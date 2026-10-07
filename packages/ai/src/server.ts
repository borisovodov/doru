import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';
import type { TreeMcpBackend } from './backend';

function asText(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
  return {
    content: [
      { type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
    ],
  };
}

export class DoruMcpServer {
  readonly server: McpServer;

  constructor(
    backend: TreeMcpBackend,
    version: string,
  ) {
    this.server = new McpServer({ name: 'doru', version });

    this.server.registerTool(
      'tree.query',
      {
        description: 'Search persons in the tree by name.',
        inputSchema: {
          query: z.string().describe('Free-text search query, matched against names'),
          limit: z.number().optional().describe('Maximum number of results (default 20)'),
        },
      },
      async (args) => asText(await backend.invoke('tree.query', args)),
    );

    this.server.registerTool(
      'tree.get',
      {
        description: 'Read a person with the families they belong to.',
        inputSchema: { personId: z.string().describe('Person id (e.g. @I1@)') },
      },
      async (args) => asText(await backend.invoke('tree.get', args)),
    );

    this.server.registerTool(
      'tree.stats',
      { description: 'Return person and family counts for the tree.' },
      async () => asText(await backend.invoke('tree.stats', {})),
    );

    this.server.registerTool(
      'tree.edit',
      {
        description:
          'Apply an edit to the tree. Supports person.add and person.update. Every edit is recorded in the audit log with the calling agent as the actor.',
        inputSchema: {
          op: z
            .discriminatedUnion('kind', [
              z.object({
                kind: z.literal('person.add'),
                person: z.object({
                  id: z.string(),
                  names: z.array(
                    z.object({
                      given: z.string().optional(),
                      surname: z.string().optional(),
                      full: z.string().optional(),
                    }),
                  ),
                  sex: z.enum(['M', 'F', 'U']),
                }),
              }),
              z.object({
                kind: z.literal('person.update'),
                before: z.unknown(),
                after: z.unknown(),
              }),
            ])
            .describe('Edit operation'),
        },
      },
      async (args) => asText(await backend.invoke('tree.edit', { op: args.op })),
    );

    this.server.registerTool(
      'sources.add',
      {
        description: 'Add a source, optionally citing a person or family.',
        inputSchema: {
          title: z.string().describe('Source title'),
          author: z.string().optional(),
          targetType: z.string().optional().describe('"person" or "family"'),
          targetId: z.string().optional().describe('Id of the cited record'),
        },
      },
      async (args) => asText(await backend.invoke('sources.add', args)),
    );

    this.server.registerTool(
      'notes.write',
      {
        description: 'Write a research note, optionally attached to a record.',
        inputSchema: {
          text: z.string().describe('Note text'),
          targetType: z.string().optional(),
          targetId: z.string().optional(),
        },
      },
      async (args) => asText(await backend.invoke('notes.write', args)),
    );

    this.server.registerTool(
      'charts.render',
      {
        description: 'Render chart data for a person (pedigree is supported).',
        inputSchema: {
          personId: z.string().describe('Root person id'),
          kind: z.enum(['pedigree']).describe('Chart kind'),
        },
      },
      async (args) => asText(await backend.invoke('charts.render', args)),
    );
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}
