import type { CitationRecord } from '@doru/core';
import { fromDateDraft, toDateDraft, type DateDraft } from '../person/draft';

/**
 * The editable form of a citation (a source cited at some target). The
 * target pair is fixed — citations are edited in place, never re-attached
 * here.
 */
export interface CitationDraft {
  id: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  page: string;
  text: string;
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
}

export function citationToDraft(citation: CitationRecord): CitationDraft {
  return {
    id: citation.id,
    sourceId: citation.sourceId,
    targetType: citation.targetType,
    targetId: citation.targetId,
    page: citation.page ?? '',
    text: citation.text ?? '',
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
  };
}

/** Builds the citation record for a save; an empty text is dropped. */
export function citationDraftToRecord(draft: CitationDraft, existing?: CitationRecord): CitationRecord {
  return {
    id: draft.id,
    sourceId: draft.sourceId,
    targetType: draft.targetType,
    targetId: draft.targetId,
    page: draft.page.trim() || undefined,
    text: draft.text.trim() || undefined,
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
  };
}
