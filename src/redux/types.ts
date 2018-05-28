import kdbush from 'kdbush'
import rbush from 'rbush'

import {
  Feature,
  FeatureCollection,
  Geometries,
  GeometryCollection,
  MultiPolygon,
  Polygon,
} from '@turf/helpers'

export type PolyLike = Polygon | MultiPolygon
export type AnyGeoJSON =
  | PolyLike
  | Feature<PolyLike>
  | FeatureCollection<PolyLike>
  | GeometryCollection

export interface Item extends rbush.BBox {
  data: AnyGeoJSON
  index: number
}

export interface State {
  bbox: rbush.BBox
  mousePosition: number[]
  line: number[][] | undefined
  snap: 'point' | 'line' | undefined
  near: number[][]
  data: AnyGeoJSON[]
  meta: AnyGeoJSON[]
  indices: {
    points: kdbush.KDBush<number[][]>
    polygons: rbush.RBush<Item>
  }
  coordinates: number[][]
  lines: number[][][]
  drawing: number[][]
  dragging: number[][]
  hoverIndex: number
  hoverTransitionIndex: number
  editing: number
  settings: {
    snap: {
      points: boolean
      lines: boolean
    }
    topology: boolean
  }
}
