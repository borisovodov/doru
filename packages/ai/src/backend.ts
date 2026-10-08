import {
  OpQueue,
  addNoteOp,
  addPersonOp,
  addSourceOp,
  computePedigree,
  updatePersonOp,
  type PersonRecord,
  type TreeRepository,
  type TreeStats,
} from '@doru/core';

export type TreeEditOp =
  | { kind: 'person.add'; person: PersonRecord }
  | { kind: 'person.update'; before: PersonRecord; after: PersonRecord };

export class TreeMcpBackend {
  actor: string;

  constructor(
    private readonly repo: TreeRepository,
    private readonly queue: OpQueue,
    actor: string,
  ) {
    this.actor = actor;
  }

  async invoke(name: string, args: Record<string, unknown>): Promise<unknown> {
    switch (name) {
      case 'tree_query':
        return this.query(args.query as string | undefined, args.limit as number | undefined);
      case 'tree_get':
        return this.get(args.personId as string);
      case 'tree_stats':
        return this.stats();
      case 'tree_edit':
        return this.edit(args.op as TreeEditOp);
      case 'sources_add':
        return this.addSource(args);
      case 'notes_write':
        return this.writeNote(args);
      case 'charts_render':
        return this.renderChart(args.personId as string, args.kind as string);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  private query(query?: string, limit?: number): PersonRecord[] {
    const normalized = normalizeSearch(query);
    return this.repo.listPersons({ search: normalized, limit: limit ?? 20 });
  }

  private get(personId: string): unknown {
    const person = this.repo.getPerson(personId);
    if (!person) {
      return { found: false };
    }
    const families = this.repo
      .listFamilies()
      .filter((family) => family.parents.includes(personId) || family.children.includes(personId));
    return { found: true, person, families };
  }

  private stats(): TreeStats {
    return { persons: this.repo.countPersons(), families: this.repo.countFamilies() };
  }

  private edit(op: TreeEditOp): unknown {
    if (!op || typeof op !== 'object') {
      throw new Error('tree_edit requires an "op" object');
    }
    if (op.kind === 'person.add') {
      this.queue.apply(addPersonOp(this.actor, op.person), { repo: this.repo });
      return { ok: true, canUndo: this.queue.canUndo() };
    }
    if (op.kind === 'person.update') {
      this.queue.apply(updatePersonOp(this.actor, op.before, op.after), { repo: this.repo });
      return { ok: true, canUndo: this.queue.canUndo() };
    }
    throw new Error(`Unsupported op kind: ${(op as { kind?: string }).kind}`);
  }

  private addSource(args: Record<string, unknown>): unknown {
    const title = args.title as string;
    if (!title) {
      throw new Error('sources_add requires a "title"');
    }
    const source = {
      id: crypto.randomUUID(),
      title,
      author: args.author as string | undefined,
      publication: args.publication as string | undefined,
    };
    const targetType = args.targetType as string | undefined;
    const targetId = args.targetId as string | undefined;
    const citation = targetType && targetId ? { targetType, targetId } : undefined;
    this.queue.apply(addSourceOp(this.actor, source, citation), { repo: this.repo });
    return { ok: true, id: source.id };
  }

  private writeNote(args: Record<string, unknown>): unknown {
    const text = args.text as string;
    if (!text) {
      throw new Error('notes_write requires "text"');
    }
    const note = {
      id: crypto.randomUUID(),
      text,
      targetType: args.targetType as string | undefined,
      targetId: args.targetId as string | undefined,
    };
    this.queue.apply(addNoteOp(this.actor, note), { repo: this.repo });
    return { ok: true, id: note.id };
  }

  private renderChart(personId: string, kind: string): unknown {
    if (!personId) {
      throw new Error('charts_render requires "personId"');
    }
    if (kind === 'pedigree') {
      const root = computePedigree(this.repo, personId, 5);
      return { kind, root };
    }
    throw new Error(`Unsupported chart kind: ${kind}`);
  }
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
