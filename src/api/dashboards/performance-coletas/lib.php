<?php
/**
 * ================================================================
 * LIB: FUNÇÕES COMPARTILHADAS - PERFORMANCE DE COLETAS
 * ================================================================
 * Biblioteca de funções reutilizáveis para todas as APIs do
 * dashboard Performance de Coletas
 * 
 * ✅ LEITURA DIRETA DA BASE DE DADOS
 * Este lib agora lê diretamente da tabela [dominio]_coleta,
 * que é populada diariamente via crontab pelo script imp_coleta.php
 * ================================================================
 */

/**
 * ================================================================
 * FUNÇÃO: getNomeTabelaColeta
 * ================================================================
 * Retorna o nome da tabela de coletas para o domínio
 * 
 * @param string $domain - Domínio do usuário (ex: ACV, JOI, CWB)
 * @return string - Nome da tabela (ex: acv_coleta, joi_coleta)
 * ================================================================
 */
function getNomeTabelaColeta($domain) {
    return strtolower($domain) . '_coleta';
}

/**
 * ================================================================
 * FUNÇÃO: createTempColetasTables
 * ================================================================
 * Cria DUAS VIEWs TEMPORÁRIAS separadas:
 * 
 * 1️⃣ tmp_coleta_filtrada: Com TODOS os filtros do usuário
 *    - Usada para: CARDS + COMPARATIVO
 *    - Respeita períodos de lançamento e previsão
 * 
 * 2️⃣ tmp_coleta_30dias: Últimos 30 dias fixos
 *    - Usada para: EVOLUÇÃO + ANÁLISE DIÁRIA
 *    - Ignora os períodos do usuário
 *    - Mantém outros filtros (cnpj, placa, situação, unidade)
 * 
 * @param resource $g_sql - Conexão PostgreSQL
 * @param string $domain - Domínio do usuário
 * @param array $filters - Filtros aplicados pelo usuário
 * 
 * @return bool - true se sucesso
 * @throws Exception - Em caso de erro
 * ================================================================
 */
