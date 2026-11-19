import type {
  AssociationRecord,
  AttachmentsSnapshot,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  PersonName,
  PlaceRecord,
  PersonRecord,
  SourceRecord,
  TitleRecord,
  TodoRecord,
} from '../model/types';
import type { MutationContext } from './op';

/**
 * Undo runs against a tree that may have changed since the snapshot was
 * taken. Rows referencing a target deleted by another writer would trip a
 * foreign key and abort the whole inverse, losing everything else in the
 * same undo step. These helpers drop only the dangling references: the row
 * itself and its attachments still come back, matching how the forward
 * deletes leave the surviving fields intact.
 */

function sanitizeNames(names: PersonName[]): PersonName[] {
  return names.map((name) => ({
    ...name,
    ...(name.variants !== undefined ? { variants: sanitizeNames(name.variants) } : {}),
  }));
}

/** The owner being restored in the same call is not stored yet when facts are sanitized. */
interface RestoringOwner {
  personId?: string;
  familyId?: string;
}

/** Drops fact references (place, address, family links, participants) whose rows are gone. */
export function sanitizeFactForRestore(
  ctx: MutationContext,
  fact: FactRecord,
  owner: RestoringOwner = {},
): FactRecord | undefined {
  if (
    fact.personId !== undefined &&
    fact.personId !== owner.personId &&
    ctx.repo.getPerson(fact.personId) === undefined
  ) {
    return undefined;
  }
  if (
    fact.familyId !== undefined &&
    fact.familyId !== owner.familyId &&
    ctx.repo.getFamily(fact.familyId) === undefined
  ) {
    return undefined;
  }
  const clean: FactRecord = { ...fact };
  if (clean.placeId !== undefined && ctx.repo.getPlace(clean.placeId) === undefined) {
    delete clean.placeId;
  }
  if (clean.addressId !== undefined && ctx.repo.getAddress(clean.addressId) === undefined) {
    delete clean.addressId;
  }
  if (clean.additionalPlaceIds !== undefined) {
    const places = clean.additionalPlaceIds.filter((id) => ctx.repo.getPlace(id) !== undefined);
    if (places.length > 0) {
      clean.additionalPlaceIds = places;
    } else {
      delete clean.additionalPlaceIds;
    }
  }
  if (clean.familyLinks !== undefined) {
    const links = clean.familyLinks.filter((link) => ctx.repo.getFamily(link.familyId) !== undefined);
    if (links.length > 0) {
      clean.familyLinks = links;
    } else {
      delete clean.familyLinks;
    }
  }
  if (clean.participants !== undefined) {
    clean.participants = clean.participants.map((participant) => {
      if (
        participant.personId === undefined ||
        participant.personId === owner.personId ||
        ctx.repo.getPerson(participant.personId) !== undefined
      ) {
        return participant;
      }
      const { personId: _personId, ...rest } = participant;
      return rest;
    });
  }
  return clean;
}

export function restoreFact(ctx: MutationContext, fact: FactRecord, owner: RestoringOwner = {}): boolean {
  const clean = sanitizeFactForRestore(ctx, fact, owner);
  if (clean === undefined) {
    return false;
  }
  ctx.repo.insertFact(clean);
  return true;
}

export function restorePerson(ctx: MutationContext, person: PersonRecord): void {
  const clean: PersonRecord = { ...person, names: sanitizeNames(person.names) };
  if (clean.addressId !== undefined && ctx.repo.getAddress(clean.addressId) === undefined) {
    delete clean.addressId;
  }
  clean.facts = person.facts.flatMap((fact) => {
    const restored = sanitizeFactForRestore(ctx, fact, { personId: person.id });
    return restored === undefined ? [] : [restored];
  });
  ctx.repo.insertPerson(clean);
}

export function restorePlace(ctx: MutationContext, place: PlaceRecord): void {
  const clean: PlaceRecord = { ...place };
  if (clean.hierarchy !== undefined) {
    const links = clean.hierarchy.filter((link) => ctx.repo.getPlace(link.parentId) !== undefined);
    if (links.length > 0) {
      clean.hierarchy = links;
    } else {
      delete clean.hierarchy;
    }
  }
  ctx.repo.insertPlace(clean);
}

