/**
 * SISTEMA PRESTO - MOCK DATA - MÓDULO ESTOQUE
 * ============================================
 * Mock data centralizado para todas as funcionalidades de estoque
 * Baseado no seed SQL do domínio DMN
 */

// ============================================================================
// UNIDADES DE MEDIDA
// ============================================================================
export const MOCK_UNIDADES_MEDIDA = [
  { seq_unidade_medida: 1, descricao: 'UNIDADE', sigla: 'UN', ativo: 'S' },
  { seq_unidade_medida: 2, descricao: 'QUILOGRAMA', sigla: 'KG', ativo: 'S' },
  { seq_unidade_medida: 3, descricao: 'METRO', sigla: 'M', ativo: 'S' },
  { seq_unidade_medida: 4, descricao: 'LITRO', sigla: 'L', ativo: 'S' },
  { seq_unidade_medida: 5, descricao: 'CAIXA', sigla: 'CX', ativo: 'S' },
  { seq_unidade_medida: 6, descricao: 'PACOTE', sigla: 'PCT', ativo: 'S' },
  { seq_unidade_medida: 7, descricao: 'PEÇA', sigla: 'PC', ativo: 'S' },
  { seq_unidade_medida: 8, descricao: 'METRO QUADRADO', sigla: 'M²', ativo: 'S' },
  { seq_unidade_medida: 9, descricao: 'METRO CÚBICO', sigla: 'M³', ativo: 'S' },
  { seq_unidade_medida: 10, descricao: 'TONELADA', sigla: 'TON', ativo: 'S' },
];

// ============================================================================
// TIPOS DE ITEM
// ============================================================================
export const MOCK_TIPOS_ITEM = [
  { seq_tipo_item: 1, descricao: 'MATÉRIA PRIMA', ativo: 'S' },
  { seq_tipo_item: 2, descricao: 'PRODUTO ACABADO', ativo: 'S' },
  { seq_tipo_item: 3, descricao: 'MATERIAL DE CONSUMO', ativo: 'S' },
  { seq_tipo_item: 4, descricao: 'MATERIAL DE ESCRITÓRIO', ativo: 'S' },
  { seq_tipo_item: 5, descricao: 'EQUIPAMENTO', ativo: 'S' },
  { seq_tipo_item: 6, descricao: 'FERRAMENTA', ativo: 'S' },
  { seq_tipo_item: 7, descricao: 'PEÇA DE REPOSIÇÃO', ativo: 'S' },
  { seq_tipo_item: 8, descricao: 'EMBALAGEM', ativo: 'S' },
];

// ============================================================================
// ESTOQUES
// ============================================================================
export const MOCK_ESTOQUES = [
  {
    seq_estoque: 1,
    unidade: 'MTZ',
    nro_estoque: 'EST-001',
    descricao: 'ESTOQUE GERAL MATRIZ',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    login_inclusao: 'ADMIN'
  },
  {
    seq_estoque: 2,
    unidade: 'MTZ',
    nro_estoque: 'EST-002',
    descricao: 'ESTOQUE FERRAMENTAS MATRIZ',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    login_inclusao: 'ADMIN'
  },
  {
    seq_estoque: 3,
    unidade: 'SPO',
    nro_estoque: 'EST-001',
    descricao: 'ESTOQUE GERAL SÃO PAULO',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    login_inclusao: 'ADMIN'
  },
  {
    seq_estoque: 4,
    unidade: 'CWB',
    nro_estoque: 'EST-001',
    descricao: 'ESTOQUE GERAL CURITIBA',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    login_inclusao: 'ADMIN'
  },
];

// ============================================================================
// ITENS
// ============================================================================
export const MOCK_ITENS = [
  // Matéria Prima
  {
    seq_item: 1,
    codigo: 'MAT-001',
    codigo_fabricante: 'FAB-MP-001',
    descricao: 'AÇO CARBONO 1020 CHAPA 3MM',
    seq_tipo_item: 1,
    tipo_item_descricao: 'MATÉRIA PRIMA',
    seq_unidade_medida: 3,
    unidade_medida_sigla: 'M',
    vlr_item: 450.00,
    estoque_minimo: 100,
    estoque_maximo: 500,
    ativo: 'S'
  },
  {
    seq_item: 2,
    codigo: 'MAT-002',
    codigo_fabricante: 'FAB-MP-002',
    descricao: 'ALUMÍNIO 6061 BARRA 50MM',
    seq_tipo_item: 1,
    tipo_item_descricao: 'MATÉRIA PRIMA',
    seq_unidade_medida: 3,
    unidade_medida_sigla: 'M',
    vlr_item: 380.00,
    estoque_minimo: 50,
    estoque_maximo: 300,
    ativo: 'S'
  },
  {
    seq_item: 3,
    codigo: 'MAT-003',
    codigo_fabricante: 'FAB-MP-003',
    descricao: 'TUBO PVC 50MM',
    seq_tipo_item: 1,
    tipo_item_descricao: 'MATÉRIA PRIMA',
    seq_unidade_medida: 3,
    unidade_medida_sigla: 'M',
    vlr_item: 25.00,
    estoque_minimo: 200,
    estoque_maximo: 1000,
    ativo: 'S'
  },
  {
    seq_item: 4,
    codigo: 'MAT-004',
    codigo_fabricante: 'FAB-MP-004',
    descricao: 'CABO ELÉTRICO 2,5MM',
    seq_tipo_item: 1,
    tipo_item_descricao: 'MATÉRIA PRIMA',
    seq_unidade_medida: 3,
    unidade_medida_sigla: 'M',
    vlr_item: 8.50,
    estoque_minimo: 500,
    estoque_maximo: 2000,
    ativo: 'S'
  },
  // Material de Consumo
  {
    seq_item: 5,
    codigo: 'CONS-001',
    codigo_fabricante: 'CONS-001',
    descricao: 'ÓLEO LUBRIFICANTE 20W50',
    seq_tipo_item: 3,
    tipo_item_descricao: 'MATERIAL DE CONSUMO',
    seq_unidade_medida: 4,
    unidade_medida_sigla: 'L',
    vlr_item: 45.00,
    estoque_minimo: 50,
    estoque_maximo: 200,
    ativo: 'S'
  },
  {
    seq_item: 6,
    codigo: 'CONS-002',
    codigo_fabricante: 'CONS-002',
    descricao: 'GRAXA INDUSTRIAL',
    seq_tipo_item: 3,
    tipo_item_descricao: 'MATERIAL DE CONSUMO',
    seq_unidade_medida: 2,
    unidade_medida_sigla: 'KG',
    vlr_item: 35.00,
    estoque_minimo: 30,
    estoque_maximo: 150,
    ativo: 'S'
  },
  {
    seq_item: 7,
    codigo: 'CONS-003',
    codigo_fabricante: 'CONS-003',
    descricao: 'ESTOPA BRANCA',
    seq_tipo_item: 3,
    tipo_item_descricao: 'MATERIAL DE CONSUMO',
    seq_unidade_medida: 2,
    unidade_medida_sigla: 'KG',
    vlr_item: 12.00,
    estoque_minimo: 100,
    estoque_maximo: 500,
    ativo: 'S'
  },
  {
    seq_item: 8,
    codigo: 'CONS-004',
    codigo_fabricante: 'CONS-004',
    descricao: 'SOLVENTE INDUSTRIAL',
    seq_tipo_item: 3,
    tipo_item_descricao: 'MATERIAL DE CONSUMO',
    seq_unidade_medida: 4,
    unidade_medida_sigla: 'L',
    vlr_item: 28.00,
    estoque_minimo: 40,
    estoque_maximo: 200,
    ativo: 'S'
  },
  // Ferramentas
  {
    seq_item: 9,
    codigo: 'FERR-001',
    codigo_fabricante: 'BOSCH-001',
    descricao: 'FURADEIRA ELÉTRICA 500W',
    seq_tipo_item: 6,
    tipo_item_descricao: 'FERRAMENTA',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 280.00,
    estoque_minimo: 5,
    estoque_maximo: 20,
    ativo: 'S'
  },
  {
    seq_item: 10,
    codigo: 'FERR-002',
    codigo_fabricante: 'MAKITA-002',
    descricao: 'ESMERILHADEIRA ANGULAR 7POL',
    seq_tipo_item: 6,
    tipo_item_descricao: 'FERRAMENTA',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 320.00,
    estoque_minimo: 3,
    estoque_maximo: 15,
    ativo: 'S'
  },
  {
    seq_item: 11,
    codigo: 'FERR-003',
    codigo_fabricante: 'DEWALT-003',
    descricao: 'PARAFUSADEIRA SEM FIO 12V',
    seq_tipo_item: 6,
    tipo_item_descricao: 'FERRAMENTA',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 450.00,
    estoque_minimo: 5,
    estoque_maximo: 20,
    ativo: 'S'
  },
  // Peças de Reposição
  {
    seq_item: 12,
    codigo: 'PECA-001',
    codigo_fabricante: 'REP-001',
    descricao: 'ROLAMENTO SKF 6205',
    seq_tipo_item: 7,
    tipo_item_descricao: 'PEÇA DE REPOSIÇÃO',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 85.00,
    estoque_minimo: 20,
    estoque_maximo: 100,
    ativo: 'S'
  },
  {
    seq_item: 13,
    codigo: 'PECA-002',
    codigo_fabricante: 'REP-002',
    descricao: 'CORREIA SINCRONIZADA HTD 8M',
    seq_tipo_item: 7,
    tipo_item_descricao: 'PEÇA DE REPOSIÇÃO',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 120.00,
    estoque_minimo: 10,
    estoque_maximo: 50,
    ativo: 'S'
  },
  {
    seq_item: 14,
    codigo: 'PECA-003',
    codigo_fabricante: 'REP-003',
    descricao: 'FILTRO DE AR COMPRESSOR',
    seq_tipo_item: 7,
    tipo_item_descricao: 'PEÇA DE REPOSIÇÃO',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 65.00,
    estoque_minimo: 15,
    estoque_maximo: 80,
    ativo: 'S'
  },
  // Material de Escritório
  {
    seq_item: 15,
    codigo: 'ESC-001',
    codigo_fabricante: 'OF-001',
    descricao: 'PAPEL A4 RESMA 500 FOLHAS',
    seq_tipo_item: 4,
    tipo_item_descricao: 'MATERIAL DE ESCRITÓRIO',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 25.00,
    estoque_minimo: 50,
    estoque_maximo: 200,
    ativo: 'S'
  },
  {
    seq_item: 16,
    codigo: 'ESC-002',
    codigo_fabricante: 'OF-002',
    descricao: 'CANETA ESFEROGRÁFICA AZUL',
    seq_tipo_item: 4,
    tipo_item_descricao: 'MATERIAL DE ESCRITÓRIO',
    seq_unidade_medida: 5,
    unidade_medida_sigla: 'CX',
    vlr_item: 15.00,
    estoque_minimo: 20,
    estoque_maximo: 100,
    ativo: 'S'
  },
  {
    seq_item: 17,
    codigo: 'ESC-003',
    codigo_fabricante: 'OF-003',
    descricao: 'TONER HP CF283A',
    seq_tipo_item: 4,
    tipo_item_descricao: 'MATERIAL DE ESCRITÓRIO',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 180.00,
    estoque_minimo: 5,
    estoque_maximo: 30,
    ativo: 'S'
  },
];

