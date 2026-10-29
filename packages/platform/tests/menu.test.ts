import { describe, expect, test } from 'vitest';
import { APP_MENU, menuPlatformOf, menuVisible } from '../src/menu';
import type { MenuItemEntry } from '../src/menu';

describe('menuPlatformOf', () => {
  test('maps process.platform values to menu platforms', () => {
    expect(menuPlatformOf('darwin')).toBe('macos');
    expect(menuPlatformOf('win32')).toBe('windows');
    expect(menuPlatformOf('linux')).toBe('linux');
    expect(menuPlatformOf('freebsd')).toBe('linux');
  });
});

describe('menuVisible', () => {
  test('entries without a platforms list are visible everywhere', () => {
    const entry = {};
    expect(menuVisible(entry, 'macos')).toBe(true);
    expect(menuVisible(entry, 'windows')).toBe(true);
    expect(menuVisible(entry, 'linux')).toBe(true);
  });

  test('entries with a platforms list are limited to those platforms', () => {
    const entry = { platforms: ['windows', 'linux'] as const };
    expect(menuVisible(entry, 'macos')).toBe(false);
    expect(menuVisible(entry, 'windows')).toBe(true);
  });
});

describe('APP_MENU', () => {
  test('uses unique entry ids', () => {
    const ids = APP_MENU.flatMap((group) => group.items)
      .filter((entry): entry is MenuItemEntry => entry.type === 'item')
      .map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every item has a command, an action, or a role', () => {
    for (const group of APP_MENU) {
      for (const entry of group.items) {
        if (entry.type !== 'item') {
          continue;
        }
        expect(entry.command ?? entry.action ?? entry.role, entry.id).toBeDefined();
      }
    }
  });

  test('native role groups are macOS-only', () => {
    const macGroups = APP_MENU.filter((group) => menuVisible(group, 'macos'));
    const windowsGroups = APP_MENU.filter((group) => menuVisible(group, 'windows'));
    expect(macGroups.some((group) => group.role === 'appMenu')).toBe(true);
    expect(macGroups.some((group) => group.role === 'windowMenu')).toBe(true);
    expect(windowsGroups.some((group) => group.role === 'appMenu')).toBe(false);
    expect(windowsGroups.some((group) => group.role === 'windowMenu')).toBe(false);
  });

  test('Quit lives only in the File menu on Windows/Linux (macOS has it in the app menu)', () => {
    const file = APP_MENU.find((group) => group.id === 'file');
    const quit = file?.items.find(
      (entry): entry is MenuItemEntry => entry.type === 'item' && entry.id === 'file.quit',
    );
    expect(quit).toBeDefined();
    expect(menuVisible(quit!, 'macos')).toBe(false);
    expect(menuVisible(quit!, 'windows')).toBe(true);
    expect(menuVisible(quit!, 'linux')).toBe(true);
  });

  test('keeps the id e2e tests address the agent chat toggle by', () => {
    const view = APP_MENU.find((group) => group.id === 'view');
    expect(view?.items.some((entry) => entry.type === 'item' && entry.id === 'toggle-agent-chat')).toBe(
      true,
    );
  });

  test('command items visible in the macOS menu always show an accelerator', () => {
    // Role groups (app, edit, window) render natively on macOS; only the
    // plain groups' items appear as command items.
    for (const group of APP_MENU.filter(
      (candidate) => menuVisible(candidate, 'macos') && !candidate.role,
    )) {
      for (const entry of group.items) {
        if (entry.type !== 'item' || !entry.command || !menuVisible(entry, 'macos')) {
          continue;
        }
        expect(entry.accelerator, entry.id).toBeDefined();
      }
    }
  });
});
