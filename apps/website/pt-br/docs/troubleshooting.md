---
source-hash: 77b60fd904c7
---

# Solução de problemas

- **Um projeto `.doru` de uma versão anterior se recusa a abrir** — antes da
  1.0, o esquema do projeto muda sem migrações, então arquivos gravados por
  outra versão não são compreendidos. Abra o projeto na versão que o criou,
  exporte GEDCOM e importe esse arquivo nesta versão.
- **“O provedor de IA não está configurado”** — abra as Configurações (ícone de
  engrenagem na barra à esquerda), escolha um provedor e siga o assistente:
  busque a lista de modelos (ou escolha um modelo) e salve uma chave quando
  necessário.
- **A conexão com o Ollama falha** — selecione a predefinição Ollama (URL base
  `http://localhost:11434/v1`); nenhuma chave de API é necessária. Pressione
  “Buscar modelos do provedor” — se ele informar que o provedor está
  inacessível, verifique se o Ollama está em execução localmente.
