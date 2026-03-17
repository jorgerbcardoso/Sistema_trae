import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { useNavigate } from 'react-router';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '../ui/dialog';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  Filter,
  X,
  Check,
  FileSpreadsheet,
  Info,
  ChevronUp,
  ChevronDown,
  Clock,
  List,
  Package,
  CheckCircle2,
  Truck,
  TrendingUp,
  Building2,
  CircleHelp
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ENVIRONMENT } from '../../config/environment';
import { FilterSelectUnidadeOrdered } from '../cadastros/FilterSelectUnidadeOrdered';
import { FilterSelectCliente } from './FilterSelectCliente';
import { FilterSelectVeiculo } from './FilterSelectVeiculo';
import { AnaliseDiariaColetas } from './AnaliseDiariaColetas';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { getLogoUrl } from '../../config/clientLogos';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';
import { 
  getDashboardData, // ✅ ENDPOINT UNIFICADO
  exportColetasPorSituacao,
  exportColetasProgramadasDia,
  exportColetasDia,
  exportColetasComandasDia,
  exportColetasNoPrazoDia,
  exportColetasComparativo,
  type ColetasFilters,
  type PerformanceCards as PerformanceCardsType,
  type DayDataColetas,
  type EvolucaoDataColetas,
  type UnidadePerformanceColetas
} from '../../services/performanceColetasService';

interface Filters extends ColetasFilters {}

interface ColetaGroup {
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

export function PerformanceColetas() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  // ✅ CALCULAR PERÍODO PADRÃO INTELIGENTE
  // Se dia > 10: mês atual do dia 1 até hoje
  // Se dia <= 10: mês anterior completo
  const getDefaultPeriod = () => {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth(); // 0-11
    const currentYear = today.getFullYear();
    
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    // Se já passou dia 10 → mês atual do dia 1 até hoje
    if (currentDay > 10) {
      const firstDayCurrentMonth = new Date(currentYear, currentMonth, 1);
      return {
        inicio: formatDate(firstDayCurrentMonth),
        fim: formatDate(today)
      };
    } 
    // Se ainda não passou dia 10 → mês anterior completo
    else {
      const firstDayLastMonth = new Date(currentYear, currentMonth - 1, 1);
      const lastDayLastMonth = new Date(currentYear, currentMonth, 0);
      return {
        inicio: formatDate(firstDayLastMonth),
        fim: formatDate(lastDayLastMonth)
      };
    }
  };
  
  const defaultPeriod = getDefaultPeriod();
  
  const [filters, setFilters] = useState<Filters>({
    periodoLancamentoInicio: '',
    periodoLancamentoFim: '',
    periodoPrevisaoInicio: defaultPeriod.inicio,
    periodoPrevisaoFim: defaultPeriod.fim,
    unidadeColeta: [], // ✅ NOVO: Array vazio
    cnpjRemetente: '',
    placa: '',
    situacao: [] // ✅ ALTERADO: Array de strings para múltiplas situações
  });
  
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [coletaGroups, setColetaGroups] = useState<ColetaGroup[]>([]);
  const [evolucaoData, setEvolucaoData] = useState<any[]>([]);
  const [unitPerformances, setUnitPerformances] = useState<UnidadePerformanceColetas[]>([]);
  
