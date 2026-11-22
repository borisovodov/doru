import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { IdentifiersSection } from '../src/domain/attachments/AttachmentsSection';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const noopAdd = vi.fn(async () => {});
const noopUpdate = vi.fn(async () => {});
const noopDelete = vi.fn(async () => {});

describe('IdentifiersSection', () => {
  it('does not offer adding identifiers to a task', () => {
    renderUi(
      <IdentifiersSection
        targetType="task"
        targetId="T1"
        identifiers={[]}
        canAdd={false}
        onAdd={noopAdd}
        onUpdate={noopUpdate}
        onDelete={noopDelete}
      />,
    );

    expect(screen.queryByRole('region', { name: nls.t('features.tree.identifiers.title') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: nls.t('features.tree.identifiers.add') })).not.toBeInTheDocument();
  });

  it('offers adding identifiers to a regular record', () => {
    renderUi(
      <IdentifiersSection
        targetType="person"
        targetId="P1"
        identifiers={[]}
        onAdd={noopAdd}
        onUpdate={noopUpdate}
        onDelete={noopDelete}
      />,
    );

    expect(screen.getByRole('region', { name: nls.t('features.tree.identifiers.title') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: nls.t('features.tree.identifiers.add') })).toBeInTheDocument();
  });
});
