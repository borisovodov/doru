import type { Meta, StoryObj } from '@storybook/react-vite';
import { Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { IconButton, type IconButtonSize, type IconButtonVariant } from './IconButton';

const meta = {
  title: 'Atoms/Icon Button',
  component: IconButton,
  args: {
    label: 'Edit',
    icon: <Pencil size={14} />,
    size: 'md',
    variant: 'ghost',
  },
} satisfies Meta<typeof IconButton>;

export default meta;
type Story = StoryObj<typeof meta>;

const VARIANTS: ReadonlyArray<[IconButtonVariant, string]> = [
  ['ghost', 'Ghost'],
  ['active', 'Active'],
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['danger', 'Danger'],
];

const SIZES: ReadonlyArray<IconButtonSize> = ['sm', 'md', 'lg', 'nav'];

const heading = {
  margin: '0 0 8px',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: 'var(--doru-fg-muted)',
};

export const AllSizes: Story = {
  name: 'All sizes',
  args: { label: 'Edit', icon: <Pencil size={14} /> },
  render: () => (
    <div style={{ display: 'grid', gap: 24 }}>
      <section>
        <h3 style={heading}>Variants × sizes</h3>
        <div style={{ display: 'grid', gap: 10 }}>
          {VARIANTS.map(([variant, label]) => (
            <div key={variant} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {SIZES.map((size) => (
                <IconButton
                  key={size}
                  size={size}
                  variant={variant}
                  label={`${label} ${size}`}
                  icon={
                    variant === 'danger' ? (
                      <Trash2 size={16} />
                    ) : variant === 'primary' ? (
                      <Plus size={16} />
                    ) : variant === 'active' ? (
                      <Settings size={16} />
                    ) : (
                      <Pencil size={16} />
                    )
                  }
                />
              ))}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 style={heading}>Disabled</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {VARIANTS.map(([variant, label]) => (
            <IconButton
              key={variant}
              size="md"
              variant={variant}
              disabled
              label={`${label} disabled`}
              icon={<Pencil size={16} />}
            />
          ))}
        </div>
      </section>
    </div>
  ),
};
