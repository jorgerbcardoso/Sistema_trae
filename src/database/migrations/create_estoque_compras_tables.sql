-- ============================================================================
-- SISTEMA PRESTO - CRIAÇÃO DE TABELAS - MÓDULOS ESTOQUE E COMPRAS
-- DOMÍNIO: ACV (ACEVILLE)
-- ============================================================================
-- Data de Criação: 27/01/2026
-- Autor: Sistema Presto
-- Descrição: Script para criação de todas as tabelas dos módulos de estoque e compras
-- Prefixo: acv_
-- ============================================================================

-- ============================================================================
-- TABELA: acv_fornecedor
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_fornecedor (
    seq_fornecedor SERIAL PRIMARY KEY,
    cnpj VARCHAR(20) NOT NULL,
    nome VARCHAR(200) NOT NULL,
    endereco VARCHAR(200),
    bairro VARCHAR(100),
    seq_cidade INTEGER,
    email VARCHAR(200),
    telefone VARCHAR(20),
    ativo CHAR(1) DEFAULT 'S',
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_acv_fornecedor_cnpj ON acv_fornecedor(cnpj);
CREATE INDEX IF NOT EXISTS idx_acv_fornecedor_nome ON acv_fornecedor(nome);

-- ============================================================================
-- TABELA: acv_estoque
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_estoque (
    seq_estoque SERIAL PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    nro_estoque VARCHAR(20) NOT NULL,
    descricao VARCHAR(200) NOT NULL,
    ativo CHAR(1) DEFAULT 'S',
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50),
    UNIQUE(unidade, nro_estoque)
);

CREATE INDEX IF NOT EXISTS idx_acv_estoque_unidade ON acv_estoque(unidade);

-- ============================================================================
-- TABELA: acv_tipo_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_tipo_item (
    seq_tipo_item SERIAL PRIMARY KEY,
    descricao VARCHAR(200) NOT NULL,
    ativo CHAR(1) DEFAULT 'S',
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50)
);

-- ============================================================================
-- TABELA: acv_unidade_medida
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_unidade_medida (
    seq_unidade_medida SERIAL PRIMARY KEY,
    descricao VARCHAR(50) NOT NULL,
    sigla VARCHAR(10) NOT NULL,
    ativo CHAR(1) DEFAULT 'S',
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50)
);

-- ============================================================================
-- TABELA: acv_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_item (
    seq_item SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    codigo_fabricante VARCHAR(50),
    descricao VARCHAR(200) NOT NULL,
    seq_tipo_item INTEGER REFERENCES acv_tipo_item(seq_tipo_item),
    seq_unidade_medida INTEGER REFERENCES acv_unidade_medida(seq_unidade_medida),
    vlr_item DECIMAL(15,2) DEFAULT 0,
    estoque_minimo DECIMAL(15,2) DEFAULT 0,
    estoque_maximo DECIMAL(15,2) DEFAULT 0,
    ativo CHAR(1) DEFAULT 'S',
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50),
    UNIQUE(codigo)
);

CREATE INDEX IF NOT EXISTS idx_acv_item_codigo ON acv_item(codigo);
CREATE INDEX IF NOT EXISTS idx_acv_item_tipo ON acv_item(seq_tipo_item);

-- ============================================================================
-- TABELA: acv_posicao
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_posicao (
    seq_posicao SERIAL PRIMARY KEY,
    seq_estoque INTEGER NOT NULL REFERENCES acv_estoque(seq_estoque),
    rua VARCHAR(20) NOT NULL,
    altura VARCHAR(20) NOT NULL,
    coluna VARCHAR(20) NOT NULL,
    seq_item INTEGER REFERENCES acv_item(seq_item),
    saldo DECIMAL(15,2) DEFAULT 0,
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50),
    UNIQUE(seq_estoque, rua, altura, coluna)
);

CREATE INDEX IF NOT EXISTS idx_acv_posicao_estoque ON acv_posicao(seq_estoque);
CREATE INDEX IF NOT EXISTS idx_acv_posicao_item ON acv_posicao(seq_item);

