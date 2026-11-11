import { useRef, useState } from 'react';
import { CalendarDays, Trash2, X } from 'lucide-react';
import type { TagLinkRecord, TagRecord } from '@doru/core';
import { nls } from '../nls';
import { DateEditor } from './DateEditor';
import { emptyDate, fromDateDraft, toDateDraft, type DateDraft } from './draft';
import { formatDate } from './format';
import './AttachmentsSection.css';

/**
 * The tags attached to the person, with create-and-attach. A tag name
 * click renames the tag (everywhere it is used); the trash removes the
 * tag from the whole tree, links included. The calendar button edits the
 * attachment date of the link.
 */
export function TagsSection({
  targetType,
  targetId,
  tags,
  tagLinks,
  onAddTag,
  onUpdateTag,
  onDeleteTag,
  onAttachTag,
  onDetachTag,
  onUpdateTagLink,
}: {
  targetType: string;
  targetId: string;
  tags: TagRecord[];
  tagLinks: Array<{ tagId: string; link: TagLinkRecord }>;
  onAddTag: (tag: TagRecord) => Promise<void>;
  onUpdateTag: (before: TagRecord, after: TagRecord) => Promise<void>;
  onDeleteTag: (tag: TagRecord) => Promise<void>;
  onAttachTag: (link: TagLinkRecord) => Promise<void>;
  onDetachTag: (link: TagLinkRecord) => Promise<void>;
  onUpdateTagLink: (before: TagLinkRecord, after: TagLinkRecord) => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [dateDraft, setDateDraft] = useState<DateDraft>(emptyDate());
  // Guards the rename against double commits (Enter followed by the
  // input's blur, or Escape followed by the unmount blur).
  const renameDone = useRef(false);
  const byId = new Map(tags.map((tag) => [tag.id, tag]));

  const attach = async () => {
    const name = input.trim();
    if (name === '') {
      return;
    }
    let tag = tags.find((entry) => entry.name.toLowerCase() === name.toLowerCase());
    if (!tag) {
      tag = { id: crypto.randomUUID(), name };
      await onAddTag(tag);
    }
    await onAttachTag({ id: crypto.randomUUID(), tagId: tag.id, targetType, targetId });
    setInput('');
  };

  const startRename = (tag: TagRecord) => {
    renameDone.current = false;
    setEditingId(tag.id);
    setEditValue(tag.name);
  };

  const commitRename = async (tagId: string) => {
    if (renameDone.current) {
      return;
    }
    renameDone.current = true;
    const tag = byId.get(tagId);
    const name = editValue.trim();
    if (tag !== undefined && name !== '' && name !== tag.name) {
      await onUpdateTag(tag, { ...tag, name });
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    renameDone.current = true;
    setEditingId(null);
  };

  const startDateEdit = (link: TagLinkRecord) => {
    setEditingDateId(link.id);
    setDateDraft(toDateDraft(link.date));
  };

  const saveDateEdit = async (link: TagLinkRecord) => {
    const date = fromDateDraft(dateDraft);
    if (link.date !== date) {
      await onUpdateTagLink(link, { ...link, date });
    }
    setEditingDateId(null);
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.tags.title')}</h3>
      {tagLinks.length === 0 && <p className="notes-empty">{nls.t('features.tree.tags.empty')}</p>}
      <div className="tag-chips">
        {tagLinks.map(({ tagId, link }) => (
          <span className="tag-link" key={link.id}>
            <span className="tag-chip">
              {editingId === tagId ? (
                <input
                  className="tag-rename-input"
                  value={editValue}
                  autoFocus
                  onChange={(event) => setEditValue(event.target.value)}
                  onBlur={() => void commitRename(tagId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void commitRename(tagId);
                    } else if (event.key === 'Escape') {
                      cancelRename();
                    }
                  }}
                />
              ) : (
                <button
                  className="tag-chip-name"
                  title={nls.t('features.tree.tags.rename')}
                  onClick={() => startRename(byId.get(tagId) ?? { id: tagId, name: tagId })}
                >
                  {byId.get(tagId)?.name ?? tagId}
                </button>
              )}
              {link.date !== undefined && <span className="tag-chip-date">{formatDate(link.date)}</span>}
              <button
                className="icon-button"
                title={nls.t('features.tree.tags.date.edit')}
                onClick={() => startDateEdit(link)}
              >
                <CalendarDays size={12} aria-hidden="true" />
              </button>
              <button className="icon-button" title={nls.t('features.tree.tags.detach')} onClick={() => void onDetachTag(link)}>
                <X size={12} aria-hidden="true" />
              </button>
              <button
                className="icon-button"
                title={nls.t('features.tree.tags.delete')}
                onClick={() => {
                  const tag = byId.get(tagId);
                  if (tag !== undefined) {
                    void onDeleteTag(tag);
                  }
                }}
              >
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </span>
            {editingDateId === link.id && (
              <span className="tag-date-editor">
                <DateEditor
                  label={nls.t('features.tree.tags.date')}
                  value={dateDraft}
                  onChange={setDateDraft}
                  hidePlace
                />
                <button className="add-button small" onClick={() => void saveDateEdit(link)}>
                  {nls.t('features.tree.save')}
                </button>
                <button className="plain-button small" onClick={() => setEditingDateId(null)}>
                  {nls.t('features.tree.fact.cancel')}
                </button>
              </span>
            )}
          </span>
        ))}
      </div>
      <div className="attachment-add">
        <input
          list="doru-tag-names"
          placeholder={nls.t('features.tree.tags.newTag')}
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
        <datalist id="doru-tag-names">
          {tags.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
        <button className="add-button" onClick={() => void attach()}>
          {nls.t('features.tree.tags.attach')}
        </button>
      </div>
    </div>
  );
}
