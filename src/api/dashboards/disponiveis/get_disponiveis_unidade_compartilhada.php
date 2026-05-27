<?php
require_once '../../../config.php';
require_once '../../lib/lib.php';
require_once './lib.php'; // Pode conter funções úteis?

use App\Util\SSW;

header('Content-Type: application/json');

// Garante que o método de requisição seja POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método não permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$unidade_alvo = isset($input['unidade']) ? pg_escape_string(strtoupper($input['unidade'])) : '';

if (empty($unidade_alvo)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Unidade não informada.']);
    exit;
}

try {
    // 1. Busca coletas pendentes para a unidade alvo
    $relatorio_coletas = SSW::get('relatorio-coletas-pendentes', [
        'unidade' => $unidade_alvo
    ]);

    $coletas = array_map(function ($item) {
        return [
            'chave_cte' => $item->chave_cte,
            'destinatario' => $item->destinatario, // O nome do campo pode variar, ajuste se necessário
            'volumes' => $item->volumes,
            'peso' => $item->peso,
        ];
    }, $relatorio_coletas);
    
    // 2. Busca CT-es para transferência
    $relatorio_transferencias = SSW::get('relatorio-cte-para-transferencia', [
        'unidade' => $unidade_alvo
    ]);
     $transferencias = array_map(function ($item) {
        return [
            'chave_cte' => $item->chave_cte,
            'remetente' => $item->remetente, // Supondo que exista
            'destinatario' => $item->destinatario_razao, // O nome do campo pode variar
            'volumes' => $item->volumes,
            'peso' => $item->peso_real,
        ];
    }, $relatorio_transferencias);

    // 3. Busca CT-es para entrega
    $relatorio_entregas = SSW::get('relatorio-cte-para-entrega', [
        'unidade' => $unidade_alvo
    ]);
     $entregas = array_map(function ($item) {
        return [
            'chave_cte' => $item->chave_cte,
            'destinatario' => $item->destinatario_razao, // O nome do campo pode variar
            'volumes' => $item->volumes,
            'peso' => $item->peso_real,
        ];
    }, $relatorio_entregas);


    echo json_encode([
        'status' => 'success',
        'data' => [
            'coletas' => $coletas,
            'transferencias' => $transferencias,
            'entregas' => $entregas
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    error_log("Erro em get_disponiveis_unidade_compartilhada.php: " . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
