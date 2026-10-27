import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { ChevronDown, Download, Loader2, Search, X } from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { toast } from 'sonner';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTooltipStyle } from '../dashboards/CustomTooltip';
import { usePageTitle } from '../../hooks/usePageTitle';
import { CteDetalhesDialog, type CteDetalhesData } from '../dashboards/CteDetalhesDialog';
import { getDefaultHeaders } from '../../utils/apiUtils';

type SortDir = 'asc' | 'desc';
type SortKey =
  | 'data_emissao'
  | 'data_prev_ent'
  | 'data_entrega'
  | 'ser_cte'
  | 'nro_cte'
  | 'sigla_emit'
  | 'sigla_dest'
  | 'nome_pag'
  | 'nome_emit'
  | 'nome_dest'
  | 'vlr_frete'
  | 'vlr_merc'
  | 'peso_real'
  | 'cubagem'
  | 'qtde_vol';

type SerieModo = 'frete' | 'merc' | 'ctes' | 'custo' | 'frete_custo';

interface UnidadeItem {
  sigla: string;
  nome?: string;
}

interface ClienteItem {
  cnpj: string;
  nome: string;
}

interface MercadoriaItem {
  codigo: number;
  descricao: string;
}

interface VendedorItem {
  login: string;
  nome: string;
}

interface RelacaoFilters {
  emissaoIni: string;
  emissaoFim: string;
  prevEntregaIni: string;
  prevEntregaFim: string;
  entregaIni: string;
  entregaFim: string;
  unidadesOrigem: string[];
  unidadesDestino: string[];
  cnpjsPagadores: string[];
  cnpjsRemetentes: string[];
  cnpjsDestinatarios: string[];
  codMercadoria: number | null;
  tpDocumento: string[];
  tpFrete: '' | 'C' | 'F';
  liquidacao: '' | 'P' | 'L';
  entrega: '' | 'P' | 'E';
  serCte: string;
  nroCte: string;
  nroNf: string;
  vendedorLogin: string;
}

