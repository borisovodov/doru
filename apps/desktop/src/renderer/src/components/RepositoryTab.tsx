import { useEffect, useState } from 'react';
import { Input } from '@doru/ui';
import { SectionCard } from '@doru/ui';
import { Field } from '@doru/ui';
import { Archive } from 'lucide-react';
import type { RepositoryRecord, SourceRecord } from '@doru/core';
import { EntityTab, type RegistriesEditorApi } from '@doru/features';
import {
  AddressFields,
  ChangesSection,
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
import { CitationAttachments, NoteAttachments, useAttachments } from '@doru/features';
import { REPOSITORY_TAB_PREFIX } from '../hooks/useTabs';
import { useRegistryAddress } from './useRegistryAddress';

export function RepositoryTab({
  tabId,
  repositories,
  api,
  sources,
  onOpenSource,
  onClose,
  onCreated,
}: {
  tabId: string;
  repositories: RepositoryRecord[];
  api: RegistriesEditorApi;
  sources: SourceRecord[];
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const repositoryId = tabId.slice(REPOSITORY_TAB_PREFIX.length);
  const isNew = repositoryId.startsWith('new:');
  const record = repositories.find((repository) => repository.id === repositoryId);
  if (!isNew && !record) {
    return <p className="person-missing">{nls.t('features.tree.repository.notFound')}</p>;
  }
  return (
    <RepositoryTabBody
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

function RepositoryTabBody({
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
  record: RepositoryRecord | undefined;
  isNew: boolean;
  api: RegistriesEditorApi;
  sources: SourceRecord[];
  onOpenSource: (sourceId: string) => void;
  onClose: (tabId: string) => void;
  onCreated: (realId: string) => void;
}) {
  const base: RepositoryRecord = record ?? { id: crypto.randomUUID(), name: '' };
  const [lastSaved, setLastSaved] = useState<RepositoryRecord | undefined>(record);
  const [name, setName] = useState(base.name);
  const { address, setAddress, saveAddress } = useRegistryAddress(api, base.addressId);
  const [addressText, setAddressText] = useState('');
  const targetId = (lastSaved ?? record)?.id;
  const {
    notes: repositoryNotes,
    allNotes,
    citations: repositoryCitations,
    tags,
    tagLinks,
    identifiers,
    contacts,
    restrictions,
    changes,
    refresh: refreshAttachments,
  } = useAttachments('repository', targetId, api);

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

  const save = async () => {
    const next: RepositoryRecord = { id: base.id, xref: base.xref, name: name.trim() };
    next.addressId = await saveAddress();
    if (isNew && lastSaved === undefined) {
      await api.addRepository(next);
      onCreated(next.id);
    } else {
      await api.updateRepository(lastSaved ?? base, next);
    }
    setLastSaved(next);
  };

  const remove = async () => {
    const target = lastSaved ?? base;
    await api.deleteRepository(target);
    onClose(tabId);
  };

  return (
    <EntityTab>
      <EntityViewCard
        media={<Archive size={20} aria-hidden="true" />}
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
        <Field label={nls.t('features.tree.repository.name')}>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <AddressFields address={address} onChange={setAddress} />
      </SectionCard>
      {targetId !== undefined && (
        <>
          <SourcesSection
            targetType="repository"
            targetId={targetId}
            sources={sources}
            citations={repositoryCitations}
            refresh={refreshAttachments}
            onAddSource={api.addSource}
            onAttachSource={api.attachSource}
            onDetachCitation={api.detachCitation}
            onUpdateCitation={api.updateCitation}
            onOpenSource={onOpenSource}
            renderCitationAttachments={(citation) => (
              <CitationAttachments citation={citation} api={api} sources={sources} onOpenSource={onOpenSource} />
            )}
          />
          <NotesSection
            targetType="repository"
            targetId={targetId}
            notes={repositoryNotes}
            availableNotes={allNotes}
            onAdd={async (text) => {
              await api.addNote({ id: crypto.randomUUID(), text, targetType: 'repository', targetId });
              await refreshAttachments();
            }}
            onUpdate={async (before, after, context) => {
              await api.updateNote(before, after, context);
              await refreshAttachments();
            }}
            onAttach={async (noteId) => {
              await api.attachNote(noteId, { id: crypto.randomUUID(), targetType: 'repository', targetId });
              await refreshAttachments();
            }}
            onDetach={async (note, link) => {
              await api.detachNote(note, link);
              await refreshAttachments();
            }}
            onDelete={async (note) => {
              await api.deleteNote(note);
              await refreshAttachments();
            }}
            renderAttachments={(note) => (
              <NoteAttachments note={note} api={api} sources={sources} onOpenSource={onOpenSource} />
            )}
          />
          <IdentifiersSection
            targetType="repository"
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
            targetType="repository"
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
            targetType="repository"
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
            targetType="repository"
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
          <ChangesSection changes={changes} />
        </>
      )}
    </EntityTab>
  );
}
