import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { ToolDefinition } from './tools';

export interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface HostToolSource {
  readonly name: string;
  listTools(): ToolDefinition[];
  call(tool: string, args: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

export class McpHostClient implements HostToolSource {
  readonly name: string;
  private readonly client: Client;
  private readonly transport: StdioClientTransport;
  private tools: ToolDefinition[] = [];

  constructor(config: McpServerConfig) {
    this.name = config.name;
    this.client = new Client({ name: 'doru', version: '1.0.0' }, { capabilities: {} });
    this.transport = new StdioClientTransport({
      command: config.command,
      args: config.args ?? [],
      env: { ...(config.env ?? {}) },
      stderr: 'pipe',
    });
  }

  async connect(): Promise<void> {
    await this.client.connect(this.transport);
    const result = await this.client.listTools();
    this.tools = result.tools.map((tool) => ({
      name: `${this.name}:${tool.name}`,
      description: tool.description ?? '',
      inputSchema: (tool.inputSchema as Record<string, unknown>) ?? { type: 'object' },
    }));
  }

  listTools(): ToolDefinition[] {
    return this.tools;
  }

  async call(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.client.callTool({ name: tool, arguments: args });
    const content = (result.content as Array<{ type?: string; text?: string }>) ?? [];
    return content
      .map((part) => (typeof part.text === 'string' ? part.text : JSON.stringify(part)))
      .join('\n');
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export class McpHostManager {
  private readonly clients = new Map<string, McpHostClient>();

  constructor(private readonly configs: McpServerConfig[]) {}

  async connectAll(): Promise<void> {
    for (const config of this.configs) {
      try {
        const client = new McpHostClient(config);
        await client.connect();
        this.clients.set(config.name, client);
      } catch (error) {
        console.warn(`[doru] failed to connect MCP host "${config.name}":`, error instanceof Error ? error.message : error);
      }
    }
  }

  externalTools(): ToolDefinition[] {
    return [...this.clients.values()].flatMap((client) => client.listTools());
  }

  has(name: string): boolean {
    const separator = name.indexOf(':');
    if (separator === -1) {
      return false;
    }
    return this.clients.has(name.slice(0, separator));
  }

  async invoke(name: string, args: Record<string, unknown>): Promise<unknown> {
    const separator = name.indexOf(':');
    if (separator === -1) {
      throw new Error(`Malformed host tool name: ${name}`);
    }
    const server = name.slice(0, separator);
    const tool = name.slice(separator + 1);
    const client = this.clients.get(server);
    if (!client) {
      throw new Error(`Unknown MCP host: ${server}`);
    }
    return client.call(tool, args);
  }

  async closeAll(): Promise<void> {
    await Promise.all([...this.clients.values()].map((client) => client.close().catch(() => {})));
    this.clients.clear();
  }
}
