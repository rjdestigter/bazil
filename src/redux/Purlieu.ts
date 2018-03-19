import {
  Geometries,
  GeometryCollection,
  MultiPolygon,
  Polygon
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
  public init: () => void

  private store: Store<State>
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement

  constructor({ canvas, fromLngLat, toLngLat, data = [] }: Config) {
    this.store = createStore(reducer, initialState)
    this.store.dispatch(actions.init({ data: data || [] }))
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D

    canvas.addEventListener('mousemove', (e: MouseEvent) => {
      e.stopPropagation()
      this.store.dispatch(actions.updateMousePosition(e2xy(e)))
    })

    this.store.subscribe(() => this.draw())

    this.init = () => {
      console.time('init')
      const dataInPixels = data.map(this.geoJSONToPixels({toLngLat, fromLngLat}))
      this.store.dispatch(actions.init({ data: dataInPixels }))
      console.timeEnd('init')
    }

    this.init()
  }

  private geoJSONToPixels(project: Project) {
    return (geom: AnyGeoJSON): AnyGeoJSON => {
      switch (geom.type) {
        case 'MultiPolygon':
          return this.multiPolygonToPixels(project, geom)
        case 'Polygon':
          return this.polygonToPixels(project, geom)
        case 'GeometryCollection':
          return this.geometryCollectionToPixels(project, geom)
        default:
          return geom
      }
    }
  }

  private geometryCollectionToPixels(
    project: Project,
    geom: GeometryCollection
  ) {
    return {
      ...geom,
      geometries: geom.geometries.map(
        this.geoJSONToPixels(project)
      ) as Geometries[],
    }
  }

  private multiPolygonToPixels(project: Project, polygon: MultiPolygon) {
    return {
      ...polygon,
      coordinates: polygon.coordinates.map(poly =>
        poly.map(this.positionToPixels(project))
      ),
    }
  }

  private polygonToPixels(project: Project, polygon: Polygon) {
    return {
      ...polygon,
      coordinates: polygon.coordinates.map(this.positionToPixels(project)),
    }
  }

  private positionToPixels(project: Project) {
    return (coords: Position[]) =>
      coords.map(coord => project.fromLngLat(coord))
  }

  private draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.store.getState().data.map(geom => this.drawGeom(geom))

    this.drawMousePosition()
  }

  private drawGeom(geom: AnyGeoJSON) {
    switch (geom.type) {
        case 'GeometryCollection':
            geom.geometries.map(g => this.drawGeom(g))
            break;
        case 'MultiPolygon':
          this.multiPolygon(geom)
          break;
      }
  }

  private drawMousePosition() {
    const [x, y] = this.store.getState().mousePosition

    this.ctx.beginPath()
    this.ctx.arc(x, y, 5, 0, 2 * Math.PI)
    this.ctx.fillStyle = '#fafafa'
    this.ctx.strokeStyle = '#000000'
    this.ctx.fill()
    this.ctx.stroke()
  }

  private multiPolygon = (geom: MultiPolygon) => {
    geom.coordinates.forEach(polygon => {
      polygon.forEach(lineString => {
        const [first, ...rest] = lineString
        this.ctx.moveTo(first[0], first[1])
        this.ctx.beginPath()

        for (let k = 0; k < rest.length - 2; k++) {
          const [x, y] = rest[k]
          //      this.ctx.arc(x, y, 3, 0, 360)
          this.ctx.lineTo(x, y)
        }

        this.ctx.closePath()
        this.ctx.fillStyle = 'rgba(0,0,0,0.1)'
        this.ctx.fill()
        // this.ctx.fill()
        this.ctx.stroke()
      })
    })
  }
}

export default (config: Config) => new Purlieu(config)
