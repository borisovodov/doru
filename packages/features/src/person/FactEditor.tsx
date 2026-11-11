import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { FactAge, FactParticipant, FactRecord, PersonRecord, PlaceRecord } from '@doru/core';
import { nls } from '../nls';
import { placeName } from '@doru/core/model';
import { DateEditor } from './DateEditor';
import { displayName } from './format';
import { EVENT_TYPES, FACT_AGE_ROLES, FACT_FLAGS, factDraftToRecord, factToDraft, type FactDraft } from './factDraft';
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
  places,
  onSave,
  onCancel,
  onDelete,
}: {
  fact: FactRecord;
  persons: PersonRecord[];
  places: PlaceRecord[];
  onSave: (fact: FactRecord) => Promise<void>;
  onCancel: () => void;
  onDelete: (fact: FactRecord) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FactDraft>(() => factToDraft(fact));
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<FactDraft>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    setSaving(true);
    try {
      await onSave(factDraftToRecord(draft));
    } finally {
      setSaving(false);
    }
  };

  const patchAge = (index: number, values: Partial<FactAge>) =>
    set({ ages: draft.ages.map((age, i) => (i === index ? { ...age, ...values } : age)) });
  const addAge = () => set({ ages: [...draft.ages, { id: crypto.randomUUID() }] });
  const removeAge = (index: number) => set({ ages: draft.ages.filter((_, i) => i !== index) });

  const patchParticipant = (index: number, values: Partial<FactParticipant>) =>
    set({ participants: draft.participants.map((participant, i) => (i === index ? { ...participant, ...values } : participant)) });
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
      <div className="fact-editor-row fact-kind-row">
        <label>
          {nls.t('features.tree.events.typeField')}
          <input
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
        <label>
          {nls.t('features.tree.fact.type')}
          <input value={draft.type} onChange={(event) => set({ type: event.target.value })} />
        </label>
        <label className="fact-negation">
          <input type="checkbox" checked={draft.negation} onChange={(event) => set({ negation: event.target.checked })} />
          {nls.t('features.tree.fact.negation')}
        </label>
      </div>

      <label>
        {nls.t('features.tree.fact.value')}
        <input value={draft.value} onChange={(event) => set({ value: event.target.value })} />
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
      <label>
        {nls.t('features.tree.fact.placeLink')}
        <select
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
        </select>
      </label>
      <DateEditor
        label={nls.t('features.tree.fact.sortDate')}
        value={draft.sortDate}
        onChange={(sortDate) => set({ sortDate })}
        hidePlace
      />

      <div className="fact-details-grid">
        <label>
          {nls.t('features.tree.fact.cause')}
          <input value={draft.cause} onChange={(event) => set({ cause: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.fact.agency')}
          <input value={draft.agency} onChange={(event) => set({ agency: event.target.value })} />
        </label>
        <label>
          {nls.t('features.tree.fact.religiousAffiliation')}
          <input
            value={draft.religiousAffiliation}
            onChange={(event) => set({ religiousAffiliation: event.target.value })}
          />
        </label>
        <label>
          {nls.t('features.tree.fact.quality')}
          <input value={draft.quality} onChange={(event) => set({ quality: event.target.value })} />
        </label>
      </div>
      <label>
        {nls.t('features.tree.fact.sentence')}
        <input value={draft.sentence} onChange={(event) => set({ sentence: event.target.value })} />
      </label>

      <div className="fact-subsection">
        <h4>{nls.t('features.tree.fact.ages.title')}</h4>
        {draft.ages.map((age, index) => (
          <div className="fact-age-row" key={age.id}>
            <select
              value={age.role ?? ''}
              onChange={(event) => patchAge(index, { role: event.target.value || undefined })}
            >
              {FACT_AGE_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role === ''
                    ? nls.t('features.tree.fact.ages.role.none')
                    : nls.t(role === 'HUSB' ? 'features.tree.fact.ages.role.husband' : 'features.tree.fact.ages.role.wife')}
                </option>
              ))}
            </select>
            {AGE_NUMBER_FIELDS.map((field) => (
              <input
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
            <input
              placeholder={nls.t('features.tree.fact.ages.phrase')}
              value={age.phrase ?? ''}
              onChange={(event) => patchAge(index, { phrase: event.target.value || undefined })}
            />
            <button
              className="icon-button"
              title={nls.t('features.tree.fact.ages.remove')}
              onClick={() => removeAge(index)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button className="add-button small" onClick={addAge}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.fact.ages.add')}
        </button>
      </div>

      <div className="fact-subsection">
        <h4>{nls.t('features.tree.fact.participants.title')}</h4>
        {draft.participants.map((participant, index) => (
          <div className="fact-participant-row" key={participant.id}>
            <select
              value={participant.personId ?? ''}
              onChange={(event) => pickParticipantPerson(index, event.target.value)}
            >
              <option value="">{nls.t('features.tree.fact.participants.person.none')}</option>
              {persons.map((person) => (
                <option key={person.id} value={person.id}>
                  {displayName(person)}
                </option>
              ))}
            </select>
            {participant.personId === undefined && (
              <input
                placeholder={nls.t('features.tree.fact.participants.name')}
                value={participant.value ?? ''}
                onChange={(event) => patchParticipant(index, { value: event.target.value || undefined })}
              />
            )}
            <input
              placeholder={nls.t('features.tree.fact.participants.role')}
              value={participant.role ?? ''}
              onChange={(event) => patchParticipant(index, { role: event.target.value || undefined })}
            />
            <button
              className="icon-button"
              title={nls.t('features.tree.fact.participants.remove')}
              onClick={() => removeParticipant(index)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button className="add-button small" onClick={addParticipant}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.fact.participants.add')}
        </button>
      </div>

      <div className="fact-subsection">
        <h4>{nls.t('features.tree.fact.flags.title')}</h4>
        <div className="fact-flags">
          {FACT_FLAGS.map((flag) => (
            <label key={flag} className="fact-flag">
              <input type="checkbox" checked={draft.flags.includes(flag)} onChange={() => toggleFlag(flag)} />
              {nls.t(`features.tree.fact.flags.${flag}`)}
            </label>
          ))}
        </div>
      </div>

      <div className="fact-editor-actions">
        <button className="add-button" disabled={saving} onClick={() => void save()}>
          {nls.t('features.tree.save')}
        </button>
        <button className="plain-button" onClick={onCancel}>
          {nls.t('features.tree.fact.cancel')}
        </button>
        <button className="danger-button" onClick={() => void onDelete(fact)}>
          {nls.t('features.tree.fact.delete')}
        </button>
      </div>
    </div>
  );
}
