<?php
/**
 * ================================================================
 * API: CÁLCULO DO FRETE TERCEIRO (CALCULADORA — MODAL ROTA)
 * ================================================================
 * Retorna as parcelas de cálculo e o valor total da simulação
 * usando um veículo terceiro informado por placa.
 *
 * POST /dashboards/disponiveis/calcular_terceiro.php
 *
 * Body:
 *   {
 *     "dias": 2,               // número de dias de operação
 *     "placa": "ABC1D23",      // obrigatória
 *     "setores": "CEN@3|NOR@1" // entregas por setor
 *   }
 *
 * Formato de "setores":
 *   - cada setor separado por "|"
 *   - dentro do setor, a quantidade de entregas separada por "@"
 *   - Ex.: "CEN@3|NOR@1" => 3 entregas em CEN e 1 entrega em NOR
 *
 * Response:
 *   {
 *     "success": true,
 *     "data": {
 *       "placa": "ABC1D23",
 *       "tipo": "TRUCK",
 *       "propriedade": "TERCEIRO",
 *       "proprietario": "FULANO",
 *       "veiculo": { ... },
 *       "dias": 2,
 *       "setores": [ { "setor": "CEN", "entregas": 3 }, ... ],
 *       "parcelas": [ { "descricao": "...", "valor": 0 }, ... ],
 *       "total": 0
 *     }
 *   }
 * ================================================================
 */

require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
}

$input = getRequestInput();

// ----------------------------------------------------------------
// 1) Número de dias
// ----------------------------------------------------------------
$dias = (int)($input['dias'] ?? 0);
if ($dias < 0) $dias = 0;

// ----------------------------------------------------------------
// 2) Placa (obrigatória)
// ----------------------------------------------------------------
$placa = strtoupper(trim((string)($input['placa'] ?? '')));
if ($placa === '') {
    respondJson(['success' => false, 'message' => 'Informe uma placa para calcular.']);
}

// ----------------------------------------------------------------
// 3) Quantidade de entregas por setor — "CEN@3|NOR@1"
// ----------------------------------------------------------------
$setoresStr = trim((string)($input['setores'] ?? ''));
$setores = [];
if ($setoresStr !== '') {
    foreach (explode('|', $setoresStr) as $chunk) {
        $chunk = trim($chunk);
        if ($chunk === '') continue;
        $partes = explode('@', $chunk);
        $setor = strtoupper(trim((string)($partes[0] ?? '')));
        if ($setor === '') continue;
        $entregas = isset($partes[1]) ? (int)trim((string)$partes[1]) : 0;
        if ($entregas < 0) $entregas = 0;
        $setores[] = ['setor' => $setor, 'entregas' => $entregas];
    }
}

$conn = connect();
$tblVeiculo = "{$domain}_veiculo";
$tblProprietario = "{$domain}_proprietario";

// ----------------------------------------------------------------
// Dados do veículo terceiro (a partir da placa)
// ----------------------------------------------------------------
$veiculo = null;
try {
    $res = sql(
        "SELECT
            v.placa,
            v.tipo,
            v.marca,
            v.modelo,
            p.nome AS proprietario,
            CASE
                WHEN v.tp_propriedade = 'A' THEN 'AGREGADO'
                WHEN v.tp_propriedade = 'F' THEN 'FROTA'
                WHEN v.tp_propriedade = 'T' THEN 'TERCEIRO'
                ELSE v.tp_propriedade
            END AS propriedade
        FROM {$tblVeiculo} v
        LEFT JOIN {$tblProprietario} p ON v.cnpj_proprietario = p.cnpj
        WHERE UPPER(BTRIM(v.placa)) = $1
        LIMIT 1",
        [$placa],
        $conn
    );
    if ($res && ($row = pg_fetch_assoc($res))) {
        $veiculo = [
            'placa' => (string)($row['placa'] ?? $placa),
            'tipo' => (string)($row['tipo'] ?? ''),
            'marca' => (string)($row['marca'] ?? ''),
            'modelo' => (string)($row['modelo'] ?? ''),
            'proprietario' => (string)($row['proprietario'] ?? ''),
            'propriedade' => (string)($row['propriedade'] ?? ''),
        ];
    }
} catch (Exception $e) {
    // Segue com o cálculo mesmo sem os dados do veículo.
    $veiculo = null;
}

// ================================================================
// TODO — ALGORITMO DO CÁLCULO DO TERCEIRO
// ----------------------------------------------------------------
// Implementar o cálculo usando:
//   - $dias    (int)          número de dias de operação
//   - $placa   (string)
//   - $veiculo (array | null) dados do veículo (tipo, propriedade, ...)
//   - $setores (array)        [ { setor, entregas }, ... ]
//   - $conn    (conexão)      para consultas adicionais (tarifas, etc.)
//
// Preencher:
//   $parcelas = [
//       ['descricao' => 'Frete peso', 'valor' => 0.0],
//       ...
//   ];
//   $total = 0.0; // soma das parcelas
// ================================================================
$parcelas = [];
$total = 0.0;
// ----------------------------------------------------------------
// Fim do TODO
// ================================================================

respondJson([
    'success' => true,
    'data' => [
        'placa' => $placa,
        'tipo' => $veiculo['tipo'] ?? '',
        'propriedade' => $veiculo['propriedade'] ?? '',
        'proprietario' => $veiculo['proprietario'] ?? '',
        'veiculo' => $veiculo,
        'dias' => $dias,
        'setores' => $setores,
        'parcelas' => $parcelas,
        'total' => round((float)$total, 2),
    ],
]);
