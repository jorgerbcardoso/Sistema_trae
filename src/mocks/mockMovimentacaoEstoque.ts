/**
 * ================================================================
 * MOCKS PARA RELATÓRIO DE MOVIMENTAÇÃO DE ESTOQUE
 * ================================================================
 */

export interface MovimentacaoEstoque {
  seq_mvto_estoque: number;
  data_mvto: string; // DD/MM/YYYY
  hora_mvto: string; // HH:MM:SS
  login: string;
  mvto: 'E' | 'S'; // E = Entrada, S = Saída
  tipo: string; // E = Entrada Manual, P = Pedido, I = Inventário, S = Saída
  seq_origem: number | null;
  nro_documento: string | null; // Número do documento de origem (NF, Pedido, etc)
  
  // Posição
  seq_posicao: number | null;
  localizacao: string | null;
  
  // Estoque
  seq_estoque: number;
  estoque_descricao: string;
  
  // Item
  seq_item: number;
  codigo_item: string;
  descricao_item: string;
  seq_tipo_item: number;
  tipo_item_descricao: string;
  
  // Valores
  qtde_item: number;
  vlr_unitario: number;
  vlr_total: number;
  
  observacao: string | null;
}

export interface MovimentacaoFilters {
  unidade?: string;
  seq_estoque?: number;
  tipo?: string; // 'E' | 'P' | 'I' | 'S'
  seq_tipo_item?: number;
  seq_item?: number;
  data_inicio?: string;
  data_fim?: string;
}

