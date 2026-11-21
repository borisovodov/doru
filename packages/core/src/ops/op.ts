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
 * Redo-dependency metadata: delete ops identify the target they remove, and
 * created ops identify the row they create, so dependent redo entries can be
 * pruned when an op can no longer be replayed.
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
  /** Snapshot trees that a successful apply should bind to its removal set. */
  snapshots?: AttachmentsSnapshot[];
  /** Entity ids this op cannot replay without (dropped redo cascades to them). */
  dependsOn?: string[];
}

/** Attaches a redo-safety check to an op without repeating its shape. */
export function withRedoSafe(op: Op, redoSafe: NonNullable<Op['redoSafe']>): Op {
  return { ...op, redoSafe };
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

  /**
   * Replays the top redo entry. A rejected entry is dropped so it cannot
   * block the ones below it; the caller gets it back in `blocked`.
   */
  redo(ctx: MutationContext): { op?: Op; blocked?: Op } | undefined {
    const op = this.redoStack[this.redoStack.length - 1];
    if (!op) {
      return undefined;
    }
    if (op.redoSafe !== undefined && !op.redoSafe(ctx)) {
      this.discardRedo(op);
      return { blocked: op };
    }
    op.apply(ctx);
    this.commitRedo();
    return { op };
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

  /**
   * Drops the top redo entry when replaying it would discard newer data,
   * together with entries that depend on the entity it would have created.
   */
  discardRedo(blocked?: Op): Op | undefined {
    const dropped = this.redoStack.pop();
    const created = blocked?.change?.targetId;
    if (created === undefined) {
      return dropped;
    }
    const unavailable = new Set([created]);
    let changed = true;
    while (changed) {
      changed = false;
      for (let index = this.redoStack.length - 1; index >= 0; index -= 1) {
        const candidate = this.redoStack[index] as Op;
        if (candidate.dependsOn?.some((id) => unavailable.has(id)) !== true) {
          continue;
        }
        this.redoStack.splice(index, 1);
        changed = true;
        if (candidate.change?.kind === 'created') {
          unavailable.add(candidate.change.targetId);
        }
      }
    }
    return dropped;
  }

  /** Drops the top undo entry when its inverse can no longer apply. */
  discardUndo(): Op | undefined {
    return this.undoStack.pop();
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
