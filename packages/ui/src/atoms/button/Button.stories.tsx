import type { Meta, StoryObj } from '@storybook/react-vite';
import { Save, Trash2 } from 'lucide-react';
import { Button } from './Button';

const meta = {
  title: 'Atoms/Button',
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS = [
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['ghost', 'Ghost'],
  ['danger', 'Danger'],
  ['link', 'Link'],
] as const;

const SIZES = ['sm', 'md', 'lg'] as const;

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
    <div style={{ display: 'grid', gap: 24, minWidth: 560 }}>
      <section>
        <h3 style={heading}>Variants × sizes</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {VARIANTS.map(([variant, label]) => (
            <div key={variant} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {SIZES.map((size) => (
                <Button key={size} variant={variant} size={size}>
                  {label} {size}
                </Button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 style={heading}>Disabled</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {VARIANTS.map(([variant, label]) => (
            <Button key={variant} variant={variant} disabled>
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 style={heading}>Loading</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {VARIANTS.map(([variant, label]) => (
            <Button key={variant} variant={variant} loading>
              {label}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h3 style={heading}>With icon</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="primary" icon={<Save size={14} />}>Save</Button>
          <Button variant="secondary" icon={<Save size={14} />}>Save</Button>
          <Button variant="danger" icon={<Trash2 size={14} />}>Delete</Button>
        </div>
      </section>
    </div>
  ),
};
