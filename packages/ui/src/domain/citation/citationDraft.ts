import type { CitationRecord } from '@doru/core';
import { fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';
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
  name: string;
  qualityAssessment: string;
  reference: string;
  abbreviation: string;
  footnote: string;
  verified: boolean;
  assessment: string;
  foundBy: string;
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
    name: citation.name ?? '',
    qualityAssessment: citation.qualityAssessment ?? '',
    reference: citation.reference ?? '',
    abbreviation: citation.abbreviation ?? '',
    footnote: citation.footnote ?? '',
    verified: citation.verified === true,
    assessment: citation.assessment ?? '',
    foundBy: citation.foundBy ?? '',
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
export function citationDraftToRecord(draft: CitationDraft, existing?: CitationRecord): CitationRecord {
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
    name: draft.name.trim() || undefined,
    qualityAssessment: draft.qualityAssessment.trim() || undefined,
    reference: draft.reference.trim() || undefined,
    abbreviation: draft.abbreviation.trim() || undefined,
    footnote: draft.footnote.trim() || undefined,
    verified: draft.verified || undefined,
    assessment: draft.assessment.trim() || undefined,
    foundBy: draft.foundBy.trim() || undefined,
    date: fromDateDraft(draft.date, existing?.date),
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
