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
  type AgentEvents,
  type AgentStep,
  type ChatMessage,
  type ChatSendResult,
} from '@doru/ai';
import { loadAiSettings, type ResolvedAiSettings } from './ai-settings';
import { log } from './log';
import { ensureRuntime } from './runtime';
import { acpClients, projectWindows } from './state';

export type ChatEvent = { type: 'textDelta'; text: string } | { type: 'step'; step: AgentStep };

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

function projectEvents(projectPath: string): AgentEvents {
  const window = projectWindows.get(projectPath);
  if (!window) {
    return {};
  }
  const send = (event: ChatEvent) => window.webContents.send('chat:event', event);
  return {
    onTextDelta: (text) => send({ type: 'textDelta', text }),
    onStep: (step) => send({ type: 'step', step }),
  };
}

/** In-flight chat runs per project; "Stop" aborts the signal. */
const chatAborts = new Map<string, AbortController>();

export function cancelChat(projectPath: string): void {
  log.debug('chat: cancel requested', { projectPath });
  chatAborts.get(projectPath)?.abort();
  // For ACP the abort kills the agent process via the signal listener; drop
  // the cached client so the next turn spawns a fresh session.
  const acp = acpClients.get(projectPath);
  if (acp) {
    void acp.close();
    acpClients.delete(projectPath);
  }
}

/**
 * Non-sensitive run context for the log: no message contents, no tool
 * arguments or results — chat may carry family data that must never land in
 * doru.log.
 */
interface ChatRunContext {
  projectPath: string;
  provider: string;
  model: string;
  messages: number;
}

function logRunError(message: string, context: ChatRunContext, error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  log.error(message, { ...context, error: text, stack: error instanceof Error ? error.stack : undefined });
  return text;
}

export async function sendChat(options: { projectPath: string; messages: ChatMessage[] }): Promise<ChatSendResult> {
  const settings = loadAiSettings();
  const runContext: ChatRunContext = {
    projectPath: options.projectPath,
    provider: settings.provider.id,
    model: settings.model,
    messages: options.messages.length,
  };
  if (!settings.configured) {
    log.warn('chat: provider is not configured', runContext);
    return {
      steps: [],
      finalText: '',
      error: `AI provider is not configured. Open the settings (gear icon) to set it up.`,
    };
  }
  const abort = new AbortController();
  chatAborts.set(options.projectPath, abort);
  const cancelled = (steps: AgentStep[]): ChatSendResult => ({
    steps,
    finalText: '',
    cancelled: true,
  });
  const fail = (error: unknown): ChatSendResult => ({
    steps: [],
    finalText: '',
    error: logRunError('chat: run failed', runContext, error),
  });

  log.debug('chat: run started', runContext);
  const startedAt = Date.now();

  let result: ChatSendResult;
  try {
    const { runtime } = await ensureRuntime(options.projectPath);
    const lastUser = [...options.messages].reverse().find((message) => message.role === 'user');
    const events = projectEvents(options.projectPath);

    const system =
      'You are a genealogy assistant working with the user\'s family tree. ' +
      'Use tree_stats to see how large the tree is, and tree_query without a query to list persons. ' +
      'Wildcards are not needed: an empty query already lists the tree. ' +
      'For edits, use tree_edit.';
    const conversation = [...options.messages];

    if (settings.provider.kind === 'acp') {
      try {
        const client = await ensureAcpClient(options.projectPath, settings);
        const acpResult = await client.prompt(lastUser?.content ?? '', events, abort.signal);
        result = { steps: acpResult.steps, finalText: acpResult.finalText };
      } catch (error) {
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
          messages: conversation,
          system,
          tools,
          events,
          signal: abort.signal,
          ...(settings.reasoning !== '' ? { reasoning: settings.reasoning } : {}),
        });
        result = { steps: agentResult.steps, finalText: agentResult.finalText };
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
    chatAborts.delete(options.projectPath);
  }

  if (!result.cancelled && result.finalText === '' && result.steps.length === 0) {
    log.warn('chat: run produced no text and no tool steps', { ...runContext, error: result.error });
  }
  log.debug('chat: run finished', {
    ...runContext,
    durationMs: Date.now() - startedAt,
    steps: result.steps.length,
    cancelled: result.cancelled === true,
  });
  return result;
}
