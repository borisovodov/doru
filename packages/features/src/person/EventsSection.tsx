import { useState } from 'react';
import type { EventRecord } from '@doru/core';
import { nls } from '../nls';
import { DateEditor } from './DateEditor';
import { emptyDate, fromDateDraft, type DateDraft } from './draft';
import { formatDate } from './format';

const EVENT_TYPES = ['BIRT', 'DEAT', 'BURI', 'MARR', 'RESI', 'OCCU', 'EMIG', 'IMMI', 'CENS', 'CHR', 'BAPM'];

export function EventsSection({
  events,
  refresh,
  onAddEvent,
  onDeleteEvent,
}: {
  events: EventRecord[];
  refresh: () => Promise<void>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
}) {
  const [type, setType] = useState('');
  const [date, setDate] = useState<DateDraft>(emptyDate());
  const [description, setDescription] = useState('');

  const add = async () => {
    const trimmed = type.trim().toUpperCase();
    if (!trimmed) {
      return;
    }
    const event: EventRecord = {
      id: crypto.randomUUID(),
      type: trimmed,
      date: fromDateDraft(date),
      description: description.trim() || undefined,
    };
    await onAddEvent(event);
    setType('');
    setDate(emptyDate());
    setDescription('');
    await refresh();
  };

  const remove = async (event: EventRecord) => {
    await onDeleteEvent(event);
    await refresh();
  };

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.events.title')}</h3>
      {events.length === 0 ? (
        <p className="notes-empty">{nls.t('features.tree.events.empty')}</p>
      ) : (
        <ul className="event-list">
          {events.map((event) => (
            <li key={event.id}>
              <span className="event-type">{event.type}</span>
              <span className="event-date">
                {event.date ? formatDate(event.date) : ''}
                {event.place ? ` — ${event.place}` : ''}
              </span>
              {event.description ? <span className="event-description">{event.description}</span> : null}
              <button title={nls.t('features.tree.events.remove')} onClick={() => void remove(event)}>
                ×
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