function createTempColetasTables($g_sql, $domain, $filters = []) {
    try {
        $tabelaBase = getNomeTabelaColeta($domain);
        
        error_log("✅ [lib.php] Criando VIEWs temporárias a partir de $tabelaBase");
        
        // ================================================================
        // CONSTRUIR CLÁUSULAS WHERE PARA OS DOIS CENÁRIOS
        // ================================================================
        
        // 1️⃣ WHERE para filtros do usuário (CARDS + COMPARATIVO)
        $where1 = buildWhereColetasUsuario($g_sql, $filters);
        
        // 2️⃣ WHERE para últimos 30 dias (EVOLUÇÃO + ANÁLISE DIÁRIA)
        $where2 = buildWhereColetasBackup($g_sql, $filters);
        
        // ================================================================
        // CRIAR VIEW 1: tmp_coleta_filtrada (COM FILTROS DO USUÁRIO)
        // ================================================================
        
        // Dropar VIEW anterior se existir
        pg_query($g_sql, "DROP VIEW IF EXISTS tmp_coleta_filtrada");
        
        $viewQuery1 = "
            CREATE TEMP VIEW tmp_coleta_filtrada AS
            SELECT DISTINCT ON (unidade, nro_coleta)
                unidade,
                nro_coleta AS numero_coleta,
                data_limite,
                hora_limite,
                cnpj_emit,
                nome_emit,
                endereco_emit,
                bairro_emit,
                cep_emit,
                cidade_emit,
                uf_emit,
                setor,
                cnpj_dest,
                '' AS nome_dest,
                '' AS endereco_dest,
                '' AS cep_dest,
                '' AS cidade_dest,
                '' AS uf_dest,
                solicitante,
                '' AS motorista,
                situacao,
                NULL AS data_situacao,
                NULL AS hora_situacao,
                vlr_merc,
                qtde_vol,
                peso,
                placa,
                '' AS mercadoria,
                '' AS tp_frete,
                observacao AS obs1,
                '' AS obs2,
                '' AS obs3,
                data_inclusao AS data_lancamento,
                hora_inclusao AS hora_lancamento,
                data_efetivacao,
                hora_efetivacao
            FROM $tabelaBase
            WHERE $where1
        ";
        
        // Criar VIEW 1
        $result1 = pg_query($g_sql, $viewQuery1);
        
        if (!$result1) {
            throw new Exception("Erro ao criar VIEW tmp_coleta_filtrada: " . pg_last_error($g_sql));
        }
        
        // Contar registros VIEW 1
        $countResult1 = pg_query($g_sql, "SELECT COUNT(*) as total FROM tmp_coleta_filtrada");
        $count1 = pg_fetch_assoc($countResult1)['total'];
        
        error_log("✅ [lib.php] VIEW tmp_coleta_filtrada criada: $count1 coletas (COM filtros do usuário)");
        
        // ================================================================
        // CRIAR VIEW 2: tmp_coleta_30dias (ÚLTIMOS 30 DIAS)
        // ================================================================
        
        // Dropar VIEW anterior se existir
        pg_query($g_sql, "DROP VIEW IF EXISTS tmp_coleta_30dias");
        
        $viewQuery2 = "
            CREATE TEMP VIEW tmp_coleta_30dias AS
            SELECT DISTINCT ON (unidade, nro_coleta)
                unidade,
                nro_coleta AS numero_coleta,
                data_limite,
                hora_limite,
                cnpj_emit,
                nome_emit,
                endereco_emit,
                bairro_emit,
                cep_emit,
                cidade_emit,
                uf_emit,
                setor,
                cnpj_dest,
                '' AS nome_dest,
                '' AS endereco_dest,
                '' AS cep_dest,
                '' AS cidade_dest,
                '' AS uf_dest,
                solicitante,
                '' AS motorista,
                situacao,
                NULL AS data_situacao,
                NULL AS hora_situacao,
                vlr_merc,
                qtde_vol,
                peso,
                placa,
                '' AS mercadoria,
                '' AS tp_frete,
                observacao AS obs1,
                '' AS obs2,
                '' AS obs3,
                data_inclusao AS data_lancamento,
                hora_inclusao AS hora_lancamento,
                data_efetivacao,
                hora_efetivacao
            FROM $tabelaBase
            WHERE $where2
        ";
        
        // Criar VIEW 2
        $result2 = pg_query($g_sql, $viewQuery2);
        
        if (!$result2) {
            throw new Exception("Erro ao criar VIEW tmp_coleta_30dias: " . pg_last_error($g_sql));
        }
        
        // Contar registros VIEW 2
        $countResult2 = pg_query($g_sql, "SELECT COUNT(*) as total FROM tmp_coleta_30dias");
        $count2 = pg_fetch_assoc($countResult2)['total'];
        
        error_log("✅ [lib.php] VIEW tmp_coleta_30dias criada: $count2 coletas (Últimos 30 dias)");
        
        return true;
        
    } catch (Exception $e) {
        error_log('❌ Erro em createTempColetasTables: ' . $e->getMessage());
        throw $e;
    }
}

/**
 * ================================================================
 * FUNÇÃO AUXILIAR: buildWhereColetasUsuario
 * ================================================================
 * Constrói cláusula WHERE para filtros do usuário
 * 
 * @param resource $g_sql - Conexão PostgreSQL
 * @param array $filters - Filtros aplicados pelo usuário
 * @return string - Cláusula WHERE
 * ================================================================
 */
