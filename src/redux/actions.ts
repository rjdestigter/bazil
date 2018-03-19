import * as constants from './constants'
import { AnyGeoJSON } from './types'

const create = <P>(type: string) => (payload: P) => ({ type, payload })

export const init = create<{ data?: AnyGeoJSON[] }>(constants.INIT)
export const updateMousePosition = create<number[]>(
  constants.UPDATE_MOUSE_POSITION
)
