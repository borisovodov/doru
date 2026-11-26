import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Textarea } from '../../atoms/form/Textarea';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { NoteRecord } from '@doru/core';
import { nls } from '../../nls';
import styles from './NotesSection.module.css';

/**
 * The person's notes with inline editing. A note is owned by exactly one
 * record: editing changes its text, deleting removes it from that record.
 */
export function NotesSection({
  notes,
  onAdd,
  onUpdate,
  onDelete,
}: {
  notes: NoteRecord[];
  onAdd: (text: string) => Promise<void>;
  onUpdate: (before: NoteRecord, after: NoteRecord) => Promise<void>;
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
    const changed = text !== note.text;
    if (text !== '' && changed) {
      await onUpdate(note, { ...note, text });
    }
    setEditingId(null);
  };

  return (
    <SectionCard title={nls.t('features.tree.notes.title')}>
      {notes.length === 0 ? (
        <EmptyText>{nls.t('features.tree.notes.empty')}</EmptyText>
      ) : (
        <ul className={styles['notesList']}>
          {notes.map((note) => (
            <li key={note.id}>
              {editingId === note.id ? (
                <div className={styles['notesEdit']}>
                  <Textarea value={editText} onChange={(event) => setEditText(event.target.value)} autoFocus />
                  <div className={styles['notesEditActions']}>
                    <Button variant="primary" size="sm" onClick={() => void saveEdit(note)}>
                      {nls.t('features.tree.save')}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                      {nls.t('features.tree.fact.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className={styles['notesRow']}>
                  <span className={styles['notesText']}>{note.text}</span>
                  <IconButton
                    size="sm"
                    label={nls.t('features.tree.notes.edit')}
                    icon={<Pencil size={13} aria-hidden="true" />}
                    onClick={() => startEdit(note)}
                  />
                  <IconButton
                    size="sm"
                    label={nls.t('features.tree.notes.remove')}
                    icon={<Trash2 size={13} aria-hidden="true" />}
                    onClick={() => void onDelete(note)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className={styles['notesAdd']}>
        <Textarea
          rows={2}
          value={draft}
          placeholder={nls.t('features.tree.notes.placeholder')}
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button variant="secondary" onClick={() => void add()}>
          {nls.t('features.tree.notes.add')}
        </Button>
      </div>
    </SectionCard>
  );
}
