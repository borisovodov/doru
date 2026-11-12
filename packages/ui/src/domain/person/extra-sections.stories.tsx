import type { Meta, StoryObj } from '@storybook/react-vite';
import { FactsSection } from '../fact/FactsSection';
import { FamilySection } from '../family/FamilySection';
import { SourcesSection } from '../sources/SourcesSection';
import { NotesSection } from '../notes/NotesSection';
import { TagsSection } from '../tags/TagsSection';
import {
  ContactsSection,
  IdentifiersSection,
  RestrictionsSection,
} from '../attachments/AttachmentsSection';
import { FactEditor } from '../fact/FactEditor';
import { CitationEditor } from '../citation/CitationEditor';
import { emptyFactDraft, factDraftToRecord } from '../fact/factDraft';

const meta = {
  title: 'Domain/Person sections',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const noop = async () => undefined;

export const Facts: Story = {
  render: () => (
    <FactsSection
      owner={{ personId: 'P1' }}
      events={[]}
      persons={[]}
      places={[]}
      addresses={[]}
      refresh={noop}
      onAddFact={noop}
      onUpdateFact={noop}
      onDeleteFact={noop}
    />
  ),
};

export const Families: Story = {
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

export const Sources: Story = {
  render: () => (
    <SourcesSection
      targetType="person"
      targetId="P1"
      sources={[]}
      citations={[]}
      refresh={noop}
      onAddSource={noop}
      onAttachSource={noop}
      onDetachCitation={async () => undefined}
      onUpdateCitation={async () => undefined}
      onOpenSource={() => undefined}
    />
  ),
};

export const Notes: Story = {
  render: () => (
    <NotesSection
      targetType="person"
      targetId="P1"
      notes={[]}
      onAdd={noop}
      onUpdate={async () => undefined}
      onDelete={async () => undefined}
    />
  ),
};

export const Tags: Story = {
  render: () => (
    <TagsSection
      targetType="person"
      targetId="P1"
      tags={[]}
      tagLinks={[]}
      onAddTag={noop}
      onUpdateTag={async () => undefined}
      onDeleteTag={async () => undefined}
      onAttachTag={async () => undefined}
      onDetachTag={async () => undefined}
      onUpdateTagLink={async () => undefined}
    />
  ),
};

export const Tagged: Story = {
  render: () => (
    <TagsSection
      targetType="person"
      targetId="P1"
      tags={[{ id: 'T1', name: 'Ivanovka' }]}
      tagLinks={[
        {
          tagId: 'T1',
          link: { id: 'L1', tagId: 'T1', targetType: 'person', targetId: 'P1' },
        },
      ]}
      onAddTag={noop}
      onUpdateTag={async () => undefined}
      onDeleteTag={async () => undefined}
      onAttachTag={async () => undefined}
      onDetachTag={async () => undefined}
      onUpdateTagLink={async () => undefined}
    />
  ),
};

export const Attachments: Story = {
  render: () => (
    <>
      <IdentifiersSection
        targetType="person"
        targetId="P1"
        identifiers={[]}
        onAdd={noop}
        onUpdate={async () => undefined}
        onDelete={async () => undefined}
      />
      <ContactsSection
        targetType="person"
        targetId="P1"
        contacts={[]}
        onAdd={noop}
        onUpdate={async () => undefined}
        onDelete={async () => undefined}
      />
      <RestrictionsSection
        targetType="person"
        targetId="P1"
        restrictions={[]}
        onAdd={noop}
        onUpdate={async () => undefined}
        onDelete={async () => undefined}
      />
    </>
  ),
};

const fact = factDraftToRecord({ ...emptyFactDraft({ personId: 'P1' }), tag: 'BIRT' });

export const FactForm: Story = {
  render: () => (
    <FactEditor fact={fact} persons={[]} places={[]} addresses={[]} onSave={noop} onCancel={() => undefined} onDelete={noop} />
  ),
};

export const CitationForm: Story = {
  render: () => (
    <CitationEditor
      citation={{ id: 'C1', sourceId: 'S1', targetType: 'person', targetId: 'P1', page: '12' }}
      onSave={noop}
      onCancel={() => undefined}
    />
  ),
};
