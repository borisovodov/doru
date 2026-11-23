/**
 * The operating-system locale, independent of the app UI language.
 *
 * The UI bundle language comes from `resolveLocale` (17 supported languages),
 * while regional preferences such as the first day of the week belong to the
 * OS. Electron exposes them through `app.getSystemLocale()`, which the
 * renderer receives at startup; this module keeps that value for pure helpers.
 */

let currentSystemLocale: string | undefined;

/** Stores the locale reported by the main process; `undefined` clears it. */
export function setSystemLocale(locale: string | undefined): void {
  currentSystemLocale = locale;
}

/** The locale reported by the main process, if it has been loaded yet. */
export function getSystemLocale(): string | undefined {
  return currentSystemLocale;
}

/**
 * Converts an OS locale into a BCP 47 tag `Intl` understands.
 *
 * Electron/macOS may append an ICU region override to the language tag, for
 * example `en-US@rg=ruzzzz` for an English UI in the Russian region. `Intl`
 * rejects the suffix, so it is folded back into the region subtag (`en-RU`).
 * Linux may also hand out POSIX spellings such as `en_US.UTF-8`, which are
 * converted to `en-US` the same way.
 */
export function normalizeSystemLocale(locale: string): string {
  const override = /(?:@|;)rg=([a-z]{2})/i.exec(locale);
  const base = (locale.split('@')[0] ?? locale).split('.')[0]?.replace(/_/g, '-') ?? locale;
  const region = override?.[1];
  if (region === undefined) {
    return base;
  }
  const language = base.split('-')[0] ?? base;
  return `${language}-${region.toUpperCase()}`;
}
