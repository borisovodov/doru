import type { AgentEvent, ChatMessage } from './types';

export type ConnectorKind = 'mcp' | 'api' | 'local' | 'acp';

export interface AgentChatOptions {
  signal?: AbortSignal;
}

export interface AgentConnector {
  readonly id: string;
  readonly kind: ConnectorKind;
  chat(messages: ChatMessage[], options?: AgentChatOptions): AsyncIterable<AgentEvent>;
}
