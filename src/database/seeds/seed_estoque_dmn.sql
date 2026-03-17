-- ============================================================================
-- SISTEMA PRESTO - SCRIPT DE ALIMENTAÇÃO - MÓDULO ESTOQUE
-- ============================================================================
-- Data de Criação: 29/01/2026
-- Domínio: dmn
-- Descrição: Script completo de alimentação para teste do módulo de estoque
-- Período de Movimentações: 01/12/2025 a 29/01/2026
-- ============================================================================

-- ============================================================================
-- LIMPEZA DAS TABELAS (na ordem reversa das FKs)
-- ============================================================================
TRUNCATE TABLE dmn_mvto_estoque CASCADE;
TRUNCATE TABLE dmn_requisicao_item CASCADE;
TRUNCATE TABLE dmn_requisicao CASCADE;
TRUNCATE TABLE dmn_inventario_posicao CASCADE;
TRUNCATE TABLE dmn_inventario CASCADE;
TRUNCATE TABLE dmn_posicao CASCADE;
TRUNCATE TABLE dmn_item CASCADE;
TRUNCATE TABLE dmn_tipo_item CASCADE;
TRUNCATE TABLE dmn_unidade_medida CASCADE;
TRUNCATE TABLE dmn_estoque CASCADE;

-- Resetar as sequences
ALTER SEQUENCE dmn_mvto_estoque_seq_mvto_estoque_seq RESTART WITH 1;
ALTER SEQUENCE dmn_requisicao_seq_requisicao_seq RESTART WITH 1;
ALTER SEQUENCE dmn_inventario_posicao_seq_inventario_posicao_seq RESTART WITH 1;
ALTER SEQUENCE dmn_inventario_seq_inventario_seq RESTART WITH 1;
ALTER SEQUENCE dmn_posicao_seq_posicao_seq RESTART WITH 1;
ALTER SEQUENCE dmn_item_seq_item_seq RESTART WITH 1;
ALTER SEQUENCE dmn_tipo_item_seq_tipo_item_seq RESTART WITH 1;
ALTER SEQUENCE dmn_unidade_medida_seq_unidade_medida_seq RESTART WITH 1;
ALTER SEQUENCE dmn_estoque_seq_estoque_seq RESTART WITH 1;

-- ============================================================================
-- UNIDADES DE MEDIDA
-- ============================================================================
INSERT INTO dmn_unidade_medida (descricao, sigla, login_inclusao) VALUES
('UNIDADE', 'UN', 'SISTEMA'),           -- seq = 1
('QUILOGRAMA', 'KG', 'SISTEMA'),        -- seq = 2
('METRO', 'M', 'SISTEMA'),              -- seq = 3
('LITRO', 'L', 'SISTEMA'),              -- seq = 4
('CAIXA', 'CX', 'SISTEMA'),             -- seq = 5
('PACOTE', 'PCT', 'SISTEMA'),           -- seq = 6
('PEÇA', 'PC', 'SISTEMA'),              -- seq = 7
('METRO QUADRADO', 'M²', 'SISTEMA'),    -- seq = 8
('METRO CÚBICO', 'M³', 'SISTEMA'),      -- seq = 9
('TONELADA', 'TON', 'SISTEMA');         -- seq = 10

-- ============================================================================
-- TIPOS DE ITEM
-- ============================================================================
INSERT INTO dmn_tipo_item (descricao, login_inclusao) VALUES
('MATÉRIA PRIMA', 'SISTEMA'),           -- seq = 1
('PRODUTO ACABADO', 'SISTEMA'),         -- seq = 2
('MATERIAL DE CONSUMO', 'SISTEMA'),     -- seq = 3
('MATERIAL DE ESCRITÓRIO', 'SISTEMA'),  -- seq = 4
('EQUIPAMENTO', 'SISTEMA'),             -- seq = 5
('FERRAMENTA', 'SISTEMA'),              -- seq = 6
('PEÇA DE REPOSIÇÃO', 'SISTEMA'),       -- seq = 7
('EMBALAGEM', 'SISTEMA');               -- seq = 8

-- ============================================================================
-- ESTOQUES
-- ============================================================================
INSERT INTO dmn_estoque (unidade, nro_estoque, descricao, ativo, login_inclusao) VALUES
('MTZ', 'EST-001', 'ESTOQUE GERAL MATRIZ', 'S', 'ADMIN'),           -- seq = 1
('MTZ', 'EST-002', 'ESTOQUE FERRAMENTAS MATRIZ', 'S', 'ADMIN'),     -- seq = 2
('SPO', 'EST-001', 'ESTOQUE GERAL SÃO PAULO', 'S', 'ADMIN'),        -- seq = 3
('CWB', 'EST-001', 'ESTOQUE GERAL CURITIBA', 'S', 'ADMIN');         -- seq = 4

