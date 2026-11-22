---
source-hash: 0feae5711b39
---

# Veriler ve yedekler

- Verileriniz sıradan bir dosyadır — ve sizin kalır. Dóru'nun hesabı, bulut arka ucu ve telemetrisi yoktur. *Siz* uzak bir YZ sağlayıcısı yapılandırmadıkça hiçbir şey hiçbir yere yüklenmez — o durumda bile sohbet mesajları ve asistanın araçları aracılığıyla aldığı ağaç verileri o sağlayıcıya gönderilir. Her şeyi bilgisayarınızda tutmak istiyorsanız yerel sağlayıcılar (Ollama, LM Studio) tamamen çevrimdışı çalışır.
- Yedeklemek için: projeye yazabilecek her işlemi durdurun — Dóru'da projeyi kapatın ve MCP istemcilerini veya diğer araçları durdurun — ardından `.doru` dosyasını (ve fotoğraflarınız varsa yanındaki `media/` klasörünü) kopyalayın. Hepsi bu. Geri yüklemek, proje kapalıyken ve başka hiçbir işlem yazmıyorken dosyayı geri kopyalamaktır.
- Sohbet oturumları `.doru` dosyasında değil, uygulamanın veri dizininde tutulur; bunlara ihtiyacınız varsa ayrıca yedekleyin.
- Dosya sürüm kontrolüne uygundur: kararlı bir ikili dosyadır — isterseniz git'e işleyin.

## Makineler arasında eşitleme

Dóru'nun yerleşik bir eşitleme motoru yoktur — projeler sıradan dosyalardır ve bunları eşitlenmiş tutmak sizin işinizdir: iCloud Drive, Dropbox, rclone, rsync, bir USB bellek, ne tercih ederseniz.

Bir uyarı: `.doru` dosyası bir SQLite veritabanıdır ve **açık** bir projeyi dosya eşitleme aracıyla canlı eşitlemek, dosyayı yarım yazılmış bir durumda kopyalayıp bozabilir. Güvenli uygulama: eşitlemeden önce projeyi (veya uygulamayı) kapatın ve yazan diğer tüm işlemleri durdurun. Kapalı olan ve başka hiçbir işlemin yazmadığı bir projeyi kopyalamak her zaman güvenlidir. Bir çökmeden sonra, SQLite'ın kalan günlüğü geri alabilmesi için projeyi Dóru'da bir kez açın ve kopyalamadan önce kapatın.
