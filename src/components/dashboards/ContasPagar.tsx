import React, { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, AreaChart, Area, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { EventoSearchInput } from '../shared/EventoSearchInput';
import { FornecedorSearchInput } from '../shared/FornecedorSearchInput';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { AlertTriangle, Calendar, Download, Filter, Loader2, Search, SlidersHorizontal, TrendingUp, X, XCircle } from 'lucide-react';

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

  const [activeTab, setActiveTab] = useState<'visao' | 'eventos' | 'unidades' | 'lista'>('visao');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>(filtrosVazios);
  const [tempFilters, setTempFilters] = useState<Filters>(filtrosVazios);

  const [grupos, setGrupos] = useState<GrupoEvento[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);

  const [rows, setRows] = useState<RowDespesa[]>([]);
  const [loading, setLoading] = useState(false);
  const [quickStatus, setQuickStatus] = useState<'ALL' | 'PEND' | 'LIQU' | 'CANC'>('ALL');
  const [quickOnlyOverdue, setQuickOnlyOverdue] = useState(false);
  const [tableSearch, setTableSearch] = useState('');
  const [focusUnidade, setFocusUnidade] = useState('');
  const [focusGrupoLabel, setFocusGrupoLabel] = useState('');
  const [focusCompetenciaKey, setFocusCompetenciaKey] = useState('');

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

  const concentracao = useMemo(() => {
    const make = (onlyOpen: boolean) => {
      const base = onlyOpen ? filtered.filter(n => n.status !== 'LIQU') : filtered;
      const map = new Map<string, { key: string; label: string; total: number }>();
      for (const n of base) {
        const name = (n.raw.fornecedor_nome ?? '').toString().trim() || '—';
        const cnpj = (n.raw.fornecedor_cnpj ?? '').toString().trim();
        const label = cnpj ? `${name} (${cnpj})` : name;
        const key = `${name}::${cnpj}`;
        if (!map.has(key)) map.set(key, { key, label, total: 0 });
        map.get(key)!.total += n.valor;
      }
      const list = Array.from(map.values()).sort((a, b) => b.total - a.total);
      const total = base.reduce((s, n) => s + n.valor, 0);
      const top1 = list[0] ?? null;
      const top3Total = list.slice(0, 3).reduce((s, x) => s + x.total, 0);
      const shareTop3 = total > 0 ? top3Total / total : 0;
      return { total, fornecedores: list.length, top1, top3Total, shareTop3 };
    };

    const all = make(false);
    const open = make(true);
    const topGrupo = byGrupo[0] ?? null;
    const shareTopGrupo = totals.total > 0 && topGrupo ? topGrupo.total / totals.total : 0;

    return { all, open, topGrupo, shareTopGrupo };
  }, [filtered, byGrupo, totals.total]);

  const topOverdue = useMemo(() => {
    return filtered
      .filter(n => n.overdue)
      .slice()
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);
  }, [filtered]);

  const upcoming7 = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0).getTime();
    const end = start + 7 * 86400000;
    return filtered
      .filter(n => n.status !== 'LIQU')
      .filter(n => n.programacaoTs !== null && n.programacaoTs >= start && n.programacaoTs <= end)
      .slice()
      .sort((a, b) => (a.programacaoTs ?? 9e15) - (b.programacaoTs ?? 9e15))
      .slice(0, 12);
  }, [filtered]);

  const clearFilters = () => {
    setFilters(filtrosVazios);
    setTempFilters(filtrosVazios);
  };

  const cancelFilters = () => {
    setTempFilters(filters);
    setShowFilters(false);
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setShowFilters(false);
  };

  const carregar = async () => {
    setLoading(true);
    try {
      const payload = { ...filters };
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/contas-pagar/get_despesas.php`,
        { method: 'POST', body: JSON.stringify(payload) },
        true
      );
      if (res?.success) {
        setRows(Array.isArray(res.rows) ? res.rows : []);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const exportarCsv = () => {
    const header = [
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
    ];

    const lines: string[] = [];
    lines.push(header.map(csvEscape).join(';'));
    for (const n of filtered) {
      const r = n.raw;
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
      lines.push(row.map(v => csvEscape(String(v ?? ''))).join(';'));
    }

    const bom = '\uFEFF';
    const content = bom + lines.join('\r\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contas_pagar_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const CompetenciaTooltip = ({ active, payload, label }: any) => {
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
                  Informe ao menos 1 período (emissão, inclusão, programação ou vencimento).
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-6 py-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FornecedorSearchInput
                        value={tempFilters.seq_fornecedor}
                        onChange={(v) => setTempFilters({ ...tempFilters, seq_fornecedor: v })}
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
                      <div className="relative">
                        <Input
                          value={tempFilters.grupo_evento}
                          onChange={(e) => setTempFilters({ ...tempFilters, grupo_evento: e.target.value.replace(/\D+/g, '') })}
                          placeholder={loadingGrupos ? 'Carregando...' : 'Ex: 4'}
                          className="pr-9 dark:bg-slate-800 dark:border-slate-700"
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      </div>
                      {tempFilters.grupo_evento && grupos.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {(() => {
                            const g = grupos.find(x => String(x.grupo) === tempFilters.grupo_evento);
                            return g ? `${g.grupo} - ${g.descricao}` : 'Grupo não encontrado';
                          })()}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <EventoSearchInput
                        value={tempFilters.evento}
                        onChange={(v) => setTempFilters({ ...tempFilters, evento: v })}
                        label="Evento"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Emissão da NF</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodo_emissao_inicio}
                          onChange={(e) => setTempFilters({ ...tempFilters, periodo_emissao_inicio: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodo_emissao_fim}
                          onChange={(e) => setTempFilters({ ...tempFilters, periodo_emissao_fim: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Inclusão</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodo_inclusao_inicio}
                          onChange={(e) => setTempFilters({ ...tempFilters, periodo_inclusao_inicio: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodo_inclusao_fim}
                          onChange={(e) => setTempFilters({ ...tempFilters, periodo_inclusao_fim: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Programação (Pagamento)</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodo_programacao_inicio}
                          onChange={(e) => setTempFilters({ ...tempFilters, periodo_programacao_inicio: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodo_programacao_fim}
                          onChange={(e) => setTempFilters({ ...tempFilters, periodo_programacao_fim: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-slate-900 dark:text-slate-100">Período de Vencimento</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodo_vencimento_inicio}
                          onChange={(e) => setTempFilters({ ...tempFilters, periodo_vencimento_inicio: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                        <Input
                          type="date"
                          value={tempFilters.periodo_vencimento_fim}
                          onChange={(e) => setTempFilters({ ...tempFilters, periodo_vencimento_fim: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-slate-100">Mês de Competência</Label>
                    <Input
                      type="month"
                      value={tempFilters.competencia_ym}
                      onChange={(e) => setTempFilters({ ...tempFilters, competencia_ym: e.target.value })}
                      className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                    />
                    {tempFilters.competencia_ym && (
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Param SSW (mes_comp): {ymToMesCompParam(tempFilters.competencia_ym)} • CSV: {ymToCompetenciaLabel(tempFilters.competencia_ym)}
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
            onClick={carregar}
            disabled={loading}
            className="dark:border-slate-600"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            <span className="ml-1.5">Buscar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setQuickStatus('ALL');
              setQuickOnlyOverdue(false);
              setTableSearch('');
              setActiveTab('visao');
              setFocusUnidade('');
              setFocusGrupoLabel('');
              setFocusCompetenciaKey('');
            }}
            className="hidden md:inline-flex dark:border-slate-600"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="ml-1.5">Visão</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="visao" className="px-3">Visão</TabsTrigger>
              <TabsTrigger value="eventos" className="px-3">Eventos</TabsTrigger>
              <TabsTrigger value="unidades" className="px-3">Unidades</TabsTrigger>
              <TabsTrigger value="lista" className="px-3">Lista</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Button
              variant={quickStatus === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickStatus('ALL')}
              className={quickStatus === 'ALL' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'dark:border-slate-600'}
            >
              Tudo
            </Button>
            <Button
              variant={quickStatus === 'PEND' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickStatus('PEND')}
              className={quickStatus === 'PEND' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'dark:border-slate-600'}
            >
              Pend
            </Button>
            <Button
              variant={quickStatus === 'LIQU' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickStatus('LIQU')}
              className={quickStatus === 'LIQU' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'dark:border-slate-600'}
            >
              Liqu
            </Button>
            <Button
              variant={quickStatus === 'CANC' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickStatus('CANC')}
              className={quickStatus === 'CANC' ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'dark:border-slate-600'}
            >
              Canc
            </Button>
            <Button
              variant={quickOnlyOverdue ? 'default' : 'outline'}
              size="sm"
              onClick={() => setQuickOnlyOverdue((v) => !v)}
              className={quickOnlyOverdue ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'dark:border-slate-600'}
            >
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              Atraso
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">Base</div>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{totals.rows}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Registros filtrados</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totals.total)}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Competência: {filters.competencia_ym ? ymToCompetenciaLabel(filters.competencia_ym) : 'todas'}
              </div>
              {headlineComparativo && (
                <div className={`mt-1 text-[11px] ${headlineComparativo.delta! > 0 ? 'text-rose-600' : headlineComparativo.delta! < 0 ? 'text-emerald-600' : 'text-slate-500'} dark:text-inherit`}>
                  Δ vs {headlineComparativo.prevLabel}: {formatCurrency(headlineComparativo.delta!)} ({headlineComparativo.pct!.toFixed(1)}%)
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs text-slate-500 dark:text-slate-400">Pendente</div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totals.pend)}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Não liquidado (inclui cancelado se houver)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-xs text-slate-500 dark:text-slate-400">Em atraso</div>
              <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(totals.overdue)}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">Vencimento &lt; hoje (exceto LIQU)</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <TabsContent value="visao">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card className="lg:col-span-8">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Evolução por competência</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Total filtrado por mês de competência</div>
                    </div>
                  </div>
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={serieCompetenciaComparativo} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gradTotal" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={60} />
                        <RechartsTooltip content={<CompetenciaTooltip />} />
                        <Area type="monotone" dataKey="total" stroke="#4f46e5" fill="url(#gradTotal)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {serieCompetencia.slice(-8).map((p) => (
                      <Button
                        key={p.key}
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFocusCompetenciaKey(prev => (prev === p.key ? '' : p.key));
                          setActiveTab('lista');
                        }}
                        className={`h-7 px-2 text-xs dark:border-slate-700 ${focusCompetenciaKey === p.key ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300' : ''}`}
                      >
                        {p.label}
                      </Button>
                    ))}
                    {focusCompetenciaKey && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFocusCompetenciaKey('')}
                        className="h-7 px-2 text-xs dark:border-slate-700"
                      >
                        <X className="w-3.5 h-3.5 mr-1.5" />
                        Limpar
                      </Button>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <div className="col-span-3">Competência</div>
                      <div className="col-span-4 text-right">Total</div>
                      <div className="col-span-5 text-right">Evolução</div>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {serieCompetenciaComparativo
                        .slice(-6)
                        .slice()
                        .reverse()
                        .map((p) => {
                          const delta = p.delta;
                          const pct = p.pct;
                          const evoClass = delta === null ? 'text-slate-400' : delta > 0 ? 'text-rose-600' : delta < 0 ? 'text-emerald-600' : 'text-slate-500';
                          return (
                            <button
                              key={p.key}
                              onClick={() => {
                                setFocusCompetenciaKey(prev => (prev === p.key ? '' : p.key));
                                setActiveTab('lista');
                              }}
                              className="grid grid-cols-12 px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                            >
                              <div className="col-span-3 font-mono">{p.label}</div>
                              <div className="col-span-4 text-right font-mono">{formatCurrency(p.total)}</div>
                              <div className={`col-span-5 text-right font-mono ${evoClass}`}>
                                {delta === null || pct === null || !p.prevLabel
                                  ? '—'
                                  : `${formatCurrency(delta)} (${pct.toFixed(1)}%)`}
                              </div>
                            </button>
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
                          >
                            <Cell fill="#f59e0b" />
                            <Cell fill="#10b981" />
                            <Cell fill="#94a3b8" />
                          </Pie>
                          <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" />PEND</div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />LIQU</div>
                      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-400" />CANC</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Concentração</div>
                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500 dark:text-slate-400">Top 3 fornecedores (total)</div>
                        <div className="font-mono">
                          {(concentracao.all.shareTop3 * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500 dark:text-slate-400">Top 3 fornecedores (pendente)</div>
                        <div className="font-mono">
                          {(concentracao.open.shareTop3 * 100).toFixed(1)}%
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-slate-500 dark:text-slate-400">Maior grupo</div>
                        <div className="font-mono">
                          {(concentracao.shareTopGrupo * 100).toFixed(1)}%
                        </div>
                      </div>
                      {concentracao.open.top1 && (
                        <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">Fornecedor #1 (pendente)</div>
                          <div className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                            {concentracao.open.top1.label}
                          </div>
                          <div className="mt-0.5 text-xs font-mono text-slate-700 dark:text-slate-200">
                            {formatCurrency(concentracao.open.top1.total)}
                          </div>
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
                        <BarChart data={ageing} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 11 }} />
                          <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                          <Bar dataKey="total" fill="#f59e0b" radius={[6, 6, 6, 6]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top vencidas</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs dark:border-slate-700"
                        onClick={() => { setQuickOnlyOverdue(true); setActiveTab('lista'); }}
                      >
                        Ver lista
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {topOverdue.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">Sem vencidas no recorte atual.</div>
                      ) : (
                        topOverdue.map((n) => (
                          <button
                            key={`${n.raw.nro_lancto}-${n.raw.parcela}-${n.raw.evento}`}
                            onClick={() => { setTableSearch(String(n.raw.nro_lancto)); setActiveTab('lista'); }}
                            className="w-full flex items-center justify-between gap-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {n.raw.fornecedor_nome || '-'}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {n.raw.unidade || '-'} · {n.raw.data_vencimento || '-'} · #{n.raw.nro_lancto}-{n.raw.parcela}
                              </div>
                            </div>
                            <div className="text-xs font-mono text-amber-700 dark:text-amber-400 whitespace-nowrap">{formatCurrency(n.valor)}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Programação (7 dias)</div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs dark:border-slate-700"
                        onClick={() => { setActiveTab('lista'); }}
                      >
                        Abrir
                      </Button>
                    </div>
                    <div className="mt-3 space-y-2">
                      {upcoming7.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">Sem pagamentos programados nos próximos 7 dias.</div>
                      ) : (
                        upcoming7.map((n) => (
                          <button
                            key={`${n.raw.nro_lancto}-${n.raw.parcela}-${n.raw.evento}-pgto`}
                            onClick={() => { setTableSearch(String(n.raw.nro_lancto)); setActiveTab('lista'); }}
                            className="w-full flex items-center justify-between gap-3 text-left"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                {n.raw.fornecedor_nome || '-'}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {n.raw.data_programacao_pgto || '-'} · {n.raw.unidade || '-'} · #{n.raw.nro_lancto}-{n.raw.parcela}
                              </div>
                            </div>
                            <div className="text-xs font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">{formatCurrency(n.valor)}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="eventos">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card className="lg:col-span-5">
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Top eventos (valor)</div>
                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={byEvento.slice(0, 12).map((e) => ({ ...e, short: e.label.length > 32 ? `${e.label.slice(0, 32)}…` : e.label }))}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="short" width={170} tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                        <Bar
                          dataKey="total"
                          fill="#4f46e5"
                          radius={[6, 6, 6, 6]}
                          onClick={(d: any) => {
                            const label = (d?.payload?.label ?? '').toString();
                            const code = label.split(' ')[0] || '';
                            if (code) {
                              setTableSearch(code);
                              setActiveTab('lista');
                            }
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-7">
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Grupos de evento (valor)</div>
                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={byGrupo.slice(0, 10).map((g) => ({ ...g, short: g.label.length > 28 ? `${g.label.slice(0, 28)}…` : g.label }))}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="short" width={170} tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                        <Bar
                          dataKey="total"
                          fill="#10b981"
                          radius={[6, 6, 6, 6]}
                          onClick={(d: any) => {
                            const label = (d?.payload?.label ?? '').toString();
                            if (!label) return;
                            setFocusGrupoLabel(prev => (prev === label ? '' : label));
                            setActiveTab('lista');
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="unidades">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <Card className="lg:col-span-6">
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Despesa por unidade (valor)</div>
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byUnidade.slice(0, 14)} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="label" width={70} tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                        <Bar
                          dataKey="total"
                          fill="#f59e0b"
                          radius={[6, 6, 6, 6]}
                          onClick={(d: any) => {
                            const u = (d?.payload?.label ?? '').toString().trim().toUpperCase();
                            if (!u) return;
                            setFocusUnidade(prev => (prev === u ? '' : u));
                            setActiveTab('lista');
                          }}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-6">
                <CardContent className="pt-6">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Top fornecedores (valor)</div>
                  <div className="h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(() => {
                          const map = new Map<string, { key: string; label: string; total: number }>();
                          for (const n of filtered) {
                            const label = (n.raw.fornecedor_nome ?? '').toString().trim() || '—';
                            const key = `${label}::${(n.raw.fornecedor_cnpj ?? '').toString().trim()}`;
                            if (!map.has(key)) map.set(key, { key, label, total: 0 });
                            map.get(key)!.total += n.valor;
                          }
                          return Array.from(map.values())
                            .sort((a, b) => b.total - a.total)
                            .slice(0, 12)
                            .map((x) => ({ ...x, short: x.label.length > 32 ? `${x.label.slice(0, 32)}…` : x.label }));
                        })()}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                      >
                        <XAxis type="number" hide />
                        <YAxis type="category" dataKey="short" width={170} tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(v: any) => formatCurrency(Number(v) || 0)} />
                        <Bar dataKey="total" fill="#0ea5e9" radius={[6, 6, 6, 6]} />
                      </BarChart>
                    </ResponsiveContainer>
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

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <div className="col-span-1">Lanç.</div>
                  <div className="col-span-1">Parc.</div>
                  <div className="col-span-1">Evento</div>
                  <div className="col-span-3">Fornecedor</div>
                  <div className="col-span-2 text-right">Valor</div>
                  <div className="col-span-1">Venc.</div>
                  <div className="col-span-1">Pgto</div>
                  <div className="col-span-1">UNI</div>
                  <div className="col-span-1">Sit</div>
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
                    {filtered
                      .slice()
                      .sort((a, b) => (a.vencimentoTs ?? 9e15) - (b.vencimentoTs ?? 9e15))
                      .slice(0, 600)
                      .map((n) => {
                        const r = n.raw;
                        const key = `${r.nro_lancto}-${r.parcela}-${r.evento}-${r.fornecedor_cnpj}`;
                        const isOverdue = n.overdue;
                        return (
                          <div key={key} className="grid grid-cols-12 px-4 py-2 text-xs text-slate-700 dark:text-slate-200">
                            <div className="col-span-1 font-mono">{r.nro_lancto}</div>
                            <div className="col-span-1 font-mono">{r.parcela}</div>
                            <div className="col-span-1 font-mono">{r.evento}</div>
                            <div className="col-span-3">
                              <div className="font-medium truncate">{r.fornecedor_nome || '-'}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                {r.fornecedor_cnpj || '-'} · {n.grupoLabel}
                              </div>
                            </div>
                            <div className="col-span-2 text-right font-mono">{r.vlr_parcela || '-'}</div>
                            <div className={`col-span-1 font-mono ${isOverdue ? 'text-amber-700 dark:text-amber-400' : ''}`}>{r.data_vencimento || '-'}</div>
                            <div className="col-span-1 font-mono">{r.data_programacao_pgto || '-'}</div>
                            <div className="col-span-1 font-mono">{r.unidade || '-'}</div>
                            <div className={`col-span-1 font-mono ${r.sit_des === 'LIQU' ? 'text-emerald-700 dark:text-emerald-400' : r.sit_des === 'CANC' ? 'text-slate-400' : ''}`}>
                              {r.sit_des || '-'}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {filtered.length > 600 && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Exibindo apenas os primeiros 600 registros (filtrados: {filtered.length}).
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
