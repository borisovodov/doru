import { useState } from 'react';
import { Pencil, Plus, X } from 'lucide-react';
import type { NoteLinkRecord, NoteRecord, NoteTranslation } from '@doru/core';
import { nls } from '../../nls';
import './NotesSection.css';

/**
 * The person's notes with inline editing. Editing a shared note from this
 * context splits it (copy-on-write) — the service handles that when the
 * context link is passed through. The edit form covers the note text, its
 * language and MIME type and the translations (GEDCOM NOTE TRAN rows).
 */
export function NotesSection({
  targetType,
  targetId,
  notes,
  onAdd,
  onUpdate,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  notes: NoteRecord[];
  onAdd: (text: string) => Promise<void>;
  onUpdate: (before: NoteRecord, after: NoteRecord, context: NoteLinkRecord) => Promise<void>;
  onDelete: (note: NoteRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [editMime, setEditMime] = useState('');
  const [editTranslations, setEditTranslations] = useState<NoteTranslation[]>([]);

  const add = async () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    await onAdd(text);
    setDraft('');
  };

  const startEdit = (note: NoteRecord) => {
    setEditingId(note.id);
    setEditText(note.text);
    setEditLanguage(note.language ?? '');
    setEditMime(note.mime ?? '');
    setEditTranslations(
      (note.translations ?? []).map((translation) => ({
        id: translation.id,
        text: translation.text,
        mime: translation.mime ?? '',
        language: translation.language ?? '',
      })),
    );
  };

  const patchTranslation = (index: number, values: Partial<NoteTranslation>) =>
    setEditTranslations((current) =>
      current.map((translation, i) => (i === index ? { ...translation, ...values } : translation)),
    );

  const addTranslation = () =>
    setEditTranslations((current) => [
      ...current,
      { id: crypto.randomUUID(), text: '', mime: '', language: '' },
    ]);

  const removeTranslation = (index: number) =>
    setEditTranslations((current) => current.filter((_, i) => i !== index));

  const saveEdit = async (note: NoteRecord) => {
    const text = editText.trim();
    const language = editLanguage.trim() || undefined;
    const mime = editMime.trim() || undefined;
    const translations = editTranslations
      .map((translation) => ({
        id: translation.id,
        text: translation.text.trim(),
        mime: translation.mime?.trim() || undefined,
        language: translation.language?.trim() || undefined,
      }))
      .filter((translation) => translation.text !== '');
    const changed =
      text !== note.text ||
      language !== note.language ||
      mime !== note.mime ||
      !translationsEqual(translations, note.translations ?? []);
    if (text !== '' && changed) {
      const link =
        note.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId) ??
        ({ id: crypto.randomUUID(), targetType, targetId } as NoteLinkRecord);
      await onUpdate(note, { ...note, text, mime, language, translations }, link);
    }
    setEditingId(null);
  };

  return (
    <div className="person-notes">
      <h3>{nls.t('features.tree.notes.title')}</h3>
      {notes.length === 0 ? (
        <p className="notes-empty">{nls.t('features.tree.notes.empty')}</p>
      ) : (
        <ul>
          {notes.map((note) => (
            <li key={note.id}>
              {editingId === note.id ? (
                <div className="notes-edit">
                  <textarea value={editText} onChange={(event) => setEditText(event.target.value)} autoFocus />
                  <div className="notes-edit-fields">
                    <input
                      placeholder={nls.t('features.tree.notes.language')}
                      value={editLanguage}
                      onChange={(event) => setEditLanguage(event.target.value)}
                    />
                    <input
                      placeholder={nls.t('features.tree.notes.mime')}
                      value={editMime}
                      onChange={(event) => setEditMime(event.target.value)}
                    />
                  </div>
                  <div className="notes-translations">
                    <span className="notes-translations-title">
                      {nls.t('features.tree.notes.translations.title')}
                    </span>
                    {editTranslations.map((translation, index) => (
                      <div className="translation-row" key={translation.id}>
                        <input
                          className="translation-text"
                          placeholder={nls.t('features.tree.notes.translations.placeholder')}
                          value={translation.text}
                          onChange={(event) => patchTranslation(index, { text: event.target.value })}
                        />
                        <input
                          placeholder={nls.t('features.tree.notes.language')}
                          value={translation.language}
                          onChange={(event) => patchTranslation(index, { language: event.target.value })}
                        />
                        <input
                          placeholder={nls.t('features.tree.notes.mime')}
                          value={translation.mime}
                          onChange={(event) => patchTranslation(index, { mime: event.target.value })}
                        />
                        <button
                          className="icon-button"
                          title={nls.t('features.tree.notes.translations.remove')}
                          onClick={() => removeTranslation(index)}
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <button className="add-button small" onClick={addTranslation}>
                      <Plus size={13} aria-hidden="true" />
                      {nls.t('features.tree.notes.translations.add')}
                    </button>
                  </div>
                  <div className="notes-edit-actions">
                    <button className="add-button small" onClick={() => void saveEdit(note)}>
                      {nls.t('features.tree.save')}
                    </button>
                    <button className="plain-button small" onClick={() => setEditingId(null)}>
                      {nls.t('features.tree.fact.cancel')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="notes-row">
                  <span className="notes-text">{note.text}</span>
                  {noteMeta(note) !== '' && <span className="notes-meta">{noteMeta(note)}</span>}
                  <button className="icon-button" title={nls.t('features.tree.notes.edit')} onClick={() => startEdit(note)}>
                    <Pencil size={13} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button"
                    title={nls.t('features.tree.notes.remove')}
                    onClick={() => void onDelete(note)}
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="notes-add">
        <input
          value={draft}
          placeholder={nls.t('features.tree.notes.placeholder')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void add();
            }
          }}
        />
        <button className="add-button" onClick={() => void add()}>
          {nls.t('features.tree.notes.add')}
        </button>
      </div>
    </div>
  );
}

function translationsEqual(a: NoteTranslation[], b: NoteTranslation[]): boolean {
  return (
    a.length === b.length &&
    a.every((translation, index) => {
      const other = b[index]!;
      return (
        translation.text === other.text &&
        translation.mime === other.mime &&
        translation.language === other.language
      );
    })
  );
}

/** The muted meta line of a collapsed note: its language and translation count. */
function noteMeta(note: NoteRecord): string {
  const parts: string[] = [];
  if (note.language !== undefined && note.language !== '') {
    parts.push(note.language);
  }
  const count = note.translations?.length ?? 0;
  if (count > 0) {
    parts.push(nls.t('features.tree.notes.translations.count', count));
  }
  return parts.join(' · ');
}
