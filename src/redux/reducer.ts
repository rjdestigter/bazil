import {
  Feature,
  FeatureCollection,
  featureCollection as toFeatureCollection,
  Geometries,
  GeometryCollection,
  point as toPoint,
} from '@turf/helpers'

import { coordAll } from '@turf/meta'

import pointsWithinPolygon from '@turf/points-within-polygon'

import kdbush from 'kdbush'
import _ from 'lodash'

import * as constants from './constants'

import {
  findLineSnapPosition,
  replacePointInGeoJSON,
  replacePosition,
} from './utils'

import { AnyGeoJSON, State } from './types'

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

  const nearPoints = state.index.within(x, y, 10)

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

const onClick = (state: State, action: Action<number[]>) => {
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
  }>
): State => ({
  ...state,
  ...action.payload,
  index: kdbush(action.payload.coordinates),
})

const updatePositions = (
  state: State,
  action: Action<{
    data: AnyGeoJSON[]
    coordinates: number[][]
    lines: number[][][]
  }>
) => {
  const empty: number[][] = []
  const coordinates = empty.concat(
    ...action.payload.data.map(geom => coordAll(geom))
  )

  return {
    ...state,
    ...action.payload,
    index: kdbush(action.payload.coordinates),
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
  index: kdbush([]),
  drawing: [],
  coordinates: [],
  lines: [],
  dragging: [],
  hoverIndex: -1,
  editing: -1,
  settings: {
    snap: {
      points: false,
      lines: false,
    },
    topology: false,
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
