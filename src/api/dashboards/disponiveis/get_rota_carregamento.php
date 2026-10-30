<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input = getRequestInput();
$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $input['unidade']
    ?? $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? ''
));
$placa = strtoupper(trim((string)($input['placa'] ?? '')));
$seqCarInput = (int)($input['seq_carregamento'] ?? 0);

if ($unidade === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade inválida.']);
}
if ($placa === '') {
    respondJson(['success' => false, 'message' => 'Placa inválida.']);
}

$conn = connect();
$tblCar = "{$domain}_carregamento";
$tblCap = "{$domain}_carregamento_capacidade";
$tblUnid = "{$domain}_unidade";
$tblCte = "{$domain}_cte";
$tblCliente = "{$domain}_cliente";

$tableExists = function($conn, string $tableName): bool {
    $t = strtolower(trim($tableName));
    if ($t === '') return false;
    $res = sql(
        "SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND lower(table_name) = lower($1)
         LIMIT 1",
        [$t],
        $conn
    );
    return ($res && pg_num_rows($res) > 0);
};

$colCache = [];
$colExists = function($conn, string $tableName, string $col) use (&$colCache): bool {
    $t = strtolower(trim($tableName));
    if ($t === '') return false;
    if (!isset($colCache[$t])) {
        $colCache[$t] = [];
        try {
            $res = sql(
                "SELECT column_name
                 FROM information_schema.columns
                 WHERE table_schema = 'public'
                   AND lower(table_name) = lower($1)",
                [$t],
                $conn
            );
            while ($res && ($r = pg_fetch_assoc($res))) {
                $name = strtolower(trim((string)($r['column_name'] ?? '')));
                if ($name !== '') $colCache[$t][$name] = true;
            }
        } catch (Exception $e) {
            $colCache[$t] = [];
        }
    }
    return isset($colCache[$t][strtolower($col)]);
};

$parseCoord = function($v) {
    if ($v === null) return null;
    if (is_int($v) || is_float($v)) return (float)$v;
    $s = trim((string)$v);
    if ($s === '') return null;
    $s = str_replace(',', '.', $s);
    if (preg_match('/^-?\d+(\.\d+)?$/', $s)) return (float)$s;
    if (preg_match('/^(-?)(\d{1,3})\D+(\d{1,2})\D+(\d{1,2}(\.\d+)?)\D*([NSEW])?/i', $s, $m)) {
        $deg = (float)$m[2];
        $min = (float)$m[3];
        $sec = (float)$m[4];
        $hem = strtoupper((string)($m[6] ?? ''));
        $sign = ($m[1] === '-') ? -1 : 1;
        if ($hem === 'S' || $hem === 'W') $sign = -1;
        return $sign * ($deg + ($min / 60.0) + ($sec / 3600.0));
    }
    if (preg_match('/^(-?\d{1,3}(?:\.\d+)?)\s*([NSEW])$/i', $s, $m)) {
        $val = (float)$m[1];
        $hem = strtoupper($m[2]);
        if ($hem === 'S' || $hem === 'W') $val = -abs($val);
        return $val;
    }
    return null;
};

