import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { MediaAddControl } from '../src/domain/media/MediaAddControl';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const filesLabel = 'Add media';

describe('MediaAddControl', () => {
  it('offers the file picker and the link form', () => {
    const onAddFiles = vi.fn();
    renderUi(<MediaAddControl label={filesLabel} onAddFiles={onAddFiles} onAddUrl={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: filesLabel }));
    fireEvent.click(screen.getByRole('menuitem', { name: nls.t('features.tree.media.addFromComputer') }));
    expect(onAddFiles).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('adds a normalized link and closes the popover', async () => {
    const onAddUrl = vi.fn(async () => undefined);
    renderUi(<MediaAddControl label={filesLabel} onAddFiles={vi.fn()} onAddUrl={onAddUrl} />);

    fireEvent.click(screen.getByRole('button', { name: filesLabel }));
    fireEvent.click(screen.getByRole('menuitem', { name: nls.t('features.tree.media.addFromLink') }));
    fireEvent.change(screen.getByLabelText(nls.t('features.tree.media.linkLabel')), {
      target: { value: 'example.com/photo.jpg' },
    });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.media.linkAdd') }));

    await waitFor(() => expect(onAddUrl).toHaveBeenCalledWith('https://example.com/photo.jpg'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects a non-http link without calling the API', () => {
    const onAddUrl = vi.fn(async () => undefined);
    renderUi(<MediaAddControl label={filesLabel} onAddFiles={vi.fn()} onAddUrl={onAddUrl} />);

    fireEvent.click(screen.getByRole('button', { name: filesLabel }));
    fireEvent.click(screen.getByRole('menuitem', { name: nls.t('features.tree.media.addFromLink') }));
    fireEvent.change(screen.getByLabelText(nls.t('features.tree.media.linkLabel')), {
      target: { value: 'ftp://example.com/photo.jpg' },
    });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.media.linkAdd') }));

    expect(screen.getByText(nls.t('features.tree.media.linkInvalid'))).toBeInTheDocument();
    expect(onAddUrl).not.toHaveBeenCalled();
  });

  it('keeps the form open and shows a failure message', async () => {
    const onAddUrl = vi.fn(async () => {
      throw new Error('unsupported');
    });
    renderUi(<MediaAddControl label={filesLabel} onAddFiles={vi.fn()} onAddUrl={onAddUrl} />);

    fireEvent.click(screen.getByRole('button', { name: filesLabel }));
    fireEvent.click(screen.getByRole('menuitem', { name: nls.t('features.tree.media.addFromLink') }));
    fireEvent.change(screen.getByLabelText(nls.t('features.tree.media.linkLabel')), {
      target: { value: 'https://example.com/photo.png' },
    });
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.media.linkAdd') }));

    await waitFor(() => expect(screen.getByText(nls.t('features.tree.media.linkFailed'))).toBeInTheDocument());
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
