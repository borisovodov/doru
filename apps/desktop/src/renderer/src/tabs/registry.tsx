import type { ReactNode } from 'react';
import { addressTab, repositoryTab, submitterTab, titleTab } from './registries';
import { familyTab } from './family';
import { mediaTab } from './media';
import { personTab } from './person';
import { placeTab } from './place';
import { sourceTab } from './source';
import { exportTab, noticesTab, settingsTab, treeTab } from './static';
import { taskTab } from './task';
import type { TabDescriptor, TabLabelContext, TabRenderContext } from './types';

export const tabDescriptors: readonly TabDescriptor[] = [
  treeTab,
  settingsTab,
  noticesTab,
  exportTab,
  personTab,
  familyTab,
  sourceTab,
  placeTab,
  repositoryTab,
  submitterTab,
  addressTab,
  taskTab,
  mediaTab,
  titleTab,
];

export interface TabMatch {
  descriptor: TabDescriptor;
  entityId?: string;
}

export function describeTab(id: string): TabMatch | undefined {
  const exact = tabDescriptors.find((descriptor) => descriptor.id === id);
  if (exact !== undefined) {
    return { descriptor: exact };
  }
  for (const descriptor of tabDescriptors) {
    const prefix = descriptor.prefix;
    if (prefix !== undefined && id.startsWith(prefix)) {
      return { descriptor, entityId: id.slice(prefix.length) };
    }
  }
  return undefined;
}

export function tabLabel(id: string, context: TabLabelContext): string {
  return describeTab(id)?.descriptor.label(id, context) ?? id;
}

export function renderTab(id: string, context: TabRenderContext): ReactNode {
  return describeTab(id)?.descriptor.render(id, context) ?? null;
}
