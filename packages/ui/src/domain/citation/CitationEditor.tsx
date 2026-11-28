import { Button } from '../../atoms/button/Button';
import { Checkbox } from '../../atoms/form/Checkbox';
import { useState, type ReactNode } from 'react';
import type { CitationRecord } from '@doru/core';
import { nls } from '../../nls';
import { citationDraftToRecord, citationToDraft, type CitationDraft } from './citationDraft';
import { DateEditor } from '../date/DateEditor';
import { Field } from '../../atoms/field/Field';
import { FieldGrid } from '../../atoms/field-grid/FieldGrid';
import { Input } from '../../atoms/form/Input';
import { Textarea } from '../../atoms/form/Textarea';
import './CitationEditor.css';

/** The full citation form, shown inline under a cited source in the person's sources section. */
export function CitationEditor({
  citation,
  attachments,
  onSave,
  onDelete,
  onCancel,
}: {
  citation: CitationRecord;
  attachments?: ReactNode;
  onSave: (citation: CitationRecord) => Promise<void>;
  onDelete?: (() => Promise<void>) | undefined;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CitationDraft>(() => citationToDraft(citation));
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<CitationDraft>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      await onSave(citationDraftToRecord(draft, citation));
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
        <Field label={nls.t('features.tree.citation.name')}>
          <Input value={draft.name} onChange={(event) => set({ name: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.qualityAssessment')}>
          <Input value={draft.qualityAssessment} onChange={(event) => set({ qualityAssessment: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.reference')}>
          <Input value={draft.reference} onChange={(event) => set({ reference: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.source.abbreviation')}>
          <Input value={draft.abbreviation} onChange={(event) => set({ abbreviation: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.assessment')}>
          <Input value={draft.assessment} onChange={(event) => set({ assessment: event.target.value })} />
        </Field>
        <Field label={nls.t('features.tree.citation.foundBy')}>
          <Input value={draft.foundBy} onChange={(event) => set({ foundBy: event.target.value })} />
        </Field>
      </FieldGrid>
      <Field label={nls.t('features.tree.citation.description')}>
        <Textarea rows={2} value={draft.description} onChange={(event) => set({ description: event.target.value })} />
      </Field>
      <Field label={nls.t('features.tree.citation.footnote')}>
        <Textarea rows={3} value={draft.footnote} onChange={(event) => set({ footnote: event.target.value })} />
      </Field>
      <Checkbox
        label={nls.t('features.tree.citation.verified')}
        checked={draft.verified}
        onChange={(event) => set({ verified: event.target.checked })}
      />
      <DateEditor
        label={nls.t('features.tree.citation.date')}
        value={draft.date}
        onChange={(date) => set({ date })}
        hidePlace
      />

      <Field label={nls.t('features.tree.citation.texts')}>
        <Textarea rows={3} value={draft.text} onChange={(event) => set({ text: event.target.value })} />
      </Field>

      {attachments}

      <div className="citation-actions">
        <Button variant="primary" disabled={saving} onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {nls.t('features.tree.fact.cancel')}
        </Button>
        {onDelete !== undefined && (
          <Button
            variant="danger"
            onClick={() => {
              void onDelete();
            }}
          >
            {nls.t('features.tree.fact.delete')}
          </Button>
        )}
      </div>
    </div>
  );
}
