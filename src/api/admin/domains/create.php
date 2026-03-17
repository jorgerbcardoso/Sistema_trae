<?php
/**
 * API: Criar Domínios
 * POST /presto/api/admin/domains/create.php
 * 
 * Cria um novo domínio (empresa) no sistema
 * Apenas usuários do domínio XXX podem acessar
 */

require_once __DIR__ . '/../../config.php';

setupCORS();
handleOptionsRequest();
validateRequestMethod('POST');

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
            'message' => 'ACESSO NEGADO. APENAS SUPER ADMIN PODE CRIAR DOMÍNIOS.'
        ]);
        exit();
    }

    // Receber dados
    $data = getRequestInput();

    // Validar
    if (empty($data['domain'])) {
        msg('DOMÍNIO É OBRIGATÓRIO', 'error');
    }

    if (empty($data['name'])) {
        msg('NOME DA EMPRESA É OBRIGATÓRIO', 'error');
    }

    $newDomain = strtoupper(trim($data['domain']));

    // Validar formato (3 letras)
    if (!preg_match('/^[A-Z]{3}$/', $newDomain)) {
        msg('DOMÍNIO DEVE TER EXATAMENTE 3 LETRAS MAIÚSCULAS', 'error');
    }

    // Verificar se já existe
    $checkQuery = "SELECT COUNT(*) as total FROM domains WHERE domain = $1";
    $result = sql($checkQuery, [$newDomain]);
    $exists = pg_fetch_assoc($result);

    if ($exists['total'] > 0) {
        msg('DOMÍNIO JÁ EXISTE', 'error');
    }

    // Preparar dados do domínio
    $name = strtoupper($data['name'] ?? '');
    $cnpj = $data['cnpj'] ?? '';
    $phone = $data['phone'] ?? '';
    $address = strtoupper($data['address'] ?? '');
    $website = $data['website'] ?? '';
    $email = $data['email'] ?? '';
    $modalidade = $data['modalidade'] ?? 'CARGAS';
    $favicon_url = $data['favicon_url'] ?? '';
    $controla_linhas = phpBoolToPg($data['controla_linhas'] ?? false);
    $use_mock_data = phpBoolToPg($data['use_mock_data'] ?? true);
    $ssw_domain = $data['ssw_domain'] ?? '';
    $ssw_username = $data['ssw_username'] ?? '';
    $ssw_password = $data['ssw_password'] ?? '';
    $ssw_cpf = $data['ssw_cpf'] ?? '';
    $logo_light = $data['logo_light'] ?? '';
    $logo_dark = $data['logo_dark'] ?? '';
    $is_active = phpBoolToPg(true);

    // Iniciar transação
    sql('BEGIN');

    try {
        // Criar registro na tabela domains
        $insertDomain = "
            INSERT INTO domains (
                domain, name, cnpj, phone, address, website, email,
                modalidade, favicon_url, controla_linhas, use_mock_data,
                ssw_domain, ssw_username, ssw_password, ssw_cpf,
                logo_light, logo_dark, is_active, created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                $12, $13, $14, $15, $16, $17, $18, NOW()
            )
        ";
        
        sql($insertDomain, [
            $newDomain, $name, $cnpj, $phone, $address, $website, $email,
            $modalidade, $favicon_url, $controla_linhas, $use_mock_data,
            $ssw_domain, $ssw_username, $ssw_password, $ssw_cpf,
            $logo_light, $logo_dark, $is_active
        ]);

        // Criar usuários padrão
        $password = hashPassword('presto123');
        
        // Criar usuário "presto"
        $insertUser = "
            INSERT INTO users (domain, username, password_hash, email, full_name, is_active, created_at)
            VALUES ($1, 'presto', $2, $3, $4, $5, NOW())
        ";
        
        $userEmail = "presto@{$newDomain}.com.br";
        $fullName = "USUÁRIO PADRÃO";
        
        sql($insertUser, [
            $newDomain, $password, $userEmail, $fullName, phpBoolToPg(true)
        ]);

        // Criar usuário "admin"
        $insertUser = "
            INSERT INTO users (domain, username, password_hash, email, full_name, is_active, created_at)
            VALUES ($1, 'admin', $2, $3, $4, $5, NOW())
        ";

        $adminEmail = "admin@{$newDomain}.com.br";
        $adminName = "ADMINISTRADOR {$newDomain}";
        
        sql($insertUser, [
            $newDomain, $password, $adminEmail, $adminName, phpBoolToPg(true)
        ]);

        // ✅ NOVO: Inserir TODOS os IDs de menu_items na tabela domain_menu_items
        $permQuery = "
            INSERT INTO domain_menu_items (domain, id)
            SELECT $1, id
            FROM menu_items
        ";
        
        sql($permQuery, [$newDomain]);

        // Commitar transação
        sql('COMMIT');

        echo json_encode([
            'success' => true,
            'message' => 'DOMÍNIO CRIADO COM SUCESSO',
            'domain' => $newDomain,
            'users_created' => ['presto', 'admin'],
            'default_password' => 'presto123'
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

    } catch (Exception $e) {
        sql('ROLLBACK');
        throw $e;
    }

} catch (Exception $e) {
    error_log("Erro ao criar domínio: " . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'ERRO AO CRIAR DOMÍNIO',
        'error' => $e->getMessage()
    ]);
}