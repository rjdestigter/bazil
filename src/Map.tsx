import { GeoJsonObject } from 'geojson'
import * as L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import * as React from 'react'
import { GeoJSON, Map, TileLayer } from 'react-leaflet'
import Bazil from './Bazil'

const osmUrl = 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'

export default class Blip extends React.Component<any> {
  public onRef(ref: Map | null) {
    // if (ref) {
    //   L.geoJSON(leerbroek).addTo(ref.leafletElement)
    // }
  }

  public render() {
    return (
      <Map
        preferCanvas
        style={{ height: '100%', width: '100%' }}
        center={[0, 0]}
        // center={[51.9197203, 5.0256929]}
        zoom={1}
        ref={this.onRef}
        worldCopyJump
        maxZoom={24}
      >
        <TileLayer url={osmUrl} maxNativeZoom={18} maxZoom={24} />
        <Bazil />
      </Map>
    )
  }
}
