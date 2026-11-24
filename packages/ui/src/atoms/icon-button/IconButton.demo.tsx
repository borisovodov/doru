import type { Demo, DemoMeta } from '../../../gallery/types';
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
} satisfies DemoMeta<typeof IconButton>;

export default meta;
type DemoCase = Demo;

const VARIANTS: ReadonlyArray<[IconButtonVariant, string]> = [
  ['ghost', 'Ghost'],
  ['active', 'Active'],
  ['primary', 'Primary'],
  ['secondary', 'Secondary'],
  ['danger', 'Danger'],
];

const SIZES: ReadonlyArray<[IconButtonSize, string]> = [
  ['sm', 'Small'],
  ['md', 'Medium'],
  ['lg', 'Large'],
  ['nav', 'Navigation'],
];

const row = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
} as const;

function iconFor(variant: IconButtonVariant) {
  if (variant === 'danger') {
    return <Trash2 size={16} />;
  }
  if (variant === 'primary') {
    return <Plus size={16} />;
  }
  if (variant === 'active') {
    return <Settings size={16} />;
  }
  return <Pencil size={16} />;
}

export const Variants: DemoCase = {
  render: () => (
    <div style={row}>
      {VARIANTS.map(([variant, label]) => (
        <IconButton key={variant} variant={variant} label={label} icon={iconFor(variant)} />
      ))}
    </div>
  ),
};

export const Sizes: DemoCase = {
  render: () => (
    <div style={row}>
      {SIZES.map(([size, label]) => (
        <IconButton key={size} size={size} variant="ghost" label={`Edit ${label}`} icon={<Pencil size={16} />} />
      ))}
    </div>
  ),
};

export const Disabled: DemoCase = {
  render: () => (
    <div style={row}>
      {VARIANTS.map(([variant, label]) => (
        <IconButton key={variant} variant={variant} label={`${label} disabled`} icon={iconFor(variant)} disabled />
      ))}
    </div>
  ),
};

export const WithShortcut: DemoCase = {
  render: () => (
    <div style={row}>
      <IconButton label="Edit person" shortcut="⌘E" icon={<Pencil size={16} />} />
      <IconButton label="Add person" shortcut="⌘N" icon={<Plus size={16} />} />
    </div>
  ),
};
