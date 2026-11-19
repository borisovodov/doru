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
  /**
   * Whether redoing a destructive op is still safe: a concurrent writer may
   * have added rows that `apply` would cascade away and `inverse` cannot
   * restore. Ops leave this unset when redo always replays exactly.
   */
  redoSafe?(ctx: MutationContext): boolean;
}

export class OpQueue {
  private readonly undoStack: Op[] = [];
  private readonly redoStack: Op[] = [];

  apply(op: Op, ctx: MutationContext): void {
    op.apply(ctx);
    this.push(op);
  }

  /** Publishes an operation whose database mutation already committed. */
  push(op: Op): void {
    this.undoStack.push(op);
    this.redoStack.length = 0;
  }

  undo(ctx: MutationContext): Op | undefined {
    const op = this.undoStack[this.undoStack.length - 1];
    if (!op) {
      return undefined;
    }
    op.inverse(ctx);
    this.commitUndo();
    return op;
  }

  redo(ctx: MutationContext): Op | undefined {
    const op = this.redoStack[this.redoStack.length - 1];
    if (!op) {
      return undefined;
    }
    if (op.redoSafe !== undefined && !op.redoSafe(ctx)) {
      return undefined;
    }
    op.apply(ctx);
    this.commitRedo();
    return op;
  }

  /**
   * Moves the top undo entry to the redo stack. Callers that run the inverse
   * in their own transaction invoke this only after COMMIT succeeds; a failed
   * replay or commit leaves the history untouched so the user can retry.
   */
  commitUndo(): Op | undefined {
    const op = this.undoStack.pop();
    if (op !== undefined) {
      this.redoStack.push(op);
    }
    return op;
  }

  /** Moves the top redo entry back to the undo stack after a committed apply. */
  commitRedo(): Op | undefined {
    const op = this.redoStack.pop();
    if (op !== undefined) {
      this.undoStack.push(op);
    }
    return op;
  }

  /** The op that `undo` would invert, without touching the stacks. */
  peekUndo(): Op | undefined {
    return this.undoStack[this.undoStack.length - 1];
  }

  /** The op that `redo` would re-apply, without touching the stacks. */
  peekRedo(): Op | undefined {
    return this.redoStack[this.redoStack.length - 1];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
