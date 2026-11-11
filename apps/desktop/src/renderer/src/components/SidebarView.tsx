import { useState } from 'react';
import type {
  CitationRecord,
  FactRecord,
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TodoRecord,
} from '@doru/core';
import {
  PersonList,
  PlaceholderView,
  RepositoryList,
  SidebarFamilies,
  SidebarFacts,
  SidebarMedia,
  SidebarPlaces,
  SidebarSearch,
  SidebarSources,
  SubmitterList,
  TasksView,
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
  repositories,
  submitters,
  todos,
  onOpenPerson,
  onOpenFamily,
  onOpenSource,
  onOpenPlace,
  onOpenRepository,
  onOpenSubmitter,
  onAddTodo,
  onUpdateTodo,
  onDeleteTodo,
}: {
  activeView: ActivityViewId;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  sources: SourceRecord[];
  media: SidebarMediaItem[];
  citations: CitationRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  todos: TodoRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenFamily: (familyId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onOpenRepository: (repositoryId: string) => void;
  onOpenSubmitter: (submitterId: string) => void;
  onAddTodo: (todo: TodoRecord) => Promise<void>;
  onUpdateTodo: (before: TodoRecord, after: TodoRecord) => Promise<void>;
  onDeleteTodo: (todo: TodoRecord) => Promise<void>;
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
      return (
        <SourcesSidebar
          sources={sources}
          citations={citations}
          repositories={repositories}
          submitters={submitters}
          onOpenSource={onOpenSource}
          onOpenRepository={onOpenRepository}
          onOpenSubmitter={onOpenSubmitter}
        />
      );
    case 'tasks':
      return (
        <TasksView
          todos={todos}
          persons={persons}
          repositories={repositories}
          onAddTodo={onAddTodo}
          onUpdateTodo={onUpdateTodo}
          onDeleteTodo={onDeleteTodo}
          onOpenPerson={onOpenPerson}
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

/** The Sources sidebar: a segmented picker over sources, repositories and submitters. */
function SourcesSidebar({
  sources,
  citations,
  repositories,
  submitters,
  onOpenSource,
  onOpenRepository,
  onOpenSubmitter,
}: {
  sources: SourceRecord[];
  citations: CitationRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  onOpenSource: (sourceId: string) => void;
  onOpenRepository: (repositoryId: string) => void;
  onOpenSubmitter: (submitterId: string) => void;
}) {
  const [segment, setSegment] = useState<'sources' | 'repositories' | 'submitters'>('sources');

  return (
    <>
      <div className="sidebar-segments">
        {(
          [
            ['sources', nls.t('workbench.activityBar.sources')],
            ['repositories', nls.t('workbench.activityBar.repositories')],
            ['submitters', nls.t('workbench.activityBar.submitters')],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={segment === id ? 'sidebar-segment active' : 'sidebar-segment'}
            onClick={() => setSegment(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {segment === 'sources' &&
        (sources.length === 0 ? (
          <PlaceholderView
            title={nls.t('workbench.activityBar.sources')}
            description={nls.t('features.sources.placeholder')}
          />
        ) : (
          <SidebarSources sources={sources} citations={citations} onOpenSource={onOpenSource} />
        ))}
      {segment === 'repositories' && (
        <RepositoryList repositories={repositories} onOpenRepository={onOpenRepository} />
      )}
      {segment === 'submitters' && <SubmitterList submitters={submitters} onOpenSubmitter={onOpenSubmitter} />}
    </>
  );
}