  // Estados para ordenação da tabela de comparativo
  const [sortColumn, setSortColumn] = useState<keyof UnidadePerformanceColetas>('performance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Estados para Análise Diária
  const [analisePeriodo, setAnalisePeriodo] = useState<7 | 15 | 30>(7);
  const [diasData, setDiasData] = useState<DayDataColetas[]>([]);
  const [loadingAnalise, setLoadingAnalise] = useState(false);

  // Estados para Evolução da Performance
  const [evolucaoPeriodo, setEvolucaoPeriodo] = useState<7 | 15 | 30>(30);
  const [loadingEvolucao, setLoadingEvolucao] = useState(false);

  usePageTitle('Performance de Coletas');

  const handleBackToMenu = () => {
    navigate('/');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    try {
      const userDomain = user?.domain;
      sessionStorage.clear();
      await logout();
      
      const isAceville = userDomain === 'ACV';
      const loginPath = isAceville ? '/login-aceville' : '/login';
      navigate(loginPath, { replace: true });
    } catch (error) {
      console.error('❌ Erro durante logout:', error);
      const storedDomain = localStorage.getItem('presto_domain');
      const isAceville = storedDomain === 'ACV';
      const loginPath = isAceville ? '/login-aceville' : '/login';
      navigate(loginPath, { replace: true });
    }
  };

  // useEffect: Carregar dados ao montar o componente
  useEffect(() => {
    console.log('🔍 [PerformanceColetas] Carregando dados iniciais...');
    loadMockData();
  }, []);

  // useEffect: Recarregar dados quando os filtros mudarem
  useEffect(() => {
    if (coletaGroups.length > 0 || evolucaoData.length > 0 || unitPerformances.length > 0) {
      console.log('🔄 [PerformanceColetas] Filtros mudaram, recarregando dados...');
      loadMockData();
    }
  }, [filters]);

  // ✅ Recarregar dados quando mudar o período de análise ou evolução
  useEffect(() => {
    if (coletaGroups.length > 0) {
      loadMockData();
    }
  }, [analisePeriodo, evolucaoPeriodo]);

  const loadMockData = async () => {
    setLoading(true);
    try {
      console.log('🚀 [PerformanceColetas] Carregando TODOS os dados via endpoint unificado');
      
      // ✅ NOVO: Usar endpoint unificado que retorna tudo de uma vez
      const dashboardData = await getDashboardData(filters);
      console.log('✅ [PerformanceColetas] Dados recebidos:', dashboardData);
      
      // ✅ VALIDAÇÃO: Garantir que os dados são válidos
      if (!dashboardData || typeof dashboardData !== 'object') {
        throw new Error('Dados inválidos recebidos do servidor');
      }
      
      // Processar cards
      const cardsData = dashboardData.cards || { preCadastradas: 0, cadastradas: 0, comandadas: 0, coletadas: 0, total: 0 };
      
      // ✅ GARANTIR QUE TODOS OS VALORES SEJAM NÚMEROS
      const preCadastradas = Number(cardsData.preCadastradas) || 0;
      const cadastradas = Number(cardsData.cadastradas) || 0;
      const comandadas = Number(cardsData.comandadas) || 0;
      const coletadas = Number(cardsData.coletadas) || 0;
      const total = Number(cardsData.total) || 0;
      
      // Criar grupos com cores específicas
      const groups: ColetaGroup[] = [
        {
          label: 'Pré-Cadastradas',
          count: preCadastradas,
          percentage: total > 0 ? (preCadastradas / total) * 100 : 0,
          color: 'text-slate-700 dark:text-slate-300',
          bgColor: 'bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 border-slate-200 dark:border-slate-800',
          chartColor: '#64748b',
          emptyColor: '#f1f5f9',
          emptyColorDark: '#1e293b',
          hoverColor: 'hover:bg-slate-200 dark:hover:bg-slate-800'
        },
        {
          label: 'Cadastradas',
          count: cadastradas,
          percentage: total > 0 ? (cadastradas / total) * 100 : 0,
          color: 'text-blue-700 dark:text-blue-300',
          bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
          chartColor: '#3b82f6',
          emptyColor: '#dbeafe',
          emptyColorDark: '#1e3a8a',
          hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-800'
        },
        {
          label: 'Comandadas',
          count: comandadas,
          percentage: total > 0 ? (comandadas / total) * 100 : 0,
          color: 'text-yellow-700 dark:text-yellow-300',
          bgColor: 'bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800',
          chartColor: '#f59e0b',
          emptyColor: '#fef3c7',
          emptyColorDark: '#713f12',
          hoverColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-800'
        },
        {
          label: 'Coletadas',
          count: coletadas,
          percentage: total > 0 ? (coletadas / total) * 100 : 0,
          color: 'text-green-700 dark:text-green-300',
          bgColor: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',
          chartColor: '#10b981',
          emptyColor: '#dcfce7',
          emptyColorDark: '#064e3b',
          hoverColor: 'hover:bg-green-200 dark:hover:bg-green-800'
        },
        {
          label: 'Total',
          count: total,
          percentage: 100,
          color: 'text-purple-700 dark:text-purple-300',
          bgColor: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800',
          chartColor: '#a855f7',
          emptyColor: '#f3e8ff',
          emptyColorDark: '#581c87',
          hoverColor: 'hover:bg-purple-200 dark:hover:bg-purple-800'
        }
      ];
      
      setColetaGroups(groups);
      
      // ✅ VALIDAÇÃO: Garantir que são arrays antes de chamar slice
      const analiseDiariaArray = Array.isArray(dashboardData.analiseDiaria) ? dashboardData.analiseDiaria : [];
      const evolucaoArray = Array.isArray(dashboardData.evolucao) ? dashboardData.evolucao : [];
      const comparativoArray = Array.isArray(dashboardData.comparativo) ? dashboardData.comparativo : [];
      
      // Processar análise diária (últimos N dias)
      setDiasData(analiseDiariaArray.slice(-analisePeriodo));
      
      // Processar evolução
      const slicedEvolucao = evolucaoArray.slice(-evolucaoPeriodo);
      setEvolucaoData(slicedEvolucao);
      
      // Processar comparativo
      setUnitPerformances(comparativoArray);
      
      setLoading(false);
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      setLoading(false);
    }
  };

  const clearFilters = () => {
    const emptyFilters: Filters = {
      periodoLancamentoInicio: '',
      periodoLancamentoFim: '',
      periodoPrevisaoInicio: '',
      periodoPrevisaoFim: '',
      unidadeColeta: [], // ✅ NOVO: Array vazio
      cnpjRemetente: '',
      placa: '',
      situacao: [] // ✅ ALTERADO: Array de strings para múltiplas situações
    };
    setTempFilters(emptyFilters);
    setFilters(emptyFilters);
    setShowFilters(false);
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setShowFilters(false);
  };

  const getPeriodDisplay = () => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    
    // Prioridade 1: Período de Lançamento (se preenchido)
    if (filters.periodoLancamentoInicio && filters.periodoLancamentoFim) {
      return `${formatDate(filters.periodoLancamentoInicio)} - ${formatDate(filters.periodoLancamentoFim)}`;
    } else if (filters.periodoLancamentoInicio) {
      return `A partir de ${formatDate(filters.periodoLancamentoInicio)}`;
    } else if (filters.periodoLancamentoFim) {
      return `Até ${formatDate(filters.periodoLancamentoFim)}`;
    }
    
    // Prioridade 2: Período de Previsão (padrão)
    if (filters.periodoPrevisaoInicio && filters.periodoPrevisaoFim) {
      return `${formatDate(filters.periodoPrevisaoInicio)} - ${formatDate(filters.periodoPrevisaoFim)}`;
    } else if (filters.periodoPrevisaoInicio) {
      return `A partir de ${formatDate(filters.periodoPrevisaoInicio)}`;
    } else if (filters.periodoPrevisaoFim) {
      return `Até ${formatDate(filters.periodoPrevisaoFim)}`;
    }
    
    // Fallback: Se nenhum período definido
    return 'Todos os períodos';
  };

