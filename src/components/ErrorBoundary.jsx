import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="viewer-status" role="alert">
          The 3D viewer hit a problem. Steps, clips and the AI trace still work.
        </div>
      );
    }
    return this.props.children;
  }
}
