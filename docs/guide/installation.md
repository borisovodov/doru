# Installation

Dóru is installed from your platform's app store or package manager — there
is nothing to download from this website. You install it once; afterwards
updates arrive through the same channel. If you already use the tool
mentioned for your operating system, you can skip straight to the commands.

The Windows and Linux versions are younger than the macOS one: they are
built and tested automatically, but have seen less use on real machines.
If something behaves oddly there, please
[report it](https://github.com/borisovodov/doru/issues).

## macOS

Dóru on macOS is distributed through **Homebrew**, a package manager that
installs and updates applications for you. If you don't have Homebrew yet,
install it from [brew.sh](https://brew.sh) first.

To install Dóru:

1. Open **Terminal**: press `Cmd+Space`, type “Terminal”, press `Enter`.
2. Copy the first line below, paste it into the Terminal window (`Cmd+V`),
   press `Enter`, and wait for it to finish.
3. Do the same with the second and third lines.

```sh
brew tap borisovodov/taps
brew trust borisovodov/taps
brew install --cask doru
```

Dóru now appears in your Applications as **Doru**. To update it later, run
`brew upgrade --cask doru` in Terminal from time to time.

## Windows

Dóru on Windows is distributed through **Scoop**, a command-line installer
that keeps applications up to date. If you don't have Scoop yet, install it
from [scoop.sh](https://scoop.sh) first.

To install Dóru:

1. Open **PowerShell**: press the `Windows` key, type “PowerShell”, press
   `Enter`.
2. Copy the first line below, paste it into the PowerShell window (right
   click pastes), press `Enter`, and wait for it to finish.
3. Do the same with the second line.

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
scoop install doru
```

Dóru now appears in your Start menu as **Dóru**. To update it later, run
`scoop update doru` in PowerShell from time to time.

## Linux

Dóru on Linux is distributed through **Flatpak**, the standard way to
install applications on most Linux distributions. If Flatpak is not
installed yet, follow the setup steps for your distribution at
[flatpak.org/setup](https://flatpak.org/setup/).

To install Dóru:

1. Open a **terminal** window (on most distributions: `Ctrl+Alt+T`).
2. Copy the first line below, paste it into the terminal (`Ctrl+Shift+V`),
   press `Enter`, and wait for it to finish.
3. Do the same with the second line.

```sh
flatpak remote-add --user borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo
flatpak install borisovodov org.doru.doru
```

Dóru now appears in your applications menu as **Doru**. To update it later,
let your system's software application handle Flatpak updates (for example
GNOME Software or Discover), or run `flatpak update` in a terminal.

### Homebrew as an alternative

If you already use Homebrew on Linux, you can install Dóru the same way as
on macOS:

```sh
brew tap borisovodov/taps
brew trust borisovodov/taps
brew install --cask doru
```

## Updates

Install once, then updates come through the channel you used: Homebrew on
macOS, Scoop on Windows, Flatpak (or Homebrew) on Linux. Dóru itself never
updates in place and never downloads anything behind your back — the app
store you installed from is the only update channel.
