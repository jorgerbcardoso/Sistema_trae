import { ENVIRONMENT, USE_MOCK_DATA } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';

export interface LancamentoReceita {
  nro_cte: number;
  ser_cte: string;
  cte: string;
  data_emissao: string;
  sigla_emit: string;
  cnpj_pag: string; // ✅ CNPJ do cliente
  nome_pag: string;
  peso_real: number;
  vlr_merc: number;
  vlr_frete: number;
  vlr_icms: number;
  data_inclusao?: string; // ✅ Data de inclusão
  hora_inclusao?: string; // ✅ Hora de inclusão
  login_inclusao?: string; // ✅ Usuário que incluiu
}

export interface LancamentoReceitaFormData {
  nro_cte?: number;
  ser_cte?: string;
  data_emissao: string;
  sigla_emit: string;
  cnpj_pag: string; // ✅ CNPJ do cliente (não código)
  nome_pag: string;
  peso_real: number;
  vlr_merc: number;
  vlr_frete: number;
  vlr_icms: number;
}

export interface LancamentoReceitaTotals {
  peso_real: number;
  vlr_merc: number;
  vlr_frete: number;
  vlr_icms: number;
}

export interface LancamentosReceitasResponse {
  success: boolean;
  lancamentos: LancamentoReceita[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  totals: LancamentoReceitaTotals;
}

// ============================================
// DADOS MOCKADOS
// ============================================

const MOCK_LANCAMENTOS: LancamentoReceita[] = [
  // ========================================
  // JANEIRO 2026
  // ========================================
  {
    nro_cte: 1100,
    ser_cte: 'MAN',
    cte: 'MAN001100',
    data_emissao: '2026-01-02',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'ACEVILLE TRANSPORTES LTDA',
    peso_real: 1850.125,
    vlr_merc: 31000.00,
    vlr_frete: 4250.00,
    vlr_icms: 510.00
  },
  {
    nro_cte: 1101,
    ser_cte: 'MAN',
    cte: 'MAN001101',
    data_emissao: '2026-01-03',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTADORA BRASIL SA',
    peso_real: 2100.500,
    vlr_merc: 35500.00,
    vlr_frete: 4850.00,
    vlr_icms: 582.00
  },
  {
    nro_cte: 1102,
    ser_cte: 'MAN',
    cte: 'MAN001102',
    data_emissao: '2026-01-05',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'LOGISTICA EXPRESS LTDA',
    peso_real: 3200.750,
    vlr_merc: 52000.00,
    vlr_frete: 7600.00,
    vlr_icms: 912.00
  },
  {
    nro_cte: 1103,
    ser_cte: 'MAN',
    cte: 'MAN001103',
    data_emissao: '2026-01-06',
    sigla_emit: 'PIN',
    cnpj_pag: '12345678901234',
    nome_pag: 'CARGO RAPIDO LTDA',
    peso_real: 1650.250,
    vlr_merc: 27500.00,
    vlr_frete: 3950.00,
    vlr_icms: 474.00
  },
  {
    nro_cte: 1104,
    ser_cte: 'MAN',
    cte: 'MAN001104',
    data_emissao: '2026-01-07',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'DISTRIBUIDORA NACIONAL',
    peso_real: 2850.375,
    vlr_merc: 47000.00,
    vlr_frete: 6550.00,
    vlr_icms: 786.00
  },
  {
    nro_cte: 1105,
    ser_cte: 'MAN',
    cte: 'MAN001105',
    data_emissao: '2026-01-08',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTES NORTE SUL',
    peso_real: 1920.625,
    vlr_merc: 32000.00,
    vlr_frete: 4480.00,
    vlr_icms: 537.60
  },
  {
    nro_cte: 1106,
    ser_cte: 'MAN',
    cte: 'MAN001106',
    data_emissao: '2026-01-09',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'FRETE TOTAL LTDA',
    peso_real: 2450.875,
    vlr_merc: 41000.00,
    vlr_frete: 5750.00,
    vlr_icms: 690.00
  },
  {
    nro_cte: 1107,
    ser_cte: 'MAN',
    cte: 'MAN001107',
    data_emissao: '2026-01-10',
    sigla_emit: 'PIN',
    cnpj_pag: '12345678901234',
    nome_pag: 'EMPRESA ABC LOGISTICA',
    peso_real: 3100.00,
    vlr_merc: 51500.00,
    vlr_frete: 7350.00,
    vlr_icms: 882.00
  },
  {
    nro_cte: 1108,
    ser_cte: 'MAN',
    cte: 'MAN001108',
    data_emissao: '2026-01-12',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTES XYZ LTDA',
    peso_real: 1780.00,
    vlr_merc: 29800.00,
    vlr_frete: 4150.00,
    vlr_icms: 498.00
  },
  {
    nro_cte: 1109,
    ser_cte: 'MAN',
    cte: 'MAN001109',
    data_emissao: '2026-01-13',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'LOGISTICA BRASIL LTDA',
    peso_real: 2650.00,
    vlr_merc: 44000.00,
    vlr_frete: 6200.00,
    vlr_icms: 744.00
  },
  {
    nro_cte: 1110,
    ser_cte: 'MAN',
    cte: 'MAN001110',
    data_emissao: '2026-01-14',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTES NACIONAL SA',
    peso_real: 2200.00,
    vlr_merc: 36500.00,
    vlr_frete: 5100.00,
    vlr_icms: 612.00
  },
  {
    nro_cte: 1111,
    ser_cte: 'MAN',
    cte: 'MAN001111',
    data_emissao: '2026-01-15',
    sigla_emit: 'PIN',
    cnpj_pag: '12345678901234',
    nome_pag: 'CARGO EXPRESS LTDA',
    peso_real: 1550.00,
    vlr_merc: 26000.00,
    vlr_frete: 3650.00,
    vlr_icms: 438.00
  },
  {
    nro_cte: 1112,
    ser_cte: 'MAN',
    cte: 'MAN001112',
    data_emissao: '2026-01-16',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'FRETE RAPIDO LTDA',
    peso_real: 3450.00,
    vlr_merc: 57500.00,
    vlr_frete: 8450.00,
    vlr_icms: 1014.00
  },
  {
    nro_cte: 1113,
    ser_cte: 'MAN',
    cte: 'MAN001113',
    data_emissao: '2026-01-17',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'DISTRIBUIDORA SUL',
    peso_real: 2350.00,
    vlr_merc: 39000.00,
    vlr_frete: 5500.00,
    vlr_icms: 660.00
  },
  {
    nro_cte: 1114,
    ser_cte: 'MAN',
    cte: 'MAN001114',
    data_emissao: '2026-01-19',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTADORA EXEMPLO SA',
    peso_real: 2750.00,
    vlr_merc: 45500.00,
    vlr_frete: 6450.00,
    vlr_icms: 774.00
  },
  {
    nro_cte: 1115,
    ser_cte: 'MAN',
    cte: 'MAN001115',
    data_emissao: '2026-01-20',
    sigla_emit: 'PIN',
    cnpj_pag: '12345678901234',
    nome_pag: 'CLIENTE TESTE LTDA',
    peso_real: 1880.00,
    vlr_merc: 31500.00,
    vlr_frete: 4400.00,
    vlr_icms: 528.00
  },
  {
    nro_cte: 1116,
    ser_cte: 'MAN',
    cte: 'MAN001116',
    data_emissao: '2026-01-21',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'LOGISTICA NACIONAL',
    peso_real: 2950.00,
    vlr_merc: 49000.00,
    vlr_frete: 6950.00,
    vlr_icms: 834.00
  },
  {
    nro_cte: 1117,
    ser_cte: 'MAN',
    cte: 'MAN001117',
    data_emissao: '2026-01-22',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'FRETE MASTER LTDA',
    peso_real: 2100.00,
    vlr_merc: 35000.00,
    vlr_frete: 4900.00,
    vlr_icms: 588.00
  },
  {
    nro_cte: 1118,
    ser_cte: 'MAN',
    cte: 'MAN001118',
    data_emissao: '2026-01-23',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'CARGO BRASIL SA',
    peso_real: 3250.00,
    vlr_merc: 54000.00,
    vlr_frete: 7850.00,
    vlr_icms: 942.00
  },
  {
    nro_cte: 1119,
    ser_cte: 'MAN',
    cte: 'MAN001119',
    data_emissao: '2026-01-24',
    sigla_emit: 'PIN',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTES UNIDOS',
    peso_real: 1720.00,
    vlr_merc: 28800.00,
    vlr_frete: 4050.00,
    vlr_icms: 486.00
  },
  {
    nro_cte: 1120,
    ser_cte: 'MAN',
    cte: 'MAN001120',
    data_emissao: '2026-01-26',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'EMPRESA XYZ LOGISTICA',
    peso_real: 2550.00,
    vlr_merc: 42500.00,
    vlr_frete: 5950.00,
    vlr_icms: 714.00
  },
  {
    nro_cte: 1121,
    ser_cte: 'MAN',
    cte: 'MAN001121',
    data_emissao: '2026-01-27',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'DISTRIBUIDORA LESTE',
    peso_real: 2250.00,
    vlr_merc: 37500.00,
    vlr_frete: 5250.00,
    vlr_icms: 630.00
  },
  {
    nro_cte: 1122,
    ser_cte: 'MAN',
    cte: 'MAN001122',
    data_emissao: '2026-01-28',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTADORA MODERNA',
    peso_real: 2850.00,
    vlr_merc: 47500.00,
    vlr_frete: 6650.00,
    vlr_icms: 798.00
  },
  {
    nro_cte: 1123,
    ser_cte: 'MAN',
    cte: 'MAN001123',
    data_emissao: '2026-01-29',
    sigla_emit: 'PIN',
    cnpj_pag: '12345678901234',
    nome_pag: 'CARGO SOLUTIONS LTDA',
    peso_real: 1980.00,
    vlr_merc: 33000.00,
    vlr_frete: 4650.00,
    vlr_icms: 558.00
  },
  {
    nro_cte: 1124,
    ser_cte: 'MAN',
    cte: 'MAN001124',
    data_emissao: '2026-01-30',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'LOGISTICA PRIME',
    peso_real: 3150.00,
    vlr_merc: 52500.00,
    vlr_frete: 7550.00,
    vlr_icms: 906.00
  },
  {
    nro_cte: 1125,
    ser_cte: 'MAN',
    cte: 'MAN001125',
    data_emissao: '2026-01-31',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTES PREMIUM SA',
    peso_real: 2450.00,
    vlr_merc: 40800.00,
    vlr_frete: 5750.00,
    vlr_icms: 690.00
  },
  
  // ========================================
  // FEVEREIRO 2026
  // ========================================
  {
    nro_cte: 1234,
    ser_cte: 'MAN',
    cte: 'MAN001234',
    data_emissao: '2026-02-01',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'ACEVILLE TRANSPORTES LTDA',
    peso_real: 1500.50,
    vlr_merc: 25000.00,
    vlr_frete: 3500.00,
    vlr_icms: 420.00
  },
  {
    nro_cte: 1235,
    ser_cte: 'MAN',
    cte: 'MAN001235',
    data_emissao: '2026-02-02',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTADORA EXEMPLO SA',
    peso_real: 2300.75,
    vlr_merc: 38000.00,
    vlr_frete: 5200.00,
    vlr_icms: 624.00
  },
  {
    nro_cte: 1236,
    ser_cte: 'MAN',
    cte: 'MAN001236',
    data_emissao: '2026-02-03',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'CLIENTE TESTE LTDA',
    peso_real: 1800.00,
    vlr_merc: 30000.00,
    vlr_frete: 4100.00,
    vlr_icms: 492.00
  },
  {
    nro_cte: 1237,
    ser_cte: 'MAN',
    cte: 'MAN001237',
    data_emissao: '2026-02-04',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'EMPRESA ABC LOGISTICA',
    peso_real: 3200.25,
    vlr_merc: 52000.00,
    vlr_frete: 7800.00,
    vlr_icms: 936.00
  },
  {
    nro_cte: 1238,
    ser_cte: 'MAN',
    cte: 'MAN001238',
    data_emissao: '2026-02-05',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTES XYZ LTDA',
    peso_real: 1950.00,
    vlr_merc: 32500.00,
    vlr_frete: 4650.00,
    vlr_icms: 558.00
  },
  {
    nro_cte: 1239,
    ser_cte: 'MAN',
    cte: 'MAN001239',
    data_emissao: '2026-02-06',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'LOGÍSTICA BRASIL LTDA',
    peso_real: 2800.00,
    vlr_merc: 45000.00,
    vlr_frete: 6200.00,
    vlr_icms: 744.00
  },
  {
    nro_cte: 1240,
    ser_cte: 'MAN',
    cte: 'MAN001240',
    data_emissao: '2026-02-07',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'TRANSPORTES NACIONAL SA',
    peso_real: 2100.50,
    vlr_merc: 35000.00,
    vlr_frete: 4900.00,
    vlr_icms: 588.00
  },
  {
    nro_cte: 1241,
    ser_cte: 'MAN',
    cte: 'MAN001241',
    data_emissao: '2026-02-08',
    sigla_emit: 'REC',
    cnpj_pag: '12345678901234',
    nome_pag: 'CARGO EXPRESS LTDA',
    peso_real: 1650.00,
    vlr_merc: 28000.00,
    vlr_frete: 3850.00,
    vlr_icms: 462.00
  },
  {
    nro_cte: 1242,
    ser_cte: 'MAN',
    cte: 'MAN001242',
    data_emissao: '2026-02-09',
    sigla_emit: 'MTZ',
    cnpj_pag: '12345678901234',
    nome_pag: 'FRETE RAPIDO LTDA',
    peso_real: 3500.00,
    vlr_merc: 58000.00,
    vlr_frete: 8500.00,
    vlr_icms: 1020.00
  },
  {
    nro_cte: 1243,
    ser_cte: 'MAN',
    cte: 'MAN001243',
    data_emissao: '2026-02-10',
    sigla_emit: 'SSA',
    cnpj_pag: '12345678901234',
    nome_pag: 'DISTRIBUIDORA NACIONAL',
    peso_real: 2250.00,
    vlr_merc: 37500.00,
    vlr_frete: 5300.00,
    vlr_icms: 636.00
  }
];

let mockLancamentos = [...MOCK_LANCAMENTOS];
let nextMockId = 1244;

// ============================================
// FUNÇÕES MOCK
// ============================================

function getMockLancamentos(
  startDate: string,
  endDate: string,
  page: number = 1
): LancamentosReceitasResponse {
  // Simular delay de rede
  const limit = 50;
  const offset = (page - 1) * limit;
  
  // Filtrar por data (simulado)
  const filtered = mockLancamentos.filter(l => {
    return l.data_emissao >= startDate && l.data_emissao <= endDate;
  });
  
  // Paginar
  const paginated = filtered.slice(offset, offset + limit);
  
  // Calcular totais
  const totals = filtered.reduce(
    (acc, l) => ({
      peso_real: acc.peso_real + l.peso_real,
      vlr_merc: acc.vlr_merc + l.vlr_merc,
      vlr_frete: acc.vlr_frete + l.vlr_frete,
      vlr_icms: acc.vlr_icms + l.vlr_icms
    }),
    { peso_real: 0, vlr_merc: 0, vlr_frete: 0, vlr_icms: 0 }
  );
  
  return {
    success: true,
    lancamentos: paginated,
    pagination: {
      total: filtered.length,
      page,
      limit,
      totalPages: Math.ceil(filtered.length / limit)
    },
    totals
  };
}

function createMockLancamento(data: LancamentoReceitaFormData): void {
  const newLancamento: LancamentoReceita = {
    nro_cte: nextMockId++,
    ser_cte: 'MAN',
    cte: `MAN${String(nextMockId - 1).padStart(6, '0')}`,
    data_emissao: data.data_emissao,
    sigla_emit: data.sigla_emit,
    cnpj_pag: data.cnpj_pag,
    nome_pag: data.nome_pag,
    peso_real: data.peso_real,
    vlr_merc: data.vlr_merc,
    vlr_frete: data.vlr_frete,
    vlr_icms: data.vlr_icms
  };
  
  mockLancamentos = [newLancamento, ...mockLancamentos];
}

function updateMockLancamento(data: LancamentoReceitaFormData): void {
  const index = mockLancamentos.findIndex(
    l => l.nro_cte === data.nro_cte && l.ser_cte === data.ser_cte
  );
  
  if (index !== -1) {
    mockLancamentos[index] = {
      ...mockLancamentos[index],
      data_emissao: data.data_emissao,
      sigla_emit: data.sigla_emit,
      cnpj_pag: data.cnpj_pag,
      nome_pag: data.nome_pag,
      peso_real: data.peso_real,
      vlr_merc: data.vlr_merc,
      vlr_frete: data.vlr_frete,
      vlr_icms: data.vlr_icms
    };
  }
}

function deleteMockLancamento(nro_cte: number, ser_cte: string): void {
  mockLancamentos = mockLancamentos.filter(
    l => !(l.nro_cte === nro_cte && l.ser_cte === ser_cte)
  );
}

// ============================================
// FUNÇÕES DA API (COM SUPORTE A MOCK)
// ============================================

export async function getLancamentosReceitas(
  startDate: string,
  endDate: string,
  page: number = 1
): Promise<LancamentosReceitasResponse> {
  // Se estiver usando mock, retornar dados mockados
  if (USE_MOCK_DATA) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay
    return getMockLancamentos(startDate, endDate, page);
  }
  
