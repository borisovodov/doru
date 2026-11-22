---
source-hash: e207f75e832a
---

# Veriler ve yedekler

- Verileriniz sıradan bir dosyadır — ve sizin kalır. Dóru'nun hesabı, bulut arka ucu ve telemetrisi yoktur. *Siz* bir YZ sağlayıcısı yapılandırmadıkça hiçbir şey hiçbir yere yüklenmez — o durumda bile makinenizden yalnızca sohbette gönderdiğiniz içerik ayrılır. Her şeyi bilgisayarınızda tutmak istiyorsanız yerel sağlayıcılar (Ollama, LM Studio) tamamen çevrimdışı çalışır.
- Yedeklemek için: `.doru` dosyasını (ve fotoğraflarınız varsa yanındaki `media/` klasörünü) kopyalayın. Hepsi bu. Geri yüklemek, geri kopyalamaktır.
- Dosya sürüm kontrolüne uygundur: kararlı bir ikili dosyadır — isterseniz git'e işleyin.

## Makineler arasında eşitleme

Dóru'nun yerleşik bir eşitleme motoru yoktur — projeler sıradan dosyalardır ve bunları eşitlenmiş tutmak sizin işinizdir: iCloud Drive, Dropbox, rclone, rsync, bir USB bellek, ne tercih ederseniz.

Bir uyarı: `.doru` dosyası bir SQLite veritabanıdır ve **açık** bir projeyi dosya eşitleme aracıyla canlı eşitlemek, dosyayı yarım yazılmış bir durumda kopyalayıp bozabilir. Güvenli uygulama: eşitlemeden önce projeyi (veya uygulamayı) kapatın. Kapalı bir projeyi kopyalamak her zaman güvenlidir.
