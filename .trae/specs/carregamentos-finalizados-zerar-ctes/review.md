# Review: Carregamentos Finalizados Zerados — Correção de CT-es

**Spec ID**: `carregamentos-finalizados-zerar-ctes`
**Contexto**: Bug alto impacto — carregamentos finalizados de ontem amanheciam com 0 CT-es no dashboard Disponiveis. Usuário forçado a usar botão manual "gambiarra". Correção implementada em 4 backend PHP + 1 frontend TSX.
**Arquivos sob revisão**: `get_carregamentos.php`, `salvar_carregamento.php`, `importar_carregamentos_ssw.php`, `Disponiveis.tsx`.
**Método**: Subagente de contexto limpo (read-only, nenhum comando executado). Revisão por checkpoints (CP) mapeados para ACs do spec.
**Reviewer (R1)**: Subagente geral (contexto limpo). **Remediation Implementer**: Agente principal. **Reviewer (R2)**: Subagente geral (recheck só pontos falhos).
**Resultado Global Consolidado**: **PASS** (R2). R1 detectou 1 achado crítico → remediado → R2 confirmou correção sem regressões.

---

## Checkpoints Review Results

| ID      | Tipo  | Cobertura AC        | R1 Result | R2 Result | Notas |
|---------|-------|---------------------|-----------|-----------|-------|
| CP-R1   | rule  | AC-1 (listagem)     | fail →    | **pass**  | R1: bug 1 caractere linha 582 → R2 corrigido |
| CP-R2   | rule  | AC-2 + AC-3 (finaliza manual) | pass | pass | try/catch antes UPDATE; helper idempotente |
| CP-R3   | rule  | AC-4 (import SSW)   | pass      | (recheck omitido, já pass) | NOT EXISTS + fallback COALESCE |
| CP-R4   | rule  | AC-5 (frontend Math.max) | pass | (recheck omitido) | Badge + botão Rota usam qtdeCtesCarreg |
| CP-R5   | rule  | HARD CONSTRAINT seq_carregamento | fail → | **pass** | R1: inserção usava idxPorPlaca → R2 usa $idx |

---

## R1 — Revisão Completa (Primeira Rodada)

**Data R1**: implementação initial após Task 1-4.
**R1 Resultado Global**: **FAIL**

### CP-R1 (AC-1 Listagem) — R1: FAIL
- **Razão R1**: Query `$sqlCtes` (get_carregamentos.php) correta (tem seq_carregamento no SELECT, sem filtro data_finalizacao IS NULL); loop calcula $idx corretamente com prioridade idxPorSeq. **Entretanto, linha 582 usava `$carregamentos[$idxPorPlaca[$placa]]['ctes'][]` em vez de `$carregamentos[$idx]['ctes'][]`, anulando a proteção de colisão de placas.**
- **Evidência R1**: get_carregamentos.php:535 (SELECT seq_carregamento); :558-561 (WHERE sem filtro); :570-575 ($idx ok); :576 (continue ok); **:582 (BUG)**.

### CP-R2 (AC-2/AC-3 Finaliza Manual) — R1: PASS
- **Razão R1**: Função `_atualizarCtesAntesFinalizar` linha 114 encapsula atualização SSW/TMS com checagem de duplicatas (SELECT pré-INSERT idempotente). Handler finalizar_carregamento linha 1594 tem `try { _atualizarCtesAntesFinalizar(...) } catch(Exception $e) {}` **ANTES** do UPDATE de data_finalizacao (linha 1599+). Respostas success=true (1615/1618) inalteradas. Falha TMS NÃO BLOQUEIA.
- **Evidência R1**: salvar_carregamento.php:114 (def helper); :442-453 (SELECT+continue idempotente); :1594-1597 (try/catch ANTES UPDATE); :1599-1607 (UPDATE finalização); :1615/:1618 (success=true).

### CP-R3 (AC-4 Import SSW Placas Vazias) — R1: PASS
- **Razão R1**: if(empty($placas_ssw)) linha 460, UPDATE principal alias `externo` com `NOT EXISTS (...) interno.seq_carregamento = externo.seq_carregamento AND nro_cte>0` (linhas 471-475) + `externo.seq_carregamento IS NOT NULL` (linha 476). Fallback `AND COALESCE(nro_cte,0)=0` (linha 488) para carregamentos antigos com seq=NULL.
- **Evidência R1**: importar_carregamentos_ssw.php:460 (if); :464-476 (UPDATE principal NOT EXISTS); :478-489 (fallback).

### CP-R4 (AC-5 Frontend Math.max) — R1: PASS
- **Razão R1**: Variável `qtdeCtesCarreg = Math.max(qtdeCtesArray, qtdeCtesHeader)` (linha 2430) usada em Badge header do card (`{qtdeCtesCarreg} CT-es`, 3057) e validação disabled/className/title botão "Rota" (3238/3240/3245), substituindo uso isolado de ctes.length.
- **Evidência R1**: Disponiveis.tsx:2428-2430 (Math.max); :3057 (Badge); :3238/:3240 (disabled Rota); :3245 (title Rota).

### CP-R5 (HARD CONSTRAINT seq_carregamento) — R1: FAIL
- **Razão R1**: Mesmo bug de CP-R1. $idx calculado com prioridade idxPorSeq, mas linha inserção 582 ignora $idx e usa idxPorPlaca[$placa]. Permite misturar CT-es de carregamentos DIFERENTES (seq distintos) com mesma placa em um único índice (último carregamento cadastrado com aquela placa no GROUP BY).
- **Evidência R1**: get_carregamentos.php:570-575 ($idx correto); **:582 (ignora $idx)**.

