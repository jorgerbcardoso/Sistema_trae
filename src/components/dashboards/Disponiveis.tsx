import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { usePageTitle } from '../../hooks/usePageTitle';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { toast } from 'sonner';
import {
  Warehouse,
  Truck,
  PackageSearch,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Package,
  Weight,
  Box,
  MapPin,
  Building2,
  TrendingUp,
  Layers,
  Timer,
  Loader2,
} from 'lucide-react';

interface Cte {
  ctrc: string;
  serCte: string;
  nroCte: number;
  tipo: string;
  emissao: string;
  prevEnt: string;
  nfiscal: string;
  pedido: string;
  remetente: string;
  pagador: string;
  destinatario: string;
  cidade: string;
  uf: string;
  vlrNf: string;
  frete: string;
  peso: string;
  cubagem: string;
  qtdeVol: string;
  manifesto: string;
  prevChegada: string;
  emTransito: boolean;
  unidadeDest: string;
  nomeDest: string;
  indicadorSaida: 'verde' | 'amarelo' | 'laranja' | 'vermelho' | null;
  atrasoTransf: 'verde' | 'amarelo' | 'laranja' | 'vermelho' | null;
}

interface Coleta {
  serColeta: string;
  nroColeta: string;
  remetente: string;
  cidadeRem: string;
  dataHoreLim: string;
  coletada: string;
  valMerc: string;
  qtdeVol: string;
  peso: string;
  statusColeta: 'pendente' | 'coletada' | 'coletada_atrasada' | 'atrasada';
  atrasoMin: number | null;
}

interface DadosTransferencia {
  ctes: Cte[];
  coletas: Coleta[];
  sigla: string;
  geradoEm: string;
}

interface GrupoDestino {
  sigla: string;
  nome: string;
  armazem: Cte[];
  transito: Cte[];
  totalCtes: number;
  totalVol: number;
  totalPeso: number;
  totalCubagem: number;
}

const COR_INDICADOR: Record<string, string> = {
  verde:    'bg-green-500',
  amarelo:  'bg-yellow-400',
  laranja:  'bg-orange-500',
  vermelho: 'bg-red-600',
};

const TEXTO_INDICADOR: Record<string, string> = {
  verde:    'text-green-700 dark:text-green-400',
  amarelo:  'text-yellow-700 dark:text-yellow-400',
  laranja:  'text-orange-700 dark:text-orange-400',
  vermelho: 'text-red-700 dark:text-red-400',
};

const BG_INDICADOR: Record<string, string> = {
  verde:    'bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-800',
  amarelo:  'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-200 dark:border-yellow-800',
  laranja:  'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800',
  vermelho: 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800',
};

