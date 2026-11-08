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
  Filter,
  Gauge,
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
import { DashboardLayout } from '../layouts/DashboardLayout';
import { FilterSelectVendedor } from '../relatorios/FilterSelectVendedor';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
 * comissões, top clientes, distribuição por UF / tipo de frete e
 * geolocalização dos clientes em mapa (Leaflet).
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
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
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
interface PontoMapa {
  cnpj: string;
  nome: string;
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
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
  pontos_mapa: PontoMapa[];
  gerado_em: string;
}

interface Filtros {
  ini: string;
  fim: string;
  login: string;
  tpFrete: string;
}

// ============================================================
// LEAFLET (múltiplos pontos)
// ============================================================
declare global {
  interface Window {
    L: any;
  }
}

function useLeafletPontos(
  containerRef: React.RefObject<HTMLDivElement | null>,
  pontos: PontoMapa[],
  active: boolean
) {
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

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

  useEffect(() => {
    if (!loaded || !active || !containerRef.current) return;
    const L = window.L;

    if (!mapRef.current) {
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        preferCanvas: true,
      }).setView([-15.78, -47.93], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
      mapRef.current = map;
    }
    const map = mapRef.current;

    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    const maxFrete = Math.max(1, ...pontos.map((p) => Number(p.frete) || 0));
    const bounds: any[] = [];
    pontos.forEach((p) => {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!isFinite(lat) || !isFinite(lng)) return;
      const ratio = Math.min(1, (Number(p.frete) || 0) / maxFrete);
      const radius = 4 + ratio * 12;
      const marker = L.circleMarker([lat, lng], {
        radius,
        color: '#1d4ed8',
        weight: 1,
        fillColor: ratios(p.frete, maxFrete),
        fillOpacity: 0.55,
      }).addTo(group);
      marker.bindPopup(
        `<div style="font-family:inherit;min-width:180px">
           <div style="font-weight:700;margin-bottom:2px">${escapeHtml(p.nome)}</div>
           <div style="font-size:11px;color:#64748b;margin-bottom:6px">${escapeHtml(fmtCnpj(p.cnpj))}</div>
           <div style="font-size:11px;color:#64748b;margin-bottom:6px">${escapeHtml(p.cidade)}${p.uf ? ' - ' + escapeHtml(p.uf) : ''}</div>
           <div style="font-size:12px">Frete: <b>${escapeHtml(fmtBRL(p.frete))}</b></div>
           <div style="font-size:12px">CT-es: <b>${escapeHtml(fmtNum(p.ctes))}</b></div>
         </div>`
      );
      bounds.push([lat, lng]);
    });

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 10 });
    }
    const t = setTimeout(() => {
      try {
        map.invalidateSize();
      } catch {
        /* noop */
      }
    }, 150);

    return () => clearTimeout(t);
  }, [loaded, active, pontos]);

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  return loaded;
}

function ratios(frete: number, max: number) {
  const r = Math.min(1, (Number(frete) || 0) / (max || 1));
  if (r > 0.66) return '#ef4444';
  if (r > 0.33) return '#f59e0b';
  return '#3b82f6';
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
      if (!res || res.success === false) {
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

  // ============ MAPA ============
  const pontos = dados?.pontos_mapa ?? [];
  useLeafletPontos(mapaRef, pontos, !!dados);

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
              />
              <KpiCard
                titulo="Comissão Estimada"
                valor={fmtBRL(kpis?.comissao ?? 0)}
                sub={`${fmtPct(((kpis?.comissao ?? 0) / (kpis?.total_frete || 1)) * 100)} do frete`}
                icon={<Wallet className="w-4 h-4" />}
                accent="from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-300"
              />
              <KpiCard
                titulo="CT-es"
                valor={fmtNum(kpis?.total_ctes ?? 0)}
                sub={`Ticket ${fmtBRL(kpis?.ticket_medio ?? 0)}`}
                icon={<Package className="w-4 h-4" />}
                accent="from-sky-500/15 to-sky-500/0 text-sky-600 dark:text-sky-300"
              />
              <KpiCard
                titulo="Clientes Ativos"
                valor={fmtNum(kpis?.clientes_ativos ?? 0)}
                sub={`de ${fmtNum(kpis?.clientes_carteira ?? 0)} na carteira`}
                icon={<Users className="w-4 h-4" />}
                accent="from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-300"
              />
              <KpiCard
                titulo="Peso Total"
                valor={fmtPeso(kpis?.total_peso ?? 0)}
                sub={`${fmtBRL(kpis?.frete_por_kg ?? 0)} / kg`}
                icon={<Weight className="w-4 h-4" />}
                accent="from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-300"
              />
              <KpiCard
                titulo="Volumes"
                valor={fmtNum(kpis?.total_volumes ?? 0)}
                sub={`${fmtNum(kpis?.total_ctes ?? 0)} documentos`}
                icon={<Building2 className="w-4 h-4" />}
                accent="from-rose-500/15 to-rose-500/0 text-rose-600 dark:text-rose-300"
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
                    {dados.periodo.granularidade === 'dia' ? 'Diário' : 'Mensal'}
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
                        />
                        <Area
                          type="monotone"
                          dataKey="comissao"
                          name="Comissão"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="url(#gCom)"
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
                      <div key={f.status} className="space-y-1">
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
                          className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 hover:bg-accent/40 transition-colors"
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
                          <div key={t.tp} className="flex items-center justify-between text-xs">
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
                          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/40 transition-colors"
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
                          <Bar dataKey="frete" radius={[0, 4, 4, 0]} maxBarSize={18}>
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
                    <h3 className="text-sm font-semibold text-foreground">Geolocalização</h3>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {fmtNum(pontos.length)} pontos
                  </Badge>
                </div>
                <CardContent className="pt-0 px-0">
                  {pontos.length === 0 ? (
                    <p className="py-16 text-center text-sm text-muted-foreground px-4">
                      Nenhum cliente com geolocalização cadastrada no período.
                    </p>
                  ) : (
                    <div ref={mapaRef} style={{ width: '100%', height: 340, zIndex: 1 }} />
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
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
}: {
  titulo: string;
  valor: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <Card className={`relative overflow-hidden border-border/60 shadow-sm bg-gradient-to-br ${accent}`}>
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
