---
source-hash: 762f7e504ddc
---

# Installation und Updates

Dóru wird über den App Store oder Paketmanager Ihrer Plattform installiert.

## macOS {#macos}

Dóru für macOS wird über **Homebrew** verteilt, einen Paketmanager, der
Anwendungen für Sie installiert und aktualisiert. Wenn Sie Homebrew noch nicht
haben, installieren Sie es zuerst von [brew.sh](https://brew.sh).

Dóru setzt macOS 13 (Ventura) oder neuer und einen Mac mit Apple Silicon
(M1 oder neuer) voraus; Intel-Macs werden nicht unterstützt.

Um Dóru zu installieren, öffnen Sie Terminal und führen Sie diese Befehle aus:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru erscheint jetzt in Ihren Programmen. Um es später zu aktualisieren, führen
Sie von Zeit zu Zeit `brew upgrade --cask doru` im Terminal aus.

## Linux {#linux}

Dóru für Linux läuft auf x86-64- und arm64-Rechnern. Es setzt
**Ubuntu 22.04 LTS** oder neuer bzw. **Fedora 41** oder neuer voraus; getestet
wird es auf den neuesten Versionen beider Systeme. Andere Distributionen
funktionieren höchstwahrscheinlich ebenfalls, sind aber nicht verifiziert. Wählen
Sie eine der beiden Methoden unten — beide installieren dieselbe App.

### Flatpak

Dóru wird über **Flatpak** verteilt, den Standardweg zur Installation von
Anwendungen auf den meisten Linux-Distributionen. Wenn Flatpak noch nicht
installiert ist, folgen Sie den Einrichtungsschritten für Ihre Distribution unter
[flatpak.org/setup](https://flatpak.org/setup/).

Um Dóru zu installieren, öffnen Sie ein Terminal und führen Sie diese Befehle
aus:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru erscheint jetzt in Ihrem Anwendungsmenü. Um es später zu aktualisieren,
lassen Sie die Softwareverwaltung Ihres Systems Flatpak-Updates erledigen (zum
Beispiel GNOME Software oder Discover) oder führen Sie `flatpak update` in einem
Terminal aus.

### Homebrew

Dóru wird unter Linux auch über **Homebrew** verteilt. Wenn Sie Homebrew noch
nicht haben, installieren Sie es zuerst von [brew.sh](https://brew.sh).

Um Dóru zu installieren, öffnen Sie ein Terminal und führen Sie diese Befehle
aus:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru erscheint jetzt in Ihrem Anwendungsmenü. Um es später zu aktualisieren,
führen Sie von Zeit zu Zeit `brew upgrade --cask doru` in einem Terminal aus.

## Windows (experimentell) {#windows-experimental}

Dóru für Windows wird über **Scoop** verteilt, einen Installer für die
Kommandozeile, der Anwendungen aktuell hält. Wenn Sie Scoop noch nicht haben,
installieren Sie es zuerst von [scoop.sh](https://scoop.sh).

Dóru setzt Windows 11 oder neuer voraus.

Um Dóru zu installieren, öffnen Sie PowerShell und führen Sie diese Befehle aus:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru erscheint jetzt in Ihrem Startmenü. Um es später zu aktualisieren, führen
Sie von Zeit zu Zeit `scoop update doru` in PowerShell aus.
