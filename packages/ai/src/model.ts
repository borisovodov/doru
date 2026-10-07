import type { ChatMessage, ToolCall } from './types';
import type { ToolDefinition } from './tools';

export interface ModelResponse {
  content: string | null;
  toolCalls: ToolCall[];
}

export interface ChatModel {
  readonly id: string;
  complete(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ModelResponse>;
}
