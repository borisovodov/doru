import type { PersonRecord } from '@doru/core';
import { PersonList, PlaceholderView } from '@doru/features';
import { nls, type ActivityViewId } from '@doru/workbench';

/** Render cap for the People list on very large trees. */
const PEOPLE_LIST_LIMIT = 500;

export function SidebarView({
  activeView,
  persons,
  onOpenPerson,
}: {
  activeView: ActivityViewId;
  persons: PersonRecord[];
  onOpenPerson: (personId: string) => void;
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
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.families')}
          description={nls.t('features.families.placeholder')}
        />
      );
    case 'events':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.events')}
          description={nls.t('features.events.placeholder')}
        />
      );
    case 'places':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.places')}
          description={nls.t('features.places.placeholder')}
        />
      );
    case 'media':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.media')}
          description={nls.t('features.media.placeholder')}
        />
      );
    case 'sources':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.sources')}
          description={nls.t('features.sources.placeholder')}
        />
      );
    case 'tasks':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.tasks')}
          description={nls.t('features.tasks.placeholder')}
        />
      );
    case 'search':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.search')}
          description={nls.t('features.search.placeholder')}
        />
      );
    default:
      return null;
  }
}
