import type { CitationRecord } from '@doru/core';
import { fromDateDraft, toDateDraft, type DateDraft } from './draft';
import type { SourceTextDraft, TemplateFieldDraft } from '../source/sourceDraft';

/**
 * The editable form of a citation (a source cited at some target). The
 * target pair is fixed — citations are edited in place, never re-attached
 * here. Texts and template fields share the source sub-drafts.
 */
export interface CitationDraft {
  id: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  page: string;
  quality: string;
  description: string;
  confidence: string;
  event: string;
  role: string;
  phrase: string;
  www: string;
  date: DateDraft;
  texts: SourceTextDraft[];
  templateFields: TemplateFieldDraft[];
}

export function citationToDraft(citation: CitationRecord): CitationDraft {
  return {
    id: citation.id,
    sourceId: citation.sourceId,
    targetType: citation.targetType,
    targetId: citation.targetId,
    page: citation.page ?? '',
    quality: citation.quality ?? '',
    description: citation.description ?? '',
    confidence: citation.confidence ?? '',
    event: citation.event ?? '',
    role: citation.role ?? '',
    phrase: citation.phrase ?? '',
    www: citation.www ?? '',
    date: toDateDraft(citation.date),
    texts: (citation.texts ?? []).map((text) => ({
      id: text.id,
      text: text.text,
      mime: text.mime ?? '',
      language: text.language ?? '',
    })),
    templateFields: (citation.templateFields ?? []).map((field) => ({
      id: field.id,
      name: field.name,
      value: field.value ?? '',
    })),
  };
}

/** Builds the citation record for a save; empty texts and fields are dropped. */
export function citationDraftToRecord(draft: CitationDraft): CitationRecord {
  return {
    id: draft.id,
    sourceId: draft.sourceId,
    targetType: draft.targetType,
    targetId: draft.targetId,
    page: draft.page.trim() || undefined,
    quality: draft.quality.trim() || undefined,
    description: draft.description.trim() || undefined,
    confidence: draft.confidence.trim() || undefined,
    event: draft.event.trim() || undefined,
    role: draft.role.trim() || undefined,
    phrase: draft.phrase.trim() || undefined,
    www: draft.www.trim() || undefined,
    date: fromDateDraft(draft.date),
    texts: draft.texts
      .filter((text) => text.text.trim() !== '')
      .map((text) => ({
        id: text.id,
        text: text.text.trim(),
        mime: text.mime.trim() || undefined,
        language: text.language.trim() || undefined,
      })),
    templateFields: draft.templateFields
      .filter((field) => field.name.trim() !== '')
      .map((field) => ({
        id: field.id,
        name: field.name.trim(),
        ...(field.value.trim() !== '' ? { value: field.value.trim() } : {}),
      })),
  };
}
