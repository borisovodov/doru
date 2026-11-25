import type { CitationRecord, SourceRecord } from '@doru/core';
import { AttachmentsPanel, type AttachmentsPanelApi } from './AttachmentsPanel';

/** Notes and identifiers attached to a citation. No sources here:
 * citations → sources → citations would recurse. */
export function CitationAttachments({
  citation,
  api,
  sources,
  onOpenSource,
}: {
  citation: CitationRecord;
  api: AttachmentsPanelApi;
  sources: SourceRecord[];
  onOpenSource?: ((sourceId: string) => void) | undefined;
}) {
  return (
    <AttachmentsPanel
      targetType="citation"
      targetId={citation.id}
      api={api}
      sources={sources}
      onOpenSource={onOpenSource}
      sections={['notes', 'media', 'identifiers', 'contacts', 'contributors', 'tasks']}
    />
  );
}
