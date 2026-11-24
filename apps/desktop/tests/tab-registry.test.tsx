import { describe, expect, it } from 'vitest';
import { nls } from '@doru/workbench';
import { describeTab, tabDescriptors, tabLabel } from '../src/renderer/src/tabs/registry';
import type { TabLabelContext } from '../src/renderer/src/tabs/types';

const context: TabLabelContext = {
  persons: [{ id: 'p1', sex: 'F', names: [{ id: 'n1', given: 'Ada', surname: 'Lovelace' }], facts: [] }],
  families: [],
  sources: [{ id: 's1', title: 'Parish register' }],
  places: [],
  repositories: [],
  submitters: [],
  addresses: [],
  tasks: [{ id: 't1', text: 'Check the census', targets: [] }],
  titles: [],
  media: [
    { id: 'm1', title: 'Portrait', absolutePath: '/tmp/portrait.jpg' },
    { id: 'm2', path: 'photos/census.jpg', absolutePath: '/tmp/census.jpg' },
  ],
};

describe('tab registry', () => {
  it('resolves every descriptor by its canonical id', () => {
    for (const descriptor of tabDescriptors) {
      const id = descriptor.id ?? `${descriptor.prefix}x`;
      expect(describeTab(id)?.descriptor.kind).toBe(descriptor.kind);
    }
  });

  it('parses entity ids and rejects unknown tabs', () => {
    expect(describeTab('person:abc')).toMatchObject({ entityId: 'abc', descriptor: { kind: 'person' } });
    expect(describeTab('media:m1')).toMatchObject({ entityId: 'm1', descriptor: { kind: 'media' } });
    expect(describeTab('missing')).toBeUndefined();
    expect(describeTab('tree:1')).toBeUndefined();
  });

  it('labels static tabs', () => {
    expect(tabLabel('tree', context)).toBe(nls.t('features.tree.title'));
    expect(tabLabel('settings', context)).toBe(nls.t('workbench.settings'));
    expect(tabLabel('notices', context)).toBe(nls.t('notices.title'));
    expect(tabLabel('export', context)).toBe(nls.t('workbench.exportGedcom'));
  });

  it('labels entity tabs from the current records', () => {
    expect(tabLabel('person:p1', context)).toBe('Ada Lovelace');
    expect(tabLabel('person:new:1', context)).toBe(nls.t('features.tree.addPerson'));
    expect(tabLabel('person:missing', context)).toBe('missing');

    expect(tabLabel('source:s1', context)).toBe('Parish register');
    expect(tabLabel('source:new:1', context)).toBe(nls.t('features.tree.source.newSource'));

    expect(tabLabel('task:t1', context)).toBe('Check the census');
    expect(tabLabel('task:new:1', context)).toBe(nls.t('features.tasks.newTask'));

    expect(tabLabel('media:m1', context)).toBe('Portrait');
    expect(tabLabel('media:m2', context)).toBe('photos/census.jpg');
  });
});
