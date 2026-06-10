import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { FilterSelectUnidadeOrdered } from '../cadastros/FilterSelectUnidadeOrdered';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { apiFetch } from '../../utils/apiUtils';
import { ENVIRONMENT } from '../../config/environment';
import { toast } from 'sonner';
import {
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  Legend, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  Loader2, FileSpreadsheet, PackageX, PackageCheck,
  Weight, DollarSign, Filter, RefreshCw,
  Calendar, Building2, FileText, Users, Truck,
  X, Check, ChevronDown, Download
} from 'lucide-react';

interface Filters {
  periodoOcorrenciaInicio: string;
  periodoOcorrenciaFim: string;
  periodoEmissaoInicio: string;
  periodoEmissaoFim: string;
  siglaEmit: string[];
}

interface CteRetido {
  nro_cte: string;
  ser_cte: string;
  data_emissao: string;
  data_ocorrencia_82: string;
  sigla_emit: string;
  sigla_dest: string;
  nome_remetente: string;
  nome_destinatario: string;
  nome_pagador: string;
  cidade_emit: string;
  uf_emit: string;
  cidade_dest: string;
  uf_dest: string;
  peso_real: number;
  vlr_merc: number;
  vlr_frete: number;
  qt_vol: number;
  ult_ocor: number;
  is_ativo: boolean;
}

interface Totais {
  total_retidos: number;
  retidos_ativos: number;
  retidos_resolvidos: number;
  peso_total: number;
  vlr_merc_total: number;
  vlr_frete_total: number;
  total_clientes: number;
}

interface SerieDia {
  data: string;
  retidos: number;
  resolvidos: number;
  peso: number;
}

interface TopCliente {
  nome: string;
  quantidade: number;
}

const COLORS_DONUT = ['#ef4444', '#10b981'];
const COLORS_PALETTE = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899'];

function formatMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNum(v: number) {
  return v.toLocaleString('pt-BR');
}

