---
source-hash: 472083c37a73
---

# Início rápido

1. Inicie o Dóru e clique em **Criar novo projeto…** (ou **Abrir projeto ou
   importar GEDCOM…**) na página inicial.
2. **Criar** pede um local e um nome e cria um arquivo `.doru` ali; **Abrir
   projeto ou importar GEDCOM** abre um arquivo `.doru` existente, ou um
   arquivo GEDCOM `.ged`/`.gdz` — um arquivo GEDCOM inicia um novo projeto
   ainda não salvo com a árvore importada; salve-o como `.doru` depois. O
   arquivo *é* o projeto — seu nome é o nome do projeto:

```
My Family.doru      a própria árvore (SQLite, identificada com um ID do aplicativo)
media/              fotos e digitalizações, criadas sob demanda (opcional)
```

3. Insira os dados: uma árvore nova mostra um cartão vazio — clique nele,
   digite o nome, confirme com a marca de seleção e a primeira pessoa aparece
   na tela; cada cartão pode adicionar filhos, cônjuges e pais da mesma forma.
   Arquivos GEDCOM entram por **Abrir projeto ou importar GEDCOM** (etapa 2).
   Para exportar, abra a aba **Exportar GEDCOM**, escolha **GEDCOM 7.0**
   (`.ged`) ou **GEDZIP** (`.gdz`, com os arquivos de mídia gerenciados), e
   confirme o local de salvamento.

Cada projeto é aberto em sua **própria janela**; pessoas, o editor da árvore e
as configurações abrem como abas dentro dela. **Nova janela** (`⌘⇧N`,
`Ctrl+Shift+N` no Linux e no Windows) abre outra página inicial sem fechar o
projeto atual, para que você possa importar um arquivo GEDCOM ou abrir uma
segunda árvore ao lado dele. Projetos usados recentemente são listados na
página inicial, e suas janelas de projeto abertas são restauradas na próxima
inicialização.
Um clique duplo em um arquivo `*.doru` (ou a abertura de um link
`doru://open?path=/…/family.doru`) o abre no aplicativo em execução.

## Abrindo projetos a partir de links

O aplicativo registra o esquema de URL `doru://`, então um link
`doru://open?path=…` abre o projeto — ou importa o arquivo, para `.ged`/`.gdz` —
mesmo quando o aplicativo ainda não está em execução:

- O caminho deve ser **absoluto e codificado na URL** (`%20` para espaços, e
  assim por diante), por exemplo
  `doru://open?path=%2FUsers%2Fyou%2FFamily.doru`.
- Se o aplicativo não estiver em execução, o link o inicia e abre o projeto
  imediatamente.
- Se o aplicativo já estiver em execução, o projeto abre na instância em
  execução — uma segunda instância nunca é iniciada, a janela existente recebe
  o foco.
- Os links só funcionam para os tipos de arquivo que o aplicativo abre
  diretamente: projetos `.doru` e arquivos GEDCOM `.ged`/`.gdz`.

No macOS, `open "doru://open?path=…"` envia o link pelo terminal ou por outros
aplicativos; no Linux, o `xdg-open` faz o mesmo.

## Próximos passos

- [Trabalhando com a árvore](tree.md) — pessoas, famílias, fontes, notas.
- [Configurações](settings.md) — a referência de `settings.json`.
- [IA e agentes](agents.md) — deixe um agente ler e editar sua árvore.
- [Temas](themes.md) — um tema com paletas clara e escura, escolhido conforme a
  aparência do sistema operacional.
