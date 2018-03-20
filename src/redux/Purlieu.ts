import {
  Geometries,
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Position,
} from '@turf/helpers'
import { coordAll, geomEach } from '@turf/meta'
import * as kdbush from 'kdbush'
import * as L from 'leaflet'
import * as _ from 'lodash'
import { AnyAction, applyMiddleware, createStore, Reducer, Store } from 'redux'
import { createLogger } from 'redux-logger'
import * as actions from './actions'
import reducer, { AnyGeoJSON, initialState, State } from './reducer'
import {
  pointToLineDistance,
  projectGeoJSON,
  replacePointInGeoJSON,
} from './utils'

interface Config {
  canvas: HTMLCanvasElement
  fromLngLat: (lnglat: number[]) => number[]
  toLngLat: (xy: number[]) => number[]
  data: AnyGeoJSON[]
}

interface Project {
  fromLngLat: (lnglat: number[]) => number[]
  toLngLat: (xy: number[]) => number[]
}

const e2xy = (e: MouseEvent) => [e.offsetX, e.offsetY]

class Purlieu {
  public store: Store<State>
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private data: AnyGeoJSON[]
  private fromLngLat: (xy: number[]) => number[]
  private toLngLat: (xy: number[]) => number[]

  constructor({ canvas, fromLngLat, toLngLat, data = [] }: Config) {
    this.data = data
    this.fromLngLat = fromLngLat
    this.toLngLat = toLngLat

    this.store = createStore(
      reducer,
      initialState,
      applyMiddleware(createLogger())
    )

    // this.store.dispatch(actions.init({ data: data || [] }))
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      e.stopPropagation()
      this.store.dispatch(actions.updateMousePosition(e2xy(e)))
    })

    this.store.subscribe(() => this.draw())

    this.init()

    const onMouseDown = (e: MouseEvent) => {
      const timeout = setTimeout(() => {
        const state = this.store.getState()
        canvas.removeEventListener('mouseup', onTimeout)
        canvas.addEventListener('mouseup', onMouseUp)

        if (state.near.length) {
          this.store.dispatch(actions.toggleDrag(state.near))
        }
      }, 100)

      const onTimeout = () => clearTimeout(timeout)

      canvas.addEventListener('mouseup', onTimeout)
    }

    const onMouseUp = (e: MouseEvent) => {
      if (this.store.getState().dragging) {
        this.store.dispatch(
          actions.updatePositions({
            positions: this.store.getState().dragging,
            point: this.store.getState().mousePosition,
          })
        )
      }

      this.draw()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.foo = this
  }

  public onChange(cb: (data: AnyGeoJSON[]) => void) {
    let current = this.store.getState()
    const project = ([x, y, a, b]: number[]) => {
      if (a && b) {
        return [a, b]
      }

      return this.toLngLat([x, y])
    }

    this.store.subscribe(() => {
      const next = this.store.getState()

      if (next.data !== current.data) {
        current = next
        cb(next.data.map(projectGeoJSON(project)()))
      }
    })
  }

  public init(data: AnyGeoJSON[] = this.data) {
    console.time('init')
    const project = (xy: number[]) => [...this.fromLngLat(xy), ...xy]
    const collection: {
      lines: number[][][]
      coordinates: number[][]
    } = { lines: [], coordinates: [] }
    this.store.dispatch(
      actions.init({
        data: data.map(projectGeoJSON(project)(collection)),
        ...collection,
      })
    )
    console.timeEnd('init')
  }

  private draw() {
    const state = this.store.getState()

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const markers = ([] as number[][]).concat(
      ...state.data.map(geom => this.drawGeom(geom))
    )

    if (state.line) {
      this.ctx.beginPath()
      this.ctx.moveTo(state.line[0][0], state.line[0][1])
      this.ctx.lineTo(state.line[1][0], state.line[1][1])
      this.ctx.strokeStyle = 'Cyan'
      this.ctx.lineWidth = 2
      this.ctx.stroke()
      this.ctx.strokeStyle = 'Black'
      this.ctx.lineWidth = 1
    }

    this.ctx.fillStyle = '#ffffff'
    this.ctx.strokeStyle = '#000000'

    markers.map(([x, y]) => {
      this.ctx.beginPath()
      this.ctx.arc(x, y, 5, 0, 2 * Math.PI)
      this.ctx.fill()
      this.ctx.stroke()
    })

    this.drawMousePosition()
  }

  private drawGeom(geom: AnyGeoJSON): number[][] {
    switch (geom.type) {
      case 'GeometryCollection':
        return ([] as number[][]).concat(
          ...geom.geometries.map(g => this.drawGeom(g))
        )
      case 'MultiPolygon':
        return this.multiPolygon(geom)
    }

    return []
  }

  private drawMousePosition() {
    const state = this.store.getState()
    const [x, y] = state.mousePosition
    const near = state.index.within(x, y, 10)

    this.ctx.beginPath()
    this.ctx.fillStyle =
      state.snap === 'point'
        ? 'Yellow'
        : state.snap === 'line' ? 'Orange' : '#ffffff'

    this.ctx.strokeStyle = '#000000'
    this.ctx.arc(x, y, state.snap ? 10 : 5, 0, 2 * Math.PI)
    this.ctx.fill()
    this.ctx.stroke()
  }

  private multiPolygon = (geom: MultiPolygon) => {
    const state = this.store.getState()
    const markers: number[][] = []

    geom.coordinates.forEach(polygon => {
      polygon.forEach(lineString => {
        const [first, ...rest] = lineString
        this.ctx.moveTo(first[0], first[1])
        this.ctx.beginPath()

        for (let k = 0; k < rest.length - 2; k++) {
          const [x, y] = rest[k]

          if (state.dragging.length) {
            const isDraggingPoint = state.dragging.find(point =>
              _.isEqual(point, [x, y])
            )

            if (isDraggingPoint) {
              const mxy = state.mousePosition
              markers.push(mxy)
              this.ctx.lineTo(mxy[0], mxy[1])
            } else {
              markers.push([x, y])
              this.ctx.lineTo(x, y)
            }
          } else {
            markers.push([x, y])
            this.ctx.lineTo(x, y)
          }
        }

        this.ctx.closePath()
        this.ctx.fillStyle = 'rgba(0,0,0,0.1)'
        this.ctx.fill()
        // this.ctx.fill()
        this.ctx.stroke()
      })
    })

    return markers
  }
}

export default (config: Config) => new Purlieu(config)
