import { useState } from 'react';
import { X } from 'lucide-react';
import type { FactRecord } from '@doru/core';
import { nls } from '../nls';
import { DateEditor } from './DateEditor';
import { emptyDate, fromDateDraft, type DateDraft } from './draft';
import { formatDate } from './format';
import './EventsSection.css';

const EVENT_TYPES = ['BIRT', 'DEAT', 'BURI', 'MARR', 'RESI', 'OCCU', 'EMIG', 'IMMI', 'CENS', 'CHR', 'BAPM'];

export function EventsSection({
  personId,
  events: facts,
  refresh,
  onAddFact,
  onDeleteFact,
}: {
  personId: string;
  events: FactRecord[];
  refresh: () => Promise<void>;
  onAddFact: (fact: FactRecord) => Promise<void>;
  onDeleteFact: (fact: FactRecord) => Promise<void>;
}) {
  const [type, setType] = useState('');
  const [date, setDate] = useState<DateDraft>(emptyDate());
  const [description, setDescription] = useState('');

  const add = async () => {
    const trimmed = type.trim().toUpperCase();
    if (!trimmed) {
      return;
    }
    const fact: FactRecord = {
      id: crypto.randomUUID(),
      personId,
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
              <span className="event-type">{fact.tag}</span>
              <span className="event-date">
                {fact.date ? formatDate(fact.date) : ''}
                {fact.place ? ` — ${fact.place}` : ''}
              </span>
              {fact.value ? <span className="event-description">{fact.value}</span> : null}
              <button title={nls.t('features.tree.events.remove')} onClick={() => void remove(fact)}>
                <X size={14} aria-hidden="true" />
              </button>
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
        <button onClick={() => void add()}>{nls.t('features.tree.events.add')}</button>
      </div>
    </div>
  );
}
