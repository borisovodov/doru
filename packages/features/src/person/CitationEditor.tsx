import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { CitationRecord } from '@doru/core';
import { nls } from '../nls';
import { citationDraftToRecord, citationToDraft, type CitationDraft } from '@doru/ui';
import { DateEditor } from '@doru/ui';
import { emptySourceTextDraft, type SourceTextDraft, type TemplateFieldDraft } from '@doru/ui';
import './CitationEditor.css';

/** The full citation form, shown inline under a cited source in the person's sources section. */
export function CitationEditor({
  citation,
  onSave,
  onCancel,
}: {
  citation: CitationRecord;
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
  const addField = () => set({ templateFields: [...draft.templateFields, { id: crypto.randomUUID(), name: '', value: '' }] });
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
      <div className="citation-grid">
        <label>
          {nls.t('features.tree.citation.page')}
          <input value={draft.page} onChange={(event) => set({ page: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.citation.quality')}
          <input value={draft.quality} onChange={(event) => set({ quality: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.citation.description')}
          <input value={draft.description} onChange={(event) => set({ description: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.citation.confidence')}
          <input value={draft.confidence} onChange={(event) => set({ confidence: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.citation.event')}
          <input value={draft.event} onChange={(event) => set({ event: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.citation.role')}
          <input value={draft.role} onChange={(event) => set({ role: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.citation.phrase')}
          <input value={draft.phrase} onChange={(event) => set({ phrase: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.citation.www')}
          <input value={draft.www} onChange={(event) => set({ www: event.target.value })} />
        </label>
      </div>
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
            <textarea
              value={text.text}
              placeholder={nls.t('features.tree.citation.texts')}
              onChange={(event) => patchText(index, { text: event.target.value })}
            />
            <div className="citation-sub-row">
              <input
                placeholder={nls.t('features.tree.source.texts.language')}
                value={text.language}
                onChange={(event) => patchText(index, { language: event.target.value })}
              />
              <input
                placeholder={nls.t('features.tree.source.texts.mime')}
                value={text.mime}
                onChange={(event) => patchText(index, { mime: event.target.value })}
              />
              <button
                className="icon-button"
                title={nls.t('features.tree.source.texts.remove')}
                onClick={() => removeText(index)}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        <button className="add-button small" onClick={addText}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.texts.add')}
        </button>
      </div>

      <div className="citation-subsection">
        <h4>{nls.t('features.tree.citation.templateFields')}</h4>
        {draft.templateFields.map((field, index) => (
          <div className="citation-sub-row" key={field.id}>
            <input
              placeholder={nls.t('features.tree.source.templateFields.name')}
              value={field.name}
              onChange={(event) => patchField(index, { name: event.target.value })}
            />
            <input
              placeholder={nls.t('features.tree.source.templateFields.value')}
              value={field.value}
              onChange={(event) => patchField(index, { value: event.target.value })}
            />
            <button
              className="icon-button"
              title={nls.t('features.tree.source.templateFields.remove')}
              onClick={() => removeField(index)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button className="add-button small" onClick={addField}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.source.templateFields.add')}
        </button>
      </div>

      <div className="citation-actions">
        <button className="add-button" disabled={saving} onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </button>
        <button className="plain-button" onClick={onCancel}>
          {nls.t('features.tree.fact.cancel')}
        </button>
      </div>
    </div>
  );
}
