import { z } from 'zod';
import { jsonSchema, tool, type JSONSchema7, type ToolSet } from 'ai';
import type { TreeMcpBackend } from './backend';

export interface ToolDefinition {
  name: string;
  description: string;
  /** Zod raw shape — the single source of truth for both surfaces. */
  inputSchema: Record<string, z.ZodTypeAny>;
}

/**
 * The single source of truth for the agent toolset. Both surfaces register
 * from these definitions: the in-app AI SDK tool set (`doruToolSet`) derives
 * its JSON Schema via `z.toJSONSchema`, and the MCP server (`DoruMcpServer`)
 * takes the zod shape directly — so the two can never drift apart.
 * Descriptions target small local models: concrete, with explicit defaults.
 */
export const doruTools: ToolDefinition[] = [
  {
    name: 'tree_query',
    description:
      'Search persons in the tree by name. If the query is omitted, returns the first 20 persons in the tree — use this to list everyone when no specific name is known.',
    inputSchema: {
      query: z.string().optional().describe('Free-text search query, matched against names'),
      limit: z.number().optional().describe('Maximum number of results (default 20)'),
    },
  },
  {
    name: 'tree_get',
    description: 'Read a person with the families they belong to.',
    inputSchema: {
      personId: z.string().describe('Person id (e.g. @I1@)'),
    },
  },
  {
    name: 'tree_stats',
    description: 'Return person and family counts for the tree.',
    inputSchema: {},
  },
  {
    name: 'tree_edit',
    description:
      'Apply an edit to the tree. Supports person.add and person.update. Returns the inverse operation for undo.',
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
  {
    name: 'sources_add',
    description: 'Add a source with an optional citation attached to a record.',
    inputSchema: {
      title: z.string().describe('Source title'),
      author: z.string().optional(),
      targetType: z.string().optional().describe('"person" or "family"'),
      targetId: z.string().optional().describe('Id of the cited record'),
    },
  },
  {
    name: 'notes_write',
    description: 'Write a research note attached to a person, family or source.',
    inputSchema: {
      text: z.string().describe('Note text'),
      targetType: z.string().optional(),
      targetId: z.string().optional(),
    },
  },
  {
    name: 'charts_render',
    description: 'Render an ancestor chart for the given person as a standalone SVG image.',
    inputSchema: {
      personId: z.string().describe('Root person id'),
      kind: z.enum(['pedigree']).describe('Chart kind'),
    },
  },
];

/** Builds the AI SDK tool set for the in-app agent from the shared definitions. */
export function doruToolSet(backend: TreeMcpBackend): ToolSet {
  return Object.fromEntries(
    doruTools.map((definition) => [
      definition.name,
      tool({
        description: definition.description,
        inputSchema: jsonSchema(
          z.toJSONSchema(z.object(definition.inputSchema)) as unknown as JSONSchema7,
        ),
        execute: async (args) =>
          backend.invoke(definition.name, (args as Record<string, unknown> | undefined) ?? {}),
      }),
    ]),
  );
}
