# Correção: Carregamentos Finalizados Aparecem Zerados Sem CT-es

## Overview
- **Summary**: Impedir que carregamentos já finalizados (com `data_finalizacao` preenchida) apareçam no dashboard de Disponíveis com a lista de CT-es vazia (`ctes: []`), mesmo possuindo linhas de CT-es válidas persistidas no banco. Incorporar a rotina de atualização de CT-es do TMS (antigo "gambiarra" do botão manual) como passo automático da finalização (manual ou automática) do carregamento.
- **Purpose**: Eliminar a reclamação crítica do cliente final que percebe carregamentos de ontem "amanhecendo zerados" diariamente, obrigando o uso recorrente de um botão manual de atualização.
- **Target Users**: Usuário final (cliente Presto) que opera o dashboard de Disponíveis para Entrega.

## Goals
1. Carregamentos finalizados (qualquer data) devem exibir a lista completa de CT-es associados no dashboard, sem precisar de refresh manual.
2. A ação de "finalizar" (manual ou automática via detecção de saída TMS) deve garantir, antes de selar o carregamento, que os CT-es foram importados o mais completo possível do TMS/SSW.
3. Importações subsequentes de TMS NÃO podem "apagar" (via finalização prematura ou deleção de linhas) CT-es já persistidos de carregamentos finalizados.
4. A percepção visual das barras de progresso no card deve refletir `max(total_ctes header, array ctes.length)` sem regredir para zero.

## Non-Goals
- Redesenhar a arquitetura da tabela mesclada header+rows (`[dominio]_carregamento`).
- Alterar critérios de agrupamento/abas do dashboard (Disponíveis, Todos, Adiados etc.).
- Refatorar a integração TMS completa; apenas aplicar proteções e encadear chamadas existentes.
- Remover o botão manual "atualizar CT-es de finalizado" nesta entrega — apenas garantir que ele deixe de ser necessário no fluxo padrão.

## Background & Context
- **Stack**: Frontend React+TS+Vite; Backend PHP 8+ com PostgreSQL e wrapper `sql($query,$params)` de `config.php`; integração SSW (rebranded como "TMS" na UI) via `ssw_login()/ssw_go()` e programas `ssw0194`, `ssw0424`, `ssw0125 PER`, `ssw0125 CTRCS_MAN`.
- **Tabela mesclada**: `[dominio]_carregamento` guarda header (linha sentinela `nro_cte=0`) e CT-es (`nro_cte>0`) na mesma tabela, todos vinculados por `seq_carregamento`. Campos de header repetem-se em todas as linhas e são agregados via `GROUP BY seq_carregamento,...` em `get_carregamentos.php`.
- **HARD CONSTRAINT confirmada (project memory)**: Subqueries DEVEM usar `seq_carregamento` como chave (NUNCA placa) para evitar colisão por reciclagem de placas entre carregamentos históricos.
- **HARD CONSTRAINT confirmada**: Destinos de carregamentos manuais/adiados NÃO podem ser sobrescritos por heurísticas de linha ou CT-e.
- **Deploy**: Jamais rodar build local; push git → servidor Debian → `deploy.sh` manual.
- **Causas raiz diagnosticadas**:
  1. `get_carregamentos.php:556` filtra `AND c.data_finalizacao IS NULL` na query de detalhamento de CT-es → CT-es de finalizados nunca retornam ao frontend, resultando em `ctes: []` apesar de `total_ctes` do header estar correto.
  2. `salvar_carregamento.php action=finalizar_carregamento` (linhas 1184-1210) apenas seta `data_finalizacao/hora/login_finalizacao` — NÃO executa `atualizar_ctes_ssw` antes.
  3. `importar_carregamentos_ssw.php:460-479` quando `$placas_ssw` vazio, FINALIZA em massa TODOS carregamentos SSW abertos — potencialmente forçando fechamento prematuro de carregamentos com CT-es já gravados.
  4. `verificar_saidas_ssw` (salvar_carregamento:1212-1687) já combina "baixar CT-es manifesto + finalizar" mas só roda para placas que aparecem no `ssw0125 PER` de saídas autorizadas; o caminho manual não aproveita essa lógica.
- **Guideline UI (project memory)**: Barras de progresso usam `Math.max(header.total_ctes, ctesArray.length)` para não aparentar vazio.

