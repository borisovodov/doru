import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '../atoms/button/Button';
import { Input } from '../atoms/form/Input';

const meta = {
  title: 'Foundations/Design language',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const COLORS = [
  ['bg-canvas', 'Canvas'],
  ['bg-chrome', 'Chrome'],
  ['bg-raised', 'Raised'],
  ['bg-popover', 'Popover'],
  ['bg-input', 'Input'],
  ['fg', 'Text'],
  ['fg-muted', 'Text muted'],
  ['fg-faint', 'Text faint'],
  ['accent', 'Accent'],
  ['accent-hover', 'Accent hover'],
  ['success', 'Success'],
  ['warning', 'Warning'],
  ['danger', 'Danger'],
  ['info', 'Info'],
] as const;

export const Colors: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 140px)', gap: 12 }}>
      {COLORS.map(([token, label]) => (
        <div key={token} style={{ display: 'grid', gap: 4 }}>
          <div
            style={{
              height: 56,
              borderRadius: 8,
              border: '1px solid var(--doru-border)',
              background: `var(--doru-${token})`,
            }}
          />
          <strong style={{ fontSize: 12 }}>{label}</strong>
          <code style={{ fontSize: 11, color: 'var(--doru-fg-muted)' }}>--doru-{token}</code>
        </div>
      ))}
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Entity title</h1>
      <h2 style={{ margin: 0, fontSize: 18 }}>Section heading</h2>
      <h3 style={{ margin: 0, fontSize: 13 }}>Card heading</h3>
      <p style={{ margin: 0 }}>Body text uses the 13px base size.</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--doru-fg-muted)' }}>Secondary text is 12px muted.</p>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--doru-fg-faint)' }}>Captions use 11px faint text.</p>
    </div>
  ),
};

export const Controls: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12, maxWidth: 360 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="link">Link</Button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        <Input placeholder="Default control (28px)" />
        <Input controlSize="sm" placeholder="Compact control (24px)" />
        <Input controlSize="lg" placeholder="Prominent control (32px)" />
      </div>
    </div>
  ),
};
