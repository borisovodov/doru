import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { ContributorsSection } from '../src/domain/contributors/ContributorsSection';
import { ResearchInterestsSection } from '../src/domain/contributors/ResearchInterestsSection';
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

  it('does not show research interests among contributors', () => {
    renderUi(
      <ContributorsSection
        targetType="person"
        targetId="P1"
        submitters={[{ id: 'S1', name: 'Ivan Petrov' }]}
        links={[
          {
            id: 'L1',
            submitterId: 'S1',
            targetType: 'person',
            targetId: 'P1',
            kind: 'ancestor_interest',
          },
        ]}
        onAdd={noopAdd}
        onDelete={noopDelete}
      />,
    );

    expect(screen.queryByText('Ivan Petrov')).not.toBeInTheDocument();
    expect(screen.getByText(nls.t('features.tree.contributors.empty'))).toBeInTheDocument();
  });

  it('lists ancestor and descendant interests with their own labels', () => {
    renderUi(
      <ResearchInterestsSection
        targetType="person"
        targetId="P1"
        submitters={[
          { id: 'S1', name: 'Ivan Petrov' },
          { id: 'S2', name: 'Maria Ivanova' },
        ]}
        links={[
          {
            id: 'L1',
            submitterId: 'S1',
            targetType: 'person',
            targetId: 'P1',
            kind: 'ancestor_interest',
          },
          {
            id: 'L2',
            submitterId: 'S2',
            targetType: 'person',
            targetId: 'P1',
            kind: 'descendant_interest',
          },
        ]}
        onAdd={noopAdd}
        onDelete={noopDelete}
      />,
    );

    expect(screen.getByRole('region', { name: nls.t('features.tree.researchInterests.title') })).toBeInTheDocument();
    expect(screen.getByText(nls.t('features.tree.contributors.kind.ancestor_interest'))).toBeInTheDocument();
    expect(screen.getByText(nls.t('features.tree.contributors.kind.descendant_interest'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: nls.t('features.tree.researchInterests.add') })).toBeInTheDocument();
  });
});
