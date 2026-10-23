import { app } from 'electron';
import { dirname, resolve } from 'node:path';
import type { ToolSet } from 'ai';
import {
  AcpAgentClient,
  TreeMcpBackend,
  buildLanguageModel,
  doruToolSet,
  runAgent,
  type AcpMcpServerEntry,
  type AcpPromptBlock,
  type AgentEvents,
  type AgentStep,
  type ChatMessage,
  type ChatSendResult,
  type ChatTranscriptMessage,
} from '@doru/ai';
import { loadAiSettings, type ResolvedAiSettings } from './ai-settings';
import { userErrorMessage, userMessageFor } from './ai-errors';
import { chatSessions } from './chat-sessions';
import { log } from './log';
import { nls } from './nls';
import { ensureRuntime } from './runtime';
import { acpClients, acpSessionOwner, projectWindows } from './state';

/**
 * The agent chat. Dóru owns every conversation as a persisted transcript
 * (see chat-sessions.ts); the provider is only a transport. Every turn
 * builds its context from the transcript, so the flow is the same for
 * models and ACP agents — the difference is one adapter block.
 */

export type ChatEvent = { sessionId: string } & (
  | { type: 'textDelta'; text: string }
  | { type: 'step'; step: AgentStep }
);

const SYSTEM_PROMPT =
  'You are a genealogy assistant working with the user\'s family tree. ' +
  'Use tree_stats to see how large the tree is, and tree_query without a query to list persons. ' +
  'Wildcards are not needed: an empty query already lists the tree. ' +
  'tree_query accepts an optional sex filter ("M", "F" or "U") — e.g. use sex "M" to list men. ' +
  'For edits, use tree_edit.';

function doruMcpServerEntry(projectPath: string): AcpMcpServerEntry {
  const args = app.isPackaged
    ? ['--mcp-server', projectPath]
    : [resolve(process.argv[1] ?? '.'), '--mcp-server', projectPath];
  return { name: 'doru', command: process.execPath, args };
}

async function ensureAcpClient(projectPath: string, settings: ResolvedAiSettings): Promise<AcpAgentClient> {
  const existing = acpClients.get(projectPath);
  if (existing) {
    return existing;
  }
  const client = new AcpAgentClient({
    command: settings.acpCommand,
    args: settings.acpArgs,
    cwd: dirname(projectPath),
    mcpServers: [doruMcpServerEntry(projectPath)],
  });
  await client.start();
  acpClients.set(projectPath, client);
  return client;
}

function projectEvents(projectPath: string, sessionId: string): AgentEvents {
  const window = projectWindows.get(projectPath);
  if (!window) {
    return {};
  }
  const send = (event: ChatEvent) => window.webContents.send('chat:event', event);
  return {
    onTextDelta: (text) => send({ sessionId, type: 'textDelta', text }),
    onStep: (step) => send({ sessionId, type: 'step', step }),
  };
}

/** In-flight chat runs per session; "Stop" aborts the signal. */
const chatAborts = new Map<string, AbortController>();

export function cancelChat(projectPath: string, sessionId: string): void {
  log.debug('chat: cancel requested', { projectPath, sessionId });
  chatAborts.get(sessionId)?.abort();
}

/**
 * Non-sensitive run context for the log: no message contents, no tool
 * arguments or results — chat may carry family data that must never land in
 * doru.log.
 */
interface ChatRunContext {
  projectPath: string;
  sessionId: string;
  provider: string;
  model: string;
  messages: number;
}

function logRunError(message: string, context: ChatRunContext, error: unknown): void {
  const text = error instanceof Error ? error.message : String(error);
  log.error(message, { ...context, error: text, stack: error instanceof Error ? error.stack : undefined });
}

/**
 * The transcript becomes the model conversation: user/assistant texts in
 * order plus the new user message. Tool steps stay display-only.
 */
function modelConversation(transcript: ChatTranscriptMessage[], userText: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  for (const message of transcript) {
    if (message.content !== '') {
      messages.push({ role: message.role, content: message.content });
    }
  }
  messages.push({ role: 'user', content: userText });
  return messages;
}

/**
 * ACP has no roles in prompt blocks, so the replayed transcript is rendered
 * as a labeled conversation log between the system block and the new
 * question.
 */
function acpPromptBlocks(system: string, transcript: ChatTranscriptMessage[], userText: string): AcpPromptBlock[] {
  const history = transcript
    .filter((message) => message.content !== '')
    .map((message) => (message.role === 'user' ? `User: ${message.content}` : `Assistant: ${message.content}`))
    .join('\n');
  const blocks: AcpPromptBlock[] = [{ type: 'text', text: system }];
  if (history !== '') {
    blocks.push({ type: 'text', text: `Previous conversation:\n${history}` });
  }
  blocks.push({ type: 'text', text: userText });
  return blocks;
}

