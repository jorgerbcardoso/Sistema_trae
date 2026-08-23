import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useAuth } from '../../contexts/AuthContext';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { UnidadesMultiSelect } from '../admin/UnidadesMultiSelect';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Loader2,
  RefreshCw,
  Warehouse,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Filters = {
  unidadeAtual: string[];
  unidadeDestino: string[];
  periodoEmissaoInicio: string;
  periodoEmissaoFim: string;
  periodoPrevisaoInicio: string;
  periodoPrevisaoFim: string;
  tempoArmazemDe: string;
  tempoArmazemAte: string;
  codigoUltOcor: string;
  tipoUltOcor: string[];
  apenasAgendados: boolean;
};

type Row = {
  seq_cte: number;
  ser_cte: string;
  nro_cte: number;
  data_emissao: string | null;
  data_prev_ent: string | null;
  data_chegada_unid: string | null;
  unid_atual: string | null;
  sigla_emit: string | null;
  sigla_dest: string | null;
  nome_emit: string | null;
  nome_dest: string | null;
  nome_pag: string | null;
  qtde_vol: number | null;
  cubagem: number | null;
  peso: number | null;
  vlr_frete: number | null;
  vlr_merc: number | null;
  dias_armazem: number | null;
  dias_atraso_prev: number | null;
  agendado: boolean;
  ult_ocor_codigo: number | null;
  ult_ocor_tipo: string | null;
  ult_ocor_descricao: string | null;
  ult_ocor_data: string | null;
  ult_ocor_hora: string | null;
  ult_ocor_complemento: string | null;
  horas_desde_ult_ocor?: number | null;
};

type Summary = {
  total: number;
  agendados: number;
  parados4: number;
  parados8: number;
  atraso_prev: number;
  pend_cliente: number;
  pend_transportadora: number;
  sem_ocorrencia: number;
  total_vlr_merc: number;
  total_vlr_frete: number;
  avg_dias_armazem: number;
  avg_horas_ult_ocor: number;
};

type UnitStats = {
  unid_atual: string;
  total: number;
  agendados: number;
  parados4: number;
  parados8: number;
  atraso_prev: number;
  pend_cliente: number;
  pend_transportadora: number;
  sem_ocorrencia: number;
  b_0_1: number;
  b_2_3: number;
  b_4_7: number;
  b_8_15: number;
  b_16p: number;
  total_vlr_merc: number;
  total_vlr_frete: number;
  avg_dias_armazem: number;
  max_dias_armazem: number;
  avg_horas_ult_ocor: number;
};

type UnitMotivo = { unid_atual: string; tipo: string; total: number };
type UnitTopOcorrencia = { unid_atual: string; codigo: number; tipo: string; descricao: string; total: number };

type ApiResponse = {
  success: boolean;
  message?: string;
  rows?: Row[];
  limit?: number;
  ocorAgendamento?: number;
  summary?: Summary;
  unitStats?: UnitStats[];
  unitMotivos?: UnitMotivo[];
  unitTopOcorrencias?: UnitTopOcorrencia[];
};

const TIPOS_OCOR: Record<string, { label: string; badge: string; tone: 'slate' | 'amber' | 'red' | 'orange' | 'emerald' | 'violet' }> = {
  B: { label: 'Baixa', badge: 'B', tone: 'slate' },
  S: { label: 'Solução', badge: 'S', tone: 'emerald' },
  R: { label: 'Reentrega', badge: 'R', tone: 'violet' },
  E: { label: 'Entrega', badge: 'E', tone: 'emerald' },
  I: { label: 'Informativa', badge: 'I', tone: 'slate' },
  C: { label: 'Pend. Cliente', badge: 'C', tone: 'orange' },
  P: { label: 'Pend. Transport.', badge: 'P', tone: 'red' },
};

function fmtDateBR(iso: string | null | undefined) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(n: number | null | undefined, maxFractionDigits: number) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
}

function toneClasses(tone: 'slate' | 'amber' | 'red' | 'orange' | 'emerald' | 'violet') {
  if (tone === 'red') return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  if (tone === 'orange') return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
  if (tone === 'amber') return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
  if (tone === 'emerald') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
  if (tone === 'violet') return 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200';
  return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200';
}

function csvEscape(v: any) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}

