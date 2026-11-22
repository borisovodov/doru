---
source-hash: 472083c37a73
---

# Hızlı başlangıç

1. Dóru'yu başlatın ve başlangıç sayfasında **Yeni proje oluştur…** (veya **Proje aç veya GEDCOM içe aktar…**) düğmesine tıklayın.
2. **Oluştur** bir konum ve ad ister ve orada bir `.doru` dosyası oluşturur; **Proje aç veya GEDCOM içe aktar** mevcut bir `.doru` dosyasını ya da bir `.ged`/`.gdz` GEDCOM dosyasını açar — GEDCOM dosyası, içe aktarılan ağaçla yeni ve henüz kaydedilmemiş bir proje başlatır; ardından `.doru` olarak kaydedin. Dosya *projenin kendisidir* — adı projenin adıdır:

```
My Family.doru      ağacın kendisi (SQLite, bir uygulama kimliğiyle işaretlenmiş)
media/              fotoğraflar ve taramalar, gerektiğinde oluşturulur (isteğe bağlı)
```

3. Verileri içeri alın: yeni bir ağaç tek bir boş kart gösterir — karta tıklayın, adı yazın, onay işaretiyle onaylayın ve ilk kişi tuvalde görünür; her kart aynı şekilde çocuk, eş ve ebeveyn ekleyebilir. GEDCOM dosyaları **Proje aç veya GEDCOM içe aktar** (2. adım) ile içeri alınır. Dışa aktarmak için **Dışa aktar** sekmesini açın, **GEDCOM 7.0** (`.ged`) veya **GEDZIP** (`.gdz`, yönetilen medya dosyalarıyla) seçin ve kaydetme konumunu onaylayın.

Her proje **kendi penceresinde** açılır; kişiler, ağaç düzenleyici ve ayarlar içinde sekme olarak açılır. **Yeni pencere** (`⌘⇧N`, Linux ve Windows'ta `Ctrl+Shift+N`) mevcut projeyi kapatmadan başka bir başlangıç sayfası açar; böylece bir GEDCOM dosyasını içe aktarabilir veya yanında ikinci bir ağaç açabilirsiniz. Son kullanılan projeler başlangıç sayfasında listelenir ve açık proje pencereleriniz bir sonraki başlatmada geri yüklenir. Bir `*.doru` dosyasına çift tıklamak (veya `doru://open?path=/…/family.doru` bağlantısını açmak) dosyayı çalışan uygulamada açar.

## Projeleri bağlantılardan açma

Uygulama `doru://` URL şemasını kaydeder; böylece bir `doru://open?path=…` bağlantısı, uygulama henüz çalışmıyor olsa bile projeyi açar — veya `.ged`/`.gdz` için dosyayı içe aktarır:

- Yol **mutlak ve URL ile kodlanmış** olmalıdır (boşluklar için `%20` vb.), ör. `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Uygulama çalışmıyorsa bağlantı onu başlatır ve projeyi hemen açar.
- Uygulama zaten çalışıyorsa proje çalışan örnekte açılır — asla ikinci bir örnek başlatılmaz, mevcut pencere öne getirilir.
- Bağlantılar yalnızca uygulamanın doğrudan açtığı dosya türleri için çalışır: `.doru` projeleri ve `.ged`/`.gdz` GEDCOM dosyaları.

macOS'te `open "doru://open?path=…"` bağlantıyı terminalden veya diğer uygulamalardan gönderir; Linux'ta `xdg-open` aynısını yapar.

## Sonraki adımlar

- [Ağaçla çalışma](tree.md) — kişiler, aileler, kaynaklar, notlar.
- [Ayarlar](settings.md) — `settings.json` başvurusu.
- [YZ ve ajanlar](agents.md) — bir ajanın ağacınızı okumasına ve düzenlemesine izin verin.
- [Temalar](themes.md) — işletim sistemi görünümüne göre seçilen, koyu ve açık paletli bir tema.
