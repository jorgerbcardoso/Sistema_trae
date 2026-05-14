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
  Layers,
  Timer,
  Loader2,
  Home,
  ListFilter,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Car,
  X,
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
  cidadeDest: string;
  unidadeDest: string;
  paraEntrega: boolean;
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

interface CteEntrega {
  ctrc: string;
  serCte: string;
  nroCte: number;
  setor: string;
  nfiscal: string;
  pagador: string;
  destinatario: string;
  cnpjDest: string;
  endereco: string;
  cidade: string;
  bairro: string;
  cep: string;
  prevEnt: string;
  agendamento: string;
  vlrMerc: string;
  peso: string;
  cubagem: string;
  qtdeVol: string;
  frete: string;
  codUltOcor: string;
  descUltOcor: string;
  dataUltOcor: string;
  agendObrig: boolean;
  prevChegada: string;
  manifesto: string;
  diasAtraso: number;
  emTransito: boolean;
  atrasoEntrega: 'verde' | 'amarelo' | 'laranja' | 'vermelho' | null;
}

interface DadosEntrega {
  ctes: CteEntrega[];
  sigla: string;
  geradoEm: string;
}

interface GrupoSetor {
  setor: string;
  armazem: CteEntrega[];
  transito: CteEntrega[];
  totalCtes: number;
  totalVol: number;
  totalPeso: number;
  totalCubagem: number;
}

interface GrupoDestino {
  sigla: string;
  nome: string;
  armazem: Cte[];
  transito: Cte[];
  coletas: Coleta[];
  totalCtes: number;
  totalVol: number;
  totalPeso: number;
  totalCubagem: number;
}

interface CteCarregamento {
  seq_cte: number;
  login_inclusao: string;
  data_inclusao: string;
  hora_inclusao: string;
}

