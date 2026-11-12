import { useEffect, useState } from 'react';
import { BookOpenText, HelpCircle, Image as ImageIcon, Mars, StickyNote, Venus } from 'lucide-react';
import {
  Avatar,
  Badge,
  Button,
  EditorPage,
  EntityViewCard,
  SectionCard,
} from '@doru/ui';
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
import './PersonEditor.css';
import { AssociationsSection } from './AssociationsSection';
import { AliasesSection } from '@doru/ui';
import { ContactsSection, IdentifiersSection, RestrictionsSection } from './AttachmentsSection';
import { ChangesSection } from '@doru/ui';
import { ContributorsSection } from '@doru/ui';
import { DateEditor } from '@doru/ui';
import { FactsSection } from './FactsSection';
import { FamilySection } from './FamilySection';
import { MediaSection } from '@doru/ui';
import { NotesSection } from './NotesSection';
import { NamesSection } from '@doru/ui';
import { SourcesSection } from './SourcesSection';
import { TagsSection } from './TagsSection';
import { draftInitials, draftSpan, nameDraftDisplay, primaryNameDraft, type PersonDraft } from '@doru/ui';
import type { MediaWithPath, PersonEditorApi } from './types';

export interface PersonEditorProps {
  draft: PersonDraft;
  persons: PersonRecord[];
  onChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onCancel?: (() => void) | undefined;
  api: PersonEditorApi;
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
}: PersonEditorProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    if (!draft.isNew) {
      void api.getNotes(draft.id).then((loaded) => {
        if (!cancelled) setNotes(loaded);
      });
      void refreshFamilies();
      void refreshCitations();
      void api.getAssociations(draft.id).then((loaded) => {
        if (!cancelled) setAssociations(loaded);
      });
      void api.getFacts(draft.id).then((loaded) => {
        if (!cancelled) setFacts(loaded);
      });
      void api.getMedia(draft.id).then((loaded) => {
        if (!cancelled) setMedia(loaded);
      });
      void refreshAttachments();
      void refreshContributors();
      void api.getPlaces().then((loaded) => {
        if (!cancelled) setPlaces(loaded);
      });
      void api.getAddresses().then((loaded) => {
        if (!cancelled) setAddresses(loaded);
      });
    } else {
      setNotes([]);
      setFamilies([]);
      setAssociations([]);
      setSources([]);
      setCitations([]);
      setFacts([]);
      setMedia([]);
      setIdentifiers([]);
      setContacts([]);
      setRestrictions([]);
      setTags([]);
      setTagLinks([]);
      setChanges([]);
      setPlaces([]);
      setSubmitters([]);
      setContributors([]);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id, draft.isNew, persons]);

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
        api.getIdentifiers(draft.id),
        api.getContacts(draft.id),
        api.getRestrictions(draft.id),
        api.getTags(),
        api.getTagLinks(draft.id),
        api.getChanges(draft.id),
      ]);
    setIdentifiers(loadedIdentifiers);
    setContacts(loadedContacts);
    setRestrictions(loadedRestrictions);
    setTags(loadedTags);
    setTagLinks(loadedTagLinks);
    setChanges(loadedChanges);
  };

  const refreshCitations = async () => {
    setCitations(await api.getCitations(draft.id));
    setSources(await api.getSources());
  };

  const refreshFacts = async () => {
    setFacts(await api.getFacts(draft.id));
  };

  const refreshMedia = async () => {
    setMedia(await api.getMedia(draft.id));
  };

  const set = (patch: Partial<PersonDraft>) => onChange({ ...draft, ...patch });

  const name = nameDraftDisplay(primaryNameDraft(draft));
  const span = draftSpan(draft);
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
        <NamesSection names={draft.names} onChange={(names) => set({ names })} />
      </SectionCard>

      <SectionCard title={nls.t('features.tree.details')}>
        <label>
          {nls.t('features.tree.field.sex')}
          <select value={draft.sex} onChange={(event) => set({ sex: event.target.value as Sex })}>
            <option value="U">{nls.t('features.tree.sex.U')}</option>
            <option value="M">{nls.t('features.tree.sex.M')}</option>
            <option value="F">{nls.t('features.tree.sex.F')}</option>
          </select>
        </label>
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
          />
          <SourcesSection
            targetType="person"
            targetId={draft.id}
            sources={sources}
            citations={citations}
            refresh={refreshCitations}
            onAddSource={async (source, _targetType, targetId) => {
              await api.addSource(source, targetId);
            }}
            onAttachSource={async (sourceId, _targetType, targetId) => {
              await api.attachSource(sourceId, targetId);
            }}
            onDetachCitation={api.detachCitation}
            onUpdateCitation={api.updateCitation}
            onOpenSource={(sourceId) => api.openSource?.(sourceId)}
          />
          <MediaSection
            personId={draft.id}
            media={media}
            refresh={refreshMedia}
            onAddMedia={api.addMedia}
            onDeleteMedia={api.deleteMedia}
          />
          <NotesSection
            targetType="person"
            targetId={draft.id}
            notes={notes}
            onAdd={async (text) => {
              await api.addNote(draft.id, text);
              setNotes(await api.getNotes(draft.id));
            }}
            onUpdate={async (before, after, context) => {
              await api.updateNote(before, after, context);
              setNotes(await api.getNotes(draft.id));
            }}
            onDelete={async (note) => {
              await api.deleteNote(note);
              setNotes(await api.getNotes(draft.id));
            }}
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
