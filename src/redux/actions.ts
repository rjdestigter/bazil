import * as constants from './constants'
import { AnyGeoJSON } from './types'

const create = <P>(type: string) => (payload: P) => ({ type, payload })

export const init = create<{
  data: AnyGeoJSON[]
  lines: number[][][]
  coordinates: number[][]
}>(constants.INIT)

export const updateMousePosition = create<number[]>(
  constants.UPDATE_MOUSE_POSITION
)

export const updatePositions = create<{
  positions: number[][]
  point: number[]
}>(constants.UPDATE_POSITIONS)

export const toggleDrag = create<number[][]>(constants.UPDATE_DRAGGING)
