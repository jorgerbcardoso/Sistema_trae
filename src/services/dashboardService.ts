/**
 * ============================================
 * DASHBOARD SERVICE
 * ============================================
 * Serviço para buscar dados do Dashboard no backend PHP
 */

import { ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';

export interface DashboardPeriod {
  type: 'month' | 'quarter' | 'year' | 'custom';
  year?: number;
  month?: number;
  quarter?: number;
  startDate?: string;
  endDate?: string;
}

export interface OverviewData {
  monthly: Array<{
    month: string;
    receita: number;
    custos: number;
    lucro: number;
  }>;
  units: Array<{
    unidade: string;
    receita: number;
    custos: number;
    lucro: number;
  }>;
  totals: {
    receita: number;
    custos: number;
    lucro: number;
    margem: number;
  };
  // ✅ NOVOS CAMPOS - usados pelo componente OverviewPage
  receita_total?: number;
  custos_total?: number;
  despesas_total?: number;
  lucro_bruto?: number;
  lucro_liquido?: number;
  margem_bruta?: number;
  margem_liquida?: number;
  ebitda?: number;
  margem_ebitda?: number;
  
  // ✅ CAMPOS PARA DRE (a serem implementados no overview.php)
  impostos?: number;              // Impostos sobre vendas (ICMS, PIS, COFINS, etc.)
  depreciacao?: number;           // Depreciação e Amortização
  despesas_financeiras?: number;  // Despesas Financeiras (juros, taxas, etc.)
  
  comparacao_mes_anterior?: {
    receita: number;
    custos: number;
    lucro: number;
  };
  alertas?: Array<{
    tipo: string;
    mensagem: string;
  }>;
  kpis?: {
    receita_por_viagem: number;
    custo_por_km: number;
    ticket_medio: number;
    total_viagens: number;
  };
  period?: {
    type: string;
    start_date: string;
    end_date: string;
    label: string;
  };
}

export interface RevenueData {
  // Dados mensais (SEMPRE 12 meses - para gráficos cronológicos)
  revenueByUnitCargas: Array<Record<string, any>>; // Dinâmico: {month, JVE, SPO, CTB, Demais}
  revenueByUnitPassageiros: Array<Record<string, any>>;
  ticketMedioByUnitCargas: Array<Record<string, any>>;
  ticketMedioByUnitPassageiros: Array<Record<string, any>>;
  
  // Totais do período selecionado (para cards superiores)
  unitTotals: Record<string, number>; // Ex: {JVE: 5555, SPO: 3333, CTB: 2222, Demais: 1111}
  
  // Total geral do período
  total: number;
  
  // Informações do período
  period?: {
    type: string;
    start_date: string;
    end_date: string;
    label: string;
  };
}

export interface CostsData {
  // Dados mensais (SEMPRE 12 meses - para gráficos cronológicos)
  costsByCategoryCargas: Array<{
    month: string;
    combustivel: number;
    manutencao: number;
    pessoal: number;
    tributos: number;
    demais: number;
  }>;
  costsByCategoryPassageiros: Array<{
    month: string;
    combustivel: number;
    manutencao: number;
    pessoal: number;
    tributos: number;
    demais: number;
  }>;
  
  // Eficiência de combustível (12 meses)
  fuelEfficiencyCargas: Array<{
    month: string;
    kmPorLitro: number;
    custoKm: number;
  }>;
  fuelEfficiencyPassageiros: Array<{
    month: string;
    kmPorLitro: number;
    custoKm: number;
  }>;
  
  // Totais do período selecionado (para cards)
  categoryTotals: {
    combustivel: number;
    manutencao: number;
    pessoal: number;
    tributos: number;
    demais: number;
  };
  
  // Total geral do período
  totals: {
    total: number;
  };
  
  // ✅ NOVO: Dados de unidades (SEMPRE presente)
  unitCategoryTotals?: Record<string, number>; // {SP: 850000, RJ: 650000, MG: 450000, PR: 350000, Demais: 250000}
  costsByUnitCargas?: Array<Record<string, any>>; // [{month: 'Jan/25', SP: 68000, RJ: 52000, ...}, ...]
  costsByUnitPassageiros?: Array<Record<string, any>>; // [{month: 'Jan/25', SP: 0, RJ: 0, ...}, ...]
  
  // Informações do período
  period?: {
    type: string;
    start_date: string;
    end_date: string;
    label: string;
  };
}

export interface LinesData {
  byLine: Array<{
    linha: string;
    receita: number;
    custos: number;
    lucro: number;
    margem: number;
  }>;
  performance: Array<{
    linha: string;
    demanda: number;
    ocupacao: number;
  }>;
  monthly: Array<{
    month: string;
    receita: number;
    viagens: number;
  }>;
}

export interface ProfitabilityData {
  // ✅ NOVO: Métricas do período selecionado (para os cards)
  periodMetrics?: {
    margemBruta: number;
    margemOperacional: number;
    margemLiquida: number;
    ebitda: number;
    roi: number;
  };
  // Dados mensais de margens (últimos 12 meses - para gráficos)
  profitabilityDataCargas: Array<{
    month: string;
    margemBruta: number;
    margemOperacional: number;
    margemLiquida: number;
    ebitda: number;
    roi: number;
  }>;
  profitabilityDataPassageiros: Array<{
    month: string;
    margemBruta: number;
    margemOperacional: number;
    margemLiquida: number;
    ebitda: number;
    roi: number;
  }>;
  // Dados por unidade
  unitProfitabilityCargas: Array<{
    unidade: string;
    receita: number;
    custo: number;
    lucro: number;
    margem: number;
  }>;
  unitProfitabilityPassageiros: Array<{
    unidade: string;
    receita: number;
    custo: number;
    lucro: number;
    margem: number;
  }>;
}

/**
 * Buscar dados do Overview
 */
export async function getOverviewData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS' = 'GERAL'
): Promise<OverviewData> {
  const params = new URLSearchParams({
    period: period.type,
    view_mode: viewMode,
    ...(period.year && { year: period.year.toString() }),
    ...(period.month && { month: period.month.toString() }),
    ...(period.quarter && { quarter: period.quarter.toString() }),
    ...(period.startDate && { start_date: period.startDate }),
    ...(period.endDate && { end_date: period.endDate }),
  });

  // ✅ apiFetch já retorna JSON processado e intercepta toasts
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/dre/overview.php?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return result.data;
}

