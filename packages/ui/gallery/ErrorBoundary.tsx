import { Component, type ReactNode } from 'react';
import { nls } from '../src/nls';

interface DemoErrorBoundaryProps {
  children: ReactNode;
}

interface DemoDiagnostic {
  /** The diagnostic text from the thrown value, unchanged. */
  text: string;
  /** False when the value cannot be converted to a string at all. */
  readable: boolean;
}

interface DemoErrorBoundaryState {
  error: DemoDiagnostic | null;
}

/** Keeps one broken demo from blanking the whole gallery. */
export class DemoErrorBoundary extends Component<DemoErrorBoundaryProps, DemoErrorBoundaryState> {
  override state: DemoErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): DemoErrorBoundaryState {
    return { error: normalizeDemoError(error) };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      return (
        <div className="demo-error" role="alert">
          {error.readable ? nls.t('gallery.demo.failed', error.text) : nls.t('gallery.demo.unreadable')}
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
function normalizeDemoError(error: unknown): DemoDiagnostic {
  try {
    if (typeof error === 'string' && error.trim() !== '') {
      return { text: error, readable: true };
    }
    if (error instanceof Error) {
      const message = error.message;
      if (typeof message === 'string' && message.trim() !== '') {
        return { text: message, readable: true };
      }
    }
    return { text: String(error), readable: true };
  } catch {
    // Objects without a primitive conversion (for example Object.create(null))
    // throw from String(); still show a stable diagnostic instead of failing.
    return { text: '', readable: false };
  }
}
