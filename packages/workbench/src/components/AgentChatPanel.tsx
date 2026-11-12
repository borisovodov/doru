import type { ReactNode } from 'react';

export interface AgentChatPanelProps {
  children?: ReactNode;
  /** Accessible name of the panel. */
  label?: string;
}

export function AgentChatPanel({ children, label }: AgentChatPanelProps) {
  return (
    <aside className="agent-chat-panel" aria-label={label}>
      {children}
    </aside>
  );
}
