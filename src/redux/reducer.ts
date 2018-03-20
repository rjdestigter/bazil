import {
  Feature,
  FeatureCollection,
  Geometries,
  GeometryCollection,
} from '@turf/helpers'

import kdbush, { KDBush } from 'kdbush'
import _ from 'lodash'

import * as constants from './constants'

import {
  findLineSnapPosition,
  replacePointInGeoJSON,
  replacePosition,
} from './utils'

export type AnyGeoJSON =
  | Feature
  | FeatureCollection
  | Geometries
  | GeometryCollection

export interface State {
  mousePosition: number[]
  line: number[][] | undefined
  snap: 'point' | 'line' | undefined
  near: number[][]
  data: AnyGeoJSON[]
  meta: AnyGeoJSON[]
  index: KDBush<number[][]>
  coordinates: number[][]
  lines: number[][][]
  drawing: number[][]
  dragging: number[][]
}

interface Action<P> {
  type: string
  payload: P
}

const updateMousePosition = (state: State, action: Action<number[]>): State => {
  const [x, y] = action.payload

  const nearPoints = state.index.within(x, y, 10)

  if (nearPoints.length) {
    return {
      ...state,
      line: undefined,
      snap: 'point',
      near: nearPoints.map(i => state.coordinates[i]),
      mousePosition: state.coordinates[nearPoints[0]],
    }
  }

  const nearLine = findLineSnapPosition(action.payload, state.lines)

  if (nearLine.distance) {
    return {
      ...state,
      snap: 'line',
      line: nearLine.line,
      near: [],
      mousePosition: nearLine.point,
    }
  }

  return {
    ...state,
    line: undefined,
    snap: undefined,
    near: [],
    mousePosition: action.payload,
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
  action: Action<{ positions: number[][]; point: number[] }>
) => {
  const coordinates = replacePosition(
    action.payload.positions,
    action.payload.point
  )(state.coordinates)

  return {
    ...state,
    coordinates,
    lines: state.lines.map(line => {
      return replacePosition(action.payload.positions, action.payload.point)(
        line
      )
    }),
    data: state.data.map(
      replacePointInGeoJSON(action.payload.positions, action.payload.point)
    ),
    index: kdbush(coordinates),
    dragging: [],
  }
}

export const updateDragging = (state: State, action: Action<number[][]>) => ({
  ...state,
  dragging: action.payload,
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
}

export default (state: State, action: any) => {
  switch (action.type) {
    case constants.INIT:
      return init(state || initialState, action)
    case constants.UPDATE_MOUSE_POSITION:
      return updateMousePosition(state || initialState, action)
    case constants.UPDATE_POSITIONS:
      return updatePositions(state, action)
    case constants.UPDATE_DRAGGING:
      return updateDragging(state, action)
    default:
      return state || initialState
  }
}
