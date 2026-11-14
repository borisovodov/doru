import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { Textarea } from '../../atoms/form/Textarea';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { useState, type ReactNode } from 'react';
import { Paperclip, Pencil, Plus, Trash2, X } from 'lucide-react';
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
  availableNotes = [],
  onAdd,
  onUpdate,
  onAttach,
  onDetach,
  onDelete,
  renderAttachments,
}: {
  targetType: string;
  targetId: string;
  notes: NoteRecord[];
  availableNotes?: NoteRecord[];
  renderAttachments?: ((note: NoteRecord) => ReactNode) | undefined;
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
  const [attachId, setAttachId] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedAttachmentsId, setExpandedAttachmentsId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editLanguage, setEditLanguage] = useState('');
  const [editMime, setEditMime] = useState('');
  const [editShared, setEditShared] = useState(false);
  const [editTranslations, setEditTranslations] = useState<NoteTranslation[]>([]);

  const add = async () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    await onAdd(text);
    setDraft('');
  };

  const attach = async () => {
    if (attachId === '' || onAttach === undefined) {
      return;
    }
    await onAttach(attachId);
    setAttachId('');
  };

  const startEdit = (note: NoteRecord) => {
    setEditingId(note.id);
    setEditText(note.text);
    setEditLanguage(note.language ?? '');
    setEditMime(note.mime ?? '');
    setEditShared(false);
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
    setEditTranslations((current) => [...current, { id: crypto.randomUUID(), text: '', mime: '', language: '' }]);

  const removeTranslation = (index: number) => setEditTranslations((current) => current.filter((_, i) => i !== index));

  const attachableNotes = availableNotes.filter(
    (note) => !(note.links ?? []).some((link) => link.targetType === targetType && link.targetId === targetId),
  );

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
      const link = note.links?.find((entry) => entry.targetType === targetType && entry.targetId === targetId) ?? {
        id: crypto.randomUUID(),
        targetType,
        targetId,
      };
      const shared = (note.links?.length ?? 0) > 1;
      await onUpdate(
        note,
        { ...note, text, mime, language, translations },
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
                  <div className="notes-edit-fields">
                    <Input
                      placeholder={nls.t('features.tree.notes.language')}
                      value={editLanguage}
                      onChange={(event) => setEditLanguage(event.target.value)}
                    />
                    <Input
                      placeholder={nls.t('features.tree.notes.mime')}
                      value={editMime}
                      onChange={(event) => setEditMime(event.target.value)}
                    />
                  </div>
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
                  <div className="notes-translations">
                    <span className="notes-translations-title">{nls.t('features.tree.notes.translations.title')}</span>
                    {editTranslations.map((translation, index) => (
                      <div className="translation-row" key={translation.id}>
                        <Input
                          className="translation-text"
                          placeholder={nls.t('features.tree.notes.translations.placeholder')}
                          value={translation.text}
                          onChange={(event) => patchTranslation(index, { text: event.target.value })}
                        />
                        <Input
                          placeholder={nls.t('features.tree.notes.language')}
                          value={translation.language}
                          onChange={(event) => patchTranslation(index, { language: event.target.value })}
                        />
                        <Input
                          placeholder={nls.t('features.tree.notes.mime')}
                          value={translation.mime}
                          onChange={(event) => patchTranslation(index, { mime: event.target.value })}
                        />
                        <IconButton
                          size="sm"
                          label={nls.t('features.tree.notes.translations.remove')}
                          icon={<X size={13} aria-hidden="true" />}
                          onClick={() => removeTranslation(index)}
                        />
                      </div>
                    ))}
                    <Button variant="primary" size="sm" onClick={addTranslation}>
                      <Plus size={13} aria-hidden="true" />
                      {nls.t('features.tree.notes.translations.add')}
                    </Button>
                  </div>
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
                  {noteMeta(note) !== '' && <span className="notes-meta">{noteMeta(note)}</span>}
                  {(note.links?.length ?? 0) > 1 && (
                    <span className="notes-meta">{nls.t('features.tree.notes.shared')}</span>
                  )}
                  {renderAttachments !== undefined && (
                    <IconButton
                      size="sm"
                      label={nls.t('features.tree.notes.attachments')}
                      icon={<Paperclip size={13} aria-hidden="true" />}
                      onClick={() => setExpandedAttachmentsId(expandedAttachmentsId === note.id ? null : note.id)}
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
              {renderAttachments !== undefined && expandedAttachmentsId === note.id && (
                <div className="notes-attachments">{renderAttachments(note)}</div>
              )}
            </li>
          ))}
        </ul>
      )}
      {onAttach !== undefined && attachableNotes.length > 0 && (
        <div className="notes-add">
          <Select value={attachId} onChange={(event) => setAttachId(event.target.value)}>
            <option value="">{nls.t('features.tree.notes.attachExisting')}</option>
            {attachableNotes.map((note) => (
              <option key={note.id} value={note.id}>
                {note.text.length > 60 ? `${note.text.slice(0, 60)}…` : note.text}
              </option>
            ))}
          </Select>
          <Button variant="secondary" disabled={attachId === ''} onClick={() => void attach()}>
            {nls.t('features.tree.notes.attach')}
          </Button>
        </div>
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
        <Button variant="primary" onClick={() => void add()}>
          {nls.t('features.tree.notes.add')}
        </Button>
      </div>
    </SectionCard>
  );
}

function translationsEqual(a: NoteTranslation[], b: NoteTranslation[]): boolean {
  return (
    a.length === b.length &&
    a.every((translation, index) => {
      const other = b[index];
      return (
        other !== undefined &&
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
