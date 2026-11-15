export type RefreshTree = () => Promise<void>;

export interface TreeEditorDeps {
  projectPath: string | null | undefined;
  refreshTree: RefreshTree;
}
