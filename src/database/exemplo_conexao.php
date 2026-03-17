<?php
/**
 * EXEMPLO DE CONEXÃO E USO DO BANCO DE DADOS POSTGRESQL
 * SISTEMA PRESTO - API Backend
 */

// ============================================================================
// 1. CONFIGURAÇÃO DA CONEXÃO
// ============================================================================

class Database {
    private $host = 'localhost';
    private $dbname = 'presto_db';
    private $username = 'postgres';
    private $password = 'presto123';
    private $port = '5432';
    private $pdo;

    public function __construct() {
        $this->connect();
    }

    private function connect() {
        try {
            $dsn = "pgsql:host={$this->host};port={$this->port};dbname={$this->dbname}";
            $this->pdo = new PDO($dsn, $this->username, $this->password);
            $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            error_log("✅ Conectado ao PostgreSQL - Banco: {$this->dbname}");
        } catch(PDOException $e) {
            error_log("❌ Erro ao conectar ao PostgreSQL: " . $e->getMessage());
            throw new Exception("Erro ao conectar ao banco de dados");
        }
    }

    public function getConnection() {
        return $this->pdo;
    }
}

// ============================================================================
// 2. CLASSE DE AUTENTICAÇÃO
// ============================================================================

class Auth {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * Login do usuário
     * 
     * @param string $domain Código do domínio (3 letras)
     * @param string $username Nome de usuário
     * @param string $password Senha
     * @return array Dados do usuário autenticado
     * @throws Exception Se credenciais inválidas
     */
    public function login($domain, $username, $password) {
        try {
            $sql = "SELECT 
                        u.id,
                        u.domain,
                        u.username,
                        u.email,
                        u.full_name,
                        u.is_active,
                        u.is_admin,
                        d.name AS client_name,
                        d.modalidade,
                        d.favicon_url,
                        d.is_super_admin
                    FROM users u
                    JOIN domains d ON u.domain = d.domain
                    WHERE UPPER(u.domain) = UPPER(:domain)
                      AND LOWER(u.username) = LOWER(:username)
                      AND u.is_active = TRUE
                      AND d.is_active = TRUE";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':domain' => $domain,
                ':username' => $username
            ]);

            $user = $stmt->fetch();

            if (!$user) {
                throw new Exception('Usuário não encontrado ou inativo');
            }

            // Verificar senha
            if (!password_verify($password, $user['password_hash'] ?? '')) {
                throw new Exception('Senha incorreta');
            }

            // Atualizar last_login
            $this->updateLastLogin($user['id']);

            // Remover password_hash da resposta
            unset($user['password_hash']);

            return [
                'success' => true,
                'token' => $this->generateToken($user['id']),
                'user' => $user
            ];

        } catch(Exception $e) {
            error_log("❌ Erro no login: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Atualizar timestamp de último login
     */
    private function updateLastLogin($userId) {
        $sql = "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = :id";
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $userId]);
    }

    /**
     * Gerar token JWT (simplificado - usar biblioteca JWT em produção)
     */
    private function generateToken($userId) {
        return base64_encode(json_encode([
            'user_id' => $userId,
            'timestamp' => time(),
            'hash' => hash('sha256', $userId . time() . 'SECRET_KEY')
        ]));
    }
}

// ============================================================================
// 3. CLASSE DE MENU
// ============================================================================

