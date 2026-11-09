import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
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
import {
  Award,
  Building2,
  Calculator,
  Calendar,
  ChevronDown,
  Download,
  Filter,
  Gauge,
  Info,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Target,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Weight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useTheme } from '../ThemeProvider';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { formatCteComDv } from '../../utils/cteUtils';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { FilterSelectVendedor } from '../relatorios/FilterSelectVendedor';
import { CteDetalhesDialog, type CteDetalhesData } from '../dashboards/CteDetalhesDialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

/**
 * ================================================================
 * COMERCIAL - BI COMERCIAL
 * ================================================================
 * Painel analítico do módulo Comercial. Cruza os CT-es
 * ([dominio]_cte) com a carteira de clientes por vendedor
 * ([dominio]_vendedor_cliente), sempre pelo CNPJ PAGADOR (cnpj_pag).
 *
 * Entrega: KPIs, funil de vendas (status dos clientes), evolução
 * (frete x comissão), ranking de vendedores com estimativa de
 * comissões, top clientes e incidência de frete por UF de entrega
 * (choropleth Leaflet + malhas do IBGE).
 *
 * Drill-down: TODO indicador abre a lista de CT-es que o compõe, e
 * cada CT-e abre o dialog de detalhes (CteDetalhesDialog).
 * ================================================================
 */

const API = `${ENVIRONMENT.apiBaseUrl}/comercial/bi_comercial.php`;

