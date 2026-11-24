import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { InlineError } from '../../atoms/feedback/InlineError';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { Textarea } from '../../atoms/form/Textarea';
import { AttachExisting } from '../../patterns/attach-existing/AttachExisting';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { useState, type ReactNode } from 'react';
import { BookOpenText, Pencil, Trash2, X } from 'lucide-react';
import type { NoteLinkRecord, NoteRecord } from '@doru/core';
import { nls } from '../../nls';
import './NotesSection.css';

/**
 * The person's notes with inline editing. Editing a shared note from this
 * context splits it (copy-on-write) — the service handles that when the
 * context link is passed through. The edit form covers the note text. The
 * sources button opens the citations of a note; a note has no other
 * attachments.
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
  renderSources,
}: {
  targetType: string;
  targetId: string;
  notes: NoteRecord[];
  availableNotes?: NoteRecord[];
  renderSources?: ((note: NoteRecord) => ReactNode) | undefined;
  onAdd: (text: string) => Promise<void>;
  onUpdate: (
    before: NoteRecord,
    after: NoteRecord,
    context: NoteLinkRecord | undefined,
    mode?: 'split' | 'shared',
  ) => Promise<void>;
  onAttach?: ((noteId: string) => Promise<void>) | undefined;
  onDetach?: ((note: NoteRecord, link: NoteLinkRecord) => Promise<void>) | undefined;
  onDelete: (note: NoteRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [attachError, setAttachError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedSourcesId, setExpandedSourcesId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editShared, setEditShared] = useState(false);

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
    setEditShared(false);
  };

  const attachableNotes = availableNotes.filter(
    (note) => !(note.links ?? []).some((link) => link.targetType === targetType && link.targetId === targetId),
  );

  const saveEdit = async (note: NoteRecord) => {
    const text = editText.trim();
    const changed = text !== note.text;
    if (text !== '' && changed) {
      const link = note.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId) ?? {
        id: crypto.randomUUID(),
        targetType,
        targetId,
      };
      const shared = (note.links?.length ?? 0) > 1;
      await onUpdate(
        note,
        { ...note, text },
        shared && editShared ? undefined : link,
        shared && editShared ? 'shared' : 'split',
      );
    }
    setEditingId(null);
  };

  return (
    <SectionCard title={nls.t('features.tree.notes.title')}>
      {notes.length === 0 ? (
        <EmptyText>{nls.t('features.tree.notes.empty')}</EmptyText>
      ) : (
        <ul className="notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              {editingId === note.id ? (
                <div className="notes-edit">
                  <Textarea value={editText} onChange={(event) => setEditText(event.target.value)} autoFocus />
                  {(note.links?.length ?? 0) > 1 && (
                    <Select
                      aria-label={nls.t('features.tree.notes.editMode')}
                      value={editShared ? 'shared' : 'split'}
                      onChange={(event) => setEditShared(event.target.value === 'shared')}
                    >
                      <option value="split">{nls.t('features.tree.notes.editSplit')}</option>
                      <option value="shared">{nls.t('features.tree.notes.editShared')}</option>
                    </Select>
                  )}
                  <div className="notes-edit-actions">
                    <Button variant="primary" size="sm" onClick={() => void saveEdit(note)}>
                      {nls.t('features.tree.save')}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                      {nls.t('features.tree.fact.cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="notes-row">
                  <span className="notes-text">{note.text}</span>
                  {(note.links?.length ?? 0) > 1 && (
                    <span className="notes-meta">{nls.t('features.tree.notes.shared')}</span>
                  )}
                  {renderSources !== undefined && (
                    <IconButton
                      size="sm"
                      label={nls.t('features.tree.sources.title')}
                      icon={<BookOpenText size={13} aria-hidden="true" />}
                      onClick={() => setExpandedSourcesId(expandedSourcesId === note.id ? null : note.id)}
                    />
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
              {renderSources !== undefined && expandedSourcesId === note.id && (
                <div className="notes-sources">{renderSources(note)}</div>
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
      <div className="notes-add">
        <Input
          value={draft}
          placeholder={nls.t('features.tree.notes.placeholder')}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void add();
            }
          }}
        />
        <Button variant="secondary" onClick={() => void add()}>
          {nls.t('features.tree.notes.add')}
        </Button>
      </div>
    </SectionCard>
  );
}
