import type { ReactNode } from 'react';

export interface PlaceholderViewProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PlaceholderView({ title, description, children }: PlaceholderViewProps) {
  return (
    <div className="placeholder-view">
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}
