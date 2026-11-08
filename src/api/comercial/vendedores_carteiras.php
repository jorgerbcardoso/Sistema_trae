<?php
/**
 * ============================================
 * API: COMERCIAL - VENDEDORES E CARTEIRAS
 * ============================================
 * Tabelas:
 * - [dominio]_vendedor          (login, nome, tele_vendas)
 * - [dominio]_vendedor_cliente  (login, cnpj, status, data_status,
 *                                perc_conquista, data_ini_conquista, data_fin_conquista,
 *                                perc_manutencao, data_ini_manutencao, data_fin_manutencao,
 *                                perc_manutencao2, data_ini_manutencao2, data_fin_manutencao2)
 * - [dominio]_cliente           (cnpj, nome, seq_cidade, data_ult_mvto)
 *
 * GET
 * - (padrão)                       → lista vendedores + totais por status
 * - ?action=clientes&login=xxx     → clientes da carteira do vendedor (com status e comissão)
 * - ?action=buscar_cliente&q=xxx   → busca cliente(s) e seus vendedores
 * - ?action=exportar               → CSV (vendedores + clientes + status + comissão)
 *
 * POST (JSON)
 * - { action: 'update_status', login, cnpj, status }
 * - { action: 'update_comissao', login, cnpj, perc_*, data_ini_*, data_fin_* }
 * - { action: 'update_tele_venda', login, tele_venda }
 * - { action: 'importar' }
 *
 * Status do vínculo vendedor x cliente:
 *   C = CONQUISTA | D = CADASTRADO | P = EM PROSPECÇÃO | N = EM NEGOCIAÇÃO
 *
 * Comissão: períodos (Conquista, Manutenção, Manutenção 2), cada um com
 * percentual + data inicial + data final. Mínimo de 1 período preenchido.
 * ============================================
 */

set_time_limit(0);
ini_set('max_execution_time', '0');
ini_set('memory_limit', '512M');

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../lib/ssw_loader.php';

setupCORS();
handleOptionsRequest();
requireAuth();

$currentUser = getCurrentUser();
$dominio = strtolower($currentUser['domain']);
$prefix  = $dominio . '_';

global $g_sql;
$g_sql = getDBConnection();

if (!$g_sql) {
    msg('Erro ao conectar ao banco de dados', 'error', 500);
}

$tblVendedor        = $prefix . 'vendedor';
$tblVendedorCliente = $prefix . 'vendedor_cliente';
$tblCliente         = $prefix . 'cliente';

$STATUS = [
    'C' => 'CONQUISTA',
    'D' => 'CADASTRADO',
    'P' => 'EM PROSPECÇÃO',
    'N' => 'EM NEGOCIAÇÃO',
];

// ============================================
// HELPERS
// ============================================

function crmTabelaExiste(string $tabela): bool {
    $r = sql(
        "SELECT 1 FROM information_schema.tables WHERE table_name = $1 LIMIT 1",
        [$tabela]
    );
    return $r && pg_num_rows($r) > 0;
}

function crmColunaExiste(string $tabela, string $coluna): bool {
    $r = sql(
        "SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2 LIMIT 1",
        [$tabela, $coluna]
    );
    return $r && pg_num_rows($r) > 0;
}

/**
 * Garante as colunas de status/data_status na tabela de vínculo (multi-domínio).
 */
function crmGarantirColunasStatus(string $tabela): void {
    if (!crmColunaExiste($tabela, 'status')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN status VARCHAR(1)");
    }
    if (!crmColunaExiste($tabela, 'data_status')) {
        sql("ALTER TABLE {$tabela} ADD COLUMN data_status DATE");
    }
}

/**
 * Garante as colunas de comissão (períodos + percentuais) na tabela de vínculo.
 */
