import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ContributorsSection } from '../src/domain/contributors/ContributorsSection';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const noopAdd = vi.fn(async () => {});
const noopDelete = vi.fn(async () => {});

describe('ContributorsSection', () => {
  it('does not offer adding contributors to a task', () => {
    renderUi(
      <ContributorsSection
        targetType="task"
        targetId="T1"
        submitters={[]}
        links={[]}
        canAdd={false}
        onAdd={noopAdd}
        onDelete={noopDelete}
      />,
    );

    expect(screen.queryByRole('region', { name: nls.t('features.tree.contributors.title') })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: nls.t('features.tree.contributors.add') })).not.toBeInTheDocument();
  });

  it('offers adding contributors to a regular record', () => {
    renderUi(
      <ContributorsSection
        targetType="person"
        targetId="P1"
        submitters={[]}
        links={[]}
        onAdd={noopAdd}
        onDelete={noopDelete}
      />,
    );

    expect(screen.getByRole('region', { name: nls.t('features.tree.contributors.title') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: nls.t('features.tree.contributors.add') })).toBeInTheDocument();
  });
});
