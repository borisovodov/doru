import type {
  AssociationRecord,
  AttachmentsSnapshot,
  CensusRecord,
  DuplicateCandidateRecord,
  EvidenceRecord,
  OrdinanceRecord,
  ResearchActivityRecord,
  ResearchDocumentRecord,
  TitleRecord,
  TodoRecord,
} from '../model/types';
import { emptyAttachments } from '../model/types';
import type { Op } from './op';

function op(id: string, kind: string, apply: Op['apply'], inverse: Op['inverse'], change?: Op['change']): Op {
  return { id, kind, timestamp: new Date().toISOString(), ...(change ? { change } : {}), apply, inverse };
}

export function addAssociationOp(association: AssociationRecord): Op {
  return op(
    crypto.randomUUID(),
    'association.add',
    (ctx) => ctx.repo.insertAssociation(association),
    (ctx) => ctx.repo.deleteAssociation(association.id),
    { targetType: 'association', targetId: association.id, kind: 'created' },
  );
}

export function updateAssociationOp(before: AssociationRecord, after: AssociationRecord): Op {
  return op(
    crypto.randomUUID(),
    'association.update',
    (ctx) => ctx.repo.updateAssociation(after),
    (ctx) => ctx.repo.updateAssociation(before),
    { targetType: 'association', targetId: before.id, kind: 'changed' },
  );
}

