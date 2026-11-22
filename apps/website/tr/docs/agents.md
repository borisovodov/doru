---
source-hash: b3dd07f80d43
---

# YZ ve ajanlar

## Uygulama içi sohbet

Sohbet paneli pencerenin alt kısmındadır. Bir soru yazın; ajan yerleşik araçlarla ağacı okuyabilir ve düzenleyebilir: `tree_query`, `tree_get`, `tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`, `notes_write`.

Konuşmalar **sohbet oturumları** olarak kaydedilir: sohbet panelinin başlığı oturumlarınızı listeler; aralarında geçiş yapabilir, yeni sohbet başlatabilir veya onları silebilirsiniz. Oturumlar proje başına uygulamanın veri dizininde (`.doru` dosyasının içinde değil) saklanır, başlık ilk mesajınızdan gelir ve her şey uygulama yeniden başlatmalarında korunur. Her yanıtta, ham markdown'ını sistem panosuna koyan bir kopyalama düğmesi vardır.

Sağlayıcı, `settings.json` dosyasının `ai` bölümünde yapılandırılır (bkz. [Ayarlar](settings.md)):

- **Sağlayıcı ön ayarları**: Ollama, LM Studio, özel bir OpenAI uyumlu uç nokta veya bir ACP ajanı. Bulut ön ayarları, entegrasyonları yeniden oluşturuldukça tek tek geri döner. Kimliği `"provider"` içinde ayarlayın; her ön ayar varsayılan bir temel URL sağlar, model ise Ayarlar sihirbazında seçilir — yerel uç noktalar için sağlayıcıdan getirilir, bulut ön ayarları için birlikte gelen katalogdan seçilir. Her sağlayıcı kendi yapılandırmasını (model, temel URL, akıl yürütme, anahtar) `"providers"` altında tutar — sağlayıcı değiştirmek her birinin kayıtlı kurulumunu geri yükler.
- **API anahtarları**, uygulamanın veri dizinindeki `secrets.json` (0600 modu) dosyasında, sağlayıcı kimliğine göre anahtarlanarak saklanır. Anahtar hiçbir zaman ayar dosyasında görünmez.

## Dóru AI (çevrimdışı asistan)

Varsayılan sağlayıcı **Dóru AI**'dır: tamamen bilgisayarınızda çalışan yerel bir asistan. YZ ayarlarında bir kez indirin (tek dosya, yaklaşık 3 GB); bundan sonra sohbet hesap ve internet bağlantısı olmadan çalışır. Yeni kurulumlarda varsayılan olarak seçilidir ve en az 8 GB RAM gerektirir.

İndirilen model Qwen3.5-4B'dir (Q4_K_M kuantize GGUF, Apache-2.0 lisansı — bkz. [model kartı](https://huggingface.co/Qwen/Qwen3.5-4B)). Ağırlıklar uygulama bildiriminde SHA-256 ile sabitlenir ve her indirmeden sonra doğrulanır.

## ACP ajanları

Agent Client Protocol konuşan bir ajanla (Zed tarzı ajanlar) görüşmek için `"ai": { "provider": "acp", "providers": { "acp": { "command": "…", "args": [] } } }` ayarlayın. Dóru projeyi ajana bir MCP sunucusu olarak geçirir, böylece ajan ağacı tıpkı yerleşik sohbet gibi sorgulayabilir ve düzenleyebilir.

## MCP sunucusu olarak Dóru

Herhangi bir MCP istemcisi — Claude Desktop, Cursor, kodlama ajanları — ağacınızla çalışabilir. Dóru'yu `.doru` dosyasını işaret ederek sunucu modunda çalıştırın:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Claude Desktop yapılandırma örneği (`Claude → Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Linux AppImage: AppImage dosyasının yolu. Windows: `"command": "C:\\Program Files\\Doru\\doru.exe"`. Araç adları, arayüz dilinden bağımsız olarak İngilizce kalır.

Sunucu **başsız ve durumsuzdur**: pencere yok, dock simgesi yok, sohbet oturumu yok — ağaç dosyasını doğrudan okur ve düzenler, istemci bağlantıyı kestiğinde çıkar. Herhangi sayıda istemci aynı dosyayı aynı anda işaret edebilir (Claude Desktop, Cursor, birkaç kodlama ajanı); eşzamanlı yazmalar güvenle kuyruğa alınır. Bir istemci sunucuyu başlatamıyorsa komutu bir terminalde çalıştırın — yardımcı, sorunları stderr'e günlükler ve geçici profili çıkışta atılır.

## Örnek istemler

- *“1850'den önce doğan herkesi bul ve kaynaklarını listele.”*
- *“Petr ve Maria'nın çocuğu olarak, yaklaşık 1923 doğumlu Ivan Ivanov'u ekle.”*
- *“Anna hakkında 1901 nüfus sayımıyla ilgili bir araştırma notu yaz.”*
- *“Ağacımı, ebeveynleri öldükten sonra doğan kişiler için kontrol et.”*
