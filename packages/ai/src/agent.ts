// The agent runtime: a multi-step tool loop powered by the AI SDK
// (`streamText`). Text streams to the renderer as deltas; tool activity is
// collected into AgentStep[] so the transcript can show what the agent did.
import { stepCountIs, streamText, type LanguageModel, type ModelMessage, type ToolSet } from 'ai';
import { classifyError, type AiErrorCode } from './errors';
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
  /**
   * A stream error observed via the AI SDK `onError` callback. The AI SDK
   * resolves `.text` with partial content instead of rejecting on mid-stream
   * failures (e.g. a provider's 500 after the role chunk), so the error is
   * carried on the result instead — otherwise the run looks successful with
   * an empty answer. The raw text goes to the log; `errorCode` picks the
   * localized message for the user.
   */
  error?: string;
  errorCode?: AiErrorCode;
}

export interface ChatSendResult extends AgentRunResult {
  error?: string;
  /** True when the user cancelled the run; text and steps stay partial. */
  cancelled?: boolean;
}

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

/**
 * Recovers the first complete JSON object from a malformed tool-input
 * string. Small local models often append trailing garbage after the
 * arguments JSON (`{"query": "x"}]}.`) or prepend filler text while the
 * object itself is intact. Returns the cleaned JSON text, or null when no
 * complete object parses.
 */
export function repairToolInput(raw: string): string | null {
  const start = raw.indexOf('{');
  if (start === -1) {
    return null;
  }
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < raw.length; i += 1) {
    const char = raw[i]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = raw.slice(start, i + 1);
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/**
 * Normalizes sloppy `tree_query` inputs from small models: a free-text query
 * that is really a sex filter (`sex:M`, `gender: female`, …) is moved into
 * the proper `sex` field. Anything else passes through untouched.
 */
export function refineTreeQueryInput(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) {
    return input;
  }
  const record = input as { query?: unknown; sex?: unknown; [key: string]: unknown };
  if (record['sex'] !== undefined || typeof record['query'] !== 'string') {
    return input;
  }
  const match = record['query'].trim().match(/^(?:sex|gender)\s*[:=]\s*(male|female|unknown|m|f|u)$/i);
  if (!match) {
    return input;
  }
  const value = match[1]!.toLowerCase();
  const sex = value === 'male' || value === 'm' ? 'M' : value === 'female' || value === 'f' ? 'F' : 'U';
  const { query: _removed, ...rest } = record;
  return { ...rest, sex };
}

export async function runAgent(options: RunAgentOptions): Promise<AgentRunResult> {
  const steps: AgentStep[] = [];
  const events = options.events ?? {};
  let streamError: { message: string; code: AiErrorCode } | undefined;

  const result = streamText({
    model: options.model,
    messages: toModelMessages(options.messages),
    tools: options.tools,
    stopWhen: stepCountIs(options.maxSteps ?? 8),
    ...(options.system !== undefined ? { system: options.system } : {}),
    ...(options.signal !== undefined ? { abortSignal: options.signal } : {}),
    ...(options.reasoning !== undefined ? { reasoning: options.reasoning } : {}),
    // Small local models emit tool calls with broken argument JSON (trailing
    // garbage after the object) or sloppy arguments (a free-text query that
    // is really a sex filter). Repair and refine locally instead of failing
    // the whole run.
    repairToolCall: async ({ toolCall }) => {
      const repaired = typeof toolCall.input === 'string' ? repairToolInput(toolCall.input) : null;
      return repaired === null ? null : { ...toolCall, input: repaired };
    },
    experimental_refineToolInput: {
      tree_query: refineTreeQueryInput,
    },
    onError: ({ error }: { error: unknown }) => {
      streamError = {
        message: error instanceof Error ? error.message : String(error),
        code: classifyError(error),
      };
    },
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
  return {
    steps,
    finalText,
    ...(streamError !== undefined ? { error: streamError.message, errorCode: streamError.code } : {}),
  };
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
