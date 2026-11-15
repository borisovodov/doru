import { MediaTab } from '../components/MediaTab';
import { ENTITY_TAB_PREFIX, type TabDescriptor } from './types';

const prefix = ENTITY_TAB_PREFIX.media;

export const mediaTab: TabDescriptor = {
  kind: 'media',
  prefix,
  label: (id, context) => {
    const mediaId = id.slice(prefix.length);
    const item = context.media.find((entry) => entry.id === mediaId);
    return item?.title ?? item?.path ?? '—';
  },
  render: (id, context) => (
    <MediaTab
      tabId={id}
      media={context.tree.media}
      api={context.tree.mediaAdminApi}
      attachmentsApi={{ ...context.tree.api, openTask: context.tabs.open.task }}
      sources={context.tree.sources}
      targetData={{
        persons: context.tree.persons,
        families: context.tree.families,
        sources: context.tree.sources,
        places: context.tree.places,
        repositories: context.tree.repositories,
        titles: context.tree.titles,
        facts: context.tree.facts,
        citations: context.tree.citations,
        notes: context.tree.notes,
        media: context.tree.media,
        submitters: context.tree.submitters,
        addresses: context.tree.addresses,
        associations: context.tree.associations,
        todos: context.tree.todos,
      }}
      onClose={context.tabs.closeTab}
    />
  ),
};
