import kdbush from 'kdbush'
import * as _ from 'lodash'
import 'normalize.css/normalize.css'
import * as React from 'react'
import { render } from 'react-dom'
import Blip from './Map'

const root = document.getElementById('root')
render(React.createElement(Blip, {}), root)

type XY = [number, number]

function c(e: MouseEvent): XY {
  return [e.offsetX, e.offsetY]
}

function getColor() {
  const rgba = [
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 256),
    Math.floor(Math.random() * 10) / 10,
  ].join(',')

  return `rgba(${rgba})`
}

function pDistance([x, y]: XY, [[x1, y1], [x2, y2]]: [XY, XY]) {
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
  return [[xx, yy], Math.sqrt(dx * dx + dy * dy)] as [XY, number]
}

;(window as any).d = pDistance
if (root) {
  const canvas = document.createElement('canvas')

  // root.appendChild(canvas)
  const size: XY = [root.offsetWidth, root.offsetHeight]
  canvas.width = root.offsetWidth
  canvas.height = root.offsetHeight

  const ctx = canvas.getContext('2d')

  if (ctx) {
    let index = kdbush([])
    const coordinates: XY[] = []
    let circles: XY[] = []
    const polygons: XY[][] = []
    const to: XY = [0, 0]
    let hover: XY = [0, 0]
    let previousHover: XY | undefined

    const drawMarkers = () => {
      const [c1, ...cs] = circles
      circle(c1)
      cs.reduce((prev, xy) => {
        circle(xy)
        lineTo(prev, xy)
        return xy
      }, c1)
    }

    const draw = () => {
      ctx.clearRect(0, 0, size[0], size[1])

      polygons.forEach(drawPolygon)

      if (circles.length) {
        const [c1, ...cs] = circles
        circle(c1)
        cs.reduce((prev, xy) => {
          circle(xy)
          lineTo(prev, xy)
          return xy
        }, c1)
      }

      const p = drawNearestLineToHover()

      const near = index.within(hover[0], hover[1], 10)
      if (near.length) {
        circle(coordinates[near[0]], 'Yellow', 5)
      } else if (p) {
        circle(p, 'Yellow', 5)
      } else {
        circle(hover)
      }
    }

    const circle = ([x, y]: XY, color: string = 'Black', radius = 3) => {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, 360)

      ctx.fillStyle = color
      ctx.strokeStyle = color

      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = 'Black'
      ctx.strokeStyle = 'Black'
    }

    const drawPolygon = (p: XY[]) => {
      const [start, ...rest] = p

      ctx.beginPath()
      ctx.moveTo(start[0], start[1])

      const coords = [...rest]
      coords.pop()

      for (const xy of coords) {
        ctx.lineTo(xy[0], xy[1])
      }

      ctx.closePath()
      ctx.fillStyle = (p as any).color || getColor()
      ctx.fill()

      ctx.stroke()
    }

    const lineTo = ([x1, y1]: XY, [x2, y2]: XY) => {
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    const drawNearestLineToHover = (coords = hover, drawIt = true) => {
      let px: XY | undefined
      polygons.find((poly): boolean => {
        const [first, ...rest] = poly
        return !!rest.find((line, pIndex) => {
          const [xy, d] = pDistance(coords, [poly[pIndex], line])
          if (d <= 4) {
            px = xy
            if (drawIt) {
              ctx.beginPath()
              ctx.moveTo(poly[pIndex][0], poly[pIndex][1])
              ctx.lineTo(line[0], line[1])
              ctx.strokeStyle = 'Green'
              ctx.lineWidth = 2
              ctx.stroke()
              ctx.strokeStyle = 'Black'
              ctx.lineWidth = 1
            }
            return true
          }

          return false
        })
      })

      return px
    }

    const onMouseMove = (e: MouseEvent) => {
      hover = c(e)
      draw()
    }

    canvas.addEventListener('mousemove', onMouseMove)

    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      circles.push(c(e))
      draw()

      const onMove = (e2: MouseEvent) => {
        circles.pop()
        circles.push(c(e2))
        draw()
      }

      const onUp = (e2: MouseEvent) => {
        canvas.removeEventListener('mousemove', onMove)
        canvas.removeEventListener('mouseup', onUp)

        const [x, y] = c(e2)

        const near = index.within(x, y, 10)
        if (near.length) {
          circles.pop()
          circles.push(coordinates[near[0]])

          if (
            circles.length >= 3 &&
            _.isEqual(circles[0], circles[circles.length - 1])
          ) {
            const polys = [...circles]
            ;(polys as any).color = getColor()

            polygons.push(polys)
            circles = []
          }
        } else {
          const pxy = drawNearestLineToHover([x, y], false)

          if (pxy) {
            circles.pop()
            circles.push(pxy)
            coordinates.push(pxy)
          } else {
            coordinates.push([x, y])
          }
        }

        index = kdbush(coordinates)

        draw()
      }

      canvas.addEventListener('mousemove', onMove)
      canvas.addEventListener('mouseup', onUp)
    })

    ctx.moveTo(0, 0)
    ;(window as any).data = () => ({
      circles,
      coordinates,
      hover,
      index,
      polygons,
    })
  }
}
