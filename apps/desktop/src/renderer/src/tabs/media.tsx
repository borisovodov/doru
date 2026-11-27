import { mediaDisplayName } from '@doru/core/model';
import { MediaTab } from '@doru/features/media';
import { ENTITY_TAB_PREFIX, type TabDescriptor } from './types';

const prefix = ENTITY_TAB_PREFIX.media;

export const mediaTab: TabDescriptor = {
  kind: 'media',
  prefix,
  label: (id, context) => {
    const mediaId = id.slice(prefix.length);
    const item = context.media.find((entry) => entry.id === mediaId);
    return item === undefined ? '—' : (mediaDisplayName(item) ?? '—');
  },
  render: (id, context) => (
    <MediaTab
      entityId={id.slice(prefix.length)}
      media={context.tree.media}
      api={{ ...context.tree.mediaAdminApi, openSource: context.tabs.open.source }}
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
        media: context.tree.media,
        submitters: context.tree.submitters,
        addresses: context.tree.addresses,
        associations: context.tree.associations,
        tasks: context.tree.tasks,
      }}
      onClose={() => context.tabs.closeTab(id)}
    />
  ),
};
