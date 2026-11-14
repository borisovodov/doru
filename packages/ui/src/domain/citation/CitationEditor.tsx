import { Button } from '../../atoms/button/Button';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import type { CitationRecord } from '@doru/core';
import { nls } from '../../nls';
import { citationDraftToRecord, citationToDraft, type CitationDraft } from './citationDraft';
import { DateEditor } from '../date/DateEditor';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { Input } from '../../atoms/form/Input';
import { Textarea } from '../../atoms/form/Textarea';
import { ReorderButtons } from '../../atoms/reorder-buttons/ReorderButtons';
import { moveItem } from '../reorder';
import { emptySourceTextDraft, type SourceTextDraft, type TemplateFieldDraft } from '../source/sourceDraft';
import './CitationEditor.css';

/** The full citation form, shown inline under a cited source in the person's sources section. */
export function CitationEditor({
  citation,
  attachments,
  onSave,
  onCancel,
}: {
  citation: CitationRecord;
  attachments?: ReactNode;
  onSave: (citation: CitationRecord) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CitationDraft>(() => citationToDraft(citation));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<CitationDraft>) => setDraft({ ...draft, ...patch });

  const patchText = (index: number, values: Partial<SourceTextDraft>) =>
    set({ texts: draft.texts.map((text, i) => (i === index ? { ...text, ...values } : text)) });
  const addText = () => set({ texts: [...draft.texts, emptySourceTextDraft()] });
  const removeText = (index: number) => set({ texts: draft.texts.filter((_, i) => i !== index) });

  const patchField = (index: number, values: Partial<TemplateFieldDraft>) =>
    set({ templateFields: draft.templateFields.map((field, i) => (i === index ? { ...field, ...values } : field)) });
  const addField = () =>
    set({ templateFields: [...draft.templateFields, { id: crypto.randomUUID(), name: '', value: '' }] });
  const removeField = (index: number) => set({ templateFields: draft.templateFields.filter((_, i) => i !== index) });

  const save = async () => {
    setSaving(true);
    try {
      await onSave(citationDraftToRecord(draft));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="citation-editor">
      <FieldGrid columns={2}>
        <Field label={nls.t('features.tree.citation.page')}>
          <Input value={draft.page} onChange={(event) => set({ page: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.quality')}>
          <Input value={draft.quality} onChange={(event) => set({ quality: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.description')}>
          <Input value={draft.description} onChange={(event) => set({ description: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.confidence')}>
          <Input value={draft.confidence} onChange={(event) => set({ confidence: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.event')}>
          <Input value={draft.event} onChange={(event) => set({ event: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.role')}>
          <Input value={draft.role} onChange={(event) => set({ role: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.phrase')}>
          <Input value={draft.phrase} onChange={(event) => set({ phrase: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.www')}>
          <Input value={draft.www} onChange={(event) => set({ www: event.target.value })} />
        </Field>
      </FieldGrid>
      <DateEditor
        label={nls.t('features.tree.citation.date')}
        value={draft.date}
        onChange={(date) => set({ date })}
        hidePlace
      />

      <div className="citation-subsection">
        <h4>{nls.t('features.tree.citation.texts')}</h4>
        {draft.texts.map((text, index) => (
          <div className="citation-text-block" key={text.id}>
            <Textarea
              value={text.text}
              placeholder={nls.t('features.tree.citation.texts')}
              onChange={(event) => patchText(index, { text: event.target.value })}
            />
            <div className="citation-sub-row">
              <Input
                placeholder={nls.t('features.tree.source.texts.language')}
                value={text.language}
                onChange={(event) => patchText(index, { language: event.target.value })}
              />
              <Input
                placeholder={nls.t('features.tree.source.texts.mime')}
                value={text.mime}
                onChange={(event) => patchText(index, { mime: event.target.value })}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.source.texts.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => removeText(index)}
              />
            </div>
          </div>
        ))}
        <Button variant="primary" size="sm" onClick={addText}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.texts.add')}
        </Button>
      </div>

      <div className="citation-subsection">
        <h4>{nls.t('features.tree.citation.templateFields')}</h4>
        {draft.templateFields.map((field, index) => (
          <div className="citation-sub-row" key={field.id}>
            <Input
              placeholder={nls.t('features.tree.source.templateFields.name')}
              value={field.name}
              onChange={(event) => patchField(index, { name: event.target.value })}
            />
            <Input
              placeholder={nls.t('features.tree.source.templateFields.value')}
              value={field.value}
              onChange={(event) => patchField(index, { value: event.target.value })}
            />
            <ReorderButtons
              upLabel={nls.t('features.tree.reorder.up')}
              downLabel={nls.t('features.tree.reorder.down')}
              canMoveUp={index > 0}
              canMoveDown={index < draft.templateFields.length - 1}
              onMoveUp={() => set({ templateFields: moveItem(draft.templateFields, index, index - 1) })}
              onMoveDown={() => set({ templateFields: moveItem(draft.templateFields, index, index + 1) })}
            />
            <IconButton
              size="sm"
              label={nls.t('features.tree.source.templateFields.remove')}
              icon={<X size={13} aria-hidden="true" />}
              onClick={() => removeField(index)}
            />
          </div>
        ))}
        <Button variant="primary" size="sm" onClick={addField}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.templateFields.add')}
        </Button>
      </div>

      {attachments}

      <div className="citation-actions">
        <Button variant="primary" disabled={saving} onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {nls.t('features.tree.fact.cancel')}
        </Button>
      </div>
    </div>
  );
}