  // Caso contrário, chamar API real
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(
    `${ENVIRONMENT.apiBaseUrl}/financeiro/lancamentos_manuais/list.php`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        startDate,
        endDate,
        page
      })
    }
  );

  const contentType = response.headers.get('content-type');
  
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('Resposta não é JSON:', text.substring(0, 500));
    throw new Error(`Erro ao buscar lançamentos: resposta inválida do servidor`);
  }

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao buscar lançamentos de receitas');
  }

  return response.json();
}

export async function createLancamentoReceita(
  data: LancamentoReceitaFormData
): Promise<{ success: boolean }> {
  // Se estiver usando mock, criar localmente
  if (USE_MOCK_DATA) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simular delay
    createMockLancamento(data);
    return { success: true };
  }
  
  // ✅ GARANTIR que todos os campos necessários sejam enviados
  const payload = {
    ...data,
    // Garantir que o CNPJ e nome do cliente sejam enviados nos 3 campos (emit, dest, pag)
    cnpj_emit: data.cnpj_pag,
    cnpj_dest: data.cnpj_pag,
    nome_emit: data.nome_pag,
    nome_dest: data.nome_pag
  };
  
  console.log('🔧 [createLancamentoReceita] Payload completo:', payload);
  console.log('🔧 [createLancamentoReceita] JSON.stringify:', JSON.stringify(payload));
  
  // ✅ Usar apiFetch com URL completa do ENVIRONMENT
  return apiFetch(
    `${ENVIRONMENT.apiBaseUrl}/financeiro/lancamentos_manuais/create.php`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function updateLancamentoReceita(
  data: LancamentoReceitaFormData
): Promise<{ success: boolean }> {
  // Se estiver usando mock, atualizar localmente
  if (USE_MOCK_DATA) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simular delay
    updateMockLancamento(data);
    return { success: true };
  }
  
  // ✅ GARANTIR que todos os campos necessários sejam enviados
  const payload = {
    ...data,
    // Garantir que o CNPJ e nome do cliente sejam enviados nos 3 campos (emit, dest, pag)
    cnpj_emit: data.cnpj_pag,
    cnpj_dest: data.cnpj_pag,
    nome_emit: data.nome_pag,
    nome_dest: data.nome_pag
  };
  
  console.log('🔧 [updateLancamentoReceita] Payload completo:', payload);
  console.log('🔧 [updateLancamentoReceita] JSON.stringify:', JSON.stringify(payload));
  
  // ✅ Usar apiFetch com URL completa do ENVIRONMENT
  return apiFetch(
    `${ENVIRONMENT.apiBaseUrl}/financeiro/lancamentos_manuais/update.php`,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function deleteLancamentoReceita(
  nro_cte: number,
  ser_cte: string
): Promise<{ success: boolean }> {
  // Se estiver usando mock, deletar localmente
  if (USE_MOCK_DATA) {
    await new Promise(resolve => setTimeout(resolve, 300)); // Simular delay
    deleteMockLancamento(nro_cte, ser_cte);
    return { success: true };
  }
  
  // Caso contrário, chamar API real
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(
    `${ENVIRONMENT.apiBaseUrl}/financeiro/lancamentos_manuais/delete.php`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        nro_cte,
        ser_cte
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Erro ao excluir lançamento de receita');
  }

  return response.json();
}