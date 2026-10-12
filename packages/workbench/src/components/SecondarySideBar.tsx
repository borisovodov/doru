import type { ReactNode } from 'react';

export interface SecondarySideBarProps {
  children?: ReactNode;
}

export function SecondarySideBar({ children }: SecondarySideBarProps) {
  return <div className="secondary-side-bar">{children}</div>;
}
