import rbush from 'rbush'
import * as constants from './constants'
import { AnyGeoJSON, State } from './types'

const create = <P>(type: string) => (payload: P) => ({ type, payload })

export const init = create<{
  data: AnyGeoJSON[]
  lines: number[][][]
  coordinates: number[][]
  bbox: rbush.BBox
}>(constants.INIT)

export const updateMousePosition = create<number[]>(
  constants.UPDATE_MOUSE_POSITION
)

export const updatePositions = create<{
  data: AnyGeoJSON[]
  lines: number[][][]
  coordinates: number[][]
}>(constants.UPDATE_POSITIONS)

export const toggleDrag = create<number[][]>(constants.UPDATE_DRAGGING)

export const updateSettings = create<State['settings']>(
  constants.UPDATE_SETTINGS
)

export const onClick = create<number[]>(constants.CLICK)
export const onFinish = create<void>(constants.FINISH)
export const increaseHoverTransition = create<void>(
  constants.INCREASE_HOVER_TRANSITION
)
