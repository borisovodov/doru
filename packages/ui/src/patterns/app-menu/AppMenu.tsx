import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu as MenuIcon } from 'lucide-react';
import {
  APP_MENU,
  menuPlatformOf,
  menuVisible,
  type CommandService,
  type MenuAction,
  type MenuEntry,
  type MenuPlatform,
} from '@doru/platform';
import { IconButton } from '../../atoms/icon-button/IconButton';
import { nls } from '../../nls';
import styles from './AppMenu.module.css';

export interface AppMenuProps {
  commands: CommandService;
  platform: string;
  /** Runs a main-process window action (for example `app.quit`). */
  onMenuAction: (action: MenuAction) => void;
}

/**
 * The in-window application menu for Windows/Linux, rendered from the same
 * `APP_MENU` model the native macOS menu bar uses. Commands run through the
 * CommandService; window-level entries go to the host through
 * `onMenuAction`. macOS has the native menu bar and never renders this.
 */
export function AppMenu({ commands, platform, onMenuAction }: AppMenuProps) {
  const menuPlatform: MenuPlatform = menuPlatformOf(platform);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        close();
      }
    };
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
  }, [open, close]);

  const runEntry = (entry: MenuEntry) => {
    if (entry.type === 'separator') {
      return;
    }
    close();
    if (entry.command) {
      void commands.execute(entry.command).catch(() => undefined);
    } else if (entry.action) {
      onMenuAction(entry.action);
    }
  };

  const groups = APP_MENU.map((group) => ({
    group,
    entries: group.items.filter((entry) => menuVisible(entry, menuPlatform)),
  })).filter(({ group, entries }) => menuVisible(group, menuPlatform) && group.items.length > 0 && entries.length > 0);

  return (
    <div className={styles['menu']} ref={rootRef}>
      <IconButton
        ref={triggerRef}
        className={styles['trigger']}
        size="md"
        variant={open ? 'active' : 'ghost'}
        label={nls.t('menu.open')}
        icon={<MenuIcon size={16} aria-hidden="true" />}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <div className={styles['popup']} role="menu">
          {groups.map(({ group, entries }) => (
            <div key={group.id} className={styles['group']}>
              {group.labelKey && (
                <div className={styles['groupLabel']} role="presentation">
                  {nls.t(group.labelKey)}
                </div>
              )}
              {entries.map((entry, index) =>
                entry.type === 'separator' ? (
                  // The menu model is static, so separator positions are stable.
                  // eslint-disable-next-line @eslint-react/no-array-index-key
                  <div key={`separator-${index}`} className={styles['separator']} role="separator" />
                ) : (
                  <button
                    key={entry.id}
                    type="button"
                    role="menuitem"
                    className={styles['item']}
                    data-menu-item={entry.id}
                    onClick={() => runEntry(entry)}
                  >
                    <span className={styles['itemLabel']}>{entry.labelKey ? nls.t(entry.labelKey) : entry.id}</span>
                    {entry.hint && <span className={styles['itemHint']}>{entry.hint}</span>}
                  </button>
                ),
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
