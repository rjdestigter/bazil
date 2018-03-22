import {
  Feature,
  FeatureCollection,
  featureCollection as toFeatureCollection,
  Geometries,
  GeometryCollection,
  point as toPoint,
} from '@turf/helpers'

import bbox from '@turf/bbox'
import { coordAll } from '@turf/meta'

import pointsWithinPolygon from '@turf/points-within-polygon'

import kdbush from 'kdbush'
import _ from 'lodash'
import rbush from 'rbush'

import * as constants from './constants'

import { findLineSnapPosition } from './utils'

import { AnyGeoJSON, Item, State } from './types'

interface Action<P> {
  type: string
  payload: P
}

const updateMousePosition = (state: State, action: Action<number[]>): State => {
  const [x, y] = action.payload
  const geopoints = toFeatureCollection([toPoint([x, y])])
  let hoverIndex = state.editing

  if (state.editing < 0) {
    state.data.find((geom, index) => {
      const result = pointsWithinPolygon(geopoints, geom)
      if (result.features.length) {
        hoverIndex = index
        return true
      }

      return false
    })
  }

  const nearPoints = state.indices.points.within(x, y, 10)

  if (state.settings.snap.points) {
    if (nearPoints.length) {
      return {
        ...state,
        line: undefined,
        snap: 'point',
        near: nearPoints.map(i => state.coordinates[i]),
        mousePosition: state.coordinates[nearPoints[0]],
        hoverIndex,
      }
    }
  }

  if (state.settings.snap.lines) {
    const nearLine = findLineSnapPosition(action.payload, state.lines)

    if (nearLine.distance) {
      return {
        ...state,
        snap: 'line',
        line: nearLine.line,
        near: [],
        mousePosition: nearLine.point,
        hoverIndex,
      }
    }
  }

  return {
    ...state,
    line: undefined,
    snap: undefined,
    near: nearPoints.map(i => state.coordinates[i]),
    mousePosition: action.payload,
    hoverIndex,
  }
}

const onClick = (state: State, action: Action<number[]>): State => {
  return {
    ...state,
    editing: (state.editing = state.hoverIndex),
  }
}

const init = (
  state: State,
  action: Action<{
    coordinates: number[][]
    lines: number[][][]
    data: AnyGeoJSON[]
    bbox: rbush.BBox
  }>
): State => {
  const coordinates: number[][] = []
  const items: Item[] = []

  const data: AnyGeoJSON[] = action.payload.data.map((geom, index) => {
    const [minX, minY, maxX, maxY] = bbox(geom)
    const geojson = {
      ...geom,
      bbox: [minX, minY, maxX, maxY] as [number, number, number, number],
    }

    items.push({
      minX,
      minY,
      maxX,
      maxY,
      data: geojson,
      index,
    })

    coordinates.push(...coordAll(geom))

    return geojson
  })

  state.indices.polygons.clear()
  state.indices.polygons.load(items)

  return {
    ...state,
    ...action.payload,
    indices: {
      polygons: state.indices.polygons,
      points: kdbush(action.payload.coordinates),
    },
  }
}

const updatePositions = (
  state: State,
  action: Action<{
    data: AnyGeoJSON[]
    coordinates: number[][]
    lines: number[][][]
  }>
): State => {
  // const empty: number[][] = []

  const coordinates: number[][] = []
  const items: Item[] = []

  const data: AnyGeoJSON[] = action.payload.data.map((geom, index) => {
    const [minX, minY, maxX, maxY] = bbox(geom)
    const geojson = {
      ...geom,
      bbox: [minX, minY, maxX, maxY] as [number, number, number, number],
    }

    items.push({
      minX,
      minY,
      maxX,
      maxY,
      data: geojson,
      index,
    })

    coordinates.push(...coordAll(geom))

    return geojson
  })

  state.indices.polygons.clear()
  state.indices.polygons.load(items)

  return {
    ...state,
    ...action.payload,
    indices: {
      polygons: state.indices.polygons,
      points: kdbush(action.payload.coordinates),
    },
    dragging: [],
  }
}

export const updateDragging = (state: State, action: Action<number[][]>) => ({
  ...state,
  dragging: action.payload,
})

export const updateSettings = (
  state: State,
  action: Action<State['settings']>
) => ({
  ...state,
  settings: action.payload,
})

export const initialState: State = {
  mousePosition: [0, 0],
  line: undefined,
  snap: undefined,
  near: [],
  data: [],
  meta: [],
  indices: {
    points: kdbush([]),
    polygons: rbush(),
  },
  drawing: [],
  coordinates: [],
  lines: [],
  dragging: [],
  hoverIndex: -1,
  editing: -1,
  settings: {
    snap: {
      points: true,
      lines: true,
    },
    topology: true,
  },
}

export default (state: State, action: any): State => {
  switch (action.type) {
    case constants.INIT:
      return init(state || initialState, action)
    case constants.UPDATE_MOUSE_POSITION:
      return updateMousePosition(state || initialState, action)
    case constants.UPDATE_POSITIONS:
      return updatePositions(state, action)
    case constants.UPDATE_DRAGGING:
      return updateDragging(state, action)
    case constants.UPDATE_SETTINGS:
      return updateSettings(state, action)
    case constants.CLICK:
      return onClick(state, action)
    default:
      return state || initialState
  }
}
