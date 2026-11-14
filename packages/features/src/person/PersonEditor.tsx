import { useEffect, useState } from 'react';
import { BookOpenText, HelpCircle, Image as ImageIcon, Mars, StickyNote, Venus } from 'lucide-react';
import { Avatar } from '@doru/ui';
import { Badge, Button, EditorPage, EntityViewCard, Field, SectionCard, Select } from '@doru/ui';
import { collectNameIds } from '@doru/core/model';
import type {
  AddressRecord,
  AssociationRecord,
  ChangeRecord,
  CitationRecord,
  ContactRecord,
  FactRecord,
  FamilyRecord,
  IdentifierRecord,
  NoteRecord,
  PersonRecord,
  PlaceRecord,
  RestrictionRecord,
  Sex,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
} from '@doru/core';
import { nls } from '../nls';
import '../sidebar/sidebar.css';
import { AssociationsSection } from '@doru/ui/domain';
import { AliasesSection } from '@doru/ui/domain';
import { ContactsSection, IdentifiersSection, RestrictionsSection } from '@doru/ui/domain';
import { ChangesSection } from '@doru/ui/domain';
import { ContributorsSection } from '@doru/ui/domain';
import { DateEditor } from '@doru/ui/domain';
import { FactsSection } from '@doru/ui/domain';
import { FamilySection } from '@doru/ui/domain';
import { MediaSection } from '@doru/ui/domain';
import { NotesSection } from '@doru/ui/domain';
import { AttachmentsPanel } from '../attachments/AttachmentsPanel';
import { CitationAttachments, NoteAttachments } from '../attachments/TargetAttachments';
import { NamesSection } from '@doru/ui/domain';
import { SourcesSection } from '@doru/ui/domain';
import { TagsSection } from '@doru/ui/domain';
import { draftInitials, draftSpan, nameDraftDisplay, primaryNameDraft, type PersonDraft } from '@doru/ui/domain';
import type { MediaTargetApi, MediaWithPath, PersonEditorApi } from './types';

export interface PersonEditorProps {
  draft: PersonDraft;
  persons: PersonRecord[];
  onChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onCancel?: (() => void) | undefined;
  api: PersonEditorApi;
  mediaApi: MediaTargetApi;
  onOpenMedia?: ((mediaId: string) => void) | undefined;
}

/**
 * The person tab: a person card (avatar, name, life span, badges) above the
 * identity form and the family/events/sources/media/notes sections.
 */