// ============================================================================
// POSIÇÕES (com saldos finais após movimentações)
// ============================================================================
export const MOCK_POSICOES = [
  // ESTOQUE GERAL MATRIZ (seq_estoque: 1)
  { seq_posicao: 1, seq_estoque: 1, rua: 'A', altura: '01', coluna: '01', seq_item: 1, saldo: 225.00, ativa: 'S' },
  { seq_posicao: 2, seq_estoque: 1, rua: 'A', altura: '01', coluna: '02', seq_item: 1, saldo: 298.00, ativa: 'S' },
  { seq_posicao: 3, seq_estoque: 1, rua: 'A', altura: '02', coluna: '01', seq_item: 2, saldo: 130.00, ativa: 'S' },
  { seq_posicao: 4, seq_estoque: 1, rua: 'A', altura: '02', coluna: '02', seq_item: 3, saldo: 505.00, ativa: 'S' },
  { seq_posicao: 5, seq_estoque: 1, rua: 'A', altura: '03', coluna: '01', seq_item: 4, saldo: 750.00, ativa: 'S' },
  { seq_posicao: 6, seq_estoque: 1, rua: 'B', altura: '01', coluna: '01', seq_item: 5, saldo: 165.00, ativa: 'S' },
  { seq_posicao: 7, seq_estoque: 1, rua: 'B', altura: '01', coluna: '02', seq_item: 6, saldo: 123.00, ativa: 'S' },
  { seq_posicao: 8, seq_estoque: 1, rua: 'B', altura: '02', coluna: '01', seq_item: 7, saldo: 320.00, ativa: 'S' },
  { seq_posicao: 9, seq_estoque: 1, rua: 'B', altura: '02', coluna: '02', seq_item: 8, saldo: 100.00, ativa: 'S' },
  { seq_posicao: 10, seq_estoque: 1, rua: 'C', altura: '01', coluna: '01', seq_item: 12, saldo: 77.00, ativa: 'S' },
  { seq_posicao: 11, seq_estoque: 1, rua: 'C', altura: '01', coluna: '02', seq_item: 13, saldo: 40.00, ativa: 'S' },
  { seq_posicao: 12, seq_estoque: 1, rua: 'C', altura: '02', coluna: '01', seq_item: 14, saldo: 42.00, ativa: 'S' },
  { seq_posicao: 13, seq_estoque: 1, rua: 'D', altura: '01', coluna: '01', seq_item: 15, saldo: 195.00, ativa: 'S' },
  { seq_posicao: 14, seq_estoque: 1, rua: 'D', altura: '01', coluna: '02', seq_item: 16, saldo: 65.00, ativa: 'S' },
  { seq_posicao: 15, seq_estoque: 1, rua: 'D', altura: '02', coluna: '01', seq_item: 17, saldo: 27.00, ativa: 'S' },
  
  // ESTOQUE FERRAMENTAS MATRIZ (seq_estoque: 2)
  { seq_posicao: 16, seq_estoque: 2, rua: 'F', altura: '01', coluna: '01', seq_item: 9, saldo: 16.00, ativa: 'S' },
  { seq_posicao: 17, seq_estoque: 2, rua: 'F', altura: '01', coluna: '02', seq_item: 10, saldo: 11.00, ativa: 'S' },
  { seq_posicao: 18, seq_estoque: 2, rua: 'F', altura: '02', coluna: '01', seq_item: 11, saldo: 16.00, ativa: 'S' },
  
  // ESTOQUE GERAL SÃO PAULO (seq_estoque: 3)
  { seq_posicao: 19, seq_estoque: 3, rua: 'A', altura: '01', coluna: '01', seq_item: 1, saldo: 180.00, ativa: 'S' },
  { seq_posicao: 20, seq_estoque: 3, rua: 'A', altura: '02', coluna: '01', seq_item: 3, saldo: 320.00, ativa: 'S' },
  { seq_posicao: 21, seq_estoque: 3, rua: 'B', altura: '01', coluna: '01', seq_item: 5, saldo: 80.00, ativa: 'S' },
  { seq_posicao: 22, seq_estoque: 3, rua: 'B', altura: '02', coluna: '01', seq_item: 7, saldo: 150.00, ativa: 'S' },
  { seq_posicao: 23, seq_estoque: 3, rua: 'C', altura: '01', coluna: '01', seq_item: 12, saldo: 30.00, ativa: 'S' },
  
  // ESTOQUE GERAL CURITIBA (seq_estoque: 4)
  { seq_posicao: 24, seq_estoque: 4, rua: 'A', altura: '01', coluna: '01', seq_item: 2, saldo: 120.00, ativa: 'S' },
  { seq_posicao: 25, seq_estoque: 4, rua: 'A', altura: '02', coluna: '01', seq_item: 4, saldo: 600.00, ativa: 'S' },
  { seq_posicao: 26, seq_estoque: 4, rua: 'B', altura: '01', coluna: '01', seq_item: 6, saldo: 55.00, ativa: 'S' },
  { seq_posicao: 27, seq_estoque: 4, rua: 'B', altura: '02', coluna: '01', seq_item: 8, saldo: 70.00, ativa: 'S' },
  { seq_posicao: 28, seq_estoque: 4, rua: 'C', altura: '01', coluna: '01', seq_item: 13, saldo: 20.00, ativa: 'S' },
  
  // POSIÇÕES VAZIAS (para receber novos itens)
  { seq_posicao: 29, seq_estoque: 1, rua: 'E', altura: '01', coluna: '01', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 30, seq_estoque: 1, rua: 'E', altura: '01', coluna: '02', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 31, seq_estoque: 1, rua: 'E', altura: '02', coluna: '01', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 32, seq_estoque: 1, rua: 'E', altura: '02', coluna: '02', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 33, seq_estoque: 2, rua: 'F', altura: '03', coluna: '01', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 34, seq_estoque: 2, rua: 'F', altura: '03', coluna: '02', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 35, seq_estoque: 3, rua: 'D', altura: '01', coluna: '01', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 36, seq_estoque: 3, rua: 'D', altura: '02', coluna: '01', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 37, seq_estoque: 4, rua: 'D', altura: '01', coluna: '01', seq_item: null, saldo: 0, ativa: 'S' },
  { seq_posicao: 38, seq_estoque: 4, rua: 'D', altura: '02', coluna: '01', seq_item: null, saldo: 0, ativa: 'S' },
];

