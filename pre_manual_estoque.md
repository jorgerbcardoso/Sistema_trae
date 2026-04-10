Manual de Utilização do Módulo Estoque:
1. o usuário administrador deve previamente cadastrar os outros usuários e definir as permissões de acesso a cada tela do módulo
2. devem ser cadastradas todas as unidades previamente - a importação das unidades do SSW é totalmente possível
3. com as unidades cadastradas, podemos iniciar o cadastro de ESTOQUES. cada unidade pode ter diversos estoques cadastrados, de forma que a numeração do estoque será exibida no formato AAA000000, onde AAA é a unidade e 000000 é o número do estoque, dentro da unidade.
4. após isso, devem ser cadastrados os TIPOS DE ITEM. O sistema Presto já vem com um "esqueleto" de tipos de item, que pode ser totalmente personalizado. É importante controlar o acesso a esta tela, para que não sejam gerados conflitos operacionais.
5. Cadastro de itens: uma vez tendo os tipos de item definidos, podemos cadastrar os itens. os itens possuirão 2 códigos: o código interno da empresa (obrigatório) e o código do Fabricante (opcional, mas útil para compras). Também serão definidos a Descrição do item, o Tipo de Item (previamente cadastrado) e a Unidade de Medida utilizada para medição/saldo do item.
  5.1. ainda na tela de cadastro de itens, é possível definir o Valor Unitário. sugerimos que este valor seja cadastrado, ao menos "aproximadamente". Este valor será automaticamente atualizado conforme as compras do item forem efetuadas.
  5.2. também no cadastro do item, será possível, opcionalmente, definirmos o estoque mínimo e máximo do item. Quando o consumo do item fizer com que ele atinga o estoque mínimo, o sistema automaticamente sinalizará o setor de compras, para que a quantidade necessária para atingir o estoque máximo seja comprada.
6. Tendo os Estoques e Itens definidos, podemos montar as POSIÇÕES do estoque, que nada mais são do que endereços de onde o item se encontra, dentro de um estoque.
  6.1. Cada posição terá um item, e seu saldo.
  6.2. Cada posição terá, como formato de endereço, Rua/Altura/Coluna. Exemplo: A/1/1 (Rua A, Coluna 1, Altura 1). O endereçamento permite que qualquer colaborador consiga encontrar o item requisitado dentro do estoque, sem necessidade de familiaridade com os itens.
  6.3. IMPORTANTE: Caso você não deseje controlar endereçamentos, mesmo assim as posições devem ser definidas. Mais de um item pode ser atribuído à mesma posição, ou seja, é possível cadastrar uma posição ÚNICA para todos os itens.
  6.4. Ainda no caso de não-endereçamento, na entrada de itens no estoque, será possível cadastrar uma posição fictícia (PSO/1/1). Isso isenta você da necessidade de cadastrar posições.
  6.5. Na tela de posições também será possível ver o MAPA do estoque, exibindo exatamente os itens e saldos de cada posição. Como os itens possuem VALOR UNITÁRIO, nesta tela também já será possível sabermos quanto temos em VALOR dentro do estoque.
7. Inventário: no início das operações no Sistema Presto, sugerimos fortemente que seja feito um inventário. Esta tela permite fazermos a conferência/contagem exata de cada posição/item no estoque.
  7.1. Pode ser feito um inventário GERAL, ou limitado, ou seja, é possível contarmos o estoque parcialmente (apenas uma RUA, por exemplo)
  7.2. Mesmo após o golive do sistema, é muito interessante manter os inventários sendo feitos com certa frequência, para evitar inconsistências nos saldos.
8. Entrada no estoque - As entrada no estoque podem ser feitas de duas formas: Manual ou via Pedido
  8.1. As entradas manuais são para itens que estão entrando no estoque de maneira "informal". É, inclusive, uma alternativa para o inventário.
  8.2. Entradas via pedido exigem que seja informado o PEDIDO junto ao fornecedor, que foi previsamente gerado e aprovado pelo setor de COMPRAS.
  8.3. Nas entradas, cada item será conferido (quantidade do pedido x quantidade recebida)
  8.4. No momento da entrada, também é definida a POSIÇÃO do estoque em que o item ficará, alimentando não apenas o estoque, como também a posição.
9. Saída do estoque: funcionalidade utilizada, normalmente, pelo almoxarife da empresa.
  9.1. Na tela de nova saída será informado não apenas o estoque, mas também o nome do solicitante e o CENTRO DE CUSTO que está consumindo o item.
  9.2. Opcionalmente, para empresas que querem controlar custos com a FROTA, a placa do veículo deve ser informada nesta tela.
  9.3. Diversos itens podem sair em uma mesma movimentação. Deverá ser informada a quantidade requisitada e a posição de onde os itens estão saindo. Isso porque o mesmo item pode estar em mais de uma posição
10. Relatório de movimentação do estoque: Aqui todo o processo poderá ser minuciosamente monitorado, com diversos filtros e totais.
  10.1. Será exibido o movimento (Entrada/Saída)
  10.2. Será exibido o tipo de movimentação (Entrada Manual, Entrada via Pedido, Saída do Estoque (requisição) ou Inventário)
  10.3. Os valores dos itens farão parte da relação, assim fica fácil de vermos quanto saiu em dinheiro, quanto entrou em dinheiro, e qual foi o saldo financeiro do período.