export function CondicaoArmazens() {
  usePageTitle('Condição dos Armazéns');
  const { user } = useAuth();

  const unidadeLogada = (user?.unidade_atual || user?.unidade || 'MTZ').trim().toUpperCase();
  const isMTZ = unidadeLogada === 'MTZ';

  const filtrosVazios: Filters = {
    unidadeAtual: [],
    unidadeDestino: [],
    periodoEmissaoInicio: '',
    periodoEmissaoFim: '',
    periodoPrevisaoInicio: '',
    periodoPrevisaoFim: '',
    tempoArmazemDe: '',
    tempoArmazemAte: '',
    codigoUltOcor: '',
    tipoUltOcor: [],
    apenasAgendados: false,
  };

  const [filters, setFilters] = useState<Filters>(filtrosVazios);
  const [tempFilters, setTempFilters] = useState<Filters>(filtrosVazios);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (showFilters) setTempFilters(filters);
  }, [showFilters, filters]);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('');
  const [rows, setRows] = useState<Row[]>([]);
  const rowsRef = useRef<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [unitStats, setUnitStats] = useState<UnitStats[]>([]);
  const [unitMotivos, setUnitMotivos] = useState<UnitMotivo[]>([]);
  const [unitTopOcorrencias, setUnitTopOcorrencias] = useState<UnitTopOcorrencia[]>([]);

  const [busca, setBusca] = useState('');
  const [sortKey, setSortKey] = useState<'prioridade' | 'dias_armazem' | 'dias_atraso' | 'unidade'>('prioridade');

  const dominio = (user?.domain ?? '').trim().toUpperCase();

  useEffect(() => {
    if (!user) return;
    if (isMTZ) return;
    setFilters((f) => {
      const atual = (f.unidadeAtual ?? []).map((x) => String(x).toUpperCase());
      if (atual.length === 1 && atual[0] === unidadeLogada) return f;
      return { ...f, unidadeAtual: [unidadeLogada] };
    });
    setTempFilters((f) => {
      const atual = (f.unidadeAtual ?? []).map((x) => String(x).toUpperCase());
      if (atual.length === 1 && atual[0] === unidadeLogada) return f;
      return { ...f, unidadeAtual: [unidadeLogada] };
    });
  }, [user, isMTZ, unidadeLogada]);

  const hasFiltrosAtivos = useMemo(() => {
    const f = filters;
    return (
      (f.unidadeAtual?.length ?? 0) > 0 ||
      (f.unidadeDestino?.length ?? 0) > 0 ||
      !!f.periodoEmissaoInicio ||
      !!f.periodoEmissaoFim ||
      !!f.periodoPrevisaoInicio ||
      !!f.periodoPrevisaoFim ||
      !!f.tempoArmazemDe ||
      !!f.tempoArmazemAte ||
      !!f.codigoUltOcor ||
      (f.tipoUltOcor?.length ?? 0) > 0 ||
      !!f.apenasAgendados
    );
  }, [filters]);

  const carregar = useCallback(async () => {
    if (!isMTZ && (filters.unidadeAtual?.length ?? 0) === 0) return;
    setLoading(true);
    setErro(null);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/armazens/get_condicao_armazens.php`,
        { method: 'POST', body: JSON.stringify({ filters, limit: 20000 }) },
        true
      );

      const data: ApiResponse = res;
      if (!data?.success) {
        const msg = data?.message || 'Erro ao carregar dados';
        setErro(msg);
        setRows([]);
        rowsRef.current = [];
        setSummary(null);
        setUnitStats([]);
        setUnitMotivos([]);
        setUnitTopOcorrencias([]);
        return;
      }

      const lista = data.rows ?? [];
      setRows(lista);
      rowsRef.current = lista;
      setSummary(data.summary ?? null);
      setUnitStats(data.unitStats ?? []);
      setUnitMotivos(data.unitMotivos ?? []);
      setUnitTopOcorrencias(data.unitTopOcorrencias ?? []);
      const dt = new Date();
      setUltimaAtualizacao(dt.toLocaleString('pt-BR'));
    } catch (e: any) {
      const msg = e?.message || 'Erro ao carregar dados';
      setErro(msg);
      setRows([]);
      rowsRef.current = [];
      setSummary(null);
      setUnitStats([]);
      setUnitMotivos([]);
      setUnitTopOcorrencias([]);
    } finally {
      setLoading(false);
    }
  }, [filters, isMTZ]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const clearFilters = () => {
    setFilters({ ...filtrosVazios, unidadeAtual: isMTZ ? [] : [unidadeLogada] });
    setShowFilters(false);
  };

  const applyFilters = () => {
    setFilters({ ...tempFilters, unidadeAtual: isMTZ ? tempFilters.unidadeAtual : [unidadeLogada] });
    setShowFilters(false);
  };

  const cancelFilters = () => setShowFilters(false);

  const prioridadeScore = useCallback((r: Row) => {
    const dias = Math.max(0, r.dias_armazem ?? 0);
    const atraso = Math.max(0, r.dias_atraso_prev ?? 0);
    const tipo = String(r.ult_ocor_tipo ?? '').trim().toUpperCase();
    const base = dias * 2 + atraso * 3;
    const add = tipo === 'P' ? 25 : tipo === 'C' ? 15 : tipo === '' ? 5 : 0;
    const ag = r.agendado ? -5 : 0;
    return base + add + ag;
  }, []);

  const viewRows = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const cte = `${r.ser_cte || ''}-${String(r.nro_cte || 0).padStart(9, '0')}`.toUpperCase();
      const campos = [
        String(r.unid_atual ?? ''),
        String(r.sigla_emit ?? ''),
        String(r.sigla_dest ?? ''),
        String(r.nome_emit ?? ''),
        String(r.nome_dest ?? ''),
        String(r.nome_pag ?? ''),
        String(r.ult_ocor_descricao ?? ''),
        String(r.ult_ocor_complemento ?? ''),
        String(r.ult_ocor_codigo ?? ''),
        String(r.ult_ocor_tipo ?? ''),
        cte,
      ]
        .join(' ')
        .toUpperCase();
      return campos.includes(q);
    });
  }, [rows, busca]);

  const exportarCSV = () => {
    const lista = viewRows;
    if (!lista.length) {
      toast.info('Nenhum registro para exportar.');
      return;
    }

    const header = [
      'Unidade atual',
      'CT-e',
      'Emissão',
      'Chegada na unidade',
      'Dias no armazém',
      'Prev. entrega',
      'Dias atraso (prev.)',
      'Agendado',
      'Emitente',
      'Destinatário',
      'Pagador',
      'Origem',
      'Destino',
      'Volumes',
      'Peso',
      'Cubagem',
      'Vlr. mercadoria',
      'Frete',
      'Últ. ocorrência (código)',
      'Últ. ocorrência (tipo)',
      'Últ. ocorrência (descrição)',
      'Últ. ocorrência (data)',
      'Últ. ocorrência (hora)',
      'Horas desde últ. ocorrência',
      'Complemento',
    ];

    const rowsCsv = lista.map((r) => {
      const cte = `${r.ser_cte || ''}-${String(r.nro_cte || 0).padStart(9, '0')}`;
      return [
        csvEscape(r.unid_atual ?? ''),
        csvEscape(cte),
        csvEscape(r.data_emissao ?? ''),
        csvEscape(r.data_chegada_unid ?? ''),
        csvEscape(r.dias_armazem ?? ''),
        csvEscape(r.data_prev_ent ?? ''),
        csvEscape(r.dias_atraso_prev ?? ''),
        csvEscape(r.agendado ? 'SIM' : 'NÃO'),
        csvEscape(r.nome_emit ?? ''),
        csvEscape(r.nome_dest ?? ''),
        csvEscape(r.nome_pag ?? ''),
        csvEscape(r.sigla_emit ?? ''),
        csvEscape(r.sigla_dest ?? ''),
        csvEscape(r.qtde_vol ?? ''),
        csvEscape(r.peso ?? ''),
        csvEscape(r.cubagem ?? ''),
        csvEscape(r.vlr_merc ?? ''),
        csvEscape(r.vlr_frete ?? ''),
        csvEscape(r.ult_ocor_codigo ?? ''),
        csvEscape(r.ult_ocor_tipo ?? ''),
        csvEscape(r.ult_ocor_descricao ?? ''),
        csvEscape(r.ult_ocor_data ?? ''),
        csvEscape(r.ult_ocor_hora ?? ''),
        csvEscape(r.horas_desde_ult_ocor ?? ''),
        csvEscape(r.ult_ocor_complemento ?? ''),
      ];
    });

    const csv = [header.join(';'), ...rowsCsv.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `condicao_armazens_${(dominio || 'DOM').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totais = useMemo(() => {
    if (summary) {
      return {
        total: summary.total,
        agendados: summary.agendados,
        atrasoPrev: summary.atraso_prev,
        parados4: summary.parados4,
        parados8: summary.parados8,
        pendCliente: summary.pend_cliente,
        pendTransp: summary.pend_transportadora,
        semOcorrencia: summary.sem_ocorrencia,
        totalVlrMerc: summary.total_vlr_merc,
        totalVlrFrete: summary.total_vlr_frete,
        avgDias: summary.avg_dias_armazem,
        avgHorasUltOcor: summary.avg_horas_ult_ocor,
      };
    }
    const total = rows.length;
    const agendados = rows.filter((r) => r.agendado).length;
    const atrasoPrev = rows.filter((r) => (r.dias_atraso_prev ?? 0) > 0).length;
    const parados4 = rows.filter((r) => (r.dias_armazem ?? 0) >= 4).length;
    const parados8 = rows.filter((r) => (r.dias_armazem ?? 0) >= 8).length;
    const pendCliente = rows.filter((r) => (r.ult_ocor_tipo ?? '').toUpperCase() === 'C').length;
    const pendTransp = rows.filter((r) => (r.ult_ocor_tipo ?? '').toUpperCase() === 'P').length;
    const semOcorrencia = rows.filter((r) => (r.ult_ocor_codigo ?? 0) === 0 || r.ult_ocor_codigo === null).length;
    const totalVlrMerc = rows.reduce((s, r) => s + (r.vlr_merc ?? 0), 0);
    const totalVlrFrete = rows.reduce((s, r) => s + (r.vlr_frete ?? 0), 0);
    const avgDias = total > 0 ? rows.reduce((s, r) => s + (r.dias_armazem ?? 0), 0) / total : 0;
    const avgHorasUltOcor = total > 0 ? rows.reduce((s, r) => s + (r.horas_desde_ult_ocor ?? 0), 0) / total : 0;
    return { total, agendados, atrasoPrev, parados4, parados8, pendCliente, pendTransp, semOcorrencia, totalVlrMerc, totalVlrFrete, avgDias, avgHorasUltOcor };
  }, [rows, summary]);

  const buckets = useMemo(() => {
    if (unitStats.length > 0) {
      return [...unitStats]
        .map((u) => ({
          unidade: u.unid_atual || '—',
          '0-1': u.b_0_1 ?? 0,
          '2-3': u.b_2_3 ?? 0,
          '4-7': u.b_4_7 ?? 0,
          '8-15': u.b_8_15 ?? 0,
          '16+': u.b_16p ?? 0,
          total: u.total ?? 0,
        }))
        .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
        .slice(0, 18);
    }

    const init = { '0-1': 0, '2-3': 0, '4-7': 0, '8-15': 0, '16+': 0 };
    const byUnid: Record<string, typeof init> = {};
    rows.forEach((r) => {
      const un = String(r.unid_atual ?? '').trim().toUpperCase() || '—';
      const d = r.dias_armazem ?? 0;
      const bucket = d <= 1 ? '0-1' : d <= 3 ? '2-3' : d <= 7 ? '4-7' : d <= 15 ? '8-15' : '16+';
      if (!byUnid[un]) byUnid[un] = { ...init };
      byUnid[un][bucket as keyof typeof init] += 1;
    });
    return Object.entries(byUnid)
      .map(([unidade, b]) => ({ unidade, ...b, total: (b['0-1'] + b['2-3'] + b['4-7'] + b['8-15'] + b['16+']) }))
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, 18);
  }, [rows, unitStats]);

  const pieMotivos = useMemo(() => {
    if (unitMotivos.length > 0) {
      const counts: Record<string, number> = {};
      unitMotivos.forEach((m) => {
        const t = String(m.tipo ?? '').trim().toUpperCase() || '—';
        counts[t] = (counts[t] ?? 0) + (m.total ?? 0);
      });
      return Object.entries(counts)
        .map(([tipo, count]) => ({ tipo, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const t = String(r.ult_ocor_tipo ?? '').trim().toUpperCase() || '—';
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([tipo, count]) => ({ tipo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rows, unitMotivos]);

  const topOcorrencias = useMemo(() => {
    if (unitTopOcorrencias.length > 0) {
      const counts: Record<string, { codigo: string; tipo: string; desc: string; count: number }> = {};
      unitTopOcorrencias.forEach((r) => {
        const cod = r.codigo ? String(r.codigo) : '';
        if (!cod) return;
        const tipo = String(r.tipo ?? '').trim().toUpperCase();
        const key = `${cod}|${tipo}`;
        if (!counts[key]) {
          counts[key] = { codigo: cod, tipo, desc: String(r.descricao ?? ''), count: 0 };
        }
        counts[key].count += (r.total ?? 0);
      });
      return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 12);
    }
    const counts: Record<string, { codigo: string; tipo: string; desc: string; count: number }> = {};
    rows.forEach((r) => {
      const cod = r.ult_ocor_codigo !== null ? String(r.ult_ocor_codigo) : '';
      if (!cod) return;
      const key = `${cod}|${String(r.ult_ocor_tipo ?? '').trim().toUpperCase()}`;
      if (!counts[key]) {
        counts[key] = { codigo: cod, tipo: String(r.ult_ocor_tipo ?? '').trim().toUpperCase(), desc: String(r.ult_ocor_descricao ?? ''), count: 0 };
      }
      counts[key].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 12);
  }, [rows, unitTopOcorrencias]);

  const sortedRows = useMemo(() => {
    const copy = [...viewRows];
    copy.sort((a, b) => {
      if (sortKey === 'unidade') {
        const ua = String(a.unid_atual ?? '').toUpperCase();
        const ub = String(b.unid_atual ?? '').toUpperCase();
        if (ua !== ub) return ua.localeCompare(ub);
      }
      if (sortKey === 'dias_atraso') {
        const aa = Math.max(0, a.dias_atraso_prev ?? 0);
        const ab = Math.max(0, b.dias_atraso_prev ?? 0);
        if (aa !== ab) return ab - aa;
      }
      if (sortKey === 'dias_armazem') {
        const da = a.dias_armazem ?? -1;
        const db = b.dias_armazem ?? -1;
        if (da !== db) return db - da;
      }
      const pa = a.data_prev_ent ?? '';
      const pb = b.data_prev_ent ?? '';
      if (pa !== pb) return pa.localeCompare(pb);
      if (sortKey === 'prioridade') {
        const sa = prioridadeScore(a);
        const sb = prioridadeScore(b);
        if (sa !== sb) return sb - sa;
      }
      const da2 = a.dias_armazem ?? -1;
      const db2 = b.dias_armazem ?? -1;
      if (da2 !== db2) return db2 - da2;
      return (b.seq_cte ?? 0) - (a.seq_cte ?? 0);
    });
    return copy;
  }, [viewRows, sortKey, prioridadeScore]);

  const unitRank = useMemo(() => {
    const calc = (u: UnitStats) => {
      const total = u.total ?? 0;
      const p8 = u.parados8 ?? 0;
      const p4 = u.parados4 ?? 0;
      const atras = u.atraso_prev ?? 0;
      const pendP = u.pend_transportadora ?? 0;
      const pendC = u.pend_cliente ?? 0;
      const sem = u.sem_ocorrencia ?? 0;
      const maxDias = u.max_dias_armazem ?? 0;
      return (
        pendP * 8 +
        pendC * 5 +
        atras * 3 +
        p8 * 2 +
        p4 * 1 +
        sem * 1 +
        maxDias * 0.2 +
        total * 0.05
      );
    };
    return [...unitStats]
      .map((u) => ({ ...u, score: calc(u) }))
      .sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, 20);
  }, [unitStats]);

  const unitCP = useMemo(() => {
    const base = [...unitStats]
      .map((u) => {
        const total = u.total ?? 0;
        const c = u.pend_cliente ?? 0;
        const p = u.pend_transportadora ?? 0;
        const outros = Math.max(0, total - c - p);
        return { unidade: u.unid_atual || '—', C: c, P: p, Outros: outros, total };
      })
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, 18);
    return base;
  }, [unitStats]);

  const unitHeat = useMemo(() => {
    return [...unitStats]
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
      .slice(0, 25);
  }, [unitStats]);

  return (
    <DashboardLayout
      title="Condição dos Armazéns"
      description={user?.client_name}
      headerActions={
        <div className="flex items-center gap-3">
          {ultimaAtualizacao && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>Atualizado em {ultimaAtualizacao}</span>
            </div>
          )}

          <div className="hidden lg:flex items-center gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar CT-e, unidade, pagador, ocorrência..."
              className="h-9 w-[340px] dark:bg-slate-900 dark:border-slate-700"
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
            >
              <option value="prioridade">Ordenar: prioridade</option>
              <option value="dias_armazem">Ordenar: dias no armazém</option>
              <option value="dias_atraso">Ordenar: atraso previsão</option>
              <option value="unidade">Ordenar: unidade</option>
            </select>
          </div>

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
            <DialogContent className="sm:max-w-[760px] bg-white dark:bg-slate-900 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  O painel lê exclusivamente a base do Presto (todas as unidades do domínio).
                </DialogDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <UnidadesMultiSelect
                      value={tempFilters.unidadeAtual}
                      onChange={(value) => setTempFilters({ ...tempFilters, unidadeAtual: value })}
                      domain={user?.domain}
                      label="Unidade"
                      disabled={!isMTZ}
                      emptyHint={
                        isMTZ ? (
                          <>
                            <strong>Nenhuma selecionada</strong> = todas
                          </>
                        ) : (
                          <>
                            <strong>Bloqueado</strong> = {unidadeLogada}
                          </>
                        )
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <UnidadesMultiSelect
                      value={tempFilters.unidadeDestino}
                      onChange={(value) => setTempFilters({ ...tempFilters, unidadeDestino: value })}
                      domain={user?.domain}
                      label="Unidade(s) destino"
                      emptyHint={<><strong>Nenhuma selecionada</strong> = sem filtro</>}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Emissão (de)</Label>
                      <Input
                        type="date"
                        value={tempFilters.periodoEmissaoInicio}
                        onChange={(e) => setTempFilters({ ...tempFilters, periodoEmissaoInicio: e.target.value })}
                        className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Emissão (até)</Label>
                      <Input
                        type="date"
                        value={tempFilters.periodoEmissaoFim}
                        onChange={(e) => setTempFilters({ ...tempFilters, periodoEmissaoFim: e.target.value })}
                        className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Previsão entrega (de)</Label>
                      <Input
                        type="date"
                        value={tempFilters.periodoPrevisaoInicio}
                        onChange={(e) => setTempFilters({ ...tempFilters, periodoPrevisaoInicio: e.target.value })}
                        className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm text-slate-600 dark:text-slate-400">Previsão entrega (até)</Label>
                      <Input
                        type="date"
                        value={tempFilters.periodoPrevisaoFim}
                        onChange={(e) => setTempFilters({ ...tempFilters, periodoPrevisaoFim: e.target.value })}
                        className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-slate-900 dark:text-slate-100">Tempo no armazém (dias)</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Baseado em (hoje - chegada na unidade). Se não houver chegada, usa inclusão/emissão.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">De</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={tempFilters.tempoArmazemDe}
                          onChange={(e) => setTempFilters({ ...tempFilters, tempoArmazemDe: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm text-slate-600 dark:text-slate-400">Até</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={tempFilters.tempoArmazemAte}
                          onChange={(e) => setTempFilters({ ...tempFilters, tempoArmazemAte: e.target.value })}
                          className="dark:bg-slate-800 dark:border-slate-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-900 dark:text-slate-100">Código da última ocorrência</Label>
                    <Input
                      type="number"
                      value={tempFilters.codigoUltOcor}
                      onChange={(e) => setTempFilters({ ...tempFilters, codigoUltOcor: e.target.value })}
                      className="dark:bg-slate-800 dark:border-slate-700"
                      placeholder="Ex.: 15"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-slate-900 dark:text-slate-100">Tipo(s) da última ocorrência</Label>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Destaques para C (culpa do cliente) e P (culpa da transportadora).
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(['C', 'P', 'B', 'S', 'R', 'E', 'I'] as const).map((t) => {
                        const ativo = (tempFilters.tipoUltOcor ?? []).includes(t);
                        const tone = (TIPOS_OCOR[t]?.tone ?? 'slate') as any;
                        return (
                          <Button
                            key={t}
                            type="button"
                            size="sm"
                            variant={ativo ? 'default' : 'outline'}
                            className={
                              ativo
                                ? `${toneClasses(tone)} border-0 hover:opacity-90`
                                : `dark:border-slate-700 ${tone === 'red' ? 'text-red-700 dark:text-red-300' : tone === 'orange' ? 'text-orange-700 dark:text-orange-300' : 'text-slate-700 dark:text-slate-200'}`
                            }
                            onClick={() => {
                              const set = new Set(tempFilters.tipoUltOcor ?? []);
                              if (set.has(t)) set.delete(t);
                              else set.add(t);
                              setTempFilters({ ...tempFilters, tipoUltOcor: Array.from(set) });
                            }}
                          >
                            {t}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 select-none">
                      <input
                        type="checkbox"
                        checked={!!tempFilters.apenasAgendados}
                        onChange={(e) => setTempFilters({ ...tempFilters, apenasAgendados: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900"
                      />
                      <span>Apenas CT-es agendados</span>
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Considera a configuração de ocorrência de agendamento do domínio.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button variant="outline" onClick={clearFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
                  Limpar tudo
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={cancelFilters} className="dark:border-slate-700 dark:hover:bg-slate-800">
                    Cancelar
                  </Button>
                  <Button onClick={applyFilters} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Aplicar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => void carregar()} disabled={loading} className="dark:border-slate-600">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-1.5">Atualizar</span>
          </Button>

          <Button variant="outline" size="sm" onClick={exportarCSV} disabled={loading || viewRows.length === 0} className="dark:border-slate-600">
            <Download className="w-4 h-4" />
            <span className="ml-1.5">CSV</span>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">
            Domínio: {dominio || '—'}
          </Badge>
          {filters.unidadeAtual.length > 0 && (
            <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200 text-xs">
              Unidade: {filters.unidadeAtual.map((u) => String(u).toUpperCase()).join(', ')}
            </Badge>
          )}
          <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 text-xs">
            Fonte: Base Presto (todas as unidades)
          </Badge>
          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">
            Ocorrências: B/S/R/E/I/C/P
          </Badge>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex flex-col lg:hidden gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar CT-e, unidade, pagador, ocorrência..."
              className="dark:bg-slate-900 dark:border-slate-700"
            />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as any)}
              className="h-10 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-700 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
            >
              <option value="prioridade">Ordenar: prioridade</option>
              <option value="dias_armazem">Ordenar: dias no armazém</option>
              <option value="dias_atraso">Ordenar: atraso previsão</option>
              <option value="unidade">Ordenar: unidade</option>
            </select>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters((f) => ({ ...f, tempoArmazemDe: '4' }))}
              className="dark:border-slate-700"
            >
              ≥ 4 dias
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters((f) => ({ ...f, tempoArmazemDe: '8' }))}
              className="dark:border-slate-700"
            >
              ≥ 8 dias
            </Button>
            <Button
              size="sm"
              variant={filters.apenasAgendados ? 'default' : 'outline'}
              onClick={() => setFilters((f) => ({ ...f, apenasAgendados: !f.apenasAgendados }))}
              className={filters.apenasAgendados ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'dark:border-slate-700'}
            >
              Agendados
            </Button>
            <Button
              size="sm"
              variant={(filters.tipoUltOcor ?? []).includes('C') ? 'default' : 'outline'}
              onClick={() => {
                setFilters((f) => {
                  const set = new Set(f.tipoUltOcor ?? []);
                  if (set.has('C')) set.delete('C');
                  else set.add('C');
                  return { ...f, tipoUltOcor: Array.from(set) };
                });
              }}
              className={(filters.tipoUltOcor ?? []).includes('C') ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'dark:border-slate-700'}
            >
              Tipo C
            </Button>
            <Button
              size="sm"
              variant={(filters.tipoUltOcor ?? []).includes('P') ? 'default' : 'outline'}
              onClick={() => {
                setFilters((f) => {
                  const set = new Set(f.tipoUltOcor ?? []);
                  if (set.has('P')) set.delete('P');
                  else set.add('P');
                  return { ...f, tipoUltOcor: Array.from(set) };
                });
              }}
              className={(filters.tipoUltOcor ?? []).includes('P') ? 'bg-red-600 hover:bg-red-700 text-white' : 'dark:border-slate-700'}
            >
              Tipo P
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setBusca(''); setSortKey('prioridade'); clearFilters(); }}
              className="dark:border-slate-700"
            >
              Limpar
            </Button>
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
              Exibindo {viewRows.length} de {rows.length}
            </span>
          </div>
        </div>

        {erro && (
          <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-5 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-300">Erro ao carregar painel</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erro}</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando…
          </div>
        )}

        {!loading && !erro && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Warehouse className="w-3.5 h-3.5" />
                    Total no armazém
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.total}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Parados ≥ 4 dias
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.parados4}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Parados ≥ 8 dias
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.parados8}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    Atrasados (prev.)
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.atrasoPrev}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-black text-orange-600 dark:text-orange-400">C</span>
                    Pend. cliente
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.pendCliente}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-black text-red-600 dark:text-red-400">P</span>
                    Pend. transport.
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.pendTransp}</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Agendados
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.agendados}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Sem ocorrência
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.semOcorrencia}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-black text-emerald-600 dark:text-emerald-400">R$</span>
                    Vlr. mercadoria
                  </div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtMoney(totais.totalVlrMerc)}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-black text-sky-600 dark:text-sky-400">R$</span>
                    Vlr. frete
                  </div>
                  <div className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtMoney(totais.totalVlrFrete)}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <CalendarDays className="w-3.5 h-3.5" />
                    Média dias (armazém)
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtNum(totais.avgDias, 1)}</div>
                </CardContent>
              </Card>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    Média horas (últ. ocorrência)
                  </div>
                  <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtNum(totais.avgHorasUltOcor, 0)}</div>
                </CardContent>
              </Card>
            </div>

            {(unitStats.length > 0) && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="border-slate-200 dark:border-slate-800 lg:col-span-2">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ranking de risco por unidade</p>
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Top 20</Badge>
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <div className="grid grid-cols-[70px_70px_70px_70px_70px_70px_minmax(0,1fr)] gap-2 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                        <span>Unid.</span>
                        <span className="text-right">Total</span>
                        <span className="text-right">≥8d</span>
                        <span className="text-right">C</span>
                        <span className="text-right">P</span>
                        <span className="text-right">Max</span>
                        <span>Indicador</span>
                      </div>
                      <div className="max-h-[280px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {unitRank.length === 0 ? (
                          <div className="px-3 py-10 text-sm text-slate-400 dark:text-slate-500 text-center">—</div>
                        ) : (
                          (() => {
                            const maxScore = Math.max(...unitRank.map((u: any) => Number(u.score ?? 0)), 1);
                            return unitRank.map((u: any) => {
                              const pct = Math.round((Number(u.score ?? 0) / maxScore) * 100);
                              return (
                                <div key={u.unid_atual} className="grid grid-cols-[70px_70px_70px_70px_70px_70px_minmax(0,1fr)] gap-2 px-3 py-2 text-xs items-center">
                                  <button
                                    className="text-left font-mono font-semibold text-slate-800 dark:text-slate-200 hover:underline"
                                    onClick={() => {
                                      if (!isMTZ) {
                                        toast.info('Filtro de unidade está bloqueado para seu usuário.');
                                        return;
                                      }
                                      setFilters((f) => ({ ...f, unidadeAtual: [u.unid_atual] }));
                                    }}
                                  >
                                    {u.unid_atual || '—'}
                                  </button>
                                  <span className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">{u.total ?? 0}</span>
                                  <span className="text-right font-mono tabular-nums text-red-700 dark:text-red-300 font-semibold">{u.parados8 ?? 0}</span>
                                  <span className="text-right font-mono tabular-nums text-orange-700 dark:text-orange-300 font-semibold">{u.pend_cliente ?? 0}</span>
                                  <span className="text-right font-mono tabular-nums text-red-700 dark:text-red-300 font-semibold">{u.pend_transportadora ?? 0}</span>
                                  <span className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">{u.max_dias_armazem ?? 0}</span>
                                  <div className="relative h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-400 via-red-500 to-red-600" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            });
                          })()
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pendências C/P por unidade</p>
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Top 18</Badge>
                    </div>
                    <div className="mt-3 h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={unitCP} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="unidade" tick={{ fontSize: 11 }} width={50} />
                          <RechartsTooltip />
                          <Legend wrapperStyle={{ fontSize: 11 }} />
                          <Bar dataKey="P" stackId="a" fill="#ef4444" />
                          <Bar dataKey="C" stackId="a" fill="#f97316" />
                          <Bar dataKey="Outros" stackId="a" fill="#94a3b8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
                </div>
                <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mapa de aging por unidade</p>
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Top 25</Badge>
                  </div>
                  <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="min-w-[760px]">
                      <div className="grid grid-cols-[70px_70px_70px_70px_70px_70px_70px] gap-2 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                        <span>Unid.</span>
                        <span className="text-right">Total</span>
                        <span className="text-right">0-1</span>
                        <span className="text-right">2-3</span>
                        <span className="text-right">4-7</span>
                        <span className="text-right">8-15</span>
                        <span className="text-right">16+</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[260px] overflow-y-auto">
                        {unitHeat.length === 0 ? (
                          <div className="px-3 py-10 text-sm text-slate-400 dark:text-slate-500 text-center">—</div>
                        ) : (
                          unitHeat.map((u) => {
                            const cell = (n: number, tone: 'slate' | 'blue' | 'amber' | 'orange' | 'red') => {
                              const v = n ?? 0;
                              const bg =
                                v === 0 ? 'bg-slate-50 dark:bg-slate-900/40' :
                                tone === 'red' ? 'bg-red-50 dark:bg-red-950/20' :
                                tone === 'orange' ? 'bg-orange-50 dark:bg-orange-950/20' :
                                tone === 'amber' ? 'bg-amber-50 dark:bg-amber-950/20' :
                                tone === 'blue' ? 'bg-blue-50 dark:bg-blue-950/20' :
                                'bg-slate-100 dark:bg-slate-800/60';
                              const text =
                                v === 0 ? 'text-slate-400 dark:text-slate-500' :
                                tone === 'red' ? 'text-red-700 dark:text-red-300' :
                                tone === 'orange' ? 'text-orange-700 dark:text-orange-300' :
                                tone === 'amber' ? 'text-amber-700 dark:text-amber-300' :
                                tone === 'blue' ? 'text-blue-700 dark:text-blue-300' :
                                'text-slate-700 dark:text-slate-200';
                              return (
                                <span className={`text-right font-mono tabular-nums px-2 py-1 rounded ${bg} ${text}`}>
                                  {v.toLocaleString('pt-BR')}
                                </span>
                              );
                            };
                            return (
                              <div key={u.unid_atual} className="grid grid-cols-[70px_70px_70px_70px_70px_70px_70px] gap-2 px-3 py-2 text-xs items-center">
                                <button
                                  className="text-left font-mono font-semibold text-slate-800 dark:text-slate-200 hover:underline"
                                  onClick={() => {
                                    if (!isMTZ) {
                                      toast.info('Filtro de unidade está bloqueado para seu usuário.');
                                      return;
                                    }
                                    setFilters((f) => ({ ...f, unidadeAtual: [u.unid_atual] }));
                                  }}
                                >
                                  {u.unid_atual}
                                </button>
                                <span className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">{u.total.toLocaleString('pt-BR')}</span>
                                {cell(u.b_0_1, 'slate')}
                                {cell(u.b_2_3, 'blue')}
                                {cell(u.b_4_7, 'amber')}
                                {cell(u.b_8_15, 'orange')}
                                {cell(u.b_16p, 'red')}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              </>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aging por unidade (Top 18)</p>
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">CT-es</Badge>
                  </div>
                  <div className="mt-3 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={buckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                        <XAxis dataKey="unidade" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <RechartsTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="0-1" stackId="a" fill="#a3a3a3" />
                        <Bar dataKey="2-3" stackId="a" fill="#60a5fa" />
                        <Bar dataKey="4-7" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="8-15" stackId="a" fill="#f97316" />
                        <Bar dataKey="16+" stackId="a" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Motivo (tipo de ocorrência)</p>
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Última ocorrência</Badge>
                  </div>
                  <div className="mt-3 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieMotivos} dataKey="count" nameKey="tipo" outerRadius={92} innerRadius={40}>
                          {pieMotivos.map((it, idx) => {
                            const t = (it.tipo || '—').toUpperCase();
                            const tone = (TIPOS_OCOR[t]?.tone ?? 'slate') as any;
                            const color =
                              tone === 'red' ? '#ef4444' :
                              tone === 'orange' ? '#f97316' :
                              tone === 'emerald' ? '#10b981' :
                              tone === 'violet' ? '#8b5cf6' :
                              tone === 'amber' ? '#f59e0b' :
                              '#94a3b8';
                            return <Cell key={idx} fill={color} />;
                          })}
                        </Pie>
                        <RechartsTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 dark:border-slate-800">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top ocorrências (código)</p>
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Top 12</Badge>
                  </div>
                  <div className="mt-3 space-y-2">
                    {topOcorrencias.length === 0 ? (
                      <div className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">—</div>
                    ) : (
                      topOcorrencias.map((o) => {
                        const tipo = (o.tipo || '').toUpperCase();
                        const t = TIPOS_OCOR[tipo]?.tone ?? 'slate';
                        return (
                          <button
                            key={`${o.codigo}-${o.tipo}`}
                            className="w-full text-left flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-2 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                            onClick={() => setFilters((f) => ({ ...f, codigoUltOcor: String(o.codigo || '') }))}
                          >
                            <Badge className={`${toneClasses(t)} text-[11px] shrink-0`}>{o.codigo}</Badge>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                {tipo ? <Badge className={`${toneClasses(t)} text-[11px]`}>{tipo}</Badge> : null}
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 tabular-nums">{o.count}</span>
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{o.desc || '—'}</div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">CT-es em armazém (todas as unidades)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Priorize pelo “Dias no armazém” e observe o tipo de ocorrência C/P para entender o motivo.
                    </p>
                  </div>
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">
                    {sortedRows.length} registros{rows.length !== sortedRows.length ? ` (de ${rows.length})` : ''}
                  </Badge>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                      <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <th className="px-3 py-2 text-left whitespace-nowrap">Unid.</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">CT-e</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Prio</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Chegada</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Dias</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Prev. Ent.</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Atraso</th>
                        <th className="px-3 py-2 text-center whitespace-nowrap">Ag.</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Ocorrência</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Hrs últ.</th>
                        <th className="px-3 py-2 text-left whitespace-nowrap">Complemento</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Vlr Merc.</th>
                        <th className="px-3 py-2 text-right whitespace-nowrap">Frete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sortedRows.length === 0 ? (
                        <tr>
                          <td colSpan={13} className="px-3 py-10 text-center text-slate-400 dark:text-slate-500">
                            Nenhum CT-e encontrado com os filtros atuais.
                          </td>
                        </tr>
                      ) : (
                        sortedRows.map((r) => {
                          const cte = `${r.ser_cte || ''}-${String(r.nro_cte || 0).padStart(9, '0')}`;
                          const tipo = String(r.ult_ocor_tipo ?? '').trim().toUpperCase();
                          const tone = TIPOS_OCOR[tipo]?.tone ?? 'slate';
                          const dias = r.dias_armazem ?? 0;
                          const atraso = r.dias_atraso_prev ?? 0;
                          const prio = prioridadeScore(r);
                          const hrsUlt = r.horas_desde_ult_ocor ?? null;

                          const rowTone =
                            tipo === 'P'
                              ? 'bg-red-50/50 dark:bg-red-950/15'
                              : tipo === 'C'
                                ? 'bg-orange-50/50 dark:bg-orange-950/15'
                                : r.agendado
                                  ? 'bg-violet-50/40 dark:bg-violet-950/15'
                                  : '';

                          return (
                            <tr key={r.seq_cte} className={`${rowTone}`}>
                              <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {String(r.unid_atual ?? '').toUpperCase() || '—'}
                              </td>
                              <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {cte}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                                <span className={prio >= 70 ? 'text-red-700 dark:text-red-300 font-bold' : prio >= 45 ? 'text-orange-700 dark:text-orange-300 font-bold' : 'text-slate-700 dark:text-slate-200'}>
                                  {Math.round(prio)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {fmtDateBR(r.data_chegada_unid)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                                <span className={dias >= 8 ? 'text-red-700 dark:text-red-300 font-bold' : dias >= 4 ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-slate-700 dark:text-slate-200'}>
                                  {dias}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                {fmtDateBR(r.data_prev_ent)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                                <span className={atraso > 0 ? 'text-red-700 dark:text-red-300 font-bold' : 'text-slate-700 dark:text-slate-200'}>
                                  {atraso > 0 ? atraso : 0}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                {r.agendado ? <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200 text-[11px]">SIM</Badge> : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  {r.ult_ocor_codigo !== null ? (
                                    <Badge className={`${toneClasses(tone)} text-[11px] font-mono`}>
                                      {r.ult_ocor_codigo}
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[11px]">
                                      —
                                    </Badge>
                                  )}
                                  {tipo ? <Badge className={`${toneClasses(tone)} text-[11px]`}>{tipo}</Badge> : null}
                                  <span className="text-xs text-slate-700 dark:text-slate-200 truncate max-w-[340px]">
                                    {r.ult_ocor_descricao || 'Sem ocorrência'}
                                  </span>
                                </div>
                                {(r.ult_ocor_data || r.ult_ocor_hora) && (
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {fmtDateBR(r.ult_ocor_data)} {String(r.ult_ocor_hora ?? '').slice(0, 5)}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                                {hrsUlt === null || hrsUlt === undefined ? '—' : Math.round(hrsUlt).toLocaleString('pt-BR')}
                              </td>
                              <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 max-w-[320px] truncate">
                                {r.ult_ocor_complemento || '—'}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                                {fmtMoney(r.vlr_merc)}
                              </td>
                              <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                                {fmtMoney(r.vlr_frete)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
