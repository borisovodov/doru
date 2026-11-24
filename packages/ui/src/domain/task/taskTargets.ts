import type {
  AddressRecord,
  AssociationRecord,
  CitationRecord,
  FactRecord,
  FamilyRecord,
  MediaRecord,
  NoteRecord,
  PersonName,
  PersonRecord,
  PlaceRecord,
  RepositoryRecord,
  SourceRecord,
  SubmitterRecord,
  TitleRecord,
  TaskRecord,
} from '@doru/core';
import { placeName, TARGET_TYPES } from '@doru/core/model';

/**
 * The target types a task can be linked to. Sources, other tasks, submitters
 * and notes are excluded: a citation or a task-to-task chain would duplicate
 * the research record, a task is not a contribution to a submitter's record,
 * and a note is only a citation target, never an attachment host.
 */
export const TASK_TARGET_TYPES = TARGET_TYPES.filter(
  (type) => type !== 'source' && type !== 'task' && type !== 'submitter' && type !== 'note',
);
import { displayName, factOwnerName, familyLabel, formatAddress, formatDate } from '../format/format';

/** Everything the task editor needs to offer a target of every supported type. */
export interface TaskTargetData {
  persons: PersonRecord[];
  families: FamilyRecord[];
  sources: SourceRecord[];
  places: PlaceRecord[];
  repositories: RepositoryRecord[];
  titles: TitleRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  media: MediaRecord[];
  submitters: SubmitterRecord[];
  addresses: AddressRecord[];
  associations: AssociationRecord[];
  tasks: TaskRecord[];
}

export interface TaskTargetOption {
  id: string;
  label: string;
}

/** The universal target directory shape used by every target picker. */
export type TargetData = TaskTargetData;

/** One searchable option of the universal picker, carrying its target type. */
export interface TargetOption extends TaskTargetOption {
  type: string;
}

/** Flatten the options of several target types for a grouped picker. */
export function targetOptionsForTypes(types: readonly string[], data: TaskTargetData): TargetOption[] {
  return types.flatMap((type) => taskTargetOptions(type, data).map((option) => ({ ...option, type })));
}

/** The non-empty target-type groups of a picker, in the supplied order. */
export function targetGroups(
  types: readonly string[],
  data: TaskTargetData,
): Array<{ type: string; options: TaskTargetOption[] }> {
  return types
    .map((type) => ({ type, options: taskTargetOptions(type, data) }))
    .filter((group) => group.options.length > 0);
}

