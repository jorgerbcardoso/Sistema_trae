import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from 'recharts';
import {
  Award,
  Check,
  ChevronDown,
  Filter,
  Info,
  Loader2,
  Package,
  Search,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Weight,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useTheme } from '../ThemeProvider';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { FilterSelectUnidadeOrdered } from '../cadastros/FilterSelectUnidadeOrdered';

function getLastMonthPeriod() {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last  = new Date(now.getFullYear(), now.getMonth(), 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { inicio: fmt(first), fim: fmt(last) };
}

function formatPeriodDisplay(inicio: string, fim: string): string {
  if (!inicio && !fim) return '';
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const p = (s: string) => { const [y,m,d] = s.split('-'); return { year: +y, month: +m, day: +d }; };
  const s = p(inicio); const e = p(fim);
  if (s.month === e.month && s.year === e.year) return `${MONTHS[s.month-1]} ${s.year}`;
  if (s.year === e.year) return `${MONTHS[s.month-1]} – ${MONTHS[e.month-1]} ${s.year}`;
  return `${MONTHS[s.month-1]} ${s.year} – ${MONTHS[e.month-1]} ${e.year}`;
}

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}
function fmtBRLCompact(v: number) {
  if (v >= 1_000_000) return 'R$ ' + (v / 1_000_000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mi';
  return fmtBRL(v);
}
function fmtNum(v: number) {
  return v.toLocaleString('pt-BR');
}
function fmtKg(v: number) {
  if (v >= 1000) return (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' t';
  return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kg';
}

const PALETTE = [
  '#6366f1','#3b82f6','#06b6d4','#10b981','#f59e0b',
  '#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316',
];

interface Filters {
  periodoEmissaoInicio: string;
  periodoEmissaoFim: string;
  tpFrete: string;
  siglaEmit: string[];
  siglaDest: string[];
  cnpjsPagadores: string[];
}

interface ClienteRanking {
  cnpj: string;
  nome: string;
  qtde_ctes: number;
  total_frete: number;
  total_merc: number;
  total_peso: number;
  total_volumes: number;
  ticket_medio: number;
  qtde_cif: number;
  qtde_fob: number;
}

interface Totais {
  qtde_ctes: number;
  total_frete: number;
  total_merc: number;
  total_peso: number;
  total_volumes: number;
  qtde_clientes: number;
}

interface EvolucaoMes {
  mes: string;
  mes_label: string;
  total_frete: number;
  qtde_ctes: number;
}

interface UnidadeFat {
  sigla: string;
  total_frete: number;
  qtde_ctes: number;
}

interface ClienteOpcao {
  cnpj: string;
  nome: string;
  total_frete: number;
}

export function FaturamentoClientes() {
  const { user } = useAuth();
  const { theme } = useTheme();
  usePageTitle('Faturamento de Clientes');

  const defaultPeriod = getLastMonthPeriod();

  const [filters, setFilters] = useState<Filters>({
    periodoEmissaoInicio: defaultPeriod.inicio,
    periodoEmissaoFim: defaultPeriod.fim,
    tpFrete: '',
    siglaEmit: [],
    siglaDest: [],
    cnpjsPagadores: [],
  });
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [showFilters, setShowFilters] = useState(false);

  const [clientes, setClientes] = useState<ClienteRanking[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [evolucao, setEvolucao] = useState<EvolucaoMes[]>([]);
  const [unidades, setUnidades] = useState<UnidadeFat[]>([]);
  const [evolClientes, setEvolClientes] = useState<any[]>([]);
  const [evolClientesKeys, setEvolClientesKeys] = useState<Record<string, string>>({});
  const [evolUnidades, setEvolUnidades] = useState<any[]>([]);
  const [evolUnidadesKeys, setEvolUnidadesKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [clienteDialogOpen, setClienteDialogOpen] = useState(false);
  const [clienteOpcoes, setClienteOpcoes] = useState<ClienteOpcao[]>([]);
  const [clienteSearch, setClienteSearch] = useState('');
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [clientesSelecionados, setClientesSelecionados] = useState<ClienteOpcao[]>([]);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [cteDialogOpen, setCteDialogOpen] = useState(false);
  const [cteDialogTitulo, setCteDialogTitulo] = useState('');
  const [cteDialogLista, setCteDialogLista] = useState<any[]>([]);
  const [cteDialogTotais, setCteDialogTotais] = useState<any>(null);
  const [loadingCtes, setLoadingCtes] = useState(false);

  const carregarDados = useCallback(async (f: Filters) => {
    setLoading(true);
    try {
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/faturamento-clientes/get_dados.php`,
        { method: 'POST', body: JSON.stringify({ filters: f }) },
        true
      );
      if (response.success) {
        setClientes(response.data.clientes || []);
        setTotais(response.data.totais || null);
        setEvolucao(response.data.evolucao || []);
        setUnidades(response.data.unidades || []);
        setEvolClientes(response.data.evol_clientes || []);
        setEvolClientesKeys(response.data.evol_clientes_keys || {});
        setEvolUnidades(response.data.evol_unidades || []);
        setEvolUnidadesKeys(response.data.evol_unidades_keys || []);
      } else {
        toast.error(response.message || 'Erro ao carregar dados');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarDados(filters);
  }, [filters]);

  const abrirCteDialog = useCallback(async (titulo: string, tipo: string, chave: string, mes?: string) => {
    setCteDialogTitulo(titulo);
    setCteDialogLista([]);
    setCteDialogTotais(null);
    setCteDialogOpen(true);
    setLoadingCtes(true);
    try {
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/faturamento-clientes/get_ctes.php`,
        { method: 'POST', body: JSON.stringify({ filters, tipo, chave, mes: mes ?? '' }) },
        true
      );
      if (response.success) {
        setCteDialogLista(response.data.ctes || []);
        setCteDialogTotais(response.data.totais || null);
      } else {
        toast.error(response.message || 'Erro ao carregar CT-es');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar CT-es');
    } finally {
      setLoadingCtes(false);
    }
  }, [filters]);

  const buscarClientesOpcoes = useCallback(async (search: string, f: Filters) => {
    setLoadingClientes(true);
    try {
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/faturamento-clientes/get_top_clientes.php`,
        { method: 'POST', body: JSON.stringify({ search, filters: f }) },
        true
      );
      if (response.success) {
        setClienteOpcoes(response.clientes || []);
      }
    } catch {
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  useEffect(() => {
    if (!clienteDialogOpen) return;
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      buscarClientesOpcoes(clienteSearch, tempFilters);
    }, 300);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [clienteSearch, clienteDialogOpen, tempFilters]);

  const toggleClienteSelecionado = (c: ClienteOpcao) => {
    setClientesSelecionados(prev => {
      const exists = prev.find(x => x.cnpj === c.cnpj);
      if (exists) return prev.filter(x => x.cnpj !== c.cnpj);
      if (prev.length >= 10) { toast.warning('Máximo de 10 clientes'); return prev; }
      return [...prev, c];
    });
  };

  const confirmarClientes = () => {
    setTempFilters(prev => ({ ...prev, cnpjsPagadores: clientesSelecionados.map(c => c.cnpj) }));
    setClienteDialogOpen(false);
  };

  const applyFilters = () => {
    setFilters({ ...tempFilters });
    setShowFilters(false);
  };

  const cancelFilters = () => {
    setTempFilters({ ...filters });
    setClientesSelecionados(filters.cnpjsPagadores.map(cnpj => {
      const found = clienteOpcoes.find(c => c.cnpj === cnpj);
      return found || { cnpj, nome: cnpj, total_frete: 0 };
    }));
    setShowFilters(false);
  };

  const clearFilters = () => {
    const empty: Filters = {
      periodoEmissaoInicio: '',
      periodoEmissaoFim: '',
      tpFrete: '',
      siglaEmit: [],
      siglaDest: [],
      cnpjsPagadores: [],
    };
    setTempFilters(empty);
    setClientesSelecionados([]);
  };

  const totalFreteSelecionados = clientes.reduce((s, c) => s + c.total_frete, 0);

  const isDark = theme === 'dark';
  const gridColor  = isDark ? '#334155' : '#e2e8f0';
  const textColor  = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg  = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';

  const headerActions = (
    <div className="flex items-center gap-2 md:gap-4">
      <div className="text-right hidden md:block">
        <p className="text-slate-500 dark:text-slate-400 text-xs">Período</p>
        <p className="text-slate-900 dark:text-slate-100 text-sm">
          {formatPeriodDisplay(filters.periodoEmissaoInicio, filters.periodoEmissaoFim) || 'Sem período'}
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
      title="Faturamento de Clientes"
      description={user?.client_name}
      headerActions={headerActions}
    >
      <main className="container mx-auto px-3 md:px-6 py-6 space-y-6">

        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Faturamento de Clientes
          </h2>
          <p className="text-slate-500 dark:text-slate-400">
            Análise de faturamento por cliente pagador — top 10 por valor de frete
          </p>
        </div>

        <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 px-5 py-3 flex items-center gap-3">
          <Info className="w-4 h-4 text-indigo-500 shrink-0" />
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            <strong>Dica:</strong> Clique em qualquer cliente no ranking, fatia dos gráficos de rosca ou ponto nos gráficos de linha para ver a lista detalhada dos CT-es.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {totais && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {([
                  { label: 'Faturamento Total',   value: fmtBRL(totais.total_frete),    icon: Wallet,     bg: '#eef2ff', bgDark: '#1e1b4b33', border: '#c7d2fe', borderDark: '#3730a3', iconColor: '#4f46e5', textLabel: '#4338ca', textValue: '#312e81' },
                  { label: 'Clientes Ativos',     value: fmtNum(totais.qtde_clientes),  icon: Users,      bg: '#eff6ff', bgDark: '#172554', border: '#bfdbfe', borderDark: '#1e40af', iconColor: '#2563eb', textLabel: '#1d4ed8', textValue: '#1e3a8a' },
                  { label: 'CT-es Emitidos',      value: fmtNum(totais.qtde_ctes),      icon: Truck,      bg: '#ecfeff', bgDark: '#083344', border: '#a5f3fc', borderDark: '#155e75', iconColor: '#0891b2', textLabel: '#0e7490', textValue: '#164e63' },
                  { label: 'Valor de Mercadoria', value: fmtBRLCompact(totais.total_merc), icon: TrendingUp, bg: '#f0fdf4', bgDark: '#052e16', border: '#bbf7d0', borderDark: '#14532d', iconColor: '#16a34a', textLabel: '#15803d', textValue: '#14532d' },
                  { label: 'Peso Total',          value: fmtKg(totais.total_peso),      icon: Weight,     bg: '#fffbeb', bgDark: '#1c1003', border: '#fde68a', borderDark: '#78350f', iconColor: '#d97706', textLabel: '#b45309', textValue: '#92400e' },
                  { label: 'Volumes',             value: fmtNum(totais.total_volumes),  icon: Package,    bg: '#fff1f2', bgDark: '#1f0a0a', border: '#fecdd3', borderDark: '#9f1239', iconColor: '#e11d48', textLabel: '#be123c', textValue: '#881337' },
                ] as const).map(({ label, value, icon: Icon, bg, bgDark, border, borderDark, iconColor, textLabel, textValue }) => (
                  <div
                    key={label}
                    className="rounded-xl border p-4"
                    style={{ backgroundColor: isDark ? bgDark : bg, borderColor: isDark ? borderDark : border }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4" style={{ color: iconColor }} />
                      <span className="text-xs font-medium" style={{ color: isDark ? '#cbd5e1' : textLabel }}>{label}</span>
                    </div>
                    <p className="text-lg font-bold leading-tight" style={{ color: isDark ? '#f1f5f9' : textValue }}>{value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid lg:grid-cols-5 gap-6">
              <div className="lg:col-span-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Ranking de Clientes</h3>
                  <span className="ml-auto text-xs text-slate-400">por faturamento de frete</span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <Users className="w-10 h-10 mb-2" />
                      <p className="text-sm">Nenhum dado encontrado</p>
                    </div>
                  ) : (
                    clientes.map((c, i) => {
                      const pct = totalFreteSelecionados > 0 ? (c.total_frete / totalFreteSelecionados) * 100 : 0;
                      const color = PALETTE[i % PALETTE.length];
                      return (
                        <div key={c.cnpj} className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => abrirCteDialog(c.nome, 'cliente', c.cnpj)}>
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                              style={{ backgroundColor: color }}
                            >
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{c.nome}</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">{fmtBRL(c.total_frete)}</p>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1.5">
                                <div
                                  className="h-1.5 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, backgroundColor: color }}
                                />
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                <span>{c.qtde_ctes} CT-es</span>
                                <span>·</span>
                                <span>Ticket: {fmtBRL(c.ticket_medio)}</span>
                                <span>·</span>
                                <span>{pct.toFixed(1)}% do total</span>
                                {c.qtde_cif > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">CIF {c.qtde_cif}</Badge>}
                                {c.qtde_fob > 0 && <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">FOB {c.qtde_fob}</Badge>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Distribuição por Cliente
                  </h3>
                  {clientes.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Sem dados</div>
                  ) : (() => {
                    const totalGeral = totais?.total_frete ?? 0;
                    const top5 = clientes.slice(0, 5);
                    const totalTop5 = top5.reduce((s, c) => s + c.total_frete, 0);
                    const demais = totalGeral - totalTop5;
                    const pieData = [
                      ...top5.map(c => ({ nome: c.nome, label: c.nome.substring(0, 8), value: c.total_frete })),
                      ...(demais > 0 ? [{ nome: 'Demais', label: 'Demais', value: demais }] : []),
                    ];
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            stroke="none"
                            style={{ cursor: 'pointer' }}
                            onClick={(d: any) => abrirCteDialog(d.nome, 'cliente', d.nome === 'Demais' ? '__demais__' : (top5.find(c => c.nome === d.nome)?.cnpj ?? ''))}
                          >
                            {pieData.map((_, i) => (
                              <Cell key={i} fill={i < PALETTE.length ? PALETTE[i] : '#94a3b8'} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number, _: any, props: any) => [`${props.payload.nome}: ${fmtBRL(v)}`]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(v) => <span style={{ color: textColor, fontSize: 11 }}>{v}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-cyan-500" />
                    Distribuição por Unidade Origem
                  </h3>
                  {unidades.length === 0 ? (
                    <div className="flex items-center justify-center py-10 text-slate-400 text-sm">Sem dados</div>
                  ) : (() => {
                    const top5u = unidades.slice(0, 5);
                    const totalTop5u = top5u.reduce((s, u) => s + u.total_frete, 0);
                    const totalGeral = totais?.total_frete ?? 0;
                    const demaisU = totalGeral - totalTop5u;
                    const pieDataU = [
                      ...top5u.map(u => ({ sigla: u.sigla, value: u.total_frete })),
                      ...(demaisU > 0 ? [{ sigla: 'Demais', value: demaisU }] : []),
                    ];
                    return (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={pieDataU}
                            dataKey="value"
                            nameKey="sigla"
                            cx="50%"
                            cy="50%"
                            innerRadius={55}
                            outerRadius={85}
                            paddingAngle={2}
                            stroke="none"
                            style={{ cursor: 'pointer' }}
                            onClick={(d: any) => abrirCteDialog(d.sigla === 'Demais' ? 'Demais Unidades' : `Unidade ${d.sigla}`, 'unidade', d.sigla === 'Demais' ? '__demais__' : d.sigla)}
                          >
                            {pieDataU.map((_, i) => (
                              <Cell key={i} fill={i < PALETTE.length ? PALETTE[i] : '#94a3b8'} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                            formatter={(v: number, _: any, props: any) => [`${props.payload.sigla}: ${fmtBRL(v)}`]}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            formatter={(v) => <span style={{ color: textColor, fontSize: 11 }}>{v}</span>}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    );
                  })()}
                </div>


              </div>
            </div>

            {evolucao.length > 1 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                  Evolução Mensal do Faturamento
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={evolucao} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="mes_label" tick={{ fill: textColor, fontSize: 11 }} />
                    <YAxis tick={{ fill: textColor, fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                    <RechartsTooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => [fmtBRL(v), 'Faturamento']}
                    />
                    <Area
                      type="monotone"
                      dataKey="total_frete"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#gradFat)"
                      dot={{ fill: '#6366f1', r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {evolClientes.length > 1 && (() => {
              const totaisPorCnpj: Record<string, number> = {};
              evolClientes.forEach(row => {
                Object.entries(evolClientesKeys).forEach(([cnpj]) => {
                  if (row[cnpj]) totaisPorCnpj[cnpj] = (totaisPorCnpj[cnpj] || 0) + row[cnpj];
                });
              });
              const top5cnpjs = Object.entries(totaisPorCnpj)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cnpj]) => cnpj);
              const demaisCnpjs = Object.keys(totaisPorCnpj).filter(c => !top5cnpjs.includes(c));
              const dataComDemais = evolClientes.map(row => {
                const novo: any = { mes: row.mes, mes_label: row.mes_label };
                top5cnpjs.forEach(cnpj => { novo[cnpj] = row[cnpj] ?? null; });
                if (demaisCnpjs.length > 0) {
                  novo['__demais__'] = demaisCnpjs.reduce((s, c) => s + (row[c] ?? 0), 0) || null;
                }
                return novo;
              });
              const linhas = [
                ...top5cnpjs.map((cnpj, i) => ({ key: cnpj, label: evolClientesKeys[cnpj] || cnpj, color: PALETTE[i % PALETTE.length] })),
                ...(demaisCnpjs.length > 0 ? [{ key: '__demais__', label: 'Demais', color: '#94a3b8' }] : []),
              ];
              return (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-500" />
                      Evolução por Cliente — Últimos 12 Meses
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Independente do período selecionado nos filtros</p>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={dataComDemais}
                      margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                      onClick={(e: any) => {
                        if (!e?.activePayload?.[0]) return;
                        const mes = e.activeLabel;
                        const mesIso = dataComDemais.find(d => d.mes_label === mes)?.mes ?? '';
                        const key = e.activePayload[0].dataKey;
                        const l = linhas.find(l => l.key === key);
                        if (!l) return;
                        abrirCteDialog(
                          `${l.label} — ${mes}`,
                          'evol_cliente',
                          key === '__demais__' ? '__demais__' : key,
                          mesIso
                        );
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="mes_label" tick={{ fill: textColor, fontSize: 11 }} />
                      <YAxis tick={{ fill: textColor, fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, key: string) => {
                          const l = linhas.find(l => l.key === key);
                          return [fmtBRL(v), l?.label || key];
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => {
                          const l = linhas.find(l => l.key === v);
                          const label = l?.label || v;
                          return <span style={{ color: textColor, fontSize: 11 }}>{label.substring(0, 8)}</span>;
                        }}
                      />
                      {linhas.map(({ key, color }) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={key}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}

            {evolUnidades.length > 1 && (() => {
              const totaisPorSigla: Record<string, number> = {};
              evolUnidades.forEach(row => {
                evolUnidadesKeys.forEach(sigla => {
                  if (row[sigla]) totaisPorSigla[sigla] = (totaisPorSigla[sigla] || 0) + row[sigla];
                });
              });
              const top5siglas = Object.entries(totaisPorSigla)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([s]) => s);
              const demaisSiglas = evolUnidadesKeys.filter(s => !top5siglas.includes(s));
              const dataUnidComDemais = evolUnidades.map(row => {
                const novo: any = { mes: row.mes, mes_label: row.mes_label };
                top5siglas.forEach(s => { novo[s] = row[s] ?? null; });
                if (demaisSiglas.length > 0) {
                  novo['__demais__'] = demaisSiglas.reduce((sum, s) => sum + (row[s] ?? 0), 0) || null;
                }
                return novo;
              });
              const linhasU = [
                ...top5siglas.map((s, i) => ({ key: s, label: s, color: PALETTE[i % PALETTE.length] })),
                ...(demaisSiglas.length > 0 ? [{ key: '__demais__', label: 'Demais', color: '#94a3b8' }] : []),
              ];
              return (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <div className="mb-4">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Truck className="w-5 h-5 text-cyan-500" />
                      Evolução por Unidade Origem — Últimos 12 Meses
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Independente do período selecionado nos filtros</p>
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart
                      data={dataUnidComDemais}
                      margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                      onClick={(e: any) => {
                        if (!e?.activePayload?.[0]) return;
                        const mes = e.activeLabel;
                        const mesIso = dataUnidComDemais.find(d => d.mes_label === mes)?.mes ?? '';
                        const key = e.activePayload[0].dataKey;
                        const l = linhasU.find(l => l.key === key);
                        if (!l) return;
                        abrirCteDialog(
                          `${l.label === 'Demais' ? 'Demais Unidades' : `Unidade ${l.label}`} — ${mes}`,
                          'evol_unidade',
                          key === '__demais__' ? '__demais__' : key,
                          mesIso
                        );
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                      <XAxis dataKey="mes_label" tick={{ fill: textColor, fontSize: 11 }} />
                      <YAxis tick={{ fill: textColor, fontSize: 11 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                      <RechartsTooltip
                        contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number, key: string) => {
                          const l = linhasU.find(l => l.key === key);
                          return [fmtBRL(v), l?.label || key];
                        }}
                      />
                      <Legend
                        iconType="circle"
                        iconSize={8}
                        formatter={(v) => {
                          const l = linhasU.find(l => l.key === v);
                          return <span style={{ color: textColor, fontSize: 11 }}>{l?.label || v}</span>;
                        }}
                      />
                      {linhasU.map(({ key, color }) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={key}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              );
            })()}
          </>
        )}
      </main>

      <Dialog open={cteDialogOpen} onOpenChange={setCteDialogOpen}>
        <DialogContent className="max-w-5xl h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>{cteDialogTitulo}</DialogTitle>
            <DialogDescription>Lista de CT-es do grupo selecionado</DialogDescription>
          </DialogHeader>

          <div className="grid grid-rows-[minmax(0,1fr)_auto] gap-3 min-h-0 overflow-hidden">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 grid grid-rows-[auto_minmax(0,1fr)] min-h-0 overflow-hidden">
              <div className="grid grid-cols-[120px_90px_110px_90px_70px_100px] gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <span>CT-e</span>
                <span>Emissão</span>
                <span className="text-right">Vlr. Merc.</span>
                <span className="text-right">Peso</span>
                <span className="text-right">Qtde. Vol.</span>
                <span className="text-right">Frete</span>
              </div>
              <div className="min-h-0 overflow-y-auto">
                {loadingCtes ? (
                  <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando CT-es...
                  </div>
                ) : cteDialogLista.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
                    <Package className="h-6 w-6" />
                    Nenhum CT-e encontrado.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cteDialogLista.map((cte, idx) => (
                      <div
                         key={idx}
                         className="grid grid-cols-[120px_90px_110px_90px_70px_100px] gap-2 px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900/50"
                       >
                         <span className="font-mono text-xs self-center text-slate-700 dark:text-slate-300">{cte.ser_cte}{String(cte.nro_cte).padStart(6, '0')}</span>
                         <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_emissao}</span>
                         <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{fmtBRL(cte.vlr_merc)}</span>
                         <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{fmtKg(cte.peso_real)}</span>
                         <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{fmtNum(cte.qtde_vol)}</span>
                         <span className="self-center text-right font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">{fmtBRL(cte.vlr_frete)}</span>
                       </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {cteDialogTotais && (
              <div className="grid grid-cols-[120px_90px_110px_90px_70px_100px] gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                <span className="text-slate-500 dark:text-slate-400">{cteDialogLista.length} CT-es</span>
                <span />
                <span className="text-right font-mono">{fmtBRL(cteDialogTotais.vlr_merc)}</span>
                <span className="text-right font-mono">{fmtKg(cteDialogTotais.peso_real)}</span>
                <span className="text-right font-mono">{fmtNum(cteDialogTotais.qtde_vol)}</span>
                <span className="text-right font-mono text-indigo-700 dark:text-indigo-300">{fmtBRL(cteDialogTotais.vlr_frete)}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="sm:max-w-[680px] bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Personalize a visualização do faturamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
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
              <Label className="text-slate-900 dark:text-slate-100">Tipo de Frete</Label>
              <div className="flex gap-2">
                {[{ v: '', l: 'Todos' }, { v: 'C', l: 'CIF' }, { v: 'F', l: 'FOB' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setTempFilters({ ...tempFilters, tpFrete: v })}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      tempFilters.tpFrete === v
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-slate-100">Unidade(s) Origem</Label>
              <FilterSelectUnidadeOrdered
                value={tempFilters.siglaEmit}
                onChange={v => setTempFilters({ ...tempFilters, siglaEmit: v })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-slate-100">Unidade(s) Destino</Label>
              <FilterSelectUnidadeOrdered
                value={tempFilters.siglaDest}
                onChange={v => setTempFilters({ ...tempFilters, siglaDest: v })}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-900 dark:text-slate-100">Clientes Pagadores</Label>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Por padrão exibe os 10 maiores. Selecione até 10 clientes específicos.
              </p>
              <Button
                variant="outline"
                className="w-full justify-between dark:border-slate-600 dark:hover:bg-slate-800"
                onClick={() => {
                  setClienteSearch('');
                  setClientesSelecionados(
                    tempFilters.cnpjsPagadores.map(cnpj => {
                      const found = clienteOpcoes.find(c => c.cnpj === cnpj);
                      return found || { cnpj, nome: cnpj, total_frete: 0 };
                    })
                  );
                  setClienteDialogOpen(true);
                }}
              >
                <span className="text-slate-600 dark:text-slate-300">
                  {tempFilters.cnpjsPagadores.length === 0
                    ? 'Top 10 automático'
                    : `${tempFilters.cnpjsPagadores.length} cliente(s) selecionado(s)`}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </Button>
              {tempFilters.cnpjsPagadores.length > 0 && (
                <button
                  className="text-xs text-red-500 hover:underline"
                  onClick={() => setTempFilters({ ...tempFilters, cnpjsPagadores: [] })}
                >
                  Limpar seleção (voltar ao top 10)
                </button>
              )}
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

      <Dialog open={clienteDialogOpen} onOpenChange={setClienteDialogOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[80vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-slate-900 dark:text-slate-100">Selecionar Clientes</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Selecione até 10 clientes. Ordenados por faturamento no período.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-3 min-h-0 overflow-hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <Input
                value={clienteSearch}
                onChange={e => setClienteSearch(e.target.value)}
                placeholder="Buscar por nome..."
                className="pl-9 dark:bg-slate-800 dark:border-slate-700"
              />
            </div>

            {clientesSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {clientesSelecionados.map(c => (
                  <Badge
                    key={c.cnpj}
                    variant="secondary"
                    className="gap-1 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30"
                    onClick={() => toggleClienteSelecionado(c)}
                  >
                    {c.nome.split(' ').slice(0, 2).join(' ')}
                    <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-y-auto min-h-0">
              {loadingClientes ? (
                <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Carregando...</span>
                </div>
              ) : clienteOpcoes.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-slate-400 text-sm">
                  Nenhum cliente encontrado
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {clienteOpcoes.map((c, i) => {
                    const selected = clientesSelecionados.some(x => x.cnpj === c.cnpj);
                    return (
                      <div
                        key={c.cnpj}
                        onClick={() => toggleClienteSelecionado(c)}
                        className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                          selected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                      >
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                          style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                        >
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{c.nome}</p>
                          <p className="text-xs text-slate-400">{fmtBRL(c.total_frete)}</p>
                        </div>
                        {selected && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-slate-500">{clientesSelecionados.length}/10 selecionados</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setClienteDialogOpen(false)} className="dark:border-slate-700">
                  Cancelar
                </Button>
                <Button size="sm" onClick={confirmarClientes} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
