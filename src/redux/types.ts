import kdbush from 'kdbush'
import rbush from 'rbush'

import {
  Feature,
  FeatureCollection,
  Geometries,
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Point,
  AllGeoJSON,
  LineString,
  MultiLineString,
} from '@turf/helpers'

export type PolyLike =
  | Polygon
  | MultiPolygon
  | Feature<Polygon>
  | Feature<MultiPolygon>

export interface Item extends rbush.BBox {
  data: AllGeoJSON
  index: number
}

export interface State {
  bbox: rbush.BBox
  mousePosition: number[]
  line: number[][] | undefined
  snap: 'point' | 'line' | undefined
  near: number[][]
  data: AllGeoJSON[]
  meta: AllGeoJSON[]
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