export function restoreFamily(ctx: MutationContext, family: FamilyRecord): void {
  const clean: FamilyRecord = { ...family };
  if (clean.marriageStatuses !== undefined) {
    clean.marriageStatuses = clean.marriageStatuses.map((status) => {
      if (status.placeId === undefined || ctx.repo.getPlace(status.placeId) !== undefined) {
        return status;
      }
      const { placeId: _placeId, ...rest } = status;
      return rest;
    });
  }
  ctx.repo.insertFamily(clean);
}

export function restoreMedia(ctx: MutationContext, media: MediaRecord): void {
  const clean: MediaRecord = { ...media };
  if (clean.placeId !== undefined && ctx.repo.getPlace(clean.placeId) === undefined) {
    delete clean.placeId;
  }
  ctx.repo.insertMedia(clean);
}

export function restoreSource(ctx: MutationContext, source: SourceRecord): void {
  const clean: SourceRecord = { ...source };
  if (clean.titleId !== undefined && ctx.repo.getTitle(clean.titleId) === undefined) {
    delete clean.titleId;
  }
  if (clean.dataEvents !== undefined) {
    clean.dataEvents = clean.dataEvents.map((event) => {
      if (event.placeId === undefined || ctx.repo.getPlace(event.placeId) !== undefined) {
        return event;
      }
      const { placeId: _placeId, ...rest } = event;
      return rest;
    });
  }
  if (clean.repositories !== undefined) {
    const links = clean.repositories.filter((link) => ctx.repo.getRepository(link.repositoryId) !== undefined);
    if (links.length > 0) {
      clean.repositories = links;
    } else {
      delete clean.repositories;
    }
  }
  ctx.repo.insertSource(clean);
}

export function restoreCitation(ctx: MutationContext, citation: CitationRecord): boolean {
  if (ctx.repo.getSource(citation.sourceId) === undefined) {
    return false;
  }
  if (!attachmentTargetExists(ctx, citation.targetType, citation.targetId)) {
    return false;
  }
  ctx.repo.insertCitation(citation);
  return true;
}

export function restoreAssociation(ctx: MutationContext, association: AssociationRecord): boolean {
  if (ctx.repo.getPerson(association.otherPersonId) === undefined) {
    return false;
  }
  if (association.personId !== undefined && ctx.repo.getPerson(association.personId) === undefined) {
    return false;
  }
  if (association.familyId !== undefined && ctx.repo.getFamily(association.familyId) === undefined) {
    return false;
  }
  ctx.repo.insertAssociation(association);
  return true;
}

export function restoreAlias(ctx: MutationContext, id: string, personId: string, aliasId: string): boolean {
  if (ctx.repo.getPerson(personId) === undefined || ctx.repo.getPerson(aliasId) === undefined) {
    return false;
  }
  ctx.repo.insertAlias(id, personId, aliasId);
  return true;
}

export function restoreTodo(ctx: MutationContext, todo: TodoRecord): void {
  const clean: TodoRecord = { ...todo };
  if (clean.repositoryId !== undefined && ctx.repo.getRepository(clean.repositoryId) === undefined) {
    delete clean.repositoryId;
  }
  ctx.repo.insertTodo(clean);
}

export function restoreTitle(ctx: MutationContext, title: TitleRecord): void {
  const clean: TitleRecord = { ...title };
  if (clean.repositoryId !== undefined && ctx.repo.getRepository(clean.repositoryId) === undefined) {
    delete clean.repositoryId;
  }
  ctx.repo.insertTitle(clean);
}

export function restoreTagLink(
  ctx: MutationContext,
  link: { id: string; tagId: string; targetType: string; targetId: string },
): boolean {
  if (!ctx.repo.listTags().some((tag) => tag.id === link.tagId)) {
    return false;
  }
  ctx.repo.insertTagLink(link);
  return true;
}

export function restoreRecordSubmitter(
  ctx: MutationContext,
  link: {
    id: string;
    submitterId: string;
    targetType: string;
    targetId: string;
    kind?: 'contributor' | 'ancestor_interest' | 'descendant_interest' | undefined;
  },
): boolean {
  if (ctx.repo.getSubmitter(link.submitterId) === undefined) {
    return false;
  }
  ctx.repo.insertRecordSubmitter(link.id, link.submitterId, link.targetType, link.targetId, link.kind);
  return true;
}

