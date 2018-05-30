import _ from 'lodash'

import {
  AllGeoJSON,
  Feature,
  FeatureCollection,
  GeoJSONObject,
  Geometries,
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Position,
  Types as GeoJSONTypes,
} from '@turf/helpers'

import { GeoJSON, PolyLike } from './types'

type Project = (xy: number[]) => number[]

interface Collect {
  coordinates: number[][]
  lines: number[][][]
}

const defaultCollect = (): Collect => ({ coordinates: [], lines: [] })

export const pointIsEqual = ([x1, y1]: number[], [x2, y2]: number[]): boolean =>
  _.isEqual([x1, y1], [x2, y2])

export const projectGeometry = (project: Project) => (
  collect: Collect = defaultCollect()
) => (geom: Geometries): Geometries => {
  switch (geom.type) {
    case 'MultiPolygon':
      return projectMultiPolygon(project)(collect)(geom)
    case 'Polygon':
      return projectPolygon(project)(collect)(geom)
    default:
      return geom
  }
}

export const projectGeoJSON = (project: Project) => (
  collect: Collect = defaultCollect()
) => (geom: GeoJSON): GeoJSON => {
  switch (geom.type) {
    case 'FeatureCollection':
      return projectFeatureCollection(project)(collect)(geom as any)
    case 'Feature':
      return projectFeature(project)(collect)(geom)
    case 'GeometryCollection':
      return projectGeometryCollection(project)(collect)(geom)
    default:
      return projectGeometry(project)(collect)(geom)
  }
}

export const projectFeature = (project: Project) => (
  collect: Collect = defaultCollect()
) => (geom: any): Feature<Geometries> => ({
  ...geom,
  geometry: projectGeometry(project)(collect)(geom.geometry),
})

export const projectFeatureCollection = (project: Project) => (
  collect: Collect = defaultCollect()
) => (geom: any): FeatureCollection<Geometries> => ({
  ...geom,
  features: geom.features.map(projectFeature(project)(collect)),
})

export const projectGeometryCollection = (project: Project) => (
  collect: Collect = defaultCollect()
) => (geom: any): GeometryCollection => ({
  ...geom,
  geometries: geom.geometries.map(projectGeometry(project)(collect)),
})

export const projectMultiPolygon = (project: Project) => (
  collect: Collect = defaultCollect()
) => (polygon: MultiPolygon) => ({
  ...polygon,
  coordinates: polygon.coordinates.map(poly =>
    poly.map(projectPositions(project)(collect))
  ),
})

export const projectPolygon = (project: Project) => (
  collect: Collect = defaultCollect()
) => (polygon: Polygon) => {
  return {
    ...polygon,
    coordinates: polygon.coordinates.map(projectPositions(project)(collect)),
  }
}

export const projectPositions = (project: Project) => (
  collect: Collect = defaultCollect()
) => (coords: Position[]) =>
  coords.map((coord, index) => {
    const projected = project(coord)

    collect.coordinates.push([projected[0], projected[1]])

    if (index > 0) {
      collect.lines.push([
        collect.coordinates[collect.coordinates.length - 2],
        [projected[0], projected[1]],
      ])
    }

    return projected
  })

export const pointToLineDistance = (
  [x, y]: number[],
  [[x1, y1], [x2, y2]]: number[][]
) => {
  const A = x - x1
  const B = y - y1
  const C = x2 - x1
  const D = y2 - y1

  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  if (lenSq !== 0) {
    // in case of 0 length line
    param = dot / lenSq
  }

  let xx: number
  let yy: number

  if (param < 0) {
    xx = x1
    yy = y1
  } else if (param > 1) {
    xx = x2
    yy = y2
  } else {
    xx = x1 + param * C
    yy = y1 + param * D
  }

  const dx = x - xx
  const dy = y - yy
  return [[xx, yy], Math.sqrt(dx * dx + dy * dy)] as [number[], number]
}

export const findLineSnapPosition = (
  position: number[],
  lines: number[][][]
) => {
  let point: number[] = []
  let distance: number = -1
  let line: number[][] | undefined

  lines.find((poly): boolean => {
    const [xy, d] = pointToLineDistance(position, poly)

    if (d <= 5) {
      point = xy
      distance = d
      line = poly

      return true
    }

    return false
  })

  if (distance >= 0) {
    return { point, distance, line }
  }

  return { point: position, distance: 0, line }
}

export function isFeature(geom: GeoJSON): geom is Feature<Geometries> {
  return geom.type === 'Feature'
}

export const isGeom = (type: GeoJSONTypes) => {
  function isGeomOfType<T>(geom: T): geom is T
  function isGeomOfType<T>(geom: Feature<T>): geom is Feature<T>
  function isGeomOfType(geom: GeoJSON) {
    if (isFeature(geom)) {
      return geom.geometry && geom.geometry.type === type
    }

    return geom.type === type
  }

  return isGeomOfType
}

export const isPoint = isGeom('Point')
export const isPolygon = isGeom('Polygon')
export const isMultiPolygon = isGeom('MultiPolygon')

export const isPolyLike = (
  geom: GeoJSON
): geom is Polygon | MultiPolygon | Feature<Polygon | MultiPolygon> => {
  return isPolygon(geom) || isMultiPolygon(geom)
}

export const extractPoly = (
  geoJSON: GeoJSON
): Array<MultiPolygon | Polygon> => {
  switch (geoJSON.type) {
    case 'MultiPolygon':
    case 'Polygon':
      return [geoJSON]
    case 'Feature':
      return geoJSON.geometry ? extractPoly(geoJSON.geometry) : []
    case 'FeatureCollection':
      return _.flatten(geoJSON.features.map(extractPoly))
    default:
      return []
  }
}

export const getNextGeometry = (
  coordinates: number[],
  current: Geometries
): Geometries => {
  switch (current.type) {
    case 'Point':
      return {
        type: 'LineString',
        coordinates: [current.coordinates, coordinates],
      }
    case 'LineString':
      return {
        type: 'Polygon',
        coordinates: [
          [...current.coordinates, coordinates, current.coordinates[0]],
        ],
      }
    case 'Polygon':
      const polygonCoordinates = [...current.coordinates[0]]
      polygonCoordinates.splice(polygonCoordinates.length - 2, 0, coordinates)
      return {
        ...current,
        coordinates: [polygonCoordinates],
      }
    default:
      return current
  }
}
export const getNextGeoJSON = (
  coordinates: number[],
  current: GeoJSON
): GeoJSON => {
  switch (current.type) {
    case 'Feature':
      return {
        ...current,
        geometry: current.geometry
          ? getNextGeometry(coordinates, current.geometry)
          : null,
      }
    case 'FeatureCollection':
      return {
        ...current,
        features: current.features.map(feature => {
          return {
            ...feature,
            geometry: feature.geometry
              ? getNextGeometry(coordinates, feature.geometry)
              : null,
          }
        }),
      }
    case 'GeometryCollection':
      return {
        ...current,
        geometries: current.geometries.map(geometry =>
          getNextGeometry(coordinates, geometry)
        ),
      }
    default:
      return getNextGeometry(coordinates, current)
  }
}
