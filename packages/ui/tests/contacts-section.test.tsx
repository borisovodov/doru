import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { ContactsSection } from '../src/domain/attachments/AttachmentsSection';
import { nls } from '../src/nls';
import { renderUi } from '../../../test/ui/harness';

const noopAdd = vi.fn(async () => {});
const noopUpdate = vi.fn(async () => {});
const noopDelete = vi.fn(async () => {});

function section(targetType: string, contacts: Parameters<typeof ContactsSection>[0]['contacts'] = []) {
  return (
    <ContactsSection
      targetType={targetType}
      targetId="X1"
      contacts={contacts}
      onAdd={noopAdd}
      onUpdate={noopUpdate}
      onDelete={noopDelete}
    />
  );
}

describe('ContactsSection', () => {
  it('offers the canonical kinds on every target', () => {
    renderUi(section('person'));

    const labels = within(screen.getByRole('combobox'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(labels).toEqual([
      nls.t('features.tree.contacts.kind.email'),
      nls.t('features.tree.contacts.kind.phone'),
      nls.t('features.tree.contacts.kind.fax'),
      nls.t('features.tree.contacts.kind.www'),
      nls.t('features.tree.contacts.kind.skype'),
      nls.t('features.tree.contacts.kind.jabber'),
    ]);
    expect(labels).not.toContain(nls.t('features.tree.contacts.kind.url'));
  });

  it('shows a legacy url with the URL label and edits it as a website', () => {
    renderUi(
      section('person', [
        { id: 'C1', targetType: 'person', targetId: 'X1', kind: 'url', value: 'https://legacy.example' },
      ]),
    );

    expect(screen.getByText(nls.t('features.tree.contacts.kind.url'))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: nls.t('features.tree.contacts.edit') }));

    const kinds = screen.getAllByRole('combobox').map((select) => (select as HTMLSelectElement).value);
    expect(kinds).toContain('www');
    expect(kinds).not.toContain('url');
  });
});
