import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'dummy', version: '1.0.0' });

server.registerTool(
  'echo',
  { description: 'Echo text back.', inputSchema: { text: z.string() } },
  async (args) => ({ content: [{ type: 'text', text: `echo: ${args.text}` }] }),
);

server.registerTool(
  'count',
  { description: 'Return the length of the text.', inputSchema: { text: z.string() } },
  async (args) => ({ content: [{ type: 'text', text: String(args.text.length) }] }),
);

await server.connect(new StdioServerTransport());
