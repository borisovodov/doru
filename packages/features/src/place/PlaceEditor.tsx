import { useMemo } from 'react';
import { MapPin, Plus, X } from 'lucide-react';
import type { PlaceRecord } from '@doru/core';
import { nls } from '../nls';
import { placeName } from '@doru/core/model';
import '../sidebar/sidebar.css';
import './PlaceEditor.css';
import { DateEditor } from '@doru/ui';
import { emptyDate } from '@doru/ui';
import {
  HIERARCHY_TYPES,
  PLACE_NAME_KINDS,
  emptyPlaceNameDraft,
  placeDraftName,
  type HierarchyDraft,
  type PlaceDraft,
  type PlaceNameDraft,
  type PostalCodeDraft,
} from './placeDraft';

/**
 * The full place form: names by jurisdiction (with variants), coordinates,
 * postal codes and parent links. Parent selects never offer the place
 * itself or its descendants, so the hierarchy cannot cycle.
 */
export function PlaceEditor({
  draft,
  onChange,
  places,
  onSave,
  onDelete,
}: {
  draft: PlaceDraft;
  onChange: (draft: PlaceDraft) => void;
  places: PlaceRecord[];
  onSave: () => void;
  onDelete: (() => void) | undefined;
}) {
  const set = (patch: Partial<PlaceDraft>) => onChange({ ...draft, ...patch });

  const patchName = (index: number, values: Partial<PlaceNameDraft>) =>
    set({ names: draft.names.map((name, i) => (i === index ? { ...name, ...values } : name)) });
  const addName = () => set({ names: [...draft.names, emptyPlaceNameDraft(draft.names.length)] });
  const removeName = (index: number) => set({ names: draft.names.filter((_, i) => i !== index) });

  const patchPostal = (index: number, values: Partial<PostalCodeDraft>) =>
    set({ postalCodes: draft.postalCodes.map((postal, i) => (i === index ? { ...postal, ...values } : postal)) });
  const addPostal = () =>
    set({ postalCodes: [...draft.postalCodes, { id: crypto.randomUUID(), code: '', date: emptyDate() }] });
  const removePostal = (index: number) => set({ postalCodes: draft.postalCodes.filter((_, i) => i !== index) });

  const patchHierarchy = (index: number, values: Partial<HierarchyDraft>) =>
    set({ hierarchy: draft.hierarchy.map((link, i) => (i === index ? { ...link, ...values } : link)) });
  const addHierarchy = () => set({ hierarchy: [...draft.hierarchy, { parentId: '', type: '' }] });
  const removeHierarchy = (index: number) => set({ hierarchy: draft.hierarchy.filter((_, i) => i !== index) });

  /** The place itself and everything below it — never a valid parent. */
  const excludedIds = useMemo(() => {
    const excluded = new Set<string>([draft.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const place of places) {
        if (excluded.has(place.id)) {
          continue;
        }
        if ((place.hierarchy ?? []).some((link) => excluded.has(link.parentId))) {
          excluded.add(place.id);
          grew = true;
        }
      }
    }
    return excluded;
  }, [draft.id, places]);

  const parentOptions = places.filter((place) => !excludedIds.has(place.id));
  const subtitle = [draft.latitude.trim(), draft.longitude.trim()].filter((part) => part !== '').join(', ');

  return (
    <div className="place-editor">
      <section className="entity-view-card">
        <span className="entity-card-icon entity-view-icon">
          <MapPin size={20} aria-hidden="true" />
        </span>
        <div className="entity-view-body">
          <h2 className="entity-view-title">{placeDraftName(draft) || '—'}</h2>
          {subtitle !== '' && <p className="entity-view-subtitle">{subtitle}</p>}
        </div>
        <div className="person-view-actions">
          <button className="primary" onClick={onSave}>
            {nls.t('features.tree.save')}
          </button>
          {onDelete && (
            <button className="place-delete-button" onClick={onDelete}>
              {nls.t('features.tree.fact.delete')}
            </button>
          )}
        </div>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.place.names')}</h3>
        {draft.names.length === 0 && <p className="notes-empty">{nls.t('features.tree.place.names.empty')}</p>}
        {draft.names.map((name, index) => (
          <div className="place-name-row" key={name.id}>
            <select
              value={name.kind}
              onChange={(event) => patchName(index, { kind: event.target.value })}
              title={nls.t('features.tree.place.names.kind')}
            >
              {PLACE_NAME_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {nls.t(`features.tree.place.names.kind.${kind}`)}
                </option>
              ))}
            </select>
            <input
              placeholder={nls.t('features.tree.names.language')}
              value={name.language}
              onChange={(event) => patchName(index, { language: event.target.value })}
            />
            <input
              placeholder={nls.t('features.tree.place.names.type')}
              value={name.type}
              onChange={(event) => patchName(index, { type: event.target.value })}
            />
            <input
              className="place-name-value"
              placeholder={nls.t('features.tree.place.names.value')}
              value={name.value}
              onChange={(event) => patchName(index, { value: event.target.value })}
            />
            <button
              className="icon-button"
              title={nls.t('features.tree.place.names.remove')}
              onClick={() => removeName(index)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button className="add-button" onClick={addName}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.names.add')}
        </button>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.place.coordinates')}</h3>
        <div className="place-coordinates">
          <label>
            {nls.t('features.tree.place.latitude')}
            <input value={draft.latitude} onChange={(event) => set({ latitude: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.place.longitude')}
            <input value={draft.longitude} onChange={(event) => set({ longitude: event.target.value })} />
          </label>
          <label className="place-verified">
            <input type="checkbox" checked={draft.verified} onChange={(event) => set({ verified: event.target.checked })} />
            {nls.t('features.tree.place.verified')}
          </label>
        </div>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.place.postalCodes')}</h3>
        {draft.postalCodes.map((postal, index) => (
          <div className="place-postal-block" key={postal.id}>
            <div className="place-sub-row">
              <input
                placeholder={nls.t('features.tree.place.postalCodes.code')}
                value={postal.code}
                onChange={(event) => patchPostal(index, { code: event.target.value })}
              />
              <button
                className="icon-button"
                title={nls.t('features.tree.place.postalCodes.remove')}
                onClick={() => removePostal(index)}
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
            <DateEditor
              label={nls.t('features.tree.events.dateField')}
              value={postal.date}
              onChange={(date) => patchPostal(index, { date })}
              hidePlace
            />
          </div>
        ))}
        <button className="add-button" onClick={addPostal}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.postalCodes.add')}
        </button>
      </section>

      <section className="person-section">
        <h3>{nls.t('features.tree.place.hierarchy')}</h3>
        {draft.hierarchy.map((link, index) => (
          <div className="place-sub-row" key={index}>
            <select
              value={link.parentId}
              onChange={(event) => patchHierarchy(index, { parentId: event.target.value })}
            >
              <option value="">{nls.t('features.tree.place.hierarchy.parent.none')}</option>
              {parentOptions.map((place) => (
                <option key={place.id} value={place.id}>
                  {placeName(place)}
                </option>
              ))}
            </select>
            <select
              value={link.type}
              onChange={(event) => patchHierarchy(index, { type: event.target.value })}
              title={nls.t('features.tree.place.hierarchy.type')}
            >
              <option value="">{nls.t('features.tree.place.hierarchy.type.none')}</option>
              {HIERARCHY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {nls.t(`features.tree.place.hierarchy.type.${type}`)}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              title={nls.t('features.tree.place.hierarchy.remove')}
              onClick={() => removeHierarchy(index)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        ))}
        <button className="add-button" onClick={addHierarchy}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.hierarchy.add')}
        </button>
      </section>
    </div>
  );
}
