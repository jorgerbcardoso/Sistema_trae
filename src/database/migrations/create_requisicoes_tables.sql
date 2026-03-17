-- ============================================================================
-- SCRIPT: Criar tabelas de REQUISIÇÕES DE ESTOQUE
-- Descrição: Tabelas para gerenciamento de requisições de saída do estoque
-- ============================================================================

-- IMPORTANTE: Execute este script com o prefixo do domínio correto
-- Exemplo para domínio 'acv': Substitua [dominio] por acv

-- ============================================================================
-- TABELA: [dominio]_requisicao
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_requisicao (
    seq_requisicao SERIAL PRIMARY KEY,
    seq_estoque INTEGER NOT NULL REFERENCES acv_estoque(seq_estoque),
    nro_requisicao VARCHAR(20),
    data_requisicao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_requisicao TIME NOT NULL DEFAULT CURRENT_TIME,
    login VARCHAR(50) NOT NULL,
    solicitante VARCHAR(200) NOT NULL,
    observacao TEXT,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    data_atendimento DATE,
    hora_atendimento TIME,
    login_atendimento VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_acv_requisicao_estoque ON acv_requisicao(seq_estoque);
CREATE INDEX IF NOT EXISTS idx_acv_requisicao_status ON acv_requisicao(status);
CREATE INDEX IF NOT EXISTS idx_acv_requisicao_data ON acv_requisicao(data_requisicao);

-- ============================================================================
-- TABELA: [dominio]_requisicao_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_requisicao_item (
    seq_requisicao_item SERIAL PRIMARY KEY,
    seq_requisicao INTEGER NOT NULL REFERENCES acv_requisicao(seq_requisicao) ON DELETE CASCADE,
    seq_item INTEGER NOT NULL REFERENCES acv_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    qtde_atendida DECIMAL(15,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_acv_requisicao_item_req ON acv_requisicao_item(seq_requisicao);
CREATE INDEX IF NOT EXISTS idx_acv_requisicao_item_item ON acv_requisicao_item(seq_item);

-- ============================================================================
-- COMENTÁRIOS
-- ============================================================================
COMMENT ON TABLE acv_requisicao IS 'Requisições de saída do estoque';
COMMENT ON COLUMN acv_requisicao.seq_requisicao IS 'Chave primária da requisição';
COMMENT ON COLUMN acv_requisicao.seq_estoque IS 'Estoque de origem da requisição';
COMMENT ON COLUMN acv_requisicao.nro_requisicao IS 'Número único da requisição (REQ-000001)';
COMMENT ON COLUMN acv_requisicao.solicitante IS 'Nome da pessoa que solicitou';
COMMENT ON COLUMN acv_requisicao.status IS 'Status da requisição: PENDENTE ou ATENDIDO';
COMMENT ON COLUMN acv_requisicao.login_atendimento IS 'Usuário que atendeu a requisição';

COMMENT ON TABLE acv_requisicao_item IS 'Itens da requisição de saída';
COMMENT ON COLUMN acv_requisicao_item.qtde_item IS 'Quantidade solicitada';
COMMENT ON COLUMN acv_requisicao_item.qtde_atendida IS 'Quantidade efetivamente atendida';

-- ============================================================================
-- DADOS MOCKADOS (OPCIONAL - PARA TESTES)
-- ============================================================================

-- Inserir algumas requisições de exemplo (somente se não existir nenhuma)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM acv_requisicao LIMIT 1) THEN
        -- Requisição 1: ATENDIDA
        INSERT INTO acv_requisicao (
            seq_estoque, nro_requisicao, login, solicitante, 
            observacao, status, data_atendimento, hora_atendimento, login_atendimento,
            data_requisicao, hora_requisicao
        ) VALUES (
            (SELECT seq_estoque FROM acv_estoque WHERE ativo = 'S' LIMIT 1),
            'REQ-000001',
            'admin',
            'JOÃO DA SILVA',
            'Materiais para manutenção',
            'ATENDIDO',
            CURRENT_DATE - INTERVAL '2 days',
            '14:30:00',
            'admin',
            CURRENT_DATE - INTERVAL '3 days',
            '10:15:00'
        );

        -- Adicionar itens para requisição 1
        INSERT INTO acv_requisicao_item (seq_requisicao, seq_item, qtde_item, qtde_atendida)
        SELECT 
            1,
            seq_item,
            5.00,
            5.00
        FROM acv_item 
        WHERE ativo = 'S' 
        LIMIT 2;

        -- Requisição 2: PENDENTE
        INSERT INTO acv_requisicao (
            seq_estoque, nro_requisicao, login, solicitante, 
            observacao, status,
            data_requisicao, hora_requisicao
        ) VALUES (
            (SELECT seq_estoque FROM acv_estoque WHERE ativo = 'S' LIMIT 1),
            'REQ-000002',
            'admin',
            'MARIA SANTOS',
            'Materiais de escritório',
            'PENDENTE',
            CURRENT_DATE,
            '09:45:00'
        );

        -- Adicionar itens para requisição 2
        INSERT INTO acv_requisicao_item (seq_requisicao, seq_item, qtde_item, qtde_atendida)
        SELECT 
            2,
            seq_item,
            10.00,
            0
        FROM acv_item 
        WHERE ativo = 'S' 
        LIMIT 3;

        -- Requisição 3: PENDENTE (hoje)
        INSERT INTO acv_requisicao (
            seq_estoque, nro_requisicao, login, solicitante, 
            status,
            data_requisicao, hora_requisicao
        ) VALUES (
            (SELECT seq_estoque FROM acv_estoque WHERE ativo = 'S' LIMIT 1),
            'REQ-000003',
            'admin',
            'PEDRO OLIVEIRA',
            'PENDENTE',
            CURRENT_DATE,
            CURRENT_TIME
        );

        -- Adicionar itens para requisição 3
        INSERT INTO acv_requisicao_item (seq_requisicao, seq_item, qtde_item, qtde_atendida)
        SELECT 
            3,
            seq_item,
            2.00,
            0
        FROM acv_item 
        WHERE ativo = 'S' 
        LIMIT 1;

        RAISE NOTICE 'Dados mockados de requisições inseridos com sucesso!';
    ELSE
        RAISE NOTICE 'Tabela acv_requisicao já contém dados. Pulando inserção de mocks.';
    END IF;
END $$;