// ============================================================================
// REQUISIÇÕES (SAÍDAS DE ESTOQUE)
// ============================================================================
export const MOCK_REQUISICOES = [
  {
    seq_requisicao: 1,
    seq_estoque: 1,
    login: 'ADMIN',
    solicitante: 'JOÃO SILVA',
    observacao: 'MANUTENÇÃO PREVENTIVA LINHA 01',
    data_atendimento: '2025-12-08',
    hora_atendimento: '10:30:00',
    login_atendimento: 'ADMIN',
    unidade: 'MTZ',
    nro_estoque: 'EST-001',
    estoque_descricao: 'ESTOQUE GERAL MATRIZ',
    qtd_itens: 3
  },
  {
    seq_requisicao: 2,
    seq_estoque: 1,
    login: 'ADMIN',
    solicitante: 'MARIA SANTOS',
    observacao: 'REPARO URGENTE EQUIPAMENTO X',
    data_atendimento: '2025-12-12',
    hora_atendimento: '15:45:00',
    login_atendimento: 'ADMIN',
    unidade: 'MTZ',
    nro_estoque: 'EST-001',
    estoque_descricao: 'ESTOQUE GERAL MATRIZ',
    qtd_itens: 3
  },
  {
    seq_requisicao: 3,
    seq_estoque: 2,
    login: 'ADMIN',
    solicitante: 'PEDRO OLIVEIRA',
    observacao: 'FERRAMENTAS PARA OBRA EXTERNA',
    data_atendimento: '2025-12-18',
    hora_atendimento: '08:00:00',
    login_atendimento: 'ADMIN',
    unidade: 'MTZ',
    nro_estoque: 'EST-002',
    estoque_descricao: 'ESTOQUE FERRAMENTAS MATRIZ',
    qtd_itens: 2
  },
  {
    seq_requisicao: 4,
    seq_estoque: 1,
    login: 'ADMIN',
    solicitante: 'CARLOS FERREIRA',
    observacao: 'PROJETO EXPANSÃO SETOR B',
    data_atendimento: '2026-01-07',
    hora_atendimento: '09:15:00',
    login_atendimento: 'ADMIN',
    unidade: 'MTZ',
    nro_estoque: 'EST-001',
    estoque_descricao: 'ESTOQUE GERAL MATRIZ',
    qtd_itens: 3
  },
  {
    seq_requisicao: 5,
    seq_estoque: 1,
    login: 'ADMIN',
    solicitante: 'ANA COSTA',
    observacao: 'MATERIAL ESCRITÓRIO ADMINISTRAÇÃO',
    data_atendimento: '2026-01-14',
    hora_atendimento: '11:00:00',
    login_atendimento: 'ADMIN',
    unidade: 'MTZ',
    nro_estoque: 'EST-001',
    estoque_descricao: 'ESTOQUE GERAL MATRIZ',
    qtd_itens: 3
  },
  {
    seq_requisicao: 6,
    seq_estoque: 1,
    login: 'ADMIN',
    solicitante: 'ROBERTO ALVES',
    observacao: 'MANUTENÇÃO CORRETIVA PRENSA',
    data_atendimento: '2026-01-20',
    hora_atendimento: '13:30:00',
    login_atendimento: 'ADMIN',
    unidade: 'MTZ',
    nro_estoque: 'EST-001',
    estoque_descricao: 'ESTOQUE GERAL MATRIZ',
    qtd_itens: 3
  },
  {
    seq_requisicao: 7,
    seq_estoque: 1,
    login: 'ADMIN',
    solicitante: 'JULIANA MENDES',
    observacao: 'SETUP NOVA LINHA PRODUÇÃO',
    data_atendimento: '2026-01-29',
    hora_atendimento: '10:00:00',
    login_atendimento: 'ADMIN',
    unidade: 'MTZ',
    nro_estoque: 'EST-001',
    estoque_descricao: 'ESTOQUE GERAL MATRIZ',
    qtd_itens: 4
  },
];

// ============================================================================
// INVENTÁRIOS
// ============================================================================
export const MOCK_INVENTARIOS = [
  {
    seq_inventario: 1,
    nome_inventario: 'INVENTÁRIO FIM DE ANO 2025',
    seq_estoque: 1,
    unidade: 'MTZ',
    nro_estoque: 'EST-001',
    estoque_descricao: 'ESTOQUE GERAL MATRIZ',
    status: 'CONCLUÍDO',
    data_inclusao: '2025-12-28',
    hora_inclusao: '08:00:00',
    login_inclusao: 'ADMIN',
    data_conclusao: '2025-12-28',
    hora_conclusao: '16:30:00',
    login_conclusao: 'ADMIN',
    qtd_posicoes: 7
  },
  {
    seq_inventario: 2,
    nome_inventario: 'INVENTÁRIO FERRAMENTAS JAN/2026',
    seq_estoque: 2,
    unidade: 'MTZ',
    nro_estoque: 'EST-002',
    estoque_descricao: 'ESTOQUE FERRAMENTAS MATRIZ',
    status: 'PENDENTE',
    data_inclusao: '2026-01-24',
    hora_inclusao: '08:00:00',
    login_inclusao: 'ADMIN',
    data_conclusao: null,
    hora_conclusao: null,
    login_conclusao: null,
    qtd_posicoes: 3
  },
];

