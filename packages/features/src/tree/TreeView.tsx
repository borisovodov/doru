import { useEffect, useState } from 'react';
import type { GedcomImportResult, PersonRecord, ProjectSummary, Sex, TreeStats } from '@doru/core';
import { LocalizationService } from '@doru/platform';

const detected =
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('ru')
    ? 'ru'
    : 'en';

const nls = new LocalizationService(detected);

interface PersonDraft {
  id: string;
  given: string;
  surname: string;
  sex: Sex;
  birthYear: string;
  deathYear: string;
  isNew: boolean;
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
  onOpenProject: () => void;
  onImportGedcom: () => void;
  onExportGedcom: () => void;
  onSearch: (query: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddPerson: (person: PersonRecord) => void;
  onUpdatePerson: (before: PersonRecord, after: PersonRecord) => void;
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
  onOpenProject,
  onImportGedcom,
  onExportGedcom,
  onSearch,
  onUndo,
  onRedo,
  onAddPerson,
  onUpdatePerson,
}: TreeViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PersonDraft | null>(null);

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
      birthYear: '',
      deathYear: '',
      isNew: true,
    });
  };

  const closeEditor = () => {
    setDraft(null);
    setSelectedId(null);
  };

  const save = () => {
    if (!draft) {
      return;
    }
    const record = toRecord(draft);
    if (draft.isNew) {
      onAddPerson(record);
      closeEditor();
      return;
    }
    const before = persons.find((entry) => entry.id === draft.id);
    if (before) {
      onUpdatePerson(before, record);
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
      </div>
      {stats && <p className="tree-stats">{nls.t('features.tree.totalPersons', stats.persons)}</p>}
      {importResult && (
        <p className="tree-stats">
          {nls.t('features.tree.importResult', importResult.importedPersons, importResult.importedFamilies)}
        </p>
      )}
      {exportResult && (
        <p className="tree-stats">{nls.t('features.tree.exported', exportResult.path)}</p>
      )}
      {draft ? (
        <PersonEditor draft={draft} onChange={setDraft} onSave={save} onCancel={closeEditor} />
      ) : persons.length === 0 ? (
        <p>{nls.t('features.tree.emptyTree')}</p>
      ) : (
        <ul className="person-list">
          {persons.map((person) => (
            <li key={person.id} onClick={() => setSelectedId(person.id)}>
              <span className="person-name">{displayName(person)}</span>
              <span className="person-dates">{years(person)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface PersonEditorProps {
  draft: PersonDraft;
  onChange: (draft: PersonDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

function PersonEditor({ draft, onChange, onSave, onCancel }: PersonEditorProps) {
  const set = (patch: Partial<PersonDraft>) => onChange({ ...draft, ...patch });
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
      <label>
        {nls.t('features.tree.field.birthYear')}
        <input
          type="number"
          value={draft.birthYear}
          onChange={(event) => set({ birthYear: event.target.value })}
        />
      </label>
      <label>
        {nls.t('features.tree.field.deathYear')}
        <input
          type="number"
          value={draft.deathYear}
          onChange={(event) => set({ deathYear: event.target.value })}
        />
      </label>
      <div className="person-editor-actions">
        <button onClick={onSave}>{nls.t('features.tree.save')}</button>
        <button onClick={onCancel}>{nls.t('features.tree.back')}</button>
      </div>
    </div>
  );
}

function toDraft(person: PersonRecord): PersonDraft {
  const name = person.names[0];
  return {
    id: person.id,
    given: name?.given ?? '',
    surname: name?.surname ?? '',
    sex: person.sex,
    birthYear: person.birth?.year !== undefined ? String(person.birth.year) : '',
    deathYear: person.death?.year !== undefined ? String(person.death.year) : '',
    isNew: false,
  };
}

function draftEquals(draft: PersonDraft, person: PersonRecord): boolean {
  const name = person.names[0];
  return (
    draft.given === (name?.given ?? '') &&
    draft.surname === (name?.surname ?? '') &&
    draft.sex === person.sex &&
    draft.birthYear === (person.birth?.year !== undefined ? String(person.birth.year) : '') &&
    draft.deathYear === (person.death?.year !== undefined ? String(person.death.year) : '')
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
    birth: draft.birthYear !== '' ? { year: Number(draft.birthYear), quality: 'exact' } : undefined,
    death: draft.deathYear !== '' ? { year: Number(draft.deathYear), quality: 'exact' } : undefined,
  };
}

function displayName(person: PersonRecord): string {
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
  const parts = [name.given, name.surname].filter((part) => part !== undefined);
  return parts.length > 0 ? parts.join(' ') : person.id;
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

function qualityMark(quality: 'exact' | 'about' | 'before' | 'after' | 'range' | 'unknown'): string {
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
