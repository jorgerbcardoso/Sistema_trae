<?php
/**
 * BI DE COMPRAS - Dashboard de análise de compras
 * 
 * Endpoint: POST /sistema/api/compras/dashboard.php
 * 
 * @description Retorna análise completa de compras com gráficos, KPIs e indicadores
 * @author Sistema PRESTO
 * @version 2.0
 * @date 2026-02-26
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Domain, X-Unidade");
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../middleware/auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'success' => false,
        'message' => 'Método não permitido. Use POST.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ✅ AUTENTICAÇÃO OBRIGATÓRIA - Usando try-catch correto
try {
    $user = authenticate();
    $domain = $user['domain'];
    
    // ✅ Obter unidade do header X-Unidade (enviado pelo frontend)
    $headers = getallheaders();
    $unidade_logada = $headers['X-Unidade'] ?? $headers['x-unidade'] ?? 'MTZ';
    
    error_log('🔍 [BI Compras] Domain: ' . $domain);
    error_log('🔍 [BI Compras] Unidade: ' . $unidade_logada);
    error_log('🔍 [BI Compras] Username: ' . $user['username']);
} catch (Exception $e) {
    error_log('❌ [BI Compras] Erro de autenticação: ' . $e->getMessage());
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'message' => 'Não autorizado: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // ====================================================================
    // RECEBER FILTROS
    // ====================================================================
    $input = json_decode(file_get_contents('php://input'), true);
    
    $periodo_inclusao_inicio = $input['periodo_inclusao_inicio'] ?? null;
    $periodo_inclusao_fim = $input['periodo_inclusao_fim'] ?? null;
    $unidade_filtro = $input['unidade'] ?? null;
    $seq_tipo_item = $input['seq_tipo_item'] ?? null;
    $seq_item = $input['seq_item'] ?? null;
    $seq_fornecedor = $input['seq_fornecedor'] ?? null;

    // ====================================================================
    // VALIDAÇÕES
    // ====================================================================
    if (!$periodo_inclusao_inicio || !$periodo_inclusao_fim) {
        throw new Exception('Período de inclusão obrigatório');
    }

    // ✅ DETECTAR SE DEVE AGRUPAR POR DIA OU POR MÊS
    $data_inicio = new DateTime($periodo_inclusao_inicio);
    $data_fim = new DateTime($periodo_inclusao_fim);
    $diferenca_dias = $data_inicio->diff($data_fim)->days;
    $agrupar_por_dia = $diferenca_dias < 62;

    error_log("📊 [BI Compras] Diferença de dias: {$diferenca_dias}");
    error_log("📊 [BI Compras] Agrupar por dia: " . ($agrupar_por_dia ? 'SIM' : 'NÃO'));

    // ✅ REGRA DE ACESSO: Usuários não-MTZ só veem sua própria unidade
    if ($unidade_logada !== 'MTZ' && $unidade_filtro && $unidade_filtro !== $unidade_logada) {
        throw new Exception('Você não tem permissão para visualizar dados de outras unidades');
    }

    // Se usuário não é MTZ e não passou filtro, forçar sua unidade
    if ($unidade_logada !== 'MTZ' && !$unidade_filtro) {
        $unidade_filtro = $unidade_logada;
    }

    // ====================================================================
    // CONECTAR NO BANCO
    // ====================================================================
    $g_sql = connect();

    // ====================================================================
    // QUERY PRINCIPAL - KPIs E DADOS AGREGADOS
    // ====================================================================
    // ✅ CONSTRUIR WHERE E JOINS DINÂMICOS
    // Só fazer JOIN com pedido_item/item se houver filtro de tipo_item ou seq_item
    $precisaJoinItem = ($seq_tipo_item || $seq_item);
    
    $where_conditions = ["p.data_inclusao BETWEEN $1 AND $2"];
    $params = [$periodo_inclusao_inicio, $periodo_inclusao_fim];
    $param_index = 3;

    if ($unidade_filtro) {
        $where_conditions[] = "p.unidade = $$param_index";
        $params[] = $unidade_filtro;
        $param_index++;
    }

    if ($seq_tipo_item) {
        $where_conditions[] = "i.seq_tipo_item = $$param_index";
        $params[] = $seq_tipo_item;
        $param_index++;
    }

    if ($seq_item) {
        $where_conditions[] = "pi.seq_item = $$param_index";
        $params[] = $seq_item;
        $param_index++;
    }

    if ($seq_fornecedor) {
        $where_conditions[] = "p.seq_fornecedor = $$param_index";
        $params[] = $seq_fornecedor;
        $param_index++;
    }

    $where_clause = implode(' AND ', $where_conditions);

    // ✅ QUERY: KPIs Gerais
    if ($precisaJoinItem) {
        $query_kpis = "
            SELECT 
                COUNT(DISTINCT p.seq_pedido) as total_pedidos,
                COUNT(DISTINCT pi.seq_item) as total_itens,
                COUNT(DISTINCT p.seq_fornecedor) as total_fornecedores,
                COALESCE(SUM(p.vlr_total), 0) as valor_total
            FROM 
                {$domain}_pedido p
                INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
                INNER JOIN {$domain}_item i ON pi.seq_item = i.seq_item
            WHERE 
                {$where_clause}
        ";
    } else {
        $query_kpis = "
            SELECT 
                COUNT(DISTINCT p.seq_pedido) as total_pedidos,
                COALESCE(SUM(
                    (SELECT COUNT(*) FROM {$domain}_pedido_item pi WHERE pi.seq_pedido = p.seq_pedido)
                ), 0)::integer as total_itens,
                COUNT(DISTINCT p.seq_fornecedor) as total_fornecedores,
                COALESCE(SUM(p.vlr_total), 0) as valor_total
            FROM 
                {$domain}_pedido p
            WHERE 
                {$where_clause}
        ";
    }

    $result_kpis = sql($query_kpis, $params, $g_sql);
    $kpis = pg_fetch_assoc($result_kpis) ?? [
        'total_pedidos' => 0,
        'total_itens' => 0,
        'total_fornecedores' => 0,
        'valor_total' => 0
    ];

    $valor_total = (float) $kpis['valor_total'];
    $total_pedidos = (int) $kpis['total_pedidos'];
    $ticket_medio = $total_pedidos > 0 ? ($valor_total / $total_pedidos) : 0;

    // ====================================================================
    // EVOLUÇÃO TOTAL (Por período)
    // ====================================================================
    if ($precisaJoinItem) {
        // Com filtro de item: precisa fazer JOIN
        if ($agrupar_por_dia) {
            $query_evolucao_total = "
                SELECT 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM-DD') as periodo,
                    TO_CHAR(p.data_inclusao, 'DD/MM') as periodo_label,
                    COALESCE(SUM(p.vlr_total), 0) as valor
                FROM 
                    {$domain}_pedido p
                    INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
                    INNER JOIN {$domain}_item i ON pi.seq_item = i.seq_item
                WHERE 
                    {$where_clause}
                GROUP BY 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM-DD'),
                    TO_CHAR(p.data_inclusao, 'DD/MM')
                ORDER BY 
                    periodo
            ";
        } else {
            $query_evolucao_total = "
                SELECT 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM') as periodo,
                    TO_CHAR(p.data_inclusao, 'Mon/YY') as periodo_label,
                    COALESCE(SUM(p.vlr_total), 0) as valor
                FROM 
                    {$domain}_pedido p
                    INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
                    INNER JOIN {$domain}_item i ON pi.seq_item = i.seq_item
                WHERE 
                    {$where_clause}
                GROUP BY 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM'),
                    TO_CHAR(p.data_inclusao, 'Mon/YY')
                ORDER BY 
                    periodo
            ";
        }
    } else {
        // Sem filtro de item: consulta direta na tabela pedido
        if ($agrupar_por_dia) {
            $query_evolucao_total = "
                SELECT 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM-DD') as periodo,
                    TO_CHAR(p.data_inclusao, 'DD/MM') as periodo_label,
                    COALESCE(SUM(p.vlr_total), 0) as valor
                FROM 
                    {$domain}_pedido p
                WHERE 
                    {$where_clause}
                GROUP BY 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM-DD'),
                    TO_CHAR(p.data_inclusao, 'DD/MM')
                ORDER BY 
                    periodo
            ";
        } else {
            $query_evolucao_total = "
                SELECT 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM') as periodo,
                    TO_CHAR(p.data_inclusao, 'Mon/YY') as periodo_label,
                    COALESCE(SUM(p.vlr_total), 0) as valor
                FROM 
                    {$domain}_pedido p
                WHERE 
                    {$where_clause}
                GROUP BY 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM'),
                    TO_CHAR(p.data_inclusao, 'Mon/YY')
                ORDER BY 
                    periodo
            ";
        }
    }

    $result_evolucao_total = sql($query_evolucao_total, $params, $g_sql);
    $evolucao_total = pg_fetch_all($result_evolucao_total) ?: [];

    // ====================================================================
    // DIVISÃO POR UNIDADE
    // ====================================================================
    if ($precisaJoinItem) {
        $query_por_unidade = "
            SELECT 
                p.unidade,
                COALESCE(SUM(p.vlr_total), 0) as valor,
                COUNT(DISTINCT p.seq_pedido) as qtde_pedidos
            FROM 
                {$domain}_pedido p
                INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
                INNER JOIN {$domain}_item i ON pi.seq_item = i.seq_item
            WHERE 
                {$where_clause}
            GROUP BY 
                p.unidade
            ORDER BY 
                valor DESC
        ";
    } else {
        $query_por_unidade = "
            SELECT 
                p.unidade,
                COALESCE(SUM(p.vlr_total), 0) as valor,
                COUNT(DISTINCT p.seq_pedido) as qtde_pedidos
            FROM 
                {$domain}_pedido p
            WHERE 
                {$where_clause}
            GROUP BY 
                p.unidade
            ORDER BY 
                valor DESC
        ";
    }

    $result_por_unidade = sql($query_por_unidade, $params, $g_sql);
    $por_unidade = pg_fetch_all($result_por_unidade) ?: [];
    
    // Adicionar percentual
    foreach ($por_unidade as &$item) {
        $item['valor'] = (float) $item['valor'];
        $item['percentual'] = $valor_total > 0 ? ($item['valor'] / $valor_total * 100) : 0;
    }

    // ====================================================================
    // DIVISÃO POR CENTRO DE CUSTO (TOP 5) - USA TABELA ORDEM_COMPRA
    // ====================================================================
    // ✅ Construir filtros SEM fornecedor para ordem_compra
    $where_oc_conditions = ["oc.data_inclusao BETWEEN $1 AND $2", "oc.aprovada = 'S'"];
    $params_oc = [$periodo_inclusao_inicio, $periodo_inclusao_fim];
    $param_oc_index = 3;

    if ($unidade_filtro) {
        $where_oc_conditions[] = "oc.unidade = $$param_oc_index";
        $params_oc[] = $unidade_filtro;
        $param_oc_index++;
    }

    if ($seq_tipo_item) {
        $where_oc_conditions[] = "i.seq_tipo_item = $$param_oc_index";
        $params_oc[] = $seq_tipo_item;
        $param_oc_index++;
    }

    if ($seq_item) {
        $where_oc_conditions[] = "oci.seq_item = $$param_oc_index";
        $params_oc[] = $seq_item;
        $param_oc_index++;
    }

    $where_oc_clause = implode(' AND ', $where_oc_conditions);

    $query_por_centro_custo = "
        SELECT 
            oc.unidade,
            COALESCE(oc.seq_centro_custo, 0) as seq_centro_custo,
            COALESCE(cc.descricao, 'SEM CENTRO DE CUSTO') as descricao,
            COALESCE(SUM(i.vlr_item), 0) as valor
        FROM 
            {$domain}_ordem_compra oc
            INNER JOIN {$domain}_ordem_compra_item oci ON oc.seq_ordem_compra = oci.seq_ordem_compra
            INNER JOIN {$domain}_item i ON oci.seq_item = i.seq_item
            LEFT JOIN {$domain}_centro_custo cc ON oc.seq_centro_custo = cc.seq_centro_custo
        WHERE 
            {$where_oc_clause}
        GROUP BY 
            oc.unidade,
            oc.seq_centro_custo,
            cc.descricao
        ORDER BY 
            valor DESC
        LIMIT 5
    ";

    $result_por_centro_custo = sql($query_por_centro_custo, $params_oc, $g_sql);
    $por_centro_custo = pg_fetch_all($result_por_centro_custo) ?: [];
    
    // Calcular total para percentuais (pode ser diferente do total de pedidos)
    $total_centro_custo = array_sum(array_column($por_centro_custo, 'valor'));
    
    // Adicionar percentual
    foreach ($por_centro_custo as &$item) {
        $item['valor'] = (float) $item['valor'];
        $item['percentual'] = $total_centro_custo > 0 ? ($item['valor'] / $total_centro_custo * 100) : 0;
    }

    // ====================================================================
    // DIVISÃO POR SETOR (TOP 5) - USA TABELA ORDEM_COMPRA
    // ====================================================================
    $query_por_setor = "
        SELECT 
            COALESCE(oc.nro_setor, 0) as nro_setor,
            COALESCE(s.descricao, 'SEM SETOR') as descricao,
            COALESCE(SUM(i.vlr_item), 0) as valor
        FROM 
            {$domain}_ordem_compra oc
            INNER JOIN {$domain}_ordem_compra_item oci ON oc.seq_ordem_compra = oci.seq_ordem_compra
            INNER JOIN {$domain}_item i ON oci.seq_item = i.seq_item
            LEFT JOIN {$domain}_setores s ON oc.nro_setor = s.nro_setor
        WHERE 
            {$where_oc_clause}
        GROUP BY 
            oc.nro_setor,
            s.descricao
        ORDER BY 
            valor DESC
        LIMIT 5
    ";

    $result_por_setor = sql($query_por_setor, $params_oc, $g_sql);
    $por_setor = pg_fetch_all($result_por_setor) ?: [];
    
    // Calcular total para percentuais
    $total_setor = array_sum(array_column($por_setor, 'valor'));
    
    // Adicionar percentual
    foreach ($por_setor as &$item) {
        $item['valor'] = (float) $item['valor'];
        $item['percentual'] = $total_setor > 0 ? ($item['valor'] / $total_setor * 100) : 0;
    }

    // ====================================================================
    // TOP TIPOS DE ITEM (TOP 4 + OUTROS)
    // ====================================================================
    $query_por_tipo_item = "
        SELECT 
            i.seq_tipo_item,
            ti.descricao,
            COALESCE(SUM(pi.vlr_total), 0) as valor
        FROM 
            {$domain}_pedido p
            INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
            INNER JOIN {$domain}_item i ON pi.seq_item = i.seq_item
            LEFT JOIN {$domain}_tipo_item ti ON i.seq_tipo_item = ti.seq_tipo_item
        WHERE 
            {$where_clause}
        GROUP BY 
            i.seq_tipo_item,
            ti.descricao
        ORDER BY 
            valor DESC
    ";

    $result_por_tipo_item = sql($query_por_tipo_item, $params, $g_sql);
    $tipos_item_raw = pg_fetch_all($result_por_tipo_item) ?: [];
    $por_tipo_item = agruparTop4Outros($tipos_item_raw, 'descricao', 'valor');

    // ====================================================================
    // TOP ITENS (TOP 4 + OUTROS)
    // ====================================================================
    $query_por_item = "
        SELECT 
            pi.seq_item,
            i.descricao,
            COALESCE(SUM(pi.vlr_total), 0) as valor
        FROM 
            {$domain}_pedido p
            INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
            INNER JOIN {$domain}_item i ON pi.seq_item = i.seq_item
        WHERE 
            {$where_clause}
        GROUP BY 
            pi.seq_item,
            i.descricao
        ORDER BY 
            valor DESC
    ";

    $result_por_item = sql($query_por_item, $params, $g_sql);
    $itens_raw = pg_fetch_all($result_por_item) ?: [];
    $por_item = agruparTop4Outros($itens_raw, 'descricao', 'valor');

    // ====================================================================
    // TOP 5 FORNECEDORES
    // ====================================================================
    if ($precisaJoinItem) {
        $query_por_fornecedor = "
            SELECT 
                p.seq_fornecedor,
                f.nome,
                f.cnpj,
                COALESCE(SUM(p.vlr_total), 0) as valor,
                COUNT(DISTINCT p.seq_pedido) as qtde_pedidos
            FROM 
                {$domain}_pedido p
                INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
                INNER JOIN {$domain}_item i ON pi.seq_item = i.seq_item
                LEFT JOIN {$domain}_fornecedor f ON p.seq_fornecedor = f.seq_fornecedor
            WHERE 
                {$where_clause}
            GROUP BY 
                p.seq_fornecedor,
                f.nome,
                f.cnpj
            ORDER BY 
                valor DESC
            LIMIT 5
        ";
    } else {
        $query_por_fornecedor = "
            SELECT 
                p.seq_fornecedor,
                f.nome,
                f.cnpj,
                COALESCE(SUM(p.vlr_total), 0) as valor,
                COUNT(DISTINCT p.seq_pedido) as qtde_pedidos
            FROM 
                {$domain}_pedido p
                LEFT JOIN {$domain}_fornecedor f ON p.seq_fornecedor = f.seq_fornecedor
            WHERE 
                {$where_clause}
            GROUP BY 
                p.seq_fornecedor,
                f.nome,
                f.cnpj
            ORDER BY 
                valor DESC
            LIMIT 5
        ";
    }

    $result_por_fornecedor = sql($query_por_fornecedor, $params, $g_sql);
    $por_fornecedor = pg_fetch_all($result_por_fornecedor) ?: [];
    
    // Adicionar percentual
    foreach ($por_fornecedor as &$item) {
        $item['valor'] = (float) $item['valor'];
        $item['percentual'] = $valor_total > 0 ? ($item['valor'] / $valor_total * 100) : 0;
    }

    // ====================================================================
    // EVOLUÇÕES POR DIMENSÃO (TOP 3 cada)
    // ====================================================================
    
    // Evolução por Fornecedor (Top 3) - NÃO precisa JOIN com item (fornecedor está no pedido)
    $evolucao_por_fornecedor = calcularEvolucaoPorDimensao(
        $domain,
        $where_clause,
        $params,
        'fornecedor',
        'f.nome',
        'p.seq_fornecedor',
        "{$domain}_fornecedor f ON p.seq_fornecedor = f.seq_fornecedor",
        $g_sql,
        3,
        $agrupar_por_dia,
        $precisaJoinItem // ✅ Passa o parâmetro
    );

    // Evolução por Item (Top 3) - SEMPRE precisa JOIN com item
    $evolucao_por_item = calcularEvolucaoPorDimensao(
        $domain,
        $where_clause,
        $params,
        'item',
        'i.descricao',
        'pi.seq_item',
        "{$domain}_item i ON pi.seq_item = i.seq_item",
        $g_sql,
        3,
        $agrupar_por_dia,
        true // ✅ SEMPRE precisa JOIN para item
    );

    // Evolução por Unidade - NÃO precisa JOIN com item (unidade está no pedido)
    $evolucao_por_unidade = calcularEvolucaoPorDimensao(
        $domain,
        $where_clause,
        $params,
        'unidade',
        'p.unidade',
        'p.unidade',
        null,
        $g_sql,
        999, // Todas as unidades
        $agrupar_por_dia,
        $precisaJoinItem // ✅ Passa o parâmetro
    );

    // Evolução por Centro de Custo (Top 3)
    $evolucao_por_centro_custo = calcularEvolucaoPorCentroCusto(
        $domain,
        $where_oc_clause,
        $params_oc,
        $g_sql,
        3,
        $agrupar_por_dia
    );

    // Evolução por Setor (Top 3)
    $evolucao_por_setor = calcularEvolucaoPorSetor(
        $domain,
        $where_oc_clause,
        $params_oc,
        $g_sql,
        3,
        $agrupar_por_dia
    );

    // ====================================================================
    // RESPOSTA
    // ====================================================================
    echo json_encode([
        'success' => true,
        'data' => [
            'valor_total' => $valor_total,
            'total_pedidos' => $total_pedidos,
            'total_itens' => (int) $kpis['total_itens'],
            'total_fornecedores' => (int) $kpis['total_fornecedores'],
            'ticket_medio' => $ticket_medio,
            'evolucao_total' => $evolucao_total,
            'por_unidade' => $por_unidade,
            'por_centro_custo' => $por_centro_custo,
            'por_setor' => $por_setor,
            'por_tipo_item' => $por_tipo_item,
            'por_item' => $por_item,
            'por_fornecedor' => $por_fornecedor,
            'evolucao_por_fornecedor' => $evolucao_por_fornecedor,
            'evolucao_por_item' => $evolucao_por_item,
            'evolucao_por_unidade' => $evolucao_por_unidade,
            'evolucao_por_centro_custo' => $evolucao_por_centro_custo,
            'evolucao_por_setor' => $evolucao_por_setor
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}

// ========================================================================
// FUNÇÕES AUXILIARES
// ========================================================================

/**
 * Agrupa TOP 4 + OUTROS
 */
