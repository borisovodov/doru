import type { TreeDocument } from '../model/types';

export interface Op {
  readonly id: string;
  readonly kind: string;
  readonly timestamp: string;
  readonly actor: string;
  apply(doc: TreeDocument): void;
  inverse(doc: TreeDocument): void;
}

export class OpQueue {
  private readonly undoStack: Op[] = [];
  private readonly redoStack: Op[] = [];

  constructor(private readonly audit: (op: Op) => void = () => {}) {}

  apply(op: Op, doc: TreeDocument): void {
    op.apply(doc);
    this.undoStack.push(op);
    this.redoStack.length = 0;
    this.audit(op);
  }

  undo(doc: TreeDocument): Op | undefined {
    const op = this.undoStack.pop();
    if (!op) {
      return undefined;
    }
    op.inverse(doc);
    this.redoStack.push(op);
    return op;
  }

  redo(doc: TreeDocument): Op | undefined {
    const op = this.redoStack.pop();
    if (!op) {
      return undefined;
    }
    op.apply(doc);
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
