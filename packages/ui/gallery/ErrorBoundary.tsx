import { Component, type ReactNode } from 'react';

interface DemoErrorBoundaryProps {
  children: ReactNode;
}

interface DemoErrorBoundaryState {
  error: Error | null;
}

/** Keeps one broken demo from blanking the whole gallery. */
export class DemoErrorBoundary extends Component<DemoErrorBoundaryProps, DemoErrorBoundaryState> {
  override state: DemoErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DemoErrorBoundaryState {
    return { error };
  }

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="demo-error" role="alert">
          Demo failed: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
