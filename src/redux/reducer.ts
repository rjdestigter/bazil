import {
  Feature,
  FeatureCollection,
  Geometries,
  GeometryCollection,
} from '@turf/helpers'

import kdbush from 'kdbush'

import * as constants from './constants'

export type AnyGeoJSON =
  | Feature
  | FeatureCollection
  | Geometries
  | GeometryCollection

export interface State {
  mousePosition: number[]
  data: AnyGeoJSON[]
  meta: AnyGeoJSON[]
  index: kdbush.KDBush<number[][]>
  drawing: number[][]
}

interface Action<P> {
  type: string
  payload: P
}

const updateMousePosition = (
  state: State,
  action: Action<number[]>
): State => ({
  ...state,
  mousePosition: action.payload,
})

const init = (
  state: State,
  action: Action<{ data?: AnyGeoJSON[] }>
): State => ({
  ...state,
  data: action.payload.data || state.data,
})

export const initialState: State = {
  mousePosition: [0, 0],
  data: [],
  meta: [],
  index: kdbush([]),
  drawing: [],
}

export default (state: State, action: any) => {
  switch (action.type) {
    case constants.INIT:
      return init(state || initialState, action)
    case constants.UPDATE_MOUSE_POSITION:
      return updateMousePosition(state || initialState, action)
    default:
      return state || initialState
  }
}