// ============================================================================
// POSIÇÕES DOS INVENTÁRIOS
// ============================================================================
export const MOCK_INVENTARIO_POSICOES = [
  // INVENTÁRIO 1 - FIM DE ANO 2025 (GERAL - 7 posições)
  { seq_inventario_posicao: 1, seq_inventario: 1, seq_posicao: 1, rua: 'A', altura: '01', coluna: '01', seq_item: 1, item_codigo: 'MAT-001', item_descricao: 'AÇO CARBONO 1020 CHAPA 3MM', saldo_sistema: 225.00, saldo_contado: 225.00, diferenca: 0, vlr_item: 450.00 },
  { seq_inventario_posicao: 2, seq_inventario: 1, seq_posicao: 3, rua: 'A', altura: '02', coluna: '01', seq_item: 2, item_codigo: 'MAT-002', item_descricao: 'ALUMÍNIO 6061 BARRA 50MM', saldo_sistema: 130.00, saldo_contado: 128.00, diferenca: -2.00, vlr_item: 380.00 },
  { seq_inventario_posicao: 3, seq_inventario: 1, seq_posicao: 4, rua: 'A', altura: '02', coluna: '02', seq_item: 3, item_codigo: 'MAT-003', item_descricao: 'TUBO PVC 50MM', saldo_sistema: 505.00, saldo_contado: 505.00, diferenca: 0, vlr_item: 25.00 },
  { seq_inventario_posicao: 4, seq_inventario: 1, seq_posicao: 6, rua: 'B', altura: '01', coluna: '01', seq_item: 5, item_codigo: 'CONS-001', item_descricao: 'ÓLEO LUBRIFICANTE 20W50', saldo_sistema: 165.00, saldo_contado: 165.00, diferenca: 0, vlr_item: 45.00 },
  { seq_inventario_posicao: 5, seq_inventario: 1, seq_posicao: 10, rua: 'C', altura: '01', coluna: '01', seq_item: 12, item_codigo: 'PECA-001', item_descricao: 'ROLAMENTO SKF 6205', saldo_sistema: 77.00, saldo_contado: 80.00, diferenca: 3.00, vlr_item: 85.00 },
  { seq_inventario_posicao: 6, seq_inventario: 1, seq_posicao: 13, rua: 'D', altura: '01', coluna: '01', seq_item: 15, item_codigo: 'ESC-001', item_descricao: 'PAPEL A4 RESMA 500 FOLHAS', saldo_sistema: 195.00, saldo_contado: 195.00, diferenca: 0, vlr_item: 25.00 },
  { seq_inventario_posicao: 7, seq_inventario: 1, seq_posicao: 15, rua: 'D', altura: '02', coluna: '01', seq_item: 17, item_codigo: 'ESC-003', item_descricao: 'TONER HP CF283A', saldo_sistema: 27.00, saldo_contado: 25.00, diferenca: -2.00, vlr_item: 180.00 },
  
  // INVENTÁRIO 2 - FERRAMENTAS JAN/2026 (PARCIAL - RUA F - 3 posições)
  { seq_inventario_posicao: 8, seq_inventario: 2, seq_posicao: 16, rua: 'F', altura: '01', coluna: '01', seq_item: 9, item_codigo: 'FERR-001', item_descricao: 'FURADEIRA ELÉTRICA 500W', saldo_sistema: 16.00, saldo_contado: 0, diferenca: 0, vlr_item: 280.00 },
  { seq_inventario_posicao: 9, seq_inventario: 2, seq_posicao: 17, rua: 'F', altura: '01', coluna: '02', seq_item: 10, item_codigo: 'FERR-002', item_descricao: 'ESMERILHADEIRA ANGULAR 7POL', saldo_sistema: 11.00, saldo_contado: 0, diferenca: 0, vlr_item: 320.00 },
  { seq_inventario_posicao: 10, seq_inventario: 2, seq_posicao: 18, rua: 'F', altura: '02', coluna: '01', seq_item: 11, item_codigo: 'FERR-003', item_descricao: 'PARAFUSADEIRA SEM FIO 12V', saldo_sistema: 16.00, saldo_contado: 0, diferenca: 0, vlr_item: 450.00 },
];

// ============================================================================
// MOVIMENTAÇÕES DE ESTOQUE
// ============================================================================
export const MOCK_MOVIMENTACOES = [
  // Entradas manuais - Dezembro 2025
  {
    seq_mvto_estoque: 1,
    data_mvto: '2025-12-05',
    hora_mvto: '09:30:00',
    login: 'ADMIN',
    mvto: 'E',
    tipo: 'E',
    tipo_descricao: 'ENTRADA MANUAL',
    seq_origem: 0,
    seq_posicao: 1,
    posicao_descricao: 'A - ALT 01 - COL 01',
    seq_item: 1,
    codigo_item: 'MAT-001',
    descricao_item: 'AÇO CARBONO 1020 CHAPA 3MM',
    qtde_item: 100.00,
    vlr_unitario: 450.00,
    vlr_total: 45000.00,
    observacao: 'ENTRADA MANUAL - COMPRA DIRETA AÇO CARBONO',
    unidade: 'MTZ',
    nro_estoque: 'EST-001'
  },
  {
    seq_mvto_estoque: 2,
    data_mvto: '2025-12-05',
    hora_mvto: '09:35:00',
    login: 'ADMIN',
    mvto: 'E',
    tipo: 'E',
    tipo_descricao: 'ENTRADA MANUAL',
    seq_origem: 0,
    seq_posicao: 3,
    posicao_descricao: 'A - ALT 02 - COL 01',
    seq_item: 2,
    codigo_item: 'MAT-002',
    descricao_item: 'ALUMÍNIO 6061 BARRA 50MM',
    qtde_item: 50.00,
    vlr_unitario: 380.00,
    vlr_total: 19000.00,
    observacao: 'ENTRADA MANUAL - COMPRA DIRETA ALUMÍNIO',
    unidade: 'MTZ',
    nro_estoque: 'EST-001'
  },
  // Saídas por requisição - Dezembro 2025
  {
    seq_mvto_estoque: 3,
    data_mvto: '2025-12-08',
    hora_mvto: '10:30:00',
    login: 'ADMIN',
    mvto: 'S',
    tipo: 'R',
    tipo_descricao: 'REQUISIÇÃO',
    seq_origem: 1,
    seq_posicao: 1,
    posicao_descricao: 'A - ALT 01 - COL 01',
    seq_item: 1,
    codigo_item: 'MAT-001',
    descricao_item: 'AÇO CARBONO 1020 CHAPA 3MM',
    qtde_item: 50.00,
    vlr_unitario: 0,
    vlr_total: 0,
    observacao: 'SAÍDA - REQ. Nº 1 - JOÃO SILVA - MANUTENÇÃO PREVENTIVA LINHA 01',
    unidade: 'MTZ',
    nro_estoque: 'EST-001'
  },
  // Ajustes de inventário - Dezembro 2025
  {
    seq_mvto_estoque: 4,
    data_mvto: '2025-12-28',
    hora_mvto: '16:30:00',
    login: 'ADMIN',
    mvto: 'E',
    tipo: 'I',
    tipo_descricao: 'INVENTÁRIO',
    seq_origem: 1,
    seq_posicao: 1,
    posicao_descricao: 'A - ALT 01 - COL 01',
    seq_item: 1,
    codigo_item: 'MAT-001',
    descricao_item: 'AÇO CARBONO 1020 CHAPA 3MM',
    qtde_item: 5.00,
    vlr_unitario: 450.00,
    vlr_total: 2250.00,
    observacao: 'AJUSTE DE INVENTÁRIO - ENTRADA',
    unidade: 'MTZ',
    nro_estoque: 'EST-001'
  },
  // Janeiro 2026
  {
    seq_mvto_estoque: 5,
    data_mvto: '2026-01-29',
    hora_mvto: '10:00:00',
    login: 'ADMIN',
    mvto: 'S',
    tipo: 'R',
    tipo_descricao: 'REQUISIÇÃO',
    seq_origem: 7,
    seq_posicao: 3,
    posicao_descricao: 'A - ALT 02 - COL 01',
    seq_item: 2,
    codigo_item: 'MAT-002',
    descricao_item: 'ALUMÍNIO 6061 BARRA 50MM',
    qtde_item: 40.00,
    vlr_unitario: 0,
    vlr_total: 0,
    observacao: 'SAÍDA - REQ. Nº 7 - JULIANA MENDES - SETUP NOVA LINHA PRODUÇÃO',
    unidade: 'MTZ',
    nro_estoque: 'EST-001'
  },
];

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Retorna itens com saldo no estoque especificado
 */
export function getItensComSaldo(seq_estoque: number): any[] {
  const posicoes = MOCK_POSICOES.filter(p => p.seq_estoque === seq_estoque && p.saldo > 0);
  const seqItensUnicos = Array.from(new Set(posicoes.map(p => p.seq_item)));
  
  return MOCK_ITENS.filter(item => seqItensUnicos.includes(item.seq_item));
}

/**
 * Retorna posições com saldo de um item específico em um estoque
 */
export function getPosicoesComSaldo(seq_estoque: number, seq_item: number): any[] {
  return MOCK_POSICOES
    .filter(p => p.seq_estoque === seq_estoque && p.seq_item === seq_item && p.saldo > 0)
    .map(p => {
      const item = MOCK_ITENS.find(i => i.seq_item === p.seq_item);
      const estoque = MOCK_ESTOQUES.find(e => e.seq_estoque === p.seq_estoque);
      
      return {
        ...p,
        nro_posicao: `${p.rua}-${p.altura}-${p.coluna}`,
        posicao_descricao: `${p.rua} - ALT ${p.altura} - COL ${p.coluna}`,
        unidade: estoque?.unidade,
        nro_estoque: estoque?.nro_estoque,
        codigo_item: item?.codigo,
        descricao_item: item?.descricao,
        unidade_medida_sigla: item?.unidade_medida_sigla
      };
    });
}

