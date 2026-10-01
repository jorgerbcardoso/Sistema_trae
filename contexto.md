PROMPT INICIAL PARA IA:
Este é meu sistema de gestão para transportadoras. Ele já está bem completo.
Ele é um projeto react/vite com backend em PHP
O backend se encontra aqui, também, e eu vou solicitar que você faça ocasionais alterações nele.
O fluxo é sempre um push total para meu repositório git. Depois, no meu serv linux debian eu rodo o script deploy.sh (ele está neste projeto também).
O script deploy.sh faz o pull completo do git e depois faz o build no meu servidor.
Todas as definições e regras que você precisa saber para efetuar as operações estão nos arquivos CHECKLIST_TELAS.md, PADROES_CODIGO.md, REGRAS_DESENVOLVIMENTO.md e pre_manual_estoque.md. O arquivo REGRAS_DESENVOLVIMENTO.md contém as diretrizes críticas sobre a exibição de logotipos em relatórios (PDF e Excel), especialmente a regra de exclusão da logo Presto para o domínio ACV.
Importante: após cada alteração, nunca faça o build, nem rode o servidor após suas operações. Não quero gastar créditos de IA com isso. Eu mesmo executarei os comandos manualmente.
Quanto a base de dados: temos algumas tabelas centrais (users, domains, menu_items) mas a maioria delas é identicada com um prefixo no nome. Este prefixo é o dominio de cada cliente meu.
Exemplo: a tabela de setores do domínio ACV se chama acv_setores
Eu sempre passarei orientação a você me referindo às tabelas dessa forma: [dominio]_setores (no caso da tabela de setores)
REGRA IMPORTANTE: caso eu passe um prompt pra ti que vai demandar muitas buscas em vários arquivos, não saia fazendo múltiplas buscas. antes disso, me informe o que vc está procurando para que eu te caminhos mais específicos.


COMO ADICIONAR UMA NOVA TELA/FUNCIONALIDADE (RESUMO PRÁTICO):

1) FRONTEND (React/Vite)
- Crie o componente em: src/components/<secao>/<NomeDaTela>.tsx (ou src/pages quando for o padrão daquele módulo)
- Se for tela de cadastros/admin: usar <AdminLayout title="..." description="...">
- Registre a rota em src/routes.tsx (ex: path: 'cadastros/unidades')
- Registre o component_path em src/components/ComponentRegistry.tsx (ex: 'cadastros/CadastroUnidades')

2) BANCO (MENU)
- A rota salva no banco PRECISA começar com "/" (ex: "/cadastros/unidades"). Se vier sem "/", o clique no menu pode gerar navegação relativa (ex: /menu/cadastros/unidades) e cair no fallback, voltando pro menu.
- O component_path salvo no banco NÃO começa com "/" e precisa bater com a chave do ComponentRegistry (ex: "cadastros/CadastroUnidades").
- Além de inserir em menu_items, o item precisa estar liberado para o domínio em domain_menu_items (senão não aparece no menu do usuário).

3) BACKEND (PHP)
- Cadastros costumam ficar em: src/api/cadastros/
- Importações do sistema externo seguem o padrão de: src/api/eventos/import_eventos.php (require_ssw + ask() + imp_ssw_*)


PADRÕES DE CÓDIGO CRÍTICOS:

1. INTERAÇÃO COM BANCO DE DADOS (PHP):
   - NUNCA use as funções nativas `pg_query`, `pg_connect`, `pg_fetch_assoc`, etc.
   - SEMPRE utilize a função wrapper `sql($query, $params=[])` disponível no `config.php`.
   - Exemplo: `$resultado = sql("SELECT * FROM usuarios WHERE id = $1", [1]);`

