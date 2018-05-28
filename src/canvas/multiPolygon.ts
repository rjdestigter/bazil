import {
  MultiPolygon,
  Polygon,
  point as turfPoint,
  lineString as turfLineString,
} from '@turf/helpers'
import * as _ from 'lodash'
import { Store } from 'redux'
import { State } from '../redux/types'
import { pointIsEqual } from '../redux/utils'
import turfMidpoint from '@turf/midpoint'
import turfBooleanPointOnLine from '@turf/boolean-point-on-line'

interface Result {
  markers: number[][]
  placeholderLines: number[][][]
  draggedMarkerIsDrawn: boolean
  index: number
  insertAt: number[] | undefined
}

type Stroke = (
  ctx: CanvasRenderingContext2D,
  options?: { hovering?: boolean; hoverTransitionIndex?: number }
) => void

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
      stroke(ctx, {
        hovering: result.index === store.getState().hoverIndex,
        hoverTransitionIndex: store.getState().hoverTransitionIndex,
      })
      ctx.fill()
      ctx.stroke()

      return next
    }

    const multiPolygon = (result: Result) => (geom: MultiPolygon) => {
      const next = {
        ...geom,
        coordinates: multiPolygonCoordinates(result)(geom.coordinates),
      }

      // stroke(ctx, geom)
      // ctx.fill()
      // ctx.stroke()

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
  maybeOptions?: {
    hovering?: boolean
    hoverTransitionIndex?: number
  }
) => {
  const options = maybeOptions || {}
  const hovering = !!options.hovering
  const hoverTransitionIndex =
    (options.hoverTransitionIndex != null
      ? options.hoverTransitionIndex
      : 20) || 20
  ctx.fillStyle = `rgba(226, 186, 38, ${
    hovering
      ? 0.8 - hoverTransitionIndex / 100
      : 0.6 + hoverTransitionIndex / 100
  })`
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

  // Determine if the user is dragging the coordinate being drawn
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
  // let fn = ctx.moveTo

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

  const length = linearRing.length - 1
  for (let k = 0; k < length; k++) {
    const [x, y, a, b] = linearRing[k]

    // If topology has been enabled
    // and the user is dragging a coordinate
    // and the current drag position is snapped to a line
    // and the current line matches the snapped line
    //
    // Then insert a new coordinate.
    if (
      state.settings.topology &&
      state.dragging.length &&
      state.line &&
      _.isEqual(state.line, [[prevX, prevY], [x, y]])
    ) {
      // Insert the mouse position as a new coordinate
      nextRing.push(state.mousePosition)
    } else if (_.isEqual(state.line, [[prevX, prevY], [x, y]])) {
      if (result.insertAt) {
        nextRing.push([(prevX + x) / 2, (prevY + y) / 2])
      }
    }

    // If drawing the first coordinate of the linear ring
    // - use ctx.moveTo
    if (k == 0) {
      const next = drawCoordinate(ctx)(store)(result)(ctx.moveTo)(
        [x, y],
        [prevX, prevY],
        linearRing[k + 1] || linearRing[0]
      )

      nextRing.push(next)

      prevX = x
      prevY = y
      // Else if the user is editing
    } else if (state.editing === result.index) {
      const next = drawCoordinate(ctx)(store)(result)(ctx.lineTo)(
        [x, y],
        [prevX, prevY],
        linearRing[k + 1] || linearRing[0]
      )

      nextRing.push(next)

      prevX = x
      prevY = y
    } else {
      const next = drawCoordinate(ctx)(store)(result)(ctx.lineTo)(
        [x, y],
        [prevX, prevY],
        linearRing[k + 1] || linearRing[0]
      )

      nextRing.push(next)

      prevX = x
      prevY = y
    }
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
  return coordinates.map(ring => {
    const next = draw(result)(ring)
    ctx.closePath()

    return next
  })
}

export const drawMultiPolygonCoordinates = (draw: DrawPolygonCoords) => (
  ctx: CanvasRenderingContext2D
) => (store: Store<State>) => (result: Result) => (
  coordinates: MultiPolygon['coordinates']
): MultiPolygon['coordinates'] => {
  const state = store.getState()

  return coordinates.map(coords => {
    const next = draw(result)(coords)
    strokePolygon(ctx, {
      hovering: result.index === state.hoverIndex,
      hoverTransitionIndex: state.hoverTransitionIndex,
    })
    ctx.fill()
    ctx.stroke()
    return next
  })
}
