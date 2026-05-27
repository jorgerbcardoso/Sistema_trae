<?php
require_once '../../../config.php';
require_once '../../lib/lib.php';

use App\Util\dominio;
use App\Util\unidade;

header('Content-Type: application/json');

// Garante que o método de requisição seja POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método não permitido']);
    exit;
}

try {
    $unidade_atual = unidade::get();
    $dominio = dominio::get();

    if (empty($unidade_atual) || empty($dominio)) {
        throw new Exception("Não foi possível determinar a unidade ou domínio atual.");
    }

    $sql = "SELECT unidades_compart FROM {$dominio}_unidades WHERE sigla = '{$unidade_atual}'";
    $result = pg_query($ch_pg, $sql);

    if (!$result) {
        throw new Exception('Erro ao consultar o banco de dados para unidades compartilhadas.');
    }

    $row = pg_fetch_assoc($result);

    // Se não encontrar ou o campo estiver vazio, retorna um array vazio com sucesso
    if (!$row || empty($row['unidades_compart'])) {
        echo json_encode(['status' => 'success', 'data' => []]);
        exit;
    }

    // Separa a string por vírgulas, remove espaços em branco e filtra valores vazios
    $unidades_compart = array_filter(array_map('trim', explode(',', $row['unidades_compart'])));

    // Garante que o array seja reindexado se houver filtros
    echo json_encode(['status' => 'success', 'data' => array_values($unidades_compart)]);

} catch (Exception $e) {
    http_response_code(500);
    error_log("Erro em get_unidades_compartilhadas.php: " . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>