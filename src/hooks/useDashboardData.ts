/**
 * ============================================
 * HOOK - useDashboardData
 * ============================================
 * Hook customizado que decide automaticamente entre MOCK e BACKEND
 * baseado na configuração do domínio
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { shouldUseMockData, getDomain } from '../services/domainService';
import {
  getOverviewData,
  getRevenueData,
  getCostsData,
  getLinesData,
  getProfitabilityData,
  DashboardPeriod,
  OverviewData,
  RevenueData,
  CostsData,
  LinesData,
  ProfitabilityData
} from '../services/dashboardService';

// Importar mocks
import { 
  generateMockOverviewData,
  generateMockRevenueData,
  generateMockCostsData,
  generateMockLinesData,
  generateMockProfitabilityData
} from '../mocks/dashboardMocks';

type DashboardType = 'overview' | 'revenue' | 'costs' | 'lines' | 'profitability';

interface UseDashboardDataOptions {
  type: DashboardType;
  period: DashboardPeriod;
  viewMode?: 'GERAL' | 'CARGAS' | 'PASSAGEIROS';
  groupBy?: 'EVENTOS' | 'GRUPOS'; // ✅ NOVO: Agrupar por eventos ou grupos
  enabled?: boolean; // Se false, não carrega dados
}

interface UseDashboardDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  isMockData: boolean; // Indica se os dados são mockados
}

export function useDashboardData<T = any>(
  options: UseDashboardDataOptions
): UseDashboardDataReturn<T> {
  const { user } = useAuth();
  const { type, period, viewMode = 'GERAL', groupBy = 'EVENTOS', enabled = true } = options;
  
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true); // Começar com loading true
  const [error, setError] = useState<string | null>(null);
  const [isMockData, setIsMockData] = useState(true);

  // 🐛 DEBUG: Rastrear mudanças no data
  useEffect(() => {
    console.log('🔄 [useDashboardData] STATE CHANGE - data:', data);
  }, [data]);

  useEffect(() => {
    console.log('🔄 [useDashboardData] STATE CHANGE - loading:', loading);
  }, [loading]);

  const fetchData = async () => {
    console.log('🚀 [useDashboardData] fetchData INICIADO', { enabled, user, domain: user?.domain });
    
    if (!enabled) {
      console.warn('⚠️ [useDashboardData] Requisição CANCELADA: enabled=false');
      return;
    }

    // ✅ FALLBACK: Se não tem user.domain, usar dados MOCK como fallback
    if (!user?.domain) {
      console.warn('⚠️ [useDashboardData] user.domain não disponível - Usando dados MOCK como fallback');
      setIsMockData(true);
      setLoading(true);
      
      try {
        let fallbackResult: any;
        
        // Criar period padrão caso não exista
        const safePeriod: DashboardPeriod = {
          type: period?.type || 'YTD',
          startDate: period?.startDate || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
          endDate: period?.endDate || new Date().toISOString().split('T')[0]
        };
        
        switch (type) {
          case 'overview':
            fallbackResult = generateMockOverviewData(safePeriod, viewMode);
            break;
          case 'revenue':
            fallbackResult = generateMockRevenueData(safePeriod, viewMode);
            break;
          case 'costs':
            fallbackResult = generateMockCostsData(safePeriod, viewMode);
            break;
          case 'lines':
            fallbackResult = generateMockLinesData(safePeriod, viewMode);
            break;
          case 'profitability':
            fallbackResult = generateMockProfitabilityData(safePeriod, viewMode);
            break;
        }
        
        setData(fallbackResult as T);
        setError(null);
      } catch (err: any) {
        console.error('❌ [useDashboardData] Erro ao gerar dados MOCK de fallback:', err);
        setError('Erro ao carregar dados');
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ✅ NOVA LÓGICA: Verificar user.use_mock_data PRIMEIRO (mais confiável)
      // Se não existir, usar shouldUseMockData() como fallback
      const useMock = user.use_mock_data !== undefined 
        ? user.use_mock_data  // ✅ Usar flag do user (definida no login)
        : shouldUseMockData(user.domain); // Fallback para domainService
      
      const domain = getDomain(user.domain);
      const controlaLinhas = domain?.controla_linhas || false;
      
      console.log(`🔍 [useDashboardData] Carregando dados tipo="${type}", mock=${useMock}, viewMode=${viewMode}, groupBy=${groupBy}`);
      console.log(`🔍 [useDashboardData] user.use_mock_data=${user.use_mock_data}, shouldUseMockData=${shouldUseMockData(user.domain)}`);
      
      setIsMockData(useMock);

      let result: any;

      // Caso especial: ABA LINHAS quando domínio NÃO controla linhas
      // SEMPRE retorna mock nesse caso
      if (type === 'lines' && !controlaLinhas) {
        console.log('⚠️ [useDashboardData] Domínio não controla linhas → Usando dados MOCK');
        result = generateMockLinesData(period, viewMode);
        setIsMockData(true);
      }
      // Usar MOCK
      else if (useMock) {
        console.log('🎭 [useDashboardData] Usando dados MOCK');
        
        switch (type) {
          case 'overview':
            result = generateMockOverviewData(period, viewMode);
            break;
          case 'revenue':
            result = generateMockRevenueData(period, viewMode);
            break;
          case 'costs':
            result = generateMockCostsData(period, viewMode);
            break;
          case 'lines':
            result = generateMockLinesData(period, viewMode);
            break;
          case 'profitability':
            result = generateMockProfitabilityData(period, viewMode);
            break;
          default:
            throw new Error(`Tipo de dashboard inválido: ${type}`);
        }
      }
      // Usar BACKEND
      else {
        console.log('🌐 [useDashboardData] Buscando dados do BACKEND');
        
        switch (type) {
          case 'overview':
            result = await getOverviewData(period, viewMode);
            break;
          case 'revenue':
            result = await getRevenueData(period, viewMode);
            break;
          case 'costs':
            result = await getCostsData(period, viewMode, groupBy); // ✅ NOVO: Passar groupBy
            break;
          case 'lines':
            result = await getLinesData(period, viewMode);
            break;
          case 'profitability':
            result = await getProfitabilityData(period, viewMode);
            break;
          default:
            throw new Error(`Tipo de dashboard inválido: ${type}`);
        }
      }

      setData(result as T);
      console.log(`✅ [useDashboardData] Dados carregados com sucesso (${useMock ? 'MOCK' : 'BACKEND'})`);
      
    } catch (err: any) {
      console.error('❌ [useDashboardData] Erro ao carregar dados:', err);
      setError(err.message || 'Erro ao carregar dados');
      
      // Fallback para mock em caso de erro do backend
      if (!isMockData) {
        console.log('⚠️ [useDashboardData] Erro no backend, usando dados MOCK como fallback');
        setIsMockData(true);
        
        try {
          let fallbackResult: any;
          
          switch (type) {
            case 'overview':
              fallbackResult = generateMockOverviewData(period, viewMode);
              break;
            case 'revenue':
              fallbackResult = generateMockRevenueData(period, viewMode);
              break;
            case 'costs':
              fallbackResult = generateMockCostsData(period, viewMode);
              break;
            case 'lines':
              fallbackResult = generateMockLinesData(period, viewMode);
              break;
            case 'profitability':
              fallbackResult = generateMockProfitabilityData(period, viewMode);
              break;
          }
          
          setData(fallbackResult as T);
          setError(null); // Limpar erro já que conseguimos carregar mock
        } catch (mockErr) {
          console.error('❌ [useDashboardData] Erro fatal: nem backend nem mock funcionaram');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    type, 
    period.startDate, 
    period.endDate, 
    viewMode,
    groupBy, // ✅ NOVO: Adicionar groupBy nas dependências
    enabled, 
    user?.domain
  ]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isMockData
  };
}
