import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../atoms/button/Button';
import { ActionBar } from './action-bar/ActionBar';
import { Field } from '../atoms/field/Field';
import { Input } from '../atoms/form/Input';
import { Subcard } from './subcard/Subcard';

const meta = {
  title: 'Patterns/Forms',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Subcards: Story = {
  render: () => (
    <Subcard>
      <Field label="Cause">
        <Input defaultValue="Pneumonia" />
      </Field>
    </Subcard>
  ),
};

export const ActionBars: Story = {
  render: () => (
    <ActionBar>
      <Button variant="primary">Save</Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="danger">Delete</Button>
    </ActionBar>
  ),
};
