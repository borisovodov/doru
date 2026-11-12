import { useMemo, type ReactNode } from 'react';
import { BookOpenText } from 'lucide-react';
import type { CitationRecord, FactRecord, FamilyRecord, NoteRecord, PersonRecord, SourceRecord } from '@doru/core';
import { nls } from '../nls';
import { displayName, familyLabel } from '@doru/ui/domain';
import { EditorPage, EntityCard } from '@doru/ui';
import './sidebar.css';

/**
 * The read-only information under the source editor: the records citing
 * this source and its notes.
 */
export function SourceCitationsList({
  source,
  persons,
  families,
  facts,
  citations,
  notes,
  onOpenPerson,
}: {
  source: SourceRecord;
  persons: PersonRecord[];
  families: FamilyRecord[];
  facts: FactRecord[];
  citations: CitationRecord[];
  notes: NoteRecord[];
  onOpenPerson: (personId: string) => void;
}) {
  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);
  const familyById = useMemo(() => new Map(families.map((family) => [family.id, family])), [families]);

  const citing = citations.filter((citation) => citation.sourceId === source.id);
  const sourceNotes = notes.filter((note) => note.targetType === 'source' && note.targetId === source.id);

  return (
    <>
      <section className="entity-section">
        <h3>{nls.t('features.sources.citedIn')}</h3>
        {citing.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.sources.empty')}</p>
        ) : (
          <ul className="entity-section-list">
            {citing.map((citation) => {
              const target = citationTarget(citation, personById, familyById, facts, persons);
              return (
                <li key={citation.id}>
                  <EntityCard
                    icon={<BookOpenText size={15} aria-hidden="true" />}
                    title={target.label}
                    subtitle={citation.page !== undefined ? citation.page : null}
                    meta={citation.quality !== undefined ? citation.quality : null}
                    {...(target.personId !== undefined ? { onClick: () => onOpenPerson(target.personId ?? '') } : {})}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="entity-section">
        <h3>{nls.t('features.tree.notes.title')}</h3>
        {sourceNotes.length === 0 ? (
          <p className="entity-empty">{nls.t('features.tree.notes.empty')}</p>
        ) : (
          <ul className="entity-section-list">
            {sourceNotes.map((note) => (
              <li key={note.id} className="entity-card">
                <span className="entity-card-body">
                  <span className="entity-note-text">{note.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** The target record a citation points at, with its display label and open action. */
function citationTarget(
  citation: CitationRecord,
  personById: Map<string, PersonRecord>,
  familyById: Map<string, FamilyRecord>,
  facts: FactRecord[],
  persons: PersonRecord[],
): { label: string; personId?: string | undefined } {
  if (citation.targetType === 'person') {
    const person = personById.get(citation.targetId);
    return { label: person ? displayName(person) : citation.targetId, personId: citation.targetId };
  }
  if (citation.targetType === 'family') {
    const family = familyById.get(citation.targetId);
    return {
      label: family ? familyLabel(family, personById) : citation.targetId,
      personId: family?.partners[0],
    };
  }
  if (citation.targetType === 'fact') {
    const fact = facts.find((entry) => entry.id === citation.targetId);
    if (fact) {
      if (fact.personId !== undefined) {
        return { label: displayName(personById.get(fact.personId)), personId: fact.personId };
      }
      const family = fact.familyId !== undefined ? familyById.get(fact.familyId) : undefined;
      return { label: family ? familyLabel(family, personById) : citation.targetId, personId: family?.partners[0] };
    }
  }
  if (citation.targetType === 'name') {
    const owner = persons.find((person) => person.names.some((name) => name.id === citation.targetId));
    return { label: owner ? displayName(owner) : citation.targetId, personId: owner?.id };
  }
  return { label: citation.targetId };
}

/** Wraps a list in the editor page shell (used by the source tab). */
export function EntityTab({ children }: { children: ReactNode }) {
  return <EditorPage>{children}</EditorPage>;
}
