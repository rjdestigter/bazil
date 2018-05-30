import rbush from 'rbush'
import * as constants from './constants'
import { State } from './types'
import { AllGeoJSON, Feature, Point } from '@turf/helpers'

const create = <P, T extends string>(type: T) => (payload: P) => ({
  type,
  payload,
})

export const init = create<
  {
    data: AllGeoJSON[]
    lines: number[][][]
    coordinates: number[][]
    bbox: rbush.BBox
  },
  typeof constants.INIT
>(constants.INIT)

export const updateMousePosition = create<
  number[],
  typeof constants.UPDATE_MOUSE_POSITION
>(constants.UPDATE_MOUSE_POSITION)

export const updatePositions = create<
  {
    data: AllGeoJSON[]
    lines: number[][][]
    coordinates: number[][]
  },
  typeof constants.UPDATE_POSITIONS
>(constants.UPDATE_POSITIONS)

export const toggleDrag = create<number[][], typeof constants.UPDATE_DRAGGING>(
  constants.UPDATE_DRAGGING
)

export const updateSettings = create<
  State['settings'],
  typeof constants.UPDATE_SETTINGS
>(constants.UPDATE_SETTINGS)

export const onClick = create<number[], typeof constants.CLICK>(constants.CLICK)
export const onFinish = create<void, typeof constants.FINISH>(constants.FINISH)
export const increaseHoverTransition = create<
  any,
  typeof constants.INCREASE_HOVER_TRANSITION
>(constants.INCREASE_HOVER_TRANSITION)

export const onEdit = create<Feature<Point>, typeof constants.EDIT>(
  constants.EDIT
)
export const onUpdate = create<AllGeoJSON[], typeof constants.UPDATE>(
  constants.UPDATE
)

export type Action =
  | ReturnType<typeof init>
  | ReturnType<typeof updateMousePosition>
  | ReturnType<typeof updatePositions>
  | ReturnType<typeof toggleDrag>
  | ReturnType<typeof updateSettings>
  | ReturnType<typeof onClick>
  | ReturnType<typeof onFinish>
  | ReturnType<typeof increaseHoverTransition>
  | ReturnType<typeof onEdit>
  | ReturnType<typeof onUpdate>
