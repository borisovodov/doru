import { familyLabel } from '@doru/ui/domain';
import { nls } from '@doru/workbench';
import { FamilyTab } from '@doru/features/family';
import { ENTITY_TAB_PREFIX, type TabDescriptor } from './types';

const prefix = ENTITY_TAB_PREFIX.family;

export const familyTab: TabDescriptor = {
  kind: 'family',
  prefix,
  label: (id, context) => {
    const familyId = id.slice(prefix.length);
    const family = context.families.find((entry) => entry.id === familyId);
    if (!family) {
      return familyId;
    }
    return familyLabel(family, new Map(context.persons.map((person) => [person.id, person])));
  },
  render: (id, context) => {
    const familyId = id.slice(prefix.length);
    const family = context.tree.families.find((entry) => entry.id === familyId);
    if (!family) {
      return <p className="person-missing">{nls.t('features.tree.familyNotFound')}</p>;
    }
    return (
      <FamilyTab
        entityId={id.slice(prefix.length)}
        families={context.tree.families}
        api={{ ...context.tree.familyApi, openTask: context.tabs.open.task }}
        persons={context.tree.persons}
        associations={context.tree.associations}
        sources={context.tree.sources}
        media={context.tree.media}
        mediaApi={context.tree.mediaApi}
        onOpenMedia={context.tabs.open.media}
        onOpenSource={context.tabs.open.source}
        onClose={() => context.tabs.closeTab(id)}
      />
    );
  },
};
