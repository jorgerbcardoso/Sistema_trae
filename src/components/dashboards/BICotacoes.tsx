import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  Legend,
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
  BadgePercent,
  FileText,
  Hourglass,
  Handshake,
  Truck,
  Wallet,
  ClipboardList,
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
import { useTooltipStyle } from './CustomTooltip';
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
const USER_LINE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ef4444'];

const pad = (n: number) => String(n).padStart(2, '0');
const fmtIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => fmtIso(new Date());

const funilSituacaoLabel = (raw: string) => {
  const k = String(raw || '—')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
  if (k === 'COT CLI') return 'Cotado pelo cliente';
  if (k === 'COTADO') return 'Cotado pelo operador';
  if (k === 'CTRC EMI') return 'CTRC emitido';
  if (k === 'COT FIXO') return 'Contratado com valor fixo';
  if (k === 'CONTRAT') return 'Contratado';
  return String(raw || '—').trim() || '—';
};

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
  const [dailyMode, setDailyMode] = useState<'todas' | 'cotacoes' | 'simuladas' | 'contratadas' | 'ctrc_emi'>('cotacoes');
  const [usersDailyMode, setUsersDailyMode] = useState<'cotacoes' | 'simuladas' | 'contratadas' | 'ctrc_emi'>('cotacoes');
  const [origemDestinoMode, setOrigemDestinoMode] = useState<'origem' | 'destino'>('origem');
  const tooltipStyle = useTooltipStyle();

  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRows, setDrillRows] = useState<CotacaoRow[]>([]);
  const [drillSearch, setDrillSearch] = useState('');

  const runRef = useRef(0);
  const initialLoadRef = useRef(false);

  const clearFilters = () => {
    const d = getDefaultFilters();
    setTempFilters(d);
  };

  const gerar = () => {
    const next = { ...tempFilters };
    setFilters(next);
    setTempFilters(next);
    setShowFilters(false);
    carregar(next);
  };

  const cancelFilters = () => {
    setTempFilters({ ...filters });
    setShowFilters(false);
  };

  const carregar = async (override?: Filters) => {
    const runId = Date.now();
    runRef.current = runId;
    setLoading(true);
    setStatus('Buscando cotações...');
    try {
      const isFilters = (x: any): x is Filters =>
        !!x && typeof x === 'object' && typeof x.periodoIni === 'string' && typeof x.periodoFim === 'string';
      const f = isFilters(override) ? override : filters;
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

  const rowsSimuladas = useMemo(() => rowsFiltered.filter((r) => r.status_kind === 'COTADO'), [rowsFiltered]);
  const rowsContratadas = useMemo(
    () => rowsFiltered.filter((r) => r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI'),
    [rowsFiltered]
  );
  const rowsCtrecEmit = useMemo(() => rowsFiltered.filter((r) => r.status_kind === 'CTRC_EMI'), [rowsFiltered]);

  const openDrill = useCallback((title: string, rows: CotacaoRow[]) => {
    setDrillTitle(title);
    setDrillRows(Array.isArray(rows) ? rows : []);
    setDrillSearch('');
    setDrillOpen(true);
  }, []);

  const rowsForDailyIso = useCallback(
    (iso: string, mode: 'todas' | 'cotacoes' | 'simuladas' | 'contratadas' | 'ctrc_emi') => {
      const datePart = (s: string) => (s && s.length >= 10 ? s.slice(0, 10) : '');
      const uniq = new Map<string, CotacaoRow>();
      const add = (r: CotacaoRow) => {
        const k = `${r.cotacao || ''}||${r.ctrc || ''}||${r.data_inclusao || ''}||${r.data_emissao_ctrc || ''}`;
        if (!uniq.has(k)) uniq.set(k, r);
      };
      if (mode === 'ctrc_emi') {
        for (const r of rowsFiltered) {
          if (r.status_kind !== 'CTRC_EMI') continue;
          const d = datePart(r.data_emissao_ctrc) || datePart(r.data_inclusao);
          if (d === iso) add(r);
        }
        return Array.from(uniq.values());
      }

      for (const r of rowsFiltered) {
        const di = datePart(r.data_inclusao);
        if (di !== iso) continue;
        if (mode === 'cotacoes') add(r);
        else if (mode === 'simuladas') {
          if (r.status_kind === 'COTADO') add(r);
        } else if (mode === 'contratadas') {
          if (r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI') add(r);
        } else if (mode === 'todas') add(r);
      }

      if (mode === 'todas') {
        for (const r of rowsFiltered) {
          if (r.status_kind !== 'CTRC_EMI') continue;
          const d = datePart(r.data_emissao_ctrc) || datePart(r.data_inclusao);
          if (d === iso) add(r);
        }
      }

      return Array.from(uniq.values());
    },
    [rowsFiltered]
  );

  const rowsForUsersDailyIso = useCallback(
    (iso: string, mode: 'cotacoes' | 'simuladas' | 'contratadas' | 'ctrc_emi') => {
      const datePart = (s: string) => (s && s.length >= 10 ? s.slice(0, 10) : '');
      const userSet = new Set(topUsuarios5.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean));
      const out: CotacaoRow[] = [];
      for (const r of rowsFiltered) {
        if (!userSet.has(String(r.usuario_inclusao || '').trim().toLowerCase())) continue;
        if (mode === 'ctrc_emi') {
          if (r.status_kind !== 'CTRC_EMI') continue;
          const d = datePart(r.data_emissao_ctrc) || datePart(r.data_inclusao);
          if (d === iso) out.push(r);
          continue;
        }
        const di = datePart(r.data_inclusao);
        if (di !== iso) continue;
        if (mode === 'cotacoes') out.push(r);
        else if (mode === 'simuladas') {
          if (r.status_kind === 'COTADO') out.push(r);
        } else if (mode === 'contratadas') {
          if (r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI') out.push(r);
        }
      }
      return out;
    },
    [rowsFiltered, topUsuarios5]
  );

  const rowsForMonthYm = useCallback(
    (ym: string) => {
      const key = String(ym || '').trim();
      if (!key) return [];
      const toYm = (s: string) => (s && s.length >= 7 ? s.slice(0, 7) : '');
      return rowsCtrecEmit.filter((r) => toYm(r.data_emissao_ctrc || r.data_inclusao) === key);
    },
    [rowsCtrecEmit]
  );

  const drillRowsFiltradas = useMemo(() => {
    const q = drillSearch.trim().toLowerCase();
    if (!q) return drillRows;
    return drillRows.filter((r) => {
      const bag = [
        r.cotacao,
        funilSituacaoLabel(r.situacao),
        r.cnpj_pagador,
        r.nome_pagador,
        r.origem,
        r.destino,
        r.usuario_inclusao,
        r.unidade_inclusao,
        r.ctrc,
        r.data_inclusao,
        r.validade,
        r.data_emissao_ctrc,
      ]
        .join(' ')
        .toLowerCase();
      return bag.includes(q);
    });
  }, [drillRows, drillSearch]);

  const drillTotals = useMemo(() => {
    let potencial = 0;
    let convertido = 0;
    let ctrc = 0;
    for (const r of drillRowsFiltradas) {
      potencial += toNumber(r.proposta_atual);
      if (r.status_kind === 'CTRC_EMI') {
        ctrc += 1;
        convertido += toNumber(r.frete_ctrc);
      }
    }
    return { rows: drillRowsFiltradas.length, potencial, convertido, ctrc };
  }, [drillRowsFiltradas]);

  const totalsView = useMemo(() => {
    const rows = rowsFiltered;
    const t = {
      cotacoes: rows.length,
      clientes: 0,
      cotado: 0,
      contrat: 0,
      ctrc_emi: 0,
      potencial: 0,
      convertido: 0,
    };
    const clientes = new Set<string>();
    for (const r of rows) {
      t.potencial += toNumber(r.proposta_atual);
      const ck = String(r.cnpj_pagador || '').trim() || String(r.nome_pagador || '').trim();
      if (ck) clientes.add(ck);
      if (r.status_kind === 'COTADO') t.cotado++;
      if (r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI') t.contrat++;
      if (r.status_kind === 'CTRC_EMI') {
        t.ctrc_emi++;
        t.convertido += toNumber(r.frete_ctrc);
      }
    }
    t.clientes = clientes.size;
    return {
      ...t,
      conversao: t.cotacoes > 0 ? t.ctrc_emi / t.cotacoes : 0,
    };
  }, [rowsFiltered]);

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
    const byDay = new Map<
      string,
      { cotacoes: number; simuladas: number; contratadas: number; contratadas_base: number; ctrc_emi: number; potencial: number; convertido: number }
    >();
    for (const d of periodDays) {
      byDay.set(d, { cotacoes: 0, simuladas: 0, contratadas: 0, contratadas_base: 0, ctrc_emi: 0, potencial: 0, convertido: 0 });
    }
    for (const r of rowsFiltered) {
      const di = datePart(r.data_inclusao);
      if (byDay.has(di)) {
        const a = byDay.get(di)!;
        a.cotacoes += 1;
        a.potencial += toNumber(r.proposta_atual);
        if (r.status_kind === 'COTADO') a.simuladas += 1;
        if (r.status_kind === 'CONTRAT') a.contratadas_base += 1;
        if (r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI') a.contratadas += 1;
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
      const v =
        byDay.get(iso) || { cotacoes: 0, simuladas: 0, contratadas: 0, contratadas_base: 0, ctrc_emi: 0, potencial: 0, convertido: 0 };
      return { iso, label, ...v };
    });
  }, [periodDays, rowsFiltered]);

  const topUsuarios5 = useMemo(() => {
    const map = new Map<string, { display: string; cotacoes: number }>();
    for (const r of rowsFiltered) {
      const display = String(r.usuario_inclusao || '').trim();
      const key = display.toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, { display, cotacoes: 0 });
      map.get(key)!.cotacoes += 1;
    }
    const out = Array.from(map.values());
    out.sort((a, b) => b.cotacoes - a.cotacoes || a.display.localeCompare(b.display));
    return out.slice(0, 5).map((x) => x.display);
  }, [rowsFiltered]);

  const usersDailySeries = useMemo(() => {
    const datePart = (s: string) => (s && s.length >= 10 ? s.slice(0, 10) : '');
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const idxByUser = new Map<string, number>();
    topUsuarios5.forEach((u, i) => idxByUser.set(String(u || '').trim().toLowerCase(), i));
    const byDay = new Map<string, Record<string, number>>();
    for (const d of periodDays) {
      const rec: Record<string, number> = {};
      for (let i = 0; i < topUsuarios5.length; i++) rec[`u${i}`] = 0;
      byDay.set(d, rec);
    }
    for (const r of rowsFiltered) {
      const userKey = String(r.usuario_inclusao || '').trim().toLowerCase();
      const idx = idxByUser.get(userKey);
      if (idx === undefined) continue;

      if (usersDailyMode === 'ctrc_emi') {
        if (r.status_kind !== 'CTRC_EMI') continue;
        const d = datePart(r.data_emissao_ctrc) || datePart(r.data_inclusao);
        if (!byDay.has(d)) continue;
        byDay.get(d)![`u${idx}`] += 1;
        continue;
      }

      const di = datePart(r.data_inclusao);
      if (!byDay.has(di)) continue;
      if (usersDailyMode === 'cotacoes') {
        byDay.get(di)![`u${idx}`] += 1;
      } else if (usersDailyMode === 'simuladas') {
        if (r.status_kind === 'COTADO') byDay.get(di)![`u${idx}`] += 1;
      } else if (usersDailyMode === 'contratadas') {
        if (r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI') byDay.get(di)![`u${idx}`] += 1;
      }
    }
    return periodDays.map((iso) => {
      const dt = new Date(`${iso}T12:00:00`);
      const label = `${pad2(dt.getDate())}/${pad2(dt.getMonth() + 1)}`;
      return { iso, label, ...(byDay.get(iso) || {}) };
    });
  }, [periodDays, rowsFiltered, topUsuarios5, usersDailyMode]);

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
      const k = funilSituacaoLabel(r.situacao || '—');
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
      if (r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI') a.contratadas++;
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
      if (r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI') a.contratadas++;
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
      if (r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI') a.contratadas++;
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
          funilSituacaoLabel(r.situacao),
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

  const exportDrilldownCsv = useCallback(() => {
    if (drillRowsFiltradas.length === 0) {
      toast.info('Nenhum registro para exportar.');
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
    for (const r of drillRowsFiltradas) {
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
          funilSituacaoLabel(r.situacao),
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
    downloadTextFile(lines.join('\n'), `bi_cotacoes_detalhe_${filters.periodoIni}_a_${filters.periodoFim}.csv`);
  }, [drillRowsFiltradas, filters.periodoFim, filters.periodoIni]);

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
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-200">Início</Label>
                    <Input
                      type="date"
                      value={tempFilters.periodoIni}
                      onChange={(e) => setTempFilters({ ...tempFilters, periodoIni: e.target.value })}
                      className="dark:border-slate-700 dark:bg-slate-900"
                    />
                    </div>
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="space-y-2">
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
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-200">Usuário</Label>
                      <Input
                        value={tempFilters.f14}
                        onChange={(e) => setTempFilters({ ...tempFilters, f14: e.target.value })}
                        placeholder="Login do usuário"
                        className="dark:border-slate-700 dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-200">Unidade de inclusão</Label>
                      <FilterSelectUnidadeSingle value={tempFilters.f11} onChange={(v) => setTempFilters({ ...tempFilters, f11: v })} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-200">Unidade de origem</Label>
                      <FilterSelectUnidadeSingle value={tempFilters.f13} onChange={(v) => setTempFilters({ ...tempFilters, f13: v })} />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                    <div className="space-y-2">
                      <Label className="text-slate-700 dark:text-slate-200">Pagador</Label>
                      <FilterSelectCliente type="pagador" value={tempFilters.f16} onChange={(v) => setTempFilters({ ...tempFilters, f16: v })} />
                    </div>
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
                  <Button onClick={gerar} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    Gerar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

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
      <div className="relative">
        {loading && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 backdrop-blur-sm">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Gerando relatório...</div>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {status || 'Buscando cotações.'}
              </div>
            </div>
          </div>
        )}

        <div className={loading ? 'space-y-6 blur-[1px] opacity-70 pointer-events-none select-none' : 'space-y-6'}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card
            role="button"
            tabIndex={0}
            onClick={() => openDrill('Cotações', rowsFiltered)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Cotações', rowsFiltered); }}
            className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900 cursor-pointer hover:opacity-95"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-blue-700 dark:text-blue-200">Cotações</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.cotacoes)}</p>
                </div>
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-300" />
              </div>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => openDrill('Clientes (registros)', rowsFiltered)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Clientes (registros)', rowsFiltered); }}
            className="bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900 cursor-pointer hover:opacity-95"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-violet-800 dark:text-violet-200">Clientes</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.clientes)}</p>
                </div>
                <Users className="w-5 h-5 text-violet-600 dark:text-violet-300" />
              </div>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => openDrill('Simuladas', rowsSimuladas)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Simuladas', rowsSimuladas); }}
            className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 cursor-pointer hover:opacity-95"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-slate-700 dark:text-slate-200">Simuladas</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.cotado)}</p>
                </div>
                <Hourglass className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              </div>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => openDrill('Contratadas', rowsContratadas)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Contratadas', rowsContratadas); }}
            className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 cursor-pointer hover:opacity-95"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-amber-800 dark:text-amber-200">Contratadas</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.contrat)}</p>
                </div>
                <Handshake className="w-5 h-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => openDrill('CTRC emit.', rowsCtrecEmit)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('CTRC emit.', rowsCtrecEmit); }}
            className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 cursor-pointer hover:opacity-95"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-emerald-800 dark:text-emerald-200">CTRC emit.</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatNumber(totalsView.ctrc_emi)}</p>
                </div>
                <Truck className="w-5 h-5 text-emerald-500" />
              </div>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => openDrill('Conversão (base)', rowsFiltered)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Conversão (base)', rowsFiltered); }}
            className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900 cursor-pointer hover:opacity-95"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-indigo-800 dark:text-indigo-200">Conversão</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatPercent(totalsView.conversao)}</p>
                </div>
                <BadgePercent className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
              </div>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => openDrill('Frete cotado (base)', rowsFiltered)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Frete cotado (base)', rowsFiltered); }}
            className="bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900 cursor-pointer hover:opacity-95"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-cyan-800 dark:text-cyan-200">Frete cotado</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totalsView.potencial)}</p>
                </div>
                <ClipboardList className="w-5 h-5 text-cyan-600 dark:text-cyan-300" />
              </div>
            </CardContent>
          </Card>

          <Card
            role="button"
            tabIndex={0}
            onClick={() => openDrill('Frete CTRC', rowsCtrecEmit)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Frete CTRC', rowsCtrecEmit); }}
            className="bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 cursor-pointer hover:opacity-95"
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs tracking-wide text-green-800 dark:text-green-200">Frete CTRC</p>
                  <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totalsView.convertido)}</p>
                </div>
                <Wallet className="w-5 h-5 text-green-700 dark:text-green-300" />
              </div>
            </CardContent>
          </Card>
          </div>

        <div className="space-y-3">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="w-full h-12 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 grid grid-cols-6">
              <TabsTrigger value="pipeline" className="h-10 gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Target className="w-4 h-4" />
                <span className="hidden sm:inline">Pipeline</span>
              </TabsTrigger>
              <TabsTrigger value="usuarios" className="h-10 gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <UserIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Usuários</span>
              </TabsTrigger>
              <TabsTrigger value="clientes" className="h-10 gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Clientes</span>
              </TabsTrigger>
              <TabsTrigger value="origem-destino" className="h-10 gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <MapPin className="w-4 h-4" />
                <span className="hidden sm:inline">Origem/Destino</span>
              </TabsTrigger>
              <TabsTrigger value="ranking" className="h-10 gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <Trophy className="w-4 h-4" />
                <span className="hidden sm:inline">Ranking</span>
              </TabsTrigger>
              <TabsTrigger value="lista" className="h-10 gap-2 data-[state=active]:bg-indigo-600 data-[state=active]:text-white">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Lista</span>
              </TabsTrigger>
            </TabsList>

          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant={quickStatus === 'ALL' ? 'default' : 'outline'}
                className={
                  quickStatus === 'ALL'
                    ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                }
                onClick={() => setQuickStatus('ALL')}
              >
                Todos
              </Button>
              <Button
                variant={quickStatus === 'COTADO' ? 'default' : 'outline'}
                onClick={() => setQuickStatus('COTADO')}
                className={
                  quickStatus === 'COTADO'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                    : 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-200 dark:hover:bg-blue-950/30'
                }
              >
                Cotado
              </Button>
              <Button
                variant={quickStatus === 'CONTRAT' ? 'default' : 'outline'}
                onClick={() => setQuickStatus('CONTRAT')}
                className={
                  quickStatus === 'CONTRAT'
                    ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                    : 'border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-950/30'
                }
              >
                Contrat
              </Button>
              <Button
                variant={quickStatus === 'CTRC_EMI' ? 'default' : 'outline'}
                onClick={() => setQuickStatus('CTRC_EMI')}
                className={
                  quickStatus === 'CTRC_EMI'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                    : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-200 dark:hover:bg-emerald-950/30'
                }
              >
                CTRC
              </Button>
            </div>

            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cotação, cliente, origem/destino, CTRC..."
                className="pl-9 dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
          </div>
          <TabsContent value="pipeline" className="mt-0">
            <div className="space-y-4">
              <Card
                role="button"
                tabIndex={0}
                onClick={() => {
                  const rs =
                    dailyMode === 'simuladas'
                      ? rowsSimuladas
                      : dailyMode === 'contratadas'
                        ? rowsContratadas
                        : dailyMode === 'ctrc_emi'
                          ? rowsCtrecEmit
                          : rowsFiltered;
                  openDrill(`Volume diário · ${dailyMode === 'todas' ? 'Todas' : dailyMode === 'cotacoes' ? 'Cotações' : dailyMode === 'simuladas' ? 'Simuladas' : dailyMode === 'contratadas' ? 'Contratadas' : 'CTRC emit.'}`, rs);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  const rs =
                    dailyMode === 'simuladas'
                      ? rowsSimuladas
                      : dailyMode === 'contratadas'
                        ? rowsContratadas
                        : dailyMode === 'ctrc_emi'
                          ? rowsCtrecEmit
                          : rowsFiltered;
                  openDrill(`Volume diário · ${dailyMode === 'todas' ? 'Todas' : dailyMode === 'cotacoes' ? 'Cotações' : dailyMode === 'simuladas' ? 'Simuladas' : dailyMode === 'contratadas' ? 'Contratadas' : 'CTRC emit.'}`, rs);
                }}
                className="dark:bg-slate-900 dark:border-slate-700 cursor-pointer hover:opacity-95"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                      <CalendarDays className="w-4 h-4 text-indigo-500" />
                      Volume diário
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={dailyMode === 'todas' ? 'default' : 'outline'}
                        className={
                          dailyMode === 'todas'
                            ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                        }
                        onClick={(e) => { e.stopPropagation(); setDailyMode('todas'); }}
                      >
                        Todas
                      </Button>
                      <Button
                        size="sm"
                        variant={dailyMode === 'cotacoes' ? 'default' : 'outline'}
                        className={
                          dailyMode === 'cotacoes'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                            : 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-200 dark:hover:bg-blue-950/30'
                        }
                        onClick={(e) => { e.stopPropagation(); setDailyMode('cotacoes'); }}
                      >
                        Cotações
                      </Button>
                      <Button
                        size="sm"
                        variant={dailyMode === 'simuladas' ? 'default' : 'outline'}
                        className={
                          dailyMode === 'simuladas'
                            ? 'bg-slate-600 hover:bg-slate-700 text-white border-slate-600'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                        }
                        onClick={(e) => { e.stopPropagation(); setDailyMode('simuladas'); }}
                      >
                        Simuladas
                      </Button>
                      <Button
                        size="sm"
                        variant={dailyMode === 'contratadas' ? 'default' : 'outline'}
                        className={
                          dailyMode === 'contratadas'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                            : 'border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-950/30'
                        }
                        onClick={(e) => { e.stopPropagation(); setDailyMode('contratadas'); }}
                      >
                        Contratadas
                      </Button>
                      <Button
                        size="sm"
                        variant={dailyMode === 'ctrc_emi' ? 'default' : 'outline'}
                        className={
                          dailyMode === 'ctrc_emi'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                            : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-200 dark:hover:bg-emerald-950/30'
                        }
                        onClick={(e) => { e.stopPropagation(); setDailyMode('ctrc_emi'); }}
                      >
                        CTRC emit.
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
                        <AreaChart data={dailySeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                          <defs>
                            <linearGradient id="bi_ct_line_cotacoes" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="bi_ct_line_simuladas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#64748b" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="bi_ct_line_contratadas" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="bi_ct_line_ctrc" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                          <XAxis dataKey="label" interval="preserveStartEnd" />
                          <YAxis allowDecimals={false} />
                          <RechartsTooltip
                            contentStyle={tooltipStyle as any}
                            formatter={(v: any, name: any) => {
                              const n = String(name);
                              const label =
                                n === 'cotacoes'
                                  ? 'Cotações'
                                  : n === 'simuladas'
                                    ? 'Simuladas'
                                    : n === 'contratadas_base'
                                      ? 'Contratadas'
                                      : n === 'contratadas'
                                        ? 'Contratadas'
                                        : n === 'ctrc_emi'
                                          ? 'CTRC emit.'
                                          : n;
                              return [formatNumber(Number(v)), label];
                            }}
                            labelFormatter={(l: any) => String(l)}
                          />
                          {dailyMode === 'todas' ? (
                            <>
                              <Legend wrapperStyle={{ fontSize: 11 }} />
                              <Area
                                type="monotone"
                                dataKey="simuladas"
                                name="Simuladas"
                                stackId="1"
                                stroke="#64748b"
                                strokeWidth={2}
                                fill="url(#bi_ct_line_simuladas)"
                                dot={false}
                                onClick={(d: any, _i: any, e: any) => {
                                  e?.stopPropagation?.();
                                  const iso = d?.payload?.iso;
                                  if (iso) openDrill('Volume diário · Todas', rowsForDailyIso(String(iso), 'todas'));
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="contratadas_base"
                                name="Contratadas"
                                stackId="1"
                                stroke="#f59e0b"
                                strokeWidth={2}
                                fill="url(#bi_ct_line_contratadas)"
                                dot={false}
                                onClick={(d: any, _i: any, e: any) => {
                                  e?.stopPropagation?.();
                                  const iso = d?.payload?.iso;
                                  if (iso) openDrill('Volume diário · Todas', rowsForDailyIso(String(iso), 'todas'));
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="ctrc_emi"
                                name="CTRC emit."
                                stackId="1"
                                stroke="#10b981"
                                strokeWidth={2}
                                fill="url(#bi_ct_line_ctrc)"
                                dot={false}
                                onClick={(d: any, _i: any, e: any) => {
                                  e?.stopPropagation?.();
                                  const iso = d?.payload?.iso;
                                  if (iso) openDrill('Volume diário · Todas', rowsForDailyIso(String(iso), 'todas'));
                                }}
                              />
                            </>
                          ) : (
                            <Area
                              type="monotone"
                              dataKey={
                                dailyMode === 'cotacoes'
                                  ? 'cotacoes'
                                  : dailyMode === 'simuladas'
                                    ? 'simuladas'
                                    : dailyMode === 'contratadas'
                                      ? 'contratadas'
                                      : 'ctrc_emi'
                              }
                              name={
                                dailyMode === 'cotacoes'
                                  ? 'Cotações'
                                  : dailyMode === 'simuladas'
                                    ? 'Simuladas'
                                    : dailyMode === 'contratadas'
                                      ? 'Contratadas'
                                      : 'CTRC emit.'
                              }
                              stroke={
                                dailyMode === 'cotacoes'
                                  ? '#3b82f6'
                                  : dailyMode === 'simuladas'
                                    ? '#64748b'
                                    : dailyMode === 'contratadas'
                                      ? '#f59e0b'
                                      : '#10b981'
                              }
                              strokeWidth={2}
                              fill={
                                dailyMode === 'cotacoes'
                                  ? 'url(#bi_ct_line_cotacoes)'
                                  : dailyMode === 'simuladas'
                                    ? 'url(#bi_ct_line_simuladas)'
                                    : dailyMode === 'contratadas'
                                      ? 'url(#bi_ct_line_contratadas)'
                                      : 'url(#bi_ct_line_ctrc)'
                              }
                              dot={false}
                              activeDot={{ r: 5 }}
                              onClick={(d: any, _i: any, e: any) => {
                                e?.stopPropagation?.();
                                const iso = d?.payload?.iso;
                                if (!iso) return;
                                openDrill(
                                  `Volume diário · ${
                                    dailyMode === 'cotacoes'
                                      ? 'Cotações'
                                      : dailyMode === 'simuladas'
                                        ? 'Simuladas'
                                        : dailyMode === 'contratadas'
                                          ? 'Contratadas'
                                          : 'CTRC emit.'
                                  }`,
                                  rowsForDailyIso(String(iso), dailyMode)
                                );
                              }}
                            />
                          )}
                        </AreaChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => openDrill('Funil por Situação', rowsFiltered)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Funil por Situação', rowsFiltered); }}
                  className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-1 cursor-pointer hover:opacity-95"
                >
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
                            <Pie
                              data={donutData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={55}
                              outerRadius={90}
                              paddingAngle={2}
                              stroke="none"
                              onClick={(d: any, _i: any, e: any) => {
                                e?.stopPropagation?.();
                                const name = String(d?.name ?? d?.payload?.name ?? '').trim();
                                if (!name) return;
                                openDrill(`Funil por Situação: ${name}`, rowsFiltered.filter((r) => funilSituacaoLabel(r.situacao) === name));
                              }}
                            >
                              {donutData.map((_, i) => (
                                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={tooltipStyle as any}
                              formatter={(v: any, n: any) => [formatNumber(Number(v)), String(n)]}
                            />
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

                <Card
                  role="button"
                  tabIndex={0}
                  onClick={() => openDrill('Receita · Potencial vs Convertida', rowsFiltered)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Receita · Potencial vs Convertida', rowsFiltered); }}
                  className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-2 cursor-pointer hover:opacity-95"
                >
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
                            <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any) => formatCurrency(Number(v))} />
                            <Bar
                              dataKey="potencial"
                              fill="#93c5fd"
                              radius={[4, 4, 0, 0]}
                              onClick={(d: any, _i: any, e: any) => {
                                e?.stopPropagation?.();
                                const usuario = d?.payload?.name;
                                if (!usuario) return;
                                openDrill(`Usuário: ${String(usuario)}`, rowsFiltered.filter((r) => String(r.usuario_inclusao || '').trim().toLowerCase() === String(usuario).trim().toLowerCase()));
                              }}
                            />
                            <Bar
                              dataKey="convertido"
                              fill="#34d399"
                              radius={[4, 4, 0, 0]}
                              onClick={(d: any, _i: any, e: any) => {
                                e?.stopPropagation?.();
                                const usuario = d?.payload?.name;
                                if (!usuario) return;
                                openDrill(`Usuário: ${String(usuario)}`, rowsFiltered.filter((r) => String(r.usuario_inclusao || '').trim().toLowerCase() === String(usuario).trim().toLowerCase()));
                              }}
                            />
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
            <div className="space-y-4">
              <Card
                role="button"
                tabIndex={0}
                onClick={() => {
                  const userSet = new Set(topUsuarios5.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean));
                  const base = rowsFiltered.filter((r) => userSet.has(String(r.usuario_inclusao || '').trim().toLowerCase()));
                  const rs =
                    usersDailyMode === 'simuladas'
                      ? base.filter((r) => r.status_kind === 'COTADO')
                      : usersDailyMode === 'contratadas'
                        ? base.filter((r) => r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI')
                        : usersDailyMode === 'ctrc_emi'
                          ? base.filter((r) => r.status_kind === 'CTRC_EMI')
                          : base;
                  openDrill(
                    `Usuários · Série diária · ${usersDailyMode === 'cotacoes' ? 'Cotações' : usersDailyMode === 'simuladas' ? 'Simuladas' : usersDailyMode === 'contratadas' ? 'Contratadas' : 'CTRC emit.'} (Top ${formatNumber(topUsuarios5.length)})`,
                    rs
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  const userSet = new Set(topUsuarios5.map((u) => String(u || '').trim().toLowerCase()).filter(Boolean));
                  const base = rowsFiltered.filter((r) => userSet.has(String(r.usuario_inclusao || '').trim().toLowerCase()));
                  const rs =
                    usersDailyMode === 'simuladas'
                      ? base.filter((r) => r.status_kind === 'COTADO')
                      : usersDailyMode === 'contratadas'
                        ? base.filter((r) => r.status_kind === 'CONTRAT' || r.status_kind === 'CTRC_EMI')
                        : usersDailyMode === 'ctrc_emi'
                          ? base.filter((r) => r.status_kind === 'CTRC_EMI')
                          : base;
                  openDrill(
                    `Usuários · Série diária · ${usersDailyMode === 'cotacoes' ? 'Cotações' : usersDailyMode === 'simuladas' ? 'Simuladas' : usersDailyMode === 'contratadas' ? 'Contratadas' : 'CTRC emit.'} (Top ${formatNumber(topUsuarios5.length)})`,
                    rs
                  );
                }}
                className="dark:bg-slate-900 dark:border-slate-700 cursor-pointer hover:opacity-95"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-semibold">
                      <UserIcon className="w-4 h-4 text-indigo-500" />
                      Volume diário por usuário
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={usersDailyMode === 'cotacoes' ? 'default' : 'outline'}
                        className={
                          usersDailyMode === 'cotacoes'
                            ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                            : 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-900/60 dark:text-blue-200 dark:hover:bg-blue-950/30'
                        }
                        onClick={(e) => { e.stopPropagation(); setUsersDailyMode('cotacoes'); }}
                      >
                        Cotações
                      </Button>
                      <Button
                        size="sm"
                        variant={usersDailyMode === 'simuladas' ? 'default' : 'outline'}
                        className={
                          usersDailyMode === 'simuladas'
                            ? 'bg-slate-600 hover:bg-slate-700 text-white border-slate-600'
                            : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
                        }
                        onClick={(e) => { e.stopPropagation(); setUsersDailyMode('simuladas'); }}
                      >
                        Simuladas
                      </Button>
                      <Button
                        size="sm"
                        variant={usersDailyMode === 'contratadas' ? 'default' : 'outline'}
                        className={
                          usersDailyMode === 'contratadas'
                            ? 'bg-amber-600 hover:bg-amber-700 text-white border-amber-600'
                            : 'border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-200 dark:hover:bg-amber-950/30'
                        }
                        onClick={(e) => { e.stopPropagation(); setUsersDailyMode('contratadas'); }}
                      >
                        Contratadas
                      </Button>
                      <Button
                        size="sm"
                        variant={usersDailyMode === 'ctrc_emi' ? 'default' : 'outline'}
                        className={
                          usersDailyMode === 'ctrc_emi'
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                            : 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-200 dark:hover:bg-emerald-950/30'
                        }
                        onClick={(e) => { e.stopPropagation(); setUsersDailyMode('ctrc_emi'); }}
                      >
                        CTRC emit.
                      </Button>
                    </div>
                  </div>

                  <div className="h-[280px]">
                    {!data ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Gere para visualizar.</div>
                    ) : topUsuarios5.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-slate-500">Sem usuários.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={usersDailySeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                          <XAxis dataKey="label" interval="preserveStartEnd" />
                          <YAxis allowDecimals={false} />
                          <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any, name: any) => [formatNumber(Number(v)), String(name)]} />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          {topUsuarios5.map((u, idx) => (
                            <Line
                              key={u}
                              type="monotone"
                              dataKey={`u${idx}`}
                              name={u}
                              stroke={USER_LINE_COLORS[idx % USER_LINE_COLORS.length]}
                              strokeWidth={2}
                              dot={false}
                              activeDot={{ r: 5 }}
                              onClick={(d: any, _i: any, e: any) => {
                                e?.stopPropagation?.();
                                const iso = d?.payload?.iso;
                                if (!iso) return;
                                openDrill(
                                  `Usuários · Série diária · ${
                                    usersDailyMode === 'cotacoes'
                                      ? 'Cotações'
                                      : usersDailyMode === 'simuladas'
                                        ? 'Simuladas'
                                        : usersDailyMode === 'contratadas'
                                          ? 'Contratadas'
                                          : 'CTRC emit.'
                                  } · ${String(iso)}`,
                                  rowsForUsersDailyIso(String(iso), usersDailyMode)
                                );
                              }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Top {formatNumber(topUsuarios5.length)} usuários cotadores · Série diária do período selecionado
                  </div>
                </CardContent>
              </Card>

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
                            <tr
                              key={u.usuario}
                              role="button"
                              tabIndex={0}
                              onClick={() => openDrill(`Usuário: ${u.usuario}`, rowsFiltered.filter((r) => String(r.usuario_inclusao || '').trim().toLowerCase() === u.usuario))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') openDrill(`Usuário: ${u.usuario}`, rowsFiltered.filter((r) => String(r.usuario_inclusao || '').trim().toLowerCase() === u.usuario));
                              }}
                              className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 cursor-pointer"
                            >
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
            </div>
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
                          <tr
                            key={c.cnpj || c.nome}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              const title = c.nome ? `Cliente: ${c.nome}` : `Cliente: ${c.cnpj || '-'}`;
                              const rs = rowsFiltered.filter((r) => {
                                if (c.cnpj) return String(r.cnpj_pagador || '').trim() === String(c.cnpj).trim();
                                if (c.nome) return String(r.nome_pagador || '').trim() === String(c.nome).trim();
                                return false;
                              });
                              openDrill(title, rs);
                            }}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter' && e.key !== ' ') return;
                              const title = c.nome ? `Cliente: ${c.nome}` : `Cliente: ${c.cnpj || '-'}`;
                              const rs = rowsFiltered.filter((r) => {
                                if (c.cnpj) return String(r.cnpj_pagador || '').trim() === String(c.cnpj).trim();
                                if (c.nome) return String(r.nome_pagador || '').trim() === String(c.nome).trim();
                                return false;
                              });
                              openDrill(title, rs);
                            }}
                            className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 cursor-pointer"
                          >
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
              <Card
                role="button"
                tabIndex={0}
                onClick={() => openDrill(`Origem / Destino · ${origemDestinoMode === 'origem' ? 'Origem' : 'Destino'}`, rowsFiltered)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openDrill(`Origem / Destino · ${origemDestinoMode === 'origem' ? 'Origem' : 'Destino'}`, rowsFiltered);
                }}
                className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-1 cursor-pointer hover:opacity-95"
              >
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
                        className={
                          origemDestinoMode === 'origem'
                            ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                            : 'dark:border-slate-700'
                        }
                        onClick={(e) => { e.stopPropagation(); setOrigemDestinoMode('origem'); }}
                      >
                        Origem
                      </Button>
                      <Button
                        size="sm"
                        variant={origemDestinoMode === 'destino' ? 'default' : 'outline'}
                        className={
                          origemDestinoMode === 'destino'
                            ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200'
                            : 'dark:border-slate-700'
                        }
                        onClick={(e) => { e.stopPropagation(); setOrigemDestinoMode('destino'); }}
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
                            contentStyle={tooltipStyle as any}
                            formatter={(v: any, name: any) => {
                              const n = String(name);
                              if (n === 'potencial' || n === 'convertido') return [formatCurrency(Number(v)), n];
                              if (n === 'conversao') return [formatPercent(Number(v)), 'conversão'];
                              return [formatNumber(Number(v)), n];
                            }}
                          />
                          <Bar
                            dataKey="cotacoes"
                            fill="#60a5fa"
                            radius={[4, 4, 4, 4]}
                            onClick={(d: any, _i: any, e: any) => {
                              e?.stopPropagation?.();
                              const uf = d?.payload?.uf;
                              if (!uf) return;
                              const rs = rowsFiltered.filter((x) => {
                                const u = origemDestinoMode === 'origem' ? ufFromPlace(x.origem) : ufFromPlace(x.destino);
                                return u === uf;
                              });
                              openDrill(`UF ${String(uf)} · ${origemDestinoMode === 'origem' ? 'Origem' : 'Destino'}`, rs);
                            }}
                          />
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
                            <tr
                              key={r.uf}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                const rs = rowsFiltered.filter((x) => {
                                  const uf = origemDestinoMode === 'origem' ? ufFromPlace(x.origem) : ufFromPlace(x.destino);
                                  return uf === r.uf;
                                });
                                openDrill(`UF ${r.uf} · ${origemDestinoMode === 'origem' ? 'Origem' : 'Destino'}`, rs);
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== 'Enter' && e.key !== ' ') return;
                                const rs = rowsFiltered.filter((x) => {
                                  const uf = origemDestinoMode === 'origem' ? ufFromPlace(x.origem) : ufFromPlace(x.destino);
                                  return uf === r.uf;
                                });
                                openDrill(`UF ${r.uf} · ${origemDestinoMode === 'origem' ? 'Origem' : 'Destino'}`, rs);
                              }}
                              className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 cursor-pointer"
                            >
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
              <Card
                role="button"
                tabIndex={0}
                onClick={() => openDrill('Frete convertido por mês', rowsCtrecEmit)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Frete convertido por mês', rowsCtrecEmit); }}
                className="dark:bg-slate-900 dark:border-slate-700 lg:col-span-2 cursor-pointer hover:opacity-95"
              >
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
                          <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any) => formatCurrency(Number(v))} />
                          <Area
                            type="monotone"
                            dataKey="convertido"
                            stroke="#10b981"
                            fill="#10b981"
                            fillOpacity={0.18}
                            strokeWidth={2}
                            onClick={(d: any, _i: any, e: any) => {
                              e?.stopPropagation?.();
                              const ym = d?.payload?.ym;
                              const label = d?.payload?.label;
                              if (!ym) return;
                              openDrill(`Frete convertido · ${String(label || ym)}`, rowsForMonthYm(String(ym)));
                            }}
                          />
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
                          role="button"
                          tabIndex={0}
                          onClick={() => openDrill(`Usuário: ${u.usuario}`, rowsFiltered.filter((r) => String(r.usuario_inclusao || '').trim().toLowerCase() === u.usuario))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') openDrill(`Usuário: ${u.usuario}`, rowsFiltered.filter((r) => String(r.usuario_inclusao || '').trim().toLowerCase() === u.usuario));
                          }}
                          className={[
                            'rounded-lg border p-3 flex items-center justify-between gap-3 cursor-pointer hover:opacity-95',
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
                            <tr
                              key={u.usuario}
                              role="button"
                              tabIndex={0}
                              onClick={() => openDrill(`Usuário: ${u.usuario}`, rowsFiltered.filter((r) => String(r.usuario_inclusao || '').trim().toLowerCase() === u.usuario))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') openDrill(`Usuário: ${u.usuario}`, rowsFiltered.filter((r) => String(r.usuario_inclusao || '').trim().toLowerCase() === u.usuario));
                              }}
                              className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-900/40 cursor-pointer"
                            >
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
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => openDrill('Lista (CRM)', rowsFiltered)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openDrill('Lista (CRM)', rowsFiltered); }}
                    className="text-slate-900 dark:text-slate-100 font-semibold cursor-pointer hover:opacity-95"
                  >
                    Lista (CRM)
                  </div>
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
                                {r.situacao ? funilSituacaoLabel(r.situacao) : '-'}
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
      </div>
      </div>
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-[1200px] bg-white dark:bg-slate-900 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
          <div className="flex items-start justify-between gap-3 pr-10">
            <DialogHeader>
              <DialogTitle className="text-slate-900 dark:text-slate-100">{drillTitle || 'Detalhe'}</DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400">
                {formatNumber(drillTotals.rows)} registro{drillTotals.rows !== 1 ? 's' : ''} · Potencial: {formatCurrency(drillTotals.potencial)} · CTRC: {formatNumber(drillTotals.ctrc)} · Convertido: {formatCurrency(drillTotals.convertido)}
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="outline"
              size="sm"
              onClick={exportDrilldownCsv}
              disabled={drillRowsFiltradas.length === 0}
              className="dark:border-slate-700 mr-2"
            >
              <Download className="w-4 h-4" />
              <span className="ml-1.5">Exportar CSV</span>
            </Button>
          </div>

          <div className="mt-2">
            <Input
              value={drillSearch}
              onChange={(e) => setDrillSearch(e.target.value)}
              placeholder="Filtrar por cotação, situação, cliente, origem/destino, usuário, CTRC..."
              className="dark:bg-slate-800 dark:border-slate-700"
            />
          </div>

          <div className="mt-3 flex-1 overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="sticky top-0 z-20 grid gap-x-2 grid-cols-[90px_140px_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_90px_55px_110px_110px_70px_70px] bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 backdrop-blur">
              <div className="font-mono">Cotação</div>
              <div>Situação</div>
              <div>Cliente</div>
              <div>Origem</div>
              <div>Destino</div>
              <div>Usuário</div>
              <div>Unid</div>
              <div className="text-right">Proposta</div>
              <div className="text-right">Frete CTRC</div>
              <div>CTRC</div>
              <div>Incl.</div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {drillRowsFiltradas.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum registro encontrado.</div>
              ) : (
                drillRowsFiltradas.map((r, idx) => {
                  const incl = (r.data_inclusao || '').slice(0, 10);
                  const cliente = r.nome_pagador || r.cnpj_pagador || '-';
                  return (
                    <div
                      key={`${r.cotacao}-${r.ctrc}-${idx}`}
                      className="grid gap-x-2 grid-cols-[90px_140px_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_90px_55px_110px_110px_70px_70px] px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div className="font-mono truncate">{r.cotacao || '-'}</div>
                      <div className="truncate">{r.situacao ? funilSituacaoLabel(r.situacao) : '-'}</div>
                      <div className="min-w-0">
                        <div className="truncate">{cliente}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">{r.cnpj_pagador || '-'}</div>
                      </div>
                      <div className="truncate">{r.origem || '-'}</div>
                      <div className="truncate">{r.destino || '-'}</div>
                      <div className="font-mono truncate">{r.usuario_inclusao || '-'}</div>
                      <div className="font-mono truncate">{r.unidade_inclusao || '-'}</div>
                      <div className="text-right font-mono">{formatCurrency(r.proposta_atual)}</div>
                      <div className="text-right font-mono">{formatCurrency(r.frete_ctrc)}</div>
                      <div className="font-mono truncate">{r.ctrc || '-'}</div>
                      <div className="font-mono truncate">{incl || '-'}</div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="sticky bottom-0 z-20 grid gap-x-2 grid-cols-[90px_140px_minmax(0,2.2fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_90px_55px_110px_110px_70px_70px] bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 backdrop-blur">
              <div />
              <div />
              <div />
              <div />
              <div />
              <div />
              <div className="text-right">Total</div>
              <div className="text-right font-mono">{formatCurrency(drillTotals.potencial)}</div>
              <div className="text-right font-mono">{formatCurrency(drillTotals.convertido)}</div>
              <div />
              <div />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
