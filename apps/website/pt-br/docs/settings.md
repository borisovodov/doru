---
source-hash: cb76eaf45583
---

# Configurações

As configurações globais ficam em `settings.json` na pasta de dados do
aplicativo:

| Sistema operacional | Caminho |
|---|---|
| macOS | `~/Library/Application Support/Doru/settings.json` |
| Linux | `~/.config/Doru/settings.json` |
| Windows | `%APPDATA%\Doru\settings.json` |

**Os padrões ficam no aplicativo; o arquivo registra apenas substituições
explícitas.** Na primeira execução, o aplicativo cria o arquivo apenas com a
referência `$schema` — todo o resto recorre aos padrões integrados, então novos
padrões chegam aos usuários existentes com atualizações do aplicativo. A
referência `$schema` é a única fonte de documentação: editores com suporte a
JSON Schema (VS Code, Zed, JetBrains) oferecem preenchimento automático,
validação e descrições de campos a partir dela. O aplicativo grava entradas no
arquivo apenas quando você altera uma configuração em **Configurações**; todo o
resto permanece intacto.
O arquivo é JSON simples com comentários permitidos — edite-o com qualquer
editor; as alterações são detectadas ao vivo enquanto o aplicativo está em
execução. O aplicativo valida o arquivo em relação ao esquema ao carregar; se
ele não for analisado ou não corresponder ao esquema, é substituído pelo modelo
vazio (um aviso é registrado). O provedor de IA é configurado na seção `ai`
deste arquivo — veja [IA e agentes](agents.md).

Referência completa:

```jsonc
{
  "$schema": "https://doru.family/settings.json",

  // Provedores de IA — defina em Configurações (ícone de engrenagem) ou aqui diretamente.
  "ai": {
    // O provedor ativo: ollama | lmstudio | custom | acp
    // (as predefinições de nuvem voltam uma a uma).
    "provider": "ollama",

    // Configurações por provedor, indexadas pelo id do provedor. Apenas a
    // entrada do provedor ativo é usada; as outras mantêm seus valores e são
    // restauradas quando você volta.
    "providers": {
      "ollama": {
        "baseUrl": "", // substituição opcional do endpoint padrão do provedor
        "model": ""
      }
      // Apenas para "acp": o binário do agente a iniciar.
      // "acp": { "command": "my-agent", "args": [] }
    }
  },

  // Tema: um arquivo de paleta com uma seção escura e uma clara. A aparência
  // do sistema operacional decide qual paleta se aplica.
  "theme": "doru"
}
```

## Logs

O aplicativo acrescenta diagnósticos a `doru.log` na pasta de dados (ao lado de
`settings.json`). O arquivo é rotacionado em 5 MB — o arquivo anterior é
mantido como `doru.old.log`. O nível de detalhe padrão é `warn` (builds de
desenvolvimento registram em `debug`); defina
`DORU_LOG_LEVEL=trace|debug|info|warn|error` para substituí-lo. Avisos de
validação de esquema (um arquivo de configurações ou de tema que não
corresponde ao seu esquema) são registrados aqui. O botão **Abrir arquivo de
log** em Configurações cria o arquivo sob demanda se nada tiver sido registrado
ainda.
