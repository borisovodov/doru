import { useEffect, useState } from 'react';
import type {
  EventRecord,
  FamilyRecord,
  NoteRecord,
  PersonRecord,
  Sex,
  SourceRecord,
} from '@doru/core';
import { nls } from '../nls';
import './PersonEditor.css';
import { DateEditor } from './DateEditor';
import { EventsSection } from './EventsSection';
import { FamilySection } from './FamilySection';
import { MediaSection } from './MediaSection';
import { SourcesSection } from './SourcesSection';
import type { PersonDraft } from './draft';
import type { CitationInfo, MediaWithPath, PersonEditorApi } from './types';

export interface PersonEditorProps {
  draft: PersonDraft;
  persons: PersonRecord[];
  onChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onCancel?: () => void;
  api: PersonEditorApi;
}

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
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [media, setMedia] = useState<MediaWithPath[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!draft.isNew) {
      void api.getNotes(draft.id).then((loaded) => {
        if (!cancelled) setNotes(loaded);
      });
      void refreshFamilies();
      void refreshCitations();
      void api.getEvents(draft.id).then((loaded) => {
        if (!cancelled) setEvents(loaded);
      });
      void api.getMedia(draft.id).then((loaded) => {
        if (!cancelled) setMedia(loaded);
      });
    } else {
      setNotes([]);
      setFamilies([]);
      setSources([]);
      setCitations([]);
      setEvents([]);
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

  const refreshEvents = async () => {
    setEvents(await api.getEvents(draft.id));
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

  return (
    <div className="person-editor">
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
      <div className="person-editor-actions">
        <button onClick={onSave}>{nls.t('features.tree.save')}</button>
        {onCancel && <button onClick={onCancel}>{nls.t('features.tree.back')}</button>}
      </div>
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
            getEvents={api.getEvents}
            onAddEvent={api.addEvent}
            onDeleteEvent={api.deleteEvent}
          />
          <EventsSection
            events={events}
            refresh={refreshEvents}
            onAddEvent={api.addEvent}
            onDeleteEvent={api.deleteEvent}
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
