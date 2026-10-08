export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const doruTools: ToolDefinition[] = [
  {
    name: 'tree_query',
    description: 'Search and read persons, families, events and sources in the tree.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        personId: { type: 'string' },
        limit: { type: 'number' },
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
