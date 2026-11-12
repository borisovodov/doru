import { LocalizationService, resolveLocale } from '@doru/platform';

const locale =
  typeof navigator !== 'undefined' ? resolveLocale(navigator.language ?? '') : 'en';

export const nls = new LocalizationService(locale);
