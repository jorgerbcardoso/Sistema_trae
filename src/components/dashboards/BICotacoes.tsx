import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  Filter,
  Loader2,
  Search,
  Download,
  Target,
  TrendingUp,
  Users,
  Building2,
  User as UserIcon,
  ArrowUpRight,
  Trophy,
  MapPin,
  CalendarDays,
  AlertTriangle,
} from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { FilterSelectCliente } from './FilterSelectCliente';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { toast } from 'sonner';

type FreteTipoFiltro = 'C' | 'F' | 'T';
type SituacaoFiltro = 'C' | 'D' | 'F' | 'E' | 'K' | 'T';

type StatusKind = 'COTADO' | 'CONTRAT' | 'CTRC_EMI' | 'OUTRO';

interface CotacaoRow {
  cotacao: string;
  unidade_inclusao: string;
  usuario_inclusao: string;
  cnpj_pagador: string;
  nome_pagador: string;
  vendedor: string;
  origem: string;
  destino: string;
  tipo_frete: string;
  valor_nf: number;
  peso: number;
  cubagem: number;
  proposta_atual: number;
  situacao: string;
  status_kind: StatusKind;
  ctrc: string;
  data_inclusao: string;
  validade: string;
  data_emissao_ctrc: string;
  frete_ctrc: number;
}

interface AggRow {
  key: string;
  label: string;
  cotacoes: number;
  contratadas: number;
  ctrc_emi: number;
  potencial: number;
  convertido: number;
  conversao: number;
}

interface ApiData {
  totals: {
    cotacoes: number;
    cotado: number;
    contrat: number;
    cot_fix: number;
    ctrc_emi: number;
    potencial: number;
    convertido: number;
    conversao: number;
  };
  byStatus: AggRow[];
  byUser: AggRow[];
  byUnidadeInclusao: AggRow[];
  byCliente: AggRow[];
  rows: CotacaoRow[];
  comparisons?: {
    prev_period?: { periodo_ini: string; periodo_fim: string; totals: ApiData['totals'] | null };
    year_ago?: { periodo_ini: string; periodo_fim: string; totals: ApiData['totals'] | null };
  };
  meta?: { truncated?: boolean; max_rows?: number; ssw_url?: string };
}

interface Filters {
  periodoIni: string;
  periodoFim: string;
  f7: FreteTipoFiltro;
  f8: SituacaoFiltro;
  f11: string;
  f13: string;
  f14: string;
  f16: string;
}

const PALETTE = ['#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#a855f7', '#94a3b8'];

const pad = (n: number) => String(n).padStart(2, '0');
const fmtIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => fmtIso(new Date());

const toNumber = (v: any) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (n: number) => new Intl.NumberFormat('pt-BR').format(toNumber(n));
const formatCurrency = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(toNumber(n));
const formatPercent = (n: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    Math.max(0, Math.min(1, toNumber(n)))
  );

const parseIso = (s: string) => {
  if (!s) return null;
  const ts = Date.parse(s.includes(' ') ? s.replace(' ', 'T') : s);
  return Number.isFinite(ts) ? ts : null;
};

const isSoon = (isoDateOrDateTime: string, days: number) => {
  const ts = parseIso(isoDateOrDateTime);
  if (!ts) return false;
  const now = new Date();
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 23, 59, 59, 999).getTime();
  return ts <= limit;
};

