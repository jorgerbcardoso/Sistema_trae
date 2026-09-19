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

if ($unidade === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade inválida.']);
}
if ($placa === '') {
    respondJson(['success' => false, 'message' => 'Placa inválida.']);
}

$conn = connect();
$tblCar = "{$domain}_carregamento";
$tblUnid = "{$domain}_unidade";
$tblCte = "{$domain}_cte";

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

$carRow = null;
try {
    $resCar = sql(
        "SELECT
            MAX(seq_carregamento) AS seq_carregamento,
            MAX(COALESCE(NULLIF(destino, ''), NULLIF(destino_cte, ''))) AS destino,
            MAX(COALESCE(NULLIF(unidades, ''), '')) AS paradas
         FROM {$tblCar}
         WHERE unidade = $1
           AND UPPER(placa_provisoria) = UPPER($2)
           AND data_finalizacao IS NULL",
        [$unidade, $placa],
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

$rows = [];
$unidadesSet = [$unidade => true];
if ($destino !== '') $unidadesSet[$destino] = true;
foreach ($paradasArr as $p) $unidadesSet[$p] = true;

try {
    $q = "
        SELECT
            car.ser_cte,
            car.nro_cte,
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
            COALESCE(cte.seq_cidade_entr, NULL) AS seq_cidade_entr,
            COALESCE(cte.cep_entrega::text, '') AS cep_entrega,
            COALESCE(cte.endereco_entrega, '') AS endereco_entrega,
            COALESCE(cte.bairro_entrega, '') AS bairro_entrega,
            COALESCE(cid.nome, '') AS cidade_entrega,
            COALESCE(cid.uf, '') AS uf_entrega,
            cte.latitude_entrega,
            cte.longitude_entrega
        FROM {$tblCar} car
        LEFT JOIN {$tblCte} cte
               ON cte.ser_cte = car.ser_cte
              AND cte.nro_cte = car.nro_cte
        LEFT JOIN cidade cid
               ON cid.seq_cidade = cte.seq_cidade_entr
        WHERE car.unidade = $1
          AND UPPER(car.placa_provisoria) = UPPER($2)
          AND car.data_finalizacao IS NULL
          AND (car.nro_cte::text ~ '^[0-9]+$' AND (car.nro_cte::text)::int > 0)
        ORDER BY car.data_inclusao, car.hora_inclusao
    ";
    $res = sql($q, [$unidade, $placa], $conn);
    while ($res && ($r = pg_fetch_assoc($res))) {
        $destCte = strtoupper(trim((string)($r['destino_cte'] ?? '')));
        if ($destCte !== '' && preg_match('/^[A-Z0-9]{2,5}$/', $destCte)) $unidadesSet[$destCte] = true;
        $rows[] = [
            'ser_cte' => (string)($r['ser_cte'] ?? ''),
            'nro_cte' => ($r['nro_cte'] !== null && $r['nro_cte'] !== '') ? (int)$r['nro_cte'] : 0,
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
            'latitude_entrega' => $parseCoord($r['latitude_entrega'] ?? null),
            'longitude_entrega' => $parseCoord($r['longitude_entrega'] ?? null),
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
        'destino' => $destino !== '' ? $destino : null,
        'paradas' => $paradasArr,
    ],
    'unidades' => $unidades,
    'ctes' => $rows,
]);
