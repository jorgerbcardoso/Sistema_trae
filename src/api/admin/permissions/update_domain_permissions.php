<?php
/**
 * API: Atualizar Permissões de um Domínio
 * POST /presto/api/admin/permissions/update_domain_permissions.php
 *
 * Atualiza as permissões de acesso de um domínio
 * Apenas usuários do domínio XXX podem acessar
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/../../middleware/auth.php';
require_once __DIR__ . '/../../Database.php';

try {
    // Verificar autenticação
    $authResult = verifyAuth();
    if (!$authResult['valid']) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => $authResult['message']
        ]);
        exit();
    }

    $domain = $authResult['domain'];

    // Verificar se é super admin
    if ($domain !== 'XXX') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE ATUALIZAR PERMISSÕES.'
        ]);
        exit();
    }

    // Receber dados
    $data = json_decode(file_get_contents('php://input'), true);

    if (empty($data['domain']) || empty($data['permissions'])) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'DOMÍNIO E PERMISSÕES SÃO OBRIGATÓRIOS'
        ]);
        exit();
    }

    $targetDomain = strtoupper(trim($data['domain']));
    $permissions = $data['permissions'];

    $database = new Database();
    $db = $database->getConnection();

    pg_query($db, 'BEGIN');

    $updated = 0;
    $inserted = 0;

    try {
        foreach ($permissions as $perm) {
            $itemId = $perm['item_id'];
            $canAccess = $perm['can_access'] ? 'true' : 'false';
            $canCreate = $perm['can_create'] ? 'true' : 'false';
            $canEdit = $perm['can_edit'] ? 'true' : 'false';
            $canDelete = $perm['can_delete'] ? 'true' : 'false';
            $canExport = $perm['can_export'] ? 'true' : 'false';

            // Verificar se já existe
            $checkQuery = "
                SELECT id FROM permissions
                WHERE domain = $1 AND menu_item_id = $2
            ";
            $checkResult = pg_query_params($db, $checkQuery, [$targetDomain, $itemId]);

            if (!$checkResult) {
                throw new Exception('Erro ao verificar permissão existente');
            }

            $exists = pg_fetch_assoc($checkResult);

            if ($exists) {
                // Atualizar
                $updateQuery = "
                    UPDATE permissions
                    SET can_access = {$canAccess},
                        can_create = {$canCreate},
                        can_edit = {$canEdit},
                        can_delete = {$canDelete},
                        can_export = {$canExport},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE domain = $1 AND menu_item_id = $2
                ";
                $result = pg_query_params($db, $updateQuery, [$targetDomain, $itemId]);

                if (!$result) {
                    throw new Exception('Erro ao atualizar permissão');
                }

                $updated++;
            } else {
                // Inserir
                $insertQuery = "
                    INSERT INTO permissions
                    (domain, menu_item_id, can_access, can_create, can_edit, can_delete, can_export, created_at)
                    VALUES ($1, $2, {$canAccess}, {$canCreate}, {$canEdit}, {$canDelete}, {$canExport}, CURRENT_TIMESTAMP)
                ";
                $result = pg_query_params($db, $insertQuery, [$targetDomain, $itemId]);

                if (!$result) {
                    throw new Exception('Erro ao inserir permissão');
                }

                $inserted++;
            }
        }

        pg_query($db, 'COMMIT');

        echo json_encode([
            'success' => true,
            'message' => 'PERMISSÕES ATUALIZADAS COM SUCESSO',
            'domain' => $targetDomain,
            'updated' => $updated,
            'inserted' => $inserted
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    } catch (Exception $e) {
        pg_query($db, 'ROLLBACK');
        throw $e;
    }

} catch (Exception $e) {
    error_log("Erro ao atualizar permissões: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO ATUALIZAR PERMISSÕES',
        'error' => $e->getMessage()
    ]);
}
