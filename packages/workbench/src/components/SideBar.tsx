import type { ReactNode } from 'react';

export interface SideBarProps {
  children?: ReactNode;
}

export function SideBar({ children }: SideBarProps) {
  return <div className="side-bar">{children}</div>;
}
