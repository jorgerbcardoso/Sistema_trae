<?php
require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth   = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input = getRequestInput();
$acao  = strtolower(trim((string)($input['acao'] ?? 'get')));

$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $input['unidade']
    ?? $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? ''
));
if ($unidade === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade inválida.']);
}

$seqCar = (int)($input['seq_carregamento'] ?? 0);
$placa  = strtoupper(trim((string)($input['placa'] ?? '')));
if ($seqCar <= 0 && $placa === '') {
    respondJson(['success' => false, 'message' => 'seq_carregamento ou placa não informado.']);
}

$conn = connect();
$tblCar = "{$domain}_carregamento";
$tblCap = "{$domain}_carregamento_capacidade";
$tblMot = "{$domain}_motorista";

@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS unidade VARCHAR(10)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS seq_carregamento INT");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS placa_definitiva VARCHAR(10)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS placa_carreta VARCHAR(10)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS cpf_motorista VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS ddd_motorista VARCHAR(5)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS fone_motorista VARCHAR(20)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS qtde_pallets INT");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS conferente VARCHAR(80)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS ajudantes VARCHAR(120)");
@pg_query($conn, "ALTER TABLE {$tblCap} ADD COLUMN IF NOT EXISTS doca VARCHAR(20)");

$resolveSeq = function() use ($conn, $tblCar, $unidade, $seqCar, $placa): int {
    if ($seqCar > 0) return $seqCar;
    try {
        $res = sql(
            "SELECT MAX(seq_carregamento) AS seq_carregamento
             FROM {$tblCar}
             WHERE unidade = $1
               AND UPPER(placa_provisoria) = UPPER($2)
               AND data_finalizacao IS NULL",
            [$unidade, $placa],
            $conn
        );
        if ($res && pg_num_rows($res) > 0) {
            $row = pg_fetch_assoc($res);
            return (int)($row['seq_carregamento'] ?? 0);
        }
    } catch (Exception $e) {}
    return 0;
};

$seqCarResolved = $resolveSeq();
if ($seqCarResolved <= 0) {
    respondJson(['success' => false, 'message' => 'Carregamento não encontrado.']);
}

if ($acao === 'get') {
    try {
        $res = sql(
            "SELECT
                placa_definitiva,
                placa_carreta,
                cpf_motorista,
                ddd_motorista,
                fone_motorista,
                qtde_pallets,
                conferente,
                ajudantes,
                doca
             FROM {$tblCap}
             WHERE unidade = $1 AND seq_carregamento = $2
             LIMIT 1",
            [$unidade, $seqCarResolved],
            $conn
        );
        $row = $res && pg_num_rows($res) > 0 ? pg_fetch_assoc($res) : [];
        $cpf = strtoupper(trim((string)($row['cpf_motorista'] ?? '')));
        $nomeMot = '';
        if ($cpf !== '') {
            try {
                $resMot = sql("SELECT nome FROM {$tblMot} WHERE cpf = $1 LIMIT 1", [$cpf], $conn);
                if ($resMot && pg_num_rows($resMot) > 0) {
                    $rm = pg_fetch_assoc($resMot);
                    $nomeMot = trim((string)($rm['nome'] ?? ''));
                }
            } catch (Exception $e) {}
        }
        respondJson([
            'success' => true,
            'seq_carregamento' => $seqCarResolved,
            'data' => [
                'placa_definitiva' => strtoupper(trim((string)($row['placa_definitiva'] ?? ''))),
                'placa_carreta' => strtoupper(trim((string)($row['placa_carreta'] ?? ''))),
                'cpf_motorista' => $cpf,
                'motorista_nome' => $nomeMot,
                'ddd_motorista' => trim((string)($row['ddd_motorista'] ?? '')),
                'fone_motorista' => trim((string)($row['fone_motorista'] ?? '')),
                'qtde_pallets' => (int)($row['qtde_pallets'] ?? 0),
                'conferente' => trim((string)($row['conferente'] ?? '')),
                'ajudantes' => trim((string)($row['ajudantes'] ?? '')),
                'doca' => trim((string)($row['doca'] ?? '')),
            ],
        ]);
    } catch (Exception $e) {
        respondJson(['success' => false, 'message' => 'Erro ao carregar dados.']);
    }
}

if ($acao === 'save') {
    $placaDef = strtoupper(trim((string)($input['placa_definitiva'] ?? '')));
    $placaCar = strtoupper(trim((string)($input['placa_carreta'] ?? '')));
    $cpfMot = strtoupper(trim((string)($input['cpf_motorista'] ?? '')));
    $dddMot = trim((string)($input['ddd_motorista'] ?? ''));
    $foneMot = trim((string)($input['fone_motorista'] ?? ''));
    $qtdePallets = (int)($input['qtde_pallets'] ?? 0);
    $conferente = trim((string)($input['conferente'] ?? ''));
    $ajudantes = trim((string)($input['ajudantes'] ?? ''));
    $doca = trim((string)($input['doca'] ?? ''));

    if ($placaDef !== '' && !preg_match('/^[A-Z0-9]{6,10}$/', $placaDef)) {
        respondJson(['success' => false, 'message' => 'Placa definitiva inválida.']);
    }
    if ($placaCar !== '' && !preg_match('/^[A-Z0-9]{6,10}$/', $placaCar)) {
        respondJson(['success' => false, 'message' => 'Carreta inválida.']);
    }
    if ($cpfMot !== '' && !preg_match('/^[0-9]{11,14}$/', preg_replace('/\D+/', '', $cpfMot))) {
        respondJson(['success' => false, 'message' => 'CPF inválido.']);
    }

    try {
        $res = sql(
            "SELECT 1 FROM {$tblCap} WHERE unidade = $1 AND seq_carregamento = $2 LIMIT 1",
            [$unidade, $seqCarResolved],
            $conn
        );
        $exists = $res && pg_num_rows($res) > 0;

        if (!$exists) {
            sql(
                "INSERT INTO {$tblCap} (unidade, seq_carregamento)
                 VALUES ($1, $2)",
                [$unidade, $seqCarResolved],
                $conn
            );
        }

        sql(
            "UPDATE {$tblCap}
             SET
                placa_definitiva = $3,
                placa_carreta = $4,
                cpf_motorista = $5,
                ddd_motorista = $6,
                fone_motorista = $7,
                qtde_pallets = $8,
                conferente = $9,
                ajudantes = $10,
                doca = $11
             WHERE unidade = $1 AND seq_carregamento = $2",
            [
                $unidade,
                $seqCarResolved,
                ($placaDef !== '' ? $placaDef : null),
                ($placaCar !== '' ? $placaCar : null),
                ($cpfMot !== '' ? preg_replace('/\D+/', '', $cpfMot) : null),
                ($dddMot !== '' ? $dddMot : null),
                ($foneMot !== '' ? $foneMot : null),
                ($qtdePallets > 0 ? $qtdePallets : null),
                ($conferente !== '' ? $conferente : null),
                ($ajudantes !== '' ? $ajudantes : null),
                ($doca !== '' ? $doca : null),
            ],
            $conn
        );

        respondJson(['success' => true, 'seq_carregamento' => $seqCarResolved]);
    } catch (Exception $e) {
        respondJson(['success' => false, 'message' => 'Erro ao salvar dados.']);
    }
}

respondJson(['success' => false, 'message' => 'Ação inválida.']);

