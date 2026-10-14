import { useEffect, useState } from 'react';
import type { EventRecord, FamilyRecord, PersonRecord } from '@doru/core';
import { nls } from '../nls';
import { DateEditor } from './DateEditor';
import { emptyDate, fromDateDraft, type DateDraft } from './draft';
import { displayName, formatDate } from './format';
import './FamilySection.css';

interface FamilySectionProps {
  personId: string;
  persons: PersonRecord[];
  families: FamilyRecord[];
  refresh: () => Promise<void>;
  onAddFamily: (family: FamilyRecord) => Promise<void>;
  onUpdateFamily: (before: FamilyRecord, after: FamilyRecord) => Promise<void>;
  onDeleteFamily: (family: FamilyRecord) => Promise<void>;
  getEvents: (personId?: string, familyId?: string) => Promise<EventRecord[]>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
}

export function FamilySection({
  personId,
  persons,
  families,
  refresh,
  onAddFamily,
  onUpdateFamily,
  onDeleteFamily,
  getEvents,
  onAddEvent,
  onDeleteEvent,
}: FamilySectionProps) {
  const asChild = families.filter((family) => family.children.includes(personId));
  const asParent = families.filter((family) => family.parents.includes(personId));

  const addFamily = async (kind: 'child' | 'parent') => {
    await onAddFamily({
      id: crypto.randomUUID(),
      parents: kind === 'parent' ? [personId] : [],
      children: kind === 'child' ? [personId] : [],
    });
    await refresh();
  };

  const removeMember = async (family: FamilyRecord, memberId: string) => {
    const after: FamilyRecord = {
      ...family,
      parents: family.parents.filter((id) => id !== memberId),
      children: family.children.filter((id) => id !== memberId),
    };
    await onUpdateFamily(family, after);
    await refresh();
  };

  const addMember = async (family: FamilyRecord, role: 'parent' | 'child', memberId: string) => {
    const after: FamilyRecord = {
      ...family,
      parents: role === 'parent' ? [...family.parents, memberId] : family.parents,
      children: role === 'child' ? [...family.children, memberId] : family.children,
    };
    await onUpdateFamily(family, after);
    await refresh();
  };

  const deleteFamily = async (family: FamilyRecord) => {
    await onDeleteFamily(family);
    await refresh();
  };

  const cardProps = (family: FamilyRecord) => ({
    family,
    personId,
    persons,
    onRemoveMember: (memberId: string) => void removeMember(family, memberId),
    onAddMember: (role: 'parent' | 'child', memberId: string) => void addMember(family, role, memberId),
    onDelete: () => void deleteFamily(family),
    getEvents,
    onAddEvent,
    onDeleteEvent,
  });

  return (
    <div className="person-section">
      <h3>{nls.t('features.tree.families.title')}</h3>
      {asChild.length === 0 && asParent.length === 0 && (
        <p className="notes-empty">{nls.t('features.tree.families.empty')}</p>
      )}
      {asChild.map((family) => (
        <FamilyCard key={family.id} {...cardProps(family)} />
      ))}
      {asParent.map((family) => (
        <FamilyCard key={family.id} {...cardProps(family)} />
      ))}
      <div className="family-add">
        <button onClick={() => void addFamily('child')}>
          {nls.t('features.tree.families.addParents')}
        </button>
        <button onClick={() => void addFamily('parent')}>
          {nls.t('features.tree.families.addPartner')}
        </button>
      </div>
    </div>
  );
}

function FamilyCard({
  family,
  personId,
  persons,
  onRemoveMember,
  onAddMember,
  onDelete,
  getEvents,
  onAddEvent,
  onDeleteEvent,
}: {
  family: FamilyRecord;
  personId: string;
  persons: PersonRecord[];
  onRemoveMember: (memberId: string) => void;
  onAddMember: (role: 'parent' | 'child', memberId: string) => void;
  onDelete: () => void;
  getEvents: (personId?: string, familyId?: string) => Promise<EventRecord[]>;
  onAddEvent: (event: EventRecord) => Promise<void>;
  onDeleteEvent: (event: EventRecord) => Promise<void>;
}) {
  const [familyEvents, setFamilyEvents] = useState<EventRecord[]>([]);
  const [marriageDate, setMarriageDate] = useState<DateDraft>(emptyDate());

  useEffect(() => {
    let cancelled = false;
    void getEvents(undefined, family.id).then((loaded) => {
      if (!cancelled) setFamilyEvents(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [family.id, getEvents]);

  const addMarriage = async () => {
    const date = fromDateDraft(marriageDate);
    await onAddEvent({ id: crypto.randomUUID(), type: 'MARR', date, familyId: family.id });
    setMarriageDate(emptyDate());
    setFamilyEvents(await getEvents(undefined, family.id));
  };

  const removeEvent = async (event: EventRecord) => {
    await onDeleteEvent(event);
    setFamilyEvents(await getEvents(undefined, family.id));
  };

  return (
    <div className="family-row">
      <div className="family-members">
        {family.parents
          .filter((id) => id !== personId)
          .map((parentId) => (
            <span key={parentId} className="family-chip">
              {displayName(persons.find((person) => person.id === parentId))}
              <button title="×" onClick={() => onRemoveMember(parentId)}>
                ×
              </button>
            </span>
          ))}
        {family.children.map((childId) => (
          <span key={childId} className="family-chip child">
            {displayName(persons.find((person) => person.id === childId))}
            <button title="×" onClick={() => onRemoveMember(childId)}>
              ×
            </button>
          </span>
        ))}
        <PersonPicker
          persons={persons}
          exclude={[...family.parents, ...family.children]}
          onPick={(memberId) => onAddMember('child', memberId)}
        />
      </div>
      <div className="family-events">
        <span className="family-events-label">{nls.t('features.tree.families.marriage')}</span>
        {familyEvents.map((event) => (
          <span key={event.id} className="family-chip event">
            {event.date ? formatDate(event.date) : ''}
            {event.place ? ` — ${event.place}` : ''}
            <button title="×" onClick={() => void removeEvent(event)}>
              ×
            </button>
          </span>
        ))}
        <DateEditor label="" value={marriageDate} onChange={setMarriageDate} />
        <button onClick={() => void addMarriage()}>{nls.t('features.tree.events.add')}</button>
      </div>
      <div className="family-actions">
        <button onClick={onDelete}>{nls.t('features.tree.families.delete')}</button>
      </div>
    </div>
  );
}

function PersonPicker({
  persons,
  exclude,
  onPick,
}: {
  persons: PersonRecord[];
  exclude: string[];
  onPick: (personId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const needle = query.trim().toLowerCase();
  const candidates = persons
    .filter((person) => !exclude.includes(person.id))
    .filter((person) => !needle || displayName(person).toLowerCase().includes(needle))
    .slice(0, 8);

  return (
    <div className="person-picker">
      <input
        value={query}
        placeholder={nls.t('features.tree.families.personSearch')}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && candidates.length > 0 && (
        <ul className="person-picker-list">
          {candidates.map((person) => (
            <li
              key={person.id}
              onMouseDown={() => {
                onPick(person.id);
                setQuery('');
                setOpen(false);
              }}
            >
              {displayName(person)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
