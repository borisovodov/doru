import { useState } from 'react';
import { Pencil, X } from 'lucide-react';
import type { NoteLinkRecord, NoteRecord } from '@doru/core';
import { nls } from '../nls';
import './NotesSection.css';

/**
 * The person's notes with inline editing. Editing a shared note from this
 * context splits it (copy-on-write) — the service handles that when the
 * context link is passed through.
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
  };

  const saveEdit = async (note: NoteRecord) => {
    const text = editText.trim();
    if (text !== '' && text !== note.text) {
      const link =
        note.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId) ??
        ({ id: crypto.randomUUID(), targetType, targetId } as NoteLinkRecord);
      await onUpdate(note, { ...note, text }, link);
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
