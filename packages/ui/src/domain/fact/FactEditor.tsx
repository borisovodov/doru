import { Button } from '../../atoms/button/Button';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import type {
  AddressRecord,
  FactAge,
  FactParticipant,
  FactRecord,
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
} from '@doru/core';
import { nls } from '../../nls';
import { placeName } from '@doru/core/model';
import { DateEditor } from '../date/DateEditor';
import { Checkbox } from '../../atoms/form/Checkbox';
import { Input } from '../../atoms/form/Input';
import { Select } from '../../atoms/form/Select';
import { ReorderButtons } from '../../atoms/reorder-buttons/ReorderButtons';
import { displayName, familyLabel, formatAddress } from '../format/format';
import { moveItem } from '../reorder';
import { AddressFields } from '../registries/AddressFields';
import {
  addressDraftEmpty,
  addressDraftToRecord,
  addressToDraft,
  emptyAddressDraft,
  type AddressDraft,
} from '../registries/address';
import {
  EVENT_TYPES,
  FACT_AGE_ROLES,
  FACT_FLAGS,
  factDraftToRecord,
  factOwnerRef,
  factToDraft,
  setFactOwner,
  type FactDraft,
} from './factDraft';
import './FactEditor.css';

const AGE_NUMBER_FIELDS = ['years', 'months', 'weeks', 'days'] as const;

/**
 * The full fact form: kind and value, dates (with sort date), the
 * detail fields (cause, agency, …), ages, participants and flags. Used
 * inline under an expanded event row in the events section.
 */