function buildWhereColetasUsuario($g_sql, $filters) {
    $conditions = [];
    
    // ✅ SEMPRE EXCLUIR SITUAÇÃO 3 (CANCELADA)
    $conditions[] = "situacao != '3'";
    
    // Filtro: Período de Lançamento (data_inclusao)
    if (!empty($filters['periodoLancamentoInicio'])) {
        $dataIni = pg_escape_string($g_sql, $filters['periodoLancamentoInicio']);
        $conditions[] = "data_inclusao >= '$dataIni'";
    }
    if (!empty($filters['periodoLancamentoFim'])) {
        $dataFim = pg_escape_string($g_sql, $filters['periodoLancamentoFim']);
        $conditions[] = "data_inclusao <= '$dataFim'";
    }
    
    // Filtro: Período de Previsão (data_limite)
    if (!empty($filters['periodoPrevisaoInicio'])) {
        $dataIni = pg_escape_string($g_sql, $filters['periodoPrevisaoInicio']);
        $conditions[] = "data_limite >= '$dataIni'";
    }
    if (!empty($filters['periodoPrevisaoFim'])) {
        $dataFim = pg_escape_string($g_sql, $filters['periodoPrevisaoFim']);
        $conditions[] = "data_limite <= '$dataFim'";
    }
    
    // Filtro: CNPJ Remetente
    if (!empty($filters['cnpjRemetente'])) {
        $cnpj = pg_escape_string($g_sql, $filters['cnpjRemetente']);
        $conditions[] = "cnpj_emit = '$cnpj'";
    }
    
    // Filtro: Placa
    if (!empty($filters['placa'])) {
        $placa = pg_escape_string($g_sql, strtoupper($filters['placa']));
        $conditions[] = "UPPER(placa) = '$placa'";
    }
    
    if (!empty($filters['situacao'])) {
        // ✅ SUPORTE PARA ARRAY DE SITUAÇÕES
        if (is_array($filters['situacao'])) {
            $situacoes = array_map(function($s) use ($g_sql) {
                // Mapear nome para código
                $map = [
                    'PRE-CADASTRADA' => '9',
                    'CADASTRADA' => '0',
                    'COMANDADA' => '1',
                    'COLETADA' => '2'
                ];
                $codigo = $map[$s] ?? $s;
                return "'" . pg_escape_string($g_sql, $codigo) . "'";
            }, $filters['situacao']);
            
            if (!empty($situacoes)) {
                $conditions[] = "situacao IN (" . implode(', ', $situacoes) . ")";
            }
        } else {
            // Compatibilidade com string única
            $situacao = pg_escape_string($g_sql, $filters['situacao']);
            $conditions[] = "situacao = '$situacao'";
        }
    }
    
    $unidadeFilter = buildUnidadeColetaFilter($g_sql, $filters['unidadeColeta'] ?? []);
    if (!empty($unidadeFilter)) {
        $conditions[] = ltrim($unidadeFilter, ' AND');
    }
    
    return implode(' AND ', $conditions);
}

/**
 * ================================================================
 * FUNÇÃO AUXILIAR: buildWhereColetasBackup
 * ================================================================
 * Constrói cláusula WHERE para backup dos últimos 30 dias
 * 
 * @param resource $g_sql - Conexão PostgreSQL
 * @param array $filters - Filtros aplicados pelo usuário
 * @return string - Cláusula WHERE
 * ================================================================
 */
