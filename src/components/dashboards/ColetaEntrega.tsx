import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { FilterSelectVeiculo } from './FilterSelectVeiculo';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiFetch } from '../../utils/apiUtils';
import { ENVIRONMENT } from '../../config/environment';
import { toast } from 'sonner';
import {
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  Legend, ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import {
  Loader2, FileSpreadsheet, Truck, Package, PackageCheck,
  Weight, DollarSign, Filter, RefreshCw,
  ChevronUp, ChevronDown, ChevronsUpDown, Building2,
  ChevronRight, FileText,
} from 'lucide-react';

interface Operacao {
  placa: string;
  tipo: string;
  tipoCodigo: string;
  dataBaixa: string;
  ctrc: string;
  nf: string;
  nomeRemetente: string;
  nomeExpedidor: string;
  nomeDestinatario: string;
  nomeRecebedor: string;
  cidadeEntrega: string;
  nomePagador: string;
  romaneio: string;
  pesoCalculo: number;
  qtVol: number;
  valMerc: number;
  vlrFrete: number;
  nroCtrb: string;
}

interface GrupoPlaca {
  placa: string;
  coletas: number;
  entregas: number;
  total: number;
  peso: number;
  frete: number;
  valMerc: number;
  vol: number;
  ctrcs: Operacao[];
}

interface SerieDia {
  data: string;
  coletas: number;
  entregas: number;
  frete: number;
  peso: number;
}

interface Totais {
  coletas: number;
  entregas: number;
  total: number;
  placas: number;
  peso: number;
  frete: number;
  valMerc: number;
  vol: number;
}

type SortField = 'placa' | 'total' | 'coletas' | 'entregas' | 'peso' | 'frete' | 'valMerc';
type SortDir = 'asc' | 'desc';

const COLORS_DONUT = ['#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b', '#ef4444'];

function formatMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function formatNum(v: number, dec = 3) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function formatTon(kg: number) {
  return (kg / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' t';
}

function getDataPadrao() {
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };
  return { ini: fmt(ontem), fin: fmt(hoje) };
}

const parseDateBR = (s: string): Date | null => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return new Date(2000 + parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
};

export function ColetaEntrega() {
  const { user, logout, clientConfig } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const unidadeAtual = user?.unidade_atual || user?.unidade || '';
  const isMTZ = unidadeAtual === 'MTZ';

  const datas = getDataPadrao();
  const [dataIni, setDataIni] = useState(datas.ini);
  const [dataFin, setDataFin] = useState(datas.fin);
  const [placa, setPlaca] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [loadingExcelPlaca, setLoadingExcelPlaca] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const [grupos, setGrupos] = useState<GrupoPlaca[]>([]);
  const [serie, setSerie] = useState<SerieDia[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedPlacas, setExpandedPlacas] = useState<Set<string>>(new Set());

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const toggleExpand = (placa: string) => {
    setExpandedPlacas(prev => {
      const next = new Set(prev);
      next.has(placa) ? next.delete(placa) : next.add(placa);
      return next;
    });
  };

  const gruposOrdenados = [...grupos].sort((a, b) => {
    const va = a[sortField] as number | string;
    const vb = b[sortField] as number | string;
    if (typeof va === 'number' && typeof vb === 'number')
      return sortDir === 'asc' ? va - vb : vb - va;
    return sortDir === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va));
  });

  const handleGerar = async () => {
    if (!dataIni || !dataFin) { toast.error('Informe o período.'); return; }

    const dtIni = parseDateBR(dataIni);
    const dtFin = parseDateBR(dataFin);
    if (!dtIni || !dtFin) { toast.error('Data inválida. Use o formato DD/MM/AA.'); return; }
    if (dtFin < dtIni) { toast.error('A data final não pode ser anterior à data inicial.'); return; }
    const diffDias = Math.round((dtFin.getTime() - dtIni.getTime()) / 86400000);
    if (diffDias > 31) { toast.error('O período não pode ser maior que 31 dias.'); return; }

    setLoading(true);
    setElapsed(0);
    setHasSearched(false);
    setGrupos([]);
    setSerie([]);
    setTotais(null);
    setExpandedPlacas(new Set());

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);

    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/coleta-entrega/get_coleta_entrega.php`,
        { method: 'POST', body: JSON.stringify({ data_ini: dataIni, data_fin: dataFin, placa }) },
        true
      );
      clearInterval(timer);
      setElapsed(0);

      if (res.success) {
        setGrupos(res.grupos ?? []);
        setSerie(res.serieCronologica ?? []);
        setTotais(res.totais ?? null);
        setHasSearched(true);
        if ((res.grupos ?? []).length === 0) toast.info('Nenhuma operação encontrada para o período.');
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
  };

  const exportarExcel = async (ctrcs: Operacao[], placaLabel: string) => {
    const isGeral = placaLabel === 'GERAL';
    if (isGeral) setLoadingExcel(true);
    else setLoadingExcelPlaca(placaLabel);

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/coleta-entrega/exportar_excel.php`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            operacoes: ctrcs,
            totais: isGeral ? totais : {
              total: ctrcs.length,
              coletas: ctrcs.filter(c => c.tipoCodigo === 'C').length,
              entregas: ctrcs.filter(c => c.tipoCodigo === 'E').length,
              peso: ctrcs.reduce((s, c) => s + c.pesoCalculo, 0),
              frete: ctrcs.reduce((s, c) => s + c.vlrFrete, 0),
              valMerc: ctrcs.reduce((s, c) => s + c.valMerc, 0),
              vol: ctrcs.reduce((s, c) => s + c.qtVol, 0),
            },
            filters: { data_ini: dataIni, data_fin: dataFin, unidade: unidadeAtual, placa: isGeral ? '' : placaLabel },
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
      a.download = `coleta_entrega_${isGeral ? 'geral' : placaLabel}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Planilha Excel exportada com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao exportar planilha.');
    } finally {
      setLoadingExcel(false);
      setLoadingExcelPlaca(null);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-blue-400" />
      : <ChevronDown className="h-3 w-3 ml-1 text-blue-400" />;
  };

  const ThH = ({ field, label, right = false }: { field: SortField; label: string; right?: boolean }) => (
    <th
      className={`px-3 py-2 text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-white ${right ? 'text-right' : 'text-left'}`}
      onClick={() => handleSort(field)}
    >
      <span className={`flex items-center ${right ? 'justify-end' : ''}`}>
        {label}<SortIcon field={field} />
      </span>
    </th>
  );

  const donutColetas = totais ? [
    { name: 'Coletas', value: totais.coletas },
    { name: 'Entregas', value: totais.entregas },
  ] : [];

  const top5Placas = [...grupos]
    .sort((a, b) => b.frete - a.frete)
    .slice(0, 5)
    .map(g => ({ placa: g.placa, frete: g.frete, peso: g.peso / 1000 }));

  return (
    <DashboardLayout
      user={user} logout={logout} theme={theme} toggleTheme={toggleTheme}
      navigate={navigate} clientConfig={clientConfig}
      title="COLETA E ENTREGA"
      subtitle="LEVANTAMENTO DE COLETAS E ENTREGAS DA UNIDADE"
    >
      <div className="space-y-6">

        {isMTZ ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
            <Building2 className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Acesso não disponível para a unidade MTZ</p>
            <p className="text-sm mt-1">Faça login em uma unidade específica para visualizar este painel.</p>
          </div>
        ) : (<>

        {/* FILTROS */}
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2 text-base">
              <Filter className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Data Início</Label>
                <Input type="text" value={dataIni} onChange={e => setDataIni(e.target.value)}
                  placeholder="DD/MM/AA" maxLength={8} className="dark:bg-slate-800 dark:border-slate-700 font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Data Fim</Label>
                <Input type="text" value={dataFin} onChange={e => setDataFin(e.target.value)}
                  placeholder="DD/MM/AA" maxLength={8} className="dark:bg-slate-800 dark:border-slate-700 font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Placa (opcional)</Label>
                <FilterSelectVeiculo value={placa} onChange={setPlaca} placeholder="Todas as placas" />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleGerar} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{elapsed > 0 ? `Aguardando... ${elapsed}s` : 'Processando...'}</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Gerar Relatório</>
                  )}
                </Button>
                {hasSearched && (
                  <Button onClick={() => exportarExcel(grupos.flatMap(g => g.ctrcs), 'GERAL')}
                    disabled={loadingExcel || grupos.length === 0} variant="outline"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                    {loadingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>

            {loading && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      Processando informações...
                    </p>
                    <div className="mt-2 bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full animate-pulse w-full" />
                    </div>
                  </div>
                  <span className="text-lg font-mono font-bold text-blue-700 dark:text-blue-300 min-w-[3rem] text-right">{elapsed}s</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {hasSearched && totais && (<>

        {/* CARDS — 3 por linha, 2 linhas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl">
                  <Package className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Coletas</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totais.coletas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                  <PackageCheck className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Entregas</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totais.entregas}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <Truck className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Placas</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totais.placas}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{totais.total} operações</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <Weight className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Peso Total</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatTon(totais.peso)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                  <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Vlr Frete</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatMoeda(totais.frete)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <FileText className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Vlr Mercadoria</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatMoeda(totais.valMerc)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DASHBOARD — gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Donut coletas x entregas */}
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Coletas vs Entregas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={donutColetas} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    dataKey="value" paddingAngle={3} stroke="none">
                    <Cell fill="#f97316" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <RechartTooltip formatter={(v: number, n: string) => [v, n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Linha cronológica de operações */}
          <Card className="lg:col-span-2 dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Operações por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={serie} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <RechartTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="coletas" stroke="#f97316" strokeWidth={2} dot={false} name="Coletas" />
                  <Line type="monotone" dataKey="entregas" stroke="#3b82f6" strokeWidth={2} dot={false} name="Entregas" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top 5 placas por frete */}
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Top 5 Placas — Frete</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={top5Placas} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTop5" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v != null ? `R$${(Number(v)/1000).toFixed(0)}k` : ''} />
                  <YAxis type="category" dataKey="placa" tick={{ fontSize: 10, fill: '#94a3b8' }} width={65} />
                  <RechartTooltip formatter={(v: number) => [formatMoeda(v), 'Frete']}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="frete" fill="url(#gradTop5)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Frete por dia */}
          <Card className="lg:col-span-2 dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Frete por Dia (R$)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={serie} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradFreteDia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => v != null ? `R$${(Number(v)/1000).toFixed(0)}k` : ''} />
                  <RechartTooltip formatter={(v: number) => [formatMoeda(v), 'Frete']}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="frete" stroke="#3b82f6" strokeWidth={2.5}
                    fill="url(#gradFreteDia)" dot={false} name="Frete" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* TABELA AGRUPADA POR PLACA */}
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Operações por Placa
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  {grupos.length} {grupos.length === 1 ? 'placa' : 'placas'}
                </span>
                <Button onClick={() => exportarExcel(grupos.flatMap(g => g.ctrcs), 'GERAL')}
                  disabled={loadingExcel} size="sm" variant="outline"
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                  {loadingExcel
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exportando...</>
                    : <><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Tudo</>}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 dark:bg-slate-950">
                    <th className="px-3 py-2 w-8" />
                    <ThH field="placa" label="Placa" />
                    <ThH field="coletas" label="Coletas" right />
                    <ThH field="entregas" label="Entregas" right />
                    <ThH field="total" label="Total" right />
                    <ThH field="peso" label="Peso (t)" right />
                    <ThH field="frete" label="Vlr Frete" right />
                    <ThH field="valMerc" label="Vlr Merc" right />
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Excel</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposOrdenados.map((g, idx) => {
                    const expanded = expandedPlacas.has(g.placa);
                    return (
                      <React.Fragment key={g.placa}>
                        <tr
                          className={`border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${idx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/50'}`}
                          onClick={() => toggleExpand(g.placa)}
                        >
                          <td className="px-3 py-2 text-slate-400">
                            {expanded
                              ? <ChevronDown className="h-4 w-4" />
                              : <ChevronRight className="h-4 w-4" />}
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">{g.placa}</td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300 dark:border-orange-800 text-xs">{g.coletas}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800 text-xs">{g.entregas}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-700 dark:text-slate-300">{g.total}</td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatTon(g.peso)}</td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatMoeda(g.frete)}</td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatMoeda(g.valMerc)}</td>
                          <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                            <Button size="sm" variant="ghost"
                              disabled={loadingExcelPlaca === g.placa}
                              onClick={() => exportarExcel(g.ctrcs, g.placa)}
                              className="h-7 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                              {loadingExcelPlaca === g.placa
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <FileSpreadsheet className="h-3.5 w-3.5" />}
                            </Button>
                          </td>
                        </tr>

                        {expanded && (
                          <tr className="bg-slate-50 dark:bg-slate-950/60">
                            <td colSpan={9} className="p-0">
                              <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-700">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-slate-700 dark:bg-slate-900">
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">Data</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">Tipo</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">CTRC</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">NF</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">Remetente</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">Destinatário</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">Cidade</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">Pagador</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">Romaneio</th>
                                      <th className="px-3 py-1.5 text-right text-slate-300 font-medium whitespace-nowrap">Peso (kg)</th>
                                      <th className="px-3 py-1.5 text-right text-slate-300 font-medium whitespace-nowrap">Vol</th>
                                      <th className="px-3 py-1.5 text-right text-slate-300 font-medium whitespace-nowrap">Vlr Merc</th>
                                      <th className="px-3 py-1.5 text-right text-slate-300 font-medium whitespace-nowrap">Vlr Frete</th>
                                      <th className="px-3 py-1.5 text-left text-slate-300 font-medium whitespace-nowrap">CTRB/OS</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {g.ctrcs.map((op, i) => (
                                      <tr key={i} className={`border-b border-slate-200 dark:border-slate-800 ${op.tipoCodigo === 'C' ? 'bg-orange-50/40 dark:bg-orange-900/5' : i % 2 === 0 ? 'bg-white dark:bg-slate-900/40' : 'bg-blue-50/20 dark:bg-blue-900/5'}`}>
                                        <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{op.dataBaixa}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">
                                          <Badge variant="outline" className={`text-[10px] ${op.tipoCodigo === 'C' ? 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-300' : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300'}`}>
                                            {op.tipo}
                                          </Badge>
                                        </td>
                                        <td className="px-3 py-1.5 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">{op.ctrc}</td>
                                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{op.nf}</td>
                                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 max-w-[140px] truncate" title={op.nomeRemetente}>{op.nomeRemetente}</td>
                                        <td className="px-3 py-1.5 text-slate-700 dark:text-slate-300 max-w-[140px] truncate" title={op.nomeDestinatario}>{op.nomeDestinatario}</td>
                                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">{op.cidadeEntrega}</td>
                                        <td className="px-3 py-1.5 text-slate-600 dark:text-slate-400 max-w-[120px] truncate" title={op.nomePagador}>{op.nomePagador}</td>
                                        <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{op.romaneio}</td>
                                        <td className="px-3 py-1.5 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNum(op.pesoCalculo)}</td>
                                        <td className="px-3 py-1.5 text-right text-slate-700 dark:text-slate-300">{op.qtVol}</td>
                                        <td className="px-3 py-1.5 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatMoeda(op.valMerc)}</td>
                                        <td className="px-3 py-1.5 text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatMoeda(op.vlrFrete)}</td>
                                        <td className="px-3 py-1.5 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{op.nroCtrb || '-'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot>
                                    <tr className="bg-slate-700 dark:bg-slate-900 font-semibold">
                                      <td colSpan={9} className="px-3 py-1.5 text-xs text-slate-200">
                                        {g.total} operações ({g.coletas} coletas / {g.entregas} entregas)
                                      </td>
                                      <td className="px-3 py-1.5 text-right text-xs text-slate-200 whitespace-nowrap">{formatNum(g.peso)}</td>
                                      <td className="px-3 py-1.5 text-right text-xs text-slate-200">{g.vol}</td>
                                      <td className="px-3 py-1.5 text-right text-xs text-slate-200 whitespace-nowrap">{formatMoeda(g.valMerc)}</td>
                                      <td className="px-3 py-1.5 text-right text-xs text-emerald-300 whitespace-nowrap">{formatMoeda(g.frete)}</td>
                                      <td />
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                {totais && (
                  <tfoot>
                    <tr className="bg-slate-800 dark:bg-slate-950 font-semibold">
                      <td colSpan={2} className="px-3 py-2 text-xs text-slate-200">
                        TOTAL — {totais.placas} placas / {totais.total} operações
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-orange-300">{totais.coletas}</td>
                      <td className="px-3 py-2 text-right text-xs text-blue-300">{totais.entregas}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-200">{totais.total}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-200 whitespace-nowrap">{formatTon(totais.peso)}</td>
                      <td className="px-3 py-2 text-right text-xs text-emerald-300 whitespace-nowrap">{formatMoeda(totais.frete)}</td>
                      <td className="px-3 py-2 text-right text-xs text-slate-200 whitespace-nowrap">{formatMoeda(totais.valMerc)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </CardContent>
        </Card>

        </>)}

        </>)}
      </div>
    </DashboardLayout>
  );
}
