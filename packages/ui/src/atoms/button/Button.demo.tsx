import type { Demo, DemoMeta } from '../../../gallery/types';
import { Save, Trash2 } from 'lucide-react';
import { Button } from './Button';

const meta = {
  title: 'Atoms/Button',
  component: Button,
} satisfies DemoMeta<typeof Button>;

export default meta;
type DemoCase = Demo;

const VARIANTS = [
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['ghost', 'Ghost'],
  ['danger', 'Danger'],
  ['link', 'Link'],
] as const;

const SIZES = [
  ['sm', 'Small'],
  ['md', 'Medium'],
  ['lg', 'Large'],
] as const;

const row = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 'var(--doru-space-4)',
} as const;

export const Variants: DemoCase = {
  render: () => (
    <div style={row}>
      {VARIANTS.map(([variant, label]) => (
        <Button key={variant} variant={variant}>
          {label}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: DemoCase = {
  render: () => (
    <div style={row}>
      {SIZES.map(([size, label]) => (
        <Button key={size} size={size}>
          {label}
        </Button>
      ))}
    </div>
  ),
};

export const Disabled: DemoCase = {
  render: () => (
    <div style={row}>
      {VARIANTS.map(([variant, label]) => (
        <Button key={variant} variant={variant} disabled>
          {label}
        </Button>
      ))}
    </div>
  ),
};

export const Loading: DemoCase = {
  render: () => (
    <div style={row}>
      {VARIANTS.map(([variant, label]) => (
        <Button key={variant} variant={variant} loading>
          {label}
        </Button>
      ))}
    </div>
  ),
};

export const WithIcon: DemoCase = {
  render: () => (
    <div style={row}>
      <Button variant="primary" icon={<Save size={14} />}>
        Save
      </Button>
      <Button variant="secondary" icon={<Save size={14} />}>
        Save
      </Button>
      <Button variant="danger" icon={<Trash2 size={14} />}>
        Delete
      </Button>
    </div>
  ),
};
