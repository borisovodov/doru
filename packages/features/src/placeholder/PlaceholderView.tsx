import type { ReactNode } from 'react';
import './PlaceholderView.css';

export interface PlaceholderViewProps {
  title: string;
  description?: string | undefined;
  children?: ReactNode;
}

export function PlaceholderView({ title, description, children }: PlaceholderViewProps) {
  return (
    <section className="placeholder-view" aria-label={title}>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </section>
  );
}
