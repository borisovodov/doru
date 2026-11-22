---
source-hash: cb76eaf45583
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

  // YZ sağlayıcıları — Ayarlar'dan (dişli simgesi) veya doğrudan buradan ayarlanır.
  "ai": {
    // Etkin sağlayıcı: ollama | lmstudio | custom | acp
    // (bulut ön ayarları tek tek geri döner).
    "provider": "ollama",

    // Sağlayıcı kimliğine göre anahtarlanmış sağlayıcı başına ayarlar. Yalnızca
    // etkin sağlayıcının girdisi kullanılır; diğerleri değerlerini korur ve
    // geri döndüğünüzde geri yüklenir.
    "providers": {
      "ollama": {
        "baseUrl": "", // sağlayıcının varsayılan uç noktası için isteğe bağlı geçersiz kılma
        "model": ""
      }
      // Yalnızca "acp" için: başlatılacak ajan ikilisi.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Tema: koyu ve açık bölümü olan tek bir palet dosyası. Hangi paletin
  // uygulanacağına işletim sistemi görünümü karar verir.
  "theme": "doru"
}
```

## Günlükler

Uygulama, veri dizinindeki (`settings.json` yanındaki) `doru.log` dosyasına tanılama ekler. Dosya 5 MB'ta döner — önceki dosya `doru.old.log` olarak saklanır. Varsayılan ayrıntı düzeyi `warn`'dır (geliştirme derlemeleri `debug` düzeyinde günlükler); geçersiz kılmak için `DORU_LOG_LEVEL=trace|debug|info|warn|error` ayarlayın. Şema doğrulama uyarıları (şemasıyla eşleşmeyen bir ayar veya tema dosyası) buraya kaydedilir. Ayarlar'daki **Günlük dosyasını aç** düğmesi, henüz hiçbir şey günlüğe yazılmadıysa dosyayı gerektiğinde oluşturur.
