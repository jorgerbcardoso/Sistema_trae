-- ============================================================================
-- SCRIPT COMPLETO: Criar TODAS as tabelas do módulo ESTOQUE
-- ============================================================================
-- IMPORTANTE: Substitua 'acv' pelo seu domínio conforme necessário

-- ============================================================================
-- TABELA: acv_posicao (Posições físicas do estoque)
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_posicao (
    seq_posicao SERIAL PRIMARY KEY,
    seq_estoque INTEGER NOT NULL,
    rua VARCHAR(50) NOT NULL,
    altura VARCHAR(50) NOT NULL,
    coluna VARCHAR(50) NOT NULL,
    seq_item INTEGER,
    saldo DECIMAL(15,2) DEFAULT 0,
    ativa CHAR(1) DEFAULT 'S',
    login_inclusao VARCHAR(50),
    data_inclusao DATE DEFAULT CURRENT_DATE,
    hora_inclusao TIME DEFAULT CURRENT_TIME,
    login_alteracao VARCHAR(50),
    data_alteracao DATE,
    hora_alteracao TIME
);

CREATE INDEX IF NOT EXISTS idx_acv_posicao_estoque ON acv_posicao(seq_estoque);
CREATE INDEX IF NOT EXISTS idx_acv_posicao_item ON acv_posicao(seq_item);
CREATE INDEX IF NOT EXISTS idx_acv_posicao_ativa ON acv_posicao(ativa);
CREATE INDEX IF NOT EXISTS idx_acv_posicao_localiza ON acv_posicao(seq_estoque, rua, altura, coluna);

COMMENT ON TABLE acv_posicao IS 'Posições físicas do estoque (endereçamento)';
COMMENT ON COLUMN acv_posicao.rua IS 'Identificação da rua/corredor';
COMMENT ON COLUMN acv_posicao.altura IS 'Nível/altura da posição';
COMMENT ON COLUMN acv_posicao.coluna IS 'Coluna da posição';
COMMENT ON COLUMN acv_posicao.ativa IS 'S=Ativa, N=Inativa';

