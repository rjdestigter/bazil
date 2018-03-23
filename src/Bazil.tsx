import bbox from '@turf/bbox'
import rewind from '@turf/rewind'
import { Map } from 'leaflet'
import * as PropTypes from 'prop-types'
import * as React from 'react'
import basil from './basil'
import DrawControl from './DrawControl'
import leerbroek from './leerbroek.json'
import purlieu from './redux/Purlieu'
import fields from './sample.json'

interface State {
  size: {
    width: number
    height: number
  }
  topology: boolean
}

const geojson = [leerbroek].concat(
  fields
    .filter(field => field.shape && field.shape.shapeData)
    .map(field => rewind(JSON.parse(field.shape.shapeData)))
)

interface Context {
  map: Map
}

const styles: { [id: string]: React.CSSProperties } = {
  container: {
    position: 'relative',
    zIndex: 500,
  },
}

export default class Bazil extends React.Component<any, State> {
  public static contextTypes = {
    map: PropTypes.instanceOf(Map),
  }

  private map: Map

  constructor(props: any, context: Context) {
    super(props)

    this.state = {
      ...this.getStateFromMapSize(context),
      topology: true,
    }

    this.onRef = this.onRef.bind(this)
    this.map = context.map

    const [minx, miny, maxx, maxy] = bbox(geojson[1])

    this.map.fitBounds([[miny, minx], [maxy, maxx]])
  }

  public render() {
    return (
      <>
        <DrawControl
          onAddPoly={() => undefined}
          onAddCircle={() => undefined}
          onCutLine={() => undefined}
          onCutPoly={() => undefined}
          onCutCircle={() => undefined}
          onToggleSnapPoint={() => undefined}
          onToggleSnapLine={() => undefined}
          onToggleTopology={() => undefined}
          onCancel={() => undefined}
          onDone={() => undefined}
          onUndo={() => undefined}
          onRedo={() => undefined}
          snap={{ lines: true, points: true }}
          topology
        />
        <canvas
          style={styles.container}
          height={this.state.size.height}
          width={this.state.size.width}
          ref={this.onRef}
        />
      </>
    )
  }

  private onRef(node: HTMLCanvasElement | null) {
    if (node) {
      const ctx = node.getContext('2d')

      if (ctx) {
        let data: any = []

        const toLngLat = ([x, y]: number[]): number[] => {
          const point = this.map.containerPointToLatLng([x, y])
          return [point.lng, point.lat]
        }

        const fromLngLat = ([lng, lat]: number[]): number[] => {
          const point = this.map.latLngToContainerPoint([lat, lng])
          return [point.x, point.y]
        }

        const app = purlieu({
          canvas: node,
          toLngLat,
          fromLngLat,
          data,
        })

        app.onChange(next => {
          data = next
        })

        app.store.subscribe(() => {
          const state = app.store.getState()
          if (this.map.dragging.enabled() && state.dragging.length) {
            this.map.dragging.disable()
          } else if (!this.map.dragging.enabled()) {
            this.map.dragging.enable()
          }
        })

        this.map.on('move zoom', () => app.init(data))
        window.basil = this
        window.app = app
        window.load = i => app.init([geojson[i]])
        window.load(1)
      }
    }
  }

  private getStateFromMapSize(context: Context = this.context) {
    const size = context.map.getSize()
    return Object.assign(this.state || {}, {
      size: {
        height: size.y,
        width: size.x,
      },
    })
  }
}
