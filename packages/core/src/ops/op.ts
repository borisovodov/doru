import type { TreeRepository } from '../db/repository';

export interface MutationContext {
  repo: TreeRepository;
}

export interface Op {
  readonly id: string;
  readonly kind: string;
  readonly timestamp: string;
  readonly actor: string;
  apply(ctx: MutationContext): void;
  inverse(ctx: MutationContext): void;
}

export class OpQueue {
  private readonly undoStack: Op[] = [];
  private readonly redoStack: Op[] = [];

  constructor(private readonly audit: (op: Op) => void = () => {}) {}

  apply(op: Op, ctx: MutationContext): void {
    op.apply(ctx);
    this.undoStack.push(op);
    this.redoStack.length = 0;
    this.audit(op);
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
