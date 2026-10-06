[OPEN]

## Sessão
- id: transfer-block-pe-error
- data: 2026-10-06

## Sintoma
- Ao abrir o bloco "Carregamentos Transferência", a aplicação quebra com:
  - `Cannot access 'pe' before initialization`
  - stack aponta para `recharts-vendor` e um frame no bundle principal.

## Esperado
- Abrir o bloco de Transferência sem crash.

## Hipóteses (falsificáveis)
- H1 (A): Algum valor passado para Recharts no momento de abrir Transferência está inválido/inesperado e dispara um caminho interno que resulta no TDZ do bundle.
- H2 (B): Existe uma referência a variável (minificada como `pe`) antes da inicialização por causa de ordem de declaração/closure dentro do render do dashboard.
- H3 (C): Há uma ramificação específica do "abrir transferência" que monta o dataset/tooltip com campo ausente (ex: `payload`, `percent`, `name`) e ativa um bug/edge-case no Recharts.
- H4 (D): O crash ocorre antes de qualquer request (é 100% frontend) e depende apenas do estado local (ex: listas vazias + `null`/`undefined` em alguma métrica).

## Plano de evidência
- Instrumentar pontos mínimos no `Disponiveis.tsx` para enviar eventos para o Debug Server:
  - clique de abertura do bloco Transferência
  - início de render do calendário/gráficos e tamanho/amostras do dataset
  - captura de `window.onerror` dentro do escopo do componente (temporário) para mandar stack/linha

## Execuções
- pre-fix: pendente
- post-fix: pendente

