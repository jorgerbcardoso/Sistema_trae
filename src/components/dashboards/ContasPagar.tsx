import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, LineChart, Line, CartesianGrid, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { EventoSearchInput } from '../shared/EventoSearchInput';
import { FornecedorSearchInput } from '../shared/FornecedorSearchInput';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { AlertTriangle, ArrowDown, ArrowUp, CalendarRange, ClipboardList, Clock, Download, Filter, Loader2, Search, Wallet, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useTooltipStyle } from './CustomTooltip';

type GrupoEvento = { grupo: number; descricao: string };

type RowDespesa = {
  nro_lancto: number;
  parcela: number;
  evento: number;
  evento_descricao: string;
  historico: string;
  fornecedor_cnpj: string;
  fornecedor_nome: string;
  vlr_parcela: string;
  data_inclusao: string;
  data_vencimento: string;
  data_emissao_nf: string;
  data_programacao_pgto: string;
  unidade: string;
  sit_des: string;
  grupo_evento: string;
  mes_competencia: string;
};

type Filters = {
  seq_fornecedor: string;
  unidade: string;
  grupo_evento: string;
  evento: string;
  periodo_emissao_inicio: string;
  periodo_emissao_fim: string;
  periodo_inclusao_inicio: string;
  periodo_inclusao_fim: string;
  periodo_programacao_inicio: string;
  periodo_programacao_fim: string;
  periodo_vencimento_inicio: string;
  periodo_vencimento_fim: string;
  competencia_ym: string;
};

const filtrosVazios: Filters = {
  seq_fornecedor: '',
  unidade: '',
  grupo_evento: '',
  evento: '',
  periodo_emissao_inicio: '',
  periodo_emissao_fim: '',
  periodo_inclusao_inicio: '',
  periodo_inclusao_fim: '',
  periodo_programacao_inicio: '',
  periodo_programacao_fim: '',
  periodo_vencimento_inicio: '',
  periodo_vencimento_fim: '',
  competencia_ym: '',
};

const dateToInput = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const diffDaysInclusive = (startIso: string, endIso: string): number | null => {
  const s = Date.parse(`${startIso}T00:00:00`);
  const e = Date.parse(`${endIso}T00:00:00`);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  const days = Math.floor((e - s) / (24 * 60 * 60 * 1000)) + 1;
  return Number.isFinite(days) ? days : null;
};

const validarRecorte = (f: Filters): string | null => {
  if (f.grupo_evento && f.evento) return 'Selecione Grupo de Evento ou Evento (não é permitido informar os dois).';

  const p = [
    { label: 'Inclusão', ini: f.periodo_inclusao_inicio, fim: f.periodo_inclusao_fim },
    { label: 'Programação (Pagamento)', ini: f.periodo_programacao_inicio, fim: f.periodo_programacao_fim },
    { label: 'Vencimento', ini: f.periodo_vencimento_inicio, fim: f.periodo_vencimento_fim },
  ];

  const hasAnyOfThree = p.some((x) => !!x.ini || !!x.fim);
  if (!hasAnyOfThree) return 'Informe ao menos 1 dos períodos: Inclusão, Programação (Pagamento) ou Vencimento.';

  for (const x of p) {
    if (!x.ini && !x.fim) continue;
    if (!x.ini || !x.fim) return `Informe início e fim do período de ${x.label}.`;
    const days = diffDaysInclusive(x.ini, x.fim);
    if (days === null) return `Período de ${x.label} inválido.`;
    if (days < 1) return `Período de ${x.label} inválido (fim antes do início).`;
    if (days > 62) return `Período de ${x.label} deve ter no máximo 62 dias.`;
  }

  if ((f.periodo_emissao_inicio || f.periodo_emissao_fim) && (!f.periodo_emissao_inicio || !f.periodo_emissao_fim)) {
    return 'Informe início e fim do período de Emissão da NF.';
  }
  if (f.periodo_emissao_inicio && f.periodo_emissao_fim) {
    const days = diffDaysInclusive(f.periodo_emissao_inicio, f.periodo_emissao_fim);
    if (days === null) return 'Período de Emissão da NF inválido.';
    if (days < 1) return 'Período de Emissão da NF inválido (fim antes do início).';
    if (days > 62) return 'Período de Emissão da NF deve ter no máximo 62 dias.';
  }

  return null;
};

const getMesFechadoPagamento = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { inicio: dateToInput(first), fim: dateToInput(last) };
};

const getDefaultFilters = (): Filters => {
  const { inicio, fim } = getMesFechadoPagamento();
  return {
    ...filtrosVazios,
    periodo_programacao_inicio: inicio,
    periodo_programacao_fim: fim,
  };
};