// Mock de movimentações
export const MOCK_MOVIMENTACOES: MovimentacaoEstoque[] = [
  {
    seq_mvto_estoque: 1,
    data_mvto: '20/01/2026',
    hora_mvto: '08:15:00',
    login: 'ADMIN',
    mvto: 'E',
    tipo: 'E',
    seq_origem: null,
    nro_documento: null,
    seq_posicao: 1,
    localizacao: 'A01-01-01',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 1,
    codigo_item: 'PEC001',
    descricao_item: 'FILTRO DE ÓLEO MERCEDES',
    seq_tipo_item: 1,
    tipo_item_descricao: 'PEÇAS',
    qtde_item: 50.00,
    vlr_unitario: 85.50,
    vlr_total: 4275.00,
    observacao: 'Entrada manual de estoque'
  },
  {
    seq_mvto_estoque: 2,
    data_mvto: '20/01/2026',
    hora_mvto: '09:30:00',
    login: 'COMPRAS',
    mvto: 'E',
    tipo: 'P',
    seq_origem: 1,
    nro_documento: 'PED-2025-001',
    seq_posicao: 5,
    localizacao: 'B02-03-01',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 2,
    codigo_item: 'PEC002',
    descricao_item: 'PASTILHA DE FREIO SCANIA',
    seq_tipo_item: 1,
    tipo_item_descricao: 'PEÇAS',
    qtde_item: 30.00,
    vlr_unitario: 320.00,
    vlr_total: 9600.00,
    observacao: 'Recebimento de pedido SCANIA - NF 12345'
  },
  {
    seq_mvto_estoque: 3,
    data_mvto: '20/01/2026',
    hora_mvto: '10:45:00',
    login: 'ESTOQUE',
    mvto: 'S',
    tipo: 'S',
    seq_origem: 15,
    nro_documento: 'REQ-2025-015',
    seq_posicao: 1,
    localizacao: 'A01-01-01',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 1,
    codigo_item: 'PEC001',
    descricao_item: 'FILTRO DE ÓLEO MERCEDES',
    seq_tipo_item: 1,
    tipo_item_descricao: 'PEÇAS',
    qtde_item: 5.00,
    vlr_unitario: 85.50,
    vlr_total: 427.50,
    observacao: 'Saída para manutenção veículo ABC-1234'
  },
  {
    seq_mvto_estoque: 4,
    data_mvto: '21/01/2026',
    hora_mvto: '08:00:00',
    login: 'COMPRAS',
    mvto: 'E',
    tipo: 'P',
    seq_origem: 2,
    nro_documento: 'PED-2025-002',
    seq_posicao: 10,
    localizacao: 'C01-02-03',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 3,
    codigo_item: 'LUB001',
    descricao_item: 'ÓLEO MOTOR SHELL 15W40',
    seq_tipo_item: 4,
    tipo_item_descricao: 'LUBRIFICANTES',
    qtde_item: 200.00,
    vlr_unitario: 28.90,
    vlr_total: 5780.00,
    observacao: 'Recebimento de pedido SHELL - NF 67890'
  },
  {
    seq_mvto_estoque: 5,
    data_mvto: '21/01/2026',
    hora_mvto: '11:20:00',
    login: 'ESTOQUE',
    mvto: 'S',
    tipo: 'S',
    seq_origem: 18,
    nro_documento: 'REQ-2025-018',
    seq_posicao: 10,
    localizacao: 'C01-02-03',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 3,
    codigo_item: 'LUB001',
    descricao_item: 'ÓLEO MOTOR SHELL 15W40',
    seq_tipo_item: 4,
    tipo_item_descricao: 'LUBRIFICANTES',
    qtde_item: 20.00,
    vlr_unitario: 28.90,
    vlr_total: 578.00,
    observacao: 'Saída para troca de óleo frota'
  },
  {
    seq_mvto_estoque: 6,
    data_mvto: '22/01/2026',
    hora_mvto: '14:30:00',
    login: 'ADMIN',
    mvto: 'E',
    tipo: 'I',
    seq_origem: null,
    nro_documento: 'INV-2025-001',
    seq_posicao: 15,
    localizacao: 'D03-01-02',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 4,
    codigo_item: 'PNE001',
    descricao_item: 'PNEU BRIDGESTONE 295/80R22.5',
    seq_tipo_item: 5,
    tipo_item_descricao: 'PNEUS',
    qtde_item: 12.00,
    vlr_unitario: 1850.00,
    vlr_total: 22200.00,
    observacao: 'Ajuste de inventário - contagem física'
  },
  {
    seq_mvto_estoque: 7,
    data_mvto: '22/01/2026',
    hora_mvto: '15:45:00',
    login: 'ESTOQUE',
    mvto: 'S',
    tipo: 'S',
    seq_origem: 20,
    nro_documento: 'REQ-2025-020',
    seq_posicao: 15,
    localizacao: 'D03-01-02',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 4,
    codigo_item: 'PNE001',
    descricao_item: 'PNEU BRIDGESTONE 295/80R22.5',
    seq_tipo_item: 5,
    tipo_item_descricao: 'PNEUS',
    qtde_item: 4.00,
    vlr_unitario: 1850.00,
    vlr_total: 7400.00,
    observacao: 'Saída para manutenção - troca de pneus'
  },
  {
    seq_mvto_estoque: 8,
    data_mvto: '23/01/2026',
    hora_mvto: '09:15:00',
    login: 'COMPRAS',
    mvto: 'E',
    tipo: 'P',
    seq_origem: 3,
    nro_documento: 'PED-2025-003',
    seq_posicao: 8,
    localizacao: 'B03-02-01',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 5,
    codigo_item: 'FER001',
    descricao_item: 'CHAVE COMBINADA 19MM',
    seq_tipo_item: 2,
    tipo_item_descricao: 'FERRAMENTAS',
    qtde_item: 15.00,
    vlr_unitario: 45.00,
    vlr_total: 675.00,
    observacao: 'Recebimento de pedido GEDORE - NF 11223'
  },
  {
    seq_mvto_estoque: 9,
    data_mvto: '23/01/2026',
    hora_mvto: '13:00:00',
    login: 'ADMIN',
    mvto: 'E',
    tipo: 'E',
    seq_origem: null,
    nro_documento: null,
    seq_posicao: 12,
    localizacao: 'C02-01-01',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 6,
    codigo_item: 'CON001',
    descricao_item: 'GRAXA AUTOMOTIVA',
    seq_tipo_item: 3,
    tipo_item_descricao: 'CONSUMÍVEIS',
    qtde_item: 50.00,
    vlr_unitario: 18.50,
    vlr_total: 925.00,
    observacao: 'Entrada manual - compra direta'
  },
  {
    seq_mvto_estoque: 10,
    data_mvto: '24/01/2026',
    hora_mvto: '10:30:00',
    login: 'ESTOQUE',
    mvto: 'S',
    tipo: 'S',
    seq_origem: 22,
    nro_documento: 'REQ-2025-022',
    seq_posicao: 5,
    localizacao: 'B02-03-01',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 2,
    codigo_item: 'PEC002',
    descricao_item: 'PASTILHA DE FREIO SCANIA',
    seq_tipo_item: 1,
    tipo_item_descricao: 'PEÇAS',
    qtde_item: 2.00,
    vlr_unitario: 320.00,
    vlr_total: 640.00,
    observacao: 'Saída para manutenção veículo XYZ-5678'
  },
  {
    seq_mvto_estoque: 11,
    data_mvto: '25/01/2026',
    hora_mvto: '08:45:00',
    login: 'COMPRAS',
    mvto: 'E',
    tipo: 'P',
    seq_origem: 4,
    nro_documento: 'PED-2025-004',
    seq_posicao: 18,
    localizacao: 'E01-01-01',
    seq_estoque: 2,
    estoque_descricao: 'ESTOQUE FILIAL',
    seq_item: 7,
    codigo_item: 'ELE001',
    descricao_item: 'BOBINA IGNIÇÃO 12V',
    seq_tipo_item: 7,
    tipo_item_descricao: 'ELÉTRICA',
    qtde_item: 10.00,
    vlr_unitario: 125.00,
    vlr_total: 1250.00,
    observacao: 'Recebimento de pedido - NF 33445'
  },
  {
    seq_mvto_estoque: 12,
    data_mvto: '25/01/2026',
    hora_mvto: '14:20:00',
    login: 'ESTOQUE',
    mvto: 'S',
    tipo: 'S',
    seq_origem: 25,
    nro_documento: 'REQ-2025-025',
    seq_posicao: 12,
    localizacao: 'C02-01-01',
    seq_estoque: 1,
    estoque_descricao: 'ESTOQUE CENTRAL',
    seq_item: 6,
    codigo_item: 'CON001',
    descricao_item: 'GRAXA AUTOMOTIVA',
    seq_tipo_item: 3,
    tipo_item_descricao: 'CONSUMÍVEIS',
    qtde_item: 10.00,
    vlr_unitario: 18.50,
    vlr_total: 185.00,
    observacao: 'Saída para manutenção preventiva'
  }
];

