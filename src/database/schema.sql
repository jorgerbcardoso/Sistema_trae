-- ============================================================================
-- SISTEMA PRESTO - SCHEMA DO BANCO DE DADOS PostgreSQL
-- ============================================================================
-- Sistema completo de gestão para transportadoras
-- Suporte para: CARGAS | PASSAGEIROS | MISTA
-- White-label com favicon dinâmico por domínio
-- ============================================================================

-- ============================================================================
-- ⚠️ ATENÇÃO: Este script recria TODA a estrutura do banco
-- ============================================================================
-- Este script irá:
-- 1. Dropar TODAS as tabelas existentes
-- 2. Dropar TODOS os tipos customizados (ENUMs)
-- 3. Dropar TODAS as views
-- 4. Dropar TODAS as funções e triggers
-- 5. Recriar tudo do zero com dados mockados
--
-- ⚠️ CUIDADO: Todos os dados serão PERDIDOS!
-- ⚠️ Use apenas em desenvolvimento ou para reset completo
-- ============================================================================

-- Conectar ao banco 'presto'
\c presto;

-- ============================================================================
-- FASE 1: LIMPEZA COMPLETA (DROP de tudo que pode existir)
-- ============================================================================

-- 1.1. Dropar tabelas existentes (na ordem correta devido a FKs)
DROP TABLE IF EXISTS user_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS domains CASCADE;

-- 1.2. Dropar views existentes
DROP VIEW IF EXISTS v_domain_stats CASCADE;
DROP VIEW IF EXISTS v_user_permissions CASCADE;

-- 1.3. Dropar funções e triggers
DROP FUNCTION IF EXISTS update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_domain_stats() CASCADE;

-- 1.4. Dropar tipos customizados (ENUMs)
DROP TYPE IF EXISTS modalidade_enum CASCADE;
DROP TYPE IF EXISTS status_enum CASCADE;

-- ============================================================================
-- FASE 2: CRIAÇÃO DOS TIPOS CUSTOMIZADOS (ENUMS)
-- ============================================================================

-- Modalidade de transporte
CREATE TYPE modalidade_enum AS ENUM ('CARGAS', 'PASSAGEIROS', 'MISTA');

-- Status de desenvolvimento
CREATE TYPE status_enum AS ENUM ('active', 'development', 'inactive');

-- ============================================================================
-- FASE 3: CRIAÇÃO DAS TABELAS
-- ============================================================================

-- 3.1. Tabela: domains (Domínios/Clientes)
CREATE TABLE domains (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    email VARCHAR(255),
    modalidade modalidade_enum NOT NULL DEFAULT 'CARGAS',
    
    -- White-label: Favicon dinâmico
    favicon_url VARCHAR(500) DEFAULT NULL,
    
    -- Controle de funcionalidades
    controla_linhas BOOLEAN DEFAULT FALSE,
    use_mock_data BOOLEAN DEFAULT TRUE,  -- Define se o domínio usa dados mockados ou reais
    
    -- Credenciais SSW (Sistema externo)
    ssw_domain VARCHAR(3),
    ssw_username VARCHAR(50),
    ssw_password VARCHAR(50),
    ssw_cpf VARCHAR(11),
    
    -- Estatísticas
    total_users INTEGER DEFAULT 0,
    total_permissions INTEGER DEFAULT 0,
    
    -- Controle
    is_super_admin BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_domains_domain ON domains(domain);
CREATE INDEX idx_domains_is_active ON domains(is_active);
CREATE INDEX idx_domains_modalidade ON domains(modalidade);
CREATE INDEX idx_domains_is_super_admin ON domains(is_super_admin);
CREATE INDEX idx_domains_use_mock_data ON domains(use_mock_data);

-- Comentários
COMMENT ON TABLE domains IS 'Cadastro de domínios/clientes do sistema';
COMMENT ON COLUMN domains.domain IS 'Código do domínio (3 letras) - Identificador único';
COMMENT ON COLUMN domains.modalidade IS 'Modalidade: CARGAS, PASSAGEIROS ou MISTA';
COMMENT ON COLUMN domains.favicon_url IS 'URL do favicon/logo da empresa (white-label)';
COMMENT ON COLUMN domains.controla_linhas IS 'Define se a empresa utiliza controle de linhas de transporte';
COMMENT ON COLUMN domains.use_mock_data IS 'Define se o domínio usa dados mockados (TRUE) ou dados reais do backend/API externa (FALSE)';
COMMENT ON COLUMN domains.ssw_domain IS 'Credencial SSW - Domínio (3 letras maiúsculas)';
COMMENT ON COLUMN domains.ssw_username IS 'Credencial SSW - Usuário (minúsculas)';
COMMENT ON COLUMN domains.ssw_password IS 'Credencial SSW - Senha (minúsculas)';
COMMENT ON COLUMN domains.ssw_cpf IS 'Credencial SSW - CPF (11 dígitos)';

-- 3.2. Tabela: users (Usuários)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(3) NOT NULL REFERENCES domains(domain) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    
    -- Controle
    is_active BOOLEAN DEFAULT TRUE,
    is_admin BOOLEAN DEFAULT FALSE,
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    
    -- Constraint: username único por domínio
    CONSTRAINT unique_username_per_domain UNIQUE(domain, username)
);

