---
source-hash: 762f7e504ddc
---

# Instalacja i aktualizacje

Dóru instaluje się ze sklepu z aplikacjami lub menedżera pakietów swojej
platformy.

## macOS {#macos}

Dóru na macOS jest dystrybuowany przez **Homebrew**, menedżera pakietów, który
instaluje i aktualizuje aplikacje za Ciebie. Jeśli nie masz jeszcze Homebrew,
zainstaluj go najpierw z [brew.sh](https://brew.sh).

Dóru wymaga macOS 13 (Ventura) lub nowszego oraz Maca z Apple silicon (M1 lub
nowszym); Maci z procesorami Intel nie są obsługiwane.

Aby zainstalować Dóru, otwórz Terminal i wykonaj te polecenia:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru pojawi się teraz w folderze Programy. Aby zaktualizować go później, od
czasu do czasu wykonaj `brew upgrade --cask doru` w Terminalu.

## Linux {#linux}

Dóru na Linuksie działa na maszynach x86-64 i arm64. Wymaga **Ubuntu 22.04
LTS** lub nowszego albo **Fedory 41** lub nowszej; jest testowany na
najnowszych wydaniach obu. Inne dystrybucje najprawdopodobniej też będą
działać, ale nie są weryfikowane. Wybierz jedną z poniższych metod — obie
instalują tę samą aplikację.

### Flatpak

Dóru jest dystrybuowany przez **Flatpak**, standardowy sposób instalowania
aplikacji w większości dystrybucji Linuksa. Jeśli Flatpak nie jest jeszcze
zainstalowany, wykonaj kroki konfiguracji dla swojej dystrybucji na
[flatpak.org/setup](https://flatpak.org/setup/).

Aby zainstalować Dóru, otwórz terminal i wykonaj te polecenia:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru pojawi się teraz w menu aplikacji. Aby zaktualizować go później, pozwól
aplikacji do zarządzania oprogramowaniem w systemie obsługiwać aktualizacje
Flatpaka (na przykład GNOME Software lub Discover) albo wykonaj
`flatpak update` w terminalu.

### Homebrew

Dóru jest też dystrybuowany przez **Homebrew** na Linuksie. Jeśli nie masz
jeszcze Homebrew, zainstaluj go najpierw z [brew.sh](https://brew.sh).

Aby zainstalować Dóru, otwórz terminal i wykonaj te polecenia:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru pojawi się teraz w menu aplikacji. Aby zaktualizować go później, od czasu
do czasu wykonaj `brew upgrade --cask doru` w terminalu.

## Windows (eksperymentalny) {#windows-experimental}

Dóru na Windowsie jest dystrybuowany przez **Scoop**, instalator wiersza
poleceń, który utrzymuje aplikacje w aktualnej wersji. Jeśli nie masz jeszcze
Scoopa, zainstaluj go najpierw z [scoop.sh](https://scoop.sh).

Dóru wymaga Windows 11 lub nowszego.

Aby zainstalować Dóru, otwórz PowerShell i wykonaj te polecenia:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru pojawi się teraz w menu Start. Aby zaktualizować go później, od czasu do
czasu wykonaj `scoop update doru` w PowerShellu.
