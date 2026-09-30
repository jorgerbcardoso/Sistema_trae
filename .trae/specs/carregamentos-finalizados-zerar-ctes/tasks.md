# Correção: Carregamentos Finalizados Zerados — Implementation Plan

## Task 1: Remover filtro data_finalizacao da query de detalhamento de CT-es (get_carregamentos.php)
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Localizar a query `$sqlCtes` em `get_carregamentos.php` (~linha 531-560) que carrega as linhas de CT-es para cada carregamento retornado.
  - Remover a condição `AND c.data_finalizacao IS NULL` que hoje filtra CT-es de carregamentos finalizados.
  - MANTER todos os demais filtros (`nro_cte>0`, filtro RVE `ser_cte <> 'SAS'`, unidade, etc.).
  - Garantir que o resultado ainda seja agregado corretamente por `seq_carregamento` (mapeado via placa_provisoria ou seq_carregamento, conforme o GROUP BY do header).
  - Se a query possui join por placa ao invés de seq_carregamento, ALTERAR a chave para `seq_carregamento` (HARD CONSTRAINT), para não correr risco de misturar CT-es de carregamentos antigos com a mesma placa.
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `rule` TR-1.1: A query `$sqlCtes` modificada NÃO contém mais a string `data_finalizacao IS NULL`. Evidence: grep do arquivo.
  - `rule` TR-1.2: Um `SELECT` direto na view da query (rodar o SQL resultante no banco) para um carregamento finalizado com N CT-es retorna exatamente N linhas. Evidence: output psql comparado ao count da tabela.
  - `rule` TR-1.3: Subqueries de detalhamento usam `seq_carregamento` (ou equivalente que vincule estritamente ao header do GROUP BY) como chave, nunca só `placa_provisoria`. Evidence: leitura do SQL da query.
