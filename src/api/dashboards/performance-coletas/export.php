<?php
/**
 * ================================================================
 * API: DASHBOARD PERFORMANCE DE COLETAS - EXPORTAR COLETAS CSV
 * ================================================================
 * Exporta coletas filtradas para CSV
 * Requer autenticação via token
 *
 * POST /api/dashboards/performance-coletas/export.php
 * Body: { 
 *   filters: {...},           // Objeto com filtros do formulário
 *   situacao?: string,         // Situação específica do card clicado
 *   data?: string,             // Data específica (YYYY-MM-DD) - indica análise diária/evolução
 *   unidade?: string,          // Sigla da unidade (3 primeiros caracteres) - do comparativo
 *   tipo?: string              // 'total', 'programadas', 'comandadas', 'coletadas'
 * }
 * Response: CSV file download
 * 
 * REGRAS DE FILTRO:
 * - Exportações de CARDS/COMPARATIVO: aplica filtros do usuário
 * - Exportações de ANÁLISE DIÁRIA/EVOLUÇÃO: força últimos 30 dias
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/lib.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST');

try {
    // ================================================================
    // AUTENTICAÇÃO
    // ================================================================
    $auth = authenticateAndGetUser();
    $user = $auth['user'];
    $domain = $auth['domain'];

    // ================================================================
    // RECEBER E PROCESSAR PARÂMETROS
    // ================================================================
    $input = getRequestInput();

    // 🔍 DEBUG: Log do payload recebido
    error_log("📥 [export.php] Payload recebido: " . json_encode($input));

    // Parâmetros de contexto da exportação (vêm direto no root do JSON)
    $situacao = $input['situacao'] ?? null;           // 'PRE-CADASTRADA', 'CADASTRADA', 'COMANDADA', 'COLETADA', 'TODAS'
    $data = $input['data'] ?? null;                   // Data específica (YYYY-MM-DD) - indica análise diária/evolução
    $unidade = $input['unidade'] ?? null;             // Sigla da unidade (3 primeiros caracteres) - do comparativo
    $tipo = $input['tipo'] ?? $input['coluna'] ?? null;  // ✅ 'total', 'programadas', 'comandadas', 'coletadas', 'no_prazo'
    
    // ✅ CORREÇÃO: Filtros gerais vêm dentro de $input['filters']
    $filters = $input['filters'] ?? [];
    
    $periodoLancamentoInicio = $filters['periodoLancamentoInicio'] ?? null;
    $periodoLancamentoFim = $filters['periodoLancamentoFim'] ?? null;
    $periodoPrevisaoInicio = $filters['periodoPrevisaoInicio'] ?? null;
    $periodoPrevisaoFim = $filters['periodoPrevisaoFim'] ?? null;
    $unidadeColeta = $filters['unidadeColeta'] ?? [];
    $cnpjRemetente = $filters['cnpjRemetente'] ?? null;
    $placa = $filters['placa'] ?? null;
    $filtroSituacao = $filters['situacao'] ?? null;  // Array de situações do filtro da tela

    // 🔍 DEBUG: Log dos filtros extraídos
    error_log("📊 [export.php] Contexto: situacao=$situacao, data=$data, unidade=$unidade, tipo=$tipo");
    error_log("📊 [export.php] Filtros: " . json_encode([
        'periodoLancamentoInicio' => $periodoLancamentoInicio,
        'periodoLancamentoFim' => $periodoLancamentoFim,
        'periodoPrevisaoInicio' => $periodoPrevisaoInicio,
        'periodoPrevisaoFim' => $periodoPrevisaoFim,
        'unidadeColeta' => $unidadeColeta,
        'cnpjRemetente' => $cnpjRemetente,
        'placa' => $placa,
        'filtroSituacao' => $filtroSituacao
    ]));

    // ================================================================
    // CONECTAR AO BANCO
    // ================================================================
    $g_sql = connect();

    // ================================================================
    // VALIDAR DOMÍNIO
    // ================================================================
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
        respondJson(['success' => false, 'error' => 'Domínio inválido'], 400);
        exit;
    }

    // ================================================================
    // DETERMINAR TIPO DE EXPORTAÇÃO
    // ================================================================
    // ✅ REGRA: Se tem parâmetro 'data' (análise diária/evolução) → força últimos 30 dias
    // ✅ REGRA: Caso contrário (cards/comparativo) → usa filtros do usuário
    $isAnaliseDiaria = !empty($data);
    
    error_log("📊 [export.php] Tipo: " . ($isAnaliseDiaria ? "Análise Diária (30 dias)" : "Cards/Comparativo (filtros usuário)"));

    // ================================================================
    // CONSTRUIR QUERY COM FILTROS
    // ================================================================
    $params = [];
    $paramIndex = 1;
    $whereConditions = [];
    
    $tableName = $domain . '_coleta';
    $clienteTable = $domain . '_cliente';

    // ✅ FILTRO OBRIGATÓRIO: Situação diferente de '3' (Cancelada)
    $whereConditions[] = "col.situacao != '3'";

    // ✅ FILTRO DE SITUAÇÃO (dos cards)
    if ($situacao && $situacao !== 'TODAS') {
        $situacaoMap = [
            'PRE-CADASTRADA' => '9',
            'CADASTRADA' => '0',
            'COMANDADA' => '1',
            'COLETADA' => '2'
        ];
        
        $codigoSituacao = $situacaoMap[$situacao] ?? null;
        if ($codigoSituacao !== null) {
            $whereConditions[] = "col.situacao = $" . $paramIndex;
            $params[] = $codigoSituacao;
            $paramIndex++;
        }
    }

    // ✅ FILTRO DE TIPO (do comparativo de unidades e análise diária)
    if ($tipo) {
        switch ($tipo) {
            case 'total':
                // Não adiciona filtro
                break;
            case 'programadas':
                // Do comparativo: apenas as não coletadas ainda
                $whereConditions[] = "col.situacao IN ('0', '1', '9')";
                break;
            case 'programadas_dia':
                // Da análise diária: todas as coletas do dia (qualquer situação)
                // Não adiciona filtro de situação (já tem o filtro de != '3' canceladas)
                break;
            case 'comandadas':
            case 'comandadas_dia':
                $whereConditions[] = "col.situacao = '1'";
                break;
            case 'coletadas':
            case 'coletadas_dia':
                $whereConditions[] = "col.situacao = '2'";
                break;
            case 'no_prazo':
            case 'no_prazo_dia':
                // ✅ FILTRO: Coletadas no prazo (situacao=2 E efetivação <= limite)
                $whereConditions[] = "col.situacao = '2'";
                $whereConditions[] = "(col.data_efetivacao + col.hora_efetivacao) <= (col.data_limite + col.hora_limite)";
                break;
            case 'coletas_dia':
                // ✅ Total de coletas do dia (sem filtro de situação adicional)
                break;
            case 'evolucao_dia':
                // ✅ Do gráfico de evolução: todas as coletas programadas do dia (qualquer situação, exceto canceladas)
                // Não adiciona filtro de situação (já tem o filtro de != '3' canceladas)
                break;
        }
    }

    // ✅ FILTRO DE DATA (da análise diária)
    if ($data) {
        $whereConditions[] = "col.data_limite::date = $" . $paramIndex;
        $params[] = $data;
        $paramIndex++;
    }

    // ✅ FILTRO DE UNIDADE (do comparativo)
    if ($unidade) {
        $whereConditions[] = "SUBSTRING(col.unidade, 1, 3) = $" . $paramIndex;
        $params[] = $unidade;
        $paramIndex++;
    }

    // ✅ REGRA PRINCIPAL: Determinar quais filtros aplicar baseado no tipo de exportação
    if ($isAnaliseDiaria) {
        // ========================================================
        // ANÁLISE DIÁRIA / EVOLUÇÃO: Últimos 30 dias
        // ========================================================
        $whereConditions[] = "col.data_limite >= CURRENT_DATE - INTERVAL '30 days'";
        $whereConditions[] = "col.data_limite <= CURRENT_DATE";
        
        error_log("✅ [export.php] Aplicando filtro: Últimos 30 dias");
        
        // Manter filtros de CNPJ, Placa, Situação e Unidade (mas NÃO períodos)
        if ($cnpjRemetente) {
            $whereConditions[] = "col.cnpj_emit = $" . $paramIndex;
            $params[] = $cnpjRemetente;
            $paramIndex++;
            error_log("✅ [export.php] Filtro CNPJ: $cnpjRemetente");
        }
        
        if ($placa) {
            $whereConditions[] = "UPPER(col.placa) = $" . $paramIndex;
            $params[] = strtoupper($placa);
            $paramIndex++;
            error_log("✅ [export.php] Filtro Placa: $placa");
        }
        
        if (!empty($filtroSituacao) && is_array($filtroSituacao)) {
            $situacaoMap = [
                'PRE-CADASTRADA' => '9',
                'CADASTRADA' => '0',
                'COMANDADA' => '1',
                'COLETADA' => '2'
            ];
            
            $codigosSituacao = [];
            foreach ($filtroSituacao as $sit) {
                if (isset($situacaoMap[$sit])) {
                    $codigosSituacao[] = "$" . $paramIndex;
                    $params[] = $situacaoMap[$sit];
                    $paramIndex++;
                }
            }
            
            if (!empty($codigosSituacao)) {
                $whereConditions[] = "col.situacao IN (" . implode(',', $codigosSituacao) . ")";
                error_log("✅ [export.php] Filtro Situações: " . implode(',', $filtroSituacao));
            }
        }
        
        // Filtro de unidade (array)
        if (!empty($unidadeColeta) && is_array($unidadeColeta)) {
            $placeholders = [];
            foreach ($unidadeColeta as $sigla) {
                $placeholders[] = "$" . $paramIndex;
                $params[] = substr(strtoupper($sigla), 0, 3);
                $paramIndex++;
            }
            $whereConditions[] = "SUBSTRING(col.unidade, 1, 3) IN (" . implode(',', $placeholders) . ")";
            error_log("✅ [export.php] Filtro Unidades: " . implode(',', $unidadeColeta));
        }
        
    } else {
        // ========================================================
        // CARDS / COMPARATIVO: Filtros do usuário
        // ========================================================
        
        // Filtro: Período de Lançamento
        if ($periodoLancamentoInicio) {
            $whereConditions[] = "col.data_inclusao >= $" . $paramIndex;
            $params[] = $periodoLancamentoInicio;
            $paramIndex++;
            error_log("✅ [export.php] Filtro Período Lançamento Início: $periodoLancamentoInicio");
        }
        if ($periodoLancamentoFim) {
            $whereConditions[] = "col.data_inclusao <= $" . $paramIndex;
            $params[] = $periodoLancamentoFim;
            $paramIndex++;
            error_log("✅ [export.php] Filtro Período Lançamento Fim: $periodoLancamentoFim");
        }

        // Filtro: Período de Previsão
        if ($periodoPrevisaoInicio) {
            $whereConditions[] = "col.data_limite >= $" . $paramIndex;
            $params[] = $periodoPrevisaoInicio;
            $paramIndex++;
            error_log("✅ [export.php] Filtro Período Previsão Início: $periodoPrevisaoInicio");
        }
        if ($periodoPrevisaoFim) {
            $whereConditions[] = "col.data_limite <= $" . $paramIndex;
            $params[] = $periodoPrevisaoFim;
            $paramIndex++;
            error_log("✅ [export.php] Filtro Período Previsão Fim: $periodoPrevisaoFim");
        }

        // Filtro: CNPJ Remetente
        if ($cnpjRemetente) {
            $whereConditions[] = "col.cnpj_emit = $" . $paramIndex;
            $params[] = $cnpjRemetente;
            $paramIndex++;
            error_log("✅ [export.php] Filtro CNPJ: $cnpjRemetente");
        }

        // Filtro: Placa
        if ($placa) {
            $whereConditions[] = "UPPER(col.placa) = $" . $paramIndex;
            $params[] = strtoupper($placa);
            $paramIndex++;
            error_log("✅ [export.php] Filtro Placa: $placa");
        }

        // Filtro: Situação (array)
        if (!empty($filtroSituacao) && is_array($filtroSituacao)) {
            $situacaoMap = [
                'PRE-CADASTRADA' => '9',
                'CADASTRADA' => '0',
                'COMANDADA' => '1',
                'COLETADA' => '2'
            ];
            
            $codigosSituacao = [];
            foreach ($filtroSituacao as $sit) {
                if (isset($situacaoMap[$sit])) {
                    $codigosSituacao[] = "$" . $paramIndex;
                    $params[] = $situacaoMap[$sit];
                    $paramIndex++;
                }
            }
            
            if (!empty($codigosSituacao)) {
                $whereConditions[] = "col.situacao IN (" . implode(',', $codigosSituacao) . ")";
                error_log("✅ [export.php] Filtro Situações: " . implode(',', $filtroSituacao));
            }
        }

        // Filtro: Unidade de Coleta (array)
        if (!empty($unidadeColeta) && is_array($unidadeColeta)) {
            $placeholders = [];
            foreach ($unidadeColeta as $sigla) {
                $placeholders[] = "$" . $paramIndex;
                $params[] = substr(strtoupper($sigla), 0, 3);
                $paramIndex++;
            }
            $whereConditions[] = "SUBSTRING(col.unidade, 1, 3) IN (" . implode(',', $placeholders) . ")";
            error_log("✅ [export.php] Filtro Unidades: " . implode(',', $unidadeColeta));
        }
    }

    $whereClause = '';
    if (count($whereConditions) > 0) {
        $whereClause = 'WHERE ' . implode(' AND ', $whereConditions);
    }

    // ================================================================
    // QUERY PARA BUSCAR COLETAS
    // ================================================================
    $query = "
        SELECT 
            col.unidade,
            col.nro_coleta AS numero_coleta,
            to_char(col.data_limite, 'DD/MM/YYYY') AS data_limite,
            to_char(col.hora_limite, 'HH24:MI') AS hora_limite,
            col.cnpj_emit,
            col.nome_emit,
            col.endereco_emit,
            col.bairro_emit,
            col.cep_emit,
            col.cidade_emit,
            col.setor,
            col.cnpj_dest,
            COALESCE(cli.nome, '') AS nome_dest,
            '' AS endereco_dest,
            '' AS cep_dest,
            '' AS cidade_dest,
            col.solicitante,
            '' AS motorista,
            CASE 
                WHEN col.situacao = '9' THEN 'Pré-cadastrada'
                WHEN col.situacao = '0' THEN 'Cadastrada'
                WHEN col.situacao = '1' THEN 'Comandada'
                WHEN col.situacao = '2' THEN 'Coletada'
                ELSE col.situacao
            END AS situacao,
            col.vlr_merc,
            col.qtde_vol,
            col.peso,
            col.placa,
            '' AS mercadoria,
            '' AS tp_frete,
            to_char(col.data_inclusao, 'DD/MM/YYYY') AS data_lancamento,
            to_char(col.data_efetivacao, 'DD/MM/YYYY') AS data_efetivacao,
            to_char(col.hora_efetivacao, 'HH24:MI') AS hora_efetivacao,
            col.observacao AS obs1,
            '' AS obs2,
            '' AS obs3
        FROM $tableName col
        LEFT OUTER JOIN $clienteTable cli ON cli.cnpj = col.cnpj_dest
        $whereClause
        ORDER BY col.data_limite DESC, col.nro_coleta
    ";

    // ✅ EXECUTAR QUERY E VERIFICAR ERRO **ANTES** DE ENVIAR HEADERS CSV
    if (count($params) > 0) {
        $result = pg_query_params($g_sql, $query, $params);
    } else {
        $result = pg_query($g_sql, $query);
    }

    // ⚠️ IMPORTANTE: Verificar erro ANTES de enviar headers
    if (!$result) {
        error_log("❌ [export.php] Erro SQL: " . pg_last_error($g_sql));
        error_log("❌ [export.php] Query: " . $query);
        respondJson(['success' => false, 'error' => 'Erro ao buscar coletas: ' . pg_last_error($g_sql)], 500);
        exit;
    }

    // ✅ Verificar se há resultados
    $rowCount = pg_num_rows($result);
    error_log("✅ [export.php] Query retornou $rowCount linhas");
    
    if ($rowCount === 0) {
        respondJson(['success' => false, 'error' => 'Nenhuma coleta encontrada com os filtros aplicados'], 404);
        exit;
    }

    // ================================================================
    // GERAR CSV (só chega aqui se não houver erros)
    // ================================================================
    $filename = 'perf_coletas_' . date('Y-m-d_His') . '.csv';

    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Pragma: no-cache');
    header('Expires: 0');

    // BOM para UTF-8
    echo "\xEF\xBB\xBF";

    // Cabeçalho
    $headers = [
        'Unidade',
        'Número Coleta',
        'Data Limite',
        'Hora Limite',
        'Data Lançamento',
        'CNPJ Remetente',
        'Nome Remetente',
        'Endereço Remetente',
        'Bairro',
        'CEP',
        'Cidade Remetente',
        'Setor',
        'CNPJ Destinatário',
        'Nome Destinatário',
        'Endereço Destinatário',
        'CEP Destino',
        'Cidade Destinatário',
        'Solicitante',
        'Motorista',
        'Situação',
        'Valor Mercadoria (R$)',
        'Qtde Volumes',
        'Peso (Kg)',
        'Placa',
        'Mercadoria',
        'Tipo Frete',
        'Data Efetivação',
        'Hora Efetivação',
        'Obs 1',
        'Obs 2',
        'Obs 3'
    ];

    echo implode(';', $headers) . "\n";

    // Dados
    while ($row = pg_fetch_assoc($result)) {
        $line = [
            $row['unidade'] ?? '',
            $row['numero_coleta'] ?? '',
            $row['data_limite'] ?? '',
            $row['hora_limite'] ?? '',
            $row['data_lancamento'] ?? '',
            $row['cnpj_emit'] ?? '',
            $row['nome_emit'] ?? '',
            $row['endereco_emit'] ?? '',
            $row['bairro_emit'] ?? '',
            $row['cep_emit'] ?? '',
            $row['cidade_emit'] ?? '',
            $row['setor'] ?? '',
            $row['cnpj_dest'] ?? '',
            $row['nome_dest'] ?? '',
            $row['endereco_dest'] ?? '',
            $row['cep_dest'] ?? '',
            $row['cidade_dest'] ?? '',
            $row['solicitante'] ?? '',
            $row['motorista'] ?? '',
            $row['situacao'] ?? '',
            isset($row['vlr_merc']) ? fmtdec(floatval($row['vlr_merc']), 2) : '',
            $row['qtde_vol'] ?? '',
            isset($row['peso']) ? fmtdec(floatval($row['peso']), 2) : '',
            $row['placa'] ?? '',
            $row['mercadoria'] ?? '',
            $row['tp_frete'] ?? '',
            $row['data_efetivacao'] ?? '',
            $row['hora_efetivacao'] ?? '',
            $row['obs1'] ?? '',
            $row['obs2'] ?? '',
            $row['obs3'] ?? ''
        ];

        echo implode(';', array_map(function($value) {
            return '"' . str_replace('"', '""', $value) . '"';
        }, $line)) . "\n";
    }

    exit;

} catch (Exception $e) {
    error_log("❌ [export.php] Exception: " . $e->getMessage());
    respondJson(['success' => false, 'error' => 'Erro ao processar exportação: ' . $e->getMessage()], 500);
}