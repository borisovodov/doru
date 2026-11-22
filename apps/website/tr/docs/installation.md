---
source-hash: 762f7e504ddc
---

# Kurulum ve güncellemeler

Dóru, platformunuzun uygulama mağazasından veya paket yöneticisinden kurulur.

## macOS {#macos}

Dóru, macOS'te **Homebrew** aracılığıyla dağıtılır; bu paket yöneticisi uygulamaları sizin için kurar ve günceller. Henüz Homebrew yoksa önce [brew.sh](https://brew.sh) adresinden kurun.

Dóru, macOS 13 (Ventura) veya üstünü ve Apple silicon bir Mac (M1 veya üstü) gerektirir; Intel Mac'ler desteklenmez.

Dóru'yu kurmak için Terminal'i açın ve şu komutları çalıştırın:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru artık Uygulamalar'da görünür. Daha sonra güncellemek için zaman zaman Terminal'de `brew upgrade --cask doru` komutunu çalıştırın.

## Linux {#linux}

Dóru, Linux'ta x86-64 ve arm64 makinelerde çalışır. **Ubuntu 22.04 LTS** veya üstünü ya da **Fedora 41** veya üstünü gerektirir; her ikisinin de en son sürümlerinde test edilir. Diğer dağıtımlar büyük olasılıkla da çalışır, ancak doğrulanmamıştır. Aşağıdaki yöntemlerden birini seçin — ikisi de aynı uygulamayı kurar.

### Flatpak

Dóru, **Flatpak** aracılığıyla dağıtılır; bu, çoğu Linux dağıtımında uygulama kurmanın standart yoludur. Flatpak henüz kurulu değilse [flatpak.org/setup](https://flatpak.org/setup/) adresinde dağıtımınız için kurulum adımlarını izleyin.

Dóru'yu kurmak için bir terminal açın ve şu komutları çalıştırın:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru artık uygulamalar menünüzde görünür. Daha sonra güncellemek için sisteminizin yazılım uygulamasının Flatpak güncellemelerini yönetmesine izin verin (örneğin GNOME Software veya Discover) veya bir terminalde `flatpak update` çalıştırın.

### Homebrew

Dóru, Linux'ta **Homebrew** aracılığıyla da dağıtılır. Henüz Homebrew yoksa önce [brew.sh](https://brew.sh) adresinden kurun.

Dóru'yu kurmak için bir terminal açın ve şu komutları çalıştırın:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru artık uygulamalar menünüzde görünür. Daha sonra güncellemek için zaman zaman bir terminalde `brew upgrade --cask doru` komutunu çalıştırın.

## Windows (deneysel) {#windows-experimental}

Dóru, Windows'ta **Scoop** aracılığıyla dağıtılır; bu, uygulamaları güncel tutan bir komut satırı kurucusudur. Henüz Scoop yoksa önce [scoop.sh](https://scoop.sh) adresinden kurun.

Dóru, Windows 11 veya üstünü gerektirir.

Dóru'yu kurmak için PowerShell'i açın ve şu komutları çalıştırın:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru artık Başlat menünüzde görünür. Daha sonra güncellemek için zaman zaman PowerShell'de `scoop update doru` komutunu çalıştırın.
