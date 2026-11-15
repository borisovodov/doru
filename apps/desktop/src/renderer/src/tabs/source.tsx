import { nls } from '@doru/workbench';
import { SourceTab } from '../components/SourceTab';
import { ENTITY_TAB_PREFIX, entityTabId, type TabDescriptor } from './types';

const prefix = ENTITY_TAB_PREFIX.source;

export const sourceTab: TabDescriptor = {
  kind: 'source',
  prefix,
  newId: () => `new:${crypto.randomUUID()}`,
  label: (id, context) => {
    const sourceId = id.slice(prefix.length);
    if (sourceId.startsWith('new:')) {
      return nls.t('features.tree.source.newSource');
    }
    const source = context.sources.find((entry) => entry.id === sourceId);
    return source?.title ?? '';
  },
  render: (id, context) => {
    const sourceId = id.slice(prefix.length);
    const source = context.tree.sources.find((entry) => entry.id === sourceId);
    if (!sourceId.startsWith('new:') && !source) {
      return <p className="person-missing">{nls.t('features.sources.notFound')}</p>;
    }
    return (
      <SourceTab
        tabId={id}
        sources={context.tree.sources}
        api={{ ...context.tree.sourceApi, openTask: context.tabs.open.task }}
        onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('source', realId))}
        persons={context.tree.persons}
        families={context.tree.families}
        facts={context.tree.facts}
        places={context.tree.places}
        citations={context.tree.citations}
        notes={context.tree.notes}
        media={context.tree.media}
        mediaApi={context.tree.mediaApi}
        onOpenPerson={context.openPersonAndFocus}
        onOpenMedia={context.tabs.open.media}
        onOpenSource={context.tabs.open.source}
        onClose={context.tabs.closeTab}
      />
    );
  },
};
