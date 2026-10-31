import { PlaceholderView } from '@doru/features';
import { nls } from '@doru/workbench';
import './ExportView.css';

/**
 * The export tab. Formats land here one by one; the GEDCOM export is the
 * first. The tab opens from the command menu / shortcut instead of the
 * activity bar.
 */
export function ExportView({ onExportGedcom }: { onExportGedcom: () => void }) {
  return (
    <div className="export-view">
      <PlaceholderView
        title={nls.t('workbench.exportGedcom')}
        description={nls.t('features.export.placeholder')}
      >
        <button onClick={onExportGedcom}>{nls.t('features.tree.exportGedcom')}</button>
      </PlaceholderView>
    </div>
  );
}
