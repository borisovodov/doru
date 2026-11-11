import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { FactRecord, FamilyRecord, PersonRecord } from '@doru/core';
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
  getFacts: (personId?: string, familyId?: string) => Promise<FactRecord[]>;
  onAddFact: (fact: FactRecord) => Promise<void>;
  onDeleteFact: (fact: FactRecord) => Promise<void>;
}

export function FamilySection({
  personId,
  persons,
  families,
  refresh,
  onAddFamily,
  onUpdateFamily,
  onDeleteFamily,
  getFacts,
  onAddFact,
  onDeleteFact,
}: FamilySectionProps) {
  const asChild = families.filter((family) => family.children.includes(personId));
  const asParent = families.filter((family) => family.partners.includes(personId));

  const addFamily = async (kind: 'child' | 'parent') => {
    await onAddFamily({
      id: crypto.randomUUID(),
      partners: kind === 'parent' ? [personId] : [],
      children: kind === 'child' ? [personId] : [],
    });
    await refresh();
  };

  const removeMember = async (family: FamilyRecord, memberId: string) => {
    const after: FamilyRecord = {
      ...family,
      partners: family.partners.filter((id) => id !== memberId),
      children: family.children.filter((id) => id !== memberId),
    };
    await onUpdateFamily(family, after);
    await refresh();
  };

  const addMember = async (family: FamilyRecord, role: 'parent' | 'child', memberId: string) => {
    const after: FamilyRecord = {
      ...family,
      partners: role === 'parent' ? [...family.partners, memberId] : family.partners,
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
    getFacts,
    onAddFact,
    onDeleteFact,
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
  getFacts,
  onAddFact,
  onDeleteFact,
}: {
  family: FamilyRecord;
  personId: string;
  persons: PersonRecord[];
  onRemoveMember: (memberId: string) => void;
  onAddMember: (role: 'parent' | 'child', memberId: string) => void;
  onDelete: () => void;
  getFacts: (personId?: string, familyId?: string) => Promise<FactRecord[]>;
  onAddFact: (fact: FactRecord) => Promise<void>;
  onDeleteFact: (fact: FactRecord) => Promise<void>;
}) {
  const [familyFacts, setFamilyFacts] = useState<FactRecord[]>([]);
  const [marriageDate, setMarriageDate] = useState<DateDraft>(emptyDate());

  useEffect(() => {
    let cancelled = false;
    void getFacts(undefined, family.id).then((loaded) => {
      if (!cancelled) setFamilyFacts(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [family.id, getFacts]);

  const addMarriage = async () => {
    const date = fromDateDraft(marriageDate);
    const place = marriageDate.place.trim() || undefined;
    await onAddFact({ id: crypto.randomUUID(), familyId: family.id, tag: 'MARR', date, place });
    setMarriageDate(emptyDate());
    setFamilyFacts(await getFacts(undefined, family.id));
  };

  const removeFact = async (fact: FactRecord) => {
    await onDeleteFact(fact);
    setFamilyFacts(await getFacts(undefined, family.id));
  };

  return (
    <div className="family-row">
      <div className="family-members">
        {family.partners
          .filter((id) => id !== personId)
          .map((partnerId) => (
            <span key={partnerId} className="family-chip">
              {displayName(persons.find((person) => person.id === partnerId))}
              <button title={nls.t('features.tree.family.removeMember')} onClick={() => onRemoveMember(partnerId)}>
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        {family.children.map((childId) => (
          <span key={childId} className="family-chip child">
            {displayName(persons.find((person) => person.id === childId))}
            <button title={nls.t('features.tree.family.removeMember')} onClick={() => onRemoveMember(childId)}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <PersonPicker
          persons={persons}
          exclude={[...family.partners, ...family.children]}
          onPick={(memberId) => onAddMember('child', memberId)}
        />
      </div>
      <div className="family-events">
        <span className="family-events-label">{nls.t('features.tree.families.marriage')}</span>
        {familyFacts.map((fact) => (
          <span key={fact.id} className="family-chip event">
            {fact.date ? formatDate(fact.date) : ''}
            {fact.place ? ` — ${fact.place}` : ''}
            <button title={nls.t('features.tree.events.remove')} onClick={() => void removeFact(fact)}>
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <DateEditor label="" value={marriageDate} onChange={setMarriageDate} />
        <button className="add-button" onClick={() => void addMarriage()}>{nls.t('features.tree.events.add')}</button>
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
