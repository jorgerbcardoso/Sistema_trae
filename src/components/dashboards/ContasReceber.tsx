import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  Pie,
  PieChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AlertTriangle, BadgeDollarSign, CalendarClock, Download, Filter, HandCoins, Loader2, PieChart as PieChartIcon, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { BuscadorClientes } from '../cadastros/BuscadorClientes';

type TabKey = 'visao_geral' | 'a_receber' | 'aging_a_receber' | 'faturas_vencidas' | 'aging_vencidos' | 'a_faturar';

type Ssw0103Row = {
  em: string;
  ctrc: string;
  numero_cte: string;
  pagador: string;
  cnpj_pagador: string;
  cob: string;
  dest: string;
  banco: string;
  frete: number;
  emissao: string;
  nfiscal: string;
  tip: string;
  pre_fatu: string;
  ult_ocor: string;
  chave_cte: string;
  data_entrega: string;
  prev_entrega: string;
  comp_entrega_escaneado: string;
  observacao: string;
};

type Ssw0103Data = {
  meta: {
    programa: string;
    ontem_dmy: string;
    act: string;
    filename: string;
    updated_at: string | null;
    gerado_em: string;
  };
  totals: {
    ctes: number;
    frete_total: number;
  };
  rows: Ssw0103Row[];
};

type FatCte = {
  fatura: string;
  emissao_fatura: string;
  ctrc: string;
  cte: string;
  data_emissao: string;
  data_autorizacao: string;
  valor_frete: number;
  lote_contabil: string;
  valor_contabil: number;
};

type FatFatura = {
  fatura: string;
  cnpj: string;
  cliente: string;
  tipo_cobranca: string;
  banco_carteira: string;
  periodicidade: string;
  fil: string;
  emissao: string;
  vencimento: string;
  pagamento: string;
  dias_atraso: string;
  situacao: string;
  vlr_fatur: number;
  vlr_pago: number;
  saldo: number;
  ultima_ocorrencia: string;
  unidade_responsavel: string;
  vendedor: string;
  ctes: FatCte[];
  ctes_total_frete: number;
  ctes_total_contabil: number;
};

type FatData = {
  totals: {
    faturas: number;
    ctes: number;
    vlr_fatur_total: number;
    saldo_total: number;
    frete_ctes_total: number;
  };
  faturas: FatFatura[];
  updated_at: string | null;
};

type FatResponse =
  | { success: true; status: 'ready'; result: 'data'; data: FatData; meta?: any }
  | { success: true; status: 'ready'; result: 'empty'; data: FatData; meta?: any }
  | { success: true; status: 'started'; baseline_seq: number; request_start_ts: number; meta?: any }
  | { success: true; status: 'pending' }
  | { success: true; status: 'ready'; result: 'links'; acts: string[]; ssw_seq?: number }
  | { success: false; message?: string; debug?: any };

type ClienteSel = { cnpj: string; nome: string };

function dateToInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateBr(dmy: string): number | null {
  const s = String(dmy ?? '').trim();
  let m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  let dd: number;
  let mm: number;
  let yyyy: number;
  if (m) {
    dd = parseInt(m[1], 10);
    mm = parseInt(m[2], 10);
    yyyy = parseInt(m[3], 10);
  } else {
    m = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (!m) return null;
    dd = parseInt(m[1], 10);
    mm = parseInt(m[2], 10);
    const yy = parseInt(m[3], 10);
    yyyy = yy >= 80 ? 1900 + yy : 2000 + yy;
  }
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  const dt = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
  const ts = dt.getTime();
  return Number.isFinite(ts) ? ts : null;
}

