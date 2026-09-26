[OPEN] Debug session: ssw-import-empty-ctes

## Sintoma
- Carregamentos importados do SSW entram no Presto com placa, mas sem CT-es (carregamentos “zerados”).

## Hipóteses (falsificáveis)
- H1: O `ssw0194?act=PREP_IMP` está retornando placas/seqs, mas o `SR_IMP|...` não está gerando um relatório válido (act/arq ausentes ou arquivo vazio/HTML).
- H2: O download `ssw0424` retorna conteúdo, porém o texto não contém o padrão `PLACA:`/linhas CTRC esperado e o parser `parseRelatorioCarregamentos()` não encontra CT-es.
- H3: Há mismatch entre a placa do XML (f0) e a placa presente no relatório (ex.: hífen/espacos/normalização), fazendo `$carregamentos[$placa]` ficar sem CT-es.
- H4: O relatório está correto, mas o loop de inserção está ignorando CT-es por “já em outro carregamento”/duplicidade, resultando em 0 inseridos.
- H5: A importação está rodando em unidade diferente da unidade do usuário (TRO não efetivou), então o relatório baixado não corresponde às placas esperadas.

## Plano de evidências
- Instrumentar `importar_carregamentos_ssw.php` para logar: unidade, tamanho/trecho das respostas PREP_IMP/SR_IMP/0424, contagens de placas/seqs, contagens de `PLACA:`/CT-es parseados, contagem de inseridos/ignorados.
- Reproduzir importação no painel (botão Atualizar / importação automática) e coletar logs.

## Status
- Aguardando execução com logs (pre-fix).

