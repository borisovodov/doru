import { useEffect, useRef, useState } from 'react';
import type {
  CitationRecord,
  ContactRecord,
  FamilyRecord,
  IdentifierRecord,
  NoteRecord,
  PersonRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
} from '@doru/core';
import { EntityTab, FamilyEditor, type FamilyEditorApi } from '@doru/features';
import { ContactsSection, ContributorsSection, IdentifiersSection, NotesSection, RestrictionsSection, SourcesSection, TagsSection, familyDraftMatches, familyDraftToRecord, familyToDraft, type FamilyDraft } from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { FAMILY_TAB_PREFIX } from '../hooks/useTabs';

export function FamilyTab({
  tabId,
  families,
  api,
  persons,
  sources,
  onOpenSource,
  onClose,
}: {
  tabId: string;
  families: FamilyRecord[];
  api: FamilyEditorApi;
  persons: PersonRecord[];
  sources: SourceRecord[];
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
}) {
  const familyId = tabId.slice(FAMILY_TAB_PREFIX.length);
  const record = families.find((family) => family.id === familyId);
  if (!record) {
    return <p className="person-missing">{nls.t('features.tree.familyNotFound')}</p>;
  }
  return (
    <FamilyTabBody
      tabId={tabId}
      record={record}
      api={api}
      persons={persons}
      sources={sources}
      onOpenSource={onOpenSource}
      onClose={onClose}
    />
  );
}

function FamilyTabBody({
  tabId,
  record,
  api,
  persons,
  sources,
  onOpenSource,
  onClose,
}: {
  tabId: string;
  record: FamilyRecord;
  api: FamilyEditorApi;
  persons: PersonRecord[];
  sources: SourceRecord[];
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
}) {
  const [draft, setDraft] = useState<FamilyDraft>(() => familyToDraft(record));
  const [familyNotes, setFamilyNotes] = useState<NoteRecord[]>([]);
  const [familyCitations, setFamilyCitations] = useState<CitationRecord[]>([]);
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

  const refreshAttachments = async () => {
    const [
      loadedNotes,
      loadedCitations,
      loadedTags,
      loadedTagLinks,
      loadedIdentifiers,
      loadedContacts,
      loadedRestrictions,
      loadedSubmitters,
      loadedContributors,
    ] = await Promise.all([
      api.getNotes('family', record.id),
      api.getCitations('family', record.id),
      api.getTags(),
      api.getTagLinks('family', record.id),
      api.getIdentifiers('family', record.id),
      api.getContacts('family', record.id),
      api.getRestrictions('family', record.id),
      api.getSubmitters(),
      api.getRecordSubmitters('family', record.id),
    ]);
    setFamilyNotes(loadedNotes);
    setFamilyCitations(loadedCitations);
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
  }, [record.id]);

  // Reset the draft only when it still equals the previous stored family —
  // i.e. the user has no unsaved edits. Unrelated tree reloads (a fact
  // added elsewhere) must not clobber in-progress edits.
  useEffect(() => {
    if (record === recordRef.current) {
      return;
    }
    const previous = recordRef.current;
    recordRef.current = record;
    setDraft((current) =>
      current && familyDraftMatches(current, previous) ? familyToDraft(record) : current,
    );
  }, [record]);

  const save = async () => {
    await api.updateFamily(record, familyDraftToRecord(draft));
  };

  const remove = async () => {
    await api.deleteFamily(record);
    onClose(tabId);
  };

  return (
    <EntityTab>
      <FamilyEditor
        draft={draft}
        onChange={setDraft}
        persons={persons}
        api={api}
        onSave={() => void save()}
        onDelete={() => void remove()}
      />
      <SourcesSection
        targetType="family"
        targetId={record.id}
        sources={sources}
        citations={familyCitations}
        refresh={refreshAttachments}
        onAddSource={api.addSource}
        onAttachSource={api.attachSource}
        onDetachCitation={api.detachCitation}
        onUpdateCitation={api.updateCitation}
        onOpenSource={onOpenSource}
      />
      <NotesSection
        targetType="family"
        targetId={record.id}
        notes={familyNotes}
        onAdd={async (text) => {
          await api.addNote({ id: crypto.randomUUID(), text, targetType: 'family', targetId: record.id });
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
        targetType="family"
        targetId={record.id}
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
        targetType="family"
        targetId={record.id}
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
        targetType="family"
        targetId={record.id}
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
        targetType="family"
        targetId={record.id}
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
        targetType="family"
        targetId={record.id}
        submitters={submitters}
        links={contributors}
        onAdd={api.addRecordSubmitter}
        onDelete={api.deleteRecordSubmitter}
      />
    </EntityTab>
  );
}
