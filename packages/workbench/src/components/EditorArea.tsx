import type { ReactNode } from 'react';
import { TabBar, type TabInfo } from './TabBar';

export interface EditorAreaProps {
  children?: ReactNode;
  tabs?: TabInfo[] | undefined;
  activeTabId?: string | null | undefined;
  onSelectTab?: ((id: string) => void) | undefined;
  onCloseTab?: ((id: string) => void) | undefined;
  onReorderTab?: ((sourceId: string, dropIndex: number) => void) | undefined;
  /** Host platform (`process.platform`); on macOS tab close actions sit on the left. */
  platform?: string | undefined;
}

export function EditorArea({
  children,
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onReorderTab,
  platform,
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
          platform={platform}
        />
      )}
      <div className="editor-content">{children}</div>
    </div>
  );
}