-- Índices
CREATE INDEX idx_users_domain ON users(domain);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_domain_username ON users(domain, username);

-- Comentários
COMMENT ON TABLE users IS 'Usuários do sistema (multi-tenant por domínio)';
COMMENT ON COLUMN users.domain IS 'Domínio ao qual o usuário pertence';
COMMENT ON COLUMN users.username IS 'Nome de usuário (único dentro do domínio)';
COMMENT ON COLUMN users.password_hash IS 'Hash bcrypt da senha';

-- 3.3. Tabela: sessions (Sessões de Login - AUTENTICAÇÃO SEGURA)
CREATE TABLE sessions (
    id SERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain VARCHAR(3) NOT NULL REFERENCES domains(domain) ON DELETE CASCADE,
    
    -- Controle de expiração
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Auditoria de segurança
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Controle
    is_active BOOLEAN DEFAULT TRUE
);

-- Índices para performance
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_domain ON sessions(domain);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_is_active ON sessions(is_active);
CREATE INDEX idx_sessions_token_active ON sessions(token, is_active) WHERE is_active = TRUE;

-- Comentários
COMMENT ON TABLE sessions IS 'Sessões de login ativas com tokens de autenticação';
COMMENT ON COLUMN sessions.token IS 'Token hexadecimal de 64 caracteres gerado no login';
COMMENT ON COLUMN sessions.expires_at IS 'Data/hora de expiração do token (padrão: 24h)';
COMMENT ON COLUMN sessions.last_activity IS 'Última atividade para renovação automática';
COMMENT ON COLUMN sessions.ip_address IS 'IP do cliente (auditoria de segurança)';
COMMENT ON COLUMN sessions.user_agent IS 'User-Agent do navegador (auditoria)';

-- 3.4. Tabela: password_reset_tokens (Tokens de Recuperação de Senha)
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_used ON password_reset_tokens(used);

-- Comentários
COMMENT ON TABLE password_reset_tokens IS 'Tokens de recuperação de senha com validade de 1 hora';
COMMENT ON COLUMN password_reset_tokens.token IS 'Token hexadecimal de 64 caracteres para recuperação';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Data/hora de expiração do token (1 hora)';
COMMENT ON COLUMN password_reset_tokens.used IS 'Indica se o token já foi utilizado';

-- 3.5. Tabela: access_logs (Logs de Acesso e Ações)
CREATE TABLE access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX idx_access_logs_action ON access_logs(action);
CREATE INDEX idx_access_logs_created_at ON access_logs(created_at);

-- Comentários
COMMENT ON TABLE access_logs IS 'Log de ações e acessos dos usuários para auditoria';
COMMENT ON COLUMN access_logs.action IS 'Tipo de ação (login, logout, password_reset_requested, etc)';

-- 3.6. Tabela: menu_items (Itens do Menu)
CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    route_path VARCHAR(255) NOT NULL,
    component_path VARCHAR(255) NOT NULL,
    
    -- Controle de disponibilidade
    is_available BOOLEAN DEFAULT TRUE,
    status status_enum DEFAULT 'development',
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_menu_items_code ON menu_items(code);
CREATE INDEX idx_menu_items_route_path ON menu_items(route_path);
CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);
CREATE INDEX idx_menu_items_status ON menu_items(status);

