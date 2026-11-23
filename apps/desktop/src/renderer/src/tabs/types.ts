import type { ReactNode } from 'react';
import type {
  AddressRecord,
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TaskRecord,
} from '@doru/core';
import type { MediaWithPath } from '@doru/ui/domain';
import type { TabInfo } from '@doru/workbench';
import type { useAiSettings } from '../hooks/useAiSettings';
import type { useProject } from '../hooks/useProject';
import type { useTheme } from '../hooks/useTheme';
import type { useTreeData } from '../hooks/useTreeData';

export const TREE_TAB_ID = 'tree';
export const SETTINGS_TAB_ID = 'settings';
export const NOTICES_TAB_ID = 'notices';
export const EXPORT_TAB_ID = 'export';

export const ENTITY_TAB_PREFIX = {
  person: 'person:',
  family: 'family:',
  source: 'source:',
  place: 'place:',
  repository: 'repository:',
  submitter: 'submitter:',
  address: 'address:',
  task: 'task:',
  media: 'media:',
  title: 'title:',
} as const;

export type EntityTabKind = keyof typeof ENTITY_TAB_PREFIX;
export type StaticTabKind = 'tree' | 'settings' | 'notices' | 'export';
export type TabKind = EntityTabKind | StaticTabKind;

export type EntityOpeners = { [K in EntityTabKind]: (entityId: string) => void };
export type NewTabOpeners = { [K in NewEntityTabKind]: () => void };
export type StaticOpeners = { [K in StaticTabKind]: () => void };

export type NewEntityTabKind =
  | 'person'
  | 'source'
  | 'place'
  | 'repository'
  | 'submitter'
  | 'address'
  | 'task'
  | 'title';

export interface OpenTab {
  id: string;
  closable: boolean;
}

export interface TabsApi {
  openTabs: OpenTab[];
  activeTabId: string | null;
  tabInfos: TabInfo[];
  setActiveTabId: (id: string | null) => void;
  /** Persists open drafts, then closes every tab. False keeps them open. */
  resetToTree: () => Promise<boolean>;
  ensureTreeTab: () => void;
  openTab: (id: string) => void;
  closeTab: (id: string) => void;
  replaceTab: (oldId: string, newId: string) => void;
  nextTab: () => void;
  prevTab: () => void;
  openTabAt: (index: number) => void;
  reorderTabs: (sourceId: string, dropIndex: number) => void;
  open: EntityOpeners;
  openNew: NewTabOpeners;
  openStatic: StaticOpeners;
}

export interface TabLabelContext {
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  tasks: TaskRecord[];
  titles: TitleRecord[];
  media: MediaWithPath[];
}

export interface TabRenderContext {
  tree: ReturnType<typeof useTreeData>;
  tabs: TabsApi;
  projectPath: string | null | undefined;
  personPhotos: ReadonlyMap<string, string>;
  canvasFocus: { personId: string; nonce: number } | null;
  openPersonAndFocus: (personId: string) => void;
  theme: ReturnType<typeof useTheme>;
  ai: ReturnType<typeof useAiSettings>;
  project: ReturnType<typeof useProject>;
  version: string;
}

export interface TabDescriptor {
  kind: TabKind;
  /** Exact id for a singleton tab (tree, settings, notices, export). */
  id?: string;
  /** Entity id prefix for a tab that opens one domain record. */
  prefix?: string;
  /** Builds a fresh `new:` entity id when the tab creates a record. */
  newId?: () => string;
  label(id: string, context: TabLabelContext): string;
  render(id: string, context: TabRenderContext): ReactNode;
}

export function newEntityId(): string {
  return `new:${crypto.randomUUID()}`;
}

export function entityTabId(kind: EntityTabKind, entityId: string): string {
  return `${ENTITY_TAB_PREFIX[kind]}${entityId}`;
}