const PALETTE = [
  '#6366f1', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

// ============================================================
// FORMATADORES (padrão brasileiro / sem abreviações)
// ============================================================
function fmtBRL(v: number) {
  return (Number(v) || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
function fmtNum(v: number) {
  return (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
}
function fmtPeso(v: number) {
  const n = Number(v) || 0;
  if (n >= 1000) return (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' t';
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' kg';
}
function fmtPct(v: number) {
  return `${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
function fmtCnpj(cnpj: string | number | null | undefined) {
  const d = String(cnpj ?? '').replace(/\D/g, '');
  if (d.length === 14) {
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return String(cnpj ?? '');
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function brDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  return `${d}/${m}/${y}`;
}
function fmtCte(ser: string | null | undefined, nro: number | null | undefined) {
  const s = String(ser ?? '').trim().toUpperCase();
  const n = String(nro ?? 0).padStart(6, '0');
  return `${s}${n}`;
}
function fmtDateShort(iso: string | null | undefined) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(iso);
  return `${m[3]}/${m[2]}/${String(m[1]).slice(2)}`;
}
function csvEscape(v: any) {
  return `"${String(v ?? '').replace(/"/g, '""')}"`;
}
function fmtDecimalCsv(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return new Intl.NumberFormat('pt-BR', {
    useGrouping: false,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// ============================================================
// STATUS DO FUNIL
// ============================================================
type StatusCodigo = 'D' | 'P' | 'N' | 'C' | 'R';

const STATUS_META: Record<
  StatusCodigo,
  { label: string; bar: string; badge: string; dot: string }
> = {
  D: {
    label: 'Cadastrado',
    bar: '#94a3b8',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  P: {
    label: 'Prospecção',
    bar: '#f59e0b',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    dot: 'bg-amber-500',
  },
  N: {
    label: 'Negociação',
    bar: '#6366f1',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
    dot: 'bg-indigo-500',
  },
  C: {
    label: 'Conquista',
    bar: '#10b981',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
    dot: 'bg-emerald-500',
  },
  R: {
    label: 'Reconquista',
    bar: '#f43f5e',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    dot: 'bg-rose-500',
  },
};
const FUNIL_ORDEM: StatusCodigo[] = ['D', 'P', 'N', 'C', 'R'];

// ============================================================
// TIPOS
// ============================================================
interface Kpis {
  total_frete: number;
  total_merc: number;
  total_ctes: number;
  total_peso: number;
  total_volumes: number;
  ticket_medio: number;
  frete_por_kg: number;
  comissao: number;
  clientes_ativos: number;
  clientes_carteira: number;
}
interface FunilItem {
  status: StatusCodigo;
  label: string;
  clientes: number;
  ctes: number;
  frete: number;
}
interface EvolucaoItem {
  periodo: string;
  label: string;
  ctes: number;
  frete: number;
  comissao: number;
}
interface RankingItem {
  login: string;
  nome: string;
  ctes: number;
  clientes_ativos: number;
  frete: number;
  comissao: number;
  pct: number;
}
interface TopCliente {
  cnpj: string;
  nome: string;
  cidade: string;
  uf: string;
  ctes: number;
  frete: number;
  peso: number;
}
interface UfItem {
  uf: string;
  ctes: number;
  frete: number;
}
interface TpFreteItem {
  tp: string;
  label: string;
  ctes: number;
  frete: number;
}
interface Parametros {
  desc_icms: boolean;
  desc_pis_cofins: boolean;
  apenas_liq: boolean;
  apenas_entr: boolean;
}
interface BiData {
  success: boolean;
  periodo: { ini: string; fim: string; dias: number; granularidade: 'dia' | 'mes' };
  parametros: Parametros;
  kpis: Kpis;
  funil: FunilItem[];
  evolucao: EvolucaoItem[];
  ranking: RankingItem[];
  top_clientes: TopCliente[];
  por_uf: UfItem[];
  por_tp_frete: TpFreteItem[];
  gerado_em: string;
}

interface Filtros {
  ini: string;
  fim: string;
  login: string;
  tpFrete: string;
}

interface CteRow {
  seq_cte: number;
  ser_cte: string;
  nro_cte: number;
  tp_documento: string;
  tp_frete: string;
  data_emissao: string;
  data_chegada_unid: string;
  data_prev_ent: string;
  data_entrega: string;
  sigla_emit: string;
  sigla_dest: string;
  unid_atual: string;
  nome_pag: string;
  nome_emit: string;
  nome_dest: string;
  cnpj_emit: string;
  cnpj_dest: string;
  cnpj_pag: string;
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
  cidade_entrega: string;
  uf_entrega: string;
  cidade_emit: string;
  uf_emit: string;
  liquidado: boolean;
  custo_seguro?: number;
  custo_icms?: number;
  custo_pis_cofins?: number;
  custo_gris?: number;
  custo_pedagio?: number;
  custo_expedicao?: number;
  custo_transbordo?: number;
  custo_vendedor?: number;
  custo_recepcao?: number;
  custo_desp_div?: number;
  custo_transferencia_real?: number;
}

// ============================================================
// MAPA (choropleth por UF — malhas do IBGE, sem Mapbox)
// ============================================================
// Código IBGE da UF -> sigla. As malhas do IBGE expõem somente
// `properties.codarea`, então este de-para é necessário.
const IBGE_UF: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP', '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};
const GEOJSON_UFS =
  'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF';

// Escala sequencial (azul claro -> índigo) para a incidência de frete.
const ESCALA_UF = ['#e0e7ff', '#c7d2fe', '#a5b4fc', '#818cf8', '#6366f1', '#4f46e5', '#3730a3'];
function corUf(ratio: number): string {
  const r = Math.max(0, Math.min(1, Number(ratio) || 0));
  const idx = Math.min(ESCALA_UF.length - 1, Math.round(r * (ESCALA_UF.length - 1)));
  return ESCALA_UF[idx];
}

// ============================================================
// LEAFLET (choropleth das UFs)
// ============================================================
declare global {
  interface Window {
    L: any;
  }
}

function useLeafletUfChoropleth(
  containerRef: React.RefObject<HTMLDivElement | null>,
  porUf: UfItem[],
  active: boolean,
  isDark: boolean,
  onDrill?: (uf: string) => void
) {
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const geoRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const [geo, setGeo] = useState<any>(null);

  // Carrega o Leaflet via CDN (uma única vez).
  useEffect(() => {
    if (!active) return;
    if (window.L) {
      setLoaded(true);
      return;
    }
    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }
    const scriptId = 'leaflet-js';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => setLoaded(true);
      document.head.appendChild(script);
    } else {
      setLoaded(true);
    }
  }, [active]);

  // Baixa a malha das UFs do IBGE (uma única vez, cacheada em memória).
  useEffect(() => {
    if (!active) return;
    if (geoRef.current) {
      setGeo(geoRef.current);
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const resp = await fetch(GEOJSON_UFS);
        const json = await resp.json();
        if (cancelado) return;
        geoRef.current = json;
        setGeo(json);
      } catch {
        /* sem malha: mapa fica vazio */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [active]);

  useEffect(() => {
    if (!loaded || !active || !geo || !containerRef.current) return;
    const L = window.L;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true,
        minZoom: 2,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
    }
    const map = mapRef.current;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    const info: Record<string, UfItem> = {};
    porUf.forEach((u) => {
      const k = String(u.uf ?? '').toUpperCase().trim();
      if (k) info[k] = u;
    });
    const maxFrete = Math.max(1, ...porUf.map((u) => Number(u.frete) || 0));
    const vazio = isDark ? '#1e293b' : '#f1f5f9';

    const geoLayer: any = L.geoJSON(geo, {
      style: (feat: any) => {
        const sigla = IBGE_UF[String(feat?.properties?.codarea ?? '')] ?? '';
        const frete = sigla ? Number(info[sigla]?.frete) || 0 : 0;
        return {
          color: isDark ? '#0f172a' : '#ffffff',
          weight: 0.8,
          fillColor: frete > 0 ? corUf(frete / maxFrete) : vazio,
          fillOpacity: frete > 0 ? 0.9 : 0.5,
        };
      },
      onEachFeature: (feat: any, lyr: any) => {
        const sigla = IBGE_UF[String(feat?.properties?.codarea ?? '')] ?? '';
        const item = info[sigla];
        const frete = Number(item?.frete) || 0;
        const ctes = Number(item?.ctes) || 0;
        const temDados = frete > 0 || ctes > 0;

        lyr.bindTooltip(
          `${escapeHtml(sigla || 'UF')}${temDados ? ' · ' + escapeHtml(fmtBRL(frete)) : ' · sem frete'}`,
          { sticky: true }
        );
        lyr.bindPopup(
          `<div style="font-family:inherit;min-width:170px">
             <div style="font-weight:700;margin-bottom:4px">${escapeHtml(sigla || 'UF')}</div>
             <div style="font-size:12px">Frete: <b>${escapeHtml(fmtBRL(frete))}</b></div>
             <div style="font-size:12px;margin-bottom:6px">CT-es: <b>${escapeHtml(fmtNum(ctes))}</b></div>
             ${temDados ? '<button class="bi-popup-uf" style="width:100%;cursor:pointer;border:0;border-radius:6px;padding:4px 8px;background:#6366f1;color:#fff;font-size:11px;font-weight:600">Ver CT-es</button>' : ''}
           </div>`
        );
        lyr.on('mouseover', () => lyr.setStyle({ weight: 2, color: '#6366f1' }));
        lyr.on('mouseout', () => geoLayer.resetStyle(lyr));
        if (onDrill && temDados) {
          lyr.on('popupopen', (e: any) => {
            const el = e?.popup?.getElement?.()?.querySelector?.('.bi-popup-uf');
            if (el) (el as HTMLElement).onclick = () => onDrill(sigla);
          });
        }
      },
    }).addTo(map);
    layerRef.current = geoLayer;

    // Mantém o Brasil inteiro centralizado, independente das UFs com dados.
    const fitBrasil = () => {
      try {
        map.fitBounds(geoLayer.getBounds(), { padding: [4, 4], animate: false });
      } catch {
        /* noop */
      }
    };
    fitBrasil();

    const t = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        /* noop */
      }
      fitBrasil();
    }, 150);

    return () => clearTimeout(t);
  }, [loaded, active, geo, porUf, isDark, onDrill]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);
}

function escapeHtml(s: unknown) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// COMPONENTE
// ============================================================
export function BIComercial() {
  const { user } = useAuth();
  const { theme } = useTheme();
  usePageTitle('BI Comercial');

  const hoje = useMemo(() => new Date(), []);
  const [filtros, setFiltros] = useState<Filtros>(() => ({
    ini: ymd(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
    fim: ymd(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)),
    login: '',
    tpFrete: 'TODOS',
  }));
  const [aplicado, setAplicado] = useState<Filtros>(filtros);
  const [dados, setDados] = useState<BiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const mapaRef = useRef<HTMLDivElement>(null);

  // ---------- Drill-down (lista de CT-es) ----------
  const [drillOpen, setDrillOpen] = useState(false);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillTitulo, setDrillTitulo] = useState('');
  const [drillRows, setDrillRows] = useState<CteRow[]>([]);
  const [drillTotais, setDrillTotais] = useState({ ctes: 0, frete: 0, merc: 0, peso: 0, volumes: 0 });
  const [drillSort, setDrillSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'data_emissao',
    dir: 'desc',
  });

  // ---------- Detalhes do CT-e ----------
  const [cteDialogOpen, setCteDialogOpen] = useState(false);
  const [cteDialogData, setCteDialogData] = useState<CteDetalhesData | null>(null);

  const dirties =
    filtros.ini !== aplicado.ini ||
    filtros.fim !== aplicado.fim ||
    filtros.login !== aplicado.login ||
    filtros.tpFrete !== aplicado.tpFrete;

  const isDark = theme === 'dark';

  // ============ CARREGAMENTO ============
  const carregar = useCallback(async (f: Filtros) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        ini: f.ini,
        fim: f.fim,
        login: f.login || '',
        tp_frete: f.tpFrete === 'TODOS' ? '' : f.tpFrete,
      });
      const res = await apiFetch(`${API}?${qs.toString()}`);
      if (!res || res.success === false || !res.periodo) {
        throw new Error(res?.message || 'Falha ao carregar o BI Comercial.');
      }
      setDados(res as BiData);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao carregar o BI Comercial.');
      setDados(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(aplicado);
  }, [aplicado, carregar]);

  const aplicar = () => setAplicado(filtros);

  const atalho = (ini: string, fim: string) => {
    const novo = { ...filtros, ini, fim };
    setFiltros(novo);
    setAplicado(novo);
  };

  const atalhos = useMemo(() => {
    const d = new Date();
    const primeiroDiaMes = new Date(d.getFullYear(), d.getMonth(), 1);
    const ultimoDiaMes = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const primeiroDiaMesAnt = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const ultimoDiaMesAnt = new Date(d.getFullYear(), d.getMonth(), 0);
    const menos7 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 6);
    const menos30 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 29);
    return [
      { key: 'hoje', label: 'Hoje', ini: ymd(d), fim: ymd(d) },
      { key: '7d', label: '7 dias', ini: ymd(menos7), fim: ymd(d) },
      { key: '30d', label: '30 dias', ini: ymd(menos30), fim: ymd(d) },
      { key: 'mes', label: 'Mês atual', ini: ymd(primeiroDiaMes), fim: ymd(ultimoDiaMes) },
      { key: 'mesant', label: 'Mês anterior', ini: ymd(primeiroDiaMesAnt), fim: ymd(ultimoDiaMesAnt) },
    ];
  }, []);

  const atalhoAtivo = (ini: string, fim: string) => aplicado.ini === ini && aplicado.fim === fim;

  // ============ DRILL-DOWN ============
  const abrirDrill = useCallback(
    async (f: string, v: string, titulo: string) => {
      setDrillOpen(true);
      setDrillTitulo(titulo);
      setDrillRows([]);
      setDrillLoading(true);
      try {
        const qs = new URLSearchParams({
          action: 'ctes',
          ini: aplicado.ini,
          fim: aplicado.fim,
          login: aplicado.login || '',
          tp_frete: aplicado.tpFrete === 'TODOS' ? '' : aplicado.tpFrete,
          f,
          v: v || '',
        });
        const res = await apiFetch(`${API}?${qs.toString()}`);
        if (!res || res.success === false || !Array.isArray(res.ctes)) {
          throw new Error(res?.message || 'Falha ao carregar os CT-es.');
        }
        setDrillRows((res.ctes as CteRow[]) || []);
        setDrillTotais(res.total || { ctes: 0, frete: 0, merc: 0, peso: 0, volumes: 0 });
      } catch (err: any) {
        toast.error(err?.message || 'Erro ao carregar os CT-es.');
        setDrillRows([]);
      } finally {
        setDrillLoading(false);
      }
    },
    [aplicado]
  );

  const abrirDrillUf = useCallback(
    (uf: string) => abrirDrill('uf', uf, `UF de entrega — ${uf}`),
    [abrirDrill]
  );

  const openCte = useCallback((r: CteRow) => {
    const nfiscal = String(r.nfs || '')
      .split(',')
      .map((x) => x.trim())
      .filter((x) => x !== '')[0];
    const data: CteDetalhesData = {
      serCte: r.ser_cte,
      nroCte: r.nro_cte,
      seqCte: r.seq_cte,
      tpDocumento: r.tp_documento,
      emissao: brDate(r.data_emissao),
      prevEnt: brDate(r.data_prev_ent),
      chegadaUnid: brDate(r.data_chegada_unid),
      unidAtual: r.unid_atual,
      unidadeOrigem: r.sigla_emit,
      unidadeDest: r.sigla_dest,
      unidadeEntrega: r.sigla_dest,
      remetente: r.nome_emit,
      pagador: r.nome_pag,
      destinatario: r.nome_dest,
      cnpjEmit: r.cnpj_emit,
      cnpjPag: r.cnpj_pag,
      cnpjDest: r.cnpj_dest,
      cidadeEmitente: [String(r.cidade_emit || '').trim(), String(r.uf_emit || '').trim()]
        .filter(Boolean)
        .join('/'),
      placaColeta: r.placa_coleta,
      nfiscal: nfiscal || '',
      frete: r.vlr_frete,
      vlrMerc: r.vlr_merc,
      pesoReal: r.peso_real,
      pesoCalc: r.peso_calc,
      cubagem: r.cubagem,
      qtdeVol: r.qtde_vol,
      cidadeEntrega: [String(r.cidade_entrega || '').trim(), String(r.uf_entrega || '').trim()]
        .filter(Boolean)
        .join('/'),
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
  }, []);

  const drillSortedRows = useMemo(() => {
    const copy = [...drillRows];
    const mul = drillSort.dir === 'asc' ? 1 : -1;
    const num = (v: any) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? -Infinity : Number(v));
    const str = (v: any) => String(v ?? '').trim().toUpperCase();
    const dateMs = (iso: any) => {
      if (!iso) return -Infinity;
      const ms = Date.parse(String(iso));
      return Number.isFinite(ms) ? ms : -Infinity;
    };
    const cteKey = (r: CteRow) =>
      `${String(r.ser_cte ?? '').trim().toUpperCase()}${String(r.nro_cte ?? 0).padStart(6, '0')}`;

    copy.sort((a, b) => {
      switch (drillSort.key) {
        case 'cte':
          return cteKey(a).localeCompare(cteKey(b)) * mul;
        case 'data_emissao':
          return (dateMs(a.data_emissao) - dateMs(b.data_emissao)) * mul;
        case 'data_prev_ent':
          return (dateMs(a.data_prev_ent) - dateMs(b.data_prev_ent)) * mul;
        case 'data_entrega':
          return (dateMs(a.data_entrega) - dateMs(b.data_entrega)) * mul;
        case 'cliente':
          return str(a.nome_pag).localeCompare(str(b.nome_pag)) * mul;
        case 'cidade':
          return (
            `${str(a.cidade_entrega)}/${str(a.uf_entrega)}`.localeCompare(
              `${str(b.cidade_entrega)}/${str(b.uf_entrega)}`
            ) * mul
          );
        case 'peso':
          return (num(a.peso_real) - num(b.peso_real)) * mul;
        case 'volumes':
          return (num(a.qtde_vol) - num(b.qtde_vol)) * mul;
        case 'vlr_merc':
          return (num(a.vlr_merc) - num(b.vlr_merc)) * mul;
        case 'vlr_frete':
          return (num(a.vlr_frete) - num(b.vlr_frete)) * mul;
        default:
          return 0;
      }
    });
    return copy;
  }, [drillRows, drillSort]);

  const toggleSort = (key: string, defaultDir: 'asc' | 'desc' = 'asc') =>
    setDrillSort((s) => ({ key, dir: s.key === key ? (s.dir === 'asc' ? 'desc' : 'asc') : defaultDir }));

  const sortArrow = (key: string) =>
    drillSort.key === key ? (drillSort.dir === 'asc' ? ' ▲' : ' ▼') : '';

  const exportarDrillCSV = () => {
    if (!drillRows.length) {
      toast.info('Nenhum registro para exportar.');
      return;
    }
    const header = [
      'CT-e',
      'Emissão',
      'Prev. entrega',
      'Entrega',
      'Tipo frete',
      'Cliente (pagador)',
      'CNPJ pagador',
      'Cidade/UF entrega',
      'Peso (kg)',
      'Volumes',
      'Cubagem',
      'Vlr. mercadoria',
      'Frete',
      'Liquidado',
    ];
    const rows = drillRows.map((r) => [
      csvEscape(formatCteComDv(r.ser_cte, r.nro_cte)),
      csvEscape(r.data_emissao ?? ''),
      csvEscape(r.data_prev_ent ?? ''),
      csvEscape(r.data_entrega ?? ''),
      csvEscape(r.tp_frete ?? ''),
      csvEscape(r.nome_pag ?? ''),
      csvEscape(r.cnpj_pag ?? ''),
      csvEscape(`${r.cidade_entrega ?? ''}${r.uf_entrega ? '/' + r.uf_entrega : ''}`),
      csvEscape(fmtDecimalCsv(r.peso_real)),
      csvEscape(fmtDecimalCsv(r.qtde_vol)),
      csvEscape(fmtDecimalCsv(r.cubagem)),
      csvEscape(fmtDecimalCsv(r.vlr_merc)),
      csvEscape(fmtDecimalCsv(r.vlr_frete)),
      csvEscape(r.liquidado ? 'SIM' : 'NÃO'),
    ]);
    const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = String(drillTitulo || 'drilldown')
      .replace(/\s+/g, '_')
      .replace(/[^\w\-_.]+/g, '')
      .slice(0, 80);
    a.href = url;
    a.download = `bi_comercial_${safe}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============ DADOS ============
  const kpis = dados?.kpis;
  const ranking = dados?.ranking ?? [];
  const maxRankFrete = useMemo(
    () => Math.max(1, ...ranking.map((r) => Number(r.frete) || 0)),
    [ranking]
  );
  const funil = dados?.funil ?? [];
  const maxFunilClientes = useMemo(
    () => Math.max(1, ...funil.map((f) => Number(f.clientes) || 0)),
    [funil]
  );
  const funilTotal = useMemo(
    () => funil.reduce((a, f) => a + (Number(f.clientes) || 0), 0),
    [funil]
  );
  const topClientes = dados?.top_clientes ?? [];
  const porUf = dados?.por_uf ?? [];
  const porTp = dados?.por_tp_frete ?? [];
  const evolucao = dados?.evolucao ?? [];

  // Mapa choropleth da incidência de frete por UF (malhas do IBGE).
  useLeafletUfChoropleth(mapaRef, porUf, !!dados && porUf.length > 0, isDark, abrirDrillUf);

  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 10,
    fontSize: 12,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
  };

  const headerActions = (
    <div className="hidden md:flex items-center gap-2">
      <Badge variant="secondary" className="bg-primary/10 text-primary">
        <Calendar className="w-3 h-3 mr-1" />
        {brDate(aplicado.ini)} — {brDate(aplicado.fim)}
      </Badge>
      <Button variant="outline" size="icon" onClick={() => carregar(aplicado)} title="Atualizar">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );

  return (
    <DashboardLayout title="BI Comercial" description={user?.client_name} headerActions={headerActions}>
      <div className="px-3 md:px-6 py-4 space-y-4">
        {/* ================= BARRA DE FILTROS ================= */}
        <Card className="border-border/60 shadow-sm">
          <CardContent className="p-3 md:p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground mr-1">
                <Gauge className="w-4 h-4 text-primary" />
                Período
              </div>
              {atalhos.map((a) => (
                <Button
                  key={a.key}
                  variant={atalhoAtivo(a.ini, a.fim) ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => atalho(a.ini, a.fim)}
                >
                  {a.label}
                </Button>
              ))}
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={() => setFiltrosAbertos((v) => !v)}
              >
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                Filtros
                <ChevronDown className={`w-3.5 h-3.5 ml-1.5 transition-transform ${filtrosAbertos ? 'rotate-180' : ''}`} />
              </Button>
              <Button
                size="sm"
                className="h-8"
                onClick={aplicar}
                disabled={!dirties && !loading}
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                Gerar
              </Button>
            </div>

            {filtrosAbertos && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border/60">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data inicial</Label>
                  <Input
                    type="date"
                    value={filtros.ini}
                    max={filtros.fim}
                    onChange={(e) => setFiltros((p) => ({ ...p, ini: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data final</Label>
                  <Input
                    type="date"
                    value={filtros.fim}
                    min={filtros.ini}
                    onChange={(e) => setFiltros((p) => ({ ...p, fim: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Vendedor</Label>
                  <FilterSelectVendedor
                    value={filtros.login}
                    onChange={(v) => setFiltros((p) => ({ ...p, login: v }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Tipo de frete</Label>
                  <Select
                    value={filtros.tpFrete}
                    onValueChange={(v) => setFiltros((p) => ({ ...p, tpFrete: v }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos</SelectItem>
                      <SelectItem value="C">CIF (C)</SelectItem>
                      <SelectItem value="F">FOB (F)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {dados?.parametros && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground mr-1">
                  Base de comissão
                </span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  {dados.parametros.desc_icms ? 'Frete − ICMS' : 'Frete bruto'}
                </Badge>
                {dados.parametros.desc_pis_cofins && (
                  <Badge variant="outline" className="text-[10px] font-normal">− PIS/COFINS</Badge>
                )}
                {dados.parametros.apenas_liq && (
                  <Badge variant="outline" className="text-[10px] font-normal">Somente liquidados</Badge>
                )}
                {dados.parametros.apenas_entr && (
                  <Badge variant="outline" className="text-[10px] font-normal">Somente entregues</Badge>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {loading && !dados ? (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando indicadores...
          </div>
        ) : !dados ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Não foi possível carregar os indicadores do período selecionado.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ================= KPIs ================= */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
              <KpiCard
                titulo="Frete Total"
                valor={fmtBRL(kpis?.total_frete ?? 0)}
                sub={`Mercadoria ${fmtBRL(kpis?.total_merc ?? 0)}`}
                icon={<Truck className="w-4 h-4" />}
                accent="from-indigo-500/15 to-indigo-500/0 text-indigo-600 dark:text-indigo-300"
                onClick={() => abrirDrill('geral', '', 'Todos os CT-es do período')}
              />
              <KpiCard
                titulo="Comissão Estimada"
                valor={fmtBRL(kpis?.comissao ?? 0)}
                sub={`${fmtPct(((kpis?.comissao ?? 0) / (kpis?.total_frete || 1)) * 100)} do frete`}
                icon={<Wallet className="w-4 h-4" />}
                accent="from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-300"
                onClick={() =>
                  aplicado.login
                    ? abrirDrill('vendedor', aplicado.login, `Comissão — ${aplicado.login}`)
                    : abrirDrill('geral', '', 'Comissão estimada — CT-es do período')
                }
              />
              <KpiCard
                titulo="CT-es"
                valor={fmtNum(kpis?.total_ctes ?? 0)}
                sub={`Ticket ${fmtBRL(kpis?.ticket_medio ?? 0)}`}
                icon={<Package className="w-4 h-4" />}
                accent="from-sky-500/15 to-sky-500/0 text-sky-600 dark:text-sky-300"
                onClick={() => abrirDrill('geral', '', 'Todos os CT-es do período')}
              />
              <KpiCard
                titulo="Clientes Ativos"
                valor={fmtNum(kpis?.clientes_ativos ?? 0)}
                sub={`de ${fmtNum(kpis?.clientes_carteira ?? 0)} na carteira`}
                icon={<Users className="w-4 h-4" />}
                accent="from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-300"
                onClick={() => abrirDrill('geral', '', 'Clientes ativos — CT-es do período')}
              />
              <KpiCard
                titulo="Peso Total"
                valor={fmtPeso(kpis?.total_peso ?? 0)}
                sub={`${fmtBRL(kpis?.frete_por_kg ?? 0)} / kg`}
                icon={<Weight className="w-4 h-4" />}
                accent="from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-300"
                onClick={() => abrirDrill('geral', '', 'Peso total — CT-es do período')}
              />
              <KpiCard
                titulo="Volumes"
                valor={fmtNum(kpis?.total_volumes ?? 0)}
                sub={`${fmtNum(kpis?.total_ctes ?? 0)} documentos`}
                icon={<Building2 className="w-4 h-4" />}
                accent="from-rose-500/15 to-rose-500/0 text-rose-600 dark:text-rose-300"
                onClick={() => abrirDrill('geral', '', 'Volumes — CT-es do período')}
              />
            </div>

            {/* ================= EVOLUÇÃO + FUNIL ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="lg:col-span-2 border-border/60 shadow-sm">
                <div className="flex items-center justify-between px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Evolução — Frete & Comissão
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {dados.periodo?.granularidade === 'dia' ? 'Diário' : 'Mensal'}
                  </Badge>
                </div>
                <CardContent className="pt-2">
                  <div style={{ width: '100%', height: 268 }}>
                    <ResponsiveContainer>
                      <AreaChart data={evolucao} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gFrete" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="gCom" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#eef2f7'} />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                          minTickGap={16}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#64748b' }}
                          tickLine={false}
                          axisLine={false}
                          width={62}
                          tickFormatter={(v) => fmtNum(Number(v))}
                        />
                        <RechartsTooltip
                          contentStyle={tooltipStyle}
                          formatter={(value: any, name: any) => [fmtBRL(Number(value)), String(name)]}
                          labelFormatter={(l) => `Período: ${l}`}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
                        <Area
                          type="monotone"
                          dataKey="frete"
                          name="Frete"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fill="url(#gFrete)"
                          style={{ cursor: 'pointer' }}
                          onClick={(d: any) => {
                            const it = d?.payload ?? d;
                            if (it?.periodo) {
                              abrirDrill('periodo', it.periodo, `Evolução — ${it.label ?? it.periodo}`);
                            }
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="comissao"
                          name="Comissão"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#gCom)"
                          style={{ cursor: 'pointer' }}
                          onClick={(d: any) => {
                            const it = d?.payload ?? d;
                            if (it?.periodo) {
                              abrirDrill('periodo', it.periodo, `Evolução — ${it.label ?? it.periodo}`);
                            }
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* FUNIL DE VENDAS */}
              <Card className="border-border/60 shadow-sm">
                <div className="flex items-center justify-between px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Funil de Vendas</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {fmtNum(funilTotal)} clientes
                  </Badge>
                </div>
                <CardContent className="pt-3 space-y-2.5">
                  {funil.map((f) => {
                    const meta = STATUS_META[f.status] ?? STATUS_META.D;
                    const w = (f.clientes / maxFunilClientes) * 100;
                    return (
                      <div
                        key={f.status}
                        role="button"
                        tabIndex={0}
                        className="space-y-1 rounded-lg px-2 -mx-2 py-1 cursor-pointer hover:bg-accent/40 transition-colors"
                        onClick={() => abrirDrill('status', f.status, `Funil — ${meta.label}`)}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                          <span className="flex items-baseline gap-2">
                            <span className="font-bold text-foreground">{fmtNum(f.clientes)}</span>
                            <span className="text-muted-foreground">{fmtBRL(f.frete)}</span>
                          </span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${Math.max(w, f.clientes > 0 ? 4 : 0)}%`, backgroundColor: meta.bar }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground pl-3.5">
                          {fmtNum(f.ctes)} CT-es no período
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>

            {/* ================= RANKING + TIPO DE FRETE ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="lg:col-span-2 border-border/60 shadow-sm">
                <div className="flex items-center justify-between px-4 pt-4">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Ranking de Vendedores & Comissões
                    </h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {fmtNum(ranking.length)} vendedores
                  </Badge>
                </div>
                <CardContent className="pt-3">
                  {ranking.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Nenhum CT-e vinculado a vendedores no período.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {ranking.map((r, i) => (
                        <div
                          key={r.login}
                          role="button"
                          tabIndex={0}
                          className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 hover:bg-accent/40 cursor-pointer transition-colors"
                          onClick={() =>
                            abrirDrill('vendedor', r.login, `Vendedor — ${r.nome || r.login}`)
                          }
                        >
                          <div className="w-6 shrink-0 text-center">
                            <span className={`text-xs font-bold ${i < 3 ? 'text-primary' : 'text-muted-foreground'}`}>
                              {i + 1}º
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {r.nome || r.login}
                              </p>
                              <Badge
                                variant="secondary"
                                className="shrink-0 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 text-[10px]"
                              >
                                <Calculator className="w-3 h-3 mr-1" />
                                {fmtBRL(r.comissao)}
                              </Badge>
                            </div>
                            <div className="mt-1 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400"
                                style={{ width: `${Math.max((r.frete / maxRankFrete) * 100, 2)}%` }}
                              />
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span className="font-semibold text-foreground">{fmtBRL(r.frete)}</span>
                              <span>{fmtPct(r.pct)} do total</span>
                              <span>{fmtNum(r.ctes)} CT-es</span>
                              <span>{fmtNum(r.clientes_ativos)} clientes</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <div className="flex items-center gap-2 px-4 pt-4">
                  <Truck className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">CIF x FOB</h3>
                </div>
                <CardContent className="pt-2">
                  {porTp.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <>
                      <div style={{ width: '100%', height: 200 }}>
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie
                              data={porTp}
                              dataKey="frete"
                              nameKey="label"
                              innerRadius={52}
                              outerRadius={82}
                              paddingAngle={3}
                              stroke="none"
                              style={{ cursor: 'pointer' }}
                              onClick={(d: any) => {
                                const it = d?.payload ?? d;
                                if (it?.tp) {
                                  abrirDrill('tp_frete', it.tp, `Tipo de frete — ${it.label ?? it.tp}`);
                                }
                              }}
                            >
                              {porTp.map((_, i) => (
                                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={tooltipStyle}
                              formatter={(value: any, name: any) => [fmtBRL(Number(value)), String(name)]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="mt-1 space-y-1.5">
                        {porTp.map((t, i) => (
                          <div
                            key={t.tp}
                            role="button"
                            tabIndex={0}
                            className="flex items-center justify-between text-xs rounded-md px-1.5 py-1 cursor-pointer hover:bg-accent/40 transition-colors"
                            onClick={() => abrirDrill('tp_frete', t.tp, `Tipo de frete — ${t.label}`)}
                          >
                            <span className="flex items-center gap-2 text-foreground">
                              <span
                                className="w-2.5 h-2.5 rounded-sm"
                                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                              />
                              {t.label}
                            </span>
                            <span className="text-muted-foreground">
                              <b className="text-foreground">{fmtBRL(t.frete)}</b> · {fmtNum(t.ctes)} CT-es
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ================= TOP CLIENTES + UF + MAPA ================= */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Card className="border-border/60 shadow-sm">
                <div className="flex items-center gap-2 px-4 pt-4">
                  <Users className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Top Clientes</h3>
                </div>
                <CardContent className="pt-3">
                  {topClientes.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                      {topClientes.slice(0, 12).map((c, i) => (
                        <div
                          key={c.cnpj}
                          role="button"
                          tabIndex={0}
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/40 cursor-pointer transition-colors"
                          onClick={() => abrirDrill('cliente', c.cnpj, `Cliente — ${c.nome}`)}
                        >
                          <span className="w-5 shrink-0 text-center text-[11px] font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{c.nome}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {fmtCnpj(c.cnpj)}
                              {c.cidade ? ` · ${c.cidade}${c.uf ? '/' + c.uf : ''}` : ''}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-xs font-bold text-foreground">{fmtBRL(c.frete)}</p>
                            <p className="text-[10px] text-muted-foreground">{fmtNum(c.ctes)} CT-es</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm">
                <div className="flex items-center gap-2 px-4 pt-4">
                  <MapPin className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Frete por UF de Entrega</h3>
                </div>
                <CardContent className="pt-2">
                  {porUf.length === 0 ? (
                    <p className="py-12 text-center text-sm text-muted-foreground">Sem dados.</p>
                  ) : (
                    <div style={{ width: '100%', height: 340 }}>
                      <ResponsiveContainer>
                        <BarChart
                          data={porUf.slice(0, 10)}
                          layout="vertical"
                          margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#1e293b' : '#eef2f7'} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => fmtNum(Number(v))}
                          />
                          <YAxis
                            type="category"
                            dataKey="uf"
                            tick={{ fontSize: 11, fill: isDark ? '#cbd5e1' : '#334155' }}
                            tickLine={false}
                            axisLine={false}
                            width={34}
                          />
                          <RechartsTooltip
                            contentStyle={tooltipStyle}
                            cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)' }}
                            formatter={(value: any) => [fmtBRL(Number(value)), 'Frete']}
                          />
                          <Bar
                            dataKey="frete"
                            radius={[0, 4, 4, 0]}
                            maxBarSize={18}
                            style={{ cursor: 'pointer' }}
                            onClick={(d: any) => {
                              const it = d?.payload ?? d;
                              if (it?.uf) abrirDrill('uf', it.uf, `UF de entrega — ${it.uf}`);
                            }}
                          >
                            {porUf.slice(0, 10).map((_, i) => (
                              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Incidência por UF de Entrega</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {fmtNum(porUf.filter((u) => u.uf && u.uf !== '??').length)} UFs
                  </Badge>
                </div>
                <CardContent className="pt-0 px-0">
                  {porUf.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground px-4">
                      Sem frete no período.
                    </p>
                  ) : (
                    <>
                      <div ref={mapaRef} style={{ width: '100%', height: 300, zIndex: 1 }} />
                      <div className="flex items-center justify-center gap-2 px-4 pt-2">
                        <span className="text-[10px] text-muted-foreground">Menor</span>
                        <div className="flex overflow-hidden rounded-sm">
                          {ESCALA_UF.map((c) => (
                            <span key={c} className="h-2.5 w-5" style={{ backgroundColor: c }} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">Maior frete</span>
                      </div>
                      <p className="px-4 pb-3 pt-1 text-[10px] text-muted-foreground">
                        Frete entregue por UF · clique em um estado para listar os CT-es.
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      {/* ================= DIALOG: LISTA DE CT-es (drill-down) ================= */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-7xl h-[85vh] flex flex-col overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader className="shrink-0 pr-16">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="text-slate-900 dark:text-slate-100 truncate">
                  {drillTitulo || 'CT-es'}
                </DialogTitle>
                <DialogDescription className="text-slate-600 dark:text-slate-400">
                  Lista de CT-es que compõem o indicador. Clique em um CT-e para ver os detalhes.
                </DialogDescription>
              </div>
              {drillRows.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportarDrillCSV}
                  className="gap-2 shrink-0 dark:border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative">
                {drillLoading ? (
                  <div className="flex items-center justify-center py-20 text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Carregando CT-es...
                  </div>
                ) : (
                  <table className="w-full text-sm table-fixed">
                    <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-10">
                      <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <th className="px-3 py-2 text-left whitespace-nowrap w-[10%]">
                          <button
                            className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('cte', 'desc')}
                          >
                            CT-e{sortArrow('cte')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left whitespace-nowrap w-[8%]">
                          <button
                            className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('data_emissao', 'desc')}
                          >
                            Emissão{sortArrow('data_emissao')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left whitespace-nowrap w-[8%]">
                          <button
                            className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('data_prev_ent', 'desc')}
                          >
                            Prev.{sortArrow('data_prev_ent')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left whitespace-nowrap w-[8%]">
                          <button
                            className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('data_entrega', 'desc')}
                          >
                            Entrega{sortArrow('data_entrega')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left whitespace-nowrap w-[22%]">
                          <button
                            className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('cliente', 'asc')}
                          >
                            Cliente{sortArrow('cliente')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-left whitespace-nowrap w-[13%]">
                          <button
                            className="text-left hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('cidade', 'asc')}
                          >
                            Cidade/UF{sortArrow('cidade')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap w-[7%]">
                          <button
                            className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('peso', 'desc')}
                          >
                            Peso{sortArrow('peso')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap w-[6%]">
                          <button
                            className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('volumes', 'desc')}
                          >
                            Vol.{sortArrow('volumes')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap w-[9%]">
                          <button
                            className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('vlr_merc', 'desc')}
                          >
                            Vlr Merc.{sortArrow('vlr_merc')}
                          </button>
                        </th>
                        <th className="px-3 py-2 text-right whitespace-nowrap w-[9%]">
                          <button
                            className="text-right hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                            onClick={() => toggleSort('vlr_frete', 'desc')}
                          >
                            Frete{sortArrow('vlr_frete')}
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
                        drillSortedRows.map((r) => (
                          <tr
                            key={r.seq_cte}
                            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                            onClick={() => openCte(r)}
                          >
                            <td className="px-3 py-2 font-mono text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {fmtCte(r.ser_cte, r.nro_cte)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                              {fmtDateShort(r.data_emissao)}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                              {fmtDateShort(r.data_prev_ent)}
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap text-xs">
                              {fmtDateShort(r.data_entrega) || '—'}
                            </td>
                            <td className="px-3 py-2 min-w-0">
                              <p className="truncate text-slate-800 dark:text-slate-200 font-medium">
                                {r.nome_pag || '—'}
                              </p>
                              <p className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                                {fmtCnpj(r.cnpj_pag)}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-slate-600 dark:text-slate-300 text-xs truncate">
                              {r.cidade_entrega || '—'}
                              {r.uf_entrega ? `/${r.uf_entrega}` : ''}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                              {fmtPeso(r.peso_real)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                              {fmtNum(r.qtde_vol)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                              {fmtBRL(r.vlr_merc)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-200">
                              {fmtBRL(r.vlr_frete)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              {!drillLoading && drillRows.length > 0 && (
                <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
                  <table className="w-full text-sm table-fixed">
                    <tbody>
                      <tr className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <td className="px-3 py-2 whitespace-nowrap w-[10%]">
                          TOTAL · {fmtNum(drillTotais.ctes)}
                        </td>
                        <td className="px-3 py-2 w-[8%]" />
                        <td className="px-3 py-2 w-[8%]" />
                        <td className="px-3 py-2 w-[8%]" />
                        <td className="px-3 py-2 w-[22%]" />
                        <td className="px-3 py-2 w-[13%]" />
                        <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap w-[7%]">
                          {fmtPeso(drillTotais.peso)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap w-[6%]">
                          {fmtNum(drillTotais.volumes)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap w-[9%]">
                          {fmtBRL(drillTotais.merc)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap w-[9%]">
                          {fmtBRL(drillTotais.frete)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= DIALOG: DETALHES DO CT-e ================= */}
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
    </DashboardLayout>
  );
}

// ============================================================
// KPI CARD
// ============================================================
function KpiCard({
  titulo,
  valor,
  sub,
  icon,
  accent,
  onClick,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <Card
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      className={`relative overflow-hidden border-border/60 shadow-sm bg-gradient-to-br ${accent} ${
        onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''
      }`}
    >
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {titulo}
          </span>
          <span className="opacity-80">{icon}</span>
        </div>
        <div className="text-lg xl:text-xl font-bold leading-tight text-foreground break-words">
          {valor}
        </div>
        {sub && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</div>}
      </CardContent>
    </Card>
  );
}

export default BIComercial;
