import type { Meta, StoryObj } from '@storybook/react-vite';
import { Checkbox } from './Checkbox';
import { Input } from './Input';
import { Select } from './Select';
import { Textarea } from './Textarea';

const meta = {
  title: 'Atoms/Form controls',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Inputs: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 10, maxWidth: 320 }}>
      <Input placeholder="Default input" />
      <Input controlSize="sm" placeholder="Small input" />
      <Input controlSize="lg" placeholder="Large input" />
      <Input invalid placeholder="Invalid input" />
      <Input disabled placeholder="Disabled input" />
    </div>
  ),
};

export const Selects: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 10, maxWidth: 320 }}>
      <Select defaultValue="a">
        <option value="a">Option A</option>
        <option value="b">Option B</option>
      </Select>
      <Select defaultValue="a" invalid>
        <option value="a">Invalid select</option>
      </Select>
    </div>
  ),
};

export const Textareas: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 10, maxWidth: 320 }}>
      <Textarea placeholder="A note" rows={3} />
      <Textarea invalid defaultValue="Invalid note" rows={3} />
    </div>
  ),
};

export const Checkboxes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8 }}>
      <Checkbox label="Preferred name" defaultChecked />
      <Checkbox label="Disabled option" disabled />
    </div>
  ),
};