class Menu {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * Obter menu completo com permissões do domínio
     * 
     * @param string $domain Código do domínio
     * @param string $username Nome do usuário (para verificar se é admin)
     * @return array Menu estruturado com permissões
     */
    public function getMenu($domain, $username = null) {
        try {
            // Verificar se é admin
            $isAdmin = $this->isAdmin($domain, $username);

            $sql = "SELECT 
                        ms.id AS section_id,
                        ms.code AS section_code,
                        ms.name AS section_name,
                        ms.description AS section_description,
                        ms.icon AS section_icon,
                        ms.display_order AS section_order,
                        mi.id AS item_id,
                        mi.code AS item_code,
                        mi.name AS item_name,
                        mi.description AS item_description,
                        mi.icon AS item_icon,
                        mi.route_path,
                        mi.component_path,
                        mi.is_available,
                        mi.status,
                        dp.can_access,
                        dp.can_create,
                        dp.can_edit,
                        dp.can_delete,
                        dp.can_export
                    FROM menu_sections ms
                    JOIN menu_items mi ON ms.id = mi.section_id
                    LEFT JOIN domain_permissions dp ON mi.id = dp.menu_item_id 
                        AND UPPER(dp.domain) = UPPER(:domain)
                    WHERE dp.can_access = TRUE
                    ORDER BY ms.display_order, mi.id";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([':domain' => $domain]);

            $results = $stmt->fetchAll();

            // Estruturar menu por seções
            $menu = [];
            $sections = [];

            foreach ($results as $row) {
                $sectionId = $row['section_id'];

                // Criar seção se não existir
                if (!isset($sections[$sectionId])) {
                    $sections[$sectionId] = [
                        'id' => $row['section_id'],
                        'code' => $row['section_code'],
                        'name' => $row['section_name'],
                        'description' => $row['section_description'],
                        'icon' => $row['section_icon'],
                        'display_order' => $row['section_order'],
                        'items' => []
                    ];
                }

                // Adicionar item à seção
                $sections[$sectionId]['items'][] = [
                    'id' => $row['item_id'],
                    'code' => $row['item_code'],
                    'name' => $row['item_name'],
                    'description' => $row['item_description'],
                    'icon' => $row['item_icon'],
                    'route_path' => $row['route_path'],
                    'component_path' => $row['component_path'],
                    'is_available' => $row['is_available'],
                    'status' => $row['status'],
                    'permissions' => [
                        'can_access' => $row['can_access'],
                        'can_create' => $row['can_create'],
                        'can_edit' => $row['can_edit'],
                        'can_delete' => $row['can_delete'],
                        'can_export' => $row['can_export']
                    ]
                ];
            }

            // Converter para array indexado
            $menu = ['sections' => array_values($sections)];

            return [
                'success' => true,
                'menu' => $menu
            ];

        } catch(Exception $e) {
            error_log("❌ Erro ao buscar menu: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Verificar se usuário é admin
     */
    private function isAdmin($domain, $username) {
        if (!$username) {
            return false;
        }

        $sql = "SELECT is_admin FROM users 
                WHERE UPPER(domain) = UPPER(:domain) 
                  AND LOWER(username) = LOWER(:username)";
        
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':domain' => $domain,
            ':username' => $username
        ]);

        $user = $stmt->fetch();
        return $user && $user['is_admin'];
    }
}

// ============================================================================
// 4. CLASSE DE DOMÍNIOS
// ============================================================================

class Domains {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * Listar todos os domínios
     */
    public function getAll() {
        try {
            $sql = "SELECT * FROM v_domains_stats ORDER BY domain";
            $stmt = $this->db->query($sql);
            $domains = $stmt->fetchAll();

            return [
                'success' => true,
                'domains' => $domains,
                'total' => count($domains)
            ];

        } catch(Exception $e) {
            error_log("❌ Erro ao buscar domínios: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Obter informações de um domínio específico
     */
    public function get($domain) {
        try {
            $sql = "SELECT * FROM v_domains_stats WHERE UPPER(domain) = UPPER(:domain)";
            $stmt = $this->db->prepare($sql);
            $stmt->execute([':domain' => $domain]);

            $domainData = $stmt->fetch();

            if (!$domainData) {
                throw new Exception('Domínio não encontrado');
            }

            return [
                'success' => true,
                'domain' => $domainData
            ];

        } catch(Exception $e) {
            error_log("❌ Erro ao buscar domínio: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Criar novo domínio
     */
    public function create($data) {
        try {
            $sql = "SELECT * FROM create_new_domain(
                        :domain,
                        :name,
                        :client_name,
                        :modalidade,
                        :favicon_url
                    )";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':domain' => strtoupper($data['domain']),
                ':name' => $data['name'],
                ':client_name' => $data['client_name'],
                ':modalidade' => $data['modalidade'] ?? 'CARGAS',
                ':favicon_url' => $data['favicon_url'] ?? null
            ]);

            $result = $stmt->fetch();

            return [
                'success' => true,
                'message' => 'Domínio criado com sucesso',
                'domain' => $result['domain'],
                'users_created' => explode(',', trim($result['users_created'], '{}')),
                'default_password' => $result['default_password']
            ];

        } catch(Exception $e) {
            error_log("❌ Erro ao criar domínio: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Atualizar favicon de um domínio
     */
    public function updateFavicon($domain, $faviconUrl) {
        try {
            $sql = "UPDATE domains 
                    SET favicon_url = :favicon_url,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE UPPER(domain) = UPPER(:domain)";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([
                ':domain' => $domain,
                ':favicon_url' => $faviconUrl ?: null
            ]);

            return [
                'success' => true,
                'message' => 'Favicon atualizado com sucesso'
            ];

        } catch(Exception $e) {
            error_log("❌ Erro ao atualizar favicon: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}

// ============================================================================
// 5. CLASSE DE USUÁRIOS
// ============================================================================

class Users {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * Listar usuários de um domínio
     */
    public function getByDomain($domain) {
        try {
            $sql = "SELECT 
                        id,
                        domain,
                        username,
                        email,
                        full_name,
                        is_active,
                        is_admin,
                        created_at,
                        last_login
                    FROM users
                    WHERE UPPER(domain) = UPPER(:domain)
                    ORDER BY username";

            $stmt = $this->db->prepare($sql);
            $stmt->execute([':domain' => $domain]);

            $users = $stmt->fetchAll();

            return [
                'success' => true,
                'users' => $users,
                'total' => count($users)
            ];

        } catch(Exception $e) {
            error_log("❌ Erro ao buscar usuários: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }
}

// ============================================================================
// 6. EXEMPLO DE USO
// ============================================================================

// Inicializar conexão
$database = new Database();
$pdo = $database->getConnection();

// Exemplo 1: Login
echo "\n========== TESTE 1: LOGIN ==========\n";
$auth = new Auth($pdo);
$loginResult = $auth->login('VCS', 'presto', 'presto123');
print_r($loginResult);

// Exemplo 2: Obter Menu
echo "\n========== TESTE 2: MENU ==========\n";
$menu = new Menu($pdo);
$menuResult = $menu->getMenu('VCS', 'presto');
print_r($menuResult);

// Exemplo 3: Listar Domínios
echo "\n========== TESTE 3: DOMÍNIOS ==========\n";
$domains = new Domains($pdo);
$domainsResult = $domains->getAll();
print_r($domainsResult);

// Exemplo 4: Listar Usuários
echo "\n========== TESTE 4: USUÁRIOS ==========\n";
$users = new Users($pdo);
$usersResult = $users->getByDomain('VCS');
print_r($usersResult);

// Exemplo 5: Atualizar Favicon
echo "\n========== TESTE 5: ATUALIZAR FAVICON ==========\n";
$updateFaviconResult = $domains->updateFavicon('VCS', 'https://sistema.webpresto.com.br/images/logos_clientes/vcs.png');
print_r($updateFaviconResult);

?>
