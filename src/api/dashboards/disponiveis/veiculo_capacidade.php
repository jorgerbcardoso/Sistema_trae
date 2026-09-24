<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = strtoupper(trim($auth['domain'] ?? ''));
$input = getRequestInput();
$acao = strtolower(trim((string)($input['acao'] ?? 'listar')));

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$conn = connect();

$tblVeiculo = "{$domain}_veiculo";
$tblCap = "{$domain}_veiculo_capacidade";

@pg_query($conn, "CREATE TABLE IF NOT EXISTS {$tblCap} (tipo VARCHAR PRIMARY KEY, capacidade_ton NUMERIC, capacidade_m3 NUMERIC)");
@pg_query($conn, "CREATE UNIQUE INDEX IF NOT EXISTS {$tblCap}_tipo_uidx ON {$tblCap} (tipo)");

if ($acao === 'listar') {
    $sql = "
        SELECT
            v.tipo,
            COALESCE(c.capacidade_ton, 0) AS capacidade_ton,
            COALESCE(c.capacidade_m3, 0) AS capacidade_m3
        FROM (
            SELECT DISTINCT UPPER(BTRIM(tipo)) AS tipo
            FROM {$tblVeiculo}
            WHERE COALESCE(BTRIM(tipo), '') <> ''
        ) v
        LEFT JOIN {$tblCap} c ON UPPER(BTRIM(c.tipo)) = v.tipo
        ORDER BY v.tipo ASC
    ";

    $res = @pg_query($conn, $sql);
    if (!$res) {
        respondJson(['success' => false, 'message' => 'Erro ao listar tipos de veículo.']);
    }

    $items = [];
    while ($row = pg_fetch_assoc($res)) {
        $items[] = [
            'tipo' => (string)($row['tipo'] ?? ''),
            'capacidade_ton' => $row['capacidade_ton'] !== null ? (float)$row['capacidade_ton'] : 0,
            'capacidade_m3' => $row['capacidade_m3'] !== null ? (float)$row['capacidade_m3'] : 0,
        ];
    }

    respondJson(['success' => true, 'items' => $items]);
}

if ($acao === 'salvar') {
    $items = $input['items'] ?? [];
    if (!is_array($items)) $items = [];

    pg_query($conn, 'BEGIN');
    try {
        foreach ($items as $it) {
            $tipo = strtoupper(trim((string)($it['tipo'] ?? '')));
            if ($tipo === '') continue;

            $ton = $it['capacidade_ton'] ?? null;
            $m3 = $it['capacidade_m3'] ?? null;
            $tonVal = ($ton === '' || $ton === null) ? null : (float)$ton;
            $m3Val = ($m3 === '' || $m3 === null) ? null : (float)$m3;

            $ok = @pg_query_params(
                $conn,
                "INSERT INTO {$tblCap} (tipo, capacidade_ton, capacidade_m3)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (tipo) DO UPDATE
                 SET capacidade_ton = EXCLUDED.capacidade_ton,
                     capacidade_m3 = EXCLUDED.capacidade_m3",
                [$tipo, $tonVal, $m3Val]
            );
            if (!$ok) {
                throw new Exception('Erro ao salvar capacidade.');
            }
        }
        pg_query($conn, 'COMMIT');
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => $e->getMessage() ?: 'Erro ao salvar capacidades.']);
    }

    respondJson(['success' => true]);
}

respondJson(['success' => false, 'message' => 'Ação inválida.']);

