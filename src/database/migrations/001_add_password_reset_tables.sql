-- ============================================================================
-- MIGRAÇÃO: Adicionar Tabelas de Recuperação de Senha e Logs
-- ============================================================================
-- Data: 2024-12-11
-- Descrição: Adiciona suporte para recuperação de senha via email
-- ============================================================================

\c presto;

-- ============================================================================
-- 1. CRIAR TABELA: password_reset_tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);

-- Comentários
COMMENT ON TABLE password_reset_tokens IS 'Tokens de recuperação de senha com validade de 1 hora';
COMMENT ON COLUMN password_reset_tokens.token IS 'Token hexadecimal de 64 caracteres para recuperação';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Data/hora de expiração do token (1 hora)';
COMMENT ON COLUMN password_reset_tokens.used IS 'Indica se o token já foi utilizado';

-- ============================================================================
-- 2. CRIAR TABELA: access_logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS access_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at);

-- Comentários
COMMENT ON TABLE access_logs IS 'Log de ações e acessos dos usuários para auditoria';
COMMENT ON COLUMN access_logs.action IS 'Tipo de ação (login, logout, password_reset_requested, password_reset_completed, etc)';

-- ============================================================================
-- 3. VERIFICAÇÃO
-- ============================================================================

-- Verificar se as tabelas foram criadas
SELECT 
    'password_reset_tokens' AS tabela,
    COUNT(*) AS registros
FROM password_reset_tokens
UNION ALL
SELECT 
    'access_logs' AS tabela,
    COUNT(*) AS registros
FROM access_logs;

-- Exibir sucesso
SELECT '✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!' AS status;
SELECT 'Tabelas criadas: password_reset_tokens, access_logs' AS detalhes;