function formatTon(kg: number) {
  return (kg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' t';
}

function getLast30Days() {
  const hoje = new Date();
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(hoje.getDate() - 30);
  
  const fmt = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { inicio: fmt(trintaDiasAtras), fim: fmt(hoje) };
}

function formatPeriodDisplay(inicio: string, fim: string): string {
  if (!inicio && !fim) return '';
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const p = (s: string) => { const [y,m,d] = s.split('-'); return { year: +y, month: +m, day: +d }; };
  const s = p(inicio); const e = p(fim);
  if (s.month === e.month && s.year === e.year) return `${s.day} a ${e.day} de ${MONTHS[s.month-1]} ${s.year}`;
  return `${s.day}/${s.month} a ${e.day}/${e.month} de ${s.year}`;
}

export function PainelRetidos() {
  const { user, logout, clientConfig } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const unidadeAtual = user?.unidade_atual || user?.unidade || '';
  const isMTZ = unidadeAtual === 'MTZ';
  const userUnit = user?.unidade_atual || user?.unidade;

  const defaultPeriod = getLast30Days();

  const [filters, setFilters] = useState<Filters>({
    periodoOcorrenciaInicio: defaultPeriod.inicio,
    periodoOcorrenciaFim: defaultPeriod.fim,
    periodoEmissaoInicio: '',
    periodoEmissaoFim: '',
    siglaEmit: userUnit && userUnit !== 'MTZ' ? [userUnit] : [],
  });
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [showFilters, setShowFilters] = useState(false);

  const [ctesRetidos, setCtesRetidos] = useState<CteRetido[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [serie, setSerie] = useState<SerieDia[]>([]);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);

  // Card Dialog States
  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [cardDialogId, setCardDialogId] = useState<string>('');
  const [cardDialogName, setCardDialogName] = useState<string>('');
  const [ctesDialog, setCtesDialog] = useState<CteRetido[]>([]);
  const [loadingCtesDialog, setLoadingCtesDialog] = useState(false);

  const carregarDados = useCallback(async (currentFilters: Filters) => {
    setLoading(true);
    setElapsed(0);
    
    const timer = setInterval(() => setElapsed(e => e + 1), 1000);

    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/painel-retidos/get_dados.php`,
        { 
          method: 'POST', 
          body: JSON.stringify({ 
            periodoOcorrenciaInicio: currentFilters.periodoOcorrenciaInicio,
            periodoOcorrenciaFim: currentFilters.periodoOcorrenciaFim,
            periodoEmissaoInicio: currentFilters.periodoEmissaoInicio,
            periodoEmissaoFim: currentFilters.periodoEmissaoFim,
            siglaEmit: currentFilters.siglaEmit
          })
        },
        true
      );
      clearInterval(timer);
      setElapsed(0);

      if (res.success) {
        setCtesRetidos(res.ctes_retidos ?? []);
        setSerie(res.serie_cronologica ?? []);
        setTotais(res.totais ?? null);
        setTopClientes(res.top_clientes ?? []);
        setHasSearched(true);
      } else {
        toast.error(res.message || 'Erro ao gerar relatório.');
      }
    } catch (e: any) {
      clearInterval(timer);
      setElapsed(0);
      toast.error(e.message || 'Erro ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar dados automaticamente na inicialização
  useEffect(() => {
    carregarDados(filters);
  }, [carregarDados, filters]);

  const applyFilters = () => {
    setFilters({ ...tempFilters });
    carregarDados(tempFilters);
    setShowFilters(false);
  };

  const cancelFilters = () => {
    setTempFilters({ ...filters });
    setShowFilters(false);
  };

  const clearFilters = () => {
    const empty: Filters = {
      periodoOcorrenciaInicio: '',
      periodoOcorrenciaFim: '',
      periodoEmissaoInicio: '',
      periodoEmissaoFim: '',
      siglaEmit: userUnit && userUnit !== 'MTZ' ? [userUnit] : [],
    };
    setTempFilters(empty);
  };

  const exportarExcel = async () => {
    if (!ctesRetidos.length) return;
    setLoadingExcel(true);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/painel-retidos/exportar_excel.php`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            ctes: ctesRetidos,
            totais,
            filters
          }),
        }
      );

      if (!response.ok) {
        const txt = await response.text();
        try { throw new Error(JSON.parse(txt).message || 'Erro ao exportar'); }
        catch { throw new Error('Erro ao exportar planilha'); }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `painel_retidos_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Planilha Excel exportada com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao exportar planilha.');
    } finally {
      setLoadingExcel(false);
    }
  };

  const abrirCardDialog = async (cardId: string, cardName: string) => {
    setCardDialogId(cardId);
    setCardDialogName(cardName);
    setCardDialogOpen(true);
    setCtesDialog([]);
    setLoadingCtesDialog(true);

    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/painel-retidos/get_ctes_card.php`,
        {
          method: 'POST',
          body: JSON.stringify({
            cardId,
            filters,
          })
        },
        true
      );
      if (res.success) {
        setCtesDialog(res.ctes ?? []);
      } else {
        toast.error(res.message || 'Erro ao carregar CT-es');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar CT-es');
    } finally {
      setLoadingCtesDialog(false);
    }
  };

  const exportarCSV = (ctes: CteRetido[], filename: string) => {
    const header = [
      'CT-e',
      'Emissão',
      'Ocorrência 82',
      'Status',
      'Unidade Emit',
      'Cidade Origem',
      'Cidade Destino',
      'Remetente',
      'Destinatário',
      'Pagador',
      'Peso (kg)',
      'Volume',
      'Vlr Mercadoria',
      'Vlr Frete',
      'Última Ocorrência'
    ];
    const rows = ctes.map((cte) => [
      `${cte.ser_cte}${String(cte.nro_cte).padStart(6, '0')}`,
      cte.data_emissao,
      cte.data_ocorrencia_82,
      cte.is_ativo ? 'RETIDO' : 'RESOLVIDO',
      cte.sigla_emit,
      cte.cidade_emit ? `${cte.cidade_emit}/${cte.uf_emit}` : '-',
      cte.cidade_dest ? `${cte.cidade_dest}/${cte.uf_dest}` : '-',
      cte.nome_remetente,
      cte.nome_destinatario,
      cte.nome_pagador,
      cte.peso_real,
      cte.qt_vol,
      cte.vlr_merc,
      cte.vlr_frete,
      cte.ult_ocor
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isDark = theme === 'dark';
  const gridColor  = isDark ? '#334155' : '#e2e8f0';
  const textColor  = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg  = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  const donutData = totais ? [
    { name: 'Retidos Ativos', value: totais.retidos_ativos },
    { name: 'Resolvidos', value: totais.retidos_resolvidos },
  ] : [];

  const headerActions = (
    <div className="flex items-center gap-2 md:gap-4">
      <div className="text-right hidden md:block">
        <p className="text-slate-500 dark:text-slate-400 text-xs">Período</p>
        <p className="text-slate-900 dark:text-slate-100 text-sm">
          {formatPeriodDisplay(filters.periodoOcorrenciaInicio, filters.periodoOcorrenciaFim) || 'Sem período'}
        </p>
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => { setTempFilters({ ...filters }); setShowFilters(true); }}
        className="dark:border-slate-600 dark:hover:bg-slate-800"
      >
        <Filter className="w-4 h-4" />
      </Button>
    </div>
  );

  return (
    <DashboardLayout
      title="Painel de Retidos"
      description={user?.client_name}
      headerActions={headerActions}
    >
      <main className="container mx-auto px-3 md:px-6 py-6 space-y-6">

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
              Painel de Retidos
            </h2>
            <p className="text-slate-500 dark:text-slate-400">
              Análise de CT-es retidos fiscalmente ou por clientes
            </p>
          </div>
          {hasSearched && (
            <Button onClick={exportarExcel}
              disabled={loadingExcel || ctesRetidos.length === 0} variant="outline"
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
              {loadingExcel ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
              Exportar Excel
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Hint card */}
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Clique nos cards para visualizar os CT-es do grupo.
            </div>
            
            {totais && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {([
                  { label: 'Retidos Ativos',   value: totais.retidos_ativos, icon: PackageX, bg: '#fef2f2', bgDark: '#7f1d1d33', border: '#fecaca', borderDark: '#991b1b', iconColor: '#dc2626', textLabel: '#991b1b', textValue: '#7f1d1d', cardId: 'ativos' },
                  { label: 'Resolvidos',     value: totais.retidos_resolvidos, icon: PackageCheck, bg: '#f0fdf4', bgDark: '#14532d33', border: '#bbf7d0', borderDark: '#166534', iconColor: '#16a34a', textLabel: '#15803d', textValue: '#14532d', cardId: 'resolvidos' },
                  { label: 'Total Retidos',  value: totais.total_retidos, icon: FileText, bg: '#f1f5f9', bgDark: '#1e293b', border: '#cbd5e1', borderDark: '#475569', iconColor: '#475569', textLabel: '#475569', textValue: '#334155', cardId: 'total' },
                  { label: 'Peso Total',     value: formatTon(totais.peso_total), icon: Weight, bg: '#faf5ff', bgDark: '#3b076433', border: '#e9d5ff', borderDark: '#6b21a8', iconColor: '#8b5cf6', textLabel: '#7c3aed', textValue: '#5b21b6', cardId: null },
                  { label: 'Vlr Mercadoria', value: formatMoeda(totais.vlr_merc_total), icon: DollarSign, bg: '#fffbeb', bgDark: '#451a0333', border: '#fde68a', borderDark: '#92400e', iconColor: '#d97706', textLabel: '#b45309', textValue: '#92400e', cardId: null },
                  { label: 'Clientes',       value: totais.total_clientes, icon: Users, bg: '#f0fdfa', bgDark: '#042f2e33', border: '#99f6e4', borderDark: '#0f766e', iconColor: '#14b8a6', textLabel: '#0d9488', textValue: '#0f766e', cardId: null },
                ] as const).map(({ label, value, icon: Icon, bg, bgDark, border, borderDark, iconColor, textLabel, textValue, cardId }) => (
                  <div
                    key={label}
                    className={`rounded-xl border p-4 transition-all ${cardId ? 'cursor-pointer hover:shadow-md hover:border-opacity-80' : ''}`}
                    style={{ backgroundColor: isDark ? bgDark : bg, borderColor: isDark ? borderDark : border }}
                    onClick={() => cardId ? abrirCardDialog(cardId, label) : undefined}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4" style={{ color: iconColor }} />
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium" style={{ color: isDark ? '#cbd5e1' : textLabel }}>{label}</span>
                        {cardId && (
                          <span className="text-xs text-slate-400" title="Clique para ver detalhes">
                            •
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-lg font-bold leading-tight" style={{ color: isDark ? '#f1f5f9' : textValue }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <PackageX className="w-5 h-5 text-red-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Status dos Retidos</h3>
                </div>
                <div className="p-4">
                  {donutData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                          dataKey="value" paddingAngle={3} stroke="none">
                          {donutData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS_DONUT[index % COLORS_DONUT.length]} />
                          ))}
                        </Pie>
                        <RechartTooltip formatter={(v: number, n: string) => [v, n]} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <PackageX className="w-10 h-10 mb-2" />
                      <p className="text-sm">Nenhum dado encontrado</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Line className="w-5 h-5 text-blue-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Retidos e Resolvidos por Dia</h3>
                </div>
                <div className="p-4">
                  {serie.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={serie} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                        <XAxis dataKey="data" tick={{ fontSize: 10, fill: textColor }} />
                        <YAxis tick={{ fontSize: 10, fill: textColor }} />
                        <RechartTooltip contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="retidos" stroke="#ef4444" strokeWidth={2} dot={false} name="Retidos" />
                        <Line type="monotone" dataKey="resolvidos" stroke="#10b981" strokeWidth={2} dot={false} name="Resolvidos" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Line className="w-10 h-10 mb-2" />
                      <p className="text-sm">Nenhum dado encontrado</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-orange-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Top 5 Clientes - Retidos</h3>
                </div>
                <div className="p-4">
                  {topClientes.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={topClientes} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradTop5" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.7} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                        <XAxis type="number" tick={{ fontSize: 10, fill: textColor }} />
                        <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: textColor }} width={100} />
                        <RechartTooltip formatter={(v: number) => [v, 'Retidos']}
                          contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                        <Bar dataKey="quantidade" fill="url(#gradTop5)" radius={[0, 6, 6, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Users className="w-10 h-10 mb-2" />
                      <p className="text-sm">Nenhum dado encontrado</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Weight className="w-5 h-5 text-purple-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Peso Retido por Dia (ton)</h3>
                </div>
                <div className="p-4">
                  {serie.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={serie} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="gradPesoDia" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.3} />
                        <XAxis dataKey="data" tick={{ fontSize: 10, fill: textColor }} />
                        <YAxis tick={{ fontSize: 10, fill: textColor }} tickFormatter={(v) => (v / 1000).toFixed(1)} />
                        <RechartTooltip formatter={(v: number) => [formatTon(v), 'Peso']}
                          contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                        <Area type="monotone" dataKey="peso" stroke="#8b5cf6" strokeWidth={2.5}
                          fill="url(#gradPesoDia)" dot={false} name="Peso (ton)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Weight className="w-10 h-10 mb-2" />
                      <p className="text-sm">Nenhum dado encontrado</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Card className="dark:bg-slate-900/90 dark:border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2 text-base">
                  <Truck className="w-5 h-5 text-red-500" />
                  CT-e Retidos
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 dark:bg-slate-950">
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left whitespace-nowrap">CT-e</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left whitespace-nowrap">Emissão</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left whitespace-nowrap">Ocorrência</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Status</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Un. Emit</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Cidade Origem</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Cidade Destino</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Remetente</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Destinatário</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Pagador</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Peso (kg)</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Vol</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Vlr Merc</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Vlr Frete</th>
                        <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Últ. Ocorrência</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ctesRetidos.length === 0 ? (
                        <tr>
                          <td colSpan={15} className="px-3 py-16 text-center text-slate-500 dark:text-slate-400">
                            Nenhum CT-e retido encontrado
                          </td>
                        </tr>
                      ) : (
                        ctesRetidos.map((cte, idx) => (
                          <tr
                            key={idx}
                            className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/50'}`}
                          >
                            <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {cte.ser_cte}{String(cte.nro_cte).padStart(6, '0')}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.data_emissao}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.data_ocorrencia_82}</td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <Badge variant="outline" className={cte.is_ativo
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 text-xs'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 text-xs'}>
                                {cte.is_ativo ? 'RETIDO' : 'RESOLVIDO'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{cte.sigla_emit}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[140px] truncate" title={`${cte.cidade_emit || '-'}/${cte.uf_emit || ''}`}>
                              {cte.cidade_emit ? `${cte.cidade_emit}/${cte.uf_emit}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[140px] truncate" title={`${cte.cidade_dest || '-'}/${cte.uf_dest || ''}`}>
                              {cte.cidade_dest ? `${cte.cidade_dest}/${cte.uf_dest}` : '-'}
                            </td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={cte.nome_remetente}>{cte.nome_remetente}</td>
                            <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={cte.nome_destinatario}>{cte.nome_destinatario}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={cte.nome_pagador}>{cte.nome_pagador}</td>
                            <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNum(cte.peso_real)}</td>
                            <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.qt_vol}</td>
                            <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatMoeda(cte.vlr_merc)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatMoeda(cte.vlr_frete)}</td>
                          <td className="px-3 py-2 text-right font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{cte.ult_ocor}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="sm:max-w-[680px] bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Personalize a visualização dos retidos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <div className="space-y-3">
              <Label className="text-slate-900 dark:text-slate-100">Período de Ocorrência</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Início</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoOcorrenciaInicio}
                    onChange={e => setTempFilters({ ...tempFilters, periodoOcorrenciaInicio: e.target.value })}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Fim</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoOcorrenciaFim}
                    onChange={e => setTempFilters({ ...tempFilters, periodoOcorrenciaFim: e.target.value })}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-slate-900 dark:text-slate-100">Período de Emissão</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Início</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoEmissaoInicio}
                    onChange={e => setTempFilters({ ...tempFilters, periodoEmissaoInicio: e.target.value })}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Fim</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoEmissaoFim}
                    onChange={e => setTempFilters({ ...tempFilters, periodoEmissaoFim: e.target.value })}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-slate-100">Unidade(s) Origem</Label>
              <FilterSelectUnidadeOrdered
                value={tempFilters.siglaEmit}
                onChange={v => setTempFilters({ ...tempFilters, siglaEmit: v })}
                disabled={userUnit && userUnit !== 'MTZ'}
              />
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button variant="outline" onClick={clearFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
              <X className="w-4 h-4 mr-2" />
              Limpar Tudo
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
                Cancelar
              </Button>
              <Button onClick={applyFilters} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Check className="w-4 h-4 mr-2" />
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={cardDialogOpen} onOpenChange={setCardDialogOpen}>
        <DialogContent className="max-w-7xl h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <DialogHeader className="shrink-0 pr-10">
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle>{cardDialogName}</DialogTitle>
                <DialogDescription>
                  Lista de CT-es neste grupo.
                </DialogDescription>
              </div>
              {ctesDialog.length > 0 && (
                <Button variant="outline" size="sm" className="shrink-0 gap-2" onClick={() => exportarCSV(ctesDialog, `${cardDialogName.replace(/\s+/g, '_')}.csv`)}>
                  <Download className="h-4 w-4" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="grid h-full min-h-0 gap-3 overflow-hidden grid-rows-[minmax(0,1fr)]">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 grid grid-rows-[auto_minmax(0,1fr)] min-h-0 overflow-hidden">
              <div className="grid gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400" style={{ gridTemplateColumns: '100px 100px 100px 80px 80px 140px 140px 160px 160px 140px 100px 60px 110px 110px 100px' }}>
                <span>CT-e</span>
                <span>Emissão</span>
                <span>Ocorrência</span>
                <span>Status</span>
                <span>Un. Emit</span>
                <span>Cidade Origem</span>
                <span>Cidade Destino</span>
                <span>Remetente</span>
                <span>Destinatário</span>
                <span>Pagador</span>
                <span>Peso (kg)</span>
                <span>Vol</span>
                <span>Vlr Merc</span>
                <span>Vlr Frete</span>
                <span>Últ. Ocorrência</span>
              </div>

              <div className="min-h-0 overflow-y-auto">
                {loadingCtesDialog ? (
                  <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando CT-es...
                  </div>
                ) : ctesDialog.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
                    Nenhum CT-e encontrado.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {ctesDialog.map((cte, idx) => (
                      <div
                        key={idx}
                        className="grid gap-2 px-4 py-2 text-sm"
                        style={{ gridTemplateColumns: '100px 100px 100px 80px 80px 140px 140px 160px 160px 140px 100px 60px 110px 110px 100px' }}
                      >
                        <span className="font-mono text-xs self-center text-slate-700 dark:text-slate-300">{cte.ser_cte}{String(cte.nro_cte).padStart(6, '0')}</span>
                        <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_emissao}</span>
                        <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_ocorrencia_82}</span>
                        <span className="self-center">
                          <Badge variant="outline" className={cte.is_ativo
                            ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800 text-xs'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800 text-xs'}>
                            {cte.is_ativo ? 'RETIDO' : 'RESOLVIDO'}
                          </Badge>
                        </span>
                        <span className="self-center font-mono text-slate-500 dark:text-slate-400">{cte.sigla_emit}</span>
                        <span className="truncate self-center text-slate-700 dark:text-slate-300" title={`${cte.cidade_emit || '-'}/${cte.uf_emit || ''}`}>{cte.cidade_emit ? `${cte.cidade_emit}/${cte.uf_emit}` : '-'}</span>
                        <span className="truncate self-center text-slate-700 dark:text-slate-300" title={`${cte.cidade_dest || '-'}/${cte.uf_dest || ''}`}>{cte.cidade_dest ? `${cte.cidade_dest}/${cte.uf_dest}` : '-'}</span>
                        <span className="truncate self-center text-slate-700 dark:text-slate-300" title={cte.nome_remetente}>{cte.nome_remetente || '-'}</span>
                        <span className="truncate self-center text-slate-700 dark:text-slate-300" title={cte.nome_destinatario}>{cte.nome_destinatario || '-'}</span>
                        <span className="truncate self-center text-slate-500 dark:text-slate-400" title={cte.nome_pagador}>{cte.nome_pagador || '-'}</span>
                        <span className="self-center text-right text-slate-700 dark:text-slate-300">{formatNum(cte.peso_real)}</span>
                        <span className="self-center text-right text-slate-700 dark:text-slate-300">{cte.qt_vol}</span>
                        <span className="self-center text-right text-slate-700 dark:text-slate-300">{formatMoeda(cte.vlr_merc)}</span>
                        <span className="self-center text-right font-semibold text-emerald-700 dark:text-emerald-400">{formatMoeda(cte.vlr_frete)}</span>
                        <span className="truncate self-center text-right font-mono text-slate-500 dark:text-slate-400">{cte.ult_ocor || '-'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
