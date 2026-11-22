---
source-hash: 762f7e504ddc
---

# Инсталиране и обновяване

Dóru се инсталира от магазина за приложения или мениджъра на пакети на вашата платформа.

## macOS {#macos}

Dóru на macOS се разпространява чрез **Homebrew** — мениджър на пакети, който инсталира и обновява приложения вместо вас. Ако все още нямате Homebrew, първо го инсталирайте от [brew.sh](https://brew.sh).

Dóru изисква macOS 13 (Ventura) или по-нова версия и Mac с Apple silicon (M1 или по-нов); Intel Mac не се поддържат.

За да инсталирате Dóru, отворете Terminal и изпълнете тези команди:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru вече се появява в Applications. За да го обновите по-късно, от време на време изпълнявайте `brew upgrade --cask doru` в Terminal.

## Linux {#linux}

Dóru на Linux работи на x86-64 и arm64 машини. Изисква **Ubuntu 22.04 LTS** или по-нова версия, или **Fedora 41** или по-нова; тестван е на последните издания на двете. Други дистрибуции най-вероятно също ще работят, но не са проверени. Изберете някой от двата метода по-долу — и двата инсталират същото приложение.

### Flatpak

Dóru се разпространява чрез **Flatpak** — стандартния начин за инсталиране на приложения в повечето Linux дистрибуции. Ако Flatpak все още не е инсталиран, следвайте стъпките за настройка за вашата дистрибуция на [flatpak.org/setup](https://flatpak.org/setup/).

За да инсталирате Dóru, отворете терминал и изпълнете тези команди:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru вече се появява в менюто с приложения. За да го обновите по-късно, оставете софтуерното приложение на системата да се грижи за актуализациите на Flatpak (например GNOME Software или Discover) или изпълнете `flatpak update` в терминал.

### Homebrew

Dóru се разпространява и чрез **Homebrew** на Linux. Ако все още нямате Homebrew, първо го инсталирайте от [brew.sh](https://brew.sh).

За да инсталирате Dóru, отворете терминал и изпълнете тези команди:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru вече се появява в менюто с приложения. За да го обновите по-късно, от време на време изпълнявайте `brew upgrade --cask doru` в терминал.

## Windows (експериментално) {#windows-experimental}

Dóru на Windows се разпространява чрез **Scoop** — команден инсталатор, който поддържа приложенията актуални. Ако все още нямате Scoop, първо го инсталирайте от [scoop.sh](https://scoop.sh).

Dóru изисква Windows 11 или по-нова версия.

За да инсталирате Dóru, отворете PowerShell и изпълнете тези команди:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru вече се появява в менюто Start. За да го обновите по-късно, от време на време изпълнявайте `scoop update doru` в PowerShell.
