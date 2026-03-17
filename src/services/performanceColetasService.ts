import { apiFetch } from '../utils/apiUtils';
import { ENVIRONMENT } from '../config/environment';

// ========================================
// TIPOS E INTERFACES
// ========================================

export interface Coleta {
  unidade: string;
  numero_coleta: string;
  data_limite: string; // YYYY-MM-DD
  hora_limite: string; // HH:MM
  cnpj_emit: string;
  endereco_emit: string;
  bairro_emit: string;
  cep_emit: string;
  cidade_emit: string;
  setor: string;
  cnpj_dest: string;
  nome_dest: string;
  endereco_dest: string;
  cep_dest: string;
  cidade_dest: string;
  solicitante: string;
  motorista: string;
  situacao: string; // Formato: "DD/MM HH:MM [SITUACAO]"
  vlr_merc: number;
  qtde_vol: number;
  peso: number;
  placa: string;
  mercadoria: string;
  tp_frete: string;
  obs1: string;
  obs2: string;
  obs3: string;
}

export type SituacaoColeta = 'PRE-CADASTRADA' | 'CADASTRADA' | 'COMANDADA' | 'COLETADA' | 'CANCELADA';

export interface ColetasFilters {
  periodoLancamentoInicio: string;
  periodoLancamentoFim: string;
  periodoPrevisaoInicio: string;
  periodoPrevisaoFim: string;
  unidadeColeta: string[]; // ✅ Array de siglas de unidades coletadoras
  cnpjRemetente: string;
  placa: string;
  situacao: string | string[]; // '' para todas, string única, ou array de situações
}

export interface PerformanceCards {
  precastradas: number;
  cadastradas: number;
  comandadas: number;
  coletadas: number;
  total: number;
}

export interface DayDataColetas {
  data: string; // YYYY-MM-DD
  coletasRealizadas: number;
  coletasProgramadas: number;
  coletadasNoPrazo: number;
  performance: number; // percentual
}

export interface EvolucaoDataColetas {
  data: string; // DD/MM
  programadas: number;
  coletadasNoPrazo: number;
}

export interface UnidadePerformanceColetas {
  unidade: string;
  sigla: string;
  qtdeColetas: number;
  programadas: number;
  comandadas: number;
  coletadas: number;
  noPrazo: number;
  performance: number; // percentual
}

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

/**
 * Extrai a situação do campo situacao
 * Formato esperado: "DD/MM HH:MM [SITUACAO]"
 */
export function parseSituacao(situacao: string): {
  data: string | null; // DD/MM
  hora: string | null; // HH:MM
  situacao: SituacaoColeta | null;
} {
  if (!situacao) {
    return { data: null, hora: null, situacao: null };
  }

  // Regex para capturar DD/MM HH:MM [SITUACAO]
  const regex = /(\d{2}\/\d{2})\s+(\d{2}:\d{2})\s+\[([^\]]+)\]/;
  const match = situacao.match(regex);

  if (!match) {
    return { data: null, hora: null, situacao: null };
  }

  const [, data, hora, sit] = match;
  const situacaoUpper = sit.toUpperCase().trim();

  // Verificar se é uma situação válida
  const situacoesValidas: SituacaoColeta[] = ['PRE-CADASTRADA', 'CADASTRADA', 'COMANDADA', 'COLETADA', 'CANCELADA'];
  const situacaoFinal = situacoesValidas.find(s => situacaoUpper.includes(s)) || null;

  return {
    data,
    hora,
    situacao: situacaoFinal
  };
}

/**
 * Verifica se a coleta foi realizada no prazo
 */
export function isColetadaNoPrazo(coleta: Coleta): boolean {
  const { situacao: sit } = parseSituacao(coleta.situacao);
  
  if (sit !== 'COLETADA') {
    return false;
  }

  // Extrair data/hora de coleta
  const { data: dataColeta, hora: horaColeta } = parseSituacao(coleta.situacao);
  if (!dataColeta || !horaColeta) return false;

  // Converter data_limite e dataColeta para comparação
  const [diaLimite, mesLimite] = coleta.data_limite.split('-').slice(2, 0).reverse(); // Assumindo YYYY-MM-DD
  const [diaColeta, mesColeta] = dataColeta.split('/');
  
  // Criar objetos Date para comparação
  const anoLimite = coleta.data_limite.split('-')[0];
  const dataLimiteObj = new Date(`${anoLimite}-${mesLimite}-${diaLimite}T${coleta.hora_limite}`);
  
  // Para dataColeta, usar o mesmo ano (assumindo que é do mesmo período)
  const dataColetaObj = new Date(`${anoLimite}-${mesColeta}-${diaColeta}T${horaColeta}`);

  return dataColetaObj <= dataLimiteObj;
}

