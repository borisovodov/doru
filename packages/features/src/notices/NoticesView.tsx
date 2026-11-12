import type { ThirdPartyNotice } from './types';
import { thirdPartyNotices } from './generated';
import { nls } from '../nls';
import './NoticesView.css';

export interface NoticesViewProps {
  /** Opens a project link in the system browser (http/https only). */
  onOpenLink: (url: string) => void;
}

export function NoticesView({ onOpenLink }: NoticesViewProps) {
  return (
    <section className="notices-view" aria-label={nls.t('notices.title')}>
      <p className="notices-intro">{nls.t('notices.description')}</p>
      {thirdPartyNotices.map((entry) => (
        <NoticeEntry key={entry.name} entry={entry} onOpenLink={onOpenLink} />
      ))}
    </section>
  );
}

function NoticeEntry({ entry, onOpenLink }: { entry: ThirdPartyNotice; onOpenLink: (url: string) => void }) {
  const url = entry.url;
  return (
    <article className="notices-entry" aria-label={entry.name}>
      {url !== undefined ? (
        <a
          className="notices-name"
          href={url}
          onClick={(event) => {
            event.preventDefault();
            onOpenLink(url);
          }}
        >
          {entry.name}
        </a>
      ) : (
        <span className="notices-name">{entry.name}</span>
      )}
      {entry.text !== '' ? (
        <details className="notices-text">
          <summary>{entry.license}</summary>
          <pre>{entry.text}</pre>
        </details>
      ) : null}
    </article>
  );
}
