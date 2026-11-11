import { useState } from 'react';
import { X } from 'lucide-react';
import type { TagLinkRecord, TagRecord } from '@doru/core';
import { nls } from '../nls';
import './AttachmentsSection.css';

/** The tags attached to the person, with create-and-attach. */
export function TagsSection({
  personId,
  tags,
  tagLinks,
  onAddTag,
  onAttachTag,
  onDetachTag,
}: {
  personId: string;
  tags: TagRecord[];
  tagLinks: Array<{ tagId: string; link: TagLinkRecord }>;
  onAddTag: (tag: TagRecord) => Promise<void>;
  onAttachTag: (link: TagLinkRecord) => Promise<void>;
  onDetachTag: (link: TagLinkRecord) => Promise<void>;
}) {
  const [input, setInput] = useState('');
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
    await onAttachTag({ id: crypto.randomUUID(), tagId: tag.id, targetType: 'person', targetId: personId });
    setInput('');
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.tags.title')}</h3>
      {tagLinks.length === 0 && <p className="notes-empty">{nls.t('features.tree.tags.empty')}</p>}
      <div className="tag-chips">
        {tagLinks.map(({ tagId, link }) => (
          <span key={link.id} className="tag-chip">
            {byId.get(tagId)?.name ?? tagId}
            <button className="icon-button" title={nls.t('features.tree.tags.detach')} onClick={() => void onDetachTag(link)}>
              <X size={12} aria-hidden="true" />
            </button>
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