interface Carregamento {
  placa_provisoria: string;
  total_ctes: number;
  data_criacao: string;
  hora_criacao: string;
  login_criacao: string;
  capacidade_ton: number | null;
  capacidade_m3: number | null;
  ctes: CteCarregamento[];
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

function TabelaCtes({
  ctes,
  tipo,
  modoApontamento,
  ctesSelecionados,
  ctesNoCarregamento,
  onToggleCte,
}: {
  ctes: Cte[];
  tipo: 'armazem' | 'transito';
  modoApontamento?: string | null;
  ctesSelecionados?: Set<number>;
  ctesNoCarregamento?: Set<number>;
  onToggleCte?: (seqCte: number) => void;
}) {
  if (ctes.length === 0) return null;
  const emApontamento = !!modoApontamento;
  return (
    <div className="overflow-x-auto">
      {emApontamento && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <CheckSquare className="w-3.5 h-3.5 shrink-0" />
          Selecione os CT-es para adicionar ao carregamento <strong>{modoApontamento}</strong>
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {emApontamento && <th className="px-3 py-2 w-8" />}
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
          {ctes.map((cte, i) => {
            const jaNoCarregamento = ctesNoCarregamento?.has(cte.nroCte) ?? false;
            const selecionado = ctesSelecionados?.has(cte.nroCte) ?? false;
            const rowBg = jaNoCarregamento
              ? 'bg-emerald-50 dark:bg-emerald-950/20'
              : selecionado
              ? 'bg-amber-50 dark:bg-amber-950/20'
              : 'hover:bg-slate-50 dark:hover:bg-slate-900/50';
            return (
              <tr
                key={i}
                className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${rowBg} ${emApontamento && !jaNoCarregamento ? 'cursor-pointer' : ''}`}
                onClick={emApontamento && !jaNoCarregamento && onToggleCte ? () => onToggleCte(cte.nroCte) : undefined}
              >
                {emApontamento && (
                  <td className="px-3 py-2 text-center">
                    {jaNoCarregamento ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : selecionado ? (
                      <CheckSquare className="w-4 h-4 text-amber-500 mx-auto" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                    )}
                  </td>
                )}
                <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">
                  {cte.ctrc}
                  {jaNoCarregamento && <span className="ml-1 text-emerald-500 font-bold" title="Já neste carregamento">✓</span>}
                </td>
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GrupoDestinoCard({
  grupo,
  maxPeso,
  maxCubagem,
  modoApontamento,
  ctesSelecionados,
  ctesNoCarregamento,
  onToggleCte,
}: {
  grupo: GrupoDestino;
  maxPeso: number;
  maxCubagem: number;
  modoApontamento?: string | null;
  ctesSelecionados?: Set<number>;
  ctesNoCarregamento?: Set<number>;
  onToggleCte?: (seqCte: number) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'armazem' | 'transito' | 'coletas'>('armazem');

  const pctPeso    = maxPeso > 0 ? (grupo.totalPeso / maxPeso) * 100 : 0;
  const pctCubagem = maxCubagem > 0 ? (grupo.totalCubagem / maxCubagem) * 100 : 0;

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
        style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px minmax(80px,1fr) minmax(80px,1fr)' }}
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
        <span className="flex items-center justify-center">
          {pctEntregueNoPrazo !== null
            ? <span className={`text-xs font-bold ${pctEntregueNoPrazo >= 80 ? 'text-green-600 dark:text-green-400' : pctEntregueNoPrazo >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{pctEntregueNoPrazo}%</span>
            : <span className="text-xs text-slate-400">-</span>}
        </span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.armazem.length}</span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.transito.length}</span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.coletas.length > 0 ? grupo.coletas.length : '-'}</span>
        <span className="flex items-center justify-center text-slate-600 dark:text-slate-400 font-medium">{grupo.totalVol.toLocaleString('pt-BR')}</span>
        <span className="flex items-center justify-center px-2">
          {(() => {
            const label = grupo.totalPeso >= 1000
              ? `${(grupo.totalPeso / 1000).toFixed(1)}t`
              : `${grupo.totalPeso.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}kg`;
            return (
              <div className="relative w-full h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pctPeso}%`, background: 'linear-gradient(90deg, #4c1d95, #6d28d9, #8b5cf6)' }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow z-10">{label}</span>
              </div>
            );
          })()}
        </span>
        <span className="flex items-center justify-center px-2">
          {(() => {
            return (
              <div className="relative w-full h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pctCubagem}%`, background: 'linear-gradient(90deg, #312e81, #4338ca, #6366f1)' }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow z-10">{grupo.totalCubagem.toFixed(2)}m³</span>
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
              Em Transferência
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">{grupo.transito.length}</Badge>
            </button>
            {grupo.coletas.length > 0 && (
              <button
                onClick={() => setAbaAtiva('coletas')}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'coletas' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                <Package className="w-4 h-4" />
                Em Coleta
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-xs">{grupo.coletas.length}</Badge>
              </button>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 p-2">
            {abaAtiva === 'armazem' && (
              grupo.armazem.length > 0
                ? <TabelaCtes ctes={grupo.armazem} tipo="armazem" modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamento} onToggleCte={onToggleCte} />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e no armazém para este destino.</p>
            )}
            {abaAtiva === 'transito' && (
              grupo.transito.length > 0
                ? <TabelaCtes ctes={grupo.transito} tipo="transito" modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamento} onToggleCte={onToggleCte} />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e em trânsito para este destino.</p>
            )}
            {abaAtiva === 'coletas' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <th className="px-3 py-2 text-left font-semibold">Coleta</th>
                      <th className="px-3 py-2 text-left font-semibold">Remetente</th>
                      <th className="px-3 py-2 text-left font-semibold">Cidade Dest.</th>
                      <th className="px-3 py-2 text-left font-semibold">Limite</th>
                      <th className="px-3 py-2 text-left font-semibold">Coletada</th>
                      <th className="px-3 py-2 text-right font-semibold">Vlr. Merc.</th>
                      <th className="px-3 py-2 text-right font-semibold">Vol.</th>
                      <th className="px-3 py-2 text-right font-semibold">Peso (kg)</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupo.coletas.map((c, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50">
                        <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200">{c.serColeta} {c.nroColeta}</td>
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[120px] truncate">{c.remetente}</td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{c.cidadeDest || '-'}</td>
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

function TabelaEntrega({
  ctes,
  tipo,
  modoApontamento,
  ctesSelecionados,
  ctesNoCarregamento,
  onToggleCte,
}: {
  ctes: CteEntrega[];
  tipo: 'armazem' | 'transito';
  modoApontamento?: string | null;
  ctesSelecionados?: Set<number>;
  ctesNoCarregamento?: Set<number>;
  onToggleCte?: (seqCte: number) => void;
}) {
  if (ctes.length === 0) return null;
  const emApontamento = !!modoApontamento;
  return (
    <div className="overflow-x-auto">
      {emApontamento && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
          <CheckSquare className="w-3.5 h-3.5 shrink-0" />
          Selecione os CT-es para adicionar ao carregamento <strong>{modoApontamento}</strong>
        </div>
      )}
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            {emApontamento && <th className="px-3 py-2 w-8" />}
            <th className="px-3 py-2 text-left font-semibold">CT-e</th>
            <th className="px-3 py-2 text-left font-semibold">NF</th>
            <th className="px-3 py-2 text-left font-semibold">Pagador</th>
            <th className="px-3 py-2 text-left font-semibold">Destinatário</th>
            <th className="px-3 py-2 text-left font-semibold">Cidade</th>
            <th className="px-3 py-2 text-left font-semibold">Prev. Ent.</th>
            <th className="px-3 py-2 text-left font-semibold">Agendamento</th>
            <th className="px-3 py-2 text-right font-semibold">Peso</th>
            <th className="px-3 py-2 text-right font-semibold">Frete</th>
            <th className="px-3 py-2 text-left font-semibold">Últ. Ocorrência</th>
            {tipo === 'transito' && <th className="px-3 py-2 text-left font-semibold">Prev. Chegada</th>}
            <th className="px-3 py-2 text-center font-semibold">Atraso</th>
          </tr>
        </thead>
        <tbody>
          {ctes.map((cte, i) => {
            const jaNoCarregamento = ctesNoCarregamento?.has(cte.nroCte) ?? false;
            const selecionado = ctesSelecionados?.has(cte.nroCte) ?? false;
            const rowBg = jaNoCarregamento
              ? 'bg-emerald-50 dark:bg-emerald-950/20'
              : selecionado
              ? 'bg-amber-50 dark:bg-amber-950/20'
              : 'hover:bg-slate-50 dark:hover:bg-slate-900/50';
            return (
              <tr
                key={i}
                className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${rowBg} ${emApontamento && !jaNoCarregamento ? 'cursor-pointer' : ''}`}
                onClick={emApontamento && !jaNoCarregamento && onToggleCte ? () => onToggleCte(cte.nroCte) : undefined}
              >
                {emApontamento && (
                  <td className="px-3 py-2 text-center">
                    {jaNoCarregamento ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : selecionado ? (
                      <CheckSquare className="w-4 h-4 text-amber-500 mx-auto" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                    )}
                  </td>
                )}
                <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  {cte.ctrc}
                  {cte.agendObrig && <span className="ml-1 text-orange-500 font-bold" title="Agendamento obrigatório">S</span>}
                  {jaNoCarregamento && <span className="ml-1 text-emerald-500 font-bold" title="Já neste carregamento">✓</span>}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.nfiscal}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[80px] truncate">{cte.pagador}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[80px] truncate">{cte.destinatario}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.cidade}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.prevEnt}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.agendamento || '-'}</td>
                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.peso ? Math.round(parseFloat(cte.peso.replace('.', '').replace(',', '.'))) + ' kg' : '-'}</td>
                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.frete}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 max-w-[160px] truncate" title={cte.descUltOcor}>{cte.descUltOcor || '-'}</td>
                {tipo === 'transito' && (
                  <td className="px-3 py-2 text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap">{cte.prevChegada}</td>
                )}
                <td className="px-3 py-2 text-center">
                  <IndicadorDot
                    cor={cte.atrasoEntrega}
                    title={cte.diasAtraso > 0 ? `${cte.diasAtraso} dia(s) em atraso` : 'No prazo'}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GrupoSetorCard({
  grupo,
  maxPeso,
  maxCubagem,
  modoApontamento,
  ctesSelecionados,
  ctesNoCarregamento,
  onToggleCte,
}: {
  grupo: GrupoSetor;
  maxPeso: number;
  maxCubagem: number;
  modoApontamento?: string | null;
  ctesSelecionados?: Set<number>;
  ctesNoCarregamento?: Set<number>;
  onToggleCte?: (seqCte: number) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState<'armazem' | 'transito'>('armazem');

  const pctPeso    = maxPeso > 0 ? (grupo.totalPeso / maxPeso) * 100 : 0;
  const pctCubagem = maxCubagem > 0 ? (grupo.totalCubagem / maxCubagem) * 100 : 0;

  const ORDEM_IND: Record<string, number> = { vermelho: 4, laranja: 3, amarelo: 2, verde: 1 };

  const piorAtraso = [...grupo.armazem, ...grupo.transito].reduce<string | null>((p, c) => {
    const v = c.atrasoEntrega;
    if (!v) return p;
    if (!p) return v;
    return (ORDEM_IND[v] ?? 0) > (ORDEM_IND[p] ?? 0) ? v : p;
  }, null);

  const temAgendObrig = [...grupo.armazem, ...grupo.transito].some(c => c.agendObrig);

  return (
    <div className="overflow-hidden">
      <button
        className="w-full grid px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
        style={{ gridTemplateColumns: '28px 60px minmax(0,1fr) 70px 70px 70px 70px minmax(80px,1fr) minmax(80px,1fr)' }}
        onClick={() => setAberto(!aberto)}
      >
        <span className="flex items-center">
          {aberto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </span>
        <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          {grupo.setor}
        </span>
        <span />
        <span className="flex items-center justify-center">
          {piorAtraso
            ? <IndicadorDot cor={piorAtraso} title={`Pior atraso: ${piorAtraso}`} />
            : <span className="text-xs text-slate-400">-</span>}
        </span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.armazem.length}</span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.transito.length}</span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.totalVol.toLocaleString('pt-BR')}</span>
        <span className="flex items-center justify-center px-2">
          {(() => {
            const label = grupo.totalPeso >= 1000
              ? `${(grupo.totalPeso / 1000).toFixed(1)}t`
              : `${grupo.totalPeso.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}kg`;
            return (
              <div className="relative w-full h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out" style={{ width: `${pctPeso}%`, background: 'linear-gradient(90deg, #065f46, #059669, #10b981)' }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow z-10">{label}</span>
              </div>
            );
          })()}
        </span>
        <span className="flex items-center justify-center px-2">
          {(() => {
            return (
              <div className="relative w-full h-4 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out" style={{ width: `${pctCubagem}%`, background: 'linear-gradient(90deg, #064e3b, #047857, #059669)' }} />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow z-10">{grupo.totalCubagem.toFixed(2)}m³</span>
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
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'armazem' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Home className="w-4 h-4" />
              No Armazém
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">{grupo.armazem.length}</Badge>
            </button>
            <button
              onClick={() => setAbaAtiva('transito')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${abaAtiva === 'transito' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Truck className="w-4 h-4" />
              A Caminho
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">{grupo.transito.length}</Badge>
            </button>
            {temAgendObrig && (
              <span className="ml-auto flex items-center gap-1 px-4 text-xs text-orange-600 dark:text-orange-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                Há CT-es com agendamento obrigatório
              </span>
            )}
          </div>
          <div className="bg-white dark:bg-slate-900 p-2">
            {abaAtiva === 'armazem' && (
              grupo.armazem.length > 0
                ? <TabelaEntrega ctes={grupo.armazem} tipo="armazem" modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamento} onToggleCte={onToggleCte} />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e no armazém para este setor.</p>
            )}
            {abaAtiva === 'transito' && (
              grupo.transito.length > 0
                ? <TabelaEntrega ctes={grupo.transito} tipo="transito" modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamento} onToggleCte={onToggleCte} />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e a caminho para este setor.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface CarregamentoAreaProps {
  sigla: string;
  carregamentos: Carregamento[];
  loadingCarregamentos: boolean;
  modoApontamento: string | null;
  onIniciarApontamento: (placa: string) => void;
  onCancelarApontamento: () => void;
  onCriarCarregamento: (placa: string) => void;
  onExcluirCarregamento: (placa: string) => void;
  onRemoverCte: (placa: string, seqCte: number) => void;
  ctesEntrega: CteEntrega[];
}

function BarraCapacidade({ valor, capacidade, corGradient, label }: { valor: number; capacidade: number; corGradient: string; label: string }) {
  const pct = capacidade > 0 ? Math.min((valor / capacidade) * 100, 100) : 0;
  const cor = pct >= 100 ? 'bg-red-500' : pct >= 85 ? 'bg-orange-500' : pct >= 60 ? 'bg-yellow-500' : undefined;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">
          {valor.toFixed(valor >= 10 ? 1 : 2)} / {capacidade.toFixed(capacidade >= 10 ? 1 : 2)}
          {' '}({pct.toFixed(0)}%)
        </span>
      </div>
      <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-700 ease-out ${cor ?? ''}`}
          style={{ width: `${pct}%`, background: cor ? undefined : corGradient }}
        />
      </div>
    </div>
  );
}

function ModalCriarCarregamento({ onConfirmar, onFechar }: { onConfirmar: (placa: string) => void; onFechar: () => void }) {
  const [placa, setPlaca] = useState('');
  const [buscaVeiculo, setBuscaVeiculo] = useState('');
  const [veiculos, setVeiculos] = useState<{ placa: string; tipo: string; marca: string; modelo: string }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [modoVeiculo, setModoVeiculo] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buscarVeiculos = useCallback(async (termo: string) => {
    if (termo.length < 3) { setVeiculos([]); return; }
    setBuscando(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/search_veiculos.php`,
        { method: 'POST', body: JSON.stringify({ search: termo }) },
        true
      );
      if (res.success) setVeiculos(res.data ?? []);
    } catch {}
    finally { setBuscando(false); }
  }, []);

  useEffect(() => {
    if (!modoVeiculo) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscarVeiculos(buscaVeiculo), 400);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [buscaVeiculo, modoVeiculo, buscarVeiculos]);

  const placaFinal = modoVeiculo ? buscaVeiculo : placa;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Novo Carregamento</h3>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            <button
              onClick={() => { setModoVeiculo(false); setBuscaVeiculo(''); setVeiculos([]); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${!modoVeiculo ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-emerald-400'}`}
            >
              Placa livre
            </button>
            <button
              onClick={() => { setModoVeiculo(true); setPlaca(''); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${modoVeiculo ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:border-emerald-400'}`}
            >
              <Car className="w-4 h-4 inline mr-1.5" />Veículo cadastrado
            </button>
          </div>

          {!modoVeiculo ? (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Placa / Identificação</label>
              <input
                type="text"
                value={placa}
                onChange={e => setPlaca(e.target.value.toUpperCase())}
                placeholder="Ex: ABC1234 ou ROTA-01"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                autoFocus
              />
            </div>
          ) : (
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Buscar veículo</label>
              <input
                type="text"
                value={buscaVeiculo}
                onChange={e => setBuscaVeiculo(e.target.value.toUpperCase())}
                placeholder="Digite a placa, tipo ou modelo..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                autoFocus
              />
              {buscando && <Loader2 className="absolute right-3 top-8 w-4 h-4 animate-spin text-slate-400" />}
              {veiculos.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {veiculos.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => { setBuscaVeiculo(v.placa); setVeiculos([]); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span className="font-mono font-bold text-sm text-slate-900 dark:text-slate-100">{v.placa}</span>
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{v.tipo} · {v.marca} {v.modelo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <Button variant="outline" className="flex-1" onClick={onFechar}>Cancelar</Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            disabled={!placaFinal.trim()}
            onClick={() => { if (placaFinal.trim()) onConfirmar(placaFinal.trim()); }}
          >
            <Plus className="w-4 h-4 mr-1.5" />Criar carregamento
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardCarregamento({
  carregamento,
  ctesEntrega,
  modoApontamento,
  onIniciarApontamento,
  onCancelarApontamento,
  onExcluirCarregamento,
  onRemoverCte,
}: {
  carregamento: Carregamento;
  ctesEntrega: CteEntrega[];
  modoApontamento: string | null;
  onIniciarApontamento: (placa: string) => void;
  onCancelarApontamento: () => void;
  onExcluirCarregamento: (placa: string) => void;
  onRemoverCte: (placa: string, seqCte: number) => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const ativo = modoApontamento === carregamento.placa_provisoria;

  const ctesDetalhados = carregamento.ctes.map(c => {
    const cteEntrega = ctesEntrega.find(e => e.nroCte === c.seq_cte);
    return { ...c, cteEntrega };
  });

  const totalPeso = ctesDetalhados.reduce((s, c) => {
    if (!c.cteEntrega) return s;
    return s + (parseFloat(c.cteEntrega.peso.replace('.', '').replace(',', '.')) || 0);
  }, 0);

  const totalCubagem = ctesDetalhados.reduce((s, c) => {
    if (!c.cteEntrega) return s;
    return s + (parseFloat(c.cteEntrega.cubagem.replace(',', '.')) || 0);
  }, 0);

  const temCapacidade = carregamento.capacidade_ton !== null && carregamento.capacidade_m3 !== null;

  return (
    <div className={`rounded-xl border-2 transition-all duration-200 ${ativo ? 'border-emerald-400 dark:border-emerald-500 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 overflow-hidden`}>
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg ${ativo ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <Truck className={`w-4 h-4 ${ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm truncate">{carregamento.placa_provisoria}</p>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                Criado em {carregamento.data_criacao} às {carregamento.hora_criacao?.slice(0, 5)} por {carregamento.login_criacao}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">
              {carregamento.total_ctes} CT-e{carregamento.total_ctes !== 1 ? 's' : ''}
            </Badge>
            {temCapacidade && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 text-xs">
                <Car className="w-3 h-3 mr-1" />Veículo
              </Badge>
            )}
          </div>
        </div>

        {temCapacidade && (
          <div className="flex gap-3 mb-3">
            <BarraCapacidade
              valor={totalPeso / 1000}
              capacidade={carregamento.capacidade_ton!}
              corGradient="linear-gradient(90deg, #7c3aed, #8b5cf6)"
              label="Peso (ton)"
            />
            <BarraCapacidade
              valor={totalCubagem}
              capacidade={carregamento.capacidade_m3!}
              corGradient="linear-gradient(90deg, #0369a1, #0ea5e9)"
              label="Cubagem (m³)"
            />
          </div>
        )}

        {!temCapacidade && carregamento.total_ctes > 0 && (
          <div className="flex gap-4 mb-3 text-xs text-slate-500 dark:text-slate-400">
            <span><Weight className="w-3 h-3 inline mr-1" />{totalPeso >= 1000 ? `${(totalPeso / 1000).toFixed(2)}t` : `${Math.round(totalPeso)}kg`}</span>
            <span><Box className="w-3 h-3 inline mr-1" />{totalCubagem.toFixed(3)}m³</span>
          </div>
        )}

        <div className="flex gap-2">
          {!ativo ? (
            <Button
              size="sm"
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-8"
              onClick={() => onIniciarApontamento(carregamento.placa_provisoria)}
            >
              <CheckSquare className="w-3.5 h-3.5 mr-1.5" />Apontar CT-es
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-emerald-400 text-emerald-700 dark:text-emerald-400 text-xs h-8"
              onClick={onCancelarApontamento}
            >
              <X className="w-3.5 h-3.5 mr-1.5" />Cancelar apontamento
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border-slate-200 dark:border-slate-700"
            onClick={() => setExpandido(!expandido)}
            title={expandido ? 'Recolher CT-es' : 'Ver CT-es'}
          >
            {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 text-red-400 hover:text-red-600 hover:border-red-300 border-slate-200 dark:border-slate-700"
            onClick={() => onExcluirCarregamento(carregamento.placa_provisoria)}
            title="Excluir carregamento"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {expandido && carregamento.ctes.length > 0 && (
        <div className="border-t border-slate-100 dark:border-slate-800">
          <div className="max-h-48 overflow-y-auto">
            {ctesDetalhados.map((c, i) => {
              const e = c.cteEntrega;
              return (
                <div key={i} className="flex items-center gap-2 px-4 py-2 border-b border-slate-50 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs">
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 w-24 shrink-0">
                    {e ? e.ctrc : `#${c.seq_cte}`}
                  </span>
                  {e && (
                    <>
                      <span className="text-slate-500 dark:text-slate-400 truncate flex-1">{e.destinatario}</span>
                      <span className="text-slate-400 dark:text-slate-500 shrink-0">{e.cidade}</span>
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">{Math.round(parseFloat(e.peso.replace('.', '').replace(',', '.')) || 0)}kg</span>
                    </>
                  )}
                  <button
                    onClick={() => onRemoverCte(carregamento.placa_provisoria, c.seq_cte)}
                    className="ml-1 text-red-400 hover:text-red-600 shrink-0"
                    title="Remover CT-e do carregamento"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CarregamentoArea({
  sigla,
  carregamentos,
  loadingCarregamentos,
  modoApontamento,
  onIniciarApontamento,
  onCancelarApontamento,
  onCriarCarregamento,
  onExcluirCarregamento,
  onRemoverCte,
  ctesEntrega,
}: CarregamentoAreaProps) {
  const [modalAberto, setModalAberto] = useState(false);

  const handleCriar = (placa: string) => {
    setModalAberto(false);
    onCriarCarregamento(placa);
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Montagem de Carregamento</h3>
          {loadingCarregamentos && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
          {carregamentos.length > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
              {carregamentos.length} carregamento{carregamentos.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {modoApontamento && (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs flex items-center gap-1">
              <CheckSquare className="w-3 h-3" />
              Apontando para: <strong>{modoApontamento}</strong>
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs h-8"
          onClick={() => setModalAberto(true)}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />Criar carregamento
        </Button>
      </div>

      {carregamentos.length === 0 && !loadingCarregamentos ? (
        <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
          <Truck className="w-10 h-10 mb-2 opacity-20" />
          <p className="text-sm">Nenhum carregamento em andamento</p>
          <p className="text-xs mt-0.5">Clique em "Criar carregamento" para começar</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {carregamentos.map((c, i) => (
            <CardCarregamento
              key={i}
              carregamento={c}
              ctesEntrega={ctesEntrega}
              modoApontamento={modoApontamento}
              onIniciarApontamento={onIniciarApontamento}
              onCancelarApontamento={onCancelarApontamento}
              onExcluirCarregamento={onExcluirCarregamento}
              onRemoverCte={onRemoverCte}
            />
          ))}
        </div>
      )}

      {modalAberto && (
        <ModalCriarCarregamento
          onConfirmar={handleCriar}
          onFechar={() => setModalAberto(false)}
        />
      )}
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

  const [dadosEntrega, setDadosEntrega] = useState<DadosEntrega | null>(null);
  const [loadingEntrega, setLoadingEntrega] = useState(false);
  const [erroEntrega, setErroEntrega] = useState<string | null>(null);
  const [progressoEntrega, setProgressoEntrega] = useState(0);
  const progressoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [carregamentos, setCarregamentos] = useState<Carregamento[]>([]);
  const [loadingCarregamentos, setLoadingCarregamentos] = useState(false);
  const [modoApontamento, setModoApontamento] = useState<string | null>(null);
  const [ctesSelecionados, setCtesSelecionados] = useState<Set<number>>(new Set());

  const [abaAtiva, setAbaAtiva] = useState<'transferencia' | 'entrega' | 'todos'>('transferencia');

  type OrdemCol = 'sigla' | 'armazem' | 'transito' | 'coletas' | 'totalVol' | 'totalPeso' | 'totalCubagem' | 'piorSaida' | 'piorTransito';
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

  const carregarEntrega = useCallback(async (siglaParam?: string) => {
    const s = siglaParam ?? sigla;
    if (!s) return;
    setLoadingEntrega(true);
    setErroEntrega(null);
    setProgressoEntrega(0);

    if (progressoRef.current) clearInterval(progressoRef.current);
    progressoRef.current = setInterval(() => {
      setProgressoEntrega(prev => {
        if (prev >= 95) { clearInterval(progressoRef.current!); return 95; }
        return prev + (prev < 60 ? 2 : 1);
      });
    }, 600);

    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_disponiveis_entrega.php`,
        { method: 'POST', body: JSON.stringify({ sigla: s }) },
        true
      );
      if (progressoRef.current) clearInterval(progressoRef.current);
      setProgressoEntrega(100);
      if (res.success) {
        setDadosEntrega(res.data);
      } else {
        setErroEntrega(res.message || 'Erro ao carregar disponíveis para entrega');
      }
    } catch (e: any) {
      if (progressoRef.current) clearInterval(progressoRef.current);
      setProgressoEntrega(0);
      setErroEntrega(e.message || 'Erro ao carregar disponíveis para entrega');
    } finally {
      setLoadingEntrega(false);
    }
  }, [sigla]);

  const carregarCarregamentos = useCallback(async () => {
    setLoadingCarregamentos(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_carregamentos.php`,
        { method: 'POST', body: JSON.stringify({}) },
        true
      );
      if (res.success) {
        setCarregamentos(res.carregamentos ?? []);
      }
    } catch {}
    finally { setLoadingCarregamentos(false); }
  }, []);

  const handleCriarCarregamento = useCallback(async (placa: string) => {
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'criar', placa, seq_cte: 0 }) },
        true
      );
      if (res.success) {
        toast.success(`Carregamento ${placa} criado!`);
        await carregarCarregamentos();
      } else {
        toast.error(res.message || 'Erro ao criar carregamento');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao criar carregamento');
    }
  }, [carregarCarregamentos]);

  const handleExcluirCarregamento = useCallback(async (placa: string) => {
    if (!confirm(`Excluir o carregamento "${placa}"? Todos os CT-es serão removidos.`)) return;
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'excluir_carregamento', placa }) },
        true
      );
      if (res.success) {
        toast.success(`Carregamento ${placa} excluído.`);
        if (modoApontamento === placa) setModoApontamento(null);
        await carregarCarregamentos();
      } else {
        toast.error(res.message || 'Erro ao excluir carregamento');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir');
    }
  }, [carregarCarregamentos, modoApontamento]);

  const handleRemoverCte = useCallback(async (placa: string, seqCte: number) => {
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'remover_cte', placa, seq_cte: seqCte }) },
        true
      );
      if (res.success) {
        await carregarCarregamentos();
      } else {
        toast.error(res.message || 'Erro ao remover CT-e');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover CT-e');
    }
  }, [carregarCarregamentos]);

  const handleConfirmarApontamento = useCallback(async () => {
    if (!modoApontamento || ctesSelecionados.size === 0) return;
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'adicionar_ctes', placa: modoApontamento, seq_ctes: Array.from(ctesSelecionados) }) },
        true
      );
      if (res.success) {
        toast.success(`${res.adicionados ?? ctesSelecionados.size} CT-e(s) adicionado(s) ao carregamento ${modoApontamento}.`);
        setCtesSelecionados(new Set());
        setModoApontamento(null);
        await carregarCarregamentos();
      } else {
        toast.error(res.message || 'Erro ao adicionar CT-es');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao adicionar CT-es');
    }
  }, [modoApontamento, ctesSelecionados, carregarCarregamentos]);

  const toggleCte = useCallback((seqCte: number) => {
    setCtesSelecionados(prev => {
      const next = new Set(prev);
      if (next.has(seqCte)) next.delete(seqCte);
      else next.add(seqCte);
      return next;
    });
  }, []);

  useEffect(() => {
    if (isMTZ) {
      toast.error('Acesso não permitido para a unidade MTZ. Faça login em uma unidade específica.');
      return;
    }
    if (sigla) {
      carregar();
      carregarEntrega();
      carregarCarregamentos();
    }
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
        map[key] = { sigla: key, nome: cte.nomeDest, armazem: [], transito: [], coletas: [], totalCtes: 0, totalVol: 0, totalPeso: 0, totalCubagem: 0 };
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
    for (const coleta of dados.coletas.filter(c => !c.paraEntrega)) {
      const key = coleta.unidadeDest || 'SEM DESTINO';
      if (!map[key]) {
        map[key] = { sigla: key, nome: coleta.cidadeDest || key, armazem: [], transito: [], coletas: [], totalCtes: 0, totalVol: 0, totalPeso: 0, totalCubagem: 0 };
      }
      map[key].coletas.push(coleta);
      const pesoColeta = parseFloat(coleta.peso.replace('.', '').replace(',', '.')) || 0;
      map[key].totalPeso    += pesoColeta;
      map[key].totalCubagem += pesoColeta * 0.0033333333333333;
    }
    const lista = Object.values(map);
    const mult = ordemDir === 'desc' ? -1 : 1;
    return lista.sort((a, b) => {
      switch (ordemCol as string) {
        case 'sigla':        return mult * a.sigla.localeCompare(b.sigla);
        case 'armazem':      return mult * (a.armazem.length - b.armazem.length);
        case 'transito':     return mult * (a.transito.length - b.transito.length);
        case 'coletas':      return mult * (a.coletas.length - b.coletas.length);
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

  const gruposSetor: GrupoSetor[] = React.useMemo(() => {
    if (!dadosEntrega) return [];
    const map: Record<string, GrupoSetor> = {};
    for (const cte of dadosEntrega.ctes) {
      const key = cte.setor || 'SEM SETOR';
      if (!map[key]) {
        map[key] = { setor: key, armazem: [], transito: [], totalCtes: 0, totalVol: 0, totalPeso: 0, totalCubagem: 0 };
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
    return Object.values(map).sort((a, b) => b.totalCtes - a.totalCtes);
  }, [dadosEntrega]);

  const totalEntregaArmazem  = dadosEntrega?.ctes.filter(c => !c.emTransito).length ?? 0;
  const totalEntregaTransito = dadosEntrega?.ctes.filter(c => c.emTransito).length ?? 0;
  const totalEntregaVol      = gruposSetor.reduce((s, g) => s + g.totalVol, 0);
  const totalEntregaPeso     = gruposSetor.reduce((s, g) => s + g.totalPeso, 0);
  const totalEntregaCubagem  = gruposSetor.reduce((s, g) => s + g.totalCubagem, 0);
  const entregaAtrasados     = dadosEntrega?.ctes.filter(c => c.diasAtraso > 0).length ?? 0;

  const totalGeralArmazem  = totalArmazem + totalEntregaArmazem;
  const totalGeralTransito = totalTransito + totalEntregaTransito;
  const totalGeralVol      = totalVol + totalEntregaVol;
  const totalGeralPeso     = totalPeso + totalEntregaPeso;
  const totalGeralCubagem  = totalCubagem + totalEntregaCubagem;

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
            const baseArmazem  = totalGeralArmazem;
            const baseTransito = totalGeralTransito;
            const totalBase    = baseArmazem + baseTransito + totalColetas;
            const pctArmazem   = totalBase > 0 ? Math.round((baseArmazem  / totalBase) * 100) : 0;
            const pctTransito  = totalBase > 0 ? Math.round((baseTransito / totalBase) * 100) : 0;
            const pctColetas   = totalBase > 0 ? Math.round((totalColetas  / totalBase) * 100) : 0;

            const subArmazem = (() => {
              const parts = [];
              if (totalArmazem > 0) parts.push(`${totalArmazem} transf.`);
              if (totalEntregaArmazem > 0) parts.push(`${totalEntregaArmazem} entrega`);
              return parts.length > 1 ? parts.join(' + ') : null;
            })();

            const subTransito = (() => {
              const parts = [];
              if (ctesTransitoAlerta > 0) parts.push(`${ctesTransitoAlerta} c/ atraso transf.`);
              if (entregaAtrasados > 0) parts.push(`${entregaAtrasados} c/ atraso entrega`);
              return parts.length > 0 ? parts.join(' · ') : null;
            })();

            const cardsDonut = [
              {
                bgColor: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800',
                textColor: 'text-indigo-700 dark:text-indigo-300',
                emptyColor: '#e0e7ff', emptyColorDark: '#1e1b4b',
                cor: '#6366f1',
                icon: Warehouse,
                valor: baseArmazem,
                pct: pctArmazem,
                label: 'No Armazém',
                unidade: 'CT-e',
                sub: subArmazem,
                loadingExtra: loadingEntrega,
              },
              {
                bgColor: (ctesTransitoAlerta > 0 || entregaAtrasados > 0)
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800'
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
                textColor: (ctesTransitoAlerta > 0 || entregaAtrasados > 0) ? 'text-orange-700 dark:text-orange-300' : 'text-blue-700 dark:text-blue-300',
                emptyColor: (ctesTransitoAlerta > 0 || entregaAtrasados > 0) ? '#ffedd5' : '#dbeafe',
                emptyColorDark: (ctesTransitoAlerta > 0 || entregaAtrasados > 0) ? '#431407' : '#1e3a8a',
                cor: (ctesTransitoAlerta > 0 || entregaAtrasados > 0) ? '#f97316' : '#3b82f6',
                icon: Truck,
                valor: baseTransito,
                pct: pctTransito,
                label: 'Em Trânsito',
                unidade: 'CT-e',
                sub: subTransito,
                loadingExtra: loadingEntrega,
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
                unidade: 'Coleta',
                sub: coletasAtrasadas > 0 ? `${coletasAtrasadas} atrasada${coletasAtrasadas > 1 ? 's' : ''}` : null,
                loadingExtra: false,
              },
            ];

            const cardsSimples = [
              { valor: totalGeralVol.toLocaleString('pt-BR'), label: 'Volumes',    icon: Package, corBg: 'bg-purple-100 dark:bg-purple-900/40', corTexto: 'text-purple-600 dark:text-purple-400' },
              { valor: `${(totalGeralPeso / 1000).toFixed(1)}t`,  label: 'Peso Total', icon: Weight,  corBg: 'bg-amber-100 dark:bg-amber-900/40',  corTexto: 'text-amber-600 dark:text-amber-400' },
              { valor: `${totalGeralCubagem.toFixed(1)} m³`,       label: 'Cubagem',    icon: Box,     corBg: 'bg-teal-100 dark:bg-teal-900/40',   corTexto: 'text-teal-600 dark:text-teal-400' },
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
                          <div className="flex-1 min-w-0">
                            <div className={`flex items-center gap-1.5 text-xs font-medium mb-2 ${c.textColor}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {c.label}
                              {c.loadingExtra && <Loader2 className="w-3 h-3 animate-spin opacity-60 ml-1" />}
                            </div>
                            <div className={`text-2xl font-bold tabular-nums ${c.textColor}`}>{c.pct}%</div>
                            <p className={`text-sm mt-0.5 ${c.textColor}`}>{c.valor} {c.unidade}{c.valor !== 1 ? 's' : ''}</p>
                            {c.sub && <p className={`text-xs mt-0.5 font-semibold ${c.textColor} opacity-80`}>{c.sub}</p>}
                          </div>
                          <div style={{ width: 80, height: 80 }}>
                            <PieChart width={80} height={80}>
                              <Pie data={donutData} cx={40} cy={40} innerRadius={20} outerRadius={35} startAngle={90} endAngle={-270} dataKey="value" stroke="none" animationBegin={0} animationDuration={800}>
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

          <CarregamentoArea
            sigla={sigla}
            carregamentos={carregamentos}
            loadingCarregamentos={loadingCarregamentos}
            modoApontamento={modoApontamento}
            onIniciarApontamento={placa => { setModoApontamento(placa); setCtesSelecionados(new Set()); }}
            onCancelarApontamento={() => { setModoApontamento(null); setCtesSelecionados(new Set()); }}
            onCriarCarregamento={handleCriarCarregamento}
            onExcluirCarregamento={handleExcluirCarregamento}
            onRemoverCte={handleRemoverCte}
            ctesEntrega={dadosEntrega?.ctes ?? []}
          />

          {modoApontamento && ctesSelecionados.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-sm text-amber-800 dark:text-amber-300 flex-1">
                <strong>{ctesSelecionados.size}</strong> CT-e{ctesSelecionados.size !== 1 ? 's' : ''} selecionado{ctesSelecionados.size !== 1 ? 's' : ''} para <strong>{modoApontamento}</strong>
              </span>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8" onClick={handleConfirmarApontamento}>
                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />Confirmar
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-8 border-amber-300 text-amber-700 dark:text-amber-400" onClick={() => { setModoApontamento(null); setCtesSelecionados(new Set()); }}>
                Cancelar
              </Button>
            </div>
          )}

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
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${abaAtiva === 'entrega' ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Home className="w-4 h-4" />
              Disponíveis para Entrega
              {loadingEntrega
                ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Carregando...</Badge>
                : dadosEntrega
                  ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">{totalEntregaArmazem + totalEntregaTransito}</Badge>
                  : <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs">-</Badge>
              }
            </button>
            <button
              onClick={() => setAbaAtiva('todos')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${abaAtiva === 'todos' ? 'border-violet-500 text-violet-600 dark:text-violet-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <ListFilter className="w-4 h-4" />
              Todos os Disponíveis
              {loadingEntrega
                ? <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Carregando...</Badge>
                : <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200 text-xs">{totalGeralArmazem + totalGeralTransito}</Badge>
              }
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
                      const ThBtn = ({ col, children, center }: { col: string; children: React.ReactNode; center?: boolean }) => (
                        <button
                          onClick={() => toggleOrdem(col)}
                          className={`flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${center ? 'justify-center w-full' : ''}`}
                        >
                          {children}
                          {ordemCol === col
                            ? (ordemDir === 'desc' ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0 rotate-180" />)
                            : <span className="w-3 h-3 shrink-0 flex items-center justify-center opacity-40 text-[10px] leading-none">↕</span>}
                        </button>
                      );
                      return (
                        <>
                          <div className="grid bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2"
                            style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px minmax(80px,1fr) minmax(80px,1fr)' }}>
                            <span />
                            <ThBtn col="sigla">Destino</ThBtn>
                            <span />
                            <ThBtn col="piorSaida" center>Perf. saída</ThBtn>
                            <ThBtn col="armazem" center>Piso</ThBtn>
                            <ThBtn col="transito" center>Trans.</ThBtn>
                            <ThBtn col="coletas" center>Coletas</ThBtn>
                            <ThBtn col="totalVol" center>Volumes</ThBtn>
                            <ThBtn col="totalPeso" center>Peso</ThBtn>
                            <ThBtn col="totalCubagem" center>Cubagem</ThBtn>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {(() => {
                                const maxPeso     = Math.max(...grupos.map(g => g.totalPeso), 1);
                                const maxCubagem  = Math.max(...grupos.map(g => g.totalCubagem), 1);
                                const ctesNoCarregamentoAtual = modoApontamento
                                  ? new Set(carregamentos.find(c => c.placa_provisoria === modoApontamento)?.ctes.map(c => c.seq_cte) ?? [])
                                  : undefined;
                                return grupos.map((g, i) => (
                                  <GrupoDestinoCard key={i} grupo={g} maxPeso={maxPeso} maxCubagem={maxCubagem} modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamentoAtual} onToggleCte={toggleCte} />
                                ));
                              })()}
                            </div>
                        </>
                      );
                    })()}
                  </div>
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
            <div className="space-y-4">
              {loadingEntrega && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Gerando relatório no SSW...</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">O relatório está sendo processado. Isso pode levar até 1 minuto.</p>
                    </div>
                  </div>
                  <div className="w-full bg-amber-200 dark:bg-amber-900 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-500 ease-out"
                      style={{ width: `${progressoEntrega}%` }}
                    />
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 text-right">{progressoEntrega}%</p>
                </div>
              )}

              {erroEntrega && !loadingEntrega && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-5 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Erro ao carregar disponíveis para entrega</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroEntrega}</p>
                    <Button variant="outline" size="sm" className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400" onClick={() => carregarEntrega()}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Tentar novamente
                    </Button>
                  </div>
                </div>
              )}

              {dadosEntrega && !loadingEntrega && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">CT-es por Setor</h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">({gruposSetor.length} setores)</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />clique em um setor para expandir
                    </span>
                    <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => carregarEntrega()}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Atualizar
                    </Button>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-3 ml-1">
                      <span className="font-medium text-slate-600 dark:text-slate-300">Atraso:</span>
                      {(['verde','amarelo','laranja','vermelho'] as const).map(cor => (
                        <span key={cor} className="flex items-center gap-1">
                          <IndicadorDot cor={cor} />
                          <span className={TEXTO_INDICADOR[cor]}>
                            {cor === 'verde' ? 'No prazo' : cor === 'amarelo' ? '1-2 dias' : cor === 'laranja' ? '3-5 dias' : '6+ dias'}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="grid bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2"
                      style={{ gridTemplateColumns: '28px 60px minmax(0,1fr) 70px 70px 70px 70px minmax(80px,1fr) minmax(80px,1fr)' }}>
                      <span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Setor</span>
                      <span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Atraso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Piso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">A caminho</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Volumes</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Peso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Cubagem</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(() => {
                        const maxPeso    = Math.max(...gruposSetor.map(g => g.totalPeso), 1);
                        const maxCubagem = Math.max(...gruposSetor.map(g => g.totalCubagem), 1);
                        const ctesNoCarregamentoAtual = modoApontamento
                          ? new Set(carregamentos.find(c => c.placa_provisoria === modoApontamento)?.ctes.map(c => c.seq_cte) ?? [])
                          : undefined;
                        return gruposSetor.map((g, i) => (
                          <GrupoSetorCard
                            key={i}
                            grupo={g}
                            maxPeso={maxPeso}
                            maxCubagem={maxCubagem}
                            modoApontamento={modoApontamento}
                            ctesSelecionados={ctesSelecionados}
                            ctesNoCarregamento={ctesNoCarregamentoAtual}
                            onToggleCte={toggleCte}
                          />
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {!loadingEntrega && !dadosEntrega && !erroEntrega && (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500">
                  <Home className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-base font-medium">Nenhum dado disponível</p>
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'todos' && (
            <div className="space-y-6">
              {loadingEntrega && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Aguardando dados de entrega...</p>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Os dados de transferência já estão disponíveis. Os dados de entrega ainda estão sendo processados.</p>
                    </div>
                  </div>
                  <div className="w-full bg-amber-200 dark:bg-amber-900 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-500 ease-out" style={{ width: `${progressoEntrega}%` }} />
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 text-right">{progressoEntrega}%</p>
                </div>
              )}

              {grupos.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Disponíveis para Transferência</h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">({grupos.length} destinos · {totalArmazem + totalTransito} CT-es)</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="grid bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2"
                      style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px minmax(80px,1fr) minmax(80px,1fr)' }}>
                      <span /><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Destino</span><span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Perf. saída</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Piso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Trans.</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Coletas</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Volumes</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Peso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Cubagem</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(() => {
                        const maxPeso    = Math.max(...grupos.map(g => g.totalPeso), 1);
                        const maxCubagem = Math.max(...grupos.map(g => g.totalCubagem), 1);
                        const ctesNoCarregamentoAtual = modoApontamento
                          ? new Set(carregamentos.find(c => c.placa_provisoria === modoApontamento)?.ctes.map(c => c.seq_cte) ?? [])
                          : undefined;
                        return grupos.map((g, i) => (
                          <GrupoDestinoCard key={i} grupo={g} maxPeso={maxPeso} maxCubagem={maxCubagem} modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamentoAtual} onToggleCte={toggleCte} />
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {dadosEntrega && gruposSetor.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4 text-emerald-500" />
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Disponíveis para Entrega</h2>
                    <span className="text-sm text-slate-500 dark:text-slate-400">({gruposSetor.length} setores · {totalEntregaArmazem + totalEntregaTransito} CT-es)</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="grid bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2"
                      style={{ gridTemplateColumns: '28px 60px minmax(0,1fr) 70px 70px 70px 70px minmax(80px,1fr) minmax(80px,1fr)' }}>
                      <span /><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Setor</span><span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Atraso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Piso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">A caminho</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Volumes</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Peso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Cubagem</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(() => {
                        const maxPeso    = Math.max(...gruposSetor.map(g => g.totalPeso), 1);
                        const maxCubagem = Math.max(...gruposSetor.map(g => g.totalCubagem), 1);
                        const ctesNoCarregamentoAtual = modoApontamento
                          ? new Set(carregamentos.find(c => c.placa_provisoria === modoApontamento)?.ctes.map(c => c.seq_cte) ?? [])
                          : undefined;
                        return gruposSetor.map((g, i) => (
                          <GrupoSetorCard key={i} grupo={g} maxPeso={maxPeso} maxCubagem={maxCubagem} modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamentoAtual} onToggleCte={toggleCte} />
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {!loadingEntrega && !dadosEntrega && erroEntrega && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-5 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Dados de entrega indisponíveis</p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">{erroEntrega}</p>
                    <Button variant="outline" size="sm" className="mt-3 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400" onClick={() => carregarEntrega()}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />Tentar novamente
                    </Button>
                  </div>
                </div>
              )}
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
