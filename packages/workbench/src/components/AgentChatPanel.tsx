import type { ReactNode } from 'react';

export interface AgentChatPanelProps {
  children?: ReactNode;
}

export function AgentChatPanel({ children }: AgentChatPanelProps) {
  return <div className="agent-chat-panel">{children}</div>;
}
