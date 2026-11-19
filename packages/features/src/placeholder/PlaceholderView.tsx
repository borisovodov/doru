import type { ReactNode } from 'react';
import './PlaceholderView.css';

export interface PlaceholderViewProps {
  /** Optional: side bars already show the view title in their persistent header. */
  title?: string | undefined;
  description?: string | undefined;
  children?: ReactNode;
}

export function PlaceholderView({ title, description, children }: PlaceholderViewProps) {
  return (
    <section className="placeholder-view" aria-label={title}>
      {title !== undefined && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {children}
    </section>
  );
}