export function restoreSourceRepository(
  ctx: MutationContext,
  link: {
    id: string;
    sourceId: string;
    repositoryId: string;
    callNumbers?: Array<{ id: string; value: string; medium?: string }>;
  },
): boolean {
  if (ctx.repo.getSource(link.sourceId) === undefined || ctx.repo.getRepository(link.repositoryId) === undefined) {
    return false;
  }
  ctx.repo.restoreSourceRepository(link);
  return true;
}

/** True when the target carries exactly the attachments captured before its delete. */
export function attachmentsMatch(
  ctx: MutationContext,
  targetType: string,
  targetId: string,
  captured: AttachmentsSnapshot,
): boolean {
  const signature = (snapshot: AttachmentsSnapshot, seen: Set<string>): unknown => {
    const nested = [
      ...snapshot.noteAttachments,
      ...snapshot.citationAttachments,
      ...snapshot.mediaAttachments,
      ...snapshot.mediaFileAttachments,
      ...snapshot.mediaLinkAttachments,
      ...snapshot.todoAttachments,
    ].map((entry) => {
      const key = `${entry.targetType}\u0000${entry.targetId}`;
      if (seen.has(key)) {
        return [entry.targetType, entry.targetId, 'cycle'];
      }
      const next = new Set(seen);
      next.add(key);
      return [entry.targetType, entry.targetId, signature(entry.attachments, next)];
    });
    return {
      noteLinks: snapshot.noteLinks
        .map((entry) => [entry.link.id, JSON.stringify({ ...entry.note, links: undefined })])
        .sort(),
      citations: snapshot.citations.map((entry) => JSON.stringify(entry)).sort(),
      mediaLinks: snapshot.mediaLinks
        .map((entry) => [JSON.stringify(entry.link), JSON.stringify({ ...entry.media, links: undefined })])
        .sort(),
      identifiers: snapshot.identifiers.map((entry) => JSON.stringify(entry)).sort(),
      contacts: snapshot.contacts.map((entry) => JSON.stringify(entry)).sort(),
      restrictions: snapshot.restrictions.map((entry) => JSON.stringify(entry)).sort(),
      tagLinks: snapshot.tagLinks.map((entry) => JSON.stringify(entry.link)).sort(),
      todos: snapshot.todos.map((entry) => JSON.stringify(entry)).sort(),
      recordSubmitters: snapshot.recordSubmitters.map((entry) => JSON.stringify(entry)).sort(),
      nested,
    };
  };
  const key = `${targetType}\u0000${targetId}`;
  return (
    JSON.stringify(signature(ctx.repo.listAttachmentsFor(targetType, targetId), new Set([key]))) ===
    JSON.stringify(signature(captured, new Set([key])))
  );
}

/** True when the stored row still equals the record captured before its delete. */
export function sameRecord(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Whether a captured nested attachment target still exists to restore onto. */
export function attachmentTargetExists(ctx: MutationContext, targetType: string, targetId: string): boolean {
  switch (targetType) {
    case 'fact':
      return ctx.repo.getFact(targetId) !== undefined;
    case 'person_sex':
      return ctx.repo.getPerson(targetId) !== undefined;
    case 'citation':
      return ctx.repo.getCitation(targetId) !== undefined;
    case 'media_file':
      return ctx.repo.hasMediaFile(targetId);
    case 'media_link':
      return ctx.repo.hasMediaLink(targetId);
    case 'association':
      return ctx.repo.listAssociations().some((entry) => entry.id === targetId);
    case 'person':
      return ctx.repo.getPerson(targetId) !== undefined;
    case 'place':
      return ctx.repo.getPlace(targetId) !== undefined;
    case 'media':
      return ctx.repo.getMedia(targetId) !== undefined;
    case 'note':
      return ctx.repo.getNote(targetId) !== undefined;
    case 'todo':
      return ctx.repo.getTodo(targetId) !== undefined;
    case 'source':
      return ctx.repo.getSource(targetId) !== undefined;
    case 'repository':
      return ctx.repo.getRepository(targetId) !== undefined;
    case 'submitter':
      return ctx.repo.getSubmitter(targetId) !== undefined;
    case 'address':
      return ctx.repo.getAddress(targetId) !== undefined;
    default:
      return true;
  }
}
