// The agent runtime: a multi-step tool loop powered by the AI SDK
// (`streamText`). Text streams to the renderer as deltas; tool activity is
// collected into AgentStep[] so the transcript can show what the agent did.
import { stepCountIs, streamText, type LanguageModel, type ModelMessage, type ToolSet } from 'ai';
import type { ChatMessage } from './types';

/** AI SDK reasoning levels; absent means the provider default. */
export type ReasoningLevel =
  | 'provider-default'
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh'
  | 'max';

export type AgentStep =
  | { type: 'toolCall'; name: string; arguments: Record<string, unknown> }
  | { type: 'toolResult'; name: string; result: unknown }
  | { type: 'toolError'; name: string; message: string };

export interface AgentRunResult {
  steps: AgentStep[];
  finalText: string;
}

export interface ChatSendResult extends AgentRunResult {
  error?: string;
  /** True when the user cancelled the run; text and steps stay partial. */
  cancelled?: boolean;
}

export type PermissionGate = (tool: string, args: Record<string, unknown>) => Promise<boolean>;

/** Live events emitted while the agent runs. */
export interface AgentEvents {
  /** A text delta to append to the assistant bubble. */
  onTextDelta?: (delta: string) => void;
  /** A tool activity step (call, result or error). */
  onStep?: (step: AgentStep) => void;
}

export interface RunAgentOptions {
  model: LanguageModel;
  messages: ChatMessage[];
  /** System prompt; passed via the AI SDK `system` option (v7 rejects system messages in `messages`). */
  system?: string;
  tools: ToolSet;
  /** Maximum number of model/tool iterations. Defaults to 8. */
  maxSteps?: number;
  /** Reasoning level; absent means the provider default. */
  reasoning?: ReasoningLevel;
  /** Aborts the run (streaming stops, awaiting rejects with an AbortError). */
  signal?: AbortSignal;
  events?: AgentEvents;
}

export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const steps: AgentStep[] = [];
  const events = options.events ?? {};

  const result = streamText({
    model: options.model,
    messages: toModelMessages(options.messages),
    tools: options.tools,
    stopWhen: stepCountIs(options.maxSteps ?? 8),
    ...(options.system !== undefined ? { system: options.system } : {}),
    ...(options.signal !== undefined ? { abortSignal: options.signal } : {}),
    ...(options.reasoning !== undefined ? { reasoning: options.reasoning } : {}),
    onChunk: ({ chunk }) => {
      if (chunk.type === 'text-delta' && chunk.text) {
        events.onTextDelta?.(chunk.text);
      }
    },
    onStepEnd: ({ content }) => {
      for (const part of content) {
        let step: AgentStep | null = null;
        if (part.type === 'tool-call') {
          step = {
            type: 'toolCall',
            name: part.toolName,
            arguments: (part.input as Record<string, unknown> | undefined) ?? {},
          };
        } else if (part.type === 'tool-result') {
          step = { type: 'toolResult', name: part.toolName, result: part.output };
        } else if (part.type === 'tool-error') {
          const error = part.error;
          step = {
            type: 'toolError',
            name: part.toolName,
            message: error instanceof Error ? error.message : String(error),
          };
        }
        if (step) {
          steps.push(step);
          events.onStep?.(step);
        }
      }
    },
  });

  const finalText = await result.text;
  return { steps, finalText };
}

/**
 * Converts Dóru chat messages into AI SDK model messages. The renderer's
 * transcript only carries plain user/assistant text; tool-call/tool-result
 * history is maintained internally by streamText within one run.
 */
export function toModelMessages(messages: ChatMessage[]): ModelMessage[] {
  const converted: ModelMessage[] = [];
  const toolNames = new Map<string, string>();
  for (const message of messages) {
    if (message.role === 'system') {
      // v7 rejects system messages in `messages`; the system prompt travels
      // via the `system` option instead.
      continue;
    }
    if (message.role === 'assistant') {
      const parts: Array<
        { type: 'text'; text: string } | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
      > = [];
      if (message.content) {
        parts.push({ type: 'text', text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        toolNames.set(call.id, call.name);
        parts.push({ type: 'tool-call', toolCallId: call.id, toolName: call.name, input: call.arguments });
      }
      converted.push({ role: 'assistant', content: parts });
    } else if (message.role === 'tool') {
      converted.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: message.toolCallId ?? '',
            toolName: toolNames.get(message.toolCallId ?? '') ?? '',
            output: { type: 'text', value: message.content ?? '' },
          },
        ],
      });
    } else {
      converted.push({ role: message.role, content: message.content ?? '' });
    }
  }
  return converted;
}