function crmGarantirColunasComissao(string $tabela): void {
    $colunas = [
        'perc_conquista'       => 'NUMERIC',
        'data_ini_conquista'   => 'DATE',
        'data_fin_conquista'   => 'DATE',
        'perc_manutencao'      => 'NUMERIC',
        'data_ini_manutencao'  => 'DATE',
        'data_fin_manutencao'  => 'DATE',
        'perc_manutencao2'     => 'NUMERIC',
        'data_ini_manutencao2' => 'DATE',
        'data_fin_manutencao2' => 'DATE',
    ];

    foreach ($colunas as $coluna => $tipo) {
        if (!crmColunaExiste($tabela, $coluna)) {
            sql("ALTER TABLE {$tabela} ADD COLUMN {$coluna} {$tipo}");
        }
    }
}

function crmNormalizarPercentual($valor): ?float {
    if ($valor === null) {
        return null;
    }
    if (is_string($valor)) {
        $valor = trim($valor);
        if ($valor === '') {
            return null;
        }
        $valor = str_replace(',', '.', $valor);
    }
    if (!is_numeric($valor)) {
        msg('Percentual de comissão inválido.', 'error', 400);
    }
    $num = (float) $valor;
    if ($num < 0 || $num > 100) {
        msg('O percentual de comissão deve estar entre 0 e 100.', 'error', 400);
    }
    return round($num, 2);
}

function crmNormalizarData($valor): ?string {
    if ($valor === null) {
        return null;
    }
    $valor = trim((string) $valor);
    if ($valor === '') {
        return null;
    }
    $dt = DateTime::createFromFormat('Y-m-d', $valor);
    if (!$dt || $dt->format('Y-m-d') !== $valor) {
        msg('Data inválida: ' . $valor, 'error', 400);
    }
    return $valor;
}

function crmFormatarCnpj(?string $cnpj): string {
    $n = preg_replace('/[^0-9]/', '', (string)$cnpj);
    if (strlen($n) !== 14) return (string)$cnpj;
    return substr($n, 0, 2) . '.' . substr($n, 2, 3) . '.' . substr($n, 5, 3)
         . '/' . substr($n, 8, 4) . '-' . substr($n, 12, 2);
}

function crmFormatarData(?string $data): string {
    if (!$data) return '';
    $ts = strtotime($data);
    return $ts ? date('d/m/Y', $ts) : '';
}

function crmFormatarPercentual($valor): string {
    if ($valor === null || $valor === '') {
        return '';
    }
    return number_format((float) $valor, 2, ',', '');
}

function crmDataIso($valor): ?string {
    if ($valor === null || $valor === '') {
        return null;
    }
    return (string) $valor;
}

function crmPercentualNum($valor): ?float {
    if ($valor === null || $valor === '') {
        return null;
    }
    return (float) $valor;
}

// ============================================
// ROTEAMENTO
// ============================================

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    if (!crmTabelaExiste($tblVendedor)) {
        msg('Tabela de vendedores não encontrada para este domínio.', 'error');
    }
    crmGarantirColunasStatus($tblVendedorCliente);
    crmGarantirColunasComissao($tblVendedorCliente);

    if ($method === 'GET') {
        switch ($action) {
            case 'clientes':
                crmListarClientesVendedor($tblVendedor, $tblVendedorCliente, $tblCliente, $STATUS);
                break;
            case 'buscar_cliente':
                crmBuscarCliente($tblVendedor, $tblVendedorCliente, $tblCliente, $STATUS);
                break;
            case 'exportar':
                crmExportarCsv($tblVendedor, $tblVendedorCliente, $tblCliente, $STATUS);
                break;
            default:
                crmListarVendedores($tblVendedor, $tblVendedorCliente, $STATUS);
                break;
        }
        exit;
    }

    if ($method === 'POST') {
        $data = getRequestInput();
        $postAction = $data['action'] ?? '';

        if ($postAction === 'update_status') {
            crmAtualizarStatus($tblVendedorCliente, $data, $STATUS);
        } elseif ($postAction === 'update_comissao') {
            crmAtualizarComissao($tblVendedorCliente, $data);
        } elseif ($postAction === 'update_tele_venda') {
            crmAtualizarTeleVenda($tblVendedor, $data);
        } elseif ($postAction === 'importar') {
            crmImportar();
        } else {
            msg('Ação não especificada', 'error', 400);
        }
        exit;
    }

    msg('Método não permitido', 'error', 405);

} catch (Throwable $e) {
    error_log("❌ ERRO em comercial/vendedores_carteiras.php: " . $e->getMessage()
        . " | " . $e->getFile() . ":" . $e->getLine());
    msg('Erro interno do servidor', 'error', 500);
}