-- ============================================================================
-- TABELA: acv_requisicao (Requisições de saída)
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_requisicao (
    seq_requisicao SERIAL PRIMARY KEY,
    seq_estoque INTEGER NOT NULL,
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

COMMENT ON TABLE acv_requisicao IS 'Requisições de saída do estoque';
COMMENT ON COLUMN acv_requisicao.status IS 'PENDENTE ou ATENDIDO';

-- ============================================================================
-- TABELA: acv_requisicao_item (Itens das requisições)
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_requisicao_item (
    seq_requisicao_item SERIAL PRIMARY KEY,
    seq_requisicao INTEGER NOT NULL,
    seq_item INTEGER NOT NULL,
    qtde_item DECIMAL(15,2) NOT NULL,
    qtde_atendida DECIMAL(15,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_acv_requisicao_item_req ON acv_requisicao_item(seq_requisicao);
CREATE INDEX IF NOT EXISTS idx_acv_requisicao_item_item ON acv_requisicao_item(seq_item);

COMMENT ON TABLE acv_requisicao_item IS 'Itens da requisição de saída';

-- ============================================================================
-- TABELA: acv_mvto_estoque (Movimentos de estoque)
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_mvto_estoque (
    seq_mvto_estoque SERIAL PRIMARY KEY,
    login VARCHAR(50) NOT NULL,
    data_mvto DATE DEFAULT CURRENT_DATE,
    hora_mvto TIME DEFAULT CURRENT_TIME,
    mvto CHAR(1) NOT NULL, -- E=Entrada, S=Saída
    tipo CHAR(1), -- N=Nota Fiscal, T=Transferência, R=Requisição, A=Ajuste
    seq_origem INTEGER, -- ID da origem (nota, transferência, requisição)
    seq_posicao INTEGER,
    seq_item INTEGER NOT NULL,
    qtde_item DECIMAL(15,2) NOT NULL,
    vlr_unitario DECIMAL(15,2),
    vlr_total DECIMAL(15,2),
    observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_acv_mvto_estoque_data ON acv_mvto_estoque(data_mvto);
CREATE INDEX IF NOT EXISTS idx_acv_mvto_estoque_posicao ON acv_mvto_estoque(seq_posicao);
CREATE INDEX IF NOT EXISTS idx_acv_mvto_estoque_item ON acv_mvto_estoque(seq_item);
CREATE INDEX IF NOT EXISTS idx_acv_mvto_estoque_tipo ON acv_mvto_estoque(mvto, tipo);

COMMENT ON TABLE acv_mvto_estoque IS 'Movimentações de estoque (entradas e saídas)';
COMMENT ON COLUMN acv_mvto_estoque.mvto IS 'E=Entrada, S=Saída';
COMMENT ON COLUMN acv_mvto_estoque.tipo IS 'N=Nota, T=Transferência, R=Requisição, A=Ajuste';

-- ============================================================================
-- DADOS MOCKADOS - POSIÇÕES
-- ============================================================================
DO $$
DECLARE
    v_seq_estoque INTEGER;
    v_seq_item INTEGER;
BEGIN
    -- Buscar primeiro estoque ativo
    SELECT seq_estoque INTO v_seq_estoque 
    FROM acv_estoque 
    WHERE ativo = 'S' 
    LIMIT 1;
    
    -- Buscar primeiro item ativo
    SELECT seq_item INTO v_seq_item 
    FROM acv_item 
    WHERE ativo = 'S' 
    LIMIT 1;
    
    IF v_seq_estoque IS NOT NULL AND v_seq_item IS NOT NULL AND NOT EXISTS (SELECT 1 FROM acv_posicao LIMIT 1) THEN
        -- Inserir posições mockadas
        INSERT INTO acv_posicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao)
        VALUES 
            (v_seq_estoque, 'R01', 'A1', 'C01', v_seq_item, 100.00, 'S', 'admin'),
            (v_seq_estoque, 'R01', 'A1', 'C02', v_seq_item, 50.00, 'S', 'admin'),
            (v_seq_estoque, 'R01', 'A2', 'C01', v_seq_item, 75.00, 'S', 'admin'),
            (v_seq_estoque, 'R02', 'A1', 'C01', v_seq_item, 25.00, 'S', 'admin'),
            (v_seq_estoque, 'R02', 'A2', 'C01', v_seq_item, 0.00, 'S', 'admin');
        
        RAISE NOTICE 'Posições mockadas criadas com sucesso!';
    ELSE
        RAISE NOTICE 'Pulando criação de posições mockadas (já existem ou faltam dados base)';
    END IF;
END $$;

-- ============================================================================
-- DADOS MOCKADOS - REQUISIÇÕES
-- ============================================================================
DO $$
DECLARE
    v_seq_estoque INTEGER;
    v_seq_item INTEGER;
    v_seq_req1 INTEGER;
    v_seq_req2 INTEGER;
    v_seq_req3 INTEGER;
BEGIN
    SELECT seq_estoque INTO v_seq_estoque FROM acv_estoque WHERE ativo = 'S' LIMIT 1;
    SELECT seq_item INTO v_seq_item FROM acv_item WHERE ativo = 'S' LIMIT 1;
    
    IF v_seq_estoque IS NOT NULL AND v_seq_item IS NOT NULL AND NOT EXISTS (SELECT 1 FROM acv_requisicao LIMIT 1) THEN
        -- Requisição 1: ATENDIDA
        INSERT INTO acv_requisicao (seq_estoque, nro_requisicao, login, solicitante, observacao, status, data_atendimento, hora_atendimento, login_atendimento, data_requisicao, hora_requisicao)
        VALUES (v_seq_estoque, 'REQ-000001', 'admin', 'JOÃO DA SILVA', 'Materiais para manutenção', 'ATENDIDO', CURRENT_DATE - INTERVAL '2 days', '14:30:00', 'admin', CURRENT_DATE - INTERVAL '3 days', '10:15:00')
        RETURNING seq_requisicao INTO v_seq_req1;
        
        INSERT INTO acv_requisicao_item (seq_requisicao, seq_item, qtde_item, qtde_atendida)
        VALUES (v_seq_req1, v_seq_item, 5.00, 5.00);
        
        -- Requisição 2: PENDENTE
        INSERT INTO acv_requisicao (seq_estoque, nro_requisicao, login, solicitante, observacao, status, data_requisicao, hora_requisicao)
        VALUES (v_seq_estoque, 'REQ-000002', 'admin', 'MARIA SANTOS', 'Materiais de escritório', 'PENDENTE', CURRENT_DATE, '09:45:00')
        RETURNING seq_requisicao INTO v_seq_req2;
        
        INSERT INTO acv_requisicao_item (seq_requisicao, seq_item, qtde_item, qtde_atendida)
        VALUES (v_seq_req2, v_seq_item, 10.00, 0);
        
        -- Requisição 3: PENDENTE
        INSERT INTO acv_requisicao (seq_estoque, nro_requisicao, login, solicitante, status, data_requisicao, hora_requisicao)
        VALUES (v_seq_estoque, 'REQ-000003', 'admin', 'PEDRO OLIVEIRA', 'PENDENTE', CURRENT_DATE, CURRENT_TIME)
        RETURNING seq_requisicao INTO v_seq_req3;
        
        INSERT INTO acv_requisicao_item (seq_requisicao, seq_item, qtde_item, qtde_atendida)
        VALUES (v_seq_req3, v_seq_item, 2.00, 0);
        
        RAISE NOTICE 'Requisições mockadas criadas com sucesso!';
    ELSE
        RAISE NOTICE 'Pulando criação de requisições mockadas';
    END IF;
END $$;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INSTALAÇÃO CONCLUÍDA!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Posições: % registros', (SELECT COUNT(*) FROM acv_posicao);
    RAISE NOTICE 'Requisições: % registros', (SELECT COUNT(*) FROM acv_requisicao);
    RAISE NOTICE 'Itens de Requisição: % registros', (SELECT COUNT(*) FROM acv_requisicao_item);
    RAISE NOTICE 'Movimentos: % registros', (SELECT COUNT(*) FROM acv_mvto_estoque);
    RAISE NOTICE '========================================';
END $$;
