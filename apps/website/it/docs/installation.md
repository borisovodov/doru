---
source-hash: 762f7e504ddc
---

# Installazione e aggiornamenti

Dóru si installa dall'app store o dal gestore di pacchetti della tua
piattaforma.

## macOS {#macos}

Dóru su macOS è distribuito tramite **Homebrew**, un gestore di pacchetti che
installa e aggiorna le applicazioni per te. Se non hai ancora Homebrew,
installalo prima da [brew.sh](https://brew.sh).

Dóru richiede macOS 13 (Ventura) o successivo e un Mac con Apple silicon (M1 o
successivo); i Mac Intel non sono supportati.

Per installare Dóru, apri il Terminale ed esegui questi comandi:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru ora appare nelle tue Applicazioni. Per aggiornarlo in seguito, esegui di
tanto in tanto `brew upgrade --cask doru` nel Terminale.

## Linux {#linux}

Dóru su Linux gira su macchine x86-64 e arm64. Richiede **Ubuntu 22.04 LTS** o
successivo, oppure **Fedora 41** o successivo; è testato sulle ultime versioni
di entrambi. Anche altre distribuzioni funzioneranno molto probabilmente, ma
non sono verificate. Scegli uno dei due metodi seguenti — entrambi installano
la stessa app.

### Flatpak

Dóru è distribuito tramite **Flatpak**, il modo standard per installare
applicazioni sulla maggior parte delle distribuzioni Linux. Se Flatpak non è
ancora installato, segui i passaggi di configurazione per la tua distribuzione
su [flatpak.org/setup](https://flatpak.org/setup/).

Per installare Dóru, apri un terminale ed esegui questi comandi:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru ora appare nel menu delle applicazioni. Per aggiornarlo in seguito, lascia
che l'applicazione software del tuo sistema gestisca gli aggiornamenti Flatpak
(ad esempio GNOME Software o Discover), oppure esegui `flatpak update` in un
terminale.

### Homebrew

Dóru è distribuito anche tramite **Homebrew** su Linux. Se non hai ancora
Homebrew, installalo prima da [brew.sh](https://brew.sh).

Per installare Dóru, apri un terminale ed esegui questi comandi:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru ora appare nel menu delle applicazioni. Per aggiornarlo in seguito, esegui
di tanto in tanto `brew upgrade --cask doru` in un terminale.

## Windows (sperimentale) {#windows-experimental}

Dóru su Windows è distribuito tramite **Scoop**, un programma di installazione
da riga di comando che mantiene le applicazioni aggiornate. Se non hai ancora
Scoop, installalo prima da [scoop.sh](https://scoop.sh).

Dóru richiede Windows 11 o successivo.

Per installare Dóru, apri PowerShell ed esegui questi comandi:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru ora appare nel menu Start. Per aggiornarlo in seguito, esegui di tanto in
tanto `scoop update doru` in PowerShell.
