import { app } from 'electron';
import { LocalizationService, type ILocalizationService, type MessageKey } from '@doru/platform';

let service: LocalizationService | undefined;

function init(): LocalizationService {
  service ??= new LocalizationService(app.getLocale());
  return service;
}

/**
 * Main-process localization: the UI locale follows the operating system
 * (see docs/decisions.md). Chat and settings error texts are produced here
 * so the renderer receives ready-to-display strings.
 *
 * The service is created on first use, not at module load: entry modules are
 * imported before `whenReady()`, and `app.getLocale()` is only valid after
 * the app is ready.
 */
export const nls: ILocalizationService = {
  get locale() {
    return init().locale;
  },
  setLocale(locale: string) {
    init().setLocale(locale);
  },
  t(key: MessageKey, ...args: (string | number)[]) {
    return init().t(key, ...args);
  },
};
