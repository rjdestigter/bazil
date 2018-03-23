import L from 'leaflet'
import ReactDOM from 'react-dom'
import { MapControl } from 'react-leaflet'

const BlankControl = L.Control.extend({
  initialize(options) {
    L.Util.setOptions(this, options)
    this._container = L.DomUtil.create(
      'div',
      'leaflet-control-' + (options.name || 'blank')
    )
    L.DomEvent.disableClickPropagation(this._container)
  },

  onAdd(map) {
    return this._container
  },
})

export default class Control extends MapControl {
  public createLeafletElement(props) {
    return new BlankControl(props)
  }

  public render() {
    const container = this.leafletElement.getContainer()
    return ReactDOM.createPortal(this.props.children, container)
  }
}
