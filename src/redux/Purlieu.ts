import {
  Geometries,
  GeometryCollection,
  MultiPolygon,
  Polygon,
  Position,
  Point,
  AllGeoJSON,
  Feature,
  FeatureCollection,
  MultiLineString,
  LineString,
  MultiPoint,
  Geometry,
  featureCollection,
} from '@turf/helpers'

import rewind from '@turf/rewind'

import { coordAll, geomEach } from '@turf/meta'
import * as kdbush from 'kdbush'
import * as L from 'leaflet'
import * as _ from 'lodash'
import { AnyAction, applyMiddleware, createStore, Reducer, Store } from 'redux'
import { createLogger } from 'redux-logger'
import * as actions from './actions'
import reducer, { initialState } from './reducer'
import { PolyLike, State } from './types'
import { pointToLineDistance, projectGeoJSON } from './utils'

// Canvas
import draw from '../canvas/multiPolygon'

const pointIsEqual = ([x1, y1]: number[], [x2, y2]: number[]): boolean =>
  _.isEqual([x1, y1], [x2, y2])

interface Config {
  canvas: HTMLCanvasElement
  fromLngLat: (lnglat: number[]) => number[]
  toLngLat: (xy: number[]) => number[]
  data: AllGeoJSON[]
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
  insertAt: number[] | undefined
}

type Mappable = Geometries | GeometryCollection | Feature | FeatureCollection

const e2xy = (e: MouseEvent) => [e.offsetX, e.offsetY]

class Purlieu {
  public store: Store<State>
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private data: AllGeoJSON[]
  private fromLngLat: (xy: number[]) => number[]
  private toLngLat: (xy: number[]) => number[]
  private nextData: AllGeoJSON[] = []
  private mouseDown: boolean
  private insertAt: number[] | undefined

  private _draw: {
    polygon: (result: Result) => (geom: Polygon) => Polygon
    multiPolygon: (result: Result) => (geom: MultiPolygon) => MultiPolygon
  }

