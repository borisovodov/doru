---
source-hash: e207f75e832a
---

# Dados e backups

- Seus dados são um arquivo comum — e continuam seus. O Dóru não tem contas,
  nem backend na nuvem, nem telemetria. Nada é enviado a lugar nenhum a menos
  que *você* configure um provedor de IA — e mesmo assim, apenas o conteúdo que
  você envia no chat sai da sua máquina. Se quiser manter tudo no seu
  computador, provedores locais (Ollama, LM Studio) funcionam totalmente
  offline.
- Para fazer backup: copie o arquivo `.doru` (e a pasta `media/` ao lado dele,
  se você tiver fotos). É só isso. Restaurar é copiá-lo de volta.
- O arquivo é compatível com controle de versão: é um arquivo binário estável —
  faça commit dele no git se quiser.

## Sincronização entre máquinas

O Dóru não tem um mecanismo de sincronização integrado — projetos são arquivos
comuns, e mantê-los sincronizados é sua tarefa: iCloud Drive, Dropbox, rclone,
rsync, um pendrive, o que você preferir.

Uma ressalva: o arquivo `.doru` é um banco de dados SQLite, e sincronizar ao
vivo um projeto **aberto** com uma ferramenta de sincronização de arquivos pode
copiar o arquivo em um estado de gravação incompleta e corrompê-lo. A prática
segura é: feche o projeto (ou o aplicativo) antes de sincronizar. Copiar um
projeto fechado é sempre seguro.
