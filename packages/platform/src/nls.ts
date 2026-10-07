import en from './nls/locales/en.json';
import bg from './nls/locales/bg.json';
import cs from './nls/locales/cs.json';
import de from './nls/locales/de.json';
import el from './nls/locales/el.json';
import es from './nls/locales/es.json';
import fr from './nls/locales/fr.json';
import hu from './nls/locales/hu.json';
import it from './nls/locales/it.json';
import ja from './nls/locales/ja.json';
import ko from './nls/locales/ko.json';
import pl from './nls/locales/pl.json';
import ptbr from './nls/locales/pt-br.json';
import ru from './nls/locales/ru.json';
import tr from './nls/locales/tr.json';
import zhcn from './nls/locales/zh-cn.json';
import zhtw from './nls/locales/zh-tw.json';
import { createServiceId } from './di';

export const ILocalizationService = createServiceId<ILocalizationService>('localization');

export type MessageKey = keyof typeof en;

type LocaleBundle = Partial<Record<MessageKey, string>>;

const bundles: Record<string, LocaleBundle> = {
  en,
  bg,
  cs,
  de,
  el,
  es,
  fr,
  hu,
  it,
  ja,
  ko,
  pl,
  'pt-br': ptbr,
  ru,
  tr,
  'zh-cn': zhcn,
  'zh-tw': zhtw,
};

const baseMapping: Record<string, string> = {
  pt: 'pt-br',
  zh: 'zh-cn',
};

const scriptMapping: Record<string, string> = {
  'zh-hans': 'zh-cn',
  'zh-hant': 'zh-tw',
};

export function resolveLocale(preferred: string): string {
  const normalized = preferred.toLowerCase().replace('_', '-');
  if (bundles[normalized]) {
    return normalized;
  }
  if (scriptMapping[normalized]) {
    return scriptMapping[normalized] ?? 'en';
  }
  const base = normalized.split('-')[0] ?? '';
  const candidate = baseMapping[base] ?? base;
  return bundles[candidate] ? candidate : 'en';
}

export interface ILocalizationService {
  readonly locale: string;
  setLocale(locale: string): void;
  t(key: MessageKey, ...args: (string | number)[]): string;
}

export class LocalizationService implements ILocalizationService {
  private currentLocale: string;

  constructor(locale: string) {
    this.currentLocale = resolveLocale(locale);
  }

  static availableLocales(): string[] {
    return Object.keys(bundles);
  }

  get locale(): string {
    return this.currentLocale;
  }

  setLocale(locale: string): void {
    this.currentLocale = resolveLocale(locale);
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
