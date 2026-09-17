import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';
import { 
  mockGetPerformanceCards, 
  mockGetPerformanceEvolucao, 
  mockGetPerformanceComparativo,
  mockGetAnaliseDiaria
} from '../../mocks/mockData';
import { 
  getPerformanceCards,
  getPerformanceEvolucao,
  getPerformanceComparativo,
  getAnaliseDiaria,
  DayData,
  PerformanceFilters as ServiceFilters
} from '../../services/performanceEntregasService';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { apiFetch } from '../../utils/apiUtils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { 
  CheckCircle, 
  AlertCircle, 
  Clock,
  Filter,
  X,
  Check,
  ThumbsDown,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Calendar,
  TrendingUp,
  Building2,
  CircleHelp
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ENVIRONMENT } from '../../config/environment';
import { FilterSelectCliente } from './FilterSelectCliente';
import { AnaliseDiaria } from './AnaliseDiaria';
import { UnidadesMultiSelect } from '../admin/UnidadesMultiSelect';

interface Filters {
  periodoEmissaoInicio: string;
  periodoEmissaoFim: string;
  periodoPrevisaoInicio: string;
  periodoPrevisaoFim: string;
  unidadeDestino: string[]; // ✅ MUDOU: Array de strings
  cnpjPagador: string;
  cnpjDestinatario: string;
}

interface DeliveryGroup {
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

interface UnitPerformance {
  unidade: string;
  sigla: string;
  total: number;
  entreguesNoPrazo: number;
  entreguesEmAtraso: number;
  pendentesNoPrazo: number;
  pendentesEmAtraso: number;
  performance: number;
}

interface DrillCteRow {
  unid_atual: string;
  ser_cte: string;
  nro_cte: string;
  prev: string;
  entrega: string;
  atraso: number;
  ult_ocor: string;
  data_ult_ocor: string;
  vlr_merc: number;
  vlr_frete: number;
  peso_real: number;
}

// Função para obter primeiro e último dia do mês anterior
function getLastMonthPeriod() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const firstDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
  const lastDay = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
  
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    inicio: formatDate(firstDay),
    fim: formatDate(lastDay)
  };
}

// Função para formatar período para exibição
function formatPeriodDisplay(inicio: string, fim: string): string {
  if (!inicio && !fim) return '';
  
  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    return {
      year: parseInt(parts[0]),
      month: parseInt(parts[1]),
      day: parseInt(parts[2])
    };
  };
  
  const start = parseDate(inicio);
  const end = parseDate(fim);
  
  if (!start || !end) return '';
  
  // Mesmo mês e ano
  if (start.month === end.month && start.year === end.year) {
    return `${MONTHS[start.month - 1]} ${start.year}`;
  }
  
  // Mesmo ano
  if (start.year === end.year) {
    return `${MONTHS[start.month - 1]} - ${MONTHS[end.month - 1]} ${start.year}`;
  }
  
  // Anos diferentes
  return `${MONTHS[start.month - 1]} ${start.year} - ${MONTHS[end.month - 1]} ${end.year}`;
}

