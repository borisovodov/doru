---
source-hash: 762f7e504ddc
---

# 安裝與更新

Dóru 從您所在平台的應用程式商店或套件管理員安裝。

## macOS {#macos}

macOS 上的 Dóru 透過 **Homebrew** 發行。Homebrew 是一個為您安裝和更新應用程式的套件管理員。如果您還沒有 Homebrew，請先從 [brew.sh](https://brew.sh) 安裝。

Dóru 需要 macOS 13（Ventura）或更新版本，以及 Apple 晶片的 Mac（M1 或更新）；不支援 Intel Mac。

要安裝 Dóru，請開啟終端機並執行以下命令：

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru 現在會出現在您的「應用程式」資料夾中。日後要更新，請不時在終端機中執行 `brew upgrade --cask doru`。

## Linux {#linux}

Linux 上的 Dóru 可在 x86-64 和 arm64 機器上執行。它需要 **Ubuntu 22.04 LTS** 或更新版本，或 **Fedora 41** 或更新版本；已在兩者的最新版本上測試。其他發行版很可能也能執行，但未經驗證。請選擇下列任一方式——兩者安裝的是同一個應用程式。

### Flatpak

Dóru 透過 **Flatpak** 發行，這是在大多數 Linux 發行版上安裝應用程式的標準方式。如果尚未安裝 Flatpak，請依照 [flatpak.org/setup](https://flatpak.org/setup/) 中適合您發行版的設定步驟操作。

要安裝 Dóru，請開啟終端機並執行以下命令：

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru 現在會出現在您的應用程式選單中。日後要更新，請讓系統的軟體應用程式（例如 GNOME Software 或 Discover）處理 Flatpak 更新，或在終端機中執行 `flatpak update`。

### Homebrew

Dóru 在 Linux 上也透過 **Homebrew** 發行。如果您還沒有 Homebrew，請先從 [brew.sh](https://brew.sh) 安裝。

要安裝 Dóru，請開啟終端機並執行以下命令：

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru 現在會出現在您的應用程式選單中。日後要更新，請不時在終端機中執行 `brew upgrade --cask doru`。

## Windows（實驗性） {#windows-experimental}

Windows 上的 Dóru 透過 **Scoop** 發行。Scoop 是一個命令列安裝程式，可讓應用程式保持最新。如果您還沒有 Scoop，請先從 [scoop.sh](https://scoop.sh) 安裝。

Dóru 需要 Windows 11 或更新版本。

要安裝 Dóru，請開啟 PowerShell 並執行以下命令：

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru 現在會出現在您的「開始」功能表中。日後要更新，請不時在 PowerShell 中執行 `scoop update doru`。