function IndicadorDot({ cor, title }: { cor: string | null; title?: string }) {
  if (!cor) return <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" title={title ?? 'Sem dados'} />;
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${COR_INDICADOR[cor]}`} title={title} />;
}

function formatarAtraso(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

function StatusColetaBadge({ coleta }: { coleta: Coleta }) {
  if (coleta.statusColeta === 'coletada') {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Coletada</Badge>;
  }
  if (coleta.statusColeta === 'coletada_atrasada') {
    return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Coletada c/ atraso {coleta.atrasoMin ? formatarAtraso(coleta.atrasoMin) : ''}</Badge>;
  }
  if (coleta.statusColeta === 'atrasada') {
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs"><XCircle className="w-3 h-3 mr-1" />Atrasada {coleta.atrasoMin ? formatarAtraso(coleta.atrasoMin) : ''}</Badge>;
  }
  return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-xs"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
}

function TabelaCtes({ ctes, tipo }: { ctes: Cte[]; tipo: 'armazem' | 'transito' }) {
  if (ctes.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <th className="px-3 py-2 text-left font-semibold">CT-e</th>
            <th className="px-3 py-2 text-left font-semibold">Emissão</th>
            <th className="px-3 py-2 text-left font-semibold">Prev. Ent.</th>
            <th className="px-3 py-2 text-left font-semibold">Remetente</th>
            <th className="px-3 py-2 text-left font-semibold">Pagador</th>
            <th className="px-3 py-2 text-left font-semibold">Destinatário</th>
            <th className="px-3 py-2 text-left font-semibold">Cidade/UF</th>
            <th className="px-3 py-2 text-right font-semibold">Vlr. NF</th>
            <th className="px-3 py-2 text-right font-semibold">Frete</th>
            <th className="px-3 py-2 text-right font-semibold">Peso</th>
            <th className="px-3 py-2 text-right font-semibold">Vol.</th>
            <th className="px-3 py-2 text-left font-semibold">Manifesto</th>
            {tipo === 'transito' && <th className="px-3 py-2 text-left font-semibold">Prev. Chegada</th>}
            <th className="px-3 py-2 text-center font-semibold">Saída</th>
          </tr>
        </thead>
        <tbody>
          {ctes.map((cte, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
              <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">{cte.ctrc}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.emissao}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.prevEnt}</td>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[90px] truncate">{cte.remetente}</td>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[90px] truncate">{cte.pagador}</td>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[90px] truncate">{cte.destinatario}</td>
              <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.cidade}/{cte.uf}</td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.vlrNf}</td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.frete}</td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.peso}</td>
              <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.qtdeVol}</td>
              <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400">{cte.manifesto || '-'}</td>
              {tipo === 'transito' && (
                <td className={`px-3 py-2 font-semibold ${cte.atrasoTransf ? TEXTO_INDICADOR[cte.atrasoTransf] : ''}`}>{cte.prevChegada}</td>
              )}
              <td className="px-3 py-2 text-center">
                <IndicadorDot cor={cte.indicadorSaida} title={cte.indicadorSaida ? `Atraso saída: ${cte.indicadorSaida}` : 'Sem manifesto'} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GrupoDestinoCard({ grupo, maxPeso, maxCubagem }: { grupo: GrupoDestino; maxPeso: number; maxCubagem: number }) {
  const [aberto, setAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'armazem' | 'transito'>('armazem');

  const ORDEM_IND: Record<string, number> = { vermelho: 4, laranja: 3, amarelo: 2, verde: 1 };
  const getPior = (ctes: Cte[], campo: 'indicadorSaida' | 'atrasoTransf') =>
    ctes.reduce<string | null>((p, c) => {
      const v = c[campo]; if (!v) return p; if (!p) return v;
      return (ORDEM_IND[v] ?? 0) > (ORDEM_IND[p] ?? 0) ? v : p;
    }, null);

  const piorTransito = getPior(grupo.transito, 'atrasoTransf');

  const pctEntregueNoPrazo = (() => {
    const comEntrega = [...grupo.armazem, ...grupo.transito].filter(c => c.indicadorSaida !== null);
    if (comEntrega.length === 0) return null;
    const noPrazo = comEntrega.filter(c => c.indicadorSaida === 'verde').length;
    return Math.round((noPrazo / comEntrega.length) * 100);
  })();

  return (
    <div className="overflow-hidden">
      <button
        className="w-full grid px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
        style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 70px minmax(100px,1fr) minmax(80px,1fr)' }}
        onClick={() => setAberto(!aberto)}
      >
        <span className="flex items-center">
          {aberto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </span>
        <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
          <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          {grupo.sigla}
        </span>
        <span className="flex items-center text-slate-500 dark:text-slate-400 text-xs truncate pr-2">{grupo.nome}</span>
        <span className="flex items-center justify-end">
          {pctEntregueNoPrazo !== null
            ? <span className={`text-xs font-bold ${pctEntregueNoPrazo >= 80 ? 'text-green-600 dark:text-green-400' : pctEntregueNoPrazo >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{pctEntregueNoPrazo}%</span>
            : <span className="text-xs text-slate-400">-</span>}
        </span>
        <span className="flex items-center justify-end font-semibold text-slate-800 dark:text-slate-200">{grupo.armazem.length}</span>
        <span className="flex items-center justify-end font-semibold text-slate-800 dark:text-slate-200">{grupo.transito.length}</span>
        <span className="flex items-center justify-end text-slate-600 dark:text-slate-400 font-medium">{grupo.totalVol.toLocaleString('pt-BR')}</span>
        <span className="flex items-center px-1">
          {(() => {
            const pct = maxPeso > 0 ? (grupo.totalPeso / maxPeso) * 100 : 0;
            const label = grupo.totalPeso >= 1000
              ? `${(grupo.totalPeso / 1000).toFixed(1)}t`
              : `${grupo.totalPeso.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}kg`;
            return (
              <div className="relative w-full h-5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded bg-amber-400 dark:bg-amber-600 transition-all" style={{ width: `${pct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 mix-blend-normal z-10">{label}</span>
              </div>
            );
          })()}
        </span>
        <span className="flex items-center px-1">
          {(() => {
            const pct = maxCubagem > 0 ? (grupo.totalCubagem / maxCubagem) * 100 : 0;
            return (
              <div className="relative w-full h-5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded bg-teal-400 dark:bg-teal-600 transition-all" style={{ width: `${pct}%` }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200 z-10">{grupo.totalCubagem.toFixed(2)}m³</span>
              </div>
            );
          })()}
        </span>
      </button>

      {aberto && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <button
              onClick={() => setAbaAtiva('armazem')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'armazem' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Warehouse className="w-4 h-4" />
              No Armazém
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">{grupo.armazem.length}</Badge>
            </button>
            <button
              onClick={() => setAbaAtiva('transito')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'transito' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Truck className="w-4 h-4" />
              Em Trânsito
              <Badge className={`text-xs ${piorTransito ? `${BG_INDICADOR[piorTransito]} ${TEXTO_INDICADOR[piorTransito]}` : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{grupo.transito.length}</Badge>
            </button>
          </div>
          <div className="bg-white dark:bg-slate-900 p-2">
            {abaAtiva === 'armazem' && (
              grupo.armazem.length > 0
                ? <TabelaCtes ctes={grupo.armazem} tipo="armazem" />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e no armazém para este destino.</p>
            )}
            {abaAtiva === 'transito' && (
              grupo.transito.length > 0
                ? <TabelaCtes ctes={grupo.transito} tipo="transito" />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e em trânsito para este destino.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TabelaColetas({ coletas }: { coletas: Coleta[] }) {
  const porCidade = coletas.reduce<Record<string, Coleta[]>>((acc, c) => {
    const key = c.cidadeRem || 'SEM CIDADE';
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  const cidades = Object.keys(porCidade).sort();

  return (
    <div className="space-y-4">
      {cidades.map(cidade => {
        const cols = porCidade[cidade];
        const totalVol  = cols.reduce((s, c) => s + (parseInt(c.qtdeVol) || 0), 0);
        const totalPeso = cols.reduce((s, c) => s + (parseFloat(c.peso.replace('.', '').replace(',', '.')) || 0), 0);
        const temAtrasada = cols.some(c => c.statusColeta === 'atrasada' || c.statusColeta === 'coletada_atrasada');

        return (
          <div key={cidade} className={`border rounded-xl overflow-hidden ${temAtrasada ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
            <div className="flex items-center justify-between px-5 py-3 bg-white/60 dark:bg-slate-900/60">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" />
                <span className="font-semibold text-slate-900 dark:text-slate-100">{cidade}</span>
                {temAtrasada && <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs"><AlertTriangle className="w-3 h-3 mr-1" />Atenção</Badge>}
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                <span><strong className="text-slate-900 dark:text-slate-100">{cols.length}</strong> coletas</span>
                <span><strong className="text-slate-900 dark:text-slate-100">{totalVol}</strong> vol</span>
                <span><strong className="text-slate-900 dark:text-slate-100">{totalPeso.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</strong> kg</span>
              </div>
            </div>
            <div className="overflow-x-auto bg-white dark:bg-slate-900">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <th className="px-3 py-2 text-left font-semibold">Coleta</th>
                    <th className="px-3 py-2 text-left font-semibold">Remetente</th>
                    <th className="px-3 py-2 text-left font-semibold">Limite</th>
                    <th className="px-3 py-2 text-left font-semibold">Coletada</th>
                    <th className="px-3 py-2 text-right font-semibold">Vlr. Merc.</th>
                    <th className="px-3 py-2 text-right font-semibold">Vol.</th>
                    <th className="px-3 py-2 text-right font-semibold">Peso (kg)</th>
                    <th className="px-3 py-2 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cols.map((c, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">{c.serColeta} {c.nroColeta}</td>
                      <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[120px] truncate">{c.remetente}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{c.dataHoreLim}</td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{c.coletada || '-'}</td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{c.valMerc}</td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{c.qtdeVol}</td>
                      <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{c.peso}</td>
                      <td className="px-3 py-2"><StatusColetaBadge coleta={c} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Disponiveis() {
  usePageTitle('Disponíveis no Armazém');
  const { user } = useAuth();
  const { theme } = useTheme();

  const unidadeLogada = user?.unidade_atual || user?.unidade || '';
  const isMTZ = unidadeLogada === 'MTZ' || unidadeLogada === '';

  const [sigla] = useState<string>(unidadeLogada);

  const [dados, setDados] = useState<DadosTransferencia | null>(null);
  const [loading, setLoading] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('');
  const [countdown, setCountdown] = useState(300);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [abaAtiva, setAbaAtiva] = useState<'transferencia' | 'entrega'>('transferencia');

  type OrdemCol = 'sigla' | 'armazem' | 'transito' | 'totalVol' | 'totalPeso' | 'totalCubagem' | 'piorSaida' | 'piorTransito';
  const [ordemCol, setOrdemCol]   = useState<OrdemCol>('totalCtes' as any);
  const [ordemDir, setOrdemDir]   = useState<'asc' | 'desc'>('desc');

  const carregar = useCallback(async (siglaParam?: string) => {
    const s = siglaParam ?? sigla;
    if (!s) return;
    try {
      setLoading(true);
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_disponiveis_transferencia.php`,
        { method: 'POST', body: JSON.stringify({ sigla: s }) },
        true
      );
      if (res.success) {
        setDados(res.data);
        setUltimaAtualizacao(res.data.geradoEm);
        setCountdown(300);
      } else {
        toast.error(res.message || 'Erro ao carregar dados');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [sigla]);

  useEffect(() => {
    if (isMTZ) {
      toast.error('Acesso não permitido para a unidade MTZ. Faça login em uma unidade específica.');
      return;
    }
    if (sigla) carregar();
  }, [sigla]);

  useEffect(() => {
    if (!sigla) return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          carregar();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sigla, carregar]);



  const ORDEM_INDICADOR: Record<string, number> = { vermelho: 4, laranja: 3, amarelo: 2, verde: 1 };

  const getPiorIndicador = (ctes: Cte[], campo: 'indicadorSaida' | 'atrasoTransf'): string | null =>
    ctes.reduce<string | null>((pior, cte) => {
      const v = cte[campo];
      if (!v) return pior;
      if (!pior) return v;
      return (ORDEM_INDICADOR[v] ?? 0) > (ORDEM_INDICADOR[pior] ?? 0) ? v : pior;
    }, null);

  const grupos: GrupoDestino[] = React.useMemo(() => {
    if (!dados) return [];
    const map: Record<string, GrupoDestino> = {};
    for (const cte of dados.ctes) {
      const key = cte.unidadeDest;
      if (!map[key]) {
        map[key] = { sigla: key, nome: cte.nomeDest, armazem: [], transito: [], totalCtes: 0, totalVol: 0, totalPeso: 0, totalCubagem: 0 };
      }
      if (cte.emTransito) {
        map[key].transito.push(cte);
      } else {
        map[key].armazem.push(cte);
      }
      map[key].totalCtes++;
      map[key].totalVol     += parseInt(cte.qtdeVol) || 0;
      map[key].totalPeso    += parseFloat(cte.peso.replace('.', '').replace(',', '.')) || 0;
      map[key].totalCubagem += parseFloat(cte.cubagem.replace(',', '.')) || 0;
    }
    const lista = Object.values(map);
    const mult = ordemDir === 'desc' ? -1 : 1;
    return lista.sort((a, b) => {
      switch (ordemCol as string) {
        case 'sigla':        return mult * a.sigla.localeCompare(b.sigla);
        case 'armazem':      return mult * (a.armazem.length - b.armazem.length);
        case 'transito':     return mult * (a.transito.length - b.transito.length);
        case 'totalVol':     return mult * (a.totalVol - b.totalVol);
        case 'totalPeso':    return mult * (a.totalPeso - b.totalPeso);
        case 'totalCubagem': return mult * (a.totalCubagem - b.totalCubagem);
        case 'piorSaida':    return mult * ((ORDEM_INDICADOR[getPiorIndicador([...a.armazem, ...a.transito], 'indicadorSaida') ?? ''] ?? 0) - (ORDEM_INDICADOR[getPiorIndicador([...b.armazem, ...b.transito], 'indicadorSaida') ?? ''] ?? 0));
        case 'piorTransito': return mult * ((ORDEM_INDICADOR[getPiorIndicador(a.transito, 'atrasoTransf') ?? ''] ?? 0) - (ORDEM_INDICADOR[getPiorIndicador(b.transito, 'atrasoTransf') ?? ''] ?? 0));
        default:             return mult * (b.totalCtes - a.totalCtes);
      }
    });
  }, [dados, ordemCol, ordemDir]);

  const totalArmazem  = dados?.ctes.filter(c => !c.emTransito).length ?? 0;
  const totalTransito = dados?.ctes.filter(c => c.emTransito).length ?? 0;
  const totalColetas  = dados?.coletas.length ?? 0;
  const totalVol      = grupos.reduce((s, g) => s + g.totalVol, 0);
  const totalPeso     = grupos.reduce((s, g) => s + g.totalPeso, 0);
  const totalCubagem  = grupos.reduce((s, g) => s + g.totalCubagem, 0);
  const coletasAtrasadas = dados?.coletas.filter(c => c.statusColeta === 'atrasada' || c.statusColeta === 'coletada_atrasada').length ?? 0;
  const ctesTransitoAlerta = dados?.ctes.filter(c => c.emTransito && (c.atrasoTransf === 'vermelho' || c.atrasoTransf === 'laranja')).length ?? 0;

  const minutos = Math.floor(countdown / 60);
  const segundos = countdown % 60;

  return (
    <DashboardLayout
      title="Disponíveis no Armazém"
      description={user?.client_name}
      headerActions={
        <div className="flex items-center gap-3">
          {sigla && !isMTZ && (
            <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 text-sm px-3 py-1">
              <Building2 className="w-3.5 h-3.5 mr-1.5" />
              {sigla}
            </Badge>
          )}
          {ultimaAtualizacao && !isMTZ && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Timer className="w-3.5 h-3.5" />
              <span>Atualiza em {minutos}:{String(segundos).padStart(2, '0')}</span>
            </div>
          )}
          {!isMTZ && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => carregar()}
              disabled={loading || !sigla}
              className="dark:border-slate-600"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-1.5">Atualizar</span>
            </Button>
          )}
        </div>
      }
    >
      {isMTZ ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
          <Building2 className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">Acesso não disponível para a unidade MTZ</p>
          <p className="text-sm mt-1">Faça login em uma unidade específica para visualizar este painel.</p>
        </div>
      ) : loading && !dados ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
          <p className="text-base">Aguarde...</p>
          <p className="text-sm mt-1">Isso pode levar alguns segundos</p>
        </div>
      ) : dados ? (
        <div className="space-y-6">
          {(() => {
            const totalCtes = totalArmazem + totalTransito + totalColetas;
            const pctArmazem  = totalCtes > 0 ? Math.round((totalArmazem  / totalCtes) * 100) : 0;
            const pctTransito = totalCtes > 0 ? Math.round((totalTransito / totalCtes) * 100) : 0;
            const pctColetas  = totalCtes > 0 ? Math.round((totalColetas  / totalCtes) * 100) : 0;

            const cardsDonut = [
              {
                bgColor: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800',
                textColor: 'text-indigo-700 dark:text-indigo-300',
                emptyColor: '#e0e7ff', emptyColorDark: '#1e1b4b',
                cor: '#6366f1',
                icon: Warehouse,
                valor: totalArmazem,
                pct: pctArmazem,
                label: 'No Armazém',
                sub: null,
              },
              {
                bgColor: ctesTransitoAlerta > 0
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800'
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
                textColor: ctesTransitoAlerta > 0 ? 'text-orange-700 dark:text-orange-300' : 'text-blue-700 dark:text-blue-300',
                emptyColor: ctesTransitoAlerta > 0 ? '#ffedd5' : '#dbeafe',
                emptyColorDark: ctesTransitoAlerta > 0 ? '#431407' : '#1e3a8a',
                cor: ctesTransitoAlerta > 0 ? '#f97316' : '#3b82f6',
                icon: Truck,
                valor: totalTransito,
                pct: pctTransito,
                label: 'Em Trânsito',
                sub: ctesTransitoAlerta > 0 ? `${ctesTransitoAlerta} com atraso` : null,
              },
              {
                bgColor: coletasAtrasadas > 0
                  ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800'
                  : 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800',
                textColor: coletasAtrasadas > 0 ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300',
                emptyColor: coletasAtrasadas > 0 ? '#fee2e2' : '#d1fae5',
                emptyColorDark: coletasAtrasadas > 0 ? '#7f1d1d' : '#064e3b',
                cor: coletasAtrasadas > 0 ? '#ef4444' : '#10b981',
                icon: PackageSearch,
                valor: totalColetas,
                pct: pctColetas,
                label: 'Coletas',
                sub: coletasAtrasadas > 0 ? `${coletasAtrasadas} atrasada${coletasAtrasadas > 1 ? 's' : ''}` : null,
              },
            ];

            const cardsSimples = [
              { valor: totalVol.toLocaleString('pt-BR'), label: 'Volumes',    icon: Package, corBg: 'bg-purple-100 dark:bg-purple-900/40', corTexto: 'text-purple-600 dark:text-purple-400' },
              { valor: `${(totalPeso / 1000).toFixed(1)}t`,  label: 'Peso Total', icon: Weight,  corBg: 'bg-amber-100 dark:bg-amber-900/40',  corTexto: 'text-amber-600 dark:text-amber-400' },
              { valor: `${totalCubagem.toFixed(1)} m³`,       label: 'Cubagem',    icon: Box,     corBg: 'bg-teal-100 dark:bg-teal-900/40',   corTexto: 'text-teal-600 dark:text-teal-400' },
            ];

            return (
              <div className="grid grid-cols-3 gap-4">
                {cardsDonut.map((c, i) => {
                  const Icon = c.icon;
                  const donutData = [{ value: c.pct }, { value: Math.max(0, 100 - c.pct) }];
                  return (
                    <Card key={i} className={`${c.bgColor}`}>
                      <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${c.textColor}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {c.label}
                            </div>
                            <div className={`text-2xl font-bold tabular-nums ${c.textColor}`}>{c.pct}%</div>
                            <p className={`text-sm mt-0.5 ${c.textColor}`}>{c.valor} CT-e{c.valor !== 1 ? 's' : ''}</p>
                            {c.sub && <p className={`text-xs mt-0.5 font-semibold ${c.textColor} opacity-80`}>{c.sub}</p>}
                          </div>
                          <div style={{ width: 80, height: 80 }}>
                            <PieChart width={80} height={80}>
                              <Pie data={donutData} cx={40} cy={40} innerRadius={20} outerRadius={35} startAngle={90} endAngle={-270} dataKey="value" stroke="none">
                                <Cell fill={c.cor} />
                                <Cell fill={theme === 'dark' ? c.emptyColorDark : c.emptyColor} />
                              </Pie>
                            </PieChart>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {cardsSimples.map((c, i) => {
                  const Icon = c.icon;
                  return (
                    <Card key={i} className="dark:bg-slate-900 dark:border-slate-700">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${c.corBg}`}>
                            <Icon className={`w-4 h-4 ${c.corTexto}`} />
                          </div>
                          <div>
                            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{c.valor}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}

          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setAbaAtiva('transferencia')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${abaAtiva === 'transferencia' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Layers className="w-4 h-4" />
              Disponíveis para Transferência
              <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 text-xs">{totalArmazem + totalTransito}</Badge>
            </button>
            <button
              onClick={() => setAbaAtiva('entrega')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${abaAtiva === 'entrega' ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <TrendingUp className="w-4 h-4" />
              Disponíveis para Entrega
              <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs">Em breve</Badge>
            </button>
          </div>

          {abaAtiva === 'transferencia' && (
            <div className="space-y-4">
              {grupos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">CT-es por Destino</h2>
                        <span className="text-sm text-slate-500 dark:text-slate-400">({grupos.length} destinos)</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                          <ChevronRight className="w-3 h-3" />clique em um destino para expandir
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-3">
                        <span className="font-medium text-slate-600 dark:text-slate-300">Indicador Saída:</span>
                        {(['verde','amarelo','laranja','vermelho'] as const).map(cor => (
                          <span key={cor} className="flex items-center gap-1">
                            <IndicadorDot cor={cor} />
                            <span className={TEXTO_INDICADOR[cor]}>
                              {cor === 'verde' ? '≤1 dia' : cor === 'amarelo' ? '2 dias' : cor === 'laranja' ? '3 dias' : '4+ dias'}
                            </span>
                          </span>
                        ))}
                        <span className="flex items-center gap-1">
                          <IndicadorDot cor={null} />
                          <span>sem manifesto</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    {(() => {
                      const toggleOrdem = (col: string) => {
                        if (ordemCol === col) setOrdemDir(d => d === 'desc' ? 'asc' : 'desc');
                        else { setOrdemCol(col as any); setOrdemDir('desc'); }
                      };
                      const ThBtn = ({ col, children, right }: { col: string; children: React.ReactNode; right?: boolean }) => (
                        <button
                          onClick={() => toggleOrdem(col)}
                          className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${right ? 'justify-end w-full' : ''}`}
                        >
                          {children}
                          {ordemCol === col
                            ? (ordemDir === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 rotate-180" />)
                            : <span className="w-3 h-3 opacity-30">↕</span>}
                        </button>
                      );
                      return (
                        <>
                          <div className="grid bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2"
                            style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 70px minmax(100px,1fr) minmax(80px,1fr)' }}>
                            <span />
                            <ThBtn col="sigla">Destino</ThBtn>
                            <span />
                            <ThBtn col="piorSaida" right>Perf. Saída</ThBtn>
                            <ThBtn col="armazem" right>Piso</ThBtn>
                            <ThBtn col="transito" right>Trânsito</ThBtn>
                            <ThBtn col="totalVol" right>Volumes</ThBtn>
                            <ThBtn col="totalPeso" right>Peso</ThBtn>
                            <ThBtn col="totalCubagem" right>Cubagem</ThBtn>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {(() => {
                                const maxPeso     = Math.max(...grupos.map(g => g.totalPeso), 1);
                                const maxCubagem  = Math.max(...grupos.map(g => g.totalCubagem), 1);
                                return grupos.map(g => <GrupoDestinoCard key={g.sigla} grupo={g} maxPeso={maxPeso} maxCubagem={maxCubagem} />);
                              })()}
                            </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {dados.coletas.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <PackageSearch className="w-4 h-4 text-green-500" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Coletas em Andamento</h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">({dados.coletas.length} coletas)</span>
                    {coletasAtrasadas > 0 && (
                      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-xs">
                        <AlertTriangle className="w-3 h-3 mr-1" />{coletasAtrasadas} atrasada{coletasAtrasadas > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <TabelaColetas coletas={dados.coletas} />
                </div>
              )}

              {grupos.length === 0 && dados.coletas.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                  <CheckCircle2 className="w-12 h-12 mb-3 text-green-400" />
                  <p className="text-base font-medium">Nenhum CT-e disponível para transferência</p>
                  <p className="text-sm mt-1">Armazém limpo e sem coletas pendentes!</p>
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'entrega' && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
              <TrendingUp className="w-14 h-14 mb-4 opacity-30" />
              <p className="text-lg font-medium">Disponíveis para Entrega</p>
              <p className="text-sm mt-1">Esta aba será implementada em breve.</p>
            </div>
          )}

          {ultimaAtualizacao && (
            <p className="text-xs text-slate-400 dark:text-slate-600 text-right">
              Dados gerados em: {ultimaAtualizacao}
            </p>
          )}
        </div>
      ) : null}
    </DashboardLayout>
  );
}
