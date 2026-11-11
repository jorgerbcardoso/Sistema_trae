<?php
require_once __DIR__ . '/../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

set_exception_handler(function ($e) {
    error_log('[get_cte_detalhes] ' . $e->getMessage());
    respondJson(['success' => false, 'message' => 'Não foi possível carregar os detalhes do CT-e.'], 500);
});

$auth = authenticateAndGetUser();
$domain = strtolower(trim((string)($auth['domain'] ?? '')));
if ($domain === '' || !preg_match('/^[a-z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input = getRequestInput();
$seqCte = (int)($input['seq_cte'] ?? 0);
$serie = strtoupper(trim((string)($input['ser_cte'] ?? '')));
$numero = preg_replace('/\D/', '', (string)($input['nro_cte'] ?? ''));
if ($seqCte <= 0 && ($serie === '' || $numero === '')) {
    respondJson(['success' => false, 'message' => 'Identificação do CT-e não informada.']);
}

$conn = connect();
$tabelaCte = "{$domain}_cte";
$tabelaCliente = "{$domain}_cliente";

$temColuna = function (string $tabela, string $coluna) use ($conn): bool {
    $res = sql(
        "SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND lower(table_name) = lower($1)
           AND lower(column_name) = lower($2)
         LIMIT 1",
        [$tabela, $coluna],
        $conn
    );
    return $res && pg_num_rows($res) > 0;
};

$hasCidadeEntrega = $temColuna($tabelaCte, 'seq_cidade_entr');
$hasCidadeEmitente = $temColuna($tabelaCliente, 'seq_cidade');
$joinCidadeEntrega = $hasCidadeEntrega
    ? "LEFT JOIN cidade ce ON ce.seq_cidade = cte.seq_cidade_entr"
    : '';
$joinCidadeEmitente = $hasCidadeEmitente
    ? "LEFT JOIN {$tabelaCliente} cli_emit
           ON regexp_replace(COALESCE(cli_emit.cnpj::text, ''), '\\\\D', '', 'g') =
              regexp_replace(COALESCE(cte.cnpj_emit::text, ''), '\\\\D', '', 'g')
       LEFT JOIN cidade ce_emit ON ce_emit.seq_cidade = cli_emit.seq_cidade"
    : '';
$selCidadeEntrega = $hasCidadeEntrega
    ? "COALESCE(ce.nome, '') AS cidade_entrega, COALESCE(ce.uf, '') AS uf_entrega"
    : "'' AS cidade_entrega, '' AS uf_entrega";
$selCidadeEmitente = $hasCidadeEmitente
    ? "COALESCE(ce_emit.nome, '') AS cidade_emit, COALESCE(ce_emit.uf, '') AS uf_emit"
    : "'' AS cidade_emit, '' AS uf_emit";

if ($seqCte > 0) {
    $where = 'cte.seq_cte = $1';
    $params = [$seqCte];
} else {
    $where = 'UPPER(BTRIM(cte.ser_cte::text)) = $1 AND cte.nro_cte::text = $2';
    $params = [$serie, $numero];
}

$query = "
    SELECT
        to_jsonb(cte) AS cte_data,
        {$selCidadeEntrega},
        {$selCidadeEmitente}
    FROM {$tabelaCte} cte
    {$joinCidadeEntrega}
    {$joinCidadeEmitente}
    WHERE {$where}
    ORDER BY cte.data_emissao DESC
    LIMIT 1
";
$res = sql($query, $params, $conn);
if (!$res || pg_num_rows($res) === 0) {
    respondJson(['success' => false, 'message' => 'CT-e não encontrado.']);
}

$row = pg_fetch_assoc($res);
$dados = json_decode((string)($row['cte_data'] ?? ''), true);
if (!is_array($dados)) {
    respondJson(['success' => false, 'message' => 'Não foi possível ler os detalhes do CT-e.']);
}

$get = static function (array $source, string $key, $default = '') {
    return $source[$key] ?? $default;
};
$formatDate = static function ($value): string {
    $value = trim((string)$value);
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $value, $m)) {
        return "{$m[3]}/{$m[2]}/{$m[1]}";
    }
    return $value;
};
$nfs = preg_split('/[,;\s]+/', trim((string)$get($dados, 'nfs')));
$nfs = is_array($nfs) ? array_values(array_filter($nfs, static fn($item) => trim((string)$item) !== '')) : [];
$cidadeEntrega = trim((string)($row['cidade_entrega'] ?? ''));
$ufEntrega = trim((string)($row['uf_entrega'] ?? ''));
$cidadeEmitente = trim((string)($row['cidade_emit'] ?? ''));
$ufEmitente = trim((string)($row['uf_emit'] ?? ''));

