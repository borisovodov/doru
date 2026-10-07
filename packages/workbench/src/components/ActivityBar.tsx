import type { ReactNode } from 'react';

export interface ActivityBarProps {
  onOpenProject: () => void;
}

export function ActivityBar({ onOpenProject }: ActivityBarProps) {
  return (
    <div className="activity-bar">
      <button className="activity-bar-item" title="Open Project" onClick={onOpenProject}>
        <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M7.976 10.072l4.357-4.357.62.618L8.284 11h-.618L3 6.333l.619-.618 4.357 4.357z"
          />
        </svg>
      </button>
    </div>
  );
}
