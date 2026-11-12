import { Button } from '../../atoms/button/Button';
import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import type { AddressRecord, FactRecord, PersonRecord, PlaceRecord } from '@doru/core';
import { nls } from '../../nls';
import { DateEditor } from '../date/DateEditor';
import { emptyDate, fromDateDraft, type DateDraft } from '../person/draft';
import { EVENT_TYPES } from './factDraft';
import { FactEditor } from './FactEditor';
import { formatDate } from '../format/format';
import './FactsSection.css';

/** The owner of the facts edited here: a person or a family. */
export type FactOwner = { personId: string; familyId?: undefined } | { familyId: string; personId?: undefined };

export function FactsSection({
  owner,
  events: facts,
  persons,
  places,
  addresses,
  refresh,
  onAddFact,
  onUpdateFact,
  onDeleteFact,
}: {
  owner: FactOwner;
  events: FactRecord[];
  persons: PersonRecord[];
  places: PlaceRecord[];
  addresses: AddressRecord[];
  refresh: () => Promise<void>;
  onAddFact: (fact: FactRecord) => Promise<void>;
  onUpdateFact: (before: FactRecord, after: FactRecord) => Promise<void>;
  onDeleteFact: (fact: FactRecord) => Promise<void>;
}) {
  const [type, setType] = useState('');
  const [date, setDate] = useState<DateDraft>(emptyDate());
  const [description, setDescription] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const add = async () => {
    const trimmed = type.trim().toUpperCase();
    if (!trimmed) {
      return;
    }
    const fact: FactRecord = {
      id: crypto.randomUUID(),
      personId: owner.personId,
      familyId: owner.familyId,
      tag: trimmed,
      date: fromDateDraft(date),
      place: date.place.trim() || undefined,
      value: description.trim() || undefined,
    };
    await onAddFact(fact);
    setType('');
    setDate(emptyDate());
    setDescription('');
    await refresh();
  };

  const remove = async (fact: FactRecord) => {
    await onDeleteFact(fact);
    if (expandedId === fact.id) {
      setExpandedId(null);
    }
    await refresh();
  };

  const save = async (before: FactRecord, after: FactRecord) => {
    await onUpdateFact(before, after);
    setExpandedId(null);
    await refresh();
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.events.title')}</h3>
      {facts.length === 0 ? (
        <p className="notes-empty">{nls.t('features.tree.events.empty')}</p>
      ) : (
        <ul className="event-list">
          {facts.map((fact) => (
            <li key={fact.id}>
              <div
                className={`event-row${expandedId === fact.id ? ' expanded' : ''}`}
                onClick={() => setExpandedId(expandedId === fact.id ? null : fact.id)}
              >
                <span className="event-chevron" aria-hidden="true">
                  {expandedId === fact.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <span className="event-type">{fact.type ? `${fact.tag} · ${fact.type}` : fact.tag}</span>
                <span className="event-date">
                  {fact.date ? formatDate(fact.date) : ''}
                  {fact.place ? ` — ${fact.place}` : ''}
                </span>
                {fact.value ? <span className="event-description">{fact.value}</span> : null}
                {fact.negation === true && <span className="event-negation">{nls.t('features.tree.fact.negation')}</span>}
                <button
                  title={nls.t('features.tree.events.remove')}
                  onClick={(event) => {
                    event.stopPropagation();
                    void remove(fact);
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
              {expandedId === fact.id && (
                <FactEditor
                  fact={fact}
                  persons={persons}
                  places={places}
                  addresses={addresses}
                  onSave={(next) => save(fact, next)}
                  onCancel={() => setExpandedId(null)}
                  onDelete={(deleted) => remove(deleted)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="events-add">
        <input
          className="event-type-input"
          list="doru-event-types"
          placeholder={nls.t('features.tree.events.typeField')}
          value={type}
          onChange={(event) => setType(event.target.value)}
        />
        <datalist id="doru-event-types">
          {EVENT_TYPES.map((eventType) => (
            <option key={eventType} value={eventType} />
          ))}
        </datalist>
        <DateEditor label={nls.t('features.tree.events.dateField')} value={date} onChange={setDate} />
        <input
          placeholder={nls.t('features.tree.events.descriptionField')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Button variant="primary" onClick={() => void add()}>
          {nls.t('features.tree.events.add')}
        </Button>
      </div>
    </div>
  );
}
