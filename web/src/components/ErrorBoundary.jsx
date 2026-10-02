import { Component } from 'react'

// Keeps a failure in one tab from blanking the whole site
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(error, info.componentStack)
  }

  componentDidUpdate(prev) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="card error">
        Something went wrong while rendering this view.{' '}
        <button className="button ghost" onClick={() => this.setState({ error: null })}>Try again</button>
      </div>
    )
  }
}
