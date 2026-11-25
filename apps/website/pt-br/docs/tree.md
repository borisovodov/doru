---
source-hash: d6792c4fa89a
---

# Trabalhando com a árvore

A árvore abre como uma tela interativa. Tudo abaixo acontece na própria tela; a
lista de pessoas fica na visão **Pessoas** da barra de atividades à esquerda.

## Navegação

- **Desloque** arrastando o fundo, **aplique zoom** com a roda do mouse ou o
  trackpad; os botões de zoom ficam no canto da tela.
- **Recentralize** uma pessoa com um clique duplo no cartão dela. A barra de
  ferramentas mantém um histórico: setas para trás/para frente e uma trilha de
  foco.
- **Gráficos**: alterne entre as visões *Antepassados*, *Descendentes*,
  *Ampulheta* e *Família* na barra de ferramentas. A visão de família mostra o
  casal em foco, seus filhos e ambos os lados dos pais.
- **Pesquisa**: digite um nome na caixa de pesquisa da barra de ferramentas e
  escolha um resultado para ir até essa pessoa.
- **Recolha** um ramo com o chevron em um cartão (ou recolha/expanda todos os
  ramos pela barra de ferramentas).

## Cartões

Cada cartão mostra um avatar com as iniciais, o nome, os anos de vida (com †
para pessoas falecidas) e pequenos indicadores com a contagem de notas, fontes
e mídia. A borda esquerda marca a linha do pai (azul) e da mãe (rosa) nos
gráficos de antepassados; a moldura de destaque marca a pessoa em foco.

## Edição

Selecione um cartão para revelar a barra de ferramentas de ações:

- **Adicionar filho / cônjuge / pai** — um novo cartão vazio aparece ao lado da
  pessoa; digite o nome diretamente no cartão e confirme com a marca de
  seleção (o X descarta o cartão).
- **Editar** — abre o editor completo da pessoa como uma aba: nomes, sexo,
  datas de nascimento/morte com um marcador de qualidade (*Exata / Aproximada
  / Antes / Depois*) e um campo de texto livre para a data (por exemplo, uma
  data do calendário “23 Nivôse” que não corresponde ao gregoriano), famílias,
  eventos, fontes, notas e mídia.
- **Excluir** — remove a pessoa da árvore e de todas as famílias.
- **Alterar pais**: arraste um cartão sobre o cartão de outra pessoa para mover
  a pessoa arrastada como filho para aquela família (o destino válido se
  destaca durante o arraste).

Uma árvore nova (vazia) mostra um cartão vazio: clique nele, digite o nome,
confirme com a marca de seleção e a primeira pessoa aparece na tela. Depois
disso, faça a árvore crescer a partir dos próprios cartões.

## Famílias

Dentro do editor completo da pessoa, adicione pais, um parceiro ou filhos.
Digite um nome para escolher uma pessoa existente; os chips mostram os membros
de cada família. Remover uma pessoa de uma família ou excluir uma família é um
clique.

## Fontes e notas

- **Fontes**: anexe fontes a uma pessoa (com título e autor) ou reutilize uma
  fonte existente. Cada anexo é uma citação e pode ser removido.
- **Notas**: notas de pesquisa livres anexadas a uma pessoa. Uma nota pode ser
  anexada a vários registros: use **Anexar uma nota existente** na seção Notas
  de outro registro, depois escolha se uma edição deve atualizar o texto
  compartilhado em todos os lugares ou apenas o registro atual. **Desvincular
  deste registro** remove um vínculo; **Excluir em todos os lugares** remove a
  nota.
- Eventos e nomes têm suas próprias seções Fontes, Notas e Identificadores dentro do editor da pessoa; eventos também têm Contatos.

## Endereços

A visão **Fontes** tem uma seção **Endereços**. Use-a para criar, editar e
excluir endereços independentes. Endereços usados por eventos, repositórios ou
submetedores mostram sua contagem de usos; excluir um o desvincula desses
registros. O seletor de endereço de um evento também tem as ações **Novo
endereço** e **Editar endereço** para editar um endereço no próprio local.

## Tarefas

As tarefas têm uma data de criação e uma data de lembrete. Concluir uma tarefa apenas altera seu status; nenhuma data de conclusão separada é armazenada. Todo editor tem uma seção **Tarefas**: adicione uma tarefa ali e ela
é vinculada automaticamente àquele registro. Eventos, nomes e citações
têm sua própria seção Tarefas no painel de anexos. **Relacionado a** vincula uma tarefa a um ou mais registros da árvore — uma pessoa, família, evento, nome, fonte, citação, mídia, lugar, repositório, endereço ou obra; deixe vazio para uma tarefa independente. Uma tarefa é compartilhada: editá-la em qualquer lugar atualiza o mesmo registro, e excluir um registro relacionado mantém a tarefa. Use **Anexar uma tarefa existente** para reutilizar uma tarefa compartilhada em vez de criar uma nova.

Obras, endereços, associações e vínculos de parceiro/filho das famílias têm as mesmas seções Notas, Fontes, Identificadores, Colaboradores e Tarefas das abas das entidades principais. Endereços também têm Contatos. As tarefas mantêm Notas, Identificadores, Colaboradores e a seção Tarefas existente, mas não têm Fontes nem Contatos.

## Mídia

As fotos são arquivos comuns na pasta `media/` ao lado do projeto. Adicione-as
a partir de uma pessoa, família, fonte, lugar, repositório, submetedor, obra,
tarefa ou endereço; a seção **Relacionado a** da aba de mídia permite anexar um registro existente a outros destinos. Clique em uma prévia para abrir a aba de mídia, onde
você pode editar o título, gerenciar os arquivos e editar metadados do vínculo,
como a legenda, a sequência, o sinalizador principal e o de exclusão.

Um registro de mídia pode ser vinculado a vários destinos. **Desvincular deste registro** remove um vínculo e exclui o registro quando era o último; **Excluir mídia** remove o registro e as cópias dos seus arquivos. Excluir um registro de destino remove apenas seus vínculos, então um registro de mídia compartilhado pode permanecer sem vínculos.

## Ordenação

As listas em que a ordem importa — nomes, parceiros e filhos de uma família,
nomes de lugares, linhas de endereço, participantes de eventos e campos de
modelo — têm controles para cima/para baixo. A ordem é armazenada como a
posição da linha.