export function FactEditor({
  fact,
  persons,
  families,
  places,
  addresses,
  attachments,
  onAddAddress,
  onUpdateAddress,
  onSave,
  onCancel,
  onDelete,
}: {
  fact: FactRecord;
  persons: PersonRecord[];
  families: FamilyRecord[];
  places: PlaceRecord[];
  addresses: AddressRecord[];
  attachments?: ReactNode;
  onAddAddress?: ((address: AddressRecord) => Promise<AddressRecord>) | undefined;
  onUpdateAddress?: ((before: AddressRecord, after: AddressRecord) => Promise<AddressRecord>) | undefined;
  onSave: (fact: FactRecord) => Promise<void>;
  onCancel: () => void;
  onDelete: (fact: FactRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FactDraft>(() => factToDraft(fact));
  const [addressDraft, setAddressDraft] = useState<AddressDraft | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FactDraft>) => setDraft({ ...draft, ...patch });

  const owner = factOwnerRef(draft);
  const personById = new Map(persons.map((person) => [person.id, person]));
  const ownerOptions: Array<{ value: string; label: string }> = [];
  const seenOwners = new Set<string>();
  const pushPerson = (person: PersonRecord) => {
    const value = `person:${person.id}`;
    if (!seenOwners.has(value)) {
      seenOwners.add(value);
      ownerOptions.push({
        value,
        label: `${nls.t('features.tree.fact.owner.person')}: ${displayName(person)}`,
      });
    }
  };
  const pushFamily = (family: FamilyRecord) => {
    const value = `family:${family.id}`;
    if (!seenOwners.has(value)) {
      seenOwners.add(value);
      ownerOptions.push({
        value,
        label: `${nls.t('features.tree.fact.owner.family')}: ${familyLabel(family, personById)}`,
      });
    }
  };
  if (owner?.kind === 'family') {
    const current = families.find((family) => family.id === owner.id);
    if (current) {
      pushFamily(current);
    }
    persons.forEach(pushPerson);
  } else if (owner?.kind === 'person') {
    const current = persons.find((person) => person.id === owner.id);
    if (current) {
      pushPerson(current);
    }
    families.forEach(pushFamily);
  } else {
    persons.forEach(pushPerson);
    families.forEach(pushFamily);
  }
  const ownerValue = owner === undefined ? '' : `${owner.kind}:${owner.id}`;

  const save = async () => {
    setSaving(true);
    try {
      await onSave(factDraftToRecord(draft, fact));
    } finally {
      setSaving(false);
    }
  };

  const saveAddressDraft = async () => {
    if (addressDraft === undefined) {
      return;
    }
    if (addressDraftEmpty(addressDraft)) {
      setAddressDraft(undefined);
      return;
    }
    const record = addressDraftToRecord(addressDraft);
    if (addressDraft.id !== undefined && onUpdateAddress !== undefined) {
      const before = addresses.find((address) => address.id === addressDraft.id);
      if (before !== undefined) {
        await onUpdateAddress(before, record);
      }
    } else if (onAddAddress !== undefined) {
      await onAddAddress(record);
    }
    set({ addressId: record.id });
    setAddressDraft(undefined);
  };

  const patchAge = (index: number, values: Partial<FactAge>) =>
    set({ ages: draft.ages.map((age, i) => (i === index ? { ...age, ...values } : age)) });
  const addAge = () => set({ ages: [...draft.ages, { id: crypto.randomUUID() }] });
  const removeAge = (index: number) => set({ ages: draft.ages.filter((_, i) => i !== index) });

  const patchParticipant = (index: number, values: Partial<FactParticipant>) =>
    set({
      participants: draft.participants.map((participant, i) =>
        i === index ? { ...participant, ...values } : participant,
      ),
    });
  const addParticipant = () =>
    set({
      participants: [...draft.participants, { id: crypto.randomUUID(), position: draft.participants.length }],
    });
  const removeParticipant = (index: number) =>
    set({
      participants: draft.participants
        .filter((_, i) => i !== index)
        .map((participant, position) => ({ ...participant, position })),
    });

  const toggleFlag = (flag: string) =>
    set({ flags: draft.flags.includes(flag) ? draft.flags.filter((entry) => entry !== flag) : [...draft.flags, flag] });

  const pickParticipantPerson = (index: number, personId: string) => {
    if (personId === '') {
      patchParticipant(index, { personId: undefined });
    } else {
      patchParticipant(index, { personId, value: undefined });
    }
  };

  return (
    <div className="fact-editor">
      <label className="fact-field">
        {nls.t('features.tree.fact.owner')}
        <Select
          value={ownerValue}
          onChange={(event) => {
            const separator = event.target.value.indexOf(':');
            const kind = event.target.value.slice(0, separator);
            const id = event.target.value.slice(separator + 1);
            if (id !== '') {
              setDraft(setFactOwner(draft, { kind: kind === 'family' ? 'family' : 'person', id }));
            }
          }}
        >
          {ownerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </label>
      <div className="fact-editor-row fact-kind-row">
        <label className="fact-field">
          {nls.t('features.tree.events.typeField')}
          <Input
            className="fact-tag-input"
            list="doru-event-types"
            value={draft.tag}
            onChange={(event) => set({ tag: event.target.value.toUpperCase() })}
          />
        </label>
        <datalist id="doru-event-types">
          {EVENT_TYPES.map((eventType) => (
            <option key={eventType} value={eventType} />
          ))}
        </datalist>
        <label className="fact-field">
          {nls.t('features.tree.fact.type')}
          <Input value={draft.type} onChange={(event) => set({ type: event.target.value })} />
        </label>
        <Checkbox
          label={nls.t('features.tree.fact.negation')}
          checked={draft.negation}
          onChange={(event) => set({ negation: event.target.checked })}
        />
      </div>

      <label className="fact-field">
        {nls.t('features.tree.fact.value')}
        <Input value={draft.value} onChange={(event) => set({ value: event.target.value })} />
      </label>

      <DateEditor
        label={nls.t('features.tree.events.dateField')}
        value={draft.date}
        onChange={(date) => {
          const linked = places.find((place) => place.id === draft.placeId);
          // Hand-editing the place text away from the linked place's name
          // detaches the link.
          if (linked !== undefined && date.place !== placeName(linked)) {
            set({ date, placeId: undefined });
          } else {
            set({ date });
          }
        }}
      />
      <DateEditor
        label={nls.t('features.tree.fact.endDate')}
        value={draft.endDate}
        onChange={(endDate) => set({ endDate })}
        hidePlace
      />
      <label className="fact-field">
        {nls.t('features.tree.fact.placeLink')}
        <Select
          value={draft.placeId ?? ''}
          onChange={(event) => {
            const place = places.find((entry) => entry.id === event.target.value);
            if (place) {
              set({ placeId: place.id, date: { ...draft.date, place: placeName(place) } });
            } else {
              set({ placeId: undefined });
            }
          }}
        >
          <option value="">{nls.t('features.tree.fact.placeLink.none')}</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {placeName(place)}
            </option>
          ))}
        </Select>
      </label>
      <label className="fact-field">
        {nls.t('features.tree.fact.addressLink')}
        <Select
          value={draft.addressId ?? ''}
          onChange={(event) => set({ addressId: event.target.value === '' ? undefined : event.target.value })}
        >
          <option value="">{nls.t('features.tree.fact.addressLink.none')}</option>
          {addresses.map((address) => (
            <option key={address.id} value={address.id}>
              {formatAddress(address)}
            </option>
          ))}
        </Select>
      </label>
      {(onAddAddress !== undefined || onUpdateAddress !== undefined) && (
        <div className="fact-editor-row">
          <Button size="sm" variant="secondary" onClick={() => setAddressDraft(emptyAddressDraft())}>
            {nls.t('features.tree.address.newAddress')}
          </Button>
          {draft.addressId !== undefined && onUpdateAddress !== undefined && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const address = addresses.find((entry) => entry.id === draft.addressId);
                if (address !== undefined) {
                  setAddressDraft(addressToDraft(address));
                }
              }}
            >
              {nls.t('features.tree.address.edit')}
            </Button>
          )}
        </div>
      )}
      {addressDraft !== undefined && (
        <div className="fact-subsection">
          <AddressFields address={addressDraft} onChange={setAddressDraft} />
          <div className="fact-editor-row">
            <Button size="sm" variant="primary" onClick={() => void saveAddressDraft()}>
              {nls.t('features.tree.save')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAddressDraft(undefined)}>
              {nls.t('features.tree.fact.cancel')}
            </Button>
          </div>
        </div>
      )}
      <div className="fact-subsection">
        <h4>{nls.t('features.tree.fact.additionalPlaces')}</h4>
        {draft.additionalPlaceIds.map((placeId, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- place ids may repeat before a pick
          <div className="fact-editor-row" key={`${placeId}-${index}`}>
            <Select
              value={placeId}
              onChange={(event) =>
                set({
                  additionalPlaceIds: draft.additionalPlaceIds.map((id, i) => (i === index ? event.target.value : id)),
                })
              }
            >
              <option value="">{nls.t('features.tree.fact.placeLink.none')}</option>
              {places.map((place) => (
                <option key={place.id} value={place.id}>
                  {placeName(place)}
                </option>
              ))}
            </Select>
            <IconButton
              size="sm"
              label={nls.t('features.tree.fact.additionalPlaces')}
              icon={<X size={13} aria-hidden="true" />}
              onClick={() => set({ additionalPlaceIds: draft.additionalPlaceIds.filter((_, i) => i !== index) })}
            />
          </div>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => set({ additionalPlaceIds: [...draft.additionalPlaceIds, ''] })}
        >
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.fact.additionalPlaces')}
        </Button>
      </div>
      <DateEditor
        label={nls.t('features.tree.fact.sortDate')}
        value={draft.sortDate}
        onChange={(sortDate) => set({ sortDate })}
        hidePlace
      />

      <div className="fact-details-grid">
        <label className="fact-field">
          {nls.t('features.tree.fact.cause')}
          <Input value={draft.cause} onChange={(event) => set({ cause: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.agency')}
          <Input value={draft.agency} onChange={(event) => set({ agency: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.religiousAffiliation')}
          <Input
            value={draft.religiousAffiliation}
            onChange={(event) => set({ religiousAffiliation: event.target.value })}
          />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.quality')}
          <Input value={draft.quality} onChange={(event) => set({ quality: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.placePrefix')}
          <Input value={draft.placePrefix} onChange={(event) => set({ placePrefix: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.eventNumber')}
          <Input value={draft.eventNumber} onChange={(event) => set({ eventNumber: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.birthLength')}
          <Input value={draft.birthLength} onChange={(event) => set({ birthLength: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.birthWeight')}
          <Input value={draft.birthWeight} onChange={(event) => set({ birthWeight: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.cemetery')}
          <Input value={draft.cemetery} onChange={(event) => set({ cemetery: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.mapLatitude')}
          <Input value={draft.mapLatitude} onChange={(event) => set({ mapLatitude: event.target.value })} />
        </label>
        <label className="fact-field">
          {nls.t('features.tree.fact.mapLongitude')}
          <Input value={draft.mapLongitude} onChange={(event) => set({ mapLongitude: event.target.value })} />
        </label>
      </div>
      <div className="fact-editor-row">
        <Checkbox
          label={nls.t('features.tree.fact.fna')}
          checked={draft.fna}
          onChange={(event) => set({ fna: event.target.checked })}
        />
        <Checkbox
          label={nls.t('features.tree.fact.descriptionAware')}
          checked={draft.descriptionAware}
          onChange={(event) => set({ descriptionAware: event.target.checked })}
        />
      </div>
      <label className="fact-field">
        {nls.t('features.tree.fact.sentence')}
        <Input value={draft.sentence} onChange={(event) => set({ sentence: event.target.value })} />
      </label>

      <div className="fact-subsection">
        <h4>{nls.t('features.tree.fact.ages.title')}</h4>
        {draft.ages.map((age, index) => (
          <div className="fact-age-row" key={age.id}>
            <Select
              aria-label={nls.t('features.tree.fact.ages.bound')}
              value={age.bound ?? ''}
              onChange={(event) => patchAge(index, { bound: event.target.value || undefined })}
            >
              <option value="">{nls.t('features.tree.fact.ages.bound.none')}</option>
              <option value="<">{nls.t('features.tree.fact.ages.bound.lt')}</option>
              <option value=">">{nls.t('features.tree.fact.ages.bound.gt')}</option>
            </Select>
            <Select
              value={age.role ?? ''}
              onChange={(event) => patchAge(index, { role: event.target.value || undefined })}
            >
              {FACT_AGE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role === ''
                    ? nls.t('features.tree.fact.ages.role.none')
                    : nls.t(
                        role === 'HUSB' ? 'features.tree.fact.ages.role.husband' : 'features.tree.fact.ages.role.wife',
                      )}
                </option>
              ))}
            </Select>
            {AGE_NUMBER_FIELDS.map((field) => (
              <Input
                key={field}
                type="number"
                min={0}
                placeholder={nls.t(`features.tree.fact.ages.${field}`)}
                value={age[field] ?? ''}
                onChange={(event) => {
                  const text = event.target.value;
                  const number = text === '' ? undefined : Number(text);
                  patchAge(index, { [field]: Number.isFinite(number) ? number : undefined });
                }}
              />
            ))}
            <Input
              placeholder={nls.t('features.tree.fact.ages.phrase')}
              value={age.phrase ?? ''}
              onChange={(event) => patchAge(index, { phrase: event.target.value || undefined })}
            />
            <IconButton
              size="sm"
              label={nls.t('features.tree.fact.ages.remove')}
              icon={<X size={13} aria-hidden="true" />}
              onClick={() => removeAge(index)}
            />
          </div>
        ))}
        <Button variant="primary" size="sm" onClick={addAge}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.fact.ages.add')}
        </Button>
      </div>

      <div className="fact-subsection">
        <h4>{nls.t('features.tree.fact.participants.title')}</h4>
        {draft.participants.map((participant, index) => (
          <div className="fact-participant-row" key={participant.id}>
            <Select
              value={participant.personId ?? ''}
              onChange={(event) => pickParticipantPerson(index, event.target.value)}
            >
              <option value="">{nls.t('features.tree.fact.participants.person.none')}</option>
              {persons.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)}
                </option>
              ))}
            </Select>
            {participant.personId === undefined && (
              <Input
                placeholder={nls.t('features.tree.fact.participants.name')}
                value={participant.value ?? ''}
                onChange={(event) => patchParticipant(index, { value: event.target.value || undefined })}
              />
            )}
            <Input
              placeholder={nls.t('features.tree.fact.participants.role')}
              value={participant.role ?? ''}
              onChange={(event) => patchParticipant(index, { role: event.target.value || undefined })}
            />
            <ReorderButtons
              upLabel={nls.t('features.tree.reorder.up')}
              downLabel={nls.t('features.tree.reorder.down')}
              canMoveUp={index > 0}
              canMoveDown={index < draft.participants.length - 1}
              onMoveUp={() =>
                set({
                  participants: moveItem(draft.participants, index, index - 1).map((entry, position) => ({
                    ...entry,
                    position,
                  })),
                })
              }
              onMoveDown={() =>
                set({
                  participants: moveItem(draft.participants, index, index + 1).map((entry, position) => ({
                    ...entry,
                    position,
                  })),
                })
              }
            />
            <IconButton
              size="sm"
              label={nls.t('features.tree.fact.participants.remove')}
              icon={<X size={13} aria-hidden="true" />}
              onClick={() => removeParticipant(index)}
            />
          </div>
        ))}
        <Button variant="primary" size="sm" onClick={addParticipant}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.fact.participants.add')}
        </Button>
      </div>

      <div className="fact-subsection">
        <h4>{nls.t('features.tree.fact.flags.title')}</h4>
        <div className="fact-flags">
          {FACT_FLAGS.map((flag) => (
            <Checkbox
              key={flag}
              label={nls.t(`features.tree.fact.flags.${flag}`)}
              checked={draft.flags.includes(flag)}
              onChange={() => toggleFlag(flag)}
            />
          ))}
        </div>
      </div>

      {attachments}

      <div className="fact-editor-actions">
        <Button variant="primary" disabled={saving} onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {nls.t('features.tree.fact.cancel')}
        </Button>
        <Button variant="danger" onClick={() => void onDelete(fact)}>
          {nls.t('features.tree.fact.delete')}
        </Button>
      </div>
    </div>
  );
}
