---
source-hash: 762f7e504ddc
---

# インストールと更新

Dóru は、お使いのプラットフォームのアプリストアまたはパッケージマネージャーからインストールします。

## macOS {#macos}

macOS 版の Dóru は **Homebrew** で配布されています。Homebrew はアプリケーションのインストールと更新を代行するパッケージマネージャーです。まだ Homebrew がない場合は、先に [brew.sh](https://brew.sh) からインストールしてください。

Dóru には macOS 13（Ventura）以降と Apple シリコン搭載の Mac（M1 以降）が必要です。Intel Mac はサポートされていません。

Dóru をインストールするには、ターミナルを開いて次のコマンドを実行します：

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru がアプリケーションフォルダーに表示されます。後で更新するには、ときどきターミナルで `brew upgrade --cask doru` を実行してください。

## Linux {#linux}

Linux 版の Dóru は x86-64 と arm64 のマシンで動作します。**Ubuntu 22.04 LTS** 以降または **Fedora 41** 以降が必要で、両方の最新リリースでテストされています。他のディストリビューションでもおそらく動作しますが、検証はされていません。以下のいずれかの方法を選んでください——どちらも同じアプリをインストールします。

### Flatpak

Dóru は **Flatpak** で配布されています。Flatpak はほとんどの Linux ディストリビューションでアプリケーションをインストールする標準的な方法です。まだ Flatpak がインストールされていない場合は、[flatpak.org/setup](https://flatpak.org/setup/) でお使いのディストリビューションのセットアップ手順に従ってください。

Dóru をインストールするには、ターミナルを開いて次のコマンドを実行します：

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru がアプリケーションメニューに表示されます。後で更新するには、システムのソフトウェアアプリケーション（GNOME Software や Discover など）に Flatpak の更新を任せるか、ターミナルで `flatpak update` を実行してください。

### Homebrew

Dóru は Linux でも **Homebrew** で配布されています。まだ Homebrew がない場合は、先に [brew.sh](https://brew.sh) からインストールしてください。

Dóru をインストールするには、ターミナルを開いて次のコマンドを実行します：

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru がアプリケーションメニューに表示されます。後で更新するには、ときどきターミナルで `brew upgrade --cask doru` を実行してください。

## Windows（実験的） {#windows-experimental}

Windows 版の Dóru は **Scoop** で配布されています。Scoop はアプリケーションを最新に保つコマンドラインインストーラーです。まだ Scoop がない場合は、先に [scoop.sh](https://scoop.sh) からインストールしてください。

Dóru には Windows 11 以降が必要です。

Dóru をインストールするには、PowerShell を開いて次のコマンドを実行します：

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru がスタートメニューに表示されます。後で更新するには、ときどき PowerShell で `scoop update doru` を実行してください。
