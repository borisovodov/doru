import type { Demo, DemoMeta } from '../../../gallery/types';
import { FactsSection } from '../fact/FactsSection';
import { FamilySection } from '../family/FamilySection';
import { FactEditor } from '../fact/FactEditor';
import { CitationEditor } from '../citation/CitationEditor';
import { emptyFactDraft, factDraftToRecord } from '../fact/factDraft';

const meta = {
  title: 'Domain/Person sections',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

const noop = async () => undefined;

export const Facts: DemoCase = {
  render: () => (
    <FactsSection
      owner={{ personId: 'P1' }}
      events={[]}
      persons={[]}
      families={[]}
      places={[]}
      addresses={[]}
      refresh={noop}
      onAddFact={noop}
      onUpdateFact={noop}
      onDeleteFact={noop}
    />
  ),
};

export const Families: DemoCase = {
  render: () => (
    <FamilySection
      personId="P1"
      persons={[]}
      families={[]}
      refresh={noop}
      onAddFamily={noop}
      onUpdateFamily={noop}
      onDeleteFamily={noop}
      getFacts={async () => []}
      onAddFact={noop}
      onDeleteFact={noop}
    />
  ),
};

const fact = factDraftToRecord({ ...emptyFactDraft({ personId: 'P1' }), tag: 'BIRT' });

export const FactForm: DemoCase = {
  render: () => (
    <FactEditor
      fact={fact}
      persons={[]}
      families={[]}
      places={[]}
      addresses={[]}
      onSave={noop}
      onCancel={() => undefined}
      onDelete={noop}
    />
  ),
};

export const CitationForm: DemoCase = {
  render: () => (
    <CitationEditor
      citation={{ id: 'C1', sourceId: 'S1', targetType: 'person', targetId: 'P1', page: '12' }}
      onSave={noop}
      onCancel={() => undefined}
    />
  ),
};