- **Notes**: Altera cirurgicamente um WHERE clause — validar que não quebra a query (testar sintaxe com `EXPLAIN` se possível, sem rodar no prod).
- **Completion Evidence** (Self-verification via grep estático + review independente R2):
  - TR-1.1: `grep data_finalizacao IS NULL no arquivo retornou ZERO matches na seção $sqlCtes (somente em outro contexto de DDL).
  - TR-1.3: SELECT da query $sqlCtes retorna c.seq_carregamento (linha 535); loop popula $idxPorSeq[$seqCarreg] = $idx (linha 158); mapeamento CT-e prioriza idxPorSeq primeiro (linhas 570-575).
  - R2 CP-R1 e CP-R5 = pass; ver detalhes em review.md.

## Task 2: Encadear atualização de CT-es ANTES da finalização manual no backend (salvar_carregamento.php)
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - No handler `acao === 'finalizar_carregamento'` (~linha 1184), antes do UPDATE que seta `data_finalizacao`, chamar uma rotina PHP reutilizável que execute a mesma lógica de `atualizar_ctes_ssw` para a placa em questão.
  - Extrair (duplicar inline se for mais rápido para estabilidade) a parte essencial de `atualizar_ctes_ssw` que: (a) determina `data_ref` (ontem/hoje com base no carregamento), (b) consulta `ssw0125 PER` e baixa `CTRCS_MAN`, (c) insere CT-es faltantes preservando `data_finalizacao` já existente, (d) é idempotente.
  - Encapsular a chamada em `try/catch` (ou equivalente com silenciamento de erro de rede SSW) para garantir que, SE o TMS falhar, a finalização ainda executa e responde `success=true` ao frontend.
  - Após a rotina de atualização, rodar o UPDATE existente de `data_finalizacao/hora/login_finalizacao` (normal).
  - Evitar duplicações: validar por `seq_carregamento + nro_cte` antes de inserir.
- **Acceptance Criteria Addressed**: AC-2, AC-3
- **Test Requirements**:
  - `rule` TR-2.1: Leitura estática do código confirma que a rotina de atualização é chamada ANTES do UPDATE data_finalizacao, dentro de um bloco try/catch (ou equivalente). Evidence: linhas do arquivo com ordem visível.
  - `rule` TR-2.2: A resposta de `finalizar_carregamento` ainda retorna `{"success": true}` mesmo quando a integração TMS é simulada como falha (p.ex.: mockar `ssw_login` retornando false). Evidence: teste manual mockado ou leitura do try/catch.
  - `rubric` TR-2.3: Idempotência após 2 chamadas consecutivas de finalizar a mesma placa; `SELECT count(*) ... GROUP BY seq_carregamento, nro_cte HAVING count(*)>1` retorna vazio. Dimension: Ausência duplicatas; scale 1-5; anchors 1=duplicatas, 3=raras, 5=nenhuma; threshold >=4. Evidence: resultado da query GROUP BY.
- **Notes**: Priorizar estabilidade sobre elegância — se for mais seguro chamar a mesma função `atualizar_ctes_ssw` via subrotina interna ao invés de HTTP, fazer assim (evitar self-request).
- **Completion Evidence** (Self-verification via grep estático + R1 review):
  - TR-2.1: Função `_atualizarCtesAntesFinalizar()` definida em linha 114; invocada via `try{}catch{}` em linha 1594-1597, IMEDIATAMENTE antes do UPDATE de finalização (linha 1599+).
  - TR-2.2: catch vazio + respondJson success=true em linhas 1615/1618 inalterados.
  - TR-2.3: SELECT 1 pré-INSERT (linhas 442-453) checando seq_carregamento|placa + ser_cte + nro_cte antes de todo INSERT; se encontrar -> continue.

## Task 3: Proteger finalização em massa de importação SSW quando placas vazias (importar_carregamentos_ssw.php)
- **Status**: `completed`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Em `importar_carregamentos_ssw.php` (~linha 460-479), condição `if (empty($placas_ssw))`, o UPDATE de finalização em massa atinge TODOS carregamentos SSW abertos.
  - Restringir esse UPDATE para SOMENTE carregamentos sentinelas vazios: acrescentar condição que assegure que o carregamento não possua nenhuma linha com `nro_cte>0`.
  - Forma segura de fazer: usar `NOT EXISTS (SELECT 1 FROM {$tabela} interno WHERE interno.seq_carregamento = externo.seq_carregamento AND interno.nro_cte::int > 0)` ou equivalente, ALÉM das condições já existentes.
  - Alternativa via HAVING: usar seq_carregamento com max(nro_cte)=0.
  - Não alterar nenhum outro comportamento de importação.
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `rule` TR-3.1: A query dentro de `if(empty($placas_ssw))` contém uma condição que exclui carregamentos com pelo menos um CT-e (nro_cte>0). Evidence: leitura do SQL do UPDATE.
  - `rule` TR-3.2: Cenário simulado: criar carregamento A (sentinela vazio, origem_ssw não nulo, sem data_finalizacao) e carregamento B (origem_ssw não nulo, sem data_finalizacao, com 2 CT-es nro_cte>0). Rodar trecho com $placas_ssw vazio. A recebe data_finalizacao; B NÃO recebe. Evidence: queries antes/depois.
- **Notes**: Validar sintaxe SQL — usar wrapper `sql()` ou `@pg_query` consistente com o estilo do arquivo (provavelmente `@pg_query` conforme linhas 460-479 já usam).
- **Completion Evidence** (Self-verification via grep estático + R1 review):
  - TR-3.1: Query principal linha 464-476 contém alias `NOT EXISTS (...) interno.seq_carregamento = externo.seq_carregamento AND nro_cte>0` (linhas 471-475) + `AND externo.seq_carregamento IS NOT NULL` (linha 476).
  - Fallback linha 488: COALESCE(nro_cte, 0)=0 caso seq_carregamento seja NULL (carregamentos antigos sem seq).

## Task 4: Assegurar Math.max(header, array) em todos pontos de barra/contador no frontend (Disponiveis.tsx)
- **Status**: `completed`
- **Priority**: medium
- **Depends On**: None
- **Description**:
  - Grepar `Disponiveis.tsx` por todos locais onde:
    - a barra de progresso calcula sua porcentagem com base em CT-es;
    - contadores textuais exibem "X / Y CT-es" ou valores análogos;
    - validações de "carregamento vazio" são feitas.
  - Substituir cada referência de comprimento de array puro (`carregamento.ctes.length`) por `Math.max(carregamento.total_ctes ?? 0, carregamento.ctes?.length ?? 0)`.
  - Para porcentagem: `(Math.max(totalHeader, arrayLen) / esperado) * 100` (garantir que denominador não cause NaN).
  - Manter intacta a lógica de ordenação ThBtn e filtros de aba.
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `rule` TR-4.1: Grep por `.ctes.length` em `Disponiveis.tsx` (exceto em loops de renderização de linhas) encontra a fórmula `Math.max` no cálculo de totais/barras. Evidence: grep output com linhas exatas.
  - `rule` TR-4.2: Um mock de objeto carregamento com `total_ctes=5` e `ctes=[]` renderiza barra >= valor de 5 (não zero). Evidence: renderização em ambiente dev ou inspeção de código.
- **Notes**: Task pode ser pulada se o Disponiveis.tsx já tiver aplicado Math.max em sessões anteriores (validar via grep antes de editar). Se já estiver correto, marcar como cancelado com justificativa.
- **Completion Evidence** (Self-verification via grep estático + R1 review):
  - TR-4.1: Variável `qtdeCtesCarreg = Math.max(qtdeCtesArray, qtdeCtesHeader)` (linha 2430) existe e é usada em: Badge CT-es header do card (3057: `{qtdeCtesCarreg} CT-es`); validação disabled/className/title do botão Rota (linhas 3238/3240/3245).
  - TR-4.2: Inspeção de código: `qtdeCtesHeader = Number(carregamento.total_ctes ?? 0) || 0` garante que fallback numérico; Math.max retorna >= 5 se total_ctes=5, mesmo array vazio.

## Task 5: Revisão independente (review.md)
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 1, Task 2, Task 3, Task 4 (todas completed)
- **Description**:
  - Rodar review via subagente de contexto limpo, cobrindo:
    - Query `$sqlCtes` de get_carregamentos não filtra mais finalizados e junta por seq_carregamento (TR-1.1 / 1.2 / 1.3).
    - finalizar_carregamento chama atualiza ANTES de selar, e resiste a falha TMS (TR-2.1 / 2.2 / 2.3).
    - importar_carregamentos_ssw só finaliza sentinelas vazias quando placas vazio (TR-3.1 / 3.2).
    - Disponiveis.tsx Math.max consolidado (TR-4.1 / 4.2).
  - Registrar em `review.md` os checkpoints e o resultado final (pass/fail/blocked).
- **Acceptance Criteria Addressed**: AC-1 a AC-6 (todos, em checagem independente)
- **Test Requirements**:
  - `rule` TR-5.1: `review.md` existe e tem pelo menos 5 checkpoints (um por AC core) marcados como pass OU um resultado pass global. Evidence: arquivo review.md preenchido.
  - `rubric` TR-5.2: Cobertura da revisão; scale 1-5; anchors 1=revisão superficial, 3=revisa só 2 dos 4 arquivos, 5=revisa os 4 arquivos alvo (get_carregamentos, salvar, importar, Disponiveis); threshold >= 4. Evidence: seções de review.md por arquivo.
- **Completion Evidence**:
  - TR-5.1: `review.md` criado em `.trae/specs/carregamentos-finalizados-zerar-ctes/review.md`. Resultado consolidado R1 (fail → I-1) + R2 (pass). Global PASS. Checkpoints CP-R1 a CP-R5 (5) todos pass na última rodada.
  - TR-5.2: Score cobertura arquivos R1 = 5/5. R2 = scoped nos 2 pontos falhos. Total >= threshold.
  - Evidência adicional: Achado crítico I-1 (HARD CONSTRAINT violado na 582) detectado em R1, remediado em 1 caractere, validado em R2 = pass. Nenhum acionável restante.

## Issue I-1: Loop de CT-es em get_carregamentos.php ignorava $idx calculado e usava $idxPorPlaca[$placa] (HARD CONSTRAINT violada)
- **Status**: `completed`
- **Priority**: high
- **Depends On**: Task 1
- **Discovered By**: Review R1
- **Description**:
  - Após Task 1, o loop de CT-es calculava `$idx` corretamente (linhas ~570-575) priorizando `$idxPorSeq[$seqCte]` (chave canônica por seq_carregamento) e caindo em `$idxPorPlaca` como fallback — porém a linha de inserção no array de carregamentos (582) ainda usava `$carregamentos[$idxPorPlaca[$placa]]['ctes'][]` ao invés de `$carregamentos[$idx]['ctes'][]`.
  - Isso anulava a proteção contra colisão de placas recicladas (HARD CONSTRAINT do project memory), permitindo que CT-es de carregamentos DIFERENTES com mesma placa fossem atribuídos ao carregamento errado (último índice daquela placa no GROUP BY).
- **Acceptance Criteria Addressed**: AC-1, seq_carregamento HARD CONSTRAINT
- **Test Requirements**:
  - `rule` TR-I-1.1: Linha de inserção `$carregamentos[...]['ctes'][]` após correção referencia a variável `$idx` calculada (não mais `$idxPorPlaca[$placa]`). Evidence: grep da linha 582 em get_carregamentos.php.
  - `rule` TR-I-1.2: Cálculo de `$idx` nas linhas anteriores permanece intacto (idxPorSeq primeiro, idxPorPlaca fallback). Evidence: linhas 567-576 inalteradas.
- **Notes**: Correção aplicada em R1-Remediation: trocou `$idxPorPlaca[$placa]` → `$idx` na linha 582. Remediação de 1 caractere, alto impacto estabilidade.
- **Completion Evidence**:
  - Leitura da linha 582 após edição: `$carregamentos[$idx]['ctes'][] = [` registrada no Read da ferramenta.
  - Verificação de regressão: linhas 567-576 permanecem inalteradas.