function agruparTop4Outros($data, $label_field, $value_field) {
    if (count($data) <= 5) {
        // Converter valores para float
        foreach ($data as &$item) {
            $item[$value_field] = (float) $item[$value_field];
        }
        return $data;
    }

    $top4 = array_slice($data, 0, 4);
    $outros = array_slice($data, 4);

    $valor_outros = 0;
    foreach ($outros as $item) {
        $valor_outros += (float) $item[$value_field];
    }

    // Converter valores para float nos top4
    foreach ($top4 as &$item) {
        $item[$value_field] = (float) $item[$value_field];
    }

    $top4[] = [
        $label_field => 'OUTROS',
        $value_field => $valor_outros
    ];

    return $top4;
}

/**
 * Calcula evolução temporal por dimensão (fornecedor, item, unidade, etc)
 */
function calcularEvolucaoPorDimensao($domain, $where_clause, $params, $tipo, $label_sql, $group_sql, $join_sql, $g_sql, $limit = 3, $agrupar_por_dia = false, $precisa_join_item = false) {
    // PASSO 1: Identificar TOP N
    if ($precisa_join_item) {
        $query_top = "
            SELECT 
                {$group_sql} as id,
                {$label_sql} as label,
                COALESCE(SUM(p.vlr_total), 0) as valor
            FROM 
                {$domain}_pedido p
                INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
                " . ($join_sql ? "LEFT JOIN {$join_sql}" : "") . "
            WHERE 
                {$where_clause}
            GROUP BY 
                {$group_sql}, {$label_sql}
            ORDER BY 
                valor DESC
            LIMIT {$limit}
        ";
    } else {
        $query_top = "
            SELECT 
                {$group_sql} as id,
                {$label_sql} as label,
                COALESCE(SUM(p.vlr_total), 0) as valor
            FROM 
                {$domain}_pedido p
                " . ($join_sql ? "LEFT JOIN {$join_sql}" : "") . "
            WHERE 
                {$where_clause}
            GROUP BY 
                {$group_sql}, {$label_sql}
            ORDER BY 
                valor DESC
            LIMIT {$limit}
        ";
    }

    $result_top = sql($query_top, $params, $g_sql);
    $top_items = pg_fetch_all($result_top) ?: [];
    
    if (empty($top_items)) {
        return ['periodos' => [], 'series' => []];
    }

    // PASSO 2: Buscar evolução de cada um dos TOP
    $ids = array_column($top_items, 'id');
    
    // Construir placeholders dinâmicos para prepared statements
    $param_count = count($params);
    $placeholders = [];
    for ($i = 0; $i < count($ids); $i++) {
        $placeholders[] = '$' . ($param_count + $i + 1);
    }
    $placeholders_str = implode(',', $placeholders);

    if ($precisa_join_item) {
        if ($agrupar_por_dia) {
            $query_evolucao = "
                SELECT 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM-DD') as periodo,
                    TO_CHAR(p.data_inclusao, 'DD/MM') as periodo_label,
                    {$group_sql} as id,
                    {$label_sql} as label,
                    COALESCE(SUM(p.vlr_total), 0) as valor
                FROM 
                    {$domain}_pedido p
                    INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
                    " . ($join_sql ? "LEFT JOIN {$join_sql}" : "") . "
                WHERE 
                    {$where_clause}
                    AND {$group_sql} IN ({$placeholders_str})
                GROUP BY 
                    periodo, periodo_label, {$group_sql}, {$label_sql}
                ORDER BY 
                    periodo, label
            ";
        } else {
            $query_evolucao = "
                SELECT 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM') as periodo,
                    TO_CHAR(p.data_inclusao, 'Mon/YY') as periodo_label,
                    {$group_sql} as id,
                    {$label_sql} as label,
                    COALESCE(SUM(p.vlr_total), 0) as valor
                FROM 
                    {$domain}_pedido p
                    INNER JOIN {$domain}_pedido_item pi ON p.seq_pedido = pi.seq_pedido
                    " . ($join_sql ? "LEFT JOIN {$join_sql}" : "") . "
                WHERE 
                    {$where_clause}
                    AND {$group_sql} IN ({$placeholders_str})
                GROUP BY 
                    periodo, periodo_label, {$group_sql}, {$label_sql}
                ORDER BY 
                    periodo, label
            ";
        }
    } else {
        if ($agrupar_por_dia) {
            $query_evolucao = "
                SELECT 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM-DD') as periodo,
                    TO_CHAR(p.data_inclusao, 'DD/MM') as periodo_label,
                    {$group_sql} as id,
                    {$label_sql} as label,
                    COALESCE(SUM(p.vlr_total), 0) as valor
                FROM 
                    {$domain}_pedido p
                    " . ($join_sql ? "LEFT JOIN {$join_sql}" : "") . "
                WHERE 
                    {$where_clause}
                    AND {$group_sql} IN ({$placeholders_str})
                GROUP BY 
                    periodo, periodo_label, {$group_sql}, {$label_sql}
                ORDER BY 
                    periodo, label
            ";
        } else {
            $query_evolucao = "
                SELECT 
                    TO_CHAR(p.data_inclusao, 'YYYY-MM') as periodo,
                    TO_CHAR(p.data_inclusao, 'Mon/YY') as periodo_label,
                    {$group_sql} as id,
                    {$label_sql} as label,
                    COALESCE(SUM(p.vlr_total), 0) as valor
                FROM 
                    {$domain}_pedido p
                    " . ($join_sql ? "LEFT JOIN {$join_sql}" : "") . "
                WHERE 
                    {$where_clause}
                    AND {$group_sql} IN ({$placeholders_str})
                GROUP BY 
                    periodo, periodo_label, {$group_sql}, {$label_sql}
                ORDER BY 
                    periodo, label
            ";
        }
    }

    $params_evolucao = array_merge($params, $ids);
    $result_evolucao = sql($query_evolucao, $params_evolucao, $g_sql);
    $evolucao_raw = pg_fetch_all($result_evolucao) ?: [];

    // PASSO 3: Formatar para estrutura esperada pelo frontend
    $periodos = array_values(array_unique(array_column($evolucao_raw, 'periodo_label')));
    
    $series = [];
    foreach ($top_items as $item) {
        $label = $item['label'];
        $series[$label] = array_fill_keys($periodos, 0);
    }

    foreach ($evolucao_raw as $row) {
        $label = $row['label'];
        $periodo = $row['periodo_label'];
        $valor = (float) $row['valor'];

        if (isset($series[$label][$periodo])) {
            $series[$label][$periodo] = $valor;
        }
    }

    // Converter series para array de objetos
    $series_formatted = [];
    foreach ($series as $label => $valores) {
        $series_formatted[] = [
            'label' => $label,
            'data' => array_values($valores)
        ];
    }

    return [
        'periodos' => $periodos,
        'series' => $series_formatted
    ];
}

