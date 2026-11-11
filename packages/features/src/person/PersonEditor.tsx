import { useEffect, useState } from 'react';
import { BookOpenText, HelpCircle, Image as ImageIcon, Mars, StickyNote, Venus } from 'lucide-react';
import type {
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
  TagLinkRecord,
  TagRecord,
} from '@doru/core';
import { nls } from '../nls';
import '../sidebar/sidebar.css';
import './PersonEditor.css';
import { AssociationsSection } from './AssociationsSection';
import { AliasesSection } from './AliasesSection';
import { ContactsSection, IdentifiersSection, RestrictionsSection } from './AttachmentsSection';
import { ChangesSection } from './ChangesSection';
import { DateEditor } from './DateEditor';
import { FactsSection } from './FactsSection';
import { FamilySection } from './FamilySection';
import { MediaSection } from './MediaSection';
import { NotesSection } from './NotesSection';
import { NamesSection } from './NamesSection';
import { SourcesSection } from './SourcesSection';
import { TagsSection } from './TagsSection';
import { draftInitials, draftSpan, nameDraftDisplay, primaryNameDraft, type PersonDraft } from './draft';
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
      void api.getPlaces().then((loaded) => {
        if (!cancelled) setPlaces(loaded);
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
    <div className="person-editor">
      <section className="person-view-card">
        <span className={`doru-avatar person-view-avatar sex-${draft.sex.toLowerCase()}`} aria-hidden="true">
          {draftInitials(draft)}
        </span>
        <div className="person-view-body">
          <h2 className="person-view-name">
            {name !== '' ? name : '—'}
            <span className="person-view-sex" title={sexTitle}>
              <SexIcon size={13} aria-hidden="true" />
            </span>
          </h2>
          <p className="person-view-dates">
            {deceased && <span className="person-view-cross">†</span>}
            {span}
          </p>
        </div>
        <div className="person-view-badges">
          {badges.map(({ icon: Icon, count, title }) =>
            count > 0 ? (
              <span key={title} className="person-view-badge" title={`${title}: ${count}`}>
                <Icon size={12} aria-hidden="true" />
                <span>{count}</span>
              </span>
            ) : null,
          )}
        </div>
        <div className="person-view-actions">
          <button className="primary" onClick={onSave}>
            {nls.t('features.tree.save')}
          </button>
          {onCancel && (
            <button onClick={onCancel}>{nls.t('features.tree.back')}</button>
          )}
        </div>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.names.title')}</h3>
        <NamesSection names={draft.names} onChange={(names) => set({ names })} />
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.details')}</h3>
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
      </section>

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
            refresh={refreshFacts}
            onAddFact={api.addFact}
            onUpdateFact={api.updateFact}
            onDeleteFact={api.deleteFact}
          />
          <SourcesSection
            personId={draft.id}
            sources={sources}
            citations={citations}
            refresh={refreshCitations}
            onAddSource={api.addSource}
            onAttachSource={api.attachSource}
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
            personId={draft.id}
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
            personId={draft.id}
            identifiers={identifiers}
            onAdd={async (identifier) => {
              await api.addIdentifier(identifier);
              await refreshAttachments();
            }}
            onDelete={async (identifier) => {
              await api.deleteIdentifier(identifier);
              await refreshAttachments();
            }}
          />
          <ContactsSection
            personId={draft.id}
            contacts={contacts}
            onAdd={async (contact) => {
              await api.addContact(contact);
              await refreshAttachments();
            }}
            onDelete={async (contact) => {
              await api.deleteContact(contact);
              await refreshAttachments();
            }}
          />
          <RestrictionsSection
            personId={draft.id}
            restrictions={restrictions}
            onAdd={async (restriction) => {
              await api.addRestriction(restriction);
              await refreshAttachments();
            }}
            onDelete={async (restriction) => {
              await api.deleteRestriction(restriction);
              await refreshAttachments();
            }}
          />
          <TagsSection
            personId={draft.id}
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
          />
          <ChangesSection changes={changes} />
        </>
      )}
    </div>
  );
}
