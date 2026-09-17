import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  CircleHelp,
  RefreshCw,
  AlertTriangle,
  Ban
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { FilterSelectCliente } from './FilterSelectCliente';
import { FilterSelectVeiculo } from './FilterSelectVeiculo';
import { AnaliseDiariaColetas } from './AnaliseDiariaColetas';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { getLogoUrl } from '../../config/clientLogos';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';
import { 
  getDashboardData,
  getAnaliseDiariaCalendario,
  type ColetasFilters,
  type PerformanceCards as PerformanceCardsType,
  type DayDataColetas,
  type EvolucaoDataColetas,
  type UnidadePerformanceColetas
} from '../../services/performanceColetasService';

interface Filters extends ColetasFilters {}

interface ColetaRaw {
  unidade: string;
  nro_coleta: string;
  data_inclusao: string;
  hora_inclusao: string;
  data_limite: string;
  hora_limite: string;
  cnpj_emit: string;
  nome_emit: string;
  endereco_emit: string;
  bairro_emit: string;
  cidade_emit: string;
  uf_emit: string;
  cep_emit: string;
  setor: string;
  cnpj_dest: string;
  nome_dest?: string;
  cidade_dest?: string;
  uf_dest?: string;
  solicitante: string;
  situacao: string;
  vlr_merc: string;
  qtde_vol: string;
  peso: string;
  placa: string;
  observacao: string;
  data_efetivacao: string;
  hora_efetivacao: string;
}

interface ColetaGroup {
  id: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  bgColor: string;
  blobColor: string;
  chartColor: string;
  emptyColor: string;
  emptyColorDark: string;
  hoverColor: string;
  situacao?: string;
  icon?: React.ReactNode;
  showCount?: boolean;
  showCsv?: boolean;
}

