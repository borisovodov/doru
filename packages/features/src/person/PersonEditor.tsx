import { useEffect, useState } from 'react';
import { BookOpenText, HelpCircle, Image as ImageIcon, Mars, StickyNote, Venus } from 'lucide-react';
import type {
  FactRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  Sex,
  SourceRecord,
} from '@doru/core';
import { nls } from '../nls';
import '../sidebar/sidebar.css';
import './PersonEditor.css';
import { DateEditor } from './DateEditor';
import { EventsSection } from './EventsSection';
import { FamilySection } from './FamilySection';
import { MediaSection } from './MediaSection';
import { SourcesSection } from './SourcesSection';
import { draftInitials, draftSpan, type PersonDraft } from './draft';
import type { CitationInfo, MediaWithPath, PersonEditorApi } from './types';

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
  const [noteDraft, setNoteDraft] = useState('');
  const [families, setFamilies] = useState<FamilyRecord[]>([]);
  const [sources, setSources] = useState<SourceRecord[]>([]);
  const [citations, setCitations] = useState<CitationInfo[]>([]);
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [media, setMedia] = useState<MediaWithPath[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!draft.isNew) {
      void api.getNotes(draft.id).then((loaded) => {
        if (!cancelled) setNotes(loaded);
      });
      void refreshFamilies();
      void refreshCitations();
      void api.getFacts(draft.id).then((loaded) => {
        if (!cancelled) setFacts(loaded);
      });
      void api.getMedia(draft.id).then((loaded) => {
        if (!cancelled) setMedia(loaded);
      });
    } else {
      setNotes([]);
      setFamilies([]);
      setSources([]);
      setCitations([]);
      setFacts([]);
      setMedia([]);
    }
    setNoteDraft('');
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id, draft.isNew]);

  const refreshFamilies = async () => {
    setFamilies(await api.getFamilies());
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

  const addNote = async () => {
    const text = noteDraft.trim();
    if (!text) {
      return;
    }
    await api.addNote(draft.id, text);
    setNoteDraft('');
    setNotes(await api.getNotes(draft.id));
  };

  const name = `${draft.given} ${draft.surname}`.trim();
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
        <h3>{nls.t('features.tree.details')}</h3>
        <div className="person-form-grid">
          <label>
            {nls.t('features.tree.field.given')}
            <input value={draft.given} onChange={(event) => set({ given: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.field.surname')}
            <input value={draft.surname} onChange={(event) => set({ surname: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.field.sex')}
            <select value={draft.sex} onChange={(event) => set({ sex: event.target.value as Sex })}>
              <option value="U">{nls.t('features.tree.sex.U')}</option>
              <option value="M">{nls.t('features.tree.sex.M')}</option>
              <option value="F">{nls.t('features.tree.sex.F')}</option>
            </select>
          </label>
        </div>
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
          <EventsSection
            personId={draft.id}
            events={facts}
            refresh={refreshFacts}
            onAddFact={api.addFact}
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
          />
          <MediaSection
            personId={draft.id}
            media={media}
            refresh={refreshMedia}
            onAddMedia={api.addMedia}
            onDeleteMedia={api.deleteMedia}
          />
          <div className="person-notes">
            <h3>{nls.t('features.tree.notes.title')}</h3>
            {notes.length === 0 ? (
              <p className="notes-empty">{nls.t('features.tree.notes.empty')}</p>
            ) : (
              <ul>
                {notes.map((note) => (
                  <li key={note.id}>{note.text}</li>
                ))}
              </ul>
            )}
            <div className="notes-add">
              <input
                value={noteDraft}
                placeholder={nls.t('features.tree.notes.placeholder')}
                onChange={(event) => setNoteDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void addNote();
                  }
                }}
              />
              <button onClick={() => void addNote()}>{nls.t('features.tree.notes.add')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
