import { useState } from 'react';
import { Button, SegmentedControl } from '@doru/ui';
import { PlaceholderView } from '@doru/features';
import { nls } from '@doru/workbench';
import './ExportView.css';

type ExportFormat = 'ged' | 'gdz';

/**
 * The export tab: format settings and the confirmation button. The save
 * dialog opens only when the user presses the button, so the format choice
 * is made here.
 */
export function ExportView({ hasMedia, onExport }: { hasMedia: boolean; onExport: (format: ExportFormat) => void }) {
  const [format, setFormat] = useState<ExportFormat>(hasMedia ? 'gdz' : 'ged');
  return (
    <div className="export-view">
      <PlaceholderView title={nls.t('workbench.exportGedcom')} description={nls.t('features.export.placeholder')}>
        <SegmentedControl
          label={nls.t('features.export.format')}
          value={format}
          onChange={setFormat}
          options={[
            { value: 'ged', label: nls.t('features.export.format.ged') },
            { value: 'gdz', label: nls.t('features.export.format.gdz') },
          ]}
        />
        <p className="export-view-hint">
          {format === 'gdz' ? nls.t('features.export.gdz.hint') : nls.t('features.export.ged.hint')}
        </p>
        <Button variant="primary" onClick={() => onExport(format)}>
          {nls.t('features.tree.exportGedcom')}
        </Button>
      </PlaceholderView>
    </div>
  );
}
