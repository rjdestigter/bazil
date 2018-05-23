import { MultiPolygon, Polygon } from '@turf/helpers'
import * as _ from 'lodash'
import { Store } from 'redux'
import { State } from '../../typings/index'
import { pointIsEqual } from '../redux/utils'

interface Result {
  markers: number[][]
  placeholderLines: number[][][]
  draggedMarkerIsDrawn: boolean
  index: number
}

type Stroke = (ctx: CanvasRenderingContext2D, geom: any) => void

type DrawFn<T> = (result: Result) => (coords: T) => T

type DrawMultiPolygonCoords = DrawFn<MultiPolygon['coordinates']>
type DrawPolygonCoords = DrawFn<Polygon['coordinates']>
type DrawLinearRing = DrawFn<number[][]>

export default (stroke: Stroke = strokePolygon) => (
  ctx: CanvasRenderingContext2D
) => {
  return (store: Store<State>) => {
    const linearRing = drawLinearRingCoordinates(ctx)(store)
    const polygonCoordinates = drawPolygonCoordinates(linearRing)(ctx)(store)
    const multiPolygonCoordinates = drawMultiPolygonCoordinates(
      polygonCoordinates
    )(ctx)(store)

    const polygon = (result: Result) => (geom: Polygon) => {
      const next = {
        ...geom,
        coordinates: polygonCoordinates(result)(geom.coordinates),
      }

      stroke(ctx, geom)
      ctx.fill()
      ctx.stroke()

      console.log(geom.coordinates)
      console.info(next.coordinates)

      return next
    }

    const multiPolygon = (result: Result) => (geom: MultiPolygon) => {
      const next = {
        ...geom,
        coordinates: multiPolygonCoordinates(result)(geom.coordinates),
      }

      stroke(ctx, geom)
      ctx.fill()
      ctx.stroke()

      return next
    }

    return {
      polygon,
      multiPolygon,
    }
  }
}

export const strokePolygon: Stroke = (
  ctx: CanvasRenderingContext2D,
  geom: any
) => {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
  ctx.strokeStyle = '#333333'
}

export const drawMultiPolygon = (draw: DrawMultiPolygonCoords) => (
  ctx: CanvasRenderingContext2D
) => (store: Store<State>) => (
  geom: MultiPolygon,
  result: Result
): MultiPolygon => {
  return { ...geom, coordinates: draw(result)(geom.coordinates) }
}

export const drawCoordinate = (ctx: CanvasRenderingContext2D) => (
  store: Store<State>
) => (result: Result) => (
  fn:
    | typeof CanvasRenderingContext2D['prototype']['lineTo']
    | typeof CanvasRenderingContext2D['prototype']['moveTo']
) => (coordinate: number[], prev: number[], next: number[]) => {
  const state = store.getState()
  const [x, y] = coordinate

  const isDraggingCoord = state.dragging.find(point =>
    pointIsEqual(point, coordinate)
  )

  if (
    isDraggingCoord &&
    (state.settings.topology ||
      (!result.draggedMarkerIsDrawn && state.editing === result.index))
  ) {
    result.draggedMarkerIsDrawn = true
    const [mx, my] = state.mousePosition
    fn.call(ctx, mx, my)

    if (result.index === state.editing) {
      result.markers.push([mx, my])
    }

    result.placeholderLines.push([prev, coordinate], [coordinate, next])

    return [mx, my]
  } else {
    if (result.index === state.editing) {
      result.markers.push([x, y])
    }

    fn.call(ctx, x, y)
  }

  return [x, y]
}

export const drawLinearRingCoordinates = (ctx: CanvasRenderingContext2D) => (
  store: Store<State>
) => (result: Result) => (linearRing: number[][]): number[][] => {
  const state = store.getState()
  // const [first, ...rest] = linearRing
  const nextRing: number[][] = []
  let [prevX, prevY] = linearRing[linearRing.length - 2]
  let fn = ctx.moveTo

  // const isDraggingFirst = state.dragging.find(point =>
  //   pointIsEqual(point, [prevX, prevY])
  // )

  // if (isDraggingFirst) {
  //   const [mx, my] = state.mousePosition
  //   ctx.moveTo(mx, my)
  //   nextRing.push([mx, my])

  //   if (result.index === state.editing) {
  //     result.markers.push([mx, my])
  //   }

  //   result.draggedMarkerIsDrawn = true
  //   result.placeholderLines.push(
  //     [[prevX, prevY], rest[0]],
  //     [rest[rest.length - 2], [prevX, prevY]]
  //   )
  // } else {
  //   ctx.moveTo(prevX, prevY)
  //   nextRing.push(first)

  //   if (result.index === state.editing) {
  //     result.markers.push(first)
  //   }
  // }

  for (let k = 0; k < linearRing.length - 1; k++) {
    const [x, y, a, b] = linearRing[k]

    if (
      state.settings.topology &&
      state.dragging.length &&
      state.line &&
      _.isEqual(state.line, [[prevX, prevY], [x, y]])
    ) {
      nextRing.push(state.mousePosition)
    }

    const next = drawCoordinate(ctx)(store)(result)(fn)(
      [x, y],
      [prevX, prevY],
      linearRing[k + 1] || linearRing[0]
    )

    nextRing.push(next)

    fn = ctx.lineTo
    prevX = x
    prevY = y
  }

  nextRing.push(nextRing[0])

  return nextRing
}

export const drawPolygonCoordinates = (draw: DrawLinearRing) => (
  ctx: CanvasRenderingContext2D
) => (store: Store<State>) => (result: Result) => (
  coordinates: Polygon['coordinates']
): Polygon['coordinates'] => {
  const state = store.getState()

  ctx.beginPath()
  const nextCoordinates = coordinates.map(draw(result))
  ctx.closePath()

  return nextCoordinates
}

export const drawMultiPolygonCoordinates = (draw: DrawPolygonCoords) => (
  ctx: CanvasRenderingContext2D
) => (store: Store<State>) => (result: Result) => (
  coordinates: MultiPolygon['coordinates']
): MultiPolygon['coordinates'] => {
  const state = store.getState()

  return coordinates.map(draw(result))
}