2. COMUNICAÇÃO COM SISTEMA EXTERNO (PHP):
   - NUNCA crie novas classes ou métodos para se comunicar com o sistema externo.
   - SEMPRE use as funções existentes na biblioteca `ssw.php`.
   - O fluxo padrão é:
     a) `ssw_login()`: Para garantir que a sessão está ativa.
     b) `ssw_go($programa, $params)`: Para executar um programa e obter o resultado (seja HTML, XML, ou relatório de texto).
   - PADRÃO PARA PROGRAMAS QUE GERAM ARQUIVO (PLANILHA/RELATÓRIO):
     a) O programa SSW (ex.: ssw1601/ssw0166) normalmente NÃO retorna a planilha/relatório diretamente. Ele retorna um HTML com um `<input ... id=web_body ... value="...">` e uma mensagem de sucesso.
     b) Após executar o programa com `ssw_go(...)`, aplique `urldecode(...)` no HTML e extraia os parâmetros de download do arquivo usando:
        - `ssw_get_act($html)` e `ssw_get_arq($html)` (padrão já usado em várias telas)
        - fallback: ler o `web_body` e extrair o `abrir('ARQ.sswweb', ...)`
     c) Baixe o arquivo via `ssw0424` mantendo o padrão de parâmetros:
        - `https://sistema.ssw.inf.br/bin/ssw0424?act=<ACT>&filename=<ARQ>&path=&down=1&nw=1`
        - (ou `nw=0` quando o padrão daquela tela exigir)
     d) Só depois de baixar é que o backend deve processar o conteúdo (CSV/TXT).
     e) Se o SSW retornar uma mensagem/erro (ou se o HTML não contiver act/arq), o backend deve devolver essa mensagem ao frontend para exibição no Presto.

3. GRÁFICOS RECHARTS — PADRÕES VISUAIS:
   - Gráfico Donut (PieChart + Pie): SEMPRE usar `stroke="none"` no componente `<Pie>` para eliminar a borda branca entre as seções.
     Exemplo: `<Pie dataKey="value" stroke="none" ...>`
  - Tooltip (RechartsTooltip): SEMPRE aplicar estilo compatível com tema escuro usando `useTooltipStyle()` e passar em `contentStyle`, senão no dark o tooltip tende a ficar com fundo branco.
    - Hook padrão: `src/components/dashboards/CustomTooltip.tsx`
    - Exemplo:
      - `const tooltipStyle = useTooltipStyle();`
      - `<RechartsTooltip contentStyle={tooltipStyle as any} ... />`
   - Gráfico de Área (AreaChart): usar gradiente vertical com `<defs><linearGradient>` do recharts, opacidade de 0.35 no topo e 0 na base.
   - Gráfico de Barras horizontais (Top N): usar gradiente horizontal (`x1="0" x2="1" y1="0" y2="0"`) com duas cores complementares.

4. CORES PADRÃO DO SISTEMA:
   - Botão de ação principal (Aplicar, Salvar, etc.): usar `bg-indigo-600 hover:bg-indigo-700`
   - Ícone de loading (Loader2): usar `text-slate-400` sem cor específica forte

5. DIALOGS (CONFIRMAÇÃO / PERGUNTA) — REGRA OBRIGATÓRIA:
   - NÃO usar `alert()`, `confirm()`, `prompt()` (nem `window.alert/confirm/prompt`) em telas novas.
   - Para confirmações e perguntas, usar dialogs estilizados com as funções padrão:
     - `useConfirmDialog()` e `usePromptDialog()` exportados de `src/components/ui/alert-dialog.tsx`
   - Para avisos/erros informativos (sem pergunta), usar `toast` (sonner).

6. TEXTOS DE STATUS:
   - Evitar citar “SSW” nos textos de UI (botões/toasts/status). Preferir termos genéricos como “Gerando arquivo”, “Aguardando geração do relatório”, “Processando arquivo”.


PADRÃO PARA TELAS COM FILTROS (DIALOG):

Objetivo: filtros com UX consistente, sem “pulos” de layout, com scroll interno e sem aplicar alterações até o usuário confirmar.

1) ESTADO (React):
- Ter dois estados separados:
  - `filters`: filtros aplicados
  - `tempFilters`: filtros em edição no dialog
- Ter um boolean: `showFilters`
- Ao abrir o dialog, copiar `filters` → `tempFilters`:
  - `useEffect(() => { if (showFilters) setTempFilters(filters); }, [showFilters, filters]);`
- Implementar handlers padrão:
  - `applyFilters()`: valida se necessário, depois `setFilters(tempFilters)` e fecha
  - `cancelFilters()`: volta `tempFilters = filters` e fecha
  - `clearFilters()`: zera filtros (conforme cada tela) sem fechar ou fechando (padrão da tela)

