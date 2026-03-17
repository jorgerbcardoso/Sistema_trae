/**
 * ============================================
 * SERVICE - Performance de Entregas
 * ============================================
 * Funções para buscar dados de performance de entregas
 */

import { ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';
import { toast } from 'sonner';

/**
 * Função para obter token
 */
function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

export interface PerformanceFilters {
  periodoEmissaoInicio: string;
  periodoEmissaoFim: string;
  periodoPrevisaoInicio: string;
  periodoPrevisaoFim: string;
  unidadeDestino: string[];
  cnpjPagador: string;
  cnpjDestinatario: string;
}

export interface DeliveryGroup {
  label: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
  chartColor: string;
  emptyColor: string;
  emptyColorDark: string;
  hoverColor: string;
}

export interface PerformanceDataPoint {
  data: string;
  previstos: number;
  noPrazo: number;
  performance: number;
}

export interface UnitPerformance {
  unidade: string;
  sigla: string;
  total: number;
  entreguesNoPrazo: number;
  entreguesEmAtraso: number;
  pendentesNoPrazo: number;
  pendentesEmAtraso: number;
  performance: number;
}

export interface DayData {
  dia: string;
  mes: string;
  mesNome: string;
  diaSemana: string;
  data: string;
  entregasDia: number;
  previstosDia: number;
  entreguesDia: number;
}

/**
 * Buscar dados dos cards de performance
 */
export async function getPerformanceCards(filters: PerformanceFilters): Promise<{ deliveryGroups: DeliveryGroup[] }> {
  const token = getAuthToken();
  
  // ✅ apiFetch já processa o JSON e intercepta toasts automaticamente
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/get_cards.php`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters }) // ✅ CORREÇÃO: Enviar dentro de { filters: {...} }
  });
  
  console.log('🔍 [Service] Resposta raw da API get_cards.php:', result);
  console.log('🔍 [Service] result.data:', result.data);
  console.log('🔍 [Service] result.data.deliveryGroups:', result.data?.deliveryGroups);
  
  // ✅ ADICIONAR CORES aos dados do backend
  const deliveryGroups = result.data?.deliveryGroups || [];
  
  console.log('🔍 [Service] deliveryGroups antes das cores:', deliveryGroups);
  
  // ✅ LABELS PADRÃO caso o backend não retorne
  const defaultLabels = [
    'Entregues no Prazo',
    'Entregues em Atraso',
    'Pendentes no Prazo',    // ✅ CORRIGIDO: índice 2 (azul)
    'Pendentes em Atraso'    // ✅ CORRIGIDO: índice 3 (vermelho)
  ];
  
  // Definição das cores para cada grupo
  const colorSchemes = [
    {
      // Entregues no Prazo
      color: 'text-green-700 dark:text-green-300',
      bgColor: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',
      chartColor: '#10b981',
      emptyColor: '#dcfce7',
      emptyColorDark: '#064e3b',
      hoverColor: 'hover:bg-green-200 dark:hover:bg-green-800'
    },
    {
      // Entregues em Atraso
      color: 'text-yellow-700 dark:text-yellow-300',
      bgColor: 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800',
      chartColor: '#f59e0b',
      emptyColor: '#fef3c7',
      emptyColorDark: '#713f12',
      hoverColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-800'
    },
    {
      // ✅ CORRIGIDO: Pendentes no Prazo (índice 2, azul)
      color: 'text-blue-700 dark:text-blue-300',
      bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
      chartColor: '#3b82f6',
      emptyColor: '#dbeafe',
      emptyColorDark: '#1e3a8a',
      hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-800'
    },
    {
      // ✅ CORRIGIDO: Pendentes em Atraso (índice 3, vermelho)
      color: 'text-red-700 dark:text-red-300',
      bgColor: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800',
      chartColor: '#ef4444',
      emptyColor: '#fee2e2',
      emptyColorDark: '#7f1d1d',
      hoverColor: 'hover:bg-red-200 dark:hover:bg-red-800'
    }
  ];
  
  // Aplicar cores a cada grupo
  const groupsWithColors = deliveryGroups.map((group: any, index: number) => ({
    ...group,
    label: group.label || defaultLabels[index],
    ...colorSchemes[index]
  }));
  
  return { deliveryGroups: groupsWithColors };
}

/**
 * Buscar dados do gráfico de evolução
 */
export async function getPerformanceEvolucao(filters: PerformanceFilters, periodo: 7 | 15 | 30 = 30): Promise<{ performanceData: PerformanceDataPoint[] }> {
  const token = getAuthToken();
  
  // ✅ apiFetch já processa o JSON e intercepta toasts automaticamente
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/get_evolucao.php`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters, periodo }) // ✅ Enviar filtros + período
  });

  // ✅ MAPEAR campos da API para o formato esperado pelo frontend
  const performanceData = (result.data?.performanceData || []).map((item: any) => ({
    data: item.data,
    previstos: item.total,      // ✅ API retorna "total", frontend espera "previstos"
    noPrazo: item.onTime,       // ✅ API retorna "onTime", frontend espera "noPrazo"
    performance: item.percentage // ✅ API retorna "percentage", frontend espera "performance"
  }));

  return { performanceData };
}

/**
 * Buscar dados do comparativo de unidades
 */
