[OPEN] Debug Session: coleta-entrega-504

## Sintoma
- Frontend: após clicar em "Gerar Relatório" (1 dia), a requisição ainda retorna 504.
- Observação do usuário: no SSW1440 o relatório fica concluído em ~6s.

## Objetivo
- Identificar o gargalo (fila 1440, download 0424, parsing, ou outro) com evidência de runtime.
- Expor na UI pontos de status: “SSW pronto” e “Processando arquivo”.

## Hipóteses (falsificáveis)
1) O polling do ssw1440 não encontra o registro certo (filtro por usuário/seq/limite de linhas), então espera até timeout.
2) O gargalo é o download via ssw0424 (arquivo muito grande / rede lenta), levando a 504 antes de concluir.
3) O gargalo é o parsing do TXT (muito CPU/mem), mesmo com o SSW já concluído rápido.
4) O 504 vem do proxy/webserver acima do PHP (timeout fixo), mesmo com o PHP ainda rodando.
5) Existe uma repetição/loop involuntário (ex.: polling extra) que estica o tempo total.

## Evidências esperadas
- Timestamps por etapa: ENV(0216) → polling(1440) → download(0424) → decode → parse → respond.
- Contagem de tentativas e por que não achou linha do 1440.
- Tamanho do arquivo baixado e duração do download/parsing.

## Próximos passos
1) Subir Debug Server e coletar logs (runId pre).
2) Instrumentar get_coleta_entrega.php com eventos por etapa e timings.
3) Reproduzir 1 vez e analisar logs.