/**
 * Calcula evolução temporal por centro de custo
 */
function calcularEvolucaoPorCentroCusto($domain, $where_clause, $params, $g_sql, $limit = 3, $agrupar_por_dia = false) {
    // PASSO 1: Identificar TOP N
    $query_top = "
        SELECT 
            oc.seq_centro_custo as id,
            COALESCE(cc.descricao, 'SEM CENTRO DE CUSTO') as label,
            COALESCE(SUM(i.vlr_item), 0) as valor
        FROM 
            {$domain}_ordem_compra oc
            INNER JOIN {$domain}_ordem_compra_item oci ON oc.seq_ordem_compra = oci.seq_ordem_compra
            INNER JOIN {$domain}_item i ON oci.seq_item = i.seq_item
            LEFT JOIN {$domain}_centro_custo cc ON oc.seq_centro_custo = cc.seq_centro_custo
        WHERE 
            {$where_clause}
        GROUP BY 
            oc.seq_centro_custo, cc.descricao
        ORDER BY 
            valor DESC
        LIMIT {$limit}
    ";

    $result_top = sql($query_top, $params, $g_sql);
    $top_items = pg_fetch_all($result_top) ?: [];
    
    if (empty($top_items)) {
        return ['periodos' => [], 'series' => []];
    }

    // PASSO 2: Buscar evolução de cada um dos TOP
    $ids = array_column($top_items, 'id');
    
    // Construir placeholders dinâmicos para prepared statements
    $param_count = count($params);
    $placeholders = [];
    for ($i = 0; $i < count($ids); $i++) {
        $placeholders[] = '$' . ($param_count + $i + 1);
    }
    $placeholders_str = implode(',', $placeholders);

    if ($agrupar_por_dia) {
        $query_evolucao = "
            SELECT 
                TO_CHAR(oc.data_inclusao, 'YYYY-MM-DD') as periodo,
                TO_CHAR(oc.data_inclusao, 'DD/MM') as periodo_label,
                oc.seq_centro_custo as id,
                COALESCE(cc.descricao, 'SEM CENTRO DE CUSTO') as label,
                COALESCE(SUM(i.vlr_item), 0) as valor
            FROM 
                {$domain}_ordem_compra oc
                INNER JOIN {$domain}_ordem_compra_item oci ON oc.seq_ordem_compra = oci.seq_ordem_compra
                INNER JOIN {$domain}_item i ON oci.seq_item = i.seq_item
                LEFT JOIN {$domain}_centro_custo cc ON oc.seq_centro_custo = cc.seq_centro_custo
            WHERE 
                {$where_clause}
                AND oc.seq_centro_custo IN ({$placeholders_str})
            GROUP BY 
                periodo, periodo_label, oc.seq_centro_custo, cc.descricao
            ORDER BY 
                periodo, label
        ";
    } else {
        $query_evolucao = "
            SELECT 
                TO_CHAR(oc.data_inclusao, 'YYYY-MM') as periodo,
                TO_CHAR(oc.data_inclusao, 'Mon/YY') as periodo_label,
                oc.seq_centro_custo as id,
                COALESCE(cc.descricao, 'SEM CENTRO DE CUSTO') as label,
                COALESCE(SUM(i.vlr_item), 0) as valor
            FROM 
                {$domain}_ordem_compra oc
                INNER JOIN {$domain}_ordem_compra_item oci ON oc.seq_ordem_compra = oci.seq_ordem_compra
                INNER JOIN {$domain}_item i ON oci.seq_item = i.seq_item
                LEFT JOIN {$domain}_centro_custo cc ON oc.seq_centro_custo = cc.seq_centro_custo
            WHERE 
                {$where_clause}
                AND oc.seq_centro_custo IN ({$placeholders_str})
            GROUP BY 
                periodo, periodo_label, oc.seq_centro_custo, cc.descricao
            ORDER BY 
                periodo, label
        ";
    }

    $params_evolucao = array_merge($params, $ids);
    $result_evolucao = sql($query_evolucao, $params_evolucao, $g_sql);
    $evolucao_raw = pg_fetch_all($result_evolucao) ?: [];

    // PASSO 3: Formatar para estrutura esperada pelo frontend
    $periodos = array_values(array_unique(array_column($evolucao_raw, 'periodo_label')));
    
    $series = [];
    foreach ($top_items as $item) {
        $label = $item['label'];
        $series[$label] = array_fill_keys($periodos, 0);
    }

    foreach ($evolucao_raw as $row) {
        $label = $row['label'];
        $periodo = $row['periodo_label'];
        $valor = (float) $row['valor'];

        if (isset($series[$label][$periodo])) {
            $series[$label][$periodo] = $valor;
        }
    }

    // Converter series para array de objetos
    $series_formatted = [];
    foreach ($series as $label => $valores) {
        $series_formatted[] = [
            'label' => $label,
            'data' => array_values($valores)
        ];
    }

    return [
        'periodos' => $periodos,
        'series' => $series_formatted
    ];
}

