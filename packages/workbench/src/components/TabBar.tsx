import { nls } from '../nls';

export interface TabInfo {
  id: string;
  label: string;
}

export interface TabBarProps {
  tabs: TabInfo[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function TabBar({ tabs, activeId, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) {
    return null;
  }
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={tab.id === activeId ? 'tab active' : 'tab'}
          onClick={() => onSelect(tab.id)}
        >
          <span className="tab-label">{tab.label}</span>
          <button
            className="tab-close"
            title={nls.t('workbench.tab.close')}
            onClick={(event) => {
              event.stopPropagation();
              onClose(tab.id);
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
