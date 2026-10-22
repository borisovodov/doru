import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatMarkdown } from '../src/chat/ChatMarkdown';

function renderMarkdown(text: string): string {
  return renderToStaticMarkup(createElement(ChatMarkdown, { text }));
}

describe('ChatMarkdown', () => {
  it('renders GitHub-flavored markdown elements', () => {
    const html = renderMarkdown('# Heading\n\nSome **bold** and `code`.\n\n- one\n- two');
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>one</li>');
  });

  it('turns single newlines into breaks', () => {
    const html = renderMarkdown('first line\nsecond line');
    expect(html).toContain('first line');
    expect(html).toContain('<br/>');
    expect(html).toContain('second line');
  });

  it('renders links as anchors with their href', () => {
    const html = renderMarkdown('see [docs](https://example.com)');
    expect(html).toContain('<a href="https://example.com">docs</a>');
  });

  it('drops raw HTML from the model', () => {
    const html = renderMarkdown('hello <script>alert(1)</script> <b>world</b>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<b>');
    expect(html).toContain('hello');
    expect(html).toContain('world');
  });

  it('drops images so the renderer never fetches model-chosen URLs', () => {
    const html = renderMarkdown('look ![x](https://evil.example/pixel.png)');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('evil.example');
  });

  it('renders code blocks as pre blocks', () => {
    const html = renderMarkdown('```\nconst x = 1;\n```');
    expect(html).toContain('<pre>');
    expect(html).toContain('const x = 1;');
  });
});