## Functional Requirements
- **FR-1 (Listagem)**: A API que retorna os carregamentos para o dashboard (`get_carregamentos.php`) deve incluir, no array `ctes` de cada carregamento, TODAS as linhas com `nro_cte>0` vinculadas ao respectivo `seq_carregamento`, independentemente de `data_finalizacao` estar ou não nula.
- **FR-2 (Finalização Manual)**: O endpoint `salvar_carregamento.php?acao=finalizar_carregamento` deve, ANTES de aplicar o UPDATE de finalização, invocar a mesma rotina de `atualizar_ctes_ssw` usada hoje pelo botão manual, passando a placa e uma data de referência adequada. Se a consulta ao TMS/SSW falhar (timeout, indisponibilidade), a finalização ainda deve ocorrer (não bloquear operador), mas deve-se preservar todo CT-e já existente.
- **FR-3 (Finalização Automática — preservar e fortalecer)**: O fluxo `verificar_saidas_ssw` já baixa CT-es do manifesto antes de finalizar; esse comportamento deve ser mantido e, adicionalmente, NUNCA deve deletar CT-es previamente existentes de um carregamento que já estava finalizado.
- **FR-4 (Proteção na Importação TMS)**: Quando `importar_carregamentos_ssw.php` detectar lista de placas VAZIA vindas do TMS, a finalização em massa de carregamentos SSW abertos DEVE excluir carregamentos que já possuem pelo menos 1 CT-e válido (`nro_cte>0`) persistido; só pode finalizar automaticamente as linhas sentinelas vazias (`nro_cte=0` e sem CT-es).
- **FR-5 (Frontend — consistência barra)**: O componente `Disponiveis.tsx` deve calcular o valor exibido nas barras de progresso e contadores utilizando `Math.max(carregamento.total_ctes ?? 0, carregamento.ctes?.length ?? 0)` em qualquer ponto onde o total aparente do card é exibido ou usado para lógica visual.
- **FR-6 (Idempotência)**: Nenhuma das correções acima pode gerar duplicação de CT-es no banco (mesmo `seq_carregamento + nro_cte` repetido); a lógica de inserção de CT-es deve ser idempotente ou fazer upsert.

## Non-Functional Requirements
- **NFR-1 (Performance)**: A listagem de carregamentos não pode degradar mais de 10% em tempo de resposta após remover o filtro `data_finalizacao IS NULL` do detalhamento (o conjunto de dados retornado por placa é pequeno, tipicamente < 50 CT-es por carregamento).
- **NFR-2 (Estabilidade sob falha de TMS)**: Se o TMS/SSW estiver inacessível no momento da finalização, a operação de finalizar deve completar em < 15s e NÃO deve lançar erro ao operador; pode logar internamente a falha.
- **NFR-3 (Sem regressões em destinos manuais)**: Nenhuma alteração pode ativar a sobrescrita de `destino`, `unidades`, `setores_entrega` de carregamentos com `origem_criacao='MANUAL'` ou `adiado=true` (conforme hard constraint do project memory).
- **NFR-4 (Sem build local)**: Nenhum build de produção deve ser disparado pela IA; apenas edições de código-fonte.

## Constraints
- **Technical**:
  - Linguagem backend: PHP com wrapper `sql()` (não usar `pg_query/pg_fetch_assoc` nativos em código novo).
  - Frontend: React + TypeScript, componentes existentes em `Disponiveis.tsx`.
  - Banco: PostgreSQL, tabelas `[dominio]_carregamento` com prefixo por domínio (ex: `rve_carregamento`).
  - Subqueries de detalhamento devem usar `seq_carregamento` como chave de join com o header (HARD CONSTRAINT).
  - Integração TMS exclusivamente via funções existentes em `ssw.php` (ssw_login, ssw_go, ssw0424 etc.).
- **Business**:
  - Prazo de entrega: imediato (cliente extremamente irritado); priorizar mudanças cirúrgicas sobre refatorações elegantes.
  - Terminologia UI: exibir "TMS" em vez de "SSW" ao usuário final (qualquer log/msg nova deve seguir).
- **Dependencies**:
  - Arquivos-alvo: `get_carregamentos.php`, `salvar_carregamento.php`, `importar_carregamentos_ssw.php`, `Disponiveis.tsx`.

## Assumptions
- A linha sentinela `nro_cte=0` de um carregamento finalizado continua existindo corretamente e o `GROUP BY` do header a retorna em abas que incluem finalizados.
- O domínio RVE segue com regra de sufixo de placa 4 dígitos; nenhuma alteração nessa regra.
- O botão manual "atualizar CT-es de carregamento finalizado" continua funcional (FR não obriga remoção).

## Acceptance Criteria

### AC-1: Listagem retorna CT-es de carregamentos finalizados
- **Type**: `rule`
- **Given**: Um carregamento C com `seq_carregamento=X` possui `data_finalizacao` não nula e possui N linhas na tabela com `nro_cte>0` e `seq_carregamento=X` (N ≥ 1)
- **When**: O dashboard de Disponíveis (ou aba Todos) recarrega e a API `get_carregamentos.php` retorna o carregamento C
- **Then**: O objeto JSON do carregamento C contém um campo `ctes` com exatamente N itens, correspondentes às linhas `nro_cte>0` do banco
- **Pass Condition**: Inspecionar a resposta JSON da API (ou `console.log` no frontend após fetchar); nenhum CT-e existente no banco é omitido por conta de `data_finalizacao IS NOT NULL`
- **Evidence**: Leitura da resposta de `get_carregamentos.php` comparada com `SELECT count(*) FROM dominio_carregamento WHERE seq_carregamento=X AND nro_cte>0`