/**
 * Busca movimentações com filtros
 */
export async function mockGetMovimentacoes(
  filters: MovimentacaoFilters
): Promise<{ success: boolean; movimentacoes: MovimentacaoEstoque[]; total: number }> {
  // Simular delay de rede
  await new Promise(resolve => setTimeout(resolve, 500));

  let movimentacoes = [...MOCK_MOVIMENTACOES];

  // Filtrar por estoque
  if (filters.seq_estoque) {
    movimentacoes = movimentacoes.filter(m => m.seq_estoque === filters.seq_estoque);
  }

  // Filtrar por tipo
  if (filters.tipo) {
    movimentacoes = movimentacoes.filter(m => m.tipo === filters.tipo);
  }

  // Filtrar por tipo de item
  if (filters.seq_tipo_item) {
    movimentacoes = movimentacoes.filter(m => m.seq_tipo_item === filters.seq_tipo_item);
  }

  // Filtrar por item
  if (filters.seq_item) {
    movimentacoes = movimentacoes.filter(m => m.seq_item === filters.seq_item);
  }

  // Filtrar por período
  if (filters.data_inicio && filters.data_fim) {
    movimentacoes = movimentacoes.filter(m => {
      const dataMvto = m.data_mvto.split('/').reverse().join('-'); // DD/MM/YYYY -> YYYY-MM-DD
      return dataMvto >= filters.data_inicio! && dataMvto <= filters.data_fim!;
    });
  }

  return {
    success: true,
    movimentacoes,
    total: movimentacoes.length
  };
}