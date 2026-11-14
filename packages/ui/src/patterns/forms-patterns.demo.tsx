import type { Demo, DemoMeta } from '../../gallery/types';
import { Button } from '../atoms/button/Button';
import { ActionBar } from './action-bar/ActionBar';
import { Field } from '../atoms/field/Field';
import { Input } from '../atoms/form/Input';
import { Subcard } from './subcard/Subcard';

const meta = {
  title: 'Patterns/Forms',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

export const Subcards: DemoCase = {
  render: () => (
    <Subcard>
      <Field label="Cause">
        <Input defaultValue="Pneumonia" />
      </Field>
      <Field label="Agency">
        <Input defaultValue="City hospital" />
      </Field>
      <ActionBar>
        <Button variant="primary">Save</Button>
        <Button variant="secondary">Cancel</Button>
      </ActionBar>
    </Subcard>
  ),
};

export const ActionBars: DemoCase = {
  render: () => (
    <ActionBar>
      <Button variant="primary">Save</Button>
      <Button variant="secondary">Cancel</Button>
      <Button variant="danger">Delete</Button>
    </ActionBar>
  ),
};
