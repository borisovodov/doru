---
source-hash: 70e5c9243679
---

# Dados e backups

- Seus dados são um arquivo comum — e continuam seus. O Dóru não tem contas, nem
  backend na nuvem, nem telemetria. Nada é enviado a lugar nenhum a menos que
  *você* configure um provedor de IA remoto — e mesmo assim, as mensagens do
  chat e os dados da árvore que o assistente obtém por meio de suas ferramentas
  são enviados a esse provedor. Se quiser manter tudo no seu computador,
  provedores locais (Ollama, LM Studio) funcionam totalmente offline.
- Para fazer backup: pare todo processo que possa escrever no projeto — feche-o
  no Dóru e pare quaisquer clientes MCP ou outras ferramentas — e então copie o
  arquivo `.doru` (e a pasta `media/` ao lado dele, se você tiver fotos). É só
  isso. Restaurar é copiar de volta tanto o arquivo `.doru` quanto a pasta
  `media/` com o projeto fechado e sem nenhum outro processo gravando. Depois de
  um travamento, abra o projeto uma vez no Dóru para que o SQLite possa
  recuperar qualquer journal restante e feche-o antes de copiar ou restaurar.
- As sessões de chat ficam no diretório de dados do aplicativo, não dentro do
  arquivo `.doru`; faça um backup separado delas se precisar.
- O arquivo é compatível com controle de versão: é um arquivo binário estável —
  faça commit dele no git se quiser.

## Sincronização entre máquinas

O Dóru não tem um mecanismo de sincronização integrado — projetos são arquivos
comuns, e mantê-los sincronizados é sua tarefa: iCloud Drive, Dropbox, rclone,
rsync, um pendrive, o que você preferir.

Uma ressalva: o arquivo `.doru` é um banco de dados SQLite, e sincronizar ao
vivo um projeto **aberto** com uma ferramenta de sincronização de arquivos pode
copiar o arquivo em um estado de gravação incompleta e corrompê-lo. A prática
segura é: feche o projeto (ou o aplicativo) e pare qualquer outro processo que
escreva antes de sincronizar. Um projeto fechado corretamente e em que ninguém
mais escreve pode ser copiado com segurança. Depois de um travamento, abra o
projeto uma vez no Dóru para que o SQLite possa reverter qualquer journal
restante e feche-o antes de copiar.
