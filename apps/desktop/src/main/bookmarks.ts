import { app } from 'electron';
import { log } from './log';

/**
 * Security-scoped bookmarks for the macOS App Sandbox.
 *
 * A sandboxed MAS build loses the file access granted by an open/save dialog
 * or a Finder double-click as soon as the app quits. The only way to regain
 * access to a user-picked file across launches is a security-scoped bookmark:
 * the app mints one while it has access, persists the base64 data in
 * recent.json, and resolves it through
 * `app.startAccessingSecurityScopedResource` when the project is reopened.
 *
 * Electron can resolve bookmarks but not create them, so creation goes
 * through koffi (FFI) into CoreFoundation's `CFURLCreateBookmarkData`.
 *
 * The same code runs in every macOS build — MAS, Homebrew, direct download.
 * Outside the sandbox bookmarks are harmless, so the distribution channel
 * never changes behavior. Non-macOS builds store plain paths only.
 */

interface BookmarkFfi {
  create(filePath: string): string | null;
}

let ffi: BookmarkFfi | null = null;

async function bookmarkFfi(): Promise<BookmarkFfi | null> {
  if (ffi) {
    return ffi;
  }
  const koffi = (await import('koffi')).default;
  const cf = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
  const CFStringCreateWithCString = cf.func('CFStringCreateWithCString', 'void *', [
    'void *',
    'string',
    'uint32',
  ]);
  const CFURLCreateWithFileSystemPath = cf.func('CFURLCreateWithFileSystemPath', 'void *', [
    'void *',
    'void *',
    'int',
    'bool',
  ]);
  const CFURLCreateBookmarkData = cf.func('CFURLCreateBookmarkData', 'void *', [
    'void *',
    'void *',
    'uint64',
    'void *',
    'void *',
    'void *',
  ]);
  const CFDataGetLength = cf.func('CFDataGetLength', 'int64', ['void *']);
  const CFDataGetBytePtr = cf.func('CFDataGetBytePtr', 'void *', ['void *']);

  const kCFStringEncodingUTF8 = 0x08000100;
  const kCFURLBookmarkCreationWithSecurityScope = 1 << 11;

  ffi = {
    create(filePath) {
      const string = CFStringCreateWithCString(null, filePath, kCFStringEncodingUTF8);
      if (!string) {
        return null;
      }
      const url = CFURLCreateWithFileSystemPath(null, string, 0, false);
      if (!url) {
        return null;
      }
      const data = CFURLCreateBookmarkData(
        null,
        url,
        kCFURLBookmarkCreationWithSecurityScope,
        null,
        null,
        null,
      );
      if (!data) {
        return null;
      }
      const length = Number(CFDataGetLength(data));
      const bytes = koffi.decode(CFDataGetBytePtr(data), koffi.array('uint8', length));
      return Buffer.from(bytes).toString('base64');
    },
  };
  return ffi;
}

/** Mints a bookmark for the file the app currently has access to (macOS). */
export async function createBookmark(filePath: string): Promise<string | null> {
  if (process.platform !== 'darwin') {
    return null;
  }
  try {
    return (await bookmarkFfi())?.create(filePath) ?? null;
  } catch (error) {
    log.warn('could not create security-scoped bookmark', filePath, error);
    return null;
  }
}

/**
 * Resolves a stored bookmark, regranting access to the file (macOS).
 *
 * Returns the stop function that must be called when the project closes, or
 * null when access could not be granted (or when there is no sandbox at all).
 */
export function startAccessing(bookmark: string): (() => void) | null {
  if (process.platform !== 'darwin') {
    return null;
  }
  // The API only exists in MAS (App Sandbox) builds; regular builds simply
  // keep the access they already have and the call would throw.
  if (typeof app.startAccessingSecurityScopedResource !== 'function') {
    return null;
  }
  try {
    const stop = app.startAccessingSecurityScopedResource(bookmark);
    return typeof stop === 'function' ? (stop as () => void) : null;
  } catch (error) {
    log.warn('could not resolve security-scoped bookmark', error);
    return null;
  }
}

/** Releases access previously granted by `startAccessing` (never throws). */
export function releaseBookmarkAccess(stop: (() => void) | null | undefined): void {
  if (!stop) {
    return;
  }
  try {
    stop();
  } catch (error) {
    log.warn('could not release security-scoped bookmark', error);
  }
}
