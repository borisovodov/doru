---
source-hash: ecff58fa2a2c
---

# Ayarlar

Genel ayarlar, uygulamanın veri dizinindeki `settings.json` dosyasında bulunur:

| İşletim sistemi | Yol |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Varsayılanlar uygulamada yaşar; dosya yalnızca açık geçersiz kılmaları kaydeder.** İlk çalıştırmada uygulama dosyayı yalnızca `$schema` referansıyla oluşturur — diğer her şey yerleşik varsayılanlara düşer, böylece yeni varsayılanlar uygulama güncellemeleriyle mevcut kullanıcılara ulaşır. `$schema` referansı tek dokümantasyon kaynağıdır: JSON Schema desteği olan düzenleyiciler (VS Code, Zed, JetBrains) ondan otomatik tamamlama, doğrulama ve alan açıklamaları sunar. Uygulama dosyaya yalnızca **Ayarlar**'da bir ayarı değiştirdiğinizde kayıt yazar; diğer her şey olduğu gibi kalır.
Dosya, yorumlara izin verilen düz JSON'dur — herhangi bir düzenleyiciyle düzenleyin; değişiklikler uygulama çalışırken canlı olarak alınır. Uygulama, yükleme sırasında dosyayı şemaya göre doğrular; ayrıştırılamazsa veya şemayla eşleşmezse boş şablonla değiştirilir (bir uyarı günlüğe yazılır). YZ sağlayıcısı bu dosyanın `ai` bölümünde yapılandırılır — bkz. [YZ ve ajanlar](agents.md).

Tam başvuru:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // AI providers — set from Settings (gear icon) or here directly.
  "ai": {
    // The active provider: ollama | lmstudio | custom | acp
    // (cloud presets return one by one).
    "provider": "ollama",

    // Per-provider settings, keyed by provider id. Only the entry of the
    // active provider is used; the others keep their values and are
    // restored when you switch back.
    "providers": {
      "ollama": {
        "baseUrl": "", // optional override of the provider's default endpoint
        "model": ""
      }
      // For "acp" only: the agent binary to spawn. Add a comma after the
      // "ollama" object above when you enable it.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Theme: one palette file with a dark and a light section. The OS
  // appearance decides which palette applies.
  "theme": "doru"
}
```

## Günlükler

Uygulama, veri dizinindeki (`settings.json` yanındaki) `doru.log` dosyasına tanılama ekler. Dosya 5 MB'ta döner — önceki dosya `doru.old.log` olarak saklanır. Varsayılan ayrıntı düzeyi `warn`'dır (geliştirme derlemeleri `debug` düzeyinde günlükler); geçersiz kılmak için `DORU_LOG_LEVEL=trace|debug|info|warn|error` ayarlayın. Şema doğrulama uyarıları (şemasıyla eşleşmeyen bir ayar veya tema dosyası) buraya kaydedilir. Ayarlar'daki **Günlük dosyasını aç** düğmesi, henüz hiçbir şey günlüğe yazılmadıysa dosyayı gerektiğinde oluşturur.
