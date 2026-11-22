---
source-hash: 762f7e504ddc
---

# Instalace a aktualizace

Dóru se instaluje z obchodu s aplikacemi nebo správce balíčků vaší platformy.

## macOS {#macos}

Dóru na macOS se distribuuje přes **Homebrew**, správce balíčků, který za vás
instaluje a aktualizuje aplikace. Pokud Homebrew ještě nemáte, nainstalujte ho
nejprve z [brew.sh](https://brew.sh).

Dóru vyžaduje macOS 13 (Ventura) nebo novější a Mac s Apple silicon (M1 nebo
novější); Macy s procesory Intel nejsou podporovány.

Chcete-li Dóru nainstalovat, otevřete Terminál a spusťte tyto příkazy:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru se nyní objeví ve vašich Aplikacích. Chcete-li ho později aktualizovat,
občas v Terminálu spusťte `brew upgrade --cask doru`.

## Linux {#linux}

Dóru na Linuxu běží na strojích x86-64 a arm64. Vyžaduje **Ubuntu 22.04 LTS**
nebo novější, případně **Fedora 41** nebo novější; je testován na nejnovějších
verzích obou. Jiné distribuce budou pravděpodobně také fungovat, ale nejsou
ověřené. Vyberte si jeden z níže uvedených způsobů — oba nainstalují stejnou
aplikaci.

### Flatpak

Dóru se distribuuje přes **Flatpak**, standardní způsob instalace aplikací na
většině linuxových distribucí. Pokud Flatpak ještě není nainstalovaný,
postupujte podle kroků nastavení pro svou distribuci na
[flatpak.org/setup](https://flatpak.org/setup/).

Chcete-li Dóru nainstalovat, otevřete terminál a spusťte tyto příkazy:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru se nyní objeví v nabídce aplikací. Chcete-li ho později aktualizovat,
nechte aktualizace Flatpaku na softwarové aplikaci svého systému (například
GNOME Software nebo Discover), nebo v terminálu spusťte `flatpak update`.

### Homebrew

Dóru se na Linuxu distribuuje také přes **Homebrew**. Pokud Homebrew ještě
nemáte, nainstalujte ho nejprve z [brew.sh](https://brew.sh).

Chcete-li Dóru nainstalovat, otevřete terminál a spusťte tyto příkazy:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru se nyní objeví v nabídce aplikací. Chcete-li ho později aktualizovat,
občas v terminálu spusťte `brew upgrade --cask doru`.

## Windows (experimentální) {#windows-experimental}

Dóru na Windows se distribuuje přes **Scoop**, instalátor z příkazového řádku,
který udržuje aplikace aktuální. Pokud Scoop ještě nemáte, nainstalujte ho
nejprve z [scoop.sh](https://scoop.sh).

Dóru vyžaduje Windows 11 nebo novější.

Chcete-li Dóru nainstalovat, otevřete PowerShell a spusťte tyto příkazy:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru se nyní objeví v nabídce Start. Chcete-li ho později aktualizovat, občas
v PowerShellu spusťte `scoop update doru`.
