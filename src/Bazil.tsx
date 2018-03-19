import { Map } from 'leaflet'
import * as PropTypes from 'prop-types'
import * as React from 'react'
import basil from './basil'

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

  constructor(props: any, context: Context) {
    super(props)

    this.state = this.getStateFromMapSize(context)

    this.onRef = this.onRef.bind(this)
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
        basil([this.state.size.width, this.state.size.height], node, ctx)
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