// ============================================
// AÇÕES
// ============================================

/**
 * Lista os vendedores com a quantidade de clientes na carteira e os totais por status.
 */
function crmListarVendedores(string $tblVendedor, string $tblVendedorCliente, array $STATUS): void {
    $colStatus = crmColunaExiste($tblVendedorCliente, 'status') ? 'vc.status' : "''::varchar";

    $query = "
        SELECT
            v.login,
            v.nome,
            v.tele_vendas,
            COUNT(DISTINCT vc.cnpj)::int AS qtd_clientes,
            COUNT(DISTINCT CASE WHEN {$colStatus} = 'C' THEN vc.cnpj END)::int AS qtd_conquista,
            COUNT(DISTINCT CASE WHEN {$colStatus} = 'N' THEN vc.cnpj END)::int AS qtd_negociacao,
            COUNT(DISTINCT CASE WHEN {$colStatus} = 'P' THEN vc.cnpj END)::int AS qtd_prospeccao,
            COUNT(DISTINCT CASE WHEN {$colStatus} = 'D' OR {$colStatus} IS NULL OR {$colStatus} = '' THEN vc.cnpj END)::int AS qtd_cadastrado
        FROM {$tblVendedor} v
        LEFT JOIN {$tblVendedorCliente} vc ON LOWER(vc.login) = LOWER(v.login)
        GROUP BY v.login, v.nome, v.tele_vendas
        ORDER BY v.nome
    ";

    $result = sql($query, []);
    if (!$result) {
        msg('Erro ao buscar vendedores', 'error', 500);
    }

    $vendedores = [];
    $totais = [
        'vendedores'   => 0,
        'clientes'     => 0,
        'conquista'    => 0,
        'negociacao'   => 0,
        'prospeccao'   => 0,
        'cadastrado'   => 0,
    ];

    while ($row = pg_fetch_assoc($result)) {
        $item = [
            'login'          => $row['login'],
            'nome'           => $row['nome'],
            'tele_venda'     => pgBoolToPHP($row['tele_vendas']),
            'qtd_clientes'   => (int)$row['qtd_clientes'],
            'qtd_conquista'  => (int)$row['qtd_conquista'],
            'qtd_negociacao' => (int)$row['qtd_negociacao'],
            'qtd_prospeccao' => (int)$row['qtd_prospeccao'],
            'qtd_cadastrado' => (int)$row['qtd_cadastrado'],
        ];
        $vendedores[] = $item;

        $totais['vendedores']++;
        $totais['clientes']     += $item['qtd_clientes'];
        $totais['conquista']    += $item['qtd_conquista'];
        $totais['negociacao']   += $item['qtd_negociacao'];
        $totais['prospeccao']   += $item['qtd_prospeccao'];
        $totais['cadastrado']   += $item['qtd_cadastrado'];
    }

    echo json_encode([
        'success'    => true,
        'vendedores' => $vendedores,
        'totais'     => $totais,
        'status'     => $STATUS,
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Lista os clientes da carteira de um vendedor, com status e data do status.
 */
function crmListarClientesVendedor(string $tblVendedor, string $tblVendedorCliente, string $tblCliente, array $STATUS): void {
    $login = trim((string)($_GET['login'] ?? ''));
    if ($login === '') {
        msg('Vendedor não informado', 'error', 400);
    }

    $colStatus     = crmColunaExiste($tblVendedorCliente, 'status')      ? 'vc.status'      : "''::varchar";
    $colDataStatus = crmColunaExiste($tblVendedorCliente, 'data_status') ? 'vc.data_status' : 'NULL::date';

    $query = "
        SELECT
            c.cnpj,
            c.nome,
            COALESCE(cid.nome, '') AS cidade,
            COALESCE(cid.uf, '')   AS uf,
            c.data_ult_mvto,
            {$colStatus}     AS status,
            {$colDataStatus} AS data_status,
            vc.perc_conquista,
            vc.data_ini_conquista,
            vc.data_fin_conquista,
            vc.perc_manutencao,
            vc.data_ini_manutencao,
            vc.data_fin_manutencao,
            vc.perc_manutencao2,
            vc.data_ini_manutencao2,
            vc.data_fin_manutencao2
        FROM {$tblVendedorCliente} vc
        INNER JOIN {$tblCliente} c ON c.cnpj = vc.cnpj
        LEFT JOIN cidade cid ON cid.seq_cidade = c.seq_cidade
        WHERE LOWER(vc.login) = LOWER($1)
        ORDER BY c.nome
    ";

    $result = sql($query, [$login]);
    if (!$result) {
        msg('Erro ao buscar clientes', 'error', 500);
    }

    $clientes = [];
    $totais = ['total' => 0, 'C' => 0, 'D' => 0, 'P' => 0, 'N' => 0];

    while ($row = pg_fetch_assoc($result)) {
        $status = trim((string)$row['status']);
        if ($status === '' || !isset($STATUS[$status])) {
            $status = 'D';
        }

        $clientes[] = [
            'cnpj'           => $row['cnpj'],
            'cnpj_fmt'       => crmFormatarCnpj($row['cnpj']),
            'nome'           => $row['nome'],
            'cidade'         => $row['cidade'],
            'uf'             => $row['uf'],
            'data_ult_mvto'  => crmFormatarData($row['data_ult_mvto']),
            'status'         => $status,
            'status_label'   => $STATUS[$status],
            'data_status'    => crmFormatarData($row['data_status']),

            'perc_conquista'       => crmPercentualNum($row['perc_conquista']),
            'data_ini_conquista'   => crmDataIso($row['data_ini_conquista']),
            'data_fin_conquista'   => crmDataIso($row['data_fin_conquista']),
            'perc_manutencao'      => crmPercentualNum($row['perc_manutencao']),
            'data_ini_manutencao'  => crmDataIso($row['data_ini_manutencao']),
            'data_fin_manutencao'  => crmDataIso($row['data_fin_manutencao']),
            'perc_manutencao2'     => crmPercentualNum($row['perc_manutencao2']),
            'data_ini_manutencao2' => crmDataIso($row['data_ini_manutencao2']),
            'data_fin_manutencao2' => crmDataIso($row['data_fin_manutencao2']),
        ];

        $totais['total']++;
        $totais[$status] = ($totais[$status] ?? 0) + 1;
    }

    echo json_encode([
        'success'  => true,
        'clientes' => $clientes,
        'totais'   => $totais,
        'status'   => $STATUS,
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Busca um cliente (por nome ou CNPJ) e retorna o(s) vendedor(es) da sua carteira.
 */
function crmBuscarCliente(string $tblVendedor, string $tblVendedorCliente, string $tblCliente, array $STATUS): void {
    $q = trim((string)($_GET['q'] ?? ''));
    if ($q === '') {
        msg('Informe o nome ou o CNPJ do cliente', 'error', 400);
    }

    $colStatus     = crmColunaExiste($tblVendedorCliente, 'status')      ? 'vc.status'      : "''::varchar";
    $colDataStatus = crmColunaExiste($tblVendedorCliente, 'data_status') ? 'vc.data_status' : 'NULL::date';

    $where  = "c.nome ILIKE $1";
    $params = ['%' . $q . '%'];

    $digitos = preg_replace('/[^0-9]/', '', $q);
    if ($digitos !== '') {
        $where .= " OR regexp_replace(c.cnpj, '[^0-9]', '', 'g') LIKE $2";
        $params[] = '%' . $digitos . '%';
    }

    $query = "
        SELECT
            c.cnpj,
            c.nome,
            COALESCE(cid.nome, '') AS cidade,
            COALESCE(cid.uf, '')   AS uf,
            v.login,
            v.nome AS vendedor_nome,
            v.tele_vendas,
            {$colStatus}     AS status,
            {$colDataStatus} AS data_status
        FROM {$tblVendedorCliente} vc
        INNER JOIN {$tblCliente} c ON c.cnpj = vc.cnpj
        INNER JOIN {$tblVendedor} v ON LOWER(v.login) = LOWER(vc.login)
        LEFT JOIN cidade cid ON cid.seq_cidade = c.seq_cidade
        WHERE {$where}
        ORDER BY c.nome, v.nome
        LIMIT 500
    ";

    $result = sql($query, $params);
    if (!$result) {
        msg('Erro ao buscar cliente', 'error', 500);
    }

    $clientes = [];
    while ($row = pg_fetch_assoc($result)) {
        $cnpj = $row['cnpj'];

        if (!isset($clientes[$cnpj])) {
            $clientes[$cnpj] = [
                'cnpj'     => $cnpj,
                'cnpj_fmt' => crmFormatarCnpj($cnpj),
                'nome'     => $row['nome'],
                'cidade'   => $row['cidade'],
                'uf'       => $row['uf'],
                'vendedores' => [],
            ];
        }

        $status = trim((string)$row['status']);
        if ($status === '' || !isset($STATUS[$status])) {
            $status = 'D';
        }

        $clientes[$cnpj]['vendedores'][] = [
            'login'        => $row['login'],
            'nome'         => $row['vendedor_nome'],
            'tele_venda'   => pgBoolToPHP($row['tele_vendas']),
            'status'       => $status,
            'status_label' => $STATUS[$status],
            'data_status'  => crmFormatarData($row['data_status']),
        ];
    }

    echo json_encode([
        'success'  => true,
        'clientes' => array_values($clientes),
    ], JSON_UNESCAPED_UNICODE);
}

/**
 * Atualiza o status da negociação de um cliente dentro da carteira de um vendedor.
 */
function crmAtualizarStatus(string $tblVendedorCliente, array $data, array $STATUS): void {
    $login  = trim((string)($data['login'] ?? ''));
    $cnpj   = trim((string)($data['cnpj'] ?? ''));
    $status = strtoupper(trim((string)($data['status'] ?? '')));

    if ($login === '' || $cnpj === '') {
        msg('Vendedor e cliente são obrigatórios', 'error', 400);
    }

    if (!isset($STATUS[$status])) {
        msg('Status inválido', 'error', 400);
    }

    $result = sql(
        "UPDATE {$tblVendedorCliente}
            SET status = $1, data_status = CURRENT_DATE
          WHERE LOWER(login) = LOWER($2) AND cnpj = $3",
        [$status, $login, $cnpj]
    );

    if (!$result) {
        msg('Erro ao atualizar o status', 'error', 500);
    }

    if (pg_affected_rows($result) === 0) {
        msg('Vínculo entre vendedor e cliente não encontrado', 'error', 404);
    }

    msg('Status atualizado para ' . $STATUS[$status], 'success');
}

/**
 * Atualiza os períodos e percentuais de comissão do vínculo vendedor x cliente.
 * Regras: mínimo de 1 período; um período usado exige percentual + data inicial + data final.
 */
function crmAtualizarComissao(string $tblVendedorCliente, array $data): void {
    $login = trim((string)($data['login'] ?? ''));
    $cnpj  = trim((string)($data['cnpj'] ?? ''));

    if ($login === '' || $cnpj === '') {
        msg('Vendedor e cliente são obrigatórios', 'error', 400);
    }

    $periodos = [
        ['perc_conquista', 'data_ini_conquista', 'data_fin_conquista', 'Conquista'],
        ['perc_manutencao', 'data_ini_manutencao', 'data_fin_manutencao', 'Manutenção'],
        ['perc_manutencao2', 'data_ini_manutencao2', 'data_fin_manutencao2', 'Manutenção 2'],
    ];

    $valores = [];
    $preenchidos = 0;

    foreach ($periodos as [$campoPerc, $campoIni, $campoFin, $rotulo]) {
        $perc = crmNormalizarPercentual($data[$campoPerc] ?? null);
        $ini  = crmNormalizarData($data[$campoIni] ?? null);
        $fin  = crmNormalizarData($data[$campoFin] ?? null);

        if ($perc !== null || $ini !== null || $fin !== null) {
            if ($perc === null || $ini === null || $fin === null) {
                msg("Preencha o percentual e as datas inicial e final do período {$rotulo}.", 'error', 400);
            }
            if ($ini > $fin) {
                msg("No período {$rotulo}, a data inicial não pode ser posterior à data final.", 'error', 400);
            }
            $preenchidos++;
        }

        $valores[] = $perc;
        $valores[] = $ini;
        $valores[] = $fin;
    }

    if ($preenchidos === 0) {
        msg('Informe ao menos um período de comissão (Conquista, Manutenção ou Manutenção 2).', 'error', 400);
    }

    $result = sql(
        "UPDATE {$tblVendedorCliente}
            SET perc_conquista = $1, data_ini_conquista = $2, data_fin_conquista = $3,
                perc_manutencao = $4, data_ini_manutencao = $5, data_fin_manutencao = $6,
                perc_manutencao2 = $7, data_ini_manutencao2 = $8, data_fin_manutencao2 = $9
          WHERE LOWER(login) = LOWER($10) AND cnpj = $11",
        array_merge($valores, [$login, $cnpj])
    );

    if (!$result) {
        msg('Erro ao salvar a comissão', 'error', 500);
    }

    if (pg_affected_rows($result) === 0) {
        msg('Vínculo entre vendedor e cliente não encontrado', 'error', 404);
    }

    msg('Comissão atualizada com sucesso', 'success');
}

/**
 * Atualiza a configuração de tele-vendas do vendedor.
 */
function crmAtualizarTeleVenda(string $tblVendedor, array $data): void {
    $login = trim((string)($data['login'] ?? ''));
    $teleVenda = filter_var(
        $data['tele_venda'] ?? null,
        FILTER_VALIDATE_BOOLEAN,
        FILTER_NULL_ON_FAILURE
    );

    if ($login === '' || $teleVenda === null) {
        msg('Vendedor e configuração de tele-vendas são obrigatórios', 'error', 400);
    }

    $result = sql(
        "UPDATE {$tblVendedor} SET tele_vendas = $1 WHERE LOWER(login) = LOWER($2)",
        [$teleVenda ? 'true' : 'false', $login]
    );

    if (!$result) {
        msg('Erro ao atualizar tele-vendas', 'error', 500);
    }

    if (pg_affected_rows($result) === 0) {
        msg('Vendedor não encontrado', 'error', 404);
    }

    msg('Configuração de tele-vendas atualizada', 'success');
}

/**
 * Importa vendedores e carteiras do sistema de origem (TMS).
 */
function crmImportar(): void {
    try {
        require_ssw();
    } catch (Throwable $e) {
        msg('Biblioteca de integração não disponível', 'error', 500);
    }

    if (!function_exists('imp_ssw_ven')) {
        msg('Rotina de importação de vendedores não encontrada', 'error', 500);
    }

    ob_start();
    try {
        imp_ssw_ven();
    } catch (Throwable $e) {
        ob_end_clean();
        error_log("❌ ERRO em imp_ssw_ven(): " . $e->getMessage());
        msg('Erro ao importar vendedores e carteiras', 'error', 500);
    }

    $output = ob_get_clean();
    if (!empty($output)) {
        error_log("📊 OUTPUT de imp_ssw_ven():\n" . $output);
    }

    msg('Vendedores e carteiras importados com sucesso!', 'success');
}

/**
 * CSV com todos os vendedores, seus clientes e seus status.
 */
function crmExportarCsv(string $tblVendedor, string $tblVendedorCliente, string $tblCliente, array $STATUS): void {
    $colStatus     = crmColunaExiste($tblVendedorCliente, 'status')      ? 'vc.status'      : "''::varchar";
    $colDataStatus = crmColunaExiste($tblVendedorCliente, 'data_status') ? 'vc.data_status' : 'NULL::date';

    $query = "
        SELECT
            v.login,
            v.nome AS vendedor_nome,
            v.tele_vendas,
            c.cnpj,
            c.nome AS cliente_nome,
            COALESCE(cid.nome, '') AS cidade,
            COALESCE(cid.uf, '')   AS uf,
            {$colStatus}     AS status,
            {$colDataStatus} AS data_status,
            vc.perc_conquista,
            vc.data_ini_conquista,
            vc.data_fin_conquista,
            vc.perc_manutencao,
            vc.data_ini_manutencao,
            vc.data_fin_manutencao,
            vc.perc_manutencao2,
            vc.data_ini_manutencao2,
            vc.data_fin_manutencao2
        FROM {$tblVendedorCliente} vc
        INNER JOIN {$tblVendedor} v ON LOWER(v.login) = LOWER(vc.login)
        INNER JOIN {$tblCliente}  c ON c.cnpj = vc.cnpj
        LEFT JOIN cidade cid ON cid.seq_cidade = c.seq_cidade
        ORDER BY v.nome, c.nome
    ";

    $result = sql($query, []);
    if (!$result) {
        msg('Erro ao gerar a planilha', 'error', 500);
    }

    $csv = initCSVExport('vendedores_carteiras_' . date('Ymd_His') . '.csv');

    writeCSVRow($csv, [
        'VENDEDOR',
        'NOME DO VENDEDOR',
        'TELE-VENDA',
        'CNPJ',
        'CLIENTE',
        'CIDADE',
        'UF',
        'STATUS',
        'DATA DO STATUS',
        'PERC. CONQUISTA',
        'INÍCIO CONQUISTA',
        'FIM CONQUISTA',
        'PERC. MANUTENÇÃO',
        'INÍCIO MANUTENÇÃO',
        'FIM MANUTENÇÃO',
        'PERC. MANUTENÇÃO 2',
        'INÍCIO MANUTENÇÃO 2',
        'FIM MANUTENÇÃO 2',
    ]);

    while ($row = pg_fetch_assoc($result)) {
        $status = trim((string)$row['status']);
        if ($status === '' || !isset($STATUS[$status])) {
            $status = 'D';
        }

        writeCSVRow($csv, [
            $row['login'],
            $row['vendedor_nome'],
            pgBoolToPHP($row['tele_vendas']) ? 'SIM' : 'NÃO',
            crmFormatarCnpj($row['cnpj']),
            $row['cliente_nome'],
            $row['cidade'],
            $row['uf'],
            $status . ' - ' . $STATUS[$status],
            crmFormatarData($row['data_status']),
            crmFormatarPercentual($row['perc_conquista']),
            crmFormatarData($row['data_ini_conquista']),
            crmFormatarData($row['data_fin_conquista']),
            crmFormatarPercentual($row['perc_manutencao']),
            crmFormatarData($row['data_ini_manutencao']),
            crmFormatarData($row['data_fin_manutencao']),
            crmFormatarPercentual($row['perc_manutencao2']),
            crmFormatarData($row['data_ini_manutencao2']),
            crmFormatarData($row['data_fin_manutencao2']),
        ]);
    }

    finishCSVExport($csv);
}