// ========================================
// CHAMADAS DE API
// ========================================

/**
 * ✅ ENDPOINT UNIFICADO: Busca TODOS os dados do dashboard em uma única chamada
 * Retorna: { cards, analiseDiaria, evolucao, comparativo }
 */
export async function getDashboardData(filters: ColetasFilters): Promise<{
  cards: PerformanceCards;
  analiseDiaria: DayDataColetas[];
  evolucao: EvolucaoDataColetas[];
  comparativo: UnidadePerformanceColetas[];
}> {
  if (ENVIRONMENT.isFigmaMake) {
    const { 
      mockGetPerformanceCardsColetas,
      mockGetAnaliseDiariaColetas,
      mockGetEvolucaoPerformanceColetas,
      mockGetComparativoUnidadesColetas
    } = await import('../mocks/mockData');
    
    // ✅ CORREÇÃO: Aguardar todas as promises em paralelo
    const [cards, analiseDiaria, evolucao, comparativo] = await Promise.all([
      mockGetPerformanceCardsColetas(filters),
      mockGetAnaliseDiariaColetas(filters),
      mockGetEvolucaoPerformanceColetas(filters),
      mockGetComparativoUnidadesColetas(filters)
    ]);
    
    return {
      cards,
      analiseDiaria,
      evolucao,
      comparativo
    };
  }

  const token = localStorage.getItem('auth_token');
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/get_dashboard_data.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ filters })
  });

  if (!result.success) {
    throw new Error(result.message || 'Erro ao buscar dados do dashboard');
  }

  return result.data;
}

/**
 * Busca os cards de performance de coletas
 * ⚠️ DEPRECIADO: Use getDashboardData() para melhor performance
 */
export async function getPerformanceCards(filters: ColetasFilters): Promise<PerformanceCards> {
  if (ENVIRONMENT.isFigmaMake) {
    const { mockGetPerformanceCardsColetas } = await import('../mocks/mockData');
    return mockGetPerformanceCardsColetas(filters);
  }

  const token = localStorage.getItem('auth_token');
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/get_cards.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ filters }) // ✅ CORRIGIDO: Enviar { filters: {...} }
  });

  if (!result.success) {
    throw new Error(result.message || 'Erro ao buscar cards');
  }

  return result.data;
}

/**
 * Busca a análise diária de coletas
 * ⚠️ DEPRECIADO: Use getDashboardData() para melhor performance
 */
export async function getAnaliseDiaria(filters: ColetasFilters): Promise<DayDataColetas[]> {
  if (ENVIRONMENT.isFigmaMake) {
    const { mockGetAnaliseDiariaColetas } = await import('../mocks/mockData');
    return mockGetAnaliseDiariaColetas(filters);
  }

  const token = localStorage.getItem('auth_token');
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/get_analise_diaria.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ filters }) // ✅ CORRIGIDO: Enviar { filters: {...} }
  });

  if (!result.success) {
    throw new Error(result.message || 'Erro ao buscar análise diária');
  }

  return result.data;
}

/**
 * Busca a evolução da performance
 * ⚠️ DEPRECIADO: Use getDashboardData() para melhor performance
 */
export async function getEvolucaoPerformance(filters: ColetasFilters): Promise<EvolucaoDataColetas[]> {
  if (ENVIRONMENT.isFigmaMake) {
    const { mockGetEvolucaoPerformanceColetas } = await import('../mocks/mockData');
    return mockGetEvolucaoPerformanceColetas(filters);
  }

  const token = localStorage.getItem('auth_token');
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/get_evolucao.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ filters }) // ✅ CORRIGIDO: Enviar { filters: {...} }
  });

  if (!result.success) {
    throw new Error(result.message || 'Erro ao buscar evolução');
  }

  return result.data;
}

/**
 * Busca o comparativo por unidades
 * ⚠️ DEPRECIADO: Use getDashboardData() para melhor performance
 */
export async function getComparativoUnidades(filters: ColetasFilters): Promise<UnidadePerformanceColetas[]> {
  if (ENVIRONMENT.isFigmaMake) {
    const { mockGetComparativoUnidadesColetas } = await import('../mocks/mockData');
    return mockGetComparativoUnidadesColetas(filters);
  }

  const token = localStorage.getItem('auth_token');
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/get_comparativo.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ filters }) // ✅ CORRIGIDO: Enviar { filters: {...} }
  });

  if (!result.success) {
    throw new Error(result.message || 'Erro ao buscar comparativo');
  }

  return result.data;
}

