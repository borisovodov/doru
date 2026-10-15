import type { ReactNode } from 'react';
import { TabBar, type TabInfo } from './TabBar';

export interface EditorAreaProps {
  children?: ReactNode;
  tabs?: TabInfo[] | undefined;
  activeTabId?: string | null | undefined;
  onSelectTab?: ((id: string) => void) | undefined;
  onCloseTab?: ((id: string) => void) | undefined;
  onReorderTab?: ((sourceId: string, dropIndex: number) => void) | undefined;
}

export function EditorArea({
  children,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onReorderTab,
}: EditorAreaProps) {
  return (
    <div className="editor-area">
      {tabs && tabs.length > 0 && (
        <TabBar
          tabs={tabs}
          activeId={activeTabId ?? null}
          onSelect={onSelectTab ?? (() => {})}
          onClose={onCloseTab ?? (() => {})}
          onReorder={onReorderTab}
        />
      )}
      <div className="editor-content">{children}</div>
    </div>
  );
}
