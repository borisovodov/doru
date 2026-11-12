import { useEffect, useRef, useState } from 'react';
import type {
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
  TitleRecord,
} from '@doru/core';
import { EntityTab, SourceCitationsList, SourceEditor, type SourceEditorApi } from '@doru/features';
import { ContactsSection, ContributorsSection, IdentifiersSection, NotesSection, RestrictionsSection, SourcesSection, TagsSection, emptySourceDraft, sourceDraftMatches, sourceDraftToRecord, sourceToDraft, type SourceDraft } from '@doru/ui/domain';
import { nls } from '@doru/workbench';
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
  const [sourceNotes, setSourceNotes] = useState<NoteRecord[]>([]);
  const [sourceCitations, setSourceCitations] = useState<CitationRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [tagLinks, setTagLinks] = useState<Array<{ tagId: string; link: TagLinkRecord }>>([]);
  const [identifiers, setIdentifiers] = useState<IdentifierRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionRecord[]>([]);
  const [submitters, setSubmitters] = useState<SubmitterRecord[]>([]);
  const [contributors, setContributors] = useState<
    Array<{ id: string; submitterId: string; targetType: string; targetId: string }>
  >([]);
  const recordRef = useRef(record);

  const targetId = (lastSaved ?? record)?.id;

  const refreshAttachments = async () => {
    if (targetId === undefined) {
      return;
    }
    const [loadedNotes, loadedCitations, loadedTags, loadedTagLinks, loadedIdentifiers, loadedContacts, loadedRestrictions, loadedSubmitters, loadedContributors] =
      await Promise.all([
        api.getNotes('source', targetId),
        api.getCitations('source', targetId),
        api.getTags(),
        api.getTagLinks('source', targetId),
        api.getIdentifiers('source', targetId),
        api.getContacts('source', targetId),
        api.getRestrictions('source', targetId),
        api.getSubmitters(),
        api.getRecordSubmitters('source', targetId),
      ]);
    setSourceNotes(loadedNotes);
    setSourceCitations(loadedCitations);
    setTags(loadedTags);
    setTagLinks(loadedTagLinks);
    setIdentifiers(loadedIdentifiers);
    setContacts(loadedContacts);
    setRestrictions(loadedRestrictions);
    setSubmitters(loadedSubmitters);
    setContributors(loadedContributors);
  };

  useEffect(() => {
    void refreshAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

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
      current && previous !== undefined && sourceDraftMatches(current, previous) ? sourceToDraft(record) : current,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, record]);

  const save = async () => {
    const next = sourceDraftToRecord(draft);
    if (isNew && lastSaved === undefined) {
      await api.addSource(next);
      onCreated(next.id);
    } else {
      await api.updateSource(lastSaved ?? record!, next);
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
      {(lastSaved !== undefined || record !== undefined) && (
        <>
          <SourceCitationsList
            source={lastSaved ?? record!}
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
