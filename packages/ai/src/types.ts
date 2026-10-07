export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AgentIdentity {
  provider: string;
  model: string;
  sessionId: string;
}

export type AgentEvent =
  | { type: 'text'; content: string }
  | { type: 'toolCall'; call: ToolCall }
  | { type: 'done' }
  | { type: 'error'; message: string };
