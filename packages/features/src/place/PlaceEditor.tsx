import { IconButton } from '@doru/ui';
import { EmptyText } from '@doru/ui';
import { Fragment, useMemo, useState } from 'react';
import { Checkbox, Field, FieldGrid, Input, ReorderButtons, Select, SectionCard, Subcard } from '@doru/ui';
import { MapPin, Paperclip, Plus, Trash2, X } from 'lucide-react';
import type { FocusEventHandler, ReactNode } from 'react';
import type { PlaceRecord } from '@doru/core';
import { nls } from '../nls';
import { placeName } from '@doru/core/model';
import '../sidebar/sidebar.css';
import './PlaceEditor.css';
import { DateEditor, emptyDate, moveItem } from '@doru/ui/domain';
import { Button, useAutoFocusSelect } from '@doru/ui';
import { EditorPage, EntityViewCard } from '@doru/ui';
import {
  HIERARCHY_TYPES,
  PLACE_NAME_KINDS,
  emptyPlaceNameDraft,
  placeDraftName,
  withPlaceNamePositions,
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
  notice,
  renderAttachments,
  renderNameAttachments,
  onBlur,
  onRowRemoved,
}: {
  draft: PlaceDraft;
  onChange: (draft: PlaceDraft) => void;
  places: PlaceRecord[];
  onSave: () => void;
  /** Inline notice rendered under the header (autosave failure). */
  notice?: ReactNode;
  renderAttachments?: ((linkId: string) => ReactNode) | undefined;
  renderNameAttachments?: ((nameId: string) => ReactNode) | undefined;
  /** Autosave trigger from the tab; fires when a field loses focus. */
  onBlur?: FocusEventHandler<HTMLElement> | undefined;
  /** Requests a save after a focused row-remove button disappears. */
  onRowRemoved?: (() => void) | undefined;
}) {
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [expandedNameId, setExpandedNameId] = useState<string | null>(null);
  const set = (patch: Partial<PlaceDraft>) => onChange({ ...draft, ...patch });

  const patchName = (index: number, values: Partial<PlaceNameDraft>) =>
    set({ names: draft.names.map((name, i) => (i === index ? { ...name, ...values } : name)) });
  const addName = () =>
    set({
      names: withPlaceNamePositions([...draft.names, emptyPlaceNameDraft(draft.names.length)]),
    });
  const removeName = (index: number) => {
    set({ names: withPlaceNamePositions(draft.names.filter((_, i) => i !== index)) });
    onRowRemoved?.();
  };
  const moveName = (index: number, to: number) =>
    set({ names: withPlaceNamePositions(moveItem(draft.names, index, to)) });

  const patchPostal = (index: number, values: Partial<PostalCodeDraft>) =>
    set({ postalCodes: draft.postalCodes.map((postal, i) => (i === index ? { ...postal, ...values } : postal)) });
  const addPostal = () =>
    set({ postalCodes: [...draft.postalCodes, { id: crypto.randomUUID(), code: '', date: emptyDate() }] });
  const removePostal = (index: number) => {
    set({ postalCodes: draft.postalCodes.filter((_, i) => i !== index) });
    onRowRemoved?.();
  };

  const patchHierarchy = (index: number, values: Partial<HierarchyDraft>) =>
    set({ hierarchy: draft.hierarchy.map((link, i) => (i === index ? { ...link, ...values } : link)) });
  const addHierarchy = () =>
    set({
      hierarchy: [...draft.hierarchy, { id: crypto.randomUUID(), parentId: '', type: '', date: emptyDate() }],
    });
  const removeHierarchy = (index: number) => {
    set({ hierarchy: draft.hierarchy.filter((_, i) => i !== index) });
    onRowRemoved?.();
  };

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
  const saved = places.some((place) => place.id === draft.id);
  const nameInputRef = useAutoFocusSelect<HTMLInputElement>(!saved);
  const name = placeDraftName(draft);
  const displayTitle = name !== '' ? name : saved ? '—' : nls.t('features.tree.place.newPlace');
  const subtitle = [draft.latitude.trim(), draft.longitude.trim()].filter((part) => part !== '').join(', ');

  return (
    <EditorPage label={nls.t('workbench.activityBar.places')} onBlur={onBlur}>
      <EntityViewCard
        media={<MapPin size={20} aria-hidden="true" />}
        title={displayTitle}
        subtitle={subtitle !== '' ? subtitle : null}
        actions={
          saved ? undefined : (
            <Button variant="primary" size="sm" data-autosave-skip="true" onClick={onSave}>
              {nls.t('features.tree.create')}
            </Button>
          )
        }
      />
      {notice}

      <SectionCard title={nls.t('features.tree.place.names')}>
        {draft.names.length === 0 && <EmptyText>{nls.t('features.tree.place.names.empty')}</EmptyText>}
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
              {!(PLACE_NAME_KINDS as readonly string[]).includes(name.kind) && name.kind !== '' && (
                <option value={name.kind}>{name.kind}</option>
              )}
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
              ref={index === 0 ? nameInputRef : undefined}
              className="place-name-value"
              placeholder={nls.t('features.tree.place.names.value')}
              value={name.value}
              onChange={(event) => patchName(index, { value: event.target.value })}
            />
            <ReorderButtons
              upLabel={nls.t('features.tree.reorder.up')}
              downLabel={nls.t('features.tree.reorder.down')}
              canMoveUp={index > 0}
              canMoveDown={index < draft.names.length - 1}
              onMoveUp={() => moveName(index, index - 1)}
              onMoveDown={() => moveName(index, index + 1)}
            />
            {renderNameAttachments !== undefined && saved && (
              <IconButton
                size="sm"
                label={nls.t('features.tree.attachments.show')}
                icon={<Paperclip size={13} aria-hidden="true" />}
                onClick={() => setExpandedNameId(expandedNameId === name.id ? null : name.id)}
              />
            )}
            <IconButton
              size="sm"
              label={nls.t('features.tree.place.names.remove')}
              icon={<Trash2 size={13} aria-hidden="true" />}
              onClick={() => removeName(index)}
            />
            <div className="place-name-extra">
              <DateEditor
                label={nls.t('features.tree.names.date')}
                value={name.date}
                onChange={(date) => patchName(index, { date })}
                hidePlace
              />
              <FieldGrid columns={3}>
                <Field label={nls.t('features.tree.place.names.addition')}>
                  <Input
                    value={name.addition}
                    onChange={(event) => patchName(index, { addition: event.target.value })}
                  />
                </Field>
                <Field label={nls.t('features.tree.place.names.abbreviation')}>
                  <Input
                    value={name.abbreviation}
                    onChange={(event) => patchName(index, { abbreviation: event.target.value })}
                  />
                </Field>
                <Field label={nls.t('features.tree.place.names.abbreviationType')}>
                  <Input
                    value={name.abbreviationType}
                    onChange={(event) => patchName(index, { abbreviationType: event.target.value })}
                  />
                </Field>
              </FieldGrid>
            </div>
            {expandedNameId === name.id && renderNameAttachments?.(name.id)}
          </div>
        ))}
        <Button variant="secondary" onClick={addName}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.names.add')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.place.coordinates')}>
        <FieldGrid columns={2}>
          <Field label={nls.t('features.tree.place.latitude')}>
            <Input value={draft.latitude} onChange={(event) => set({ latitude: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.place.longitude')}>
            <Input value={draft.longitude} onChange={(event) => set({ longitude: event.target.value })} />
          </Field>
          <Checkbox
            label={nls.t('features.tree.place.verified')}
            checked={draft.verified}
            onChange={(event) => set({ verified: event.target.checked })}
          />
        </FieldGrid>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.families.details')}>
        <FieldGrid columns={2}>
          <Field label={nls.t('features.tree.place.form')}>
            <Input value={draft.form} onChange={(event) => set({ form: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.source.abbreviation')}>
            <Input value={draft.abbreviation} onChange={(event) => set({ abbreviation: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.place.preposition')}>
            <Input value={draft.preposition} onChange={(event) => set({ preposition: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.place.maidenhead')}>
            <Input value={draft.maidenhead} onChange={(event) => set({ maidenhead: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.place.placeType')}>
            <Input value={draft.placeType} onChange={(event) => set({ placeType: event.target.value })} />
          </Field>
        </FieldGrid>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.place.postalCodes')}>
        {draft.postalCodes.map((postal, index) => (
          <Subcard key={postal.id}>
            <div className="place-sub-row">
              <Input
                placeholder={nls.t('features.tree.place.postalCodes.code')}
                value={postal.code}
                onChange={(event) => patchPostal(index, { code: event.target.value })}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.place.postalCodes.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => removePostal(index)}
              />
            </div>
            <DateEditor
              label={nls.t('features.tree.events.dateField')}
              value={postal.date}
              onChange={(date) => patchPostal(index, { date })}
              hidePlace
            />
          </Subcard>
        ))}
        <Button variant="secondary" onClick={addPostal}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.postalCodes.add')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.place.hierarchy')}>
        {draft.hierarchy.map((link, index) => (
          <Fragment key={link.id}>
            <div className="place-sub-row">
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
                {!(HIERARCHY_TYPES as readonly string[]).includes(link.type) && link.type !== '' && (
                  <option value={link.type}>{link.type}</option>
                )}
              </Select>
              <DateEditor
                label={nls.t('features.tree.names.date')}
                value={link.date}
                onChange={(date) => patchHierarchy(index, { date })}
                hidePlace
              />
              {renderAttachments !== undefined && saved && (
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.attachments.show')}
                  icon={<Paperclip size={13} aria-hidden="true" />}
                  onClick={() => setExpandedLinkId(expandedLinkId === link.id ? null : link.id)}
                />
              )}
              <IconButton
                size="sm"
                label={nls.t('features.tree.place.hierarchy.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => removeHierarchy(index)}
              />
            </div>
            {expandedLinkId === link.id && renderAttachments?.(link.id)}
          </Fragment>
        ))}
        <Button variant="secondary" onClick={addHierarchy}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.place.hierarchy.add')}
        </Button>
      </SectionCard>
    </EditorPage>
  );
}
