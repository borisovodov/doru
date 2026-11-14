import { IconButton } from '@doru/ui';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type {
  AddressRecord,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import { PersonList, TasksView } from '@doru/ui/domain';
import {
  AddressList,
  PlaceholderView,
  RepositoryList,
  SidebarFamilies,
  SidebarFacts,
  SidebarMedia,
  SidebarPlaces,
  SidebarSearch,
  SidebarSources,
  SubmitterList,
  TitleList,
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
  addresses,
  titles,
  todos,
  onOpenPerson,
  onOpenFamily,
  onOpenSource,
  onOpenPlace,
  onOpenRepository,
  onOpenSubmitter,
  onOpenAddress,
  onOpenTitle,
  onNewTitle,
  onNewPerson,
  onNewPlace,
  onNewSource,
  onNewRepository,
  onNewSubmitter,
  onNewAddress,
  onOpenTask,
  onNewTask,
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
  addresses: AddressRecord[];
  titles: TitleRecord[];
  todos: TodoRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenFamily: (familyId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onOpenPlace: (placeId: string) => void;
  onOpenRepository: (repositoryId: string) => void;
  onOpenSubmitter: (submitterId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onOpenTitle: (titleId: string) => void;
  onNewTitle: () => void;
  onNewPerson: () => void;
  onNewPlace: () => void;
  onNewSource: () => void;
  onNewRepository: () => void;
  onNewSubmitter: () => void;
  onNewAddress: () => void;
  onOpenTask: (todoId: string) => void;
  onNewTask: () => void;
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
          <div className="tasks-header">
            <IconButton
              size="sm"
              label={nls.t('features.tree.person.add')}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={onNewPerson}
            />
          </div>
          <PersonList persons={persons.slice(0, PEOPLE_LIST_LIMIT)} onOpen={onOpenPerson} />
          {persons.length > PEOPLE_LIST_LIMIT && (
            <p className="side-bar-note">{nls.t('tree.people.listLimit', PEOPLE_LIST_LIMIT, persons.length)}</p>
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
      return <SidebarFamilies families={families} persons={persons} facts={facts} onOpenFamily={onOpenFamily} />;
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
      return (
        <>
          <div className="tasks-header">
            <IconButton
              size="sm"
              label={nls.t('features.tree.place.add')}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={onNewPlace}
            />
          </div>
          {places.length === 0 ? (
            <PlaceholderView
              title={nls.t('workbench.activityBar.places')}
              description={nls.t('features.places.placeholder')}
            />
          ) : (
            <SidebarPlaces places={places} onOpenPlace={onOpenPlace} />
          )}
        </>
      );
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
          addresses={addresses}
          titles={titles}
          onOpenSource={onOpenSource}
          onOpenRepository={onOpenRepository}
          onOpenSubmitter={onOpenSubmitter}
          onOpenAddress={onOpenAddress}
          onOpenTitle={onOpenTitle}
          onNewTitle={onNewTitle}
          onNewSource={onNewSource}
          onNewRepository={onNewRepository}
          onNewSubmitter={onNewSubmitter}
          onNewAddress={onNewAddress}
        />
      );
    case 'tasks':
      return (
        <TasksView
          todos={todos}
          persons={persons}
          families={families}
          sources={sources}
          places={places}
          repositories={repositories}
          titles={titles}
          onOpenTask={onOpenTask}
          onNewTask={onNewTask}
          onOpenPerson={onOpenPerson}
          onOpenFamily={onOpenFamily}
          onOpenSource={onOpenSource}
          onOpenPlace={onOpenPlace}
          onOpenRepository={onOpenRepository}
          onOpenTitle={onOpenTitle}
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

/** The Sources sidebar: a segmented picker over sources, repositories, submitters, addresses and titles. */
function SourcesSidebar({
  sources,
  citations,
  repositories,
  submitters,
  addresses,
  titles,
  onOpenSource,
  onOpenRepository,
  onOpenSubmitter,
  onOpenAddress,
  onOpenTitle,
  onNewTitle,
  onNewSource,
  onNewRepository,
  onNewSubmitter,
  onNewAddress,
}: {
  sources: SourceRecord[];
  citations: CitationRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  titles: TitleRecord[];
  onOpenSource: (sourceId: string) => void;
  onOpenRepository: (repositoryId: string) => void;
  onOpenSubmitter: (submitterId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onOpenTitle: (titleId: string) => void;
  onNewTitle: () => void;
  onNewSource: () => void;
  onNewRepository: () => void;
  onNewSubmitter: () => void;
  onNewAddress: () => void;
}) {
  const [segment, setSegment] = useState<'sources' | 'repositories' | 'submitters' | 'addresses' | 'titles'>('sources');

  return (
    <>
      <div className="sidebar-segments">
        {(
          [
            ['sources', nls.t('workbench.activityBar.sources')],
            ['titles', nls.t('workbench.activityBar.titles')],
            ['repositories', nls.t('workbench.activityBar.repositories')],
            ['submitters', nls.t('workbench.activityBar.submitters')],
            ['addresses', nls.t('workbench.activityBar.addresses')],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={segment === id ? 'sidebar-segment active' : 'sidebar-segment'}
            onClick={() => setSegment(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {segment === 'sources' && (
        <>
          <div className="tasks-header">
            <IconButton
              size="sm"
              label={nls.t('features.tree.source.add')}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={onNewSource}
            />
          </div>
          {sources.length === 0 ? (
            <PlaceholderView
              title={nls.t('workbench.activityBar.sources')}
              description={nls.t('features.sources.placeholder')}
            />
          ) : (
            <SidebarSources sources={sources} citations={citations} onOpenSource={onOpenSource} />
          )}
        </>
      )}
      {segment === 'repositories' && (
        <>
          <div className="tasks-header">
            <IconButton
              size="sm"
              label={nls.t('features.tree.repository.add')}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={onNewRepository}
            />
          </div>
          <RepositoryList repositories={repositories} onOpenRepository={onOpenRepository} />
        </>
      )}
      {segment === 'submitters' && (
        <>
          <div className="tasks-header">
            <IconButton
              size="sm"
              label={nls.t('features.tree.submitter.add')}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={onNewSubmitter}
            />
          </div>
          <SubmitterList submitters={submitters} onOpenSubmitter={onOpenSubmitter} />
        </>
      )}
      {segment === 'addresses' && (
        <>
          <div className="tasks-header">
            <IconButton
              size="sm"
              label={nls.t('features.tree.address.newAddress')}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={onNewAddress}
            />
          </div>
          <AddressList addresses={addresses} onOpenAddress={onOpenAddress} />
        </>
      )}
      {segment === 'titles' && (
        <>
          <div className="tasks-header">
            <IconButton
              size="sm"
              label={nls.t('features.tree.title.add')}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={onNewTitle}
            />
          </div>
          <TitleList titles={titles} onOpenTitle={onOpenTitle} />
        </>
      )}
    </>
  );
}