-- ============================================================================
-- ITENS
-- ============================================================================
-- Matéria Prima (tipo_item = 1)
INSERT INTO dmn_item (codigo, codigo_fabricante, descricao, seq_tipo_item, seq_unidade_medida, vlr_item, estoque_minimo, estoque_maximo, ativo, login_inclusao) VALUES
('MAT-001', 'FAB-MP-001', 'AÇO CARBONO 1020 CHAPA 3MM', 1, 3, 450.00, 100, 500, 'S', 'ADMIN'),    -- seq = 1
('MAT-002', 'FAB-MP-002', 'ALUMÍNIO 6061 BARRA 50MM', 1, 3, 380.00, 50, 300, 'S', 'ADMIN'),       -- seq = 2
('MAT-003', 'FAB-MP-003', 'TUBO PVC 50MM', 1, 3, 25.00, 200, 1000, 'S', 'ADMIN'),                 -- seq = 3
('MAT-004', 'FAB-MP-004', 'CABO ELÉTRICO 2,5MM', 1, 3, 8.50, 500, 2000, 'S', 'ADMIN');            -- seq = 4

-- Material de Consumo (tipo_item = 3)
INSERT INTO dmn_item (codigo, codigo_fabricante, descricao, seq_tipo_item, seq_unidade_medida, vlr_item, estoque_minimo, estoque_maximo, ativo, login_inclusao) VALUES
('CONS-001', 'CONS-001', 'ÓLEO LUBRIFICANTE 20W50', 3, 4, 45.00, 50, 200, 'S', 'ADMIN'),          -- seq = 5
('CONS-002', 'CONS-002', 'GRAXA INDUSTRIAL', 3, 2, 35.00, 30, 150, 'S', 'ADMIN'),                 -- seq = 6
('CONS-003', 'CONS-003', 'ESTOPA BRANCA', 3, 2, 12.00, 100, 500, 'S', 'ADMIN'),                   -- seq = 7
('CONS-004', 'CONS-004', 'SOLVENTE INDUSTRIAL', 3, 4, 28.00, 40, 200, 'S', 'ADMIN');              -- seq = 8

-- Ferramentas (tipo_item = 6)
INSERT INTO dmn_item (codigo, codigo_fabricante, descricao, seq_tipo_item, seq_unidade_medida, vlr_item, estoque_minimo, estoque_maximo, ativo, login_inclusao) VALUES
('FERR-001', 'BOSCH-001', 'FURADEIRA ELÉTRICA 500W', 6, 1, 280.00, 5, 20, 'S', 'ADMIN'),          -- seq = 9
('FERR-002', 'MAKITA-002', 'ESMERILHADEIRA ANGULAR 7POL', 6, 1, 320.00, 3, 15, 'S', 'ADMIN'),    -- seq = 10
('FERR-003', 'DEWALT-003', 'PARAFUSADEIRA SEM FIO 12V', 6, 1, 450.00, 5, 20, 'S', 'ADMIN');      -- seq = 11

-- Peças de Reposição (tipo_item = 7)
INSERT INTO dmn_item (codigo, codigo_fabricante, descricao, seq_tipo_item, seq_unidade_medida, vlr_item, estoque_minimo, estoque_maximo, ativo, login_inclusao) VALUES
('PECA-001', 'REP-001', 'ROLAMENTO SKF 6205', 7, 1, 85.00, 20, 100, 'S', 'ADMIN'),                -- seq = 12
('PECA-002', 'REP-002', 'CORREIA SINCRONIZADA HTD 8M', 7, 1, 120.00, 10, 50, 'S', 'ADMIN'),       -- seq = 13
('PECA-003', 'REP-003', 'FILTRO DE AR COMPRESSOR', 7, 1, 65.00, 15, 80, 'S', 'ADMIN');            -- seq = 14

-- Material de Escritório (tipo_item = 4)
INSERT INTO dmn_item (codigo, codigo_fabricante, descricao, seq_tipo_item, seq_unidade_medida, vlr_item, estoque_minimo, estoque_maximo, ativo, login_inclusao) VALUES
('ESC-001', 'OF-001', 'PAPEL A4 RESMA 500 FOLHAS', 4, 1, 25.00, 50, 200, 'S', 'ADMIN'),           -- seq = 15
('ESC-002', 'OF-002', 'CANETA ESFEROGRÁFICA AZUL', 4, 5, 15.00, 20, 100, 'S', 'ADMIN'),           -- seq = 16
('ESC-003', 'OF-003', 'TONER HP CF283A', 4, 1, 180.00, 5, 30, 'S', 'ADMIN');                      -- seq = 17

-- ============================================================================
-- POSIÇÕES - ESTOQUE GERAL MATRIZ (seq_estoque = 1)
-- ============================================================================
-- RUA A - Matéria Prima
INSERT INTO dmn_posicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao) VALUES
(1, 'A', '01', '01', 1, 250.00, 'S', 'ADMIN'),  -- seq = 1: AÇO CARBONO
(1, 'A', '01', '02', 1, 180.00, 'S', 'ADMIN'),  -- seq = 2: AÇO CARBONO (outra posição)
(1, 'A', '02', '01', 2, 150.00, 'S', 'ADMIN'),  -- seq = 3: ALUMÍNIO
(1, 'A', '02', '02', 3, 450.00, 'S', 'ADMIN'),  -- seq = 4: TUBO PVC
(1, 'A', '03', '01', 4, 800.00, 'S', 'ADMIN');  -- seq = 5: CABO ELÉTRICO

