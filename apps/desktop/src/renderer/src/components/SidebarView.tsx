import { IconButton, SegmentedControl, SideBarEmpty, SideBarLayout } from '@doru/ui';
import { isVisibleMedia } from '@doru/core/model';
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
  TaskRecord,
} from '@doru/core';
import { PersonList, TasksView, type TaskTargetData } from '@doru/ui/domain';
import {
  AddressList,
  CitationsList,
  NotesList,
  RepositoryList,
  SidebarFamilies,
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
import { ENTITY_TAB_PREFIX, type EntityTabKind } from '../tabs/types';

/** Render cap for the People list on very large trees. */
const PEOPLE_LIST_LIMIT = 500;

export function SidebarView({
  activeView,
  canCreate,
  searchFocusNonce,
  activeTabId,
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
  tasks,
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
  /** Whether the app has a project open (a saved tree or an imported GEDCOM). */
  canCreate: boolean;
  /** Bumped whenever the Search view is selected; the query field takes focus. */
  searchFocusNonce: number;
  /** The active editor tab, used to highlight the matching list row. */
  activeTabId: string | null;
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
  tasks: TaskRecord[];
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
  onDeleteTag: (tag: TagRecord) => void;
  onNewTitle: () => void;
  onNewPerson: () => void;
  onNewPlace: () => void;
  onNewMedia: () => void;
  onNewSource: () => void;
  onNewRepository: () => void;
  onNewSubmitter: () => void;
  onNewAddress: () => void;
  onOpenTask: (taskId: string) => void;
  onNewTask: () => void;
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
    tasks,
  };
  const selectedId = (kind: EntityTabKind): string | undefined => {
    if (activeTabId === null) {
      return undefined;
    }
    const prefix = ENTITY_TAB_PREFIX[kind];
    return activeTabId.startsWith(prefix) ? activeTabId.slice(prefix.length) : undefined;
  };

  switch (activeView) {
    case 'people':
      return (
        <SideBarLayout
          title={nls.t('workbench.activityBar.people')}
          actions={<AddButton label={nls.t('features.tree.person.add')} onClick={onNewPerson} disabled={!canCreate} />}
        >
          {persons.length === 0 ? (
            <SideBarEmpty>{nls.t('features.people.placeholder')}</SideBarEmpty>
          ) : (
            <>
              <PersonList
                persons={persons.slice(0, PEOPLE_LIST_LIMIT)}
                onOpen={onOpenPerson}
                selectedId={selectedId('person')}
              />
              {persons.length > PEOPLE_LIST_LIMIT && (
                <p className="side-bar-note">{nls.t('tree.people.listLimit', PEOPLE_LIST_LIMIT, persons.length)}</p>
              )}
            </>
          )}
        </SideBarLayout>
      );
    case 'families':
      return (
        <SideBarLayout title={nls.t('workbench.activityBar.families')}>
          {families.length === 0 ? (
            <SideBarEmpty>{nls.t('features.families.placeholder')}</SideBarEmpty>
          ) : (
            <SidebarFamilies
              families={families}
              persons={persons}
              facts={facts}
              onOpenFamily={onOpenFamily}
              selectedId={selectedId('family')}
            />
          )}
        </SideBarLayout>
      );
    case 'places':
      return (
        <SideBarLayout
          title={nls.t('workbench.activityBar.places')}
          actions={<AddButton label={nls.t('features.tree.place.add')} onClick={onNewPlace} disabled={!canCreate} />}
        >
          {places.length === 0 ? (
            <SideBarEmpty>{nls.t('features.places.placeholder')}</SideBarEmpty>
          ) : (
            <SidebarPlaces places={places} onOpenPlace={onOpenPlace} selectedId={selectedId('place')} />
          )}
        </SideBarLayout>
      );
    case 'media': {
      const visibleMedia = media.filter(isVisibleMedia);
      return (
        <SideBarLayout
          title={nls.t('workbench.activityBar.media')}
          actions={<AddButton label={nls.t('features.tree.media.add')} onClick={onNewMedia} disabled={!canCreate} />}
        >
          {visibleMedia.length === 0 ? (
            <SideBarEmpty>{nls.t('features.media.placeholder')}</SideBarEmpty>
          ) : (
            <SidebarMedia
              media={visibleMedia}
              persons={persons}
              onOpenMedia={onOpenMedia}
              selectedId={selectedId('media')}
            />
          )}
        </SideBarLayout>
      );
    }
    case 'sources':
      return (
        <SourcesSidebar
          canCreate={canCreate}
          selectedId={selectedId}
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
        <SideBarLayout
          title={nls.t('features.tasks.title')}
          actions={<AddButton label={nls.t('features.tasks.add')} onClick={onNewTask} disabled={!canCreate} />}
        >
          <TasksView
            tasks={tasks}
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
            onOpenPerson={onOpenPerson}
            onOpenFamily={onOpenFamily}
            onOpenSource={onOpenSource}
            onOpenPlace={onOpenPlace}
            onOpenRepository={onOpenRepository}
            onOpenSubmitter={onOpenSubmitter}
            onOpenAddress={onOpenAddress}
            onOpenMedia={onOpenMedia}
            onOpenTitle={onOpenTitle}
            selectedId={selectedId('task')}
          />
        </SideBarLayout>
      );
    case 'search':
      return (
        <SidebarSearch
          persons={persons}
          families={families}
          sources={sources}
          facts={facts}
          focusNonce={searchFocusNonce}
          selected={{
            person: selectedId('person'),
            family: selectedId('family'),
            source: selectedId('source'),
          }}
          onOpenPerson={onOpenPerson}
          onOpenFamily={onOpenFamily}
          onOpenSource={onOpenSource}
        />
      );
    default:
      return null;
  }
}

/** The shared add action in side bar title rows. */
function AddButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <IconButton
      size="sm"
      label={label}
      icon={<Plus size={14} aria-hidden="true" />}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

/** The Sources sidebar: a segmented picker over sources, repositories, submitters, addresses and titles. */
function SourcesSidebar({
  canCreate,
  selectedId,
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
  canCreate: boolean;
  selectedId: (kind: EntityTabKind) => string | undefined;
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

  const panels = {
    sources: {
      addLabel: nls.t('features.tree.source.add'),
      onAdd: onNewSource,
      focusable: sources.length > 0,
      content:
        sources.length === 0 ? (
          <SideBarEmpty>{nls.t('features.sources.placeholder')}</SideBarEmpty>
        ) : (
          <SidebarSources
            sources={sources}
            citations={citations}
            onOpenSource={onOpenSource}
            selectedId={selectedId('source')}
          />
        ),
    },
    citations: {
      focusable: citations.length > 0,
      content: (
        <CitationsList citations={citations} sources={sources} targetData={targetData} onOpenSource={onOpenSource} />
      ),
    },
    notes: {
      focusable: notes.length > 0,
      content: <NotesList notes={notes} targetData={targetData} />,
    },
    repositories: {
      addLabel: nls.t('features.tree.repository.add'),
      onAdd: onNewRepository,
      focusable: repositories.length > 0,
      content: (
        <RepositoryList
          repositories={repositories}
          onOpenRepository={onOpenRepository}
          selectedId={selectedId('repository')}
        />
      ),
    },
    submitters: {
      addLabel: nls.t('features.tree.submitter.add'),
      onAdd: onNewSubmitter,
      focusable: submitters.length > 0,
      content: (
        <SubmitterList submitters={submitters} onOpenSubmitter={onOpenSubmitter} selectedId={selectedId('submitter')} />
      ),
    },
    addresses: {
      addLabel: nls.t('features.tree.address.newAddress'),
      onAdd: onNewAddress,
      focusable: addresses.length > 0,
      content: <AddressList addresses={addresses} onOpenAddress={onOpenAddress} selectedId={selectedId('address')} />,
    },
    titles: {
      addLabel: nls.t('features.tree.title.add'),
      onAdd: onNewTitle,
      focusable: titles.length > 0,
      content: <TitleList titles={titles} onOpenTitle={onOpenTitle} selectedId={selectedId('title')} />,
    },
    tags: {
      focusable: tags.length > 0,
      content: <TagsList tags={tags} tagLinks={tagLinks} onDeleteTag={onDeleteTag} />,
    },
  } as const;
  const current = panels[segment];
  const segments = [
    { value: 'sources', label: nls.t('workbench.activityBar.sources') },
    { value: 'citations', label: nls.t('features.tree.citations.title') },
    { value: 'notes', label: nls.t('features.tree.notes.title') },
    { value: 'titles', label: nls.t('workbench.activityBar.titles') },
    { value: 'repositories', label: nls.t('workbench.activityBar.repositories') },
    { value: 'submitters', label: nls.t('workbench.activityBar.submitters') },
    { value: 'addresses', label: nls.t('workbench.activityBar.addresses') },
    { value: 'tags', label: nls.t('features.tree.tags.title') },
  ] as const;
  const tabPrefix = 'sources-tab';
  const panelId = 'sources-panel';

  return (
    <SideBarLayout
      title={nls.t('workbench.activityBar.sources')}
      actions={
        'addLabel' in current ? (
          <AddButton label={current.addLabel} onClick={current.onAdd} disabled={!canCreate} />
        ) : undefined
      }
      subheader={
        <SegmentedControl
          label={nls.t('workbench.activityBar.sources')}
          mode="tabs"
          idPrefix={tabPrefix}
          panelId={panelId}
          columns={2}
          value={segment}
          onChange={setSegment}
          options={segments}
        />
      }
    >
      {/* An empty panel has no focusable content, so make the panel itself reachable by Tab. */}
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={`${tabPrefix}-${segment}`}
        tabIndex={current.focusable ? undefined : 0}
      >
        {current.content}
      </div>
    </SideBarLayout>
  );
}
