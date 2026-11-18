import type { Demo, DemoMeta } from '../../gallery/types';
import { Button } from '../atoms/button/Button';
import { Input } from '../atoms/form/Input';

const meta = {
  title: 'Foundations/Design language',
} satisfies DemoMeta;

export default meta;
type DemoCase = Demo;

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

export const Colors: DemoCase = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 140px)', gap: 'var(--doru-space-6)' }}>
      {COLORS.map(([token, label]) => (
        <div key={token} style={{ display: 'grid', gap: 'var(--doru-space-2)' }}>
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

export const Typography: DemoCase = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--doru-space-4)', maxWidth: 420 }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Entity title</h1>
      <h2 style={{ margin: 0, fontSize: 18 }}>Section heading</h2>
      <h3 style={{ margin: 0, fontSize: 13 }}>Card heading</h3>
      <p style={{ margin: 0 }}>Body text uses the 13px base size.</p>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--doru-fg-muted)' }}>Secondary text is 12px muted.</p>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--doru-fg-faint)' }}>Captions use 11px faint text.</p>
    </div>
  ),
};

export const Controls: DemoCase = {
  render: () => (
    <div style={{ display: 'grid', gap: 'var(--doru-space-6)', maxWidth: 360 }}>
      <div style={{ display: 'flex', gap: 'var(--doru-space-4)', alignItems: 'center' }}>
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="link">Link</Button>
      </div>
      <div style={{ display: 'grid', gap: 'var(--doru-space-4)' }}>
        <Input placeholder="Default control (28px)" />
        <Input controlSize="sm" placeholder="Compact control (24px)" />
        <Input controlSize="lg" placeholder="Prominent control (32px)" />
      </div>
    </div>
  ),
};