-- RUA B - Material de Consumo
INSERT INTO dmn_posicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao) VALUES
(1, 'B', '01', '01', 5, 120.00, 'S', 'ADMIN'),  -- seq = 6: ÓLEO LUBRIFICANTE
(1, 'B', '01', '02', 6, 85.00, 'S', 'ADMIN'),   -- seq = 7: GRAXA
(1, 'B', '02', '01', 7, 250.00, 'S', 'ADMIN'),  -- seq = 8: ESTOPA
(1, 'B', '02', '02', 8, 100.00, 'S', 'ADMIN');  -- seq = 9: SOLVENTE

-- RUA C - Peças de Reposição
INSERT INTO dmn_posicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao) VALUES
(1, 'C', '01', '01', 12, 45.00, 'S', 'ADMIN'),  -- seq = 10: ROLAMENTO
(1, 'C', '01', '02', 13, 28.00, 'S', 'ADMIN'),  -- seq = 11: CORREIA
(1, 'C', '02', '01', 14, 35.00, 'S', 'ADMIN');  -- seq = 12: FILTRO

-- RUA D - Material de Escritório
INSERT INTO dmn_posicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao) VALUES
(1, 'D', '01', '01', 15, 120.00, 'S', 'ADMIN'), -- seq = 13: PAPEL A4
(1, 'D', '01', '02', 16, 45.00, 'S', 'ADMIN'),  -- seq = 14: CANETA
(1, 'D', '02', '01', 17, 18.00, 'S', 'ADMIN');  -- seq = 15: TONER

-- ============================================================================
-- POSIÇÕES - ESTOQUE FERRAMENTAS MATRIZ (seq_estoque = 2)
-- ============================================================================
INSERT INTO dmn_posicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao) VALUES
(2, 'F', '01', '01', 9, 12.00, 'S', 'ADMIN'),   -- seq = 16: FURADEIRA
(2, 'F', '01', '02', 10, 8.00, 'S', 'ADMIN'),   -- seq = 17: ESMERILHADEIRA
(2, 'F', '02', '01', 11, 15.00, 'S', 'ADMIN');  -- seq = 18: PARAFUSADEIRA

-- ============================================================================
-- POSIÇÕES - ESTOQUE GERAL SÃO PAULO (seq_estoque = 3)
-- ============================================================================
INSERT INTO dmn_posicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao) VALUES
(3, 'A', '01', '01', 1, 180.00, 'S', 'ADMIN'),  -- seq = 19: AÇO CARBONO
(3, 'A', '02', '01', 3, 320.00, 'S', 'ADMIN'),  -- seq = 20: TUBO PVC
(3, 'B', '01', '01', 5, 80.00, 'S', 'ADMIN'),   -- seq = 21: ÓLEO
(3, 'B', '02', '01', 7, 150.00, 'S', 'ADMIN'),  -- seq = 22: ESTOPA
(3, 'C', '01', '01', 12, 30.00, 'S', 'ADMIN');  -- seq = 23: ROLAMENTO

-- ============================================================================
-- POSIÇÕES - ESTOQUE GERAL CURITIBA (seq_estoque = 4)
-- ============================================================================
INSERT INTO dmn_posicao (seq_estoque, rua, altura, coluna, seq_item, saldo, ativa, login_inclusao) VALUES
(4, 'A', '01', '01', 2, 120.00, 'S', 'ADMIN'),  -- seq = 24: ALUMÍNIO
(4, 'A', '02', '01', 4, 600.00, 'S', 'ADMIN'),  -- seq = 25: CABO ELÉTRICO
(4, 'B', '01', '01', 6, 55.00, 'S', 'ADMIN'),   -- seq = 26: GRAXA
(4, 'B', '02', '01', 8, 70.00, 'S', 'ADMIN'),   -- seq = 27: SOLVENTE
(4, 'C', '01', '01', 13, 20.00, 'S', 'ADMIN');  -- seq = 28: CORREIA

-- ============================================================================
-- MOVIMENTAÇÕES TIPO 'E' - ENTRADAS MANUAIS (DEZEMBRO 2025)
-- ============================================================================
-- 05/12/2025 - Entrada manual de Matéria Prima
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2025-12-05', '09:30:00', 'ADMIN', 'E', 'E', 0, 1, 1, 100.00, 450.00, 45000.00, 'ENTRADA MANUAL - COMPRA DIRETA AÇO CARBONO'),
('2025-12-05', '09:35:00', 'ADMIN', 'E', 'E', 0, 3, 2, 50.00, 380.00, 19000.00, 'ENTRADA MANUAL - COMPRA DIRETA ALUMÍNIO');

