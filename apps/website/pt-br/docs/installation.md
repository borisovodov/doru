---
source-hash: 762f7e504ddc
---

# Instalação e atualizações

O Dóru é instalado pela loja de aplicativos ou pelo gerenciador de pacotes da
sua plataforma.

## macOS {#macos}

O Dóru no macOS é distribuído pelo **Homebrew**, um gerenciador de pacotes que
instala e atualiza aplicativos para você. Se você ainda não tem o Homebrew,
instale-o primeiro em [brew.sh](https://brew.sh).

O Dóru requer macOS 13 (Ventura) ou posterior e um Mac com Apple silicon (M1 ou
posterior); Macs Intel não são compatíveis.

Para instalar o Dóru, abra o Terminal e execute estes comandos:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru agora aparece nos seus Aplicativos. Para atualizá-lo depois, execute
`brew upgrade --cask doru` no Terminal de vez em quando.

## Linux {#linux}

O Dóru no Linux roda em máquinas x86-64 e arm64. Ele requer **Ubuntu 22.04
LTS** ou posterior, ou **Fedora 41** ou posterior; é testado nas versões mais
recentes de ambos. Outras distribuições provavelmente também funcionarão, mas
não são verificadas. Escolha qualquer um dos métodos abaixo — ambos instalam o
mesmo aplicativo.

### Flatpak

O Dóru é distribuído pelo **Flatpak**, a forma padrão de instalar aplicativos na
maioria das distribuições Linux. Se o Flatpak ainda não estiver instalado,
siga as etapas de configuração para sua distribuição em
[flatpak.org/setup](https://flatpak.org/setup/).

Para instalar o Dóru, abra um terminal e execute estes comandos:

```sh
flatpak remote-add flathub https://dl.flathub.org/repo/flathub.flatpakrepo --user --if-not-exists
```

```sh
flatpak remote-add borisovodov https://borisovodov.github.io/flatpak/borisovodov.flatpakrepo --user --if-not-exists
```

```sh
flatpak install borisovodov doru
```

Dóru agora aparece no seu menu de aplicativos. Para atualizá-lo depois, deixe o
aplicativo de software do seu sistema cuidar das atualizações do Flatpak (por
exemplo, GNOME Software ou Discover), ou execute `flatpak update` em um
terminal.

### Homebrew

O Dóru também é distribuído pelo **Homebrew** no Linux. Se você ainda não tem o
Homebrew, instale-o primeiro em [brew.sh](https://brew.sh).

Para instalar o Dóru, abra um terminal e execute estes comandos:

```sh
brew tap borisovodov/taps
```

```sh
brew trust borisovodov/taps
```

```sh
brew install --cask doru
```

Dóru agora aparece no seu menu de aplicativos. Para atualizá-lo depois, execute
`brew upgrade --cask doru` em um terminal de vez em quando.

## Windows (experimental) {#windows-experimental}

O Dóru no Windows é distribuído pelo **Scoop**, um instalador de linha de
comando que mantém os aplicativos atualizados. Se você ainda não tem o Scoop,
instale-o primeiro em [scoop.sh](https://scoop.sh).

O Dóru requer Windows 11 ou posterior.

Para instalar o Dóru, abra o PowerShell e execute estes comandos:

```powershell
scoop bucket add bucket https://github.com/borisovodov/bucket
```

```powershell
scoop install doru
```

Dóru agora aparece no seu menu Iniciar. Para atualizá-lo depois, execute
`scoop update doru` no PowerShell de vez em quando.
