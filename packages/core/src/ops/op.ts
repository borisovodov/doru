import type { TreeRepository } from '../db/repository';
import type { AttachmentsSnapshot } from '../model/types';

/** Attachments of a nested entity (a name, a fact, …) captured for undo. */
export interface NestedAttachments {
  targetType: string;
  targetId: string;
  attachments: AttachmentsSnapshot;
}

export interface MutationContext {
  repo: TreeRepository;
}

/**
 * Where an op should record its change-log entry; the service writes the row
 * before applying the op. Delete ops record on a target that is about to go,
 * so their entry disappears with the entity and is restored from the op's
 * attachment snapshot on undo.
 */
export interface OpChange {
  targetType: string;
  targetId: string;
  kind: 'created' | 'changed';
}

export interface Op {
  readonly id: string;
  readonly kind: string;
  readonly timestamp: string;
  readonly change?: OpChange;
  apply(ctx: MutationContext): void;
  inverse(ctx: MutationContext): void;
}

export class OpQueue {
  private readonly undoStack: Op[] = [];
  private readonly redoStack: Op[] = [];

  apply(op: Op, ctx: MutationContext): void {
    op.apply(ctx);
    this.undoStack.push(op);
    this.redoStack.length = 0;
  }

  undo(ctx: MutationContext): Op | undefined {
    const op = this.undoStack.pop();
    if (!op) {
      return undefined;
    }
    op.inverse(ctx);
    this.redoStack.push(op);
    return op;
  }

  redo(ctx: MutationContext): Op | undefined {
    const op = this.redoStack.pop();
    if (!op) {
      return undefined;
    }
    op.apply(ctx);
    this.undoStack.push(op);
    return op;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
