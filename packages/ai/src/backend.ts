import { type PersonName, type PersonRecord, TreeService } from '@doru/core';

export type TreeEditOp =
  { kind: 'person.add'; person: PersonRecord } | { kind: 'person.update'; before: PersonRecord; after: PersonRecord };

/**
 * The agent-facing tree surface: adapts the MCP/AI tool calls onto the
 * project's `TreeService`. The domain rules live in the service; this class
 * only maps tool arguments, validates them for model output (which is
 * untrusted), and shapes the tool replies.
 */
export class TreeMcpBackend {
  constructor(private readonly service: TreeService) {}

  async invoke(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'tree_query':
        return this.query(
          args['query'] as string | undefined,
          args['limit'] as number | undefined,
          args['sex'] as string | undefined,
        );
      case 'tree_get':
        return this.get(args['personId'] as string);
      case 'tree_stats':
        return this.service.stats();
      case 'tree_edit':
        return this.edit(args['op']);
      case 'tree_add_relative':
        return this.addRelative(
          args['relation'] as 'child' | 'spouse' | 'parent',
          args['anchorId'] as string,
          args['person'] as PersonRecord,
        );
      case 'sources_add':
        return this.addSource(args);
      case 'notes_write':
        return this.writeNote(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private query(query?: string, limit?: number, sex?: string): PersonRecord[] {
    const normalized = normalizeSearch(query);
    const sexFilter = sex === 'M' || sex === 'F' || sex === 'X' || sex === 'U' ? sex : undefined;
    return this.service.listPersons({ search: normalized, sex: sexFilter, limit: limit ?? 20 });
  }

  private get(personId: string): unknown {
    const person = this.service.getPerson(personId);
    if (!person) {
      return { found: false };
    }
    const families = this.service.listFamiliesForPerson(personId);
    return { found: true, person, families };
  }

  private edit(op: unknown): unknown {
    if (op === null || typeof op !== 'object') {
      throw new Error('tree_edit requires an "op" object');
    }
    const record = op as Record<string, unknown>;
    if (record['kind'] === 'person.add') {
      const person = normalizePerson(record['person']);
      if (this.service.getPerson(person.id)) {
        throw new Error(
          `A person with id "${person.id}" already exists in the tree; the new person needs an unused id.`,
        );
      }
      const state = this.service.addPerson(person);
      return { ok: true, canUndo: state.canUndo };
    }
    if (record['kind'] === 'person.update') {
      const state = this.service.updatePerson(normalizePerson(record['before']), normalizePerson(record['after']));
      return { ok: true, canUndo: state.canUndo };
    }
    throw new Error(`Unsupported op kind: ${String(record['kind'])}`);
  }

  /**
   * Creates a person and links them to the anchor as a child, spouse or
   * parent — the service reuses the anchor's family or creates one.
   */
  private addRelative(relation: 'child' | 'spouse' | 'parent', anchorId: string, person: PersonRecord): unknown {
    const normalized = normalizePerson(person);
    if (this.service.getPerson(normalized.id)) {
      throw new Error(
        `A person with id "${normalized.id}" already exists in the tree; the new person needs an unused id.`,
      );
    }
    if (!this.service.getPerson(anchorId)) {
      return { ok: false, error: `Unknown anchor person: ${anchorId}` };
    }
    const state = this.service.addRelative(relation, anchorId, normalized);
    return { ok: true, canUndo: state.canUndo };
  }

  private addSource(args: Record<string, unknown>): unknown {
    const title = args['title'] as string;
    if (!title) {
      throw new Error('sources_add requires a "title"');
    }
    const source = {
      id: crypto.randomUUID(),
      title,
      author: args['author'] as string | undefined,
      publication: args['publication'] as string | undefined,
    };
    const targetType = args['targetType'] as string | undefined;
    const targetId = args['targetId'] as string | undefined;
    this.service.addSource(source, targetType, targetId);
    return { ok: true, id: source.id };
  }

  private writeNote(args: Record<string, unknown>): unknown {
    const text = args['text'] as string;
    if (!text) {
      throw new Error('notes_write requires "text"');
    }
    const note = {
      id: crypto.randomUUID(),
      text,
      targetType: args['targetType'] as string | undefined,
      targetId: args['targetId'] as string | undefined,
    };
    this.service.addNote(note);
    return { ok: true, id: note.id };
  }
}

/**
 * Completes a person payload coming from a model: name ids are generated
 * when the model omitted them (they exist for stable in-app addressing,
 * not for the model to invent), missing optional parts default to empty.
 */
function normalizePerson(person: unknown): PersonRecord {
  if (person === null || typeof person !== 'object') {
    throw new Error('a person payload with an "id" is required');
  }
  const record = person as Record<string, unknown>;
  const id = record['id'];
  if (typeof id !== 'string' || id === '') {
    throw new Error('a person payload with an "id" is required');
  }
  const rawNames: unknown[] = Array.isArray(record['names']) ? (record['names'] as unknown[]) : [];
  const names: PersonName[] = rawNames.map((rawName: unknown) => {
    const name = (typeof rawName === 'object' && rawName !== null ? rawName : {}) as Partial<PersonName>;
    return {
      id: typeof name.id === 'string' && name.id !== '' ? name.id : crypto.randomUUID(),
      full: name.full,
      given: name.given,
      surname: name.surname,
      surnamePrefix: name.surnamePrefix,
      nickname: name.nickname,
      prefix: name.prefix,
      suffix: name.suffix,
      type: name.type,
    };
  });
  const sex = record['sex'];
  return {
    id,
    xref: typeof record['xref'] === 'string' ? record['xref'] : undefined,
    sex: sex === 'M' || sex === 'F' || sex === 'X' || sex === 'U' ? sex : 'U',
    names,
    facts: Array.isArray(record['facts']) ? (record['facts'] as PersonRecord['facts']) : [],
  };
}

function normalizeSearch(query: string | undefined): string | undefined {
  if (!query) {
    return undefined;
  }
  const trimmed = query.trim();
  if (trimmed === '' || /^[\s*?%]*$/.test(trimmed)) {
    return undefined;
  }
  return trimmed.replace(/[*?%]/g, ' ').trim() || undefined;
}
