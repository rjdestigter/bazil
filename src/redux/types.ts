import kdbush from 'kdbush'
import rbush from 'rbush'

import {
  AllGeoJSON,
  Feature,
  FeatureCollection,
  Geometries,
  GeometryCollection,
  LineString,
  MultiLineString,
  MultiPolygon,
  Point,
  Polygon,
} from '@turf/helpers'

export type PolyLike = Polygon | MultiPolygon | Feature<Polygon | MultiPolygon>

export type GeoJSON =
  | Geometries
  | GeometryCollection
  | Feature<Geometries>
  | FeatureCollection<Geometries>

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
  data: GeoJSON[]
  meta: GeoJSON[]
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
