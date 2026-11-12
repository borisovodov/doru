import type { ReactNode } from 'react';

export interface SideBarProps {
  children?: ReactNode;
  /** Accessible name of the side bar, usually the active view's title. */
  label?: string;
}

export function SideBar({ children, label }: SideBarProps) {
  return (
    <aside className="side-bar" aria-label={label}>
      {children}
    </aside>
  );
}