-- Comentários
COMMENT ON TABLE menu_items IS 'Itens individuais do menu (funcionalidades do sistema)';
COMMENT ON COLUMN menu_items.code IS 'Código único do item (ex: dashboard_dre)';
COMMENT ON COLUMN menu_items.route_path IS 'Caminho da rota no React Router';
COMMENT ON COLUMN menu_items.component_path IS 'Caminho do componente React';
COMMENT ON COLUMN menu_items.status IS 'Status: active, development ou inactive';

-- 3.7. Tabela: permissions (Permissões)
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(3) NOT NULL,
    menu_item_id INTEGER NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
    
    -- Permissões granulares
    can_access BOOLEAN DEFAULT FALSE,
    can_create BOOLEAN DEFAULT FALSE,
    can_edit BOOLEAN DEFAULT FALSE,
    can_delete BOOLEAN DEFAULT FALSE,
    can_export BOOLEAN DEFAULT FALSE,
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Chave estrangeira e constraint
    FOREIGN KEY (domain) REFERENCES domains(domain) ON DELETE CASCADE,
    UNIQUE (domain, menu_item_id)
);

-- Índices
CREATE INDEX idx_permissions_menu_item_id ON permissions(menu_item_id);
CREATE INDEX idx_permissions_can_access ON permissions(can_access);
CREATE INDEX idx_permissions_domain ON permissions(domain);
CREATE INDEX idx_permissions_domain_menu_item ON permissions(domain, menu_item_id);

-- Comentários
COMMENT ON TABLE permissions IS 'Permissões de acesso (multi-tenant)';
COMMENT ON COLUMN permissions.can_access IS 'Permissão para visualizar';
COMMENT ON COLUMN permissions.can_create IS 'Permissão para criar registros';
COMMENT ON COLUMN permissions.can_edit IS 'Permissão para editar registros';
COMMENT ON COLUMN permissions.can_delete IS 'Permissão para excluir registros';
COMMENT ON COLUMN permissions.can_export IS 'Permissão para exportar dados';

-- 3.8. Tabela: user_permissions (Permissões por Usuário)
CREATE TABLE user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    
    -- Auditoria
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_user_permissions_permission_id ON user_permissions(permission_id);

-- Comentários
COMMENT ON TABLE user_permissions IS 'Permissões de acesso por usuário (multi-tenant)';

-- ============================================================================
-- FASE 4: FUNÇÕES ÚTEIS
-- ============================================================================

-- Função: Atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_domains_updated_at BEFORE UPDATE ON domains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_menu_items_updated_at BEFORE UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_permissions_updated_at BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_user_permissions_updated_at BEFORE UPDATE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Função: Atualizar estatísticas do domínio automaticamente
CREATE OR REPLACE FUNCTION update_domain_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar total de usuários
    UPDATE domains
    SET total_users = (SELECT COUNT(*) FROM users WHERE domain = NEW.domain AND is_active = TRUE)
    WHERE domain = NEW.domain;
    
    -- Atualizar total de permissões
    UPDATE domains
    SET total_permissions = (SELECT COUNT(*) FROM user_permissions WHERE user_id IN (SELECT id FROM users WHERE domain = NEW.domain))
    WHERE domain = NEW.domain;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_domains_stats_after_insert_user AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION update_domain_stats();

CREATE TRIGGER update_domains_stats_after_update_user AFTER UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_domain_stats();

CREATE TRIGGER update_domains_stats_after_delete_user AFTER DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION update_domain_stats();

CREATE TRIGGER update_domains_stats_after_insert_user_permission AFTER INSERT ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION update_domain_stats();

CREATE TRIGGER update_domains_stats_after_update_user_permission AFTER UPDATE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION update_domain_stats();

CREATE TRIGGER update_domains_stats_after_delete_user_permission AFTER DELETE ON user_permissions
    FOR EACH ROW EXECUTE FUNCTION update_domain_stats();

-- ============================================================================
-- FASE 5: INSERIR DADOS: Domínios
-- ============================================================================

