import { useCallback, useRef, useState } from 'react';

/** The lifecycle controls an entity editor's autosave exposes to deletion. */
export interface DeleteAutoSaveControl {
  cancel(): void;
  resume(): void;
  release(): void;
}

/**
 * Runs one entity deletion at a time. The guard is synchronous so a second
 * click cannot resume autosave while the first delete is still pending.
 */
export function useEntityDelete(
  autoSave: DeleteAutoSaveControl,
  remove: () => Promise<void>,
  onClose: () => void,
): { deleting: boolean; failed: boolean; deleteEntity: () => void } {
  const pendingRef = useRef(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  const deleteEntity = useCallback(() => {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setDeleting(true);
    setFailed(false);
    autoSave.cancel();
    void Promise.resolve()
      .then(remove)
      .then(
        () => {
          autoSave.release();
          onClose();
        },
        () => {
          pendingRef.current = false;
          setDeleting(false);
          setFailed(true);
          autoSave.resume();
        },
      );
  }, [autoSave, onClose, remove]);

  return { deleting, failed, deleteEntity };
}
