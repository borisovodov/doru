import type { ReactNode } from 'react';

export interface EditorAreaProps {
  children?: ReactNode;
}

export function EditorArea({ children }: EditorAreaProps) {
  return <div className="editor-area">{children}</div>;
}
