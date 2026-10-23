export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

/** A message in the chat transcript sent to the agent. */
export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  toolCalls?: ToolCall[];
  toolCallId?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * A persisted chat-session entry: the source of truth for what the chat
 * panel displays and for the context every provider receives. It exists
 * independently of any provider — Dóru owns sessions; providers are only
 * transports.
 */
export interface ChatSessionMeta {
  id: string;
  /** Auto-generated from the first user message; empty until the first turn. */
  title: string;
  createdAt: number;
  updatedAt: number;
}