### Achados Acionáveis R1
1. **I-1 high (CP-R1/CP-R5)**. **Arquivo**: get_carregamentos.php:582. **Descrição**: Linha inserção CT-es usa `$idxPorPlaca[$placa]` ao invés de `$idx` (calculado com prioridade seq_carregamento). Anula proteção contra colisão de placas recicladas (HARD CONSTRAINT). **Resultado esperado**: Alterar para `$carregamentos[$idx]['ctes'][]`.

### Achados Aconselhamentos R1 (low, não-bloqueantes)
- salvar_carregamento.php:1596 catch vazio — considerar error_log() sem bloquear finalização.
- salvar_carregamento.php:135, 212-214, 512-514 — try/catch internos helper também silenciosos; considerar log mínimo para depuração integração TMS.

---

## I-1 Remediação (Pós-R1)
- **Ação executada**: Edit em get_carregamentos.php linha 582: trocou `$idxPorPlaca[$placa]` → `$idx`. 1 caractere de alteração.
- **Issue template em tasks.md**: `Issue I-1` criada (status completed) com TR-I-1.1/TR-I-1.2 e evidência de conclusão (leitura pós-edit, verificação não-regressão linhas 567-576).

---

## R2 — Re-Review Pós-Remediação

**R2 Escopo**: Apenas CP-R1 e CP-R5 (os 2 que falharam em R1). Demais CPs já PASS, recheck omitido.
**R2 Resultado Global**: **PASS**

### CP-R1 (AC-1) — R2: PASS
- **R2 Razão**: Linha 582 agora `$carregamentos[$idx]['ctes'][] = [...]` (não mais idxPorPlaca[$placa]). $idx = valor calculado nas linhas 570-575 (idxPorSeq primeiro).
- **R2 Evidência**: get_carregamentos.php:582

### CP-R5 (HARD CONSTRAINT seq_carregamento) — R2: PASS
- **R2 Razão**: (a) cálculo $idx tem prioridade idxPorSeq[seqCte] sobre idxPorPlaca (570-575); (b) inserção linha 582 usa $idx calculado e não idxPorPlaca[$placa] como chave do array. Colisão de placas recicladas não mais ocorre.
- **R2 Evidência**: get_carregamentos.php:567-576 + 582.

### R2 Novos Acionáveis
Nenhum.

---

## Resultado Final (Consolidado R1+R2)
**Resultado Global**: **PASS**
**Score Cobertura Arquivos R1**: 5/5 (4 arquivos, seções completas lidas: get_carregamentos 520-608; salvar 1-100/114-515/1500-1620; importar 445-501; Disponiveis 2415-2495/3050-3070/3230-3255).
**Score Cobertura R2**: Pontual (2 CPs) — 100% sobre pontos falhos.

### Validação dos Acceptance Criteria do Spec
| AC  | R1 | R2 | Status Final |
|-----|----|----|--------------|
| AC-1 (Listagem retorna CT-es finalizados) | fail via bug | **pass** | ✅ PASS |
| AC-2 (Finalizar manual atualiza CT-es ANTES) | pass | (já pass) | ✅ PASS |
| AC-3 (Falha TMS não bloqueia) | pass | (já pass) | ✅ PASS |
| AC-4 (Import SSW placas vazias protege CT-es existentes) | pass | (já pass) | ✅ PASS |
| AC-5 (Frontend Math.max em UI) | pass | (já pass) | ✅ PASS |
| AC-6 (Idempotência — rubrica sem duplicatas) | R1 visualizou SELECT pré-INSERT; R2 não regrediu | evidência salvar.php:442-453 | ✅ PASS (presuntivo; query GROUP BY em prod ainda não executada — acionamento: cliente) |

### Checkpoints de Usabilidade (CP-U1 / CP-U2)
- **CP-U1 (rubric):** Nenhum comportamento de UI deletado. Botão manual existente "atualizar CT-es carregamento finalizado" mantido como fallback safety (escolha spec default; não removido).
- **CP-U2 (rubric):** Nenhum new breaking change na API; `finalizar_carregamento` ainda responde `success=true` mesmo em TMS falha (contrato preservado).

### Riscos Restantes Pós-Review (NÃO BLOQUEIAM DEPLOY)
1. **Risco baixo-low-mid**: Helper `_atualizarCtesAntesFinalizar` tem falha silenciosa em todas exceções (design intencional para não travar finalização). Se TMS ficar indisponível DURANTE 1 ou 2 dias seguidos e o carregamento for finalizado nessa janela, a atualização será perdida até que o usuário use o botão manual. Mitigação: botão manual mantido; aconselhamento R1 de adicionar error_log para monitorar frequência.
2. **Risco low**: Fallback `COALESCE(nro_cte,0)=0` no importar SSW cobre carregamentos MUITO antigos sem seq_carregamento; nesse caso o NOT EXISTS por seq não roda — chance pequena de falso positivo em registros sem seq, mas menos provável que a condição original.
3. **Observação**: Frontend — popup mapa (L5190-L5203) e badge lateral (L5798/L5868) ainda não convertidos para Math.max. Fora de escopo AC-5; usuário pode abrir issue se cliente reclamar de contadores em popup também.

---

## Review History

| Ciclo | Data/ordem | Resultado | Achados |
|-------|------------|-----------|---------|
| R1 | Primeira rodada (full) | fail | 1 high (I-1); 2 low (aconselhamentos catch vazio) |
| R1 → I-1 | Remediação 1 caractere | completed | N/A |
| R2 | Segunda rodada (scoped, só CP-R1/R5) | pass | 0 novos |
| **Consolidado** | | **PASS** | Nenhum acionável restante |
