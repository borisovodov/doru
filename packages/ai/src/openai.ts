import type { ChatMessage, ToolCall } from './types';
import type { ToolDefinition } from './tools';
import type { ChatModel, ModelResponse } from './model';

export interface OpenAIChatOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface ApiMessage {
  role: string;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>;
}

interface ApiResponse {
  choices?: Array<{ message?: { content?: string | null; tool_calls?: ApiToolCall[] } }>;
}

interface ApiToolCall {
  id: string;
  function: { name: string; arguments: string };
}

export class OpenAIChatConnector implements ChatModel {
  readonly id: string;

  constructor(private readonly options: OpenAIChatOptions) {
    this.id = `openai:${options.model}`;
  }

  async complete(messages: ChatMessage[], tools: ToolDefinition[]): Promise<ModelResponse> {
    const url = `${this.options.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        messages: messages.map(toApiMessage),
        ...(tools.length > 0
          ? {
              tools: tools.map((tool) => ({
                type: 'function',
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.inputSchema,
                },
              })),
              tool_choice: 'auto',
            }
          : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Model API error ${response.status}: ${await response.text()}`);
    }
    const data = (await response.json()) as ApiResponse;
    const message = data.choices?.[0]?.message;
    return {
      content: message?.content ?? null,
      toolCalls: (message?.tool_calls ?? []).map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: parseArguments(call.function.arguments),
      })),
    };
  }
}

function toApiMessage(message: ChatMessage): ApiMessage {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content ?? '', tool_call_id: message.toolCallId };
  }
  if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: message.content,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: 'function',
        function: { name: call.name, arguments: JSON.stringify(call.arguments) },
      })),
    };
  }
  return { role: message.role, content: message.content ?? '' };
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}
