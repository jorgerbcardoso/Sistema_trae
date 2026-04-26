precisamos criar uma nova funcionalidade para as transportadoras que utilizar o Presto.

estou criando-a, na tabela menu_items, da seguinte maneira:
INSERT INTO menu_items (id, code, name, description, icon, route_path, component_path, is_available, status, section_id, ordem)
VALUES ((SELECT MAX(id) + 1 AS next_id FROM menu_items), 'dashboard_disponiveis', 'DISPON&Iacute;VEIS NO ARMAZÉM', 
        'CONTROLE DE CARGAS EM PISO OU EM TRÂNSITO', 'Calendar',  '/dashboards/disponiveis', 'dashboards/Disponíveis',
        true, 'active', 1, (SELECT COALESCE(MAX(ordem), 0) + 1 FROM menu_items WHERE section_id = 1));

veja o registro deoutro dashboard na tabela menu_items. assim saberá como e onde criar os sripts de componentes, frontend e backend:
 id |     code      |         name         |              description               |    icon    |      route_path       |         component_path         | is_available | status |         created_at         |         updated_at         | section_id | ordem
----+---------------+----------------------+----------------------------------------+------------+-----------------------+--------------------------------+--------------+--------+----------------------------+----------------------------+------------+-------
  1 | dashboard_dre | DASHBOARD FINANCEIRO | DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO | TrendingUp | /financeiro/dashboard | dashboards/FinanceiroDashboard | t            | active | 2026-01-19 21:51:58.918958 | 2026-02-27 01:32:42.577999 |          1 |     1

o que será essa funcionalidade:
1. Ela será um dashboard completo que se baseará sempre nos dados de uma mesma unidade
2. Se o usuário estiver, no menu principal, logado em uma unidade diferente de MTZ, o painel vai adotar essa unidade como referência
3. Caso o usuário esteja em MTZ, um dialog pedindo qual unidade ele deseja visualizar deve ser exibido
4. A ideia aqui, em resumo, é mostrar não apenas TUDO o que está parado na unidade em questão (em PISO).
5. Mas também tudo o que está sendo transferido para ela (em trânsito de transferência), e que está com chegada próxima.
6. Além disso, também vamos ler as coletas que estão sendo feitas em torno da cidade (em trânsito de colta)
7. O painel deve ser um grande dashboard, rico em informações. Ainda não decidio o layout e vou te deixar livre para me surpreender.
8. Depois que reunirmos todas essas cargas, provindas dessas 3 origens (PISO, TRANSFERÊNCIA e COLETA), temos que dividir o painel em 2.
9. Eu penso que o painel poderia ter 2 "abas" para essa divisão. A divisão seria "Disponíveis para Transferência" e "Disponíveis para Entrega"
10. IMPORTANTE: os dados virão todos do sistema SSW, usando nossas bibliotecas que já temos de comunicação com eles. Nossa base de dados não será utilizada.
11. As informações da aba "Disponíveis Para Transferência" virão mais rápido, por uma questão de performance, portanto, quero que essa aba seja a principal e carregue primeiro. Imediatamente depois os dados da segunda aba devem começar a ser carregados, mesmo o usuário não visualizando eles ainda!

COMO MONTAR A TELA "DISPONÍVEIS PARA TRANSFERÊNCIA"