-- ============================================================================
-- TABELA: acv_inventario
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_inventario (
    seq_inventario SERIAL PRIMARY KEY,
    nome_inventario VARCHAR(200) NOT NULL,
    seq_estoque INTEGER NOT NULL REFERENCES acv_estoque(seq_estoque),
    status VARCHAR(20) DEFAULT 'PENDENTE',
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_conclusao DATE,
    hora_conclusao TIME,
    login_conclusao VARCHAR(50),
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_acv_inventario_estoque ON acv_inventario(seq_estoque);
CREATE INDEX IF NOT EXISTS idx_acv_inventario_status ON acv_inventario(status);

-- ============================================================================
-- TABELA: acv_inventario_posicao
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_inventario_posicao (
    seq_inventario_posicao SERIAL PRIMARY KEY,
    seq_inventario INTEGER NOT NULL REFERENCES acv_inventario(seq_inventario),
    seq_posicao INTEGER NOT NULL REFERENCES acv_posicao(seq_posicao),
    saldo_sistema DECIMAL(15,2) DEFAULT 0,
    saldo_contado DECIMAL(15,2) DEFAULT 0,
    diferenca DECIMAL(15,2) DEFAULT 0,
    data_contagem DATE,
    hora_contagem TIME,
    login_contagem VARCHAR(50),
    UNIQUE(seq_inventario, seq_posicao)
);

CREATE INDEX IF NOT EXISTS idx_acv_inventario_posicao_inv ON acv_inventario_posicao(seq_inventario);

-- ============================================================================
-- TABELA: acv_requisicao
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

-- ============================================================================
-- TABELA: acv_requisicao_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_requisicao_item (
    seq_requisicao_item SERIAL PRIMARY KEY,
    seq_requisicao INTEGER NOT NULL REFERENCES acv_requisicao(seq_requisicao),
    seq_item INTEGER NOT NULL REFERENCES acv_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    qtde_atendida DECIMAL(15,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_acv_requisicao_item_req ON acv_requisicao_item(seq_requisicao);

-- ============================================================================
-- TABELA: acv_mvto_estoque
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_mvto_estoque (
    seq_mvto_estoque SERIAL PRIMARY KEY,
    data_mvto DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_mvto TIME NOT NULL DEFAULT CURRENT_TIME,
    login VARCHAR(50) NOT NULL,
    mvto CHAR(1) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    seq_origem INTEGER,
    seq_posicao INTEGER REFERENCES acv_posicao(seq_posicao),
    seq_item INTEGER NOT NULL REFERENCES acv_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    vlr_unitario DECIMAL(15,2) DEFAULT 0,
    vlr_total DECIMAL(15,2) DEFAULT 0,
    observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_acv_mvto_estoque_data ON acv_mvto_estoque(data_mvto);
CREATE INDEX IF NOT EXISTS idx_acv_mvto_estoque_posicao ON acv_mvto_estoque(seq_posicao);
CREATE INDEX IF NOT EXISTS idx_acv_mvto_estoque_item ON acv_mvto_estoque(seq_item);
CREATE INDEX IF NOT EXISTS idx_acv_mvto_estoque_tipo ON acv_mvto_estoque(tipo);

-- ============================================================================
-- TABELA: acv_centro_custo
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_centro_custo (
    seq_centro_custo SERIAL PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    nro_centro_custo VARCHAR(20) NOT NULL,
    descricao VARCHAR(200) NOT NULL,
    ativo CHAR(1) DEFAULT 'S',
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50),
    UNIQUE(unidade, nro_centro_custo)
);

CREATE INDEX IF NOT EXISTS idx_acv_centro_custo_unidade ON acv_centro_custo(unidade);

-- ============================================================================
-- TABELA: acv_ordem_compra
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_ordem_compra (
    seq_ordem_compra SERIAL PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    nro_ordem_compra VARCHAR(20),
    seq_centro_custo INTEGER REFERENCES acv_centro_custo(seq_centro_custo),
    aprovada CHAR(1) DEFAULT 'N',
    orcar CHAR(1) DEFAULT 'N',
    status VARCHAR(20) DEFAULT 'PENDENTE',
    observacao TEXT,
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_aprovacao DATE,
    hora_aprovacao TIME,
    login_aprovacao VARCHAR(50),
    motivo_reprovacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_acv_ordem_compra_unidade ON acv_ordem_compra(unidade);
CREATE INDEX IF NOT EXISTS idx_acv_ordem_compra_status ON acv_ordem_compra(status);

-- ============================================================================
-- TABELA: acv_ordem_compra_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_ordem_compra_item (
    seq_ordem_compra_item SERIAL PRIMARY KEY,
    seq_ordem_compra INTEGER NOT NULL REFERENCES acv_ordem_compra(seq_ordem_compra),
    seq_item INTEGER NOT NULL REFERENCES acv_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    vlr_unitario DECIMAL(15,2) DEFAULT 0,
    vlr_total DECIMAL(15,2) DEFAULT 0,
    observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_acv_ordem_compra_item_ordem ON acv_ordem_compra_item(seq_ordem_compra);

-- ============================================================================
-- TABELA: acv_orcamento
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_orcamento (
    seq_orcamento SERIAL PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    nro_orcamento VARCHAR(20),
    status VARCHAR(20) DEFAULT 'PENDENTE',
    observacao TEXT,
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_aprovacao DATE,
    hora_aprovacao TIME,
    login_aprovacao VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_acv_orcamento_unidade ON acv_orcamento(unidade);
CREATE INDEX IF NOT EXISTS idx_acv_orcamento_status ON acv_orcamento(status);

-- ============================================================================
-- TABELA: acv_orcamento_ordem_compra
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_orcamento_ordem_compra (
    seq_orcamento_ordem_compra SERIAL PRIMARY KEY,
    seq_orcamento INTEGER NOT NULL REFERENCES acv_orcamento(seq_orcamento),
    seq_ordem_compra INTEGER NOT NULL REFERENCES acv_ordem_compra(seq_ordem_compra),
    UNIQUE(seq_orcamento, seq_ordem_compra)
);

CREATE INDEX IF NOT EXISTS idx_acv_orcamento_ordem_orcamento ON acv_orcamento_ordem_compra(seq_orcamento);

-- ============================================================================
-- TABELA: acv_orcamento_fornecedor
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_orcamento_fornecedor (
    seq_orcamento_fornecedor SERIAL PRIMARY KEY,
    seq_orcamento INTEGER NOT NULL REFERENCES acv_orcamento(seq_orcamento),
    seq_fornecedor INTEGER NOT NULL REFERENCES acv_fornecedor(seq_fornecedor),
    email VARCHAR(200),
    data_solicitacao DATE,
    hora_solicitacao TIME,
    data_retorno DATE,
    hora_retorno TIME,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    UNIQUE(seq_orcamento, seq_fornecedor)
);

CREATE INDEX IF NOT EXISTS idx_acv_orcamento_fornecedor_orc ON acv_orcamento_fornecedor(seq_orcamento);

-- ============================================================================
-- TABELA: acv_orcamento_cotacao
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_orcamento_cotacao (
    seq_orcamento_cotacao SERIAL PRIMARY KEY,
    seq_orcamento INTEGER NOT NULL REFERENCES acv_orcamento(seq_orcamento),
    seq_fornecedor INTEGER NOT NULL REFERENCES acv_fornecedor(seq_fornecedor),
    seq_ordem_compra INTEGER NOT NULL REFERENCES acv_ordem_compra(seq_ordem_compra),
    seq_item INTEGER NOT NULL REFERENCES acv_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    vlr_estoque DECIMAL(15,2) DEFAULT 0,
    vlr_fornecedor DECIMAL(15,2) DEFAULT 0,
    vlr_total DECIMAL(15,2) DEFAULT 0,
    prazo_entrega INTEGER,
    observacao TEXT,
    selecionado CHAR(1) DEFAULT 'N'
);

CREATE INDEX IF NOT EXISTS idx_acv_orcamento_cotacao_orc ON acv_orcamento_cotacao(seq_orcamento);
CREATE INDEX IF NOT EXISTS idx_acv_orcamento_cotacao_forn ON acv_orcamento_cotacao(seq_fornecedor);

-- ============================================================================
-- TABELA: acv_pedido
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_pedido (
    seq_pedido SERIAL PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    nro_pedido VARCHAR(20),
    seq_orcamento INTEGER REFERENCES acv_orcamento(seq_orcamento),
    seq_fornecedor INTEGER REFERENCES acv_fornecedor(seq_fornecedor),
    status VARCHAR(20) DEFAULT 'PENDENTE',
    vlr_total DECIMAL(15,2) DEFAULT 0,
    observacao TEXT,
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_fin DATE,
    hora_fin TIME,
    login_fin VARCHAR(50),
    ser_nf VARCHAR(10),
    nro_nf VARCHAR(20),
    chave_nfe VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_acv_pedido_unidade ON acv_pedido(unidade);
CREATE INDEX IF NOT EXISTS idx_acv_pedido_status ON acv_pedido(status);
CREATE INDEX IF NOT EXISTS idx_acv_pedido_fornecedor ON acv_pedido(seq_fornecedor);

-- ============================================================================
-- TABELA: acv_pedido_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS acv_pedido_item (
    seq_pedido_item SERIAL PRIMARY KEY,
    seq_pedido INTEGER NOT NULL REFERENCES acv_pedido(seq_pedido),
    seq_item INTEGER NOT NULL REFERENCES acv_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    vlr_unitario DECIMAL(15,2) DEFAULT 0,
    vlr_total DECIMAL(15,2) DEFAULT 0,
    observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_acv_pedido_item_pedido ON acv_pedido_item(seq_pedido);

-- ============================================================================
-- DADOS INICIAIS - UNIDADES DE MEDIDA
-- ============================================================================
INSERT INTO acv_unidade_medida (descricao, sigla, login_inclusao) VALUES
('UNIDADE', 'UN', 'SISTEMA'),
('QUILOGRAMA', 'KG', 'SISTEMA'),
('METRO', 'M', 'SISTEMA'),
('LITRO', 'L', 'SISTEMA'),
('CAIXA', 'CX', 'SISTEMA'),
('PACOTE', 'PCT', 'SISTEMA'),
('PEÇA', 'PC', 'SISTEMA'),
('METRO QUADRADO', 'M²', 'SISTEMA'),
('METRO CÚBICO', 'M³', 'SISTEMA'),
('TONELADA', 'TON', 'SISTEMA')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DADOS INICIAIS - TIPOS DE ITEM
-- ============================================================================
INSERT INTO acv_tipo_item (descricao, login_inclusao) VALUES
('MATÉRIA PRIMA', 'SISTEMA'),
('PRODUTO ACABADO', 'SISTEMA'),
('MATERIAL DE CONSUMO', 'SISTEMA'),
('MATERIAL DE ESCRITÓRIO', 'SISTEMA'),
('EQUIPAMENTO', 'SISTEMA'),
('FERRAMENTA', 'SISTEMA'),
('PEÇA DE REPOSIÇÃO', 'SISTEMA'),
('EMBALAGEM', 'SISTEMA')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- FIM DO SCRIPT - DOMÍNIO ACV
-- ============================================================================
