---
source-hash: 762f7e504ddc
---

# Установка и обновление

Dóru устанавливается из магазина приложений или менеджера пакетов вашей
платформы.

## macOS {#macos}

Dóru для macOS распространяется через **Homebrew** — менеджер пакетов,
который устанавливает и обновляет приложения за вас. Если Homebrew ещё не
установлен, сначала установите его с [brew.sh](https://brew.sh).

Для Dóru требуется macOS 13 (Ventura) или новее и Mac на Apple silicon
(M1 или новее); Mac с процессорами Intel не поддерживаются.

Чтобы установить Dóru, откройте Терминал и выполните следующие команды:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru теперь в вашей папке «Программы». Чтобы обновить его позже, время от
времени выполняйте в Терминале `brew upgrade --cask doru`.

## Linux {#linux}

Dóru для Linux работает на машинах x86-64 и arm64. Требуется
**Ubuntu 22.04 LTS** или новее либо **Fedora 41** или новее; приложение
протестировано на последних выпусках обеих систем. Другие дистрибутивы,
скорее всего, тоже подойдут, но не проверялись. Выберите любой из способов
ниже — оба устанавливают одно и то же приложение.

### Flatpak

Dóru распространяется через **Flatpak** — стандартный способ установки
приложений в большинстве дистрибутивов Linux. Если Flatpak ещё не установлен,
выполните шаги настройки для своего дистрибутива на
[flatpak.org/setup](https://flatpak.org/setup/).

Чтобы установить Dóru, откройте терминал и выполните следующие команды:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru появится в меню приложений. Чтобы обновить его позже, позвольте
системному приложению для управления ПО обрабатывать обновления Flatpak
(например, GNOME Software или Discover) или выполняйте в терминале
`flatpak update`.

### Homebrew

Dóru также распространяется через **Homebrew** в Linux. Если Homebrew ещё не
установлен, сначала установите его с [brew.sh](https://brew.sh).

Чтобы установить Dóru, откройте терминал и выполните следующие команды:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru появится в меню приложений. Чтобы обновить его позже, время от
времени выполняйте в терминале `brew upgrade --cask doru`.

## Windows (экспериментально) {#windows-experimental}

Dóru для Windows распространяется через **Scoop** — установщик командной
строки, который поддерживает приложения в актуальном состоянии. Если Scoop
ещё не установлен, сначала установите его с [scoop.sh](https://scoop.sh).

Для Dóru требуется Windows 11 или новее.

Чтобы установить Dóru, откройте PowerShell и выполните следующие команды:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru появится в меню «Пуск». Чтобы обновить его позже, время от
времени выполняйте в PowerShell `scoop update doru`.
