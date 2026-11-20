import { addressLabel } from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { AddressTab, RepositoryTab, SubmitterTab, TitleTab } from '@doru/features/registries';
import { ENTITY_TAB_PREFIX, entityTabId, type TabDescriptor } from './types';

const repositoryPrefix = ENTITY_TAB_PREFIX.repository;
const submitterPrefix = ENTITY_TAB_PREFIX.submitter;
const addressPrefix = ENTITY_TAB_PREFIX.address;
const titlePrefix = ENTITY_TAB_PREFIX.title;

export const repositoryTab: TabDescriptor = {
  kind: 'repository',
  prefix: repositoryPrefix,
  newId: () => `new:${crypto.randomUUID()}`,
  label: (id, context) => {
    const repositoryId = id.slice(repositoryPrefix.length);
    if (repositoryId.startsWith('new:')) {
      return nls.t('features.tree.repository.newRepository');
    }
    const repository = context.repositories.find((entry) => entry.id === repositoryId);
    return repository?.name || '—';
  },
  render: (id, context) => (
    <RepositoryTab
      entityId={id.slice(repositoryPrefix.length)}
      repositories={context.tree.repositories}
      addresses={context.tree.addresses}
      api={{ ...context.tree.registriesApi, openTask: context.tabs.open.task }}
      sources={context.tree.sources}
      titles={context.tree.titles}
      media={context.tree.media}
      mediaApi={context.tree.mediaApi}
      onOpenSource={context.tabs.open.source}
      onOpenTitle={context.tabs.open.title}
      onOpenMedia={context.tabs.open.media}
      onOpenAddress={context.tabs.open.address}
      onClose={() => context.tabs.closeTab(id)}
      onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('repository', realId))}
    />
  ),
};

export const submitterTab: TabDescriptor = {
  kind: 'submitter',
  prefix: submitterPrefix,
  newId: () => `new:${crypto.randomUUID()}`,
  label: (id, context) => {
    const submitterId = id.slice(submitterPrefix.length);
    if (submitterId.startsWith('new:')) {
      return nls.t('features.tree.submitter.newSubmitter');
    }
    const submitter = context.submitters.find((entry) => entry.id === submitterId);
    return submitter?.name || '—';
  },
  render: (id, context) => (
    <SubmitterTab
      entityId={id.slice(submitterPrefix.length)}
      submitters={context.tree.submitters}
      addresses={context.tree.addresses}
      api={{ ...context.tree.registriesApi, openTask: context.tabs.open.task }}
      sources={context.tree.sources}
      media={context.tree.media}
      mediaApi={context.tree.mediaApi}
      recordSubmitters={context.tree.recordSubmitters}
      targetData={{
        persons: context.tree.persons,
        families: context.tree.families,
        sources: context.tree.sources,
        places: context.tree.places,
        repositories: context.tree.repositories,
        titles: context.tree.titles,
        facts: context.tree.facts,
        citations: context.tree.citations,
        notes: context.tree.notes,
        media: context.tree.media,
        submitters: context.tree.submitters,
        addresses: context.tree.addresses,
        associations: context.tree.associations,
        todos: context.tree.todos,
      }}
      onOpenSource={context.tabs.open.source}
      onOpenMedia={context.tabs.open.media}
      onOpenAddress={context.tabs.open.address}
      onOpenTarget={(targetType, targetId) => {
        switch (targetType) {
          case 'person':
            context.tabs.open.person(targetId);
            break;
          case 'family':
            context.tabs.open.family(targetId);
            break;
          case 'source':
            context.tabs.open.source(targetId);
            break;
          case 'place':
            context.tabs.open.place(targetId);
            break;
          case 'repository':
            context.tabs.open.repository(targetId);
            break;
          case 'submitter':
            context.tabs.open.submitter(targetId);
            break;
          case 'address':
            context.tabs.open.address(targetId);
            break;
          case 'todo':
            context.tabs.open.task(targetId);
            break;
          case 'media':
            context.tabs.open.media(targetId);
            break;
          case 'title':
            context.tabs.open.title(targetId);
            break;
          default:
            break;
        }
      }}
      onClose={() => context.tabs.closeTab(id)}
      onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('submitter', realId))}
    />
  ),
};

export const addressTab: TabDescriptor = {
  kind: 'address',
  prefix: addressPrefix,
  newId: () => `new:${crypto.randomUUID()}`,
  label: (id, context) => {
    const addressId = id.slice(addressPrefix.length);
    if (addressId.startsWith('new:')) {
      return nls.t('features.tree.address.newAddress');
    }
    const address = context.addresses.find((entry) => entry.id === addressId);
    return address ? addressLabel(address) || '—' : '—';
  },
  render: (id, context) => (
    <AddressTab
      entityId={id.slice(addressPrefix.length)}
      addresses={context.tree.addresses}
      facts={context.tree.facts}
      repositories={context.tree.repositories}
      submitters={context.tree.submitters}
      sources={context.tree.sources}
      api={{ ...context.tree.registriesApi, openTask: context.tabs.open.task }}
      onClose={() => context.tabs.closeTab(id)}
      onOpenSource={context.tabs.open.source}
      onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('address', realId))}
    />
  ),
};

export const titleTab: TabDescriptor = {
  kind: 'title',
  prefix: titlePrefix,
  newId: () => `new:${crypto.randomUUID()}`,
  label: (id, context) => {
    const titleId = id.slice(titlePrefix.length);
    if (titleId.startsWith('new:')) {
      return nls.t('features.tree.title.newTitle');
    }
    const title = context.titles.find((entry) => entry.id === titleId);
    return title?.name || '—';
  },
  render: (id, context) => (
    <TitleTab
      entityId={id.slice(titlePrefix.length)}
      titles={context.tree.titles}
      sources={context.tree.sources}
      repositories={context.tree.repositories}
      api={{ ...context.tree.titlesApi, openTask: context.tabs.open.task }}
      onClose={() => context.tabs.closeTab(id)}
      onOpenSource={context.tabs.open.source}
      onOpenMedia={context.tabs.open.media}
      onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('title', realId))}
    />
  ),
};
