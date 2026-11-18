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

  static getDerivedStateFromError(error: unknown): DemoErrorBoundaryState {
    return { error: normalizeDemoError(error) };
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

/** React allows any thrown value; always turn it into a diagnosable Error. */
function normalizeDemoError(error: unknown): Error {
  if (error instanceof Error && error.message !== '') {
    return error;
  }
  const message = typeof error === 'string' && error.trim() !== '' ? error : `Demo failed: ${String(error)}`;
  return new Error(message);
}