@pg_query($conn, "ALTER TABLE {$tblCte} ADD COLUMN IF NOT EXISTS latitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCte} ADD COLUMN IF NOT EXISTS longitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCliente} ADD COLUMN IF NOT EXISTS latitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCliente} ADD COLUMN IF NOT EXISTS longitude_entrega VARCHAR(32)");
@pg_query($conn, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS ordem INT");

$cteOk = $tableExists($conn, $tblCte);
$clienteOk = $tableExists($conn, $tblCliente);
$hasSeqCidadeEntr = $cteOk && $colExists($conn, $tblCte, 'seq_cidade_entr');
$hasCepEntrega = $cteOk && $colExists($conn, $tblCte, 'cep_entrega');
$hasEnderecoEntrega = $cteOk && $colExists($conn, $tblCte, 'endereco_entrega');
$hasBairroEntrega = $cteOk && $colExists($conn, $tblCte, 'bairro_entrega');
$hasLatEntrega = $cteOk && $colExists($conn, $tblCte, 'latitude_entrega');
$hasLngEntrega = $cteOk && $colExists($conn, $tblCte, 'longitude_entrega');
$hasLocEntDif = $cteOk && $colExists($conn, $tblCte, 'loc_ent_dif');
$hasLocDifEnt = $cteOk && $colExists($conn, $tblCte, 'loc_dif_ent');
$hasCnpjEmit = $cteOk && $colExists($conn, $tblCte, 'cnpj_emit');

$joinCte = $cteOk ? "
        LEFT JOIN {$tblCte} cte
               ON cte.ser_cte = car.ser_cte
              AND cte.nro_cte = car.nro_cte
              AND NOT (
                    UPPER(BTRIM(COALESCE(cte.tp_documento, ''))) = 'PRES SERVICO'
                AND UPPER(BTRIM(COALESCE(cte.ser_cte, ''))) = '999'
              )
" : "";
$joinCliente = ($clienteOk && $hasCnpjEmit) ? "
        LEFT JOIN {$tblCliente} cli
               ON cli.cnpj = cte.cnpj_emit
" : "";
$joinCidade = $hasSeqCidadeEntr ? "
        LEFT JOIN cidade cid
               ON cid.seq_cidade = cte.seq_cidade_entr
" : "";
$selSeqCidadeEntr = $hasSeqCidadeEntr ? "COALESCE(cte.seq_cidade_entr, NULL) AS seq_cidade_entr," : "NULL AS seq_cidade_entr,";
$selCepEntrega = $hasCepEntrega ? "COALESCE(cte.cep_entrega::text, '') AS cep_entrega," : "'' AS cep_entrega,";
$selEnderecoEntrega = $hasEnderecoEntrega ? "COALESCE(cte.endereco_entrega, '') AS endereco_entrega," : "'' AS endereco_entrega,";
$selBairroEntrega = $hasBairroEntrega ? "COALESCE(cte.bairro_entrega, '') AS bairro_entrega," : "'' AS bairro_entrega,";
$selCidadeEntrega = $hasSeqCidadeEntr ? "COALESCE(cid.nome, '') AS cidade_entrega," : "'' AS cidade_entrega,";
$selUfEntrega = $hasSeqCidadeEntr ? "COALESCE(cid.uf, '') AS uf_entrega," : "'' AS uf_entrega,";
$selLatEntrega = $hasLatEntrega ? "cte.latitude_entrega," : "NULL AS latitude_entrega,";
$selLngEntrega = $hasLngEntrega ? "cte.longitude_entrega," : "NULL AS longitude_entrega,";
$selLocEntDif = $hasLocEntDif
    ? "COALESCE(cte.loc_ent_dif, '') AS loc_ent_dif,"
    : ($hasLocDifEnt ? "COALESCE(cte.loc_dif_ent, '') AS loc_ent_dif," : "'' AS loc_ent_dif,");
$selCnpjEmit = $hasCnpjEmit ? "COALESCE(cte.cnpj_emit, '') AS cnpj_emit," : "'' AS cnpj_emit,";
$selCliLat = ($clienteOk && $colExists($conn, $tblCliente, 'latitude_entrega') && $hasCnpjEmit) ? "cli.latitude_entrega AS cli_latitude_entrega," : "NULL AS cli_latitude_entrega,";
$selCliLng = ($clienteOk && $colExists($conn, $tblCliente, 'longitude_entrega') && $hasCnpjEmit) ? "cli.longitude_entrega AS cli_longitude_entrega" : "NULL AS cli_longitude_entrega";

$carRow = null;
try {
    $whereSeq = $seqCarInput > 0 ? " AND seq_carregamento = $3" : "";
    $paramsCar = $seqCarInput > 0 ? [$unidade, $placa, $seqCarInput] : [$unidade, $placa];
    $resCar = sql(
        "SELECT
            MAX(seq_carregamento) AS seq_carregamento,
            MAX(COALESCE(NULLIF(destino, ''), NULLIF(destino_cte, ''))) AS destino,
            MAX(COALESCE(NULLIF(unidades, ''), '')) AS paradas
         FROM {$tblCar}
         WHERE unidade = $1
           AND UPPER(placa_provisoria) = UPPER($2)
           AND data_finalizacao IS NULL
           {$whereSeq}",
        $paramsCar,
        $conn
    );
    if ($resCar) $carRow = pg_fetch_assoc($resCar);
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar carregamento.']);
}

if (!$carRow) {
    respondJson(['success' => false, 'message' => 'Carregamento não encontrado.']);
}

$destino = strtoupper(trim((string)($carRow['destino'] ?? '')));
$paradasCsv = strtoupper(trim((string)($carRow['paradas'] ?? '')));
$paradasArr = array_values(array_filter(array_map('trim', preg_split('/[,\s;]+/', $paradasCsv)), function($p) {
    return $p !== '' && preg_match('/^[A-Z0-9]{2,5}$/', $p);
}));

if ($destino !== '' && preg_match('/^[A-Z0-9]{2,5}$/', $destino)) {
    $paradasArr = array_values(array_filter($paradasArr, function($u) use ($destino) { return $u !== $destino; }));
    $paradasArr[] = $destino;
}

$seqCar = ($carRow['seq_carregamento'] !== null && $carRow['seq_carregamento'] !== '') ? (int)$carRow['seq_carregamento'] : null;
$tpCarregamento = 'E';
if ($seqCar !== null && $seqCar > 0) {
    try {
        $resTp = sql(
            "SELECT COALESCE(tp_carregamento, '') AS tp_carregamento
             FROM {$tblCap}
             WHERE unidade = $1 AND seq_carregamento = $2
             LIMIT 1",
            [$unidade, $seqCar],
            $conn
        );
        if ($resTp && pg_num_rows($resTp) > 0) {
            $rowTp = pg_fetch_assoc($resTp);
            $tp = strtoupper(trim((string)($rowTp['tp_carregamento'] ?? '')));
            if ($tp === 'T' || $tp === 'E') $tpCarregamento = $tp;
        }
    } catch (Exception $e) {}
}

$rows = [];
$unidadesSet = [$unidade => true];
if ($destino !== '') $unidadesSet[$destino] = true;
foreach ($paradasArr as $p) $unidadesSet[$p] = true;

try {
    $whereSeq = ($seqCarInput > 0) ? " AND car.seq_carregamento = $3" : "";
    $params = ($seqCarInput > 0) ? [$unidade, $placa, $seqCarInput] : [$unidade, $placa];
    $q = "
        SELECT
            car.ser_cte,
            car.nro_cte,
            car.ordem,
            UPPER(COALESCE(NULLIF(car.destino_cte, ''), NULLIF(car.destino, ''))) AS destino_cte,
            COALESCE(car.remetente_cte, '') AS remetente_cte,
            COALESCE(car.destinatario_cte, '') AS destinatario_cte,
            COALESCE(car.pagador_cte, '') AS pagador_cte,
            COALESCE(car.cidade_destino_cte, '') AS cidade_destino_cte,
            COALESCE(car.data_emissao_cte::text, '') AS data_emissao,
            COALESCE(car.data_prev_ent_cte::text, '') AS data_prev_ent,
            COALESCE(car.vlr_merc_cte, 0) AS vlr_merc,
            COALESCE(car.vlr_frete_cte, 0) AS vlr_frete,
            COALESCE(car.peso_cte, 0) AS peso,
            COALESCE(car.cubagem_cte, 0) AS cubagem,
            COALESCE(car.qtde_vol_cte, 0) AS qtde_vol,
            {$selSeqCidadeEntr}
            {$selCepEntrega}
            {$selEnderecoEntrega}
            {$selBairroEntrega}
            {$selCidadeEntrega}
            {$selUfEntrega}
            {$selLatEntrega}
            {$selLngEntrega}
            {$selLocEntDif}
            {$selCnpjEmit}
            {$selCliLat}
            {$selCliLng}
        FROM {$tblCar} car
        {$joinCte}
        {$joinCliente}
        {$joinCidade}
        WHERE car.unidade = $1
          AND UPPER(car.placa_provisoria) = UPPER($2)
          AND car.data_finalizacao IS NULL
          {$whereSeq}
          AND (car.nro_cte::text ~ '^[0-9]+$' AND (car.nro_cte::text)::int > 0)
        ORDER BY
          CASE WHEN car.ordem IS NULL OR car.ordem <= 0 THEN 999999 ELSE car.ordem END,
          car.data_inclusao,
          car.hora_inclusao
    ";
    $res = sql($q, $params, $conn);
    while ($res && ($r = pg_fetch_assoc($res))) {
        $destCte = strtoupper(trim((string)($r['destino_cte'] ?? '')));
        if ($destCte !== '' && preg_match('/^[A-Z0-9]{2,5}$/', $destCte)) $unidadesSet[$destCte] = true;
        $rows[] = [
            'ser_cte' => (string)($r['ser_cte'] ?? ''),
            'nro_cte' => ($r['nro_cte'] !== null && $r['nro_cte'] !== '') ? (int)$r['nro_cte'] : 0,
            'ordem' => ($r['ordem'] !== null && $r['ordem'] !== '') ? (int)$r['ordem'] : null,
            'destino_cte' => $destCte,
            'remetente' => (string)($r['remetente_cte'] ?? ''),
            'destinatario' => (string)($r['destinatario_cte'] ?? ''),
            'pagador' => (string)($r['pagador_cte'] ?? ''),
            'cidade_destino_cte' => (string)($r['cidade_destino_cte'] ?? ''),
            'data_emissao' => (string)($r['data_emissao'] ?? ''),
            'data_prev_ent' => (string)($r['data_prev_ent'] ?? ''),
            'vlr_merc' => ($r['vlr_merc'] !== null && $r['vlr_merc'] !== '') ? (float)$r['vlr_merc'] : 0.0,
            'vlr_frete' => ($r['vlr_frete'] !== null && $r['vlr_frete'] !== '') ? (float)$r['vlr_frete'] : 0.0,
            'peso' => ($r['peso'] !== null && $r['peso'] !== '') ? (float)$r['peso'] : 0.0,
            'cubagem' => ($r['cubagem'] !== null && $r['cubagem'] !== '') ? (float)$r['cubagem'] : 0.0,
            'qtde_vol' => ($r['qtde_vol'] !== null && $r['qtde_vol'] !== '') ? (int)$r['qtde_vol'] : 0,
            'cep_entrega' => (string)($r['cep_entrega'] ?? ''),
            'endereco_entrega' => (string)($r['endereco_entrega'] ?? ''),
            'bairro_entrega' => (string)($r['bairro_entrega'] ?? ''),
            'cidade_entrega' => (string)($r['cidade_entrega'] ?? ''),
            'uf_entrega' => (string)($r['uf_entrega'] ?? ''),
            'latitude_entrega' => (function() use ($parseCoord, $r) {
                $lat = $parseCoord($r['latitude_entrega'] ?? null);
                if ($lat !== null && $lat != 0) return $lat;
                $loc = strtoupper(trim((string)($r['loc_ent_dif'] ?? '')));
                if ($loc !== 'N') return $lat;
                $cliLat = $parseCoord($r['cli_latitude_entrega'] ?? null);
                return ($cliLat !== null && $cliLat != 0) ? $cliLat : $lat;
            })(),
            'longitude_entrega' => (function() use ($parseCoord, $r) {
                $lng = $parseCoord($r['longitude_entrega'] ?? null);
                if ($lng !== null && $lng != 0) return $lng;
                $loc = strtoupper(trim((string)($r['loc_ent_dif'] ?? '')));
                if ($loc !== 'N') return $lng;
                $cliLng = $parseCoord($r['cli_longitude_entrega'] ?? null);
                return ($cliLng !== null && $cliLng != 0) ? $cliLng : $lng;
            })(),
        ];
    }
} catch (Exception $e) {
    respondJson(['success' => false, 'message' => 'Erro ao buscar CT-es do carregamento.']);
}

$unidades = [];
$siglas = array_keys($unidadesSet);
sort($siglas);
if (count($siglas) > 0) {
    $params = [];
    $ph = [];
    $p = 1;
    foreach ($siglas as $s) {
        $ph[] = '$' . $p;
        $params[] = $s;
        $p += 1;
    }
    try {
        $qUn = "
            SELECT sigla, COALESCE(nome, '') AS nome, latitude, longitude
            FROM {$tblUnid}
            WHERE UPPER(sigla) IN (" . implode(',', $ph) . ")
        ";
        $resU = sql($qUn, $params, $conn);
        while ($resU && ($ru = pg_fetch_assoc($resU))) {
            $sig = strtoupper(trim((string)($ru['sigla'] ?? '')));
            if ($sig === '') continue;
            $unidades[] = [
                'sigla' => $sig,
                'nome' => (string)($ru['nome'] ?? ''),
                'latitude' => $parseCoord($ru['latitude'] ?? null),
                'longitude' => $parseCoord($ru['longitude'] ?? null),
            ];
        }
    } catch (Exception $e) {
        $unidades = [];
    }
}

respondJson([
    'success' => true,
    'carregamento' => [
        'seq_carregamento' => $seqCar,
        'placa' => $placa,
        'unidade_origem' => $unidade,
        'tp_carregamento' => $tpCarregamento,
        'destino' => $destino !== '' ? $destino : null,
        'paradas' => $paradasArr,
    ],
    'unidades' => $unidades,
    'ctes' => $rows,
]);