function buildWhereColetasBackup($g_sql, $filters) {
    $conditions = [];
    
    // ✅ SEMPRE EXCLUIR SITUAÇÃO 3 (CANCELADA)
    $conditions[] = "situacao != '3'";
    
    // ✅ ÚLTIMOS 30 DIAS (baseado em data_limite)
    $conditions[] = "data_limite >= CURRENT_DATE - INTERVAL '30 days'";
    $conditions[] = "data_limite <= CURRENT_DATE";
    
    // Manter filtros de CNPJ, Placa, Situação e Unidade
    if (!empty($filters['cnpjRemetente'])) {
        $cnpj = pg_escape_string($g_sql, $filters['cnpjRemetente']);
        $conditions[] = "cnpj_emit = '$cnpj'";
    }
    
    if (!empty($filters['placa'])) {
        $placa = pg_escape_string($g_sql, strtoupper($filters['placa']));
        $conditions[] = "UPPER(placa) = '$placa'";
    }
    
    if (!empty($filters['situacao'])) {
        // ✅ SUPORTE PARA ARRAY DE SITUAÇÕES
        if (is_array($filters['situacao'])) {
            $situacoes = array_map(function($s) use ($g_sql) {
                // Mapear nome para código
                $map = [
                    'PRE-CADASTRADA' => '9',
                    'CADASTRADA' => '0',
                    'COMANDADA' => '1',
                    'COLETADA' => '2'
                ];
                $codigo = $map[$s] ?? $s;
                return "'" . pg_escape_string($g_sql, $codigo) . "'";
            }, $filters['situacao']);
            
            if (!empty($situacoes)) {
                $conditions[] = "situacao IN (" . implode(', ', $situacoes) . ")";
            }
        } else {
            // Compatibilidade com string única
            $situacao = pg_escape_string($g_sql, $filters['situacao']);
            $conditions[] = "situacao = '$situacao'";
        }
    }
    
    $unidadeFilter = buildUnidadeColetaFilter($g_sql, $filters['unidadeColeta'] ?? []);
    if (!empty($unidadeFilter)) {
        $conditions[] = ltrim($unidadeFilter, ' AND');
    }
    
    return implode(' AND ', $conditions);
}

/**
 * ================================================================
 * FUNÇÃO: buildUnidadeColetaFilter
 * ================================================================
 * Constrói filtro SQL para unidades de coleta
 *
 * Esta função recebe um array de siglas de unidades e retorna
 * uma cláusula SQL WHERE que filtra baseado nos 3 primeiros
 * caracteres da coluna especificada.
 *
 * @param resource $g_sql - Conexão PostgreSQL (para escape)
 * @param array $siglas - Array de siglas (ex: ['JOI', 'CWB'])
 * @param string $columnName - Nome da coluna (padrão: 'unidade')
 * @return string - Cláusula SQL WHERE ou string vazia
 *
 * EXEMPLO DE USO:
 * ----------------------------------------------------------------
 * $unidadeFilter = buildUnidadeColetaFilter($g_sql, $filters['unidadeColeta'] ?? []);
 *
 * $query = "SELECT * FROM tmp_coleta WHERE 1=1 $unidadeFilter";
 * ----------------------------------------------------------------
 *
 * EXEMPLO DE SAÍDA SQL:
 * ----------------------------------------------------------------
 * Input: ['JOI', 'CWB']
 * Output: AND SUBSTRING(unidade, 1, 3) IN ('JOI', 'CWB')
 * ----------------------------------------------------------------
 * ================================================================
 */
function buildUnidadeColetaFilter($g_sql, $siglas = [], $columnName = 'unidade') {
    // Se não houver siglas, retornar string vazia
    if (empty($siglas) || !is_array($siglas)) {
        return '';
    }

    // Escapar cada sigla e construir array de condições
    $escapedSiglas = [];
    foreach ($siglas as $sigla) {
        if (!empty($sigla)) {
            // Converter para maiúscula e pegar apenas 3 primeiros caracteres
            $siglaTrimmed = strtoupper(substr(trim($sigla), 0, 3));
            $escapedSiglas[] = "'" . pg_escape_string($g_sql, $siglaTrimmed) . "'";
        }
    }

    // Se não houver siglas válidas após escape, retornar vazio
    if (empty($escapedSiglas)) {
        return '';
    }

    // Construir cláusula IN com SUBSTRING para extrair sigla
    $siglasList = implode(', ', $escapedSiglas);
    return " AND SUBSTRING($columnName, 1, 3) IN ($siglasList)";
}

/**
 * ================================================================
 * FUNÇÃO: getColetasCountBySituacao
 * ================================================================
 * Retorna contadores de coletas agrupadas por situação
 *
 * @param resource $g_sql - Conexão PostgreSQL
 * @param string $tableName - Nome da VIEW a usar (tmp_coleta_filtrada ou tmp_coleta_30dias)
 * @return array - Array com contadores por situação
 * 
 * SITUAÇÕES:
 * - 9 = Pré-cadastrada
 * - 0 = Cadastrada
 * - 1 = Comandada
 * - 2 = Coletada
 * - 3 = Cancelada (SEMPRE DESCONSIDERADA)
 * ================================================================
 */
