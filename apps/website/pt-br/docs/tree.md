---
source-hash: 385c34608fc6
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
- **Notas**: notas de pesquisa livres anexadas a uma pessoa. Cada nota pertence a um único registro: adicione, edite ou exclua-a na seção Notas desse registro. Uma nota compartilhada de um arquivo GEDCOM importado é copiada para cada registro que a referencia.

## Endereços

A visão **Fontes** tem uma seção **Endereços**. Use-a para criar, editar e
excluir endereços independentes. Endereços usados por eventos, repositórios ou
submetedores mostram sua contagem de usos; excluir um o desvincula desses
registros. O seletor de endereço de um evento também tem as ações **Novo
endereço** e **Editar endereço** para editar um endereço no próprio local.

## Tarefas

As tarefas têm uma data de criação e uma data de lembrete. Concluir uma tarefa apenas altera seu status; nenhuma data de conclusão separada é armazenada. A maioria dos editores tem uma seção **Tarefas**: adicione uma tarefa ali e ela é vinculada automaticamente àquele registro. As exceções são o editor de tarefas e o editor de submetedores, e uma linha de vínculo de mídia tem apenas a seção Fontes: o cartão de uma tarefa mantém Notas e Mídia, o de um submetedor não tem seção Tarefas, e um vínculo de mídia não é alvo de tarefas. Eventos, nomes e citações têm sua própria seção Tarefas no painel de anexos. **Relacionado a** vincula uma tarefa a um ou mais registros da árvore — uma pessoa, família, evento, nome, fonte, citação, mídia, lugar, repositório, endereço ou obra, mas não outra tarefa, um submetedor ou um vínculo de mídia; deixe vazio para uma tarefa independente. Uma tarefa é compartilhada: editá-la em qualquer lugar atualiza o mesmo registro, e excluir um registro relacionado mantém a tarefa. Use **Anexar uma tarefa existente** para reutilizar uma tarefa compartilhada em vez de criar uma nova.

Obras, endereços, associações e vínculos de parceiro/filho das famílias têm as mesmas seções Notas, Fontes, Colaboradores e Tarefas das abas das entidades principais. Os contatos pertencem à pessoa, ao evento, ao repositório ou ao submetedor que descrevem, não a um endereço. As tarefas mantêm Notas e Mídia, mas não têm Fontes, Contatos, Colaboradores nem Tarefas. Um vínculo de mídia tem apenas Fontes.

## Mídia

As fotos são arquivos comuns na pasta `media/` ao lado do projeto. Adicione-as a partir de uma pessoa, família, fonte, lugar, repositório, submetedor, obra, tarefa ou endereço; a seção **Relacionado a** da aba de mídia permite anexar um registro existente a outros destinos. Cada cartão de mídia contém exatamente um arquivo. Clique em uma prévia para abrir a aba de mídia, onde você pode editar o título e os metadados do vínculo, como legenda, sequência, sinalizador principal e sinalizador de exclusão.

Um registro de mídia pode ser vinculado a vários destinos. **Desvincular deste registro** aparece apenas quando a mídia está vinculada a vários destinos; remove um vínculo. **Excluir mídia** remove o registro e a cópia do seu arquivo. Excluir um registro de destino remove apenas seus vínculos, então um registro de mídia pode permanecer sem vínculos. Uma mídia importada de um `OBJE` GEDCOM com vários arquivos se torna um cartão por arquivo; formatos alternativos `TRAN` não são importados.

## Ordenação

As listas em que a ordem importa — nomes, parceiros e filhos de uma família,
nomes de lugares, linhas de endereço, participantes de eventos e campos de
modelo — têm controles para cima/para baixo. A ordem é armazenada como a
posição da linha.
