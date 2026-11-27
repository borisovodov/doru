import { useEffect, useMemo } from 'react';
import { CommandService, GEDCOM_INTEROP_VISIBLE } from '@doru/platform';
import { nls } from '@doru/workbench';
import type { useProject } from './useProject';
import type { useTabs } from './useTabs';
import type { useTreeData } from './useTreeData';
import type { NavigationHistoryApi } from './useNavigationHistory';

type ProjectApi = ReturnType<typeof useProject>;
type TabsApi = ReturnType<typeof useTabs>;
type TreeHistory = Pick<ReturnType<typeof useTreeData>, 'undo' | 'redo'>;

/**
 * Registers the renderer commands shared by the menu, the native menu and the
 * keybindings, and returns the command service with its keybinding table.
 */
export function useAppCommands(
  project: ProjectApi,
  tabs: TabsApi,
  tree: TreeHistory,
  navigation: NavigationHistoryApi,
) {
  const commands = useMemo(() => new CommandService(), []);
  const isMac = window.doru.platform === 'darwin';

  useEffect(() => {
    const removeOpen = commands.register({
      id: 'workbench.openProject',
      title: nls.t('workbench.openProject'),
      handler: () => project.openProject(),
    });
    const removeSave = commands.register({
      id: 'workbench.saveProject',
      title: nls.t('workbench.saveProject'),
      handler: () => project.saveProject(),
    });
    const removeCreate = commands.register({
      id: 'workbench.createProject',
      title: nls.t('workbench.createProject'),
      handler: () => project.createProject(),
    });
    const removeNewWindow = commands.register({
      id: 'workbench.newWindow',
      title: nls.t('workbench.newWindow'),
      handler: () => window.doru.menuAction('window.new'),
    });
    const removeExport = commands.register({
      id: 'workbench.exportGedcom',
      title: nls.t('workbench.exportGedcom'),
      handler: () => tabs.openStatic.export(),
    });
    const removeOpenSettings = commands.register({
      id: 'workbench.openSettings',
      title: nls.t('workbench.settings'),
      handler: () => tabs.openStatic.settings(),
    });
    const removeNextTab = commands.register({
      id: 'workbench.nextTab',
      title: nls.t('workbench.nextTab'),
      handler: () => tabs.nextTab(),
    });
    const removePrevTab = commands.register({
      id: 'workbench.prevTab',
      title: nls.t('workbench.prevTab'),
      handler: () => tabs.prevTab(),
    });
    const removeGoBack = commands.register({
      id: 'workbench.goBack',
      title: nls.t('workbench.goBack'),
      handler: () => navigation.goBack(),
    });
    const removeGoForward = commands.register({
      id: 'workbench.goForward',
      title: nls.t('workbench.goForward'),
      handler: () => navigation.goForward(),
    });
    const removeSwitchToTab = commands.register({
      id: 'workbench.switchToTab',
      title: nls.t('workbench.switchToTab'),
      handler: (index) => tabs.openTabAt(Number(index) - 1),
    });
    const removeUndo = commands.register({
      id: 'tree.undo',
      title: nls.t('workbench.undo'),
      handler: () => tree.undo(),
    });
    const removeRedo = commands.register({
      id: 'tree.redo',
      title: nls.t('workbench.redo'),
      handler: () => tree.redo(),
    });
    return () => {
      removeOpen.dispose();
      removeSave.dispose();
      removeCreate.dispose();
      removeNewWindow.dispose();
      removeExport.dispose();
      removeOpenSettings.dispose();
      removeNextTab.dispose();
      removePrevTab.dispose();
      removeGoBack.dispose();
      removeGoForward.dispose();
      removeSwitchToTab.dispose();
      removeUndo.dispose();
      removeRedo.dispose();
    };
  }, [
    commands,
    project.openProject,
    project.saveProject,
    project.createProject,
    tabs.openStatic.export,
    tabs.openStatic.settings,
    tabs.nextTab,
    tabs.prevTab,
    tabs.openTabAt,
    navigation.goBack,
    navigation.goForward,
    tree.undo,
    tree.redo,
  ]);

  const keybindings = useMemo(
    () => [
      { key: 'meta+z', command: 'tree.undo' },
      { key: 'ctrl+z', command: 'tree.undo' },
      { key: 'meta+shift+z', command: 'tree.redo' },
      { key: 'ctrl+shift+z', command: 'tree.redo' },
      { key: 'meta+s', command: 'workbench.saveProject' },
      { key: 'ctrl+s', command: 'workbench.saveProject' },
      { key: 'meta+o', command: 'workbench.openProject' },
      { key: 'ctrl+o', command: 'workbench.openProject' },
      { key: 'meta+n', command: 'workbench.createProject' },
      { key: 'ctrl+n', command: 'workbench.createProject' },
      { key: 'meta+shift+n', command: 'workbench.newWindow' },
      { key: 'ctrl+shift+n', command: 'workbench.newWindow' },
      { key: 'meta+,', command: 'workbench.openSettings' },
      { key: 'ctrl+,', command: 'workbench.openSettings' },
      { key: 'meta+shift+]', command: 'workbench.nextTab' },
      { key: 'meta+shift+[', command: 'workbench.prevTab' },
      { key: 'ctrl+tab', command: 'workbench.nextTab' },
      { key: 'ctrl+shift+tab', command: 'workbench.prevTab' },
      ...(isMac
        ? [
            { key: 'meta+[', command: 'workbench.goBack' },
            { key: 'meta+]', command: 'workbench.goForward' },
          ]
        : [
            { key: 'alt+left', command: 'workbench.goBack' },
            { key: 'alt+right', command: 'workbench.goForward' },
          ]),
      ...(GEDCOM_INTEROP_VISIBLE
        ? [
            { key: 'meta+shift+e', command: 'workbench.exportGedcom' },
            { key: 'ctrl+shift+e', command: 'workbench.exportGedcom' },
          ]
        : []),
      { key: 'meta+alt+b', command: 'workbench.toggleAgentChat' },
      { key: 'ctrl+alt+b', command: 'workbench.toggleAgentChat' },
      ...Array.from({ length: 9 }, (_, index) => [
        { key: `meta+${index + 1}`, command: 'workbench.switchToTab', args: [index + 1] },
        { key: `ctrl+${index + 1}`, command: 'workbench.switchToTab', args: [index + 1] },
      ]).flat(),
    ],
    [isMac],
  );

  return { commands, keybindings };
}
