-- ============================================================================
-- SISTEMA PRESTO - CRIAÇÃO DE TABELAS - MÓDULOS ESTOQUE E COMPRAS
-- ============================================================================
-- Data de Criação: 27/01/2026
-- Autor: Sistema Presto
-- Descrição: Script para criação de todas as tabelas dos módulos de estoque e compras
-- IMPORTANTE: Substituir [dominio] pelo código do domínio antes de executar
-- Exemplo: Para domínio VCS, substituir [dominio] por vcs
-- ============================================================================

-- ============================================================================
-- TABELA: [dominio]_fornecedor
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_fornecedor (
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

CREATE INDEX IF NOT EXISTS idx_[dominio]_fornecedor_cnpj ON [dominio]_fornecedor(cnpj);
CREATE INDEX IF NOT EXISTS idx_[dominio]_fornecedor_nome ON [dominio]_fornecedor(nome);

-- ============================================================================
-- TABELA: [dominio]_estoque
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_estoque (
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

CREATE INDEX IF NOT EXISTS idx_[dominio]_estoque_unidade ON [dominio]_estoque(unidade);

-- ============================================================================
-- TABELA: [dominio]_tipo_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_tipo_item (
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
-- TABELA: [dominio]_unidade_medida
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_unidade_medida (
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
-- TABELA: [dominio]_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_item (
    seq_item SERIAL PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL,
    codigo_fabricante VARCHAR(50),
    descricao VARCHAR(200) NOT NULL,
    seq_tipo_item INTEGER REFERENCES [dominio]_tipo_item(seq_tipo_item),
    seq_unidade_medida INTEGER REFERENCES [dominio]_unidade_medida(seq_unidade_medida),
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

CREATE INDEX IF NOT EXISTS idx_[dominio]_item_codigo ON [dominio]_item(codigo);
CREATE INDEX IF NOT EXISTS idx_[dominio]_item_tipo ON [dominio]_item(seq_tipo_item);

-- ============================================================================
-- TABELA: [dominio]_posicao
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_posicao (
    seq_posicao SERIAL PRIMARY KEY,
    seq_estoque INTEGER NOT NULL REFERENCES [dominio]_estoque(seq_estoque),
    rua VARCHAR(20) NOT NULL,
    altura VARCHAR(20) NOT NULL,
    coluna VARCHAR(20) NOT NULL,
    seq_item INTEGER REFERENCES [dominio]_item(seq_item),
    saldo DECIMAL(15,2) DEFAULT 0,
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_alteracao DATE,
    hora_alteracao TIME,
    login_alteracao VARCHAR(50),
    ativa VARCHAR,
    UNIQUE(seq_estoque, rua, altura, coluna)
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_posicao_estoque ON [dominio]_posicao(seq_estoque);
CREATE INDEX IF NOT EXISTS idx_[dominio]_posicao_item ON [dominio]_posicao(seq_item);

-- ============================================================================
-- TABELA: [dominio]_inventario
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_inventario (
    seq_inventario SERIAL PRIMARY KEY,
    nome_inventario VARCHAR(200) NOT NULL,
    seq_estoque INTEGER NOT NULL REFERENCES [dominio]_estoque(seq_estoque),
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

CREATE INDEX IF NOT EXISTS idx_[dominio]_inventario_estoque ON [dominio]_inventario(seq_estoque);
CREATE INDEX IF NOT EXISTS idx_[dominio]_inventario_status ON [dominio]_inventario(status);

-- ============================================================================
-- TABELA: [dominio]_inventario_posicao
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_inventario_posicao (
    seq_inventario_posicao SERIAL PRIMARY KEY,
    seq_inventario INTEGER NOT NULL REFERENCES [dominio]_inventario(seq_inventario),
    seq_posicao INTEGER NOT NULL REFERENCES [dominio]_posicao(seq_posicao),
    saldo_sistema DECIMAL(15,2) DEFAULT 0,
    saldo_contado DECIMAL(15,2) DEFAULT 0,
    diferenca DECIMAL(15,2) DEFAULT 0,
    data_contagem DATE,
    hora_contagem TIME,
    login_contagem VARCHAR(50),
    UNIQUE(seq_inventario, seq_posicao)
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_inventario_posicao_inv ON [dominio]_inventario_posicao(seq_inventario);

-- ============================================================================
-- TABELA: [dominio]_requisicao
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_requisicao (
    seq_requisicao SERIAL PRIMARY KEY,
    seq_estoque INTEGER NOT NULL REFERENCES [dominio]_estoque(seq_estoque),
    login VARCHAR(50) NOT NULL,
    solicitante VARCHAR(200) NOT NULL,
    observacao TEXT,
    data_atendimento DATE,
    hora_atendimento TIME,
    login_atendimento VARCHAR(50)
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_requisicao_estoque ON [dominio]_requisicao(seq_estoque);
CREATE INDEX IF NOT EXISTS idx_[dominio]_requisicao_status ON [dominio]_requisicao(status);

-- ============================================================================
-- TABELA: [dominio]_requisicao_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_requisicao_item (
    seq_requisicao INTEGER NOT NULL REFERENCES [dominio]_requisicao(seq_requisicao),
    seq_item INTEGER NOT NULL REFERENCES [dominio]_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    seq_posicao INT
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_requisicao_item_req ON [dominio]_requisicao_item(seq_requisicao);

-- ============================================================================
-- TABELA: [dominio]_mvto_estoque
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_mvto_estoque (
    seq_mvto_estoque SERIAL PRIMARY KEY,
    data_mvto DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_mvto TIME NOT NULL DEFAULT CURRENT_TIME,
    login VARCHAR(50) NOT NULL,
    mvto CHAR(1) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    seq_origem INTEGER,
    seq_posicao INTEGER REFERENCES [dominio]_posicao(seq_posicao),
    seq_item INTEGER NOT NULL REFERENCES [dominio]_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    vlr_unitario DECIMAL(15,2) DEFAULT 0,
    vlr_total DECIMAL(15,2) DEFAULT 0,
    observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_mvto_estoque_data ON [dominio]_mvto_estoque(data_mvto);
CREATE INDEX IF NOT EXISTS idx_[dominio]_mvto_estoque_posicao ON [dominio]_mvto_estoque(seq_posicao);
CREATE INDEX IF NOT EXISTS idx_[dominio]_mvto_estoque_item ON [dominio]_mvto_estoque(seq_item);
CREATE INDEX IF NOT EXISTS idx_[dominio]_mvto_estoque_tipo ON [dominio]_mvto_estoque(tipo);

-- ============================================================================
-- TABELA: [dominio]_entrada_estoque
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_entrada_estoque (
    seq_entrada SERIAL PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    seq_estoque INTEGER NOT NULL REFERENCES [dominio]_estoque(seq_estoque),
    tipo_entrada VARCHAR(20) NOT NULL, -- 'MANUAL' ou 'PEDIDO'
    seq_pedido INTEGER, -- Referência ao pedido (se tipo_entrada = 'PEDIDO')
    seq_fornecedor INTEGER REFERENCES [dominio]_fornecedor(seq_fornecedor),
    ser_nf VARCHAR(10), -- Série da nota fiscal
    nro_nf VARCHAR(20), -- Número da nota fiscal
    chave_nfe VARCHAR(44), -- Chave da NF-e (44 dígitos)
    observacao TEXT,
    data_entrada DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_entrada TIME NOT NULL DEFAULT CURRENT_TIME,
    login_entrada VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_entrada_estoque_data ON [dominio]_entrada_estoque(data_entrada);
CREATE INDEX IF NOT EXISTS idx_[dominio]_entrada_estoque_estoque ON [dominio]_entrada_estoque(seq_estoque);
CREATE INDEX IF NOT EXISTS idx_[dominio]_entrada_estoque_pedido ON [dominio]_entrada_estoque(seq_pedido);
CREATE INDEX IF NOT EXISTS idx_[dominio]_entrada_estoque_fornecedor ON [dominio]_entrada_estoque(seq_fornecedor);
CREATE INDEX IF NOT EXISTS idx_[dominio]_entrada_estoque_chave ON [dominio]_entrada_estoque(chave_nfe);

-- ============================================================================
-- TABELA: [dominio]_entrada_estoque_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_entrada_estoque_item (
    seq_entrada_item SERIAL PRIMARY KEY,
    seq_entrada INTEGER NOT NULL REFERENCES [dominio]_entrada_estoque(seq_entrada),
    seq_item INTEGER NOT NULL REFERENCES [dominio]_item(seq_item),
    seq_posicao INTEGER NOT NULL REFERENCES [dominio]_posicao(seq_posicao),
    qtde_pedida DECIMAL(15,2) DEFAULT 0, -- Quantidade no pedido (se entrada via pedido)
    qtde_recebida DECIMAL(15,2) NOT NULL, -- Quantidade efetivamente recebida
    vlr_unitario DECIMAL(15,2) DEFAULT 0,
    vlr_total DECIMAL(15,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_entrada_estoque_item_entrada ON [dominio]_entrada_estoque_item(seq_entrada);
CREATE INDEX IF NOT EXISTS idx_[dominio]_entrada_estoque_item_item ON [dominio]_entrada_estoque_item(seq_item);
CREATE INDEX IF NOT EXISTS idx_[dominio]_entrada_estoque_item_posicao ON [dominio]_entrada_estoque_item(seq_posicao);

-- ============================================================================
-- TABELA: [dominio]_centro_custo
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_centro_custo (
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

CREATE INDEX IF NOT EXISTS idx_[dominio]_centro_custo_unidade ON [dominio]_centro_custo(unidade);

-- ============================================================================
-- TABELA: [dominio]_ordem_compra
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_ordem_compra (
    seq_ordem_compra SERIAL PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    nro_ordem_compra VARCHAR(20),
    seq_centro_custo INTEGER REFERENCES [dominio]_centro_custo(seq_centro_custo),
    aprovada CHAR(1) DEFAULT 'N',
    orcar CHAR(1) DEFAULT 'N',
    observacao TEXT,
    data_inclusao DATE NOT NULL DEFAULT CURRENT_DATE,
    hora_inclusao TIME NOT NULL DEFAULT CURRENT_TIME,
    login_inclusao VARCHAR(50) NOT NULL,
    data_aprovacao DATE,
    hora_aprovacao TIME,
    login_aprovacao VARCHAR(50),
    motivo_reprovacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_ordem_compra_unidade ON [dominio]_ordem_compra(unidade);
CREATE INDEX IF NOT EXISTS idx_[dominio]_ordem_compra_status ON [dominio]_ordem_compra(status);

-- ============================================================================
-- TABELA: [dominio]_ordem_compra_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_ordem_compra_item (
    seq_ordem_compra_item SERIAL PRIMARY KEY,
    seq_ordem_compra INTEGER NOT NULL REFERENCES [dominio]_ordem_compra(seq_ordem_compra),
    seq_item INTEGER NOT NULL REFERENCES [dominio]_item(seq_item)
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_ordem_compra_item_ordem ON [dominio]_ordem_compra_item(seq_ordem_compra);

-- ============================================================================
-- TABELA: [dominio]_orcamento
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_orcamento (
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

CREATE INDEX IF NOT EXISTS idx_[dominio]_orcamento_unidade ON [dominio]_orcamento(unidade);
CREATE INDEX IF NOT EXISTS idx_[dominio]_orcamento_status ON [dominio]_orcamento(status);

-- ============================================================================
-- TABELA: [dominio]_orcamento_ordem_compra
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_orcamento_ordem_compra (
    seq_orcamento_ordem_compra SERIAL PRIMARY KEY,
    seq_orcamento INTEGER NOT NULL REFERENCES [dominio]_orcamento(seq_orcamento),
    seq_ordem_compra INTEGER NOT NULL REFERENCES [dominio]_ordem_compra(seq_ordem_compra),
    UNIQUE(seq_orcamento, seq_ordem_compra)
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_orcamento_ordem_orcamento ON [dominio]_orcamento_ordem_compra(seq_orcamento);

-- ============================================================================
-- TABELA: [dominio]_orcamento_fornecedor
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_orcamento_fornecedor (
    seq_orcamento_fornecedor SERIAL PRIMARY KEY,
    seq_orcamento INTEGER NOT NULL REFERENCES [dominio]_orcamento(seq_orcamento),
    seq_fornecedor INTEGER NOT NULL REFERENCES [dominio]_fornecedor(seq_fornecedor),
    email VARCHAR(200),
    data_solicitacao DATE,
    hora_solicitacao TIME,
    data_retorno DATE,
    hora_retorno TIME,
    status VARCHAR(20) DEFAULT 'PENDENTE',
    UNIQUE(seq_orcamento, seq_fornecedor)
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_orcamento_fornecedor_orc ON [dominio]_orcamento_fornecedor(seq_orcamento);

-- ============================================================================
-- TABELA: [dominio]_orcamento_cotacao
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_orcamento_cotacao (
    seq_orcamento_cotacao SERIAL PRIMARY KEY,
    seq_orcamento INTEGER NOT NULL REFERENCES [dominio]_orcamento(seq_orcamento),
    seq_fornecedor INTEGER NOT NULL REFERENCES [dominio]_fornecedor(seq_fornecedor),
    seq_ordem_compra INTEGER NOT NULL REFERENCES [dominio]_ordem_compra(seq_ordem_compra),
    seq_item INTEGER NOT NULL REFERENCES [dominio]_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    vlr_estoque DECIMAL(15,2) DEFAULT 0,
    vlr_fornecedor DECIMAL(15,2) DEFAULT 0,
    vlr_total DECIMAL(15,2) DEFAULT 0,
    prazo_entrega INTEGER,
    observacao TEXT,
    selecionado CHAR(1) DEFAULT 'N'
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_orcamento_cotacao_orc ON [dominio]_orcamento_cotacao(seq_orcamento);
CREATE INDEX IF NOT EXISTS idx_[dominio]_orcamento_cotacao_forn ON [dominio]_orcamento_cotacao(seq_fornecedor);

-- ============================================================================
-- TABELA: [dominio]_pedido
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_pedido (
    seq_pedido SERIAL PRIMARY KEY,
    unidade VARCHAR(10) NOT NULL,
    nro_pedido VARCHAR(20),
    seq_orcamento INTEGER REFERENCES [dominio]_orcamento(seq_orcamento),
    seq_fornecedor INTEGER REFERENCES [dominio]_fornecedor(seq_fornecedor),
    status CHAR(1) DEFAULT 'P', -- 'P' = PENDENTE, 'E' = ENTREGUE
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

CREATE INDEX IF NOT EXISTS idx_[dominio]_pedido_unidade ON [dominio]_pedido(unidade);
CREATE INDEX IF NOT EXISTS idx_[dominio]_pedido_status ON [dominio]_pedido(status);
CREATE INDEX IF NOT EXISTS idx_[dominio]_pedido_fornecedor ON [dominio]_pedido(seq_fornecedor);

-- ============================================================================
-- TABELA: [dominio]_pedido_item
-- ============================================================================
CREATE TABLE IF NOT EXISTS [dominio]_pedido_item (
    seq_pedido_item SERIAL PRIMARY KEY,
    seq_pedido INTEGER NOT NULL REFERENCES [dominio]_pedido(seq_pedido),
    seq_item INTEGER NOT NULL REFERENCES [dominio]_item(seq_item),
    qtde_item DECIMAL(15,2) NOT NULL,
    vlr_unitario DECIMAL(15,2) DEFAULT 0,
    vlr_total DECIMAL(15,2) DEFAULT 0,
    observacao TEXT
);

CREATE INDEX IF NOT EXISTS idx_[dominio]_pedido_item_pedido ON [dominio]_pedido_item(seq_pedido);

-- ============================================================================
-- DADOS INICIAIS - UNIDADES DE MEDIDA
-- ============================================================================
INSERT INTO [dominio]_unidade_medida (descricao, sigla, login_inclusao) VALUES
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
INSERT INTO [dominio]_tipo_item (descricao, login_inclusao) VALUES
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
-- FIM DO SCRIPT
-- ============================================================================
-- INSTRUÇÕES DE USO:
-- 1. Substituir TODAS as ocorrências de [dominio] pelo código do domínio
-- 2. Exemplo para VCS: sed 's/\[dominio\]/vcs/g' este_arquivo.sql > vcs_estoque_compras.sql
-- 3. Executar: psql -U usuario -d presto_db -f vcs_estoque_compras.sql
-- ============================================================================