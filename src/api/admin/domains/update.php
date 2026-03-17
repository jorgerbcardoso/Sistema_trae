<?php
/**
 * API: Atualizar Domínio
 * PUT /presto/api/admin/domains/update.php
 * 
 * Atualiza informações de um domínio existente
 * Apenas usuários do domínio XXX podem acessar
 */

require_once __DIR__ . '/../../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod(['PUT', 'POST']);

try {
    // Obter usuário autenticado
    $user = getCurrentUser();
    
    if (!$user) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'NÃO AUTENTICADO'
        ]);
        exit();
    }

    $domain = $user['domain'];

    // Verificar se é super admin
    if ($domain !== 'XXX') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE ATUALIZAR DOMÍNIOS.'
        ]);
        exit();
    }

    // Receber dados
    $data = getRequestInput();

    // Validar
    if (empty($data['domain'])) {
        msg('DOMÍNIO É OBRIGATÓRIO', 'error');
    }

    $targetDomain = strtoupper(trim($data['domain']));

    // Verificar se o domínio existe
    $checkQuery = "SELECT COUNT(*) as total FROM domains WHERE domain = $1";
    $result = sql($checkQuery, [$targetDomain]);
    $exists = pg_fetch_assoc($result);

    if ($exists['total'] == 0) {
        msg('DOMÍNIO NÃO ENCONTRADO', 'error');
    }

    // Preparar dados para atualização
    $fields = [];
    $values = [];
    $paramIndex = 1;

    // Campos que podem ser atualizados
    $allowedFields = [
        'name', 'cnpj', 'phone', 'address', 'website', 'email',
        'modalidade', 'favicon_url', 'controla_linhas', 'use_mock_data', 'aprova_pedidos_manuais',
        'ssw_domain', 'ssw_username', 'ssw_password', 'ssw_cpf',
        'logo_light', 'logo_dark'
    ];

    foreach ($allowedFields as $field) {
        if (isset($data[$field])) {
            // Para campos booleanos, converter para PostgreSQL
            if ($field === 'controla_linhas' || $field === 'use_mock_data' || $field === 'aprova_pedidos_manuais') {
                $value = phpBoolToPg($data[$field]);
            } 
            // Para campos de texto, converter para MAIÚSCULAS
            else if (in_array($field, ['name', 'address'])) {
                $value = strtoupper($data[$field]);
            }
            else {
                $value = $data[$field];
            }
            
            $fields[] = "$field = $" . $paramIndex;
            $values[] = $value;
            $paramIndex++;
        }
    }

    if (empty($fields)) {
        msg('NENHUM CAMPO PARA ATUALIZAR', 'error');
    }

    // Adicionar updated_at
    $fields[] = "updated_at = NOW()";

    // Adicionar domínio como último parâmetro
    $values[] = $targetDomain;

    // Montar query
    $updateQuery = "
        UPDATE domains 
        SET " . implode(', ', $fields) . "
        WHERE domain = $" . $paramIndex;

    sql($updateQuery, $values);

    echo json_encode([
        'success' => true,
        'message' => 'DOMÍNIO ATUALIZADO COM SUCESSO',
        'domain' => $targetDomain
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

} catch (Exception $e) {
    error_log("Erro ao atualizar domínio: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO ATUALIZAR DOMÍNIO',
        'error' => $e->getMessage()
    ]);
}