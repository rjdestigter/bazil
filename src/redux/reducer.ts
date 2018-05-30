import {
  Feature,
  FeatureCollection,
  featureCollection as toFeatureCollection,
  Geometries,
  GeometryCollection,
  point as toPoint,
  AllGeoJSON,
} from '@turf/helpers'

// Actions
import * as actions from './actions'

import bbox from '@turf/bbox'
import { coordAll } from '@turf/meta'

import pointsWithinPolygon from '@turf/points-within-polygon'

import kdbush from 'kdbush'
import _ from 'lodash'
import rbush from 'rbush'

import * as constants from './constants'

import { findLineSnapPosition, isPolyLike, isFeature } from './utils'

import { Item, State } from './types'

const updateMousePosition = (
  state: State,
  action: ReturnType<typeof actions.updateMousePosition>
): State => {
  const [x, y] = action.payload
  const geopoints = toFeatureCollection([toPoint([x, y])])
  let hoverIndex = state.editing

  // If the user is not editing determine if the mouse position
  // is hovering over a feature
  if (state.editing < 0) {
    state.data.find((geom, index) => {
      if (isPolyLike(geom)) {
        const polyGeom = isFeature(geom) ? geom.geometry : geom

        if (polyGeom) {
          const result = pointsWithinPolygon(geopoints, polyGeom)
          if (result.features.length) {
            hoverIndex = index
            return true
          }
        }
      }

      return false
    })
  }

  const hoverTransitionIndex =
    hoverIndex !== state.hoverIndex ? 0 : state.hoverTransitionIndex

  let nearPoints: number[] | undefined = undefined

  if (state.settings.snap.points) {
    nearPoints = state.indices.points.within(x, y, 10)
    if (nearPoints.length) {
      return {
        ...state,
        line: undefined,
        snap: 'point',
        near: nearPoints.map(i => state.coordinates[i]),
        mousePosition: state.coordinates[nearPoints[0]],
        hoverIndex,
        hoverTransitionIndex,
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
        hoverTransitionIndex,
      }
    }
  }

  nearPoints = nearPoints || state.indices.points.within(x, y, 10)
  return {
    ...state,
    line: undefined,
    snap: undefined,
    near: nearPoints.map(i => state.coordinates[i]),
    mousePosition: action.payload,
    hoverIndex,
    hoverTransitionIndex,
  }
}

const onClick = (
  state: State,
  action: ReturnType<typeof actions.onClick>
): State => {
  return {
    ...state,
    editing: (state.editing = state.hoverIndex),
  }
}

const onFinish = (
  state: State,
  action: ReturnType<typeof actions.onFinish>
): State => {
  return {
    ...state,
    editing: -1,
  }
}

const increaseHoverTransition = (
  state: State,
  action: ReturnType<typeof actions.increaseHoverTransition>
): State => {
  const hoverTransitionIndex = state.hoverTransitionIndex + 0.2
  return {
    ...state,
    hoverTransitionIndex:
      hoverTransitionIndex >= 20 ? 20 : hoverTransitionIndex,
  }
}

const init = (state: State, action: ReturnType<typeof actions.init>): State => {
  const coordinates: number[][] = []
  const items: Item[] = []

  const data: AllGeoJSON[] = action.payload.data.map((geom, index) => {
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
  action: ReturnType<typeof actions.updatePositions>
): State => {
  // const empty: number[][] = []

  const coordinates: number[][] = []
  const items: Item[] = []

  const data: AllGeoJSON[] = action.payload.data.map((geom, index) => {
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

export const updateDragging = (
  state: State,
  action: ReturnType<typeof actions.toggleDrag>
) => ({
  ...state,
  dragging: action.payload,
})

export const updateSettings = (
  state: State,
  action: ReturnType<typeof actions.updateSettings>
) => ({
  ...state,
  settings: action.payload,
})

export const initialState: State = {
  bbox: { maxX: 0, maxY: 0, minX: 0, minY: 0 },
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
  hoverTransitionIndex: 20,
  editing: -1,
  settings: {
    snap: {
      points: true,
      lines: true,
    },
    topology: true,
  },
}

export const onEdit = (
  state: State,
  action: ReturnType<typeof actions.onEdit>
): State => {
  return {
    ...state,
    data: [...state.data, action.payload],
    editing: state.data.length,
  }
}

export const onUpdate = (
  state: State,
  action: ReturnType<typeof actions.onUpdate>
): State => {
  return {
    ...state,
    data: action.payload,
  }
}

export default (state: State, action: actions.Action): State => {
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
    case constants.FINISH:
      return onFinish(state, action)
    case constants.INCREASE_HOVER_TRANSITION:
      return increaseHoverTransition(state, action)
    case constants.EDIT:
      return onEdit(state, action)
    case constants.UPDATE:
      return onUpdate(state, action)
    default:
      return state || initialState
  }
}