/**
 * Retorna o saldo total de um item em um estoque (somando todas as posições)
 */
export function getSaldoTotalItem(seq_estoque: number, seq_item: number): number {
  return MOCK_POSICOES
    .filter(p => p.seq_estoque === seq_estoque && p.seq_item === seq_item)
    .reduce((total, p) => total + p.saldo, 0);
}

/**
 * Retorna estatísticas do estoque
 */
export function getEstatisticasEstoque() {
  return {
    total_estoques: MOCK_ESTOQUES.length,
    total_itens: MOCK_ITENS.length,
    total_posicoes: MOCK_POSICOES.length,
    total_requisicoes: MOCK_REQUISICOES.length,
    total_inventarios: MOCK_INVENTARIOS.length,
    total_movimentacoes: MOCK_MOVIMENTACOES.length,
    valor_total_estoque: MOCK_POSICOES.reduce((total, p) => {
      const item = MOCK_ITENS.find(i => i.seq_item === p.seq_item);
      return total + (p.saldo * (item?.vlr_item || 0));
    }, 0)
  };
}

// ============================================================================
// MÓDULO COMPRAS - CENTROS DE CUSTO
// ============================================================================
export const MOCK_CENTROS_CUSTO = [
  {
    seq_centro_custo: 1,
    unidade: 'MTZ',
    nro_centro_custo: 1,
    descricao: 'PRODUÇÃO - LINHA 01',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:00:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 2,
    unidade: 'MTZ',
    nro_centro_custo: 2,
    descricao: 'PRODUÇÃO - LINHA 02',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:05:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 3,
    unidade: 'MTZ',
    nro_centro_custo: 10,
    descricao: 'MANUTENÇÃO',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:10:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 4,
    unidade: 'MTZ',
    nro_centro_custo: 20,
    descricao: 'ADMINISTRAÇÃO',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:15:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 5,
    unidade: 'MTZ',
    nro_centro_custo: 30,
    descricao: 'COMERCIAL',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:20:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 6,
    unidade: 'SPO',
    nro_centro_custo: 1,
    descricao: 'PRODUÇÃO SÃO PAULO',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:25:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 7,
    unidade: 'SPO',
    nro_centro_custo: 10,
    descricao: 'MANUTENÇÃO SÃO PAULO',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:30:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 8,
    unidade: 'CWB',
    nro_centro_custo: 1,
    descricao: 'PRODUÇÃO CURITIBA',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:35:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 9,
    unidade: 'CWB',
    nro_centro_custo: 10,
    descricao: 'MANUTENÇÃO CURITIBA',
    ativo: 'S',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:40:00',
    login_inclusao: 'ADMIN'
  },
  {
    seq_centro_custo: 10,
    unidade: 'MTZ',
    nro_centro_custo: 999,
    descricao: 'DIVERSOS',
    ativo: 'N',
    data_inclusao: '2026-01-01',
    hora_inclusao: '08:45:00',
    login_inclusao: 'ADMIN'
  },
];

// ============================================================================
// MÓDULO COMPRAS - ORDENS DE COMPRA
// ============================================================================
export const MOCK_ORDENS_COMPRA = [
  {
    seq_ordem_compra: 1,
    unidade: 'MTZ',
    nro_ordem_compra: 'OC-2026-001',
    seq_centro_custo: 1,
    nro_centro_custo: 'MTZ000001',
    centro_custo_descricao: 'PRODUÇÃO - LINHA 01',
    centro_custo_unidade: 'MTZ',
    nro_setor: 1,
    setor_descricao: 'PRODUÇÃO',
    aprovada: 'N',
    orcar: 'N',
    observacao: 'COMPRA DE MATERIAIS PARA LINHA DE PRODUÇÃO',
    data_inclusao: '2026-01-15',
    hora_inclusao: '09:00:00',
    login_inclusao: 'ADMIN',
    qtd_itens: 4
  },
  {
    seq_ordem_compra: 2,
    unidade: 'MTZ',
    nro_ordem_compra: 'OC-2026-002',
    seq_centro_custo: 3,
    nro_centro_custo: 'MTZ000010',
    centro_custo_descricao: 'MANUTENÇÃO',
    centro_custo_unidade: 'MTZ',
    nro_setor: 2,
    setor_descricao: 'MANUTENÇÃO',
    aprovada: 'S',
    orcar: 'S',
    observacao: 'PEÇAS DE REPOSIÇÃO URGENTES',
    data_inclusao: '2026-01-18',
    hora_inclusao: '10:30:00',
    login_inclusao: 'ADMIN',
    data_aprovacao: '2026-01-19',
    hora_aprovacao: '14:00:00',
    login_aprovacao: 'GERENTE',
    qtd_itens: 3
  },
  {
    seq_ordem_compra: 3,
    unidade: 'MTZ',
    nro_ordem_compra: 'OC-2026-003',
    seq_centro_custo: 4,
    nro_centro_custo: 'MTZ000020',
    centro_custo_descricao: 'ADMINISTRAÇÃO',
    centro_custo_unidade: 'MTZ',
    nro_setor: 3,
    setor_descricao: 'ADMINISTRATIVO',
    aprovada: 'N',
    orcar: 'N',
    observacao: 'MATERIAL DE ESCRITÓRIO',
    data_inclusao: '2026-01-22',
    hora_inclusao: '11:15:00',
    login_inclusao: 'ADMIN',
    qtd_itens: 2
  },
  {
    seq_ordem_compra: 4,
    unidade: 'SPO',
    nro_ordem_compra: 'OC-2026-001',
    seq_centro_custo: 6,
    nro_centro_custo: 'SPO000001',
    centro_custo_descricao: 'PRODUÇÃO SÃO PAULO',
    centro_custo_unidade: 'SPO',
    nro_setor: 1,
    setor_descricao: 'PRODUÇÃO',
    aprovada: 'S',
    orcar: 'N',
    observacao: 'MATERIAIS PARA PRODUÇÃO - COMPRA DIRETA',
    data_inclusao: '2026-01-25',
    hora_inclusao: '08:30:00',
    login_inclusao: 'ADMIN',
    data_aprovacao: '2026-01-26',
    hora_aprovacao: '09:00:00',
    login_aprovacao: 'GERENTE',
    qtd_itens: 3
  },
  {
    seq_ordem_compra: 5,
    unidade: 'MTZ',
    nro_ordem_compra: 'OC-2026-004',
    seq_centro_custo: 2,
    nro_centro_custo: 'MTZ000002',
    centro_custo_descricao: 'PRODUÇÃO - LINHA 02',
    centro_custo_unidade: 'MTZ',
    nro_setor: 1,
    setor_descricao: 'PRODUÇÃO',
    aprovada: 'N',
    orcar: 'N',
    observacao: 'FERRAMENTAS NOVAS PARA LINHA 02',
    data_inclusao: '2026-01-28',
    hora_inclusao: '14:45:00',
    login_inclusao: 'ADMIN',
    qtd_itens: 2
  },
];

