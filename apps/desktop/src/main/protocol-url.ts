/**
 * Parses `doru://` deep links.
 *
 * Links have the shape `doru://open?path=<project file>`: the `path` query
 * parameter carries the URL-encoded absolute path, and the host part
 * (`open`) carries no meaning yet. Returns the decoded path, or `null` when
 * the URL does not parse, is not a `doru:` link, or carries no `path`.
 */
export function parseProtocolUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'doru:') {
      return null;
    }
    return parsed.searchParams.get('path') || null;
  } catch {
    return null;
  }
}
