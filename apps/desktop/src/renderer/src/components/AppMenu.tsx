import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import {
  APP_MENU,
  menuPlatformOf,
  menuVisible,
  type CommandService,
  type MenuEntry,
  type MenuPlatform,
} from '@doru/platform';
import { nls } from '@doru/workbench';
import './AppMenu.css';

interface AppMenuProps {
  commands: CommandService;
  platform: string;
}

/**
 * The in-window application menu for Windows/Linux, rendered from the same
 * `APP_MENU` model the native macOS menu bar uses. Commands run through the
 * CommandService; window-level entries go to the main process over the
 * `menu:action` IPC. macOS has the native menu bar and never renders this.
 */
export function AppMenu({ commands, platform }: AppMenuProps) {
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
      void window.doru.menuAction(entry.action);
    }
  };

  const groups = APP_MENU.map((group) => ({
    group,
    entries: group.items.filter((entry) => menuVisible(entry, menuPlatform)),
  })).filter(
    ({ group, entries }) => menuVisible(group, menuPlatform) && group.items.length > 0 && entries.length > 0,
  );

  return (
    <div className="app-menu" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={open ? 'app-menu-trigger open' : 'app-menu-trigger'}
        title={nls.t('menu.open')}
        aria-label={nls.t('menu.open')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Menu size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="app-menu-popup" role="menu">
          {groups.map(({ group, entries }) => (
            <div key={group.id} className="app-menu-group">
              {group.labelKey && (
                <div className="app-menu-group-label" role="presentation">
                  {nls.t(group.labelKey)}
                </div>
              )}
              {entries.map((entry, index) =>
                entry.type === 'separator' ? (
                  <div key={`separator-${index}`} className="app-menu-separator" role="separator" />
                ) : (
                  <button
                    key={entry.id}
                    type="button"
                    role="menuitem"
                    className="app-menu-item"
                    data-menu-item={entry.id}
                    onClick={() => runEntry(entry)}
                  >
                    <span className="app-menu-item-label">
                      {entry.labelKey ? nls.t(entry.labelKey) : entry.id}
                    </span>
                    {entry.hint && <span className="app-menu-item-hint">{entry.hint}</span>}
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
