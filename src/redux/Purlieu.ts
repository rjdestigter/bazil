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
import reducer, { initialState } from './reducer'
import { AnyGeoJSON, PolyLike, State } from './types'
import {
  pointToLineDistance,
  projectGeoJSON,
  replacePointInGeoJSON,
} from './utils'

const pointIsEqual = ([x1, y1]: number[], [x2, y2]: number[]): boolean =>
  _.isEqual([x1, y1], [x2, y2])

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

interface Result {
  markers: number[][]
  placeholderLines: number[][][]
  draggedMarkerIsDrawn: boolean
  index: number
}

const e2xy = (e: MouseEvent) => [e.offsetX, e.offsetY]

class Purlieu {
  public store: Store<State>
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private data: AnyGeoJSON[]
  private fromLngLat: (xy: number[]) => number[]
  private toLngLat: (xy: number[]) => number[]
  private nextData: AnyGeoJSON[] = []

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

    canvas.addEventListener('click', (e: MouseEvent) => {
      this.store.dispatch(actions.onClick(e2xy(e)))
    })

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
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
        const collection: {
          lines: number[][][]
          coordinates: number[][]
        } = { lines: [], coordinates: [] }

        this.nextData.map(projectGeoJSON(a => a)(collection))

        this.store.dispatch(
          actions.updatePositions({
            data: this.nextData,
            ...collection,
          })
        )
      }

      this.draw()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.foo = this
  }

  public onToggleSnap() {
    const settings = this.store.getState().settings

    this.store.dispatch(
      actions.updateSettings({
        ...settings,
        snap: {
          lines: !settings.snap.lines,
          points: !settings.snap.points,
        },
      })
    )
  }

  public onToggleTopology() {
    const settings = this.store.getState().settings

    this.store.dispatch(
      actions.updateSettings({
        ...settings,
        topology: !settings.topology,
      })
    )
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

    const result: Result = {
      markers: [],
      placeholderLines: [],
      draggedMarkerIsDrawn: false,
      index: -1,
    }

    this.nextData = state.data.map((geom, index) => {
      if (index === state.hoverIndex || index === state.editing) {
        return this.drawGeom(
          geom,
          { ...result, index },
          {
            fillStyle: 'rgba(255, 255, 255, 0.5)',
            strokeStyle: '#111111',
          }
        )
      }

      return this.drawGeom(geom, result, {
        fillStyle: 'rgba(0, 0, 0, 0.2)',
        strokeStyle: '#111111',
      })
    })

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

    if (state.editing >= 0) {
      result.markers.map(([x, y]) => {
        this.ctx.beginPath()
        this.ctx.arc(x, y, 5, 0, 2 * Math.PI)
        this.ctx.fill()
        this.ctx.stroke()
      })

      result.placeholderLines.map(line => {
        this.ctx.beginPath()
        const [[px1, py1], [px2, py2]] = line
        this.ctx.moveTo(px1, py1)
        this.ctx.strokeStyle = '#555555'
        this.ctx.setLineDash([5, 5])
        this.ctx.lineTo(px2, py2)
        this.ctx.stroke()
        this.ctx.setLineDash([0, 0])
      })

      this.placeholderLines = []
    }

    this.drawMousePosition()
  }

  private drawGeom<G>(
    geom: AnyGeoJSON,
    result: Result,
    options: { fillStyle: string; strokeStyle: string }
  ): AnyGeoJSON {
    switch (geom.type) {
      case 'GeometryCollection':
        const nextGeometries: any = geom.geometries.map(g =>
          this.drawGeom(g as PolyLike, result, options)
        )

        return {
          ...geom,
          geometries: nextGeometries,
        }
      case 'MultiPolygon':
        return this.multiPolygon(geom, result, options)
    }

    return [] as any
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

  private multiPolygon(
    geom: MultiPolygon,
    result: Result,
    options: { fillStyle: string; strokeStyle: string }
  ): MultiPolygon {
    const state = this.store.getState()

    const nexxCoordinates = geom.coordinates.map(polygon => {
      return polygon.map(lineString => {
        const [first, ...rest] = lineString
        this.ctx.moveTo(first[0], first[1])
        this.ctx.beginPath()

        const r: number[][] = [first]

        for (let k = 0; k < rest.length - 2; k++) {
          const [x, y, a, b] = rest[k]

          if (
            state.dragging.length &&
            (state.settings.topology ||
              (!result.draggedMarkerIsDrawn && state.editing === result.index))
          ) {
            const isDraggingPoint = state.dragging.find(point =>
              pointIsEqual(point, [x, y])
            )

            if (isDraggingPoint) {
              const mxy = state.mousePosition
              result.markers.push(mxy)
              this.ctx.lineTo(mxy[0], mxy[1])
              result.draggedMarkerIsDrawn = true
              result.placeholderLines.push(
                [rest[k - 1] || first, [x, y]],
                [[x, y], rest[k + 1] || first]
              )

              r.push(mxy)
            } else {
              result.markers.push([x, y])
              this.ctx.lineTo(x, y)
              r.push(rest[k])
            }
          } else {
            result.markers.push([x, y])
            this.ctx.lineTo(x, y)
            r.push(rest[k])
          }
        }

        this.ctx.closePath()
        this.ctx.fillStyle = options.fillStyle
        this.ctx.strokeStyle = options.strokeStyle
        this.ctx.fill()
        // this.ctx.fill()
        this.ctx.stroke()

        r.push(rest[rest.length - 1])
        r.push(first)
        return r
      })
    })

    return {
      ...geom,
      coordinates: nexxCoordinates,
    }
  }
}

export default (config: Config) => new Purlieu(config)