INSERT INTO domains (
    domain, name, client_name, website, email, modalidade,
    favicon_url, controla_linhas, use_mock_data, ssw_domain, ssw_username, ssw_password, ssw_cpf,
    total_users, total_permissions, is_super_admin, is_active
) VALUES
-- XXX: Sistema Presto (Super Admin)
(
    'XXX',
    'Sistema Presto',
    'Sistema Presto',
    'webpresto.com.br',
    'admin@webpresto.com.br',
    'CARGAS',
    NULL, -- Favicon padrão
    FALSE,
    TRUE,
    'XXX',
    'presto',
    'web@pres',
    '11111160',
    1,
    16,
    TRUE, -- is_super_admin
    TRUE
),

-- VCS: Viação Cruzeiro do Sul (Modalidade MISTA)
(
    'VCS',
    'Viação Cruzeiro do Sul',
    'Viação Cruzeiro do Sul',
    'vcs.com.br',
    'contato@vcs.com.br',
    'MISTA', -- Transporte de CARGAS + PASSAGEIROS
    NULL, -- Favicon padrão
    TRUE,
    TRUE,
    'VCS',
    'presto',
    'web@pres',
    '11111160',
    5,
    13,
    FALSE,
    TRUE
),

-- ACV: Aceville Transportes (com favicon personalizado)
(
    'ACV',
    'Aceville Transportes',
    'Aceville Transportes',
    'acevilletransportes.com.br',
    'contato@acevilletransportes.com.br',
    'CARGAS',
    'https://sistema.webpresto.com.br/images/logos_clientes/aceville.png', -- Favicon personalizado
    TRUE,
    TRUE,
    'ACV',
    'presto',
    'web@pres',
    '11111160',
    4,
    13,
    FALSE,
    TRUE
);

-- ============================================================================
-- FASE 6: INSERIR DADOS: Usuários
-- ============================================================================

-- NOTA: Senha padrão para todos: "presto123"
-- Hash bcrypt de "presto123": $2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq

INSERT INTO users (domain, username, password_hash, email, full_name, is_active, is_admin) VALUES
-- Usuários do domínio XXX (Sistema Presto)
('XXX', 'presto', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'admin@webpresto.com.br', 'ADMINISTRADOR DO SISTEMA', TRUE, TRUE),

-- Usuários do domínio VCS (Viação Cruzeiro do Sul)
('VCS', 'presto', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'presto@vcs.com.br', 'USUÁRIO PADRÃO', TRUE, TRUE),
('VCS', 'admin', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'admin@vcs.com.br', 'ADMINISTRADOR VCS', TRUE, TRUE),
('VCS', 'joao.silva', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'joao.silva@vcs.com.br', 'JOÃO SILVA', TRUE, FALSE),
('VCS', 'maria.santos', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'maria.santos@vcs.com.br', 'MARIA SANTOS', TRUE, FALSE),
('VCS', 'carlos.oliveira', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'carlos.oliveira@vcs.com.br', 'CARLOS OLIVEIRA', TRUE, FALSE),

-- Usuários do domínio ACV (Aceville Transportes)
('ACV', 'admin', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'admin@aceville.com.br', 'ADMINISTRADOR ACEVILLE', TRUE, TRUE),
('ACV', 'presto', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'presto@aceville.com.br', 'USUÁRIO PADRÃO', TRUE, TRUE),
('ACV', 'financeiro', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'financeiro@aceville.com.br', 'SETOR FINANCEIRO', TRUE, FALSE),
('ACV', 'operacional', '$2y$10$N9qo8uLOickgx2ZMRZoMyIjBg7p9C4FmLKkKkKwLwVkMsQbKNBZQq', 'operacional@aceville.com.br', 'SETOR OPERACIONAL', TRUE, FALSE);

-- ============================================================================
-- FASE 7: INSERIR DADOS: Itens do Menu
-- ============================================================================

INSERT INTO menu_items (id, code, name, description, icon, route_path, component_path, is_available, status) VALUES
-- DASHBOARDS
(1, 'dashboard_dre', 'DRE', 'DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO', 'TrendingUp', '/dashboards/dre', 'dashboards/FinanceiroDashboard', TRUE, 'active'),
(2, 'dashboard_performance_entregas', 'PERFORMANCE DE ENTREGAS', 'ANÁLISE DE ENTREGAS E PRAZOS', 'Truck', '/dashboards/performance-entregas', 'dashboards/PerformanceEntregas', FALSE, 'development'),