const shiftIsoDateYears = (iso: string, yearsDelta: number) => {
  const s = (iso ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  dt.setFullYear(dt.getFullYear() + yearsDelta);
  return dateToInput(dt);
};

const shiftIsoMonthYears = (ym: string, yearsDelta: number) => {
  const s = (ym ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const y = parseInt(m[1], 10);
  const mo = m[2];
  return `${y + yearsDelta}-${mo}`;
};

const shiftFiltersYears = (f: Filters, yearsDelta: number): Filters => {
  return {
    ...f,
    periodo_emissao_inicio: f.periodo_emissao_inicio ? shiftIsoDateYears(f.periodo_emissao_inicio, yearsDelta) : '',
    periodo_emissao_fim: f.periodo_emissao_fim ? shiftIsoDateYears(f.periodo_emissao_fim, yearsDelta) : '',
    periodo_inclusao_inicio: f.periodo_inclusao_inicio ? shiftIsoDateYears(f.periodo_inclusao_inicio, yearsDelta) : '',
    periodo_inclusao_fim: f.periodo_inclusao_fim ? shiftIsoDateYears(f.periodo_inclusao_fim, yearsDelta) : '',
    periodo_programacao_inicio: f.periodo_programacao_inicio ? shiftIsoDateYears(f.periodo_programacao_inicio, yearsDelta) : '',
    periodo_programacao_fim: f.periodo_programacao_fim ? shiftIsoDateYears(f.periodo_programacao_fim, yearsDelta) : '',
    periodo_vencimento_inicio: f.periodo_vencimento_inicio ? shiftIsoDateYears(f.periodo_vencimento_inicio, yearsDelta) : '',
    periodo_vencimento_fim: f.periodo_vencimento_fim ? shiftIsoDateYears(f.periodo_vencimento_fim, yearsDelta) : '',
    competencia_ym: f.competencia_ym ? shiftIsoMonthYears(f.competencia_ym, yearsDelta) : '',
  };
};

const meses = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const;

const ymToCompetenciaLabel = (ym: string) => {
  const m = (ym ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || month < 1 || month > 12) return '';
  const mm = meses[month - 1];
  const yy = String(year).slice(-2);
  return `${mm}/${yy}`;
};

const ymToMesCompParam = (ym: string) => {
  const m = (ym ?? '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return '';
  const yy = m[1].slice(-2);
  return `${m[2]}${yy}`;
};

const moedaToNumber = (v: string) => {
  const s = (v ?? '').toString().trim();
  if (!s) return 0;
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const csvEscape = (value: string) => {
  const v = (value ?? '').toString();
  const needsQuotes = v.includes('"') || v.includes(';') || v.includes('\n') || v.includes('\r');
  const escaped = v.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const parseDateBR = (v: string) => {
  const s = (v ?? '').trim();
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const d = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
};

const parseCompetencia = (v: string) => {
  const s = (v ?? '').trim().toLowerCase();
  const m = s.match(/^([a-z]{3})\/(\d{2})$/);
  if (!m) return null;
  const mm = meses.indexOf(m[1] as any);
  if (mm < 0) return null;
  const year = 2000 + parseInt(m[2], 10);
  if (Number.isNaN(year)) return null;
  const month = mm + 1;
  const key = `${year}-${String(month).padStart(2, '0')}`;
  return { year, month, key, label: `${m[1]}/${m[2]}` };
};

const parseGrupoEvento = (v: string) => {
  const s = (v ?? '').toString().replace(/\s+/g, ' ').trim();
  if (!s) return { code: null as number | null, label: 'Sem grupo' };
  const m = s.match(/^(\d+)\s*(.*)$/);
  if (!m) return { code: null, label: s };
  const code = parseInt(m[1], 10);
  const desc = (m[2] ?? '').trim();
  return { code: Number.isNaN(code) ? null : code, label: desc ? `${m[1]} ${desc}` : m[1] };
};

export function ContasPagar() {
  usePageTitle('BI · Contas a Pagar');
  const { user } = useAuth();
  const tooltipStyle = useTooltipStyle();

  const [activeTab, setActiveTab] = useState<'visao' | 'lista'>('visao');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => getDefaultFilters());
  const [tempFilters, setTempFilters] = useState<Filters>(() => getDefaultFilters());
  const initialLoadRef = useRef(false);

  const [grupos, setGrupos] = useState<GrupoEvento[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  const [rows, setRows] = useState<RowDespesa[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickStatus, setQuickStatus] = useState<'ALL' | 'PEND' | 'LIQU' | 'CANC'>('ALL');
  const [quickOnlyOverdue, setQuickOnlyOverdue] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const PAGE_SIZE = 80;
  const [listPage, setListPage] = useState(1);
  const [topSort, setTopSort] = useState<{ key: 'venc' | 'valor' | 'fornecedor' | 'evento' | 'unidade'; dir: 'asc' | 'desc' }>(() => ({ key: 'valor', dir: 'desc' }));
  const [listSort, setListSort] = useState<{ key: 'prioridade' | 'sit' | 'pgto' | 'evento' | 'valor' | 'venc' | 'fornecedor' | 'unidade' | 'lancto'; dir: 'asc' | 'desc' }>(() => ({ key: 'prioridade', dir: 'asc' }));
  const [unidadeEmLinhas, setUnidadeEmLinhas] = useState(false);
  const [selectedDespesa, setSelectedDespesa] = useState<RowDespesa | null>(null);
  const [focusUnidade, setFocusUnidade] = useState('');
  const [focusGrupoLabel, setFocusGrupoLabel] = useState('');
  const [focusCompetenciaKey, setFocusCompetenciaKey] = useState('');
  const [lastLoadMessage, setLastLoadMessage] = useState<string>('');
  const [anoAnterior, setAnoAnterior] = useState<{ sum_total: number; sum_liqu: number; sum_canc: number; count_total: number } | null>(null);
  const [loadingAnoAnterior, setLoadingAnoAnterior] = useState(false);
  const anoAnteriorReqRef = useRef(0);

  useEffect(() => {
    if (showFilters) setTempFilters(filters);
  }, [showFilters, filters]);

  useEffect(() => {
    const loadGrupos = async () => {
      setLoadingGrupos(true);
      try {
        const res = await apiFetch(`/sistema/api/grupos_eventos/list.php?_t=${Date.now()}`);
        if (res?.success && Array.isArray(res.grupos)) {
          setGrupos(res.grupos);
        } else {
          setGrupos([]);
        }
      } finally {
        setLoadingGrupos(false);
      }
    };

    loadGrupos();
  }, []);

  const normalized = useMemo(() => {
    const today = new Date();
    const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0).getTime();
    return rows.map((r) => {
      const valor = moedaToNumber(r.vlr_parcela);
      const venc = parseDateBR(r.data_vencimento);
      const pgto = parseDateBR(r.data_programacao_pgto);
      const incl = parseDateBR(r.data_inclusao);
      const emi = parseDateBR(r.data_emissao_nf);
      const comp = parseCompetencia(r.mes_competencia);
      const grp = parseGrupoEvento(r.grupo_evento);
      const status = (r.sit_des ?? '').toString().trim().toUpperCase() || 'PEND';
      const vencTs = venc?.getTime() ?? null;
      const overdue = status !== 'LIQU' && vencTs !== null && vencTs < today0;
      const overdue7 = status !== 'LIQU' && vencTs !== null && vencTs < (today0 - (7 * 86400000));
      return {
        raw: r,
        valor,
        status,
        grupoCode: grp.code,
        grupoLabel: grp.label,
        competenciaKey: comp?.key ?? '',
        competenciaLabel: comp?.label ?? (r.mes_competencia ?? '').toString().trim(),
        vencimentoTs: vencTs,
        vencimentoLabel: r.data_vencimento,
        programacaoLabel: r.data_programacao_pgto,
        emissaoTs: emi?.getTime() ?? null,
        inclusaoTs: incl?.getTime() ?? null,
        programacaoTs: pgto?.getTime() ?? null,
        overdue,
        overdue7,
      };
    });
  }, [rows]);

  const hasFiltrosAtivos = useMemo(() => {
    const f = filters;
    return (
      !!f.seq_fornecedor ||
      !!f.unidade ||
      !!f.grupo_evento ||
      !!f.evento ||
      !!f.periodo_emissao_inicio ||
      !!f.periodo_emissao_fim ||
      !!f.periodo_inclusao_inicio ||
      !!f.periodo_inclusao_fim ||
      !!f.periodo_programacao_inicio ||
      !!f.periodo_programacao_fim ||
      !!f.periodo_vencimento_inicio ||
      !!f.periodo_vencimento_fim ||
      !!f.competencia_ym
    );
  }, [filters]);

  const filtered = useMemo(() => {
    const q = tableSearch.trim().toUpperCase();
    return normalized.filter((n) => {
      if (quickStatus !== 'ALL' && n.status !== quickStatus) return false;
      if (quickOnlyOverdue && !n.overdue) return false;
      if (focusUnidade && ((n.raw.unidade ?? '').toString().trim().toUpperCase() !== focusUnidade)) return false;
      if (focusGrupoLabel && n.grupoLabel !== focusGrupoLabel) return false;
      if (focusCompetenciaKey && n.competenciaKey !== focusCompetenciaKey) return false;
      if (!q) return true;
      const r = n.raw;
      const hay = [
        String(r.nro_lancto ?? ''),
        String(r.parcela ?? ''),
        String(r.evento ?? ''),
        (r.evento_descricao ?? ''),
        (r.fornecedor_nome ?? ''),
        (r.fornecedor_cnpj ?? ''),
        (r.historico ?? ''),
        (r.unidade ?? ''),
        (r.grupo_evento ?? ''),
        (r.mes_competencia ?? ''),
      ].join(' ').toUpperCase();
      return hay.includes(q);
    });
  }, [normalized, quickStatus, quickOnlyOverdue, focusUnidade, focusGrupoLabel, focusCompetenciaKey, tableSearch]);

  const totals = useMemo(() => {
    const base = { total: 0, pend: 0, liqu: 0, canc: 0, overdue: 0, rows: filtered.length };
    for (const n of filtered) {
      base.total += n.valor;
      if (n.status === 'LIQU') base.liqu += n.valor;
      else if (n.status === 'CANC') base.canc += n.valor;
      else base.pend += n.valor;
      if (n.overdue) base.overdue += n.valor;
    }
    return base;
  }, [filtered]);

  useEffect(() => {
    setListPage(1);
  }, [tableSearch, quickStatus, quickOnlyOverdue, focusUnidade, focusGrupoLabel, focusCompetenciaKey, rows.length, listSort.key, listSort.dir]);

  const listaOrdenada = useMemo(() => {
    const rank = (n: any) => {
      if (n.status === 'LIQU') return 2;
      if (n.status === 'CANC') return 3;
      if (n.overdue7) return 0;
      return 1;
    };
    const sitRank = (n: any) => {
      if (n.status === 'LIQU') return 1;
      if (n.status === 'CANC') return 2;
      return 0;
    };
    const cmpStr = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
    const safeTs = (t: number | null) => (t === null ? 9e15 : t);
    const eventoNum = (n: any) => {
      const v = String(n?.raw?.evento ?? '').replace(/\D+/g, '');
      const num = parseInt(v || '0', 10);
      return Number.isFinite(num) ? num : 0;
    };

    const arr = filtered.slice();
    arr.sort((a: any, b: any) => {
      if (listSort.key === 'prioridade') {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;

        const pa = safeTs(a.programacaoTs ?? null);
        const pb = safeTs(b.programacaoTs ?? null);
        if (pa !== pb) return pa - pb;

        const ea = eventoNum(a);
        const eb = eventoNum(b);
        if (ea !== eb) return ea - eb;

        const la = Number(a?.raw?.nro_lancto ?? 0) || 0;
        const lb = Number(b?.raw?.nro_lancto ?? 0) || 0;
        if (la !== lb) return la - lb;
        return 0;
      }

      const dir = listSort.dir === 'desc' ? -1 : 1;
      if (listSort.key === 'sit') return dir * (sitRank(a) - sitRank(b));
      if (listSort.key === 'valor') return dir * ((Number(a.valor) || 0) - (Number(b.valor) || 0));
      if (listSort.key === 'venc') return dir * (safeTs(a.vencimentoTs ?? null) - safeTs(b.vencimentoTs ?? null));
      if (listSort.key === 'pgto') return dir * (safeTs(a.programacaoTs ?? null) - safeTs(b.programacaoTs ?? null));
      if (listSort.key === 'evento') return dir * (eventoNum(a) - eventoNum(b));
      if (listSort.key === 'unidade') return dir * cmpStr(String(a?.raw?.unidade ?? ''), String(b?.raw?.unidade ?? ''));
      if (listSort.key === 'fornecedor') return dir * cmpStr(String(a?.raw?.fornecedor_nome ?? ''), String(b?.raw?.fornecedor_nome ?? ''));
      if (listSort.key === 'lancto') return dir * ((Number(a?.raw?.nro_lancto ?? 0) || 0) - (Number(b?.raw?.nro_lancto ?? 0) || 0));
      return 0;
    });
    return arr;
  }, [filtered, listSort.dir, listSort.key]);

  const listPageCount = useMemo(() => {
    return Math.max(1, Math.ceil(listaOrdenada.length / PAGE_SIZE));
  }, [listaOrdenada.length, PAGE_SIZE]);

  const listPageSafe = Math.min(Math.max(1, listPage), listPageCount);
  useEffect(() => {
    if (listPageSafe !== listPage) setListPage(listPageSafe);
  }, [listPageSafe, listPage]);

  const listaPaginada = useMemo(() => {
    const start = (listPageSafe - 1) * PAGE_SIZE;
    return listaOrdenada.slice(start, start + PAGE_SIZE);
  }, [listaOrdenada, listPageSafe, PAGE_SIZE]);

  const anoAnteriorValor = useMemo(() => {
    if (!anoAnterior) return null;
    if (quickStatus === 'LIQU') return anoAnterior.sum_liqu;
    if (quickStatus === 'PEND') return Math.max(0, anoAnterior.sum_total - anoAnterior.sum_liqu);
    return anoAnterior.sum_total;
  }, [anoAnterior, quickStatus]);

  const comparativoAnoAnterior = useMemo(() => {
    if (quickOnlyOverdue) return null;
    if (anoAnteriorValor === null) return null;
    const prev = anoAnteriorValor;
    const curr = totals.total;
    const pct = prev !== 0 ? ((curr - prev) / prev) * 100 : null;
    const delta = curr - prev;
    return { prev, pct, delta };
  }, [anoAnteriorValor, quickOnlyOverdue, totals.total]);

  const serieProgramacao = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; liqu: number }>();
    for (const n of filtered) {
      if (n.programacaoTs === null) continue;
      const d = new Date(n.programacaoTs);
      const key = dateToInput(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { key, label, total: 0, liqu: 0 });
      const it = map.get(key)!;
      it.total += n.valor;
      if (n.status === 'LIQU') it.liqu += n.valor;
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [filtered]);

  const serieProgramacaoComparativo = useMemo(() => {
    return serieProgramacao.map((p, idx) => {
      const prev = idx > 0 ? serieProgramacao[idx - 1] : null;
      const delta = prev ? p.total - prev.total : null;
      const pct = prev && prev.total !== 0 ? (delta! / prev.total) * 100 : null;
      return {
        ...p,
        prevLabel: prev?.label ?? null,
        prevTotal: prev?.total ?? null,
        delta,
        pct,
      };
    });
  }, [serieProgramacao]);

  const serieCompetencia = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; pend: number; liqu: number; canc: number }>();
    for (const n of filtered) {
      const key = n.competenciaKey || n.competenciaLabel || 'SEM';
      if (!map.has(key)) {
        map.set(key, { key, label: n.competenciaLabel || key, total: 0, pend: 0, liqu: 0, canc: 0 });
      }
      const it = map.get(key)!;
      it.total += n.valor;
      if (n.status === 'LIQU') it.liqu += n.valor;
      else if (n.status === 'CANC') it.canc += n.valor;
      else it.pend += n.valor;
    }
    const list = Array.from(map.values());
    const toSortable = (k: string) => {
      const m = k.match(/^(\d{4})-(\d{2})$/);
      if (m) return `${m[1]}-${m[2]}`;
      const c = parseCompetencia(k);
      if (c) return `${c.year}-${String(c.month).padStart(2, '0')}`;
      return `0000-${k}`;
    };
    list.sort((a, b) => toSortable(a.key).localeCompare(toSortable(b.key)));
    return list;
  }, [filtered]);

  const serieCompetenciaComparativo = useMemo(() => {
    return serieCompetencia.map((p, idx) => {
      const prev = idx > 0 ? serieCompetencia[idx - 1] : null;
      const delta = prev ? p.total - prev.total : null;
      const pct = prev && prev.total !== 0 ? (delta! / prev.total) * 100 : null;
      return {
        ...p,
        prevLabel: prev?.label ?? null,
        prevTotal: prev?.total ?? null,
        delta,
        pct,
      };
    });
  }, [serieCompetencia]);

  const headlineComparativo = useMemo(() => {
    if (serieCompetenciaComparativo.length < 2) return null;
    const curr = serieCompetenciaComparativo[serieCompetenciaComparativo.length - 1];
    if (!curr.prevLabel || curr.delta === null || curr.pct === null) return null;
    return curr;
  }, [serieCompetenciaComparativo]);

  const byGrupo = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; pend: number; liqu: number; canc: number; count: number }>();
    for (const n of filtered) {
      const key = n.grupoLabel || 'Sem grupo';
      if (!map.has(key)) map.set(key, { key, label: key, total: 0, pend: 0, liqu: 0, canc: 0, count: 0 });
      const it = map.get(key)!;
      it.total += n.valor;
      it.count += 1;
      if (n.status === 'LIQU') it.liqu += n.valor;
      else if (n.status === 'CANC') it.canc += n.valor;
      else it.pend += n.valor;
    }
    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return list;
  }, [filtered]);

  const byUnidade = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; pend: number; liqu: number; canc: number; count: number }>();
    for (const n of filtered) {
      const u = (n.raw.unidade ?? '').toString().trim().toUpperCase() || '—';
      if (!map.has(u)) map.set(u, { key: u, label: u, total: 0, pend: 0, liqu: 0, canc: 0, count: 0 });
      const it = map.get(u)!;
      it.total += n.valor;
      it.count += 1;
      if (n.status === 'LIQU') it.liqu += n.valor;
      else if (n.status === 'CANC') it.canc += n.valor;
      else it.pend += n.valor;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const unidadesTop3 = useMemo(() => byUnidade.slice(0, 3).map(u => u.label), [byUnidade]);

  const serieProgramacaoPorUnidade = useMemo(() => {
    const topSet = new Set(unidadesTop3);
    const map = new Map<string, Record<string, any>>();
    for (const n of filtered) {
      if (n.programacaoTs === null) continue;
      const d = new Date(n.programacaoTs);
      const key = dateToInput(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0));
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

      if (!map.has(key)) {
        const base: Record<string, any> = { key, label };
        for (const u of unidadesTop3) base[u] = 0;
        base.Demais = 0;
        map.set(key, base);
      }

      const it = map.get(key)!;
      const u = (n.raw.unidade ?? '').toString().trim().toUpperCase() || '—';
      const k = topSet.has(u) ? u : 'Demais';
      it[k] = (Number(it[k]) || 0) + n.valor;
    }
    return Array.from(map.values()).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  }, [filtered, unidadesTop3]);

  const byEvento = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; count: number }>();
    for (const n of filtered) {
      const code = String(n.raw.evento ?? '').trim();
      const label = `${code} ${String(n.raw.evento_descricao ?? '').trim()}`.trim();
      const key = label || code || '—';
      if (!map.has(key)) map.set(key, { key, label: key, total: 0, count: 0 });
      const it = map.get(key)!;
      it.total += n.valor;
      it.count += 1;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  const ageing = useMemo(() => {
    const today = new Date();
    const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0).getTime();
    const buckets = [
      { key: 'vencido', label: 'Vencido', total: 0 },
      { key: 'hoje', label: 'Vence hoje', total: 0 },
      { key: 'd7', label: '1–7 dias', total: 0 },
      { key: 'd15', label: '8–15 dias', total: 0 },
      { key: 'd30', label: '16–30 dias', total: 0 },
      { key: 'd31', label: '31+ dias', total: 0 },
      { key: 'sem', label: 'Sem venc.', total: 0 },
    ];

    for (const n of filtered) {
      if (n.status === 'LIQU') continue;
      if (n.vencimentoTs === null) {
        buckets.find(b => b.key === 'sem')!.total += n.valor;
        continue;
      }
      const diffDays = Math.floor((n.vencimentoTs - today0) / 86400000);
      if (diffDays < 0) buckets.find(b => b.key === 'vencido')!.total += n.valor;
      else if (diffDays === 0) buckets.find(b => b.key === 'hoje')!.total += n.valor;
      else if (diffDays <= 7) buckets.find(b => b.key === 'd7')!.total += n.valor;
      else if (diffDays <= 15) buckets.find(b => b.key === 'd15')!.total += n.valor;
      else if (diffDays <= 30) buckets.find(b => b.key === 'd30')!.total += n.valor;
      else buckets.find(b => b.key === 'd31')!.total += n.valor;
    }
    return buckets;
  }, [filtered]);

  const baseParaResumo = useMemo(() => {
    return normalized.filter((n) => {
      if (focusUnidade && ((n.raw.unidade ?? '').toString().trim().toUpperCase() !== focusUnidade)) return false;
      if (focusGrupoLabel && n.grupoLabel !== focusGrupoLabel) return false;
      if (focusCompetenciaKey && n.competenciaKey !== focusCompetenciaKey) return false;
      return true;
    });
  }, [normalized, focusUnidade, focusGrupoLabel, focusCompetenciaKey]);

  const donutFornecedores = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number }>();
    for (const n of baseParaResumo) {
      const name = (n.raw.fornecedor_nome ?? '').toString().trim() || '—';
      const cnpj = (n.raw.fornecedor_cnpj ?? '').toString().trim();
      const label = name;
      const key = `${name}::${cnpj}`;
      if (!map.has(key)) map.set(key, { key, label, total: 0 });
      map.get(key)!.total += n.valor;
    }
    const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const total = list.reduce((s, x) => s + x.total, 0);
    const top = list.slice(0, 5);
    const topSum = top.reduce((s, x) => s + x.total, 0);
    const outros = Math.max(0, total - topSum);
    const colors = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#a855f7'];
    const data = [
      ...top.map((x, idx) => ({
        name: x.label,
        value: x.total,
        color: colors[idx] || '#94a3b8',
      })),
      ...(outros > 0 ? [{ name: 'Outros', value: outros, color: '#94a3b8' }] : []),
    ];
    return { total, top, data };
  }, [baseParaResumo]);

  const donutEventos = useMemo(() => {
    const list = byEvento;
    const total = list.reduce((s, x) => s + x.total, 0);
    const top = list.slice(0, 5);
    const topSum = top.reduce((s, x) => s + x.total, 0);
    const outros = Math.max(0, total - topSum);
    const colors = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#a855f7'];
    const data = [
      ...top.map((x, idx) => ({
        name: x.label,
        value: x.total,
        color: colors[idx] || '#94a3b8',
      })),
      ...(outros > 0 ? [{ name: 'Outros', value: outros, color: '#94a3b8' }] : []),
    ];
    return { total, top, data };
  }, [byEvento]);

  const donutGrupos = useMemo(() => {
    const list = byGrupo.map((g) => ({ key: g.key, label: g.label, total: g.total }));
    const total = list.reduce((s, x) => s + x.total, 0);
    const top = list.slice(0, 5);
    const topSum = top.reduce((s, x) => s + x.total, 0);
    const outros = Math.max(0, total - topSum);
    const colors = ['#10b981', '#f59e0b', '#0ea5e9', '#4f46e5', '#a855f7'];
    const data = [
      ...top.map((x, idx) => ({
        name: x.label,
        value: x.total,
        color: colors[idx] || '#94a3b8',
      })),
      ...(outros > 0 ? [{ name: 'Outros', value: outros, color: '#94a3b8' }] : []),
    ];
    return { total, top, data };
  }, [byGrupo]);

  const donutUnidades = useMemo(() => {
    const list = byUnidade.map((u) => ({ key: u.key, label: u.label, total: u.total }));
    const total = list.reduce((s, x) => s + x.total, 0);
    const top = list.slice(0, 5);
    const topSum = top.reduce((s, x) => s + x.total, 0);
    const demais = Math.max(0, total - topSum);
    const colors = ['#4f46e5', '#0ea5e9', '#f59e0b', '#10b981', '#a855f7'];
    const data = [
      ...top.map((x, idx) => ({
        name: x.label,
        value: x.total,
        color: colors[idx] || '#94a3b8',
      })),
      ...(demais > 0 ? [{ name: 'Demais', value: demais, color: '#94a3b8' }] : []),
    ];
    return { total, top, data };
  }, [byUnidade]);

  const unidadeLineColors = useMemo(() => {
    const entries: Record<string, string> = {};
    if (unidadesTop3[0]) entries[unidadesTop3[0]] = '#4f46e5';
    if (unidadesTop3[1]) entries[unidadesTop3[1]] = '#0ea5e9';
    if (unidadesTop3[2]) entries[unidadesTop3[2]] = '#f59e0b';
    entries.Demais = '#94a3b8';
    return entries;
  }, [unidadesTop3]);

  const topOverdueBase = useMemo(() => {
    return filtered
      .filter(n => n.overdue)
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 25);
  }, [filtered]);

  const topOverdue = useMemo(() => {
    const cmpStr = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
    const safeTs = (t: number | null) => (t === null ? 9e15 : t);
    const eventoNum = (n: any) => {
      const v = String(n?.raw?.evento ?? '').replace(/\D+/g, '');
      const num = parseInt(v || '0', 10);
      return Number.isFinite(num) ? num : 0;
    };
    const dir = topSort.dir === 'desc' ? -1 : 1;

    const arr = topOverdueBase.slice();
    arr.sort((a: any, b: any) => {
      if (topSort.key === 'valor') return dir * ((Number(a.valor) || 0) - (Number(b.valor) || 0));
      if (topSort.key === 'venc') return dir * (safeTs(a.vencimentoTs ?? null) - safeTs(b.vencimentoTs ?? null));
      if (topSort.key === 'evento') return dir * (eventoNum(a) - eventoNum(b));
      if (topSort.key === 'unidade') return dir * cmpStr(String(a?.raw?.unidade ?? ''), String(b?.raw?.unidade ?? ''));
      if (topSort.key === 'fornecedor') return dir * cmpStr(String(a?.raw?.fornecedor_nome ?? ''), String(b?.raw?.fornecedor_nome ?? ''));
      return 0;
    });
    return arr;
  }, [topOverdueBase, topSort.dir, topSort.key]);

  const clearFilters = () => {
    const d = getDefaultFilters();
    setFilters(d);
    setTempFilters(d);
  };

  const cancelFilters = () => {
    setTempFilters(filters);
    setShowFilters(false);
  };

  const applyFilters = () => {
    const err = validarRecorte(tempFilters);
    if (err) {
      toast.error(err);
      return;
    }
    setFilters(tempFilters);
    setShowFilters(false);
    setListPage(1);
    void carregar(tempFilters);
  };

  const carregarAnoAnterior = useCallback(async (basePayload: Filters) => {
    const reqId = (anoAnteriorReqRef.current += 1);
    setLoadingAnoAnterior(true);
    try {
      const prev = shiftFiltersYears(basePayload, -1);
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/contas-pagar/get_despesas.php`,
        { method: 'POST', body: JSON.stringify({ ...prev, summary_only: true }) },
        true
      );
      if (reqId !== anoAnteriorReqRef.current) return;
      const summary = res?.summary;
      if (res?.success && summary) {
        setAnoAnterior({
          sum_total: Number(summary.sum_total) || 0,
          sum_liqu: Number(summary.sum_liqu) || 0,
          sum_canc: Number(summary.sum_canc) || 0,
          count_total: Number(summary.count_total) || 0,
        });
      } else {
        setAnoAnterior(null);
        const msg = res?.message ? String(res.message) : '';
        if (msg) toast.message(`Ano anterior: ${msg}`);
      }
    } catch {
      if (reqId !== anoAnteriorReqRef.current) return;
      setAnoAnterior(null);
      toast.message('Ano anterior: não foi possível obter o indicador.');
    } finally {
      if (reqId === anoAnteriorReqRef.current) setLoadingAnoAnterior(false);
    }
  }, []);

  const carregar = useCallback(async (override?: unknown) => {
    const isFiltersLike =
      !!override &&
      typeof override === 'object' &&
      'periodo_programacao_inicio' in (override as any) &&
      'periodo_programacao_fim' in (override as any);
    const base = (isFiltersLike ? (override as Filters) : filters) as Filters;
    const payload = { ...base };
    const err = validarRecorte(payload);
    if (err) {
      toast.error(err);
      return;
    }
    setLoading(true);
    setLastLoadMessage('');
    setAnoAnterior(null);
    setLoadingAnoAnterior(false);
    let shouldLoadAnoAnterior = false;
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/contas-pagar/get_despesas.php`,
        { method: 'POST', body: JSON.stringify(payload) },
        true
      );
      if (res?.success) {
        setRows(Array.isArray(res.rows) ? res.rows : []);
        if (res?.message) setLastLoadMessage(String(res.message));
        if (Array.isArray(res.rows) && res.rows.length === 0) {
          toast.message(res?.message ? String(res.message) : 'Nenhum registro encontrado para o recorte informado.');
        }
        shouldLoadAnoAnterior = true;
      } else {
        setRows([]);
        const msg = String(res?.message || 'Erro ao ler as despesas.');
        setLastLoadMessage(msg);
        toast.error(msg);
      }
    } catch (e: any) {
      setRows([]);
      const msg = e?.message ? String(e.message) : 'Erro ao ler as despesas.';
      setLastLoadMessage(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
      if (shouldLoadAnoAnterior) {
        const run = () => void carregarAnoAnterior(payload);
        if (typeof (window as any)?.requestIdleCallback === 'function') {
          (window as any).requestIdleCallback(run, { timeout: 1500 });
        } else {
          window.setTimeout(run, 350);
        }
      }
    }
  }, [filters, carregarAnoAnterior]);

  useEffect(() => {
    if (initialLoadRef.current) return;
    initialLoadRef.current = true;
    void carregar();
  }, [carregar]);

  const baixarCsv = useCallback(
    (filenameBase: string, header: string[], rows: Array<Array<string | number | null | undefined>>) => {
      const lines: string[] = [];
      lines.push(header.map(csvEscape).join(';'));
      for (const r of rows) lines.push(r.map(v => csvEscape(String(v ?? ''))).join(';'));

      const bom = '\uFEFF';
      const content = bom + lines.join('\r\n');
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    []
  );

  const headerCsvDespesas = useMemo(
    () => [
      'NUMLANCTO',
      'PARCELA',
      'EVENTO',
      'DESCR EVENTO',
      'CNPJ FORNECEDOR',
      'NOME FORNECEDOR',
      'VLR PARCELA',
      'INCLUSAO',
      'EMISSAO NF',
      'VENCIMENTO',
      'DATA PGTO',
      'UNI',
      'SIT DES',
      'GRUPO EVENTO',
      'MES COMPETENCIA',
      'HISTORICO',
    ],
    []
  );

  const exportarCsv = useCallback(() => {
    const rowsCsv = filtered.map((n) => {
      const r = n.raw;
      return [
        String(r.nro_lancto ?? ''),
        String(r.parcela ?? ''),
        String(r.evento ?? ''),
        String(r.evento_descricao ?? ''),
        String(r.fornecedor_cnpj ?? ''),
        String(r.fornecedor_nome ?? ''),
        String(r.vlr_parcela ?? ''),
        String(r.data_inclusao ?? ''),
        String(r.data_emissao_nf ?? ''),
        String(r.data_vencimento ?? ''),
        String(r.data_programacao_pgto ?? ''),
        String(r.unidade ?? ''),
        String(r.sit_des ?? ''),
        String(r.grupo_evento ?? ''),
        String(r.mes_competencia ?? ''),
        String(r.historico ?? ''),
      ];
    });
    baixarCsv('contas_pagar', headerCsvDespesas, rowsCsv);
  }, [baixarCsv, filtered, headerCsvDespesas]);

  const exportarCsvLista = useCallback(
    (filenameBase: string, items: any[]) => {
      const rowsCsv = items.map((n) => {
        const r: RowDespesa = n.raw;
        return [
          String(r.nro_lancto ?? ''),
          String(r.parcela ?? ''),
          String(r.evento ?? ''),
          String(r.evento_descricao ?? ''),
          String(r.fornecedor_cnpj ?? ''),
          String(r.fornecedor_nome ?? ''),
          String(r.vlr_parcela ?? ''),
          String(r.data_inclusao ?? ''),
          String(r.data_emissao_nf ?? ''),
          String(r.data_vencimento ?? ''),
          String(r.data_programacao_pgto ?? ''),
          String(r.unidade ?? ''),
          String(r.sit_des ?? ''),
          String(r.grupo_evento ?? ''),
          String(r.mes_competencia ?? ''),
          String(r.historico ?? ''),
        ];
      });
      baixarCsv(filenameBase, headerCsvDespesas, rowsCsv);
    },
    [baixarCsv, headerCsvDespesas]
  );

  const exportarCsvLinha = useCallback(
    (r: RowDespesa) => {
      const row = [
        String(r.nro_lancto ?? ''),
        String(r.parcela ?? ''),
        String(r.evento ?? ''),
        String(r.evento_descricao ?? ''),
        String(r.fornecedor_cnpj ?? ''),
        String(r.fornecedor_nome ?? ''),
        String(r.vlr_parcela ?? ''),
        String(r.data_inclusao ?? ''),
        String(r.data_emissao_nf ?? ''),
        String(r.data_vencimento ?? ''),
        String(r.data_programacao_pgto ?? ''),
        String(r.unidade ?? ''),
        String(r.sit_des ?? ''),
        String(r.grupo_evento ?? ''),
        String(r.mes_competencia ?? ''),
        String(r.historico ?? ''),
      ];
      baixarCsv('contas_pagar_linha', headerCsvDespesas, [row]);
    },
    [baixarCsv, headerCsvDespesas]
  );

  const exportarSerieProgramacao = useCallback(
    (serieKey: 'total' | 'liqu') => {
      const labelCol = serieKey === 'total' ? 'TOTAL' : 'LIQUIDADAS';
      const rowsCsv = serieProgramacaoComparativo.map((p) => {
        const dateLabel = `${p.key.slice(8, 10)}/${p.key.slice(5, 7)}/${p.key.slice(0, 4)}`;
        return [dateLabel, Number((p as any)[serieKey]) || 0];
      });
      baixarCsv(`evolucao_programacao_${labelCol.toLowerCase()}`, ['DATA', labelCol], rowsCsv);
    },
    [baixarCsv, serieProgramacaoComparativo]
  );

  const exportarSerieProgramacaoCompleta = useCallback(() => {
    const rowsCsv = serieProgramacaoComparativo.map((p) => {
      const dateLabel = `${p.key.slice(8, 10)}/${p.key.slice(5, 7)}/${p.key.slice(0, 4)}`;
      return [dateLabel, Number(p.total) || 0, Number(p.liqu) || 0];
    });
    baixarCsv('evolucao_programacao', ['DATA', 'TOTAL', 'LIQUIDADAS'], rowsCsv);
  }, [baixarCsv, serieProgramacaoComparativo]);

  const exportarSerieProgramacaoUnidade = useCallback(
    (unidadeKey: string) => {
      const rowsCsv = serieProgramacaoPorUnidade.map((p: any) => {
        const dateLabel = `${String(p.key).slice(8, 10)}/${String(p.key).slice(5, 7)}/${String(p.key).slice(0, 4)}`;
        return [dateLabel, Number(p[unidadeKey]) || 0];
      });
      baixarCsv(`evolucao_unidade_${unidadeKey.toLowerCase()}`, ['DATA', 'TOTAL'], rowsCsv);
    },
    [baixarCsv, serieProgramacaoPorUnidade]
  );

  const exportarSerieProgramacaoUnidades = useCallback(() => {
    const keys = [...unidadesTop3, ...(byUnidade.length > 3 ? ['Demais'] : [])];
    const header = ['DATA', ...keys.map(k => String(k).toUpperCase())];
    const rowsCsv = serieProgramacaoPorUnidade.map((p: any) => {
      const dateLabel = `${String(p.key).slice(8, 10)}/${String(p.key).slice(5, 7)}/${String(p.key).slice(0, 4)}`;
      return [dateLabel, ...keys.map(k => Number(p[k]) || 0)];
    });
    baixarCsv('evolucao_unidades', header, rowsCsv);
  }, [baixarCsv, byUnidade.length, serieProgramacaoPorUnidade, unidadesTop3]);

  const exportarSlice = useCallback(
    (filenameBase: string, item: string, value: number, total: number) => {
      const pct = total > 0 ? (value / total) * 100 : 0;
      baixarCsv(filenameBase, ['ITEM', 'VALOR', '%'], [[item, value, pct.toFixed(2)]]);
    },
    [baixarCsv]
  );

  const exportarBucket = useCallback(
    (filenameBase: string, item: string, value: number) => {
      baixarCsv(filenameBase, ['ITEM', 'VALOR'], [[item, value]]);
    },
    [baixarCsv]
  );

  const ProgramacaoTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const d = payload[0]?.payload;
    const delta = typeof d?.delta === 'number' ? d.delta : null;
    const pct = typeof d?.pct === 'number' ? d.pct : null;
    const prevLabel = d?.prevLabel ?? null;
    const deltaClass = delta === null ? '' : delta > 0 ? 'text-rose-600' : delta < 0 ? 'text-emerald-600' : 'text-slate-600';
    return (
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{label}</div>
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
          Total: <span className="font-mono">{formatCurrency(Number(d?.total) || 0)}</span>
        </div>
        <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
          Liquidadas: <span className="font-mono">{formatCurrency(Number(d?.liqu) || 0)}</span>
        </div>
        {delta !== null && pct !== null && prevLabel && (
          <div className={`mt-0.5 text-xs ${deltaClass}`}>
            Δ vs {prevLabel}: <span className="font-mono">{formatCurrency(delta)}</span> ({pct.toFixed(1)}%)
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout
      title="BI · Contas a Pagar"
      description={user?.client_name}
      headerActions={
        <div className="flex items-center gap-2 md:gap-3">
          <Dialog open={showFilters} onOpenChange={setShowFilters}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="relative dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
                    >
                      <Filter className="w-4 h-4" />
                      {hasFiltrosAtivos && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-600" />
                      )}
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Filtros</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DialogContent className="sm:max-w-[760px] bg-white dark:bg-slate-900 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  Padrão: Programação (Pagamento) = mês fechado. Informe ao menos 1 período (emissão, inclusão, programação ou vencimento).
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FornecedorSearchInput
                        value={tempFilters.seq_fornecedor}
                        onChange={(v) => setTempFilters({ ...tempFilters, seq_fornecedor: v })}
                        displayMode="nameOnly"
                      />
                    </div>
                    <div className="space-y-2">
                      <FilterSelectUnidadeSingle
                        value={tempFilters.unidade}
                        onChange={(v) => setTempFilters({ ...tempFilters, unidade: v })}
                        label="Unidade (UNI)"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-slate-900 dark:text-slate-100">Grupo de Evento</Label>
                      <Select
                        value={tempFilters.grupo_evento || undefined}
                        onValueChange={(v) => setTempFilters({ ...tempFilters, grupo_evento: v || '', evento: '' })}
                      >
                        <SelectTrigger className="h-9 dark:bg-slate-800 dark:border-slate-700">
                          <div className="flex-1 min-w-0">
                            <SelectValue placeholder={loadingGrupos ? 'Carregando...' : 'Selecione um grupo'} />
                          </div>
                          {tempFilters.grupo_evento && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setTempFilters({ ...tempFilters, grupo_evento: '' });
                              }}
                              className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {grupos.map((g) => (
                            <SelectItem key={g.grupo} value={String(g.grupo)}>
                              {String(g.grupo).padStart(2, '0')} - {g.descricao}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <EventoSearchInput
                        value={tempFilters.evento}
                        onChange={(v) => setTempFilters({ ...tempFilters, evento: v, grupo_evento: '' })}
                        label="Evento"
                        displayMode="singleLine"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Emissão da NF</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodo_emissao_inicio}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodo_emissao_inicio: e.target.value })}
                            className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          {tempFilters.periodo_emissao_inicio && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({ ...tempFilters, periodo_emissao_inicio: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodo_emissao_fim}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodo_emissao_fim: e.target.value })}
                            className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          {tempFilters.periodo_emissao_fim && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({ ...tempFilters, periodo_emissao_fim: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Inclusão</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodo_inclusao_inicio}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodo_inclusao_inicio: e.target.value })}
                            className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          {tempFilters.periodo_inclusao_inicio && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({ ...tempFilters, periodo_inclusao_inicio: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodo_inclusao_fim}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodo_inclusao_fim: e.target.value })}
                            className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          {tempFilters.periodo_inclusao_fim && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({ ...tempFilters, periodo_inclusao_fim: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Programação (Pagamento)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodo_programacao_inicio}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodo_programacao_inicio: e.target.value })}
                            className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          {tempFilters.periodo_programacao_inicio && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({ ...tempFilters, periodo_programacao_inicio: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodo_programacao_fim}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodo_programacao_fim: e.target.value })}
                            className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          {tempFilters.periodo_programacao_fim && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({ ...tempFilters, periodo_programacao_fim: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Vencimento</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodo_vencimento_inicio}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodo_vencimento_inicio: e.target.value })}
                            className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          {tempFilters.periodo_vencimento_inicio && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({ ...tempFilters, periodo_vencimento_inicio: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <div className="relative">
                          <Input
                            type="date"
                            value={tempFilters.periodo_vencimento_fim}
                            onChange={(e) => setTempFilters({ ...tempFilters, periodo_vencimento_fim: e.target.value })}
                            className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                          />
                          {tempFilters.periodo_vencimento_fim && (
                            <button
                              type="button"
                              onClick={() => setTempFilters({ ...tempFilters, periodo_vencimento_fim: '' })}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-slate-100">Mês de Competência</Label>
                    <div className="relative">
                      <Input
                        type="month"
                        value={tempFilters.competencia_ym}
                        onChange={(e) => setTempFilters({ ...tempFilters, competencia_ym: e.target.value })}
                        className="pr-9 dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                      />
                      {tempFilters.competencia_ym && (
                        <button
                          type="button"
                          onClick={() => setTempFilters({ ...tempFilters, competencia_ym: '' })}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {tempFilters.competencia_ym && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Param (mes_comp): {ymToMesCompParam(tempFilters.competencia_ym)} • CSV: {ymToCompetenciaLabel(tempFilters.competencia_ym)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                  variant="outline"
                  onClick={clearFilters}
                  className="dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <XCircle className="w-4 h-4 mr-2" />
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
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Aplicar Filtros
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={() => { void carregar(); }}
            disabled={loading}
            className="dark:border-slate-600"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-1.5">Atualizar</span>
          </Button>
        </div>
      }
    >
      <div className="relative">
        {loading && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/25 backdrop-blur-sm">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Carregando dados...</div>
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Lendo despesas conforme o recorte informado.
              </div>
            </div>
          </div>
        )}

        <div className={loading ? 'space-y-4 blur-[1px] opacity-70 pointer-events-none select-none' : 'space-y-4'}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="w-full md:w-auto h-11 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <TabsTrigger
                value="visao"
                className="h-9 px-4 text-sm font-semibold data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-indigo-400/40"
              >
                Visão Geral
              </TabsTrigger>
              <TabsTrigger
                value="lista"
                className="h-9 px-4 text-sm font-semibold data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md data-[state=active]:ring-2 data-[state=active]:ring-indigo-400/40"
              >
                Lista
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setQuickStatus('ALL'); setQuickOnlyOverdue(false); }}
              className={
                quickStatus === 'ALL' && !quickOnlyOverdue
                  ? 'h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'
                  : 'h-10 px-4 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-950/30'
              }
            >
              Tudo
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setQuickStatus('PEND'); setQuickOnlyOverdue(false); }}
              className={
                quickStatus === 'PEND' && !quickOnlyOverdue
                  ? 'h-10 px-4 bg-amber-500 hover:bg-amber-600 text-white border-amber-500'
                  : 'h-10 px-4 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30'
              }
            >
              Pendentes
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setQuickStatus('LIQU'); setQuickOnlyOverdue(false); }}
              className={
                quickStatus === 'LIQU' && !quickOnlyOverdue
                  ? 'h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                  : 'h-10 px-4 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/30'
              }
            >
              Liquidadas
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setQuickStatus('ALL'); setQuickOnlyOverdue(true); }}
              className={
                quickOnlyOverdue
                  ? 'h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
                  : 'h-10 px-4 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/30'
              }
            >
              Em Atraso
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card
            className="bg-indigo-50 border-indigo-200 dark:bg-indigo-950/40 dark:border-indigo-900 cursor-pointer"
            onClick={() => exportarCsvLista('base', filtered)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Base</div>
                <ClipboardList className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{totals.rows}</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">Registros no recorte</div>
            </CardContent>
          </Card>

          <Card
            className="bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-900 cursor-pointer"
            onClick={() => exportarCsvLista('total', filtered)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-sky-700 dark:text-sky-300">Total</div>
                <div className="flex items-center gap-2">
                  {loadingAnoAnterior && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  <Wallet className="w-4 h-4 text-sky-500 dark:text-sky-400" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totals.total)}</div>
              <div className="text-[11px] text-slate-600 dark:text-slate-400">
                Pagto: {filters.periodo_programacao_inicio || '—'} → {filters.periodo_programacao_fim || '—'}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                {loadingAnoAnterior ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    <span>Carregando ano anterior...</span>
                  </>
                ) : comparativoAnoAnterior ? (
                  <>
                    {comparativoAnoAnterior.pct !== null && comparativoAnoAnterior.pct > 0 ? (
                      <ArrowUp className="w-3.5 h-3.5 text-rose-600" />
                    ) : comparativoAnoAnterior.pct !== null && comparativoAnoAnterior.pct < 0 ? (
                      <ArrowDown className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUp className="w-3.5 h-3.5 text-slate-400 rotate-90" />
                    )}
                    <span>
                      Ano anterior: {formatCurrency(comparativoAnoAnterior.prev)}
                      {comparativoAnoAnterior.pct === null
                        ? ''
                        : ` (${comparativoAnoAnterior.pct >= 0 ? '+ ' : '- '}${Math.abs(comparativoAnoAnterior.pct).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)`}
                    </span>
                  </>
                ) : (
                  <span>Ano anterior: —</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-amber-50 border-amber-200 dark:bg-amber-950/35 dark:border-amber-900 cursor-pointer"
            onClick={() => exportarCsvLista('pendentes', filtered.filter((n: any) => n.status !== 'LIQU' && n.status !== 'CANC'))}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-amber-800 dark:text-amber-300">Pendentes</div>
                <Clock className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totals.pend)}</div>
            </CardContent>
          </Card>

          <Card
            className="bg-rose-50 border-rose-200 dark:bg-rose-950/35 dark:border-rose-900 cursor-pointer"
            onClick={() => exportarCsvLista('em_atraso', filtered.filter((n: any) => n.overdue))}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-rose-700 dark:text-rose-300">Em atraso</div>
                <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(totals.overdue)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="py-3">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Download className="w-4 h-4 text-slate-500" />
              <span>Clique em cards e gráficos para exportar os dados em CSV.</span>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsContent value="visao">
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <Card className="lg:col-span-8">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-3">
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={exportarSerieProgramacaoCompleta}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') exportarSerieProgramacaoCompleta(); }}
                        className="cursor-pointer"
                        title="Exportar CSV"
                      >
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Evolução por Programação</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Total por data de pagamento (programação)</div>
                      </div>
                    </div>

                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={serieProgramacaoComparativo}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                          style={{ cursor: 'pointer' }}
                          onClick={(e: any) => {
                            const dk = e?.activePayload?.[0]?.dataKey ? String(e.activePayload[0].dataKey) : '';
                            if (dk === 'total' || dk === 'liqu') exportarSerieProgramacao(dk as any);
                            else exportarSerieProgramacaoCompleta();
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={70} />
                          <RechartsTooltip content={<ProgramacaoTooltip />} />
                          <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="liqu" stroke="#10b981" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-[2px] bg-indigo-600" />
                        Total
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-[2px] bg-emerald-500" />
                        Liquidadas
                      </div>
                    </div>

                    <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                      <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <div className="col-span-3">Data</div>
                        <div className="col-span-3 text-right">Total</div>
                        <div className="col-span-3 text-right">Liquidadas</div>
                        <div className="col-span-3 text-right">%</div>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {serieProgramacaoComparativo
                          .slice(-10)
                          .slice()
                          .reverse()
                          .map((p) => {
                            const pctLiqu = p.total > 0 ? (p.liqu / p.total) * 100 : 0;
                            const pctClass =
                              pctLiqu <= 40 ? 'text-rose-600 dark:text-rose-400' :
                              pctLiqu <= 60 ? 'text-orange-600 dark:text-orange-400' :
                              pctLiqu <= 80 ? 'text-amber-600 dark:text-amber-400' :
                              'text-emerald-600 dark:text-emerald-400';
                            const dateLabel = `${p.key.slice(8, 10)}/${p.key.slice(5, 7)}/${p.key.slice(0, 4)}`;
                            return (
                              <div
                                key={p.key}
                                className="grid grid-cols-12 px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200"
                              >
                                <div className="col-span-3 font-mono">{dateLabel}</div>
                                <div className="col-span-3 text-right font-mono">{formatCurrency(p.total)}</div>
                                <div className="col-span-3 text-right font-mono">{formatCurrency(p.liqu)}</div>
                                <div className={`col-span-3 text-right font-mono ${pctClass}`}>{pctLiqu.toFixed(1)}%</div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </CardContent>
                </Card>

              <div className="lg:col-span-4 space-y-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Status</div>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'PEND', value: totals.pend },
                              { name: 'LIQU', value: totals.liqu },
                              { name: 'CANC', value: totals.canc },
                            ].filter(x => x.value > 0)}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="55%"
                            outerRadius="80%"
                            stroke="none"
                            style={{ cursor: 'pointer' }}
                            onClick={(d: any) => {
                              const p = d?.payload ?? d;
                              exportarSlice('status', String(p?.name ?? ''), Number(p?.value) || 0, totals.pend + totals.liqu + totals.canc);
                            }}
                          >
                            <Cell fill="#f59e0b" />
                            <Cell fill="#10b981" />
                            <Cell fill="#94a3b8" />
                          </Pie>
                          <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), String(name)]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 flex flex-col items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" />Pendentes</div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />Liquidadas</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Principais Fornecedores</div>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={donutFornecedores.data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius="55%"
                            outerRadius="80%"
                            stroke="none"
                            style={{ cursor: 'pointer' }}
                            onClick={(d: any) => {
                              const p = d?.payload ?? d;
                              exportarSlice('fornecedores', String(p?.name ?? ''), Number(p?.value) || 0, donutFornecedores.total);
                            }}
                          >
                            {donutFornecedores.data.map((d, idx) => (
                              <Cell key={`${d.name}-${idx}`} fill={(d as any).color} />
                            ))}
                          </Pie>
                          <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), String(name)]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                      {donutFornecedores.top.map((x, idx) => {
                        const pct = donutFornecedores.total > 0 ? (x.total / donutFornecedores.total) * 100 : 0;
                        const colors = ['bg-indigo-600', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500'];
                        const color = colors[idx] || 'bg-slate-400';
                        return (
                          <div key={x.key} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`w-2 h-2 rounded-full ${color}`} />
                              <span className="truncate">{x.label}</span>
                            </div>
                            <span className="font-mono whitespace-nowrap">{pct.toFixed(1)}%</span>
                          </div>
                        );
                      })}
                      {donutFornecedores.data.some(d => d.name === 'Outros') && (
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-slate-400" />
                            <span className="truncate">Outros</span>
                          </div>
                          <span className="font-mono whitespace-nowrap">
                            {donutFornecedores.total > 0
                              ? ((donutFornecedores.data.find(d => d.name === 'Outros')!.value / donutFornecedores.total) * 100).toFixed(1)
                              : '0.0'}%
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Envelhecimento (pendentes)</div>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ageing} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }} style={{ cursor: 'pointer' }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
                          <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                          <Bar
                            dataKey="total"
                            fill="#f59e0b"
                            radius={[6, 6, 6, 6]}
                            style={{ cursor: 'pointer' }}
                            onClick={(d: any) => {
                              const p = d?.payload ?? d;
                              exportarBucket('envelhecimento_pendentes', String(p?.label ?? ''), Number(p?.total) || 0);
                            }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card className="lg:col-span-8">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={exportarSerieProgramacaoUnidades}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') exportarSerieProgramacaoUnidades(); }}
                      className="cursor-pointer"
                      title="Exportar CSV"
                    >
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Evolução por Unidade</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Total por data de pagamento (Top 3 + Demais)</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-slate-600 dark:text-slate-300">Linhas</Label>
                      <Switch checked={unidadeEmLinhas} onCheckedChange={(v) => setUnidadeEmLinhas(Boolean(v))} />
                    </div>
                  </div>

                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      {unidadeEmLinhas ? (
                        <LineChart
                          data={serieProgramacaoPorUnidade}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                          style={{ cursor: 'pointer' }}
                          onClick={(e: any) => {
                            const dk = e?.activePayload?.[0]?.dataKey ? String(e.activePayload[0].dataKey) : '';
                            if (dk && dk !== 'key' && dk !== 'label') exportarSerieProgramacaoUnidade(dk);
                            else exportarSerieProgramacaoUnidades();
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={70} />
                          <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), String(name)]} />
                          {unidadesTop3.map((u) => (
                            <Line
                              key={u}
                              type="monotone"
                              dataKey={u}
                              stroke={unidadeLineColors[u] || '#4f46e5'}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))}
                          {byUnidade.length > 3 && (
                            <Line
                              type="monotone"
                              dataKey="Demais"
                              stroke={unidadeLineColors.Demais}
                              strokeWidth={2}
                              dot={false}
                            />
                          )}
                        </LineChart>
                      ) : (
                        <AreaChart
                          data={serieProgramacaoPorUnidade}
                          margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                          style={{ cursor: 'pointer' }}
                          onClick={(e: any) => {
                            const dk = e?.activePayload?.[0]?.dataKey ? String(e.activePayload[0].dataKey) : '';
                            if (dk && dk !== 'key' && dk !== 'label') exportarSerieProgramacaoUnidade(dk);
                            else exportarSerieProgramacaoUnidades();
                          }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} width={70} />
                          <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), String(name)]} />
                          {unidadesTop3.map((u) => (
                            <Area
                              key={u}
                              type="monotone"
                              dataKey={u}
                              stackId="1"
                              stroke="none"
                              fill={unidadeLineColors[u] || '#4f46e5'}
                              fillOpacity={0.62}
                              strokeWidth={0}
                            />
                          ))}
                          {byUnidade.length > 3 && (
                            <Area
                              type="monotone"
                              dataKey="Demais"
                              stackId="1"
                              stroke="none"
                              fill={unidadeLineColors.Demais}
                              fillOpacity={0.28}
                              strokeWidth={0}
                            />
                          )}
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300">
                    {unidadesTop3.map((u) => (
                      <div key={`leg-${u}`} className="flex items-center gap-2">
                        <span className="w-3 h-[2px]" style={{ background: unidadeLineColors[u] || '#4f46e5' }} />
                        {u}
                      </div>
                    ))}
                    {byUnidade.length > 3 && (
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-[2px] bg-slate-400" />
                        Demais
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-4">
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Unidades</div>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutUnidades.data}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="55%"
                          outerRadius="80%"
                          stroke="none"
                          style={{ cursor: 'pointer' }}
                          onClick={(d: any) => {
                            const p = d?.payload ?? d;
                            exportarSlice('unidades', String(p?.name ?? ''), Number(p?.value) || 0, donutUnidades.total);
                          }}
                        >
                          {donutUnidades.data.map((d, idx) => (
                            <Cell key={`${d.name}-${idx}`} fill={(d as any).color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), String(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {donutUnidades.top.map((x, idx) => {
                      const pct = donutUnidades.total > 0 ? (x.total / donutUnidades.total) * 100 : 0;
                      const colors = ['bg-indigo-600', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500'];
                      const color = colors[idx] || 'bg-slate-400';
                      return (
                        <div key={x.key} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full ${color}`} />
                            <span className="truncate">{x.label}</span>
                          </div>
                          <span className="font-mono whitespace-nowrap">{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                    {donutUnidades.data.some(d => d.name === 'Demais') && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span className="truncate">Demais</span>
                        </div>
                        <span className="font-mono whitespace-nowrap">
                          {donutUnidades.total > 0
                            ? ((donutUnidades.data.find(d => d.name === 'Demais')!.value / donutUnidades.total) * 100).toFixed(1)
                            : '0.0'}%
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Eventos</div>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutEventos.data}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="55%"
                          outerRadius="80%"
                          stroke="none"
                          style={{ cursor: 'pointer' }}
                          onClick={(d: any) => {
                            const p = d?.payload ?? d;
                            exportarSlice('eventos', String(p?.name ?? ''), Number(p?.value) || 0, donutEventos.total);
                          }}
                        >
                          {donutEventos.data.map((d, idx) => (
                            <Cell key={`${d.name}-${idx}`} fill={(d as any).color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), String(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {donutEventos.top.map((x, idx) => {
                      const pct = donutEventos.total > 0 ? (x.total / donutEventos.total) * 100 : 0;
                      const colors = ['bg-indigo-600', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-purple-500'];
                      const color = colors[idx] || 'bg-slate-400';
                      return (
                        <div key={x.key} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full ${color}`} />
                            <span className="truncate">{x.label}</span>
                          </div>
                          <span className="font-mono whitespace-nowrap">{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                    {donutEventos.data.some(d => d.name === 'Outros') && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span className="truncate">Outros</span>
                        </div>
                        <span className="font-mono whitespace-nowrap">
                          {donutEventos.total > 0
                            ? ((donutEventos.data.find(d => d.name === 'Outros')!.value / donutEventos.total) * 100).toFixed(1)
                            : '0.0'}%
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Grupos de eventos</div>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutGrupos.data}
                          dataKey="value"
                          nameKey="name"
                          innerRadius="55%"
                          outerRadius="80%"
                          stroke="none"
                          style={{ cursor: 'pointer' }}
                          onClick={(d: any) => {
                            const p = d?.payload ?? d;
                            exportarSlice('grupos_eventos', String(p?.name ?? ''), Number(p?.value) || 0, donutGrupos.total);
                          }}
                        >
                          {donutGrupos.data.map((d, idx) => (
                            <Cell key={`${d.name}-${idx}`} fill={(d as any).color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(v: any, name: any) => [formatCurrency(Number(v) || 0), String(name)]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {donutGrupos.top.map((x, idx) => {
                      const pct = donutGrupos.total > 0 ? (x.total / donutGrupos.total) * 100 : 0;
                      const colors = ['bg-emerald-500', 'bg-amber-500', 'bg-sky-500', 'bg-indigo-600', 'bg-purple-500'];
                      const color = colors[idx] || 'bg-slate-400';
                      return (
                        <div key={x.key} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full ${color}`} />
                            <span className="truncate">{x.label}</span>
                          </div>
                          <span className="font-mono whitespace-nowrap">{pct.toFixed(1)}%</span>
                        </div>
                      );
                    })}
                    {donutGrupos.data.some(d => d.name === 'Outros') && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-slate-400" />
                          <span className="truncate">Outros</span>
                        </div>
                        <span className="font-mono whitespace-nowrap">
                          {donutGrupos.total > 0
                            ? ((donutGrupos.data.find(d => d.name === 'Outros')!.value / donutGrupos.total) * 100).toFixed(1)
                            : '0.0'}%
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top vencidas</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Maiores valores em atraso (recorte atual)</div>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <div className="col-span-2">Lançamento</div>
                    <div className="col-span-1">Unid</div>
                    <div className="col-span-1">Evento</div>
                    <div className="col-span-3">Fornecedor</div>
                    <button
                      type="button"
                      className="col-span-2 w-full text-right pr-4 hover:text-slate-900 dark:hover:text-slate-100"
                      onClick={() => setTopSort((s) => (s.key === 'valor' ? { key: 'valor', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'valor', dir: 'desc' }))}
                    >
                      Valor{topSort.key === 'valor' ? (topSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                    <button
                      type="button"
                      className="col-span-1 w-full text-left pr-2 hover:text-slate-900 dark:hover:text-slate-100"
                      onClick={() => setTopSort((s) => (s.key === 'venc' ? { key: 'venc', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'venc', dir: 'asc' }))}
                    >
                      Venc.{topSort.key === 'venc' ? (topSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </button>
                    <div className="col-span-1 pl-2">Pgto</div>
                    <div className="col-span-1 text-right">Sit</div>
                  </div>

                  {topOverdue.length === 0 ? (
                    <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Sem vencidas no recorte atual.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {topOverdue.map((n) => {
                        const r = n.raw;
                        const lanc = `${String(r.nro_lancto ?? 0).padStart(6, '0')}-${String(r.parcela ?? '')}`;
                        const sitColor = r.sit_des === 'LIQU' ? 'bg-emerald-600' : r.sit_des === 'CANC' ? 'bg-slate-400' : 'bg-rose-600';
                        return (
                          <button
                            key={`${r.nro_lancto}-${r.parcela}-${r.evento}-topv`}
                            onClick={() => setSelectedDespesa(r)}
                            className="w-full grid grid-cols-12 px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <div className="col-span-2 font-mono">{lanc}</div>
                            <div className="col-span-1 font-mono">{r.unidade || '-'}</div>
                            <div className="col-span-1 font-mono">{r.evento || '-'}</div>
                            <div className="col-span-3 min-w-0">
                              <div className="font-medium truncate">{r.fornecedor_nome || '-'}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {r.fornecedor_cnpj || '—'}
                              </div>
                            </div>
                            <div className="col-span-2 text-right font-mono pr-4">{formatCurrency(n.valor)}</div>
                            <div className="col-span-1 font-mono pr-2 text-amber-700 dark:text-amber-400">{r.data_vencimento || '-'}</div>
                            <div className="col-span-1 font-mono pl-2">{r.data_programacao_pgto || '-'}</div>
                            <div className="col-span-1 flex justify-end">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${sitColor}`} />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          <TabsContent value="lista">
            <div className="space-y-3">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <Label className="text-slate-900 dark:text-slate-100">Busca rápida</Label>
                      <Input
                        value={tableSearch}
                        onChange={(e) => setTableSearch(e.target.value)}
                        placeholder="Lançamento, evento, fornecedor, CNPJ, histórico, unidade..."
                        className="mt-2 dark:bg-slate-800 dark:border-slate-700"
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <div className="flex items-end gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={exportarCsv}
                          disabled={filtered.length === 0}
                          className="h-9 dark:border-slate-600"
                        >
                          <Download className="w-4 h-4" />
                          <span className="ml-1.5">CSV</span>
                        </Button>
                        <div className="text-right">
                          <div className="text-xs text-slate-500 dark:text-slate-400">Total filtrado</div>
                          <div className="text-xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totals.total)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {(focusUnidade || focusGrupoLabel || focusCompetenciaKey) && (
                <Card>
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mr-1">Foco:</div>
                      {focusUnidade && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFocusUnidade('')}
                          className="h-7 px-2 text-xs dark:border-slate-700"
                        >
                          UNI {focusUnidade}
                          <X className="w-3.5 h-3.5 ml-2" />
                        </Button>
                      )}
                      {focusGrupoLabel && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFocusGrupoLabel('')}
                          className="h-7 px-2 text-xs dark:border-slate-700"
                        >
                          {focusGrupoLabel}
                          <X className="w-3.5 h-3.5 ml-2" />
                        </Button>
                      )}
                      {focusCompetenciaKey && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setFocusCompetenciaKey('')}
                          className="h-7 px-2 text-xs dark:border-slate-700"
                        >
                          {focusCompetenciaKey}
                          <X className="w-3.5 h-3.5 ml-2" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setFocusUnidade(''); setFocusGrupoLabel(''); setFocusCompetenciaKey(''); }}
                        className="h-7 px-2 text-xs dark:border-slate-700"
                      >
                        Limpar tudo
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {listaOrdenada.length > 0 && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {listaOrdenada.length} registro{listaOrdenada.length !== 1 ? 's' : ''} · {PAGE_SIZE} por página
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700"
                      onClick={() => setListSort({ key: 'prioridade', dir: 'asc' })}
                      disabled={listSort.key === 'prioridade'}
                    >
                      Padrão
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700"
                      onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      disabled={listPageSafe <= 1}
                    >
                      Anterior
                    </Button>
                    <div className="text-xs text-slate-600 dark:text-slate-300">
                      Página <span className="font-mono">{listPageSafe}</span> de <span className="font-mono">{listPageCount}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700"
                      onClick={() => setListPage((p) => Math.min(listPageCount, p + 1))}
                      disabled={listPageSafe >= listPageCount}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <button
                    type="button"
                    className="col-span-2 w-full text-left hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => setListSort((s) => (s.key === 'lancto' ? { key: 'lancto', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'lancto', dir: 'asc' }))}
                  >
                    Lançamento{listSort.key === 'lancto' ? (listSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <button
                    type="button"
                    className="col-span-1 w-full text-left hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => setListSort((s) => (s.key === 'unidade' ? { key: 'unidade', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'unidade', dir: 'asc' }))}
                  >
                    Unid{listSort.key === 'unidade' ? (listSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <button
                    type="button"
                    className="col-span-1 w-full text-left hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => setListSort((s) => (s.key === 'evento' ? { key: 'evento', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'evento', dir: 'asc' }))}
                  >
                    Evento{listSort.key === 'evento' ? (listSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <button
                    type="button"
                    className="col-span-3 w-full text-left hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => setListSort((s) => (s.key === 'fornecedor' ? { key: 'fornecedor', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'fornecedor', dir: 'asc' }))}
                  >
                    Fornecedor{listSort.key === 'fornecedor' ? (listSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <button
                    type="button"
                    className="col-span-2 w-full text-right pr-4 hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => setListSort((s) => (s.key === 'valor' ? { key: 'valor', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'valor', dir: 'desc' }))}
                  >
                    Valor{listSort.key === 'valor' ? (listSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <button
                    type="button"
                    className="col-span-1 w-full text-left pl-3 pr-2 hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => setListSort((s) => (s.key === 'venc' ? { key: 'venc', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'venc', dir: 'asc' }))}
                  >
                    Venc.{listSort.key === 'venc' ? (listSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <button
                    type="button"
                    className="col-span-1 w-full text-left pl-4 hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => setListSort((s) => (s.key === 'pgto' ? { key: 'pgto', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'pgto', dir: 'asc' }))}
                  >
                    Pgto{listSort.key === 'pgto' ? (listSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                  <button
                    type="button"
                    className="col-span-1 w-full text-right hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => setListSort((s) => (s.key === 'sit' ? { key: 'sit', dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: 'sit', dir: 'asc' }))}
                  >
                    Sit{listSort.key === 'sit' ? (listSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </button>
                </div>

                {rows.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    {loading ? 'Carregando...' : 'Nenhum registro para os filtros informados.'}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum registro para os filtros rápidos.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {listaPaginada.map((n) => {
                        const r = n.raw;
                        const key = `${r.nro_lancto}-${r.parcela}-${r.evento}-${r.fornecedor_cnpj}`;
                        const rowBg =
                          r.sit_des === 'LIQU'
                            ? 'bg-emerald-50/80 dark:bg-emerald-950/25'
                            : r.sit_des === 'CANC'
                              ? 'bg-slate-50/80 dark:bg-slate-900/25'
                              : n.overdue7
                                ? 'bg-rose-50/80 dark:bg-rose-950/25'
                                : 'bg-amber-50/80 dark:bg-amber-950/25';
                        const lanc = `${String(r.nro_lancto ?? 0).padStart(6, '0')}-${String(r.parcela ?? '')}`;
                        const sitColor = r.sit_des === 'LIQU' ? 'bg-emerald-600' : r.sit_des === 'CANC' ? 'bg-slate-400' : 'bg-rose-600';
                        return (
                          <button
                            type="button"
                            key={key}
                            onClick={() => setSelectedDespesa(r)}
                            className={`w-full grid grid-cols-12 px-4 py-2 text-left text-xs text-slate-700 dark:text-slate-200 hover:opacity-90 ${rowBg}`}
                            title="Detalhes"
                          >
                            <div className="col-span-2 font-mono">{lanc}</div>
                            <div className="col-span-1 font-mono">{r.unidade || '-'}</div>
                            <div className="col-span-1 font-mono">{r.evento}</div>
                            <div className="col-span-3">
                              <div className="font-medium truncate">{r.fornecedor_nome || '-'}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {r.fornecedor_cnpj || '-'} · {n.grupoLabel}
                              </div>
                            </div>
                            <div className="col-span-2 text-right font-mono pr-4">{formatCurrency(n.valor)}</div>
                            <div className="col-span-1 font-mono pl-3 pr-2">{r.data_vencimento || '-'}</div>
                            <div className="col-span-1 font-mono pl-4">{r.data_programacao_pgto || '-'}</div>
                            <div className="col-span-1 flex justify-end">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full ${sitColor}`} />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>

      <Dialog open={!!selectedDespesa} onOpenChange={(o) => { if (!o) setSelectedDespesa(null); }}>
        <DialogContent className="sm:max-w-[780px] bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">
              {selectedDespesa
                ? `Despesa ${String(selectedDespesa.nro_lancto ?? 0).padStart(6, '0')}-${String(selectedDespesa.parcela ?? '')}`
                : 'Despesa'}
            </DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              {selectedDespesa ? `${selectedDespesa.evento} · ${selectedDespesa.evento_descricao || '—'}` : '—'}
            </DialogDescription>
          </DialogHeader>

          {selectedDespesa && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <div className="text-xs text-slate-500 dark:text-slate-400">Fornecedor</div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">{selectedDespesa.fornecedor_nome || '—'}</div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-300">{selectedDespesa.fornecedor_cnpj || '—'}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Unid</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">{selectedDespesa.unidade || '—'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Situação</div>
                  <div className="text-slate-900 dark:text-slate-100">
                    {(selectedDespesa.sit_des || '').toString().toUpperCase() === 'LIQU' ? 'Liquidada' : 'Pendente'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Valor</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">{formatCurrency(moedaToNumber(selectedDespesa.vlr_parcela))}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Competência</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">{selectedDespesa.mes_competencia || '—'}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:col-span-2">
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Inclusão</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">{selectedDespesa.data_inclusao || '—'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Vencimento</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">{selectedDespesa.data_vencimento || '—'}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Pagamento</div>
                  <div className="font-mono text-slate-900 dark:text-slate-100">{selectedDespesa.data_programacao_pgto || '—'}</div>
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">Grupo de evento</div>
                <div className="text-slate-900 dark:text-slate-100">{selectedDespesa.grupo_evento || '—'}</div>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <div className="text-xs text-slate-500 dark:text-slate-400">Histórico</div>
                <div className="text-slate-900 dark:text-slate-100 whitespace-pre-wrap break-words">{selectedDespesa.historico || '—'}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