1. Vamos utilizar um relatório do SSW chamado "DISPONÍVEIS PARA TRANSFERÊNCIA". Nele também já vamos capturar o que está em Trânsito de Transferência para a unidade em questão.
2. Você vai fazer o login no ssw, como outros programas já fazem (ver CONFERÊNCIA DE SAÍDAS)
3. Você fará a seguinte requisição ao SSW, usando a function "ssw_go" que está em /var/www/html/lib/ssw.php onde $sigla é a sigla da unidade em questão: 
https://sistema.ssw.inf.br/bin/ssw0036?act=ENV&l_siglas_familia=$sigla&data_prev_man=260426&hora_prev_man=1928&data_emit_ctrc=260426&hora_emit_ctrc=0728&status_ctrc=C&ctrc_pendente=T&lista_pendencias=N&apenas_descarregados=T&lista_reversa=T&apenas_prioritarios=T&id_tp_produto=T&fg_enderecados=T&relacionar_produtos=N&relatorio_excel=N&button_env_enable=ENV&button_env_disable=btn_envia
detalhes:
data_prev_man e hora_prev_man são sempre a data e hora de AGORA somada com 12h, e no formato ddmmaa para data e hhmm
data_emit_cte e hora_emit_cte são sempre a data e hora correntes
4. após a requisição feita, precisamos exportar o arquivo. a requisição só devolve o endereço dele. segue um trecho de código de exemplo (de outro relatório), pra vc se basear:
    // Faz o login no sistema
    ssw_login ($dominio_ssw);

    // Faz a requisicao
    $str = ssw_go ('https://sistema.ssw.inf.br/bin/ssw0241?act=IMP');

    if (substr ($str, 0, 5) == '<foc ')
      msg ('Mensagem do SSW (403): ' . $str);

    $str = urldecode ($str);
    $act = ssw_get_act ($str);
    $arq = ssw_get_arq ($str);

    // Abre o arquivo do relatorio
    $file    = ssw_go ('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act . '&filename=' . $arq . '&path=&down=1&nw=0');
    $fil_arr = explode ("\r", $file);

5. repare que, após a extração do arquivo, o arquivo é quebrado em "\r". isso porque é um arquivo de relatório texto, em modo caracter, ou seja, teremos que ler posição a posição de cada linha
6. deverá ser feito um laço lendo cada linha. 
7. há um arquivo, aqui neste projeto, chamado "exemplo_disponiveis_para_transferencia.md"... este é exatamente o relatório que devemos ler. procure entendê-lo bem:
  7.1. colunas do relatório que vamos precisar: CTRC/GAI/PAL (chamaremos de CT-e), AUTOR (Chamaremos de Emissão), PREVI (Chamaremos de Prev. Ent.), REMETENTE (Remetente), PAGADOR (Pagador), DESTINATAR (Destinat.), Destino, UF, MERCADORIA (Vlr. NF), FRETE (Frete), KgREA (Peso), M3 (Cubagem), MANIFESTO (Manifesto) e PREVCHEGADA (Prev. Chegada)
  7.2. Você perceberá, pela iformação acima das colunas "DESTINO FINAL", que o relatório é dividido por unidade de destino. Essa informação (sigla da unidade de destino também é importante)
  7.3. Dentro do bloco de cada unidade de destino, os CT-es (ou CTRCS) são divididos em "NO ARMAZEM" ou "EM TRANSITO". Para saber se é um registro de armazem ou transito, sem ter que chegar ao final do bloco, apenas veja a coluna PREVCHEGADA. Se ela tiver valor, o CT-e está em trânsito! Essa divisão é funcamental.
8. precisaremos exibir um indicador importante aqui - se o manifesto (agrupamento de CT-es para transferência) demorou para sair da unidade de origem.
  8.1. pegue a data de emissão mais recente (coluna AUTOR) dos CT-es do mesmo manifesto.
  8.2. na nossa base, leia a data de emissão deste manifesto na tabela [dominio]_manifesto. para isso, separa a coluna MANIFESTO em 2: as 3 primeiras letras são a série do manifesto, e os 6 dígitos subsequentes são o número do manifesto. os caracteres restantes não interessam. Com isso você tentará localizar o registro em [dominio]_manifesto.
   8.3. se não encontrar o manifesto, considere que ele não foi emitido.
   8.4. se encontrar o manifesto, pegue a data de emissão.
   8.5. calcule a diferença de dias entre a data de emissão e a data de emissão mais recente dos CT-es do mesmo manifesto.
   criar indicadores: verde - no mesmo dia
                      verde - 1 dia depois
					  amarelo - 2 dias depois
					  vermelho - 4 dias depois
9. calcular atraso na transferência - se a previsao de chegada não passou - verde
                                      se a previsao de chegada já passou - amarelo
                                      se a previsao de chegada já passou há 2h - laranja
                                      se a previsao de chegadajá passou há +2h - vermelho

10. a ideia é mostrar qtde ctes, qtde vol, peso e cubagem de tudo DIVIDIDO POR UNIDADE DE DESTINO
11. IMPORTANTE: quando estiver varrendo o relatório, atente-se para as quebras de páginas, pois o babeçalho é impresso novamente.
12. Nas ultimas páginas o relatório forma uma resumo. pode desconsiderar

Com isso montamos toda nossa base de dados do que está em PISO e do que está em TRANSITO DE TRANSFERÊNCIA. Agora falta o que está sendo COLETADO, e deve ser transferido (disponível para transferência)

Para isso, usaremos outro relatório do SSW, o RELATÓRIO DE COLETAS.

você logará no SSW (se já o tiver feito, não precisa) e fará a seguinte requisição:
https://sistema.ssw.inf.br/bin/ssw0157?act=ENV&f2=$sigla&f3=A&f6=230426&f7=240426&f16=0&f17=1&f18=2
IMPORTANTE: os campos f6 e f7 são as datas de coleta, formatadas como "date ('dmy')" no PHP. usaremos sempre "ontem" para f6 e "hoje" para f7.

um exemplo deste arquivo está em 
Este é mais um relatório em modo caracter (txt), e vc terá que ler as posições. No entanto ele é bem diferente, pois não tem cabeçalhos. as coletas são divididas em blopcos e vc terá que procurar pelo "Labels" de cada informação dentro do bloco.

Antes de eu te dizer o que precisamos, você verá que há o label "SIT/INSTR:". nele estão listadas as ocorrencias da coleta. IMPORTANTE: se você encontrar a instrução "CTRC GERADO: [numero de CT-e gerado]", você deve DESCONSIDERAR A COLETA!

Agora vamos às informações que precisamos do relatório, e que devemos apresentar ao nosso usuário:
1. série e número da coleta: são exatamente as 2 primeiras informações do bloco
2. Remetente ("REME:") - capturar apenas o nome
3. Cidade do remetente (strpos ($linha, 120, 25))
4. "DATA/HORA LIMITE": essa é a previsão de coleta, no formado DD/MM/ HH:NN.
5. Campo "COLETADA": se este campo estiver em branco, e a previsão já passou, está atrasado. trabalhar em uma maneira de mostrar isso ao usuário. além disso, por mais que o campo "COLETADA" tenha valor, se foi coletada depois da previsão, também é um atraso!
6. "VAL MERC": Valor da mercadoria, em Reais
7. "QTDE VOL": Quantidade de volumes
8. "PESO": Peso total, em Kg
9. IMPORTANTE: quando estiver varrendo o relatório, atente-se para as quebras de páginas, pois o babeçalho é impresso novamente.
10. No final, o relatório forma uma resumo. pode desconsiderar

-----------------------------------------------------------------

A parte da aba "Disponíveis para entrega" faremos depois

Você já tem bastante trabalho agora

LEMBRANDO QUE QUERO ALGO ORGANIZADO E MODERNO! ALGO QUE NINGUÉM MAIS TEM! 
NÃO QUERO APENAS DAR AS INFORMAÇÕES, MAS TAMBÉM ALERTAR O USUÁRIO ATRAVÉS DE INDICADORES E MOSTRAR AS MELHORES SAÍDAS