/** The options of one target type; an unknown/unsupported type has none. */
export function taskTargetOptions(type: string, data: TaskTargetData): TaskTargetOption[] {
  const personById = new Map(data.persons.map((person) => [person.id, person]));
  const familyById = new Map(data.families.map((family) => [family.id, family]));
  const sourceById = new Map(data.sources.map((source) => [source.id, source]));

  switch (type) {
    case 'person':
      return data.persons.map((person) => ({ id: person.id, label: displayName(person) }));
    case 'family':
      return data.families.map((family) => ({ id: family.id, label: familyLabel(family, personById) }));
    case 'family_partner':
      return data.families.flatMap((family) =>
        (family.partnerLinks ?? []).map((link) => ({
          id: link.id,
          label: `${familyLabel(family, personById)} · ${displayName(personById.get(link.personId))}`,
        })),
      );
    case 'family_child':
      return data.families.flatMap((family) =>
        (family.childLinks ?? []).map((link) => ({
          id: link.id,
          label: `${familyLabel(family, personById)} · ${displayName(personById.get(link.childId))}`,
        })),
      );
    case 'family_marriage_status':
      return data.families.flatMap((family) =>
        (family.marriageStatuses ?? []).map((status) => ({
          id: status.id,
          label: `${familyLabel(family, personById)} · ${status.status}`,
        })),
      );
    case 'fact':
      return data.facts.map((fact) => ({
        id: fact.id,
        label: [
          fact.type !== undefined ? `${fact.tag} (${fact.type})` : fact.tag,
          fact.date !== undefined ? formatDate(fact.date) : '',
          factOwnerName(fact, personById, familyById),
        ]
          .filter((part) => part !== '')
          .join(' · '),
      }));
    case 'name':
      return data.persons.flatMap((person) => nameOptions(person));
    case 'name_part':
      return data.persons.flatMap((person) =>
        person.names.flatMap((name) =>
          (name.parts ?? []).map((part) => ({
            id: part.id,
            label: `${displayName(person)} · ${nameLabel(name)} · ${part.kind}`,
          })),
        ),
      );
    case 'source':
      return data.sources.map((source) => ({ id: source.id, label: source.title ?? source.id }));
    case 'citation':
      return data.citations.map((citation) => ({
        id: citation.id,
        label: `${sourceById.get(citation.sourceId)?.title ?? citation.sourceId} · ${citation.targetType}`,
      }));
    case 'note':
      return data.notes.map((note) => ({ id: note.id, label: truncate(note.text) }));
    case 'media':
      return data.media.map((media) => ({ id: media.id, label: mediaLabel(media) }));
    case 'media_file':
      return data.media.flatMap((media) =>
        (media.files ?? []).map((file) => ({
          id: file.id,
          label: `${mediaLabel(media)} · ${file.title ?? file.path}`,
        })),
      );
    case 'media_link': {
      const labelFor = createTaskTargetLabeler(data, false);
      return data.media.flatMap((media) =>
        (media.links ?? []).map((link) => ({
          id: link.id,
          label: `${mediaLabel(media)} · ${labelFor(link.targetType, link.targetId)}`,
        })),
      );
    }
    case 'place':
      return data.places.map((place) => ({ id: place.id, label: placeName(place) }));
    case 'place_name':
      return data.places.flatMap((place) =>
        place.names.map((name) => ({
          id: name.id,
          label: `${placeName(place)} · ${name.value}`,
        })),
      );
    case 'place_hierarchy':
      return data.places.flatMap((place) =>
        (place.hierarchy ?? []).map((link) => {
          const parent = data.places.find((entry) => entry.id === link.parentId);
          return {
            id: link.id,
            label: `${placeName(place)} · ${parent ? placeName(parent) : link.parentId}`,
          };
        }),
      );
    case 'repository':
      return data.repositories.map((repository) => ({ id: repository.id, label: repository.name }));
    case 'submitter':
      return data.submitters.map((submitter) => ({ id: submitter.id, label: submitter.name }));
    case 'address':
      return data.addresses.map((address) => ({ id: address.id, label: formatAddress(address) || address.id }));
    case 'address_line':
      return data.addresses.flatMap((address) =>
        address.lines.map((line) => ({
          id: line.id,
          label: [formatAddress(address), line.value].filter((part) => part !== '').join(' · '),
        })),
      );
    case 'association':
      return data.associations.map((association) => {
        const family = association.familyId !== undefined ? familyById.get(association.familyId) : undefined;
        const owner =
          association.personId !== undefined
            ? displayName(personById.get(association.personId))
            : family !== undefined
              ? familyLabel(family, personById)
              : (association.familyId ?? '');
        return {
          id: association.id,
          label: [
            `${owner} ↔ ${displayName(personById.get(association.otherPersonId))}`,
            association.role ?? '',
            association.relationship ?? '',
          ]
            .filter((part) => part !== '')
            .join(' · '),
        };
      });
    case 'task':
      return data.tasks.map((task) => ({ id: task.id, label: truncate(task.text) }));
    case 'title':
      return data.titles.map((title) => ({ id: title.id, label: title.name ?? title.id }));
    default:
      return [];
  }
}

/** A human-readable label for a target id, falling back to the raw pair. */
export function taskTargetLabel(type: string, id: string, data: TaskTargetData): string {
  return createTaskTargetLabeler(data)(type, id);
}

/**
 * A label lookup that builds each target type's options at most once. Use it
 * for lists with many references instead of calling taskTargetLabel per row.
 */
export function createTaskTargetLabeler(
  data: TaskTargetData,
  resolveMediaLinks = true,
): (type: string, id: string) => string {
  const byType = new Map<string, Map<string, string>>();
  return (type, id) => {
    if (type === 'media_link' && !resolveMediaLinks) {
      return `media_link:${id}`;
    }
    let byId = byType.get(type);
    if (byId === undefined) {
      byId = new Map(taskTargetOptions(type, data).map((option) => [option.id, option.label]));
      byType.set(type, byId);
    }
    return byId.get(id) ?? `${type}:${id}`;
  };
}

function nameOptions(person: PersonRecord): TaskTargetOption[] {
  const options: TaskTargetOption[] = [];
  const visit = (name: PersonName): void => {
    options.push({ id: name.id, label: `${displayName(person)} · ${nameLabel(name)}` });
    for (const variant of name.variants ?? []) {
      visit(variant);
    }
  };
  for (const name of person.names) {
    visit(name);
  }
  return options;
}

function nameLabel(name: PersonName): string {
  if (name.full !== undefined) {
    const full = name.full.replace(/\//g, '').trim();
    if (full !== '') {
      return full;
    }
  }
  const pieces = [name.given, name.surname].filter((part): part is string => part !== undefined && part !== '');
  return pieces.length > 0 ? pieces.join(' ') : name.id;
}

function mediaLabel(media: MediaRecord): string {
  return media.title ?? media.path ?? media.id;
}

function truncate(text: string): string {
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}
