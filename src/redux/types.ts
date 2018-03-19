import {
  Feature,
  FeatureCollection,
  Geometries,
  GeometryCollection,
} from '@turf/helpers'

export type AnyGeoJSON =
  | Feature
  | FeatureCollection
  | Geometries
  | GeometryCollection
