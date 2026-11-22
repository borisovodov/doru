---
source-hash: b3dd07f80d43
---

# IA e agentes

## O chat integrado

O painel de chat fica na parte inferior da janela. Digite uma pergunta e o
agente pode ler e editar a árvore usando ferramentas integradas: `tree_query`,
`tree_get`, `tree_stats`, `tree_edit`, `tree_add_relative`, `sources_add`,
`notes_write`.

As conversas são salvas como **sessões de chat**: o cabeçalho do painel de chat
lista suas sessões, e você pode alternar entre elas, iniciar um novo chat ou
excluí-las. As sessões são armazenadas por projeto na pasta de dados do
aplicativo (não dentro do arquivo `.doru`), o título vem da sua primeira
mensagem, e tudo sobrevive a reinicializações do aplicativo. Cada resposta tem
um botão de copiar que coloca seu markdown bruto na área de transferência do
sistema.

O provedor é configurado na seção `ai` de `settings.json` (veja
[Configurações](settings.md)):

- **Predefinições de provedor**: Ollama, LM Studio, um endpoint personalizado
  compatível com OpenAI ou um agente ACP. As predefinições de nuvem retornam uma
  a uma conforme suas integrações são reconstruídas. Defina o id em
  `"provider"`; cada predefinição fornece uma URL base padrão, enquanto o
  modelo é escolhido no assistente em Configurações — buscado do provedor para
  endpoints locais, selecionado do catálogo incluído para predefinições de
  nuvem. Cada provedor mantém sua própria configuração (modelo, URL base,
  raciocínio, chave) em `"providers"` — trocar de provedor restaura a
  configuração salva de cada um.
- **As chaves de API** são armazenadas em `secrets.json` (modo 0600) na pasta
  de dados do aplicativo, indexadas pelo id do provedor. A chave nunca aparece
  no arquivo de configurações.

## Dóru AI (assistente offline)

O provedor padrão é o **Dóru AI**: um assistente local que roda inteiramente no
seu computador. Baixe-o uma vez nas configurações de IA (um único arquivo,
cerca de 3 GB); depois disso, o chat funciona sem conta e sem conexão com a
internet. Ele é selecionado por padrão em uma instalação nova e precisa de pelo
menos 8 GB de RAM.

O modelo baixado é o Qwen3.5-4B (GGUF quantizado em Q4_K_M, licença Apache-2.0
— veja o [cartão do modelo](https://huggingface.co/Qwen/Qwen3.5-4B)). Os pesos
são fixados por SHA-256 no manifesto do aplicativo e verificados após cada
download.

## Agentes ACP

Defina `"ai": { "provider": "acp", "providers": { "acp": { "command": "…",
"args": [] } } }` para conversar com um agente que fala o Agent Client
Protocol (agentes no estilo Zed). O Dóru passa o projeto ao agente como um
servidor MCP, para que o agente possa consultar e editar a árvore como o chat
integrado.

## Dóru como servidor MCP

Qualquer cliente MCP — Claude Desktop, Cursor, agentes de programação — pode
trabalhar com sua árvore. Execute o Dóru em modo servidor, apontando para o
arquivo `.doru`:

```sh
doru --mcp-server /absolute/path/to/family.doru
```

Exemplo de configuração do Claude Desktop
(`Claude → Settings → Developer → Edit Config`):

```json
{
  "mcpServers": {
    "doru": {
      "command": "/Applications/Doru.app/Contents/MacOS/doru",
      "args": ["--mcp-server", "/Users/you/FamilyHistory/family.doru"]
    }
  }
}
```

Linux AppImage: o caminho para o arquivo AppImage. Windows:
`"command": "C:\\Program Files\\Doru\\doru.exe"`. Os nomes das ferramentas
permanecem em inglês independentemente do idioma da interface.

O servidor é **headless e sem estado**: sem janela, sem ícone no dock, sem
sessões de chat — ele lê e edita o arquivo da árvore diretamente e sai quando o
cliente se desconecta. Qualquer número de clientes pode apontar para o mesmo
arquivo ao mesmo tempo (Claude Desktop, Cursor, vários agentes de programação);
gravações concorrentes entram na fila com segurança. Se um cliente não conseguir
iniciar o servidor, execute o comando em um terminal — o programa auxiliar
registra problemas em stderr e seu perfil temporário é descartado ao sair.

## Exemplos de prompts

- *“Encontre todos os nascidos antes de 1850 e liste suas fontes.”*
- *“Adicione Ivan Ivanov, nascido por volta de 1923, como filho de Petr e
  Maria.”*
- *“Escreva uma nota de pesquisa sobre Anna a respeito do censo de 1901.”*
- *“Verifique minha árvore em busca de pessoas nascidas depois da morte dos
  pais.”*
