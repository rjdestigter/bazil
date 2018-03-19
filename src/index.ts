import 'normalize.css/normalize.css'
import * as React from 'react'
import { render } from 'react-dom'
import Blip from './Map'

const root = document.getElementById('root')

render(React.createElement(Blip, {}), root)
