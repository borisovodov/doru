import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import type { CitationRecord } from '@doru/core';
import { CitationEditor } from '../src/domain/citation/CitationEditor';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const citation: CitationRecord = {
  id: 'C1',
  sourceId: 'S1',
  targetType: 'person',
  targetId: 'P1',
  description: 'The 1850 census entry',
  footnote: 'Census, 1850, p. 12',
};

describe('CitationEditor', () => {
  it('edits long citation text in multiline fields', () => {
    renderUi(<CitationEditor citation={citation} onSave={vi.fn(async () => undefined)} onCancel={vi.fn()} />);

    expect(screen.getByLabelText(nls.t('features.tree.citation.description')).tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText(nls.t('features.tree.citation.footnote')).tagName).toBe('TEXTAREA');
    expect(screen.getByLabelText(nls.t('features.tree.citation.texts')).tagName).toBe('TEXTAREA');
  });
});
