import en from './nls/locales/en.json';
import ru from './nls/locales/ru.json';
import { createServiceId } from './di';

export const ILocalizationService = createServiceId<ILocalizationService>('localization');

export type MessageKey = keyof typeof en;

type LocaleBundle = Partial<Record<MessageKey, string>>;

const bundles: Record<string, LocaleBundle> = { en, ru };

export interface ILocalizationService {
  readonly locale: string;
  setLocale(locale: string): void;
  t(key: MessageKey, ...args: (string | number)[]): string;
}

export class LocalizationService implements ILocalizationService {
  private currentLocale: string;

  constructor(locale: string) {
    this.currentLocale = locale;
  }

  get locale(): string {
    return this.currentLocale;
  }

  setLocale(locale: string): void {
    this.currentLocale = locale;
  }

  t(key: MessageKey, ...args: (string | number)[]): string {
    const bundle = bundles[this.currentLocale];
    let message = bundle?.[key] ?? en[key];
    for (let i = 0; i < args.length; i++) {
      message = message.replace(`{${i}}`, String(args[i]));
    }
    return message;
  }
}
