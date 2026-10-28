import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { error: Error | null }

/** Last line of defence: a render error shows a message and a reload button instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('render error', error, info.componentStack)
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{ padding: 24, textAlign: 'center' }}>
        <h2>Something broke</h2>
        <p><small>{this.state.error.message}</small></p>
        <button type="button" className="btn btn--primary" onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
}