export const MOCK_ORDEM_COMPRA_ITENS = [
  // Itens da OC 1
  { seq_ordem_compra_item: 1, seq_ordem_compra: 1, seq_item: 1, codigo: 'MAT-001', descricao: 'AÇO CARBONO 1020 CHAPA 3MM', unidade_medida: 'M', qtde_item: 150.00 },
  { seq_ordem_compra_item: 2, seq_ordem_compra: 1, seq_item: 2, codigo: 'MAT-002', descricao: 'ALUMÍNIO 6061 BARRA 50MM', unidade_medida: 'M', qtde_item: 80.00 },
  { seq_ordem_compra_item: 3, seq_ordem_compra: 1, seq_item: 3, codigo: 'MAT-003', descricao: 'TUBO PVC 50MM', unidade_medida: 'M', qtde_item: 200.00 },
  { seq_ordem_compra_item: 4, seq_ordem_compra: 1, seq_item: 5, codigo: 'CONS-001', descricao: 'ÓLEO LUBRIFICANTE 20W50', unidade_medida: 'L', qtde_item: 50.00 },
  
  // Itens da OC 2
  { seq_ordem_compra_item: 5, seq_ordem_compra: 2, seq_item: 12, codigo: 'PECA-001', descricao: 'ROLAMENTO SKF 6205', unidade_medida: 'UN', qtde_item: 30.00 },
  { seq_ordem_compra_item: 6, seq_ordem_compra: 2, seq_item: 13, codigo: 'PECA-002', descricao: 'CORREIA SINCRONIZADA HTD 8M', unidade_medida: 'UN', qtde_item: 15.00 },
  { seq_ordem_compra_item: 7, seq_ordem_compra: 2, seq_item: 14, codigo: 'PECA-003', descricao: 'FILTRO DE AR COMPRESSOR', unidade_medida: 'UN', qtde_item: 20.00 },
  
  // Itens da OC 3
  { seq_ordem_compra_item: 8, seq_ordem_compra: 3, seq_item: 15, codigo: 'ESC-001', descricao: 'PAPEL A4 RESMA 500 FOLHAS', unidade_medida: 'UN', qtde_item: 100.00 },
  { seq_ordem_compra_item: 9, seq_ordem_compra: 3, seq_item: 17, codigo: 'ESC-003', descricao: 'TONER HP CF283A', unidade_medida: 'UN', qtde_item: 10.00 },
  
  // Itens da OC 4
  { seq_ordem_compra_item: 10, seq_ordem_compra: 4, seq_item: 1, codigo: 'MAT-001', descricao: 'AÇO CARBONO 1020 CHAPA 3MM', unidade_medida: 'M', qtde_item: 200.00 },
  { seq_ordem_compra_item: 11, seq_ordem_compra: 4, seq_item: 3, codigo: 'MAT-003', descricao: 'TUBO PVC 50MM', unidade_medida: 'M', qtde_item: 300.00 },
  { seq_ordem_compra_item: 12, seq_ordem_compra: 4, seq_item: 7, codigo: 'CONS-003', descricao: 'ESTOPA BRANCA', unidade_medida: 'KG', qtde_item: 150.00 },
  
  // Itens da OC 5
  { seq_ordem_compra_item: 13, seq_ordem_compra: 5, seq_item: 9, codigo: 'FERR-001', descricao: 'FURADEIRA ELÉTRICA 500W', unidade_medida: 'UN', qtde_item: 5.00 },
  { seq_ordem_compra_item: 14, seq_ordem_compra: 5, seq_item: 10, codigo: 'FERR-002', descricao: 'ESMERILHADEIRA ANGULAR 7POL', unidade_medida: 'UN', qtde_item: 3.00 },
];

// ============================================================================
// MÓDULO COMPRAS - ORÇAMENTOS
// ============================================================================
export const MOCK_ORCAMENTOS = [
  {
    seq_orcamento: 1,
    unidade: 'MTZ',
    nro_orcamento: 'ORC-000001',
    status: 'PENDENTE',
    observacao: 'ORÇAMENTO DE MATERIAIS E PEÇAS',
    data_inclusao: '2026-01-29',
    hora_inclusao: '10:00:00',
    login_inclusao: 'ADMIN',
    qtd_ordens: 2
  },
  {
    seq_orcamento: 2,
    unidade: 'FLN',
    nro_orcamento: 'ORC-000002',
    status: 'FINALIZADO',
    observacao: 'ORÇAMENTO MATERIAIS ESCRITÓRIO',
    data_inclusao: '2026-01-25',
    hora_inclusao: '14:30:00',
    login_inclusao: 'ADMIN',
    data_aprovacao: '2026-01-27',
    hora_aprovacao: '16:00:00',
    login_aprovacao: 'ADMIN',
    qtd_ordens: 1
  },
  {
    seq_orcamento: 3,
    unidade: 'MTZ',
    nro_orcamento: 'ORC-2026-003',
    status: 'PENDENTE',
    observacao: 'ORÇAMENTO PARA DEMONSTRAÇÃO COM VALORES PREENCHIDOS',
    data_inclusao: '2026-01-29',
    hora_inclusao: '14:30:00',
    login_inclusao: 'ADMIN',
    qtd_ordens: 2
  },
];

export const MOCK_ORCAMENTO_ORDENS = [
  // Orçamento 1 - VAZIO (recém-criado)
  { seq_orcamento_ordem_compra: 1, seq_orcamento: 1, seq_ordem_compra: 1 },
  { seq_orcamento_ordem_compra: 2, seq_orcamento: 1, seq_ordem_compra: 4 },
  
  // Orçamento 2 - APROVADO
  { seq_orcamento_ordem_compra: 3, seq_orcamento: 2, seq_ordem_compra: 3 },
  
  // Orçamento 3 - PENDENTE COM VALORES (para demonstração)
  { seq_orcamento_ordem_compra: 4, seq_orcamento: 3, seq_ordem_compra: 1 },
  { seq_orcamento_ordem_compra: 5, seq_orcamento: 3, seq_ordem_compra: 2 },
];

export const MOCK_ORCAMENTO_FORNECEDORES = [
  // Orçamento 1 - 3 fornecedores
  {
    seq_orcamento_fornecedor: 1,
    seq_orcamento: 1,
    seq_fornecedor: 1,
    email: 'compras@metalurgicasilva.com.br',
    status: 'PENDENTE',
    data_solicitacao: null,
    data_retorno: null,
    condicao_pgto: null,
    data_prev_ent: null
  },
  {
    seq_orcamento_fornecedor: 2,
    seq_orcamento: 1,
    seq_fornecedor: 2,
    email: 'vendas@distribuidorasantos.com.br',
    status: 'PENDENTE',
    data_solicitacao: null,
    data_retorno: null,
    condicao_pgto: null,
    data_prev_ent: null
  },
  {
    seq_orcamento_fornecedor: 3,
    seq_orcamento: 1,
    seq_fornecedor: 3,
    email: 'comercial@industrialferreira.com.br',
    status: 'PENDENTE',
    data_solicitacao: null,
    data_retorno: null,
    condicao_pgto: null,
    data_prev_ent: null
  },
  
  // Orçamento 2 - 2 fornecedores (FINALIZADO)
  {
    seq_orcamento_fornecedor: 4,
    seq_orcamento: 2,
    seq_fornecedor: 5,
    email: 'vendas@papelariapresente.com.br',
    status: 'CONCLUIDO',
    data_solicitacao: '2026-01-25',
    data_retorno: '2026-01-26',
    condicao_pgto: '30 DIAS',
    data_prev_ent: '2026-02-10'
  },
  {
    seq_orcamento_fornecedor: 5,
    seq_orcamento: 2,
    seq_fornecedor: 6,
    email: 'contato@escritoriomoderno.com.br',
    status: 'CONCLUIDO',
    data_solicitacao: '2026-01-25',
    data_retorno: '2026-01-26',
    condicao_pgto: '15 DIAS',
    data_prev_ent: '2026-02-05'
  },

  // Orçamento 3 - 3 fornecedores (PENDENTE COM VALORES)
  {
    seq_orcamento_fornecedor: 6,
    seq_orcamento: 3,
    seq_fornecedor: 1,
    email: 'compras@metalurgicasilva.com.br',
    status: 'CONCLUIDO',
    data_solicitacao: '2026-01-29',
    data_retorno: '2026-01-29',
    condicao_pgto: '45 DIAS',
    data_prev_ent: '2026-02-15'
  },
  {
    seq_orcamento_fornecedor: 7,
    seq_orcamento: 3,
    seq_fornecedor: 2,
    email: 'vendas@distribuidorasantos.com.br',
    status: 'CONCLUIDO',
    data_solicitacao: '2026-01-29',
    data_retorno: '2026-01-29',
    condicao_pgto: '30 DIAS',
    data_prev_ent: '2026-02-08'
  },
  {
    seq_orcamento_fornecedor: 8,
    seq_orcamento: 3,
    seq_fornecedor: 3,
    email: 'comercial@industrialferreira.com.br',
    status: 'CONCLUIDO',
    data_solicitacao: '2026-01-29',
    data_retorno: '2026-01-29',
    condicao_pgto: '60 DIAS',
    data_prev_ent: '2026-02-20'
  },
];

