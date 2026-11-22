---
source-hash: 85c6a6b9acc6
---

# Temalar

Arayüz tamamen CSS özel özellikleriyle biçimlendirilir ve uygulama düzeyinde uygulanır — hiçbir zaman proje başına değil.

- **Yerleşik tema** — `doru`, uygulamanın `themes/` dizininde tek bir JSON palet dosyası: tema başına bir dosya, CSS yok. Dosya hem `dark` hem de `light` paleti barındırır; hangisinin uygulanacağına işletim sistemi görünümü karar verir — işletim sisteminizi açık moda alın, Dóru anında uyar. Dosya adı tema kimliğidir (`doru.json`); içindeki `name` alanı görünen addır.
- Temayı `settings.json` içinde tek bir dizeyle (bkz. [Ayarlar](settings.md)) veya uygulama içi **Ayarlar** sayfasından (Tema açılır menüsü) seçin; seçim her iki durumda da `settings.json` içinde saklanır.
- Etkin paletin `colors` değerleri başlangıçta `--doru-*` CSS özel özelliklerine çözümlenir.

## Kullanıcı temaları

`dark` ve `light` paletli bir `<id>.json` dosyasını uygulamanın veri dizinindeki `themes` dizinine bırakın (`settings.json` dosyasının yaşadığı yer — bkz. [Ayarlar](settings.md)), ardından `settings.json` içinde `"theme": "<id>"` ile seçin. Dosya eklendikten sonra uygulamayı yeniden başlatın, böylece algılansın. Dizin ilk çalıştırmada oluşturulur; kimliği yerleşik bir temayla eşleşen kullanıcı teması onu geçersiz kılar. Bozuk veya şemayla eşleşmeyen bir tema dosyası atlanır (bir uyarı günlüğe yazılır), tıpkı eksik olan gibi, ve tema listesinde görünmez. Yerleşik temalar bir `$schema` referansı taşır (`https://doru.family/theme.json`) — JSON Schema anlayan düzenleyicilerde otomatik tamamlama ve doğrulama almak için aynı satırı kendi dosyanıza ekleyin.

Yerleşik temalar, her biri koyu ve açık paletli:

| Tema kimliği | Görünen ad |
|---|---|
| `doru` (varsayılan) | Dóru |
| `one-dark` | One Dark |
| `github` | GitHub |
| `solarized` | Solarized |
| `gruvbox` | Gruvbox |
| `catppuccin` | Catppuccin |
| `ayu` | Ayu |
| `rose-pine` | Rosé Pine |
| `everforest` | Everforest |

Varsayılan Dóru paleti uygulama simgesini izler: sıcak kâğıt tonlarıyla derin orman yeşili. Koyu palet, yüzeyleri neredeyse siyah, yeşil tonlu bir tuvalden daha açık çerçeveye ve açılır panellere katmanlar; açık palet sıcak kâğıt ve krem kullanır.

Kullanılabilir değişkenler:

| Değişken | Anlamı |
|---|---|
| `--doru-bg-canvas` | düzenleyici arka planı ve sekme şeridi |
| `--doru-bg-chrome` | etkinlik çubuğu, kenar çubukları, yüzen panel yüzeyi |
| `--doru-bg-raised` | kartlar, çipler, sohbet girişi |
| `--doru-bg-popover` | menüler ve seçiciler |
| `--doru-bg-input` | düğmeler, giriş alanları, seçiciler |
| `--doru-fg` / `--doru-fg-muted` / `--doru-fg-faint` | ana, soluk ve silik metin |
| `--doru-border` / `--doru-border-strong` | ince çizgiler ve daha güçlü kenarlıklar |
| `--doru-accent` / `--doru-accent-hover` / `--doru-accent-active` | vurgu (orman/adaçayı yeşili) |
| `--doru-on-accent` | vurgu arka planı üzerindeki metin |
| `--doru-accent-alpha` | yarı saydam vurgu (çipler, sohbet balonları) |
| `--doru-focus` | odak halkası rengi |
| `--doru-overlay-hover` / `--doru-overlay-pressed` | üzerine gelme/basılı katmanlar |
| `--doru-success` / `--doru-warning` / `--doru-danger` / `--doru-info` | durum renkleri |
| `--doru-radius-sm` / `--doru-radius-md` / `--doru-radius-lg` | 4 / 6 / 8 px yarıçaplar |
| `--doru-control-height` | denetim yüksekliği (28px) |
| `--doru-panel-gutter` | yüzen paneller ile pencere kenarı arasındaki boşluk (4px) |
| `--doru-panel-radius` | yüzen panel köşe yarıçapı (8px) |
