import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { TreeMcpBackend } from './backend';
import { doruTools } from './tools';

function asText(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
    ],
  };
}

/**
 * The Dóru tree as an MCP server: the same toolset the in-app agent uses,
 * served over stdio for ACP agents and external MCP clients. Tool definitions
 * come from the shared `doruTools` list, so both surfaces can never drift
 * apart.
 */
export class DoruMcpServer {
  readonly server: McpServer;

  constructor(
    backend: TreeMcpBackend,
    version: string,
  ) {
    this.server = new McpServer({ name: 'doru', version });

    for (const definition of doruTools) {
      this.server.registerTool(
        definition.name,
        {
          description: definition.description,
          // The MCP SDK takes the zod raw shape directly.
          inputSchema: definition.inputSchema,
        },
        async (args) =>
          asText(await backend.invoke(definition.name, (args ?? {}) as Record<string, unknown>)),
      );
    }
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}
