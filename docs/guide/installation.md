# Installation and updates

Dóru is installed from your platform's app store or package manager.

## macOS

Dóru on macOS is distributed through **Homebrew**, a package manager that
installs and updates applications for you. If you don't have Homebrew yet,
install it from [brew.sh](https://brew.sh) first.

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

Dóru on Linux is tested on **Ubuntu**, **Fedora**, and **Arch Linux**; other
distributions will most likely work too, but are not verified. Pick either
method below — both install the same app.

### Flatpak

Dóru is distributed through **Flatpak**, the standard way to install
applications on most Linux distributions. If Flatpak is not installed yet,
follow the setup steps for your distribution at
[flatpak.org/setup](https://flatpak.org/setup/).

To install Dóru, open a terminal and run these commands:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user
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

To install Dóru, open a terminal and run these commands.

On Ubuntu and Debian, first install the fuse2 library:

```sh
sudo apt install libfuse2
```

Then, on every distribution:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Homebrew installs the app as an AppImage without a menu entry — launch it
with `~/Applications/Doru.AppImage`. To update it later, run
`brew upgrade --cask doru` in a terminal from time to time.

## Windows (experimental)

Dóru on Windows is distributed through **Scoop**, a command-line installer
that keeps applications up to date. If you don't have Scoop yet, install it
from [scoop.sh](https://scoop.sh) first.

To install Dóru, open PowerShell and run these commands:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru now appears in your Start menu. To update it later, run
`scoop update doru` in PowerShell from time to time.
