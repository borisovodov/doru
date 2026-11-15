import { displayName } from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { PersonTab } from '../components/PersonTab';
import { ENTITY_TAB_PREFIX, entityTabId, type TabDescriptor } from './types';

const prefix = ENTITY_TAB_PREFIX.person;

export const personTab: TabDescriptor = {
  kind: 'person',
  prefix,
  newId: () => `new:${crypto.randomUUID()}`,
  label: (id, context) => {
    const personId = id.slice(prefix.length);
    if (personId.startsWith('new:')) {
      return nls.t('features.tree.addPerson');
    }
    const person = context.persons.find((entry) => entry.id === personId);
    return person ? displayName(person) : personId;
  },
  render: (id, context) => (
    <PersonTab
      tabId={id}
      persons={context.tree.persons}
      api={{ ...context.tree.api, openSource: context.tabs.open.source, openTask: context.tabs.open.task }}
      mediaApi={context.tree.mediaApi}
      onOpenMedia={context.tabs.open.media}
      onClose={context.tabs.closeTab}
      onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('person', realId))}
      onDeletePerson={context.tree.deletePerson}
    />
  ),
};
