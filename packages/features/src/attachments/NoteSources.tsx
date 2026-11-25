import type { NoteRecord, SourceRecord } from '@doru/core';
import { SourcesSection } from '@doru/ui/domain';
import type { AttachmentsApi } from '../person/types';
import { useCitations } from './useAttachments';

/**
 * The sources cited by one note. A note is a citation target only: sources
 * may cite it, but no other attachment can point at it.
 */
export function NoteSources({
  note,
  api,
  sources,
  onOpenSource,
}: {
  note: NoteRecord;
  api: AttachmentsApi;
  sources: SourceRecord[];
  onOpenSource?: ((sourceId: string) => void) | undefined;
}) {
  const { citations, refresh } = useCitations('note', note.id, api);
  return (
    <SourcesSection
      targetType="note"
      targetId={note.id}
      sources={sources}
      citations={citations}
      refresh={refresh}
      onAddSource={api.addSource}
      onAttachSource={api.attachSource}
      onDetachCitation={api.detachCitation}
      onUpdateCitation={api.updateCitation}
      onOpenSource={onOpenSource ?? (() => undefined)}
    />
  );
}