export function PerformanceColetas() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  
  const getDefaultPeriod = () => {
    const today = new Date();
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    return { inicio: formatDate(sevenDaysAgo), fim: formatDate(today) };
  };

  const defaultPeriod = getDefaultPeriod();
  const unidadeLogada = (user?.unidade_atual || user?.unidade || '').trim().toUpperCase();
  const isMTZ = unidadeLogada === 'MTZ' || unidadeLogada === '';
  const unidadeUsuario = unidadeLogada;

  const [filters, setFilters] = useState<Filters>({
    periodoInicio: defaultPeriod.inicio,
    periodoFim: defaultPeriod.fim,
    unidadeColeta: isMTZ ? '' : unidadeUsuario,
    cnpjRemetente: '',
    placa: '',
    situacao: []
  });
  
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [coletasRaw, setColetasRaw] = useState<ColetaRaw[]>([]);
  const [coletaGroups, setColetaGroups] = useState<ColetaGroup[]>([]);
  const [evolucaoData, setEvolucaoData] = useState<any[]>([]);
  const [unitPerformances, setUnitPerformances] = useState<UnidadePerformanceColetas[]>([]);
  const [canceladas, setCanceladas] = useState(0);

  const [listaOpen, setListaOpen] = useState(false);
  const [listaTitle, setListaTitle] = useState('');
  const [listaRows, setListaRows] = useState<ColetaRaw[]>([]);
  const [listaSort, setListaSort] = useState<{ key: 'coleta' | 'inclusao' | 'cliente' | 'status' | 'vlr_merc' | 'peso' | 'limite' | 'efetivacao'; dir: 'asc' | 'desc' }>({ key: 'limite', dir: 'desc' });
  const [listaPage, setListaPage] = useState(1);
  const listaPageSize = 70;
  
  // Estados para ordenação da tabela de comparativo
  const [sortColumn, setSortColumn] = useState<keyof UnidadePerformanceColetas>('performance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Estados para Análise Diária
  const [analisePeriodo, setAnalisePeriodo] = useState<7 | 15 | 30>(7);
  const [diasData, setDiasData] = useState<DayDataColetas[]>([]);
  const [loadingAnalise, setLoadingAnalise] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [loadingCalendario, setLoadingCalendario] = useState(false);
  const [allDiasData, setAllDiasData] = useState<DayDataColetas[]>([]);
  const [coletasRawCalendario, setColetasRawCalendario] = useState<ColetaRaw[]>([]);

  // Estados para Evolução da Performance

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



  // Fatiar allDiasData quando mudar o período do calendário
  useEffect(() => {
    const byDate = new Map<string, DayDataColetas>();
    for (const d of allDiasData) {
      if (d?.data) byDate.set(d.data, d);
    }

    const end = new Date();
    end.setDate(end.getDate() + 3);
    const endMid = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0, 0);
    const startMid = new Date(endMid);
    startMid.setDate(startMid.getDate() - (analisePeriodo - 1));

    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (dt: Date) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

    const filled: DayDataColetas[] = [];
    for (let i = 0; i < analisePeriodo; i++) {
      const d = new Date(startMid);
      d.setDate(startMid.getDate() + i);
      const iso = fmt(d);
      const found = byDate.get(iso);
      filled.push(
        found ?? {
          data: iso,
          coletasRealizadas: 0,
          coletasProgramadas: 0,
          coletadasNoPrazo: 0,
          coletasAtrasadas: 0,
          performance: 0,
        }
      );
    }

    setDiasData(filled);
  }, [analisePeriodo, allDiasData]);

  // Autoatualizador: countdown de 5 minutos
  useEffect(() => {
    if (coletaGroups.length === 0) return;
    setCountdown(300);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          loadMockData();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [filters, coletaGroups.length > 0]);

  const loadMockData = async () => {
    if (coletaGroups.length > 0) {
      setReprocessing(true);
    } else {
      setLoading(true);
    }
    try {
      console.log('🚀 [PerformanceColetas] Carregando TODOS os dados via endpoint unificado');
      
      // ✅ NOVO: Usar endpoint unificado que retorna tudo de uma vez
      const safeFilters: any = { ...filters };
      if (!safeFilters.unidadeColeta) delete safeFilters.unidadeColeta;
      const dashboardData = await getDashboardData(safeFilters);
      console.log('✅ [PerformanceColetas] Dados recebidos:', dashboardData);
      
      // ✅ VALIDAÇÃO: Garantir que os dados são válidos
      if (!dashboardData || typeof dashboardData !== 'object') {
        throw new Error('Dados inválidos recebidos do servidor');
      }
      
      // Processar cards
      const cardsData = dashboardData.cards || { preCadastradas: 0, cadastradas: 0, comandadas: 0, coletadas: 0, canceladas: 0, total: 0 };
      
      const preCadastradas = Number(cardsData.preCadastradas) || 0;
      const cadastradas    = Number(cardsData.cadastradas)    || 0;
      const comandadas     = Number(cardsData.comandadas)     || 0;
      const coletadas      = Number(cardsData.coletadas)      || 0;
      const total          = Number(cardsData.total)          || 0;
      const canceladasCount = Number(cardsData.canceladas) || 0;
      setCanceladas(canceladasCount);

      const evolucaoArray = Array.isArray(dashboardData.evolucao) ? dashboardData.evolucao : [];
      const comparativoArray = Array.isArray(dashboardData.comparativo) ? dashboardData.comparativo : [];
      const coletasList: ColetaRaw[] = Array.isArray(dashboardData.coletas) ? dashboardData.coletas : [];
      const now = new Date();
      const performanceGeral = (() => {
        const totalColetas = comparativoArray.reduce((acc: number, u: any) => acc + (Number(u.qtdeColetas) || 0), 0);
        const totalNoPrazo = comparativoArray.reduce((acc: number, u: any) => acc + (Number(u.noPrazo) || 0), 0);
        if (totalColetas <= 0) return 0;
        return (totalNoPrazo / totalColetas) * 100;
      })();

      const emAtraso = coletasList.reduce((acc, c) => acc + (isColetaAtrasada(c, now) ? 1 : 0), 0);
      const totalAll = total + canceladasCount;
      
      // Criar grupos com cores específicas
      const groups: ColetaGroup[] = [
        {
          id: 'performance',
          label: 'Performance',
          count: 0,
          percentage: performanceGeral,
          color: 'text-green-700 dark:text-green-300',
          bgColor: 'bg-gradient-to-br from-white to-green-50 dark:from-slate-900/90 dark:to-green-900/10',
          blobColor: 'bg-green-400',
          chartColor: '#22c55e',
          emptyColor: '#dcfce7',
          emptyColorDark: '#064e3b',
          hoverColor: 'hover:bg-green-200 dark:hover:bg-green-800',
          icon: <TrendingUp className="w-4 h-4" />,
          showCount: false,
          showCsv: false,
        },
        {
          id: 'pre',
          label: 'Pré-Cadastradas',
          count: preCadastradas,
          percentage: total > 0 ? (preCadastradas / total) * 100 : 0,
          color: 'text-slate-700 dark:text-slate-300',
          bgColor: 'bg-gradient-to-br from-white to-slate-50 dark:from-slate-900/90 dark:to-slate-900/40',
          blobColor: 'bg-slate-400',
          chartColor: '#64748b',
          emptyColor: '#f1f5f9',
          emptyColorDark: '#1e293b',
          hoverColor: 'hover:bg-slate-200 dark:hover:bg-slate-800',
          situacao: 'PRE-CADASTRADA',
          icon: <Clock className="w-4 h-4" />,
          showCount: true,
          showCsv: false,
        },
        {
          id: 'cad',
          label: 'Cadastradas',
          count: cadastradas,
          percentage: total > 0 ? (cadastradas / total) * 100 : 0,
          color: 'text-blue-700 dark:text-blue-300',
          bgColor: 'bg-gradient-to-br from-white to-blue-50 dark:from-slate-900/90 dark:to-blue-900/10',
          blobColor: 'bg-blue-400',
          chartColor: '#3b82f6',
          emptyColor: '#dbeafe',
          emptyColorDark: '#1e3a8a',
          hoverColor: 'hover:bg-blue-200 dark:hover:bg-blue-800',
          situacao: 'CADASTRADA',
          icon: <List className="w-4 h-4" />,
          showCount: true,
          showCsv: false,
        },
        {
          id: 'com',
          label: 'Comandadas',
          count: comandadas,
          percentage: total > 0 ? (comandadas / total) * 100 : 0,
          color: 'text-yellow-700 dark:text-yellow-300',
          bgColor: 'bg-gradient-to-br from-white to-yellow-50 dark:from-slate-900/90 dark:to-yellow-900/10',
          blobColor: 'bg-yellow-400',
          chartColor: '#f59e0b',
          emptyColor: '#fef3c7',
          emptyColorDark: '#713f12',
          hoverColor: 'hover:bg-yellow-200 dark:hover:bg-yellow-800',
          situacao: 'COMANDADA',
          icon: <Truck className="w-4 h-4" />,
          showCount: true,
          showCsv: false,
        },
        {
          id: 'colet',
          label: 'Coletadas',
          count: coletadas,
          percentage: total > 0 ? (coletadas / total) * 100 : 0,
          color: 'text-teal-700 dark:text-teal-300',
          bgColor: 'bg-gradient-to-br from-white to-teal-50 dark:from-slate-900/90 dark:to-teal-900/10',
          blobColor: 'bg-teal-400',
          chartColor: '#14b8a6',
          emptyColor: '#ccfbf1',
          emptyColorDark: '#134e4a',
          hoverColor: 'hover:bg-teal-200 dark:hover:bg-teal-800',
          situacao: 'COLETADA',
          icon: <CheckCircle2 className="w-4 h-4" />,
          showCount: true,
          showCsv: false,
        }
        ,
        {
          id: 'atraso',
          label: 'Em atraso',
          count: emAtraso,
          percentage: total > 0 ? (emAtraso / total) * 100 : 0,
          color: 'text-red-700 dark:text-red-300',
          bgColor: 'bg-gradient-to-br from-white to-red-50 dark:from-slate-900/90 dark:to-red-900/10',
          blobColor: 'bg-red-400',
          chartColor: '#ef4444',
          emptyColor: '#fee2e2',
          emptyColorDark: '#7f1d1d',
          hoverColor: 'hover:bg-red-200 dark:hover:bg-red-800',
          icon: <AlertTriangle className="w-4 h-4" />,
          showCount: true,
          showCsv: false,
        },
        {
          id: 'total',
          label: 'Total',
          count: total,
          percentage: 100,
          color: 'text-purple-700 dark:text-purple-300',
          bgColor: 'bg-gradient-to-br from-white to-purple-50 dark:from-slate-900/90 dark:to-purple-900/10',
          blobColor: 'bg-purple-400',
          chartColor: '#a855f7',
          emptyColor: '#f3e8ff',
          emptyColorDark: '#581c87',
          hoverColor: 'hover:bg-purple-200 dark:hover:bg-purple-800',
          icon: <Package className="w-4 h-4" />,
          showCount: true,
          showCsv: false,
        },
        {
          id: 'cancel',
          label: 'Canceladas',
          count: canceladasCount,
          percentage: totalAll > 0 ? (canceladasCount / totalAll) * 100 : 0,
          color: 'text-zinc-700 dark:text-zinc-300',
          bgColor: 'bg-gradient-to-br from-white to-zinc-50 dark:from-slate-900/90 dark:to-zinc-900/10',
          blobColor: 'bg-zinc-400',
          chartColor: '#71717a',
          emptyColor: '#f4f4f5',
          emptyColorDark: '#27272a',
          hoverColor: 'hover:bg-zinc-200 dark:hover:bg-zinc-800',
          situacao: 'CANCELADA',
          icon: <Ban className="w-4 h-4" />,
          showCount: true,
          showCsv: false,
        },
      ];
      
      setColetaGroups(groups);
      setEvolucaoData(evolucaoArray);
      setUnitPerformances(comparativoArray);
      setColetasRaw(coletasList);
      
      setLoading(false);
      setReprocessing(false);

      loadAnaliseDiaria();
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      setLoading(false);
      setReprocessing(false);
    }
  };

  const loadAnaliseDiaria = async () => {
    setLoadingCalendario(true);
    try {
      const analiseFilters: any = {
        cnpjRemetente:  filters.cnpjRemetente,
        placa:          filters.placa,
        situacao:       filters.situacao,
      };
      if (filters.unidadeColeta) analiseFilters.unidadeColeta = filters.unidadeColeta;
      const { analiseDiaria, coletas } = await getAnaliseDiariaCalendario(analiseFilters);
      const coletasArr = Array.isArray(coletas) ? (coletas as ColetaRaw[]) : [];
      const now = new Date();
      const diasArr = Array.isArray(analiseDiaria) ? (analiseDiaria as DayDataColetas[]) : [];
      const diasComAtrasadas = diasArr.map((d) => {
        const iso = normDate(d.data);
        const atrasadas = coletasArr.reduce((acc, c) => acc + (isAtrasadaCalendario(c, iso, now) ? 1 : 0), 0);
        return { ...d, coletasAtrasadas: atrasadas };
      });
      setAllDiasData(diasComAtrasadas);
      setColetasRawCalendario(coletasArr);
    } catch (error) {
      console.error('❌ Erro ao carregar análise diária:', error);
      setAllDiasData([]);
      setColetasRawCalendario([]);
    } finally {
      setLoadingCalendario(false);
    }
  };

  const clearFilters = () => {
    const emptyFilters: Filters = {
      periodoInicio: '',
      periodoFim: '',
      unidadeColeta: isMTZ ? '' : unidadeUsuario,
      cnpjRemetente: '',
      placa: '',
      situacao: []
    };
    setTempFilters(emptyFilters);
    setFilters(emptyFilters);
    setShowFilters(false);
  };

  const applyFilters = () => {
    if (!tempFilters.periodoInicio || !tempFilters.periodoFim) {
      toast.error('Informe as datas de início e fim do período de lançamento.');
      return;
    }

    const diffDays = Math.round((new Date(tempFilters.periodoFim).getTime() - new Date(tempFilters.periodoInicio).getTime()) / 86_400_000);
    if (diffDays > 31) {
      toast.error('O período não pode ser maior que 31 dias.');
      return;
    }

    setFilters(tempFilters);
    setShowFilters(false);
  };

  const getPeriodDisplay = () => {
    const formatDate = (dateStr: string) => {
      if (!dateStr) return '';
      const [year, month, day] = dateStr.split('-');
      return `${day}/${month}/${year}`;
    };
    if (filters.periodoInicio && filters.periodoFim) {
      return `${formatDate(filters.periodoInicio)} - ${formatDate(filters.periodoFim)}`;
    } else if (filters.periodoInicio) {
      return `A partir de ${formatDate(filters.periodoInicio)}`;
    } else if (filters.periodoFim) {
      return `Até ${formatDate(filters.periodoFim)}`;
    }
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
  const CSV_HEADER = ['Unidade','Nº Coleta','Data Inclusão','Hora Inclusão','Data Limite','Hora Limite',
    'CNPJ Remetente','Nome Remetente','Endereço','Bairro','Cidade','UF','CEP','Setor',
    'CNPJ Destinatário','DESTINATARIO','CIDADE_DESTINO','UF_DESTINO','Solicitante','Situação','Vlr Mercadoria','Qtde Vol','Peso',
    'Placa','Observação','Data Efetivação','Hora Efetivação'];

  const coletaToRow = (c: ColetaRaw) => [
    c.unidade, c.nro_coleta, c.data_inclusao, c.hora_inclusao, c.data_limite, c.hora_limite,
    c.cnpj_emit, c.nome_emit, c.endereco_emit, c.bairro_emit, c.cidade_emit, c.uf_emit, c.cep_emit, c.setor,
    c.cnpj_dest, c.nome_dest ?? '', c.cidade_dest ?? '', c.uf_dest ?? '', c.solicitante, c.situacao, c.vlr_merc, c.qtde_vol, c.peso,
    c.placa, c.observacao, c.data_efetivacao ?? '', c.hora_efetivacao ?? ''
  ];

  const downloadCSV = (rows: ColetaRaw[], filename: string) => {
    if (rows.length === 0) { toast.warning('Nenhum dado para exportar.'); return; }
    const lines = [CSV_HEADER, ...rows.map(coletaToRow)]
      .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\uFEFF' + lines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const SITUACAO_BADGE: Record<string, { label: string; className: string }> = {
    'PRE-CADASTRADA': { label: 'Pré-cadastrada', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
    'CADASTRADA': { label: 'Cadastrada', className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
    'COMANDADA': { label: 'Comandada', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-300' },
    'COLETADA': { label: 'Coletada', className: 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300' },
    'CANCELADA': { label: 'Cancelada', className: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-200' },
  };

  const normDate = (d: string) => {
    if (!d) return '';
    if (d.includes('/')) { const [dd, mm, yyyy] = d.split('/'); return `${yyyy}-${mm}-${dd}`; }
    return d;
  };

  const parseDateTimeIso = (dateBr?: string, time?: string) => {
    const iso = normDate(String(dateBr ?? ''));
    if (!iso) return null;
    const hhmm = String(time ?? '').slice(0, 5);
    if (!hhmm || hhmm.length < 4) return new Date(`${iso}T00:00:00`);
    return new Date(`${iso}T${hhmm}:00`);
  };

  const getLimiteDateTime = (c: ColetaRaw) => parseDateTimeIso(c.data_limite, c.hora_limite || '17:00');
  const getEfetivacaoDateTime = (c: ColetaRaw) => parseDateTimeIso(c.data_efetivacao, c.hora_efetivacao);
  const getInclusaoDateTime = (c: ColetaRaw) => parseDateTimeIso(c.data_inclusao, c.hora_inclusao);

  const isColetaNoPrazo = (c: ColetaRaw) => {
    if (c.situacao !== 'COLETADA') return false;
    const limite = getLimiteDateTime(c);
    const efet = getEfetivacaoDateTime(c);
    if (!limite || !efet) return false;
    return efet.getTime() <= limite.getTime();
  };

  const isColetaAtrasada = (c: ColetaRaw, now: Date) => {
    if (c.situacao === 'CANCELADA') return false;
    const limite = getLimiteDateTime(c);
    if (!limite) return false;
    if (c.situacao === 'COLETADA') {
      const efet = getEfetivacaoDateTime(c);
      if (!efet) return false;
      return efet.getTime() > limite.getTime();
    }
    return now.getTime() > limite.getTime();
  };

  const parseBRNumber = (v: any) => {
    const s = String(v ?? '').trim();
    if (!s) return null;
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    if (Number.isNaN(n)) return null;
    return n;
  };

  const fmtBRL = (v: any) => {
    const n = typeof v === 'number' ? v : parseBRNumber(v);
    if (n === null) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const fmtKg = (v: any) => {
    const n = typeof v === 'number' ? v : parseBRNumber(v);
    if (n === null) return '—';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' kg';
  };

  const fmtDateShort = (d?: string) => {
    const s = String(d ?? '').trim();
    if (!s) return '—';
    const parts = s.split('/');
    if (parts.length !== 3) return s;
    const [dd, mm, yyyy] = parts;
    return `${dd}/${mm}/${yyyy.slice(-2)}`;
  };

  const fmtTimeHHMM = (t?: string) => {
    const s = String(t ?? '').trim();
    if (!s) return '';
    return s.slice(0, 5);
  };

  const openListaCustom = (title: string, rows: ColetaRaw[]) => {
    setListaTitle(title);
    setListaRows(rows);
    setListaSort({ key: 'limite', dir: 'desc' });
    setListaPage(1);
    setListaOpen(true);
  };

  const openListaColetas = (cardId: string) => {
    const now = new Date();
    let title = '';
    let rows: ColetaRaw[] = [];

    switch (cardId) {
      case 'performance':
        title = 'Coletas no prazo';
        rows = coletasRaw.filter(isColetaNoPrazo);
        break;
      case 'pre':
        title = 'Pré-cadastradas';
        rows = coletasRaw.filter((c) => c.situacao === 'PRE-CADASTRADA');
        break;
      case 'cad':
        title = 'Cadastradas';
        rows = coletasRaw.filter((c) => c.situacao === 'CADASTRADA');
        break;
      case 'com':
        title = 'Comandadas';
        rows = coletasRaw.filter((c) => c.situacao === 'COMANDADA');
        break;
      case 'colet':
        title = 'Coletadas';
        rows = coletasRaw.filter((c) => c.situacao === 'COLETADA');
        break;
      case 'atraso':
        title = 'Em atraso';
        rows = coletasRaw.filter((c) => isColetaAtrasada(c, now));
        break;
      case 'total':
        title = 'Total';
        rows = coletasRaw.filter((c) => c.situacao !== 'CANCELADA');
        break;
      case 'cancel':
        title = 'Canceladas';
        rows = coletasRaw.filter((c) => c.situacao === 'CANCELADA');
        break;
      default:
        title = 'Coletas';
        rows = [...coletasRaw];
        break;
    }

    openListaCustom(title, rows);
  };

  const isAtrasadaCalendario = (c: ColetaRaw, iso: string, now: Date) => {
    if (normDate(c.data_limite) !== iso) return false;
    if (c.situacao === 'CANCELADA') return false;
    const limiteHora = (c.hora_limite || '17:00').slice(0, 5);
    const limiteDt = new Date(`${iso}T${limiteHora}:00`);
    if (c.situacao === 'COLETADA') {
      if (!c.data_efetivacao || !c.hora_efetivacao) return false;
      const efetIso = normDate(c.data_efetivacao);
      const efetHora = String(c.hora_efetivacao).slice(0, 5);
      const efetDt = new Date(`${efetIso}T${efetHora}:00`);
      return efetDt.getTime() > limiteDt.getTime();
    }
    return now.getTime() > limiteDt.getTime();
  };

  const handleExportColetasDia = (data: string) => {
    const iso = normDate(data);
    const filtered = coletasRaw.filter(c => normDate(c.data_limite) === iso);
    openListaCustom(`Coletas — ${iso}`, filtered);
  };

  const handleExportProgramadasDia = (data: string) => {
    const iso = normDate(data);
    const filtered = coletasRaw.filter(c => normDate(c.data_limite) === iso && ['PRE-CADASTRADA','CADASTRADA','COMANDADA'].includes(c.situacao));
    openListaCustom(`Programadas — ${iso}`, filtered);
  };

  const handleExportComandasDia = (data: string) => {
    const iso = normDate(data);
    const filtered = coletasRaw.filter(c => normDate(c.data_limite) === iso && c.situacao === 'COMANDADA');
    openListaCustom(`Comandadas — ${iso}`, filtered);
  };

  const handleExportNoPrazoDia = (data: string) => {
    const iso = normDate(data);
    const filtered = coletasRaw.filter(c => normDate(c.data_limite) === iso && c.situacao === 'COLETADA');
    openListaCustom(`Coletadas — ${iso}`, filtered);
  };

  const handleExportCalendarioColetasDia = (data: string) => {
    const iso = normDate(data);
    const filtered = coletasRawCalendario.filter(c => normDate(c.data_limite) === iso && c.situacao === 'COLETADA');
    openListaCustom(`Coletadas — ${iso}`, filtered);
  };

  const handleExportCalendarioProgramadasDia = (data: string) => {
    const iso = normDate(data);
    const filtered = coletasRawCalendario.filter(c => normDate(c.data_limite) === iso);
    openListaCustom(`Programadas — ${iso}`, filtered);
  };

  const handleExportCalendarioNoPrazoDia = (data: string) => {
    const iso = normDate(data);
    const filtered = coletasRawCalendario.filter(c => {
      if (normDate(c.data_limite) !== iso || c.situacao !== 'COLETADA') return false;
      if (!c.data_efetivacao || !c.hora_efetivacao) return false;
      const efet = normDate(c.data_efetivacao) + 'T' + c.hora_efetivacao;
      const limite = iso + 'T' + (c.hora_limite || '17:00');
      return efet <= limite;
    });
    openListaCustom(`No prazo — ${iso}`, filtered);
  };

  const handleExportCalendarioAtrasadasDia = (data: string) => {
    const iso = normDate(data);
    const now = new Date();
    const filtered = coletasRawCalendario.filter((c) => isAtrasadaCalendario(c, iso, now));
    openListaCustom(`Em atraso — ${iso}`, filtered);
  };

  const handleExportComparativo = (sigla: string, tipo: 'total' | 'programadas' | 'comandadas' | 'coletadas' | 'no_prazo', label: string) => {
    let filtered = coletasRaw.filter(c => c.unidade.startsWith(sigla));
    if (tipo === 'programadas') filtered = filtered.filter(c => ['PRE-CADASTRADA','CADASTRADA','COMANDADA'].includes(c.situacao));
    else if (tipo === 'comandadas') filtered = filtered.filter(c => c.situacao === 'COMANDADA');
    else if (tipo === 'coletadas') filtered = filtered.filter(c => c.situacao === 'COLETADA');
    else if (tipo === 'no_prazo') filtered = filtered.filter(c => c.situacao === 'COLETADA' && c.data_efetivacao && c.data_efetivacao <= c.data_limite);
    openListaCustom(`${label} — ${sigla}`, filtered);
  };

  const handleExportEvolucao = (dataStr: string) => {
    let iso = dataStr;
    if (!iso.includes('-')) {
      const [day, month] = dataStr.split('/');
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();
      const mesAtual = hoje.getMonth() + 1;
      const mesClicado = parseInt(month, 10);
      const year = mesClicado > mesAtual ? anoAtual - 1 : anoAtual;
      iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const filtered = coletasRaw.filter((c) => normDate(c.data_limite) === iso);
    openListaCustom(`Coletas — ${iso}`, filtered);
  };

  const exportarListaCSV = () => {
    if (listaRows.length === 0) return;
    downloadCSV(listaRows, `coletas_${listaTitle.toLowerCase().replace(/\s+/g, '_')}.csv`);
    toast.success('Planilha gerada com sucesso');
  };

  const isInitialLoading = loading && coletaGroups.length === 0;

  const countdownMin = Math.floor(countdown / 60);
  const countdownSec = String(countdown % 60).padStart(2, '0');

  const headerActions = (
    <div className="flex items-center gap-2 md:gap-4">
      {/* Countdown de atualização */}
      {coletaGroups.length > 0 && (
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <RefreshCw className="w-3 h-3" />
          <span>{countdownMin}:{countdownSec}</span>
        </div>
      )}
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
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodoInicio}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setTempFilters({...tempFilters, periodoInicio: e.target.value})}
                            className="dark:bg-slate-800 dark:border-slate-700 pr-8"
                          />
                          {tempFilters.periodoInicio && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({...tempFilters, periodoInicio: ''})}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodoFim}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setTempFilters({...tempFilters, periodoFim: e.target.value})}
                            className="dark:bg-slate-800 dark:border-slate-700 pr-8"
                          />
                          {tempFilters.periodoFim && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({...tempFilters, periodoFim: ''})}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ✅ NOVO: Filtro de Unidade de Coleta */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                    <Label className="text-slate-900 dark:text-slate-100">Unidade de Coleta</Label>
                    <FilterSelectUnidadeSingle
                      value={tempFilters.unidadeColeta}
                      onChange={(value) => setTempFilters({...tempFilters, unidadeColeta: value})}
                      disabled={!isMTZ}
                      respectUserUnit={!isMTZ}
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

  const listaSortedRows = useMemo(() => {
    const sorted = [...listaRows];
    const dirMult = listaSort.dir === 'asc' ? 1 : -1;

    const cmp = (a: any, b: any) => {
      if (a === b) return 0;
      if (a == null) return -1;
      if (b == null) return 1;
      if (a instanceof Date || b instanceof Date) {
        const at = a instanceof Date ? a.getTime() : new Date(a).getTime();
        const bt = b instanceof Date ? b.getTime() : new Date(b).getTime();
        return at === bt ? 0 : at > bt ? 1 : -1;
      }
      if (typeof a === 'number' || typeof b === 'number') {
        const an = typeof a === 'number' ? a : Number(a);
        const bn = typeof b === 'number' ? b : Number(b);
        return an === bn ? 0 : an > bn ? 1 : -1;
      }
      return String(a).localeCompare(String(b), 'pt-BR');
    };

    const getVal = (c: ColetaRaw) => {
      switch (listaSort.key) {
        case 'coleta': return Number(String(c.nro_coleta ?? '').replace(/\D/g, '')) || 0;
        case 'inclusao': return getInclusaoDateTime(c) ?? new Date(0);
        case 'cliente': return c.nome_emit ?? '';
        case 'status': return c.situacao ?? '';
        case 'vlr_merc': return parseBRNumber(c.vlr_merc) ?? 0;
        case 'peso': return parseBRNumber(c.peso) ?? 0;
        case 'limite': return getLimiteDateTime(c) ?? new Date(0);
        case 'efetivacao': return getEfetivacaoDateTime(c) ?? new Date(0);
        default: return '';
      }
    };

    sorted.sort((a, b) => cmp(getVal(a), getVal(b)) * dirMult);
    return sorted;
  }, [listaRows, listaSort]);

  const listaTotalPages = Math.max(1, Math.ceil(listaSortedRows.length / listaPageSize));
  const listaSafePage = Math.min(Math.max(listaPage, 1), listaTotalPages);
  const listaPageRows = listaSortedRows.slice((listaSafePage - 1) * listaPageSize, listaSafePage * listaPageSize);

  return (
    <DashboardLayout 
      title="Performance de Coletas"
      description={user?.client_name}
      headerActions={headerActions}
    >
      {/* Conteúdo */}
      <main className="container mx-auto px-3 md:px-6 py-6 space-y-6 relative">
        {(isInitialLoading || reprocessing) && (
          <div className="absolute inset-0 z-20 bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl px-10 py-8 text-center border border-slate-200 dark:border-slate-800">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-slate-700 dark:text-slate-200 font-medium">{reprocessing ? 'Reprocessando...' : 'Carregando...'}</p>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Essa operação pode levar alguns segundos.</p>
            </div>
          </div>
        )}
        {/* Título e Subtítulo */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Análise de Performance de Coletas</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Acompanhamento do cumprimento de prazos e performance das coletas por período
          </p>
        </div>

        <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <div className="text-sm font-semibold">Resumo</div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-200 dark:bg-slate-800">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px">
            {coletaGroups.map((group) => {
              const percentage = Number.isNaN(Number(group.percentage)) ? 0 : Number(group.percentage);
              const count = Number(group.count) || 0;
              const donutData = [
                { name: 'value', value: percentage },
                { name: 'empty', value: 100 - percentage }
              ];

              return (
                <div
                  key={group.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openListaColetas(group.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') openListaColetas(group.id);
                  }}
                  className={`relative overflow-hidden p-4 ${group.bgColor} cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500`}
                >
                  <div className={`absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-20 ${group.blobColor}`} />
                  <div className="relative flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={group.color}>{group.icon}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{group.label}</div>
                      </div>
                      <div className={`text-2xl font-bold tabular-nums mt-2 ${group.color}`}>{percentage.toFixed(1)}%</div>
                      {group.showCount !== false && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          {count} coleta{count !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0" style={{ width: 80, height: 80 }}>
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
                </div>
              );
            })}
          </div>
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
              Clique sobre os totais para ver lista
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
          loadingAnalise={loadingCalendario}
          handleExportColetasDia={handleExportCalendarioColetasDia}
          handleExportProgramadasDia={handleExportCalendarioProgramadasDia}
          handleExportNoPrazoDia={handleExportCalendarioNoPrazoDia}
          handleExportAtrasadasDia={handleExportCalendarioAtrasadasDia}
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
                  Clique sobre os dias para ver lista
                </p>
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
                              Clique para ver lista
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

      <Dialog open={listaOpen} onOpenChange={setListaOpen}>
        <DialogContent className="max-w-7xl h-[85vh] flex flex-col overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="shrink-0 pr-16">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-slate-900 dark:text-slate-100 truncate">{listaTitle || 'Coletas'}</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">Lista de coletas que compõem o indicador.</DialogDescription>
              </div>
              {listaRows.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportarListaCSV} className="gap-2 shrink-0 dark:border-slate-700">
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
                <table className="w-full text-sm table-fixed">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                    <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[13%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setListaSort((s) => ({ key: 'coleta', dir: s.key === 'coleta' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                        >
                          Coleta / Inclusão{listaSort.key === 'coleta' ? (listaSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[31%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setListaSort((s) => ({ key: 'cliente', dir: s.key === 'cliente' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                        >
                          Cliente{listaSort.key === 'cliente' ? (listaSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[12%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setListaSort((s) => ({ key: 'status', dir: s.key === 'status' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                        >
                          Status{listaSort.key === 'status' ? (listaSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[12%]">
                        <button
                          className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setListaSort((s) => ({ key: 'vlr_merc', dir: s.key === 'vlr_merc' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Vlr Mercadoria{listaSort.key === 'vlr_merc' ? (listaSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[8%]">
                        <button
                          className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setListaSort((s) => ({ key: 'peso', dir: s.key === 'peso' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Peso{listaSort.key === 'peso' ? (listaSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[12%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setListaSort((s) => ({ key: 'limite', dir: s.key === 'limite' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Limite{listaSort.key === 'limite' ? (listaSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[12%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setListaSort((s) => ({ key: 'efetivacao', dir: s.key === 'efetivacao' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Efetivação{listaSort.key === 'efetivacao' ? (listaSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {listaPageRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-slate-400 dark:text-slate-500">
                          Nenhuma coleta neste grupo.
                        </td>
                      </tr>
                    ) : (
                      listaPageRows.map((r) => {
                        const badge = SITUACAO_BADGE[String(r.situacao ?? '').toUpperCase()] ?? { label: String(r.situacao ?? '—'), className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' };
                        const limite = `${fmtDateShort(r.data_limite)}${fmtTimeHHMM(r.hora_limite) ? ' ' + fmtTimeHHMM(r.hora_limite) : ''}`;
                        const inclusao = `${fmtDateShort(r.data_inclusao)}${fmtTimeHHMM(r.hora_inclusao) ? ' ' + fmtTimeHHMM(r.hora_inclusao) : ''}`;
                        const efet = r.data_efetivacao ? `${fmtDateShort(r.data_efetivacao)}${fmtTimeHHMM(r.hora_efetivacao) ? ' ' + fmtTimeHHMM(r.hora_efetivacao) : ''}` : '—';

                        return (
                          <tr key={`${r.unidade}-${r.nro_coleta}-${r.data_limite}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-3 py-2 align-top">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">{r.nro_coleta}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{inclusao}</div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="text-slate-900 dark:text-slate-100 truncate">{r.nome_emit || '—'}</div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>{badge.label}</span>
                            </td>
                            <td className="px-3 py-2 text-right align-top tabular-nums text-slate-900 dark:text-slate-100">{fmtBRL(r.vlr_merc)}</td>
                            <td className="px-3 py-2 text-right align-top tabular-nums text-slate-900 dark:text-slate-100">{fmtKg(r.peso)}</td>
                            <td className="px-3 py-2 align-top">
                              <div className="text-slate-900 dark:text-slate-100">{limite}</div>
                            </td>
                            <td className="px-3 py-2 align-top">
                              <div className="text-slate-900 dark:text-slate-100">{efet}</div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Página {listaSafePage} de {listaTotalPages} · {listaSortedRows.length} registro{listaSortedRows.length !== 1 ? 's' : ''}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 dark:border-slate-700"
                    onClick={() => setListaPage(1)}
                    disabled={listaSafePage <= 1}
                  >
                    «
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 dark:border-slate-700"
                    onClick={() => setListaPage((p) => Math.max(1, p - 1))}
                    disabled={listaSafePage <= 1}
                  >
                    ‹
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 dark:border-slate-700"
                    onClick={() => setListaPage((p) => Math.min(listaTotalPages, p + 1))}
                    disabled={listaSafePage >= listaTotalPages}
                  >
                    ›
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 dark:border-slate-700"
                    onClick={() => setListaPage(listaTotalPages)}
                    disabled={listaSafePage >= listaTotalPages}
                  >
                    »
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
