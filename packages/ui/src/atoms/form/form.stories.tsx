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

export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <Input controlSize="sm" placeholder="Input sm" />
      <Input placeholder="Input md" />
      <Input controlSize="lg" placeholder="Input lg" />
      <Select controlSize="sm" defaultValue="a">
        <option value="a">Select sm</option>
      </Select>
      <Select defaultValue="a">
        <option value="a">Select md</option>
      </Select>
      <Select controlSize="lg" defaultValue="a">
        <option value="a">Select lg</option>
      </Select>
      <Textarea controlSize="sm" placeholder="Textarea sm" rows={2} />
      <Textarea placeholder="Textarea md" rows={3} />
      <Textarea controlSize="lg" placeholder="Textarea lg" rows={4} />
      <Checkbox label="Checkbox" defaultChecked />
    </div>
  ),
};

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
      <Select controlSize="sm" defaultValue="a">
        <option value="a">Small select</option>
      </Select>
      <Select defaultValue="a">
        <option value="a">Default select</option>
      </Select>
      <Select controlSize="lg" defaultValue="a">
        <option value="a">Large select</option>
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
      <Textarea controlSize="sm" placeholder="Small note" rows={2} />
      <Textarea placeholder="Default note" rows={3} />
      <Textarea controlSize="lg" placeholder="Large note" rows={4} />
      <Textarea invalid defaultValue="Invalid note" rows={2} />
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