interface LinhaCte {
  seq_cte: number;
  ser_cte: string;
  nro_cte: number;
  data_emissao: string;
  data_chegada_unid: string;
  data_prev_ent: string;
  data_entrega: string;
  sigla_emit: string;
  sigla_dest: string;
  unid_atual: string;
  tp_documento: string;
  tp_frete: string;
  nome_pag: string;
  nome_emit: string;
  nome_dest: string;
  cod_mercadoria: number | null;
  qtde_vol: number;
  cubagem: number;
  peso_real: number;
  peso_calc: number;
  vlr_frete: number;
  vlr_merc: number;
  placa_coleta: string;
  nfs: string;
  cep_entrega: string;
  endereco_entrega: string;
  bairro_entrega: string;
  custo_seguro: number;
  custo_icms: number;
  custo_pis_cofins: number;
  custo_gris: number;
  custo_pedagio: number;
  custo_expedicao: number;
  custo_transbordo: number;
  custo_vendedor: number;
  custo_recepcao: number;
  custo_desp_div: number;
  custo_transferencia_real: number;
  liquidado: boolean;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const fmtIso = (d: Date) => d.toISOString().slice(0, 10);
const fmtDateBR = (iso?: string) => {
  const s = String(iso || '').slice(0, 10);
  if (!s || !/^\d{4}\-\d{2}\-\d{2}$/.test(s)) return '—';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};
const fmtMoney = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtKg = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const fmtM3 = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
const fmtCte = (ser: string, nro: number) => `${String(ser || '').toUpperCase()}${String(nro || 0).padStart(6, '0')}`;

const TP_DOCUMENTO_OPTIONS = [
  'TODOS',
  'ARMAZENAGEM',
  'CARGA FECHADA',
  'COMPLEMENTAR FRETE',
  'CORTESIA',
  'DEVOLUCAO',
  'MANUAL',
  'NORMAL',
  'PRES SERVICO',
  'REDESPACHO',
  'REDESPACHO INTERMEDIARIO',
  'REENTREGA',
  'REVERSA',
  'SUBC EXP FORM LISO',
  'SUBC FEC FORM CTRC',
  'SUBC FORM CTRC',
  'SUBC REC FORM LISO',
  'SUBSTITUTO',
];

export function RelacaoCTes() {
  usePageTitle('Relação de CT-es');

  const tooltipStyle = useTooltipStyle();

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'data_emissao', dir: 'desc' });
  const [serieModo, setSerieModo] = useState<SerieModo>('frete');
  const [serieUnidModo, setSerieUnidModo] = useState<'paralelo' | 'empilhado'>('paralelo');

  const [rows, setRows] = useState<LinhaCte[]>([]);
  const [donutUnidades, setDonutUnidades] = useState<Array<{ name: string; value: number }>>([]);
  const [donutClientes, setDonutClientes] = useState<Array<{ name: string; value: number }>>([]);
  const [serie, setSerie] = useState<Array<{ dia: string; qtde_ctes: number; vlr_frete: number; vlr_merc: number; vlr_custo: number }>>([]);
  const [serieUnidades, setSerieUnidades] = useState<Array<{ dia: string; unid: string; vlr_frete: number }>>([]);

  const [cteDialogOpen, setCteDialogOpen] = useState(false);
  const [cteDialogData, setCteDialogData] = useState<CteDetalhesData | null>(null);

  const [filters, setFilters] = useState<RelacaoFilters>(() => {
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    return {
      emissaoIni: fmtIso(start),
      emissaoFim: fmtIso(end),
      prevEntregaIni: '',
      prevEntregaFim: '',
      entregaIni: '',
      entregaFim: '',
      unidadesOrigem: [],
      unidadesDestino: [],
      cnpjsPagadores: [],
      cnpjsRemetentes: [],
      cnpjsDestinatarios: [],
      codMercadoria: null,
      tpDocumento: [],
      tpFrete: '',
      liquidacao: '',
      entrega: '',
      serCte: '',
      nroCte: '',
      nroNf: '',
      vendedorLogin: '',
    };
  });

  const [tempFilters, setTempFilters] = useState<RelacaoFilters>(filters);

  const [selUnidOrigem, setSelUnidOrigem] = useState<UnidadeItem[]>([]);
  const [selUnidDestino, setSelUnidDestino] = useState<UnidadeItem[]>([]);
  const [selPagadores, setSelPagadores] = useState<ClienteItem[]>([]);
  const [selRemetentes, setSelRemetentes] = useState<ClienteItem[]>([]);
  const [selDestinatarios, setSelDestinatarios] = useState<ClienteItem[]>([]);
  const [selMercadoria, setSelMercadoria] = useState<MercadoriaItem | null>(null);
  const [selVendedor, setSelVendedor] = useState<VendedorItem | null>(null);

  const [searchUnidOrigem, setSearchUnidOrigem] = useState('');
  const [searchUnidDestino, setSearchUnidDestino] = useState('');
  const [searchPagador, setSearchPagador] = useState('');
  const [searchRemetente, setSearchRemetente] = useState('');
  const [searchDestinatario, setSearchDestinatario] = useState('');
  const [searchMercadoria, setSearchMercadoria] = useState('');
  const [searchVendedor, setSearchVendedor] = useState('');

  const [optUnidOrigem, setOptUnidOrigem] = useState<UnidadeItem[]>([]);
  const [optUnidDestino, setOptUnidDestino] = useState<UnidadeItem[]>([]);
  const [optPagadores, setOptPagadores] = useState<ClienteItem[]>([]);
  const [optRemetentes, setOptRemetentes] = useState<ClienteItem[]>([]);
  const [optDestinatarios, setOptDestinatarios] = useState<ClienteItem[]>([]);
  const [optMercadorias, setOptMercadorias] = useState<MercadoriaItem[]>([]);
  const [optVendedores, setOptVendedores] = useState<VendedorItem[]>([]);

  const unidTimer = useRef<any>(null);
  const cliTimer = useRef<any>(null);
  const mercTimer = useRef<any>(null);
  const vendTimer = useRef<any>(null);

  const carregar = async (p?: number, s?: { key: SortKey; dir: SortDir }, f?: RelacaoFilters) => {
    const pageToLoad = p ?? page;
    const sortToLoad = s ?? sort;
    const filt = f ?? filters;
    try {
      setLoading(true);
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/relatorios/relacao_ctes.php`,
        {
          method: 'POST',
          body: JSON.stringify({
            page: pageToLoad,
            pageSize,
            sortKey: sortToLoad.key,
            sortDir: sortToLoad.dir,
            filters: {
              ...filt,
              codMercadoria: filt.codMercadoria ?? '',
            },
          }),
        },
        true
      );

      if (!res?.success) {
        toast.error('Erro ao carregar relação', { description: res?.message || 'Falha ao consultar.' });
        setRows([]);
        setDonutUnidades([]);
        setDonutClientes([]);
        setSerie([]);
        setSerieUnidades([]);
        setTotal(0);
        setTotalPages(1);
        return;
      }

      setRows(Array.isArray(res.rows) ? res.rows : []);
      setDonutUnidades(Array.isArray(res?.donuts?.unidades) ? res.donuts.unidades : []);
      setDonutClientes(Array.isArray(res?.donuts?.clientes) ? res.donuts.clientes : []);
      setSerie(Array.isArray(res?.serie) ? res.serie : []);
      setSerieUnidades(Array.isArray(res?.serie_unidades) ? res.serie_unidades : []);
      setTotal(Number(res.total ?? 0) || 0);
      setTotalPages(Number(res.totalPages ?? 1) || 1);
      setPage(Number(res.page ?? pageToLoad) || pageToLoad);
    } catch (e: any) {
      toast.error('Erro ao carregar relação', { description: e?.message || 'Falha inesperada.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(1, sort, filters);
  }, []);

  const toggleSort = (key: SortKey, defaultDir: SortDir = 'asc') => {
    setSort((prev) => {
      const dir: SortDir = prev.key === key ? (prev.dir === 'asc' ? 'desc' : 'asc') : defaultDir;
      const next = { key, dir };
      setPage(1);
      carregar(1, next, filters);
      return next;
    });
  };

  const exportarCsv = async () => {
    try {
      setExporting(true);
      const resp = await fetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/relacao_ctes_export_csv.php`, {
        method: 'POST',
        headers: getDefaultHeaders(),
        body: JSON.stringify({
          sortKey: sort.key,
          sortDir: sort.dir,
          filters: {
            ...filters,
            codMercadoria: filters.codMercadoria ?? '',
          },
        }),
      });

      if (!resp.ok) {
        toast.error('Falha ao exportar');
        return;
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relacao_ctes_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exportado');
    } catch (e: any) {
      toast.error('Erro ao exportar', { description: e?.message || 'Falha inesperada.' });
    } finally {
      setExporting(false);
    }
  };

  const openCte = (r: LinhaCte) => {
    const data: CteDetalhesData = {
      serCte: r.ser_cte,
      nroCte: r.nro_cte,
      seqCte: r.seq_cte,
      emissao: fmtDateBR(r.data_emissao),
      prevEnt: fmtDateBR(r.data_prev_ent),
      chegadaUnid: fmtDateBR(r.data_chegada_unid),
      unidAtual: r.unid_atual,
      unidadeOrigem: r.sigla_emit,
      unidadeDest: r.sigla_dest,
      remetente: r.nome_emit,
      pagador: r.nome_pag,
      destinatario: r.nome_dest,
      placaColeta: r.placa_coleta,
      nfiscal: '',
      frete: r.vlr_frete,
      vlrMerc: r.vlr_merc,
      pesoReal: r.peso_real,
      pesoCalc: r.peso_calc,
      cubagem: r.cubagem,
      qtdeVol: r.qtde_vol,
      cepEntrega: r.cep_entrega,
      enderecoEntrega: r.endereco_entrega,
      bairroEntrega: r.bairro_entrega,
      custoSeguro: r.custo_seguro,
      custoIcms: r.custo_icms,
      custoPisCofins: r.custo_pis_cofins,
      custoGris: r.custo_gris,
      custoPedagio: r.custo_pedagio,
      custoExpedicao: r.custo_expedicao,
      custoTransbordo: r.custo_transbordo,
      custoVendedor: r.custo_vendedor,
      custoRecepcao: r.custo_recepcao,
      custoDespDiv: r.custo_desp_div,
      custoTransferenciaReal: r.custo_transferencia_real,
    };
    setCteDialogData(data);
    setCteDialogOpen(true);
  };

  const serieData = useMemo(() => {
    return serie.map((it) => ({
      ...it,
      vlr_custo: Number(it.vlr_custo || 0) || 0,
      vlr_frete_custo: (Number(it.vlr_frete || 0) || 0) + (Number(it.vlr_custo || 0) || 0),
      label: fmtDateBR(it.dia),
    }));
  }, [serie]);

  const donutColors = ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f97316', '#10b981', '#eab308'];

  const donutUnidadesData = useMemo(() => {
    const arr = [...donutUnidades];
    const idx = arr.findIndex((d) => d.name === 'DEMAIS');
    if (idx >= 0) arr.push(arr.splice(idx, 1)[0]);
    return arr;
  }, [donutUnidades]);

  const donutClientesData = useMemo(() => {
    const arr = [...donutClientes];
    const idx = arr.findIndex((d) => d.name === 'DEMAIS');
    if (idx >= 0) arr.push(arr.splice(idx, 1)[0]);
    return arr;
  }, [donutClientes]);

  const serieUnidKeys = useMemo(() => {
    const present = new Set(serieUnidades.map((x) => String(x.unid || '')).filter((s) => s !== ''));
    const ordered = donutUnidadesData.map((d) => d.name).filter((n) => present.has(n));
    const rest = Array.from(present)
      .filter((n) => !ordered.includes(n))
      .sort((a, b) => a.localeCompare(b));
    return [...ordered, ...rest];
  }, [donutUnidadesData, serieUnidades]);

  const serieUnidData = useMemo(() => {
    const m = new Map<string, any>();
    for (const it of serieUnidades) {
      const dia = String(it.dia || '').slice(0, 10);
      if (!dia) continue;
      const unid = String(it.unid || '').trim() || '—';
      const vlr = Number(it.vlr_frete || 0) || 0;
      let row = m.get(dia);
      if (!row) {
        row = { dia, label: fmtDateBR(dia) };
        m.set(dia, row);
      }
      row[unid] = vlr;
    }
    const arr = Array.from(m.values()).sort((a, b) => String(a.dia).localeCompare(String(b.dia)));
    for (const row of arr) {
      for (const k of serieUnidKeys) {
        if (row[k] == null) row[k] = 0;
      }
    }
    return arr;
  }, [serieUnidKeys, serieUnidades]);

  const resetFiltros = () => {
    setSelUnidOrigem([]);
    setSelUnidDestino([]);
    setSelPagadores([]);
    setSelRemetentes([]);
    setSelDestinatarios([]);
    setSelMercadoria(null);
    setSelVendedor(null);
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    setTempFilters({
      emissaoIni: fmtIso(start),
      emissaoFim: fmtIso(end),
      prevEntregaIni: '',
      prevEntregaFim: '',
      entregaIni: '',
      entregaFim: '',
      unidadesOrigem: [],
      unidadesDestino: [],
      cnpjsPagadores: [],
      cnpjsRemetentes: [],
      cnpjsDestinatarios: [],
      codMercadoria: null,
      tpDocumento: [],
      tpFrete: '',
      liquidacao: '',
      entrega: '',
      serCte: '',
      nroCte: '',
      nroNf: '',
      vendedorLogin: '',
    });
  };

  const aplicarFiltros = () => {
    const next: RelacaoFilters = {
      ...tempFilters,
      unidadesOrigem: selUnidOrigem.map((u) => u.sigla),
      unidadesDestino: selUnidDestino.map((u) => u.sigla),
      cnpjsPagadores: selPagadores.map((c) => c.cnpj),
      cnpjsRemetentes: selRemetentes.map((c) => c.cnpj),
      cnpjsDestinatarios: selDestinatarios.map((c) => c.cnpj),
      codMercadoria: selMercadoria ? selMercadoria.codigo : null,
      vendedorLogin: selVendedor ? selVendedor.login : '',
    };
    setFilters(next);
    setPage(1);
    carregar(1, sort, next);
  };

  const buscarUnidades = (term: string, target: 'origem' | 'destino') => {
    if (unidTimer.current) clearTimeout(unidTimer.current);
    unidTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/search_unidades.php`,
          { method: 'POST', body: JSON.stringify({ search: term }) },
          true
        );
        const list = Array.isArray(res?.unidades) ? res.unidades : [];
        const mapped: UnidadeItem[] = list.map((u: any) => ({ sigla: String(u.sigla || '').toUpperCase(), nome: String(u.nome || '') }));
        if (target === 'origem') setOptUnidOrigem(mapped);
        else setOptUnidDestino(mapped);
      } catch {
        if (target === 'origem') setOptUnidOrigem([]);
        else setOptUnidDestino([]);
      }
    }, 250);
  };

  const buscarClientes = (term: string, target: 'pag' | 'rem' | 'dest') => {
    if (cliTimer.current) clearTimeout(cliTimer.current);
    cliTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/search_clientes.php`,
          { method: 'POST', body: JSON.stringify({ search: term }) },
          true
        );
        const list = Array.isArray(res?.clientes) ? res.clientes : [];
        const mapped: ClienteItem[] = list.map((c: any) => ({ cnpj: String(c.cnpj || ''), nome: String(c.nome || '') }));
        if (target === 'pag') setOptPagadores(mapped);
        if (target === 'rem') setOptRemetentes(mapped);
        if (target === 'dest') setOptDestinatarios(mapped);
      } catch {
        if (target === 'pag') setOptPagadores([]);
        if (target === 'rem') setOptRemetentes([]);
        if (target === 'dest') setOptDestinatarios([]);
      }
    }, 250);
  };

  const buscarMercadorias = (term: string) => {
    if (mercTimer.current) clearTimeout(mercTimer.current);
    mercTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/relatorios/search_mercadorias.php`,
          { method: 'POST', body: JSON.stringify({ search: term }) },
          true
        );
        const list = Array.isArray(res?.mercadorias) ? res.mercadorias : [];
        const mapped: MercadoriaItem[] = list.map((m: any) => ({ codigo: Number(m.codigo || 0), descricao: String(m.descricao || '') }));
        setOptMercadorias(mapped);
      } catch {
        setOptMercadorias([]);
      }
    }, 250);
  };

  const buscarVendedores = (term: string) => {
    if (vendTimer.current) clearTimeout(vendTimer.current);
    vendTimer.current = setTimeout(async () => {
      try {
        const res = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/relatorios/search_vendedores.php`,
          { method: 'POST', body: JSON.stringify({ search: term }) },
          true
        );
        const list = Array.isArray(res?.vendedores) ? res.vendedores : [];
        const mapped: VendedorItem[] = list.map((v: any) => ({ login: String(v.login || ''), nome: String(v.nome || '') }));
        setOptVendedores(mapped);
      } catch {
        setOptVendedores([]);
      }
    }, 250);
  };

  useEffect(() => {
    buscarMercadorias('');
    buscarVendedores('');
  }, []);

  const SortBtn = ({ k, label, align = 'left', defaultDir = 'asc' }: { k: SortKey; label: string; align?: 'left' | 'right' | 'center'; defaultDir?: SortDir }) => (
    <button
      type="button"
      className={`hover:text-slate-900 dark:hover:text-slate-100 transition-colors ${align === 'right' ? 'text-right w-full' : align === 'center' ? 'text-center w-full' : 'text-left'}`}
      onClick={() => toggleSort(k, defaultDir)}
    >
      {label}
      {sort.key === k ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </button>
  );

  return (
    <AdminLayout title="RELAÇÃO DE CT-es" companyFirst>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Relação de CT-es</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Consulta completa com filtros avançados, indicadores e exportação.</p>
          </div>
        </div>

        <details open className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
          <summary className="px-4 py-3 cursor-pointer select-none flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filtros</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Defina o período e demais critérios, depois clique em Gerar.</div>
            </div>
            <div className="flex items-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-slate-500" /> : null}
              <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
            </div>
          </summary>

          <div className="p-4 space-y-5">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 bg-slate-50/60 dark:bg-slate-900/40">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Período de emissão</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date(end.getFullYear(), end.getMonth(), 1);
                        setTempFilters((p) => ({ ...p, emissaoIni: fmtIso(start), emissaoFim: fmtIso(end) }));
                      }}
                    >
                      Mês
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const end = new Date(now.getFullYear(), now.getMonth(), 0);
                        setTempFilters((p) => ({ ...p, emissaoIni: fmtIso(start), emissaoFim: fmtIso(end) }));
                      }}
                    >
                      Mês Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => setTempFilters((p) => ({ ...p, emissaoIni: todayIso(), emissaoFim: todayIso() }))}
                    >
                      Hoje
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Início</Label>
                    <Input type="date" value={tempFilters.emissaoIni} onChange={(e) => setTempFilters((p) => ({ ...p, emissaoIni: e.target.value }))} className="dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Fim</Label>
                    <Input type="date" value={tempFilters.emissaoFim} onChange={(e) => setTempFilters((p) => ({ ...p, emissaoFim: e.target.value }))} className="dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Período de previsão de entrega</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date(end.getFullYear(), end.getMonth(), 1);
                        setTempFilters((p) => ({ ...p, prevEntregaIni: fmtIso(start), prevEntregaFim: fmtIso(end) }));
                      }}
                    >
                      Mês
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const end = new Date(now.getFullYear(), now.getMonth(), 0);
                        setTempFilters((p) => ({ ...p, prevEntregaIni: fmtIso(start), prevEntregaFim: fmtIso(end) }));
                      }}
                    >
                      Mês Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => setTempFilters((p) => ({ ...p, prevEntregaIni: todayIso(), prevEntregaFim: todayIso() }))}
                    >
                      Hoje
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Início</Label>
                    <Input type="date" value={tempFilters.prevEntregaIni} onChange={(e) => setTempFilters((p) => ({ ...p, prevEntregaIni: e.target.value }))} className="dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Fim</Label>
                    <Input type="date" value={tempFilters.prevEntregaFim} onChange={(e) => setTempFilters((p) => ({ ...p, prevEntregaFim: e.target.value }))} className="dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Período de entrega/baixa</div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => {
                        const end = new Date();
                        const start = new Date(end.getFullYear(), end.getMonth(), 1);
                        setTempFilters((p) => ({ ...p, entregaIni: fmtIso(start), entregaFim: fmtIso(end) }));
                      }}
                    >
                      Mês
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => {
                        const now = new Date();
                        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                        const end = new Date(now.getFullYear(), now.getMonth(), 0);
                        setTempFilters((p) => ({ ...p, entregaIni: fmtIso(start), entregaFim: fmtIso(end) }));
                      }}
                    >
                      Mês Anterior
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => setTempFilters((p) => ({ ...p, entregaIni: todayIso(), entregaFim: todayIso() }))}
                    >
                      Hoje
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Início</Label>
                    <Input type="date" value={tempFilters.entregaIni} onChange={(e) => setTempFilters((p) => ({ ...p, entregaIni: e.target.value }))} className="dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Fim</Label>
                    <Input type="date" value={tempFilters.entregaFim} onChange={(e) => setTempFilters((p) => ({ ...p, entregaFim: e.target.value }))} className="dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Unidades de origem</div>
                <Input
                  value={searchUnidOrigem}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchUnidOrigem(v);
                    buscarUnidades(v, 'origem');
                  }}
                  placeholder="Buscar unidade..."
                  className="dark:border-slate-700 dark:bg-slate-900"
                />
                {optUnidOrigem.length > 0 && (
                  <div className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                    {optUnidOrigem.map((u) => (
                      <button
                        key={u.sigla}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => {
                          setSelUnidOrigem((p) => (p.some((x) => x.sigla === u.sigla) ? p : [...p, u]));
                          setSearchUnidOrigem('');
                          setOptUnidOrigem([]);
                        }}
                      >
                        <span className="font-mono font-semibold">{u.sigla}</span> <span className="text-slate-600 dark:text-slate-300">{u.nome || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {selUnidOrigem.map((u) => (
                    <Badge key={u.sigla} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1">
                      <span className="font-mono">{u.sigla}</span>
                      <button type="button" className="ml-1" onClick={() => setSelUnidOrigem((p) => p.filter((x) => x.sigla !== u.sigla))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Unidades de destino</div>
                <Input
                  value={searchUnidDestino}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchUnidDestino(v);
                    buscarUnidades(v, 'destino');
                  }}
                  placeholder="Buscar unidade..."
                  className="dark:border-slate-700 dark:bg-slate-900"
                />
                {optUnidDestino.length > 0 && (
                  <div className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                    {optUnidDestino.map((u) => (
                      <button
                        key={u.sigla}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => {
                          setSelUnidDestino((p) => (p.some((x) => x.sigla === u.sigla) ? p : [...p, u]));
                          setSearchUnidDestino('');
                          setOptUnidDestino([]);
                        }}
                      >
                        <span className="font-mono font-semibold">{u.sigla}</span> <span className="text-slate-600 dark:text-slate-300">{u.nome || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {selUnidDestino.map((u) => (
                    <Badge key={u.sigla} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1">
                      <span className="font-mono">{u.sigla}</span>
                      <button type="button" className="ml-1" onClick={() => setSelUnidDestino((p) => p.filter((x) => x.sigla !== u.sigla))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Clientes pagadores</div>
                <Input
                  value={searchPagador}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchPagador(v);
                    buscarClientes(v, 'pag');
                  }}
                  placeholder="Buscar pelo nome..."
                  className="dark:border-slate-700 dark:bg-slate-900"
                />
                {optPagadores.length > 0 && (
                  <div className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                    {optPagadores.map((c) => (
                      <button
                        key={c.cnpj}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => {
                          setSelPagadores((p) => (p.some((x) => x.cnpj === c.cnpj) ? p : [...p, c]));
                          setSearchPagador('');
                          setOptPagadores([]);
                        }}
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{c.nome}</div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{c.cnpj}</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {selPagadores.map((c) => (
                    <Badge key={c.cnpj} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1 max-w-full">
                      <span className="truncate max-w-[220px]">{c.nome}</span>
                      <button type="button" className="ml-1 shrink-0" onClick={() => setSelPagadores((p) => p.filter((x) => x.cnpj !== c.cnpj))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Remetentes</div>
                <Input
                  value={searchRemetente}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchRemetente(v);
                    buscarClientes(v, 'rem');
                  }}
                  placeholder="Buscar pelo nome..."
                  className="dark:border-slate-700 dark:bg-slate-900"
                />
                {optRemetentes.length > 0 && (
                  <div className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                    {optRemetentes.map((c) => (
                      <button
                        key={c.cnpj}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => {
                          setSelRemetentes((p) => (p.some((x) => x.cnpj === c.cnpj) ? p : [...p, c]));
                          setSearchRemetente('');
                          setOptRemetentes([]);
                        }}
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{c.nome}</div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{c.cnpj}</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {selRemetentes.map((c) => (
                    <Badge key={c.cnpj} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1 max-w-full">
                      <span className="truncate max-w-[220px]">{c.nome}</span>
                      <button type="button" className="ml-1 shrink-0" onClick={() => setSelRemetentes((p) => p.filter((x) => x.cnpj !== c.cnpj))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Destinatários</div>
                <Input
                  value={searchDestinatario}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchDestinatario(v);
                    buscarClientes(v, 'dest');
                  }}
                  placeholder="Buscar pelo nome..."
                  className="dark:border-slate-700 dark:bg-slate-900"
                />
                {optDestinatarios.length > 0 && (
                  <div className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                    {optDestinatarios.map((c) => (
                      <button
                        key={c.cnpj}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => {
                          setSelDestinatarios((p) => (p.some((x) => x.cnpj === c.cnpj) ? p : [...p, c]));
                          setSearchDestinatario('');
                          setOptDestinatarios([]);
                        }}
                      >
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{c.nome}</div>
                        <div className="text-xs font-mono text-slate-500 dark:text-slate-400">{c.cnpj}</div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {selDestinatarios.map((c) => (
                    <Badge key={c.cnpj} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1 max-w-full">
                      <span className="truncate max-w-[220px]">{c.nome}</span>
                      <button type="button" className="ml-1 shrink-0" onClick={() => setSelDestinatarios((p) => p.filter((x) => x.cnpj !== c.cnpj))}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Mercadoria</div>
                <Input
                  value={searchMercadoria}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchMercadoria(v);
                    buscarMercadorias(v);
                  }}
                  placeholder="Buscar mercadoria..."
                  className="dark:border-slate-700 dark:bg-slate-900"
                />
                <div className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                  {optMercadorias.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">—</div>
                  ) : (
                    optMercadorias.map((m) => (
                      <button
                        key={m.codigo}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => setSelMercadoria(m)}
                      >
                        <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{String(m.codigo)}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{m.descricao}</div>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-2">
                  {selMercadoria ? (
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1 max-w-full">
                      <span className="font-mono">{String(selMercadoria.codigo)}</span>
                      <span className="truncate max-w-[220px]">{selMercadoria.descricao}</span>
                      <button type="button" className="ml-1 shrink-0" onClick={() => setSelMercadoria(null)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400">Nenhuma selecionada</div>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Vendedor</div>
                <Input
                  value={searchVendedor}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSearchVendedor(v);
                    buscarVendedores(v);
                  }}
                  placeholder="Buscar vendedor..."
                  className="dark:border-slate-700 dark:bg-slate-900"
                />
                <div className="mt-2 max-h-52 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
                  {optVendedores.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">—</div>
                  ) : (
                    optVendedores.map((v) => (
                      <button
                        key={v.login}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                        onClick={() => setSelVendedor(v)}
                      >
                        <div className="font-mono font-semibold text-slate-800 dark:text-slate-200">{v.login}</div>
                        <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{v.nome}</div>
                      </button>
                    ))
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selVendedor ? (
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1">
                      <span className="font-mono">{selVendedor.login}</span>
                      <button type="button" className="ml-1" onClick={() => setSelVendedor(null)}>
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : (
                    <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1">
                      <span>Todos</span>
                    </Badge>
                  )}
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 gap-1">
                    <button type="button" onClick={() => setSelVendedor({ login: '__sem_vendedor__', nome: 'Sem vendedor' })}>
                      Sem vendedor
                    </button>
                  </Badge>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Tipo de documento</Label>
                    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 max-h-44 overflow-auto">
                      <label className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                        <Checkbox
                          checked={tempFilters.tpDocumento.length === 0}
                          onCheckedChange={(v) => {
                            if (v) setTempFilters((p) => ({ ...p, tpDocumento: [] }));
                          }}
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-200">Todos</span>
                      </label>
                      {TP_DOCUMENTO_OPTIONS.filter((t) => t !== 'TODOS').map((t) => {
                        const checked = tempFilters.tpDocumento.includes(t);
                        return (
                          <label key={t} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                setTempFilters((p) => {
                                  const set = new Set(p.tpDocumento);
                                  if (v) set.add(t);
                                  else set.delete(t);
                                  return { ...p, tpDocumento: Array.from(set) };
                                });
                              }}
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-200">{t}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Tipo de frete</Label>
                    <Select value={tempFilters.tpFrete || 'T'} onValueChange={(v) => setTempFilters((p) => ({ ...p, tpFrete: v === 'T' ? '' : (v as any) }))}>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Liquidação</Label>
                    <Select value={tempFilters.liquidacao || 'T'} onValueChange={(v) => setTempFilters((p) => ({ ...p, liquidacao: v === 'T' ? '' : (v as any) }))}>
                      <SelectTrigger className="dark:border-slate-700 dark:bg-slate-900">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="T">Todos</SelectItem>
                        <SelectItem value="P">Pendentes</SelectItem>
                        <SelectItem value="L">Liquidados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Entrega</Label>
                    <Select value={tempFilters.entrega || 'T'} onValueChange={(v) => setTempFilters((p) => ({ ...p, entrega: v === 'T' ? '' : (v as any) }))}>
                      <SelectTrigger className="dark:border-slate-700 dark:bg-slate-900">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="T">Todos</SelectItem>
                        <SelectItem value="P">Pendentes</SelectItem>
                        <SelectItem value="E">Entregues</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Série</Label>
                    <Input value={tempFilters.serCte} onChange={(e) => setTempFilters((p) => ({ ...p, serCte: e.target.value.toUpperCase() }))} className="dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-700 dark:text-slate-200">Número</Label>
                    <Input value={tempFilters.nroCte} onChange={(e) => setTempFilters((p) => ({ ...p, nroCte: e.target.value }))} className="dark:border-slate-700 dark:bg-slate-900" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-200">NF (dentro do campo nfs)</Label>
                  <Input value={tempFilters.nroNf} onChange={(e) => setTempFilters((p) => ({ ...p, nroNf: e.target.value }))} className="dark:border-slate-700 dark:bg-slate-900" placeholder="Digite o número da NF" />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <Button type="button" variant="outline" className="dark:border-slate-700" disabled={loading} onClick={resetFiltros}>
                Limpar
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" className="bg-blue-600 hover:bg-blue-700 text-white gap-2" disabled={loading} onClick={aplicarFiltros}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Gerar
                </Button>
                {total > 0 ? (
                  <Button type="button" variant="outline" className="gap-2 dark:border-slate-700" disabled={exporting || loading} onClick={exportarCsv}>
                    {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Exportar CSV
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </details>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">CT-es por Unidade (origem)</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="h-[240px]">
                {donutUnidadesData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">—</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutUnidadesData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                        {donutUnidadesData.map((_e, idx) => (
                          <Cell key={idx} fill={donutColors[idx % donutColors.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <RechartsTooltip contentStyle={tooltipStyle as any} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
            <CardHeader className="pb-0">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">CT-es por Cliente (pagador)</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="h-[240px]">
                {donutClientesData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-400">—</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutClientesData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                        {donutClientesData.map((_e, idx) => (
                          <Cell key={idx} fill={donutColors[idx % donutColors.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <RechartsTooltip contentStyle={tooltipStyle as any} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">Evolução no Período</CardTitle>
                <div className="text-xs text-slate-500 dark:text-slate-400">{total.toLocaleString('pt-BR')} CT-es</div>
              </div>
              <Tabs value={serieModo} onValueChange={(v) => setSerieModo(v as SerieModo)}>
                <TabsList className="h-8">
                  <TabsTrigger value="frete" className="text-xs h-7">
                    Frete
                  </TabsTrigger>
                  <TabsTrigger value="merc" className="text-xs h-7">
                    Merc.
                  </TabsTrigger>
                  <TabsTrigger value="ctes" className="text-xs h-7">
                    Qtde
                  </TabsTrigger>
                  <TabsTrigger value="custo" className="text-xs h-7">
                    Custo
                  </TabsTrigger>
                  <TabsTrigger value="frete_custo" className="text-xs h-7">
                    Frete+Custo
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="h-[280px]">
              {serieData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">—</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serieData}>
                    <defs>
                      <linearGradient id="gradFrete" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradMerc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradQtde" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradCusto" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <RechartsTooltip contentStyle={tooltipStyle as any} />
                    {serieModo === 'frete' ? <Area type="monotone" dataKey="vlr_frete" name="Frete" stroke="#6366f1" fill="url(#gradFrete)" strokeWidth={2} dot={false} /> : null}
                    {serieModo === 'merc' ? <Area type="monotone" dataKey="vlr_merc" name="Merc." stroke="#f97316" fill="url(#gradMerc)" strokeWidth={2} dot={false} /> : null}
                    {serieModo === 'ctes' ? <Area type="monotone" dataKey="qtde_ctes" name="CT-es" stroke="#10b981" fill="url(#gradQtde)" strokeWidth={2} dot={false} /> : null}
                    {serieModo === 'custo' ? <Area type="monotone" dataKey="vlr_custo" name="Custo" stroke="#ef4444" fill="url(#gradCusto)" strokeWidth={2} dot={false} /> : null}
                    {serieModo === 'frete_custo' ? (
                      <>
                        <Area type="monotone" dataKey="vlr_frete" name="Frete" stroke="#6366f1" fill="url(#gradFrete)" strokeWidth={2} dot={false} />
                        <Area type="monotone" dataKey="vlr_custo" name="Custo" stroke="#ef4444" fill="url(#gradCusto)" strokeWidth={2} dot={false} />
                      </>
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">Evolução por Unidade</CardTitle>
                <div className="text-xs text-slate-500 dark:text-slate-400">Frete total por unidade (origem) · Top 5 + demais</div>
              </div>
              <Tabs value={serieUnidModo} onValueChange={(v) => setSerieUnidModo(v as any)}>
                <TabsList className="h-8">
                  <TabsTrigger value="paralelo" className="text-xs h-7">
                    Paralelo
                  </TabsTrigger>
                  <TabsTrigger value="empilhado" className="text-xs h-7">
                    Empilhado
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent className="pt-3">
            <div className="h-[320px]">
              {serieUnidData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-400">—</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {serieUnidModo === 'empilhado' ? (
                    <AreaChart data={serieUnidData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <RechartsTooltip contentStyle={tooltipStyle as any} />
                      {serieUnidKeys.map((k, idx) => (
                        <Area key={k} type="monotone" dataKey={k} name={k} stackId="1" stroke={donutColors[idx % donutColors.length]} fill={donutColors[idx % donutColors.length]} fillOpacity={0.25} />
                      ))}
                    </AreaChart>
                  ) : (
                    <LineChart data={serieUnidData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <RechartsTooltip contentStyle={tooltipStyle as any} />
                      {serieUnidKeys.map((k, idx) => (
                        <Line key={k} type="monotone" dataKey={k} name={k} stroke={donutColors[idx % donutColors.length]} strokeWidth={2} dot={false} />
                      ))}
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 dark:border-slate-800 overflow-hidden">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold text-slate-900 dark:text-slate-100">Lista</CardTitle>
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">
                {rows.length} registros • {page}/{totalPages}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[85vh] overflow-y-auto overflow-x-hidden relative">
              <table className="w-full text-sm table-fixed">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                  <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-left w-[90px]">
                      <SortBtn k="data_emissao" label="Emissão" defaultDir="desc" />
                    </th>
                    <th className="px-3 py-2 text-left w-[94px]">
                      <SortBtn k="ser_cte" label="CT-e" />
                    </th>
                    <th className="px-3 py-2 text-left w-[70px]">
                      <SortBtn k="sigla_emit" label="Orig." />
                    </th>
                    <th className="px-3 py-2 text-left w-[70px]">
                      <SortBtn k="sigla_dest" label="Dest." />
                    </th>
                    <th className="px-3 py-2 text-left w-[120px]">
                      <SortBtn k="data_prev_ent" label="Prev. Ent." defaultDir="desc" />
                    </th>
                    <th className="px-3 py-2 text-left w-[90px]">
                      <SortBtn k="data_entrega" label="Entrega" defaultDir="desc" />
                    </th>
                    <th className="px-3 py-2 text-left">Pagador</th>
                    <th className="px-3 py-2 text-left">Remetente</th>
                    <th className="px-3 py-2 text-left">Destinatário</th>
                    <th className="px-3 py-2 text-right w-[110px]">
                      <SortBtn k="vlr_merc" label="Vlr. Merc." align="right" defaultDir="desc" />
                    </th>
                    <th className="px-3 py-2 text-right w-[110px]">
                      <SortBtn k="vlr_frete" label="Frete" align="right" defaultDir="desc" />
                    </th>
                    <th className="px-3 py-2 text-right w-[85px]">
                      <SortBtn k="peso_real" label="Peso" align="right" defaultDir="desc" />
                    </th>
                    <th className="px-3 py-2 text-right w-[85px]">
                      <SortBtn k="cubagem" label="m³" align="right" defaultDir="desc" />
                    </th>
                    <th className="px-3 py-2 text-right w-[60px]">
                      <SortBtn k="qtde_vol" label="Vol" align="right" defaultDir="desc" />
                    </th>
                    <th className="px-3 py-2 text-center w-[78px]">Liq.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="px-3 py-10 text-center text-slate-400 dark:text-slate-500">
                        {loading ? 'Carregando...' : 'Nenhum CT-e encontrado com os filtros atuais.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((r) => {
                      const ctrc = fmtCte(r.ser_cte, r.nro_cte);
                      return (
                        <tr
                          key={r.seq_cte}
                          className="hover:bg-slate-50 dark:hover:bg-slate-900/60 cursor-pointer"
                          onClick={() => openCte(r)}
                          title="Clique para ver detalhes"
                        >
                          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDateBR(r.data_emissao)}</td>
                          <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{ctrc}</td>
                          <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{r.sigla_emit || '—'}</td>
                          <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">{r.sigla_dest || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDateBR(r.data_prev_ent)}</td>
                          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">{fmtDateBR(r.data_entrega)}</td>
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200 truncate">{r.nome_pag || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200 truncate">{r.nome_emit || '—'}</td>
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-200 truncate">{r.nome_dest || '—'}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtMoney(r.vlr_merc)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtMoney(r.vlr_frete)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtKg(r.peso_real)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">{fmtM3(r.cubagem)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">{(r.qtde_vol || 0).toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {r.liquidado ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200 text-[11px]">SIM</Badge> : <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 text-[11px]">NÃO</Badge>}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 md:flex-row md:items-center md:justify-between bg-slate-50 dark:bg-slate-900/80">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total: <span className="font-semibold text-slate-700 dark:text-slate-200">{total.toLocaleString('pt-BR')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="dark:border-slate-700" disabled={loading || page <= 1} onClick={() => { setPage(1); carregar(1, sort, filters); }}>
                  «
                </Button>
                <Button variant="outline" size="sm" className="dark:border-slate-700" disabled={loading || page <= 1} onClick={() => { const p = Math.max(1, page - 1); setPage(p); carregar(p, sort, filters); }}>
                  Anterior
                </Button>
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  Página {page} de {totalPages}
                </span>
                <Button variant="outline" size="sm" className="dark:border-slate-700" disabled={loading || page >= totalPages} onClick={() => { const p = Math.min(totalPages, page + 1); setPage(p); carregar(p, sort, filters); }}>
                  Próxima
                </Button>
                <Button variant="outline" size="sm" className="dark:border-slate-700" disabled={loading || page >= totalPages} onClick={() => { setPage(totalPages); carregar(totalPages, sort, filters); }}>
                  »
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <CteDetalhesDialog
          cte={cteDialogData}
          open={cteDialogOpen && !!cteDialogData}
          onOpenChange={(o) => {
            setCteDialogOpen(o);
            if (!o) setCteDialogData(null);
          }}
        >
          <span />
        </CteDetalhesDialog>
      </div>
    </AdminLayout>
  );
}