  constructor({ canvas, fromLngLat, toLngLat, data = [] }: Config) {
    this.data = data.map(geom => rewind(geom))
    this.fromLngLat = fromLngLat
    this.toLngLat = toLngLat
    this.mouseDown = false

    this.store = createStore<State>(
      reducer,
      initialState
      // applyMiddleware(createLogger())
    )

    // this.store.dispatch(actions.init({ data: data || [] }))
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    this._draw = draw()(this.ctx)(this.store)

    const onMouseDownMain = (e: MouseEvent) => {
      const onMouseDownMainContinued = () => {
        canvas.removeEventListener('mouseup', onMouseDownMainContinued)
        canvas.removeEventListener('mousemove', onMove)

        if (this.store.getState().hoverIndex >= 0) {
          canvas.removeEventListener('mousedown', onMouseDownMain)
          this.store.dispatch(actions.onClick(e2xy(e)))
          canvas.addEventListener('mousedown', onMouseDown)
          document.addEventListener('keypress', onCancel)
        }
      }

      const onMove = () => {
        canvas.removeEventListener('mouseup', onMouseDownMainContinued)
        canvas.removeEventListener('mousemove', onMove)
      }

      canvas.addEventListener('mousemove', onMove)
      canvas.addEventListener('mouseup', onMouseDownMainContinued)
    }

    const onCancel = (e: KeyboardEvent) => {
      if (e.keyCode === 13) {
        document.removeEventListener('keypress', onCancel)
        this.store.dispatch(actions.onFinish(undefined))
        canvas.addEventListener('mousedown', onMouseDownMain)
        canvas.removeEventListener('mousedown', onMouseDown)
      }
    }

    canvas.addEventListener('mousedown', onMouseDownMain)

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      this.store.dispatch(actions.updateMousePosition(e2xy(e)))
    })

    this.store.subscribe(() => this.draw())

    this.init()

    const onMouseDown = (e: MouseEvent) => {
      const state = this.store.getState()

      // If the user potentiall will drag a marker
      if (state.near.length) {
        // Sets state in to dragging mode if near a marker
        const onContinueWithMouseDown = () => {
          canvas.removeEventListener('mouseup', onMouseUpToSoon)
          canvas.removeEventListener('mousemove', onMove)
          canvas.addEventListener('mouseup', onMouseUp)

          if (state.near.length) {
            this.store.dispatch(actions.toggleDrag(state.near))
          } else {
            this.insertAt = e2xy(e)
          }
        }

        // Start setting drag state in 100 ms
        const continueIn100Ms = setTimeout(onContinueWithMouseDown, 100)

        // Cancels setting drag state timeout
        const onCancelContinue = () => clearTimeout(continueIn100Ms)

        // On mousemove we know we want to drag so we
        // - cancel the timeout
        // - cancel the this mousemove listener
        // - and continue with setting drag state
        const onMove = () => {
          canvas.removeEventListener('mousemove', onMove)
          onCancelContinue()
          onContinueWithMouseDown()
        }

        // If the user release the mouse click to soon we
        // - cancel the timeout
        // - cancel the listener for mousemove
        const onMouseUpToSoon = () => {
          onCancelContinue()
          canvas.removeEventListener('mousemove', onMove)
          this.insertAt = e2xy(e)
        }

        // Register event listener for mouseup and mousemove
        canvas.addEventListener('mouseup', onMouseUpToSoon)
        canvas.addEventListener('mousemove', onMove)
      } else {
        this.insertAt = e2xy(e)
        this.store.dispatch({ type: 'NOOP' })
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
    }

    const onMouseUp = (e: MouseEvent) => {
      canvas.removeEventListener('mouseup', onMouseUp)
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
  }

  public onTogglePointSnap() {
    const settings = this.store.getState().settings

    this.store.dispatch(
      actions.updateSettings({
        ...settings,
        snap: {
          ...settings.snap,
          points: !settings.snap.points,
        },
      })
    )
  }
  public onToggleLineSnap() {
    const settings = this.store.getState().settings

    this.store.dispatch(
      actions.updateSettings({
        ...settings,
        snap: {
          ...settings.snap,
          lines: !settings.snap.lines,
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

  public onAddPolygon() {
    const onAddPoint = (e: MouseEvent) => {
      this.canvas.removeEventListener('click', onAddPoint)
      const coordinates = e2xy(e)
      this.store.dispatch(
        actions.onEdit({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates,
          },
          properties: {
            editing: true,
          },
        })
      )
    }

    this.canvas.addEventListener('click', onAddPoint)
  }

  public onChange(cb: (data: AllGeoJSON[]) => void) {
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

  public init(data: AllGeoJSON[] = this.data) {
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
        bbox: {
          minX: 0,
          minY: 0,
          maxX: this.canvas.width,
          maxY: this.canvas.height,
        },
      })
    )
    console.timeEnd('init')
  }

  private draw() {
    const state = this.store.getState()

    if (state.editing >= 0) {
      this.canvas.style.cursor = 'none'
    } else if (state.hoverIndex >= 0) {
      this.canvas.style.cursor = 'pointer'
    } else {
      this.canvas.style.cursor = 'inherit'
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    const result: Result = {
      markers: [],
      placeholderLines: [],
      draggedMarkerIsDrawn: false,
      index: -1,
      insertAt: this.insertAt,
    }

    const items = state.indices.polygons.search(state.bbox)

    this.nextData = state.data.map((geom, index) => {
      const item = items.find(i => i.index === index)

      if (item) {
        return this.drawGeom(geom, { ...result, index: item.index })
      }

      return geom
    })

    if (state.editing >= 0 && state.line) {
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
      let drew: { [id: string]: undefined | boolean } = {}
      result.markers.map(([x, y]) => {
        this.ctx.beginPath()
        this.ctx.arc(x, y, 5, 0, 2 * Math.PI)

        if (drew[`${x}:${y}`]) {
          this.ctx.fillStyle = 'Red'
        } else {
          this.ctx.fillStyle = 'White'
        }

        this.ctx.fill()
        this.ctx.stroke()

        drew[`${x}:${y}`] = true
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
    }

    this.drawMousePosition()

    this.insertAt = undefined

    if (state.hoverTransitionIndex < 20) {
      requestAnimationFrame(() => {
        this.store.dispatch(actions.increaseHoverTransition(undefined))
      })
    }
  }

  private drawGeom(geom: AllGeoJSON, result: Result): AllGeoJSON {
    switch (geom.type) {
      case 'GeometryCollection':
        const geometryCollection: GeometryCollection = geom as any
        const nextGeometries = geometryCollection.geometries.map(g =>
          this.drawGeom(g, result)
        )

        return Object.assign({}, geom, {
          geometries: nextGeometries,
        })
      case 'MultiPolygon':
        const multiPolygon: MultiPolygon = geom as any
        return this._draw.multiPolygon(result)(multiPolygon)
      case 'Polygon':
        const polygon: Polygon = geom as any
        return this._draw.polygon(result)(polygon)
      case 'Feature':
        const feature: Feature = geom as any
        if (feature.geometry) {
          const geometry = feature.geometry

          return {
            ...feature,
            geometry: this.drawGeom(geometry, result),
          }
        }
        break
      case 'FeatureCollection':
        return {
          ...geom,
          features: geom.features.map(g => this.drawGeom(g, result)),
        }
    }

    return [] as any
  }

  private drawMousePosition() {
    const state = this.store.getState()

    if (state.editing >= 0) {
      const [x, y] = state.mousePosition
      const [lng, lat] = this.toLngLat([x, y]).map(
        n => Math.round(n * 1000000) / 1000000
      )
      const near = state.indices.points.within(x, y, 10)

      this.ctx.beginPath()
      this.ctx.arc(x, y, 2, 0, 2 * Math.PI)
      // this.ctx.arc(x, y, state.snap ? 10 : 5, 0, 2 * Math.PI)

      this.ctx.strokeStyle = 'transparent'
      this.ctx.fillStyle = '#000000'
      this.ctx.fill()
      this.ctx.stroke()

      this.ctx.beginPath()
      this.ctx.arc(x, y, 25, 0, 2 * Math.PI)
      this.ctx.strokeStyle = '#000000'
      // this.ctx.lineWidth = 2
      this.ctx.stroke()

      this.ctx.font = '12px monospace, serif'
      this.ctx.fillText(`${lng}, ${lat}`, x + 40, y - 40)
      // this.ctx.lineWidth = 1
      // this.ctx.fillStyle =
      // state.snap === 'point'
      //   ? 'Yellow'
      //   : state.snap === 'line' ? 'Orange' : '#ffffff'
    }
  }
}

export default (config: Config) => new Purlieu(config)
