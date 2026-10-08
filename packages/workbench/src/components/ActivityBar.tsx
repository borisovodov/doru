import type { ReactNode } from 'react';

export interface ActivityBarProps {
  onOpenProject: () => void;
  onOpenSettings: () => void;
}

export function ActivityBar({ onOpenProject, onOpenSettings }: ActivityBarProps) {
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
      <button className="activity-bar-item activity-bar-bottom" title="Settings" onClick={onOpenSettings}>
        <svg width="20" height="20" viewBox="0 0 16 16" aria-hidden="true">
          <path
            fill="currentColor"
            d="M9.1 4.4L8.6 2H7.4l-.5 2.4a4.99 4.99 0 0 0-1.6.9L3.1 4.1 2.2 5l2.2 2.2a5 5 0 0 0-.4 1.6H1.6v1.2H4a5 5 0 0 0 .4 1.6l-2.2 2.2.9.9 2.2-2.2a5 5 0 0 0 1.6.9L7.4 16h1.2l.5-2.4a5 5 0 0 0 1.6-.9l2.2 2.2.9-.9-2.2-2.2a5 5 0 0 0 .4-1.6h2.4V8.8H12a5 5 0 0 0-.4-1.6l2.2-2.2-.9-.9-2.2 2.2a5 5 0 0 0-1.6-.9z"
          />
        </svg>
      </button>
    </div>
  );
}
