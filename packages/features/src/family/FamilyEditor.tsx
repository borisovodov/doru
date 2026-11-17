import { IconButton } from '@doru/ui';
import { EmptyText } from '@doru/ui';
import { useEffect, useMemo, useState } from 'react';
import { Checkbox, Field, FieldGrid, InlineForm, Input, ReorderButtons, Select, SectionCard, Subcard } from '@doru/ui';
import { Paperclip, Plus, Users, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type {
  AddressRecord,
  AssociationRecord,
  FactRecord,
  FamilyRecord,
  PersonRecord,
  PlaceRecord,
  SourceRecord,
  SubmitterRecord,
} from '@doru/core';
import { placeName } from '@doru/core/model';
import { nls } from '../nls';
import '../sidebar/sidebar.css';
import './FamilyEditor.css';
import { AssociationsSection, ContributorsSection, DateEditor, FactsSection, displayName } from '@doru/ui/domain';
import { AttachmentsPanel } from '../attachments/AttachmentsPanel';
import { CitationAttachments } from '../attachments/TargetAttachments';
import { Button, EditorPage, EntityViewCard } from '@doru/ui';
import type { FamilyEditorApi } from '../person/types';
import {
  CHILD_STATUS_TYPES,
  PEDIGREE_TYPES,
  moveItem,
  emptyChildLinkDraft,
  emptyMarriageStatusDraft,
  emptyPartnerLinkDraft,
  type ChildLinkDraft,
  type FamilyDraft,
  type PartnerLinkDraft,
} from '@doru/ui/domain';

/**
 * The full family form: partner and child slots with their link details
 * (preferred partner, relationship date, pedigree, status, relations to
 * the parents), plus the family's facts. One save on the card writes the
 * whole family.
 */
export function FamilyEditor({
  draft,
  onChange,
  persons,
  families,
  associations,
  sources,
  api,
  savedLinkIds,
  renderLinkAttachments,
  renderStatusAttachments,
  onSave,
  onDelete,
}: {
  draft: FamilyDraft;
  savedLinkIds?: ReadonlySet<string> | undefined;
  renderLinkAttachments?: ((kind: 'partner' | 'child', linkId: string) => ReactNode) | undefined;
  renderStatusAttachments?: ((statusId: string) => ReactNode) | undefined;
  onChange: (draft: FamilyDraft) => void;
  persons: PersonRecord[];
  families: FamilyRecord[];
  associations: AssociationRecord[];
  sources: SourceRecord[];
  api: FamilyEditorApi;
  onSave: () => void;
  onDelete: (() => void) | undefined;
}) {
  const [facts, setFacts] = useState<FactRecord[]>([]);
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [addresses, setAddresses] = useState<AddressRecord[]>([]);
  const [submitters, setSubmitters] = useState<SubmitterRecord[]>([]);
  const [contributors, setContributors] = useState<
    Array<{
      id: string;
      submitterId: string;
      targetType: string;
      targetId: string;
      kind?: 'contributor' | 'ancestor_interest' | 'descendant_interest';
    }>
  >([]);
  const [newPartnerId, setNewPartnerId] = useState('');
  const [newChildId, setNewChildId] = useState('');
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [expandedStatusId, setExpandedStatusId] = useState<string | null>(null);

  const set = (patch: Partial<FamilyDraft>) => onChange({ ...draft, ...patch });

  const personById = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);
  const memberIds = new Set([
    ...draft.partnerLinks.map((link) => link.personId),
    ...draft.childLinks.map((link) => link.childId),
  ]);
  const candidates = persons.filter((person) => !memberIds.has(person.id));

  const refreshContributors = async () => {
    setSubmitters(await api.getSubmitters());
    setContributors(await api.getRecordSubmitters('family', draft.id));
  };

  useEffect(() => {
    let cancelled = false;
    void api.getFacts(undefined, draft.id).then((loaded) => {
      if (!cancelled) setFacts(loaded);
    });
    void api.getPlaces().then((loaded) => {
      if (!cancelled) setPlaces(loaded);
    });
    void api.getAddresses().then((loaded) => {
      if (!cancelled) setAddresses(loaded);
    });
    void Promise.all([api.getSubmitters(), api.getRecordSubmitters('family', draft.id)]).then(
      ([loadedSubmitters, loadedContributors]) => {
        if (!cancelled) {
          setSubmitters(loadedSubmitters);
          setContributors(loadedContributors);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [draft.id, api, persons]);

  const refreshFacts = async () => {
    setFacts(await api.getFacts(undefined, draft.id));
  };

  const patchPartner = (index: number, values: Partial<PartnerLinkDraft>) =>
    set({ partnerLinks: draft.partnerLinks.map((link, i) => (i === index ? { ...link, ...values } : link)) });
  const removePartner = (index: number) => set({ partnerLinks: draft.partnerLinks.filter((_, i) => i !== index) });
  const addPartner = () => {
    if (newPartnerId === '') {
      return;
    }
    set({ partnerLinks: [...draft.partnerLinks, emptyPartnerLinkDraft(newPartnerId)] });
    setNewPartnerId('');
  };

  const patchChild = (index: number, values: Partial<ChildLinkDraft>) =>
    set({ childLinks: draft.childLinks.map((link, i) => (i === index ? { ...link, ...values } : link)) });
  const removeChild = (index: number) => set({ childLinks: draft.childLinks.filter((_, i) => i !== index) });
  const addChild = () => {
    if (newChildId === '') {
      return;
    }
    set({ childLinks: [...draft.childLinks, emptyChildLinkDraft(newChildId)] });
    setNewChildId('');
  };

  const partnerNames = draft.partnerLinks
    .map((link) => displayName(personById.get(link.personId)))
    .filter((name) => name !== '?');
  const label = partnerNames.length > 0 ? partnerNames.join(' & ') : '—';

  return (
    <EditorPage label={nls.t('features.tree.families.title')}>
      <EntityViewCard
        media={<Users size={20} aria-hidden="true" />}
        title={label}
        subtitle={nls.t('features.sidebar.children', draft.childLinks.length)}
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

      <SectionCard title={nls.t('features.tree.families.details')}>
        <Checkbox
          label={nls.t('features.tree.family.preferred')}
          checked={draft.preferred}
          onChange={(event) => set({ preferred: event.target.checked })}
        />
        <Checkbox
          label={nls.t('features.tree.family.sameSex')}
          checked={draft.sameSex}
          onChange={(event) => set({ sameSex: event.target.checked })}
        />
        <FieldGrid columns={2}>
          <Field label={nls.t('features.tree.family.unionKind')}>
            <Input value={draft.unionKind} onChange={(event) => set({ unionKind: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.family.unionStatus')}>
            <Input value={draft.unionStatus} onChange={(event) => set({ unionStatus: event.target.value })} />
          </Field>
          <Field label={nls.t('features.tree.family.marriageBeginStatus')}>
            <Input
              value={draft.marriageBeginStatus}
              onChange={(event) => set({ marriageBeginStatus: event.target.value })}
            />
          </Field>
          <Field label={nls.t('features.tree.family.marriageEndStatus')}>
            <Input
              value={draft.marriageEndStatus}
              onChange={(event) => set({ marriageEndStatus: event.target.value })}
            />
          </Field>
        </FieldGrid>
        <h4>{nls.t('features.tree.family.witnesses')}</h4>
        {draft.witnesses.map((witness, index) => (
          // oxlint-disable-next-line react/no-array-index-key -- witnesses are plain text rows
          <div className="family-link-head" key={index}>
            <Input
              value={witness}
              aria-label={nls.t('features.tree.family.witnesses')}
              onChange={(event) =>
                set({ witnesses: draft.witnesses.map((value, i) => (i === index ? event.target.value : value)) })
              }
            />
            <IconButton
              size="sm"
              label={nls.t('features.tree.family.removeWitness')}
              icon={<X size={13} aria-hidden="true" />}
              onClick={() => set({ witnesses: draft.witnesses.filter((_, i) => i !== index) })}
            />
          </div>
        ))}
        <Button size="sm" variant="secondary" onClick={() => set({ witnesses: [...draft.witnesses, ''] })}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.family.addWitness')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.family.marriageStatuses')}>
        {draft.marriageStatuses.map((status, index) => (
          <Subcard key={status.id}>
            <div className="family-link-head">
              <Input
                aria-label={nls.t('features.tree.family.marriageStatus')}
                placeholder={nls.t('features.tree.family.marriageStatus')}
                value={status.status}
                onChange={(event) =>
                  set({
                    marriageStatuses: draft.marriageStatuses.map((entry, i) =>
                      i === index ? { ...entry, status: event.target.value } : entry,
                    ),
                  })
                }
              />
              {renderStatusAttachments !== undefined && (
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.attachments.show')}
                  icon={<Paperclip size={13} aria-hidden="true" />}
                  onClick={() => setExpandedStatusId(expandedStatusId === status.id ? null : status.id)}
                />
              )}
              <IconButton
                size="sm"
                label={nls.t('features.tree.family.removeWitness')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => set({ marriageStatuses: draft.marriageStatuses.filter((_, i) => i !== index) })}
              />
            </div>
            {expandedStatusId === status.id && renderStatusAttachments?.(status.id)}
            <DateEditor
              label={nls.t('features.tree.names.date')}
              value={status.date}
              onChange={(date) =>
                set({
                  marriageStatuses: draft.marriageStatuses.map((entry, i) =>
                    i === index ? { ...entry, date } : entry,
                  ),
                })
              }
              hidePlace
            />
            <Select
              value={status.placeId}
              onChange={(event) =>
                set({
                  marriageStatuses: draft.marriageStatuses.map((entry, i) =>
                    i === index ? { ...entry, placeId: event.target.value } : entry,
                  ),
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
          </Subcard>
        ))}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => set({ marriageStatuses: [...draft.marriageStatuses, emptyMarriageStatusDraft()] })}
        >
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.family.addMarriageStatus')}
        </Button>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.families.partners')}>
        {draft.partnerLinks.length === 0 && <EmptyText>{nls.t('features.tree.families.empty')}</EmptyText>}
        {draft.partnerLinks.map((link, index) => (
          <Subcard key={link.id}>
            <div className="family-link-head">
              <span className="family-link-name">{displayName(personById.get(link.personId))}</span>
              <Checkbox
                label={nls.t('features.tree.family.preferred')}
                checked={link.preferred}
                onChange={(event) => patchPartner(index, { preferred: event.target.checked })}
              />
              <ReorderButtons
                upLabel={nls.t('features.tree.reorder.up')}
                downLabel={nls.t('features.tree.reorder.down')}
                canMoveUp={index > 0}
                canMoveDown={index < draft.partnerLinks.length - 1}
                onMoveUp={() => set({ partnerLinks: moveItem(draft.partnerLinks, index, index - 1) })}
                onMoveDown={() => set({ partnerLinks: moveItem(draft.partnerLinks, index, index + 1) })}
              />
              {renderLinkAttachments !== undefined && savedLinkIds?.has(link.id) === true && (
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.attachments.show')}
                  icon={<Paperclip size={13} aria-hidden="true" />}
                  onClick={() => setExpandedLinkId(expandedLinkId === link.id ? null : link.id)}
                />
              )}
              <IconButton
                size="sm"
                label={nls.t('features.tree.family.removeMember')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => removePartner(index)}
              />
            </div>
            <DateEditor
              label={nls.t('features.tree.family.partnerDate')}
              value={link.date}
              onChange={(date) => patchPartner(index, { date })}
              hidePlace
            />
            <FieldGrid columns={2}>
              <Field label={nls.t('features.tree.family.partnerPhrase')}>
                <Input value={link.phrase} onChange={(event) => patchPartner(index, { phrase: event.target.value })} />
              </Field>
              <Field label={nls.t('features.tree.family.partnerName')}>
                <Input value={link.name} onChange={(event) => patchPartner(index, { name: event.target.value })} />
              </Field>
              <Field label={nls.t('features.tree.family.civilStatus')}>
                <Input
                  value={link.civilStatus}
                  onChange={(event) => patchPartner(index, { civilStatus: event.target.value })}
                />
              </Field>
              <Field label={nls.t('features.tree.family.marriageNumber')}>
                <Input
                  value={link.marriageNumber}
                  onChange={(event) => patchPartner(index, { marriageNumber: event.target.value })}
                />
              </Field>
            </FieldGrid>
            {expandedLinkId === link.id && renderLinkAttachments?.('partner', link.id)}
          </Subcard>
        ))}
        <InlineForm>
          <Select value={newPartnerId} onChange={(event) => setNewPartnerId(event.target.value)}>
            <option value="">{nls.t('features.tree.family.addMember.none')}</option>
            {candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {displayName(person)}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={addPartner}>
            <Plus size={13} aria-hidden="true" />
            {nls.t('features.tree.families.addPartner')}
          </Button>
        </InlineForm>
      </SectionCard>

      <SectionCard title={nls.t('features.tree.families.children')}>
        {draft.childLinks.length === 0 && <EmptyText>{nls.t('features.tree.families.empty')}</EmptyText>}
        {draft.childLinks.map((link, index) => (
          <Subcard key={link.id}>
            <div className="family-link-head">
              <span className="family-link-name">{displayName(personById.get(link.childId))}</span>
              <ReorderButtons
                upLabel={nls.t('features.tree.reorder.up')}
                downLabel={nls.t('features.tree.reorder.down')}
                canMoveUp={index > 0}
                canMoveDown={index < draft.childLinks.length - 1}
                onMoveUp={() => set({ childLinks: moveItem(draft.childLinks, index, index - 1) })}
                onMoveDown={() => set({ childLinks: moveItem(draft.childLinks, index, index + 1) })}
              />
              {renderLinkAttachments !== undefined && savedLinkIds?.has(link.id) === true && (
                <IconButton
                  size="sm"
                  label={nls.t('features.tree.attachments.show')}
                  icon={<Paperclip size={13} aria-hidden="true" />}
                  onClick={() => setExpandedLinkId(expandedLinkId === link.id ? null : link.id)}
                />
              )}
              <IconButton
                size="sm"
                label={nls.t('features.tree.family.removeMember')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => removeChild(index)}
              />
            </div>
            <FieldGrid columns={2}>
              <Field label={nls.t('features.tree.family.pedigree')}>
                <Select value={link.pedigree} onChange={(event) => patchChild(index, { pedigree: event.target.value })}>
                  <option value="">{nls.t('features.tree.family.pedigree.none')}</option>
                  {PEDIGREE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {nls.t(`features.tree.family.pedigree.${type}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={nls.t('features.tree.family.status')}>
                <Select value={link.status} onChange={(event) => patchChild(index, { status: event.target.value })}>
                  <option value="">{nls.t('features.tree.family.status.none')}</option>
                  {CHILD_STATUS_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {nls.t(`features.tree.family.status.${type}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={nls.t('features.tree.family.statusPhrase')}>
                <Input
                  value={link.statusPhrase}
                  onChange={(event) => patchChild(index, { statusPhrase: event.target.value })}
                />
              </Field>
              <Field label={nls.t('features.tree.family.fatherRelation')}>
                <Input
                  value={link.fatherRelation}
                  onChange={(event) => patchChild(index, { fatherRelation: event.target.value })}
                />
              </Field>
              <Field label={nls.t('features.tree.family.motherRelation')}>
                <Input
                  value={link.motherRelation}
                  onChange={(event) => patchChild(index, { motherRelation: event.target.value })}
                />
              </Field>
              <Field label={nls.t('features.tree.family.pedigreePhrase')}>
                <Input
                  value={link.pedigreePhrase}
                  onChange={(event) => patchChild(index, { pedigreePhrase: event.target.value })}
                />
              </Field>
              <Field label={nls.t('features.tree.family.multiplicity')}>
                <Input
                  value={link.multiplicity}
                  onChange={(event) => patchChild(index, { multiplicity: event.target.value })}
                />
              </Field>
            </FieldGrid>
            <Checkbox
              label={nls.t('features.tree.family.childPreferred')}
              checked={link.preferred}
              onChange={(event) => patchChild(index, { preferred: event.target.checked })}
            />
            {expandedLinkId === link.id && renderLinkAttachments?.('child', link.id)}
          </Subcard>
        ))}
        <InlineForm>
          <Select value={newChildId} onChange={(event) => setNewChildId(event.target.value)}>
            <option value="">{nls.t('features.tree.family.addMember.none')}</option>
            {candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {displayName(person)}
              </option>
            ))}
          </Select>
          <Button variant="primary" onClick={addChild}>
            <Plus size={13} aria-hidden="true" />
            {nls.t('features.tree.families.addChild')}
          </Button>
        </InlineForm>
      </SectionCard>

      <AssociationsSection
        owner={{ kind: 'family', id: draft.id }}
        associations={associations}
        persons={persons}
        onAdd={api.addAssociation}
        onUpdate={api.updateAssociation}
        onDelete={api.deleteAssociation}
      />

      <FactsSection
        owner={{ familyId: draft.id }}
        events={facts}
        persons={persons}
        families={families}
        places={places}
        addresses={addresses}
        refresh={refreshFacts}
        onAddFact={api.addFact}
        onUpdateFact={api.updateFact}
        onDeleteFact={api.deleteFact}
        onAddAddress={async (address) => {
          const created = await api.addAddress(address);
          setAddresses(await api.getAddresses());
          return created;
        }}
        onUpdateAddress={async (before, after) => {
          const updated = await api.updateAddress(before, after);
          setAddresses(await api.getAddresses());
          return updated;
        }}
        renderAttachments={(fact) => (
          <AttachmentsPanel
            targetType="fact"
            targetId={fact.id}
            api={api}
            sources={sources}
            sections={[
              'notes',
              'sources',
              'media',
              'tags',
              'identifiers',
              'contacts',
              'restrictions',
              'contributors',
              'tasks',
              'changes',
            ]}
            renderCitationAttachments={(citation) => (
              <CitationAttachments citation={citation} api={api} sources={sources} />
            )}
          />
        )}
      />

      <ContributorsSection
        targetType="family"
        targetId={draft.id}
        submitters={submitters}
        links={contributors}
        onAdd={async (submitterId, targetType, targetId, kind) => {
          await api.addRecordSubmitter(submitterId, targetType, targetId, kind);
          await refreshContributors();
        }}
        onDelete={async (id, submitterId, targetType, targetId, kind) => {
          await api.deleteRecordSubmitter(id, submitterId, targetType, targetId, kind);
          await refreshContributors();
        }}
      />
    </EditorPage>
  );
}