export async function sendChat(options: {
  projectPath: string;
  sessionId: string;
  text: string;
}): Promise<ChatSendResult> {
  const settings = loadAiSettings();
  const runContext: ChatRunContext = {
    projectPath: options.projectPath,
    sessionId: options.sessionId,
    provider: settings.provider.id,
    model: settings.model,
    messages: 1,
  };
  if (!settings.configured) {
    log.warn('chat: provider is not configured', runContext);
    return {
      steps: [],
      finalText: '',
      error: nls.t('chat.errors.notConfigured'),
    };
  }
  const abort = new AbortController();
  chatAborts.set(options.sessionId, abort);
  const cancelled = (steps: AgentStep[]): ChatSendResult => ({
    steps,
    finalText: '',
    cancelled: true,
  });
  // The raw error goes to the log; the user sees a localized explanation.
  const fail = (error: unknown): ChatSendResult => {
    logRunError('chat: run failed', runContext, error);
    return { steps: [], finalText: '', error: userErrorMessage(error) };
  };

  log.debug('chat: run started', runContext);
  const startedAt = Date.now();

  let result: ChatSendResult;
  try {
    const { runtime } = await ensureRuntime(options.projectPath);
    const events = projectEvents(options.projectPath, options.sessionId);
    const transcript = chatSessions().transcript(options.projectPath, options.sessionId);

    if (settings.provider.kind === 'acp') {
      try {
        const client = await ensureAcpClient(options.projectPath, settings);
        // One agent session serves the currently open chat session; opening
        // another chat session resets the agent session and replays the
        // whole transcript into it (Dóru owns the history, so the agent
        // needs no session/resume bookkeeping).
        const blocks: AcpPromptBlock[] =
          acpSessionOwner.get(options.projectPath) === options.sessionId
            ? [{ type: 'text', text: options.text }]
            : await (async () => {
                await client.resetSession();
                acpSessionOwner.set(options.projectPath, options.sessionId);
                return acpPromptBlocks(SYSTEM_PROMPT, transcript, options.text);
              })();
        const acpResult = await client.prompt(blocks, events, abort.signal);
        result = { steps: acpResult.steps, finalText: acpResult.finalText };
      } catch (error) {
        // A cancelled or failed turn can leave the agent session or the
        // whole process unusable; drop both so the next turn starts fresh.
        const acp = acpClients.get(options.projectPath);
        if (acp) {
          void acp.close();
          acpClients.delete(options.projectPath);
        }
        acpSessionOwner.delete(options.projectPath);
        if (abort.signal.aborted) {
          log.debug('chat: run cancelled', runContext);
          result = cancelled([]);
        } else {
          result = fail(error);
        }
      }
    } else {
      const backend = new TreeMcpBackend(runtime.repo, runtime.queue);
      const model = buildLanguageModel({
        providerId: settings.provider.id,
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        model: settings.model,
      });

      const tools: ToolSet = doruToolSet(backend);

      try {
        const agentResult = await runAgent({
          model,
          messages: modelConversation(transcript, options.text),
          system: SYSTEM_PROMPT,
          tools,
          events,
          signal: abort.signal,
          ...(settings.reasoning !== '' ? { reasoning: settings.reasoning } : {}),
        });
        if (agentResult.error !== undefined) {
          // Raw stream error for the log; a localized message for the UI.
          log.warn('chat: run error', { ...runContext, error: agentResult.error });
        }
        result = {
          steps: agentResult.steps,
          finalText: agentResult.finalText,
          ...(agentResult.error !== undefined
            ? { error: userMessageFor(agentResult.errorCode ?? 'unknown') }
            : {}),
        };
      } catch (error) {
        if (abort.signal.aborted) {
          log.debug('chat: run cancelled', runContext);
          result = cancelled([]);
        } else {
          result = fail(error);
        }
      }
    }
  } catch (error) {
    // ensureRuntime and anything else outside the inner handlers: convert
    // to an error result so the renderer shows it.
    if (abort.signal.aborted) {
      log.debug('chat: run cancelled', runContext);
      result = cancelled([]);
    } else {
      result = fail(error);
    }
  } finally {
    chatAborts.delete(options.sessionId);
  }

  if (!result.cancelled) {
    try {
      chatSessions().appendExchange(options.projectPath, options.sessionId, {
        user: options.text,
        assistant: {
          role: 'assistant',
          content: result.finalText,
          steps: result.steps,
          ...(result.error !== undefined ? { error: result.error } : {}),
        },
      });
    } catch (error) {
      log.error('chat: could not persist the exchange', { ...runContext, error: String(error) });
    }
  }

  if (!result.cancelled && result.finalText === '' && result.steps.length === 0) {
    log.warn('chat: run produced no text and no tool steps', { ...runContext, error: result.error });
  }
  if (result.error) {
    log.warn('chat: run finished with an error', { ...runContext, error: result.error });
  }
  log.debug('chat: run finished', {
    ...runContext,
    durationMs: Date.now() - startedAt,
    steps: result.steps.length,
    cancelled: result.cancelled === true,
  });
  return result;
}
