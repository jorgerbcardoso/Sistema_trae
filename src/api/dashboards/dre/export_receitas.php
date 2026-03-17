<?php
/**
 * ================================================================
 * API: EXPORTAÇÃO DE RECEITAS (CSV)
 * ================================================================
 * Exporta os dados detalhados de receitas em formato CSV
 * Requer autenticação via token
 *
 * POST /api/dashboards/dre/export_receitas.php
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
$unit = $input['unit'] ?? null; // ✅ NOVO: Filtro por unidade

// ================================================================
// BUSCAR DADOS DO BANCO
// ================================================================
$dominio = $auth['domain'];

// ✅ ADICIONAR sigla_emit e sigla_dest no SELECT
$query = "SELECT ser_cte, nro_cte, to_char (data_emissao, 'DD/MM/YY') AS emissao, " .
               " chave_cte, tp_documento, tp_frete, " .
               " $dominio" . "_cte.sigla_emit, $dominio" . "_cte.sigla_dest, " . // ✅ CORRIGIDO: Prefixo da tabela
               " cid_emit.nome||'/'||cid_emit.uf AS cid_emit, " .
               " cid_entr.nome||'/'||cid_entr.uf AS cid_entr, " .
               " cnpj_emit, nome_emit, cnpj_dest, nome_dest, cnpj_pag nome_pag, " .
               " qtde_vol, peso_real, vlr_merc, vlr_frete, vlr_icms " .
          " FROM $dominio" . "_cte, cidade cid_emit, cidade cid_entr " .
         " WHERE $dominio" . "_cte.seq_cidade_emit = cid_emit.seq_cidade " .
           " AND $dominio" . "_cte.seq_cidade_entr = cid_entr.seq_cidade " .
           " AND $dominio" . "_cte.status <> 'C' " .
           " AND $dominio" . "_cte.data_emissao BETWEEN $1 AND $2";

// ✅ NOVO: Adicionar filtro por unidade (CIF emitidos + FOB recebidos)
$params = [$period['startDate'], $period['endDate']];

if ($unit && $unit !== 'Demais') {
    // Receita da unidade = CIF emitidos (sigla_emit) + FOB recebidos (sigla_dest)
    $query .= " AND (($dominio" . "_cte.tp_frete = 'C' AND $dominio" . "_cte.sigla_emit = $3) OR ($dominio" . "_cte.tp_frete = 'F' AND $dominio" . "_cte.sigla_dest = $3))";
    $params[] = $unit;
}

$g_sql = connect();

$result = sql ($g_sql, $query, false, $params);

if (pg_num_rows ($result) == 0)
  msg ('Nenhum conhecimento encontrado.', 'error');

$filename = "receitas$domain" . time() . ".csv";
$csv      = initCSVExport($filename);

// ✅ ADICIONAR colunas Sigla Emitente e Sigla Destinatário
writeCSVRow ($csv, ['Serie CTRC',        'Numero CTRC',       'Emissao',           'Chave CT-e',
                    'Tipo de Documento', 'Tipo de Frete',     'Sigla Emitente',    'Sigla Destinatario',
                    'Cidade Origem',     'Cidade de Entrega', 'CNPJ Remetente',    'Nome Remetente', 
                    'CNPJ Destinatario', 'Nome Destinatario', 'CNPJ Pagador',      'Nome Pagador',   
                    'Qtde. de Volumes',  'Peso (Kg)',         'Valor da NF (R$)',  'Frete (R$)',     
                    'ICMS (R$)']);

while ($row = pg_fetch_array ($result))
  // ✅ ADICIONAR dados de sigla_emit e sigla_dest
  writeCSVRow($csv, [$row['ser_cte'],      $row['nro_cte'],   $row['emissao'],    $row['chave_cte'],
                     $row['tp_documento'], $row['tp_frete'],  $row['sigla_emit'], $row['sigla_dest'],
                     $row['cid_emit'],     $row['cid_entr'],  $row['cnpj_emit'],  $row['nome_emit'], 
                     $row['cnpj_dest'],    $row['nome_dest'], $row['cnpj_pag'],   $row['nome_pag'],  
                     $row['qtde_vol'],     $row['peso_real'], $row['vlr_merc'],   $row['vlr_frete'], 
                     $row['vlr_icms']]);

finishCSVExport($csv);