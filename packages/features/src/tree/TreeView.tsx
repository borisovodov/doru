import { useEffect, useState } from 'react';
import type {
  DateQuality,
  DateValue,
  EventRecord,
  FamilyRecord,
  GedcomImportResult,
  MediaRecord,
  NoteRecord,
  PersonRecord,
  ProjectSummary,
  Sex,
  SourceRecord,
  TreeStats,
} from '@doru/core';
import { nls } from '../nls';

export type NameFormat = 'given-first' | 'surname-first';

export interface MediaWithPath extends MediaRecord {
  absolutePath: string;
}

interface DateDraft {
  year: string;
  month: string;
  day: string;
  text: string;
  quality: DateQuality;
  place: string;
}

interface PersonDraft {
  id: string;
  given: string;
  surname: string;
  sex: Sex;
  birth: DateDraft;
  death: DateDraft;
  isNew: boolean;
}

export interface CitationInfo {
  id: string;
  source: SourceRecord;
}

export interface TreeViewProps {
  summary?: ProjectSummary | null;
  persons: PersonRecord[];
  stats?: TreeStats | null;
  importResult?: GedcomImportResult | null;
  exportResult?: { path: string } | null;
  search: string;
  canUndo: boolean;
  canRedo: boolean;
  nameFormat: NameFormat;
  onOpenProject: () => void;
  onImportGedcom: () => void;
  onExportGedcom: () => void;
  onSearch: (query: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddPerson: (person: PersonRecord) => Promise<void>;
  onUpdatePerson: (before: PersonRecord, after: PersonRecord) => Promise<void>;
  getNotes: (personId: string) => Promise<NoteRecord[]>;
  onAddNote: (personId: string, text: string) => Promise<void>;
  getGedcomText: () => Promise<string>;
  getFamilies: () => Promise<FamilyRecord[]>;
  onAddFamily: (family: FamilyRecord) => Promise<void>;
  onUpdateFamily: (before: FamilyRecord, after: FamilyRecord) => Promise<void>;
  onDeleteFamily: (family: FamilyRecord) => Promise<void>;
  getSources: () => Promise<SourceRecord[]>;
  getCitations: (personId: string) => Promise<CitationInfo[]>;
  onAddSource: (source: SourceRecord, targetId: string) => Promise<void>;
  onAttachSource: (sourceId: string, targetId: string) => Promise<void>;
  onDetachCitation: (citationId: string) => Promise<void>;
  getEvents: (personId?: string, familyId?: string) => Promise<EventRecord[]>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
  getMedia: (personId: string) => Promise<MediaWithPath[]>;
  onAddMedia: (personId: string) => Promise<void>;
  onDeleteMedia: (media: MediaRecord) => Promise<void>;
}

export function TreeView({
  summary,
  persons,
  stats,
  importResult,
  exportResult,
  search,
  canUndo,
  canRedo,
  nameFormat,
  onOpenProject,
  onImportGedcom,
  onExportGedcom,
  onSearch,
  onUndo,
  onRedo,
  onAddPerson,
  onUpdatePerson,
  getNotes,
  onAddNote,
  getGedcomText,
  getFamilies,
  onAddFamily,
  onUpdateFamily,
  onDeleteFamily,
  getSources,
  getCitations,
  onAddSource,
  onAttachSource,
  onDetachCitation,
  getEvents,
  onAddEvent,
  onDeleteEvent,
  getMedia,
  onAddMedia,
  onDeleteMedia,
}: TreeViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PersonDraft | null>(null);
  const [viewMode, setViewMode] = useState<'tree' | 'gedcom'>('tree');
  const [gedcomText, setGedcomText] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const person = persons.find((entry) => entry.id === selectedId);
    if (!person) {
      return;
    }
    setDraft((current) => {
      if (current && !current.isNew && draftEquals(current, person)) {
        return current;
      }
      return toDraft(person);
    });
  }, [selectedId, persons]);

  if (!summary) {
    return (
      <div className="tree-view">
        <h2>{nls.t('features.tree.title')}</h2>
        <p>{nls.t('workbench.tree.empty')}</p>
        <button onClick={onOpenProject}>{nls.t('workbench.openProject')}</button>
      </div>
    );
  }

  const startAdd = () => {
    setSelectedId(null);
    setDraft({
      id: crypto.randomUUID(),
      given: '',
      surname: '',
      sex: 'U',
      birth: emptyDate(),
      death: emptyDate(),
      isNew: true,
    });
  };

  const closeEditor = () => {
    setDraft(null);
    setSelectedId(null);
  };

  const save = async () => {
    if (!draft) {
      return;
    }
    const record = toRecord(draft);
    if (draft.isNew) {
      await onAddPerson(record);
      closeEditor();
      return;
    }
    const before = persons.find((entry) => entry.id === draft.id);
    if (before) {
      await onUpdatePerson(before, record);
    }
  };

  const toggleGedcom = async () => {
    if (viewMode === 'tree') {
      setViewMode('gedcom');
      setGedcomText(null);
      setGedcomText(await getGedcomText());
      setDraft(null);
      setSelectedId(null);
    } else {
      setViewMode('tree');
      setGedcomText(null);
    }
  };

  return (
    <div className="tree-view">
      <div className="tree-toolbar">
        <input
          value={search}
          placeholder={nls.t('features.tree.search.placeholder')}
          onChange={(event) => onSearch(event.target.value)}
        />
        <button disabled={!canUndo} onClick={onUndo} title="Cmd+Z / Ctrl+Z">
          {nls.t('workbench.undo')}
        </button>
        <button disabled={!canRedo} onClick={onRedo} title="Shift+Cmd+Z / Ctrl+Shift+Z">
          {nls.t('workbench.redo')}
        </button>
        <button onClick={onImportGedcom}>{nls.t('features.tree.importGedcom')}</button>
        <button onClick={onExportGedcom}>{nls.t('features.tree.exportGedcom')}</button>
        <button onClick={startAdd}>{nls.t('features.tree.addPerson')}</button>
        <button onClick={() => void toggleGedcom()}>
          {viewMode === 'tree' ? nls.t('features.tree.viewGedcom') : nls.t('features.tree.viewPeople')}
        </button>
      </div>
      {viewMode === 'gedcom' ? (
        <pre className="gedcom-view">{gedcomText ?? ''}</pre>
      ) : (
        <>
          {stats && (
            <p className="tree-stats">{nls.t('features.tree.totalPersons', stats.persons)}</p>
          )}
          {importResult && (
            <p className="tree-stats">
              {nls.t(
                'features.tree.importResult',
                importResult.importedPersons,
                importResult.importedFamilies,
              )}
            </p>
          )}
          {exportResult && (
            <p className="tree-stats">{nls.t('features.tree.exported', exportResult.path)}</p>
          )}
          {draft ? (
            <PersonEditor
              draft={draft}
              persons={persons}
              nameFormat={nameFormat}
              onChange={setDraft}
              onSave={() => void save()}
              onCancel={closeEditor}
              getNotes={getNotes}
              onAddNote={onAddNote}
              getFamilies={getFamilies}
              onAddFamily={onAddFamily}
              onUpdateFamily={onUpdateFamily}
              onDeleteFamily={onDeleteFamily}
              getSources={getSources}
              getCitations={getCitations}
              onAddSource={onAddSource}
              onAttachSource={onAttachSource}
              onDetachCitation={onDetachCitation}
              getEvents={getEvents}
              onAddEvent={onAddEvent}
              onDeleteEvent={onDeleteEvent}
              getMedia={getMedia}
              onAddMedia={onAddMedia}
              onDeleteMedia={onDeleteMedia}
            />
          ) : persons.length === 0 ? (
            <p>{nls.t('features.tree.emptyTree')}</p>
          ) : (
            <ul className="person-list">
              {persons.map((person) => (
                <li key={person.id} onClick={() => setSelectedId(person.id)}>
                  <span className="person-name">{displayName(person, nameFormat)}</span>
                  <span className="person-dates">{years(person)}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

interface PersonEditorProps {
  draft: PersonDraft;
  persons: PersonRecord[];
  nameFormat: NameFormat;
  onChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  getNotes: (personId: string) => Promise<NoteRecord[]>;
  onAddNote: (personId: string, text: string) => Promise<void>;
  getFamilies: () => Promise<FamilyRecord[]>;
  onAddFamily: (family: FamilyRecord) => Promise<void>;
  onUpdateFamily: (before: FamilyRecord, after: FamilyRecord) => Promise<void>;
  onDeleteFamily: (family: FamilyRecord) => Promise<void>;
  getSources: () => Promise<SourceRecord[]>;
  getCitations: (personId: string) => Promise<CitationInfo[]>;
  onAddSource: (source: SourceRecord, targetId: string) => Promise<void>;
  onAttachSource: (sourceId: string, targetId: string) => Promise<void>;
  onDetachCitation: (citationId: string) => Promise<void>;
  getEvents: (personId?: string, familyId?: string) => Promise<EventRecord[]>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
  getMedia: (personId: string) => Promise<MediaWithPath[]>;
  onAddMedia: (personId: string) => Promise<void>;
  onDeleteMedia: (media: MediaRecord) => Promise<void>;
}

function PersonEditor({
  draft,
  persons,
  nameFormat,
  onChange,
  onSave,
  onCancel,
  getNotes,
  onAddNote,
  getFamilies,
  onAddFamily,
  onUpdateFamily,
  onDeleteFamily,
  getSources,
  getCitations,
  onAddSource,
  onAttachSource,
  onDetachCitation,
  getEvents,
  onAddEvent,
  onDeleteEvent,
  getMedia,
  onAddMedia,
  onDeleteMedia,
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
      void getNotes(draft.id).then((loaded) => {
        if (!cancelled) setNotes(loaded);
      });
      void refreshFamilies();
      void refreshCitations();
      void getEvents(draft.id).then((loaded) => {
        if (!cancelled) setEvents(loaded);
      });
      void getMedia(draft.id).then((loaded) => {
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
    setFamilies(await getFamilies());
  };

  const refreshCitations = async () => {
    setCitations(await getCitations(draft.id));
    setSources(await getSources());
  };

  const refreshEvents = async () => {
    setEvents(await getEvents(draft.id));
  };

  const refreshMedia = async () => {
    setMedia(await getMedia(draft.id));
  };

  const set = (patch: Partial<PersonDraft>) => onChange({ ...draft, ...patch });

  const addNote = async () => {
    const text = noteDraft.trim();
    if (!text) {
      return;
    }
    await onAddNote(draft.id, text);
    setNoteDraft('');
    setNotes(await getNotes(draft.id));
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
        <button onClick={onCancel}>{nls.t('features.tree.back')}</button>
      </div>
      {!draft.isNew && (
        <>
          <FamilySection
            personId={draft.id}
            persons={persons}
            nameFormat={nameFormat}
            families={families}
            refresh={refreshFamilies}
            onAddFamily={onAddFamily}
            onUpdateFamily={onUpdateFamily}
            onDeleteFamily={onDeleteFamily}
            getEvents={getEvents}
            onAddEvent={onAddEvent}
            onDeleteEvent={onDeleteEvent}
          />
          <EventsSection
            events={events}
            refresh={refreshEvents}
            onAddEvent={onAddEvent}
            onDeleteEvent={onDeleteEvent}
          />
          <SourcesSection
            personId={draft.id}
            sources={sources}
            citations={citations}
            refresh={refreshCitations}
            onAddSource={onAddSource}
            onAttachSource={onAttachSource}
            onDetachCitation={onDetachCitation}
          />
          <MediaSection
            personId={draft.id}
            media={media}
            refresh={refreshMedia}
            onAddMedia={onAddMedia}
            onDeleteMedia={onDeleteMedia}
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

function DateEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DateDraft;
  onChange: (value: DateDraft) => void;
}) {
  const set = (patch: Partial<DateDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="date-editor">
      <label>{label}</label>
      <div className="date-editor-row">
        <input
          type="number"
          placeholder="YYYY"
          value={value.year}
          onChange={(event) => set({ year: event.target.value })}
        />
        <input
          type="number"
          placeholder="MM"
          min={1}
          max={12}
          value={value.month}
          onChange={(event) => set({ month: event.target.value })}
        />
        <input
          type="number"
          placeholder="DD"
          min={1}
          max={31}
          value={value.day}
          onChange={(event) => set({ day: event.target.value })}
        />
        <select value={value.quality} onChange={(event) => set({ quality: event.target.value as DateQuality })}>
          <option value="exact">{nls.t('features.tree.date.exact')}</option>
          <option value="about">{nls.t('features.tree.date.about')}</option>
          <option value="before">{nls.t('features.tree.date.before')}</option>
          <option value="after">{nls.t('features.tree.date.after')}</option>
          <option value="unknown">{nls.t('features.tree.date.unknown')}</option>
        </select>
        <input
          placeholder={nls.t('features.tree.field.place')}
          value={value.place}
          onChange={(event) => set({ place: event.target.value })}
        />
      </div>
      <div className="date-editor-row">
        <input
          className="date-text-input"
          placeholder={nls.t('features.tree.field.dateText')}
          value={value.text}
          onChange={(event) => set({ text: event.target.value })}
        />
      </div>
    </div>
  );
}

const EVENT_TYPES = ['BIRT', 'DEAT', 'BURI', 'MARR', 'RESI', 'OCCU', 'EMIG', 'IMMI', 'CENS', 'CHR', 'BAPM'];

function EventsSection({
  events,
  refresh,
  onAddEvent,
  onDeleteEvent,
}: {
  events: EventRecord[];
  refresh: () => Promise<void>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
}) {
  const [type, setType] = useState('');
  const [date, setDate] = useState<DateDraft>(emptyDate());
  const [description, setDescription] = useState('');

  const add = async () => {
    const trimmed = type.trim().toUpperCase();
    if (!trimmed) {
      return;
    }
    const event: EventRecord = {
      id: crypto.randomUUID(),
      type: trimmed,
      date: fromDateDraft(date),
      description: description.trim() || undefined,
    };
    await onAddEvent(event);
    setType('');
    setDate(emptyDate());
    setDescription('');
    await refresh();
  };

  const remove = async (event: EventRecord) => {
    await onDeleteEvent(event);
    await refresh();
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.events.title')}</h3>
      {events.length === 0 ? (
        <p className="notes-empty">{nls.t('features.tree.events.empty')}</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id}>
              <span className="event-type">{event.type}</span>
              <span className="event-date">
                {event.date ? formatDate(event.date) : ''}
                {event.place ? ` — ${event.place}` : ''}
              </span>
              {event.description ? <span className="event-description">{event.description}</span> : null}
              <button title={nls.t('features.tree.events.remove')} onClick={() => void remove(event)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="events-add">
        <input
          className="event-type-input"
          list="doru-event-types"
          placeholder={nls.t('features.tree.events.typeField')}
          value={type}
          onChange={(event) => setType(event.target.value)}
        />
        <datalist id="doru-event-types">
          {EVENT_TYPES.map((eventType) => (
            <option key={eventType} value={eventType} />
          ))}
        </datalist>
        <DateEditor label={nls.t('features.tree.events.dateField')} value={date} onChange={setDate} />
        <input
          placeholder={nls.t('features.tree.events.descriptionField')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button onClick={() => void add()}>{nls.t('features.tree.events.add')}</button>
      </div>
    </div>
  );
}

interface FamilySectionProps {
  personId: string;
  persons: PersonRecord[];
  nameFormat: NameFormat;
  families: FamilyRecord[];
  refresh: () => Promise<void>;
  onAddFamily: (family: FamilyRecord) => Promise<void>;
  onUpdateFamily: (before: FamilyRecord, after: FamilyRecord) => Promise<void>;
  onDeleteFamily: (family: FamilyRecord) => Promise<void>;
  getEvents: (personId?: string, familyId?: string) => Promise<EventRecord[]>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
}

function FamilySection({
  personId,
  persons,
  nameFormat,
  families,
  refresh,
  onAddFamily,
  onUpdateFamily,
  onDeleteFamily,
  getEvents,
  onAddEvent,
  onDeleteEvent,
}: FamilySectionProps) {
  const asChild = families.filter((family) => family.children.includes(personId));
  const asParent = families.filter((family) => family.parents.includes(personId));

  const addFamily = async (kind: 'child' | 'parent') => {
    await onAddFamily({
      id: crypto.randomUUID(),
      parents: kind === 'parent' ? [personId] : [],
      children: kind === 'child' ? [personId] : [],
    });
    await refresh();
  };

  const removeMember = async (family: FamilyRecord, memberId: string) => {
    const after: FamilyRecord = {
      ...family,
      parents: family.parents.filter((id) => id !== memberId),
      children: family.children.filter((id) => id !== memberId),
    };
    await onUpdateFamily(family, after);
    await refresh();
  };

  const addMember = async (family: FamilyRecord, role: 'parent' | 'child', memberId: string) => {
    const after: FamilyRecord = {
      ...family,
      parents: role === 'parent' ? [...family.parents, memberId] : family.parents,
      children: role === 'child' ? [...family.children, memberId] : family.children,
    };
    await onUpdateFamily(family, after);
    await refresh();
  };

  const deleteFamily = async (family: FamilyRecord) => {
    await onDeleteFamily(family);
    await refresh();
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.families.title')}</h3>
      {asChild.length === 0 && asParent.length === 0 && (
        <p className="notes-empty">{nls.t('features.tree.families.empty')}</p>
      )}
      {asChild.map((family) => (
        <FamilyCard
          key={family.id}
          family={family}
          personId={personId}
          persons={persons}
          nameFormat={nameFormat}
          onRemoveMember={(memberId) => void removeMember(family, memberId)}
          onAddMember={(role, memberId) => void addMember(family, role, memberId)}
          onDelete={() => void deleteFamily(family)}
          getEvents={getEvents}
          onAddEvent={onAddEvent}
          onDeleteEvent={onDeleteEvent}
        />
      ))}
      {asParent.map((family) => (
        <FamilyCard
          key={family.id}
          family={family}
          personId={personId}
          persons={persons}
          nameFormat={nameFormat}
          onRemoveMember={(memberId) => void removeMember(family, memberId)}
          onAddMember={(role, memberId) => void addMember(family, role, memberId)}
          onDelete={() => void deleteFamily(family)}
          getEvents={getEvents}
          onAddEvent={onAddEvent}
          onDeleteEvent={onDeleteEvent}
        />
      ))}
      <div className="family-add">
        <button onClick={() => void addFamily('child')}>
          {nls.t('features.tree.families.addParents')}
        </button>
        <button onClick={() => void addFamily('parent')}>
          {nls.t('features.tree.families.addPartner')}
        </button>
      </div>
    </div>
  );
}

function FamilyCard({
  family,
  personId,
  persons,
  nameFormat,
  onRemoveMember,
  onAddMember,
  onDelete,
  getEvents,
  onAddEvent,
  onDeleteEvent,
}: {
  family: FamilyRecord;
  personId: string;
  persons: PersonRecord[];
  nameFormat: NameFormat;
  onRemoveMember: (memberId: string) => void;
  onAddMember: (role: 'parent' | 'child', memberId: string) => void;
  onDelete: () => void;
  getEvents: (personId?: string, familyId?: string) => Promise<EventRecord[]>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
}) {
  const [familyEvents, setFamilyEvents] = useState<EventRecord[]>([]);
  const [marriageDate, setMarriageDate] = useState<DateDraft>(emptyDate());

  useEffect(() => {
    let cancelled = false;
    void getEvents(undefined, family.id).then((loaded) => {
      if (!cancelled) setFamilyEvents(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [family.id, getEvents]);

  const addMarriage = async () => {
    const date = fromDateDraft(marriageDate);
    await onAddEvent({ id: crypto.randomUUID(), type: 'MARR', date, familyId: family.id });
    setMarriageDate(emptyDate());
    setFamilyEvents(await getEvents(undefined, family.id));
  };

  const removeEvent = async (event: EventRecord) => {
    await onDeleteEvent(event);
    setFamilyEvents(await getEvents(undefined, family.id));
  };

  return (
    <div className="family-row">
      <div className="family-members">
        {family.parents
          .filter((id) => id !== personId)
          .map((parentId) => (
            <span key={parentId} className="family-chip">
              {displayName(persons.find((person) => person.id === parentId), nameFormat)}
              <button title="×" onClick={() => onRemoveMember(parentId)}>
                ×
              </button>
            </span>
          ))}
        {family.children.map((childId) => (
          <span key={childId} className="family-chip child">
            {displayName(persons.find((person) => person.id === childId), nameFormat)}
            <button title="×" onClick={() => onRemoveMember(childId)}>
              ×
            </button>
          </span>
        ))}
        <PersonPicker
          persons={persons}
          exclude={[...family.parents, ...family.children]}
          nameFormat={nameFormat}
          onPick={(memberId) => onAddMember('child', memberId)}
        />
      </div>
      <div className="family-events">
        <span className="family-events-label">{nls.t('features.tree.families.marriage')}</span>
        {familyEvents.map((event) => (
          <span key={event.id} className="family-chip event">
            {event.date ? formatDate(event.date) : ''}
            {event.place ? ` — ${event.place}` : ''}
            <button title="×" onClick={() => void removeEvent(event)}>
              ×
            </button>
          </span>
        ))}
        <DateEditor label="" value={marriageDate} onChange={setMarriageDate} />
        <button onClick={() => void addMarriage()}>{nls.t('features.tree.events.add')}</button>
      </div>
      <div className="family-actions">
        <button onClick={onDelete}>{nls.t('features.tree.families.delete')}</button>
      </div>
    </div>
  );
}

function PersonPicker({
  persons,
  exclude,
  nameFormat,
  onPick,
}: {
  persons: PersonRecord[];
  exclude: string[];
  nameFormat: NameFormat;
  onPick: (personId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const needle = query.trim().toLowerCase();
  const candidates = persons
    .filter((person) => !exclude.includes(person.id))
    .filter((person) => !needle || displayName(person, nameFormat).toLowerCase().includes(needle))
    .slice(0, 8);

  return (
    <div className="person-picker">
      <input
        value={query}
        placeholder={nls.t('features.tree.families.personSearch')}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && candidates.length > 0 && (
        <ul className="person-picker-list">
          {candidates.map((person) => (
            <li
              key={person.id}
              onMouseDown={() => {
                onPick(person.id);
                setQuery('');
                setOpen(false);
              }}
            >
              {displayName(person, nameFormat)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface SourcesSectionProps {
  personId: string;
  sources: SourceRecord[];
  citations: CitationInfo[];
  refresh: () => Promise<void>;
  onAddSource: (source: SourceRecord, targetId: string) => Promise<void>;
  onAttachSource: (sourceId: string, targetId: string) => Promise<void>;
  onDetachCitation: (citationId: string) => Promise<void>;
}

function SourcesSection({
  personId,
  sources,
  citations,
  refresh,
  onAddSource,
  onAttachSource,
  onDetachCitation,
}: SourcesSectionProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');

  const addNew = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      return;
    }
    await onAddSource({ id: crypto.randomUUID(), title: trimmed, author: author.trim() || undefined }, personId);
    setTitle('');
    setAuthor('');
    await refresh();
  };

  const detach = async (citationId: string) => {
    await onDetachCitation(citationId);
    await refresh();
  };

  const attach = async (sourceId: string) => {
    await onAttachSource(sourceId, personId);
    await refresh();
  };

  const citedIds = new Set(citations.map((citation) => citation.source.id));
  const uncited = sources.filter((source) => !citedIds.has(source.id));

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.sources.title')}</h3>
      {citations.length === 0 && (
        <p className="notes-empty">{nls.t('features.tree.sources.empty')}</p>
      )}
      <ul className="source-list">
        {citations.map((citation) => (
          <li key={citation.id}>
            <span>{citation.source.title}</span>
            <button title="×" onClick={() => void detach(citation.id)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="sources-new">
        <input
          placeholder={nls.t('features.tree.sources.titleField')}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          placeholder={nls.t('features.tree.sources.authorField')}
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
        <button onClick={() => void addNew()}>{nls.t('features.tree.sources.add')}</button>
      </div>
      {uncited.length > 0 && (
        <div className="sources-attach">
          {uncited.map((source) => (
            <button key={source.id} title={source.title} onClick={() => void attach(source.id)}>
              {nls.t('features.tree.sources.attach')}: {source.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaSection({
  personId,
  media,
  refresh,
  onAddMedia,
  onDeleteMedia,
}: {
  personId: string;
  media: MediaWithPath[];
  refresh: () => Promise<void>;
  onAddMedia: (personId: string) => Promise<void>;
  onDeleteMedia: (media: MediaRecord) => Promise<void>;
}) {
  const add = async () => {
    await onAddMedia(personId);
    await refresh();
  };

  const remove = async (item: MediaRecord) => {
    await onDeleteMedia(item);
    await refresh();
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.media.title')}</h3>
      {media.length === 0 ? (
        <p className="notes-empty">{nls.t('features.tree.media.empty')}</p>
      ) : (
        <div className="media-grid">
          {media.map((item) => (
            <figure key={item.id} className="media-item">
              <img
                src={`doru-media://local/?path=${encodeURIComponent(item.absolutePath)}`}
                alt={item.caption ?? ''}
                loading="lazy"
              />
              <button
                className="media-remove"
                title={nls.t('features.tree.media.remove')}
                onClick={() => void remove(item)}
              >
                ×
              </button>
            </figure>
          ))}
        </div>
      )}
      <button onClick={() => void add()}>{nls.t('features.tree.media.add')}</button>
    </div>
  );
}

function emptyDate(): DateDraft {
  return { year: '', month: '', day: '', text: '', quality: 'exact', place: '' };
}

function toDraft(person: PersonRecord): PersonDraft {
  const name = person.names[0];
  return {
    id: person.id,
    given: name?.given ?? '',
    surname: name?.surname ?? '',
    sex: person.sex,
    birth: toDateDraft(person.birth),
    death: toDateDraft(person.death),
    isNew: false,
  };
}

function toDateDraft(date: DateValue | undefined): DateDraft {
  return {
    year: date?.year !== undefined ? String(date.year) : '',
    month: date?.month !== undefined ? String(date.month) : '',
    day: date?.day !== undefined ? String(date.day) : '',
    text: date?.text ?? '',
    quality: date?.quality ?? 'exact',
    place: date?.place ?? '',
  };
}

function draftEquals(draft: PersonDraft, person: PersonRecord): boolean {
  const name = person.names[0];
  return (
    draft.given === (name?.given ?? '') &&
    draft.surname === (name?.surname ?? '') &&
    draft.sex === person.sex &&
    dateDraftEquals(draft.birth, person.birth) &&
    dateDraftEquals(draft.death, person.death)
  );
}

function dateDraftEquals(draft: DateDraft, date: DateValue | undefined): boolean {
  const other = toDateDraft(date);
  return (
    draft.year === other.year &&
    draft.month === other.month &&
    draft.day === other.day &&
    draft.text === other.text &&
    draft.quality === other.quality &&
    draft.place === other.place
  );
}

function toRecord(draft: PersonDraft): PersonRecord {
  const full = `${draft.given} ${draft.surname}`.trim();
  const names = full
    ? [{ given: draft.given || undefined, surname: draft.surname || undefined, full }]
    : [];
  return {
    id: draft.id,
    names,
    sex: draft.sex,
    birth: fromDateDraft(draft.birth),
    death: fromDateDraft(draft.death),
  };
}

function fromDateDraft(draft: DateDraft): DateValue | undefined {
  const year = draft.year !== '' ? Number(draft.year) : undefined;
  const month = draft.month !== '' ? Number(draft.month) : undefined;
  const day = draft.day !== '' ? Number(draft.day) : undefined;
  const text = draft.text.trim() || undefined;
  const place = draft.place.trim() || undefined;
  if (year === undefined && month === undefined && day === undefined && text === undefined && place === undefined) {
    return undefined;
  }
  return { year, month, day, text, quality: draft.quality, place };
}

function displayName(person: PersonRecord | undefined, nameFormat: NameFormat = 'given-first'): string {
  if (!person) {
    return '?';
  }
  const name = person.names[0];
  if (!name) {
    return person.id;
  }
  if (name.full) {
    const cleaned = name.full.replace(/\//g, '').trim();
    if (cleaned) {
      return cleaned;
    }
  }
  const given = name.given;
  const surname = name.surname;
  const parts = nameFormat === 'surname-first' ? [surname, given] : [given, surname];
  const filtered = parts.filter((part) => part !== undefined);
  return filtered.length > 0 ? (nameFormat === 'surname-first' ? filtered.join(', ') : filtered.join(' ')) : person.id;
}

function years(person: PersonRecord): string {
  const parts: string[] = [];
  if (person.birth?.year !== undefined) {
    parts.push(`${qualityMark(person.birth.quality)}${person.birth.year}`);
  }
  if (person.death?.year !== undefined) {
    parts.push(`— ${person.death.year}`);
  }
  return parts.join(' ');
}

function formatDate(date: DateValue): string {
  const parts: string[] = [];
  if (date.year !== undefined) {
    parts.push(`${qualityMark(date.quality)}${date.year}`);
  }
  if (date.text) {
    parts.push(date.text);
  }
  return parts.join(' ');
}

function qualityMark(quality: DateQuality): string {
  switch (quality) {
    case 'about':
      return '~';
    case 'before':
      return '<';
    case 'after':
      return '>';
    default:
      return '';
  }
}
