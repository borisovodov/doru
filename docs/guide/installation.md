# Installation

## macOS

Dóru on macOS is distributed through **Homebrew**, a package manager that
installs and updates applications for you. If you don't have Homebrew yet,
install it from [brew.sh](https://brew.sh) first.

To install Dóru, open Terminal and run the commands below:

```sh
brew tap borisovodov/taps
brew trust borisovodov/taps
brew install --cask doru
```

Dóru now appears in your Applications. To update it later, run
`brew upgrade --cask doru` in Terminal from time to time.

## Windows (experimental)

Dóru on Windows is distributed through **Scoop**, a command-line installer
that keeps applications up to date. If you don't have Scoop yet, install it
from [scoop.sh](https://scoop.sh) first.

To install Dóru, open PowerShell and run the commands below:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
scoop install doru
```

Dóru now appears in your Start menu. To update it later, run
`scoop update doru` in PowerShell from time to time.

## Linux (experimental)

Dóru on Linux is distributed through **Flatpak**, the standard way to
install applications on most Linux distributions. If Flatpak is not
installed yet, follow the setup steps for your distribution at
[flatpak.org/setup](https://flatpak.org/setup/).

To install Dóru, open a terminal and run the commands below:

```sh
flatpak remote-add --user borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo
flatpak install borisovodov org.doru.doru
```

Dóru now appears in your applications menu. To update it later, let your
system's software application handle Flatpak updates (for example GNOME
Software or Discover), or run `flatpak update` in a terminal.

### Homebrew as an alternative

If you already use Homebrew on Linux, you can install Dóru the same way as
on macOS:

```sh
brew tap borisovodov/taps
brew trust borisovodov/taps
brew install --cask doru
```

## Updates

Updates come through the channel you used: Homebrew on macOS, Scoop on
Windows, Flatpak (or Homebrew) on Linux. Dóru itself never updates in place
and never downloads anything behind your back — the app store you installed
from is the only update channel.
