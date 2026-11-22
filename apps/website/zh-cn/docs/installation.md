---
source-hash: 762f7e504ddc
---

# 安装与更新

Dóru 从您所在平台的应用商店或包管理器安装。

## macOS {#macos}

macOS 上的 Dóru 通过 **Homebrew** 分发。Homebrew 是一个为您安装和更新应用程序的包管理器。如果您还没有 Homebrew，请先从 [brew.sh](https://brew.sh) 安装。

Dóru 需要 macOS 13（Ventura）或更高版本，以及 Apple 芯片的 Mac（M1 或更新）；不支持 Intel Mac。

要安装 Dóru，请打开终端并运行以下命令：

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru 现在会出现在您的“应用程序”文件夹中。以后要更新，请不时在终端中运行 `brew upgrade --cask doru`。

## Linux {#linux}

Linux 上的 Dóru 可在 x86-64 和 arm64 机器上运行。它需要 **Ubuntu 22.04 LTS** 或更高版本，或 **Fedora 41** 或更高版本；已在两者的最新版本上测试。其他发行版很可能也能运行，但未经验证。请选择下面的任一方式——两者安装的是同一个应用。

### Flatpak

Dóru 通过 **Flatpak** 分发，这是在大多数 Linux 发行版上安装应用程序的标准方式。如果尚未安装 Flatpak，请按照 [flatpak.org/setup](https://flatpak.org/setup/) 中适合您发行版的设置步骤操作。

要安装 Dóru，请打开终端并运行以下命令：

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru 现在会出现在您的应用程序菜单中。以后要更新，请让系统的软件应用（例如 GNOME Software 或 Discover）处理 Flatpak 更新，或在终端中运行 `flatpak update`。

### Homebrew

Dóru 在 Linux 上也通过 **Homebrew** 分发。如果您还没有 Homebrew，请先从 [brew.sh](https://brew.sh) 安装。

要安装 Dóru，请打开终端并运行以下命令：

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru 现在会出现在您的应用程序菜单中。以后要更新，请不时在终端中运行 `brew upgrade --cask doru`。

## Windows（实验性） {#windows-experimental}

Windows 上的 Dóru 通过 **Scoop** 分发。Scoop 是一个命令行安装程序，可让应用程序保持最新。如果您还没有 Scoop，请先从 [scoop.sh](https://scoop.sh) 安装。

Dóru 需要 Windows 11 或更高版本。

要安装 Dóru，请打开 PowerShell 并运行以下命令：

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru 现在会出现在您的“开始”菜单中。以后要更新，请不时在 PowerShell 中运行 `scoop update doru`。
