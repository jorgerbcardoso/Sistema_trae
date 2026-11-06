## Debug session: auto-finalizacao-imprevisivel

### Sintoma
- No domínio RVE, um carregamento criado “hoje” some do calendário e aparece `data_finalizacao` preenchida sem haver manifesto/saída no ssw0125(PER).
- Exemplo: `seq_carregamento=662`, `placa_provisoria=CRO9A49`, `unidade=SAO`, `data_inclusao=2026-11-05`.

### Objetivo
- Garantir que **carregamento só seja finalizado automaticamente** quando houver evidência de saída (manifesto/saída) no PER (f11) para a placa, dentro do recorte temporal aplicável.
- Garantir rastreabilidade: ao finalizar automaticamente, registrar “quem” e “por quê” (fonte painel vs cron e evidência).

### Hipóteses (falsificáveis)
1. O endpoint `importar_carregamentos_ssw.php` (chamado automaticamente ao abrir o painel) está preenchendo `data_finalizacao` em carregamentos iniciados **sem validar** saída no PER.
2. O script `src/atualiza_carregamentos.php` está finalizando por bug de merge/placa (ex.: placa parcial 4 últimos no RVE colidindo) e atribui saída de outra placa.
3. O script/painel está finalizando por regra “ausência no PER” (interpretação invertida) em vez de “presença de saída”.
4. A lógica está usando campo errado de data (ex.: `f10`/`f11`/`f17`) ou parse falha e considera “tem saída” quando não tem.
5. A finalização ocorre fora do fluxo (outro endpoint) e falta auditoria (login e origem) para identificar o agente.

### Evidências necessárias
- E1: Onde o UPDATE de `data_finalizacao` acontece (script/endpoint) e quais condições.
- E2: Para um caso (seq 662): log/echo do processo mostrando a evidência (placa, saída, manifesto) usada para finalizar.
- E3: Confirmar se a placa é tratada “parcial” no RVE e se existe colisão (mesmos 4 últimos) em outra placa com saída.