-- 10/12/2025 - Entrada manual de Material de Consumo
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2025-12-10', '14:20:00', 'ADMIN', 'E', 'E', 0, 6, 5, 80.00, 45.00, 3600.00, 'ENTRADA MANUAL - COMPRA ÓLEO LUBRIFICANTE'),
('2025-12-10', '14:25:00', 'ADMIN', 'E', 'E', 0, 7, 6, 50.00, 35.00, 1750.00, 'ENTRADA MANUAL - COMPRA GRAXA INDUSTRIAL');

-- 15/12/2025 - Entrada manual de Ferramentas
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2025-12-15', '10:00:00', 'ADMIN', 'E', 'E', 0, 16, 9, 8.00, 280.00, 2240.00, 'ENTRADA MANUAL - COMPRA FURADEIRAS'),
('2025-12-15', '10:05:00', 'ADMIN', 'E', 'E', 0, 17, 10, 5.00, 320.00, 1600.00, 'ENTRADA MANUAL - COMPRA ESMERILHADEIRAS');

-- 20/12/2025 - Entrada manual de Peças
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2025-12-20', '11:15:00', 'ADMIN', 'E', 'E', 0, 10, 12, 30.00, 85.00, 2550.00, 'ENTRADA MANUAL - COMPRA ROLAMENTOS'),
('2025-12-20', '11:20:00', 'ADMIN', 'E', 'E', 0, 11, 13, 20.00, 120.00, 2400.00, 'ENTRADA MANUAL - COMPRA CORREIAS');

-- ============================================================================
-- REQUISIÇÕES DE SAÍDA (DEZEMBRO 2025)
-- ============================================================================
-- Requisição 1 - 08/12/2025
INSERT INTO dmn_requisicao (seq_estoque, login, solicitante, observacao, data_atendimento, hora_atendimento, login_atendimento) VALUES
(1, 'ADMIN', 'JOÃO SILVA', 'MANUTENÇÃO PREVENTIVA LINHA 01', '2025-12-08', '10:30:00', 'ADMIN');
-- seq_requisicao = 1

INSERT INTO dmn_requisicao_item (seq_requisicao, seq_item, qtde_item, seq_posicao) VALUES
(1, 1, 50.00, 1),  -- AÇO CARBONO da posição A-01-01 (seq_posicao=1)
(1, 5, 20.00, 6),  -- ÓLEO LUBRIFICANTE (seq_posicao=6)
(1, 7, 30.00, 8);  -- ESTOPA (seq_posicao=8)

-- Movimentações da Requisição 1
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2025-12-08', '10:30:00', 'ADMIN', 'S', 'R', 1, 1, 1, 50.00, 0, 0, 'SAÍDA - REQ. Nº 1 - JOÃO SILVA - MANUTENÇÃO PREVENTIVA LINHA 01'),
('2025-12-08', '10:30:00', 'ADMIN', 'S', 'R', 1, 6, 5, 20.00, 0, 0, 'SAÍDA - REQ. Nº 1 - JOÃO SILVA - MANUTENÇÃO PREVENTIVA LINHA 01'),
('2025-12-08', '10:30:00', 'ADMIN', 'S', 'R', 1, 8, 7, 30.00, 0, 0, 'SAÍDA - REQ. Nº 1 - JOÃO SILVA - MANUTENÇÃO PREVENTIVA LINHA 01');

-- Requisição 2 - 12/12/2025
INSERT INTO dmn_requisicao (seq_estoque, login, solicitante, observacao, data_atendimento, hora_atendimento, login_atendimento) VALUES
(1, 'ADMIN', 'MARIA SANTOS', 'REPARO URGENTE EQUIPAMENTO X', '2025-12-12', '15:45:00', 'ADMIN');
-- seq_requisicao = 2

INSERT INTO dmn_requisicao_item (seq_requisicao, seq_item, qtde_item, seq_posicao) VALUES
(2, 2, 30.00, 3),   -- ALUMÍNIO (seq_posicao=3)
(2, 12, 10.00, 10), -- ROLAMENTO (seq_posicao=10)
(2, 13, 5.00, 11);  -- CORREIA (seq_posicao=11)

INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2025-12-12', '15:45:00', 'ADMIN', 'S', 'R', 2, 3, 2, 30.00, 0, 0, 'SAÍDA - REQ. Nº 2 - MARIA SANTOS - REPARO URGENTE EQUIPAMENTO X'),
('2025-12-12', '15:45:00', 'ADMIN', 'S', 'R', 2, 10, 12, 10.00, 0, 0, 'SAÍDA - REQ. Nº 2 - MARIA SANTOS - REPARO URGENTE EQUIPAMENTO X'),
('2025-12-12', '15:45:00', 'ADMIN', 'S', 'R', 2, 11, 13, 5.00, 0, 0, 'SAÍDA - REQ. Nº 2 - MARIA SANTOS - REPARO URGENTE EQUIPAMENTO X');

