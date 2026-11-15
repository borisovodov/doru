import { addressLabel } from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { AddressTab } from '../components/AddressTab';
import { RepositoryTab } from '../components/RepositoryTab';
import { SubmitterTab } from '../components/SubmitterTab';
import { TitleTab } from '../components/TitleTab';
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
      tabId={id}
      repositories={context.tree.repositories}
      addresses={context.tree.addresses}
      api={{ ...context.tree.registriesApi, openTask: context.tabs.open.task }}
      sources={context.tree.sources}
      media={context.tree.media}
      mediaApi={context.tree.mediaApi}
      onOpenSource={context.tabs.open.source}
      onOpenMedia={context.tabs.open.media}
      onOpenAddress={context.tabs.open.address}
      onClose={context.tabs.closeTab}
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
      tabId={id}
      submitters={context.tree.submitters}
      addresses={context.tree.addresses}
      api={{ ...context.tree.registriesApi, openTask: context.tabs.open.task }}
      sources={context.tree.sources}
      media={context.tree.media}
      mediaApi={context.tree.mediaApi}
      onOpenSource={context.tabs.open.source}
      onOpenMedia={context.tabs.open.media}
      onOpenAddress={context.tabs.open.address}
      onClose={context.tabs.closeTab}
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
      tabId={id}
      addresses={context.tree.addresses}
      facts={context.tree.facts}
      repositories={context.tree.repositories}
      submitters={context.tree.submitters}
      sources={context.tree.sources}
      api={{ ...context.tree.registriesApi, openTask: context.tabs.open.task }}
      onClose={context.tabs.closeTab}
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
      tabId={id}
      titles={context.tree.titles}
      sources={context.tree.sources}
      repositories={context.tree.repositories}
      api={{ ...context.tree.titlesApi, openTask: context.tabs.open.task }}
      onClose={context.tabs.closeTab}
      onOpenSource={context.tabs.open.source}
      onOpenMedia={context.tabs.open.media}
      onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('title', realId))}
    />
  ),
};
