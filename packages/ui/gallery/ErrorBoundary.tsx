import { Component, type ReactNode } from 'react';

interface DemoErrorBoundaryProps {
  children: ReactNode;
}

interface DemoErrorBoundaryState {
  error: string | null;
}

/** Keeps one broken demo from blanking the whole gallery. */
export class DemoErrorBoundary extends Component<DemoErrorBoundaryProps, DemoErrorBoundaryState> {
  override state: DemoErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): DemoErrorBoundaryState {
    return { error: normalizeDemoError(error) };
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="demo-error" role="alert">
          Demo failed: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * React allows any thrown value. Read the message once and keep only the
 * diagnostic string, so the alert never calls a throwing message getter again.
 */
function normalizeDemoError(error: unknown): string {
  try {
    if (typeof error === 'string' && error.trim() !== '') {
      return error;
    }
    if (error instanceof Error) {
      const message = error.message;
      if (typeof message === 'string' && message.trim() !== '') {
        return message;
      }
    }
    return String(error);
  } catch {
    // Objects without a primitive conversion (for example Object.create(null))
    // throw from String(); still show a stable diagnostic instead of failing.
    return 'an error that cannot be displayed';
  }
}
