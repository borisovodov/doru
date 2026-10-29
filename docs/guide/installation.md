# Installation and updates

Dóru is installed from your platform's app store or package manager.

## macOS

Dóru on macOS is distributed through **Homebrew**, a package manager that
installs and updates applications for you. If you don't have Homebrew yet,
install it from [brew.sh](https://brew.sh) first.

Dóru requires macOS 13 (Ventura) or later and an Apple silicon Mac (M1 or
later); Intel Macs are not supported.

To install Dóru, open Terminal and run these commands:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru now appears in your Applications. To update it later, run
`brew upgrade --cask doru` in Terminal from time to time.

## Linux

Dóru on Linux runs on 64-bit x86-64 and arm64 machines. It requires
**Ubuntu 22.04 LTS** or later, or **Fedora 41** or later; it is tested on
the latest releases of both. Other distributions will most likely work too,
but are not verified. Pick either method below — both install the same app.

### Flatpak

Dóru is distributed through **Flatpak**, the standard way to install
applications on most Linux distributions. If Flatpak is not installed yet,
follow the setup steps for your distribution at
[flatpak.org/setup](https://flatpak.org/setup/).

Ubuntu 22.04 and 24.04 ship an older Flatpak in their main repositories —
install the official Flatpak PPA first (the setup page at flatpak.org walks
through it).

To install Dóru, open a terminal and run these commands:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru now appears in your applications menu. To update it later, let your
system's software application handle Flatpak updates (for example GNOME
Software or Discover), or run `flatpak update` in a terminal.

### Homebrew

Dóru is also distributed through **Homebrew** on Linux. If you don't have
Homebrew yet, install it from [brew.sh](https://brew.sh) first.

To install Dóru, open a terminal and run these commands:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru now appears in your applications menu. To update it later, run
`brew upgrade --cask doru` in a terminal from time to time.

## Windows (experimental)

Dóru on Windows is distributed through **Scoop**, a command-line installer
that keeps applications up to date. If you don't have Scoop yet, install it
from [scoop.sh](https://scoop.sh) first.

Dóru requires Windows 10 or later, on x64 or Arm64 processors.

To install Dóru, open PowerShell and run these commands:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru now appears in your Start menu. To update it later, run
`scoop update doru` in PowerShell from time to time.
