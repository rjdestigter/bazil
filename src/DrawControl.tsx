import * as React from 'react'
import Control from './Control'

const styles: { [id: string]: React.CSSProperties } = {
  container: {
    backgroundColor: '#fafafa',
    border: '1px solid #ccc',
    cursor: 'pointer',
    color: '#333',
  },
  item: {
    padding: 5,
    borderBottom: '1px solid #ccc',
  },
}

const naf = () => {}

interface Props {
  onAddPoly: () => void
  onAddCircle: () => void
  onCutLine: () => void
  onCutPoly: () => void
  onCutCircle: () => void
  onToggleSnapPoint: () => void
  onToggleSnapLine: () => void
  onToggleTopology: () => void
  onCancel: () => void
  onDone: () => void
  onUndo: () => void
  onRedo: () => void
  snap: {
    lines: boolean
    points: boolean
  }
  topology: boolean
}

export default class DrawControl extends React.Component<Props> {
  public render() {
    return (
      <Control>
        <div style={styles.container}>
          <div onClick={this.props.onAddPoly} style={styles.item}>
            add poly
          </div>
          <div onClick={this.props.onAddCircle} style={styles.item}>
            add circle
          </div>
          <div onClick={this.props.onCutLine} style={styles.item}>
            cut line
          </div>
          <div onClick={this.props.onCutPoly} style={styles.item}>
            cut polygon
          </div>
          <div onClick={this.props.onCutCircle} style={styles.item}>
            cut circle
          </div>
          <div onClick={this.props.onToggleSnapPoint} style={styles.item}>
            snap point
          </div>
          <div onClick={this.props.onToggleSnapLine} style={styles.item}>
            snap line
          </div>
          <div onClick={this.props.onToggleTopology} style={styles.item}>
            topology
          </div>
          <div onClick={this.props.onCancel} style={styles.item}>
            cancel
          </div>
          <div onClick={this.props.onDone} style={styles.item}>
            done
          </div>
          <div onClick={this.props.onUndo} style={styles.item}>
            undo
          </div>
          <div onClick={this.props.onRedo} style={styles.item}>
            redo
          </div>
        </div>
      </Control>
    )
  }
}
