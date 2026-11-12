import { IconButton } from '@doru/ui';
import { useMemo } from 'react';
import { Checkbox, Input, Select, SectionCard } from '@doru/ui';
import { MapPin, Plus, X } from 'lucide-react';
import type { PlaceRecord } from '@doru/core';
import { nls } from '../nls';
import { placeName } from '@doru/core/model';
import '../sidebar/sidebar.css';
import './PlaceEditor.css';
import { DateEditor, emptyDate } from '@doru/ui/domain';
import { Button } from '@doru/ui';
import { EditorPage, EntityViewCard } from '@doru/ui';
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
    <EditorPage label={nls.t('workbench.activityBar.places')} className="place-editor">
      <EntityViewCard
        media={<MapPin size={20} aria-hidden="true" />}
        title={placeDraftName(draft) || '—'}
        subtitle={subtitle !== '' ? subtitle : null}
        actions={
          <>
            <Button variant="primary" size="sm" onClick={onSave}>
              {nls.t('features.tree.save')}
            </Button>
            {onDelete && (
              <Button variant="danger" size="sm" onClick={onDelete}>
                {nls.t('features.tree.fact.delete')}
              </Button>
            )}
          </>
        }
      />

      <SectionCard title={nls.t('features.tree.place.names')}>
        {draft.names.length === 0 && <p className="notes-empty">{nls.t('features.tree.place.names.empty')}</p>}
        {draft.names.map((name, index) => (
          <div className="place-name-row" key={name.id}>
            <Select
              value={name.kind}
              onChange={(event) => patchName(index, { kind: event.target.value })}
              title={nls.t('features.tree.place.names.kind')}
            >
              {PLACE_NAME_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {nls.t(`features.tree.place.names.kind.${kind}`)}
                </option>
              ))}
            </Select>
            <Input
              placeholder={nls.t('features.tree.names.language')}
              value={name.language}
              onChange={(event) => patchName(index, { language: event.target.value })}
            />
            <Input
              placeholder={nls.t('features.tree.place.names.type')}
              value={name.type}
              onChange={(event) => patchName(index, { type: event.target.value })}
            />
            <Input
              className="place-name-value"
              placeholder={nls.t('features.tree.place.names.value')}
              value={name.value}
              onChange={(event) => patchName(index, { value: event.target.value })}
            />
            <IconButton size="sm" label={nls.t('features.tree.place.names.remove')} icon={<>
              <X size={13} aria-hidden="true" />
            </>} onClick={() => removeName(index)} />
          </div>
        ))}
        <Button variant="primary" onClick={addName}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.names.add')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.place.coordinates')}>
        <div className="place-coordinates">
          <label>
            {nls.t('features.tree.place.latitude')}
            <Input value={draft.latitude} onChange={(event) => set({ latitude: event.target.value })} />
          </label>
          <label>
            {nls.t('features.tree.place.longitude')}
            <Input value={draft.longitude} onChange={(event) => set({ longitude: event.target.value })} />
          </label>
          <Checkbox
            label={nls.t('features.tree.place.verified')}
            checked={draft.verified}
            onChange={(event) => set({ verified: event.target.checked })}
          />
        </div>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.place.postalCodes')}>
        {draft.postalCodes.map((postal, index) => (
          <div className="place-postal-block" key={postal.id}>
            <div className="place-sub-row">
              <Input
                placeholder={nls.t('features.tree.place.postalCodes.code')}
                value={postal.code}
                onChange={(event) => patchPostal(index, { code: event.target.value })}
              />
              <IconButton size="sm" label={nls.t('features.tree.place.postalCodes.remove')} icon={<>
                <X size={13} aria-hidden="true" />
              </>} onClick={() => removePostal(index)} />
            </div>
            <DateEditor
              label={nls.t('features.tree.events.dateField')}
              value={postal.date}
              onChange={(date) => patchPostal(index, { date })}
              hidePlace
            />
          </div>
        ))}
        <Button variant="primary" onClick={addPostal}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.postalCodes.add')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.place.hierarchy')}>
        {draft.hierarchy.map((link, index) => (
          <div className="place-sub-row" key={index}>
            <Select
              value={link.parentId}
              onChange={(event) => patchHierarchy(index, { parentId: event.target.value })}
            >
              <option value="">{nls.t('features.tree.place.hierarchy.parent.none')}</option>
              {parentOptions.map((place) => (
                <option key={place.id} value={place.id}>
                  {placeName(place)}
                </option>
              ))}
            </Select>
            <Select
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
            </Select>
            <IconButton size="sm" label={nls.t('features.tree.place.hierarchy.remove')} icon={<>
              <X size={13} aria-hidden="true" />
            </>} onClick={() => removeHierarchy(index)} />
          </div>
        ))}
        <Button variant="primary" onClick={addHierarchy}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.hierarchy.add')}
        </Button>
      </SectionCard>
    </EditorPage>
  );
}