const downloadTextFile = (content: string, filename: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const csvEscape = (v: any) => {
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(';') || s.includes('\n') || s.includes('\r')) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

export function BICotacoes() {
  usePageTitle('BI · Cotações');
  const { user } = useAuth();

  const getDefaultFilters = useCallback((): Filters => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const unidadeUser = String(user?.unidade_atual || user?.unidade || '').toUpperCase();
    const sugestaoF11 = unidadeUser && unidadeUser !== 'MTZ' ? unidadeUser : '';
    return {
      periodoIni: fmtIso(start),
      periodoFim: fmtIso(end),
      f7: 'T',
      f8: 'T',
      f11: sugestaoF11,
      f13: '',
      f14: '',
      f16: '',
    };
  }, [user]);

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => getDefaultFilters());
  const [tempFilters, setTempFilters] = useState<Filters>(() => getDefaultFilters());

  const [activeTab, setActiveTab] = useState<'pipeline' | 'usuarios' | 'clientes' | 'origem-destino' | 'ranking' | 'lista'>('pipeline');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [data, setData] = useState<ApiData | null>(null);

  const [quickStatus, setQuickStatus] = useState<'ALL' | 'COTADO' | 'CONTRAT' | 'CTRC_EMI'>('ALL');
  const [search, setSearch] = useState('');
  const [dailyMode, setDailyMode] = useState<'cotacoes' | 'ctrc_emi'>('cotacoes');
  const [origemDestinoMode, setOrigemDestinoMode] = useState<'origem' | 'destino'>('origem');

  const runRef = useRef(0);
  const initialLoadRef = useRef(false);

  const clearFilters = () => {
    const d = getDefaultFilters();
    setTempFilters(d);
  };

  const applyFilters = () => {
    setFilters({ ...tempFilters });
    setShowFilters(false);
  };

  const cancelFilters = () => {
    setTempFilters({ ...filters });
    setShowFilters(false);
  };

  const carregar = async (override?: Filters) => {
    const runId = Date.now();
    runRef.current = runId;
    setLoading(true);
    setStatus('Buscando cotações no SSW...');
    try {
      const f = override || filters;
      const payload: any = {
        periodo_ini: f.periodoIni,
        periodo_fim: f.periodoFim,
        f7: f.f7,
        f8: f.f8,
        f11: f.f11,
        f13: f.f13,
        f14: f.f14,
        f16: f.f16,
        include_comparisons: true,
        _nonce: Date.now(),
      };
      const resp = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/bi-cotacoes/get_cotacoes.php`, {
        method: 'POST',
        body: JSON.stringify(payload),
        cache: 'no-store',
      } as any);

      const json = resp as any;
      if (!json?.success) {
        toast.error(json?.message || 'Falha ao buscar cotações.');
        setData(null);
        return;
      }
      if (runRef.current !== runId) return;
      const parsed: ApiData = {
        totals: json.totals,
        byStatus: Array.isArray(json.byStatus) ? json.byStatus : [],
        byUser: Array.isArray(json.byUser) ? json.byUser : [],
        byUnidadeInclusao: Array.isArray(json.byUnidadeInclusao) ? json.byUnidadeInclusao : [],
        byCliente: Array.isArray(json.byCliente) ? json.byCliente : [],
        rows: Array.isArray(json.rows) ? json.rows : [],
        comparisons: json.comparisons || {},
        meta: json.meta || {},
      };
      setData(parsed);
      if (parsed.meta?.truncated) {
        toast.warning(`Planilha grande: exibindo apenas ${formatNumber(parsed.meta.max_rows || 0)} registros (limite técnico).`);
      } else {
        toast.success('Cotações carregadas.');
      }
    } catch (e: any) {
      console.error(e);
      toast.error('Erro ao buscar cotações.');
      setData(null);
    } finally {
      if (runRef.current === runId) {
        setLoading(false);
        setStatus('');
      }
    }
  };

  useEffect(() => {
    if (initialLoadRef.current) return;
    if (!user) return;
    const d = getDefaultFilters();
    initialLoadRef.current = true;
    setFilters(d);
    setTempFilters(d);
    carregar(d);
  }, [user, getDefaultFilters]);

  const rowsFiltered = useMemo(() => {
    const base = data?.rows || [];
    const byQuick =
      quickStatus === 'ALL'
        ? base
        : base.filter((r) => {
            if (quickStatus === 'COTADO') return r.status_kind === 'COTADO';
            if (quickStatus === 'CONTRAT') return r.status_kind === 'CONTRAT';
            if (quickStatus === 'CTRC_EMI') return r.status_kind === 'CTRC_EMI';
            return true;
          });

    const q = search.trim().toLowerCase();
    if (!q) return byQuick;
    return byQuick.filter((r) => {
      const bag = [
        r.cotacao,
        r.unidade_inclusao,
        r.usuario_inclusao,
        r.cnpj_pagador,
        r.nome_pagador,
        r.vendedor,
        r.origem,
        r.destino,
        r.situacao,
        r.ctrc,
      ]
        .join(' ')
        .toLowerCase();
      return bag.includes(q);
    });
  }, [data, quickStatus, search]);

  const totalsView = useMemo(() => {
    const rows = rowsFiltered;
    const t = {
      cotacoes: rows.length,
      cotado: 0,
      contrat: 0,
      ctrc_emi: 0,
      potencial: 0,
      convertido: 0,
      emRisco: 0,
    };
    for (const r of rows) {
      t.potencial += toNumber(r.proposta_atual);
      if (r.status_kind === 'COTADO') t.cotado++;
      if (r.status_kind === 'CONTRAT') t.contrat++;
      if (r.status_kind === 'CTRC_EMI') {
        t.ctrc_emi++;
        t.convertido += toNumber(r.frete_ctrc);
      }
      if (r.status_kind !== 'CTRC_EMI' && r.status_kind !== 'OUTRO' && isSoon(r.validade, 2)) t.emRisco++;
    }
    return {
      ...t,
      conversao: t.cotacoes > 0 ? t.ctrc_emi / t.cotacoes : 0,
    };
  }, [rowsFiltered]);

  const showComparisons = useMemo(() => {
    if (!data) return false;
    if (quickStatus !== 'ALL') return false;
    if (search.trim() !== '') return false;
    return Boolean(data.comparisons?.prev_period?.totals || data.comparisons?.year_ago?.totals);
  }, [data, quickStatus, search]);

  const deltaPct = (cur: number, base: number) => {
    const b = toNumber(base);
    if (!Number.isFinite(b) || b === 0) return null;
    return (toNumber(cur) - b) / b;
  };

  const fmtDelta = (pct: number | null) => {
    if (pct === null) return '—';
    const sign = pct > 0 ? '+' : '';
    return `${sign}${formatPercent(pct)}`;
  };

  const deltaClass = (pct: number | null) => {
    if (pct === null) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
    if (pct > 0) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
    if (pct < 0) return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  };

  const periodDays = useMemo(() => {
    const start = filters.periodoIni;
    const end = filters.periodoFim;
    const s = Date.parse(`${start}T12:00:00`);
    const e = Date.parse(`${end}T12:00:00`);
    if (!Number.isFinite(s) || !Number.isFinite(e) || s > e) return [];
    const out: string[] = [];
    const cur = new Date(s);
    const endDt = new Date(e);
    while (cur.getTime() <= endDt.getTime()) {
      out.push(fmtIso(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [filters.periodoIni, filters.periodoFim]);

  const dailySeries = useMemo(() => {
    const datePart = (s: string) => (s && s.length >= 10 ? s.slice(0, 10) : '');
    const byDay = new Map<string, { cotacoes: number; ctrc_emi: number; potencial: number; convertido: number }>();
    for (const d of periodDays) {
      byDay.set(d, { cotacoes: 0, ctrc_emi: 0, potencial: 0, convertido: 0 });
    }
    for (const r of rowsFiltered) {
      const di = datePart(r.data_inclusao);
      if (byDay.has(di)) {
        const a = byDay.get(di)!;
        a.cotacoes += 1;
        a.potencial += toNumber(r.proposta_atual);
      }
      if (r.status_kind === 'CTRC_EMI') {
        const de = datePart(r.data_emissao_ctrc) || di;
        if (byDay.has(de)) {
          const a = byDay.get(de)!;
          a.ctrc_emi += 1;
          a.convertido += toNumber(r.frete_ctrc);
        }
      }
    }
    const pad2 = (n: number) => String(n).padStart(2, '0');
    return periodDays.map((iso) => {
      const dt = new Date(`${iso}T12:00:00`);
      const label = `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}`;
      const v = byDay.get(iso) || { cotacoes: 0, ctrc_emi: 0, potencial: 0, convertido: 0 };
      return { iso, label, ...v };
    });
  }, [periodDays, rowsFiltered]);

  const monthlyConvertedSeries = useMemo(() => {
    const toYm = (s: string) => (s && s.length >= 7 ? s.slice(0, 7) : '');
    const byMonth = new Map<string, number>();
    for (const r of rowsFiltered) {
      if (r.status_kind !== 'CTRC_EMI') continue;
      const ym = toYm(r.data_emissao_ctrc || r.data_inclusao);
      if (!ym) continue;
      byMonth.set(ym, (byMonth.get(ym) || 0) + toNumber(r.frete_ctrc));
    }
    const months: string[] = [];
    const s = Date.parse(`${filters.periodoIni}T12:00:00`);
    const e = Date.parse(`${filters.periodoFim}T12:00:00`);
    if (!Number.isFinite(s) || !Number.isFinite(e) || s > e) return [];
    const cur = new Date(s);
    cur.setDate(1);
    const end = new Date(e);
    end.setDate(1);
    while (cur.getTime() <= end.getTime()) {
      months.push(`${cur.getFullYear()}-${pad(cur.getMonth() + 1)}`);
      cur.setMonth(cur.getMonth() + 1);
    }
    const label = (ym: string) => {
      const [y, m] = ym.split('-');
      return `${m}/${String(y).slice(-2)}`;
    };
    return months.map((ym) => ({ ym, label: label(ym), convertido: byMonth.get(ym) || 0 }));
  }, [filters.periodoIni, filters.periodoFim, rowsFiltered]);

  const ufFromPlace = (s: string) => {
    const v = String(s || '').trim();
    const parts = v.split('/');
    if (parts.length < 2) return '';
    const uf = parts[parts.length - 1].trim().toUpperCase();
    return uf.length === 2 ? uf : '';
  };

  const origemDestinoUF = useMemo(() => {
    const mapOrig = new Map<string, { uf: string; cotacoes: number; ctrc_emi: number; potencial: number; convertido: number }>();
    const mapDest = new Map<string, { uf: string; cotacoes: number; ctrc_emi: number; potencial: number; convertido: number }>();
    const bump = (map: Map<string, any>, uf: string, r: CotacaoRow) => {
      if (!uf) return;
      if (!map.has(uf)) map.set(uf, { uf, cotacoes: 0, ctrc_emi: 0, potencial: 0, convertido: 0 });
      const a = map.get(uf)!;
      a.cotacoes += 1;
      a.potencial += toNumber(r.proposta_atual);
      if (r.status_kind === 'CTRC_EMI') {
        a.ctrc_emi += 1;
        a.convertido += toNumber(r.frete_ctrc);
      }
    };
    for (const r of rowsFiltered) {
      bump(mapOrig, ufFromPlace(r.origem), r);
      bump(mapDest, ufFromPlace(r.destino), r);
    }
    const toSorted = (map: Map<string, any>) =>
      Array.from(map.values())
        .map((x) => ({ ...x, conversao: x.cotacoes > 0 ? x.ctrc_emi / x.cotacoes : 0 }))
        .sort((a, b) => b.cotacoes - a.cotacoes || a.uf.localeCompare(b.uf));
    return { origem: toSorted(mapOrig), destino: toSorted(mapDest) };
  }, [rowsFiltered]);

  const donutData = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rowsFiltered) {
      const k = r.situacao || '—';
      map.set(k, (map.get(k) || 0) + 1);
    }
    const out = Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    out.sort((a, b) => b.value - a.value);
    return out;
  }, [rowsFiltered]);

  const rankingUsuarios = useMemo(() => {
    const map = new Map<string, { usuario: string; cotacoes: number; contratadas: number; ctrc_emi: number; potencial: number; convertido: number }>();
    for (const r of rowsFiltered) {
      const key = (r.usuario_inclusao || '').trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, { usuario: key, cotacoes: 0, contratadas: 0, ctrc_emi: 0, potencial: 0, convertido: 0 });
      const a = map.get(key)!;
      a.cotacoes++;
      a.potencial += toNumber(r.proposta_atual);
      if (r.status_kind === 'CONTRAT') a.contratadas++;
      if (r.status_kind === 'CTRC_EMI') {
        a.ctrc_emi++;
        a.convertido += toNumber(r.frete_ctrc);
      }
    }
    const out = Array.from(map.values()).map((x) => ({ ...x, conversao: x.cotacoes > 0 ? x.ctrc_emi / x.cotacoes : 0 }));
    out.sort((a, b) => b.ctrc_emi - a.ctrc_emi || b.cotacoes - a.cotacoes || a.usuario.localeCompare(b.usuario));
    return out.slice(0, 25);
  }, [rowsFiltered]);

  const rankingUsuariosConvertido = useMemo(() => {
    const map = new Map<string, { usuario: string; cotacoes: number; contratadas: number; ctrc_emi: number; potencial: number; convertido: number }>();
    for (const r of rowsFiltered) {
      const key = (r.usuario_inclusao || '').trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, { usuario: key, cotacoes: 0, contratadas: 0, ctrc_emi: 0, potencial: 0, convertido: 0 });
      const a = map.get(key)!;
      a.cotacoes++;
      a.potencial += toNumber(r.proposta_atual);
      if (r.status_kind === 'CONTRAT') a.contratadas++;
      if (r.status_kind === 'CTRC_EMI') {
        a.ctrc_emi++;
        a.convertido += toNumber(r.frete_ctrc);
      }
    }
    const out = Array.from(map.values()).map((x) => ({ ...x, conversao: x.cotacoes > 0 ? x.ctrc_emi / x.cotacoes : 0 }));
    out.sort((a, b) => b.convertido - a.convertido || b.ctrc_emi - a.ctrc_emi || b.cotacoes - a.cotacoes || a.usuario.localeCompare(b.usuario));
    return out.slice(0, 25);
  }, [rowsFiltered]);

  const rankingClientes = useMemo(() => {
    const map = new Map<string, { cnpj: string; nome: string; cotacoes: number; contratadas: number; ctrc_emi: number; potencial: number; convertido: number }>();
    for (const r of rowsFiltered) {
      const cnpj = (r.cnpj_pagador || '').trim();
      const nome = (r.nome_pagador || '').trim();
      const key = cnpj || nome;
      if (!key) continue;
      if (!map.has(key)) map.set(key, { cnpj, nome, cotacoes: 0, contratadas: 0, ctrc_emi: 0, potencial: 0, convertido: 0 });
      const a = map.get(key)!;
      a.cotacoes++;
      a.potencial += toNumber(r.proposta_atual);
      if (r.status_kind === 'CONTRAT') a.contratadas++;
      if (r.status_kind === 'CTRC_EMI') {
        a.ctrc_emi++;
        a.convertido += toNumber(r.frete_ctrc);
      }
    }
    const out = Array.from(map.values()).map((x) => ({ ...x, conversao: x.cotacoes > 0 ? x.ctrc_emi / x.cotacoes : 0 }));
    out.sort((a, b) => b.ctrc_emi - a.ctrc_emi || b.potencial - a.potencial || (a.nome || a.cnpj).localeCompare(b.nome || b.cnpj));
    return out.slice(0, 25);
  }, [rowsFiltered]);

  const exportCsv = () => {
    if (!data) {
      toast.info('Nenhum dado carregado para exportar.');
      return;
    }
    const header = [
      'COTACAO',
      'UNIDADE_INCLUSAO',
      'USUARIO_INCLUSAO',
      'CNPJ_PAGADOR',
      'NOME_PAGADOR',
      'VENDEDOR',
      'ORIGEM',
      'DESTINO',
      'TIPO_FRETE',
      'SITUACAO',
      'CTRC',
      'DATA_INCLUSAO',
      'VALIDADE',
      'DATA_EMISSAO_CTRC',
      'PROPOSTA_ATUAL',
      'FRETE_CTRC',
      'VALOR_NF',
      'PESO',
      'CUBAGEM',
    ];
    const lines = [header.map(csvEscape).join(';')];
    for (const r of rowsFiltered) {
      lines.push(
        [
          r.cotacao,
          r.unidade_inclusao,
          r.usuario_inclusao,
          r.cnpj_pagador,
          r.nome_pagador,
          r.vendedor,
          r.origem,
          r.destino,
          r.tipo_frete,
          r.situacao,
          r.ctrc,
          r.data_inclusao,
          r.validade,
          r.data_emissao_ctrc,
          toNumber(r.proposta_atual).toFixed(2),
          toNumber(r.frete_ctrc).toFixed(2),
          toNumber(r.valor_nf).toFixed(2),
          toNumber(r.peso).toFixed(2),
          toNumber(r.cubagem).toFixed(3),
        ].map(csvEscape).join(';')
      );
    }
    downloadTextFile(lines.join('\n'), `bi_cotacoes_${filters.periodoIni}_a_${filters.periodoFim}.csv`);
  };

  const hasFiltrosAtivos = useMemo(() => {
    const d = getDefaultFilters();
    return JSON.stringify(filters) !== JSON.stringify(d);
  }, [filters, getDefaultFilters]);

  return (
    <DashboardLayout
      title="BI · Cotações"
      description={user?.client_name}
      headerActions={
        <div className="flex items-center gap-2 md:gap-3">
          <Dialog open={showFilters} onOpenChange={setShowFilters}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="icon" className="relative dark:border-slate-600 dark:hover:bg-slate-800 print:hidden">
                      <Filter className="w-4 h-4" />
                      {hasFiltrosAtivos && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-600" />}
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filtros</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DialogContent className="sm:max-w-[820px] bg-white dark:bg-slate-900 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  Refine a busca de cotações por período, tipo, situação e responsáveis.
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto pr-2 space-y-6">
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-900/40">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Período de inclusão</div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                        onClick={() => {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(end.getDate() - 6);
                          setTempFilters((p) => ({ ...p, periodoIni: fmtIso(start), periodoFim: fmtIso(end) }));
                        }}
                      >
                        7 dias
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                        onClick={() => {
                          const end = new Date();
                          const start = new Date();
                          start.setDate(end.getDate() - 29);
                          setTempFilters((p) => ({ ...p, periodoIni: fmtIso(start), periodoFim: fmtIso(end) }));
                        }}
                      >
                        30 dias
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                        onClick={() => setTempFilters((p) => ({ ...p, periodoIni: todayIso(), periodoFim: todayIso() }))}
                      >
                        Hoje
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-slate-700 dark:text-slate-200">Início</Label>
                    <Input
                      type="date"
                      value={tempFilters.periodoIni}
                      onChange={(e) => setTempFilters({ ...tempFilters, periodoIni: e.target.value })}
                      className="dark:border-slate-700 dark:bg-slate-900"
                    />
                    </div>
                    <div>
                      <Label className="text-slate-700 dark:text-slate-200">Fim</Label>
                    <Input
                      type="date"
                      value={tempFilters.periodoFim}
                      onChange={(e) => setTempFilters({ ...tempFilters, periodoFim: e.target.value })}
                      className="dark:border-slate-700 dark:bg-slate-900"
                    />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <Label className="text-slate-700 dark:text-slate-200">Tipo de frete</Label>
                    <Select value={tempFilters.f7} onValueChange={(v: any) => setTempFilters({ ...tempFilters, f7: v })}>
                      <SelectTrigger className="dark:border-slate-700 dark:bg-slate-900">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="T">Todos</SelectItem>
                        <SelectItem value="C">CIF</SelectItem>
                        <SelectItem value="F">FOB</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <Label className="text-slate-700 dark:text-slate-200">Situação</Label>
                    <Select value={tempFilters.f8} onValueChange={(v: any) => setTempFilters({ ...tempFilters, f8: v })}>
                      <SelectTrigger className="dark:border-slate-700 dark:bg-slate-900">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="T">Todos</SelectItem>
                        <SelectItem value="C">Cotada</SelectItem>
                        <SelectItem value="F">Contratada</SelectItem>
                        <SelectItem value="E">CTRC emitido</SelectItem>
                        <SelectItem value="K">Cotada cliente</SelectItem>
                        <SelectItem value="D">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <Label className="text-slate-700 dark:text-slate-200">Usuário</Label>
                    <Input
                      value={tempFilters.f14}
                      onChange={(e) => setTempFilters({ ...tempFilters, f14: e.target.value })}
                      placeholder="Login do usuário"
                      className="dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <Label className="text-slate-700 dark:text-slate-200">Unidade de inclusão</Label>
                    <FilterSelectUnidadeSingle value={tempFilters.f11} onChange={(v) => setTempFilters({ ...tempFilters, f11: v })} />
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <Label className="text-slate-700 dark:text-slate-200">Unidade de origem</Label>
                    <FilterSelectUnidadeSingle value={tempFilters.f13} onChange={(v) => setTempFilters({ ...tempFilters, f13: v })} />
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <Label className="text-slate-700 dark:text-slate-200">Pagador</Label>
                    <FilterSelectCliente type="pagador" value={tempFilters.f16} onChange={(v) => setTempFilters({ ...tempFilters, f16: v })} />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <Button variant="outline" onClick={clearFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
                  Limpar tudo
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancelFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
                    Cancelar
                  </Button>
                  <Button onClick={applyFilters} className="bg-blue-600 hover:bg-blue-700 text-white">
                    Aplicar filtros
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button onClick={carregar} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 print:hidden">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Gerar
          </Button>

          <Button variant="outline" onClick={exportCsv} disabled={!data || loading} className="gap-2 dark:border-slate-600 dark:hover:bg-slate-800 print:hidden">
            <Download className="w-4 h-4" />
            CSV
          </Button>

          {loading && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {status || 'Processando...'}
            </Badge>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
          <Card className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-blue-700 dark:text-blue-200">Cotações</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.cotacoes)}</p>
                </div>
                <Target className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
              <p className="text-xs text-blue-700/80 dark:text-blue-200/80 mt-2">No período + filtros</p>
              {showComparisons && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className={deltaClass(deltaPct(totalsView.cotacoes, data?.comparisons?.prev_period?.totals?.cotacoes || 0))}>
                    Ant.: {fmtDelta(deltaPct(totalsView.cotacoes, data?.comparisons?.prev_period?.totals?.cotacoes || 0))}
                  </Badge>
                  <Badge className={deltaClass(deltaPct(totalsView.cotacoes, data?.comparisons?.year_ago?.totals?.cotacoes || 0))}>
                    Ano: {fmtDelta(deltaPct(totalsView.cotacoes, data?.comparisons?.year_ago?.totals?.cotacoes || 0))}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-slate-700 dark:text-slate-200">Cotadas</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.cotado)}</p>
                </div>
                <Badge className="bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-200">COTADO</Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">Simulação / início</p>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-amber-800 dark:text-amber-200">Contratadas</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.contrat)}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-amber-500" />
              </div>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-2">CONTRAT / COT FIX</p>
              {showComparisons && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className={deltaClass(deltaPct(totalsView.contrat, data?.comparisons?.prev_period?.totals?.contrat || 0))}>
                    Ant.: {fmtDelta(deltaPct(totalsView.contrat, data?.comparisons?.prev_period?.totals?.contrat || 0))}
                  </Badge>
                  <Badge className={deltaClass(deltaPct(totalsView.contrat, data?.comparisons?.year_ago?.totals?.contrat || 0))}>
                    Ano: {fmtDelta(deltaPct(totalsView.contrat, data?.comparisons?.year_ago?.totals?.contrat || 0))}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-emerald-800 dark:text-emerald-200">CTRC emit.</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.ctrc_emi)}</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-2">CTRC EMI</p>
              {showComparisons && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className={deltaClass(deltaPct(totalsView.ctrc_emi, data?.comparisons?.prev_period?.totals?.ctrc_emi || 0))}>
                    Ant.: {fmtDelta(deltaPct(totalsView.ctrc_emi, data?.comparisons?.prev_period?.totals?.ctrc_emi || 0))}
                  </Badge>
                  <Badge className={deltaClass(deltaPct(totalsView.ctrc_emi, data?.comparisons?.year_ago?.totals?.ctrc_emi || 0))}>
                    Ano: {fmtDelta(deltaPct(totalsView.ctrc_emi, data?.comparisons?.year_ago?.totals?.ctrc_emi || 0))}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-indigo-800 dark:text-indigo-200">Conversão</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatPercent(totalsView.conversao)}</p>
                </div>
                <Badge className="bg-indigo-200 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-200">%</Badge>
              </div>
              <p className="text-xs text-indigo-800/80 dark:text-indigo-200/80 mt-2">CTRC / cotações</p>
              {showComparisons && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className={deltaClass(deltaPct(totalsView.conversao, data?.comparisons?.prev_period?.totals?.conversao || 0))}>
                    Ant.: {fmtDelta(deltaPct(totalsView.conversao, data?.comparisons?.prev_period?.totals?.conversao || 0))}
                  </Badge>
                  <Badge className={deltaClass(deltaPct(totalsView.conversao, data?.comparisons?.year_ago?.totals?.conversao || 0))}>
                    Ano: {fmtDelta(deltaPct(totalsView.conversao, data?.comparisons?.year_ago?.totals?.conversao || 0))}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-cyan-800 dark:text-cyan-200">Frete cotado</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totalsView.potencial)}</p>
                </div>
                <TrendingUp className="w-5 h-5 text-cyan-600 dark:text-cyan-300" />
              </div>
              <p className="text-xs text-cyan-800/80 dark:text-cyan-200/80 mt-2">Proposta atual (SSW)</p>
              {showComparisons && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className={deltaClass(deltaPct(totalsView.potencial, data?.comparisons?.prev_period?.totals?.potencial || 0))}>
                    Ant.: {fmtDelta(deltaPct(totalsView.potencial, data?.comparisons?.prev_period?.totals?.potencial || 0))}
                  </Badge>
                  <Badge className={deltaClass(deltaPct(totalsView.potencial, data?.comparisons?.year_ago?.totals?.potencial || 0))}>
                    Ano: {fmtDelta(deltaPct(totalsView.potencial, data?.comparisons?.year_ago?.totals?.potencial || 0))}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-green-800 dark:text-green-200">Frete CTRC</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totalsView.convertido)}</p>
                </div>
                <ArrowUpRight className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-xs text-green-800/80 dark:text-green-200/80 mt-2">Somente CTRC EMI</p>
              {showComparisons && (
                <div className="mt-2 flex flex-wrap gap-1">
                  <Badge className={deltaClass(deltaPct(totalsView.convertido, data?.comparisons?.prev_period?.totals?.convertido || 0))}>
                    Ant.: {fmtDelta(deltaPct(totalsView.convertido, data?.comparisons?.prev_period?.totals?.convertido || 0))}
                  </Badge>
                  <Badge className={deltaClass(deltaPct(totalsView.convertido, data?.comparisons?.year_ago?.totals?.convertido || 0))}>
                    Ano: {fmtDelta(deltaPct(totalsView.convertido, data?.comparisons?.year_ago?.totals?.convertido || 0))}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-red-800 dark:text-red-200">Em risco</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.emRisco)}</p>
                </div>
                <Badge className="bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200">2d</Badge>
              </div>
              <p className="text-xs text-red-800/80 dark:text-red-200/80 mt-2">Validade ≤ 2 dias</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid grid-cols-6 w-full md:w-[760px]">
              <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
              <TabsTrigger value="usuarios">Usuários</TabsTrigger>
              <TabsTrigger value="clientes">Clientes</TabsTrigger>
              <TabsTrigger value="origem-destino">Origem/Destino</TabsTrigger>
              <TabsTrigger value="ranking">Ranking</TabsTrigger>
              <TabsTrigger value="lista">Lista</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={quickStatus === 'ALL' ? 'default' : 'outline'}
                className={quickStatus === 'ALL' ? 'bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-slate-100 dark:text-slate-900' : 'dark:border-slate-700'}
                onClick={() => setQuickStatus('ALL')}
              >
                Todos
              </Button>
              <Button
                variant={quickStatus === 'COTADO' ? 'default' : 'outline'}
                onClick={() => setQuickStatus('COTADO')}
                className="dark:border-slate-700"
              >
                Cotado
              </Button>
              <Button
                variant={quickStatus === 'CONTRAT' ? 'default' : 'outline'}
                onClick={() => setQuickStatus('CONTRAT')}
                className="dark:border-slate-700"
              >
                Contrat
              </Button>
              <Button
                variant={quickStatus === 'CTRC_EMI' ? 'default' : 'outline'}
                onClick={() => setQuickStatus('CTRC_EMI')}
                className="dark:border-slate-700"
              >
                CTRC
              </Button>
            </div>

            <div className="relative w-full md:w-[420px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cotação, cliente, origem/destino, CTRC..."
                className="pl-9 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
          <TabsContent value="pipeline" className="mt-0">
            <div className="space-y-4">
              <Card className="dark:bg-slate-900 dark:border-slate-700">
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                      <CalendarDays className="w-4 h-4 text-indigo-500" />
                      Volume diário
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={dailyMode === 'cotacoes' ? 'default' : 'outline'}
                        className={dailyMode === 'cotacoes' ? 'bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-slate-100 dark:text-slate-900' : 'dark:border-slate-700'}
                        onClick={() => setDailyMode('cotacoes')}
                      >
                        Cotações
                      </Button>
                      <Button
                        size="sm"
                        variant={dailyMode === 'ctrc_emi' ? 'default' : 'outline'}
                        className={dailyMode === 'ctrc_emi' ? 'bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-slate-100 dark:text-slate-900' : 'dark:border-slate-700'}
                        onClick={() => setDailyMode('ctrc_emi')}
                      >
                        CTRC emitidos
                      </Button>
                    </div>
                  </div>
                  <div className="h-[260px]">
                    {!data ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Gere para visualizar.</div>
                    ) : dailySeries.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Sem dados.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailySeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                          <XAxis dataKey="label" interval="preserveStartEnd" />
                          <YAxis allowDecimals={false} />
                          <RechartsTooltip
                            formatter={(v: any, name: any) => [
                              formatNumber(Number(v)),
                              String(name) === 'ctrc_emi' ? 'CTRC emitidos' : 'Cotações',
                            ]}
                            labelFormatter={(l: any) => String(l)}
                          />
                          <Bar dataKey={dailyMode} fill={dailyMode === 'cotacoes' ? '#60a5fa' : '#34d399'} radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-1">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                        <Target className="w-4 h-4 text-blue-500" />
                        Funil por Situação
                      </div>
                      <Badge variant="outline">{formatNumber(rowsFiltered.length)} itens</Badge>
                    </div>
                    <div className="h-[260px]">
                      {!data ? (
                        <div className="h-full flex items-center justify-center text-sm text-slate-500">Gere para visualizar.</div>
                      ) : donutData.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-sm text-slate-500">Sem dados.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                              {donutData.map((_, i) => (
                                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip formatter={(v: any, n: any) => [formatNumber(Number(v)), String(n)]} />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="mt-3 space-y-1">
                      {donutData.slice(0, 6).map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                            <span className="truncate">{d.name}</span>
                          </div>
                          <span className="font-mono text-slate-700 dark:text-slate-200">{formatNumber(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-2">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Receita · Potencial vs Convertida
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          Potencial: {formatCurrency(totalsView.potencial)}
                        </Badge>
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                          Convertido: {formatCurrency(totalsView.convertido)}
                        </Badge>
                      </div>
                    </div>

                    <div className="h-[320px]">
                      {!data ? (
                        <div className="h-full flex items-center justify-center text-sm text-slate-500">Gere para visualizar.</div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={rankingUsuarios.slice(0, 10).map((u) => ({ name: u.usuario, potencial: u.potencial, convertido: u.convertido }))}
                            margin={{ top: 10, right: 20, bottom: 40, left: 10 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                            <XAxis dataKey="name" interval={0} angle={-25} textAnchor="end" height={60} />
                            <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))} />
                            <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v))} />
                            <Bar dataKey="potencial" fill="#93c5fd" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="convertido" fill="#34d399" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" />
                      Top 10 usuários · Potencial (proposta) vs Convertido (frete CTRC)
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="usuarios" className="mt-0">
            <Card className="dark:bg-slate-900 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                    <UserIcon className="w-4 h-4 text-indigo-500" />
                    Performance por Usuário
                  </div>
                  <Badge variant="outline">{formatNumber(rankingUsuarios.length)} usuários</Badge>
                </div>

                <div className="overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                  <table className="min-w-[980px] w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr className="text-left">
                        <th className="py-2 px-3">Usuário</th>
                        <th className="py-2 px-3 text-right">Cotações</th>
                        <th className="py-2 px-3 text-right">Contratadas</th>
                        <th className="py-2 px-3 text-right">CTRC</th>
                        <th className="py-2 px-3 text-right">Conversão</th>
                        <th className="py-2 px-3 text-right">Potencial</th>
                        <th className="py-2 px-3 text-right">Convertido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingUsuarios.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-500">
                            {data ? 'Sem usuários para os filtros atuais.' : 'Gere para visualizar.'}
                          </td>
                        </tr>
                      ) : (
                        rankingUsuarios.map((u) => (
                          <tr key={u.usuario} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                            <td className="py-2 px-3 font-mono">{u.usuario}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatNumber(u.cotacoes)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatNumber(u.contratadas)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatNumber(u.ctrc_emi)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatPercent(u.conversao)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(u.potencial)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(u.convertido)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes" className="mt-0">
            <Card className="dark:bg-slate-900 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    Performance por Cliente (Pagador)
                  </div>
                  <Badge variant="outline">{formatNumber(rankingClientes.length)} clientes</Badge>
                </div>
                <div className="overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                  <table className="min-w-[1040px] w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr className="text-left">
                        <th className="py-2 px-3">Cliente</th>
                        <th className="py-2 px-3 text-right">Cotações</th>
                        <th className="py-2 px-3 text-right">Contratadas</th>
                        <th className="py-2 px-3 text-right">CTRC</th>
                        <th className="py-2 px-3 text-right">Conversão</th>
                        <th className="py-2 px-3 text-right">Potencial</th>
                        <th className="py-2 px-3 text-right">Convertido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingClientes.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-10 text-center text-slate-500">
                            {data ? 'Sem clientes para os filtros atuais.' : 'Gere para visualizar.'}
                          </td>
                        </tr>
                      ) : (
                        rankingClientes.map((c) => (
                          <tr key={c.cnpj || c.nome} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                            <td className="py-2 px-3">
                              <div className="min-w-0">
                                <div className="truncate">{c.nome || c.cnpj || '-'}</div>
                                <div className="text-xs text-slate-500 font-mono">{c.cnpj || '-'}</div>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right font-mono">{formatNumber(c.cotacoes)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatNumber(c.contratadas)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatNumber(c.ctrc_emi)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatPercent(c.conversao)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(c.potencial)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(c.convertido)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="origem-destino" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Origem / Destino
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={origemDestinoMode === 'origem' ? 'default' : 'outline'}
                        className={origemDestinoMode === 'origem' ? 'bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-slate-100 dark:text-slate-900' : 'dark:border-slate-700'}
                        onClick={() => setOrigemDestinoMode('origem')}
                      >
                        Origem
                      </Button>
                      <Button
                        size="sm"
                        variant={origemDestinoMode === 'destino' ? 'default' : 'outline'}
                        className={origemDestinoMode === 'destino' ? 'bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-slate-100 dark:text-slate-900' : 'dark:border-slate-700'}
                        onClick={() => setOrigemDestinoMode('destino')}
                      >
                        Destino
                      </Button>
                    </div>
                  </div>

                  <div className="h-[360px]">
                    {!data ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Gere para visualizar.</div>
                    ) : (origemDestinoUF[origemDestinoMode].length === 0) ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Sem dados.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={origemDestinoUF[origemDestinoMode].slice(0, 12)}
                          layout="vertical"
                          margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                          <XAxis type="number" tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))} />
                          <YAxis type="category" dataKey="uf" width={30} />
                          <RechartsTooltip
                            formatter={(v: any, name: any) => {
                              const n = String(name);
                              if (n === 'potencial' || n === 'convertido') return [formatCurrency(Number(v)), n];
                              if (n === 'conversao') return [formatPercent(Number(v)), 'conversão'];
                              return [formatNumber(Number(v)), n];
                            }}
                          />
                          <Bar dataKey="cotacoes" fill="#60a5fa" radius={[4, 4, 4, 4]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5" />
                    Top 12 UFs por volume de cotações
                  </div>
                </CardContent>
              </Card>

              <Card className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-slate-900 dark:text-slate-100 font-semibold">
                      Detalhe por UF ({origemDestinoMode === 'origem' ? 'Origem' : 'Destino'})
                    </div>
                    <Badge variant="outline">{formatNumber(origemDestinoUF[origemDestinoMode].length)} UFs</Badge>
                  </div>
                  <div className="overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                    <table className="min-w-[920px] w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr className="text-left">
                          <th className="py-2 px-3">UF</th>
                          <th className="py-2 px-3 text-right">Cotações</th>
                          <th className="py-2 px-3 text-right">CTRC</th>
                          <th className="py-2 px-3 text-right">Conversão</th>
                          <th className="py-2 px-3 text-right">Potencial</th>
                          <th className="py-2 px-3 text-right">Convertido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {!data ? (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-slate-500">
                              Gere para visualizar.
                            </td>
                          </tr>
                        ) : origemDestinoUF[origemDestinoMode].length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-slate-500">
                              Sem dados.
                            </td>
                          </tr>
                        ) : (
                          origemDestinoUF[origemDestinoMode].map((r) => (
                            <tr key={r.uf} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                              <td className="py-2 px-3 font-mono">{r.uf}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatNumber(r.cotacoes)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatNumber(r.ctrc_emi)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatPercent(r.conversao)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCurrency(r.potencial)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCurrency(r.convertido)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ranking" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                      Frete convertido por mês
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                      Total: {formatCurrency(totalsView.convertido)}
                    </Badge>
                  </div>
                  <div className="h-[300px]">
                    {!data ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Gere para visualizar.</div>
                    ) : monthlyConvertedSeries.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Sem dados.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={monthlyConvertedSeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                          <XAxis dataKey="label" />
                          <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)))} />
                          <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v))} />
                          <Area type="monotone" dataKey="convertido" stroke="#10b981" fill="#10b981" fillOpacity={0.18} strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-1">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      Top 3 usuários
                    </div>
                    <Badge variant="outline">{formatNumber(rankingUsuariosConvertido.length)} usuários</Badge>
                  </div>

                  {rankingUsuariosConvertido.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-sm text-slate-500">
                      {data ? 'Sem dados.' : 'Gere para visualizar.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {rankingUsuariosConvertido.slice(0, 3).map((u, i) => (
                        <div
                          key={u.usuario}
                          className={[
                            'rounded-lg border p-3 flex items-center justify-between gap-3',
                            i === 0 ? 'border-amber-300 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-900' : 'border-slate-200 dark:border-slate-800',
                          ].join(' ')}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge className={i === 0 ? 'bg-amber-200 text-amber-900' : i === 1 ? 'bg-slate-200 text-slate-900' : 'bg-orange-200 text-orange-900'}>
                                {i + 1}º
                              </Badge>
                              <span className="font-mono truncate">{u.usuario}</span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              CTRC: {formatNumber(u.ctrc_emi)} · Conversão: {formatPercent(u.conversao)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono">{formatCurrency(u.convertido)}</div>
                            <div className="text-xs text-slate-500">convertido</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-3">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-slate-900 dark:text-slate-100 font-semibold">Ranking por Frete Convertido (usuário)</div>
                    <Badge variant="outline">Top {formatNumber(rankingUsuariosConvertido.length)}</Badge>
                  </div>
                  <div className="overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                    <table className="min-w-[980px] w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900/50">
                        <tr className="text-left">
                          <th className="py-2 px-3">Usuário</th>
                          <th className="py-2 px-3 text-right">Cotações</th>
                          <th className="py-2 px-3 text-right">CTRC</th>
                          <th className="py-2 px-3 text-right">Conversão</th>
                          <th className="py-2 px-3 text-right">Potencial</th>
                          <th className="py-2 px-3 text-right">Convertido</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rankingUsuariosConvertido.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-10 text-center text-slate-500">
                              {data ? 'Sem dados.' : 'Gere para visualizar.'}
                            </td>
                          </tr>
                        ) : (
                          rankingUsuariosConvertido.map((u) => (
                            <tr key={u.usuario} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                              <td className="py-2 px-3 font-mono">{u.usuario}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatNumber(u.cotacoes)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatNumber(u.ctrc_emi)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatPercent(u.conversao)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCurrency(u.potencial)}</td>
                              <td className="py-2 px-3 text-right font-mono">{formatCurrency(u.convertido)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="lista" className="mt-0">
            <Card className="dark:bg-slate-900 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-slate-900 dark:text-slate-100 font-semibold">Lista (CRM)</div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{formatNumber(rowsFiltered.length)} registros</Badge>
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Potencial: {formatCurrency(totalsView.potencial)}</Badge>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Convertido: {formatCurrency(totalsView.convertido)}</Badge>
                  </div>
                </div>

                <div className="overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                  <table className="min-w-[1400px] w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/50">
                      <tr className="text-left">
                        <th className="py-2 px-3">Cotação</th>
                        <th className="py-2 px-3">Situação</th>
                        <th className="py-2 px-3">Cliente</th>
                        <th className="py-2 px-3">Origem</th>
                        <th className="py-2 px-3">Destino</th>
                        <th className="py-2 px-3">Usuário</th>
                        <th className="py-2 px-3">Unid</th>
                        <th className="py-2 px-3 text-right">Proposta</th>
                        <th className="py-2 px-3 text-right">Frete CTRC</th>
                        <th className="py-2 px-3">CTRC</th>
                        <th className="py-2 px-3">Validade</th>
                        <th className="py-2 px-3">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!data ? (
                        <tr>
                          <td colSpan={12} className="py-10 text-center text-slate-500">
                            Gere para visualizar.
                          </td>
                        </tr>
                      ) : rowsFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-10 text-center text-slate-500">
                            Nenhum registro com os filtros atuais.
                          </td>
                        </tr>
                      ) : (
                        rowsFiltered.slice(0, 800).map((r, idx) => (
                          <tr key={`${r.cotacao}-${idx}`} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40">
                            <td className="py-2 px-3 font-mono">{r.cotacao || '-'}</td>
                            <td className="py-2 px-3">
                              <Badge
                                className={
                                  r.status_kind === 'CTRC_EMI'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                                    : r.status_kind === 'CONTRAT'
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
                                      : r.status_kind === 'COTADO'
                                        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                }
                              >
                                {r.situacao || '-'}
                              </Badge>
                            </td>
                            <td className="py-2 px-3">
                              <div className="min-w-0">
                                <div className="truncate">{r.nome_pagador || r.cnpj_pagador || '-'}</div>
                                <div className="text-xs text-slate-500 font-mono">{r.cnpj_pagador || '-'}</div>
                              </div>
                            </td>
                            <td className="py-2 px-3">{r.origem || '-'}</td>
                            <td className="py-2 px-3">{r.destino || '-'}</td>
                            <td className="py-2 px-3 font-mono">{r.usuario_inclusao || '-'}</td>
                            <td className="py-2 px-3 font-mono">{r.unidade_inclusao || '-'}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(r.proposta_atual)}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatCurrency(r.frete_ctrc)}</td>
                            <td className="py-2 px-3 font-mono">{r.ctrc || '-'}</td>
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <span>{r.validade || '-'}</span>
                                {r.status_kind !== 'CTRC_EMI' && r.status_kind !== 'OUTRO' && isSoon(r.validade, 2) && (
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                                    risco
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              {r.status_kind === 'CTRC_EMI' ? (
                                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">Concluído</Badge>
                              ) : r.status_kind === 'CONTRAT' ? (
                                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Emitir CTRC</Badge>
                              ) : r.status_kind === 'COTADO' ? (
                                isSoon(r.validade, 2) ? (
                                  <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Follow-up urgente</Badge>
                                ) : (
                                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Follow-up</Badge>
                                )
                              ) : (
                                <span className="text-slate-500">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {data && (
                      <tfoot>
                        <tr className="border-t font-semibold bg-slate-50/60 dark:bg-slate-900/30">
                          <td className="py-2 px-3" colSpan={7}>
                            TOTAL ({formatNumber(rowsFiltered.length)} registros)
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(totalsView.potencial)}</td>
                          <td className="py-2 px-3 text-right font-mono">{formatCurrency(totalsView.convertido)}</td>
                          <td className="py-2 px-3" colSpan={3} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {data && rowsFiltered.length > 800 && (
                  <div className="text-xs text-slate-500 mt-2">Limite visual: mostrando os primeiros 800 registros. Use CSV para exportar tudo.</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
