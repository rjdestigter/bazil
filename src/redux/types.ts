import kdbush from 'kdbush'

import {
  Feature,
  FeatureCollection,
  Geometries,
  GeometryCollection,
} from '@turf/helpers'

export interface State {
  mousePosition: number[]
  line: number[][] | undefined
  snap: 'point' | 'line' | undefined
  near: number[][]
  data: AnyGeoJSON[]
  meta: AnyGeoJSON[]
  index: kdbush.KDBush<number[][]>
  coordinates: number[][]
  lines: number[][][]
  drawing: number[][]
  dragging: number[][]
  hoverIndex: number
  editing: number
  settings: {
    snap: {
      points: boolean
      lines: boolean
    }
    topology: boolean
  }
}

export type AnyGeoJSON =
  | Feature
  | FeatureCollection
  | Geometries
  | GeometryCollection
