<?php
/**
 * ================================================================
 * API: EXPORTAÇÃO DE DESPESAS (CSV)
 * ================================================================
 * Exporta os dados detalhados de despesas em formato CSV
 * Requer autenticação via token
 *
 * POST /api/dashboards/dre/export_despesas.php
 * Body: { period, viewMode }
 * Response: arquivo CSV para download
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';

// ================================================================
// CONFIGURAÇÃO INICIAL
// ================================================================
handleOptionsRequest();
validateRequestMethod('POST');

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
$period = processPeriod($input['period'] ?? []);
$viewMode = $input['viewMode'] ?? 'GERAL';
$groupBy = $input['groupBy'] ?? 'EVENTOS'; // ✅ NOVO: 'EVENTOS' ou 'GRUPOS'
$category = $input['category'] ?? null;    // ✅ NOVO: Filtro por categoria específica
$unit = $input['unit'] ?? null;            // ✅ NOVO: Filtro por unidade específica

// ================================================================
// BUSCAR MODALIDADE DO DOMÍNIO
// ================================================================
$dominio = $auth['domain'];
$g_sql = connect();

$modalidadeQuery = "SELECT modalidade FROM domains WHERE domain = '$dominio' LIMIT 1";
$modalidadeResult = sql($g_sql, $modalidadeQuery);

$isMista = false;
if ($modalidadeResult && pg_num_rows($modalidadeResult) > 0) {
    $domainData = pg_fetch_assoc($modalidadeResult);
    $isMista = ($domainData['modalidade'] === 'MISTA');
}

// ================================================================
// BUSCAR DADOS DO BANCO
// ================================================================

// ✅ NOVO: Se agrupar por GRUPOS, adicionar join e select do grupo
$selectGrupo = "";
$joinGrupo = "";
if ($groupBy === 'GRUPOS') {
    $selectGrupo = " eg.descricao AS grupo_descricao, "; // ✅ CORRIGIDO: Vírgula no final, não no início
    $joinGrupo = " LEFT JOIN $dominio" . "_grupo_evento eg ON e.grupo = eg.grupo ";
}

$query = "SELECT d.nro_lancto, d.nro_parcela, " .
               " TO_CHAR(d.data_inclusao, 'DD/MM/YYYY') AS data_inclusao, " .
               " d.sigla_unidade, d.evento, e.descricao AS evento_descricao, " .
               $selectGrupo . // ✅ CORRIGIDO: Agora não gera vírgula dupla
               " CASE " .
               "   WHEN COALESCE(e.tipo, 'N') = 'N' THEN 'Normal' " .
               "   WHEN COALESCE(e.tipo, 'N') = 'I' THEN 'Impostos' " .
               "   WHEN COALESCE(e.tipo, 'N') = 'D' THEN 'Depreciação' " .
               "   WHEN COALESCE(e.tipo, 'N') = 'F' THEN 'Despesas Financeiras' " .
               "   ELSE 'Normal' " .
               " END AS evento_tipo, " .
               " d.fornecedor, d.nro_nf, d.vlr_parcela, " .
               " TO_CHAR(d.data_vcto, 'DD/MM/YYYY') AS data_vcto, " .
               " TO_CHAR(d.data_pgto, 'DD/MM/YYYY') AS data_pgto, " .
               " d.historico, " .
               " CASE " .
               "   WHEN d.status = 'A' THEN 'Aberto' " .
               "   WHEN d.status = 'P' THEN 'Pago' " .
               "   WHEN d.status = 'C' THEN 'Cancelado' " .
               "   ELSE d.status " .
               " END AS status, " .
               " d.perc_cargas, d.perc_passagens " .
          " FROM $dominio" . "_despesa d " .
          " LEFT JOIN $dominio" . "_evento e ON d.evento = e.evento " .
          $joinGrupo . // ✅ NOVO: Join com grupo se necessário
         " WHERE d.status <> 'C' " .
           " AND d.data_vcto BETWEEN $1 AND $2 ";

// ✅ NOVO: Adicionar filtros baseados em viewMode
$params = [$period['startDate'], $period['endDate']];
$paramIndex = 3;

// Filtro por categoria (evento ou grupo)
if ($category) {
    if ($groupBy === 'EVENTOS') {
        // Filtrar por descrição do evento (UPPER case)
        $query .= " AND UPPER(e.descricao) = $" . $paramIndex;
        $params[] = strtoupper($category);
        $paramIndex++;
    } else {
        // Filtrar por descrição do grupo (UPPER case)
        $query .= " AND UPPER(eg.descricao) = $" . $paramIndex;
        $params[] = strtoupper($category);
        $paramIndex++;
    }
}

// Filtro por viewMode (CARGAS/PASSAGEIROS) - Apenas para empresas MISTAS
if ($isMista && $viewMode !== 'GERAL') {
    if ($viewMode === 'CARGAS') {
        $query .= " AND d.perc_cargas > 0 ";
    } elseif ($viewMode === 'PASSAGEIROS') {
        $query .= " AND d.perc_passagens > 0 ";
    }
}

// Filtro por unidade
if ($unit) {
    $query .= " AND d.sigla_unidade = $" . $paramIndex;
    $params[] = $unit;
    $paramIndex++;
}

$query .= " ORDER BY d.data_vcto, d.nro_lancto, d.nro_parcela";

$result = sql($g_sql, $query, false, $params);

if (pg_num_rows($result) == 0)
  msg('Nenhuma despesa encontrada.', 'error');

$filename = "despesas_$domain" . time() . ".csv";
$csv = initCSVExport($filename);

// ✅ Cabeçalho condicional para grupos e empresas MISTAS
$headerColumns = ['Lançamento', 'Parcela', 'Data Inclusão', 'Unidade',
                  'Cód. Evento', 'Descrição Evento'];

// ✅ NOVO: Adicionar coluna Grupo se agrupar por GRUPOS
if ($groupBy === 'GRUPOS') {
    $headerColumns[] = 'Grupo';
}

$headerColumns = array_merge($headerColumns, ['Tipo Evento', 'Fornecedor', 'NF', 'Valor', 
                                              'Data Vencimento', 'Data Pagamento', 'Status']);

if ($isMista) {
    $headerColumns[] = '% Cargas';
    $headerColumns[] = '% Passagens';
}

$headerColumns[] = 'Histórico';

writeCSVRow($csv, $headerColumns);

// Dados
while ($row = pg_fetch_array($result)) {
    $dataColumns = [$row['nro_lancto'], $row['nro_parcela'], $row['data_inclusao'],
                    $row['sigla_unidade'], $row['evento'], $row['evento_descricao']];
    
    // ✅ NOVO: Adicionar coluna Grupo se agrupar por GRUPOS
    if ($groupBy === 'GRUPOS') {
        $dataColumns[] = $row['grupo_descricao'] ?? '';
    }
    
    $dataColumns = array_merge($dataColumns, [$row['evento_tipo'], $row['fornecedor'], 
                               $row['nro_nf'], $row['vlr_parcela'], $row['data_vcto'], 
                               $row['data_pgto'], $row['status']]);
    
    if ($isMista) {
        $dataColumns[] = $row['perc_cargas'];
        $dataColumns[] = $row['perc_passagens'];
    }
    
    $dataColumns[] = $row['historico'];
    
    writeCSVRow($csv, $dataColumns);
}

finishCSVExport($csv);