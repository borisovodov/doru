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
  if (typeof error === 'string' && error.trim() !== '') {
    return new Error(error);
  }
  try {
    return new Error(`Demo failed: ${String(error)}`);
  } catch {
    // Objects without a primitive conversion (for example Object.create(null))
    // throw from String(); still show a stable diagnostic instead of failing.
    return new Error('Demo failed with a value that cannot be displayed');
  }
}
