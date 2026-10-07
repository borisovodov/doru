import type { ReactNode } from 'react';
import { nls } from '../nls';

export interface PanelProps {
  children?: ReactNode;
}

export function Panel({ children }: PanelProps) {
  return <div className="panel">{children ?? nls.t('workbench.panel.placeholder')}</div>;
}
