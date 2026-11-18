import { IconButton } from '@doru/ui';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TitleRecord,
  TodoRecord,
} from '@doru/core';
import { PersonList, TasksView, type TaskTargetData } from '@doru/ui/domain';
import {
  AddressList,
  CitationsList,
  NotesList,
  PlaceholderView,
  RepositoryList,
  SidebarFamilies,
  SidebarFacts,
  SidebarMedia,
  SidebarPlaces,
  SidebarSearch,
  SidebarSources,
  SubmitterList,
  TagsList,
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
  notes,
  places,
  repositories,
  submitters,
  tags,
  tagLinks,
  addresses,
  titles,
  todos,
  associations,
  onOpenPerson,
  onOpenMedia,
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
  onNewMedia,
  onNewSource,
  onNewRepository,
  onNewSubmitter,
  onNewAddress,
  onOpenTask,
  onNewTask,
  onDeleteTag,
}: {
  activeView: ActivityViewId;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  sources: SourceRecord[];
  media: SidebarMediaItem[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  tags: TagRecord[];
  tagLinks: TagLinkRecord[];
  addresses: AddressRecord[];
  titles: TitleRecord[];
  todos: TodoRecord[];
  associations: AssociationRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenMedia: (mediaId: string) => void;
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
  onNewMedia: () => void;
  onNewSource: () => void;
  onNewRepository: () => void;
  onNewSubmitter: () => void;
  onNewAddress: () => void;
  onOpenTask: (todoId: string) => void;
  onNewTask: () => void;
  onDeleteTag: (tag: TagRecord) => void;
}) {
  const targetData: TaskTargetData = {
    persons,
    families,
    sources,
    places,
    repositories,
    titles,
    facts,
    citations,
    notes,
    media,
    submitters,
    addresses,
    associations,
    todos,
  };
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
    case 'media': {
      const resolvedMedia = media.filter((item) => (item.files ?? []).some((file) => file.absolutePath !== ''));
      return (
        <>
          <div className="tasks-header">
            <IconButton
              size="sm"
              label={nls.t('features.tree.media.add')}
              icon={<Plus size={14} aria-hidden="true" />}
              onClick={onNewMedia}
            />
          </div>
          {resolvedMedia.length === 0 ? (
            <PlaceholderView
              title={nls.t('workbench.activityBar.media')}
              description={nls.t('features.media.placeholder')}
            />
          ) : (
            <SidebarMedia media={resolvedMedia} persons={persons} onOpenMedia={onOpenMedia} />
          )}
        </>
      );
    }
    case 'sources':
      return (
        <SourcesSidebar
          sources={sources}
          citations={citations}
          notes={notes}
          repositories={repositories}
          submitters={submitters}
          tags={tags}
          tagLinks={tagLinks}
          addresses={addresses}
          titles={titles}
          targetData={targetData}
          onOpenSource={onOpenSource}
          onOpenRepository={onOpenRepository}
          onOpenSubmitter={onOpenSubmitter}
          onOpenAddress={onOpenAddress}
          onOpenTitle={onOpenTitle}
          onDeleteTag={onDeleteTag}
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
          facts={facts}
          citations={citations}
          notes={notes}
          media={media}
          submitters={submitters}
          addresses={addresses}
          associations={associations}
          onOpenTask={onOpenTask}
          onNewTask={onNewTask}
          onOpenPerson={onOpenPerson}
          onOpenFamily={onOpenFamily}
          onOpenSource={onOpenSource}
          onOpenPlace={onOpenPlace}
          onOpenRepository={onOpenRepository}
          onOpenSubmitter={onOpenSubmitter}
          onOpenAddress={onOpenAddress}
          onOpenMedia={onOpenMedia}
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
  notes,
  repositories,
  submitters,
  tags,
  tagLinks,
  addresses,
  titles,
  targetData,
  onOpenSource,
  onOpenRepository,
  onOpenSubmitter,
  onOpenAddress,
  onOpenTitle,
  onDeleteTag,
  onNewTitle,
  onNewSource,
  onNewRepository,
  onNewSubmitter,
  onNewAddress,
}: {
  sources: SourceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  repositories: RepositoryRecord[];
  submitters: SubmitterRecord[];
  tags: TagRecord[];
  tagLinks: TagLinkRecord[];
  addresses: AddressRecord[];
  titles: TitleRecord[];
  targetData: TaskTargetData;
  onOpenSource: (sourceId: string) => void;
  onOpenRepository: (repositoryId: string) => void;
  onOpenSubmitter: (submitterId: string) => void;
  onOpenAddress: (addressId: string) => void;
  onOpenTitle: (titleId: string) => void;
  onDeleteTag: (tag: TagRecord) => void;
  onNewTitle: () => void;
  onNewSource: () => void;
  onNewRepository: () => void;
  onNewSubmitter: () => void;
  onNewAddress: () => void;
}) {
  const [segment, setSegment] = useState<
    'sources' | 'citations' | 'notes' | 'repositories' | 'submitters' | 'addresses' | 'titles' | 'tags'
  >('sources');

  return (
    <>
      <div className="sidebar-segments">
        {(
          [
            ['sources', nls.t('workbench.activityBar.sources')],
            ['citations', nls.t('features.tree.citations.title')],
            ['notes', nls.t('features.tree.notes.title')],
            ['titles', nls.t('workbench.activityBar.titles')],
            ['repositories', nls.t('workbench.activityBar.repositories')],
            ['submitters', nls.t('workbench.activityBar.submitters')],
            ['addresses', nls.t('workbench.activityBar.addresses')],
            ['tags', nls.t('features.tree.tags.title')],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={segment === id ? 'sidebar-segment active' : 'sidebar-segment'}
            aria-pressed={segment === id}
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
      {segment === 'citations' && (
        <CitationsList citations={citations} sources={sources} targetData={targetData} onOpenSource={onOpenSource} />
      )}
      {segment === 'notes' && <NotesList notes={notes} targetData={targetData} />}
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
      {segment === 'tags' && <TagsList tags={tags} tagLinks={tagLinks} onDeleteTag={onDeleteTag} />}
    </>
  );
}
