import { Button } from '../../atoms/button/Button';
import { EmptyText } from '../../atoms/feedback/EmptyText';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { FactRecord, FamilyRecord, PersonRecord } from '@doru/core';
import { nls } from '../../nls';
import { DateEditor } from '../date/DateEditor';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { Input } from '../../atoms/form/Input';
import { SectionCard } from '../../patterns/section-card/SectionCard';
import { emptyDate, fromDateDraft, type DateDraft } from '../person/draft';
import { displayName, formatDate } from '../format/format';
import { emptyChildLinkDraft, emptyPartnerLinkDraft, familyDraftToRecord, familyToDraft } from './familyDraft';
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
    const draft = familyToDraft(family);
    draft.partnerLinks = draft.partnerLinks.filter((link) => link.personId !== memberId);
    draft.childLinks = draft.childLinks.filter((link) => link.childId !== memberId);
    await onUpdateFamily(family, familyDraftToRecord(draft));
    await refresh();
  };

  const addMember = async (family: FamilyRecord, role: 'parent' | 'child', memberId: string) => {
    const draft = familyToDraft(family);
    if (role === 'parent') {
      draft.partnerLinks.push(emptyPartnerLinkDraft(memberId));
    } else {
      draft.childLinks.push(emptyChildLinkDraft(memberId));
    }
    await onUpdateFamily(family, familyDraftToRecord(draft));
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
    <SectionCard title={nls.t('features.tree.families.title')}>
      {asChild.length === 0 && asParent.length === 0 && (
        <EmptyText>{nls.t('features.tree.families.empty')}</EmptyText>
      )}
      {asChild.map((family) => (
        <FamilyCard key={family.id} {...cardProps(family)} />
      ))}
      {asParent.map((family) => (
        <FamilyCard key={family.id} {...cardProps(family)} />
      ))}
      <div className="family-add">
        <Button variant="secondary" onClick={() => void addFamily('child')}>
          {nls.t('features.tree.families.addParents')}
        </Button>
        <Button variant="secondary" onClick={() => void addFamily('parent')}>
          {nls.t('features.tree.families.addPartner')}
        </Button>
      </div>
    </SectionCard>
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
              <IconButton size="sm" label={nls.t('features.tree.family.removeMember')} icon={<X size={12} aria-hidden="true" />} onClick={() => onRemoveMember(partnerId)} />
            </span>
          ))}
        {family.children.map((childId) => (
          <span key={childId} className="family-chip child">
            {displayName(persons.find((person) => person.id === childId))}
            <IconButton size="sm" label={nls.t('features.tree.family.removeMember')} icon={<X size={12} aria-hidden="true" />} onClick={() => onRemoveMember(childId)} />
          </span>
        ))}
        <PersonPicker
          persons={persons}
          exclude={[...family.partners, ...family.children]}
          placeholder={nls.t('features.tree.families.addPartner')}
          onPick={(memberId) => onAddMember('parent', memberId)}
        />
        <PersonPicker
          persons={persons}
          exclude={[...family.partners, ...family.children]}
          placeholder={nls.t('features.tree.families.addChild')}
          onPick={(memberId) => onAddMember('child', memberId)}
        />
      </div>
      <div className="family-events">
        <span className="family-events-label">{nls.t('features.tree.families.marriage')}</span>
        {familyFacts.map((fact) => (
          <span key={fact.id} className="family-chip event">
            {fact.date ? formatDate(fact.date) : ''}
            {fact.place ? ` — ${fact.place}` : ''}
            <IconButton size="sm" label={nls.t('features.tree.events.remove')} icon={<X size={12} aria-hidden="true" />} onClick={() => void removeFact(fact)} />
          </span>
        ))}
        <DateEditor label="" value={marriageDate} onChange={setMarriageDate} />
        <Button variant="primary" onClick={() => void addMarriage()}>{nls.t('features.tree.events.add')}</Button>
      </div>
      <div className="family-actions">
        <Button variant="danger" size="sm" onClick={onDelete}>{nls.t('features.tree.families.delete')}</Button>
      </div>
    </div>
  );
}

function PersonPicker({
  persons,
  exclude,
  placeholder,
  onPick,
}: {
  persons: PersonRecord[];
  exclude: string[];
  placeholder: string;
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
      <Input
        value={query}
        placeholder={placeholder}
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
