import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';

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
  cidade_dest: string;
  peso_real: number;
  vlr_merc: number;
  vlr_frete: number;
  qt_vol: number;
  ult_ocor: string;
  is_ativo: boolean; // true se ult_ocor for 82
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

function getPeriodoPadrao() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };
  return { ini: fmt(inicioMes), fin: fmt(hoje) };
}

const parseDateBR = (s: string): Date | null => {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
  if (!m) return null;
  return new Date(2000 + parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
};

export function PainelRetidos() {
  const { user, logout, clientConfig } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const unidadeAtual = user?.unidade_atual || user?.unidade || '';
  const isMTZ = unidadeAtual === 'MTZ';

  const periodo = getPeriodoPadrao();
  const [dataIni, setDataIni] = useState(periodo.ini);
  const [dataFin, setDataFin] = useState(periodo.fin);
  const [unidades, setUnidades] = useState<string[]>(isMTZ ? [] : [unidadeAtual]);

  const [loading, setLoading] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [ctesRetidos, setCtesRetidos] = useState<CteRetido[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [serie, setSerie] = useState<SerieDia[]>([]);
  const [topClientes, setTopClientes] = useState<TopCliente[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleGerar = async () => {
    if (!dataIni || !dataFin) { toast.error('Informe o período de ocorrência.'); return; }

    const dtIni = parseDateBR(dataIni);
    const dtFin = parseDateBR(dataFin);
    if (!dtIni || !dtFin) { toast.error('Data inválida. Use o formato DD/MM/AA.'); return; }
    if (dtFin < dtIni) { toast.error('A data final não pode ser anterior à data inicial.'); return; }
    const diffDias = Math.round((dtFin.getTime() - dtIni.getTime()) / 86400000);
    if (diffDias > 90) { toast.error('O período não pode ser maior que 90 dias.'); return; }

    setLoading(true);
    setElapsed(0);
    setHasSearched(false);
    setCtesRetidos([]);
    setSerie([]);
    setTotais(null);
    setTopClientes([]);

    const timer = setInterval(() => setElapsed(e => e + 1), 1000);

    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/painel-retidos/get_dados.php`,
        { method: 'POST', body: JSON.stringify({ data_ini: dataIni, data_fin: dataFin, unidades }) },
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
        if ((res.ctes_retidos ?? []).length === 0) toast.info('Nenhum CT-e retido encontrado para o período.');
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
            filters: { data_ini: dataIni, data_fin: dataFin, unidades },
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

  const donutData = totais ? [
    { name: 'Retidos Ativos', value: totais.retidos_ativos },
    { name: 'Resolvidos', value: totais.retidos_resolvidos },
  ] : [];

  return (
    <DashboardLayout
      user={user} logout={logout} theme={theme} toggleTheme={toggleTheme}
      navigate={navigate} clientConfig={clientConfig}
      title="PAINEL DE RETIDOS"
      subtitle="VOLUME DE CARGAS RETIDOS FISCALMENTE OU POR CLIENTES"
    >
      <div className="space-y-6">

        {/* FILTROS */}
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2 text-base">
              <Filter className="h-5 w-5 text-red-600 dark:text-red-400" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Período de Ocorrência (Início)
                </Label>
                <Input type="text" value={dataIni} onChange={e => setDataIni(e.target.value)}
                  placeholder="DD/MM/AA" maxLength={8} className="dark:bg-slate-800 dark:border-slate-700 font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400">
                  Período de Ocorrência (Fim)
                </Label>
                <Input type="text" value={dataFin} onChange={e => setDataFin(e.target.value)}
                  placeholder="DD/MM/AA" maxLength={8} className="dark:bg-slate-800 dark:border-slate-700 font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  Unidade(s) Origem
                </Label>
                <FilterSelectUnidadeOrdered
                  value={unidades}
                  onChange={setUnidades}
                  disabled={!isMTZ}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleGerar} disabled={loading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{elapsed > 0 ? `Aguardando... ${elapsed}s` : 'Processando...'}</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Gerar Relatório</>
                  )}
                </Button>
                {hasSearched && (
                  <Button onClick={exportarExcel}
                    disabled={loadingExcel || ctesRetidos.length === 0} variant="outline"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                    {loadingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>

            {loading && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-red-600 dark:text-red-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                      Processando informações de retidos...
                    </p>
                    <div className="mt-2 bg-red-200 dark:bg-red-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-red-600 dark:bg-red-400 h-2 rounded-full animate-pulse w-full" />
                    </div>
                  </div>
                  <span className="text-lg font-mono font-bold text-red-700 dark:text-red-300 min-w-[3rem] text-right">{elapsed}s</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {hasSearched && totais && (<>

        {/* CARDS DE TOTAIS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="dark:bg-slate-900/90 dark:border-slate-700 border-l-4 border-l-red-500">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-xl">
                  <PackageX className="h-6 w-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Retidos Ativos</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totais.retidos_ativos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700 border-l-4 border-l-emerald-500">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                  <PackageCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Resolvidos</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totais.retidos_resolvidos}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700 border-l-4 border-l-slate-500">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <FileText className="h-6 w-6 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Total Retidos</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totais.total_retidos}</p>
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
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatTon(totais.peso_total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                  <DollarSign className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Vlr Mercadoria</p>
                  <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{formatMoeda(totais.vlr_merc_total)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                  <Users className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide font-medium">Clientes</p>
                  <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{totais.total_clientes}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* DASHBOARD — gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Donut ativos x resolvidos */}
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Status dos Retidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                    dataKey="value" paddingAngle={3} stroke="none">
                    {donutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS_DONUT[index % COLORS_DONUT.length]} />
                    ))}
                  </Pie>
                  <RechartTooltip formatter={(v: number, n: string) => [v, n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Linha cronológica de retidos por dia */}
          <Card className="lg:col-span-2 dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Retidos e Resolvidos por Dia</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={serie} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <RechartTooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="retidos" stroke="#ef4444" strokeWidth={2} dot={false} name="Retidos" />
                  <Line type="monotone" dataKey="resolvidos" stroke="#10b981" strokeWidth={2} dot={false} name="Resolvidos" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top 5 clientes com mais retidos */}
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Top 5 Clientes — Retidos</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topClientes} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTop5" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis type="category" dataKey="nome" tick={{ fontSize: 10, fill: '#94a3b8' }} width={100} />
                  <RechartTooltip formatter={(v: number) => [v, 'Retidos']}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="quantidade" fill="url(#gradTop5)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Vlr Mercadoria por dia */}
          <Card className="lg:col-span-2 dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-700 dark:text-slate-300">Peso Retido por Dia (ton)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={serie} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradPesoDia" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                  <XAxis dataKey="data" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <RechartTooltip formatter={(v: number) => [formatTon(v), 'Peso']}
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="peso" stroke="#f97316" strokeWidth={2.5}
                    fill="url(#gradPesoDia)" dot={false} name="Peso (kg)" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* TABELA DE CT-E RETIDOS */}
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-red-600 dark:text-red-400" />
                CT-e Retidos
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                  {ctesRetidos.length} {ctesRetidos.length === 1 ? 'CT-e' : 'CT-es'}
                </span>
                <Button onClick={exportarExcel}
                  disabled={loadingExcel} size="sm" variant="outline"
                  className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-900/20">
                  {loadingExcel
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exportando...</>
                    : <><FileSpreadsheet className="h-4 w-4 mr-2" />Exportar Excel</>}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 dark:bg-slate-950">
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left whitespace-nowrap">CT-e</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left whitespace-nowrap">Emissão</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left whitespace-nowrap">Ocorrência 82</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Status</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Un. Emit</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Remetente</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Destinatário</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-left">Pagador</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Peso (kg)</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Vol</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Vlr Merc</th>
                    <th className="px-3 py-2 text-xs font-semibold text-slate-300 uppercase text-right whitespace-nowrap">Vlr Frete</th>
                  </tr>
                </thead>
                <tbody>
                  {ctesRetidos.map((cte, idx) => (
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
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={cte.nome_remetente}>{cte.nome_remetente}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={cte.nome_destinatario}>{cte.nome_destinatario}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={cte.nome_pagador}>{cte.nome_pagador}</td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatNum(cte.peso_real)}</td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.qt_vol}</td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">{formatMoeda(cte.vlr_merc)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{formatMoeda(cte.vlr_frete)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        </>)}

      </div>
    </DashboardLayout>
  );
}
