<?php
require_once '../../../config.php';
require_once '../../lib/lib.php';

use App\Util\SSW;
use App\Util\dominio;
use App\Util\unidade;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método não permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$placa     = $input['placa'] ?? null;
$ctes      = $input['ctes'] ?? []; // CT-es do carregamento original
$ctes_hub  = $input['ctes_hub'] ?? []; // CT-es adicionados pelo Hub
$unidade   = $input['unidade'] ?? unidade::get(); // Pega a unidade do input ou a da sessão

if (empty($placa) || empty($unidade)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Placa e Unidade são obrigatórios.']);
    exit;
}

if (empty($ctes) && empty($ctes_hub)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Nenhum CT-e fornecido para o carregamento.']);
    exit;
}

try {
    $chaves_cte = [];

    // 1. Extrai as chaves dos CT-es originais
    foreach ($ctes as $cte) {
        if (isset($cte['chave'])) {
            $chaves_cte[] = $cte['chave'];
        }
    }

    // 2. Extrai e adiciona as chaves dos CT-es do Hub, evitando duplicatas
    foreach ($ctes_hub as $cte_hub) {
        if (isset($cte_hub['chave_cte']) && !in_array($cte_hub['chave_cte'], $chaves_cte)) {
            $chaves_cte[] = $cte_hub['chave_cte'];
        }
    }

    if(empty($chaves_cte)){
        throw new Exception("Não foi possível extrair nenhuma chave de CT-e para manifestar.");
    }

    // 3. Monta os parâmetros para a chamada SSW
    $params = [
        'unidade' => $unidade,
        'placa' => $placa,
        'chavecfe' => implode(',', $chaves_cte) // SSW espera uma string separada por vírgulas
    ];

    // 4. Chama o endpoint da SSW para criar o manifesto
    $resultadoSSW = SSW::post('manifesto-carga-v2', $params);

    // 5. Verifica a resposta da SSW
    if (isset($resultadoSSW['status']) && $resultadoSSW['status'] === 'ERRO') {
        throw new Exception($resultadoSSW['mensagem'] ?? 'Erro desconhecido ao gerar manifesto na SSW.');
    }

    // Se chegou aqui, o manifesto foi gerado com sucesso.
    echo json_encode(['status' => 'success', 'message' => 'Manifesto gerado com sucesso!']);

} catch (Exception $e) {
    http_response_code(500);
    error_log("Erro em salvar_carregamento.php: " . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

?>