function getColetasCountBySituacao($g_sql, $tableName = 'tmp_coleta_filtrada') {
    $query = "
        SELECT 
            situacao,
            COUNT(*) as total
        FROM $tableName
        WHERE situacao != '3'
        GROUP BY situacao
        ORDER BY situacao
    ";
    
    $result = pg_query($g_sql, $query);
    
    $counts = [
        '9' => 0,  // Pré-cadastrada
        '0' => 0,  // Cadastrada
        '1' => 0,  // Comandada
        '2' => 0   // Coletada
    ];
    
    while ($row = pg_fetch_assoc($result)) {
        $counts[$row['situacao']] = (int)$row['total'];
    }
    
    // Retornar no formato esperado pelo frontend
    return [
        'preCadastradas' => $counts['9'],
        'cadastradas' => $counts['0'],
        'comandadas' => $counts['1'],
        'coletadas' => $counts['2'],
        'total' => $counts['9'] + $counts['0'] + $counts['1'] + $counts['2']
    ];
}

/**
 * ================================================================
 * FUNÇÃO: getColetasAnalysisData
 * ================================================================
 * Retorna dados de análise das coletas (tempos, volumes, etc)
 *
 * @param resource $g_sql - Conexão PostgreSQL
 * @return array - Dados de análise
 * ================================================================
 */
function getColetasAnalysisData($g_sql) {
    $query = "
        SELECT 
            COUNT(*) as total_coletas,
            COUNT(DISTINCT cnpj_emit) as total_clientes,
            SUM(qtde_vol) as total_volumes,
            SUM(peso) as total_peso,
            AVG(
                CASE 
                    WHEN data_efetivacao IS NOT NULL AND data_limite IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (data_efetivacao - data_limite)) / 3600
                    ELSE NULL
                END
            ) as tempo_medio_horas,
            COUNT(
                CASE 
                    WHEN data_efetivacao > data_limite 
                    THEN 1 
                END
            ) as coletas_atrasadas,
            COUNT(
                CASE 
                    WHEN data_efetivacao <= data_limite 
                    THEN 1 
                END
            ) as coletas_no_prazo
        FROM tmp_coleta_filtrada
        WHERE situacao != '3'
    ";
    
    $result = pg_query($g_sql, $query);
    return pg_fetch_assoc($result);
}

/**
 * ================================================================
 * FUNÇÃO: getColetasDailyData
 * ================================================================
 * Retorna dados diários de coletas para gráficos de evolução
 *
 * @param resource $g_sql - Conexão PostgreSQL
 * @param int $days - Número de dias para análise (padrão: 30)
 * @return array - Array de dados diários
 * ================================================================
 */
function getColetasDailyData($g_sql, $days = 30) {
    $query = "
        SELECT 
            data_limite::date as data,
            COUNT(*) as total,
            COUNT(CASE WHEN situacao = '2' THEN 1 END) as coletadas,
            COUNT(CASE WHEN data_efetivacao > data_limite THEN 1 END) as atrasadas
        FROM tmp_coleta_30dias
        WHERE 
            situacao != '3'
            AND data_limite >= CURRENT_DATE - INTERVAL '$days days'
            AND data_limite <= CURRENT_DATE
        GROUP BY data_limite::date
        ORDER BY data_limite::date
    ";
    
    $result = pg_query($g_sql, $query);
    
    $data = [];
    while ($row = pg_fetch_assoc($result)) {
        $data[] = [
            'data' => $row['data'],
            'total' => (int)$row['total'],
            'coletadas' => (int)$row['coletadas'],
            'atrasadas' => (int)$row['atrasadas']
        ];
    }
    
    return $data;
}

