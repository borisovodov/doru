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
  TaskRecord,
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
  clean.links = (media.links ?? []).filter((link) => attachmentTargetExists(ctx, link.targetType, link.targetId));
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

export function restoreTask(ctx: MutationContext, task: TaskRecord): void {
  ctx.repo.insertTask({
    ...task,
    targets: task.targets.filter((link) => attachmentTargetExists(ctx, link.targetType, link.targetId)),
  });
}

export function restoreTitle(ctx: MutationContext, title: TitleRecord): void {
  const clean: TitleRecord = { ...title };
  if (clean.repositoryId !== undefined && ctx.repo.getRepository(clean.repositoryId) === undefined) {
    delete clean.repositoryId;
  }
  ctx.repo.insertTitle(clean);
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
  if (
    ctx.repo.getSubmitter(link.submitterId) === undefined ||
    !attachmentTargetExists(ctx, link.targetType, link.targetId)
  ) {
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
  const direct = (snapshot: AttachmentsSnapshot): unknown => ({
    notes: snapshot.notes.map((entry) => JSON.stringify(entry)).sort(),
    citations: snapshot.citations.map((entry) => JSON.stringify(entry)).sort(),
    mediaLinks: snapshot.mediaLinks
      .map((entry) => {
        const { targetType: _targetType, targetId: _targetId, links: _links, ...media } = entry.media;
        return [JSON.stringify(entry.link), JSON.stringify(media)];
      })
      .sort(),
    contacts: snapshot.contacts.map((entry) => JSON.stringify(entry)).sort(),
    taskLinks: snapshot.taskLinks.map((entry) => JSON.stringify(entry)).sort(),
    recordSubmitters: snapshot.recordSubmitters.map((entry) => JSON.stringify(entry)).sort(),
  });
  const flatten = (snapshot: AttachmentsSnapshot, rootKey: string): string => {
    const records = new Map<string, string>();
    const edges: string[] = [];
    const walk = (node: AttachmentsSnapshot, key: string): void => {
      if (records.has(key)) {
        return;
      }
      records.set(key, JSON.stringify(direct(node)));
      for (const nested of [...node.citationAttachments, ...node.mediaAttachments]) {
        const childKey = `${nested.targetType}\u0000${nested.targetId}`;
        edges.push(`${key}>${childKey}`);
        walk(nested.attachments, childKey);
      }
    };
    walk(snapshot, rootKey);
    return JSON.stringify({
      records: [...records.entries()].sort(([left], [right]) => left.localeCompare(right)),
      edges: edges.sort(),
    });
  };
  const key = `${targetType}\u0000${targetId}`;
  return flatten(ctx.repo.listAttachmentsFor(targetType, targetId), key) === flatten(captured, key);
}

/** True when the stored row still equals the record captured before its delete. */
export function sameRecord(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Whether a captured nested attachment target still exists to restore onto. */
export function attachmentTargetExists(ctx: MutationContext, targetType: string, targetId: string): boolean {
  const names = (): string[] => {
    const result: string[] = [];
    const visit = (name: PersonName): void => {
      result.push(name.id);
      for (const variant of name.variants ?? []) {
        visit(variant);
      }
    };
    for (const person of ctx.repo.listAllPersons()) {
      person.names.forEach(visit);
    }
    return result;
  };
  const parts = (): string[] =>
    ctx.repo.listAllPersons().flatMap((person) =>
      person.names.flatMap((name) => {
        const result: string[] = [];
        const visit = (entry: PersonName): void => {
          result.push(...(entry.parts ?? []).map((part) => part.id));
          for (const variant of entry.variants ?? []) {
            visit(variant);
          }
        };
        visit(name);
        return result;
      }),
    );
  switch (targetType) {
    case 'person':
      return ctx.repo.getPerson(targetId) !== undefined;
    case 'family':
      return ctx.repo.getFamily(targetId) !== undefined;
    case 'fact':
      return ctx.repo.getFact(targetId) !== undefined;
    case 'place':
      return ctx.repo.getPlace(targetId) !== undefined;
    case 'media':
      return ctx.repo.getMedia(targetId) !== undefined;
    case 'task':
      return ctx.repo.getTask(targetId) !== undefined;
    case 'source':
      return ctx.repo.getSource(targetId) !== undefined;
    case 'repository':
      return ctx.repo.getRepository(targetId) !== undefined;
    case 'submitter':
      return ctx.repo.getSubmitter(targetId) !== undefined;
    case 'address':
      return ctx.repo.getAddress(targetId) !== undefined;
    case 'citation':
      return ctx.repo.getCitation(targetId) !== undefined;
    case 'title':
      return ctx.repo.getTitle(targetId) !== undefined;
    case 'name':
      return names().includes(targetId);
    case 'name_part':
      return parts().includes(targetId);
    case 'family_partner':
    case 'family_child':
    case 'family_marriage_status':
      return ctx.repo
        .listFamilies()
        .some((family) =>
          [
            ...(family.partnerLinks ?? []).map((link) => link.id),
            ...(family.childLinks ?? []).map((link) => link.id),
            ...(family.marriageStatuses ?? []).map((status) => status.id),
          ].includes(targetId),
        );
    case 'place_name':
    case 'place_hierarchy':
      return ctx.repo
        .listPlaces()
        .some((place) =>
          [...place.names.map((name) => name.id), ...(place.hierarchy ?? []).map((link) => link.id)].includes(targetId),
        );
    case 'address_line':
      return ctx.repo.listAddresses().some((address) => address.lines.some((line) => line.id === targetId));
    case 'association':
      return ctx.repo.listAssociations().some((entry) => entry.id === targetId);
    default:
      return false;
  }
}
