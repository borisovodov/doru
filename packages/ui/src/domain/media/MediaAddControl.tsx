import { ChevronDown, FolderOpen, Link2, Plus } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type SubmitEvent } from 'react';
import { normalizeMediaUrl } from '@doru/core/model';
import { Button } from '../../atoms/button/Button';
import { Field } from '../../atoms/field/Field';
import { Input } from '../../atoms/form/Input';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { cx } from '../../lib/cx';
import { nls } from '../../nls';
import styles from './MediaAddControl.module.css';

export interface MediaAddControlProps {
  /** Visible label or compact tooltip. */
  label: string;
  /** Renders an icon-only trigger for a side-bar title row. */
  compact?: boolean;
  disabled?: boolean;
  onAddFiles: () => void;
  onAddUrl: (url: string) => Promise<void>;
}

type Mode = 'menu' | 'url';

/**
 * The add-media trigger shared by the media side bar and target editors. It
 * offers a file picker and a direct image link, and keeps the URL form and
 * its feedback inside the anchored popover.
 */
export function MediaAddControl({
  label,
  compact = false,
  disabled = false,
  onAddFiles,
  onAddUrl,
}: MediaAddControlProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('menu');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setMode('menu');
    setUrl('');
    setError(undefined);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (mode === 'url') {
      inputRef.current?.focus();
      return;
    }
    firstItemRef.current?.focus();
  }, [open, mode]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (pending) {
        return;
      }
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        close();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeydown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeydown);
    };
  }, [open, pending, close]);

  const toggle = () => {
    if (open) {
      if (!pending) {
        close();
      }
      return;
    }
    setMode('menu');
    setUrl('');
    setError(undefined);
    setOpen(true);
  };

  const chooseFiles = () => {
    close();
    onAddFiles();
  };

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) {
      return;
    }
    const normalized = normalizeMediaUrl(url);
    if (normalized === undefined) {
      setError(nls.t('features.tree.media.linkInvalid'));
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      await onAddUrl(normalized);
      setPending(false);
      close();
      triggerRef.current?.focus();
    } catch {
      setError(nls.t('features.tree.media.linkFailed'));
      setPending(false);
      inputRef.current?.focus();
    }
  };

  const triggerProps = {
    'aria-haspopup': 'menu',
    'aria-expanded': open,
  } as const;

  return (
    <div className={styles['root']} ref={rootRef}>
      {compact ? (
        <IconButton
          ref={triggerRef}
          size="sm"
          variant={open ? 'active' : 'ghost'}
          label={label}
          icon={<Plus size={14} aria-hidden="true" />}
          disabled={disabled}
          onClick={toggle}
          {...triggerProps}
        />
      ) : (
        <Button
          ref={triggerRef}
          variant="secondary"
          icon={<Plus size={15} aria-hidden="true" />}
          disabled={disabled}
          onClick={toggle}
          {...triggerProps}
        >
          {label}
          <ChevronDown className={styles['chevron']} size={14} aria-hidden="true" />
        </Button>
      )}
      {open ? (
        <div
          className={cx(styles['popup'], compact && styles['popupCompact'])}
          role={mode === 'menu' ? 'menu' : 'dialog'}
          aria-label={mode === 'url' ? nls.t('features.tree.media.addFromLink') : undefined}
        >
          {mode === 'menu' ? (
            <>
              <button ref={firstItemRef} type="button" role="menuitem" className={styles['item']} onClick={chooseFiles}>
                <FolderOpen size={15} aria-hidden="true" />
                <span>{nls.t('features.tree.media.addFromComputer')}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                className={styles['item']}
                onClick={() => {
                  setMode('url');
                  setError(undefined);
                }}
              >
                <Link2 size={15} aria-hidden="true" />
                <span>{nls.t('features.tree.media.addFromLink')}</span>
              </button>
            </>
          ) : (
            <form className={styles['form']} onSubmit={(event) => void submit(event)}>
              <Field
                label={nls.t('features.tree.media.linkLabel')}
                hint={nls.t('features.tree.media.linkHint')}
                {...(error !== undefined ? { error } : {})}
              >
                <Input
                  ref={inputRef}
                  type="text"
                  inputMode="url"
                  value={url}
                  disabled={pending}
                  invalid={error !== undefined}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => {
                    setUrl(event.target.value);
                    setError(undefined);
                  }}
                />
              </Field>
              <div className={styles['buttons']}>
                <Button variant="ghost" size="sm" type="button" disabled={pending} onClick={close}>
                  {nls.t('features.tree.media.linkCancel')}
                </Button>
                <Button variant="primary" size="sm" type="submit" loading={pending}>
                  {nls.t('features.tree.media.linkAdd')}
                </Button>
              </div>
            </form>
          )}
        </div>
      ) : null}
    </div>
  );
}
