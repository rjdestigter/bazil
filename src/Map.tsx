import { GeoJsonObject } from 'geojson'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as React from 'react'
import { Map, TileLayer } from 'react-leaflet'
import leerbroek from './leerbroek.json'

declare module './leerbroek.json' {
  const value: any
  export default value
}
const osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export default class Blip extends React.Component<any> {
  public onRef(ref: Map | null) {
    if (ref) {
      L.geoJSON(leerbroek).addTo(ref.leafletElement)
    }
  }

  public render() {
    return (
      <Map
        preferCanvas
        style={{ height: '100%', width: '100%' }}
        center={[0, 0]}
        zoom={1}
        ref={this.onRef}
      >
        <TileLayer url={osmUrl} />
      </Map>
    )
  }
}