export function PerformanceEntregas() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const unidadeAtual = (user?.unidade_atual || user?.unidade || '').toUpperCase();
  const isMTZ = unidadeAtual === 'MTZ';
  
  const defaultPeriod = getLastMonthPeriod();
  const [filters, setFilters] = useState<Filters>({
    periodoEmissaoInicio: defaultPeriod.inicio,
    periodoEmissaoFim: defaultPeriod.fim,
    periodoPrevisaoInicio: '',
    periodoPrevisaoFim: '',
    unidadeDestino: (!isMTZ && unidadeAtual) ? [unidadeAtual] : [],
    cnpjPagador: '',
    cnpjDestinatario: '',
  });
  
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [deliveryGroups, setDeliveryGroups] = useState<DeliveryGroup[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [unitPerformances, setUnitPerformances] = useState<UnitPerformance[]>([]);
  const [clickedChartData, setClickedChartData] = useState<any>(null);
  
  // ✅ NOVO: Estados para ordenação da tabela de comparativo
  const [sortColumn, setSortColumn] = useState<keyof UnitPerformance>('performance');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // ✅ NOVO: Estados para Análise Diária
  const [analisePeriodo, setAnalisePeriodo] = useState<15 | 30 | 45>(15);
  const [diasData, setDiasData] = useState<DayData[]>([]);
  const [loadingAnalise, setLoadingAnalise] = useState(false);

  // ✅ NOVO: Estados para Evolução da Performance
  const [evolucaoPeriodo, setEvolucaoPeriodo] = useState<7 | 15 | 30>(30);
  const [loadingEvolucao, setLoadingEvolucao] = useState(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRows, setDrillRows] = useState<DrillCteRow[]>([]);
  const [drillTotals, setDrillTotals] = useState<{ count: number; vlr_merc: number; vlr_frete: number; peso_real: number }>({ count: 0, vlr_merc: 0, vlr_frete: 0, peso_real: 0 });
  const [drillReq, setDrillReq] = useState<any>(null);
  const [drillSort, setDrillSort] = useState<{ key: 'unid' | 'cte' | 'prev' | 'entrega' | 'atraso' | 'ult_ocor' | 'vlr_merc' | 'vlr_frete' | 'peso_real'; dir: 'asc' | 'desc' }>({ key: 'atraso', dir: 'desc' });
  const [drillPage, setDrillPage] = useState(1);
  const drillPageSize = 100;

  usePageTitle('Performance de Entregas');

  const fmtCte = (ser: string, nro: string) => `${String(ser ?? '').trim()} ${String(nro ?? '').trim()}`.trim();

  const fmtBRL = (v: any) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const fmtKg = (v: any) => {
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isNaN(n)) return '—';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' kg';
  };

  const fmtDateISOToBR2y = (iso?: string) => {
    const s = String(iso ?? '').trim();
    if (!s) return '';
    const parts = s.split('-');
    if (parts.length < 3) return s;
    const [y, m, d] = parts;
    return `${d}/${m}/${String(y).slice(-2)}`;
  };

  const parseDateBR2y = (br?: string) => {
    const s = String(br ?? '').trim();
    if (!s) return null;
    const parts = s.split('/');
    if (parts.length < 3) return null;
    const [dd, mm, yy] = parts;
    const day = Number(dd);
    const month = Number(mm);
    const year = yy.length === 2 ? Number(`20${yy}`) : Number(yy);
    if (!day || !month || !year) return null;
    return new Date(year, month - 1, day).getTime();
  };

  const toggleDrillSort = (key: typeof drillSort.key, defaultDir: 'asc' | 'desc' = 'asc') => {
    setDrillSort((s) => ({
      key,
      dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : defaultDir
    }));
  };

  const drillSortedRows = useMemo(() => {
    const rows = [...drillRows];
    rows.sort((a, b) => {
      const dir = drillSort.dir === 'asc' ? 1 : -1;
      const key = drillSort.key;

      const cmpNum = (aa: any, bb: any) => {
        const na = typeof aa === 'number' ? aa : Number(aa);
        const nb = typeof bb === 'number' ? bb : Number(bb);
        if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
        if (Number.isNaN(na)) return 1;
        if (Number.isNaN(nb)) return -1;
        return na === nb ? 0 : na > nb ? 1 : -1;
      };

      const cmpStr = (aa: any, bb: any) => String(aa ?? '').localeCompare(String(bb ?? ''), 'pt-BR', { sensitivity: 'base' });

      let c = 0;
      if (key === 'unid') c = cmpStr(a.unid_atual, b.unid_atual);
      else if (key === 'cte') c = cmpStr(fmtCte(a.ser_cte, a.nro_cte), fmtCte(b.ser_cte, b.nro_cte));
      else if (key === 'prev') c = cmpNum(parseDateBR2y(a.prev) ?? Infinity, parseDateBR2y(b.prev) ?? Infinity);
      else if (key === 'entrega') c = cmpNum(parseDateBR2y(a.entrega) ?? Infinity, parseDateBR2y(b.entrega) ?? Infinity);
      else if (key === 'atraso') c = cmpNum(a.atraso, b.atraso);
      else if (key === 'ult_ocor') c = cmpStr(a.ult_ocor, b.ult_ocor);
      else if (key === 'vlr_merc') c = cmpNum(a.vlr_merc, b.vlr_merc);
      else if (key === 'vlr_frete') c = cmpNum(a.vlr_frete, b.vlr_frete);
      else if (key === 'peso_real') c = cmpNum(a.peso_real, b.peso_real);
      return c * dir;
    });
    return rows;
  }, [drillRows, drillSort, fmtCte]);

  const drillTotalPages = useMemo(() => Math.max(1, Math.ceil(drillSortedRows.length / drillPageSize)), [drillSortedRows.length, drillPageSize]);
  const drillSafePage = useMemo(() => Math.min(Math.max(1, drillPage), drillTotalPages), [drillPage, drillTotalPages]);
  const drillPageRows = useMemo(() => {
    const start = (drillSafePage - 1) * drillPageSize;
    return drillSortedRows.slice(start, start + drillPageSize);
  }, [drillSortedRows, drillSafePage, drillPageSize]);

  useEffect(() => {
    setDrillPage((p) => Math.min(Math.max(1, p), drillTotalPages));
  }, [drillTotalPages]);

  const buildReqBase = () => {
    const body: any = {
      periodoEmissaoInicio: filters.periodoEmissaoInicio,
      periodoEmissaoFim: filters.periodoEmissaoFim,
    };
    if (filters.periodoPrevisaoInicio) body.periodoPrevisaoInicio = filters.periodoPrevisaoInicio;
    if (filters.periodoPrevisaoFim) body.periodoPrevisaoFim = filters.periodoPrevisaoFim;
    if (filters.unidadeDestino.length > 0) body.unidadeDestino = filters.unidadeDestino;
    if (filters.cnpjPagador) body.cnpjPagador = filters.cnpjPagador;
    if (filters.cnpjDestinatario) body.cnpjDestinatario = filters.cnpjDestinatario;
    return body;
  };

  const carregarLista = async (req: any) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/get_ctes.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...buildReqBase(), ...req })
      });

      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'Erro ao buscar CT-es');
      }
      setDrillRows(Array.isArray(data?.data?.rows) ? data.data.rows : []);
      setDrillTotals(data?.data?.totals ?? { count: 0, vlr_merc: 0, vlr_frete: 0, peso_real: 0 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao buscar CT-es';
      toast.error(msg);
      setDrillRows([]);
      setDrillTotals({ count: 0, vlr_merc: 0, vlr_frete: 0, peso_real: 0 });
    }
  };

  const abrirLista = async (title: string, req: any) => {
    setDrillTitle(title);
    setDrillReq(req);
    setDrillSort({ key: 'atraso', dir: 'desc' });
    setDrillPage(1);
    setDrillOpen(true);
    await carregarLista(req);
  };

  const exportarListaCSV = async () => {
    if (!drillReq) return;
    const loadingToastId = toast.info('Gerando planilha...', { description: 'Aguarde enquanto preparamos os dados.', duration: Infinity });
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/export.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ...buildReqBase(), ...drillReq })
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        toast.dismiss(loadingToastId);
        if (data?.toast?.message) {
          const t = data.toast.type || 'info';
          if (t === 'error') toast.error(data.toast.message);
          else if (t === 'warning') toast.warning(data.toast.message);
          else toast.info(data.toast.message);
          return;
        }
        if (data?.error || data?.success === false) {
          toast.error('Erro ao gerar planilha', { description: data?.error || 'Erro desconhecido' });
          return;
        }
        return;
      }

      if (!response.ok) throw new Error('Erro ao gerar planilha');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      let filename = 'performance_entregas.csv';
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=\"?(.+)\"?/i);
        if (filenameMatch && filenameMatch[1]) filename = filenameMatch[1].replace(/\"/g, '');
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.dismiss(loadingToastId);
    } catch (e) {
      toast.dismiss(loadingToastId);
      toast.error('Erro ao gerar planilha', { description: 'Não foi possível gerar a planilha. Tente novamente.' });
    }
  };

  const handleExportCard = async (statusEntrega: string, label: string) => {
    await abrirLista(label, { statusEntrega });
  };

  const handleExportEvolucao = async (dataStr: string) => {
    const [day, month] = dataStr.split('/');
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const mesClicado = parseInt(month, 10);
    const year = mesClicado > mesAtual ? anoAtual - 1 : anoAtual;
    const dataPrevisao = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    await abrirLista(`Previsão ${dataStr}`, { dataPrevisao });
  };

  const handleExportComparativo = async (unidade: string, coluna: string, label: string) => {
    await abrirLista(`${unidade} · ${label}`, { unidade, coluna });
  };

  // ✅ FUNÇÃO: Manipular ordenação da tabela
  const handleSort = (column: keyof UnitPerformance) => {
    if (sortColumn === column) {
      // Se já está ordenando por essa coluna, inverte a direção
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Se é uma nova coluna, define ela como coluna de ordenação com direção padrão
      setSortColumn(column);
      setSortDirection(column === 'performance' ? 'desc' : 'asc'); // Performance padrão desc, outros asc
    }
  };

  // ✅ FUNÇÃO: Obter dados ordenados
  const getSortedUnits = () => {
    const sorted = [...unitPerformances].sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      // Tratamento especial para strings (sigla e unidade)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      // Tratamento para números
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      return 0;
    });
    
    return sorted;
  };

  // ✅ FUNÇÃO: Renderizar ícone de ordenação
  const renderSortIcon = (column: keyof UnitPerformance) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-40" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 inline" /> 
      : <ArrowDown className="w-3 h-3 ml-1 inline" />;
  };

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
      const storedDomain = localStorage.getItem('presto_domain');
      const isAceville = storedDomain === 'ACV';
      const loginPath = isAceville ? '/login-aceville' : '/login';
      navigate(loginPath, { replace: true });
    }
  };

  // ✅ useEffect: Carregar dados ao montar o componente ou quando user.use_mock_data muda
  useEffect(() => {
    const useMock = user?.use_mock_data ?? true;
    
    if (useMock) {
      loadMockData();
    } else {
      loadBackendData();
    }
  }, [user?.use_mock_data]);

  // ✅ useEffect: Recarregar dados quando os filtros mudarem
  useEffect(() => {
    // Não executar no primeiro render (já executado pelo useEffect anterior)
    if (deliveryGroups.length > 0 || performanceData.length > 0 || unitPerformances.length > 0) {
      const useMock = user?.use_mock_data ?? true;
      
      if (useMock) {
        loadMockData();
      } else {
        loadBackendData();
      }
    }
  }, [filters]);

  // ✅ useEffect: Carregar dados da Análise Diária quando período ou filtros mudarem
  useEffect(() => {
    loadAnaliseDiaria();
  }, [analisePeriodo, filters.unidadeDestino, filters.cnpjPagador, filters.cnpjDestinatario, user?.use_mock_data]);

  // ✅ useEffect: Carregar dados da Evolução da Performance quando o período ou filtros mudarem
  useEffect(() => {
    loadEvolucao();
  }, [evolucaoPeriodo, filters, user?.use_mock_data]);

  const loadAnaliseDiaria = async () => {
    setLoadingAnalise(true);
    try {
      const useMock = user?.use_mock_data ?? true;
      let result;
      
      const analiseFilters = {
        unidadeDestino: filters.unidadeDestino,
        cnpjPagador: filters.cnpjPagador,
        cnpjDestinatario: filters.cnpjDestinatario
      };
      
      if (useMock) {
        result = await mockGetAnaliseDiaria(analisePeriodo);
      } else {
        result = await getAnaliseDiaria(analisePeriodo, analiseFilters);
      }
      
      setDiasData(result.data?.diasData || result.diasData || []);
    } catch (error) {
      setDiasData([]);
    } finally {
      setLoadingAnalise(false);
    }
  };

  const loadEvolucao = async () => {
    setLoadingEvolucao(true);
    try {
      const useMock = user?.use_mock_data ?? true;
      
      if (useMock) {
        const evolucaoResponse = await mockGetPerformanceEvolucao(filters, evolucaoPeriodo);
        if (evolucaoResponse.success && evolucaoResponse.data.performanceData) {
          setPerformanceData(evolucaoResponse.data.performanceData);
        } else {
          setPerformanceData([]);
        }
      } else {
        const evolucaoData = await getPerformanceEvolucao(filters as ServiceFilters, evolucaoPeriodo);
        setPerformanceData(evolucaoData.performanceData || []);
      }
    } catch (error) {
      setPerformanceData([]);
    } finally {
      setLoadingEvolucao(false);
    }
  };

  const handleExportEntregasDia = async (data: string) => {
    await abrirLista(`Entregas · ${fmtDateISOToBR2y(data) || data}`, { tipo: 'entregas_dia', data });
  };

  const handleExportPrevistosDia = async (data: string) => {
    await abrirLista(`Previstos · ${fmtDateISOToBR2y(data) || data}`, { tipo: 'previstos_dia', data });
  };

  const handleExportEntreguesDia = async (data: string) => {
    await abrirLista(`No prazo · ${fmtDateISOToBR2y(data) || data}`, { statusEntrega: 'prazo_total', dataPrevisao: data });
  };

  const handleExportAtrasadasDia = async (data: string) => {
    await abrirLista(`Atrasadas · ${fmtDateISOToBR2y(data) || data}`, { tipo: 'atrasadas_dia', data });
  };

  const loadMockData = async () => {
    setLoading(true);
    try {
      const cardsResponse = await mockGetPerformanceCards(filters);
      if (cardsResponse.success && cardsResponse.data.deliveryGroups) {
        setDeliveryGroups(cardsResponse.data.deliveryGroups);
      } else {
        setDeliveryGroups([]);
      }

      const evolucaoResponse = await mockGetPerformanceEvolucao(filters, evolucaoPeriodo);
      if (evolucaoResponse.success && evolucaoResponse.data.performanceData) {
        setPerformanceData(evolucaoResponse.data.performanceData);
      } else {
        setPerformanceData([]);
      }

      const comparativoResponse = await mockGetPerformanceComparativo(filters);
      if (comparativoResponse.success && comparativoResponse.data.unitPerformances) {
        setUnitPerformances(comparativoResponse.data.unitPerformances);
      } else {
        setUnitPerformances([]);
      }
    } catch (error) {
      toast.error('Erro ao carregar dados do dashboard');
      // Garantir que os estados sejam arrays vazios em caso de erro
      setDeliveryGroups([]);
      setPerformanceData([]);
      setUnitPerformances([]);
    } finally {
      setLoading(false);
    }
  };

  const loadBackendData = async () => {
    setLoading(true);
    try {
      const cardsData = await getPerformanceCards(filters as ServiceFilters);
      setDeliveryGroups(cardsData.deliveryGroups || []);

      const evolucaoData = await getPerformanceEvolucao(filters as ServiceFilters, evolucaoPeriodo);
      setPerformanceData(evolucaoData.performanceData || []);

      const comparativoData = await getPerformanceComparativo(filters as ServiceFilters);
      setUnitPerformances(comparativoData.unitPerformances || []);
    } catch (error) {
      toast.error('Erro ao carregar dados do dashboard');
      // Garantir que os estados sejam arrays vazios em caso de erro
      setDeliveryGroups([]);
      setPerformanceData([]);
      setUnitPerformances([]);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    // Validar que pelo menos um período está preenchido
    const hasEmissao = tempFilters.periodoEmissaoInicio || tempFilters.periodoEmissaoFim;
    const hasPrevisao = tempFilters.periodoPrevisaoInicio || tempFilters.periodoPrevisaoFim;
    
    if (!hasEmissao && !hasPrevisao) {
      toast.error('É obrigatório preencher pelo menos um período (Emissão ou Previsão de Entrega)');
      return;
    }

    const next = (!isMTZ && unidadeAtual) ? { ...tempFilters, unidadeDestino: [unidadeAtual] } : tempFilters;
    setFilters(next);
    setTempFilters(next);
    setShowFilters(false);
  };

  const cancelFilters = () => {
    if (!isMTZ && unidadeAtual) setTempFilters({ ...filters, unidadeDestino: [unidadeAtual] });
    else setTempFilters({ ...filters });
    setShowFilters(false);
  };

  const clearFilters = () => {
    const lastMonth = getLastMonthPeriod();
    const emptyFilters = {
      periodoEmissaoInicio: lastMonth.inicio,
      periodoEmissaoFim: lastMonth.fim,
      periodoPrevisaoInicio: '',
      periodoPrevisaoFim: '',
      unidadeDestino: (!isMTZ && unidadeAtual) ? [unidadeAtual] : [],
      cnpjPagador: '',
      cnpjDestinatario: '',
    };
    setTempFilters(emptyFilters);
  };

  useEffect(() => {
    if (!unidadeAtual || isMTZ) return;
    setFilters(prev => {
      if (prev.unidadeDestino.length === 1 && prev.unidadeDestino[0] === unidadeAtual) return prev;
      return { ...prev, unidadeDestino: [unidadeAtual] };
    });
    setTempFilters(prev => {
      if (prev.unidadeDestino.length === 1 && prev.unidadeDestino[0] === unidadeAtual) return prev;
      return { ...prev, unidadeDestino: [unidadeAtual] };
    });
  }, [unidadeAtual, isMTZ]);

  // Determinar qual período exibir
  const getPeriodDisplay = () => {
    if (filters.periodoEmissaoInicio && filters.periodoEmissaoFim) {
      return formatPeriodDisplay(filters.periodoEmissaoInicio, filters.periodoEmissaoFim);
    }
    if (filters.periodoPrevisaoInicio && filters.periodoPrevisaoFim) {
      return formatPeriodDisplay(filters.periodoPrevisaoInicio, filters.periodoPrevisaoFim);
    }
    return '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
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
              <DialogContent className="sm:max-w-[700px] bg-white dark:bg-slate-900 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros de Pesquisa</DialogTitle>
                  <DialogDescription className="text-slate-600 dark:text-slate-400">
                    Personalize a visualização filtrando por período, unidade e empresas
                  </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
                  <div className="space-y-6 py-4">
                  {/* Períodos */}
                  <div className="space-y-4">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Emissão</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={tempFilters.periodoEmissaoInicio}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodoEmissaoInicio: e.target.value })}
                            className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!tempFilters.periodoEmissaoInicio}
                            onClick={() => setTempFilters({ ...tempFilters, periodoEmissaoInicio: '' })}
                            className="dark:hover:bg-slate-800"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={tempFilters.periodoEmissaoFim}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodoEmissaoFim: e.target.value })}
                            className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!tempFilters.periodoEmissaoFim}
                            onClick={() => setTempFilters({ ...tempFilters, periodoEmissaoFim: '' })}
                            className="dark:hover:bg-slate-800"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Previsão de Entrega</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={tempFilters.periodoPrevisaoInicio}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodoPrevisaoInicio: e.target.value })}
                            className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!tempFilters.periodoPrevisaoInicio}
                            onClick={() => setTempFilters({ ...tempFilters, periodoPrevisaoInicio: '' })}
                            className="dark:hover:bg-slate-800"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={tempFilters.periodoPrevisaoFim}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodoPrevisaoFim: e.target.value })}
                            className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!tempFilters.periodoPrevisaoFim}
                            onClick={() => setTempFilters({ ...tempFilters, periodoPrevisaoFim: '' })}
                            className="dark:hover:bg-slate-800"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Unidade, Pagador e Destinatário */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
                    <UnidadesMultiSelect
                      value={tempFilters.unidadeDestino}
                      onChange={(value) => { if (isMTZ) setTempFilters({ ...tempFilters, unidadeDestino: value }); }}
                      domain={user?.domain}
                      label="Unidade(s) Destino"
                      disabled={!isMTZ}
                      emptyHint={<><strong>Nenhuma unidade selecionada</strong> = sem filtro (todas as unidades)</>}
                    />

                    <div className="space-y-2">
                      <Label className="text-slate-900 dark:text-slate-100">Pagador</Label>
                      <FilterSelectCliente
                        type="pagador"
                        value={tempFilters.cnpjPagador}
                        onChange={(value) => setTempFilters({...tempFilters, cnpjPagador: value})}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-900 dark:text-slate-100">Destinatário</Label>
                      <FilterSelectCliente
                        type="destinatario"
                        value={tempFilters.cnpjDestinatario}
                        onChange={(value) => setTempFilters({...tempFilters, cnpjDestinatario: value})}
                      />
                    </div>
                  </div>
                  </div>
                </div>

                <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Limpar Tudo
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={cancelFilters}
                      className="dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={applyFilters}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Aplicar Filtros
                    </Button>
                  </div>
                </div>
              </DialogContent>
      </Dialog>
    </div>
  );

  const noPrazoCount = (deliveryGroups[0]?.count ?? 0) + (deliveryGroups[2]?.count ?? 0);
  const totalResumo = deliveryGroups.reduce((acc, g) => acc + (g?.count ?? 0), 0);
  const noPrazoPct = totalResumo > 0 ? (noPrazoCount / totalResumo) * 100 : 0;

  return (
    <DashboardLayout 
      title="Performance de Entregas"
      description={user?.client_name}
      headerActions={headerActions}
    >
      {/* Conteúdo */}
      <main className="container mx-auto px-3 md:px-6 py-6 space-y-6">
        {/* Título e Subtítulo */}
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Análise de Performance de Entregas</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Acompanhamento do cumprimento de prazos e performance das entregas por período
          </p>
        </div>

        {/* Cards de Grupos com Donuts */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm text-green-700 dark:text-green-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Performance
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 gap-1 px-2"
                  onClick={() => handleExportCard('prazo_total', 'Performance')}
                  title="Exportar Performance"
                  disabled={noPrazoCount === 0}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="text-xs font-medium">CSV</span>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {noPrazoPct.toFixed(1)}%
                  </div>
                  <p className="text-sm mt-1 text-green-700 dark:text-green-300">
                    {noPrazoCount} CT-e{noPrazoCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <div style={{ width: 80, height: 80 }}>
                  <PieChart width={80} height={80}>
                    <Pie
                      data={[
                        { name: 'value', value: noPrazoPct },
                        { name: 'empty', value: 100 - noPrazoPct }
                      ]}
                      cx={40}
                      cy={40}
                      innerRadius={20}
                      outerRadius={35}
                      startAngle={90}
                      endAngle={-270}
                      dataKey="value"
                      stroke="none"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill={theme === 'dark' ? '#064e3b' : '#dcfce7'} />
                    </Pie>
                  </PieChart>
                </div>
              </div>
            </CardContent>
          </Card>
          {deliveryGroups.map((group, index) => {
            const donutData = [
              { name: 'value', value: group.percentage },
              { name: 'empty', value: 100 - group.percentage }
            ];
            
            // ✅ Mapear status para chamada da API
            const statusMap = [
              'entregue_no_prazo',
              'entregue_em_atraso',
              'pendente_no_prazo',
              'pendente_em_atraso'
            ];
            
            return (
              <Card key={index} className={group.bgColor}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm ${group.color} flex items-center gap-2`}>
                      {index === 0 && <CheckCircle className="w-4 h-4" />}
                      {index === 1 && <AlertCircle className="w-4 h-4" />}
                      {index === 2 && <Clock className="w-4 h-4" />}
                      {index === 3 && <ThumbsDown className="w-4 h-4" />}
                      {group.label}
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 ${group.color} ${group.hoverColor} gap-1 px-2`}
                      onClick={() => handleExportCard(statusMap[index], group.label)}
                      title={`Exportar ${group.label}`}
                      disabled={group.count === 0}
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
                        {group.percentage.toFixed(1)}%
                      </div>
                      <p className={`text-sm mt-1 ${group.color}`}>
                        {group.count} CT-e{group.count !== 1 ? 's' : ''}
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
                        >
                          <Cell fill={group.chartColor} />
                          <Cell fill={theme === 'dark' ? group.emptyColorDark : group.emptyColor} />
                        </Pie>
                      </PieChart>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ✅ SEÇÃO: Comparativo por Unidade Entregadora */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="dark:text-slate-100 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Comparativo por Unidade Entregadora
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Análise de performance por unidade responsável pela entrega
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              Clique sobre os totais para imprimir os conhecimentos
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
                      onClick={() => handleSort('total')}
                    >
                      Qtde CT-e{renderSortIcon('total')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('entreguesNoPrazo')}
                    >
                      Entr. no Prazo{renderSortIcon('entreguesNoPrazo')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('entreguesEmAtraso')}
                    >
                      Entr. em Atraso{renderSortIcon('entreguesEmAtraso')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('pendentesNoPrazo')}
                    >
                      Pend. no Prazo{renderSortIcon('pendentesNoPrazo')}
                    </th>
                    <th 
                      className="text-right py-3 px-2 text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort('pendentesEmAtraso')}
                    >
                      Pend. em Atraso{renderSortIcon('pendentesEmAtraso')}
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
                              {unit.unidade.substring(0, 15)}{unit.unidade.length > 15 ? '...' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right dark:text-slate-300">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'total', 'Total CT-es')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.total === 0}
                          >
                            {unit.total}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-green-600 dark:text-green-400">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'entregues_no_prazo', 'Entregues no Prazo')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.entreguesNoPrazo === 0}
                          >
                            {unit.entreguesNoPrazo}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-yellow-600 dark:text-yellow-400">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'entregues_em_atraso', 'Entregues em Atraso')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.entreguesEmAtraso === 0}
                          >
                            {unit.entreguesEmAtraso}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-blue-600 dark:text-blue-400">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'pendentes_no_prazo', 'Pendentes no Prazo')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.pendentesNoPrazo === 0}
                          >
                            {unit.pendentesNoPrazo}
                          </button>
                        </td>
                        <td className="py-3 px-2 text-right text-red-600 dark:text-red-400">
                          <button
                            onClick={() => handleExportComparativo(unit.sigla, 'pendentes_em_atraso', 'Pendentes em Atraso')}
                            className="hover:underline cursor-pointer"
                            disabled={unit.pendentesEmAtraso === 0}
                          >
                            {unit.pendentesEmAtraso}
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
                      {unitPerformances.reduce((acc, u) => acc + u.total, 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-green-600 dark:text-green-400">
                      {unitPerformances.reduce((acc, u) => acc + u.entreguesNoPrazo, 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-yellow-600 dark:text-yellow-400">
                      {unitPerformances.reduce((acc, u) => acc + u.entreguesEmAtraso, 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-blue-600 dark:text-blue-400">
                      {unitPerformances.reduce((acc, u) => acc + u.pendentesNoPrazo, 0)}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-red-600 dark:text-red-400">
                      {unitPerformances.reduce((acc, u) => acc + u.pendentesEmAtraso, 0)}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-300 dark:bg-slate-600 rounded-full h-6 overflow-hidden">
                          {(() => {
                            const totalCtes = unitPerformances.reduce((acc, u) => acc + u.total, 0) || 1;
                            const totalNoPrazo = unitPerformances.reduce((acc, u) => acc + u.entreguesNoPrazo + u.pendentesNoPrazo, 0);
                            const performanceGeral = (totalNoPrazo / totalCtes) * 100;
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
                                  <span className="text-xs text-white font-bold">{performanceGeral.toFixed(1)}%</span>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        {(() => {
                          const totalCtes = unitPerformances.reduce((acc, u) => acc + u.total, 0) || 1;
                          const totalNoPrazo = unitPerformances.reduce((acc, u) => acc + u.entreguesNoPrazo + u.pendentesNoPrazo, 0);
                          const performanceGeral = (totalNoPrazo / totalCtes) * 100;
                          
                          if (performanceGeral < 15) {
                            return (
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-bold min-w-[45px]">
                                {performanceGeral.toFixed(1)}%
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ✅ SEÇÃO: Análise Diária */}
        <AnaliseDiaria
          analisePeriodo={analisePeriodo}
          setAnalisePeriodo={setAnalisePeriodo}
          diasData={diasData}
          loadingAnalise={loadingAnalise}
          handleExportEntregasDia={handleExportEntregasDia}
          handleExportPrevistosDia={handleExportPrevistosDia}
          handleExportEntreguesDia={handleExportEntreguesDia}
          handleExportAtrasadasDia={handleExportAtrasadasDia}
        />

        {/* ✅ SEÇÃO: Evolução da Performance */}
        <Card className="dark:bg-slate-900 dark:border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="dark:text-slate-100 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Evolução da Performance
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
                          Informações sobre como a seção Evolução da Performance funciona, incluindo filtros aplicados e cálculo de performance
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                            ⚠️ Importante sobre os Filtros
                          </p>
                          <p>
                            Esta seção <strong>DESCONSIDERA os períodos informados no filtro</strong>, mas respeita os outros filtros (Unidade de Destino, CNPJ Pagador e CNPJ Destinatário).
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
                            📊 Como funciona o cálculo
                          </p>
                          
                          <div className="pl-3 space-y-2">
                            <div>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">1. Previstos do dia</span>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                Para cada dia, o sistema busca o número de conhecimentos previstos para aquela data de entrega.
                              </p>
                            </div>
                            
                            <div>
                              <span className="font-semibold text-green-600 dark:text-green-400">2. No prazo</span>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                Destes previstos, o sistema verifica quantos estão no prazo (entregues no prazo ou ainda pendentes dentro do prazo).
                              </p>
                            </div>
                            
                            <div>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">3. Performance</span>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                A performance é calculada como o percentual que os conhecimentos no prazo representam do total de previstos: <strong>(No prazo / Previstos) × 100</strong>.
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                          <p className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-1">
                            <FileSpreadsheet className="w-4 h-4" />
                            Exportação de Dados
                          </p>
                          <p className="text-xs">
                            Para imprimir os CTRCs previstos para o dia, clique sobre o ponto do dia no gráfico.
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
                
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Percentual de entregas no prazo (entregues + pendentes) por dia - clique em um ponto do gráfico para listar CT-es com aquela previsão de entrega
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                  <FileSpreadsheet className="w-3 h-3" />
                  Clique sobre os dias para imprimir os conhecimentos
                </p>
              </div>
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
              <div className="flex items-center justify-center h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart 
                  data={performanceData}
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
                  tick={{ fontSize: 12, fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke={theme === 'dark' ? '#475569' : '#cbd5e1'}
                />
                <YAxis 
                  label={{ 
                    value: 'Performance (%)', 
                    angle: -90, 
                    position: 'insideLeft',
                    style: { fill: theme === 'dark' ? '#94a3b8' : '#64748b' }
                  }}
                  domain={[0, 100]}
                  tick={{ fill: theme === 'dark' ? '#94a3b8' : '#64748b' }}
                  stroke={theme === 'dark' ? '#475569' : '#cbd5e1'}
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
                            Previstos: {data.previstos} | No Prazo: {data.noPrazo}
                          </p>
                          <p className="text-xs text-blue-500 dark:text-blue-300 mt-2 flex items-center gap-1">
                            <FileSpreadsheet className="w-3 h-3" />
                            Clique para listar CT-es
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend wrapperStyle={{ color: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                <Line 
                  type="monotone" 
                  dataKey="performance" 
                  stroke="#2563eb" 
                  strokeWidth={2}
                  name="Performance (%)"
                  dot={{ fill: '#2563eb', r: 3, cursor: 'pointer' }}
                  activeDot={{ r: 6, cursor: 'pointer' }}
                  cursor="pointer"
                />
              </LineChart>
            </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-7xl h-[85vh] flex flex-col overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="shrink-0 pr-16">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-slate-900 dark:text-slate-100 truncate">{drillTitle || 'CT-es'}</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">Lista de CT-es que compõem o indicador.</DialogDescription>
              </div>
              {drillRows.length > 0 && (
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
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[6%]">
                        <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('unid', 'asc')}>
                          Unid.{drillSort.key === 'unid' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[12%]">
                        <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('cte', 'asc')}>
                          CT-e{drillSort.key === 'cte' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[9%]">
                        <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('prev', 'desc')}>
                          Prev.{drillSort.key === 'prev' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[9%]">
                        <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('entrega', 'desc')}>
                          Entrega{drillSort.key === 'entrega' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[6%]">
                        <button className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('atraso', 'desc')}>
                          Atr.{drillSort.key === 'atraso' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[30%]">
                        <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('ult_ocor', 'asc')}>
                          Últ. ocor.{drillSort.key === 'ult_ocor' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[12%]">
                        <button className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('vlr_merc', 'desc')}>
                          Vlr Merc.{drillSort.key === 'vlr_merc' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[12%]">
                        <button className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('vlr_frete', 'desc')}>
                          Frete{drillSort.key === 'vlr_frete' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[8%]">
                        <button className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => toggleDrillSort('peso_real', 'desc')}>
                          Peso{drillSort.key === 'peso_real' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {drillPageRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-10 text-center text-slate-400 dark:text-slate-500">
                          Nenhum CT-e neste grupo.
                        </td>
                      </tr>
                    ) : (
                      drillPageRows.map((r) => {
                        const cte = fmtCte(r.ser_cte, r.nro_cte);
                        const sigla = String(r.unid_atual ?? '').toUpperCase() || '—';
                        const atrasoRaw = typeof r.atraso === 'number' ? r.atraso : Number(r.atraso);
                        const atraso = Number.isNaN(atrasoRaw) ? 0 : atrasoRaw;
                        const atrasoShow = atraso > 0 ? atraso : 0;

                        return (
                          <tr key={`${sigla}-${cte}-${r.prev}-${r.entrega}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{sigla}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{cte}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">{r.prev || '—'}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">{r.entrega || '—'}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className={atrasoShow > 0 ? 'text-red-700 dark:text-red-300 font-bold' : 'text-slate-700 dark:text-slate-200'}>
                                {atrasoShow}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-slate-800 dark:text-slate-200 truncate">{r.ult_ocor || '—'}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{r.data_ult_ocor || ''}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-200">{fmtBRL(r.vlr_merc)}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-200">{fmtBRL(r.vlr_frete)}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-800 dark:text-slate-200">{fmtKg(r.peso_real)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div>
                    Página {drillSafePage} de {drillTotalPages} · {drillSortedRows.length} registro{drillSortedRows.length !== 1 ? 's' : ''}
                  </div>
                  <div className="text-slate-600 dark:text-slate-300">
                    Total merc.: {fmtBRL(drillTotals.vlr_merc)} · Frete: {fmtBRL(drillTotals.vlr_frete)} · Peso: {fmtKg(drillTotals.peso_real)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 px-2 dark:border-slate-700" onClick={() => setDrillPage(1)} disabled={drillSafePage <= 1}>
                    «
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2 dark:border-slate-700" onClick={() => setDrillPage((p) => Math.max(1, p - 1))} disabled={drillSafePage <= 1}>
                    ‹
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2 dark:border-slate-700" onClick={() => setDrillPage((p) => Math.min(drillTotalPages, p + 1))} disabled={drillSafePage >= drillTotalPages}>
                    ›
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2 dark:border-slate-700" onClick={() => setDrillPage(drillTotalPages)} disabled={drillSafePage >= drillTotalPages}>
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
