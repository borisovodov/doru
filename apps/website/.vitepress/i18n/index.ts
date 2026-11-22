import bg from './bg.ts';
import cs from './cs.ts';
import de from './de.ts';
import el from './el.ts';
import en from './en.ts';
import es from './es.ts';
import fr from './fr.ts';
import hu from './hu.ts';
import it from './it.ts';
import ja from './ja.ts';
import ko from './ko.ts';
import pl from './pl.ts';
import ptbr from './pt-br.ts';
import ru from './ru.ts';
import tr from './tr.ts';
import zhcn from './zh-cn.ts';
import zhtw from './zh-tw.ts';
import type { SiteLocale } from './types.ts';

/**
 * English is the default locale and stays first. Every other locale is listed
 * in the same alphabetical order as the app's nls bundles, so no language is
 * pinned to a hand-picked position.
 */
export const LOCALES = {
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
} satisfies Record<string, SiteLocale>;

export type LocaleCode = keyof typeof LOCALES;
