---
source-hash: 762f7e504ddc
---

# 설치와 업데이트

Dóru는 사용하는 플랫폼의 앱 스토어나 패키지 관리자에서 설치합니다.

## macOS {#macos}

macOS용 Dóru는 **Homebrew**를 통해 배포됩니다. Homebrew는 애플리케이션 설치와 업데이트를 대신 처리해 주는 패키지 관리자입니다. 아직 Homebrew가 없다면 먼저 [brew.sh](https://brew.sh)에서 설치하세요.

Dóru는 macOS 13(Ventura) 이상과 Apple 실리콘 Mac(M1 이후)이 필요합니다. Intel Mac은 지원되지 않습니다.

Dóru를 설치하려면 터미널을 열고 다음 명령을 실행하세요:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

이제 Dóru가 응용 프로그램 폴더에 나타납니다. 나중에 업데이트하려면 가끔 터미널에서 `brew upgrade --cask doru`를 실행하세요.

## Linux {#linux}

Linux용 Dóru는 x86-64 및 arm64 머신에서 실행됩니다. **Ubuntu 22.04 LTS** 이상 또는 **Fedora 41** 이상이 필요하며, 두 배포판의 최신 릴리스에서 테스트됩니다. 다른 배포판에서도 대부분 작동하겠지만 검증되지는 않았습니다. 아래 두 방법 중 하나를 선택하세요——둘 다 같은 앱을 설치합니다.

### Flatpak

Dóru는 **Flatpak**을 통해 배포됩니다. Flatpak은 대부분의 Linux 배포판에서 애플리케이션을 설치하는 표준 방법입니다. 아직 Flatpak이 설치되어 있지 않다면 [flatpak.org/setup](https://flatpak.org/setup/)에서 배포판에 맞는 설정 단계를 따르세요.

Dóru를 설치하려면 터미널을 열고 다음 명령을 실행하세요:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

이제 Dóru가 애플리케이션 메뉴에 나타납니다. 나중에 업데이트하려면 시스템의 소프트웨어 애플리케이션(예: GNOME 소프트웨어 또는 Discover)이 Flatpak 업데이트를 처리하도록 하거나 터미널에서 `flatpak update`를 실행하세요.

### Homebrew

Dóru는 Linux에서도 **Homebrew**를 통해 배포됩니다. 아직 Homebrew가 없다면 먼저 [brew.sh](https://brew.sh)에서 설치하세요.

Dóru를 설치하려면 터미널을 열고 다음 명령을 실행하세요:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

이제 Dóru가 애플리케이션 메뉴에 나타납니다. 나중에 업데이트하려면 가끔 터미널에서 `brew upgrade --cask doru`를 실행하세요.

## Windows(실험적) {#windows-experimental}

Windows용 Dóru는 **Scoop**을 통해 배포됩니다. Scoop은 애플리케이션을 최신 상태로 유지해 주는 명령줄 설치 프로그램입니다. 아직 Scoop이 없다면 먼저 [scoop.sh](https://scoop.sh)에서 설치하세요.

Dóru는 Windows 11 이상이 필요합니다.

Dóru를 설치하려면 PowerShell을 열고 다음 명령을 실행하세요:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

이제 Dóru가 시작 메뉴에 나타납니다. 나중에 업데이트하려면 가끔 PowerShell에서 `scoop update doru`를 실행하세요.