/**
 * ================================================================
 * FUNÇÃO: getColetasByUnidade
 * ================================================================
 * Retorna dados de coletas agrupados por unidade
 *
 * @param resource $g_sql - Conexão PostgreSQL
 * @return array - Array de dados por unidade
 * ================================================================
 */
function getColetasByUnidade($g_sql) {
    $query = "
        SELECT 
            SUBSTRING(unidade, 1, 3) as sigla_unidade,
            COUNT(*) as total,
            COUNT(CASE WHEN situacao = '2' THEN 1 END) as coletadas,
            COUNT(CASE WHEN data_efetivacao > data_limite THEN 1 END) as atrasadas,
            ROUND(
                COUNT(CASE WHEN situacao = '2' THEN 1 END)::numeric / 
                NULLIF(COUNT(*)::numeric, 0) * 100, 
                2
            ) as percentual_conclusao
        FROM tmp_coleta_filtrada
        WHERE situacao != '3'
        GROUP BY SUBSTRING(unidade, 1, 3)
        ORDER BY total DESC
    ";
    
    $result = pg_query($g_sql, $query);
    
    $data = [];
    while ($row = pg_fetch_assoc($result)) {
        $data[] = [
            'unidade' => $row['sigla_unidade'],
            'total' => (int)$row['total'],
            'coletadas' => (int)$row['coletadas'],
            'atrasadas' => (int)$row['atrasadas'],
            'percentual' => (float)$row['percentual_conclusao']
        ];
    }
    
    return $data;
}

/**
 * ================================================================
 * FUNÇÃO: getColetasAnaliseDiaria
 * ================================================================
 * Retorna análise diária de coletas (para gráfico de barras)
 *
 * @param resource $g_sql - Conexão PostgreSQL
 * @param int $days - Número de dias para análise (padrão: 30)
 * @return array - Array de dados diários
 * ================================================================
 */
function getColetasAnaliseDiaria($g_sql, $days = 30) {
    $query = "
        SELECT 
            data_limite::date as data,
            COUNT(*) as programadas,
            COUNT(CASE WHEN situacao = '2' THEN 1 END) as coletadas,
            COUNT(
                CASE 
                    WHEN situacao = '2' 
                    AND (data_efetivacao + hora_efetivacao) <= (data_limite + hora_limite)
                    THEN 1 
                END
            ) as no_prazo,
            ROUND(
                COUNT(
                    CASE 
                        WHEN situacao = '2' 
                        AND (data_efetivacao + hora_efetivacao) <= (data_limite + hora_limite)
                        THEN 1 
                    END
                )::numeric / 
                NULLIF(COUNT(*)::numeric, 0) * 100, 
                2
            ) as performance
        FROM tmp_coleta_30dias
        WHERE 
            situacao != '3'
            AND data_limite >= CURRENT_DATE - INTERVAL '$days days'
            AND data_limite <= CURRENT_DATE
        GROUP BY data_limite::date
        ORDER BY data_limite::date
    ";
    
    $result = pg_query($g_sql, $query);
    
    $data = [];
    while ($row = pg_fetch_assoc($result)) {
        $data[] = [
            'data' => $row['data'],
            'coletasProgramadas' => (int)$row['programadas'],
            'coletasRealizadas' => (int)$row['coletadas'],
            'coletadasNoPrazo' => (int)$row['no_prazo'],
            'performance' => (float)($row['performance'] ?? 0)
        ];
    }
    
    return $data;
}

/**
 * ================================================================
 * FUNÇÃO: getColetasEvolucao
 * ================================================================
 * Retorna evolução de performance (taxa de sucesso ao longo do tempo)
 *
 * @param resource $g_sql - Conexão PostgreSQL
 * @param int $days - Número de dias para análise (padrão: 30)
 * @return array - Array de dados de evolução
 * ================================================================
 */