2) INDICADOR DE FILTRO ATIVO:
- Ter um boolean `hasFiltrosAtivos` (ex.: unidade selecionada, datas preenchidas, etc.)
- No botão de abrir filtros, mostrar um indicador (ex.: bolinha) quando `hasFiltrosAtivos` for true.
- O botão deve seguir o padrão do dashboard Performance de Entregas (`src/components/dashboards/PerformanceEntregas.tsx`):
  - `<Button variant="outline" size="icon" className="dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"><Filter className="w-4 h-4" /></Button>`
  - Envolver em `DialogTrigger` e `Tooltip` (TooltipTrigger → DialogTrigger → Button)

3) LAYOUT DO DIALOG (scroll e altura):
- O `DialogContent` deve ocupar o height disponível com margem e sem scroll global:
  - `h-[calc(100vh-80px)] overflow-hidden flex flex-col`
- O conteúdo deve scrollar dentro:
  - wrapper: `flex-1 overflow-y-auto overscroll-contain pr-1`
- Footer (ações) deve ficar fixo no fim:
  - `border-t ...` com botões `Limpar / Cancelar / Aplicar`

REGRA GERAL PARA DIALOGS (CADASTROS/EDIÇÃO):
- Se o dialog puder ficar alto (muitos campos), aplicar o mesmo padrão de layout:
  - `DialogContent`: `h-[calc(100vh-80px)] overflow-hidden flex flex-col`
  - Conteúdo: `flex-1 overflow-y-auto overscroll-contain pr-1`
  - Footer: fixo com `border-t ...` e botões (sem scroll)

4) COMPONENTES PADRÃO:
- Para “Unidade(s)” com seleção múltipla, usar o mesmo padrão do cadastro de usuários:
  - `src/components/admin/UnidadesMultiSelect.tsx`
- Para seleção de cliente (pagador/destinatário), usar `FilterSelectCliente` com botão “X” dentro do input.
- Para filtros de data (inputs `type="date"`), sempre exibir um botão “X” para limpar o campo.
- Para botão de ajuda/manual no topo (ao lado do botão de filtros), usar ícone `CircleHelp` do `lucide-react` com `w-4 h-4` (harmoniza com o ícone de filtros).
- Loading em dashboards não deve bloquear o cabeçalho: evitar overlay `fixed inset-0` dentro da tela. Se precisar bloquear apenas o conteúdo, usar overlay `absolute inset-0` dentro do corpo.

5) REGRAS DE DOMÍNIO / UNIDADE (quando aplicável):
- Se a tela exigir unidade fixa para não-MTZ, o filtro de unidade deve ficar travado:
  - o estado deve forçar `unidadeDestino = [unidadeAtual]` ao inicializar e ao aplicar filtros
  - o componente deve receber `disabled={true}` e bloquear alterações


PADRÃO PARA LISTAS (TABELAS) EM DASHBOARDS:

Objetivo: listas grandes com navegação rápida, ordenação clara e consistência visual.

1) ORDENAÇÃO (SEM SELECT NO CABEÇALHO):
- Não usar seletor de ordenação no cabeçalho da página.
- Tornar a tabela ordenável pelo clique no título da coluna (toggle ASC/DESC).

2) PAGINAÇÃO:
- Padrão: 70 registros por página.
- Exibir “Página X de Y” e botões Anterior/Próxima (e opcional Primeiro/Último).

3) TOTALIZAÇÃO:
- Exibir totalizadores do conjunto filtrado/buscado (não apenas da página atual).
- Exemplo: somas de mercadoria/frete, volumes, peso, cubagem, e quantidade de registros.


COMPONENTE REUTILIZÁVEL: CteDetalhesDialog (Detalhes do CT-e)

Objetivo: Exibir um dialog com todas as informações relevantes de um CT-e, incluindo dados de identificação, datas, envolvidos, valores, medidas e um gráfico donut da composição do custo. Projetado para ser reutilizado em QUALQUER tela do sistema que liste CT-es.

1) LOCALIZAÇÃO:
   - Arquivo: `src/components/dashboards/CteDetalhesDialog.tsx`

2) COMO USAR (padrão DialogTrigger):
   ```tsx
   import { CteDetalhesDialog } from './CteDetalhesDialog';
   import { Info } from 'lucide-react';

   // Dentro de uma célula de tabela ou qualquer lugar:
   <CteDetalhesDialog cte={meuCte}>
     <button
       type="button"
       className="p-0.5 rounded hover:bg-indigo-50 text-indigo-500 transition-colors"
       onClick={(e) => { e.stopPropagation(); }}
       title="Detalhes do CT-e"
     >
       <Info className="w-3.5 h-3.5" />
     </button>
   </CteDetalhesDialog>
   ```
   - O `children` é o trigger (qualquer elemento clicável).
   - `e.stopPropagation()` é recomendado para evitar acionar o clique da linha (modo apontamento).

