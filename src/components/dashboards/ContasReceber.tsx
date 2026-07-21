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
import {
  AlertTriangle,
  ArrowUpDown,
  BadgeDollarSign,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  HandCoins,
  Loader2,
  PieChart as PieChartIcon,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { BuscadorClientes } from '../cadastros/BuscadorClientes';

type TabKey = 'visao_geral' | 'a_receber' | 'aging_a_receber' | 'a_faturar';

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
    ref_fim_dmy?: string;
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

function normTextKey(v: any): string {
  return String(v ?? '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normSituacaoLabel(v: any): 'ATRASADA' | 'LIQUIDADO' | 'PENDENTE' {
  const s = normTextKey(v);
  if (s.includes('ATRAS')) return 'ATRASADA';
  if (s.includes('LIQUID')) return 'LIQUIDADO';
  return 'PENDENTE';
}

function unitSigla3(v: any): string {
  const s = normTextKey(v);
  if (!s) return '—';
  return s.slice(0, 3) || '—';
}

function SituacaoBadge({ value }: { value: any }) {
  const s = normSituacaoLabel(value);
  if (s === 'ATRASADA') return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">ATRASADA</Badge>;
  if (s === 'LIQUIDADO') return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">LIQUIDADO</Badge>;
  return <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">PENDENTE</Badge>;
}

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />;
  return dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200" />;
}

function overdueBucketKey(dias: number): 'd01_07' | 'd08_15' | 'd16_30' | 'd31_60' | 'd61_90' | 'd91_plus' {
  if (dias <= 7) return 'd01_07';
  if (dias <= 15) return 'd08_15';
  if (dias <= 30) return 'd16_30';
  if (dias <= 60) return 'd31_60';
  if (dias <= 90) return 'd61_90';
  return 'd91_plus';
}

function overdueBucketLabel(k: string): string {
  if (k === 'd01_07') return '1–7d';
  if (k === 'd08_15') return '8–15d';
  if (k === 'd16_30') return '16–30d';
  if (k === 'd31_60') return '31–60d';
  if (k === 'd61_90') return '61–90d';
  if (k === 'd91_plus') return '91+d';
  return k;
}

function shortLabel(v: any, n: number): string {
  const s = String(v ?? '').trim();
  if (!s) return '—';
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function CrChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: any[];
  label?: any;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm px-3 py-2 text-xs">
      {label !== undefined && label !== null && String(label).trim() !== '' ? <div className="font-semibold mb-1">{String(label)}</div> : null}
      <div className="space-y-1">
        {payload.map((p: any, idx: number) => {
          const rawName = p?.name ?? p?.dataKey ?? '';
          const name = String(rawName || '').trim();
          const rawVal = Number(p?.value ?? p?.payload?.value ?? 0) || 0;
          const val = valueFormatter ? valueFormatter(rawVal) : String(rawVal);
          const color = String(p?.color || p?.fill || '#64748b');
          return (
            <div key={`${name}-${idx}`} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                <span className="truncate">{name || '—'}</span>
              </div>
              <span className="font-mono">{val}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ContasReceber() {
  const today0 = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 0, 0, 0, 0).getTime();
  }, []);

  const [tab, setTab] = useState<TabKey>('visao_geral');
  const [periodoTipo, setPeriodoTipo] = useState<'E' | 'V' | 'L' | 'X'>('V');
  const defaultPeriodo = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
    return { ini: dateToInput(start), fim: dateToInput(end) };
  }, []);
  const [periodoIni, setPeriodoIni] = useState<string>(defaultPeriodo.ini);
  const [periodoFim, setPeriodoFim] = useState<string>(defaultPeriodo.fim);
  const [sitFatura, setSitFatura] = useState<'P' | 'L' | 'E' | 'C' | 'T'>('T');
  const [clientePagador, setClientePagador] = useState<ClienteSel>({ cnpj: '', nome: '' });
  const [clienteGrupo, setClienteGrupo] = useState<ClienteSel>({ cnpj: '', nome: '' });
  const [tableSearch, setTableSearch] = useState('');
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
  const [drillKind, setDrillKind] = useState<'faturas' | 'ctes0103'>('faturas');
  const [drillRows, setDrillRows] = useState<any[]>([]);
  const [drillSortKey, setDrillSortKey] = useState<string>('saldo');
  const [drillSortDir, setDrillSortDir] = useState<'asc' | 'desc'>('desc');
  const [arSortKey, setArSortKey] = useState<
    'fatura' | 'cliente' | 'unid' | 'venc' | 'valor' | 'pago' | 'saldo' | 'situacao' | 'ctes'
  >('saldo');
  const [arSortDir, setArSortDir] = useState<'asc' | 'desc'>('desc');
  const [arPage, setArPage] = useState(1);
  const [afSearch, setAfSearch] = useState('');
  const [afSortKey, setAfSortKey] = useState<'ctrc' | 'cte' | 'pagador' | 'dest' | 'frete' | 'emissao' | 'prev'>('frete');
  const [afSortDir, setAfSortDir] = useState<'asc' | 'desc'>('desc');
  const [afPage, setAfPage] = useState(1);

  const [rankGroupBy, setRankGroupBy] = useState<'grupos' | 'clientes'>('grupos');
  const [grupoMap, setGrupoMap] = useState<Record<string, { cnpj_principal: string; nome_principal: string; is_grupo: boolean }>>({});
  const lastGrupoFetchKeyRef = useRef<string>('');

  const abrirDrill = useCallback((title: string, rows: any[], kind: 'faturas' | 'ctes0103' = 'faturas') => {
    setDrillTitle(title);
    setDrillRows(rows);
    setDrillKind(kind);
    setDrillSortKey(kind === 'ctes0103' ? 'frete' : 'saldo');
    setDrillSortDir('desc');
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
          normSituacaoLabel(r.situacao),
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

  const buildCsv0103 = useCallback((rows: Ssw0103Row[]) => {
    const header = ['CTRC', 'CT-e', 'Pagador', 'CNPJ Pagador', 'Dest', 'Frete', 'Emissão', 'Prev. Entrega', 'Chave CT-e', 'Últ. Ocorrência', 'Observação'];
    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(';'));
    for (const r of rows) {
      lines.push(
        [
          r.ctrc,
          r.numero_cte,
          r.pagador,
          r.cnpj_pagador,
          r.dest,
          formatCurrency(Number(r.frete) || 0),
          r.emissao,
          r.prev_entrega,
          r.chave_cte,
          r.ult_ocor,
          r.observacao,
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
      const diasAtraso =
        Number.isFinite(diasAtrasoNum) && diasAtrasoNum > 0
          ? diasAtrasoNum
          : overdueByDate && venc0 !== null
          ? Math.max(1, Math.floor((today0 - venc0) / 86400000))
          : 0;
      return {
        ...f,
        _vencTs0: venc0,
        _saldo: saldo,
        _vlrFatur: vlrFatur,
        _pago: pago,
        _overdue: overdue,
        _dueSoon: dueSoon,
        _diasAtraso: diasAtraso,
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
    const baseList: any[] = normalizedFaturas as any[];
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
  }, [normalizedFaturas, tableSearch]);

  const aReceberBaseRows = useMemo(() => {
    return (filteredFaturas as any[]).filter((f) => {
      const saldo = Number((f as any)?._saldo) || 0;
      if (saldo <= 0) return false;
      return normSituacaoLabel((f as any)?.situacao) !== 'LIQUIDADO';
    });
  }, [filteredFaturas]);

  useEffect(() => {
    setArPage(1);
  }, [tableSearch, arSortKey, arSortDir]);

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

  const kpisAll = useMemo(() => {
    const base = {
      faturas: normalizedFaturas.length,
      ctes: 0,
      valorFaturado: 0,
      pago: 0,
      pagoFaturas: 0,
      ctesPago: 0,
    };
    for (const f of normalizedFaturas as any[]) {
      base.valorFaturado += Number(f._vlrFatur) || 0;
      const pago = Number(f._pago) || 0;
      if (pago > 0) {
        base.pago += pago;
        base.pagoFaturas += 1;
        base.ctesPago += Array.isArray(f.ctes) ? f.ctes.length : 0;
      }
      base.ctes += Array.isArray(f.ctes) ? f.ctes.length : 0;
    }
    return base;
  }, [normalizedFaturas]);

  const arCards = useMemo(() => {
    const base = {
      totalReceber: 0,
      totalVencer: 0,
      totalAtrasado: 0,
      totalAtrasado10: 0,
      countReceber: 0,
      countVencer: 0,
      countAtrasado: 0,
      countAtrasado10: 0,
    };
    for (const f of aReceberBaseRows as any[]) {
      const saldo = Number(f._saldo) || 0;
      if (saldo <= 0) continue;
      base.totalReceber += saldo;
      base.countReceber += 1;
      if (f._overdue) {
        base.totalAtrasado += saldo;
        base.countAtrasado += 1;
        if ((Number(f._diasAtraso) || 0) > 10) {
          base.totalAtrasado10 += saldo;
          base.countAtrasado10 += 1;
        }
      } else {
        base.totalVencer += saldo;
        base.countVencer += 1;
      }
    }
    return base;
  }, [aReceberBaseRows]);

  const toggleArSort = useCallback((key: typeof arSortKey) => {
    setArSortKey((prevKey) => {
      if (prevKey !== key) {
        setArSortDir('desc');
        return key;
      }
      setArSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
      return prevKey;
    });
  }, []);

  const arSortedRows = useMemo(() => {
    const rows = Array.isArray(aReceberBaseRows) ? [...(aReceberBaseRows as any[])] : [];
    const dir = arSortDir === 'asc' ? 1 : -1;
    const cmpText = (a: any, b: any) => String(a).localeCompare(String(b), 'pt-BR') * dir;
    rows.sort((a, b) => {
      if (arSortKey === 'fatura') return cmpText(normTextKey(a?.fatura), normTextKey(b?.fatura));
      if (arSortKey === 'cliente') return cmpText(normTextKey(a?.cliente), normTextKey(b?.cliente));
      if (arSortKey === 'unid') return cmpText(unitSigla3(a?.fil || a?.unidade_responsavel), unitSigla3(b?.fil || b?.unidade_responsavel));
      if (arSortKey === 'situacao') return cmpText(normSituacaoLabel(a?.situacao), normSituacaoLabel(b?.situacao));
      if (arSortKey === 'ctes') return ((Array.isArray(a?.ctes) ? a.ctes.length : 0) - (Array.isArray(b?.ctes) ? b.ctes.length : 0)) * dir;
      if (arSortKey === 'venc') return (((parseDateBr(String(a?.vencimento || '')) ?? 0) - (parseDateBr(String(b?.vencimento || '')) ?? 0)) || 0) * dir;
      if (arSortKey === 'valor') return ((Number(a?._vlrFatur) || 0) - (Number(b?._vlrFatur) || 0)) * dir;
      if (arSortKey === 'pago') return ((Number(a?._pago) || 0) - (Number(b?._pago) || 0)) * dir;
      return ((Number(a?._saldo) || 0) - (Number(b?._saldo) || 0)) * dir;
    });
    return rows;
  }, [aReceberBaseRows, arSortDir, arSortKey]);

  const arTotals = useMemo(() => {
    const totalValor = (arSortedRows as any[]).reduce((acc, r) => acc + (Number(r?._vlrFatur) || 0), 0);
    const totalPago = (arSortedRows as any[]).reduce((acc, r) => acc + (Number(r?._pago) || 0), 0);
    const totalSaldo = (arSortedRows as any[]).reduce((acc, r) => acc + (Number(r?._saldo) || 0), 0);
    return { totalValor, totalPago, totalSaldo };
  }, [arSortedRows]);

  const arPageSize = 80;
  const arTotalPages = useMemo(() => Math.max(1, Math.ceil(arSortedRows.length / arPageSize)), [arSortedRows.length]);
  useEffect(() => {
    setArPage((p) => Math.min(Math.max(1, p), arTotalPages));
  }, [arTotalPages]);

  const arPageRows = useMemo(() => {
    const start = (arPage - 1) * arPageSize;
    return (arSortedRows as any[]).slice(start, start + arPageSize);
  }, [arPage, arSortedRows]);

  const mgmt = useMemo(() => {
    const total = { aReceber: 0, aVencer: 0, atrasado: 0, atrasado10: 0 };
    const counts = { aReceber: 0, aVencer: 0, atrasado: 0, atrasado10: 0 };

    const byCliente: Record<string, { key: string; name: string; value: number; overdue: number }> = {};
    const byUnit: Record<string, { key: string; name: string; value: number; overdue: number; b: Record<string, number> }> = {};

    const alerts: any[] = [];

    for (const f of aReceberBaseRows as any[]) {
      const saldo = Number(f?._saldo) || 0;
      if (saldo <= 0) continue;
      total.aReceber += saldo;
      counts.aReceber += 1;

      const isOverdue = !!f?._overdue;
      const dias = Number(f?._diasAtraso) || 0;
      if (isOverdue) {
        total.atrasado += saldo;
        counts.atrasado += 1;
        if (dias > 10) {
          total.atrasado10 += saldo;
          counts.atrasado10 += 1;
        }
        alerts.push(f);
      } else {
        total.aVencer += saldo;
        counts.aVencer += 1;
      }

      const clienteKey = normTextKey(f?.cliente) || '—';
      if (!byCliente[clienteKey]) byCliente[clienteKey] = { key: clienteKey, name: String(f?.cliente || '—').trim() || '—', value: 0, overdue: 0 };
      byCliente[clienteKey].value += saldo;
      if (isOverdue) byCliente[clienteKey].overdue += saldo;

      const unitKey = unitSigla3(f?.fil || f?.unidade_responsavel || '—');
      if (!byUnit[unitKey]) byUnit[unitKey] = { key: unitKey, name: unitKey, value: 0, overdue: 0, b: {} };
      byUnit[unitKey].value += saldo;
      if (isOverdue) {
        byUnit[unitKey].overdue += saldo;
        const bk = overdueBucketKey(Math.max(1, dias));
        byUnit[unitKey].b[bk] = (byUnit[unitKey].b[bk] || 0) + saldo;
      }
    }

    const clientesSorted = Object.values(byCliente).sort((a, b) => b.value - a.value);
    const unidadesSorted = Object.values(byUnit).sort((a, b) => b.value - a.value);
    const unidadesOverdueSorted = Object.values(byUnit).sort((a, b) => b.overdue - a.overdue);

    const topCliente = clientesSorted[0] || null;
    const topUnit = unidadesSorted[0] || null;

    const concentracaoCliente = (() => {
      const base = clientesSorted.filter((c) => normTextKey(c.name) !== 'OUTROS');
      const top = base.slice(0, 6);
      const other = base.slice(6).reduce((acc, it) => acc + it.value, 0);
      const items = top.map((it) => ({ name: it.name, value: it.value }));
      if (other > 0) items.push({ name: 'Outros', value: other });
      return items;
    })();

    const colorsClientes = ['#6366f1', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#64748b'];

    const unitOverdueStack = (() => {
      const keys = ['d01_07', 'd08_15', 'd16_30', 'd31_60', 'd61_90', 'd91_plus'] as const;
      const rows = unidadesOverdueSorted
        .filter((u) => u.overdue > 0)
        .slice(0, 12)
        .map((u) => {
          const row: any = { unit: u.key, total: u.overdue };
          for (const k of keys) row[k] = Number(u.b[k] || 0);
          return row;
        })
        .sort((a, b) => b.total - a.total);
      return rows;
    })();

    const alertsTop = alerts
      .slice()
      .sort((a, b) => (Number(b?._diasAtraso) || 0) - (Number(a?._diasAtraso) || 0) || (Number(b?._saldo) || 0) - (Number(a?._saldo) || 0))
      .slice(0, 40);

    return {
      total,
      counts,
      topCliente,
      topUnit,
      concentracaoCliente,
      colorsClientes,
      unitOverdueStack,
      clientesTopOverdue: clientesSorted
        .filter((c) => c.overdue > 0)
        .slice(0, 10)
        .map((c) => ({ name: c.name, value: c.overdue })),
      unidadesTopOverdue: unidadesOverdueSorted
        .filter((u) => u.overdue > 0)
        .slice(0, 10)
        .map((u) => ({ name: u.name, value: u.overdue })),
      alertsTop,
    };
  }, [aReceberBaseRows]);

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
    onClick,
  }: {
    label: string;
    value: string;
    sub: string;
    tone: 'indigo' | 'emerald' | 'blue' | 'rose' | 'amber' | 'orange';
    Icon: any;
    onClick?: () => void;
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
      <button
        type="button"
        onClick={onClick}
        className={`rounded-xl border ${t.border} ${t.bg} p-4 flex items-start gap-3 text-left ${onClick ? 'hover:brightness-[.98] dark:hover:brightness-110 cursor-pointer' : 'cursor-default'}`}
      >
        <div className={`rounded-lg p-2 ${t.iconBg} border ${t.iconBorder} ${t.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold leading-tight">{value}</div>
          <div className="text-xs text-muted-foreground truncate">{sub}</div>
        </div>
      </button>
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
        onClick: () => abrirDrill('Faturas', filteredFaturas as any[], 'faturas'),
      },
      {
        label: 'Recebido',
        value: formatCurrency(kpisAll.pago),
        sub: `${formatNumber(kpisAll.pagoFaturas)} fatura(s) · ${formatNumber(kpisAll.ctesPago)} CT-e(s)`,
        tone: 'emerald',
        icon: HandCoins,
        onClick: () => abrirDrill('Recebidas', (normalizedFaturas as any[]).filter((f) => (Number((f as any)._pago) || 0) > 0), 'faturas'),
      },
      {
        label: 'A receber',
        value: formatCurrency(kpis.aReceber),
        sub: `No prazo: ${formatCurrency(kpis.noPrazo)}`,
        tone: 'blue',
        icon: BadgeDollarSign,
        onClick: () => abrirDrill('A receber', (filteredFaturas as any[]).filter((f) => (Number((f as any)._saldo) || 0) > 0), 'faturas'),
      },
      {
        label: 'Atrasado',
        value: formatCurrency(kpis.atrasado),
        sub: `Inadimplência: ${formatNumber(kpis.inadimplenciaPct, 2)}%`,
        tone: 'rose',
        icon: AlertTriangle,
        onClick: () => abrirDrill('Atrasadas', (filteredFaturas as any[]).filter((f) => (Number((f as any)._saldo) || 0) > 0 && (f as any)._overdue), 'faturas'),
      },
      {
        label: 'Vence em 3 dias',
        value: formatCurrency(kpis.dueSoon),
        sub: 'Radar de risco',
        tone: 'amber',
        icon: CalendarClock,
        onClick: () => abrirDrill('Vencendo em 3 dias', (filteredFaturas as any[]).filter((f) => (Number((f as any)._saldo) || 0) > 0 && (f as any)._dueSoon), 'faturas'),
      },
      {
        label: 'Disponíveis para faturar',
        value: formatCurrency(data0103?.totals?.frete_total || 0),
        sub: `${formatNumber(data0103?.totals?.ctes || 0)} CT-e(s)`,
        tone: 'orange',
        icon: PieChartIcon,
        onClick: () => abrirDrill('CT-es disponíveis para faturar', (data0103?.rows || []) as any[], 'ctes0103'),
      },
    ];
  }, [
    abrirDrill,
    data0103?.totals?.ctes,
    data0103?.totals?.frete_total,
    data0103?.rows,
    kpis.aReceber,
    kpis.atrasado,
    kpis.ctes,
    kpis.dueSoon,
    kpis.faturas,
    kpis.inadimplenciaPct,
    kpis.noPrazo,
    kpis.valorFaturado,
    kpisAll.ctesPago,
    kpisAll.pago,
    kpisAll.pagoFaturas,
    filteredFaturas,
    normalizedFaturas,
  ]);

  const aReceberPorUnidade = useMemo(() => {
    const by: Record<string, { key: string; name: string; value: number }> = {};
    for (const f of filteredFaturas as any[]) {
      const saldo = Number(f._saldo) || 0;
      if (saldo <= 0) continue;
      const key = unitSigla3(f.fil || f.unidade_responsavel || '—');
      if (!by[key]) by[key] = { key, name: key, value: 0 };
      by[key].value += saldo;
    }
    return Object.values(by).sort((a, b) => b.value - a.value).slice(0, 12);
  }, [filteredFaturas]);

  const aReceberPorTipoCobranca = useMemo(() => {
    const by: Record<string, { key: string; name: string; value: number }> = {};
    for (const f of filteredFaturas as any[]) {
      const saldo = Number(f._saldo) || 0;
      if (saldo <= 0) continue;
      const key = normTextKey(f.tipo_cobranca || '—') || '—';
      if (!by[key]) by[key] = { key, name: key, value: 0 };
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
    const recebido = Number(kpisAll.pago) || 0;
    const aberto = Number(kpis.aReceber) || 0;
    const atrasado = Number(kpis.atrasado) || 0;
    return [
      { name: 'Recebido', value: recebido, fill: '#16a34a' },
      { name: 'A receber', value: aberto, fill: '#2563eb' },
      { name: 'Atrasado', value: atrasado, fill: '#ef4444' },
      { name: 'A faturar', value: aFaturar, fill: '#f97316' },
    ];
  }, [data0103, kpis.aReceber, kpis.atrasado, kpisAll.pago]);

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

  const aFaturarByCob = useMemo(() => {
    const rows = data0103?.rows || [];
    const by: Record<string, number> = {};
    for (const r of rows) {
      const key = String((r as any).cob || '—').trim() || '—';
      by[key] = (by[key] || 0) + (Number((r as any).frete) || 0);
    }
    return Object.entries(by)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data0103]);

  const aFaturarByEm = useMemo(() => {
    const rows = data0103?.rows || [];
    const by: Record<string, number> = {};
    for (const r of rows) {
      const key = unitSigla3((r as any).em || '—');
      by[key] = (by[key] || 0) + (Number((r as any).frete) || 0);
    }
    return Object.entries(by)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [data0103]);

  const aFaturarTrendEmissao = useMemo(() => {
    const rows = data0103?.rows || [];
    const by: Record<string, number> = {};
    for (const r of rows) {
      const ts = parseDateBr(String((r as any).emissao || ''));
      if (!ts) continue;
      const dt = new Date(ts);
      const key = `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;
      by[key] = (by[key] || 0) + (Number((r as any).frete) || 0);
    }
    const parseKey = (k: string) => {
      const m = k.match(/^(\d{2})\/(\d{2})$/);
      if (!m) return 0;
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const dt = new Date(new Date().getFullYear(), mm - 1, dd, 12, 0, 0, 0);
      return dt.getTime();
    };
    return Object.entries(by)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => parseKey(a.name) - parseKey(b.name))
      .slice(-14);
  }, [data0103]);

  const aFaturarKpis = useMemo(() => {
    const rows = data0103?.rows || [];
    const totalFrete = Number(data0103?.totals?.frete_total) || rows.reduce((acc, r) => acc + (Number((r as any).frete) || 0), 0);
    const totalCtes = Number(data0103?.totals?.ctes) || rows.length;
    const pagadores = new Set<string>();
    const destinos = new Set<string>();
    const emissores = new Set<string>();
    for (const r of rows) {
      pagadores.add(normTextKey((r as any).pagador || '—'));
      destinos.add(normTextKey((r as any).dest || '—'));
      emissores.add(unitSigla3((r as any).em || '—'));
    }
    const topPagador = aFaturarByPagador[0] || null;
    const topDestino = aFaturarByDestino[0] || null;
    const topEm = aFaturarByEm[0] || null;
    return {
      totalFrete,
      totalCtes,
      totalPagadores: pagadores.size,
      totalDestinos: destinos.size,
      totalEm: emissores.size,
      topPagador,
      topDestino,
      topEm,
    };
  }, [aFaturarByDestino, aFaturarByEm, aFaturarByPagador, data0103]);

  const toggleAfSort = useCallback((key: typeof afSortKey) => {
    setAfSortKey((prevKey) => {
      if (prevKey !== key) {
        setAfSortDir('desc');
        return key;
      }
      setAfSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
      return prevKey;
    });
  }, []);

  const aFaturarFilteredSorted = useMemo(() => {
    const rows = (data0103?.rows || []) as any[];
    const q = normTextKey(afSearch);
    const filtered = !q
      ? rows
      : rows.filter((r) => {
          const hay = [
            r?.ctrc,
            r?.numero_cte,
            r?.pagador,
            r?.cnpj_pagador,
            r?.dest,
            r?.emissao,
            r?.prev_entrega,
            r?.chave_cte,
          ]
            .map((x) => normTextKey(x))
            .join(' ');
          return hay.includes(q);
        });

    const dir = afSortDir === 'asc' ? 1 : -1;
    const cmpText = (a: any, b: any) => String(a).localeCompare(String(b), 'pt-BR') * dir;
    const sorted = [...filtered].sort((a, b) => {
      if (afSortKey === 'ctrc') return cmpText(normTextKey(a?.ctrc), normTextKey(b?.ctrc));
      if (afSortKey === 'cte') return cmpText(normTextKey(a?.numero_cte), normTextKey(b?.numero_cte));
      if (afSortKey === 'pagador') return cmpText(normTextKey(a?.pagador), normTextKey(b?.pagador));
      if (afSortKey === 'dest') return cmpText(normTextKey(a?.dest), normTextKey(b?.dest));
      if (afSortKey === 'emissao') return ((parseDateBr(String(a?.emissao || '')) ?? 0) - (parseDateBr(String(b?.emissao || '')) ?? 0)) * dir;
      if (afSortKey === 'prev') return ((parseDateBr(String(a?.prev_entrega || '')) ?? 0) - (parseDateBr(String(b?.prev_entrega || '')) ?? 0)) * dir;
      return ((Number(a?.frete) || 0) - (Number(b?.frete) || 0)) * dir;
    });
    return sorted;
  }, [afSearch, afSortDir, afSortKey, data0103]);

  const aFaturarTotals = useMemo(() => {
    const totalFrete = (aFaturarFilteredSorted as any[]).reduce((acc, r) => acc + (Number(r?.frete) || 0), 0);
    return { totalFrete, totalCtes: aFaturarFilteredSorted.length };
  }, [aFaturarFilteredSorted]);

  const afPageSize = 80;
  const afTotalPages = useMemo(() => Math.max(1, Math.ceil(aFaturarFilteredSorted.length / afPageSize)), [aFaturarFilteredSorted.length]);
  useEffect(() => {
    setAfPage(1);
  }, [afSearch, afSortKey, afSortDir]);
  useEffect(() => {
    setAfPage((p) => Math.min(Math.max(1, p), afTotalPages));
  }, [afTotalPages]);

  const aFaturarPageRows = useMemo(() => {
    const start = (afPage - 1) * afPageSize;
    return (aFaturarFilteredSorted as any[]).slice(start, start + afPageSize);
  }, [aFaturarFilteredSorted, afPage]);

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

  const toggleDrillSort = useCallback((key: string) => {
    setDrillSortKey((prevKey) => {
      if (prevKey !== key) {
        setDrillSortDir('desc');
        return key;
      }
      setDrillSortDir((prevDir) => (prevDir === 'asc' ? 'desc' : 'asc'));
      return prevKey;
    });
  }, []);

  const drillSortedRows = useMemo(() => {
    const rows = Array.isArray(drillRows) ? [...drillRows] : [];
    const dir = drillSortDir === 'asc' ? 1 : -1;
    const key = String(drillSortKey || '').trim();
    const cmp = (a: any, b: any) => {
      if (drillKind === 'ctes0103') {
        const get = (x: any) => {
          if (key === 'frete') return Number(x?.frete) || 0;
          if (key === 'ctrc') return normTextKey(x?.ctrc);
          if (key === 'cte') return normTextKey(x?.numero_cte);
          if (key === 'pagador') return normTextKey(x?.pagador);
          if (key === 'dest') return normTextKey(x?.dest);
          if (key === 'emissao') return parseDateBr(String(x?.emissao || '')) ?? 0;
          if (key === 'prev') return parseDateBr(String(x?.prev_entrega || '')) ?? 0;
          return normTextKey(x?.ctrc);
        };
        const va = get(a);
        const vb = get(b);
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
        return String(va).localeCompare(String(vb), 'pt-BR') * dir;
      }

      const get = (x: any) => {
        if (key === 'saldo') return Number(x?.saldo) || 0;
        if (key === 'valor') return Number(x?.vlr_fatur) || 0;
        if (key === 'ctes') return Array.isArray(x?.ctes) ? x.ctes.length : 0;
        if (key === 'venc') return parseDateBr(String(x?.vencimento || '')) ?? 0;
        if (key === 'situacao') return normSituacaoLabel(x?.situacao);
        if (key === 'cliente') return normTextKey(x?.cliente);
        if (key === 'fatura') return normTextKey(x?.fatura);
        return Number(x?.saldo) || 0;
      };
      const va = get(a);
      const vb = get(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), 'pt-BR') * dir;
    };
    rows.sort(cmp);
    return rows;
  }, [drillKind, drillRows, drillSortDir, drillSortKey]);

  const drillTotals = useMemo(() => {
    if (drillKind === 'ctes0103') {
      const totalFrete = (drillSortedRows as any[]).reduce((acc, r) => acc + (Number(r?.frete) || 0), 0);
      return { totalFrete };
    }
    const totalSaldo = (drillSortedRows as any[]).reduce((acc, r) => acc + (Number(r?.saldo) || 0), 0);
    const totalValor = (drillSortedRows as any[]).reduce((acc, r) => acc + (Number(r?.vlr_fatur) || 0), 0);
    return { totalSaldo, totalValor };
  }, [drillKind, drillSortedRows]);

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
            <TabsList className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 w-full bg-transparent">
              <TabsTrigger value="visao_geral">Visão geral</TabsTrigger>
              <TabsTrigger value="a_receber">A receber</TabsTrigger>
              <TabsTrigger value="aging_a_receber">Gestão</TabsTrigger>
              <TabsTrigger value="a_faturar">A faturar</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="visao_geral" className="mt-4">
          {!data0049 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">Clique em Atualizar para ler o faturamento e ver os indicadores.</CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {kpiTiles.map((t) => (
                  <Tile key={t.label} label={t.label} value={t.value} sub={t.sub} tone={t.tone} Icon={t.icon} onClick={t.onClick} />
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
                        <AreaChart
                          data={previsaoSerie30d.series}
                          margin={{ top: 12, right: 10, bottom: 0, left: 0 }}
                          onClick={(e: any) => {
                            const label = String(e?.activeLabel ?? '').trim();
                            if (!label) return;
                            const idx = (previsaoSerie30d.series as any[]).findIndex((x) => String(x?.name ?? '').trim() === label);
                            if (idx < 0) return;
                            const ts = today0 + idx * 86400000;
                            const rows = (filteredFaturas as any[]).filter((f) => {
                              const saldo = Number((f as any)._saldo) || 0;
                              if (saldo <= 0) return false;
                              if ((f as any)._overdue) return false;
                              return Number((f as any)._vencTs0) === ts;
                            });
                            abrirDrill(`Previsão · ${label}`, rows, 'faturas');
                          }}
                        >
                          <defs>
                            <linearGradient id="cr_previsao" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
                              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" interval={4} />
                          <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                          <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
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
                          <YAxis type="category" dataKey="key" width={60} interval={0} tick={{ fontSize: 10 }} />
                          <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                          <Bar
                            dataKey="value"
                            name="A receber"
                            fill="url(#cr_unid)"
                            radius={[8, 8, 8, 8]}
                            onClick={(d: any) => {
                              const key = unitSigla3(d?.key ?? d?.name ?? '');
                              if (!key) return;
                              const rows = (filteredFaturas as any[]).filter((f) => {
                                const saldo = Number((f as any)._saldo) || 0;
                                if (saldo <= 0) return false;
                                return unitSigla3((f as any).fil || (f as any).unidade_responsavel || '') === key;
                              });
                              abrirDrill(`A receber · Unidade ${key}`, rows, 'faturas');
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
                          <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                          <Legend verticalAlign="bottom" height={36} />
                          <Pie
                            data={aReceberPorTipoCobranca.slice(0, 8)}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={90}
                            stroke="none"
                            onClick={(d: any) => {
                              const key = normTextKey(d?.name ?? '');
                              if (!key) return;
                              const rows = (filteredFaturas as any[]).filter((f) => {
                                const saldo = Number((f as any)._saldo) || 0;
                                if (saldo <= 0) return false;
                                return normTextKey((f as any).tipo_cobranca) === key;
                              });
                              abrirDrill(`A receber · Cobrança ${key}`, rows, 'faturas');
                            }}
                          >
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
                            <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                            <Bar
                              dataKey="value"
                              name="Valor"
                              stroke="none"
                              onClick={(d: any) => {
                                const name = String(d?.name ?? '').trim();
                                if (!name) return;
                                if (name === 'Recebido') {
                                  abrirDrill('Recebidas', (normalizedFaturas as any[]).filter((f) => (Number((f as any)._pago) || 0) > 0), 'faturas');
                                  return;
                                }
                                if (name === 'A receber') {
                                  abrirDrill('A receber', (filteredFaturas as any[]).filter((f) => (Number((f as any)._saldo) || 0) > 0), 'faturas');
                                  return;
                                }
                                if (name === 'Atrasado') {
                                  abrirDrill('Atrasadas', (filteredFaturas as any[]).filter((f) => (Number((f as any)._saldo) || 0) > 0 && (f as any)._overdue), 'faturas');
                                  return;
                                }
                                if (name === 'A faturar') {
                                  abrirDrill('CT-es disponíveis para faturar', (data0103?.rows || []) as any[], 'ctes0103');
                                }
                              }}
                            >
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Tile
                  label="Total a receber"
                  value={formatCurrency(arCards.totalReceber)}
                  sub={`${formatNumber(arCards.countReceber)} fatura(s)`}
                  tone="blue"
                  Icon={BadgeDollarSign}
                  onClick={() => abrirDrill('A receber', arSortedRows as any[], 'faturas')}
                />
                <Tile
                  label="Total a vencer"
                  value={formatCurrency(arCards.totalVencer)}
                  sub={`${formatNumber(arCards.countVencer)} fatura(s)`}
                  tone="indigo"
                  Icon={CalendarClock}
                  onClick={() =>
                    abrirDrill(
                      'A vencer',
                      (arSortedRows as any[]).filter((f) => !(f as any)._overdue),
                      'faturas'
                    )
                  }
                />
                <Tile
                  label="Total atrasado"
                  value={formatCurrency(arCards.totalAtrasado)}
                  sub={`${formatNumber(arCards.countAtrasado)} fatura(s)`}
                  tone="amber"
                  Icon={AlertTriangle}
                  onClick={() =>
                    abrirDrill(
                      'Atrasadas',
                      (arSortedRows as any[]).filter((f) => (f as any)._overdue),
                      'faturas'
                    )
                  }
                />
                <Tile
                  label="Atrasado há +10 dias"
                  value={formatCurrency(arCards.totalAtrasado10)}
                  sub={`${formatNumber(arCards.countAtrasado10)} fatura(s)`}
                  tone="rose"
                  Icon={AlertTriangle}
                  onClick={() =>
                    abrirDrill(
                      'Atrasadas (+10 dias)',
                      (arSortedRows as any[]).filter((f) => (f as any)._overdue && (Number((f as any)._diasAtraso) || 0) > 10),
                      'faturas'
                    )
                  }
                />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">Faturas (busca e exportação)</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2"
                      onClick={() => {
                        const csv = buildCsvFaturas(arSortedRows as any);
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
                    <div className="text-sm text-muted-foreground">{`${formatNumber(arSortedRows.length)} fatura(s)`}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-base">Lista</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-muted-foreground">{`Página ${arPage} de ${arTotalPages}`}</div>
                      <Button variant="outline" size="sm" className="h-9" onClick={() => setArPage((p) => Math.max(1, p - 1))} disabled={arPage <= 1}>
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9"
                        onClick={() => setArPage((p) => Math.min(arTotalPages, p + 1))}
                        disabled={arPage >= arTotalPages}
                      >
                        Próxima
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[140vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                        <tr className="text-left border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          <th className="py-2 pr-3 pl-4">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('fatura')}>
                              <span>Fatura</span>
                              <SortIndicator active={arSortKey === 'fatura'} dir={arSortDir} />
                            </button>
                          </th>
                          <th className="py-2 pr-3">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('cliente')}>
                              <span>Cliente</span>
                              <SortIndicator active={arSortKey === 'cliente'} dir={arSortDir} />
                            </button>
                          </th>
                          <th className="py-2 pr-3">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('unid')}>
                              <span>Unid</span>
                              <SortIndicator active={arSortKey === 'unid'} dir={arSortDir} />
                            </button>
                          </th>
                          <th className="py-2 pr-3">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('venc')}>
                              <span>Vencimento</span>
                              <SortIndicator active={arSortKey === 'venc'} dir={arSortDir} />
                            </button>
                          </th>
                          <th className="py-2 pr-3 text-right">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('valor')}>
                              <span>Valor</span>
                              <SortIndicator active={arSortKey === 'valor'} dir={arSortDir} />
                            </button>
                          </th>
                          <th className="py-2 pr-3 text-right">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('pago')}>
                              <span>Pago</span>
                              <SortIndicator active={arSortKey === 'pago'} dir={arSortDir} />
                            </button>
                          </th>
                          <th className="py-2 pr-3 text-right">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('saldo')}>
                              <span>Saldo</span>
                              <SortIndicator active={arSortKey === 'saldo'} dir={arSortDir} />
                            </button>
                          </th>
                          <th className="py-2 pr-3">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('situacao')}>
                              <span>Situação</span>
                              <SortIndicator active={arSortKey === 'situacao'} dir={arSortDir} />
                            </button>
                          </th>
                          <th className="py-2 pr-3 text-right">
                            <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleArSort('ctes')}>
                              <span>CT-es</span>
                              <SortIndicator active={arSortKey === 'ctes'} dir={arSortDir} />
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {arPageRows.map((f: any) => (
                          <tr key={f.fatura} className="border-b last:border-0">
                            <td className="py-2 pr-3 pl-4 font-mono">{f.fatura}</td>
                            <td className="py-2 pr-3">
                              <div className="font-medium">{f.cliente}</div>
                              <div className="text-xs text-muted-foreground font-mono">{f.cnpj}</div>
                            </td>
                            <td className="py-2 pr-3 font-mono">{unitSigla3(f.fil || f.unidade_responsavel)}</td>
                            <td className="py-2 pr-3 font-mono">
                              <span className={f._overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}>{f.vencimento}</span>
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f._vlrFatur)}</td>
                            <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f._pago)}</td>
                            <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f._saldo)}</td>
                            <td className="py-2 pr-3">
                              <SituacaoBadge value={f.situacao} />
                            </td>
                            <td className="py-2 pr-3 text-right font-mono">{formatNumber(f.ctes?.length || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="sticky bottom-0 z-10 bg-slate-50 dark:bg-slate-900">
                        <tr className="border-t border-slate-200 dark:border-slate-800">
                          <td className="py-2 pr-3 pl-4 font-semibold" colSpan={4}>
                            Total
                          </td>
                          <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency(arTotals.totalValor)}</td>
                          <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency(arTotals.totalPago)}</td>
                          <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency(arTotals.totalSaldo)}</td>
                          <td className="py-2 pr-3" colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Tile
                  label="A receber"
                  value={formatCurrency(mgmt.total.aReceber)}
                  sub={`${formatNumber(mgmt.counts.aReceber)} fatura(s)`}
                  tone="blue"
                  Icon={BadgeDollarSign}
                  onClick={() => abrirDrill('A receber', aReceberBaseRows as any[], 'faturas')}
                />
                <Tile
                  label="A vencer"
                  value={formatCurrency(mgmt.total.aVencer)}
                  sub={`${formatNumber(mgmt.counts.aVencer)} fatura(s)`}
                  tone="indigo"
                  Icon={CalendarClock}
                  onClick={() => abrirDrill('A vencer', (aReceberBaseRows as any[]).filter((f) => !(f as any)._overdue), 'faturas')}
                />
                <Tile
                  label="Atrasado"
                  value={formatCurrency(mgmt.total.atrasado)}
                  sub={`${formatNumber(mgmt.counts.atrasado)} fatura(s)`}
                  tone="amber"
                  Icon={AlertTriangle}
                  onClick={() => abrirDrill('Atrasadas', (aReceberBaseRows as any[]).filter((f) => (f as any)._overdue), 'faturas')}
                />
                <Tile
                  label="Atrasado +10 dias"
                  value={formatCurrency(mgmt.total.atrasado10)}
                  sub={`${formatNumber(mgmt.counts.atrasado10)} fatura(s)`}
                  tone="rose"
                  Icon={AlertTriangle}
                  onClick={() =>
                    abrirDrill(
                      'Atrasadas (+10 dias)',
                      (aReceberBaseRows as any[]).filter((f) => (f as any)._overdue && (Number((f as any)._diasAtraso) || 0) > 10),
                      'faturas'
                    )
                  }
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="lg:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Risco por unidade (atrasos por faixa)</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={mgmt.unitOverdueStack}
                        layout="vertical"
                        margin={{ top: 10, right: 10, bottom: 0, left: 0 }}
                        barCategoryGap={12}
                      >
                        <defs>
                          <linearGradient id="cr_risk_01" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#fde68a" />
                            <stop offset="100%" stopColor="#f59e0b" />
                          </linearGradient>
                          <linearGradient id="cr_risk_02" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#fed7aa" />
                            <stop offset="100%" stopColor="#fb923c" />
                          </linearGradient>
                          <linearGradient id="cr_risk_03" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#fdba74" />
                            <stop offset="100%" stopColor="#f97316" />
                          </linearGradient>
                          <linearGradient id="cr_risk_04" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#fca5a5" />
                            <stop offset="100%" stopColor="#ef4444" />
                          </linearGradient>
                          <linearGradient id="cr_risk_05" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#f87171" />
                            <stop offset="100%" stopColor="#dc2626" />
                          </linearGradient>
                          <linearGradient id="cr_risk_06" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#7f1d1d" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                        <YAxis type="category" dataKey="unit" width={60} interval={0} tick={{ fontSize: 10 }} />
                        <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                        <Legend formatter={(v: any) => overdueBucketLabel(String(v))} />
                        <Bar
                          dataKey="d01_07"
                          name="d01_07"
                          stackId="a"
                          fill="url(#cr_risk_01)"
                          radius={[10, 10, 10, 10]}
                          onClick={(_: any, idx: number) => {
                            const row = (mgmt.unitOverdueStack as any[])[idx];
                            const unit = String(row?.unit || '');
                            if (!unit) return;
                            abrirDrill(`Atrasadas · Unidade ${unit} · 1–7d`, (aReceberBaseRows as any[]).filter((f) => unitSigla3((f as any).fil || (f as any).unidade_responsavel) === unit && (f as any)._overdue && (Number((f as any)._diasAtraso) || 0) <= 7), 'faturas');
                          }}
                        />
                        <Bar
                          dataKey="d08_15"
                          name="d08_15"
                          stackId="a"
                          fill="url(#cr_risk_02)"
                          radius={[10, 10, 10, 10]}
                          onClick={(_: any, idx: number) => {
                            const row = (mgmt.unitOverdueStack as any[])[idx];
                            const unit = String(row?.unit || '');
                            if (!unit) return;
                            abrirDrill(`Atrasadas · Unidade ${unit} · 8–15d`, (aReceberBaseRows as any[]).filter((f) => unitSigla3((f as any).fil || (f as any).unidade_responsavel) === unit && (f as any)._overdue && (Number((f as any)._diasAtraso) || 0) > 7 && (Number((f as any)._diasAtraso) || 0) <= 15), 'faturas');
                          }}
                        />
                        <Bar
                          dataKey="d16_30"
                          name="d16_30"
                          stackId="a"
                          fill="url(#cr_risk_03)"
                          radius={[10, 10, 10, 10]}
                          onClick={(_: any, idx: number) => {
                            const row = (mgmt.unitOverdueStack as any[])[idx];
                            const unit = String(row?.unit || '');
                            if (!unit) return;
                            abrirDrill(`Atrasadas · Unidade ${unit} · 16–30d`, (aReceberBaseRows as any[]).filter((f) => unitSigla3((f as any).fil || (f as any).unidade_responsavel) === unit && (f as any)._overdue && (Number((f as any)._diasAtraso) || 0) > 15 && (Number((f as any)._diasAtraso) || 0) <= 30), 'faturas');
                          }}
                        />
                        <Bar
                          dataKey="d31_60"
                          name="d31_60"
                          stackId="a"
                          fill="url(#cr_risk_04)"
                          radius={[10, 10, 10, 10]}
                          onClick={(_: any, idx: number) => {
                            const row = (mgmt.unitOverdueStack as any[])[idx];
                            const unit = String(row?.unit || '');
                            if (!unit) return;
                            abrirDrill(`Atrasadas · Unidade ${unit} · 31–60d`, (aReceberBaseRows as any[]).filter((f) => unitSigla3((f as any).fil || (f as any).unidade_responsavel) === unit && (f as any)._overdue && (Number((f as any)._diasAtraso) || 0) > 30 && (Number((f as any)._diasAtraso) || 0) <= 60), 'faturas');
                          }}
                        />
                        <Bar
                          dataKey="d61_90"
                          name="d61_90"
                          stackId="a"
                          fill="url(#cr_risk_05)"
                          radius={[10, 10, 10, 10]}
                          onClick={(_: any, idx: number) => {
                            const row = (mgmt.unitOverdueStack as any[])[idx];
                            const unit = String(row?.unit || '');
                            if (!unit) return;
                            abrirDrill(`Atrasadas · Unidade ${unit} · 61–90d`, (aReceberBaseRows as any[]).filter((f) => unitSigla3((f as any).fil || (f as any).unidade_responsavel) === unit && (f as any)._overdue && (Number((f as any)._diasAtraso) || 0) > 60 && (Number((f as any)._diasAtraso) || 0) <= 90), 'faturas');
                          }}
                        />
                        <Bar
                          dataKey="d91_plus"
                          name="d91_plus"
                          stackId="a"
                          fill="url(#cr_risk_06)"
                          radius={[10, 10, 10, 10]}
                          onClick={(_: any, idx: number) => {
                            const row = (mgmt.unitOverdueStack as any[])[idx];
                            const unit = String(row?.unit || '');
                            if (!unit) return;
                            abrirDrill(`Atrasadas · Unidade ${unit} · 91+d`, (aReceberBaseRows as any[]).filter((f) => unitSigla3((f as any).fil || (f as any).unidade_responsavel) === unit && (f as any)._overdue && (Number((f as any)._diasAtraso) || 0) > 90), 'faturas');
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Concentração por cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                        <Legend formatter={(v: any) => shortLabel(v, 10)} />
                        <Pie
                          data={mgmt.concentracaoCliente}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={70}
                          outerRadius={110}
                          paddingAngle={2}
                          stroke="none"
                          strokeWidth={0}
                        >
                          {(mgmt.concentracaoCliente as any[]).map((_: any, i: number) => (
                            <Cell key={i} fill={(mgmt.colorsClientes as any[])[i % (mgmt.colorsClientes as any[]).length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Top clientes em atraso</CardTitle>
                  </CardHeader>
                  <CardContent className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mgmt.clientesTopOverdue} margin={{ top: 10, right: 10, bottom: 70, left: 0 }}>
                        <defs>
                          <linearGradient id="cr_top_overdue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fbbf24" />
                            <stop offset="100%" stopColor="#f97316" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          interval={0}
                          tickFormatter={(v) => shortLabel(v, 10)}
                          tick={{ fontSize: 10 }}
                          angle={-35}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                        <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                        <Bar
                          dataKey="value"
                          name="Atrasado"
                          fill="url(#cr_top_overdue)"
                          radius={[8, 8, 8, 8]}
                          onClick={(_: any, idx: number) => {
                            const row = (mgmt.clientesTopOverdue as any[])[idx];
                            const name = String(row?.name || '').trim();
                            if (!name) return;
                            abrirDrill(`Atrasadas · Cliente ${name}`, (aReceberBaseRows as any[]).filter((f) => (f as any)._overdue && normTextKey((f as any).cliente) === normTextKey(name)), 'faturas');
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Alertas · faturas mais antigas em atraso</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="max-h-[320px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                          <tr className="text-left border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <th className="py-2 pr-3 pl-4">Fatura</th>
                            <th className="py-2 pr-3">Cliente</th>
                            <th className="py-2 pr-3">Unid</th>
                            <th className="py-2 pr-3 text-right">Dias</th>
                            <th className="py-2 pr-3">Venc.</th>
                            <th className="py-2 pr-3 text-right">Saldo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(mgmt.alertsTop as any[]).map((f: any) => (
                            <tr
                              key={String(f?.fatura || '')}
                              className="border-b last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40"
                              onClick={() => abrirDrill(`Fatura ${f.fatura}`, [f], 'faturas')}
                            >
                              <td className="py-2 pr-3 pl-4 font-mono">{f.fatura}</td>
                              <td className="py-2 pr-3">
                                <div className="font-medium">{f.cliente}</div>
                              </td>
                              <td className="py-2 pr-3 font-mono">{unitSigla3(f.fil || f.unidade_responsavel)}</td>
                              <td className="py-2 pr-3 text-right font-mono text-rose-600 dark:text-rose-300 font-semibold">{formatNumber(Number(f._diasAtraso) || 0)}</td>
                              <td className="py-2 pr-3 font-mono">{f.vencimento}</td>
                              <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency(Number(f._saldo) || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="a_faturar" className="mt-4">
          <div className="space-y-4">
            {!data0103 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">Use o botão Atualizar no topo para ler os CT-es a faturar.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Tile
                    label="CT-es"
                    value={formatNumber(aFaturarKpis.totalCtes)}
                    sub={`Atualização: ${data0103.meta.updated_at || data0103.meta.gerado_em}`}
                    tone="orange"
                    Icon={RefreshCw}
                    onClick={() => abrirDrill('CT-es disponíveis para faturar', aFaturarFilteredSorted as any[], 'ctes0103')}
                  />
                  <Tile
                    label="Frete total"
                    value={formatCurrency(aFaturarKpis.totalFrete)}
                    sub={`Ref. fim: ${data0103.meta.ref_fim_dmy || data0103.meta.ontem_dmy}`}
                    tone="indigo"
                    Icon={TrendingUp}
                    onClick={() => abrirDrill('CT-es disponíveis para faturar', aFaturarFilteredSorted as any[], 'ctes0103')}
                  />
                  <Tile
                    label="Pagadores"
                    value={formatNumber(aFaturarKpis.totalPagadores)}
                    sub={aFaturarKpis.topPagador ? `Top: ${shortLabel(aFaturarKpis.topPagador.name, 22)}` : '—'}
                    tone="blue"
                    Icon={PieChartIcon}
                    onClick={() => abrirDrill('CT-es disponíveis para faturar', aFaturarFilteredSorted as any[], 'ctes0103')}
                  />
                  <Tile
                    label="Destinos"
                    value={formatNumber(aFaturarKpis.totalDestinos)}
                    sub={aFaturarKpis.topDestino ? `Top: ${shortLabel(aFaturarKpis.topDestino.name, 22)}` : '—'}
                    tone="emerald"
                    Icon={BadgeDollarSign}
                    onClick={() => abrirDrill('CT-es disponíveis para faturar', aFaturarFilteredSorted as any[], 'ctes0103')}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Top destinos (frete)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      {aFaturarByDestino.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aFaturarByDestino} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 10 }} barCategoryGap={10}>
                            <defs>
                              <linearGradient id="cr_af_dest" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#fed7aa" />
                                <stop offset="100%" stopColor="#f97316" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                            <YAxis type="category" dataKey="name" width={70} tickFormatter={(v) => shortLabel(v, 10)} tick={{ fontSize: 10 }} interval={0} />
                            <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                            <Bar
                              dataKey="value"
                              name="Frete"
                              fill="url(#cr_af_dest)"
                              radius={[10, 10, 10, 10]}
                              onClick={(d: any) => {
                                const key = String(d?.name ?? '').trim();
                                if (!key) return;
                                const rows = (data0103?.rows || []).filter((r) => String((r as any).dest || '').trim() === key);
                                abrirDrill(`A faturar · Destino ${key}`, rows as any[], 'ctes0103');
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-3">
                        <CardTitle className="text-base">Concentração por cobrança</CardTitle>
                        <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{`Top 5 pagadores = ${formatNumber(
                          aFaturarConcentracaoTop5,
                          2
                        )}%`}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      {aFaturarByCob.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                            <Legend formatter={(v: any) => shortLabel(v, 10)} />
                            <Pie data={aFaturarByCob} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2} stroke="none" strokeWidth={0}>
                              {(aFaturarByCob as any[]).map((_: any, i: number) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Top pagadores (frete)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      {aFaturarByPagador.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aFaturarByPagador} layout="vertical" margin={{ top: 10, right: 10, bottom: 0, left: 10 }} barCategoryGap={10}>
                            <defs>
                              <linearGradient id="cr_af_pag" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#dbeafe" />
                                <stop offset="100%" stopColor="#2563eb" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                            <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} tickFormatter={(v) => shortLabel(v, 18)} interval={0} />
                            <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                            <Bar
                              dataKey="value"
                              name="Frete"
                              fill="url(#cr_af_pag)"
                              radius={[10, 10, 10, 10]}
                              onClick={(d: any) => {
                                const key = String(d?.name ?? '').trim();
                                if (!key) return;
                                const rows = (data0103?.rows || []).filter((r) => String((r as any).pagador || '').trim() === key);
                                abrirDrill(`A faturar · Pagador ${key}`, rows as any[], 'ctes0103');
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Tendência por emissão (frete)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[320px]">
                      {aFaturarTrendEmissao.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={aFaturarTrendEmissao} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                            <defs>
                              <linearGradient id="cr_af_trend" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.6} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tickFormatter={(v) => formatNumber(Number(v) / 1000, 0) + 'k'} />
                            <RechartsTooltip content={(p: any) => <CrChartTooltip {...p} valueFormatter={formatCurrency} />} />
                            <Area type="monotone" dataKey="value" name="Frete" stroke="#f97316" fill="url(#cr_af_trend)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <CardTitle className="text-base">Lista (CT-es)</CardTitle>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">{`Página ${afPage} de ${afTotalPages}`}</div>
                        <Button variant="outline" size="sm" className="h-9" onClick={() => setAfPage((p) => Math.max(1, p - 1))} disabled={afPage <= 1}>
                          Anterior
                        </Button>
                        <Button variant="outline" size="sm" className="h-9" onClick={() => setAfPage((p) => Math.min(afTotalPages, p + 1))} disabled={afPage >= afTotalPages}>
                          Próxima
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 gap-2"
                          onClick={() => {
                            const csv = buildCsv0103(aFaturarFilteredSorted as any);
                            const stamp = new Date();
                            const pad = (n: number) => String(n).padStart(2, '0');
                            downloadCsv(
                              `contas_receber_a_faturar_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.csv`,
                              csv
                            );
                          }}
                        >
                          <Download className="w-4 h-4" />
                          CSV
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input className="pl-9" placeholder="Buscar: CTRC, CT-e, pagador, CNPJ, destino, chave..." value={afSearch} onChange={(e) => setAfSearch(e.target.value)} />
                      </div>
                      <div className="text-sm text-muted-foreground">{`${formatNumber(aFaturarTotals.totalCtes)} CT-e(s) · ${formatCurrency(
                        aFaturarTotals.totalFrete
                      )}`}</div>
                    </div>

                    <div className="p-0">
                      <div className="max-h-[140vh] overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900">
                            <tr className="text-left border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              <th className="py-2 pr-3 pl-4">
                                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAfSort('ctrc')}>
                                  <span>CTRC</span>
                                  <SortIndicator active={afSortKey === 'ctrc'} dir={afSortDir} />
                                </button>
                              </th>
                              <th className="py-2 pr-3">
                                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAfSort('cte')}>
                                  <span>CT-e</span>
                                  <SortIndicator active={afSortKey === 'cte'} dir={afSortDir} />
                                </button>
                              </th>
                              <th className="py-2 pr-3">
                                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAfSort('pagador')}>
                                  <span>Pagador</span>
                                  <SortIndicator active={afSortKey === 'pagador'} dir={afSortDir} />
                                </button>
                              </th>
                              <th className="py-2 pr-3">
                                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAfSort('dest')}>
                                  <span>Dest</span>
                                  <SortIndicator active={afSortKey === 'dest'} dir={afSortDir} />
                                </button>
                              </th>
                              <th className="py-2 pr-3 text-right">
                                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAfSort('frete')}>
                                  <span>Frete</span>
                                  <SortIndicator active={afSortKey === 'frete'} dir={afSortDir} />
                                </button>
                              </th>
                              <th className="py-2 pr-3">
                                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAfSort('emissao')}>
                                  <span>Emissão</span>
                                  <SortIndicator active={afSortKey === 'emissao'} dir={afSortDir} />
                                </button>
                              </th>
                              <th className="py-2 pr-3">
                                <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleAfSort('prev')}>
                                  <span>Prev. Entrega</span>
                                  <SortIndicator active={afSortKey === 'prev'} dir={afSortDir} />
                                </button>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {aFaturarPageRows.map((r: any, i: number) => (
                              <tr
                                key={`${r.ctrc}-${r.numero_cte}-${i}`}
                                className="border-b last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40"
                                onClick={() => abrirDrill(`CT-e ${r.numero_cte}`, [r], 'ctes0103')}
                              >
                                <td className="py-2 pr-3 pl-4 font-mono">{r.ctrc}</td>
                                <td className="py-2 pr-3 font-mono">{r.numero_cte}</td>
                                <td className="py-2 pr-3">
                                  <div className="font-medium">{r.pagador}</div>
                                </td>
                                <td className="py-2 pr-3 font-mono">{r.dest}</td>
                                <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.frete)}</td>
                                <td className="py-2 pr-3 font-mono">{r.emissao}</td>
                                <td className="py-2 pr-3 font-mono">{r.prev_entrega}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="sticky bottom-0 z-10 bg-slate-50 dark:bg-slate-900">
                            <tr className="border-t border-slate-200 dark:border-slate-800">
                              <td className="py-2 pr-3 pl-4 font-semibold" colSpan={4}>
                                Total
                              </td>
                              <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency(aFaturarTotals.totalFrete)}</td>
                              <td className="py-2 pr-3" colSpan={2} />
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="sm:max-w-[1050px] h-[calc(100vh-120px)] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <div className="flex items-center justify-between gap-3">
              <DialogTitle>{drillTitle}</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 mr-[25px]"
                onClick={() => {
                  const stamp = new Date();
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const filename = `contas_receber_drill_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(stamp.getMinutes())}.csv`;
                  if (drillKind === 'ctes0103') {
                    const csv = buildCsv0103(drillSortedRows as any);
                    downloadCsv(filename, csv);
                    return;
                  }
                  const csv = buildCsvFaturas(drillSortedRows as any);
                  downloadCsv(filename, csv);
                }}
              >
                <Download className="w-4 h-4" />
                CSV
              </Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>{`Registros: ${formatNumber(drillSortedRows.length || 0)}`}</span>
              {drillKind === 'ctes0103' ? (
                <span>{`· Frete total: ${formatCurrency((drillTotals as any)?.totalFrete || 0)}`}</span>
              ) : (
                <>
                  <span>{`· Saldo total: ${formatCurrency((drillTotals as any)?.totalSaldo || 0)}`}</span>
                  <span>{`· Valor total: ${formatCurrency((drillTotals as any)?.totalValor || 0)}`}</span>
                </>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="overflow-x-auto">
              {drillKind === 'ctes0103' ? (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900/60">
                    <tr className="text-left border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('ctrc')}>
                          <span>CTRC</span>
                          <SortIndicator active={drillSortKey === 'ctrc'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('cte')}>
                          <span>CT-e</span>
                          <SortIndicator active={drillSortKey === 'cte'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('pagador')}>
                          <span>Pagador</span>
                          <SortIndicator active={drillSortKey === 'pagador'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('dest')}>
                          <span>Dest</span>
                          <SortIndicator active={drillSortKey === 'dest'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3 text-right">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('frete')}>
                          <span>Frete</span>
                          <SortIndicator active={drillSortKey === 'frete'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('emissao')}>
                          <span>Emissão</span>
                          <SortIndicator active={drillSortKey === 'emissao'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('prev')}>
                          <span>Prev. Entrega</span>
                          <SortIndicator active={drillSortKey === 'prev'} dir={drillSortDir} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(drillSortedRows as any[]).slice(0, 1200).map((r: any, i: number) => (
                      <tr key={`${r?.ctrc || ''}-${r?.numero_cte || ''}-${i}`} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono">{r.ctrc}</td>
                        <td className="py-2 pr-3 font-mono">{r.numero_cte}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{r.pagador}</div>
                          <div className="text-xs text-muted-foreground font-mono">{r.cnpj_pagador}</div>
                        </td>
                        <td className="py-2 pr-3 font-mono">{r.dest}</td>
                        <td className="py-2 pr-3 text-right font-mono">{formatCurrency(Number(r.frete) || 0)}</td>
                        <td className="py-2 pr-3 font-mono">{r.emissao}</td>
                        <td className="py-2 pr-3 font-mono">{r.prev_entrega}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-slate-50 dark:bg-slate-900/60">
                    <tr className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-2 pr-3 font-semibold" colSpan={4}>
                        Total
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency((drillTotals as any)?.totalFrete || 0)}</td>
                      <td className="py-2 pr-3" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900/60">
                    <tr className="text-left border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('fatura')}>
                          <span>Fatura</span>
                          <SortIndicator active={drillSortKey === 'fatura'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('cliente')}>
                          <span>Cliente</span>
                          <SortIndicator active={drillSortKey === 'cliente'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('venc')}>
                          <span>Vencimento</span>
                          <SortIndicator active={drillSortKey === 'venc'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3 text-right">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('saldo')}>
                          <span>Saldo</span>
                          <SortIndicator active={drillSortKey === 'saldo'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3 text-right">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('valor')}>
                          <span>Valor</span>
                          <SortIndicator active={drillSortKey === 'valor'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('situacao')}>
                          <span>Situação</span>
                          <SortIndicator active={drillSortKey === 'situacao'} dir={drillSortDir} />
                        </button>
                      </th>
                      <th className="py-2 pr-3 text-right">
                        <button type="button" className="inline-flex items-center gap-1" onClick={() => toggleDrillSort('ctes')}>
                          <span>CT-es</span>
                          <SortIndicator active={drillSortKey === 'ctes'} dir={drillSortDir} />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(drillSortedRows as any[]).slice(0, 800).map((f: any) => (
                      <tr key={f.fatura} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-mono">{f.fatura}</td>
                        <td className="py-2 pr-3">
                          <div className="font-medium">{f.cliente}</div>
                        </td>
                        <td className="py-2 pr-3 font-mono">{f.vencimento}</td>
                        <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f.saldo)}</td>
                        <td className="py-2 pr-3 text-right font-mono">{formatCurrency(f.vlr_fatur)}</td>
                        <td className="py-2 pr-3">
                          <SituacaoBadge value={f.situacao} />
                        </td>
                        <td className="py-2 pr-3 text-right font-mono">{formatNumber(f.ctes?.length || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-slate-50 dark:bg-slate-900/60">
                    <tr className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-2 pr-3 font-semibold" colSpan={3}>
                        Total
                      </td>
                      <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency((drillTotals as any)?.totalSaldo || 0)}</td>
                      <td className="py-2 pr-3 text-right font-mono font-semibold">{formatCurrency((drillTotals as any)?.totalValor || 0)}</td>
                      <td className="py-2 pr-3" colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