// ========================================
// FUNÇÕES DE EXPORTAÇÃO
// ========================================

/**
 * Helper para processar download ou erro JSON
 */
async function handleExportResponse(
  response: Response,
  defaultFilename: string,
  loadingToastId?: string | number
): Promise<void> {
  // ✅ Verificar se é JSON (erro) ou CSV (sucesso)
  const contentType = response.headers.get('content-type');
  
  if (contentType?.includes('application/json')) {
    // É um erro retornado como JSON
    const errorData = await response.json();
    const errorMessage = errorData.error || errorData.message || 'Erro ao gerar planilha';
    
    // ✅ O throw vai ser capturado pelo try/catch que já exibe o toast
    throw new Error(errorMessage);
  }
  
  // ✅ É um CSV, fazer download
  const blob = await response.blob();
  
  // Verificar se o blob tem conteúdo
  if (blob.size === 0) {
    throw new Error('Arquivo vazio retornado pelo servidor');
  }
  
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = defaultFilename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Exporta coletas por situação (dos cards)
 */
export async function exportColetasPorSituacao(
  situacao: string,
  filters: Partial<ColetasFilters>
): Promise<void> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/export.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filters,
      situacao
    })
  });

  if (!response.ok) {
    // Tentar ler mensagem de erro
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Erro ao exportar coletas');
    }
    throw new Error('Erro ao exportar coletas');
  }

  await handleExportResponse(
    response,
    `coletas_${situacao.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`
  );
}

/**
 * Exporta coletas programadas do dia (clique no gráfico)
 */
export async function exportColetasProgramadasDia(
  data: string,
  filters: Partial<ColetasFilters>
): Promise<void> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/export.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filters, // ✅ CORRIGIDO: Enviar filters como objeto separado
      tipo: 'programadas_dia',
      data
    })
  });

  if (!response.ok) {
    throw new Error('Erro ao exportar coletas programadas');
  }

  // Download do arquivo CSV
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coletas_programadas_${data}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Exporta coletas coletadas do dia (da análise diária) - apenas situação = 2
 */
export async function exportColetasDia(
  data: string,
  filters: Partial<ColetasFilters>
): Promise<void> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/export.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filters, // ✅ CORRIGIDO: Enviar filters como objeto separado
      tipo: 'coletadas_dia',
      data
    })
  });

  if (!response.ok) {
    throw new Error('Erro ao exportar coletas do dia');
  }

  // Download do arquivo CSV
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coletas_coletadas_${data}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Exporta coletas comandadas do dia (da análise diária)
 */
export async function exportColetasComandasDia(
  data: string,
  filters: Partial<ColetasFilters>
): Promise<void> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/export.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filters, // ✅ CORRIGIDO: Enviar filters como objeto separado
      tipo: 'comandadas_dia',
      data
    })
  });

  if (!response.ok) {
    throw new Error('Erro ao exportar coletas comandadas');
  }

  // Download do arquivo CSV
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coletas_comandadas_${data}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Exporta coletas efetivadas do dia (da análise diária) - todas as coletadas
 */
export async function exportColetasEfetivadasDia(
  data: string,
  filters: Partial<ColetasFilters>
): Promise<void> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/export.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filters, // ✅ CORRIGIDO: Enviar filters como objeto separado
      tipo: 'coletadas_dia',
      data
    })
  });

  if (!response.ok) {
    throw new Error('Erro ao exportar coletas efetivadas');
  }

  // Download do arquivo CSV
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coletas_efetivadas_${data}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Exporta coletas no prazo do dia (da análise diária) - coletadas dentro do prazo
 */
export async function exportColetasNoPrazoDia(
  data: string,
  filters: Partial<ColetasFilters>
): Promise<void> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/export.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filters, // ✅ Enviar filters como objeto separado
      tipo: 'no_prazo_dia',
      data
    })
  });

  if (!response.ok) {
    throw new Error('Erro ao exportar coletas no prazo');
  }

  // Download do arquivo CSV
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coletas_no_prazo_${data}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

/**
 * Exporta coletas do comparativo por unidade e coluna
 */
export async function exportColetasComparativo(
  unidade: string,
  coluna: string,
  filters: Partial<ColetasFilters>
): Promise<void> {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/export.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      filters, // ✅ CORRIGIDO: Enviar filters como objeto separado
      unidade,
      coluna
    })
  });

  if (!response.ok) {
    throw new Error('Erro ao exportar coletas da unidade');
  }

  // Download do arquivo CSV
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `coletas_${unidade}_${coluna}_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}