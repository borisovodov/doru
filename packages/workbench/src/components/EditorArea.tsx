import type { ReactNode } from 'react';
import { TabBar, type TabInfo } from './TabBar';

export interface EditorAreaProps {
  children?: ReactNode;
  tabs?: TabInfo[];
  activeTabId?: string | null;
  onSelectTab?: (id: string) => void;
  onCloseTab?: (id: string) => void;
}

export function EditorArea({ children, tabs, activeTabId, onSelectTab, onCloseTab }: EditorAreaProps) {
  return (
    <div className="editor-area">
      {tabs && tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeId={activeTabId ?? null}
          onSelect={onSelectTab ?? (() => {})}
          onClose={onCloseTab ?? (() => {})}
        />
      )}
      <div className="editor-content">{children}</div>
    </div>
  );
}
