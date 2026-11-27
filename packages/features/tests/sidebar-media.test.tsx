import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { SidebarMedia } from '../src/sidebar/SidebarMedia';
import { renderUi } from '../../../test/ui/harness';

describe('SidebarMedia', () => {
  it('labels rows by title, then file name, then URL fragment', () => {
    renderUi(
      <SidebarMedia
        persons={[]}
        onOpenMedia={vi.fn()}
        media={[
          { id: 'M1', title: 'Portrait', path: 'media/abc.jpg', absolutePath: '/demo/abc.jpg' },
          { id: 'M2', path: 'media/family.jpg', absolutePath: '/demo/family.jpg' },
          { id: 'M3', path: 'https://example.com/photos/anna.jpg?token=1', absolutePath: '' },
        ]}
      />,
    );

    expect(screen.getByRole('button', { name: 'Portrait' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'family.jpg' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'anna.jpg' })).toBeInTheDocument();
  });
});
