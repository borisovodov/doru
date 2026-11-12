import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './Field';
import { Input } from '../form/Input';
import { Select } from '../form/Select';
import { Textarea } from '../form/Textarea';

const meta = {
  title: 'Atoms/Field',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const heading = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: 'var(--doru-fg-muted)',
};

export const AllStates: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 24, minWidth: 360 }}>
      <section>
        <h3 style={heading}>Control sizes</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Small input" hint={'controlSize="sm"'}>
            <Input controlSize="sm" placeholder="Small" />
          </Field>
          <Field label="Default input">
            <Input placeholder="Default" />
          </Field>
          <Field label="Large input">
            <Input controlSize="lg" placeholder="Large" />
          </Field>
        </div>
      </section>

      <section>
        <h3 style={heading}>States</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Default field" hint="Helper text sits under the control.">
            <Input defaultValue="Ivan" />
          </Field>
          <Field label="Required field" required>
            <Input placeholder="Required value" />
          </Field>
          <Field label="Invalid field" error="This field cannot be empty.">
            <Input invalid placeholder="Invalid value" />
          </Field>
          <Field label="Disabled field">
            <Input disabled defaultValue="Read only" />
          </Field>
        </div>
      </section>

      <section>
        <h3 style={heading}>Other controls</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <Field label="Select field" hint="Works with Select too.">
            <Select defaultValue="U">
              <option value="U">Unknown</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </Select>
          </Field>
          <Field label="Textarea field">
            <Textarea placeholder="A longer note" rows={3} />
          </Field>
        </div>
      </section>
    </div>
  ),
};
