export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const doruTools: ToolDefinition[] = [
  {
    name: 'tree_query',
    description:
      'Search persons in the tree by name. If the query is omitted, returns the first 20 persons in the tree — use this to list everyone when no specific name is known.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search query, matched against names' },
        limit: { type: 'number', description: 'Maximum number of results (default 20)' },
      },
    },
  },
  {
    name: 'tree_edit',
    description: 'Apply an edit operation to the tree. Returns the inverse operation for undo.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'object' },
      },
      required: ['op'],
    },
  },
  {
    name: 'sources_add',
    description: 'Add a source with an optional citation attached to a record.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        author: { type: 'string' },
        targetType: { type: 'string' },
        targetId: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'notes_write',
    description: 'Write a research note attached to a person, family or source.',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        targetType: { type: 'string' },
        targetId: { type: 'string' },
      },
      required: ['text'],
    },
  },
  {
    name: 'charts_render',
    description: 'Render a chart (pedigree, fan) for the given person.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string' },
        kind: { type: 'string', enum: ['pedigree', 'fan'] },
      },
      required: ['personId', 'kind'],
    },
  },
];
