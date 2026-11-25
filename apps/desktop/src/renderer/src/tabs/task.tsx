import { nls } from '@doru/workbench';
import { TaskTab } from '@doru/features/task';
import { ENTITY_TAB_PREFIX, entityTabId, type TabDescriptor } from './types';

const prefix = ENTITY_TAB_PREFIX.task;

export const taskTab: TabDescriptor = {
  kind: 'task',
  prefix,
  newId: () => `new:${crypto.randomUUID()}`,
  label: (id, context) => {
    const taskId = id.slice(prefix.length);
    if (taskId.startsWith('new:')) {
      return nls.t('features.tasks.newTask');
    }
    const task = context.tasks.find((entry) => entry.id === taskId);
    return task?.text || '—';
  },
  render: (id, context) => (
    <TaskTab
      entityId={id.slice(prefix.length)}
      tasks={context.tree.tasks}
      persons={context.tree.persons}
      families={context.tree.families}
      sources={context.tree.sources}
      places={context.tree.places}
      repositories={context.tree.repositories}
      titles={context.tree.titles}
      facts={context.tree.facts}
      citations={context.tree.citations}
      media={context.tree.media}
      submitters={context.tree.submitters}
      addresses={context.tree.addresses}
      associations={context.tree.associations}
      api={{ ...context.tree.tasksApi, openTask: context.tabs.open.task }}
      onClose={() => context.tabs.closeTab(id)}
      onOpenMedia={context.tabs.open.media}
      onOpenSource={context.tabs.open.source}
      onCreated={(realId) => context.tabs.replaceTab(id, entityTabId('task', realId))}
    />
  ),
};