export const MOCK_ORCAMENTO_COTACOES = [
  // ✅ CORREÇÃO: Orçamento 1 NÃO tem cotações (recém-criado, valores vazios)
  // Deixar vazio para simular um orçamento novo sem preços informados
  
  // Orçamento 2 - Cotações do fornecedor 5 (Papelaria Presente)
  {
    seq_orcamento_cotacao: 1,
    seq_orcamento: 2,
    seq_fornecedor: 5,
    seq_ordem_compra: 3,
    seq_item: 15,
    qtde_item: 100.00,
    vlr_estoque: 25.00,
    vlr_fornecedor: 22.50,
    vlr_total: 2250.00,
    prazo_entrega: 0,
    observacao: '',
    selecionado: 'S'
  },
  {
    seq_orcamento_cotacao: 2,
    seq_orcamento: 2,
    seq_fornecedor: 5,
    seq_ordem_compra: 3,
    seq_item: 17,
    qtde_item: 10.00,
    vlr_estoque: 180.00,
    vlr_fornecedor: 165.00,
    vlr_total: 1650.00,
    prazo_entrega: 0,
    observacao: '',
    selecionado: 'S'
  },
  
  // Orçamento 2 - Cotações do fornecedor 6 (Escritório Moderno) - NÃO SELECIONADO
  {
    seq_orcamento_cotacao: 3,
    seq_orcamento: 2,
    seq_fornecedor: 6,
    seq_ordem_compra: 3,
    seq_item: 15,
    qtde_item: 100.00,
    vlr_estoque: 25.00,
    vlr_fornecedor: 24.00,
    vlr_total: 2400.00,
    prazo_entrega: 0,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 4,
    seq_orcamento: 2,
    seq_fornecedor: 6,
    seq_ordem_compra: 3,
    seq_item: 17,
    qtde_item: 10.00,
    vlr_estoque: 180.00,
    vlr_fornecedor: 170.00,
    vlr_total: 1700.00,
    prazo_entrega: 0,
    observacao: '',
    selecionado: 'N'
  },

  // ============================================================================
  // Orçamento 3 - PENDENTE COM VALORES PREENCHIDOS (para demonstração)
  // ============================================================================
  
  // Fornecedor 1 - Metalúrgica Silva (preços competitivos em alguns itens)
  {
    seq_orcamento_cotacao: 100,
    seq_orcamento: 3,
    seq_fornecedor: 1,
    seq_ordem_compra: 1,
    seq_item: 1,
    qtde_item: 150.00,
    vlr_estoque: 450.00,
    vlr_fornecedor: 420.00,
    vlr_total: 63000.00,
    prazo_entrega: 15,
    observacao: '',
    selecionado: 'S'
  },
  {
    seq_orcamento_cotacao: 101,
    seq_orcamento: 3,
    seq_fornecedor: 1,
    seq_ordem_compra: 1,
    seq_item: 2,
    qtde_item: 80.00,
    vlr_estoque: 380.00,
    vlr_fornecedor: 365.00,
    vlr_total: 29200.00,
    prazo_entrega: 15,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 102,
    seq_orcamento: 3,
    seq_fornecedor: 1,
    seq_ordem_compra: 1,
    seq_item: 3,
    qtde_item: 200.00,
    vlr_estoque: 25.00,
    vlr_fornecedor: 23.50,
    vlr_total: 4700.00,
    prazo_entrega: 15,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 103,
    seq_orcamento: 3,
    seq_fornecedor: 1,
    seq_ordem_compra: 1,
    seq_item: 5,
    qtde_item: 50.00,
    vlr_estoque: 45.00,
    vlr_fornecedor: 43.00,
    vlr_total: 2150.00,
    prazo_entrega: 15,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 104,
    seq_orcamento: 3,
    seq_fornecedor: 1,
    seq_ordem_compra: 2,
    seq_item: 6,
    qtde_item: 100.00,
    vlr_estoque: 85.00,
    vlr_fornecedor: 82.00,
    vlr_total: 8200.00,
    prazo_entrega: 15,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 105,
    seq_orcamento: 3,
    seq_fornecedor: 1,
    seq_ordem_compra: 2,
    seq_item: 7,
    qtde_item: 120.00,
    vlr_estoque: 65.00,
    vlr_fornecedor: 61.50,
    vlr_total: 7380.00,
    prazo_entrega: 15,
    observacao: '',
    selecionado: 'N'
  },

  // Fornecedor 2 - Distribuidora Santos (melhores preços na maioria)
  {
    seq_orcamento_cotacao: 200,
    seq_orcamento: 3,
    seq_fornecedor: 2,
    seq_ordem_compra: 1,
    seq_item: 1,
    qtde_item: 150.00,
    vlr_estoque: 450.00,
    vlr_fornecedor: 435.00,
    vlr_total: 65250.00,
    prazo_entrega: 10,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 201,
    seq_orcamento: 3,
    seq_fornecedor: 2,
    seq_ordem_compra: 1,
    seq_item: 2,
    qtde_item: 80.00,
    vlr_estoque: 380.00,
    vlr_fornecedor: 358.00,
    vlr_total: 28640.00,
    prazo_entrega: 10,
    observacao: '',
    selecionado: 'S'
  },
  {
    seq_orcamento_cotacao: 202,
    seq_orcamento: 3,
    seq_fornecedor: 2,
    seq_ordem_compra: 1,
    seq_item: 3,
    qtde_item: 200.00,
    vlr_estoque: 25.00,
    vlr_fornecedor: 22.00,
    vlr_total: 4400.00,
    prazo_entrega: 10,
    observacao: '',
    selecionado: 'S'
  },
  {
    seq_orcamento_cotacao: 203,
    seq_orcamento: 3,
    seq_fornecedor: 2,
    seq_ordem_compra: 1,
    seq_item: 5,
    qtde_item: 50.00,
    vlr_estoque: 45.00,
    vlr_fornecedor: 42.00,
    vlr_total: 2100.00,
    prazo_entrega: 10,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 204,
    seq_orcamento: 3,
    seq_fornecedor: 2,
    seq_ordem_compra: 2,
    seq_item: 6,
    qtde_item: 100.00,
    vlr_estoque: 85.00,
    vlr_fornecedor: 79.00,
    vlr_total: 7900.00,
    prazo_entrega: 10,
    observacao: '',
    selecionado: 'S'
  },
  {
    seq_orcamento_cotacao: 205,
    seq_orcamento: 3,
    seq_fornecedor: 2,
    seq_ordem_compra: 2,
    seq_item: 7,
    qtde_item: 120.00,
    vlr_estoque: 65.00,
    vlr_fornecedor: 60.00,
    vlr_total: 7200.00,
    prazo_entrega: 10,
    observacao: '',
    selecionado: 'S'
  },

  // Fornecedor 3 - Industrial Ferreira (preços intermediários)
  {
    seq_orcamento_cotacao: 300,
    seq_orcamento: 3,
    seq_fornecedor: 3,
    seq_ordem_compra: 1,
    seq_item: 1,
    qtde_item: 150.00,
    vlr_estoque: 450.00,
    vlr_fornecedor: 428.00,
    vlr_total: 64200.00,
    prazo_entrega: 20,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 301,
    seq_orcamento: 3,
    seq_fornecedor: 3,
    seq_ordem_compra: 1,
    seq_item: 2,
    qtde_item: 80.00,
    vlr_estoque: 380.00,
    vlr_fornecedor: 370.00,
    vlr_total: 29600.00,
    prazo_entrega: 20,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 302,
    seq_orcamento: 3,
    seq_fornecedor: 3,
    seq_ordem_compra: 1,
    seq_item: 3,
    qtde_item: 200.00,
    vlr_estoque: 25.00,
    vlr_fornecedor: 24.50,
    vlr_total: 4900.00,
    prazo_entrega: 20,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 303,
    seq_orcamento: 3,
    seq_fornecedor: 3,
    seq_ordem_compra: 1,
    seq_item: 5,
    qtde_item: 50.00,
    vlr_estoque: 45.00,
    vlr_fornecedor: 40.50,
    vlr_total: 2025.00,
    prazo_entrega: 20,
    observacao: '',
    selecionado: 'S'
  },
  {
    seq_orcamento_cotacao: 304,
    seq_orcamento: 3,
    seq_fornecedor: 3,
    seq_ordem_compra: 2,
    seq_item: 6,
    qtde_item: 100.00,
    vlr_estoque: 85.00,
    vlr_fornecedor: 81.00,
    vlr_total: 8100.00,
    prazo_entrega: 20,
    observacao: '',
    selecionado: 'N'
  },
  {
    seq_orcamento_cotacao: 305,
    seq_orcamento: 3,
    seq_fornecedor: 3,
    seq_ordem_compra: 2,
    seq_item: 7,
    qtde_item: 120.00,
    vlr_estoque: 65.00,
    vlr_fornecedor: 62.00,
    vlr_total: 7440.00,
    prazo_entrega: 20,
    observacao: '',
    selecionado: 'N'
  },
];