$cte = [
    'seqCte' => (int)$get($dados, 'seq_cte', 0),
    'serCte' => (string)$get($dados, 'ser_cte'),
    'nroCte' => (string)$get($dados, 'nro_cte'),
    'tpDocumento' => (string)$get($dados, 'tp_documento'),
    'emissao' => $formatDate($get($dados, 'data_emissao')),
    'chegadaUnid' => $formatDate($get($dados, 'data_chegada_unid')),
    'prevEnt' => $formatDate($get($dados, 'data_prev_ent')),
    'prevChegada' => $formatDate($get($dados, 'data_prev_chegada')),
    'dataEnt' => $formatDate($get($dados, 'data_entrega')),
    'unidAtual' => (string)$get($dados, 'unid_atual'),
    'unidadeOrigem' => (string)$get($dados, 'sigla_emit'),
    'unidadeDest' => (string)$get($dados, 'sigla_dest'),
    'unidadeEntrega' => (string)$get($dados, 'sigla_dest'),
    'nfiscal' => (string)($nfs[0] ?? $get($dados, 'nfiscal')),
    'remetente' => (string)$get($dados, 'nome_emit'),
    'pagador' => (string)$get($dados, 'nome_pag'),
    'destinatario' => (string)$get($dados, 'nome_dest'),
    'cnpjEmit' => (string)$get($dados, 'cnpj_emit'),
    'cnpjPag' => (string)$get($dados, 'cnpj_pag'),
    'cnpjDest' => (string)$get($dados, 'cnpj_dest'),
    'cidadeEmitente' => trim($cidadeEmitente . ($ufEmitente !== '' ? "/{$ufEmitente}" : '')),
    'cidadeEntrega' => trim($cidadeEntrega . ($ufEntrega !== '' ? "/{$ufEntrega}" : '')),
    'cepEntrega' => (string)$get($dados, 'cep_entrega'),
    'enderecoEntrega' => (string)$get($dados, 'endereco_entrega'),
    'bairroEntrega' => (string)$get($dados, 'bairro_entrega'),
    'placaColeta' => (string)$get($dados, 'placa_coleta'),
    'frete' => $get($dados, 'vlr_frete', 0),
    'vlrMerc' => $get($dados, 'vlr_merc', 0),
    'peso' => $get($dados, 'peso_real', 0),
    'pesoReal' => $get($dados, 'peso_real', 0),
    'pesoCalc' => $get($dados, 'peso_calc', 0),
    'cubagem' => $get($dados, 'cubagem', 0),
    'qtdeVol' => $get($dados, 'qtde_vol', 0),
    'custoSeguro' => $get($dados, 'custo_seguro', 0),
    'custoIcms' => $get($dados, 'custo_icms', 0),
    'custoPisCofins' => $get($dados, 'custo_pis_cofins', 0),
    'custoGris' => $get($dados, 'custo_gris', 0),
    'custoPedagio' => $get($dados, 'custo_pedagio', 0),
    'custoExpedicao' => $get($dados, 'custo_expedicao', 0),
    'custoTransbordo' => $get($dados, 'custo_transbordo', 0),
    'custoVendedor' => $get($dados, 'custo_vendedor', 0),
    'custoRecepcao' => $get($dados, 'custo_recepcao', 0),
    'custoDespDiv' => $get($dados, 'custo_desp_div', 0),
    'custoTransferenciaReal' => $get($dados, 'custo_transferencia_real', 0),
    'codUltOcor' => (string)$get($dados, 'cod_ult_ocor'),
    'descUltOcor' => (string)$get($dados, 'desc_ult_ocor'),
    'dataUltOcor' => $formatDate($get($dados, 'data_ult_ocor')),
];

respondJson(['success' => true, 'cte' => $cte]);
