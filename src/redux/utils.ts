import _ from 'lodash'

import {
  Geometries,
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Position,
} from '@turf/helpers'

import { AnyGeoJSON } from './types'

type Project = (xy: number[]) => number[]

interface Collect {
  coordinates: number[][]
  lines: number[][][]
}

const defaultCollect = (): Collect => ({ coordinates: [], lines: [] })

export const pointIsEqual = ([x1, y1]: number[], [x2, y2]: number[]): boolean =>
  _.isEqual([x1, y1], [x2, y2])

export const projectGeoJSON = (project: Project) => (
  collect: Collect = defaultCollect()
) => (geom: AnyGeoJSON): AnyGeoJSON => {
  switch (geom.type) {
    case 'MultiPolygon':
      return projectMultiPolygon(project)(collect)(geom)
    case 'Polygon':
      return projectPolygon(project)(collect)(geom)
    case 'GeometryCollection':
      return projectGeometryCollection(project)(collect)(geom)
    default:
      return geom
  }
}

export const replacePointInGeoJSON = (
  positions: number[][],
  point: number[]
) => (geom: AnyGeoJSON): AnyGeoJSON => {
  switch (geom.type) {
    case 'MultiPolygon':
      return replacePointInMultiPolygon(positions, point)(geom)
    case 'Polygon':
      return replacePointInPolygon(positions, point)(geom)
    case 'GeometryCollection':
      return replacePointInGeometryCollection(positions, point)(geom)
    default:
      return geom
  }
}

export const projectGeometryCollection = (project: Project) => (
  collect: Collect = defaultCollect()
) => (geom: GeometryCollection) => ({
  ...geom,
  geometries: geom.geometries.map(
    projectGeoJSON(project)(collect)
  ) as Geometries[],
})

export const replacePointInGeometryCollection = (
  positions: number[][],
  point: number[]
) => (geom: GeometryCollection) => ({
  ...geom,
  geometries: geom.geometries.map(
    replacePointInGeoJSON(positions, point)
  ) as Geometries[],
})

export const projectMultiPolygon = (project: Project) => (
  collect: Collect = defaultCollect()
) => (polygon: MultiPolygon) => ({
  ...polygon,
  coordinates: polygon.coordinates.map(poly =>
    poly.map(projectPositions(project)(collect))
  ),
})

export const replacePointInMultiPolygon = (
  positions: number[][],
  point: number[]
) => (polygon: MultiPolygon) => ({
  ...polygon,
  coordinates: polygon.coordinates.map(poly =>
    poly.map(replacePosition(positions, point))
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

export const replacePointInPolygon = (
  positions: number[][],
  point: number[]
) => (polygon: Polygon) => {
  return {
    ...polygon,
    coordinates: polygon.coordinates.map(replacePosition(positions, point)),
  }
}

export const projectPositions = (project: Project) => (
  collect: Collect = defaultCollect()
) => (coords: Position[]) =>
  coords.map((coord, index) => {
    const projected = project(coord)

    collect.coordinates.push(projected)

    if (index > 0) {
      collect.lines.push([
        collect.coordinates[collect.coordinates.length - 2],
        projected,
      ])
    }

    return projected
  })

export const replacePosition = (positions: number[][], point: number[]) => (
  coords: Position[]
) =>
  coords.map((coord, index) => {
    const isInList = positions.find(pos => pointIsEqual(pos, coord))

    if (isInList) {
      return point
    }

    return coord
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
