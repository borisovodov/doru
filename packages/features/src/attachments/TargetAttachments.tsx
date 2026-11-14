import type { CitationRecord, NoteRecord, SourceRecord } from '@doru/core';
import { AttachmentsPanel, type AttachmentsPanelApi } from './AttachmentsPanel';

/** Notes, tags and identifiers attached to a citation. No sources here:
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
      sections={['notes', 'tags', 'identifiers', 'contacts', 'restrictions', 'changes']}
    />
  );
}

/** Sources and other attachments of a note. No nested notes: a note cannot
 * own another note in the UI. */
export function NoteAttachments({
  note,
  api,
  sources,
  onOpenSource,
}: {
  note: NoteRecord;
  api: AttachmentsPanelApi;
  sources: SourceRecord[];
  onOpenSource?: ((sourceId: string) => void) | undefined;
}) {
  return (
    <AttachmentsPanel
      targetType="note"
      targetId={note.id}
      api={api}
      sources={sources}
      onOpenSource={onOpenSource}
      sections={['sources', 'tags', 'identifiers', 'contacts', 'restrictions', 'changes']}
    />
  );
}