// ============================================================================
// PEDIDOS - Gerados via orçamento ou manualmente
// ============================================================================
export const MOCK_PEDIDOS = [
  // Pedido 1 - Gerado via orçamento 2 (FINALIZADO)
  {
    seq_pedido: 1,
    unidade: 'MTZ',
    nro_pedido: 'PED-2026/001',
    seq_orcamento: 2,
    seq_fornecedor: 5,
    status: 'F', // ✅ F = FINALIZADO
    vlr_total: 3500.00,
    observacao: 'PEDIDO GERADO AUTOMATICAMENTE VIA ORÇAMENTO',
    data_inclusao: '2026-01-27',
    hora_inclusao: '10:30:00',
    login_inclusao: 'admin',
    data_fin: '2026-01-28',
    hora_fin: '14:20:00',
    login_fin: 'admin',
    ser_nf: '1',
    nro_nf: '12345',
    chave_nfe: '12345678901234567890123456789012345678901234'
  },
  // Pedido 2 - Gerado via orçamento 2 (FINALIZADO)
  {
    seq_pedido: 2,
    unidade: 'MTZ',
    nro_pedido: 'PED-2026/002',
    seq_orcamento: 2,
    seq_fornecedor: 6,
    status: 'F', // ✅ F = FINALIZADO
    vlr_total: 4200.00,
    observacao: 'PEDIDO GERADO AUTOMATICAMENTE VIA ORÇAMENTO',
    data_inclusao: '2026-01-27',
    hora_inclusao: '10:30:00',
    login_inclusao: 'admin',
    data_fin: '2026-01-28',
    hora_fin: '16:45:00',
    login_fin: 'admin',
    ser_nf: '1',
    nro_nf: '54321',
    chave_nfe: '98765432109876543210987654321098765432109876'
  },
  // Pedido 3 - Manual (sem orçamento) - PENDENTE
  {
    seq_pedido: 3,
    unidade: 'MTZ',
    nro_pedido: '3',
    seq_orcamento: null,
    seq_fornecedor: 1,
    status: 'P',
    vlr_total: 8500.00,
    observacao: 'PEDIDO MANUAL - COMPRA URGENTE',
    data_inclusao: '2026-01-29',
    hora_inclusao: '08:15:00',
    login_inclusao: 'admin',
    data_fin: null,
    hora_fin: null,
    login_fin: null,
    ser_nf: null,
    nro_nf: null,
    chave_nfe: null
  },
  // Pedido 4 - Manual (sem orçamento) - ENTREGUE
  {
    seq_pedido: 4,
    unidade: 'MTZ',
    nro_pedido: 'PED-2026/004',
    seq_orcamento: 0,
    seq_fornecedor: 2,
    status: 'E', // ✅ E = ENTREGUE
    vlr_total: 12300.00,
    observacao: 'PEDIDO MANUAL - REPOSIÇÃO ESTOQUE',
    data_inclusao: '2026-01-28',
    hora_inclusao: '14:30:00',
    login_inclusao: 'admin',
    data_fin: null,
    hora_fin: null,
    login_fin: null,
    ser_nf: null,
    nro_nf: null,
    chave_nfe: null
  },
  // Pedido 5 - Manual SCANIA - ENTREGUE (para demonstração)
  {
    seq_pedido: 5,
    unidade: 'MTZ',
    nro_pedido: 'PED-2026/005',
    seq_orcamento: 0,
    seq_fornecedor: 2,
    status: 'E', // ✅ E = ENTREGUE
    vlr_total: 8750.00,
    observacao: 'PEDIDO MANUAL - PEÇAS SCANIA',
    data_inclusao: '2026-01-25',
    hora_inclusao: '09:00:00',
    login_inclusao: 'admin',
    data_fin: null,
    hora_fin: null,
    login_fin: null,
    ser_nf: null,
    nro_nf: null,
    chave_nfe: null
  },
  // Pedido 6 - Manual SCANIA - ENTREGUE (para demonstração)
  {
    seq_pedido: 6,
    unidade: 'MTZ',
    nro_pedido: 'PED-2026/006',
    seq_orcamento: 0,
    seq_fornecedor: 2,
    status: 'E', // ✅ E = ENTREGUE
    vlr_total: 15200.00,
    observacao: 'PEDIDO MANUAL - FILTROS E ÓLEOS',
    data_inclusao: '2026-01-26',
    hora_inclusao: '11:20:00',
    login_inclusao: 'admin',
    data_fin: null,
    hora_fin: null,
    login_fin: null,
    ser_nf: null,
    nro_nf: null,
    chave_nfe: null
  },
];

export const MOCK_PEDIDO_ITENS = [
  // Itens do Pedido 1 (Orçamento 2, Fornecedor 5 - Papelaria Presente)
  {
    seq_pedido_item: 1,
    seq_pedido: 1,
    seq_item: 4,
    qtde_item: 20.00,
    vlr_unitario: 150.00,
    vlr_total: 3000.00,
    observacao: ''
  },
  {
    seq_pedido_item: 2,
    seq_pedido: 1,
    seq_item: 5,
    qtde_item: 10.00,
    vlr_unitario: 50.00,
    vlr_total: 500.00,
    observacao: ''
  },
  
  // Itens do Pedido 2 (Orçamento 2, Fornecedor 6 - Escritório Moderno)
  {
    seq_pedido_item: 3,
    seq_pedido: 2,
    seq_item: 4,
    qtde_item: 20.00,
    vlr_unitario: 160.00,
    vlr_total: 3200.00,
    observacao: ''
  },
  {
    seq_pedido_item: 4,
    seq_pedido: 2,
    seq_item: 5,
    qtde_item: 10.00,
    vlr_unitario: 100.00,
    vlr_total: 1000.00,
    observacao: ''
  },
  
  // Itens do Pedido 3 (Manual, Fornecedor 1 - Metalúrgica Silva)
  {
    seq_pedido_item: 5,
    seq_pedido: 3,
    seq_item: 1,
    qtde_item: 50.00,
    vlr_unitario: 120.00,
    vlr_total: 6000.00,
    observacao: ''
  },
  {
    seq_pedido_item: 6,
    seq_pedido: 3,
    seq_item: 2,
    qtde_item: 25.00,
    vlr_unitario: 100.00,
    vlr_total: 2500.00,
    observacao: ''
  },
  
  // Itens do Pedido 4 (Manual, Fornecedor 2 - DISTRIBUIDORA SCANIA SP)
  {
    seq_pedido_item: 7,
    seq_pedido: 4,
    seq_item: 3,
    qtde_item: 100.00,
    vlr_unitario: 123.00,
    vlr_total: 12300.00,
    observacao: ''
  },
  
  // Itens do Pedido 5 (Manual, Fornecedor 2 - DISTRIBUIDORA SCANIA SP)
  {
    seq_pedido_item: 8,
    seq_pedido: 5,
    seq_item: 1,
    qtde_item: 30.00,
    vlr_unitario: 150.00,
    vlr_total: 4500.00,
    observacao: ''
  },
  {
    seq_pedido_item: 9,
    seq_pedido: 5,
    seq_item: 2,
    qtde_item: 25.00,
    vlr_unitario: 170.00,
    vlr_total: 4250.00,
    observacao: ''
  },
  
  // Itens do Pedido 6 (Manual, Fornecedor 2 - DISTRIBUIDORA SCANIA SP)
  {
    seq_pedido_item: 10,
    seq_pedido: 6,
    seq_item: 4,
    qtde_item: 50.00,
    vlr_unitario: 180.00,
    vlr_total: 9000.00,
    observacao: ''
  },
  {
    seq_pedido_item: 11,
    seq_pedido: 6,
    seq_item: 5,
    qtde_item: 40.00,
    vlr_unitario: 155.00,
    vlr_total: 6200.00,
    observacao: ''
  },
];