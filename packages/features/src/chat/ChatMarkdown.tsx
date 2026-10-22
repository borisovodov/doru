import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

export interface ChatMarkdownProps {
  text: string;
  /** Called when a link is clicked; the click never navigates the app window. */
  onOpenLink?: (url: string) => void;
}

/**
 * Renders the assistant reply as GitHub-flavored Markdown: headings, lists,
 * tables, task lists, strikethrough, code blocks, single-newline breaks.
 * No syntax highlighting — Dóru is a genealogy app, not an IDE. Raw HTML is
 * not rendered, and images are dropped: a remote <img> would make the
 * renderer fetch a model-chosen URL on sight, leaking the user's IP to a
 * third party they never agreed to contact.
 */
export function ChatMarkdown({ text, onOpenLink }: ChatMarkdownProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      components={{
        a: ({ href, children }) => (
          <a
            href={href}
            onClick={(event) => {
              event.preventDefault();
              if (href) {
                onOpenLink?.(href);
              }
            }}
          >
            {children}
          </a>
        ),
        img: () => null,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
