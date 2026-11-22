import { SEARCH_TEXT } from './search.ts';
import type { SiteLocale } from './types.ts';

const locale: SiteLocale = {
  label: 'Türkçe',
  lang: 'tr',
  description:
    'Soy ağaçları için bir masaüstü uygulaması. Soy ağacınız diskinizde sıradan bir klasörde yaşar, tamamen çevrimdışı çalışır ve yapay zekâ ajanları tarafından yönlendirilir — yerleşik sohbet veya herhangi bir MCP/ACP istemcisi aracılığıyla.',
  footer: 'Adı, Proto-Hint-Avrupa dilindeki <em>*dóru</em> — „ağaç“ sözcüğünden gelir.',
  nav: {
    docs: 'Belgeler',
    releases: 'Sürüm notları',
  },
  sidebar: {
    intro: 'Giriş',
    getStarted: 'Başlarken',
    installation: 'Kurulum ve güncellemeler',
    quickStart: 'Hızlı başlangıç',
    guide: 'Kılavuz',
    tree: 'Soy ağacıyla çalışma',
    shortcuts: 'Klavye kısayolları',
    settings: 'Ayarlar',
    agents: 'Yapay zekâ ve ajanlar',
    themes: 'Temalar',
    reference: 'Başvuru',
    dataBackups: 'Veriler ve yedekler',
    troubleshooting: 'Sorun giderme',
  },
  ui: {
    outline: 'Bu sayfada',
    prev: 'Önceki sayfa',
    next: 'Sonraki sayfa',
    returnToTop: 'Başa dön',
    skipToContent: 'İçeriğe geç',
    menu: 'Menü',
    appearance: 'Görünüm',
    lightTheme: 'Açık temaya geç',
    darkTheme: 'Koyu temaya geç',
    langMenu: 'Dili değiştir',
    mainNavigation: 'Ana gezinme',
    mobileMenu: 'Menü',
    moreOptions: 'Diğer seçenekler',
  },
  notFound: {
    title: 'SAYFA BULUNAMADI',
    quote: 'Ama yönünüzü değiştirmez ve aramaya devam ederseniz, gittiğiniz yere varabilirsiniz.',
    linkLabel: 'ana sayfaya git',
    linkText: 'Ana sayfaya dön',
  },
  search: SEARCH_TEXT['tr'],
  markdown: {
    codeCopyButton: {
      tooltipText: 'Kodu kopyala',
      copiedText: 'Kopyalandı',
    },
  },
};

export default locale;