3) PROPS:
   - `cte: CteDetalhesData` — (obrigatório) objeto com dados do CT-e. Interface aberta com index signature `[k:string]:any`, então campos extras são aceitos.
   - `children: React.ReactNode` — (obrigatório) elemento trigger que abre o dialog.
   - `open?: boolean` — (opcional) controlar estado aberto externamente.
   - `onOpenChange?: (open: boolean) => void` — (opcional) callback de mudança de estado.

4) HELPERS EXPORTADOS (para reuso em cálculos):
   ```ts
   import { calcularParcelasCusto, calcularCustoTotal } from './CteDetalhesDialog';
   ```
   - `calcularCustoTotal(cte): number` — Soma as 11 parcelas de custo. Retorna number em reais.
   - `calcularParcelasCusto(cte): CteCustoParcela[]` — Retorna array de `{ key, label, valor }` apenas com parcelas > 0. Útil para listar ou renderizar donut manualmente.

5) DADOS ESPERADOS NO OBJETO `cte` (tudo opcional — o dialog só mostra o que vier):
   - **Identificação**: ctrc, serCte, nroCte, seqCte, nfiscal, pedido, manifesto, setor, setorNome, unidadeDest, nomeDest, placaColeta
   - **Datas**: emissao, chegadaUnid, unidAtual, prevEnt, prevChegada, agendamento
   - **Envolvidos**: remetente, pagador, destinatario, cnpjDest, endereco, bairro, cidade, uf, cep, unidadeOrigem
   - **Valores e Medidas**: vlrNf, vlrMerc, frete, peso, pesoCalc, pesoReal, cubagem, qtdeVol
   - **Ocorrência**: codUltOcor, descUltOcor, dataUltOcor
   - **Custos (11 parcelas)**: custoSeguro, custoIcms, custoPisCofins, custoGris, custoPedagio, custoExpedicao, custoTransbordo, custoVendedor, custoRecepcao, custoDespDiv, custoTransferenciaReal

6) BACKENDS QUE JÁ RETORNAM OS CAMPOS NOVOS (para referência):
   - Transferência: `src/api/dashboards/disponiveis/get_disponiveis_transferencia.php` (campos: pesoCalc, placaColeta + 11 custos)
   - Entrega: `src/api/dashboards/disponiveis/get_disponiveis_entrega.php` (mesmos 13 campos)
   - Carregamentos: `src/api/dashboards/disponiveis/get_carregamentos.php` (campos dentro de cada cte interno de cada carregamento)

7) IMPORTANTE: BACKENDS QUE QUISEREM EXIBIR CUSTOS EM OUTRAS TELAS:
   Os relatórios SSW (019, 081, etc.) NÃO trazem peso_calc nem os custos. Esses dados SÓ existem na tabela local `[dominio]_cte`. O backend DEVE:
   a) Fazer LEFT JOIN com `[dominio]_cte` pelo par `(ser_cte, nro_cte)` extraído do CTRC.
   b) DETECTAR se as colunas existem no domínio (para não quebrar em bases antigas) usando o padrão:
      ```php
      function cteCol($col) {
          static $cols = null;
          if ($cols === null) {
              global $config;
              $dom = $config['db_schema'];
              $r = sql("SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3", [$dom, $dom.'_cte', $col]);
              $cols = array_column($r, 'column_name');
          }
          return in_array($col, $cols) ? "c.$col" : "'' as $col";
      }
      ```
   c) No SELECT usar: `COALESCE(`.cteCol('peso_calc').`, '') as pesoCalc` (e similar para cada custo).
   d) No loop de merge, só incluir o campo no JSON se valor não vazio.

8) GRÁFICO DONUT — REGRAS DE IMPLEMENTAÇÃO (já aplicadas no componente):
   - Pie sempre com `stroke="none"` (obrigatório — remove borda branca entre fatias).
   - Tooltip com `useTooltipStyle()` (compatível com tema escuro).
   - `paddingAngle={2}`, `innerRadius={48}`, `outerRadius={78}` — valores padrão para visual equilibrado.
   - Lista lateral com cores + pct + valor substitui a Legend padrão do Recharts (evita quebras de layout).

