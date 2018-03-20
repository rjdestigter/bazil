import { Map } from 'leaflet'
import * as PropTypes from 'prop-types'
import * as React from 'react'
import basil from './basil'
import leerbroek from './leerbroek.json'
import purlieu from './redux/Purlieu'

interface State {
  size: {
    width: number
    height: number
  }
}

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

    this.state = this.getStateFromMapSize(context)
    this.onRef = this.onRef.bind(this)
    this.map = context.map
  }

  public render() {
    return (
      <canvas
        style={styles.container}
        height={this.state.size.height}
        width={this.state.size.width}
        ref={this.onRef}
      />
    )
  }

  private onRef(node: HTMLCanvasElement | null) {
    if (node) {
      const ctx = node.getContext('2d')

      if (ctx) {
        let data = [leerbroek]

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
