---
source-hash: 762f7e504ddc
---

# Installation et mises à jour

Dóru s'installe depuis la boutique d'applications ou le gestionnaire de paquets
de votre plateforme.

## macOS {#macos}

Dóru sur macOS est distribué via **Homebrew**, un gestionnaire de paquets qui
installe et met à jour les applications pour vous. Si vous n'avez pas encore
Homebrew, installez-le d'abord depuis [brew.sh](https://brew.sh).

Dóru nécessite macOS 13 (Ventura) ou version ultérieure et un Mac Apple silicon
(M1 ou ultérieur) ; les Mac Intel ne sont pas pris en charge.

Pour installer Dóru, ouvrez le Terminal et exécutez ces commandes :

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru apparaît maintenant dans vos Applications. Pour le mettre à jour plus tard,
exécutez de temps en temps `brew upgrade --cask doru` dans le Terminal.

## Linux {#linux}

Dóru sur Linux fonctionne sur les machines x86-64 et arm64. Il nécessite
**Ubuntu 22.04 LTS** ou version ultérieure, ou **Fedora 41** ou version
ultérieure ; il est testé sur les dernières versions des deux. Les autres
distributions fonctionneront très probablement aussi, mais ne sont pas vérifiées.
Choisissez l'une des deux méthodes ci-dessous — les deux installent la même
application.

### Flatpak

Dóru est distribué via **Flatpak**, la façon standard d'installer des
applications sur la plupart des distributions Linux. Si Flatpak n'est pas encore
installé, suivez les étapes de configuration de votre distribution sur
[flatpak.org/setup](https://flatpak.org/setup/).

Pour installer Dóru, ouvrez un terminal et exécutez ces commandes :

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru apparaît maintenant dans votre menu d'applications. Pour le mettre à jour
plus tard, laissez l'application de gestion des logiciels de votre système gérer
les mises à jour Flatpak (par exemple GNOME Logiciels ou Discover), ou exécutez
`flatpak update` dans un terminal.

### Homebrew

Dóru est aussi distribué via **Homebrew** sous Linux. Si vous n'avez pas encore
Homebrew, installez-le d'abord depuis [brew.sh](https://brew.sh).

Pour installer Dóru, ouvrez un terminal et exécutez ces commandes :

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru apparaît maintenant dans votre menu d'applications. Pour le mettre à jour
plus tard, exécutez de temps en temps `brew upgrade --cask doru` dans un terminal.

## Windows (expérimental) {#windows-experimental}

Dóru sur Windows est distribué via **Scoop**, un installateur en ligne de commande
qui garde les applications à jour. Si vous n'avez pas encore Scoop, installez-le
d'abord depuis [scoop.sh](https://scoop.sh).

Dóru nécessite Windows 11 ou version ultérieure.

Pour installer Dóru, ouvrez PowerShell et exécutez ces commandes :

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru apparaît maintenant dans votre menu Démarrer. Pour le mettre à jour plus
tard, exécutez de temps en temps `scoop update doru` dans PowerShell.