-- OPERAÇÕES
(6, 'op_linhas', 'CADASTRO DE LINHAS', 'GERENCIAR LINHAS DE TRANSPORTE', 'Route', '/operacoes/linhas', 'operations/CadastroLinhas', FALSE, 'development'),
(7, 'op_veiculos', 'CADASTRO DE VEÍCULOS', 'GERENCIAR FROTA DE VEÍCULOS', 'Truck', '/operacoes/veiculos', 'operations/CadastroVeiculos', FALSE, 'development'),

-- RELATÓRIOS
(11, 'rel_disponiveis', 'RELAÇÃO DE DISPONÍVEIS', 'VEÍCULOS E MOTORISTAS DISPONÍVEIS', 'CheckSquare', '/relatorios/disponiveis', 'reports/RelacaoDisponiveis', FALSE, 'development'),

-- ADMINISTRAÇÃO
(15, 'admin_usuarios', 'GESTÃO DE USUÁRIOS', 'GERENCIAR USUÁRIOS DO SISTEMA', 'UserPlus', '/gerenciamento/usuarios', 'UserManagement', TRUE, 'active'),
(16, 'admin_dominios', 'GESTÃO DE DOMÍNIOS', 'GERENCIAR DOMÍNIOS E MODALIDADES', 'Building2', '/gerenciamento/dominios', 'DomainManagement', TRUE, 'active'),
(17, 'admin_permissoes', 'GESTÃO DE PERMISSÕES', 'DEFINIR PERMISSÕES DE ACESSO POR DOMÍNIO', 'Shield', '/admin/permissoes', 'admin/GestaoPermissoes', FALSE, 'development');

-- Resetar sequence
SELECT setval('menu_items_id_seq', (SELECT MAX(id) FROM menu_items));

-- ============================================================================
-- FASE 8: INSERIR DADOS: Permissões
-- ============================================================================

-- 8.1. Permissões básicas para todos os itens do menu
INSERT INTO permissions (domain, menu_item_id, can_access, can_create, can_edit, can_delete, can_export)
SELECT 
    d.domain,
    id,
    TRUE, -- can_access
    FALSE, -- can_create
    FALSE, -- can_edit
    FALSE, -- can_delete
    TRUE   -- can_export
FROM domains d
JOIN menu_items ON TRUE;

-- 8.2. Permissões do domínio XXX (Super Admin - Acesso Total)
INSERT INTO user_permissions (user_id, permission_id)
SELECT 
    u.id,
    p.id
FROM users u
JOIN permissions p ON TRUE
WHERE u.domain = 'XXX';

-- 8.3. Permissões do domínio VCS (Acesso Limitado)
-- VCS tem acesso a dashboards, operações e relatórios (sem administração completa)
INSERT INTO user_permissions (user_id, permission_id)
SELECT 
    u.id,
    p.id
FROM users u
JOIN permissions p ON p.menu_item_id IN (
    SELECT id FROM menu_items WHERE section_id IN (1, 2, 3) -- Dashboards, Operações, Relatórios
)
WHERE u.domain = 'VCS';

-- VCS tem acesso apenas à Gestão de Usuários (não Domínios/Permissões)
INSERT INTO user_permissions (user_id, permission_id)
SELECT 
    u.id,
    p.id
FROM users u
JOIN permissions p ON p.menu_item_id = 15 -- admin_usuarios
WHERE u.domain = 'VCS';

-- 8.4. Permissões do domínio ACV (Acesso Limitado)
-- ACV tem acesso similar ao VCS
INSERT INTO user_permissions (user_id, permission_id)
SELECT 
    u.id,
    p.id
FROM users u
JOIN permissions p ON p.menu_item_id IN (
    SELECT id FROM menu_items WHERE section_id IN (1, 2, 3) -- Dashboards, Operações, Relatórios
)
WHERE u.domain = 'ACV';

-- ACV tem acesso apenas à Gestão de Usuários
INSERT INTO user_permissions (user_id, permission_id)
SELECT 
    u.id,
    p.id
FROM users u
JOIN permissions p ON p.menu_item_id = 15 -- admin_usuarios
WHERE u.domain = 'ACV';

-- ============================================================================
-- FASE 9: VIEWS: Consultas úteis
-- ============================================================================