/**
 * Buscar dados de Receitas
 */
export async function getRevenueData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS' = 'GERAL'
): Promise<RevenueData> {
  const params = new URLSearchParams({
    period: period.type,
    view_mode: viewMode,
    ...(period.year && { year: period.year.toString() }),
    ...(period.month && { month: period.month.toString() }),
    ...(period.quarter && { quarter: period.quarter.toString() }),
    ...(period.startDate && { start_date: period.startDate }),
    ...(period.endDate && { end_date: period.endDate }),
  });

  // ✅ apiFetch já retorna JSON processado e intercepta toasts
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/dre/revenue.php?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return result.data;
}

/**
 * Buscar dados de Custos
 */
export async function getCostsData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS' = 'GERAL',
  groupBy: 'EVENTOS' | 'GRUPOS' = 'EVENTOS' // ✅ NOVO: Agrupar por eventos ou grupos
): Promise<CostsData> {
  const params = new URLSearchParams({
    period: period.type,
    view_mode: viewMode,
    group_by: groupBy, // ✅ NOVO: Enviar groupBy para API
    ...(period.year && { year: period.year.toString() }),
    ...(period.month && { month: period.month.toString() }),
    ...(period.quarter && { quarter: period.quarter.toString() }),
    ...(period.startDate && { start_date: period.startDate }),
    ...(period.endDate && { end_date: period.endDate }),
  });

  // ✅ apiFetch já retorna JSON processado e intercepta toasts
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/dre/costs.php?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return result.data;
}

/**
 * Buscar dados de Linhas
 */
export async function getLinesData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS' = 'GERAL'
): Promise<LinesData> {
  const params = new URLSearchParams({
    period: period.type,
    view_mode: viewMode,
    ...(period.year && { year: period.year.toString() }),
    ...(period.month && { month: period.month.toString() }),
    ...(period.quarter && { quarter: period.quarter.toString() }),
    ...(period.startDate && { start_date: period.startDate }),
    ...(period.endDate && { end_date: period.endDate }),
  });

  // ✅ apiFetch já retorna JSON processado e intercepta toasts
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/dre/lines.php?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return result.data;
}

/**
 * Buscar dados de Rentabilidade
 */
export async function getProfitabilityData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS' = 'GERAL'
): Promise<ProfitabilityData> {
  const params = new URLSearchParams({
    period: period.type,
    view_mode: viewMode,
    ...(period.year && { year: period.year.toString() }),
    ...(period.month && { month: period.month.toString() }),
    ...(period.quarter && { quarter: period.quarter.toString() }),
    ...(period.startDate && { start_date: period.startDate }),
    ...(period.endDate && { end_date: period.endDate }),
  });

  // ✅ apiFetch já retorna JSON processado e intercepta toasts
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/dre/profitability.php?${params}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return result.data;
}