function getColetasEvolucao($g_sql, $days = 30) {
    $query = "
        SELECT 
            data_limite::date as data,
            COUNT(*) as total,
            COUNT(CASE WHEN situacao = '2' THEN 1 END) as coletadas,
            COUNT(CASE 
                WHEN situacao = '2' 
                AND (data_efetivacao + hora_efetivacao) <= (data_limite + hora_limite) 
                THEN 1 
            END) as no_prazo,
            ROUND(
                COUNT(CASE 
                    WHEN situacao = '2' 
                    AND (data_efetivacao + hora_efetivacao) <= (data_limite + hora_limite) 
                    THEN 1 
                END)::numeric / 
                NULLIF(COUNT(*)::numeric, 0) * 100, 
                2
            ) as performance
        FROM tmp_coleta_30dias
        WHERE 
            situacao != '3'
            AND data_limite >= CURRENT_DATE - INTERVAL '$days days'
            AND data_limite <= CURRENT_DATE
        GROUP BY data_limite::date
        ORDER BY data_limite::date
    ";
    
    $result = pg_query($g_sql, $query);
    
    $data = [];
    while ($row = pg_fetch_assoc($result)) {
        $data[] = [
            'data' => $row['data'],
            'total' => (int)$row['total'],
            'coletadas' => (int)$row['coletadas'],
            'noPrazo' => (int)$row['no_prazo'],
            'performance' => (float)($row['performance'] ?? 0)
        ];
    }
    
    return $data;
}

/**
 * ================================================================
 * FUNÇÃO: getColetasComparativo
 * ================================================================
 * Retorna comparativo de performance entre unidades
 *
 * @param resource $g_sql - Conexão PostgreSQL
 * @param string $domain - Domínio do usuário (para buscar nome da unidade)
 * @return array - Array de dados comparativos por unidade
 * ================================================================
 */
function getColetasComparativo($g_sql, $domain) {
    $tabela_unidade = strtolower($domain) . '_unidade';
    
    $query = "
        SELECT 
            SUBSTRING(c.unidade, 1, 3) as sigla,
            COALESCE(u.nome, SUBSTRING(c.unidade, 1, 3)) as nome,
            COUNT(*) as qtde_coletas,
            COUNT(CASE WHEN c.situacao IN ('9', '0', '1') THEN 1 END) as programadas,
            COUNT(CASE WHEN c.situacao = '1' THEN 1 END) as comandadas,
            COUNT(CASE WHEN c.situacao = '2' THEN 1 END) as coletadas,
            COUNT(
                CASE 
                    WHEN c.situacao = '2' 
                    AND (c.data_efetivacao + c.hora_efetivacao) <= (c.data_limite + c.hora_limite)
                    THEN 1 
                END
            ) as no_prazo,
            ROUND(
                COUNT(
                    CASE 
                        WHEN c.situacao = '2' 
                        AND (c.data_efetivacao + c.hora_efetivacao) <= (c.data_limite + c.hora_limite)
                        THEN 1 
                    END
                )::numeric / 
                NULLIF(COUNT(*)::numeric, 0) * 100, 
                2
            ) as performance
        FROM tmp_coleta_filtrada c
        LEFT JOIN $tabela_unidade u ON SUBSTRING(c.unidade, 1, 3) = u.sigla
        WHERE c.situacao != '3'
        GROUP BY SUBSTRING(c.unidade, 1, 3), u.nome
        ORDER BY qtde_coletas DESC
    ";
    
    $result = pg_query($g_sql, $query);
    
    if (!$result) {
        error_log("❌ Erro ao executar query getColetasComparativo: " . pg_last_error($g_sql));
        return [];
    }
    
    $data = [];
    while ($row = pg_fetch_assoc($result)) {
        $data[] = [
            'unidade' => $row['nome'],
            'sigla' => $row['sigla'],
            'qtdeColetas' => (int)$row['qtde_coletas'],
            'programadas' => (int)$row['programadas'],
            'comandadas' => (int)$row['comandadas'],
            'coletadas' => (int)$row['coletadas'],
            'noPrazo' => (int)$row['no_prazo'],
            'performance' => (float)($row['performance'] ?? 0)
        ];
    }
    
    return $data;
}