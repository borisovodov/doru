import { placeName } from '@doru/core/model';
import { nls } from '@doru/workbench';
import { PlaceTab } from '../components/PlaceTab';
import { ENTITY_TAB_PREFIX, entityTabId, type TabDescriptor } from './types';

const prefix = ENTITY_TAB_PREFIX.place;

export const placeTab: TabDescriptor = {
  kind: 'place',
  prefix,
  newId: () => `new:${crypto.randomUUID()}`,
  label: (id, context) => {
    const placeId = id.slice(prefix.length);
    if (placeId.startsWith('new:')) {
      return nls.t('features.tree.place.newPlace');
    }
    const place = context.places.find((entry) => entry.id === placeId);
    return place ? placeName(place) : placeId;
  },
  render: (id, context) => (
    <PlaceTab
      tabId={id}
      places={context.tree.places}
      api={{ ...context.tree.placeApi, openTask: context.tabs.open.task }}
      onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('place', realId))}
      persons={context.tree.persons}
      families={context.tree.families}
      facts={context.tree.facts}
      sources={context.tree.sources}
      media={context.tree.media}
      mediaApi={context.tree.mediaApi}
      onOpenPerson={context.openPersonAndFocus}
      onOpenMedia={context.tabs.open.media}
      onOpenSource={context.tabs.open.source}
      onClose={context.tabs.closeTab}
    />
  ),
};