function formatCurrency(v: number): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(v: number, digits = 0): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function csvEscape(v: any): string {
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(';') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const COLORS = ['#2563eb', '#16a34a', '#f97316', '#a855f7', '#06b6d4', '#ef4444', '#84cc16', '#64748b', '#0f172a'];

export function ContasReceber() {
  const today0 = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0).getTime();
  }, []);

  const [tab, setTab] = useState<TabKey>('visao_geral');
  const [periodoTipo, setPeriodoTipo] = useState<'E' | 'V' | 'L' | 'X'>('V');
  const defaultPeriodo = useMemo(() => {
    const start = new Date();
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { ini: dateToInput(start), fim: dateToInput(end) };
  }, []);
  const [periodoIni, setPeriodoIni] = useState<string>(defaultPeriodo.ini);
  const [periodoFim, setPeriodoFim] = useState<string>(defaultPeriodo.fim);
  const [sitFatura, setSitFatura] = useState<'P' | 'L' | 'E' | 'C' | 'T'>('T');
  const [clientePagador, setClientePagador] = useState<ClienteSel>({ cnpj: '', nome: '' });
  const [clienteGrupo, setClienteGrupo] = useState<ClienteSel>({ cnpj: '', nome: '' });
  const [tableSearch, setTableSearch] = useState('');
  const [quickView, setQuickView] = useState<'todas' | 'abertas' | 'vencidas' | 'vence3d'>('todas');
  const [showFilters, setShowFilters] = useState(false);
  const defaultFilters = useMemo(
    () => ({
      periodoTipo: 'V' as const,
      periodoIni: defaultPeriodo.ini,
      periodoFim: defaultPeriodo.fim,
      sitFatura: 'T' as const,
      clientePagador: { cnpj: '', nome: '' } as ClienteSel,
      clienteGrupo: { cnpj: '', nome: '' } as ClienteSel,
    }),
    [defaultPeriodo.fim, defaultPeriodo.ini]
  );
  const [tempPeriodoTipo, setTempPeriodoTipo] = useState<'E' | 'V' | 'L' | 'X'>(defaultFilters.periodoTipo);
  const [tempPeriodoIni, setTempPeriodoIni] = useState<string>(defaultFilters.periodoIni);
  const [tempPeriodoFim, setTempPeriodoFim] = useState<string>(defaultFilters.periodoFim);
  const [tempSitFatura, setTempSitFatura] = useState<'P' | 'L' | 'E' | 'C' | 'T'>(defaultFilters.sitFatura);
  const [tempClientePagador, setTempClientePagador] = useState<ClienteSel>(defaultFilters.clientePagador);
  const [tempClienteGrupo, setTempClienteGrupo] = useState<ClienteSel>(defaultFilters.clienteGrupo);

  const [loading0049, setLoading0049] = useState(false);
  const [status0049, setStatus0049] = useState<string>('');
  const [data0049, setData0049] = useState<FatData | null>(null);
  const req0049Ref = useRef(0);
  const initialLoadRef = useRef(false);

  const [loading0103, setLoading0103] = useState(false);
  const [status0103, setStatus0103] = useState<string>('');
  const [data0103, setData0103] = useState<Ssw0103Data | null>(null);
  const initialLoad0103Ref = useRef(false);
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRows, setDrillRows] = useState<FatFatura[]>([]);

  const [rankGroupBy, setRankGroupBy] = useState<'grupos' | 'clientes'>('grupos');
  const [grupoMap, setGrupoMap] = useState<Record<string, { cnpj_principal: string; nome_principal: string; is_grupo: boolean }>>({});
  const lastGrupoFetchKeyRef = useRef<string>('');

  const abrirDrill = useCallback((title: string, rows: FatFatura[]) => {
    setDrillTitle(title);
    setDrillRows(rows);
    setDrillOpen(true);
  }, []);

  const buildCsvFaturas = useCallback((rows: FatFatura[]) => {
    const header = [
      'Fatura',
      'CNPJ',
      'Cliente',
      'Tipo cobrança',
      'Banco/Carteira',
      'Periodicidade',
      'Unidade (FIL)',
      'Emissão',
      'Vencimento',
      'Pagamento',
      'Situação',
      'Valor Faturado',
      'Valor Pago',
      'Saldo',
      'CT-es',
      'Frete CT-es',
      'Última ocorrência',
      'Unidade responsável',
      'Vendedor',
    ];
    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(';'));
    for (const r of rows) {
      lines.push(
        [
          r.fatura,
          r.cnpj,
          r.cliente,
          r.tipo_cobranca,
          r.banco_carteira,
          r.periodicidade,
          r.fil,
          r.emissao,
          r.vencimento,
          r.pagamento,
          r.situacao,
          formatCurrency(r.vlr_fatur),
          formatCurrency(r.vlr_pago),
          formatCurrency(r.saldo),
          formatNumber(r.ctes?.length || 0),
          formatCurrency(r.ctes_total_frete || 0),
          r.ultima_ocorrencia,
          r.unidade_responsavel,
          r.vendedor,
        ]
          .map(csvEscape)
          .join(';')
      );
    }
    return lines.join('\n');
  }, []);

  const carregar0049 = useCallback(async (override?: {
    periodoTipo: 'E' | 'V' | 'L' | 'X';
    periodoIni: string;
    periodoFim: string;
    sitFatura: 'P' | 'L' | 'E' | 'C' | 'T';
    clientePagadorCnpj: string;
    clienteGrupoCnpj: string;
  }) => {
    const reqId = (req0049Ref.current += 1);
    setLoading0049(true);
    setStatus0049('Lendo faturamento...');
    try {
      const f = override || {
        periodoTipo,
        periodoIni,
        periodoFim,
        sitFatura,
        clientePagadorCnpj: clientePagador.cnpj,
        clienteGrupoCnpj: clienteGrupo.cnpj,
      };
      const payload = {
        step: 'START',
        rel_ana_fg_data: f.periodoTipo,
        rel_ana_per_pesq_ini: f.periodoIni,
        rel_ana_per_pesq_fin: f.periodoFim,
        rel_ana_cgc: f.clientePagadorCnpj,
        rel_ana_cgc_grupo: f.clienteGrupoCnpj,
        rel_ana_sit_fat: f.sitFatura,
      };
      const start = (await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/contas-receber/ssw0049.php`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }, true)) as FatResponse;
      if (reqId !== req0049Ref.current) return;

      if (!start?.success) {
        toast.error(start?.message || 'Falha ao ler faturamento.');
        return;
      }

      if ((start as any).status === 'ready' && (start as any).result === 'data') {
        setData0049((start as any).data || null);
        setStatus0049('Concluído');
        return;
      }

      if ((start as any).status === 'ready' && (start as any).result === 'empty') {
        setData0049((start as any).data || null);
        setStatus0049('Sem registros');
        return;
      }

      if ((start as any).status !== 'started') {
        toast.error('Resposta inesperada ao ler faturamento.');
        return;
      }

      const baselineSeq = Number((start as any).baseline_seq) || 0;
      const requestStartTs = Number((start as any).request_start_ts) || 0;
      const deadline = Date.now() + 70000;

      setStatus0049('Processando relatório...');

      while (Date.now() < deadline) {
        if (reqId !== req0049Ref.current) return;
        const poll = (await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/contas-receber/ssw0049.php`, {
          method: 'POST',
          body: JSON.stringify({ ...payload, step: 'POLL', baseline_seq: baselineSeq, request_start_ts: requestStartTs }),
        }, true)) as FatResponse;

        if (reqId !== req0049Ref.current) return;
        if (!poll?.success) {
          toast.error(poll?.message || 'Falha ao processar relatório.');
          return;
        }

        if ((poll as any).status === 'pending') {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }

        if ((poll as any).status === 'ready' && (poll as any).result === 'empty') {
          setData0049({
            totals: { faturas: 0, ctes: 0, vlr_fatur_total: 0, saldo_total: 0, frete_ctes_total: 0 },
            faturas: [],
            updated_at: null,
          });
          setStatus0049('Sem registros');
          return;
        }

        if ((poll as any).status === 'ready' && (poll as any).result === 'links') {
          const acts = (poll as any).acts || [];
          if (!Array.isArray(acts) || acts.length === 0) {
            toast.error('Relatório concluído, mas sem links de download.');
            return;
          }

          setStatus0049('Baixando relatório...');
          const dl = (await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/contas-receber/ssw0049.php`, {
            method: 'POST',
            body: JSON.stringify({ step: 'DOWNLOAD', act: acts[0] }),
          }, true)) as FatResponse;

          if (reqId !== req0049Ref.current) return;
          if (!dl?.success || (dl as any).result !== 'data') {
            toast.error((dl as any)?.message || 'Falha ao baixar/processar relatório.');
            return;
          }

          setData0049((dl as any).data || null);
          setStatus0049('Concluído');
          return;
        }

        toast.error('Resposta inesperada ao processar relatório.');
        return;
      }

      toast.error('Timeout ao processar relatório.');
    } finally {
      if (reqId === req0049Ref.current) setLoading0049(false);
    }
  }, [clienteGrupo.cnpj, clientePagador.cnpj, periodoFim, periodoIni, periodoTipo, sitFatura]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar0049();
  }, [carregar0049]);

  const carregar0103 = useCallback(
    async (opts?: { silent?: boolean }) => {
      setLoading0103(true);
      setStatus0103('Lendo disponíveis para faturar...');
      try {
        const res = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/contas-receber/ssw0103.php`, { method: 'GET' }, true);
        if (!res?.success) {
          setStatus0103('');
          if (!opts?.silent) toast.error(res?.message || 'Falha ao ler disponíveis para faturar.');
          return;
        }
        setData0103(res);
        setStatus0103('Concluído');
        if (!opts?.silent) toast.success(`Disponíveis para faturar: ${Number(res?.totals?.ctes || 0)} CT-e(s).`);
      } finally {
        setLoading0103(false);
      }
    },
    []
  );

  useEffect(() => {
    if (initialLoad0103Ref.current) return;
    initialLoad0103Ref.current = true;
    const t = window.setTimeout(() => {
      void carregar0103({ silent: true });
    }, 250);
    return () => window.clearTimeout(t);
  }, [carregar0103]);

  const normalizedFaturas = useMemo(() => {
    const base = data0049?.faturas || [];
    return base.map((f) => {
      const vencTs = parseDateBr(f.vencimento);
      const saldo = Number(f.saldo) || 0;
      const vlrFatur = Number(f.vlr_fatur) || 0;
      const pago = Number(f.vlr_pago) || 0;
      const venc0 = vencTs !== null ? new Date(vencTs).setHours(0, 0, 0, 0) : null;
      const diasAtrasoRaw = String((f as any)?.dias_atraso ?? '').trim();
      const diasAtrasoNum = Number.parseInt(diasAtrasoRaw.replace(/[^\d-]+/g, ''), 10);
      const situacaoUp = String((f as any)?.situacao ?? '').trim().toUpperCase();

      const overdueBySignals = (Number.isFinite(diasAtrasoNum) && diasAtrasoNum > 0) || situacaoUp.includes('ATRAS');
      const overdueByDate = venc0 !== null && venc0 < today0;
      const overdue = saldo > 0 && (overdueByDate || overdueBySignals);

      const dueSoon = saldo > 0 && venc0 !== null && venc0 >= today0 && venc0 <= today0 + 3 * 86400000;
      return {
        ...f,
        _vencTs0: venc0,
        _saldo: saldo,
        _vlrFatur: vlrFatur,
        _pago: pago,
        _overdue: overdue,
        _dueSoon: dueSoon,
      };
    });
  }, [data0049, today0]);

  useEffect(() => {
    const cnpjs = Array.from(
      new Set(
        (normalizedFaturas as any[])
          .map((f) => String(f?.cnpj || '').replace(/\D+/g, ''))
          .filter((x) => x.length === 14)
      )
    );
    const key = cnpjs.sort().join(',');
    if (!key) {
      if (lastGrupoFetchKeyRef.current !== '') {
        lastGrupoFetchKeyRef.current = '';
        setGrupoMap({});
      }
      return;
    }
    if (key === lastGrupoFetchKeyRef.current) return;
    lastGrupoFetchKeyRef.current = key;
    void (async () => {
      try {
        const res = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/dashboards/contas-receber/grupos_pagadores.php`,
          { method: 'POST', body: JSON.stringify({ cnpjs }) },
          true
        );
        if (res?.success && res?.data?.items) {
          const map: Record<string, { cnpj_principal: string; nome_principal: string; is_grupo: boolean }> = {};
          for (const it of res.data.items as any[]) {
            const cnpj = String(it?.cnpj || '').replace(/\D+/g, '');
            if (!cnpj) continue;
            map[cnpj] = {
              cnpj_principal: String(it?.cnpj_principal || cnpj).replace(/\D+/g, ''),
              nome_principal: String(it?.nome_principal || '').trim(),
              is_grupo: !!it?.is_grupo,
            };
          }
          setGrupoMap(map);
        }
      } catch {
        setGrupoMap({});
      }
    })();
  }, [normalizedFaturas]);

  const filteredFaturas = useMemo(() => {
    let baseList: any[] = normalizedFaturas as any[];
    if (quickView === 'abertas') baseList = baseList.filter((f) => (Number(f._saldo) || 0) > 0);
    if (quickView === 'vencidas') baseList = baseList.filter((f) => f._overdue && (Number(f._saldo) || 0) > 0);
    if (quickView === 'vence3d') baseList = baseList.filter((f) => f._dueSoon && (Number(f._saldo) || 0) > 0);
    const q = tableSearch.trim().toUpperCase();
    if (!q) return baseList;
    return baseList.filter((f: any) => {
      const hay = [
        f.fatura,
        f.cnpj,
        f.cliente,
        f.tipo_cobranca,
        f.banco_carteira,
        f.periodicidade,
        f.fil,
        f.emissao,
        f.vencimento,
        f.pagamento,
        f.situacao,
        f.unidade_responsavel,
        f.vendedor,
        f.ultima_ocorrencia,
      ]
        .join(' ')
        .toUpperCase();
      return hay.includes(q);
    });
  }, [normalizedFaturas, quickView, tableSearch]);

  const kpis = useMemo(() => {
    const base = {
      faturas: filteredFaturas.length,
      ctes: 0,
      valorFaturado: 0,
      pago: 0,
      aReceber: 0,
      atrasado: 0,
      noPrazo: 0,
      dueSoon: 0,
    };
    for (const f of filteredFaturas as any[]) {
      base.valorFaturado += Number(f._vlrFatur) || 0;
      base.pago += Number(f._pago) || 0;
      const saldo = Number(f._saldo) || 0;
      if (saldo > 0) base.aReceber += saldo;
      if (saldo > 0 && f._overdue) base.atrasado += saldo;
      if (saldo > 0 && !f._overdue) base.noPrazo += saldo;
      if (saldo > 0 && f._dueSoon) base.dueSoon += saldo;
      base.ctes += Array.isArray(f.ctes) ? f.ctes.length : 0;
    }
    const inad = base.aReceber > 0 ? (base.atrasado / base.aReceber) * 100 : 0;
    return { ...base, inadimplenciaPct: inad };
  }, [filteredFaturas]);

  const previsaoSerie30d = useMemo(() => {
    const sums = new Array(31).fill(0) as number[];
    for (const f of filteredFaturas as any[]) {
      const saldo = Number(f._saldo) || 0;
      if (saldo <= 0 || f._overdue) continue;
      const ts = Number(f._vencTs0);
      if (!Number.isFinite(ts)) continue;
      const dayIndex = Math.floor((ts - today0) / 86400000);
      if (dayIndex < 0 || dayIndex > 30) continue;
      sums[dayIndex] += saldo;
    }
    const series = [];
    let has = false;
    for (let i = 0; i <= 30; i += 1) {
      const dt = new Date(today0 + i * 86400000);
      const label = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
      const v = Math.round((Number(sums[i]) || 0) * 100) / 100;
      if (v > 0) has = true;
      series.push({ name: label, value: v });
    }
    return { has, series };
  }, [filteredFaturas, today0]);

  const Tile = ({
    label,
    value,
    sub,
    tone,
    Icon,
  }: {
    label: string;
    value: string;
    sub: string;
    tone: 'indigo' | 'emerald' | 'blue' | 'rose' | 'amber' | 'orange';
    Icon: any;
  }) => {
    const toneMap: Record<string, { border: string; bg: string; icon: string; iconBg: string; iconBorder: string }> = {
      indigo: {
        border: 'border-indigo-200 dark:border-indigo-900/70',
        bg: 'bg-indigo-50 dark:bg-indigo-950/25',
        icon: 'text-indigo-700 dark:text-indigo-300',
        iconBg: 'bg-indigo-100/70 dark:bg-indigo-950/45',
        iconBorder: 'border-indigo-200 dark:border-indigo-900/60',
      },
      emerald: {
        border: 'border-emerald-200 dark:border-emerald-900/70',
        bg: 'bg-emerald-50 dark:bg-emerald-950/25',
        icon: 'text-emerald-700 dark:text-emerald-300',
        iconBg: 'bg-emerald-100/70 dark:bg-emerald-950/45',
        iconBorder: 'border-emerald-200 dark:border-emerald-900/60',
      },
      blue: {
        border: 'border-blue-200 dark:border-blue-900/70',
        bg: 'bg-blue-50 dark:bg-blue-950/25',
        icon: 'text-blue-700 dark:text-blue-300',
        iconBg: 'bg-blue-100/70 dark:bg-blue-950/45',
        iconBorder: 'border-blue-200 dark:border-blue-900/60',
      },
      rose: {
        border: 'border-rose-200 dark:border-rose-900/70',
        bg: 'bg-rose-50 dark:bg-rose-950/25',
        icon: 'text-rose-700 dark:text-rose-300',
        iconBg: 'bg-rose-100/70 dark:bg-rose-950/45',
        iconBorder: 'border-rose-200 dark:border-rose-900/60',
      },
      amber: {
        border: 'border-amber-200 dark:border-amber-900/70',
        bg: 'bg-amber-50 dark:bg-amber-950/25',
        icon: 'text-amber-700 dark:text-amber-300',
        iconBg: 'bg-amber-100/70 dark:bg-amber-950/45',
        iconBorder: 'border-amber-200 dark:border-amber-900/60',
      },
      orange: {
        border: 'border-orange-200 dark:border-orange-900/70',
        bg: 'bg-orange-50 dark:bg-orange-950/25',
        icon: 'text-orange-700 dark:text-orange-300',
        iconBg: 'bg-orange-100/70 dark:bg-orange-950/45',
        iconBorder: 'border-orange-200 dark:border-orange-900/60',
      },
    };
    const t = toneMap[tone];
    return (
      <div className={`rounded-xl border ${t.border} ${t.bg} p-4 flex items-start gap-3`}>
        <div className={`rounded-lg p-2 ${t.iconBg} border ${t.iconBorder} ${t.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground truncate">{sub}</div>
        </div>
      </div>
    );
  };

  const kpiTiles = useMemo(() => {
    return [
      {
        label: 'Valor faturado',
        value: formatCurrency(kpis.valorFaturado),
        sub: `${formatNumber(kpis.faturas)} fatura(s)`,
        tone: 'indigo',
        icon: TrendingUp,
      },
      {
        label: 'Recebido',
        value: formatCurrency(kpis.pago),
        sub: `${formatNumber(kpis.ctes)} CT-e(s)`,
        tone: 'emerald',
        icon: HandCoins,
      },
      {
        label: 'A receber',
        value: formatCurrency(kpis.aReceber),
        sub: `No prazo: ${formatCurrency(kpis.noPrazo)}`,
        tone: 'blue',
        icon: BadgeDollarSign,
      },
      {
        label: 'Atrasado',
        value: formatCurrency(kpis.atrasado),
        sub: `Inadimplência: ${formatNumber(kpis.inadimplenciaPct, 2)}%`,
        tone: 'rose',
        icon: AlertTriangle,
      },
      {
        label: 'Vence em 3 dias',
        value: formatCurrency(kpis.dueSoon),
        sub: 'Radar de risco',
        tone: 'amber',
        icon: CalendarClock,
      },
      {
        label: 'Disponíveis para faturar',
        value: formatCurrency(data0103?.totals?.frete_total || 0),
        sub: `${formatNumber(data0103?.totals?.ctes || 0)} CT-e(s)`,
        tone: 'orange',
        icon: PieChartIcon,
      },
    ] as const;
  }, [
    data0103?.totals?.ctes,
    data0103?.totals?.frete_total,
    kpis.aReceber,
    kpis.atrasado,
    kpis.ctes,
    kpis.dueSoon,
    kpis.faturas,
    kpis.inadimplenciaPct,
    kpis.noPrazo,
    kpis.pago,
    kpis.valorFaturado,
  ]);

  const aReceberPorUnidade = useMemo(() => {
    const by: Record<string, { name: string; value: number }> = {};
    for (const f of filteredFaturas as any[]) {
      const saldo = Number(f._saldo) || 0;
      if (saldo <= 0) continue;
      const key = String(f.fil || f.unidade_responsavel || '—').trim() || '—';
      if (!by[key]) by[key] = { name: key, value: 0 };
      by[key].value += saldo;
    }
    return Object.values(by).sort((a, b) => b.value - a.value).slice(0, 12);
  }, [filteredFaturas]);

  const aReceberPorTipoCobranca = useMemo(() => {
    const by: Record<string, { name: string; value: number }> = {};
    for (const f of filteredFaturas as any[]) {
      const saldo = Number(f._saldo) || 0;
      if (saldo <= 0) continue;
      const key = String(f.tipo_cobranca || '—').trim() || '—';
      if (!by[key]) by[key] = { name: key, value: 0 };
      by[key].value += saldo;
    }
    return Object.values(by).sort((a, b) => b.value - a.value);
  }, [filteredFaturas]);

  const rankingAReceber = useMemo(() => {
    const by: Record<
      string,
      { key: string; name: string; cnpj: string; is_grupo: boolean; value: number; count: number; vencidas: number; vence3d: number }
    > = {};
    const groupAgg: Record<string, { is_grupo: boolean; name: string }> = {};

    for (const f of filteredFaturas as any[]) {
      const saldo = Number(f._saldo) || 0;
      if (saldo <= 0) continue;
      const cnpj = String(f.cnpj || '').replace(/\D+/g, '');
      const nomeBase = String(f.cliente || '').trim() || cnpj || '—';

      let key = cnpj || nomeBase;
      let name = nomeBase;
      let isGrupo = false;

      if (rankGroupBy === 'grupos') {
        const gm = cnpj ? grupoMap[cnpj] : null;
        const principal = gm?.cnpj_principal ? String(gm.cnpj_principal).replace(/\D+/g, '') : '';
        const nomePrincipal = (gm?.nome_principal || '').trim();
        key = principal || cnpj || nomeBase;
        name = nomePrincipal || nomeBase;
        isGrupo = !!(gm?.is_grupo);

        if (!groupAgg[key]) groupAgg[key] = { is_grupo: false, name };
        groupAgg[key].is_grupo = groupAgg[key].is_grupo || isGrupo || (principal !== '' && principal !== cnpj);
        if (!groupAgg[key].name && name) groupAgg[key].name = name;
      }

      if (!by[key]) {
        by[key] = { key, name, cnpj: key, is_grupo: isGrupo, value: 0, count: 0, vencidas: 0, vence3d: 0 };
      }
      by[key].value += saldo;
      by[key].count += 1;
      if (f._overdue) by[key].vencidas += saldo;
      if (f._dueSoon) by[key].vence3d += saldo;
    }

    const list = Object.values(by).map((it) => {
      if (rankGroupBy !== 'grupos') return it;
      const ga = groupAgg[it.key];
      return {
        ...it,
        name: ga?.name || it.name,
        is_grupo: ga?.is_grupo || it.is_grupo,
      };
    });

    list.sort((a, b) => b.value - a.value);
    return list.slice(0, 20);
  }, [filteredFaturas, grupoMap, rankGroupBy]);

  const radarRisco = useMemo(() => {
    const base = [...rankingAReceber];
    const riskScore = (x: any) => (Number(x.vencidas) || 0) * 2 + (Number(x.vence3d) || 0) * 1 + (Math.max(0, (Number(x.value) || 0) - (Number(x.vencidas) || 0)) * 0.15);
    base.sort((a, b) => riskScore(b) - riskScore(a));
    return base.slice(0, 6);
  }, [rankingAReceber]);

  const funilValores = useMemo(() => {
    const aFaturar = Number(data0103?.totals?.frete_total) || 0;
    const recebido = Number(kpis.pago) || 0;
    const aberto = Number(kpis.aReceber) || 0;
    const atrasado = Number(kpis.atrasado) || 0;
    return [
      { name: 'Recebido', value: recebido, fill: '#16a34a' },
      { name: 'A receber', value: aberto, fill: '#2563eb' },
      { name: 'Atrasado', value: atrasado, fill: '#ef4444' },
      { name: 'A faturar', value: aFaturar, fill: '#f97316' },
    ];
  }, [data0103, kpis]);

  const aFaturarByDestino = useMemo(() => {
    const rows = data0103?.rows || [];
    const by: Record<string, number> = {};
    for (const r of rows) {
      const key = String(r.dest || '—').trim() || '—';
      by[key] = (by[key] || 0) + (Number(r.frete) || 0);
    }
    return Object.entries(by)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [data0103]);

  const aFaturarByPagador = useMemo(() => {
    const rows = data0103?.rows || [];
    const by: Record<string, number> = {};
    for (const r of rows) {
      const key = String(r.pagador || '—').trim() || '—';
      by[key] = (by[key] || 0) + (Number(r.frete) || 0);
    }
    return Object.entries(by)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [data0103]);

  const aFaturarConcentracaoTop5 = useMemo(() => {
    const rows = aFaturarByPagador.slice(0, 5);
    const top5 = rows.reduce((acc, r) => acc + (Number(r.value) || 0), 0);
    const total = Number(data0103?.totals?.frete_total) || 0;
    return total > 0 ? (top5 / total) * 100 : 0;
  }, [aFaturarByPagador, data0103]);

  const previsaoRecebimento30d = useMemo(() => {
    const byDay: Record<string, number> = {};
    for (const f of filteredFaturas as any[]) {
      const saldo = Number(f._saldo) || 0;
      if (saldo <= 0) continue;
      const ts = f._vencTs0;
      if (!ts || ts < today0 || ts > today0 + 30 * 86400000) continue;
      const dt = new Date(ts);
      const key = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
      byDay[key] = (byDay[key] || 0) + saldo;
    }
    const points = Object.entries(byDay).map(([name, value]) => ({ name, value }));
    const parseKey = (k: string) => {
      const m = k.match(/^(\d{2})\/(\d{2})$/);
      if (!m) return 0;
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const dt = new Date(new Date().getFullYear(), mm - 1, dd, 12, 0, 0, 0);
      return dt.getTime();
    };
    points.sort((a, b) => parseKey(a.name) - parseKey(b.name));
    let acc = 0;
    return points.map((p) => {
      acc += p.value;
      return { ...p, acumulado: acc };
    });
  }, [filteredFaturas, today0]);

  const agingBuckets = useMemo(() => {
    const bucketsReceber = [
      { key: 'Hoje', min: 0, max: 0 },
      { key: '1-2', min: 1, max: 2 },
      { key: '3-5', min: 3, max: 5 },
      { key: '6-10', min: 6, max: 10 },
      { key: '11-15', min: 11, max: 15 },
      { key: '16-20', min: 16, max: 20 },
      { key: '21-30', min: 21, max: 30 },
      { key: '31+', min: 31, max: 9999 },
    ];
    const bucketsVenc = [
      { key: '1-15', min: 1, max: 15 },
      { key: '16-30', min: 16, max: 30 },
      { key: '31-60', min: 31, max: 60 },
      { key: '61-90', min: 61, max: 90 },
      { key: '91-180', min: 91, max: 180 },
      { key: '181+', min: 181, max: 9999 },
    ];
    const rec: Record<string, number> = {};
    const venc: Record<string, number> = {};
    for (const b of bucketsReceber) rec[b.key] = 0;
    for (const b of bucketsVenc) venc[b.key] = 0;

    for (const f of filteredFaturas as any[]) {
      const saldo = Number(f._saldo) || 0;
      const ts = f._vencTs0;
      if (!ts || saldo <= 0) continue;
      const days = Math.floor((ts - today0) / 86400000);
      if (days >= 0) {
        const b = bucketsReceber.find((x) => days >= x.min && days <= x.max);
        if (b) rec[b.key] += saldo;
      } else {
        const od = Math.abs(days);
        const b = bucketsVenc.find((x) => od >= x.min && od <= x.max);
        if (b) venc[b.key] += saldo;
      }
    }

    return {
      aReceber: bucketsReceber.map((b) => ({ name: b.key, value: rec[b.key] || 0 })),
      vencidos: bucketsVenc.map((b) => ({ name: b.key, value: venc[b.key] || 0 })),
    };
  }, [filteredFaturas, today0]);

  const hasFiltrosAtivos = useMemo(() => {
    if (periodoTipo !== defaultFilters.periodoTipo) return true;
    if (periodoIni !== defaultFilters.periodoIni) return true;
    if (periodoFim !== defaultFilters.periodoFim) return true;
    if (sitFatura !== defaultFilters.sitFatura) return true;
    if ((clientePagador.cnpj || '').trim() !== '') return true;
    if ((clienteGrupo.cnpj || '').trim() !== '') return true;
    return false;
  }, [
    clienteGrupo.cnpj,
    clientePagador.cnpj,
    defaultFilters.periodoFim,
    defaultFilters.periodoIni,
    defaultFilters.periodoTipo,
    defaultFilters.sitFatura,
    periodoFim,
    periodoIni,
    periodoTipo,
    sitFatura,
  ]);

  const syncTempFromApplied = useCallback(() => {
    setTempPeriodoTipo(periodoTipo);
    setTempPeriodoIni(periodoIni);
    setTempPeriodoFim(periodoFim);
    setTempSitFatura(sitFatura);
    setTempClientePagador(clientePagador);
    setTempClienteGrupo(clienteGrupo);
  }, [clienteGrupo, clientePagador, periodoFim, periodoIni, periodoTipo, sitFatura]);

  const clearTempFilters = useCallback(() => {
    setTempPeriodoTipo(defaultFilters.periodoTipo);
    setTempPeriodoIni(defaultFilters.periodoIni);
    setTempPeriodoFim(defaultFilters.periodoFim);
    setTempSitFatura(defaultFilters.sitFatura);
    setTempClientePagador(defaultFilters.clientePagador);
    setTempClienteGrupo(defaultFilters.clienteGrupo);
  }, [defaultFilters]);

  const cancelFilters = useCallback(() => {
    syncTempFromApplied();
    setShowFilters(false);
  }, [syncTempFromApplied]);

  const applyFilters = useCallback(() => {
    setPeriodoTipo(tempPeriodoTipo);
    setPeriodoIni(tempPeriodoIni);
    setPeriodoFim(tempPeriodoFim);
    setSitFatura(tempSitFatura);
    setClientePagador(tempClientePagador);
    setClienteGrupo(tempClienteGrupo);
    setShowFilters(false);
    void carregar0049({
      periodoTipo: tempPeriodoTipo,
      periodoIni: tempPeriodoIni,
      periodoFim: tempPeriodoFim,
      sitFatura: tempSitFatura,
      clientePagadorCnpj: tempClientePagador.cnpj,
      clienteGrupoCnpj: tempClienteGrupo.cnpj,
    });
  }, [
    carregar0049,
    tempClienteGrupo,
    tempClientePagador,
    tempPeriodoFim,
    tempPeriodoIni,
    tempPeriodoTipo,
    tempSitFatura,
  ]);

  return (
    <DashboardLayout
      title="CONTAS A RECEBER"
      description="Painel em tempo real (faturamento e disponíveis para faturar)"
      headerActions={
        <div className="flex items-center gap-2 md:gap-3">
          <Dialog
            open={showFilters}
            onOpenChange={(open) => {
              setShowFilters(open);
              if (open) syncTempFromApplied();
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="relative dark:border-slate-600 dark:hover:bg-slate-800">
                <Filter className="w-4 h-4" />
                {hasFiltrosAtivos && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-600" />}
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[760px] bg-white dark:bg-slate-900 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  Defina o período e filtros do faturamento. Ao aplicar, o painel atualiza automaticamente.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Situação da fatura</Label>
                      <Select value={tempSitFatura} onValueChange={(v) => setTempSitFatura(v as any)}>
                        <SelectTrigger className="h-9 dark:bg-slate-800 dark:border-slate-700">
                          <SelectValue placeholder="Situação" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="T">Todas menos canceladas</SelectItem>
                          <SelectItem value="P">Pendentes</SelectItem>
                          <SelectItem value="L">Liquidadas</SelectItem>
                          <SelectItem value="E">Perdidas</SelectItem>
                          <SelectItem value="C">Canceladas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Tipo de período</Label>
                      <Select value={tempPeriodoTipo} onValueChange={(v) => setTempPeriodoTipo(v as any)}>
                        <SelectTrigger className="h-9 dark:bg-slate-800 dark:border-slate-700">
                          <SelectValue placeholder="Tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="V">Vencimento</SelectItem>
                          <SelectItem value="E">Emissão</SelectItem>
                          <SelectItem value="L">Liquidação</SelectItem>
                          <SelectItem value="X">Cancelamento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Data início</Label>
                      <Input
                        type="date"
                        value={tempPeriodoIni}
                        onChange={(e) => setTempPeriodoIni(e.target.value)}
                        className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Data fim</Label>
                      <Input
                        type="date"
                        value={tempPeriodoFim}
                        onChange={(e) => setTempPeriodoFim(e.target.value)}
                        className="h-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Pagador (CNPJ)</Label>
                      <BuscadorClientes
                        selectedNome={tempClientePagador.nome}
                        onSelect={(c) => setTempClientePagador({ cnpj: c.cnpj || '', nome: c.nome || '' })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Grupo (CNPJ principal)</Label>
                      <BuscadorClientes
                        selectedNome={tempClienteGrupo.nome}
                        onSelect={(c) => setTempClienteGrupo({ cnpj: c.cnpj || '', nome: c.nome || '' })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <Button variant="outline" onClick={clearTempFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
                  Limpar tudo
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancelFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
                    Cancelar
                  </Button>
                  <Button onClick={applyFilters} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    Aplicar filtros
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {loading0049 ? (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {status0049 || 'Processando...'}
            </Badge>
          ) : status0049 ? (
            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{status0049}</Badge>
          ) : null}

          {loading0103 ? (
            <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {status0103 || 'Atualizando...'}
            </Badge>
          ) : null}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void carregar0049();
              void carregar0103({ silent: true });
            }}
            disabled={loading0049}
            className="dark:border-slate-600"
          >
            {loading0049 ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-1.5">Atualizar</span>
          </Button>
        </div>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <div className="flex items-center justify-between gap-3">
          <div className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/30 backdrop-blur px-2 py-2">
            <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full bg-transparent">
              <TabsTrigger value="visao_geral">Visão geral</TabsTrigger>
              <TabsTrigger value="a_receber">A receber</TabsTrigger>
              <TabsTrigger value="aging_a_receber">Aging · A receber</TabsTrigger>
              <TabsTrigger value="faturas_vencidas">Faturas vencidas</TabsTrigger>
              <TabsTrigger value="aging_vencidos">Aging · Vencidos</TabsTrigger>
              <TabsTrigger value="a_faturar">A faturar</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="visao_geral" className="mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="text-xs text-muted-foreground">Visão rápida:</div>
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  quickView === 'todas'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                onClick={() => setQuickView('todas')}
                disabled={loading0049}
              >
                Todas
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 dark:border-slate-700 ${
                  quickView === 'abertas'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                onClick={() => setQuickView('abertas')}
                disabled={loading0049}
              >
                Abertas
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 dark:border-slate-700 ${
                  quickView === 'vencidas'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                onClick={() => setQuickView('vencidas')}
                disabled={loading0049}
              >
                Vencidas
              </button>
              <button
                type="button"
                className={`px-3 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200 dark:border-slate-700 ${
                  quickView === 'vence3d'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
                onClick={() => setQuickView('vence3d')}
                disabled={loading0049}
              >
                Vence 3d
              </button>
            </div>
          </div>
          {!data0049 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Clique em Atualizar para ler o faturamento e ver os indicadores.</CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {kpiTiles.map((t) => (
                  <Tile key={t.label} label={t.label} value={t.value} sub={t.sub} tone={t.tone} Icon={t.icon} />
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">Previsão de recebimento (30 dias)</CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-2"
                        onClick={() => {
                          const base = filteredFaturas.filter((f: any) => (Number(f._saldo) || 0) > 0 && !f._overdue);
                          const csv = buildCsvFaturas(base as any);
                          const stamp = new Date();
                          const pad = (n: number) => String(n).padStart(2, '0');
                          downloadCsv(
                            `contas_receber_faturas_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.csv`,
                            csv
                          );
                        }}
                      >
                        <Download className="w-4 h-4" />
                        CSV
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    {!previsaoSerie30d.has ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem valores no horizonte de 30 dias</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={previsaoSerie30d.series} margin={{ top: 12, right: 10, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="cr_previsao" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" interval={4} />
                          <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                          <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                          <Area
                            type="monotone"
                            dataKey="value"
                            name="Previsão"
                            stroke="#2563eb"
                            strokeWidth={2}
                            fill="url(#cr_previsao)"
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Alertas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {kpis.dueSoon > 0 ? (
                      <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300 mt-0.5" />
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">Vencendo em 3 dias</div>
                            <div className="text-xs text-amber-800/80 dark:text-amber-200/80">{formatCurrency(kpis.dueSoon)}</div>
                            <button
                              className="text-xs underline text-amber-800 dark:text-amber-200 mt-1"
                              onClick={() => abrirDrill('Vencendo em 3 dias', (filteredFaturas as any[]).filter((f) => f._dueSoon))}
                            >
                              Ver faturas
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">Nenhum alerta ativo.</div>
                    )}

                    {kpis.atrasado > 0 ? (
                      <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3">
                        <div className="text-sm font-semibold text-rose-900 dark:text-rose-100">Atrasado</div>
                        <div className="text-xs text-rose-800/80 dark:text-rose-200/80">{formatCurrency(kpis.atrasado)}</div>
                        <button
                          className="text-xs underline text-rose-800 dark:text-rose-200 mt-1"
                          onClick={() => abrirDrill('Atrasadas', (filteredFaturas as any[]).filter((f) => f._overdue))}
                        >
                          Ver faturas
                        </button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">A receber por unidade (Top)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    {aReceberPorUnidade.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aReceberPorUnidade} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                          <defs>
                            <linearGradient id="cr_unid" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.95} />
                              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.95} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                          <YAxis type="category" dataKey="name" width={50} />
                          <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                          <Bar
                            dataKey="value"
                            name="A receber"
                            fill="url(#cr_unid)"
                            radius={[8, 8, 8, 8]}
                            onClick={(d: any) => {
                              const key = String(d?.name ?? '').trim();
                              if (!key) return;
                              abrirDrill(`A receber · Unidade ${key}`, (filteredFaturas as any[]).filter((f) => (Number(f._saldo) || 0) > 0 && (f.fil || f.unidade_responsavel) === key));
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">A receber por tipo de cobrança</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    {aReceberPorTipoCobranca.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                          <Legend verticalAlign="bottom" height={36} />
                          <Pie data={aReceberPorTipoCobranca.slice(0, 8)} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} stroke="none">
                            {aReceberPorTipoCobranca.slice(0, 8).map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2 overflow-hidden">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">Top pagadores · A receber</CardTitle>
                      <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 shrink-0">
                        <button
                          onClick={() => setRankGroupBy('grupos')}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                            rankGroupBy === 'grupos'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          Grupos
                        </button>
                        <button
                          onClick={() => setRankGroupBy('clientes')}
                          className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                            rankGroupBy === 'clientes'
                              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                        >
                          Clientes
                        </button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {rankingAReceber.length === 0 ? (
                      <div className="py-12 text-center text-sm text-muted-foreground">Sem dados</div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {rankingAReceber.slice(0, 12).map((c, i) => {
                          const pct = kpis.aReceber > 0 ? (c.value / kpis.aReceber) * 100 : 0;
                          const color = COLORS[i % COLORS.length];
                          return (
                            <div
                              key={c.key}
                              className="px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                              onClick={() => {
                                const rows = (filteredFaturas as any[]).filter((f) => {
                                  const saldo = Number(f._saldo) || 0;
                                  if (saldo <= 0) return false;
                                  const cnpj = String(f.cnpj || '').replace(/\D+/g, '');
                                  if (rankGroupBy === 'clientes') return cnpj === c.cnpj;
                                  const gm = cnpj ? grupoMap[cnpj] : null;
                                  const principal = gm?.cnpj_principal ? String(gm.cnpj_principal).replace(/\D+/g, '') : '';
                                  const key = principal || cnpj || String(f.cliente || '').trim() || '—';
                                  return key === c.key;
                                });
                                abrirDrill(`A receber · ${c.name}`, rows);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                  style={{ backgroundColor: color }}
                                >
                                  {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-1.5">
                                      {c.name}
                                      {c.is_grupo && (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] px-1 py-0 h-4 shrink-0 border-indigo-300 text-indigo-600 dark:text-indigo-400"
                                        >
                                          Grupo
                                        </Badge>
                                      )}
                                    </p>
                                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 shrink-0">{formatCurrency(c.value)}</p>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 mb-1.5">
                                    <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span>{c.count} fatura(s)</span>
                                    <span>·</span>
                                    <span>{pct.toFixed(1)}% do total</span>
                                    {c.vencidas > 0 && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-rose-300 text-rose-600 dark:border-rose-700 dark:text-rose-300">
                                        Vencidas {formatCurrency(c.vencidas)}
                                      </Badge>
                                    )}
                                    {c.vence3d > 0 && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-200">
                                        Vence 3d {formatCurrency(c.vence3d)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Radar de risco</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-xs text-muted-foreground">Top risco (aberto)</div>
                      <div className="mt-2 space-y-2">
                        {radarRisco.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Sem dados</div>
                        ) : (
                          radarRisco.slice(0, 5).map((x) => {
                            const total = Number(x.value) || 0;
                            const venc = Number(x.vencidas) || 0;
                            const soon = Number(x.vence3d) || 0;
                            const pctV = total > 0 ? (venc / total) * 100 : 0;
                            const pctS = total > 0 ? (soon / total) * 100 : 0;
                            return (
                              <button
                                key={`${x.key}`}
                                className="w-full text-left"
                                onClick={() => {
                                  const rows = (filteredFaturas as any[]).filter((f) => {
                                    const saldo = Number(f._saldo) || 0;
                                    if (saldo <= 0) return false;
                                    const cnpj = String(f.cnpj || '').replace(/\D+/g, '');
                                    if (rankGroupBy === 'clientes') return cnpj === String(x.cnpj || '').replace(/\D+/g, '');
                                    const gm = cnpj ? grupoMap[cnpj] : null;
                                    const principal = gm?.cnpj_principal ? String(gm.cnpj_principal).replace(/\D+/g, '') : '';
                                    const key = principal || cnpj || String(f.cliente || '').trim() || '—';
                                    return key === x.key;
                                  });
                                  abrirDrill(`A receber · ${x.name}`, rows);
                                }}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="truncate text-sm">{x.name}</span>
                                  <span className="font-mono text-sm">{formatCurrency(total)}</span>
                                </div>
                                <div className="mt-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div className="h-1.5 bg-rose-500" style={{ width: `${pctV}%` }} />
                                  <div className="h-1.5 bg-amber-500 -mt-1.5" style={{ width: `${Math.min(100, pctV + pctS)}%` }} />
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span>Vencidas: {formatCurrency(venc)}</span>
                                  <span>·</span>
                                  <span>Vence 3d: {formatCurrency(soon)}</span>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                      <div className="text-xs text-muted-foreground">Funil (visão dinâmica)</div>
                      <div className="h-[180px] mt-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={funilValores} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                            <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                            <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                            <Bar dataKey="value" name="Valor" stroke="none">
                              {funilValores.map((p, i) => (
                                <Cell key={i} fill={(p as any).fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="a_receber" className="mt-4">
          {!data0049 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Clique em Atualizar para ler o faturamento.</CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">Faturas (busca e exportação)</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2"
                      onClick={() => {
                        const csv = buildCsvFaturas(filteredFaturas as any);
                        const stamp = new Date();
                        const pad = (n: number) => String(n).padStart(2, '0');
                        downloadCsv(
                          `contas_receber_faturas_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.csv`,
                          csv
                        );
                      }}
                    >
                      <Download className="w-4 h-4" />
                      CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        className="pl-9"
                        placeholder="Buscar: fatura, CNPJ, cliente, unidade, situação, ocorrência..."
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                      />
                    </div>
                    <div className="text-sm text-muted-foreground">{`${formatNumber(filteredFaturas.length)} fatura(s)`}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">Fatura</th>
                        <th className="py-2 pr-3">Cliente</th>
                        <th className="py-2 pr-3">Unid</th>
                        <th className="py-2 pr-3">Vencimento</th>
                        <th className="py-2 pr-3 text-right">Valor</th>
                        <th className="py-2 pr-3 text-right">Pago</th>
                        <th className="py-2 pr-3 text-right">Saldo</th>
                        <th className="py-2 pr-3">Situação</th>
                        <th className="py-2 pr-3 text-right">CT-es</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(filteredFaturas as any[]).slice(0, 300).map((f) => (
                        <tr key={f.fatura} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-mono">{f.fatura}</td>
                          <td className="py-2 pr-3">
                            <div className="font-medium">{f.cliente}</div>
                            <div className="text-xs text-muted-foreground font-mono">{f.cnpj}</div>
                          </td>
                          <td className="py-2 pr-3 font-mono">{f.fil || f.unidade_responsavel}</td>
                          <td className="py-2 pr-3 font-mono">
                            <span className={f._overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>{f.vencimento}</span>
                          </td>
                          <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f._vlrFatur)}</td>
                          <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f._pago)}</td>
                          <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f._saldo)}</td>
                          <td className="py-2 pr-3">{f.situacao || '-'}</td>
                          <td className="py-2 pr-3 text-right font-mono">{formatNumber(f.ctes?.length || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="aging_a_receber" className="mt-4">
          {!data0049 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Clique em Atualizar para ler o faturamento.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Aging · A receber (por vencimento)</CardTitle>
              </CardHeader>
              <CardContent className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingBuckets.aReceber} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                    <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                    <Bar
                      dataKey="value"
                      name="A receber"
                      fill="#16a34a"
                      onClick={(d: any) => {
                        const key = String(d?.name ?? '');
                        const rows = (filteredFaturas as any[]).filter((f) => (Number(f._saldo) || 0) > 0 && !f._overdue);
                        abrirDrill(`A receber · Faixa ${key}`, rows);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="faturas_vencidas" className="mt-4">
          {!data0049 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Clique em Atualizar para ler o faturamento.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base">Faturas vencidas (saldo &gt; 0)</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-2"
                    onClick={() => {
                      const rows = (filteredFaturas as any[]).filter((f) => f._overdue && (Number(f._saldo) || 0) > 0);
                      const csv = buildCsvFaturas(rows as any);
                      const stamp = new Date();
                      const pad = (n: number) => String(n).padStart(2, '0');
                      downloadCsv(
                        `contas_receber_vencidas_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.csv`,
                        csv
                      );
                    }}
                  >
                    <Download className="w-4 h-4" />
                    CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-3">Fatura</th>
                      <th className="py-2 pr-3">Cliente</th>
                      <th className="py-2 pr-3">Unid</th>
                      <th className="py-2 pr-3">Vencimento</th>
                      <th className="py-2 pr-3 text-right">Saldo</th>
                      <th className="py-2 pr-3">Ocorrência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredFaturas as any[])
                      .filter((f) => f._overdue && (Number(f._saldo) || 0) > 0)
                      .slice(0, 400)
                      .map((f) => (
                        <tr key={f.fatura} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-mono">{f.fatura}</td>
                          <td className="py-2 pr-3">
                            <div className="font-medium">{f.cliente}</div>
                            <div className="text-xs text-muted-foreground font-mono">{f.cnpj}</div>
                          </td>
                          <td className="py-2 pr-3 font-mono">{f.fil || f.unidade_responsavel}</td>
                          <td className="py-2 pr-3 font-mono text-rose-600 dark:text-rose-400 font-semibold">{f.vencimento}</td>
                          <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f._saldo)}</td>
                          <td className="py-2 pr-3 max-w-[520px] truncate" title={f.ultima_ocorrencia || ''}>
                            {f.ultima_ocorrencia || '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="aging_vencidos" className="mt-4">
          {!data0049 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Clique em Atualizar para ler o faturamento.</CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Aging · Vencidos</CardTitle>
              </CardHeader>
              <CardContent className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingBuckets.vencidos} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                    <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                    <Bar
                      dataKey="value"
                      name="Vencidos"
                      fill="#ef4444"
                      onClick={(d: any) => {
                        const key = String(d?.name ?? '');
                        const rows = (filteredFaturas as any[]).filter((f) => f._overdue && (Number(f._saldo) || 0) > 0);
                        abrirDrill(`Vencidos · Faixa ${key}`, rows);
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="a_faturar" className="mt-4">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Disponíveis para faturar</CardTitle>
                  <Button onClick={() => void carregar0103()} disabled={loading0103} className="gap-2">
                    {loading0103 ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Atualizar agora
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Lista de CT-es a prazo que ainda não entraram em fatura. A consulta é em tempo real e usa sempre a data de ontem como referência.
                </div>
              </CardContent>
            </Card>

            {!data0103 ? null : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <Card className="lg:col-span-3">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Resumo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-xs text-muted-foreground">CT-es</div>
                        <div className="text-2xl font-bold">{Number(data0103.totals.ctes || 0).toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-xs text-muted-foreground">Frete total</div>
                        <div className="text-2xl font-bold">{formatCurrency(data0103.totals.frete_total || 0)}</div>
                      </div>
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-xs text-muted-foreground">Atualização</div>
                        <div className="text-sm font-semibold">{data0103.meta.updated_at || data0103.meta.gerado_em}</div>
                        <div className="text-xs text-muted-foreground">{`Ref. fim (ontem): ${data0103.meta.ontem_dmy}`}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="lg:col-span-1">
                  <CardHeader className="pb-2">
                  <CardTitle className="text-base">Fonte</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground space-y-1">
                    <div>Relatório gerado em {data0103.meta.updated_at || data0103.meta.gerado_em}</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {!data0103 ? null : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">A faturar · Top destinos</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    {aFaturarByDestino.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aFaturarByDestino} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                          <YAxis type="category" dataKey="name" width={55} />
                          <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                          <Bar dataKey="value" name="Frete" fill="#f97316" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">A faturar · Top pagadores</CardTitle>
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{`Top 5 = ${formatNumber(aFaturarConcentracaoTop5, 2)}%`}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    {aFaturarByPagador.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aFaturarByPagador} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                          <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                          <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                          <Bar dataKey="value" name="Frete" fill="#f97316" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {!data0103 ? null : (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Lista (CT-es)</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-3">CTRC</th>
                        <th className="py-2 pr-3">CT-e</th>
                        <th className="py-2 pr-3">Pagador</th>
                        <th className="py-2 pr-3">Dest</th>
                        <th className="py-2 pr-3 text-right">Frete</th>
                        <th className="py-2 pr-3">Emissão</th>
                        <th className="py-2 pr-3">Prev. Entrega</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data0103.rows.slice(0, 300).map((r, i) => (
                        <tr key={`${r.ctrc}-${r.numero_cte}-${i}`} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-mono">{r.ctrc}</td>
                          <td className="py-2 pr-3 font-mono">{r.numero_cte}</td>
                          <td className="py-2 pr-3">
                            <div className="font-medium">{r.pagador}</div>
                            <div className="text-xs text-muted-foreground font-mono">{r.cnpj_pagador}</div>
                          </td>
                          <td className="py-2 pr-3 font-mono">{r.dest}</td>
                          <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.frete)}</td>
                          <td className="py-2 pr-3 font-mono">{r.emissao}</td>
                          <td className="py-2 pr-3 font-mono">{r.prev_entrega}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="sm:max-w-[1050px] h-[calc(100vh-120px)] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>{drillTitle}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Fatura</th>
                    <th className="py-2 pr-3">Cliente</th>
                    <th className="py-2 pr-3">Vencimento</th>
                    <th className="py-2 pr-3 text-right">Saldo</th>
                    <th className="py-2 pr-3 text-right">Valor</th>
                    <th className="py-2 pr-3">Situação</th>
                    <th className="py-2 pr-3 text-right">CT-es</th>
                  </tr>
                </thead>
                <tbody>
                  {drillRows.slice(0, 600).map((f: any) => (
                    <tr key={f.fatura} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-mono">{f.fatura}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{f.cliente}</div>
                        <div className="text-xs text-muted-foreground font-mono">{f.cnpj}</div>
                      </td>
                      <td className="py-2 pr-3 font-mono">{f.vencimento}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f.saldo)}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f.vlr_fatur)}</td>
                      <td className="py-2 pr-3">{f.situacao || '-'}</td>
                      <td className="py-2 pr-3 text-right font-mono">{formatNumber(f.ctes?.length || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
