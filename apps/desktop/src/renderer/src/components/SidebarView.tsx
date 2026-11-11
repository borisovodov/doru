import type { CitationRecord, FactRecord, FamilyRecord, PersonRecord, PlaceRecord, SourceRecord } from '@doru/core';
import {
  PersonList,
  PlaceholderView,
  SidebarFamilies,
  SidebarFacts,
  SidebarMedia,
  SidebarPlaces,
  SidebarSearch,
  SidebarSources,
  type SidebarMediaItem,
} from '@doru/features';
import { nls, type ActivityViewId } from '@doru/workbench';

/** Render cap for the People list on very large trees. */
const PEOPLE_LIST_LIMIT = 500;

export function SidebarView({
  activeView,
  persons,
  families,
  facts,
  sources,
  media,
  citations,
  places,
  onOpenPerson,
  onOpenFamily,
  onOpenSource,
  onOpenPlace,
}: {
  activeView: ActivityViewId;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  sources: SourceRecord[];
  media: SidebarMediaItem[];
  citations: CitationRecord[];
  places: PlaceRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenFamily: (familyId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onOpenPlace: (placeId: string) => void;
}) {
  switch (activeView) {
    case 'people':
      if (persons.length === 0) {
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.people')}
            description={nls.t('features.people.placeholder')}
          />
        );
      }
      return (
        <>
          <PersonList persons={persons.slice(0, PEOPLE_LIST_LIMIT)} onOpen={onOpenPerson} />
          {persons.length > PEOPLE_LIST_LIMIT && (
            <p className="side-bar-note">
              {nls.t('tree.people.listLimit', PEOPLE_LIST_LIMIT, persons.length)}
            </p>
          )}
        </>
      );
    case 'families':
      if (families.length === 0) {
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.families')}
            description={nls.t('features.families.placeholder')}
          />
        );
      }
      return (
        <SidebarFamilies
          families={families}
          persons={persons}
          facts={facts}
          onOpenFamily={onOpenFamily}
        />
      );
    case 'events':
      if (facts.length === 0) {
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.events')}
            description={nls.t('features.events.placeholder')}
          />
        );
      }
      return <SidebarFacts facts={facts} persons={persons} families={families} onOpenPerson={onOpenPerson} />;
    case 'places':
      if (places.length === 0) {
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.places')}
            description={nls.t('features.places.placeholder')}
          />
        );
      }
      return <SidebarPlaces places={places} onOpenPlace={onOpenPlace} />;
    case 'media':
      if (media.length === 0) {
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.media')}
            description={nls.t('features.media.placeholder')}
          />
        );
      }
      return <SidebarMedia media={media} persons={persons} onOpenPerson={onOpenPerson} />;
    case 'sources':
      if (sources.length === 0) {
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.sources')}
            description={nls.t('features.sources.placeholder')}
          />
        );
      }
      return <SidebarSources sources={sources} citations={citations} onOpenSource={onOpenSource} />;
    case 'tasks':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.tasks')}
          description={nls.t('features.tasks.placeholder')}
        />
      );
    case 'registries':
      return (
        <PlaceholderView
          title={nls.t('workbench.registries')}
          description={nls.t('features.registries.placeholder')}
        />
      );
    case 'search':
      return (
        <SidebarSearch
          persons={persons}
          families={families}
          sources={sources}
          facts={facts}
          onOpenPerson={onOpenPerson}
          onOpenFamily={onOpenFamily}
          onOpenSource={onOpenSource}
        />
      );
    default:
      return null;
  }
}