-- Requisição 3 - 18/12/2025
INSERT INTO dmn_requisicao (seq_estoque, login, solicitante, observacao, data_atendimento, hora_atendimento, login_atendimento) VALUES
(2, 'ADMIN', 'PEDRO OLIVEIRA', 'FERRAMENTAS PARA OBRA EXTERNA', '2025-12-18', '08:00:00', 'ADMIN');
-- seq_requisicao = 3

INSERT INTO dmn_requisicao_item (seq_requisicao, seq_item, qtde_item, seq_posicao) VALUES
(3, 9, 3.00, 16),  -- FURADEIRA (seq_posicao=16)
(3, 10, 2.00, 17); -- ESMERILHADEIRA (seq_posicao=17)

INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2025-12-18', '08:00:00', 'ADMIN', 'S', 'R', 3, 16, 9, 3.00, 0, 0, 'SAÍDA - REQ. Nº 3 - PEDRO OLIVEIRA - FERRAMENTAS PARA OBRA EXTERNA'),
('2025-12-18', '08:00:00', 'ADMIN', 'S', 'R', 3, 17, 10, 2.00, 0, 0, 'SAÍDA - REQ. Nº 3 - PEDRO OLIVEIRA - FERRAMENTAS PARA OBRA EXTERNA');

-- ============================================================================
-- INVENTÁRIO 1 - 28/12/2025 (ESTOQUE GERAL MATRIZ)
-- ============================================================================
INSERT INTO dmn_inventario (nome_inventario, seq_estoque, status, data_inclusao, hora_inclusao, login_inclusao, data_conclusao, hora_conclusao, login_conclusao) VALUES
('INVENTÁRIO FIM DE ANO 2025', 1, 'CONCLUÍDO', '2025-12-28', '08:00:00', 'ADMIN', '2025-12-28', '16:30:00', 'ADMIN');
-- seq_inventario = 1

-- Contagens do Inventário 1
INSERT INTO dmn_inventario_posicao (seq_inventario, seq_posicao, saldo_sistema, saldo_contado, diferenca, data_contagem, hora_contagem, login_contagem) VALUES
(1, 1, 300.00, 305.00, 5.00, '2025-12-28', '09:00:00', 'ADMIN'),    -- AÇO CARBONO - SOBRA
(1, 2, 180.00, 178.00, -2.00, '2025-12-28', '09:15:00', 'ADMIN'),   -- AÇO CARBONO POS 2 - FALTA
(1, 3, 170.00, 170.00, 0.00, '2025-12-28', '09:30:00', 'ADMIN'),    -- ALUMÍNIO - OK
(1, 4, 450.00, 455.00, 5.00, '2025-12-28', '09:45:00', 'ADMIN'),    -- TUBO PVC - SOBRA
(1, 6, 180.00, 180.00, 0.00, '2025-12-28', '10:00:00', 'ADMIN'),    -- ÓLEO - OK
(1, 7, 85.00, 83.00, -2.00, '2025-12-28', '10:15:00', 'ADMIN'),     -- GRAXA - FALTA
(1, 10, 35.00, 35.00, 0.00, '2025-12-28', '10:30:00', 'ADMIN');     -- ROLAMENTO - OK

-- Movimentações do Inventário 1 (ajustes)
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2025-12-28', '16:30:00', 'ADMIN', 'E', 'I', 1, 1, 1, 5.00, 450.00, 2250.00, 'AJUSTE DE INVENTÁRIO - ENTRADA'),
('2025-12-28', '16:30:00', 'ADMIN', 'S', 'I', 1, 2, 1, 2.00, 450.00, 900.00, 'AJUSTE DE INVENTÁRIO - SAÍDA'),
('2025-12-28', '16:30:00', 'ADMIN', 'E', 'I', 1, 4, 3, 5.00, 25.00, 125.00, 'AJUSTE DE INVENTÁRIO - ENTRADA'),
('2025-12-28', '16:30:00', 'ADMIN', 'S', 'I', 1, 7, 6, 2.00, 35.00, 70.00, 'AJUSTE DE INVENTÁRIO - SAÍDA');

-- ============================================================================
-- MOVIMENTAÇÕES JANEIRO 2026
-- ============================================================================
-- 03/01/2026 - Entradas manuais
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-03', '10:00:00', 'ADMIN', 'E', 'E', 0, 4, 3, 200.00, 25.00, 5000.00, 'ENTRADA MANUAL - REPOSIÇÃO TUBO PVC'),
('2026-01-03', '10:10:00', 'ADMIN', 'E', 'E', 0, 5, 4, 300.00, 8.50, 2550.00, 'ENTRADA MANUAL - REPOSIÇÃO CABO ELÉTRICO');

-- Requisição 4 - 07/01/2026
INSERT INTO dmn_requisicao (seq_estoque, login, solicitante, observacao, data_atendimento, hora_atendimento, login_atendimento) VALUES
(1, 'ADMIN', 'CARLOS FERREIRA', 'PROJETO EXPANSÃO SETOR B', '2026-01-07', '09:15:00', 'ADMIN');
-- seq_requisicao = 4

