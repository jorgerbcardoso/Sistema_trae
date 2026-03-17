<?php
/**
 * EXEMPLO: EXPORTAR ARQUIVO COM MENSAGEM DE SUCESSO PERSONALIZADA
 * 
 * Este arquivo demonstra como enviar um arquivo (CSV, PDF, etc) para download
 * E TAMBÉM enviar uma mensagem toast personalizada que será exibida ao usuário.
 * 
 * A solução usa HEADERS HTTP customizados:
 * - X-Toast-Type: tipo do toast (success, error, warning, info)
 * - X-Toast-Message: mensagem a ser exibida
 * 
 * ============================================
 * IMPORTANTE: ORDEM DOS HEADERS
 * ============================================
 * 
 * 1. headers customizados (X-Toast-*)
 * 2. header() para Content-Type
 * 3. header() para Content-Disposition
 * 4. header() para Content-Length (opcional)
 * 5. echo do conteúdo
 * 
 * Todos os headers devem vir ANTES de qualquer output (echo, print, etc)!
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/auth.php';

// Autenticação
$user = authMiddleware();

// Receber dados
$input = json_decode(file_get_contents('php://input'), true);
$period = $input['period'] ?? null;
$viewMode = $input['viewMode'] ?? 'GERAL';

try {
    // Conectar ao banco
    $db = getDatabaseConnection();
    
    // ============================================
    // EXEMPLO 1: Exportar CSV com mensagem de sucesso
    // ============================================
    
    // Buscar dados do banco
    $query = "SELECT * FROM receitas WHERE year = $1 LIMIT 1000";
    $result = pg_query_params($db, $query, [$period['year']]);
    
    if (!$result) {
        throw new Exception('Erro ao buscar dados: ' . pg_last_error($db));
    }
    
    $rowCount = pg_num_rows($result);
    
    // Se não houver dados
    if ($rowCount === 0) {
        // ❌ CASO 1: Retornar erro via JSON (NÃO envia arquivo)
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error' => 'Nenhum dado encontrado para o período selecionado',
            'toast' => [
                'type' => 'warning',
                'message' => 'Nenhuma receita encontrada para este período'
            ]
        ]);
        exit;
    }
    
    // ✅ CASO 2: Dados encontrados - enviar arquivo + mensagem
    
    // Preparar CSV
    $csv = [];
    $csv[] = ['ID', 'Data', 'Descrição', 'Valor', 'Categoria'];
    
    while ($row = pg_fetch_assoc($result)) {
        $csv[] = [
            $row['id'],
            $row['data'],
            $row['descricao'],
            $row['valor'],
            $row['categoria']
        ];
    }
    
    // Gerar conteúdo CSV
    $output = fopen('php://temp', 'w');
    foreach ($csv as $line) {
        fputcsv($output, $line);
    }
    rewind($output);
    $csvContent = stream_get_contents($output);
    fclose($output);
    
    // ✨ PASSO 1: Definir headers do arquivo
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="receitas_' . $period['year'] . '.csv"');
    header('Content-Length: ' . strlen($csvContent));
    
    // ✨ PASSO 2: Adicionar headers customizados com a mensagem toast
    header('X-Toast-Type: success');
    header('X-Toast-Message: Exportação concluída! ' . $rowCount . ' receitas exportadas com sucesso.');
    
    // ✨ PASSO 3: Enviar o arquivo
    echo $csvContent;
    
    // ============================================
    // O frontend irá:
    // 1. Baixar o arquivo automaticamente
    // 2. Ler os headers X-Toast-Type e X-Toast-Message
    // 3. Exibir toast.success("Exportação concluída! 150 receitas...")
    // ============================================
    
    pg_close($db);
    exit;
    
} catch (Exception $e) {
    error_log("Erro ao exportar receitas: " . $e->getMessage());
    
    // ❌ Em caso de erro, retornar JSON
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'toast' => [
            'type' => 'error',
            'message' => 'Erro ao gerar planilha. Por favor, tente novamente.'
        ]
    ]);
    exit;
}

// ============================================
// EXEMPLO 2: Exportar PDF com mensagem
// ============================================
function exportPDFWithMessage($data, $filename) {
    // Gerar PDF (usando FPDF, TCPDF, etc)
    $pdfContent = generatePDF($data);
    
    // Headers do arquivo
    header('Content-Type: application/pdf');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . strlen($pdfContent));
    
    // ✨ Mensagem personalizada
    header('X-Toast-Type: success');
    header('X-Toast-Message: Relatório PDF gerado com sucesso! Total de ' . count($data) . ' registros.');
    
    // Enviar arquivo
    echo $pdfContent;
}

// ============================================
// EXEMPLO 3: Múltiplas mensagens possíveis
// ============================================
function exportWithDynamicMessage($rowCount) {
    // Lógica para decidir a mensagem
    if ($rowCount === 0) {
        // Retornar JSON sem arquivo
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'toast' => [
                'type' => 'warning',
                'message' => 'Nenhum dado encontrado para exportar'
            ]
        ]);
        exit;
    }
    
    if ($rowCount > 10000) {
        // Warning se arquivo for muito grande
        header('X-Toast-Type: warning');
        header('X-Toast-Message: Arquivo muito grande (' . $rowCount . ' linhas). O download pode demorar.');
    } else if ($rowCount > 1000) {
        // Info se arquivo for grande
        header('X-Toast-Type: info');
        header('X-Toast-Message: Exportando ' . $rowCount . ' registros...');
    } else {
        // Success normal
        header('X-Toast-Type: success');
        header('X-Toast-Message: Exportação concluída! ' . $rowCount . ' registros exportados.');
    }
    
    // ... continuar com envio do arquivo
}

// ============================================
// RESUMO DO FLUXO:
// ============================================
/*

PHP:
1. Processar requisição
2. Buscar dados do banco
3. Gerar arquivo (CSV/PDF/Excel)
4. Definir headers do arquivo (Content-Type, Content-Disposition)
5. Adicionar headers customizados (X-Toast-Type, X-Toast-Message)
6. Enviar arquivo

FRONTEND (downloadHelper.ts):
1. Fazer fetch da URL
2. Verificar se Content-Type é JSON (erro) ou arquivo (sucesso)
3. Se for arquivo, baixar
4. Ler headers X-Toast-Type e X-Toast-Message
5. Exibir toast com a mensagem personalizada do PHP

*/
?>