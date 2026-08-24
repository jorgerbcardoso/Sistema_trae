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
import { useTooltipStyle } from './CustomTooltip';
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
  tp_documento?: string | null;
  entrega_abonada?: boolean;
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
  S: { label: 'Solução', badge: 'S', tone: 'emerald' },
  R: { label: 'Reentrega', badge: 'R', tone: 'violet' },
  I: { label: 'Informativa', badge: 'I', tone: 'slate' },
  C: { label: 'Pendência por culpa do cliente', badge: 'C', tone: 'orange' },
  P: { label: 'Pendência por culpa da transportadora', badge: 'P', tone: 'red' },
};

const TODOS_TIPOS_OCOR = ['S', 'R', 'I', 'C', 'P'] as const;

function fmtDateBR(iso: string | null | undefined) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtDateBR2y(iso: string | null | undefined) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${String(m[1]).slice(2)}`;
}

function fmtMoney(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtNum(n: number | null | undefined, maxFractionDigits: number) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: maxFractionDigits });
}

function fmtCte(ser: string | null | undefined, nro: number | null | undefined) {
  const s = String(ser ?? '').trim();
  const n = String(nro ?? 0).padStart(6, '0');
  return `${s}${n}`;
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
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillTitle, setDrillTitle] = useState('');
  const [drillRows, setDrillRows] = useState<Row[]>([]);
  const [drillSort, setDrillSort] = useState<{
    key: 'unidade' | 'cte' | 'chegada' | 'dias_armazem' | 'prev_ent' | 'dias_atraso' | 'agendado' | 'ult_ocor' | 'vlr_merc' | 'vlr_frete';
    dir: 'asc' | 'desc';
  }>({
    key: 'dias_armazem',
    dir: 'desc',
  });

  const [busca, setBusca] = useState('');
  const [sort, setSort] = useState<{
    key: 'unidade' | 'chegada' | 'dias_armazem' | 'prev_ent' | 'dias_atraso' | 'agendado' | 'ult_ocor' | 'vlr_merc' | 'vlr_frete';
    dir: 'asc' | 'desc';
  }>({
    key: 'dias_armazem',
    dir: 'desc',
  });
  const pageSize = 70;
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<'dashboard' | 'lista'>('dashboard');
  const [rankSort, setRankSort] = useState<{ key: 'score' | 'unidade' | 'total' | 'parados8' | 'pend_cliente' | 'pend_transportadora' | 'max_dias'; dir: 'asc' | 'desc' }>({
    key: 'score',
    dir: 'desc',
  });
  const [unidadesMap, setUnidadesMap] = useState<Record<string, string>>({});

  const dominio = (user?.domain ?? '').trim().toUpperCase();

  const tooltipStyle = useTooltipStyle();

  const tiposSelecionadosTexto = useMemo(() => {
    const selRaw = (filters.tipoUltOcor ?? []).map((t) => String(t).trim().toUpperCase()).filter(Boolean);
    const sel = Array.from(new Set(selRaw));
    const all = TODOS_TIPOS_OCOR.map((t) => String(t));
    if (sel.length === 0) return 'Todos';
    if (sel.length === all.length && sel.every((t) => all.includes(t))) return 'Todos';
    return sel
      .map((t) => TIPOS_OCOR[t]?.label ?? t)
      .join(' • ');
  }, [filters.tipoUltOcor]);

  useEffect(() => {
    if (!user?.domain) return;
    const run = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        const result = await apiFetch(`/sistema/api/users/get_domain_unidades.php?domain=${user.domain}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const unidades = Array.isArray(result?.unidades) ? result.unidades : [];
        const map: Record<string, string> = {};
        unidades.forEach((u: any) => {
          const sigla = String(u?.sigla ?? '').trim().toUpperCase();
          const nome = String(u?.nome ?? '').trim();
          if (sigla) map[sigla] = nome;
        });
        setUnidadesMap(map);
      } catch {
        setUnidadesMap({});
      }
    };
    void run();
  }, [user?.domain]);

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

  useEffect(() => {
    setPage(1);
  }, [filters, busca]);

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

  const clearAllFilters = () => {
    setBusca('');
    setSort({ key: 'dias_armazem', dir: 'desc' });
    setPage(1);
    setFilters({ ...filtrosVazios, unidadeAtual: isMTZ ? [] : [unidadeLogada] });
    setShowFilters(false);
  };

  const applyFilters = () => {
    const tiposValidos = new Set(TODOS_TIPOS_OCOR.map((t) => String(t)));
    const nextTipos = Array.from(new Set((tempFilters.tipoUltOcor ?? []).map((t) => String(t).trim().toUpperCase()).filter((t) => tiposValidos.has(t))));
    setFilters({ ...tempFilters, tipoUltOcor: nextTipos, unidadeAtual: isMTZ ? tempFilters.unidadeAtual : [unidadeLogada] });
    setShowFilters(false);
  };

  const cancelFilters = () => setShowFilters(false);

  const viewRows = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const cte = fmtCte(r.ser_cte, r.nro_cte).toUpperCase();
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
      'Complemento',
    ];

    const rowsCsv = lista.map((r) => {
      const cte = fmtCte(r.ser_cte, r.nro_cte);
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

  const exportarCSVLista = () => {
    const lista = sortedRows;
    if (!lista.length) {
      toast.info('Nenhum registro para exportar.');
      return;
    }

    const header = ['Unidade', 'CT-e', 'Chegada', 'Dias', 'Prev. Ent.', 'Atraso', 'Agendado', 'Últ. ocorrência', 'Complemento', 'Vlr Merc.', 'Frete'];

    const rowsCsv = lista.map((r) => {
      const sigla = String(r.unid_atual ?? '').trim().toUpperCase();
      const cte = fmtCte(r.ser_cte, r.nro_cte);
      const ult = r.ult_ocor_codigo !== null ? String(r.ult_ocor_codigo) : '';
      const tipo = String(r.ult_ocor_tipo ?? '').trim().toUpperCase();
      const tipoLabel = TIPOS_OCOR[tipo]?.label ?? (tipo ? tipo : '');
      const desc = String(r.ult_ocor_descricao ?? '').trim();
      const ultTxt = [ult, tipoLabel, desc].filter(Boolean).join(' • ');
      const vlrMerc = r.vlr_merc ?? null;
      const vlrFrete = r.vlr_frete ?? null;
      return [
        csvEscape(sigla),
        csvEscape(cte),
        csvEscape(fmtDateBR2y(r.data_chegada_unid)),
        csvEscape(r.dias_armazem ?? ''),
        csvEscape(fmtDateBR2y(r.data_prev_ent)),
        csvEscape(Math.max(0, r.dias_atraso_prev ?? 0)),
        csvEscape(r.agendado ? 'SIM' : 'NÃO'),
        csvEscape(ultTxt),
        csvEscape(r.ult_ocor_complemento ?? ''),
        csvEscape(vlrMerc !== null && Number.isFinite(vlrMerc) ? Number(vlrMerc).toFixed(2).replace('.', ',') : ''),
        csvEscape(vlrFrete !== null && Number.isFinite(vlrFrete) ? Number(vlrFrete).toFixed(2).replace('.', ',') : ''),
      ];
    });

    const csv = [header.join(';'), ...rowsCsv.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `condicao_armazens_lista_${(dominio || 'DOM').toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
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
    const label = (tipoKey: string) => {
      const t = String(tipoKey || '').trim().toUpperCase();
      if (!t || t === '—') return 'Sem tipo';
      return TIPOS_OCOR[t]?.label ?? t;
    };
    if (unitMotivos.length > 0) {
      const counts: Record<string, number> = {};
      unitMotivos.forEach((m) => {
        const t = String(m.tipo ?? '').trim().toUpperCase() || '—';
        counts[t] = (counts[t] ?? 0) + (m.total ?? 0);
      });
      return Object.entries(counts)
        .map(([tipoKey, count]) => ({ tipoKey, tipo: label(tipoKey), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }
    const counts: Record<string, number> = {};
    rows.forEach((r) => {
      const t = String(r.ult_ocor_tipo ?? '').trim().toUpperCase() || '—';
      counts[t] = (counts[t] ?? 0) + 1;
    });
    return Object.entries(counts)
      .map(([tipoKey, count]) => ({ tipoKey, tipo: label(tipoKey), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rows, unitMotivos]);

  const topOcorrencias = useMemo(() => {
    const isPendencia = (t: string) => t === 'C' || t === 'P';
    if (unitTopOcorrencias.length > 0) {
      const counts: Record<string, { codigo: string; tipo: string; desc: string; count: number }> = {};
      unitTopOcorrencias.forEach((r) => {
        const cod = r.codigo ? String(r.codigo) : '';
        if (!cod) return;
        const tipo = String(r.tipo ?? '').trim().toUpperCase();
        if (!isPendencia(tipo)) return;
        const key = `${cod}|${tipo}`;
        if (!counts[key]) {
          counts[key] = { codigo: cod, tipo, desc: String(r.descricao ?? ''), count: 0 };
        }
        counts[key].count += (r.total ?? 0);
      });
      return Object.values(counts).sort((a, b) => b.count - a.count);
    }
    const counts: Record<string, { codigo: string; tipo: string; desc: string; count: number }> = {};
    rows.forEach((r) => {
      const cod = r.ult_ocor_codigo !== null ? String(r.ult_ocor_codigo) : '';
      if (!cod) return;
      const tipo = String(r.ult_ocor_tipo ?? '').trim().toUpperCase();
      if (!isPendencia(tipo)) return;
      const key = `${cod}|${tipo}`;
      if (!counts[key]) {
        counts[key] = { codigo: cod, tipo, desc: String(r.ult_ocor_descricao ?? ''), count: 0 };
      }
      counts[key].count += 1;
    });
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }, [rows, unitTopOcorrencias]);

  const sortedRows = useMemo(() => {
    const copy = [...viewRows];
    const mul = sort.dir === 'asc' ? 1 : -1;
    const num = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? -Infinity : v);
    const str = (v: string | null | undefined) => String(v ?? '').trim().toUpperCase();
    const dateMs = (iso: string | null | undefined) => {
      if (!iso) return -Infinity;
      const ms = Date.parse(String(iso));
      return Number.isFinite(ms) ? ms : -Infinity;
    };
    copy.sort((a, b) => {
      if (sort.key === 'unidade') {
        const ua = str(a.unid_atual);
        const ub = str(b.unid_atual);
        if (ua !== ub) return ua.localeCompare(ub) * mul;
      }
      if (sort.key === 'chegada') {
        const da = dateMs(a.data_chegada_unid);
        const db = dateMs(b.data_chegada_unid);
        if (da !== db) return (da - db) * mul;
      }
      if (sort.key === 'dias_armazem') {
        const da = num(a.dias_armazem);
        const db = num(b.dias_armazem);
        if (da !== db) return (da - db) * mul;
      }
      if (sort.key === 'prev_ent') {
        const da = dateMs(a.data_prev_ent);
        const db = dateMs(b.data_prev_ent);
        if (da !== db) return (da - db) * mul;
      }
      if (sort.key === 'dias_atraso') {
        const aa = Math.max(0, a.dias_atraso_prev ?? 0);
        const ab = Math.max(0, b.dias_atraso_prev ?? 0);
        if (aa !== ab) return (aa - ab) * mul;
      }
      if (sort.key === 'agendado') {
        const aa = a.agendado ? 1 : 0;
        const ab = b.agendado ? 1 : 0;
        if (aa !== ab) return (aa - ab) * mul;
      }
      if (sort.key === 'ult_ocor') {
        const aa = num(a.ult_ocor_codigo ?? null);
        const ab = num(b.ult_ocor_codigo ?? null);
        if (aa !== ab) return (aa - ab) * mul;
      }
      if (sort.key === 'vlr_merc') {
        const aa = num(a.vlr_merc);
        const ab = num(b.vlr_merc);
        if (aa !== ab) return (aa - ab) * mul;
      }
      if (sort.key === 'vlr_frete') {
        const aa = num(a.vlr_frete);
        const ab = num(b.vlr_frete);
        if (aa !== ab) return (aa - ab) * mul;
      }
      const da2 = a.dias_armazem ?? -1;
      const db2 = b.dias_armazem ?? -1;
      if (da2 !== db2) return db2 - da2;
      return (b.seq_cte ?? 0) - (a.seq_cte ?? 0);
    });
    return copy;
  }, [viewRows, sort]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(sortedRows.length / pageSize)), [sortedRows.length, pageSize]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, page, pageSize]);

  const listaTotais = useMemo(() => {
    const total = viewRows.length;
    const vlrMerc = viewRows.reduce((s, r) => s + (r.vlr_merc ?? 0), 0);
    const vlrFrete = viewRows.reduce((s, r) => s + (r.vlr_frete ?? 0), 0);
    return { total, vlrMerc, vlrFrete };
  }, [viewRows]);

  const openDrill = useCallback(
    (title: string, predicate: (r: Row) => boolean) => {
      const list = viewRows.filter(predicate);
      list.sort((a, b) => (b.dias_armazem ?? 0) - (a.dias_armazem ?? 0));
      setDrillTitle(`${title} (${list.length})`);
      setDrillRows(list);
      setDrillSort({ key: 'dias_armazem', dir: 'desc' });
      setDrillOpen(true);
    },
    [viewRows]
  );

  const exportarDrillCSV = () => {
    const lista = drillRows;
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
      'Complemento',
    ];

    const rowsCsv = lista.map((r) => {
      const cte = fmtCte(r.ser_cte, r.nro_cte);
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
        csvEscape(r.ult_ocor_complemento ?? ''),
      ];
    });

    const csv = [header.join(';'), ...rowsCsv.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = String(drillTitle || 'drilldown')
      .replace(/\s+/g, '_')
      .replace(/[^\w\-_.]+/g, '')
      .slice(0, 80);
    a.href = url;
    a.download = `condicao_armazens_${(dominio || 'DOM').toLowerCase()}_${safe}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const drillSortedRows = useMemo(() => {
    const copy = [...drillRows];
    const mul = drillSort.dir === 'asc' ? 1 : -1;
    const num = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? -Infinity : v);
    const str = (v: string | null | undefined) => String(v ?? '').trim().toUpperCase();
    const dateMs = (iso: string | null | undefined) => {
      if (!iso) return -Infinity;
      const ms = Date.parse(String(iso));
      return Number.isFinite(ms) ? ms : -Infinity;
    };
    const cteKey = (r: Row) => `${String(r.ser_cte ?? '').trim().toUpperCase()}${String(r.nro_cte ?? 0).padStart(6, '0')}`;

    copy.sort((a, b) => {
      if (drillSort.key === 'unidade') {
        const ua = str(a.unid_atual);
        const ub = str(b.unid_atual);
        if (ua !== ub) return ua.localeCompare(ub) * mul;
      }
      if (drillSort.key === 'cte') {
        const ca = cteKey(a);
        const cb = cteKey(b);
        if (ca !== cb) return ca.localeCompare(cb) * mul;
      }
      if (drillSort.key === 'chegada') {
        const da = dateMs(a.data_chegada_unid);
        const db = dateMs(b.data_chegada_unid);
        if (da !== db) return (da - db) * mul;
      }
      if (drillSort.key === 'dias_armazem') {
        const da = num(a.dias_armazem);
        const db = num(b.dias_armazem);
        if (da !== db) return (da - db) * mul;
      }
      if (drillSort.key === 'prev_ent') {
        const da = dateMs(a.data_prev_ent);
        const db = dateMs(b.data_prev_ent);
        if (da !== db) return (da - db) * mul;
      }
      if (drillSort.key === 'dias_atraso') {
        const aa = Math.max(0, a.dias_atraso_prev ?? 0);
        const ab = Math.max(0, b.dias_atraso_prev ?? 0);
        if (aa !== ab) return (aa - ab) * mul;
      }
      if (drillSort.key === 'agendado') {
        const aa = a.agendado ? 1 : 0;
        const ab = b.agendado ? 1 : 0;
        if (aa !== ab) return (aa - ab) * mul;
      }
      if (drillSort.key === 'ult_ocor') {
        const aa = num(a.ult_ocor_codigo ?? null);
        const ab = num(b.ult_ocor_codigo ?? null);
        if (aa !== ab) return (aa - ab) * mul;
      }
      if (drillSort.key === 'vlr_merc') {
        const aa = num(a.vlr_merc);
        const ab = num(b.vlr_merc);
        if (aa !== ab) return (aa - ab) * mul;
      }
      if (drillSort.key === 'vlr_frete') {
        const aa = num(a.vlr_frete);
        const ab = num(b.vlr_frete);
        if (aa !== ab) return (aa - ab) * mul;
      }
      const da2 = a.dias_armazem ?? -1;
      const db2 = b.dias_armazem ?? -1;
      if (da2 !== db2) return db2 - da2;
      return (b.seq_cte ?? 0) - (a.seq_cte ?? 0);
    });
    return copy;
  }, [drillRows, drillSort]);

  const drillTotais = useMemo(() => {
    const total = drillRows.length;
    const vlrMerc = drillRows.reduce((s, r) => s + (r.vlr_merc ?? 0), 0);
    const vlrFrete = drillRows.reduce((s, r) => s + (r.vlr_frete ?? 0), 0);
    return { total, vlrMerc, vlrFrete };
  }, [drillRows]);

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
    return [...unitStats].map((u) => ({ ...u, score: calc(u) }));
  }, [unitStats]);

  const unitRankSorted = useMemo(() => {
    const arr = [...unitRank];
    const mul = rankSort.dir === 'asc' ? 1 : -1;
    const num = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? -Infinity : v);
    const str = (v: string | null | undefined) => String(v ?? '').trim().toUpperCase();
    arr.sort((a: any, b: any) => {
      if (rankSort.key === 'unidade') return str(a.unid_atual).localeCompare(str(b.unid_atual)) * mul;
      if (rankSort.key === 'total') return (num(a.total) - num(b.total)) * mul;
      if (rankSort.key === 'parados8') return (num(a.parados8) - num(b.parados8)) * mul;
      if (rankSort.key === 'pend_cliente') return (num(a.pend_cliente) - num(b.pend_cliente)) * mul;
      if (rankSort.key === 'pend_transportadora') return (num(a.pend_transportadora) - num(b.pend_transportadora)) * mul;
      if (rankSort.key === 'max_dias') return (num(a.max_dias_armazem) - num(b.max_dias_armazem)) * mul;
      return (num(a.score) - num(b.score)) * mul;
    });
    return arr;
  }, [unitRank, rankSort]);

  const unitCP = useMemo(() => {
    return [...unitStats]
      .map((u) => {
        const c = u.pend_cliente ?? 0;
        const p = u.pend_transportadora ?? 0;
        const total = c + p;
        return { unidade: u.unid_atual || '—', C: c, P: p, total };
      })
      .filter((u) => (u.C ?? 0) + (u.P ?? 0) > 0)
      .sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  }, [unitStats]);

  const unitHeat = useMemo(() => {
    return [...unitStats].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
  }, [unitStats]);

  const unitDistrib = useMemo(() => {
    const items = [...unitStats].sort((a, b) => (b.total ?? 0) - (a.total ?? 0));
    const top = items.slice(0, 5);
    const restItems = items.slice(5);
    const rest = restItems.reduce((s, u) => s + (u.total ?? 0), 0);
    const label = (sigla: string) => {
      const s = String(sigla ?? '').trim().toUpperCase();
      const nome = unidadesMap[s] || '';
      return nome ? `${s} - ${nome}` : s || '—';
    };
    const sigla = (s: string) => String(s ?? '').trim().toUpperCase() || '—';
    const data = top.map((u) => {
      const s = sigla(u.unid_atual);
      return { name: s, fullName: label(u.unid_atual), value: u.total ?? 0, units: [s] };
    });
    if (rest > 0) {
      const units = restItems.map((u) => sigla(u.unid_atual)).filter((u) => u && u !== '—');
      data.push({ name: 'Demais', fullName: 'Demais', value: rest, units });
    }
    return data;
  }, [unitStats, unidadesMap]);

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
                            <strong>Unidade</strong>: {unidadeLogada}
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
                        Use para identificar o motivo do tempo parado (principalmente pendências do cliente e da transportadora).
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {TODOS_TIPOS_OCOR.map((t) => {
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
                            {TIPOS_OCOR[t]?.label ?? t}
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
              Fonte: Base Presto
            </Badge>
            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">
              Tipos: {tiposSelecionadosTexto}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar CT-e, unidade, pagador, ocorrência..."
              className="h-9 w-full lg:w-[420px] dark:bg-slate-900 dark:border-slate-700"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllFilters}
              className="h-9 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Limpar Filtros
            </Button>
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
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 gap-1 w-fit">
                <button
                  onClick={() => setViewMode('dashboard')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'dashboard'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setViewMode('lista')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    viewMode === 'lista'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  Lista
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={exportarCSVLista} disabled={loading || sortedRows.length === 0} className="h-9 dark:border-slate-700 dark:hover:bg-slate-800">
                <Download className="w-4 h-4" />
                <span className="ml-1.5">CSV</span>
              </Button>
            </div>

            {viewMode === 'dashboard' ? (
              <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <Card
                  className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800 cursor-pointer"
                  onClick={() => openDrill('Total no armazém', () => true)}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Warehouse className="w-3.5 h-3.5" />
                      Total no armazém
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.total}</div>
                  </CardContent>
                </Card>
                <Card
                  className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800 cursor-pointer"
                  onClick={() => openDrill('Parados ≥ 4 dias', (r) => (r.dias_armazem ?? 0) >= 4)}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Parados ≥ 4 dias
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.parados4}</div>
                  </CardContent>
                </Card>
                <Card
                  className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800 cursor-pointer"
                  onClick={() => openDrill('Parados ≥ 8 dias', (r) => (r.dias_armazem ?? 0) >= 8)}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Parados ≥ 8 dias
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.parados8}</div>
                  </CardContent>
                </Card>
                <Card
                  className="bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950 dark:to-rose-900 border-rose-200 dark:border-rose-800 cursor-pointer"
                  onClick={() => openDrill('Atrasados (prev.)', (r) => (r.dias_atraso_prev ?? 0) > 0)}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      Atrasados (prev.)
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.atrasoPrev}</div>
                  </CardContent>
                </Card>
                <Card
                  className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900 border-violet-200 dark:border-violet-800 cursor-pointer"
                  onClick={() => openDrill('Agendados', (r) => !!r.agendado)}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Agendados
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.agendados}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                <Card
                  className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800 cursor-pointer"
                  onClick={() => openDrill('Pendência por culpa do cliente', (r) => String(r.ult_ocor_tipo ?? '').trim().toUpperCase() === 'C')}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
                      Pendência (cliente)
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.pendCliente}</div>
                  </CardContent>
                </Card>
                <Card
                  className="bg-gradient-to-br from-fuchsia-50 to-fuchsia-100 dark:from-fuchsia-950 dark:to-fuchsia-900 border-fuchsia-200 dark:border-fuchsia-800 cursor-pointer"
                  onClick={() => openDrill('Pendência por culpa da transportadora', (r) => String(r.ult_ocor_tipo ?? '').trim().toUpperCase() === 'P')}
                >
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-fuchsia-500" />
                      Pendência (transportadora)
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{totais.pendTransp}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-black text-emerald-600 dark:text-emerald-400">R$</span>
                      Vlr. mercadoria
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtMoney(totais.totalVlrMerc)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900 border-sky-200 dark:border-sky-800">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-black text-sky-600 dark:text-sky-400">R$</span>
                      Vlr. frete
                    </div>
                    <div className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtMoney(totais.totalVlrFrete)}</div>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 border-teal-200 dark:border-teal-800">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <CalendarDays className="w-3.5 h-3.5" />
                      Média dias (armazém)
                    </div>
                    <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmtNum(totais.avgDias, 1)}</div>
                  </CardContent>
                </Card>
              </div>

              {(unitStats.length > 0) && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-amber-50 dark:from-slate-900 dark:to-amber-950/20 lg:col-span-2">
                      <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ranking de pendências por unidade</p>
                          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Todas</Badge>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden bg-white/60 dark:bg-slate-900/40">
                          <div className="grid grid-cols-[minmax(0,220px)_70px_70px_110px_130px_80px_minmax(0,1fr)] gap-2 px-3 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                            <button
                              className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                              onClick={() => setRankSort((s) => ({ key: 'unidade', dir: s.key === 'unidade' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                            >
                              Unidade{rankSort.key === 'unidade' ? (rankSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                            <button
                              className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                              onClick={() => setRankSort((s) => ({ key: 'total', dir: s.key === 'total' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                            >
                              Total{rankSort.key === 'total' ? (rankSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                            <button
                              className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                              onClick={() => setRankSort((s) => ({ key: 'parados8', dir: s.key === 'parados8' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                            >
                              ≥8d{rankSort.key === 'parados8' ? (rankSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                            <button
                              className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                              onClick={() => setRankSort((s) => ({ key: 'pend_cliente', dir: s.key === 'pend_cliente' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                            >
                              Pend. cliente{rankSort.key === 'pend_cliente' ? (rankSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                            <button
                              className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                              onClick={() => setRankSort((s) => ({ key: 'pend_transportadora', dir: s.key === 'pend_transportadora' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                            >
                              Pend. transportadora{rankSort.key === 'pend_transportadora' ? (rankSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                            <button
                              className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                              onClick={() => setRankSort((s) => ({ key: 'max_dias', dir: s.key === 'max_dias' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                            >
                              Máx{rankSort.key === 'max_dias' ? (rankSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                            <button
                              className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                              onClick={() => setRankSort((s) => ({ key: 'score', dir: s.key === 'score' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                            >
                              Indicador{rankSort.key === 'score' ? (rankSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </div>
                          <div className="max-h-[320px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            {unitRankSorted.length === 0 ? (
                              <div className="px-3 py-10 text-sm text-slate-400 dark:text-slate-500 text-center">—</div>
                            ) : (
                              (() => {
                                const maxScore = Math.max(...unitRankSorted.map((u: any) => Number(u.score ?? 0)), 1);
                                return unitRankSorted.map((u: any) => {
                                  const sigla = String(u.unid_atual ?? '').toUpperCase() || '—';
                                  const nome = unidadesMap[sigla] || '';
                                  const pct = Math.round((Number(u.score ?? 0) / maxScore) * 100);
                                  return (
                                    <div key={sigla} className="grid grid-cols-[minmax(0,220px)_70px_70px_110px_130px_80px_minmax(0,1fr)] gap-2 px-3 py-2 text-xs items-center">
                                      <button
                                        className="min-w-0 text-left hover:bg-slate-50 dark:hover:bg-slate-900/60 rounded px-1 -mx-1 transition-colors"
                                        onClick={() => openDrill(`CT-es na unidade ${sigla}${nome ? ` - ${nome}` : ''}`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla)}
                                      >
                                        <div className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{sigla}</div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{nome || '—'}</div>
                                      </button>
                                      <button
                                        className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                        onClick={() => openDrill(`CT-es na unidade ${sigla}${nome ? ` - ${nome}` : ''}`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla)}
                                      >
                                        {u.total ?? 0}
                                      </button>
                                      <button
                                        className="text-right font-mono tabular-nums text-red-700 dark:text-red-300 font-semibold hover:text-red-800 dark:hover:text-red-200 transition-colors"
                                        onClick={() => openDrill(`CT-es na unidade ${sigla}${nome ? ` - ${nome}` : ''} • Parados ≥ 8 dias`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla && (r.dias_armazem ?? 0) >= 8)}
                                      >
                                        {u.parados8 ?? 0}
                                      </button>
                                      <button
                                        className="text-right font-mono tabular-nums text-orange-700 dark:text-orange-300 font-semibold hover:text-orange-800 dark:hover:text-orange-200 transition-colors"
                                        onClick={() => openDrill(`CT-es na unidade ${sigla}${nome ? ` - ${nome}` : ''} • Pendência (cliente)`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla && String(r.ult_ocor_tipo ?? '').trim().toUpperCase() === 'C')}
                                      >
                                        {u.pend_cliente ?? 0}
                                      </button>
                                      <button
                                        className="text-right font-mono tabular-nums text-red-700 dark:text-red-300 font-semibold hover:text-red-800 dark:hover:text-red-200 transition-colors"
                                        onClick={() => openDrill(`CT-es na unidade ${sigla}${nome ? ` - ${nome}` : ''} • Pendência (transportadora)`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla && String(r.ult_ocor_tipo ?? '').trim().toUpperCase() === 'P')}
                                      >
                                        {u.pend_transportadora ?? 0}
                                      </button>
                                      <button
                                        className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                        onClick={() => openDrill(`CT-es na unidade ${sigla}${nome ? ` - ${nome}` : ''} • Máx dias = ${u.max_dias_armazem ?? 0}`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla && (r.dias_armazem ?? 0) === Number(u.max_dias_armazem ?? 0))}
                                      >
                                        {u.max_dias_armazem ?? 0}
                                      </button>
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

                    <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-red-50 dark:from-slate-900 dark:to-red-950/15 lg:aspect-square">
                      <CardContent className="pt-4 pb-3 px-4 flex flex-col h-full">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Pendências por unidade</p>
                          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Cliente / Transport.</Badge>
                        </div>
                        <div className="mt-3 flex-1 overflow-y-auto pr-1">
                          <div style={{ height: Math.max(240, unitCP.length * 28) }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={unitCP} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 0 }} barCategoryGap={10}>
                                <defs>
                                  <linearGradient id="gradPendP" x1="0" x2="1" y1="0" y2="0">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.95} />
                                    <stop offset="100%" stopColor="#7f1d1d" stopOpacity={0.95} />
                                  </linearGradient>
                                  <linearGradient id="gradPendC" x1="0" x2="1" y1="0" y2="0">
                                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.95} />
                                    <stop offset="100%" stopColor="#b45309" stopOpacity={0.95} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis type="category" dataKey="unidade" tick={{ fontSize: 11 }} width={60} />
                                <RechartsTooltip
                                  contentStyle={tooltipStyle as any}
                                  formatter={(value: any, name: any) => [
                                    value,
                                    name === 'P' ? 'Pendência por culpa da transportadora' : name === 'C' ? 'Pendência por culpa do cliente' : String(name),
                                  ]}
                                />
                                <Legend
                                  wrapperStyle={{ fontSize: 11 }}
                                  formatter={(value: any) => (value === 'P' ? 'Pendência (transportadora)' : value === 'C' ? 'Pendência (cliente)' : String(value))}
                                />
                                <Bar
                                  dataKey="P"
                                  fill="url(#gradPendP)"
                                  radius={[0, 8, 8, 0]}
                                  barSize={10}
                                  onClick={(d: any) => {
                                    const sigla = String(d?.payload?.unidade ?? '').trim().toUpperCase() || '—';
                                    const nome = unidadesMap[sigla] || '';
                                    openDrill(`Pendência (transportadora) • ${sigla}${nome ? ` - ${nome}` : ''}`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla && String(r.ult_ocor_tipo ?? '').trim().toUpperCase() === 'P');
                                  }}
                                />
                                <Bar
                                  dataKey="C"
                                  fill="url(#gradPendC)"
                                  radius={[0, 8, 8, 0]}
                                  barSize={10}
                                  onClick={(d: any) => {
                                    const sigla = String(d?.payload?.unidade ?? '').trim().toUpperCase() || '—';
                                    const nome = unidadesMap[sigla] || '';
                                    openDrill(`Pendência (cliente) • ${sigla}${nome ? ` - ${nome}` : ''}`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla && String(r.ult_ocor_tipo ?? '').trim().toUpperCase() === 'C');
                                  }}
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950/20 lg:col-span-2">
                      <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Mapa de tempo de armazém por unidade</p>
                          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">
                            {unitHeat.length} unidade(s)
                          </Badge>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 overflow-hidden">
                          <div className="w-full">
                            <div className="grid grid-cols-[74px_minmax(0,1fr)_64px_52px_52px_52px_60px] md:grid-cols-[74px_minmax(0,1fr)_64px_52px_52px_52px_52px_52px_60px] gap-2 px-2 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                              <span>Sigla</span>
                              <span>Unidade</span>
                              <span className="text-right">Total</span>
                              <span className="text-right hidden md:block">0-1</span>
                              <span className="text-right hidden md:block">2-3</span>
                              <span className="text-right">4-7</span>
                              <span className="text-right">8-15</span>
                              <span className="text-right">16+</span>
                              <span className="text-right">Máx</span>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[360px] overflow-y-auto">
                              {unitHeat.length === 0 ? (
                                <div className="px-3 py-10 text-sm text-slate-400 dark:text-slate-500 text-center">—</div>
                              ) : (
                                unitHeat.map((u) => {
                                  const sigla = String(u.unid_atual ?? '').toUpperCase() || '—';
                                  const nome = unidadesMap[sigla] || '';
                                  const cell = (n: number, tone: 'slate' | 'blue' | 'amber' | 'orange' | 'red', extraClassName = '') => {
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
                                      <span className={`text-right font-mono tabular-nums px-2 py-1 rounded ${bg} ${text} ${extraClassName}`}>
                                        {v.toLocaleString('pt-BR')}
                                      </span>
                                    );
                                  };
                                  return (
                                  <div key={sigla} className="grid grid-cols-[74px_minmax(0,1fr)_64px_52px_52px_52px_60px] md:grid-cols-[74px_minmax(0,1fr)_64px_52px_52px_52px_52px_52px_60px] gap-2 px-2 py-2 text-xs items-center">
                                      <button
                                      className="text-left font-mono font-semibold text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                                        onClick={() => {
                                          openDrill(`CT-es na unidade ${sigla}${nome ? ` - ${nome}` : ''}`, (r) => String(r.unid_atual ?? '').trim().toUpperCase() === sigla);
                                        }}
                                      >
                                        {sigla}
                                      </button>
                                      <div className="min-w-0">
                                        <div className="text-slate-700 dark:text-slate-200 truncate">{nome || '—'}</div>
                                      </div>
                                      <span className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-200">{(u.total ?? 0).toLocaleString('pt-BR')}</span>
                                      {cell(u.b_0_1, 'slate', 'hidden md:inline-block')}
                                      {cell(u.b_2_3, 'blue', 'hidden md:inline-block')}
                                      {cell(u.b_4_7, 'amber')}
                                      {cell(u.b_8_15, 'orange')}
                                      {cell(u.b_16p, 'red')}
                                      {cell(u.max_dias_armazem, 'red')}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-indigo-50 dark:from-slate-900 dark:to-indigo-950/20 lg:aspect-square">
                      <CardContent className="pt-4 pb-3 px-4 flex flex-col h-full">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">CT-es no armazém por unidade</p>
                          <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Distribuição</Badge>
                        </div>
                        <div className="mt-3 flex-1 min-h-[240px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={unitDistrib} dataKey="value" nameKey="name" innerRadius={44} outerRadius={80} stroke="none" cx="35%" cy="50%">
                                {unitDistrib.map((it: any, idx) => {
                                  const palette = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#06b6d4', '#94a3b8'];
                                  return (
                                    <Cell
                                      key={idx}
                                      fill={palette[idx % palette.length]}
                                      className="cursor-pointer"
                                      onClick={() => {
                                        const units = Array.isArray(it?.units) ? (it.units as string[]) : [];
                                        openDrill(`CT-es no armazém • ${String(it?.fullName ?? it?.name ?? '')}`, (r) => units.includes(String(r.unid_atual ?? '').trim().toUpperCase()));
                                      }}
                                    />
                                  );
                                })}
                              </Pie>
                              <RechartsTooltip contentStyle={tooltipStyle as any} formatter={(value: any, _name: any, props: any) => [value, String(props?.payload?.fullName ?? props?.payload?.name ?? '')]} />
                              <Legend
                                layout="vertical"
                                align="right"
                                verticalAlign="middle"
                                wrapperStyle={{ fontSize: 11, lineHeight: '18px', whiteSpace: 'nowrap' }}
                                formatter={(_value: any, entry: any) => String(entry?.payload?.fullName ?? entry?.payload?.name ?? '')}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-blue-50 dark:from-slate-900 dark:to-blue-950/15">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Tempo de armazém por unidade</p>
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">CT-es</Badge>
                    </div>
                    <div className="mt-3 h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={buckets} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                          <XAxis dataKey="unidade" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RechartsTooltip contentStyle={tooltipStyle as any} />
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

                <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950/20">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Motivo (tipo de ocorrência)</p>
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Última ocorrência</Badge>
                    </div>
                    <div className="mt-3 h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={pieMotivos} dataKey="count" nameKey="tipo" outerRadius={80} innerRadius={44} stroke="none" cx="35%" cy="50%">
                            {pieMotivos.map((it, idx) => {
                              const t = String((it as any).tipoKey ?? '—').toUpperCase();
                              const tone = (TIPOS_OCOR[t]?.tone ?? 'slate') as any;
                              const color =
                                tone === 'red' ? '#ef4444' :
                                tone === 'orange' ? '#f97316' :
                                tone === 'emerald' ? '#10b981' :
                                tone === 'violet' ? '#8b5cf6' :
                                tone === 'amber' ? '#f59e0b' :
                                '#94a3b8';
                              return (
                                <Cell
                                  key={idx}
                                  fill={color}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    const label = String((it as any).tipo ?? '');
                                    openDrill(`Motivo • ${label}`, (r) => {
                                      const rt = String(r.ult_ocor_tipo ?? '').trim().toUpperCase() || '—';
                                      return rt === t;
                                    });
                                  }}
                                />
                              );
                            })}
                          </Pie>
                          <RechartsTooltip contentStyle={tooltipStyle as any} />
                          <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, lineHeight: '18px', whiteSpace: 'nowrap' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-red-50 dark:from-slate-900 dark:to-red-950/15">
                  <CardContent className="pt-4 pb-3 px-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Top pendências</p>
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">Códigos</Badge>
                    </div>
                    <div className="mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {topOcorrencias.length === 0 ? (
                        <div className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">—</div>
                      ) : (
                        topOcorrencias.map((o) => {
                          const tipo = (o.tipo || '').toUpperCase();
                          const t = TIPOS_OCOR[tipo]?.tone ?? 'slate';
                          const tipoLabel = TIPOS_OCOR[tipo]?.label ?? tipo;
                          return (
                            <button
                              key={`${o.codigo}-${o.tipo}`}
                              className="w-full text-left flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-2 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors"
                              onClick={() => {
                                const cod = Number(o.codigo);
                                openDrill(`CT-es com pendência ${o.codigo}${o.desc ? ` - ${o.desc}` : ''}`, (r) => Number(r.ult_ocor_codigo ?? 0) === cod);
                              }}
                            >
                              <Badge className={`${toneClasses(t)} text-[11px] shrink-0`}>{o.codigo}</Badge>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  {tipo ? <Badge className={`${toneClasses(t)} text-[11px]`}>{tipoLabel}</Badge> : null}
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
              </div>
            ) : (
              <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
                <CardContent className="p-0">
                  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">CT-es em armazém (todas as unidades)</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Priorize pelo “Dias no armazém” e observe as pendências do cliente e da transportadora para entender o motivo.
                      </p>
                    </div>
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">
                      {sortedRows.length} registros{rows.length !== sortedRows.length ? ` (de ${rows.length})` : ''} • {page}/{totalPages}
                    </Badge>
                  </div>

                  <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden relative">
                    <table className="w-full text-sm table-fixed">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                        <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <th className="px-3 py-2 text-left whitespace-nowrap w-[120px]">
                            <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'unidade', dir: s.key === 'unidade' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))}>
                              Unidade{sort.key === 'unidade' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left whitespace-nowrap w-[90px]">CT-e</th>
                          <th className="px-3 py-2 text-left whitespace-nowrap w-[80px]">
                            <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'chegada', dir: s.key === 'chegada' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}>
                              Chegada{sort.key === 'chegada' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-right whitespace-nowrap w-[64px]">
                            <button className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'dias_armazem', dir: s.key === 'dias_armazem' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}>
                              Dias{sort.key === 'dias_armazem' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left whitespace-nowrap w-[80px]">
                            <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'prev_ent', dir: s.key === 'prev_ent' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}>
                              Prev. Ent.{sort.key === 'prev_ent' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-right whitespace-nowrap w-[64px]">
                            <button className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'dias_atraso', dir: s.key === 'dias_atraso' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}>
                              Atraso{sort.key === 'dias_atraso' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-center whitespace-nowrap w-[70px]">
                            <button className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'agendado', dir: s.key === 'agendado' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}>
                              Agend.{sort.key === 'agendado' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left whitespace-nowrap w-[220px]">
                            <button className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'ult_ocor', dir: s.key === 'ult_ocor' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}>
                              Últ. ocorrência{sort.key === 'ult_ocor' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-left whitespace-nowrap">Complemento</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap w-[110px]">
                            <button className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'vlr_merc', dir: s.key === 'vlr_merc' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}>
                              Vlr Merc.{sort.key === 'vlr_merc' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                          <th className="px-3 py-2 text-right whitespace-nowrap w-[110px]">
                            <button className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors" onClick={() => setSort((s) => ({ key: 'vlr_frete', dir: s.key === 'vlr_frete' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}>
                              Frete{sort.key === 'vlr_frete' ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </button>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedRows.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="px-3 py-10 text-center text-slate-400 dark:text-slate-500">
                              Nenhum CT-e encontrado com os filtros atuais.
                            </td>
                          </tr>
                        ) : (
                          pagedRows.map((r) => {
                            const cte = fmtCte(r.ser_cte, r.nro_cte);
                            const tipo = String(r.ult_ocor_tipo ?? '').trim().toUpperCase();
                            const tone = TIPOS_OCOR[tipo]?.tone ?? 'slate';
                            const tipoLabel = TIPOS_OCOR[tipo]?.label ?? (tipo ? tipo : '');
                            const dias = r.dias_armazem ?? 0;
                            const atraso = r.dias_atraso_prev ?? 0;
                            const sigla = String(r.unid_atual ?? '').toUpperCase() || '—';
                            const nomeUnid = unidadesMap[sigla] || '';

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
                                <td className="px-3 py-2 whitespace-nowrap w-[120px]">
                                  <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{sigla}</div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{nomeUnid || '—'}</div>
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                  {cte}
                                </td>
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                                  {fmtDateBR2y(r.data_chegada_unid)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                                  <span className={dias >= 8 ? 'text-red-700 dark:text-red-300 font-bold' : dias >= 4 ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-slate-700 dark:text-slate-200'}>
                                    {dias}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                                  {fmtDateBR2y(r.data_prev_ent)}
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
                                    {tipoLabel ? <Badge className={`${toneClasses(tone)} text-[11px]`}>{tipoLabel}</Badge> : null}
                                    <span className="text-xs text-slate-700 dark:text-slate-200 truncate max-w-[220px]">
                                      {r.ult_ocor_descricao || 'Sem ocorrência'}
                                    </span>
                                  </div>
                                  {(r.ult_ocor_data || r.ult_ocor_hora) && (
                                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {fmtDateBR(r.ult_ocor_data)} {String(r.ult_ocor_hora ?? '').slice(0, 5)}
                                    </div>
                                  )}
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
                  <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                    <table className="w-full text-sm table-fixed">
                      <tbody>
                        <tr className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                          <td className="px-3 py-2 whitespace-nowrap w-[120px]">TOTAL</td>
                          <td className="px-3 py-2 whitespace-nowrap w-[90px]">{listaTotais.total.toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 w-[80px]" />
                          <td className="px-3 py-2 w-[64px]" />
                          <td className="px-3 py-2 w-[80px]" />
                          <td className="px-3 py-2 w-[64px]" />
                          <td className="px-3 py-2 w-[70px]" />
                          <td className="px-3 py-2 w-[220px]" />
                          <td className="px-3 py-2" />
                          <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap w-[110px]">{fmtMoney(listaTotais.vlrMerc)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap w-[110px]">{fmtMoney(listaTotais.vlrFrete)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="dark:border-slate-700" disabled={page <= 1} onClick={() => setPage(1)}>
                        «
                      </Button>
                      <Button variant="outline" size="sm" className="dark:border-slate-700" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                        Anterior
                      </Button>
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        Página {page} de {totalPages}
                      </span>
                      <Button variant="outline" size="sm" className="dark:border-slate-700" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                        Próxima
                      </Button>
                      <Button variant="outline" size="sm" className="dark:border-slate-700" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                        »
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-7xl h-[85vh] flex flex-col overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="shrink-0 pr-16">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-slate-900 dark:text-slate-100 truncate">{drillTitle || 'CT-es'}</DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">Lista de CT-es que compõem o indicador.</DialogDescription>
              </div>
              {drillRows.length > 0 && (
                <Button variant="outline" size="sm" onClick={exportarDrillCSV} className="gap-2 shrink-0 dark:border-slate-700">
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
                <table className="w-full text-sm table-fixed">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                    <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[6%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'unidade', dir: s.key === 'unidade' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                        >
                          Unid.{drillSort.key === 'unidade' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[10%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'cte', dir: s.key === 'cte' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                        >
                          CT-e{drillSort.key === 'cte' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[9%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'chegada', dir: s.key === 'chegada' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Cheg.{drillSort.key === 'chegada' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[6%]">
                        <button
                          className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'dias_armazem', dir: s.key === 'dias_armazem' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Dias{drillSort.key === 'dias_armazem' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[9%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'prev_ent', dir: s.key === 'prev_ent' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Prev.{drillSort.key === 'prev_ent' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[6%]">
                        <button
                          className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'dias_atraso', dir: s.key === 'dias_atraso' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Atr.{drillSort.key === 'dias_atraso' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-center whitespace-nowrap w-[6%]">
                        <button
                          className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'agendado', dir: s.key === 'agendado' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Ag.{drillSort.key === 'agendado' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-left whitespace-nowrap w-[20%]">
                        <button
                          className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'ult_ocor', dir: s.key === 'ult_ocor' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Últ. ocor.{drillSort.key === 'ult_ocor' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[14%]">
                        <button
                          className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'vlr_merc', dir: s.key === 'vlr_merc' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Vlr Merc.{drillSort.key === 'vlr_merc' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                      <th className="px-3 py-2 text-right whitespace-nowrap w-[14%]">
                        <button
                          className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                          onClick={() => setDrillSort((s) => ({ key: 'vlr_frete', dir: s.key === 'vlr_frete' ? (s.dir === 'asc' ? 'desc' : 'asc') : 'desc' }))}
                        >
                          Frete{drillSort.key === 'vlr_frete' ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {drillSortedRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-3 py-10 text-center text-slate-400 dark:text-slate-500">
                          Nenhum CT-e neste grupo.
                        </td>
                      </tr>
                    ) : (
                      drillSortedRows.map((r) => {
                        const cte = fmtCte(r.ser_cte, r.nro_cte);
                        const tipo = String(r.ult_ocor_tipo ?? '').trim().toUpperCase();
                        const tone = TIPOS_OCOR[tipo]?.tone ?? 'slate';
                        const dias = r.dias_armazem ?? 0;
                        const atraso = r.dias_atraso_prev ?? 0;
                        const sigla = String(r.unid_atual ?? '').toUpperCase() || '—';
                        const rowTone =
                          tipo === 'P'
                            ? 'bg-red-50/50 dark:bg-red-950/15'
                            : tipo === 'C'
                              ? 'bg-orange-50/50 dark:bg-orange-950/15'
                              : r.agendado
                                ? 'bg-violet-50/40 dark:bg-violet-950/15'
                                : '';

                        return (
                          <tr key={r.seq_cte} className={rowTone}>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{sigla}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{cte}</td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">{fmtDateBR2y(r.data_chegada_unid)}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className={dias >= 8 ? 'text-red-700 dark:text-red-300 font-bold' : dias >= 4 ? 'text-amber-700 dark:text-amber-300 font-bold' : 'text-slate-700 dark:text-slate-200'}>
                                {dias}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">{fmtDateBR2y(r.data_prev_ent)}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap">
                              <span className={atraso > 0 ? 'text-red-700 dark:text-red-300 font-bold' : 'text-slate-700 dark:text-slate-200'}>{atraso > 0 ? atraso : 0}</span>
                            </td>
                            <td className="px-3 py-2 text-center whitespace-nowrap">
                              {r.agendado ? <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200 text-[11px]">SIM</Badge> : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <div className="flex items-center gap-2 min-w-0">
                                {r.ult_ocor_codigo !== null ? (
                                  <Badge className={`${toneClasses(tone)} text-[11px] font-mono shrink-0`}>{r.ult_ocor_codigo}</Badge>
                                ) : (
                                  <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[11px] shrink-0">—</Badge>
                                )}
                                <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
                                  {r.ult_ocor_descricao || 'Sem ocorrência'}
                                </span>
                              </div>
                              {(r.ult_ocor_data || r.ult_ocor_hora) && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  {fmtDateBR2y(r.ult_ocor_data)} {String(r.ult_ocor_hora ?? '').slice(0, 5)}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtMoney(r.vlr_merc)}</td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtMoney(r.vlr_frete)}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                <table className="w-full text-sm table-fixed">
                  <tbody>
                    <tr className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <td className="px-3 py-2 whitespace-nowrap w-[6%]">TOTAL</td>
                      <td className="px-3 py-2 whitespace-nowrap w-[10%]">{drillTotais.total.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 w-[9%]" />
                      <td className="px-3 py-2 w-[6%]" />
                      <td className="px-3 py-2 w-[9%]" />
                      <td className="px-3 py-2 w-[6%]" />
                      <td className="px-3 py-2 w-[6%]" />
                      <td className="px-3 py-2 w-[20%]" />
                      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap w-[14%]">{fmtMoney(drillTotais.vlrMerc)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap w-[14%]">{fmtMoney(drillTotais.vlrFrete)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
