import type { ChatMessage, ToolCall } from './types';
import type { ToolDefinition } from './tools';
import type { ChatModel, ModelResponse } from './model';

export interface AnthropicChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface AnthropicToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

interface AnthropicText {
  type: 'text';
  text: string;
}

interface AnthropicContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
}

export class AnthropicChatConnector implements ChatModel {
  readonly id: string;

  constructor(private readonly options: AnthropicChatOptions) {
    this.id = `anthropic:${options.model}`;
  }

  async complete(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ModelResponse> {
    const system = messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content ?? '')
      .join('\n');

    const wireToReal = new Map<string, string>();
    const wireName = (name: string): string => {
      let candidate = name.replace(/[^a-zA-Z0-9_-]/g, '_');
      while (wireToReal.has(candidate)) {
        candidate = `${candidate}_`;
      }
      wireToReal.set(candidate, name);
      return candidate;
    };

    const body: Record<string, unknown> = {
      model: this.options.model,
      max_tokens: 2048,
      messages: toAnthropicMessages(messages.filter((message) => message.role !== 'system')),
      ...(tools.length > 0
        ? {
            tools: tools.map((tool) => ({
              name: wireName(tool.name),
              description: tool.description,
              input_schema: tool.inputSchema,
            })),
          }
        : {}),
    };
    if (system) {
      body.system = system;
    }

    const response = await fetch(`${this.options.baseUrl.replace(/\/+$/, '')}/v1/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': this.options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Model API error ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as { content?: AnthropicContentBlock[] };

    let text: string | null = null;
    const toolCalls: ToolCall[] = [];
    for (const block of data.content ?? []) {
      if (block.type === 'text' && block.text !== undefined) {
        text = (text ?? '') + block.text;
      } else if (block.type === 'tool_use' && block.id !== undefined && block.name !== undefined) {
        toolCalls.push({
          id: block.id,
          name: wireToReal.get(block.name) ?? block.name,
          arguments: (block.input as Record<string, unknown>) ?? {},
        });
      }
    }
    return { content: text, toolCalls };
  }
}

function toAnthropicMessages(messages: ChatMessage[]): Array<Record<string, unknown>> {
  const result: Array<Record<string, unknown>> = [];
  let pendingToolResults: AnthropicContentBlock[] = [];

  const flush = () => {
    if (pendingToolResults.length > 0) {
      result.push({ role: 'user', content: pendingToolResults });
      pendingToolResults = [];
    }
  };

  for (const message of messages) {
    if (message.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: message.toolCallId ?? '',
        content: message.content ?? '',
      });
      continue;
    }
    flush();
    if (message.role === 'assistant') {
      const blocks: AnthropicContentBlock[] = [];
      if (message.content) {
        blocks.push({ type: 'text', text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        const block = { type: 'tool_use', id: call.id, name: call.name, input: call.arguments } as AnthropicToolUse;
        blocks.push(block);
      }
      result.push({ role: 'assistant', content: blocks });
    } else {
      result.push({ role: 'user', content: message.content ?? '' });
    }
  }
  flush();
  return result;
}
