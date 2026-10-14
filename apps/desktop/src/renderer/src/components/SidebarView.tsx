import type { PersonRecord } from '@doru/core';
import { PersonList, PlaceholderView } from '@doru/features';
import { nls, type ActivityViewId } from '@doru/workbench';

/** Render cap for the People list on very large trees. */
const PEOPLE_LIST_LIMIT = 500;

export function SidebarView({
  activeView,
  persons,
  projectPath,
  onOpenPerson,
  onImportGedcom,
  onExportGedcom,
}: {
  activeView: ActivityViewId;
  persons: PersonRecord[];
  projectPath: string | null | undefined;
  onOpenPerson: (personId: string) => void;
  onImportGedcom: () => void;
  onExportGedcom: () => void;
}) {
  switch (activeView) {
    case 'people':
      if (persons.length === 0) {
        return (
          <PlaceholderView
            title={nls.t('workbench.activityBar.people')}
            description={nls.t('features.people.placeholder')}
          />
        );
      }
      return (
        <>
          <PersonList persons={persons.slice(0, PEOPLE_LIST_LIMIT)} onOpen={onOpenPerson} />
          {persons.length > PEOPLE_LIST_LIMIT && (
            <p className="side-bar-note">
              {nls.t('tree.people.listLimit', PEOPLE_LIST_LIMIT, persons.length)}
            </p>
          )}
        </>
      );
    case 'places':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.places')}
          description={nls.t('features.places.placeholder')}
        />
      );
    case 'sources':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.sources')}
          description={nls.t('features.sources.placeholder')}
        />
      );
    case 'tasks':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.tasks')}
          description={nls.t('features.tasks.placeholder')}
        />
      );
    case 'search':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.search')}
          description={nls.t('features.search.placeholder')}
        />
      );
    case 'import':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.import')}
          description={projectPath ? undefined : nls.t('workbench.tree.empty')}
        >
          <button disabled={!projectPath} onClick={onImportGedcom}>
            {nls.t('features.tree.importGedcom')}
          </button>
        </PlaceholderView>
      );
    case 'export':
      return (
        <PlaceholderView
          title={nls.t('workbench.activityBar.export')}
          description={projectPath ? undefined : nls.t('workbench.tree.empty')}
        >
          <button disabled={!projectPath} onClick={onExportGedcom}>
            {nls.t('features.tree.exportGedcom')}
          </button>
        </PlaceholderView>
      );
    default:
      return null;
  }
}