/**
 * Calcula evolução temporal por setor
 */
function calcularEvolucaoPorSetor($domain, $where_clause, $params, $g_sql, $limit = 3, $agrupar_por_dia = false) {
    // PASSO 1: Identificar TOP N
    $query_top = "
        SELECT 
            oc.nro_setor as id,
            COALESCE(s.descricao, 'SEM SETOR') as label,
            COALESCE(SUM(i.vlr_item), 0) as valor
        FROM 
            {$domain}_ordem_compra oc
            INNER JOIN {$domain}_ordem_compra_item oci ON oc.seq_ordem_compra = oci.seq_ordem_compra
            INNER JOIN {$domain}_item i ON oci.seq_item = i.seq_item
            LEFT JOIN {$domain}_setores s ON oc.nro_setor = s.nro_setor
        WHERE 
            {$where_clause}
        GROUP BY 
            oc.nro_setor, s.descricao
        ORDER BY 
            valor DESC
        LIMIT {$limit}
    ";

    $result_top = sql($query_top, $params, $g_sql);
    $top_items = pg_fetch_all($result_top) ?: [];
    
    if (empty($top_items)) {
        return ['periodos' => [], 'series' => []];
    }

    // PASSO 2: Buscar evolução de cada um dos TOP
    $ids = array_column($top_items, 'id');
    
    // Construir placeholders dinâmicos para prepared statements
    $param_count = count($params);
    $placeholders = [];
    for ($i = 0; $i < count($ids); $i++) {
        $placeholders[] = '$' . ($param_count + $i + 1);
    }
    $placeholders_str = implode(',', $placeholders);

    if ($agrupar_por_dia) {
        $query_evolucao = "
            SELECT 
                TO_CHAR(oc.data_inclusao, 'YYYY-MM-DD') as periodo,
                TO_CHAR(oc.data_inclusao, 'DD/MM') as periodo_label,
                oc.nro_setor as id,
                COALESCE(s.descricao, 'SEM SETOR') as label,
                COALESCE(SUM(i.vlr_item), 0) as valor
            FROM 
                {$domain}_ordem_compra oc
                INNER JOIN {$domain}_ordem_compra_item oci ON oc.seq_ordem_compra = oci.seq_ordem_compra
                INNER JOIN {$domain}_item i ON oci.seq_item = i.seq_item
                LEFT JOIN {$domain}_setores s ON oc.nro_setor = s.nro_setor
            WHERE 
                {$where_clause}
                AND oc.nro_setor IN ({$placeholders_str})
            GROUP BY 
                periodo, periodo_label, oc.nro_setor, s.descricao
            ORDER BY 
                periodo, label
        ";
    } else {
        $query_evolucao = "
            SELECT 
                TO_CHAR(oc.data_inclusao, 'YYYY-MM') as periodo,
                TO_CHAR(oc.data_inclusao, 'Mon/YY') as periodo_label,
                oc.nro_setor as id,
                COALESCE(s.descricao, 'SEM SETOR') as label,
                COALESCE(SUM(i.vlr_item), 0) as valor
            FROM 
                {$domain}_ordem_compra oc
                INNER JOIN {$domain}_ordem_compra_item oci ON oc.seq_ordem_compra = oci.seq_ordem_compra
                INNER JOIN {$domain}_item i ON oci.seq_item = i.seq_item
                LEFT JOIN {$domain}_setores s ON oc.nro_setor = s.nro_setor
            WHERE 
                {$where_clause}
                AND oc.nro_setor IN ({$placeholders_str})
            GROUP BY 
                periodo, periodo_label, oc.nro_setor, s.descricao
            ORDER BY 
                periodo, label
        ";
    }

    $params_evolucao = array_merge($params, $ids);
    $result_evolucao = sql($query_evolucao, $params_evolucao, $g_sql);
    $evolucao_raw = pg_fetch_all($result_evolucao) ?: [];

    // PASSO 3: Formatar para estrutura esperada pelo frontend
    $periodos = array_values(array_unique(array_column($evolucao_raw, 'periodo_label')));
    
    $series = [];
    foreach ($top_items as $item) {
        $label = $item['label'];
        $series[$label] = array_fill_keys($periodos, 0);
    }

    foreach ($evolucao_raw as $row) {
        $label = $row['label'];
        $periodo = $row['periodo_label'];
        $valor = (float) $row['valor'];

        if (isset($series[$label][$periodo])) {
            $series[$label][$periodo] = $valor;
        }
    }

    // Converter series para array de objetos
    $series_formatted = [];
    foreach ($series as $label => $valores) {
        $series_formatted[] = [
            'label' => $label,
            'data' => array_values($valores)
        ];
    }

    return [
        'periodos' => $periodos,
        'series' => $series_formatted
    ];
}