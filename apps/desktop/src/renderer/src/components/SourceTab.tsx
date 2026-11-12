import { useEffect, useRef, useState } from 'react';
import type {
  CitationRecord,
  FactRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  TitleRecord,
} from '@doru/core';
import { EntityTab, SourceCitationsList, SourceEditor, type SourceEditorApi } from '@doru/features';
import {
  ContactsSection,
  ContributorsSection,
  IdentifiersSection,
  NotesSection,
  RestrictionsSection,
  SourcesSection,
  TagsSection,
  emptySourceDraft,
  sourceDraftMatches,
  sourceDraftToRecord,
  sourceToDraft,
  type SourceDraft,
} from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { useAttachments } from '../hooks/useAttachments';
import { SOURCE_TAB_PREFIX } from '../hooks/useTabs';

export function SourceTab({
  tabId,
  sources,
  api,
  persons,
  families,
  facts,
  places,
  citations,
  notes,
  onOpenPerson,
  onOpenSource,
  onClose,
  onCreated,
}: {
  tabId: string;
  sources: SourceRecord[];
  api: SourceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  places: PlaceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const sourceId = tabId.slice(SOURCE_TAB_PREFIX.length);
  const isNew = sourceId.startsWith('new:');
  const record = sources.find((source) => source.id === sourceId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.sources.notFound')}</p>;
  }
  return (
    <SourceTabBody
      tabId={tabId}
      record={record}
      isNew={isNew}
      api={api}
      persons={persons}
      families={families}
      facts={facts}
      places={places}
      sources={sources}
      citations={citations}
      notes={notes}
      onOpenPerson={onOpenPerson}
      onOpenSource={onOpenSource}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function SourceTabBody({
  tabId,
  record,
  isNew,
  api,
  persons,
  families,
  facts,
  places,
  sources,
  citations,
  notes,
  onOpenPerson,
  onOpenSource,
  onClose,
  onCreated,
}: {
  tabId: string;
  record: SourceRecord | undefined;
  isNew: boolean;
  api: SourceEditorApi;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  places: PlaceRecord[];
  sources: SourceRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onOpenPerson: (personId: string) => void;
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const [draft, setDraft] = useState<SourceDraft>(() =>
    isNew ? emptySourceDraft() : record ? sourceToDraft(record) : emptySourceDraft(),
  );
  const [lastSaved, setLastSaved] = useState<SourceRecord | undefined>(record);
  const [repositories, setRepositories] = useState<RepositoryRecord[]>([]);
  const [titles, setTitles] = useState<TitleRecord[]>([]);
  const recordRef = useRef(record);

  const currentSource = lastSaved ?? record;
  const targetId = currentSource?.id;
  const {
    notes: sourceNotes,
    citations: sourceCitations,
    tags,
    tagLinks,
    identifiers,
    contacts,
    restrictions,
    submitters,
    contributors,
    refresh: refreshAttachments,
  } = useAttachments('source', targetId, api, true);

  // Reset the draft only when it still equals the previous stored source —
  // i.e. the user has no unsaved edits. Unrelated tree reloads must not
  // clobber in-progress edits.
  useEffect(() => {
    if (isNew || record === undefined || record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    setDraft((current) =>
      previous !== undefined && sourceDraftMatches(current, previous) ? sourceToDraft(record) : current,
    );
  }, [record, isNew]);

  useEffect(() => {
    let cancelled = false;
    void api.getRepositories().then((loaded) => {
      if (!cancelled) setRepositories(loaded);
    });
    void api.getTitles().then((loaded) => {
      if (!cancelled) setTitles(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [api, record]);

  const save = async () => {
    const next = sourceDraftToRecord(draft);
    if (isNew && lastSaved === undefined) {
      await api.addSource(next);
      onCreated(next.id);
    } else {
      const target = lastSaved ?? record;
      if (target === undefined) {
        return;
      }
      await api.updateSource(target, next);
    }
    setLastSaved(next);
  };

  const remove = async () => {
    const target = lastSaved ?? record;
    if (target) {
      await api.deleteSource(target);
    }
    onClose(tabId);
  };

  return (
    <EntityTab>
      <SourceEditor
        draft={draft}
        onChange={setDraft}
        repositories={repositories}
        titles={titles}
        places={places}
        onAddRepository={async (repository) => {
          await api.addRepository(repository);
          setRepositories(await api.getRepositories());
        }}
        onSave={() => void save()}
        onDelete={!isNew || lastSaved !== undefined ? () => void remove() : undefined}
      />
      {currentSource !== undefined && (
        <>
          <SourceCitationsList
            source={currentSource}
            persons={persons}
            families={families}
            facts={facts}
            citations={citations}
            notes={notes}
            onOpenPerson={onOpenPerson}
          />
          {targetId !== undefined && (
            <>
              <SourcesSection
                targetType="source"
                targetId={targetId}
                sources={sources}
                citations={sourceCitations}
                refresh={refreshAttachments}
                onAddSource={api.addSource}
                onAttachSource={api.attachSource}
                onDetachCitation={api.detachCitation}
                onUpdateCitation={api.updateCitation}
                onOpenSource={onOpenSource}
              />
              <NotesSection
                targetType="source"
                targetId={targetId}
                notes={sourceNotes}
                onAdd={async (text) => {
                  await api.addNote({ id: crypto.randomUUID(), text, targetType: 'source', targetId });
                  await refreshAttachments();
                }}
                onUpdate={async (before, after, context) => {
                  await api.updateNote(before, after, context);
                  await refreshAttachments();
                }}
                onDelete={async (note) => {
                  await api.deleteNote(note);
                  await refreshAttachments();
                }}
              />
              <IdentifiersSection
                targetType="source"
                targetId={targetId}
                identifiers={identifiers}
                onAdd={async (identifier) => {
                  await api.addIdentifier(identifier);
                  await refreshAttachments();
                }}
                onUpdate={async (before, after) => {
                  await api.updateIdentifier(before, after);
                  await refreshAttachments();
                }}
                onDelete={async (identifier) => {
                  await api.deleteIdentifier(identifier);
                  await refreshAttachments();
                }}
              />
              <ContactsSection
                targetType="source"
                targetId={targetId}
                contacts={contacts}
                onAdd={async (contact) => {
                  await api.addContact(contact);
                  await refreshAttachments();
                }}
                onUpdate={async (before, after) => {
                  await api.updateContact(before, after);
                  await refreshAttachments();
                }}
                onDelete={async (contact) => {
                  await api.deleteContact(contact);
                  await refreshAttachments();
                }}
              />
              <RestrictionsSection
                targetType="source"
                targetId={targetId}
                restrictions={restrictions}
                onAdd={async (restriction) => {
                  await api.addRestriction(restriction);
                  await refreshAttachments();
                }}
                onUpdate={async (before, after) => {
                  await api.updateRestriction(before, after);
                  await refreshAttachments();
                }}
                onDelete={async (restriction) => {
                  await api.deleteRestriction(restriction);
                  await refreshAttachments();
                }}
              />
              <TagsSection
                targetType="source"
                targetId={targetId}
                tags={tags}
                tagLinks={tagLinks}
                onAddTag={api.addTag}
                onUpdateTag={api.updateTag}
                onDeleteTag={api.deleteTag}
                onAttachTag={async (link) => {
                  await api.attachTag(link);
                  await refreshAttachments();
                }}
                onDetachTag={async (link) => {
                  await api.detachTag(link);
                  await refreshAttachments();
                }}
                onUpdateTagLink={async (before, after) => {
                  await api.updateTagLink(before, after);
                  await refreshAttachments();
                }}
              />
              <ContributorsSection
                targetType="source"
                targetId={targetId}
                submitters={submitters}
                links={contributors}
                onAdd={api.addRecordSubmitter}
                onDelete={api.deleteRecordSubmitter}
              />
            </>
          )}
        </>
      )}
    </EntityTab>
  );
}
