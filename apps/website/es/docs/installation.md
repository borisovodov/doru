---
source-hash: 762f7e504ddc
---

# Instalación y actualizaciones

Dóru se instala desde la tienda de aplicaciones o el gestor de paquetes de tu
plataforma.

## macOS {#macos}

Dóru en macOS se distribuye mediante **Homebrew**, un gestor de paquetes que
instala y actualiza aplicaciones por ti. Si aún no tienes Homebrew, instálalo
primero desde [brew.sh](https://brew.sh).

Dóru requiere macOS 13 (Ventura) o posterior y un Mac con Apple silicon (M1 o
posterior); los Mac con Intel no son compatibles.

Para instalar Dóru, abre Terminal y ejecuta estos comandos:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru aparece ahora en tus Aplicaciones. Para actualizarlo más adelante, ejecuta de
vez en cuando `brew upgrade --cask doru` en Terminal.

## Linux {#linux}

Dóru en Linux funciona en máquinas x86-64 y arm64. Requiere **Ubuntu 22.04 LTS**
o posterior, o **Fedora 41** o posterior; se prueba en las últimas versiones de
ambos. Otras distribuciones probablemente también funcionen, pero no están
verificadas. Elige cualquiera de los dos métodos siguientes: ambos instalan la
misma app.

### Flatpak

Dóru se distribuye mediante **Flatpak**, la forma estándar de instalar
aplicaciones en la mayoría de las distribuciones Linux. Si Flatpak aún no está
instalado, sigue los pasos de configuración de tu distribución en
[flatpak.org/setup](https://flatpak.org/setup/).

Para instalar Dóru, abre una terminal y ejecuta estos comandos:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru aparece ahora en tu menú de aplicaciones. Para actualizarlo más adelante, deja
que la aplicación de software de tu sistema gestione las actualizaciones de
Flatpak (por ejemplo, GNOME Software o Discover) o ejecuta `flatpak update` en una
terminal.

### Homebrew

Dóru también se distribuye mediante **Homebrew** en Linux. Si aún no tienes
Homebrew, instálalo primero desde [brew.sh](https://brew.sh).

Para instalar Dóru, abre una terminal y ejecuta estos comandos:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru aparece ahora en tu menú de aplicaciones. Para actualizarlo más adelante,
ejecuta de vez en cuando `brew upgrade --cask doru` en una terminal.

## Windows (experimental) {#windows-experimental}

Dóru en Windows se distribuye mediante **Scoop**, un instalador de línea de
comandos que mantiene las aplicaciones actualizadas. Si aún no tienes Scoop,
instálalo primero desde [scoop.sh](https://scoop.sh).

Dóru requiere Windows 11 o posterior.

Para instalar Dóru, abre PowerShell y ejecuta estos comandos:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru aparece ahora en tu menú Inicio. Para actualizarlo más adelante, ejecuta de
vez en cuando `scoop update doru` en PowerShell.
