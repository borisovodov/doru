import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field } from './Field';
import { Input } from '../form/Input';
import { Select } from '../form/Select';

const meta = {
  title: 'Atoms/Field',
  component: Field,
} satisfies Meta<typeof Field>;

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
  args: { label: 'Field', children: null },
  render: () => (
    <div style={{ display: 'grid', gap: 24, width: 360 }}>
      <section>
        <h3 style={heading}>Default</h3>
        <Field label="Given name" hint="The name as it appears in the record.">
          <Input defaultValue="Ivan" />
        </Field>
      </section>

      <section>
        <h3 style={heading}>Required</h3>
        <Field label="Surname" required>
          <Input defaultValue="Ivanov" />
        </Field>
      </section>

      <section>
        <h3 style={heading}>With error</h3>
        <Field label="Given name" error="This field cannot be empty.">
          <Input invalid />
        </Field>
      </section>

      <section>
        <h3 style={heading}>With select</h3>
        <Field label="Sex">
          <Select defaultValue="U">
            <option value="U">Unknown</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
          </Select>
        </Field>
      </section>
    </div>
  ),
};
