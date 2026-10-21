// External MCP servers for the agent chat, powered by @ai-sdk/mcp.
// Each server is spawned as a stdio subprocess; its tools are namespaced
// "<server>:<tool>" and routed through the same permission policy and gate
// as the built-in tree tools.
import { createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import type { Tool, ToolSet } from 'ai';
import type { PermissionGate } from './agent';
import { toolPermission, type PermissionPolicy } from './permissions';

export interface McpServerSettings {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpToolSetHandle {
  tools: ToolSet;
  close(): Promise<void>;
}

interface McpCallResultLike {
  content?: Array<{ type?: string; text?: string }>;
  isError?: boolean;
}

/**
 * @ai-sdk/mcp returns the raw MCP CallToolResult. Normalize it to the text
 * the model should see, throwing on `isError` so it surfaces as a tool error.
 */
function normalizeMcpOutput(output: unknown): unknown {
  if (typeof output !== 'object' || output === null || !('content' in output)) {
    return output;
  }
  const result = output as McpCallResultLike;
  const parts = result.content ?? [];
  const text = parts
    .filter((part) => typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
  const normalized = text !== '' ? text : parts.map((part) => JSON.stringify(part)).join('\n');
  if (result.isError) {
    throw new Error(normalized);
  }
  return normalized;
}

export async function connectMcpServers(
  servers: McpServerSettings[],
  gate: PermissionGate,
  policy: PermissionPolicy,
): Promise<McpToolSetHandle> {
  const clients: Array<{ close: () => Promise<void> }> = [];
  const tools: ToolSet = {};

  for (const server of servers) {
    try {
      const client = await createMCPClient({
        transport: new Experimental_StdioMCPTransport({
          command: server.command,
          args: server.args ?? [],
          env: { ...(server.env ?? {}) },
          stderr: 'pipe',
        }),
      });
      clients.push(client);
      const serverTools = await client.tools();
      for (const [name, serverTool] of Object.entries(serverTools)) {
        const fullName = `${server.name}:${name}`;
        const gated: Tool = {
          ...serverTool,
          execute: async (input, options) => {
            const permission = toolPermission(policy, fullName);
            if (permission === 'deny') {
              throw new Error('Permission denied by the user.');
            }
            if (permission === 'ask') {
              const allowed = await gate(fullName, (input as Record<string, unknown> | undefined) ?? {});
              if (!allowed) {
                throw new Error('Permission denied by the user.');
              }
            }
            return normalizeMcpOutput(await serverTool.execute(input, options));
          },
        };
        tools[fullName] = gated;
      }
    } catch (error) {
      console.warn(
        `[doru] failed to connect MCP server "${server.name}":`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return {
    tools,
    close: async () => {
      await Promise.all(clients.map((client) => client.close().catch(() => {})));
    },
  };
}