INSERT INTO dmn_requisicao_item (seq_requisicao, seq_item, qtde_item, seq_posicao) VALUES
(4, 1, 80.00, 1),  -- AÇO CARBONO (seq_posicao=1)
(4, 3, 150.00, 4), -- TUBO PVC (seq_posicao=4)
(4, 4, 200.00, 5); -- CABO ELÉTRICO (seq_posicao=5)

INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-07', '09:15:00', 'ADMIN', 'S', 'R', 4, 1, 1, 80.00, 0, 0, 'SAÍDA - REQ. Nº 4 - CARLOS FERREIRA - PROJETO EXPANSÃO SETOR B'),
('2026-01-07', '09:15:00', 'ADMIN', 'S', 'R', 4, 4, 3, 150.00, 0, 0, 'SAÍDA - REQ. Nº 4 - CARLOS FERREIRA - PROJETO EXPANSÃO SETOR B'),
('2026-01-07', '09:15:00', 'ADMIN', 'S', 'R', 4, 5, 4, 200.00, 0, 0, 'SAÍDA - REQ. Nº 4 - CARLOS FERREIRA - PROJETO EXPANSÃO SETOR B');

-- 10/01/2026 - Entrada manual Material de Escritório
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-10', '14:30:00', 'ADMIN', 'E', 'E', 0, 13, 15, 100.00, 25.00, 2500.00, 'ENTRADA MANUAL - COMPRA PAPEL A4'),
('2026-01-10', '14:35:00', 'ADMIN', 'E', 'E', 0, 14, 16, 30.00, 15.00, 450.00, 'ENTRADA MANUAL - COMPRA CANETAS'),
('2026-01-10', '14:40:00', 'ADMIN', 'E', 'E', 0, 15, 17, 12.00, 180.00, 2160.00, 'ENTRADA MANUAL - COMPRA TONERS');

-- Requisição 5 - 14/01/2026
INSERT INTO dmn_requisicao (seq_estoque, login, solicitante, observacao, data_atendimento, hora_atendimento, login_atendimento) VALUES
(1, 'ADMIN', 'ANA COSTA', 'MATERIAL ESCRITÓRIO ADMINISTRAÇÃO', '2026-01-14', '11:00:00', 'ADMIN');
-- seq_requisicao = 5

INSERT INTO dmn_requisicao_item (seq_requisicao, seq_item, qtde_item, seq_posicao) VALUES
(5, 15, 25.00, 13), -- PAPEL A4 (seq_posicao=13)
(5, 16, 10.00, 14), -- CANETA (seq_posicao=14)
(5, 17, 3.00, 15);  -- TONER (seq_posicao=15)

INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-14', '11:00:00', 'ADMIN', 'S', 'R', 5, 13, 15, 25.00, 0, 0, 'SAÍDA - REQ. Nº 5 - ANA COSTA - MATERIAL ESCRITÓRIO ADMINISTRAÇÃO'),
('2026-01-14', '11:00:00', 'ADMIN', 'S', 'R', 5, 14, 16, 10.00, 0, 0, 'SAÍDA - REQ. Nº 5 - ANA COSTA - MATERIAL ESCRITÓRIO ADMINISTRAÇÃO'),
('2026-01-14', '11:00:00', 'ADMIN', 'S', 'R', 5, 15, 17, 3.00, 0, 0, 'SAÍDA - REQ. Nº 5 - ANA COSTA - MATERIAL ESCRITÓRIO ADMINISTRAÇÃO');

-- 17/01/2026 - Entrada manual Peças
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-17', '08:45:00', 'ADMIN', 'E', 'E', 0, 10, 12, 20.00, 85.00, 1700.00, 'ENTRADA MANUAL - REPOSIÇÃO ROLAMENTOS'),
('2026-01-17', '08:50:00', 'ADMIN', 'E', 'E', 0, 12, 14, 15.00, 65.00, 975.00, 'ENTRADA MANUAL - REPOSIÇÃO FILTROS');

-- Requisição 6 - 20/01/2026
INSERT INTO dmn_requisicao (seq_estoque, login, solicitante, observacao, data_atendimento, hora_atendimento, login_atendimento) VALUES
(1, 'ADMIN', 'ROBERTO ALVES', 'MANUTENÇÃO CORRETIVA PRENSA', '2026-01-20', '13:30:00', 'ADMIN');
-- seq_requisicao = 6

INSERT INTO dmn_requisicao_item (seq_requisicao, seq_item, qtde_item, seq_posicao) VALUES
(6, 12, 8.00, 10),  -- ROLAMENTO (seq_posicao=10)
(6, 13, 3.00, 11),  -- CORREIA (seq_posicao=11)
(6, 6, 10.00, 7);   -- GRAXA (seq_posicao=7)

INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-20', '13:30:00', 'ADMIN', 'S', 'R', 6, 10, 12, 8.00, 0, 0, 'SAÍDA - REQ. Nº 6 - ROBERTO ALVES - MANUTENÇÃO CORRETIVA PRENSA'),
('2026-01-20', '13:30:00', 'ADMIN', 'S', 'R', 6, 11, 13, 3.00, 0, 0, 'SAÍDA - REQ. Nº 6 - ROBERTO ALVES - MANUTENÇÃO CORRETIVA PRENSA'),
('2026-01-20', '13:30:00', 'ADMIN', 'S', 'R', 6, 7, 6, 10.00, 0, 0, 'SAÍDA - REQ. Nº 6 - ROBERTO ALVES - MANUTENÇÃO CORRETIVA PRENSA');

-- ============================================================================
-- INVENTÁRIO 2 - 24/01/2026 (ESTOQUE FERRAMENTAS)
-- ============================================================================
INSERT INTO dmn_inventario (nome_inventario, seq_estoque, status, data_inclusao, hora_inclusao, login_inclusao, data_conclusao, hora_conclusao, login_conclusao) VALUES
('INVENTÁRIO FERRAMENTAS JAN/2026', 2, 'CONCLUÍDO', '2026-01-24', '08:00:00', 'ADMIN', '2026-01-24', '12:00:00', 'ADMIN');
-- seq_inventario = 2

INSERT INTO dmn_inventario_posicao (seq_inventario, seq_posicao, saldo_sistema, saldo_contado, diferenca, data_contagem, hora_contagem, login_contagem) VALUES
(2, 16, 9.00, 8.00, -1.00, '2026-01-24', '09:00:00', 'ADMIN'),  -- FURADEIRA - FALTA
(2, 17, 6.00, 6.00, 0.00, '2026-01-24', '09:30:00', 'ADMIN'),   -- ESMERILHADEIRA - OK
(2, 18, 15.00, 16.00, 1.00, '2026-01-24', '10:00:00', 'ADMIN'); -- PARAFUSADEIRA - SOBRA

INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-24', '12:00:00', 'ADMIN', 'S', 'I', 2, 16, 9, 1.00, 280.00, 280.00, 'AJUSTE DE INVENTÁRIO - SAÍDA'),
('2026-01-24', '12:00:00', 'ADMIN', 'E', 'I', 2, 18, 11, 1.00, 450.00, 450.00, 'AJUSTE DE INVENTÁRIO - ENTRADA');

-- 27/01/2026 - Últimas entradas manuais
INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-27', '09:00:00', 'ADMIN', 'E', 'E', 0, 2, 1, 120.00, 450.00, 54000.00, 'ENTRADA MANUAL - ESTOQUE ESTRATÉGICO AÇO'),
('2026-01-27', '09:15:00', 'ADMIN', 'E', 'E', 0, 8, 7, 100.00, 12.00, 1200.00, 'ENTRADA MANUAL - ESTOQUE ESTRATÉGICO ESTOPA');

-- Requisição 7 - 29/01/2026 (HOJE)
INSERT INTO dmn_requisicao (seq_estoque, login, solicitante, observacao, data_atendimento, hora_atendimento, login_atendimento) VALUES
(1, 'ADMIN', 'JULIANA MENDES', 'SETUP NOVA LINHA PRODUÇÃO', '2026-01-29', '10:00:00', 'ADMIN');
-- seq_requisicao = 7

INSERT INTO dmn_requisicao_item (seq_requisicao, seq_item, qtde_item, seq_posicao) VALUES
(7, 2, 40.00, 3),  -- ALUMÍNIO (seq_posicao=3)
(7, 4, 150.00, 5), -- CABO ELÉTRICO (seq_posicao=5)
(7, 5, 15.00, 6),  -- ÓLEO LUBRIFICANTE (seq_posicao=6)
(7, 14, 8.00, 12); -- FILTRO (seq_posicao=12)

INSERT INTO dmn_mvto_estoque (data_mvto, hora_mvto, login, mvto, tipo, seq_origem, seq_posicao, seq_item, qtde_item, vlr_unitario, vlr_total, observacao) VALUES
('2026-01-29', '10:00:00', 'ADMIN', 'S', 'R', 7, 3, 2, 40.00, 0, 0, 'SAÍDA - REQ. Nº 7 - JULIANA MENDES - SETUP NOVA LINHA PRODUÇÃO'),
('2026-01-29', '10:00:00', 'ADMIN', 'S', 'R', 7, 5, 4, 150.00, 0, 0, 'SAÍDA - REQ. Nº 7 - JULIANA MENDES - SETUP NOVA LINHA PRODUÇÃO'),
('2026-01-29', '10:00:00', 'ADMIN', 'S', 'R', 7, 6, 5, 15.00, 0, 0, 'SAÍDA - REQ. Nº 7 - JULIANA MENDES - SETUP NOVA LINHA PRODUÇÃO'),
('2026-01-29', '10:00:00', 'ADMIN', 'S', 'R', 7, 12, 14, 8.00, 0, 0, 'SAÍDA - REQ. Nº 7 - JULIANA MENDES - SETUP NOVA LINHA PRODUÇÃO');

