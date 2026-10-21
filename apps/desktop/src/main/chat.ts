import { app } from 'electron';
import { dirname, resolve } from 'node:path';
import type { ToolSet } from 'ai';
import {
  AcpAgentClient,
  DEFAULT_PERMISSION_POLICY,
  TreeMcpBackend,
  buildLanguageModel,
  connectMcpServers,
  doruToolSet,
  runAgent,
  type AcpMcpServerEntry,
  type AgentEvents,
  type AgentStep,
  type ChatMessage,
  type ChatSendResult,
} from '@doru/ai';
import { loadAiSettings, type ResolvedAiSettings } from './ai-settings';
import { ensureRuntime } from './runtime';
import { acpClients, pendingPermissions, projectWindows } from './state';

export type ChatEvent = { type: 'textDelta'; text: string } | { type: 'step'; step: AgentStep };

function requestPermission(projectPath: string, tool: string, args: Record<string, unknown>): Promise<boolean> {
  const id = crypto.randomUUID();
  projectWindows.get(projectPath)?.webContents.send('chat:permission', { id, tool, arguments: args });
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      pendingPermissions.delete(id);
      resolve(false);
    }, 120_000);
    pendingPermissions.set(id, { resolve, timer });
  });
}

export function resolvePermission(id: string, allow: boolean): void {
  const pending = pendingPermissions.get(id);
  if (!pending) {
    return;
  }
  clearTimeout(pending.timer);
  pendingPermissions.delete(id);
  pending.resolve(allow === true);
}

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
    mcpServers: [
      doruMcpServerEntry(projectPath),
      ...settings.mcpServers.map((server) => ({
        name: server.name,
        command: server.command,
        args: server.args,
        env: server.env,
      })),
    ],
  });
  await client.start((tool, args) => requestPermission(projectPath, tool, args));
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
  chatAborts.get(projectPath)?.abort();
  // For ACP the abort kills the agent process via the signal listener; drop
  // the cached client so the next turn spawns a fresh session.
  const acp = acpClients.get(projectPath);
  if (acp) {
    void acp.close();
    acpClients.delete(projectPath);
  }
}

export async function sendChat(options: { projectPath: string; messages: ChatMessage[] }): Promise<ChatSendResult> {
  const settings = loadAiSettings();
  if (!settings.configured) {
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
        const result = await client.prompt(lastUser?.content ?? '', events, abort.signal);
        return { steps: result.steps, finalText: result.finalText };
      } catch (error) {
        if (abort.signal.aborted) {
          return cancelled([]);
        }
        return {
          steps: [],
          finalText: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const backend = new TreeMcpBackend(runtime.repo, runtime.queue);
    const gate = (tool: string, args: Record<string, unknown>) => requestPermission(options.projectPath, tool, args);
    const model = buildLanguageModel({
      providerId: settings.provider.id,
      baseUrl: settings.baseUrl,
      apiKey: settings.apiKey,
      model: settings.model,
    });

    const tools: ToolSet = doruToolSet(backend, gate, DEFAULT_PERMISSION_POLICY);
    const mcp = await connectMcpServers(settings.mcpServers, gate, DEFAULT_PERMISSION_POLICY);
    Object.assign(tools, mcp.tools);

    try {
      const result = await runAgent({
        model,
        messages: conversation,
        system,
        tools,
        events,
        signal: abort.signal,
        ...(settings.reasoning !== '' ? { reasoning: settings.reasoning } : {}),
      });
      return { steps: result.steps, finalText: result.finalText };
    } catch (error) {
      if (abort.signal.aborted) {
        return cancelled([]);
      }
      return {
        steps: [],
        finalText: '',
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      await mcp.close();
    }
  } finally {
    chatAborts.delete(options.projectPath);
  }
}
