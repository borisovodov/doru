import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import type { TagLinkRecord, TagRecord, TargetRef } from '@doru/core';
import { foldCase, TARGET_TYPES } from '@doru/core/model';
import { nls } from '../../nls';
import { TargetPicker } from '../targets';
import '../attachments/AttachmentsSection.css';

/**
 * The tags attached to the person, with create-and-attach. A tag name
 * click renames the tag (everywhere it is used); the trash removes the
 * tag from the whole tree, links included.
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
  onAttachTagToTargets,
  onDetachTag,
}: {
  targetType: string;
  targetId: string;
  tags: TagRecord[];
  tagLinks: Array<{ tagId: string; link: TagLinkRecord }>;
  onAddTag: (tag: TagRecord) => Promise<void>;
  onUpdateTag: (before: TagRecord, after: TagRecord) => Promise<void>;
  onDeleteTag: (tag: TagRecord) => Promise<void>;
  onAttachTag: (link: TagLinkRecord) => Promise<void>;
  onAttachTagToTargets?: ((tagId: string, targets: TargetRef[]) => Promise<void>) | undefined;
  onDetachTag: (link: TagLinkRecord) => Promise<void>;
}) {
  const [input, setInput] = useState('');
  const [extraTargets, setExtraTargets] = useState<TargetRef[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  // Guards the rename against double commits (Enter followed by the
  // input's blur, or Escape followed by the unmount blur).
  const renameDoneRef = useRef(false);
  const byId = new Map(tags.map((tag) => [tag.id, tag]));

  const attach = async () => {
    const name = input.trim();
    if (name === '') {
      return;
    }
    let tag = tags.find((entry) => foldCase(entry.name) === foldCase(name));
    if (!tag) {
      tag = { id: crypto.randomUUID(), name };
      await onAddTag(tag);
    }
    const targets = [{ targetType, targetId }, ...extraTargets];
    if (onAttachTagToTargets !== undefined) {
      await onAttachTagToTargets(tag.id, targets);
    } else {
      await onAttachTag({ id: crypto.randomUUID(), tagId: tag.id, targetType, targetId });
    }
    setInput('');
    setExtraTargets([]);
  };

  const startRename = (tag: TagRecord) => {
    renameDoneRef.current = false;
    setEditingId(tag.id);
    setEditValue(tag.name);
  };

  const commitRename = async (tagId: string) => {
    if (renameDoneRef.current) {
      return;
    }
    renameDoneRef.current = true;
    const tag = byId.get(tagId);
    const name = editValue.trim();
    if (tag !== undefined && name !== '' && name !== tag.name) {
      await onUpdateTag(tag, { ...tag, name });
    }
    setEditingId(null);
  };

  const cancelRename = () => {
    renameDoneRef.current = true;
    setEditingId(null);
  };

  return (
    <SectionCard title={nls.t('features.tree.tags.title')}>
      {tagLinks.length === 0 && <EmptyText>{nls.t('features.tree.tags.empty')}</EmptyText>}
      <div className="tag-chips">
        {tagLinks.map(({ tagId, link }) => (
          <span className="tag-link" key={link.id}>
            <span className="tag-chip">
              {editingId === tagId ? (
                <Input
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
                  type="button"
                  className="tag-chip-name"
                  title={nls.t('features.tree.tags.rename')}
                  onClick={() => startRename(byId.get(tagId) ?? { id: tagId, name: tagId })}
                >
                  {byId.get(tagId)?.name ?? tagId}
                </button>
              )}
              <IconButton
                size="sm"
                label={nls.t('features.tree.tags.detach')}
                icon={<X size={12} aria-hidden="true" />}
                onClick={() => void onDetachTag(link)}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.tags.delete')}
                icon={<Trash2 size={12} aria-hidden="true" />}
                onClick={() => {
                  const tag = byId.get(tagId);
                  if (tag !== undefined) {
                    void onDeleteTag(tag);
                  }
                }}
              />
            </span>
          </span>
        ))}
      </div>
      {onAttachTagToTargets !== undefined && (
        <TargetPicker
          allowedTypes={TARGET_TYPES}
          value={extraTargets}
          onChange={setExtraTargets}
          ariaLabel={nls.t('features.tasks.target')}
        />
      )}
      <div className="attachment-add">
        <Input
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
        <Button variant="primary" onClick={() => void attach()}>
          {nls.t('features.tree.tags.attach')}
        </Button>
      </div>
    </SectionCard>
  );
}
