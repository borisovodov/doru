import { NoticesView, SettingsView, TreeCanvas } from '@doru/features';
import { nls } from '@doru/workbench';
import { ExportView } from '../components/ExportView';
import { EXPORT_TAB_ID, NOTICES_TAB_ID, SETTINGS_TAB_ID, TREE_TAB_ID, type TabDescriptor } from './types';

export const treeTab: TabDescriptor = {
  kind: 'tree',
  id: TREE_TAB_ID,
  label: () => nls.t('features.tree.title'),
  render: (_id, context) => (
    // Keying by the project path resets canvas state (chart kind,
    // selection) when the user switches projects.
    <TreeCanvas
      key={context.projectPath ?? 'none'}
      persons={context.tree.persons}
      families={context.tree.families}
      photos={context.personPhotos}
      focusPersonId={context.treeFocusPersonId}
      onFocusPerson={context.onFocusPerson}
      api={{
        addPerson: context.tree.api.addPerson,
        addRelative: context.tree.addRelative,
        deletePerson: context.tree.deletePerson,
        updatePerson: context.tree.api.updatePerson,
        getPersonCounts: context.tree.personCounts,
        openEditor: context.tabs.open.person,
      }}
    />
  ),
};

export const settingsTab: TabDescriptor = {
  kind: 'settings',
  id: SETTINGS_TAB_ID,
  label: () => nls.t('workbench.settings'),
  render: (_id, context) => {
    const ai = context.ai;
    return (
      <SettingsView
        theme={context.theme.theme}
        themes={context.theme.themes}
        onThemeChange={context.theme.selectTheme}
        onOpenLogs={() => void window.doru.openLogs()}
        onOpenThemesFolder={() => void window.doru.openThemesFolder()}
        onOpenNotices={context.tabs.openStatic.notices}
        version={context.version}
        ai={
          ai.settings
            ? {
                settings: ai.settings,
                providers: ai.providers,
                test: ai.test,
                fetchedModels: ai.fetchedModels,
                modelFetch: ai.modelFetch,
                doruModel: ai.doruModel,
                onSetProvider: (id) => void ai.setProvider(id),
                onSetModel: ai.setModel,
                onSetBaseUrl: ai.setBaseUrl,
                onSetReasoning: ai.setReasoning,
                onSetApiKey: ai.setApiKey,
                onClearApiKey: ai.clearApiKey,
                onSetAcpCommand: ai.setAcpCommand,
                onSetAcpArgs: ai.setAcpArgs,
                onTest: () => void ai.runTest(),
                onFetchModels: (baseUrl) => void ai.fetchModels(baseUrl !== undefined ? { baseUrl } : undefined),
                onDownloadDoruModel: () => void ai.downloadDoruModel(),
                onCancelDoruModelDownload: () => void ai.cancelDoruModelDownload(),
                onDeleteDoruModel: () => void ai.deleteDoruModel(),
              }
            : null
        }
      />
    );
  },
};

export const noticesTab: TabDescriptor = {
  kind: 'notices',
  id: NOTICES_TAB_ID,
  label: () => nls.t('notices.title'),
  render: () => <NoticesView onOpenLink={(url) => void window.doru.openExternal(url)} />,
};

export const exportTab: TabDescriptor = {
  kind: 'export',
  id: EXPORT_TAB_ID,
  label: () => nls.t('workbench.exportGedcom'),
  render: (_id, context) => (
    <ExportView
      hasMedia={context.tree.media.length > 0}
      onExport={(format) => void context.project.exportGedcom(format)}
    />
  ),
};
