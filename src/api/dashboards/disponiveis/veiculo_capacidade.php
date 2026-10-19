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

@pg_query($conn, "CREATE TABLE IF NOT EXISTS {$tblCap} (tipo VARCHAR PRIMARY KEY, capacidade_ton NUMERIC, capacidade_m3 NUMERIC, vlr_diaria NUMERIC, media_consumo NUMERIC, vlr_manutencao_km NUMERIC, vlr_pneus_km NUMERIC, fixo_diario NUMERIC, custo_diario_motorista NUMERIC, custo_pernoite NUMERIC)");
@pg_query($conn, "CREATE UNIQUE INDEX IF NOT EXISTS {$tblCap}_tipo_uidx ON {$tblCap} (tipo)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS vlr_diaria NUMERIC");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS media_consumo NUMERIC");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS vlr_manutencao_km NUMERIC");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS vlr_pneus_km NUMERIC");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS fixo_diario NUMERIC");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS custo_diario_motorista NUMERIC");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS custo_pernoite NUMERIC");

if ($acao === 'listar') {
    $sql = "
        SELECT
            v.tipo,
            COALESCE(c.capacidade_ton, 0) AS capacidade_ton,
            COALESCE(c.capacidade_m3, 0) AS capacidade_m3,
            c.vlr_diaria,
            c.media_consumo,
            c.vlr_manutencao_km,
            c.vlr_pneus_km,
            c.fixo_diario,
            c.custo_diario_motorista,
            c.custo_pernoite
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
            'vlr_diaria' => $row['vlr_diaria'] !== null ? (float)$row['vlr_diaria'] : null,
            'media_consumo' => $row['media_consumo'] !== null ? (float)$row['media_consumo'] : null,
            'vlr_manutencao_km' => $row['vlr_manutencao_km'] !== null ? (float)$row['vlr_manutencao_km'] : null,
            'vlr_pneus_km' => $row['vlr_pneus_km'] !== null ? (float)$row['vlr_pneus_km'] : null,
            'fixo_diario' => $row['fixo_diario'] !== null ? (float)$row['fixo_diario'] : null,
            'custo_diario_motorista' => $row['custo_diario_motorista'] !== null ? (float)$row['custo_diario_motorista'] : null,
            'custo_pernoite' => $row['custo_pernoite'] !== null ? (float)$row['custo_pernoite'] : null,
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

if ($acao === 'salvar_frota') {
    $items = $input['items'] ?? [];
    if (!is_array($items)) $items = [];

    pg_query($conn, 'BEGIN');
    try {
        foreach ($items as $it) {
            $tipo = strtoupper(trim((string)($it['tipo'] ?? '')));
            if ($tipo === '') continue;

            $vlrDiaria = $it['vlr_diaria'] ?? null;
            $mediaConsumo = $it['media_consumo'] ?? null;
            $vlrManutKm = $it['vlr_manutencao_km'] ?? null;
            $vlrPneusKm = $it['vlr_pneus_km'] ?? null;
            $fixoDiario = $it['fixo_diario'] ?? null;
            $custoMotor = $it['custo_diario_motorista'] ?? null;
            $custoPernoite = $it['custo_pernoite'] ?? null;

            $vlrDiariaVal = ($vlrDiaria === '' || $vlrDiaria === null) ? null : (float)$vlrDiaria;
            $mediaConsumoVal = ($mediaConsumo === '' || $mediaConsumo === null) ? null : (float)$mediaConsumo;
            $vlrManutKmVal = ($vlrManutKm === '' || $vlrManutKm === null) ? null : (float)$vlrManutKm;
            $vlrPneusKmVal = ($vlrPneusKm === '' || $vlrPneusKm === null) ? null : (float)$vlrPneusKm;
            $fixoDiarioVal = ($fixoDiario === '' || $fixoDiario === null) ? null : (float)$fixoDiario;
            $custoMotorVal = ($custoMotor === '' || $custoMotor === null) ? null : (float)$custoMotor;
            $custoPernoiteVal = ($custoPernoite === '' || $custoPernoite === null) ? null : (float)$custoPernoite;

            $ok = @pg_query_params(
                $conn,
                "INSERT INTO {$tblCap} (tipo, vlr_diaria, media_consumo, vlr_manutencao_km, vlr_pneus_km, fixo_diario, custo_diario_motorista, custo_pernoite)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (tipo) DO UPDATE
                 SET vlr_diaria = EXCLUDED.vlr_diaria,
                     media_consumo = EXCLUDED.media_consumo,
                     vlr_manutencao_km = EXCLUDED.vlr_manutencao_km,
                     vlr_pneus_km = EXCLUDED.vlr_pneus_km,
                     fixo_diario = EXCLUDED.fixo_diario,
                     custo_diario_motorista = EXCLUDED.custo_diario_motorista,
                     custo_pernoite = EXCLUDED.custo_pernoite",
                [$tipo, $vlrDiariaVal, $mediaConsumoVal, $vlrManutKmVal, $vlrPneusKmVal, $fixoDiarioVal, $custoMotorVal, $custoPernoiteVal]
            );
            if (!$ok) {
                throw new Exception('Erro ao salvar tabela de frota.');
            }
        }
        pg_query($conn, 'COMMIT');
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        respondJson(['success' => false, 'message' => $e->getMessage() ?: 'Erro ao salvar tabela de frota.']);
    }

    respondJson(['success' => true]);
}

respondJson(['success' => false, 'message' => 'Ação inválida.']);
