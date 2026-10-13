export const TREE_FILE_NAME = 'tree.doru';

export const MEDIA_DIR_NAME = 'media';

export const PROJECT_DIRS = [MEDIA_DIR_NAME] as const;

export interface ProjectLayout {
  folder: string;
  treeFile: string;
  dirs: readonly string[];
}
