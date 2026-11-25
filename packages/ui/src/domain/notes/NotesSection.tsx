import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { InlineError } from '../../atoms/feedback/InlineError';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Textarea } from '../../atoms/form/Textarea';
import { AttachExisting } from '../../patterns/attach-existing/AttachExisting';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import type { NoteLinkRecord, NoteRecord } from '@doru/core';
import { nls } from '../../nls';
import styles from './NotesSection.module.css';

/**
 * The person's notes with inline editing. Editing a shared note updates the
 * text for every record it is attached to. The edit form covers the note text.
 */
export function NotesSection({
  targetType,
  targetId,
  notes,
  availableNotes = [],
  onAdd,
  onUpdate,
  onAttach,
  onDetach,
  onDelete,
}: {
  targetType: string;
  targetId: string;
  notes: NoteRecord[];
  availableNotes?: NoteRecord[];
  onAdd: (text: string) => Promise<void>;
  onUpdate: (before: NoteRecord, after: NoteRecord) => Promise<void>;
  onAttach?: ((noteId: string) => Promise<void>) | undefined;
  onDetach?: ((note: NoteRecord, link: NoteLinkRecord) => Promise<void>) | undefined;
  onDelete: (note: NoteRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [attachError, setAttachError] = useState(false);
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

  const attach = async (noteId: string) => {
    setAttachError(false);
    await onAttach?.(noteId);
  };

  const startEdit = (note: NoteRecord) => {
    setEditingId(note.id);
    setEditText(note.text);
  };

  const attachableNotes = availableNotes.filter(
    (note) => !(note.links ?? []).some((link) => link.targetType === targetType && link.targetId === targetId),
  );

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
                  {(note.links?.length ?? 0) > 1 && (
                    <span className={styles['notesMeta']}>{nls.t('features.tree.notes.shared')}</span>
                  )}
                  <IconButton
                    size="sm"
                    label={nls.t('features.tree.notes.edit')}
                    icon={<Pencil size={13} aria-hidden="true" />}
                    onClick={() => startEdit(note)}
                  />
                  {(note.links?.length ?? 0) > 1 && onDetach !== undefined && (
                    <IconButton
                      size="sm"
                      label={nls.t('features.tree.notes.detach')}
                      icon={<X size={13} aria-hidden="true" />}
                      onClick={() => {
                        const link = note.links?.find(
                          (entry) => entry.targetType === targetType && entry.targetId === targetId,
                        );
                        if (link !== undefined) {
                          void onDetach(note, link);
                        }
                      }}
                    />
                  )}
                  <IconButton
                    size="sm"
                    label={
                      (note.links?.length ?? 0) > 1
                        ? nls.t('features.tree.notes.deleteEverywhere')
                        : nls.t('features.tree.notes.remove')
                    }
                    icon={
                      (note.links?.length ?? 0) > 1 ? (
                        <Trash2 size={13} aria-hidden="true" />
                      ) : (
                        <X size={13} aria-hidden="true" />
                      )
                    }
                    onClick={() => void onDelete(note)}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {attachError ? <InlineError>{nls.t('features.tree.autosaveFailed')}</InlineError> : null}
      {onAttach !== undefined && (
        <AttachExisting
          label={nls.t('features.tree.notes.attachExisting')}
          actionLabel={nls.t('features.tree.notes.attach')}
          options={attachableNotes.map((note) => ({
            id: note.id,
            label: note.text.length > 60 ? `${note.text.slice(0, 60)}…` : note.text,
          }))}
          onAttach={attach}
          onError={() => setAttachError(true)}
        />
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