### AC-2: Finalização manual encadeia atualização de CT-es ANTES de selar
- **Type**: `rule`
- **Given**: Um carregamento em aberto (data_finalizacao NULL) com P placas e 0 ou mais CT-es já importados parcialmente
- **When**: Operador clica em "Finalizar carregamento" que dispara `acao=finalizar_carregamento`
- **Then**: O backend, ANTES de executar o UPDATE que seta `data_finalizacao`, executa a rotina equivalente a `atualizar_ctes_ssw` para a placa do carregamento; quaisquer CT-es que o TMS retornar naquele momento são inseridos/atualizados; e só então a data_finalizacao é aplicada a todas as linhas
- **Pass Condition**: Rastro de logs (ou inspeção de sequência de queries) confere que a chamada/função de atualização roda antes do UPDATE de finalização; após finalizar, `count(nro_cte>0)` para o seq_carregamento reflete o que o TMS tinha disponível
- **Evidence**: Query SQL antes/depois de uma finalização manual + trace da execução PHP mostrando ordem (atualiza → finaliza)

### AC-3: Falha de TMS NÃO bloqueia finalização manual
- **Type**: `rule`
- **Given**: Serviço do TMS/SSW inacessível (simular erro de rede / credencial) no momento do clique em "Finalizar"
- **When**: Operador finaliza o carregamento
- **Then**: O carregamento recebe `data_finalizacao` normalmente (não trava), os CT-es que já estavam no banco permanecem intactos, a UI não exibe erro fatal para o usuário
- **Pass Condition**: Após simular indisponibilidade, a request retorna HTTP 200 success=true e um `SELECT` confirma `data_finalizacao IS NOT NULL` e os CT-es pré-existentes continuam lá
- **Evidence**: Resposta do endpoint finalizar_carregamento + query de conferência

### AC-4: Importação TMS com placas vazio NÃO finaliza carregamentos com CT-es existentes
- **Type**: `rule`
- **Given**: Existem 2 carregamentos com `origem_ssw IS NOT NULL` e `data_finalizacao NULL`: o carregamento A é sentinela vazia (apenas nro_cte=0), o carregamento B possui 3 CT-es (nro_cte>0) válidos
- **When**: `importar_carregamentos_ssw.php` roda e recebe do SSW uma lista de placas VAZIA
- **Then**: Apenas o carregamento A tem sua `data_finalizacao` setada; o carregamento B permanece com `data_finalizacao NULL` e seus 3 CT-es preservados
- **Pass Condition**: Antes/depois da rotina, `SELECT seq_carregamento, data_finalizacao, count(case when nro_cte>0 then 1 end) FROM ... GROUP BY seq_carregamento` confere que B não foi finalizado
- **Evidence**: Query comparativa pre/pós importação com lista vazia

### AC-5: Barras de progresso no frontend usam Math.max(header, array)
- **Type**: `rule`
- **Given**: Um card de carregamento finalizado retornado pela API tem `total_ctes=5` no header mas o array `ctes` chega com tamanho 5 após a correção do AC-1 (ou em cenários transitórios, header=5 e array chega atrasado com 0, mas Math.max garante 5 como mínimo aparente)
- **When**: O componente renderiza a barra de progresso e o contador textual de CT-es
- **Then**: O valor usado é no mínimo igual ao `total_ctes` do header, nunca menor que o tamanho atual do array; a barra não "abaixa" conforme atualizações parciais
- **Pass Condition**: Inspecionar código-fonte de `Disponiveis.tsx` nos cálculos de barra/contador — cada ponto usa `Math.max(total_ctes_header, ctes.length)`
- **Evidence**: Grepped lines de Disponiveis.tsx mostrando a fórmula aplicada em todas as referências relevantes

### AC-6: Nenhuma duplicação de CT-es por idempotência
- **Type**: `rubric`
- **Dimension**: Ausência de CT-es duplicados após múltiplas finalizações/atualizações em sequência
- **Scale**: 1-5
- **Anchors**:
  - 1 = após 2 atualizações sucessivas, há > 2% de duplicatas (mesmo seq_carregamento + nro_cte);
  - 3 = algumas duplicatas aparecem mas em < 0,5% dos casos, facilmente contornáveis;
  - 5 = após 3 ciclos (finalizar → atualizar manualmente → reimportar SSW) nenhum par `(seq_carregamento, nro_cte)` aparece mais de 1 vez no banco
- **Pass Threshold**: >= 4
- **Evidence**: Query `SELECT seq_carregamento, nro_cte, count(*) FROM dominio_carregamento WHERE nro_cte>0 GROUP BY seq_carregamento, nro_cte HAVING count(*)>1` antes e depois dos ciclos, sem retornar linhas

## Open Questions
- [ ] Remover o botão manual "atualizar CT-es de carregamento finalizado" já nesta entrega ou deixar como fallback temporário? (Default do spec: manter, por segurança NÃO-OBJEÇÃO ao remover também.)
- [ ] Há necessidade de log estruturado (além de `error_log`) quando a atualização de CT-es na finalização falha por indisponibilidade TMS? (Default: error_log padrão basta.)
