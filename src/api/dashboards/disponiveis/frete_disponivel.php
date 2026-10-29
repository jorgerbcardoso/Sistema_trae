<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = (string)($auth['domain'] ?? '');

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input = getRequestInput();
$acao = trim((string)($input['acao'] ?? ''));
if ($acao === '') $acao = trim((string)($input['action'] ?? ''));
if ($acao === '') $acao = 'list';

$conn = connect();
$tbl = "{$domain}_frete_disponivel";

@pg_query(
    $conn,
    "CREATE TABLE IF NOT EXISTS {$tbl} (
        sigla_emit         VARCHAR(20) NOT NULL,
        sigla_carregamento VARCHAR(20) NOT NULL,
        percentual         NUMERIC NOT NULL,
        PRIMARY KEY (sigla_emit, sigla_carregamento)
     )"
);
@pg_query($conn, "CREATE UNIQUE INDEX IF NOT EXISTS {$tbl}_uq1 ON {$tbl} (sigla_emit, sigla_carregamento)");

if ($acao === 'list') {
    $res = @pg_query($conn, "SELECT sigla_emit, sigla_carregamento, percentual FROM {$tbl} ORDER BY sigla_carregamento, sigla_emit");
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao buscar: ' . pg_last_error($conn)]);
    }
    $items = [];
    while ($r = pg_fetch_assoc($res)) {
        $items[] = [
            'sigla_emit' => (string)($r['sigla_emit'] ?? ''),
            'sigla_carregamento' => (string)($r['sigla_carregamento'] ?? ''),
            'percentual' => (float)($r['percentual'] ?? 0),
        ];
    }
    respondJson(['success' => true, 'items' => $items]);
}

if ($acao === 'upsert') {
    $items = $input['items'] ?? [];
    if (!is_array($items)) $items = [];

    pg_query($conn, 'BEGIN');
    try {
        $count = 0;
        foreach ($items as $it) {
            $emit = strtoupper(trim((string)($it['sigla_emit'] ?? $it['siglaEmit'] ?? '')));
            $car  = strtoupper(trim((string)($it['sigla_carregamento'] ?? $it['siglaCarregamento'] ?? '')));
            $percRaw = $it['percentual'] ?? $it['perc'] ?? null;
            $perc = (float)$percRaw;
            if ($emit === '' || $car === '' || !is_finite($perc)) continue;
            if ($perc < 0) $perc = 0.0;
            if ($perc > 1000) $perc = 1000.0;
            $resUp = sql(
                "UPDATE {$tbl}
                 SET percentual = $3
                 WHERE sigla_emit = $1
                   AND sigla_carregamento = $2",
                [$emit, $car, $perc],
                $conn
            );
            $aff = $resUp ? @pg_affected_rows($resUp) : 0;
            if (!$aff) {
                sql(
                    "INSERT INTO {$tbl} (sigla_emit, sigla_carregamento, percentual)
                     VALUES ($1, $2, $3)",
                    [$emit, $car, $perc],
                    $conn
                );
            }
            $count++;
        }
        pg_query($conn, 'COMMIT');
        respondJson(['success' => true, 'saved' => $count]);
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => 'Erro ao salvar: ' . $e->getMessage()]);
    }
}

if ($acao === 'delete') {
    $emit = strtoupper(trim((string)($input['sigla_emit'] ?? $input['siglaEmit'] ?? '')));
    $car  = strtoupper(trim((string)($input['sigla_carregamento'] ?? $input['siglaCarregamento'] ?? '')));
    if ($emit === '' || $car === '') {
        respondJson(['success' => false, 'message' => 'Informe sigla_emit e sigla_carregamento.']);
    }
    $res = sql("DELETE FROM {$tbl} WHERE sigla_emit = $1 AND sigla_carregamento = $2", [$emit, $car], $conn);
    if (!$res) respondJson(['success' => false, 'message' => 'Erro ao excluir: ' . pg_last_error($conn)]);
    respondJson(['success' => true]);
}

respondJson(['success' => false, 'message' => 'Ação inválida.']);