-- ============================================================================
-- ATUALIZAÇÃO DOS SALDOS FINAIS NAS POSIÇÕES
-- ============================================================================
-- POSIÇÃO 1 (A-01-01): AÇO CARBONO
-- Inicial: 250 | +100 (entrada) -50 (req1) +5 (inv) -80 (req4) = 225
UPDATE dmn_posicao SET saldo = 225.00 WHERE seq_posicao = 1;

-- POSIÇÃO 2 (A-01-02): AÇO CARBONO
-- Inicial: 180 | -2 (inv) +120 (entrada) = 298
UPDATE dmn_posicao SET saldo = 298.00 WHERE seq_posicao = 2;

-- POSIÇÃO 3 (A-02-01): ALUMÍNIO
-- Inicial: 150 | +50 (entrada) -30 (req2) -40 (req7) = 130
UPDATE dmn_posicao SET saldo = 130.00 WHERE seq_posicao = 3;

-- POSIÇÃO 4 (A-02-02): TUBO PVC
-- Inicial: 450 | +5 (inv) +200 (entrada) -150 (req4) = 505
UPDATE dmn_posicao SET saldo = 505.00 WHERE seq_posicao = 4;

-- POSIÇÃO 5 (A-03-01): CABO ELÉTRICO
-- Inicial: 800 | +300 (entrada) -200 (req4) -150 (req7) = 750
UPDATE dmn_posicao SET saldo = 750.00 WHERE seq_posicao = 5;

-- POSIÇÃO 6 (B-01-01): ÓLEO
-- Inicial: 120 | +80 (entrada) -20 (req1) -15 (req7) = 165
UPDATE dmn_posicao SET saldo = 165.00 WHERE seq_posicao = 6;

-- POSIÇÃO 7 (B-01-02): GRAXA
-- Inicial: 85 | +50 (entrada) -2 (inv) -10 (req6) = 123
UPDATE dmn_posicao SET saldo = 123.00 WHERE seq_posicao = 7;

-- POSIÇÃO 8 (B-02-01): ESTOPA
-- Inicial: 250 | -30 (req1) +100 (entrada) = 320
UPDATE dmn_posicao SET saldo = 320.00 WHERE seq_posicao = 8;

-- POSIÇÃO 9 (B-02-02): SOLVENTE
-- Inicial: 100 (sem movimentações) = 100
UPDATE dmn_posicao SET saldo = 100.00 WHERE seq_posicao = 9;

-- POSIÇÃO 10 (C-01-01): ROLAMENTO
-- Inicial: 45 | +30 (entrada) -10 (req2) +20 (entrada) -8 (req6) = 77
UPDATE dmn_posicao SET saldo = 77.00 WHERE seq_posicao = 10;

-- POSIÇÃO 11 (C-01-02): CORREIA
-- Inicial: 28 | +20 (entrada) -5 (req2) -3 (req6) = 40
UPDATE dmn_posicao SET saldo = 40.00 WHERE seq_posicao = 11;

-- POSIÇÃO 12 (C-02-01): FILTRO
-- Inicial: 35 | +15 (entrada) -8 (req7) = 42
UPDATE dmn_posicao SET saldo = 42.00 WHERE seq_posicao = 12;

-- POSIÇÃO 13 (D-01-01): PAPEL A4
-- Inicial: 120 | +100 (entrada) -25 (req5) = 195
UPDATE dmn_posicao SET saldo = 195.00 WHERE seq_posicao = 13;

-- POSIÇÃO 14 (D-01-02): CANETA
-- Inicial: 45 | +30 (entrada) -10 (req5) = 65
UPDATE dmn_posicao SET saldo = 65.00 WHERE seq_posicao = 14;

-- POSIÇÃO 15 (D-02-01): TONER
-- Inicial: 18 | +12 (entrada) -3 (req5) = 27
UPDATE dmn_posicao SET saldo = 27.00 WHERE seq_posicao = 15;

-- POSIÇÃO 16 (F-01-01): FURADEIRA
-- Inicial: 12 | +8 (entrada) -3 (req3) -1 (inv) = 16
UPDATE dmn_posicao SET saldo = 16.00 WHERE seq_posicao = 16;

-- POSIÇÃO 17 (F-01-02): ESMERILHADEIRA
-- Inicial: 8 | +5 (entrada) -2 (req3) = 11
UPDATE dmn_posicao SET saldo = 11.00 WHERE seq_posicao = 17;

-- POSIÇÃO 18 (F-02-01): PARAFUSADEIRA
-- Inicial: 15 | +1 (inv) = 16
UPDATE dmn_posicao SET saldo = 16.00 WHERE seq_posicao = 18;

-- ============================================================================
-- FIM DO SCRIPT DE ALIMENTAÇÃO
-- ============================================================================
-- RESUMO:
-- - 4 Estoques (MTZ, SPO, CWB)
-- - 17 Itens (Matéria Prima, Consumo, Ferramentas, Peças, Escritório)
-- - 28 Posições com saldo
-- - 2 Inventários concluídos
-- - 7 Requisições de saída
-- - 52 Movimentações (Entradas manuais, Requisições, Inventários)
-- - Período: 01/12/2025 a 29/01/2026
-- ============================================================================