export async function getPerformanceComparativo(filters: PerformanceFilters): Promise<{ unitPerformances: UnitPerformance[] }> {
  const token = getAuthToken();
  
  // ✅ apiFetch já processa o JSON e intercepta toasts automaticamente
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/get_comparativo_unidades.php`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filters }) // ✅ CORREÇÃO: Enviar dentro de { filters: {...} }
  });

  return result.data || { unitPerformances: [] };
}

/**
 * Buscar dados da análise diária
 */
export async function getAnaliseDiaria(
  periodo: 7 | 15 | 30,
  filters?: { unidadeDestino?: string[], cnpjPagador?: string, cnpjDestinatario?: string }
): Promise<{ diasData: DayData[] }> {
  const token = getAuthToken();
  
  const body: any = { periodo };
  if (filters?.unidadeDestino && filters.unidadeDestino.length > 0) body.unidadeDestino = filters.unidadeDestino;
  if (filters?.cnpjPagador) body.cnpjPagador = filters.cnpjPagador;
  if (filters?.cnpjDestinatario) body.cnpjDestinatario = filters.cnpjDestinatario;
  
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/get_analise_diaria.php`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body)
  });

  return result.data || { diasData: [] };
}

/**
 * Exportar entregas do dia
 */
export async function exportEntregasDia(
  data: string, 
  filters?: { unidadeDestino?: string[], cnpjPagador?: string, cnpjDestinatario?: string }
): Promise<void> {
  const token = getAuthToken();
  
  const body: any = { 
    tipo: 'entregas_dia',
    data: data
  };
  if (filters?.unidadeDestino && filters.unidadeDestino.length > 0) body.unidadeDestino = filters.unidadeDestino;
  if (filters?.cnpjPagador) body.cnpjPagador = filters.cnpjPagador;
  if (filters?.cnpjDestinatario) body.cnpjDestinatario = filters.cnpjDestinatario;
  
  try {
    const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/export.php`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    // ✅ Verificar se é JSON (erro com msg() do PHP)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json();
      if (errorData.toast) {
        const toastTypes: { [key: string]: any } = {
          success: toast.success,
          error: toast.error,
          warning: toast.warning,
          info: toast.info
        };
        const toastFn = toastTypes[errorData.toast.type] || toast.error;
        toastFn(errorData.toast.message);
      }
      throw new Error(errorData.message || 'Erro ao exportar planilha');
    }

    if (!response.ok) {
      throw new Error('Erro ao exportar planilha');
    }

    // Download do arquivo CSV
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `entregas_${data.replace(/-/g, '_')}.csv`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i);
      if (match && match[1]) filename = match[1].replace(/"/g, '');
    }
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error: any) {
    // Erro já foi exibido via toast
    console.error('Erro ao exportar entregas do dia:', error);
  }
}

/**
 * Exportar previstos do dia
 */
export async function exportPrevistosDia(
  data: string,
  filters?: { unidadeDestino?: string[], cnpjPagador?: string, cnpjDestinatario?: string }
): Promise<void> {
  const token = getAuthToken();
  
  const body: any = { 
    tipo: 'previstos_dia',
    data: data
  };
  if (filters?.unidadeDestino && filters.unidadeDestino.length > 0) body.unidadeDestino = filters.unidadeDestino;
  if (filters?.cnpjPagador) body.cnpjPagador = filters.cnpjPagador;
  if (filters?.cnpjDestinatario) body.cnpjDestinatario = filters.cnpjDestinatario;
  
  try {
    const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/export.php`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    // ✅ Verificar se é JSON (erro com msg() do PHP)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json();
      if (errorData.toast) {
        const toastTypes: { [key: string]: any } = {
          success: toast.success,
          error: toast.error,
          warning: toast.warning,
          info: toast.info
        };
        const toastFn = toastTypes[errorData.toast.type] || toast.error;
        toastFn(errorData.toast.message);
      }
      throw new Error(errorData.message || 'Erro ao exportar planilha');
    }

    if (!response.ok) {
      throw new Error('Erro ao exportar planilha');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `previstos_${data.replace(/-/g, '_')}.csv`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i);
      if (match && match[1]) filename = match[1].replace(/"/g, '');
    }
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error: any) {
    console.error('Erro ao exportar previstos do dia:', error);
  }
}

/**
 * Exportar entregues no prazo do dia
 */
export async function exportEntreguesDia(
  data: string,
  filters?: { unidadeDestino?: string[], cnpjPagador?: string, cnpjDestinatario?: string }
): Promise<void> {
  const token = getAuthToken();
  
  const body: any = { 
    tipo: 'entregues_dia',
    data: data
  };
  if (filters?.unidadeDestino && filters.unidadeDestino.length > 0) body.unidadeDestino = filters.unidadeDestino;
  if (filters?.cnpjPagador) body.cnpjPagador = filters.cnpjPagador;
  if (filters?.cnpjDestinatario) body.cnpjDestinatario = filters.cnpjDestinatario;
  
  try {
    const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/export.php`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body)
    });

    // ✅ Verificar se é JSON (erro com msg() do PHP)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const errorData = await response.json();
      if (errorData.toast) {
        const toastTypes: { [key: string]: any } = {
          success: toast.success,
          error: toast.error,
          warning: toast.warning,
          info: toast.info
        };
        const toastFn = toastTypes[errorData.toast.type] || toast.error;
        toastFn(errorData.toast.message);
      }
      throw new Error(errorData.message || 'Erro ao exportar planilha');
    }

    if (!response.ok) {
      throw new Error('Erro ao exportar planilha');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `entregues_no_prazo_${data.replace(/-/g, '_')}.csv`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?(.+)"?/i);
      if (match && match[1]) filename = match[1].replace(/"/g, '');
    }
    
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error: any) {
    console.error('Erro ao exportar entregues no prazo do dia:', error);
  }
}