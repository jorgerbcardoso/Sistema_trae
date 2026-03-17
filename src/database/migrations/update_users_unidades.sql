-- ============================================================================
-- SISTEMA PRESTO - ATUALIZAÇÃO TABELA USERS - CONTROLE DE UNIDADES
-- ============================================================================
-- Data de Criação: 27/01/2026
-- Descrição: Adiciona controle de unidades aos usuários
-- ============================================================================

-- Adicionar campos de unidade na tabela users (se não existirem)
ALTER TABLE users ADD COLUMN IF NOT EXISTS unidade_padrao VARCHAR(10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS pode_trocar_unidade BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS unidades_permitidas TEXT; -- JSON array de unidades

-- Criar índice para busca por unidade
CREATE INDEX IF NOT EXISTS idx_users_unidade_padrao ON users(unidade_padrao);

-- Comentários nas colunas
COMMENT ON COLUMN users.unidade_padrao IS 'Unidade padrão do usuário ao fazer login';
COMMENT ON COLUMN users.pode_trocar_unidade IS 'Se o usuário pode trocar de unidade no sistema';
COMMENT ON COLUMN users.unidades_permitidas IS 'JSON array com as unidades que o usuário pode acessar';

-- ============================================================================
-- TABELA: user_unidade_log (log de trocas de unidade)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_unidade_log (
    seq_log SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    unidade_anterior VARCHAR(10),
    unidade_nova VARCHAR(10),
    data_troca TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_user_unidade_log_user ON user_unidade_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unidade_log_data ON user_unidade_log(data_troca);

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