export function PersonEditor({
  draft,
  persons,
  onChange,
  onSave,
  onCancel,
  api,
  mediaApi,
  onOpenMedia,
}: PersonEditorProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [allNotes, setAllNotes] = useState<NoteRecord[]>([]);
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [associations, setAssociations] = useState<AssociationRecord[]>([]);
  const [aliases, setAliases] = useState<Array<{ id: string; aliasId: string }>>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [citations, setCitations] = useState<CitationRecord[]>([]);
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [media, setMedia] = useState<MediaWithPath[]>([]);
  const [identifiers, setIdentifiers] = useState<IdentifierRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [tagLinks, setTagLinks] = useState<Array<{ tagId: string; link: TagLinkRecord }>>([]);
  const [changes, setChanges] = useState<ChangeRecord[]>([]);
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [submitters, setSubmitters] = useState<SubmitterRecord[]>([]);
  const [contributors, setContributors] = useState<
    Array<{ id: string; submitterId: string; targetType: string; targetId: string }>
  >([]);

  const refreshFamilies = async () => {
    setFamilies(await api.getFamilies());
  };

  const refreshAssociations = async () => {
    setAssociations(await api.getAssociations(draft.id));
    setAliases(await api.getAliases(draft.id));
  };

  const refreshContributors = async () => {
    setSubmitters(await api.getSubmitters());
    setContributors(await api.getRecordSubmitters('person', draft.id));
  };

  /** Reloads every universal attachment list of the person. */
  const refreshAttachments = async () => {
    const [loadedIdentifiers, loadedContacts, loadedRestrictions, loadedTags, loadedTagLinks, loadedChanges] =
      await Promise.all([
        api.getIdentifiers('person', draft.id),
        api.getContacts('person', draft.id),
        api.getRestrictions('person', draft.id),
        api.getTags(),
        api.getTagLinks('person', draft.id),
        api.getChanges('person', draft.id),
      ]);
    setIdentifiers(loadedIdentifiers);
    setContacts(loadedContacts);
    setRestrictions(loadedRestrictions);
    setTags(loadedTags);
    setTagLinks(loadedTagLinks);
    setChanges(loadedChanges);
  };

  const refreshNotes = async () => {
    const [loadedNotes, loadedAllNotes] = await Promise.all([api.getNotes('person', draft.id), api.getAllNotes()]);
    setNotes(loadedNotes);
    setAllNotes(loadedAllNotes);
  };

  const refreshCitations = async () => {
    setCitations(await api.getCitations('person', draft.id));
    setSources(await api.getSources());
  };

  const refreshFacts = async () => {
    setFacts(await api.getFacts(draft.id));
  };

  const refreshMedia = async () => {
    setMedia(await api.getMedia(draft.id));
  };

  useEffect(() => {
    if (draft.isNew) {
      return;
    }
    let cancelled = false;
    void Promise.all([api.getNotes('person', draft.id), api.getAllNotes()]).then(([loadedNotes, loadedAllNotes]) => {
      if (!cancelled) {
        setNotes(loadedNotes);
        setAllNotes(loadedAllNotes);
      }
    });
    void api.getFamilies().then((loaded) => {
      if (!cancelled) setFamilies(loaded);
    });
    void Promise.all([api.getCitations('person', draft.id), api.getSources()]).then(
      ([loadedCitations, loadedSources]) => {
        if (!cancelled) {
          setCitations(loadedCitations);
          setSources(loadedSources);
        }
      },
    );
    void api.getAssociations(draft.id).then((loaded) => {
      if (!cancelled) setAssociations(loaded);
    });
    void api.getFacts(draft.id).then((loaded) => {
      if (!cancelled) setFacts(loaded);
    });
    void api.getMedia(draft.id).then((loaded) => {
      if (!cancelled) setMedia(loaded);
    });
    void Promise.all([
      api.getIdentifiers('person', draft.id),
      api.getContacts('person', draft.id),
      api.getRestrictions('person', draft.id),
      api.getTags(),
      api.getTagLinks('person', draft.id),
      api.getChanges('person', draft.id),
    ]).then(([loadedIdentifiers, loadedContacts, loadedRestrictions, loadedTags, loadedTagLinks, loadedChanges]) => {
      if (!cancelled) {
        setIdentifiers(loadedIdentifiers);
        setContacts(loadedContacts);
        setRestrictions(loadedRestrictions);
        setTags(loadedTags);
        setTagLinks(loadedTagLinks);
        setChanges(loadedChanges);
      }
    });
    void Promise.all([api.getSubmitters(), api.getRecordSubmitters('person', draft.id)]).then(
      ([loadedSubmitters, loadedContributors]) => {
        if (!cancelled) {
          setSubmitters(loadedSubmitters);
          setContributors(loadedContributors);
        }
      },
    );
    void api.getPlaces().then((loaded) => {
      if (!cancelled) setPlaces(loaded);
    });
    void api.getAddresses().then((loaded) => {
      if (!cancelled) setAddresses(loaded);
    });
    return () => {
      cancelled = true;
    };
    // oxlint-disable-next-line react/exhaustive-deps
  }, [draft.id, draft.isNew, persons]);

  const set = (patch: Partial<PersonDraft>) => onChange({ ...draft, ...patch });

  const name = nameDraftDisplay(primaryNameDraft(draft));
  const span = draftSpan(draft);
  const savedPerson = persons.find((person) => person.id === draft.id);
  const savedNameIds = new Set(savedPerson ? collectNameIds(savedPerson.names) : []);
  const deceased = draft.death.year !== '' || draft.death.text.trim() !== '';
  const SexIcon = draft.sex === 'M' ? Mars : draft.sex === 'F' ? Venus : HelpCircle;
  const sexTitle =
    draft.sex === 'M'
      ? nls.t('features.tree.sex.M')
      : draft.sex === 'F'
        ? nls.t('features.tree.sex.F')
        : nls.t('features.tree.sex.U');
  const badges = draft.isNew
    ? []
    : [
        { icon: StickyNote, count: notes.length, title: nls.t('features.tree.notes.title') },
        { icon: BookOpenText, count: citations.length, title: nls.t('features.tree.sources.title') },
        { icon: ImageIcon, count: media.length, title: nls.t('features.tree.media.title') },
      ];

  return (
    <EditorPage label={nls.t('features.personEditor.title')} className="person-editor">
      <EntityViewCard
        media={
          <Avatar
            initials={draftInitials(draft)}
            tone={draft.sex === 'M' ? 'male' : draft.sex === 'F' ? 'female' : 'neutral'}
            size="lg"
          />
        }
        title={
          <>
            {name !== '' ? name : '—'}
            <span className="person-view-sex" title={sexTitle}>
              <SexIcon size={13} aria-hidden="true" />
            </span>
          </>
        }
        subtitle={
          <>
            {deceased && <span className="person-view-cross">†</span>}
            {span}
          </>
        }
        badges={badges.map(({ icon: Icon, count, title }) =>
          count > 0 ? (
            <Badge key={title} icon={<Icon size={12} aria-hidden="true" />} title={`${title}: ${count}`}>
              {count}
            </Badge>
          ) : null,
        )}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={onSave}>
              {nls.t('features.tree.save')}
            </Button>
            {onCancel && (
              <Button variant="secondary" size="sm" onClick={onCancel}>
                {nls.t('features.tree.back')}
              </Button>
            )}
          </>
        }
      />

      <SectionCard title={nls.t('features.tree.names.title')}>
        <NamesSection
          names={draft.names}
          onChange={(names) => set({ names })}
          renderAttachments={(name) =>
            savedNameIds.has(name.id) ? (
              <AttachmentsPanel
                targetType="name"
                targetId={name.id}
                api={api}
                sources={sources}
                sections={[
                  'notes',
                  'sources',
                  'media',
                  'tags',
                  'identifiers',
                  'contacts',
                  'restrictions',
                  'contributors',
                  'changes',
                ]}
                renderCitationAttachments={(citation) => (
                  <CitationAttachments citation={citation} api={api} sources={sources} />
                )}
              />
            ) : null
          }
        />
      </SectionCard>

      <SectionCard title={nls.t('features.tree.details')}>
        <Field label={nls.t('features.tree.field.sex')}>
          <Select value={draft.sex} onChange={(event) => set({ sex: event.target.value as Sex })}>
            <option value="U">{nls.t('features.tree.sex.U')}</option>
            <option value="M">{nls.t('features.tree.sex.M')}</option>
            <option value="F">{nls.t('features.tree.sex.F')}</option>
          </Select>
        </Field>
        <DateEditor
          label={nls.t('features.tree.field.birthDate')}
          value={draft.birth}
          onChange={(birth) => set({ birth })}
        />
        <DateEditor
          label={nls.t('features.tree.field.deathDate')}
          value={draft.death}
          onChange={(death) => set({ death })}
        />
      </SectionCard>

      {!draft.isNew && (
        <>
          <FamilySection
            personId={draft.id}
            persons={persons}
            families={families}
            refresh={refreshFamilies}
            onAddFamily={api.addFamily}
            onUpdateFamily={api.updateFamily}
            onDeleteFamily={api.deleteFamily}
            getFacts={api.getFacts}
            onAddFact={api.addFact}
            onDeleteFact={api.deleteFact}
          />
          <AssociationsSection
            personId={draft.id}
            associations={associations}
            persons={persons}
            onAdd={async (association) => {
              await api.addAssociation(association);
              await refreshAssociations();
            }}
            onUpdate={async (before, after) => {
              await api.updateAssociation(before, after);
              await refreshAssociations();
            }}
            onDelete={async (association) => {
              await api.deleteAssociation(association);
              await refreshAssociations();
            }}
            renderAttachments={(association) => (
              <AttachmentsPanel targetType="association" targetId={association.id} api={api} sources={sources} />
            )}
          />
          <AliasesSection
            personId={draft.id}
            aliases={aliases}
            persons={persons}
            onAdd={async (personId, aliasId) => {
              await api.addAlias(personId, aliasId);
              await refreshAssociations();
            }}
            onDelete={async (id, personId, aliasId) => {
              await api.deleteAlias(id, personId, aliasId);
              await refreshAssociations();
            }}
          />
          <FactsSection
            owner={{ personId: draft.id }}
            events={facts}
            persons={persons}
            places={places}
            addresses={addresses}
            refresh={refreshFacts}
            onAddFact={api.addFact}
            onUpdateFact={api.updateFact}
            onDeleteFact={api.deleteFact}
            onAddAddress={async (address) => {
              const created = await api.addAddress(address);
              setAddresses(await api.getAddresses());
              return created;
            }}
            onUpdateAddress={async (before, after) => {
              const updated = await api.updateAddress(before, after);
              setAddresses(await api.getAddresses());
              return updated;
            }}
            renderAttachments={(fact) => (
              <AttachmentsPanel
                targetType="fact"
                targetId={fact.id}
                api={api}
                sources={sources}
                sections={[
                  'notes',
                  'sources',
                  'media',
                  'tags',
                  'identifiers',
                  'contacts',
                  'restrictions',
                  'contributors',
                  'changes',
                ]}
                renderCitationAttachments={(citation) => (
                  <CitationAttachments citation={citation} api={api} sources={sources} />
                )}
              />
            )}
          />
          <SourcesSection
            targetType="person"
            targetId={draft.id}
            sources={sources}
            citations={citations}
            refresh={refreshCitations}
            onAddSource={async (source, _targetType, targetId) => {
              await api.addSource(source, 'person', targetId);
            }}
            onAttachSource={async (sourceId, _targetType, targetId) => {
              await api.attachSource(sourceId, 'person', targetId);
            }}
            onDetachCitation={api.detachCitation}
            onUpdateCitation={api.updateCitation}
            onOpenSource={(sourceId) => api.openSource?.(sourceId)}
            renderCitationAttachments={(citation) => (
              <CitationAttachments
                citation={citation}
                api={api}
                sources={sources}
                onOpenSource={(sourceId) => api.openSource?.(sourceId)}
              />
            )}
          />
          <MediaSection
            targetType="person"
            targetId={draft.id}
            media={media}
            api={mediaApi}
            refresh={refreshMedia}
            onOpenMedia={onOpenMedia}
          />
          <NotesSection
            targetType="person"
            targetId={draft.id}
            notes={notes}
            availableNotes={allNotes}
            onAdd={async (text) => {
              await api.addNote({
                id: crypto.randomUUID(),
                text,
                targetType: 'person',
                targetId: draft.id,
                links: [{ id: crypto.randomUUID(), targetType: 'person', targetId: draft.id }],
              });
              await refreshNotes();
            }}
            onUpdate={async (before, after, context) => {
              await api.updateNote(before, after, context);
              await refreshNotes();
            }}
            onAttach={async (noteId) => {
              await api.attachNote(noteId, {
                id: crypto.randomUUID(),
                targetType: 'person',
                targetId: draft.id,
              });
              await refreshNotes();
            }}
            onDetach={async (note, link) => {
              await api.detachNote(note, link);
              await refreshNotes();
            }}
            onDelete={async (note) => {
              await api.deleteNote(note);
              await refreshNotes();
            }}
            renderAttachments={(note) => (
              <NoteAttachments
                note={note}
                api={api}
                sources={sources}
                onOpenSource={(sourceId) => api.openSource?.(sourceId)}
              />
            )}
          />
          <IdentifiersSection
            targetType="person"
            targetId={draft.id}
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
            targetType="person"
            targetId={draft.id}
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
            targetType="person"
            targetId={draft.id}
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
            targetType="person"
            targetId={draft.id}
            tags={tags}
            tagLinks={tagLinks}
            onAddTag={api.addTag}
            onUpdateTag={async (before, after) => {
              await api.updateTag(before, after);
              await refreshAttachments();
            }}
            onDeleteTag={async (tag) => {
              await api.deleteTag(tag);
              await refreshAttachments();
            }}
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
            targetType="person"
            targetId={draft.id}
            submitters={submitters}
            links={contributors}
            onAdd={async (submitterId, targetType, targetId) => {
              await api.addRecordSubmitter(submitterId, targetType, targetId);
              await refreshContributors();
            }}
            onDelete={async (id, submitterId, targetType, targetId) => {
              await api.deleteRecordSubmitter(id, submitterId, targetType, targetId);
              await refreshContributors();
            }}
          />
          <ChangesSection changes={changes} />
        </>
      )}
    </EditorPage>
  );
}