-- View: Domínios com estatísticas
CREATE OR REPLACE VIEW v_domain_stats AS
SELECT 
    d.domain,
    d.name,
    d.client_name,
    d.modalidade,
    d.favicon_url,
    d.is_super_admin,
    d.is_active,
    COUNT(DISTINCT u.id) AS users_count,
    COUNT(DISTINCT up.permission_id) AS permissions_count,
    d.created_at,
    d.updated_at
FROM domains d
LEFT JOIN users u ON d.domain = u.domain AND u.is_active = TRUE
LEFT JOIN user_permissions up ON u.id = up.user_id
GROUP BY d.domain, d.name, d.client_name, d.modalidade, d.favicon_url, 
         d.is_super_admin, d.is_active, d.created_at, d.updated_at;

COMMENT ON VIEW v_domain_stats IS 'Estatísticas de domínios com contagem de usuários e permissões';

-- View: Menu completo com permissões
CREATE OR REPLACE VIEW v_user_permissions AS
SELECT 
    u.domain,
    u.username,
    u.email,
    u.full_name,
    u.is_active,
    u.is_admin,
    mi.id AS item_id,
    mi.code AS item_code,
    mi.name AS item_name,
    mi.description AS item_description,
    mi.icon AS item_icon,
    mi.route_path,
    mi.component_path,
    mi.is_available,
    mi.status,
    p.can_access,
    p.can_create,
    p.can_edit,
    p.can_delete,
    p.can_export
FROM users u
JOIN user_permissions up ON u.id = up.user_id
JOIN permissions p ON up.permission_id = p.id
JOIN menu_items mi ON p.menu_item_id = mi.id
ORDER BY u.domain, u.username, mi.id;

COMMENT ON VIEW v_user_permissions IS 'Menu completo com permissões por usuário';

-- ============================================================================
-- FASE 10: QUERIES DE VERIFICAÇÃO
-- ============================================================================

-- Listar domínios
SELECT * FROM v_domain_stats ORDER BY domain;

-- Listar usuários por domínio
SELECT domain, username, email, full_name, is_active, is_admin, created_at
FROM users
ORDER BY domain, username;

-- Listar permissões do domínio XXX
SELECT 
    ms.name AS secao,
    mi.name AS funcionalidade,
    dp.can_access,
    dp.can_create,
    dp.can_edit,
    dp.can_delete,
    dp.can_export
FROM domain_permissions dp
JOIN menu_items mi ON dp.menu_item_id = mi.id
JOIN menu_sections ms ON mi.section_id = ms.id
WHERE dp.domain = 'XXX'
ORDER BY ms.display_order, mi.id;

-- Verificar favicon por domínio
SELECT domain, name, 
       CASE 
           WHEN favicon_url IS NULL OR favicon_url = '' THEN 'FAVICON PADRÃO'
           ELSE favicon_url
       END AS favicon
FROM domains
ORDER BY domain;

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================

-- Exibir resumo
SELECT '✅ SCHEMA CRIADO COM SUCESSO!' AS status;
SELECT 'Total de Domínios: ' || COUNT(*) FROM domains;
SELECT 'Total de Usuários: ' || COUNT(*) FROM users;
SELECT 'Total de Itens do Menu: ' || COUNT(*) FROM menu_items;
SELECT 'Total de Permissões: ' || COUNT(*) FROM domain_permissions;

-- Exibir credenciais padrão
SELECT '========================================' AS linha;
SELECT '🔐 CREDENCIAIS DE ACESSO' AS info;
SELECT '========================================' AS linha;
SELECT 'SENHA PADRÃO PARA TODOS: presto123' AS credencial;
SELECT '========================================' AS linha;

-- Domínios disponíveis
SELECT 
    domain,
    name,
    '👤 Usuários: presto, admin' AS usuarios,
    '🔑 Senha: presto123' AS senha,
    CASE 
        WHEN modalidade = 'MISTA' THEN '🚛+🚌 MISTA (Cargas + Passageiros)'
        WHEN modalidade = 'PASSAGEIROS' THEN '🚌 PASSAGEIROS'
        ELSE '🚛 CARGAS'
    END AS tipo,
    CASE 
        WHEN favicon_url IS NOT NULL AND favicon_url != '' THEN '🎨 Logo Personalizada'
        ELSE '🖼️  Logo Padrão'
    END AS white_label
FROM domains
ORDER BY domain;