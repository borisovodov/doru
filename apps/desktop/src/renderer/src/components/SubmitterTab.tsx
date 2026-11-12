import { IconButton } from '@doru/ui';
import { useEffect, useState } from 'react';
import { Input } from '@doru/ui';
import { SectionCard } from '@doru/ui';
import { Field, FieldGrid, InlineForm } from '@doru/ui';
import { Plus, User, X } from 'lucide-react';
import type {
  CitationRecord,
  ContactRecord,
  IdentifierRecord,
  NoteRecord,
  RestrictionRecord,
  SourceRecord,
  SubmitterRecord,
  TagLinkRecord,
  TagRecord,
} from '@doru/core';
import { EntityTab, type RegistriesEditorApi } from '@doru/features';
import {
  AddressFields,
  ContactsSection,
  IdentifiersSection,
  NotesSection,
  RestrictionsSection,
  SourcesSection,
  TagsSection,
  addressLabel,
} from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { Button } from '@doru/ui';
import { EntityViewCard } from '@doru/ui';
import { SUBMITTER_TAB_PREFIX } from '../hooks/useTabs';
import { useRegistryAddress } from './useRegistryAddress';

/* eslint-disable @eslint-react/no-array-index-key -- lists without stable ids use their position as identity */

export function SubmitterTab({
  tabId,
  submitters,
  api,
  sources,
  onOpenSource,
  onClose,
  onCreated,
}: {
  tabId: string;
  submitters: SubmitterRecord[];
  api: RegistriesEditorApi;
  sources: SourceRecord[];
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const submitterId = tabId.slice(SUBMITTER_TAB_PREFIX.length);
  const isNew = submitterId.startsWith('new:');
  const record = submitters.find((submitter) => submitter.id === submitterId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.submitter.notFound')}</p>;
  }
  return (
    <SubmitterTabBody
      tabId={tabId}
      record={record}
      isNew={isNew}
      api={api}
      sources={sources}
      onOpenSource={onOpenSource}
      onClose={onClose}
      onCreated={onCreated}
    />
  );
}

function SubmitterTabBody({
  tabId,
  record,
  isNew,
  api,
  sources,
  onOpenSource,
  onClose,
  onCreated,
}: {
  tabId: string;
  record: SubmitterRecord | undefined;
  isNew: boolean;
  api: RegistriesEditorApi;
  sources: SourceRecord[];
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base: SubmitterRecord = record ?? { id: crypto.randomUUID(), name: '' };
  const [lastSaved, setLastSaved] = useState<SubmitterRecord | undefined>(record);
  const [name, setName] = useState(base.name);
  const [languages, setLanguages] = useState<string[]>([...(base.languages ?? [])]);
  const { address, setAddress, saveAddress } = useRegistryAddress(api, base.addressId);
  const [addressText, setAddressText] = useState('');
  const [submitterNotes, setSubmitterNotes] = useState<NoteRecord[]>([]);
  const [submitterCitations, setSubmitterCitations] = useState<CitationRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [tagLinks, setTagLinks] = useState<Array<{ tagId: string; link: TagLinkRecord }>>([]);
  const [identifiers, setIdentifiers] = useState<IdentifierRecord[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [restrictions, setRestrictions] = useState<RestrictionRecord[]>([]);

  const targetId = (lastSaved ?? record)?.id;

  const refreshAttachments = async () => {
    if (targetId === undefined) {
      return;
    }
    const [
      loadedNotes,
      loadedCitations,
      loadedTags,
      loadedTagLinks,
      loadedIdentifiers,
      loadedContacts,
      loadedRestrictions,
    ] = await Promise.all([
      api.getNotes('submitter', targetId),
      api.getCitations('submitter', targetId),
      api.getTags(),
      api.getTagLinks('submitter', targetId),
      api.getIdentifiers('submitter', targetId),
      api.getContacts('submitter', targetId),
      api.getRestrictions('submitter', targetId),
    ]);
    setSubmitterNotes(loadedNotes);
    setSubmitterCitations(loadedCitations);
    setTags(loadedTags);
    setTagLinks(loadedTagLinks);
    setIdentifiers(loadedIdentifiers);
    setContacts(loadedContacts);
    setRestrictions(loadedRestrictions);
  };

  useEffect(() => {
    void refreshAttachments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetId]);

  useEffect(() => {
    let cancelled = false;
    if (base.addressId !== undefined) {
      void api.getAddress(base.addressId).then((loaded) => {
        if (!cancelled && loaded) setAddressText(addressLabel(loaded));
      });
    }
    return () => {
      cancelled = true;
    };
  }, [base.addressId, api]);

  const patchLanguage = (index: number, value: string) =>
    setLanguages(languages.map((language, i) => (i === index ? value : language)));

  const save = async () => {
    const next: SubmitterRecord = {
      id: base.id,
      xref: base.xref,
      name: name.trim(),
      languages: languages.map((language) => language.trim()).filter((language) => language !== ''),
    };
    next.addressId = await saveAddress();
    if (isNew && lastSaved === undefined) {
      await api.addSubmitter(next);
      onCreated(next.id);
    } else {
      await api.updateSubmitter(lastSaved ?? base, next);
    }
    setLastSaved(next);
  };

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteSubmitter(target);
    onClose(tabId);
  };

  return (
    <EntityTab>
      <EntityViewCard
        media={<User size={20} aria-hidden="true" />}
        title={name.trim() || '—'}
        subtitle={addressText !== '' ? addressText : null}
        actions={
          <>
            <Button variant="primary" size="sm" disabled={name.trim() === ''} onClick={() => void save()}>
              {nls.t('features.tree.save')}
            </Button>
            {(!isNew || lastSaved !== undefined) && (
              <Button variant="danger" size="sm" onClick={() => void remove()}>
                {nls.t('features.tree.fact.delete')}
              </Button>
            )}
          </>
        }
      />

      <SectionCard title={nls.t('features.tree.details')}>
        <Field label={nls.t('features.tree.submitter.name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <FieldGrid columns={1}>
          {languages.map((language, index) => (
            <InlineForm key={index}>
              <Input
                placeholder={nls.t('features.tree.submitter.languages.field')}
                value={language}
                onChange={(event) => patchLanguage(index, event.target.value)}
              />
              <IconButton
                size="sm"
                label={nls.t('features.tree.submitter.languages.remove')}
                icon={<X size={13} aria-hidden="true" />}
                onClick={() => setLanguages(languages.filter((_, i) => i !== index))}
              />
            </InlineForm>
          ))}
        </FieldGrid>
        <Button variant="primary" size="sm" onClick={() => setLanguages([...languages, ''])}>
          <Plus size={13} aria-hidden="true" />
          {nls.t('features.tree.submitter.languages.add')}
        </Button>
        <AddressFields address={address} onChange={setAddress} />
      </SectionCard>
      {targetId !== undefined && (
        <>
          <SourcesSection
            targetType="submitter"
            targetId={targetId}
            sources={sources}
            citations={submitterCitations}
            refresh={refreshAttachments}
            onAddSource={api.addSource}
            onAttachSource={api.attachSource}
            onDetachCitation={api.detachCitation}
            onUpdateCitation={api.updateCitation}
            onOpenSource={onOpenSource}
          />
          <NotesSection
            targetType="submitter"
            targetId={targetId}
            notes={submitterNotes}
            onAdd={async (text) => {
              await api.addNote({ id: crypto.randomUUID(), text, targetType: 'submitter', targetId });
              await refreshAttachments();
            }}
            onUpdate={async (before, after, context) => {
              await api.updateNote(before, after, context);
              await refreshAttachments();
            }}
            onDelete={async (note) => {
              await api.deleteNote(note);
              await refreshAttachments();
            }}
          />
          <IdentifiersSection
            targetType="submitter"
            targetId={targetId}
            identifiers={identifiers}
            onAdd={async (identifier) => {
              await api.addIdentifier(identifier);
              await refreshAttachments();
            }}
            onUpdate={async (before, after) => {
              await api.updateIdentifier(before, after);
              await refreshAttachments();
            }}
            onDelete={async (identifier) => {
              await api.deleteIdentifier(identifier);
              await refreshAttachments();
            }}
          />
          <ContactsSection
            targetType="submitter"
            targetId={targetId}
            contacts={contacts}
            onAdd={async (contact) => {
              await api.addContact(contact);
              await refreshAttachments();
            }}
            onUpdate={async (before, after) => {
              await api.updateContact(before, after);
              await refreshAttachments();
            }}
            onDelete={async (contact) => {
              await api.deleteContact(contact);
              await refreshAttachments();
            }}
          />
          <RestrictionsSection
            targetType="submitter"
            targetId={targetId}
            restrictions={restrictions}
            onAdd={async (restriction) => {
              await api.addRestriction(restriction);
              await refreshAttachments();
            }}
            onUpdate={async (before, after) => {
              await api.updateRestriction(before, after);
              await refreshAttachments();
            }}
            onDelete={async (restriction) => {
              await api.deleteRestriction(restriction);
              await refreshAttachments();
            }}
          />
          <TagsSection
            targetType="submitter"
            targetId={targetId}
            tags={tags}
            tagLinks={tagLinks}
            onAddTag={api.addTag}
            onUpdateTag={api.updateTag}
            onDeleteTag={api.deleteTag}
            onAttachTag={async (link) => {
              await api.attachTag(link);
              await refreshAttachments();
            }}
            onDetachTag={async (link) => {
              await api.detachTag(link);
              await refreshAttachments();
            }}
            onUpdateTagLink={async (before, after) => {
              await api.updateTagLink(before, after);
              await refreshAttachments();
            }}
          />
        </>
      )}
    </EntityTab>
  );
}
