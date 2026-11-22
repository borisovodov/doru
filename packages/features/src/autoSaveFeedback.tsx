import { Button, InlineError } from '@doru/ui';
import { nls } from './nls';

/**
 * The inline failure notice for autosaved edits. The draft stays in place;
 * Retry runs the same save path again.
 */
export function AutoSaveError({ failed, onRetry }: { failed: boolean; onRetry: () => void }) {
  if (!failed) {
    return null;
  }
  return (
    <InlineError>
      {nls.t('features.tree.autosaveFailed')}{' '}
      <Button variant="link" size="sm" data-autosave-skip="true" onClick={onRetry}>
        {nls.t('features.tree.retry')}
      </Button>
    </InlineError>
  );
}
