import { app } from 'electron';
import { dirname, resolve } from 'node:path';
import {
  AcpAgentClient,
  AgentRuntime,
  AnthropicChatConnector,
  DEFAULT_PERMISSION_POLICY,
  McpHostManager,
  OpenAIChatConnector,
  TreeMcpBackend,
  type AcpMcpServerEntry,
  type ChatMessage,
  type ChatSendResult,
} from '@doru/ai';
import { loadAiSettings, type ResolvedAiSettings } from './ai-settings';
import { ensureRuntime } from './runtime';
import { acpClients, pendingPermissions, projectWindows } from './state';

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

export async function sendChat(options: { projectPath: string; messages: ChatMessage[] }): Promise<ChatSendResult> {
  const settings = loadAiSettings();
  if (!settings.configured) {
    return {
      steps: [],
      finalText: '',
      error: `AI provider is not configured. Open the settings (gear icon) to set it up.`,
    };
  }
  const { runtime } = await ensureRuntime(options.projectPath);
  const lastUser = [...options.messages].reverse().find((message) => message.role === 'user');

  const systemMessage: ChatMessage = {
    role: 'system',
    content:
      'You are a genealogy assistant working with the user\'s family tree. ' +
      'Use tree_stats to see how large the tree is, and tree_query without a query to list persons. ' +
      'Wildcards are not needed: an empty query already lists the tree. ' +
      'For edits, use tree_edit.',
  };
  const conversation = [systemMessage, ...options.messages];

  if (settings.preset.dialect === 'acp') {
    try {
      const client = await ensureAcpClient(options.projectPath, settings);
      const result = await client.prompt(lastUser?.content ?? '');
      return { steps: result.steps, finalText: result.finalText };
    } catch (error) {
      return {
        steps: [],
        finalText: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  const backend = new TreeMcpBackend(runtime.repo, runtime.queue);
  const model =
    settings.preset.dialect === 'anthropic'
      ? new AnthropicChatConnector({ baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model })
      : new OpenAIChatConnector({ baseUrl: settings.baseUrl, apiKey: settings.apiKey, model: settings.model });

  let host: McpHostManager | null = null;
  if (settings.mcpServers.length > 0) {
    host = new McpHostManager(settings.mcpServers);
    await host.connectAll();
  }
  const extraTools = host?.externalTools() ?? [];
  const extraInvoke = host ? (name: string, args: Record<string, unknown>) => host.invoke(name, args) : null;
  const agent = new AgentRuntime(
    model,
    backend,
    (tool, args) => requestPermission(options.projectPath, tool, args),
    DEFAULT_PERMISSION_POLICY,
    extraTools,
    extraInvoke,
  );
  try {
    const result = await agent.run(conversation);
    return { steps: result.steps, finalText: result.finalText };
  } catch (error) {
    return {
      steps: [],
      finalText: '',
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (host) {
      await host.closeAll();
    }
  }
}
