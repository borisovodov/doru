import type { NoteRecord, SourceRecord } from '../model/types';
import type { Op } from './op';

export function addSourceOp(
  actor: string,
  source: SourceRecord,
  citation?: { targetType: string; targetId: string },
): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'source.add',
    timestamp: new Date().toISOString(),
    actor,
    apply(ctx) {
      ctx.repo.transaction(() => {
        ctx.repo.insertSource(source);
        if (citation) {
          ctx.repo.addSourceCitation(source.id, citation.targetType, citation.targetId);
        }
      });
    },
    inverse(ctx) {
      ctx.repo.deleteSource(source.id);
    },
  };
}

export function addNoteOp(actor: string, note: NoteRecord): Op {
  return {
    id: crypto.randomUUID(),
    kind: 'note.write',
    timestamp: new Date().toISOString(),
    actor,
    apply(ctx) {
      ctx.repo.insertNote(note);
    },
    inverse(ctx) {
      ctx.repo.deleteNote(note.id);
    },
  };
}
