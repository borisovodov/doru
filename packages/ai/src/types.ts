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
