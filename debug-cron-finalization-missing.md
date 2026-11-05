## Debug session: cron-finalization-missing

### Contexto
- Sintoma: carregamentos em `rve_carregamento` (data_inclusao=2026-11-03) estavam sem `data_finalizacao`; após abrir o painel Disponíveis, passaram a aparecer finalizados.
- Expectativa: o script `src/atualiza_carregamentos.php` deveria finalizar sem depender do painel.

### Hipóteses (falsificáveis)
1. **Painel ainda chama rotina de finalização** (`acao=verificar_saidas_ssw` ou similar) ao abrir/carregar calendário, e por isso finaliza ao abrir a tela.
2. **Script não está alcançando esses carregamentos** por filtro (ex.: `tp_carregamento != 'T'`, `simulado=true`, unidade divergente, ou condição `(data_finalizacao IS NULL OR total_ctes=0)` incorreta).
3. **Script consulta o PER mas não encontra a placa/saída**, por falha no parser do XML do ssw0125, ou por chave/placa divergente (placa provisória vs definitiva).
4. **Script não executa o UPDATE de finalização** (query errada, tabela/coluna diferente no domínio, ou branch de código não é atingido).
5. **Recorte temporal do PER** calculado pelo script não cobre o período onde o manifesto/saída aparece, então nunca “vê” as saídas.

### Evidências necessárias
- E1: confirmar se o frontend ainda faz chamada a `salvar_carregamento.php` com `acao=verificar_saidas_ssw` (ou equivalente) ao abrir o painel.
- E2: logs do script indicando: domínio, universo de carregamentos abertos, período global consultado, total de placas retornadas do PER, e quantos carregamentos foram marcados como finalizados.
- E3: amostra do XML ssw0125(PER) que contém as placas e datas de saída relevantes para os carregamentos listados.

### Achados (até agora)
- O painel **executa importação automática** no mount quando `importacaoAutomatica` está ativa (default true), chamando `importar_carregamentos_ssw.php` em modo silencioso.
- Isso pode alterar `data_finalizacao` no banco “sem clique”, apenas por abrir a tela.

### Próximos passos
- Inspecionar `src/atualiza_carregamentos.php` para o trecho de finalização (UPDATE) e para o recorte temporal.
- Inspecionar `src/components/dashboards/Disponiveis.tsx` por chamadas de finalização/restore no carregamento inicial.
- Instrumentar o script com echos focados (sem alterar regra), para coletar E2 em uma execução real no servidor.