export function deleteAssociationOp(
  association: AssociationRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
): Op {
  return op(
    crypto.randomUUID(),
    'association.delete',
    (ctx) => ctx.repo.deleteAssociation(association.id),
    (ctx) => {
      ctx.repo.insertAssociation(association);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addAliasOp(id: string, personId: string, aliasId: string): Op {
  return op(
    crypto.randomUUID(),
    'alias.add',
    (ctx) => ctx.repo.insertAlias(id, personId, aliasId),
    (ctx) => ctx.repo.deleteAlias(id),
    { targetType: 'person', targetId: personId, kind: 'changed' },
  );
}

export function deleteAliasOp(id: string, personId: string, aliasId: string): Op {
  return op(
    crypto.randomUUID(),
    'alias.delete',
    (ctx) => ctx.repo.deleteAlias(id),
    (ctx) => ctx.repo.insertAlias(id, personId, aliasId),
  );
}

export function addOrdinanceOp(ordinance: OrdinanceRecord): Op {
  return op(
    crypto.randomUUID(),
    'ordinance.add',
    (ctx) => ctx.repo.insertOrdinance(ordinance),
    (ctx) => ctx.repo.deleteOrdinance(ordinance.id),
    { targetType: 'ordinance', targetId: ordinance.id, kind: 'created' },
  );
}

export function updateOrdinanceOp(before: OrdinanceRecord, after: OrdinanceRecord): Op {
  return op(
    crypto.randomUUID(),
    'ordinance.update',
    (ctx) => ctx.repo.updateOrdinance(after),
    (ctx) => ctx.repo.updateOrdinance(before),
    { targetType: 'ordinance', targetId: before.id, kind: 'changed' },
  );
}

export function deleteOrdinanceOp(
  ordinance: OrdinanceRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
): Op {
  return op(
    crypto.randomUUID(),
    'ordinance.delete',
    (ctx) => ctx.repo.deleteOrdinance(ordinance.id),
    (ctx) => {
      ctx.repo.insertOrdinance(ordinance);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addTodoOp(todo: TodoRecord): Op {
  return op(
    crypto.randomUUID(),
    'todo.add',
    (ctx) => ctx.repo.insertTodo(todo),
    (ctx) => ctx.repo.deleteTodo(todo.id),
    { targetType: 'todo', targetId: todo.id, kind: 'created' },
  );
}

export function updateTodoOp(before: TodoRecord, after: TodoRecord): Op {
  return op(
    crypto.randomUUID(),
    'todo.update',
    (ctx) => ctx.repo.updateTodo(after),
    (ctx) => ctx.repo.updateTodo(before),
    { targetType: 'todo', targetId: before.id, kind: 'changed' },
  );
}

export function deleteTodoOp(todo: TodoRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
  return op(
    crypto.randomUUID(),
    'todo.delete',
    (ctx) => ctx.repo.deleteTodo(todo.id),
    (ctx) => {
      ctx.repo.insertTodo(todo);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addEvidenceOp(evidence: EvidenceRecord): Op {
  return op(
    crypto.randomUUID(),
    'evidence.add',
    (ctx) => ctx.repo.insertEvidence(evidence),
    (ctx) => ctx.repo.deleteEvidence(evidence.id),
    { targetType: 'evidence', targetId: evidence.id, kind: 'created' },
  );
}

export function updateEvidenceOp(before: EvidenceRecord, after: EvidenceRecord): Op {
  return op(
    crypto.randomUUID(),
    'evidence.update',
    (ctx) => ctx.repo.updateEvidence(after),
    (ctx) => ctx.repo.updateEvidence(before),
    { targetType: 'evidence', targetId: before.id, kind: 'changed' },
  );
}

export function deleteEvidenceOp(
  evidence: EvidenceRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
): Op {
  return op(
    crypto.randomUUID(),
    'evidence.delete',
    (ctx) => ctx.repo.deleteEvidence(evidence.id),
    (ctx) => {
      ctx.repo.insertEvidence(evidence);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addResearchDocumentOp(document: ResearchDocumentRecord): Op {
  return op(
    crypto.randomUUID(),
    'research_document.add',
    (ctx) => ctx.repo.insertResearchDocument(document),
    (ctx) => ctx.repo.deleteResearchDocument(document.id),
    { targetType: 'research_document', targetId: document.id, kind: 'created' },
  );
}

export function updateResearchDocumentOp(before: ResearchDocumentRecord, after: ResearchDocumentRecord): Op {
  return op(
    crypto.randomUUID(),
    'research_document.update',
    (ctx) => ctx.repo.updateResearchDocument(after),
    (ctx) => ctx.repo.updateResearchDocument(before),
    { targetType: 'research_document', targetId: before.id, kind: 'changed' },
  );
}

export function deleteResearchDocumentOp(
  document: ResearchDocumentRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
): Op {
  return op(
    crypto.randomUUID(),
    'research_document.delete',
    (ctx) => ctx.repo.deleteResearchDocument(document.id),
    (ctx) => {
      ctx.repo.insertResearchDocument(document);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addResearchActivityOp(activity: ResearchActivityRecord): Op {
  return op(
    crypto.randomUUID(),
    'research_activity.add',
    (ctx) => ctx.repo.insertResearchActivity(activity),
    (ctx) => ctx.repo.deleteResearchActivity(activity.id),
    { targetType: 'research_activity', targetId: activity.id, kind: 'created' },
  );
}

export function updateResearchActivityOp(before: ResearchActivityRecord, after: ResearchActivityRecord): Op {
  return op(
    crypto.randomUUID(),
    'research_activity.update',
    (ctx) => ctx.repo.updateResearchActivity(after),
    (ctx) => ctx.repo.updateResearchActivity(before),
    { targetType: 'research_activity', targetId: before.id, kind: 'changed' },
  );
}

export function deleteResearchActivityOp(
  activity: ResearchActivityRecord,
  attachments: AttachmentsSnapshot = emptyAttachments(),
): Op {
  return op(
    crypto.randomUUID(),
    'research_activity.delete',
    (ctx) => ctx.repo.deleteResearchActivity(activity.id),
    (ctx) => {
      ctx.repo.insertResearchActivity(activity);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addCensusOp(census: CensusRecord): Op {
  return op(
    crypto.randomUUID(),
    'census.add',
    (ctx) => ctx.repo.insertCensus(census),
    (ctx) => ctx.repo.deleteCensus(census.id),
    { targetType: 'census', targetId: census.id, kind: 'created' },
  );
}

export function updateCensusOp(before: CensusRecord, after: CensusRecord): Op {
  return op(
    crypto.randomUUID(),
    'census.update',
    (ctx) => ctx.repo.updateCensus(after),
    (ctx) => ctx.repo.updateCensus(before),
    { targetType: 'census', targetId: before.id, kind: 'changed' },
  );
}

export function deleteCensusOp(census: CensusRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
  return op(
    crypto.randomUUID(),
    'census.delete',
    (ctx) => ctx.repo.deleteCensus(census.id),
    (ctx) => {
      ctx.repo.insertCensus(census);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}

export function addDuplicateOp(duplicate: DuplicateCandidateRecord): Op {
  return op(
    crypto.randomUUID(),
    'duplicate.add',
    (ctx) => ctx.repo.insertDuplicate(duplicate),
    (ctx) => ctx.repo.deleteDuplicate(duplicate.id),
    { targetType: 'duplicate_candidate', targetId: duplicate.id, kind: 'created' },
  );
}

export function updateDuplicateOp(before: DuplicateCandidateRecord, after: DuplicateCandidateRecord): Op {
  return op(
    crypto.randomUUID(),
    'duplicate.update',
    (ctx) => ctx.repo.updateDuplicate(after),
    (ctx) => ctx.repo.updateDuplicate(before),
    { targetType: 'duplicate_candidate', targetId: before.id, kind: 'changed' },
  );
}

export function deleteDuplicateOp(duplicate: DuplicateCandidateRecord): Op {
  return op(
    crypto.randomUUID(),
    'duplicate.delete',
    (ctx) => ctx.repo.deleteDuplicate(duplicate.id),
    (ctx) => ctx.repo.insertDuplicate(duplicate),
  );
}

export function addTitleOp(title: TitleRecord): Op {
  return op(
    crypto.randomUUID(),
    'title.add',
    (ctx) => ctx.repo.insertTitle(title),
    (ctx) => ctx.repo.deleteTitle(title.id),
    { targetType: 'title', targetId: title.id, kind: 'created' },
  );
}

export function updateTitleOp(before: TitleRecord, after: TitleRecord): Op {
  return op(
    crypto.randomUUID(),
    'title.update',
    (ctx) => ctx.repo.updateTitle(after),
    (ctx) => ctx.repo.updateTitle(before),
    { targetType: 'title', targetId: before.id, kind: 'changed' },
  );
}

export function deleteTitleOp(title: TitleRecord, attachments: AttachmentsSnapshot = emptyAttachments()): Op {
  return op(
    crypto.randomUUID(),
    'title.delete',
    (ctx) => ctx.repo.deleteTitle(title.id),
    (ctx) => {
      ctx.repo.insertTitle(title);
      ctx.repo.restoreAttachments(attachments);
    },
  );
}