  // Função: Manipular ordenação da tabela
  const handleSort = (column: keyof UnidadePerformanceColetas) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'performance' ? 'desc' : 'asc');
    }
  };

  // Função: Obter dados ordenados
  const getSortedUnits = () => {
    const sorted = [...unitPerformances].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
    
    return sorted;
  };

  // Função: Renderizar ícone de ordenação
  const renderSortIcon = (column: keyof UnidadePerformanceColetas) => {
    if (sortColumn !== column) {
      return <ChevronUp className="w-3 h-3 ml-1 inline opacity-40" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-3 h-3 ml-1 inline" /> 
      : <ChevronDown className="w-3 h-3 ml-1 inline" />;
  };

  // Funções de exportação
  const handleExportCard = async (situacao: string, label: string) => {
    const toastId = toast.info('Gerando planilha...', {
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity
    });
    try {
      await exportColetasPorSituacao(situacao, {
        periodoLancamentoInicio: filters.periodoLancamentoInicio,
        periodoLancamentoFim: filters.periodoLancamentoFim,
        periodoPrevisaoInicio: filters.periodoPrevisaoInicio,
        periodoPrevisaoFim: filters.periodoPrevisaoFim,
        unidadeColeta: filters.unidadeColeta,
        cnpjRemetente: filters.cnpjRemetente,
        placa: filters.placa,
        situacao: filters.situacao
      });
      toast.success(`Planilha de ${label} gerada com sucesso`, { 
        id: toastId,
        description: undefined,
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar planilha';
      toast.error(errorMessage, { 
        id: toastId,
        description: undefined,
        duration: 5000
      });
    }
  };

  const handleExportColetasDia = async (data: string) => {
    const toastId = toast.info('Gerando planilha...', {
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity
    });
    try {
      await exportColetasDia(data, {
        cnpjRemetente: filters.cnpjRemetente,
        placa: filters.placa,
        situacao: filters.situacao,
        unidadeColeta: filters.unidadeColeta
      });
      toast.success('Planilha gerada com sucesso', { 
        id: toastId,
        description: undefined,
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar planilha';
      toast.error(errorMessage, { 
        id: toastId,
        description: undefined,
        duration: 5000
      });
    }
  };

  const handleExportProgramadasDia = async (data: string) => {
    const toastId = toast.info('Gerando planilha...', {
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity
    });
    try {
      await exportColetasProgramadasDia(data, {
        cnpjRemetente: filters.cnpjRemetente,
        placa: filters.placa,
        situacao: filters.situacao,
        unidadeColeta: filters.unidadeColeta
      });
      toast.success('Planilha gerada com sucesso', { 
        id: toastId,
        description: undefined,
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar planilha';
      toast.error(errorMessage, { 
        id: toastId,
        description: undefined,
        duration: 5000
      });
    }
  };

  const handleExportComandasDia = async (data: string) => {
    const toastId = toast.info('Gerando planilha...', {
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity
    });
    try {
      await exportColetasComandasDia(data, {
        cnpjRemetente: filters.cnpjRemetente,
        placa: filters.placa,
        situacao: filters.situacao,
        unidadeColeta: filters.unidadeColeta
      });
      toast.success('Planilha gerada com sucesso', { 
        id: toastId,
        description: undefined,
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar planilha';
      toast.error(errorMessage, { 
        id: toastId,
        description: undefined,
        duration: 5000
      });
    }
  };

  const handleExportNoPrazoDia = async (data: string) => {
    const toastId = toast.info('Gerando planilha...', {
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity
    });
    try {
      await exportColetasNoPrazoDia(data, {
        cnpjRemetente: filters.cnpjRemetente,
        placa: filters.placa,
        situacao: filters.situacao,
        unidadeColeta: filters.unidadeColeta
      });
      toast.success('Planilha gerada com sucesso', { 
        id: toastId,
        description: undefined,
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar planilha';
      toast.error(errorMessage, { 
        id: toastId,
        description: undefined,
        duration: 5000
      });
    }
  };

  const handleExportComparativo = async (sigla: string, tipo: 'total' | 'programadas' | 'comandadas' | 'coletadas' | 'no_prazo', label: string) => {
    const toastId = toast.info('Gerando planilha...', {
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity
    });
    try {
      await exportColetasComparativo(sigla, tipo, {
        periodoLancamentoInicio: filters.periodoLancamentoInicio,
        periodoLancamentoFim: filters.periodoLancamentoFim,
        periodoPrevisaoInicio: filters.periodoPrevisaoInicio,
        periodoPrevisaoFim: filters.periodoPrevisaoFim,
        unidadeColeta: filters.unidadeColeta,
        cnpjRemetente: filters.cnpjRemetente,
        placa: filters.placa,
        situacao: filters.situacao
      });
      toast.success(`Planilha de ${label} gerada com sucesso`, { 
        id: toastId,
        description: undefined,
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar planilha';
      toast.error(errorMessage, { 
        id: toastId,
        description: undefined,
        duration: 5000
      });
    }
  };

  // ✅ FUNÇÃO: Exportar CSV do Gráfico de Evolução (clique no dia)
  const handleExportEvolucao = async (dataStr: string) => {
    const toastId = toast.info('Gerando planilha...', {
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity
    });

    try {
      const token = localStorage.getItem('auth_token');
      
      // A data vem no formato YYYY-MM-DD do backend
      let dataLimite: string;
      
      if (dataStr.includes('-')) {
        // Já está no formato YYYY-MM-DD
        dataLimite = dataStr;
      } else {
        // Está no formato DD/MM - converter para YYYY-MM-DD
        const [day, month] = dataStr.split('/');
        
        // Determinar o ano correto baseado na data atual
        const hoje = new Date();
        const anoAtual = hoje.getFullYear();
        const mesAtual = hoje.getMonth() + 1;
        
        // Se o mês clicado for maior que o mês atual, é do ano anterior
        const mesClicado = parseInt(month, 10);
        const year = mesClicado > mesAtual ? anoAtual - 1 : anoAtual;
        
        dataLimite = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Montar body com filtros aplicados
      const body: any = {
        tipo: 'evolucao_dia',
        data: dataLimite
      };

      // Aplicar filtros (exceto períodos)
      if (filters.cnpjRemetente) body.cnpjRemetente = filters.cnpjRemetente;
      if (filters.placa) body.placa = filters.placa;
      if (filters.situacao && filters.situacao.length > 0) body.situacao = filters.situacao;
      if (filters.unidadeColeta && filters.unidadeColeta.length > 0) body.unidadeColeta = filters.unidadeColeta;

      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-coletas/export.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        toast.dismiss(toastId);
        
        if (data.toast) {
          const toastType = data.toast.type || 'info';
          const message = data.toast.message;
          
          if (toastType === 'error') {
            toast.error(message);
          } else if (toastType === 'warning') {
            toast.warning(message);
          } else if (toastType === 'info') {
            toast.info(message);
          }
        }
        return;
      }

      if (!response.ok) {
        throw new Error('Erro ao exportar coletas');
      }

      // Download do arquivo CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Tentar extrair nome do arquivo do header
      let filename = `coletas_programadas_${dataLimite}.csv`;
      const disposition = response.headers.get('content-disposition');
      if (disposition) {
        const filenameMatch = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Planilha gerada com sucesso', { 
        id: toastId,
        description: undefined,
        duration: 3000
      });
    } catch (error) {
      console.error('Erro ao exportar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao gerar planilha';
      toast.error(errorMessage, { 
        id: toastId,
        description: undefined,
        duration: 5000
      });
    }
  };

  if (loading && coletaGroups.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  // ✅ Construir headerActions com período e filtros
  const headerActions = (
    <div className="flex items-center gap-2 md:gap-4">
      {/* Exibição do Período */}
      <div className="text-right print:block">
        <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm hidden md:block">Período</p>
        <p className="text-slate-900 dark:text-slate-100 text-xs md:text-base">{getPeriodDisplay()}</p>
      </div>

      {/* Botão de Filtros */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Filtrar Período</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
              <DialogContent className="sm:max-w-[700px] bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto overscroll-contain">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros de Pesquisa</DialogTitle>
                  <DialogDescription className="text-slate-600 dark:text-slate-400">
                    Personalize a visualização filtrando por período e características
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                  {/* Período de Lançamento */}
                  <div className="space-y-4">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Lançamento</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodoLancamentoInicio}
                          onChange={(e) => setTempFilters({...tempFilters, periodoLancamentoInicio: e.target.value})}
                          className="dark:bg-slate-800 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodoLancamentoFim}
                          onChange={(e) => setTempFilters({...tempFilters, periodoLancamentoFim: e.target.value})}
                          className="dark:bg-slate-800 dark:border-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Previsão de Coleta</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodoPrevisaoInicio}
                          onChange={(e) => setTempFilters({...tempFilters, periodoPrevisaoInicio: e.target.value})}
                          className="dark:bg-slate-800 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodoPrevisaoFim}
                          onChange={(e) => setTempFilters({...tempFilters, periodoPrevisaoFim: e.target.value})}
                          className="dark:bg-slate-800 dark:border-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ✅ NOVO: Filtro de Unidade de Coleta */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                    <Label className="text-slate-900 dark:text-slate-100">Unidade(s) de Coleta</Label>
                    <FilterSelectUnidadeOrdered
                      value={tempFilters.unidadeColeta}
                      onChange={(value) => setTempFilters({...tempFilters, unidadeColeta: value})}
                      apiEndpoint="/dashboards/performance-entregas/search_unidades.php"
                    />
                  </div>

                  {/* Filtros adicionais */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-slate-900 dark:text-slate-100">CNPJ Remetente</Label>
                      <FilterSelectCliente
                        type="pagador"
                        value={tempFilters.cnpjRemetente}
                        onChange={(value) => setTempFilters({...tempFilters, cnpjRemetente: value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-900 dark:text-slate-100">Placa do Veículo</Label>
                      <FilterSelectVeiculo
                        value={tempFilters.placa}
                        onChange={(value) => setTempFilters({...tempFilters, placa: value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-900 dark:text-slate-100">Situação</Label>
                      <div className="space-y-2 border border-slate-300 dark:border-slate-700 rounded-md p-3 bg-white dark:bg-slate-800">
                        {[
                          { value: 'PRE-CADASTRADA', label: 'Pré-Cadastrada' },
                          { value: 'CADASTRADA', label: 'Cadastrada' },
                          { value: 'COMANDADA', label: 'Comandada' },
                          { value: 'COLETADA', label: 'Coletada' }
                        ].map((situacao) => (
                          <label 
                            key={situacao.value} 
                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={Array.isArray(tempFilters.situacao) && tempFilters.situacao.includes(situacao.value)}
                              onChange={(e) => {
                                const currentSituacoes = Array.isArray(tempFilters.situacao) ? tempFilters.situacao : [];
                                const newSituacoes = e.target.checked
                                  ? [...currentSituacoes, situacao.value]
                                  : currentSituacoes.filter(s => s !== situacao.value);
                                setTempFilters({...tempFilters, situacao: newSituacoes});
                              }}
                              className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:bg-slate-700"
                            />
                            <span className="text-sm text-slate-900 dark:text-slate-100">{situacao.label}</span>
                          </label>
                        ))}
                      </div>
                      {Array.isArray(tempFilters.situacao) && tempFilters.situacao.length > 0 && (
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          {tempFilters.situacao.length} situação{tempFilters.situacao.length !== 1 ? 'ões' : ''} selecionada{tempFilters.situacao.length !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button
                      variant="outline"
                      onClick={clearFilters}
                      className="dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Limpar Filtros
                    </Button>
                    <Button
                      onClick={applyFilters}
                      className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-700"
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Aplicar Filtros
                    </Button>
                  </div>
                </div>
              </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <DashboardLayout 
      title="Performance de Coletas"
      description={user?.client_name}
      headerActions={headerActions}
    >
      {/* Conteúdo */}
      <main className="container mx-auto px-3 md:px-6 py-6 space-y-6">
        {/* Título e Subtítulo */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Análise de Performance de Coletas</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Acompanhamento do cumprimento de prazos e performance das coletas por período
          </p>
        </div>

        {/* Cards de Status com Donuts */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {coletaGroups.map((group, index) => {
            // ✅ GARANTIR que percentage seja um número válido
            const percentage = isNaN(group.percentage) ? 0 : Number(group.percentage);
            const count = Number(group.count) || 0;
            
            const donutData = [
              { name: 'value', value: percentage },
              { name: 'empty', value: 100 - percentage }
            ];
            
            // Mapeamento de índice para situação
            const situacaoMap = ['PRE-CADASTRADA', 'CADASTRADA', 'COMANDADA', 'COLETADA', 'TODAS'];
            
            return (
              <Card key={index} className={group.bgColor}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm ${group.color} flex items-center gap-2`}>
                      {index === 0 && <Clock className="w-4 h-4" />}
                      {index === 1 && <List className="w-4 h-4" />}
                      {index === 2 && <Truck className="w-4 h-4" />}
                      {index === 3 && <CheckCircle2 className="w-4 h-4" />}
                      {index === 4 && <Package className="w-4 h-4" />}
                      {group.label}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 ${group.color} ${group.hoverColor} gap-1 px-2`}
                      onClick={() => handleExportCard(situacaoMap[index], group.label)}
                      title={`Exportar ${group.label}`}
                      disabled={count === 0}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="text-xs font-medium">CSV</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-2xl font-bold ${group.color}`}>
                        {percentage.toFixed(1)}%
                      </div>
                      <p className={`text-sm mt-1 ${group.color}`}>
                        {count} coleta{count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div style={{ width: 80, height: 80 }}>
                      <PieChart width={80} height={80}>
                        <Pie
                          data={donutData}
                          cx={40}
                          cy={40}
                          innerRadius={20}
                          outerRadius={35}
                          startAngle={90}
                          endAngle={-270}
                          dataKey="value"
                          stroke="none"
                          isAnimationActive={true}
                          animationBegin={0}
                          animationDuration={800}
                        >
                          <Cell key="value" fill={group.chartColor} />
                          <Cell key="empty" fill={theme === 'dark' ? group.emptyColorDark : group.emptyColor} />
                        </Pie>
                      </PieChart>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Comparativo por Unidades Coletadoras */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Comparativo por Unidades Coletadoras
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Ranking de performance das unidades coletadoras
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              Clique sobre os totais para imprimir as coletas
            </p>
          </CardHeader>
          <CardContent>
            {/* ✅ SCROLL: max-height para exibir 10-12 unidades */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                  <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                    <th 
                      className="text-left py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('sigla')}
                    >
                      Unidade{renderSortIcon('sigla')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('qtdeColetas')}
                    >
                      Qtde Coletas{renderSortIcon('qtdeColetas')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('programadas')}
                    >
                      Programadas{renderSortIcon('programadas')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('comandadas')}
                    >
                      Comandadas{renderSortIcon('comandadas')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('coletadas')}
                    >
                      Coletadas{renderSortIcon('coletadas')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('noPrazo')}
                    >
                      No Prazo{renderSortIcon('noPrazo')}
                    </th>
                    <th 
                      className="text-left py-3 px-2 text-slate-700 dark:text-slate-300 min-w-[200px] cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('performance')}
                    >
                      Performance{renderSortIcon('performance')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedUnits().map((unit, index) => {
                    const barColor = unit.performance >= 90 
                      ? 'bg-green-500 dark:bg-green-600' 
                      : unit.performance >= 70 
                      ? 'bg-yellow-500 dark:bg-yellow-600' 
                      : 'bg-red-500 dark:bg-red-600';
                    
                    return (
                      <tr key={index} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-3 px-2 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{unit.sigla}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                              {unit.unidade}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right dark:text-slate-300">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'total', 'Total Coletas')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.qtdeColetas === 0}
                          >
                            {unit.qtdeColetas}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-blue-600 dark:text-blue-400">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'programadas', 'Coletas Programadas')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.programadas === 0}
                          >
                            {unit.programadas}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-orange-600 dark:text-orange-400">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'comandadas', 'Coletas Comandadas')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.comandadas === 0}
                          >
                            {unit.comandadas}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-slate-900 dark:text-slate-100">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'coletadas', 'Coletas Efetuadas')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.coletadas === 0}
                          >
                            {unit.coletadas}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-green-600 dark:text-green-400">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'no_prazo', 'Coletas No Prazo')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.noPrazo === 0}
                          >
                            {unit.noPrazo}
                          </button>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-6 overflow-hidden">
                              <div 
                                className={`h-full ${barColor} flex items-center justify-end px-2 transition-all duration-500`}
                                style={{ width: `${unit.performance}%` }}
                              >
                                {unit.performance >= 15 && (
                                  <span className="text-xs text-white font-medium">{unit.performance.toFixed(1)}%</span>
                                )}
                              </div>
                            </div>
                            {unit.performance < 15 && (
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium min-w-[45px]">
                                {unit.performance.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  
                  {/* Linha de Total */}
                  <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/80 sticky bottom-0">
                    <td className="py-3 px-2 font-bold dark:text-slate-100">TOTAL</td>
                    <td className="py-3 px-2 text-right font-bold dark:text-slate-100">
                      {unitPerformances.reduce((acc, u) => acc + u.qtdeColetas, 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-blue-600 dark:text-blue-400">
                      {unitPerformances.reduce((acc, u) => acc + u.programadas, 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-orange-600 dark:text-orange-400">
                      {unitPerformances.reduce((acc, u) => acc + u.comandadas, 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-slate-900 dark:text-slate-100">
                      {unitPerformances.reduce((acc, u) => acc + u.coletadas, 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-green-600 dark:text-green-400">
                      {unitPerformances.reduce((acc, u) => acc + u.noPrazo, 0)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-300 dark:bg-slate-600 rounded-full h-6 overflow-hidden">
                          {(() => {
                            const totalColetas = unitPerformances.reduce((acc, u) => acc + u.qtdeColetas, 0) || 1;
                            const totalNoPrazo = unitPerformances.reduce((acc, u) => acc + u.noPrazo, 0);
                            const performanceGeral = (totalNoPrazo / totalColetas) * 100;
                            const barColorGeral = performanceGeral >= 90 
                              ? 'bg-green-500 dark:bg-green-600' 
                              : performanceGeral >= 70 
                              ? 'bg-yellow-500 dark:bg-yellow-600' 
                              : 'bg-red-500 dark:bg-red-600';
                            
                            return (
                              <div 
                                className={`h-full ${barColorGeral} flex items-center justify-end px-2 transition-all duration-500`}
                                style={{ width: `${performanceGeral}%` }}
                              >
                                {performanceGeral >= 15 && (
                                  <span className="text-xs text-white font-medium">{performanceGeral.toFixed(1)}%</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        {(() => {
                          const totalProgramadas = unitPerformances.reduce((acc, u) => acc + u.programadas, 0) || 1;
                          const totalColetadas = unitPerformances.reduce((acc, u) => acc + u.coletadas, 0);
                          const performanceGeral = (totalColetadas / totalProgramadas) * 100;
                          
                          return performanceGeral < 15 && (
                            <span className="text-xs text-slate-600 dark:text-slate-400 font-medium min-w-[45px]">
                              {performanceGeral.toFixed(1)}%
                            </span>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Análise Diária */}
        <AnaliseDiariaColetas
          analisePeriodo={analisePeriodo}
          setAnalisePeriodo={setAnalisePeriodo}
          diasData={diasData}
          loadingAnalise={loadingAnalise}
          handleExportColetasDia={handleExportColetasDia}
          handleExportProgramadasDia={handleExportProgramadasDia}
          handleExportComandasDia={handleExportComandasDia}
          handleExportNoPrazoDia={handleExportNoPrazoDia}
        />

        {/* Gráfico de Evolução da Performance */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Evolução da Performance de Coletas
                  </CardTitle>
                  
                  {/* ✅ Ícone de Ajuda */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                      >
                        <CircleHelp className="w-5 h-5" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900">
                      <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <CircleHelp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          Como funciona a Evolução da Performance
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                          Informações sobre como a seção Evolução da Performance funciona, incluindo filtros aplicados e métricas exibidas
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            ⚠️ Importante sobre os Filtros
                          </p>
                          <p>
                            Esta seção <strong>DESCONSIDERA os períodos informados no filtro</strong>, mas respeita os outros filtros (Unidade de Coleta, CNPJ Remetente e Placa).
                          </p>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            📅 Período Considerado
                          </p>
                          <p>
                            O período analisado é determinado pela chave selecionada: <strong>7 dias</strong>, <strong>15 dias</strong> ou <strong>1 mês</strong>.
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            📊 Métricas Exibidas
                          </p>
                          
                          <div className="pl-3 space-y-2">
                            <div>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">Performance (%):</span>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                Percentual de coletas realizadas no prazo em relação às coletas programadas para cada dia. Calculado como: (Coletadas no Prazo / Programadas) × 100.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                            🎯 Objetivo do Gráfico
                          </p>
                          <p className="text-xs">
                            Identificar tendências de performance ao longo do tempo, permitindo visualizar se a eficiência das coletas está melhorando, estável ou em queda.
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Percentual de coletas realizadas no prazo por dia
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  Clique sobre os dias para imprimir as coletas programadas
                </p>
              </div>

              {/* Chave de Perodo */}
              <div className="flex gap-2">
                <Button
                  variant={evolucaoPeriodo === 7 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEvolucaoPeriodo(7)}
                  className={evolucaoPeriodo === 7 ? 'bg-blue-600 hover:bg-blue-700' : 'dark:border-slate-600'}
                >
                  7 dias
                </Button>
                <Button
                  variant={evolucaoPeriodo === 15 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEvolucaoPeriodo(15)}
                  className={evolucaoPeriodo === 15 ? 'bg-blue-600 hover:bg-blue-700' : 'dark:border-slate-600'}
                >
                  15 dias
                </Button>
                <Button
                  variant={evolucaoPeriodo === 30 ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEvolucaoPeriodo(30)}
                  className={evolucaoPeriodo === 30 ? 'bg-blue-600 hover:bg-blue-700' : 'dark:border-slate-600'}
                >
                  1 mês
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingEvolucao ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : evolucaoData.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                Nenhum dado disponível para o período selecionado
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart 
                  data={evolucaoData}
                  onClick={(e) => {
                    if (e && e.activePayload && e.activePayload[0]) {
                      const data = e.activePayload[0].payload.data;
                      handleExportEvolucao(data);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                  <XAxis 
                    dataKey="data" 
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value + 'T12:00:00');
                      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
                    }}
                  />
                  <YAxis 
                    tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b', fontSize: 12 }}
                    domain={[0, 100]}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white dark:bg-slate-800 p-3 border dark:border-slate-700 rounded shadow-lg">
                            <p className="font-semibold dark:text-slate-100">{data.data}</p>
                            <p className="text-sm text-blue-600 dark:text-blue-400">
                              Performance: {data.performance.toFixed(1)}%
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Total: {data.total} | No Prazo: {data.noPrazo}
                            </p>
                            <p className="text-xs text-blue-500 dark:text-blue-300 mt-2 flex items-center gap-1">
                              <FileSpreadsheet className="w-3 h-3" />
                              Clique para exportar CSV
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="performance" 
                    name="Performance (%)"
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 4, cursor: 'pointer' }}
                    activeDot={{ r: 6, cursor: 'pointer' }}
                    cursor="pointer"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </main>
    </DashboardLayout>
  );
}