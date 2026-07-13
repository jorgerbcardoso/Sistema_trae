import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { usePageTitle } from '../../hooks/usePageTitle';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

import { ENVIRONMENT } from '../../config/environment';
import { apiFetch, apiFetchWithProgress } from '../../utils/apiUtils';
import { toast } from 'sonner';
import { UnidadesMultiSelect } from '../admin/UnidadesMultiSelect';
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
  Filter,
  Plus,
  Trash2,
  CheckSquare,
  Square,
  Car,
  X,
  Share2,
  Download,
  AlertCircle,
  FileDown,
  ListTree,
  Gauge,
  Pencil,
  Search,
  DollarSign,
  Wallet,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const DESTINOS_IGNORADOS_RVE = new Set<string>(['SAL', 'DK4', 'TNE', 'DEV']);

interface Cte {
  ctrc: string;
  serCte: string;
  nroCte: number;
  seqCte?: number;
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
  unidadeCarregamento?: string;
  unidadeOrigem?: string;
}

interface Coleta {
  serColeta: string;
  nroColeta: string;
  remetente: string;
  cidadeRem: string;
  cidadeDest: string;
  ufDest?: string;
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
  totalFrete: number;
}

interface DadosHub {
  unidades: string[];
  dados: Record<string, { ctes: Cte[]; erro: string | null }>;
}

interface CteCarregamento {
  seq_cte: number;
  login_inclusao: string;
  data_inclusao: string;
  hora_inclusao: string;
  ctrc?: string;
  nroCte?: number;
  destino_cte?: string;
  destinatario?: string;
  remetente?: string;
  pagador?: string;
  cidade?: string;
  vlr_merc?: string;
  vlr_frete?: string;
  frete?: string;
  peso?: string;
  cubagem?: string;
  qtdeVol?: string;
}

interface Carregamento {
  placa_provisoria: string;
  origem_criacao?: 'MANUAL' | 'AUTO' | 'SSW' | null;
  total_ctes: number;
  data_criacao: string;
  hora_criacao: string;
  login_criacao: string;
  capacidade_ton: number | null;
  capacidade_m3: number | null;
  vlr_min_frete?: number | null;
  destino?: string | null;
  paradas?: string | null;
  ctes: CteCarregamento[];
}

type CarregamentoInexistente = {
  origem_ssw: string;
  placa_provisoria: string;
  total_ctes: number;
};

/** Retorna o ID canônico de um CT-e para uso em seleção/apontamento.
 *  Prefere seqCte (PK do banco) quando disponível, cai em nroCte como fallback. */
const cteId = (cte: Cte): number => (cte.seqCte && cte.seqCte > 0) ? cte.seqCte : cte.nroCte;

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

const formatBytes = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 100 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 100 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb < 100 ? 1 : 0)} GB`;
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
  ctesJaCarregados,
  onToggleCte,
  onToggleTodos,
}: {
  ctes: Cte[];
  tipo: 'armazem' | 'transito';
  modoApontamento?: string | null;
  ctesSelecionados?: Map<number, Cte>;
  ctesNoCarregamento?: Set<number>;
  ctesJaCarregados?: Map<number, string>;
  onToggleCte?: (cte: Cte) => void;
  onToggleTodos?: (ctes: Cte[], selecionar: boolean) => void;
}) {
  if (ctes.length === 0) return null;
  const emApontamento = !!modoApontamento;

  type SortCol =
    | 'ctrc'
    | 'nfiscal'
    | 'emissao'
    | 'prevEnt'
    | 'remetente'
    | 'destinatario'
    | 'cidadeUf'
    | 'vlrNf'
    | 'frete'
    | 'peso'
    | 'cubagem'
    | 'qtdeVol'
    | 'manifesto'
    | 'prevChegada'
    | 'indicadorSaida';

  const [sortCol, setSortCol] = useState<SortCol>('ctrc');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const toDateVal = (v: string): number => {
    const s = (v ?? '').trim();
    if (!s || s === '—') return 0;
    const m = s.match(/^(\d{2})\/(\d{2})(?:\/(\d{2}|\d{4}))?$/);
    if (!m) return 0;
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    const anoRaw = m[3];
    const ano = !anoRaw
      ? new Date().getFullYear()
      : (anoRaw.length === 2 ? 2000 + parseInt(anoRaw, 10) : parseInt(anoRaw, 10));
    const d = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    const t = d.getTime();
    return Number.isNaN(t) ? 0 : t;
  };

  const ORDEM_IND: Record<string, number> = { vermelho: 4, laranja: 3, amarelo: 2, verde: 1 };
  const stripDv = (v: string): string => {
    const s = String(v ?? '').trim();
    if (!s) return '';
    return s.replace(/-\d+$/, '');
  };

  const ctesOrdenados = React.useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const copy = [...ctes];
    const getStr = (v: any) => String(v ?? '').toUpperCase().trim();
    const getNum = (cte: Cte): number => {
      switch (sortCol) {
        case 'vlrNf': return parseMoeda(cte.vlrNf);
        case 'frete': return parseMoeda(cte.frete);
        case 'peso': return parsePeso(cte.peso);
        case 'cubagem': return parseCubagem(cte.cubagem);
        case 'qtdeVol': return parseInt(String(cte.qtdeVol ?? '').replace(/\D/g, ''), 10) || 0;
        case 'emissao': return toDateVal(cte.emissao);
        case 'prevEnt': return toDateVal(cte.prevEnt);
        case 'prevChegada': return toDateVal(cte.prevChegada);
        case 'indicadorSaida': return ORDEM_IND[cte.indicadorSaida ?? ''] ?? 0;
        default: return 0;
      }
    };
    const getCmp = (a: Cte, b: Cte): number => {
      switch (sortCol) {
        case 'ctrc': return getStr(a.ctrc).localeCompare(getStr(b.ctrc));
        case 'nfiscal': return getStr(a.nfiscal).localeCompare(getStr(b.nfiscal));
        case 'remetente': return getStr(a.remetente).localeCompare(getStr(b.remetente));
        case 'destinatario': return getStr(a.destinatario).localeCompare(getStr(b.destinatario));
        case 'cidadeUf': return `${getStr(a.cidade)}/${getStr(a.uf)}`.localeCompare(`${getStr(b.cidade)}/${getStr(b.uf)}`);
        case 'manifesto': return getStr(a.manifesto).localeCompare(getStr(b.manifesto));
        case 'emissao':
        case 'prevEnt':
        case 'prevChegada':
        case 'vlrNf':
        case 'frete':
        case 'peso':
        case 'cubagem':
        case 'qtdeVol':
        case 'indicadorSaida':
          return getNum(a) - getNum(b);
        default:
          return 0;
      }
    };
    copy.sort((a, b) => dir * getCmp(a, b));
    return copy;
  }, [ctes, sortCol, sortDir]);

  const ThBtn = ({ col, children, align }: { col: SortCol; children: React.ReactNode; align?: 'left' | 'right' | 'center' }) => {
    const base =
      align === 'right' ? 'justify-end text-right' :
      align === 'center' ? 'justify-center text-center' :
      'justify-start text-left';
    return (
      <button
        onClick={() => toggleSort(col)}
        className={`w-full flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors ${base}`}
      >
        {children}
        {sortCol === col
          ? (sortDir === 'asc' ? <ChevronDown className="w-3 h-3 shrink-0 rotate-180" /> : <ChevronDown className="w-3 h-3 shrink-0" />)
          : <span className="w-3 h-3 shrink-0 flex items-center justify-center opacity-40 text-[10px] leading-none">↕</span>}
      </button>
    );
  };

  const selecionaveis = ctes.filter(c => {
    if (ctesNoCarregamento?.has(cteId(c))) return false;
    if (ctesJaCarregados?.has(cteId(c))) return false;
    return true;
  });
  const todosSelecionados = selecionaveis.length > 0 && selecionaveis.every(c => ctesSelecionados?.has(cteId(c)));
  const algunsSelecionados = !todosSelecionados && selecionaveis.some(c => ctesSelecionados?.has(cteId(c)));

  const handleToggleTodos = () => {
    if (!onToggleTodos) return;
    onToggleTodos(selecionaveis, !todosSelecionados);
  };

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
            {emApontamento && (
              <th className="px-3 py-2 w-8">
                <button onClick={handleToggleTodos} className="flex items-center justify-center w-full" title={todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}>
                  {todosSelecionados ? (
                    <CheckSquare className="w-4 h-4 text-amber-500" />
                  ) : algunsSelecionados ? (
                    <div className="w-4 h-4 border-2 border-amber-400 rounded-sm bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <div className="w-2 h-0.5 bg-amber-500 rounded" />
                    </div>
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </th>
            )}
            <th className="px-3 py-2 text-left"><ThBtn col="ctrc">CTRC</ThBtn></th>
            <th className="px-3 py-2 text-right w-[86px]"><ThBtn col="nfiscal" align="right">NF</ThBtn></th>
            <th className="px-3 py-2 text-left"><ThBtn col="emissao">Emissão</ThBtn></th>
            <th className="px-3 py-2 text-left"><ThBtn col="prevEnt">Prev. Ent.</ThBtn></th>
            <th className="px-3 py-2 text-left"><ThBtn col="remetente">Remetente</ThBtn></th>
            <th className="px-3 py-2 text-left"><ThBtn col="destinatario">Destinatário</ThBtn></th>
            <th className="px-3 py-2 text-left"><ThBtn col="cidadeUf">Cidade/UF</ThBtn></th>
            <th className="px-3 py-2 text-right"><ThBtn col="vlrNf" align="right">Vlr. NF</ThBtn></th>
            <th className="px-3 py-2 text-right"><ThBtn col="frete" align="right">Frete</ThBtn></th>
            <th className="px-3 py-2 text-right"><ThBtn col="peso" align="right">Peso</ThBtn></th>
            <th className="px-3 py-2 text-right"><ThBtn col="cubagem" align="right">M³</ThBtn></th>
            <th className="px-3 py-2 text-right"><ThBtn col="qtdeVol" align="right">Vol.</ThBtn></th>
            <th className="px-3 py-2 text-left"><ThBtn col="manifesto">Manifesto</ThBtn></th>
            {tipo === 'transito' && <th className="px-3 py-2 text-left"><ThBtn col="prevChegada">Prev. Chegada</ThBtn></th>}
            <th className="px-3 py-2 text-center"><ThBtn col="indicadorSaida" align="center">Saída</ThBtn></th>
          </tr>
        </thead>
        <tbody>
          {ctesOrdenados.map((cte, i) => {
            const jaNoCarregamento = ctesNoCarregamento?.has(cteId(cte)) ?? false;
            const placaOutro = ctesJaCarregados?.get(cteId(cte));
            const jaEmOutro = !!placaOutro && !jaNoCarregamento;
            const selecionado = ctesSelecionados?.has(cteId(cte)) ?? false;
            const bloqueado = jaNoCarregamento || jaEmOutro;
            const rowBg = jaNoCarregamento
              ? 'bg-emerald-50 dark:bg-emerald-950/20'
              : jaEmOutro
              ? 'bg-slate-100 dark:bg-slate-800/60 opacity-60'
              : selecionado
              ? 'bg-amber-50 dark:bg-amber-950/20'
              : 'hover:bg-slate-50 dark:hover:bg-slate-900/50';
            return (
              <tr
                key={i}
                className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${rowBg} ${emApontamento && !bloqueado ? 'cursor-pointer' : jaEmOutro ? 'cursor-not-allowed' : ''}`}
                onClick={emApontamento && !bloqueado && onToggleCte ? () => onToggleCte(cte) : undefined}
              >
                {emApontamento && (
                  <td className="px-3 py-2 text-center">
                    {jaNoCarregamento ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : jaEmOutro ? (
                      <Truck className="w-4 h-4 text-slate-400 mx-auto" />
                    ) : selecionado ? (
                      <CheckSquare className="w-4 h-4 text-amber-500 mx-auto" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 mx-auto" />
                    )}
                  </td>
                )}
                <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                  <div className="flex items-center gap-1.5 flex-nowrap">
                    {stripDv(cte.ctrc)}
                    {jaNoCarregamento && <span className="text-emerald-500 font-bold" title="Já neste carregamento">✓</span>}
                    {jaEmOutro && <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded font-mono" title={`Carregado em ${placaOutro}`}>{placaOutro}</span>}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap" title={cte.nfiscal || ''}>
                  {cte.nfiscal || '-'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.emissao}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.prevEnt}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[90px] truncate">{cte.remetente}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[90px] truncate">{cte.destinatario}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.cidade}/{cte.uf}</td>
                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.vlrNf}</td>
                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.frete}</td>
                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.peso}</td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{cte.cubagem || '-'}</td>
                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.qtdeVol}</td>
                <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{stripDv(cte.manifesto || '-') || '-'}</td>
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
  ctesJaCarregados,
  onToggleCte,
  onToggleTodos,
}: {
  grupo: GrupoDestino;
  maxPeso: number;
  maxCubagem: number;
  modoApontamento?: string | null;
  ctesSelecionados?: Map<number, Cte>;
  ctesNoCarregamento?: Set<number>;
  ctesJaCarregados?: Map<number, string>;
  onToggleCte?: (cte: Cte) => void;
  onToggleTodos?: (ctes: Cte[], selecionar: boolean) => void;
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

  const exportarDestinoCSV = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    const lista = [...grupo.armazem, ...grupo.transito];
    if (!lista.length) return;

    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmtMoeda = (n: number) => n.toFixed(2).replace('.', ',');
    const fmtNum = (n: number, dec: number) => n.toFixed(dec).replace('.', ',');

    const header = [
      'Destino',
      'CTRC',
      'NF',
      'Situação',
      'Emissão',
      'Prev. Ent.',
      'Pagador',
      'Destinatário',
      'Cidade/UF',
      'Vlr. NF',
      'Frete (R$)',
      'Peso (kg)',
      'Cubagem (m³)',
      'Volumes',
      'Manifesto',
      'Prev. Chegada',
    ];

    const rows = lista.map((c) => {
      const situacao = c.emTransito ? 'EM TRÂNSITO' : 'NO ARMAZÉM';
      return [
        esc(grupo.sigla),
        esc(c.ctrc),
        esc(c.nfiscal || ''),
        esc(situacao),
        esc(c.emissao),
        esc(c.prevEnt),
        esc(c.pagador),
        esc(c.destinatario),
        esc(`${c.cidade}/${c.uf}`),
        fmtMoeda(parseMoeda(c.vlrNf)),
        fmtMoeda(parseMoeda(c.frete)),
        fmtNum(parsePeso(c.peso), 2),
        fmtNum(parseCubagem(c.cubagem), 3),
        esc(c.qtdeVol),
        esc(c.manifesto || ''),
        esc(c.prevChegada || ''),
      ];
    });

    const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctes_${String(grupo.sigla || 'destino').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px 78px 78px 120px 60px' }}
        onClick={() => setAberto(!aberto)}
      >
        <span className="flex items-center">
          {aberto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
        </span>
        <span className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
          <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          {grupo.sigla === 'SEM DESTINO' ? '-' : grupo.sigla}
        </span>
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs truncate pr-2">
          {grupo.nome}
        </span>
        <span className="flex items-center justify-center">
          {pctEntregueNoPrazo !== null
            ? <span className={`text-xs font-bold ${pctEntregueNoPrazo >= 80 ? 'text-green-600 dark:text-green-400' : pctEntregueNoPrazo >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>{pctEntregueNoPrazo}%</span>
            : <span className="text-xs text-slate-400">-</span>}
        </span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.armazem.length}</span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.transito.length}</span>
        <span className="flex items-center justify-center font-semibold text-slate-800 dark:text-slate-200">{grupo.coletas.length > 0 ? grupo.coletas.length : '-'}</span>
        <span className="flex items-center justify-center text-slate-600 dark:text-slate-400 font-medium">{grupo.totalVol.toLocaleString('pt-BR')}</span>
        <span className="flex items-center justify-center px-1">
          {(() => {
            const label = grupo.totalPeso >= 1000
              ? `${(grupo.totalPeso / 1000).toFixed(1)}t`
              : `${grupo.totalPeso.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}kg`;
            return (
              <div className="relative w-full h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pctPeso}%`, background: 'linear-gradient(90deg, #4c1d95, #6d28d9, #8b5cf6)' }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow z-10">{label}</span>
              </div>
            );
          })()}
        </span>
        <span className="flex items-center justify-center px-1">
          {(() => {
            return (
              <div className="relative w-full h-3.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pctCubagem}%`, background: 'linear-gradient(90deg, #312e81, #4338ca, #6366f1)' }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow z-10">{grupo.totalCubagem.toFixed(2)}m³</span>
              </div>
            );
          })()}
        </span>
        <span className="flex items-center justify-end text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 pr-3">
          {grupo.totalFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="flex items-center justify-center pl-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={exportarDestinoCSV}>
            <FileDown className="w-3.5 h-3.5 mr-1" />CSV
          </Button>
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
                ? <TabelaCtes ctes={grupo.armazem} tipo="armazem" modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamento} ctesJaCarregados={ctesJaCarregados} onToggleCte={onToggleCte} onToggleTodos={onToggleTodos} />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e no armazém para este destino.</p>
            )}
            {abaAtiva === 'transito' && (
              grupo.transito.length > 0
                ? <TabelaCtes ctes={grupo.transito} tipo="transito" modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamento} ctesJaCarregados={ctesJaCarregados} onToggleCte={onToggleCte} onToggleTodos={onToggleTodos} />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e em trânsito para este destino.</p>
            )}
            {abaAtiva === 'coletas' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <th className="px-3 py-2 text-left font-semibold">Coleta</th>
                      <th className="px-3 py-2 text-left font-semibold">Remetente</th>
                      <th className="px-3 py-2 text-left font-semibold">Cidade/UF Dest.</th>
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
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-normal">
                          {(c.cidadeDest || '-')}{c.ufDest ? `/${c.ufDest}` : ''}
                        </td>
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
  ctesJaCarregados,
  onToggleCte,
  onToggleTodos,
}: {
  ctes: CteEntrega[];
  tipo: 'armazem' | 'transito';
  modoApontamento?: string | null;
  ctesSelecionados?: Map<number, Cte>;
  ctesNoCarregamento?: Set<number>;
  ctesJaCarregados?: Map<number, string>;
  onToggleCte?: (cte: Cte) => void;
  onToggleTodos?: (ctes: Cte[], selecionar: boolean) => void;
}) {
  if (ctes.length === 0) return null;
  const emApontamento = !!modoApontamento;

  // Converte CteEntrega para Cte (campos disponíveis) para envio ao backend
  const toCteFull = (c: CteEntrega): Cte => ({
    ctrc: c.ctrc,
    serCte: c.serCte,
    nroCte: c.nroCte,
    seqCte: undefined,
    tipo: '',
    emissao: '',
    prevEnt: c.prevEnt,
    nfiscal: c.nfiscal,
    pedido: '',
    remetente: '',
    pagador: c.pagador,
    destinatario: c.destinatario,
    cidade: c.cidade,
    uf: '',
    vlrNf: c.vlrMerc,
    frete: c.frete,
    peso: c.peso,
    cubagem: c.cubagem,
    qtdeVol: c.qtdeVol,
    manifesto: c.manifesto,
    prevChegada: c.prevChegada,
    emTransito: c.emTransito,
    unidadeDest: '',
    nomeDest: '',
    indicadorSaida: null,
    atrasoTransf: null,
  });

  const selecionaveis = ctes.filter(c => {
    if (ctesNoCarregamento?.has(cteId(c))) return false;
    if (ctesJaCarregados?.has(cteId(c))) return false;
    return true;
  });
  const todosSelecionados = selecionaveis.length > 0 && selecionaveis.every(c => ctesSelecionados?.has(cteId(c)));
  const algunsSelecionados = !todosSelecionados && selecionaveis.some(c => ctesSelecionados?.has(cteId(c)));

  const handleToggleTodos = () => {
    if (!onToggleTodos) return;
    onToggleTodos(selecionaveis.map(toCteFull), !todosSelecionados);
  };

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
            {emApontamento && (
              <th className="px-3 py-2 w-8">
                <button onClick={handleToggleTodos} className="flex items-center justify-center w-full" title={todosSelecionados ? 'Desmarcar todos' : 'Selecionar todos'}>
                  {todosSelecionados ? (
                    <CheckSquare className="w-4 h-4 text-amber-500" />
                  ) : algunsSelecionados ? (
                    <div className="w-4 h-4 border-2 border-amber-400 rounded-sm bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                      <div className="w-2 h-0.5 bg-amber-500 rounded" />
                    </div>
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </th>
            )}
            <th className="px-3 py-2 text-left font-semibold">CTRC</th>
            <th className="px-3 py-2 text-left font-semibold">NF</th>
            <th className="px-3 py-2 text-left font-semibold">Pagador</th>
            <th className="px-3 py-2 text-left font-semibold">Destinatário</th>
            <th className="px-3 py-2 text-left font-semibold">Cidade</th>
            <th className="px-3 py-2 text-left font-semibold">Prev. Ent.</th>
            <th className="px-3 py-2 text-left font-semibold">Agendamento</th>
            <th className="px-3 py-2 text-right font-semibold">Peso</th>
            <th className="px-3 py-2 text-right font-semibold">M³</th>
            <th className="px-3 py-2 text-right font-semibold">Frete</th>
            <th className="px-3 py-2 text-left font-semibold">Últ. Ocorrência</th>
            {tipo === 'transito' && <th className="px-3 py-2 text-left font-semibold">Prev. Chegada</th>}
            <th className="px-3 py-2 text-center font-semibold">Atraso</th>
          </tr>
        </thead>
        <tbody>
          {ctes.map((cte, i) => {
            const jaNoCarregamento = ctesNoCarregamento?.has(cteId(cte)) ?? false;
            const placaOutro = ctesJaCarregados?.get(cteId(cte));
            const jaEmOutro = !!placaOutro && !jaNoCarregamento;
            const selecionado = ctesSelecionados?.has(cteId(cte)) ?? false;
            const bloqueado = jaNoCarregamento || jaEmOutro;
            const rowBg = jaNoCarregamento
              ? 'bg-emerald-50 dark:bg-emerald-950/20'
              : jaEmOutro
              ? 'bg-slate-100 dark:bg-slate-800/60 opacity-60'
              : selecionado
              ? 'bg-amber-50 dark:bg-amber-950/20'
              : 'hover:bg-slate-50 dark:hover:bg-slate-900/50';
            return (
              <tr
                key={i}
                className={`border-b border-slate-100 dark:border-slate-800 transition-colors ${rowBg} ${emApontamento && !bloqueado ? 'cursor-pointer' : jaEmOutro ? 'cursor-not-allowed' : ''}`}
                onClick={emApontamento && !bloqueado && onToggleCte ? () => onToggleCte(toCteFull(cte)) : undefined}
              >
                {emApontamento && (
                  <td className="px-3 py-2 text-center">
                    {jaNoCarregamento ? (
                      <CheckSquare className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : jaEmOutro ? (
                      <Truck className="w-4 h-4 text-slate-400 mx-auto" />
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
                  {jaEmOutro && <span className="ml-1.5 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-1 py-0.5 rounded font-mono" title={`Carregado em ${placaOutro}`}>{placaOutro}</span>}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.nfiscal}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[80px] truncate">{cte.pagador}</td>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-300 max-w-[80px] truncate">{cte.destinatario}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.cidade}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.prevEnt}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.agendamento || '-'}</td>
                <td className="px-3 py-2 text-right text-slate-700 dark:text-slate-300">{cte.peso ? Math.round(parseFloat(cte.peso.replace('.', '').replace(',', '.'))) + ' kg' : '-'}</td>
                <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-400">{cte.cubagem || '-'}</td>
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
  ctesJaCarregados,
  onToggleCte,
  onToggleTodos,
}: {
  grupo: GrupoSetor;
  maxPeso: number;
  maxCubagem: number;
  modoApontamento?: string | null;
  ctesSelecionados?: Map<number, Cte>;
  ctesNoCarregamento?: Set<number>;
  ctesJaCarregados?: Map<number, string>;
  onToggleCte?: (cte: Cte) => void;
  onToggleTodos?: (ctes: Cte[], selecionar: boolean) => void;
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
                ? <TabelaEntrega ctes={grupo.armazem} tipo="armazem" modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamento} ctesJaCarregados={ctesJaCarregados} onToggleCte={onToggleCte} onToggleTodos={onToggleTodos} />
                : <p className="text-center text-slate-400 py-6 text-sm">Nenhum CT-e no armazém para este setor.</p>
            )}
            {abaAtiva === 'transito' && (
              grupo.transito.length > 0
                ? <TabelaEntrega ctes={grupo.transito} tipo="transito" modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamento} ctesJaCarregados={ctesJaCarregados} onToggleCte={onToggleCte} onToggleTodos={onToggleTodos} />
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
  onCriarCarregamento: (placa: string, destino: string, paradas: string) => void;
  onExcluirCarregamento: (placa: string) => void;
  onRemoverCte: (placa: string, seqCte: number) => void;
  onCarregarSSW: (placa: string) => void;
  onCarregarHub: (carregamento: Carregamento) => void;
  loadingHub: boolean;
  hubCarregamentoPlaca: string | null;
  onRecarregarCarregamentos: () => Promise<void>;
  onImportarCarregamentos: () => Promise<any>;
  importandoCarregamentos: boolean;
  importacaoAutomatica: boolean;
  onToggleImportacaoAutomatica: (ativo: boolean) => void;
  onCarregamentoAutomatico: (placa: string, unidadeDestino: string, paradas: string[], nroLinha?: number) => Promise<{
    ok: boolean;
    placa?: string;
    resumo?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
    resumoDestinos?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
  }>;
  todosCtes: { nroCte: number; seqCte?: number; ctrc: string; destinatario: string; cidade: string; peso: string; cubagem: string }[];
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

function BarraFreteSegmentada({ cif, fob, minimo }: { cif: number; fob: number; minimo?: number | null }) {
  const total = (Number.isFinite(cif) ? cif : 0) + (Number.isFinite(fob) ? fob : 0);
  const pctCif = total > 0 ? Math.max(0, Math.min((cif / total) * 100, 100)) : 0;
  const pctFob = total > 0 ? Math.max(0, Math.min((fob / total) * 100, 100)) : 0;
  const minVal = minimo && Number.isFinite(minimo) && minimo > 0 ? minimo : null;
  const abaixoMin = minVal !== null && total > 0 && total < minVal;
  const fmt = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1 gap-2">
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Frete (R$)</span>
        <span className={`text-[10px] font-bold whitespace-nowrap ${abaixoMin ? 'text-red-700 dark:text-red-300' : 'text-slate-700 dark:text-slate-300'}`}>
          {fmt(total)}{minVal !== null ? ` / mín. ${fmt(minVal)}` : ''}
        </span>
      </div>
      <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden flex">
        <div
          className="h-3"
          style={{ width: `${pctCif}%`, backgroundImage: 'linear-gradient(90deg, #059669, #10b981)' }}
          title={`CIF: ${fmt(cif)}`}
        />
        <div
          className="h-3"
          style={{ width: `${pctFob}%`, backgroundImage: 'linear-gradient(90deg, #b45309, #f59e0b)' }}
          title={`FOB: ${fmt(fob)}`}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
        <span className="whitespace-nowrap">CIF: <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{fmt(cif)}</span></span>
        <span className="whitespace-nowrap">FOB: <span className="font-mono font-semibold text-slate-600 dark:text-slate-300">{fmt(fob)}</span></span>
      </div>
    </div>
  );
}

function ModalCriarCarregamento({ onConfirmar, onFechar }: { onConfirmar: (placa: string, destino: string, paradas: string) => void; onFechar: () => void }) {
  const [placa, setPlaca] = useState('');
  const [destino, setDestino] = useState('');
  const [paradas, setParadas] = useState('');
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
        <div className="px-6 py-5 space-y-3">
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
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Unid. destino <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={destino}
              onChange={e => setDestino(e.target.value.toUpperCase())}
              placeholder="Ex: SPO"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Paradas intermediárias <span className="font-normal text-slate-400">(opcional)</span></label>
            <input
              type="text"
              value={paradas}
              onChange={e => setParadas(e.target.value.toUpperCase())}
              placeholder="Ex: CWB, LDA"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <Button variant="outline" className="flex-1" onClick={onFechar}>Cancelar</Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            disabled={!placaFinal.trim() || !destino.trim()}
            onClick={() => { if (placaFinal.trim()) onConfirmar(placaFinal.trim(), destino.trim(), paradas.trim()); }}
          >
            <Plus className="w-4 h-4 mr-1.5" />Carregamento Manual
          </Button>
        </div>
      </div>
    </div>
  );
}

function parsePeso(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}
function parseCubagem(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(',', '.')) || 0;
}
function parseMoeda(s: string): number {
  if (!s) return 0;
  const raw = String(s).trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.\-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  const normalized = hasComma && hasDot
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : hasComma
      ? cleaned.replace(',', '.')
      : cleaned;
  return parseFloat(normalized) || 0;
}
function formatData(d: string): string {
  if (!d) return '';
  const p = d.split('-');
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
  return d;
}

function CardCarregamento({
  carregamento,
  todosCtes,
  modoApontamento,
  onIniciarApontamento,
  onCancelarApontamento,
  onExcluirCarregamento,
  onRemoverCte,
  onCarregarSSW,
  onCarregarHub,
  loadingHub,
  hubCarregamentoPlaca,
  onRecarregarCarregamentos,
  importandoCarregamentos,
}: {
  carregamento: Carregamento;
  todosCtes: { nroCte: number; seqCte?: number; ctrc: string; destinatario: string; cidade: string; peso: string; cubagem: string }[];
  modoApontamento: string | null;
  onIniciarApontamento: (placa: string) => void;
  onCancelarApontamento: () => void;
  onExcluirCarregamento: (placa: string) => void;
  onRemoverCte: (placa: string, seqCte: number) => void;
  onCarregarSSW: (placa: string) => void;
  onCarregarHub: (carregamento: Carregamento) => void;
  loadingHub: boolean;
  hubCarregamentoPlaca: string | null;
  onRecarregarCarregamentos: () => Promise<void>;
  importandoCarregamentos: boolean;
}) {
  const [editandoPlaca, setEditandoPlaca] = useState(false);
  const [novaPlaca, setNovaPlaca] = useState('');
  const [editandoCapacidade, setEditandoCapacidade] = useState(false);
  const [novaCapTon, setNovaCapTon] = useState('');
  const [novaCapM3, setNovaCapM3] = useState('');
  const [novaVlrMinFrete, setNovaVlrMinFrete] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [cteDetalheDialogOpen, setCteDetalheDialogOpen] = useState(false);
  const [cteDetalheLista, setCteDetalheLista] = useState<any[]>([]);
  const [cteDetalheTotais, setCteDetalheTotais] = useState<any>(null);
  const [loadingCteDetalhe, setLoadingCteDetalhe] = useState(false);
  const [cteDetalheSelecionados, setCteDetalheSelecionados] = useState<Set<number>>(new Set());
  const cteDetalheListaRef = useRef<any[]>([]);
  const cteDetalheTituloRef = useRef<string>('');

  const abrirCteDetalhe = async () => {
    setCteDetalheDialogOpen(true);
    setCteDetalheLista([]);
    cteDetalheListaRef.current = [];
    setCteDetalheTotais(null);
    setLoadingCteDetalhe(true);
    setCteDetalheSelecionados(new Set());
    const titulo = `Carregamento ${carregamento.placa_provisoria}`;
    cteDetalheTituloRef.current = titulo;
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_ctes_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ placa: carregamento.placa_provisoria }) },
        true
      );
      if (res.success) {
        setCteDetalheLista(res.ctes ?? []);
        cteDetalheListaRef.current = res.ctes ?? [];
        setCteDetalheTotais(res.totais ?? null);
      } else {
        toast.error(res.message || 'Erro ao carregar CT-es');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar CT-es');
    } finally {
      setLoadingCteDetalhe(false);
    }
  };

  const removerCtesSelecionados = async () => {
    if (cteDetalheSelecionados.size === 0) return;
    const qtd = cteDetalheSelecionados.size;
    if (!confirm(`Excluir ${qtd} CT-e(s) selecionado(s) deste carregamento?`)) return;
    setLoadingCteDetalhe(true);
    try {
      const seq_ctes = Array.from(cteDetalheSelecionados.values()).filter(n => Number.isFinite(n) && n > 0);
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'remover_ctes', placa: carregamento.placa_provisoria, seq_ctes }) },
        true
      );
      if (!res?.success) {
        toast.error(res.message || 'Erro ao remover CT-es');
        return;
      }
      const resList = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_ctes_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ placa: carregamento.placa_provisoria }) },
        true
      );
      if (resList.success) {
        setCteDetalheLista(resList.ctes ?? []);
        cteDetalheListaRef.current = resList.ctes ?? [];
        setCteDetalheTotais(resList.totais ?? null);
        setCteDetalheSelecionados(new Set());
      }
      await onRecarregarCarregamentos();
      toast.success(`${res.removidos ?? qtd} CT-e(s) removido(s).`);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao remover CT-es');
    } finally {
      setLoadingCteDetalhe(false);
    }
  };

  const exportarCteDetalheCSV = () => {
    const lista = cteDetalheListaRef.current;
    const titulo = cteDetalheTituloRef.current;
    if (!lista.length) return;
    const header = ['CTRC', 'Carr.', 'Emissão', 'Prev. Entr..', 'Dest.', 'Pagador', 'Frete (R$)', 'Peso (Kg)', 'Cub. (m³)'];
    const rows = lista.map((c: any) => [
      c.ctrc,
      `"${c.unidade_carregamento || ''}"`,
      c.data_emissao,
      c.data_prev_ent,
      `"${c.sigla_dest || ''}"`,
      `"${(c.nome_pag || '').replace(/"/g, '""')}"`,
      c.vlr_frete.toFixed(2).replace('.', ','),
      c.peso.toFixed(2).replace('.', ','),
      c.cubagem.toFixed(3).replace('.', ','),
    ]);
    const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctes_${titulo.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ativo = modoApontamento === carregamento.placa_provisoria;

  const handleSalvarPlaca = async () => {
    if (!novaPlaca.trim()) return;
    setSalvandoEdicao(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'atualizar_placa', placa_antiga: carregamento.placa_provisoria, placa_nova: novaPlaca.trim().toUpperCase() }) },
        true
      );
      if (res.success) { toast.success('Placa atualizada.'); setEditandoPlaca(false); onRecarregarCarregamentos(); }
      else toast.error(res.message || 'Erro ao atualizar placa.');
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar placa.'); }
    finally { setSalvandoEdicao(false); }
  };

  const handleSalvarCapacidade = async () => {
    const capTonNum = novaCapTon !== '' ? parseFloat(novaCapTon) : null;
    const capM3Num = novaCapM3 !== '' ? parseFloat(novaCapM3) : null;
    const vlrMinNum = novaVlrMinFrete !== '' ? parseFloat(novaVlrMinFrete) : null;
    const mudouTon = capTonNum !== null && carregamento.capacidade_ton !== null
      ? Math.abs(capTonNum - carregamento.capacidade_ton) > 0.0001
      : capTonNum !== carregamento.capacidade_ton;
    const mudouM3 = capM3Num !== null && carregamento.capacidade_m3 !== null
      ? Math.abs(capM3Num - carregamento.capacidade_m3) > 0.0001
      : capM3Num !== carregamento.capacidade_m3;
    const mudouMinFrete = vlrMinNum !== null && carregamento.vlr_min_frete !== null && carregamento.vlr_min_frete !== undefined
      ? Math.abs(vlrMinNum - (carregamento.vlr_min_frete as number)) > 0.0001
      : vlrMinNum !== (carregamento.vlr_min_frete ?? null);

    if (mudouTon || mudouM3 || mudouMinFrete) {
      const linhas: string[] = [];
      linhas.push('Confirmar alteração dos parâmetros?');
      if (mudouMinFrete) linhas.push('- Min. Frete: será alterado também na linha (tabela [dominio]_linha).');
      if (mudouTon || mudouM3) linhas.push('- Capacidades: serão alteradas também no veículo (tabela [dominio]_veiculo).');
      const ok = confirm(linhas.join('\n'));
      if (!ok) return;
    }

    setSalvandoEdicao(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'atualizar_capacidade', placa: carregamento.placa_provisoria, cap_ton: capTonNum, cap_m3: capM3Num, vlr_min_frete: vlrMinNum, destino, paradas: (paradasArray || []).join(',') }) },
        true
      );
      if (res.success) {
        toast.success('Parâmetros atualizados.');
        if (mudouMinFrete && res.atualizou_linha === false) {
          toast.info('Min. Frete não foi aplicado em nenhuma linha (rota não encontrada).');
        }
        setEditandoCapacidade(false);
        onRecarregarCarregamentos();
      }
      else toast.error(res.message || 'Erro ao atualizar capacidade.');
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar capacidade.'); }
    finally { setSalvandoEdicao(false); }
  };

  const ctesDetalhados = carregamento.ctes.map(c => {
    const detSSW = todosCtes.find(e => e.nroCte === c.nroCte);
    const det = detSSW ?? {
      ctrc: c.ctrc || `#${c.seq_cte}`,
      nroCte: c.nroCte ?? 0,
      destinatario: c.destinatario || '',
      cidade: c.cidade || '',
      peso: c.peso || '',
      cubagem: c.cubagem || '',
    };
    return { ...c, det };
  });

  const totalPeso = ctesDetalhados.reduce((s, c) => s + parsePeso(c.det?.peso ?? ''), 0);
  const totalCubagem = ctesDetalhados.reduce((s, c) => s + parseCubagem(c.det?.cubagem ?? ''), 0);
  const normalizePessoa = (s: string) => s.trim().toUpperCase().replace(/\s+/g, ' ');
  const freteTotals = ctesDetalhados.reduce((acc: { cif: number; fob: number }, c) => {
    const v = parseMoeda(String(c.vlr_frete ?? c.frete ?? ''));
    const rem = normalizePessoa(String(c.remetente ?? ''));
    const pag = normalizePessoa(String(c.pagador ?? ''));
    if (rem !== '' && pag !== '' && rem === pag) acc.cif += v;
    else acc.fob += v;
    return acc;
  }, { cif: 0, fob: 0 });
  const freteCif = freteTotals.cif;
  const freteFob = freteTotals.fob;
  const temCapacidade = carregamento.capacidade_ton !== null && carregamento.capacidade_m3 !== null;

  const primeiroCte = carregamento.ctes.length > 0 ? carregamento.ctes[0] : null;
  const infoCriacao = primeiroCte
    ? `${formatData(primeiroCte.data_inclusao)} ${primeiroCte.hora_inclusao?.slice(0, 5)} · ${primeiroCte.login_inclusao}`
    : null;
  const destino = (() => {
    if (carregamento.destino) return carregamento.destino;
    const m = carregamento.placa_provisoria.match(/^[A-Z0-9]{2,5}-([A-Z0-9]{2,5})$/);
    if (m?.[1]) return m[1];
    const freq = new Map<string, number>();
    for (const c of carregamento.ctes) {
      const cidade = (c.cidade ?? '').trim().toUpperCase();
      if (!cidade || !/^[A-Z0-9]{2,5}$/.test(cidade)) continue;
      freq.set(cidade, (freq.get(cidade) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [k, n] of freq.entries()) {
      if (n > bestN) { best = k; bestN = n; }
    }
    return best;
  })();

  const paradasArray = (carregamento.paradas || '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
  const todasUnidades = [...paradasArray, destino].filter(Boolean) as string[];
  const unidadesDestinoTexto = todasUnidades.length > 0
    ? todasUnidades.map((u, i) => i === todasUnidades.length - 1 ? <span key={i} className="font-bold">{u}</span> : <span key={i}>{u}{i < todasUnidades.length - 1 ? ', ' : ''}</span>)
    : null;

  const origemTag = (() => {
    const o = (carregamento.origem_criacao ?? null);
    if (o === 'SSW') return { label: 'SSW', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200' };
    if (o === 'AUTO') return { label: 'Auto', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200' };
    if (o === 'MANUAL') return { label: 'Manual', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
    return null;
  })();

  return (
    <div className={`rounded-xl border-2 transition-all duration-200 ${ativo ? 'border-emerald-400 dark:border-emerald-500 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30' : 'border-slate-200 dark:border-slate-700'} bg-white dark:bg-slate-900 overflow-hidden`}>
      <div className="px-4 pt-4 pb-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${ativo ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800'}`}>
              <Truck className={`w-4 h-4 ${ativo ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`} />
            </div>
            <div className="min-w-0">
              {editandoPlaca ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    className="font-bold font-mono text-sm w-28 rounded border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                    value={novaPlaca}
                    onChange={e => setNovaPlaca(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === 'Enter') handleSalvarPlaca(); if (e.key === 'Escape') setEditandoPlaca(false); }}
                  />
                  <button onClick={handleSalvarPlaca} disabled={salvandoEdicao} className="text-emerald-500 hover:text-emerald-600 disabled:opacity-50"><CheckSquare className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setEditandoPlaca(false)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-1 group">
                  <p className="font-bold text-slate-900 dark:text-slate-100 font-mono text-sm truncate">{carregamento.placa_provisoria}</p>
                  {origemTag && (
                    <Badge className={`${origemTag.className} text-[10px] h-5 px-2`}>{origemTag.label}</Badge>
                  )}
                  <button onClick={() => { setNovaPlaca(carregamento.placa_provisoria); setEditandoPlaca(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-indigo-500" title="Editar placa">
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 justify-end">
            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">
              {carregamento.total_ctes} CT-e{carregamento.total_ctes !== 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="col-span-2 flex gap-2 min-w-0">
            <div className="w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              {infoCriacao ? (
                <p className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">{infoCriacao}</p>
              ) : (
                <p className="text-[10px] text-slate-300 dark:text-slate-600 italic">Sem CT-es</p>
              )}
              <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                <span className="font-semibold text-slate-600 dark:text-slate-300">Destino(s):</span>
                {unidadesDestinoTexto
                  ? <span className="font-mono text-slate-600 dark:text-slate-400">{unidadesDestinoTexto}</span>
                  : <span className="font-mono text-slate-400 dark:text-slate-500">-</span>
                }
              </div>
            </div>
          </div>
        </div>

        {editandoCapacidade && (
          <div className="mb-3 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 space-y-2">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Parâmetros do carregamento</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Ton</label>
                <input type="number" min="0" step="0.1" className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" value={novaCapTon} onChange={e => setNovaCapTon(e.target.value)} placeholder="Ex: 15" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">m³</label>
                <input type="number" min="0" step="0.1" className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" value={novaCapM3} onChange={e => setNovaCapM3(e.target.value)} placeholder="Ex: 40" />
              </div>
              <div className="flex-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Min. Frete (R$)</label>
                <input type="number" min="0" step="0.01" className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" value={novaVlrMinFrete} onChange={e => setNovaVlrMinFrete(e.target.value)} placeholder="Ex: 3500" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditandoCapacidade(false)}>Cancelar</Button>
              <Button size="sm" className="h-7 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={handleSalvarCapacidade} disabled={salvandoEdicao}>
                {salvandoEdicao ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}Salvar
              </Button>
            </div>
          </div>
        )}

        {temCapacidade ? (
          <div className="flex flex-col gap-2 mb-3">
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
            <BarraFreteSegmentada cif={freteCif} fob={freteFob} minimo={carregamento.vlr_min_frete ?? null} />
          </div>
        ) : (
          <div className="flex gap-4 mb-3 text-xs text-slate-500 dark:text-slate-400">
            <span><Weight className="w-3 h-3 inline mr-1" />{(totalPeso / 1000).toFixed(3)}t</span>
            <span><Box className="w-3 h-3 inline mr-1" />{totalCubagem.toFixed(3)}m³</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          {!ativo ? (
            <Button size="sm" className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs" onClick={() => onIniciarApontamento(carregamento.placa_provisoria)} title="Apontar CT-es neste carregamento">
              <CheckSquare className="w-3.5 h-3.5 mr-1" />Apont.
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-8 border-emerald-400 text-emerald-700 dark:text-emerald-400 text-xs" onClick={onCancelarApontamento} title="Cancelar apontamento">
              <X className="w-3.5 h-3.5 mr-1" />Canc.
            </Button>
          )}
          <Button size="sm" className="h-8 bg-sky-500 hover:bg-sky-600 text-white text-xs" onClick={() => onCarregarSSW(carregamento.placa_provisoria)} title="Carregar no SSW">
            <Truck className="w-3.5 h-3.5 mr-1" />SSW
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={`h-8 text-xs border-violet-300 dark:border-violet-700 ${loadingHub && hubCarregamentoPlaca === carregamento.placa_provisoria ? 'text-violet-400' : 'text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30'}`}
            onClick={() => onCarregarHub(carregamento)}
            disabled={loadingHub}
            title="Completar carregamento com CT-es via Hub"
          >
            {loadingHub && hubCarregamentoPlaca === carregamento.placa_provisoria
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              : <Share2 className="w-3.5 h-3.5 mr-1" />
            }
            Hub
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            onClick={() => { setNovaCapTon(carregamento.capacidade_ton?.toString() ?? ''); setNovaCapM3(carregamento.capacidade_m3?.toString() ?? ''); setNovaVlrMinFrete(carregamento.vlr_min_frete?.toString() ?? ''); setEditandoCapacidade(v => !v); }}
            title="Editar Parâmetros do Carregamento."
          >
            <Gauge className="w-3.5 h-3.5 mr-1" />Param.
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            onClick={abrirCteDetalhe}
            title="Lista de CT-es com exclusão"
          >
            <Search className="w-3.5 h-3.5 mr-1" />Lista
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-red-200 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => onExcluirCarregamento(carregamento.placa_provisoria)}
            title="Excluir carregamento"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />Excl.
          </Button>
        </div>
      </div>
      <Dialog open={cteDetalheDialogOpen} onOpenChange={setCteDetalheDialogOpen}>
        <DialogContent className="max-w-4xl h-[80vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <div className="shrink-0 pr-20 flex flex-col gap-1.5">
            <DialogHeader>
              <DialogTitle>CT-es · Carregamento {carregamento.placa_provisoria}</DialogTitle>
              <DialogDescription>Selecione os CT-es e clique em “Excluir selecionados” para remover do carregamento</DialogDescription>
            </DialogHeader>

            {/* Destinos do carregamento */}
            {(() => {
              const paradasArr = (carregamento.paradas || '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
              const destFinal = carregamento.destino?.toUpperCase() || null;
              const todas = [...paradasArr, destFinal].filter(Boolean) as string[];
              if (todas.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5">
                  {todas.map((u, i) => (
                    <span key={i} className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono ${i === todas.length - 1 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {u}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="absolute top-4 right-10 flex items-center gap-2 z-10">
            {cteDetalheLista.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={exportarCteDetalheCSV}
                className="gap-1.5"
                disabled={loadingCteDetalhe}
              >
                <FileDown className="w-4 h-4" />
                Exportar CSV
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={removerCtesSelecionados}
              className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/30"
              disabled={loadingCteDetalhe || cteDetalheSelecionados.size === 0}
            >
              <Trash2 className="w-4 h-4" />
              Excluir selecionados
            </Button>
          </div>

          <div className="grid grid-rows-[minmax(0,1fr)_auto] gap-3 min-h-0 overflow-hidden">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 grid grid-rows-[auto_minmax(0,1fr)] min-h-0 overflow-hidden">
              <div className="grid grid-cols-[28px_105px_45px_70px_80px_55px_minmax(0,1fr)_90px_75px_75px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <input
                  type="checkbox"
                  className="self-center"
                  checked={cteDetalheLista.length > 0 && cteDetalheSelecionados.size === cteDetalheLista.length}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCteDetalheSelecionados(() => {
                      if (!checked) return new Set();
                      const next = new Set<number>();
                      for (const c of cteDetalheLista) {
                        const id = Number((c as any).seq_cte ?? 0);
                        if (id > 0) next.add(id);
                      }
                      return next;
                    });
                  }}
                />
                <span>CT-e</span>
                <span>Carr.</span>
                <span>Emissão</span>
                <span>Prev. Entr..</span>
                <span>Dest.</span>
                <span>Pagador</span>
                <span className="text-right">Frete (R$)</span>
                <span className="text-right">Peso (Kg)</span>
                <span className="text-right">Cub. (m³)</span>
              </div>
              <div className="min-h-0 overflow-y-auto">
                {loadingCteDetalhe ? (
                  <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando CT-es...
                  </div>
                ) : cteDetalheLista.length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
                    <Package className="h-6 w-6" />
                    Nenhum CT-e encontrado.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cteDetalheLista.map((cte, idx) => {
                      const id = Number((cte as any).seq_cte ?? 0);
                      const checked = id > 0 && cteDetalheSelecionados.has(id);
                      return (
                      <div
                        key={idx}
                        className="grid grid-cols-[28px_105px_45px_70px_80px_55px_minmax(0,1fr)_90px_75px_75px] gap-2 px-3 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-900/50"
                      >
                        <input
                          type="checkbox"
                          className="self-center"
                          checked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked;
                            setCteDetalheSelecionados(prev => {
                              const next = new Set(prev);
                              if (id > 0) {
                                if (nextChecked) next.add(id);
                                else next.delete(id);
                              }
                              return next;
                            });
                          }}
                        />
                        <span className="font-mono text-xs self-center text-slate-700 dark:text-slate-300">{cte.ctrc}</span>
                        <span className="self-center font-mono text-xs text-slate-600 dark:text-slate-400">{cte.unidade_carregamento || '-'}</span>
                        <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_emissao || '-'}</span>
                        <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_prev_ent || '-'}</span>
                        <span className="self-center font-mono text-xs text-slate-600 dark:text-slate-400">{cte.sigla_dest || '-'}</span>
                        <span className="self-center truncate text-slate-600 dark:text-slate-300">{cte.nome_pag || '-'}</span>
                        <span className="self-center text-right font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">{cte.vlr_frete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{cte.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{cte.cubagem.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {cteDetalheTotais && (
              <div className="grid grid-cols-[28px_105px_45px_70px_80px_55px_minmax(0,1fr)_90px_75px_75px] gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                <span className="text-slate-500 dark:text-slate-400">{cteDetalheSelecionados.size > 0 ? `${cteDetalheSelecionados.size} selecionado(s)` : ''}</span>
                <span className="text-slate-500 dark:text-slate-400">{cteDetalheLista.length} CT-es</span>
                <span />
                <span />
                <span />
                <span />
                <span />
                <span className="text-right font-mono text-indigo-700 dark:text-indigo-300">{cteDetalheTotais.vlr_frete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-right font-mono">{cteDetalheTotais.peso.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-right font-mono">{cteDetalheTotais.cubagem.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type LogImportacao = { placa: string; status: 'importado' | 'sobrescrito' | 'ignorado' | 'aviso' | 'erro'; msg: string };

type LinhaCarregamento = {
  nro_linha: number;
  nome: string;
  sigla_emit: string;
  sigla_dest: string;
  unidades: string;
  km_ida: number | null;
  km_volta: number | null;
  vlr_min_frete?: number | null;
  carrega_seg?: boolean;
  carrega_ter?: boolean;
  carrega_qua?: boolean;
  carrega_qui?: boolean;
  carrega_sex?: boolean;
  carrega_sab?: boolean;
  carrega_dom?: boolean;
};

type LinhaHojeStatus = {
  podeCarregar: boolean;
  motivoBloqueio: string | null;
  freteTotalDestino: number;
  pesoKgDestino: number;
  cubagemDestino: number;
};

function ModalCarregamentoAutomatico({ onConfirmar, onFechar }: {
  onConfirmar: (placa: string, unidadeDestino: string, paradas: string[], nroLinha?: number) => Promise<{
    ok: boolean;
    placa?: string;
    resumo?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
    resumoDestinos?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
  }>;
  onFechar: () => void;
}) {
  const [modo, setModo] = useState<'automatico' | 'manual'>('automatico');
  const [placa, setPlaca] = useState('');
  const [unidadeDestino, setUnidadeDestino] = useState('');
  const [paradasStr, setParadasStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [linhas, setLinhas] = useState<LinhaCarregamento[]>([]);
  const [nroLinha, setNroLinha] = useState('');
  const [buscaLinha, setBuscaLinha] = useState('');
  const [ordemLinhas, setOrdemLinhas] = useState<'destino' | 'intermediarias'>('destino');
  const [ordemDirLinhas, setOrdemDirLinhas] = useState<'asc' | 'desc'>('asc');
  const [loadingLinhas, setLoadingLinhas] = useState(false);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        setLoadingLinhas(true);
        const res = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/carregamento_automatico.php`,
          { method: 'POST', body: JSON.stringify({ acao: 'listar_linhas' }) },
          true
        );
        if (!ativo) return;
        if (res.success) setLinhas(res.linhas ?? []);
        else toast.error(res.message || 'Erro ao carregar linhas.');
      } catch (e: any) {
        if (!ativo) return;
        toast.error(e.message || 'Erro ao carregar linhas.');
      } finally {
        if (ativo) setLoadingLinhas(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  const handleConfirmarManual = async () => {
    if (loading) return;
    if (!unidadeDestino.trim()) { toast.error('Informe a unidade de destino.'); return; }
    const paradas = paradasStr.split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
    const placaFinal = placa.trim().toUpperCase() || '';
    try {
      setLoading(true);
      const result = await onConfirmar(placaFinal, unidadeDestino.trim().toUpperCase(), paradas);
      if (result.ok) {
        if (result.placa && (result.resumo?.length || result.resumoDestinos?.length)) {
          setResumoPlaca(result.placa);
          setResumoUnidades(result.resumo ?? []);
          setResumoDestinos(result.resumoDestinos ?? []);
          setResumoDialogOpen(true);
        } else {
          onFechar();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const [resumoDialogOpen, setResumoDialogOpen] = useState(false);
  const [resumoPlaca, setResumoPlaca] = useState('');
  const [resumoUnidades, setResumoUnidades] = useState<{ unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[]>([]);
  const [resumoDestinos, setResumoDestinos] = useState<{ unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[]>([]);

  const handleConfirmarAutomatico = async () => {
    if (loading) return;
    if (!nroLinha) { toast.error('Selecione uma linha.'); return; }
    try {
      setLoading(true);
      const result = await onConfirmar('', '', [], Number(nroLinha));
      if (result.ok) {
        if (result.placa && (result.resumo?.length || result.resumoDestinos?.length)) {
          setResumoPlaca(result.placa);
          setResumoUnidades(result.resumo ?? []);
          setResumoDestinos(result.resumoDestinos ?? []);
          setResumoDialogOpen(true);
        } else {
          onFechar();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFecharResumo = () => {
    setResumoDialogOpen(false);
    onFechar();
  };

  const toggleOrdemLinhas = (col: 'destino' | 'intermediarias') => {
    if (ordemLinhas === col) setOrdemDirLinhas(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrdemLinhas(col); setOrdemDirLinhas('asc'); }
  };

  const linhasVisiveis = React.useMemo(() => {
    const q = buscaLinha.trim().toUpperCase();
    const filtradas = q
      ? linhas.filter(l => (l.sigla_dest ?? '').toUpperCase().includes(q) || (l.unidades ?? '').toUpperCase().includes(q))
      : linhas.slice();

    const dir = ordemDirLinhas === 'asc' ? 1 : -1;
    filtradas.sort((a, b) => {
      const va = (ordemLinhas === 'destino' ? (a.sigla_dest ?? '') : (a.unidades ?? '')).toUpperCase();
      const vb = (ordemLinhas === 'destino' ? (b.sigla_dest ?? '') : (b.unidades ?? '')).toUpperCase();
      const cmp = va.localeCompare(vb);
      if (cmp !== 0) return cmp * dir;
      return ((a.nro_linha ?? 0) - (b.nro_linha ?? 0)) * dir;
    });
    return filtradas;
  }, [linhas, buscaLinha, ordemLinhas, ordemDirLinhas]);

  const podeIniciar = modo === 'automatico'
    ? !!nroLinha && !loadingLinhas
    : !!unidadeDestino.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ListTree className="w-5 h-5 text-indigo-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Carregamento Automático</h3>
          </div>
          <button onClick={!loading ? onFechar : undefined} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" disabled={loading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-4 flex gap-2">
          <button
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${modo === 'automatico' ? 'bg-indigo-500 text-white border-indigo-500' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            onClick={() => setModo('automatico')}
            disabled={loading}
          >
            Por Linhas (automático)
          </button>
          <button
            className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${modo === 'manual' ? 'bg-indigo-500 text-white border-indigo-500' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
            onClick={() => setModo('manual')}
            disabled={loading}
          >
            Informado
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {modo === 'automatico' ? (
            <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-2">
                <ListTree className="w-4 h-4" />Montagem automática por linhas
              </p>
              <p className="text-xs text-indigo-700 dark:text-indigo-400">
                Selecione uma linha para montar um carregamento para o destino final dessa linha, incluindo as paradas intermediárias.
              </p>
              <div className="pt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Linha <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {loadingLinhas ? 'Carregando...' : `${linhasVisiveis.length} linha(s)`}
                  </span>
                </div>

                <input
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                  placeholder="Buscar sigla (destino ou intermediárias)..."
                  value={buscaLinha}
                  onChange={e => setBuscaLinha(e.target.value.toUpperCase())}
                  disabled={loading || loadingLinhas}
                />

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="grid grid-cols-[84px_1fr] items-center gap-2 px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-700 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                      onClick={() => toggleOrdemLinhas('destino')}
                      disabled={loading || loadingLinhas}
                    >
                      Destino
                      {ordemLinhas === 'destino' && (
                        ordemDirLinhas === 'desc'
                          ? <ChevronDown className="w-3 h-3 shrink-0" />
                          : <ChevronDown className="w-3 h-3 shrink-0 rotate-180" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 text-left"
                      onClick={() => toggleOrdemLinhas('intermediarias')}
                      disabled={loading || loadingLinhas}
                    >
                      Unidades intermediárias
                      {ordemLinhas === 'intermediarias' && (
                        ordemDirLinhas === 'desc'
                          ? <ChevronDown className="w-3 h-3 shrink-0" />
                          : <ChevronDown className="w-3 h-3 shrink-0 rotate-180" />
                      )}
                    </button>
                  </div>
                  <div className="max-h-28 overflow-y-auto">
                    {loadingLinhas ? (
                      <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Carregando linhas...
                      </div>
                    ) : linhasVisiveis.length === 0 ? (
                      <div className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                        Nenhuma linha encontrada.
                      </div>
                    ) : (
                      linhasVisiveis.map(l => {
                        const selecionada = String(l.nro_linha) === nroLinha;
                        const destino = (l.sigla_dest ?? '').trim().toUpperCase() || '-';
                        const inter = (l.unidades ?? '').trim().toUpperCase() || '-';
                        const nome = (l.nome ?? '').trim();
                        return (
                          <button
                            key={l.nro_linha}
                            type="button"
                            onClick={() => setNroLinha(String(l.nro_linha))}
                            className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 transition-colors ${selecionada ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
                            disabled={loading}
                          >
                            <div className="grid grid-cols-[84px_1fr] items-start gap-2">
                              <div className="leading-tight">
                                <div className={`font-mono font-bold text-xs ${selecionada ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}`}>
                                  {destino}
                                </div>
                                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                                  #{l.nro_linha}
                                </div>
                              </div>
                              <div className="min-w-0 leading-tight">
                                <div className="font-mono text-[11px] text-slate-700 dark:text-slate-200 whitespace-nowrap truncate">
                                  {inter}
                                </div>
                                {nome && (
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 whitespace-nowrap truncate">
                                    {nome}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Placa <span className="font-normal text-slate-400">(opcional — gerada automaticamente se vazia)</span></label>
                <input
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                  placeholder="Ex: ABC1234"
                  value={placa}
                  onChange={e => setPlaca(e.target.value.toUpperCase())}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Unidade de Destino</label>
                <input
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                  placeholder="Ex: MTZ"
                  value={unidadeDestino}
                  onChange={e => setUnidadeDestino(e.target.value.toUpperCase())}
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Paradas intermediárias <span className="font-normal text-slate-400">(separadas por vírgula, opcional)</span></label>
                <input
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                  placeholder="Ex: CWB, LDA"
                  value={paradasStr}
                  onChange={e => setParadasStr(e.target.value.toUpperCase())}
                  disabled={loading}
                />
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onFechar} disabled={loading}>Cancelar</Button>
          <Button size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white" onClick={modo === 'automatico' ? handleConfirmarAutomatico : handleConfirmarManual} disabled={loading || !podeIniciar}>
            {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ListTree className="w-3.5 h-3.5 mr-1.5" />}
            {loading ? 'Processando...' : 'Iniciar'}
          </Button>
        </div>
      </div>
      <Dialog open={resumoDialogOpen} onOpenChange={setResumoDialogOpen}>
        <DialogContent className="sm:max-w-[690px]">
          <DialogHeader>
            <DialogTitle>Resumo · Carregamento {resumoPlaca}</DialogTitle>
            <DialogDescription>CT-es adicionados por unidade de destino</DialogDescription>
          </DialogHeader>
          <div className="flex">
            <div className="w-full rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden min-w-0">
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Por unidade destino</p>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <span>Unid.</span>
                <span className="text-right">CT-es</span>
                <span className="text-right">Kg</span>
                <span className="text-right">M³</span>
                <span className="text-right">Frete</span>
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {resumoDestinos.length === 0 ? <div className="px-3 py-3 text-xs text-slate-400 text-center">—</div> : resumoDestinos.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 px-2 py-1.5 text-xs">
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{r.unidade || '-'}</span>
                    <span className="text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{r.qtd}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.peso_kg ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.cubagem ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.frete ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-1.5 text-xs font-semibold">
                <span className="text-slate-600 dark:text-slate-300">Total</span>
                <span className="text-right font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{resumoDestinos.reduce((s, r) => s + r.qtd, 0)}</span>
                <span className="text-right font-mono text-[10px] tabular-nums">{resumoDestinos.reduce((s, r) => s + (r.peso_kg ?? 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                <span className="text-right font-mono text-[10px] tabular-nums">{resumoDestinos.reduce((s, r) => s + (r.cubagem ?? 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                <span className="text-right font-mono text-[10px] tabular-nums">{resumoDestinos.reduce((s, r) => s + (r.frete ?? 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleFecharResumo}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ModalHub({
  placa,
  origem,
  destino,
  unidadesStr,
  onChangeUnidades,
  onConfirmar,
  onFechar,
  loadingSugestao,
  loadingConfirmar,
}: {
  placa: string;
  origem: string;
  destino: string;
  unidadesStr: string;
  onChangeUnidades: (value: string) => void;
  onConfirmar: () => void;
  onFechar: () => void;
  loadingSugestao: boolean;
  loadingConfirmar: boolean;
}) {
  const loading = loadingSugestao || loadingConfirmar;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Hub · Completar Carregamento</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {placa} · linha <span className="font-mono font-bold">{origem}</span> → <span className="font-mono font-bold">{destino}</span>
              </p>
            </div>
          </div>
          <button onClick={!loading ? onFechar : undefined} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" disabled={loading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div className="rounded-xl border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-violet-800 dark:text-violet-300 flex items-center gap-2">
              <Share2 className="w-4 h-4" />
              Unidades intermediárias
              {loadingSugestao && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
            </p>
            <p className="text-xs text-violet-700 dark:text-violet-400">
              O sistema sugere estas unidades a partir da linha cadastrada ({origem} → {destino}). Você pode editar antes de buscar.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Unidades <span className="font-normal text-slate-400">(separadas por vírgula)</span>
            </label>
            <input
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:opacity-50"
              placeholder="Ex: CWB, LDA"
              value={unidadesStr}
              onChange={e => onChangeUnidades(e.target.value.toUpperCase())}
              disabled={loading}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onFechar} disabled={loading}>Cancelar</Button>
          <Button
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={onConfirmar}
            disabled={loading || !unidadesStr.trim()}
          >
            {loadingConfirmar ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5 mr-1.5" />}
            {loadingConfirmar ? 'Processando...' : 'Completar'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModalImportarSSW({ onFechar, onConcluir, onExecutar }: { onFechar: () => void; onConcluir: () => Promise<void>; onExecutar: () => Promise<any> }) {
  const [etapa, setEtapa] = useState<'confirmar' | 'carregando' | 'resultado'>('confirmar');
  const [logs, setLogs] = useState<LogImportacao[]>([]);
  const [placasSSW, setPlacasSSW] = useState<string[]>([]);

  const executar = async () => {
    setEtapa('carregando');
    try {
      const res = await onExecutar();
      if (res.success) {
        setLogs(res.logs ?? []);
        setPlacasSSW(res.placas_ssw ?? []);
        setEtapa('resultado');
        await onConcluir();
      } else {
        toast.error(res.message || 'Erro ao importar carregamentos do SSW');
        onFechar();
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao importar carregamentos do SSW');
      onFechar();
    }
  };

  const corStatus: Record<string, string> = {
    importado:   'text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30',
    sobrescrito: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30',
    ignorado:    'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40',
    aviso:       'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30',
    erro:        'text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-sky-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Importar Carregamentos do SSW</h3>
          </div>
          {etapa !== 'carregando' && (
            <button onClick={onFechar} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-5">
          {etapa === 'confirmar' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                O sistema irá reimportar os carregamentos do SSW para a sua unidade, atualizando o Presto.
              </p>
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Reimportação automática</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      Antes de importar, o sistema remove os registros anteriores vindos do SSW e traz novamente os dados. Apontamentos manuais permanecem.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {etapa === 'carregando' && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-sky-500" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Importando carregamentos do SSW...</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">Isso pode levar alguns segundos. Não feche esta janela.</p>
            </div>
          )}

          {etapa === 'resultado' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {placasSSW.length} placa{placasSSW.length !== 1 ? 's' : ''} encontrada{placasSSW.length !== 1 ? 's' : ''} no SSW. Resultado:
              </p>
              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {logs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${corStatus[log.status] ?? ''}`}>
                    <span className="font-mono font-bold shrink-0">{log.placa}</span>
                    <span className="flex-1">{log.msg}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Nenhum resultado para exibir.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2">
          {etapa === 'confirmar' && (
            <>
              <Button variant="outline" size="sm" onClick={onFechar}>Cancelar</Button>
              <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white" onClick={executar}>
                <Download className="w-3.5 h-3.5 mr-1.5" />Importar
              </Button>
            </>
          )}
          {etapa === 'resultado' && (
            <Button size="sm" variant="outline" onClick={onFechar}>Fechar</Button>
          )}
        </div>
      </div>
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
  onCarregarSSW,
  onCarregarHub,
  loadingHub,
  hubCarregamentoPlaca,
  onRecarregarCarregamentos,
  onImportarCarregamentos,
  importandoCarregamentos,
  importacaoAutomatica,
  onToggleImportacaoAutomatica,
  onCarregamentoAutomatico,
  todosCtes,
}: CarregamentoAreaProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [modalAutomaticoAberto, setModalAutomaticoAberto] = useState(false);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);

  const handleCriar = (placa: string, destino: string, paradas: string) => {
    setModalAberto(false);
    onCriarCarregamento(placa, destino, paradas);
  };

  const handleExcluirTodos = async () => {
    if (!window.confirm(`Excluir TODOS os ${carregamentos.length} carregamento(s) da unidade ${sigla}? Esta ação não pode ser desfeita.`)) return;
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'excluir_todos' }) },
        true
      );
      if (res.success) {
        toast.success('Todos os carregamentos foram excluídos.');
        onRecarregarCarregamentos();
      } else {
        toast.error(res.message || 'Erro ao excluir carregamentos.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir carregamentos.');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 overflow-hidden relative">
      <div className={`${importandoCarregamentos ? 'blur-sm pointer-events-none select-none' : ''}`}>
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
          <div className="flex gap-2">
            {carregamentos.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-red-300 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={handleExcluirTodos}
                title="Excluir todos os carregamentos"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />Excluir todos
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 border-sky-300 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30"
              onClick={() => setModalImportarAberto(true)}
              disabled={importandoCarregamentos}
            >
              <FileDown className="w-3.5 h-3.5 mr-1.5" />Imp. carregamentos
            </Button>
            <div className="inline-flex items-center gap-1.5 px-2 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Auto</span>
              <Switch checked={importacaoAutomatica} onCheckedChange={onToggleImportacaoAutomatica} />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={() => setModalAberto(true)}
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />Carr. Manual
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-8 border-indigo-300 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
              onClick={() => setModalAutomaticoAberto(true)}
            >
              <ListTree className="w-3.5 h-3.5 mr-1.5" />Carr. Automático
            </Button>
          </div>
        </div>

        {carregamentos.length === 0 && !loadingCarregamentos ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
            <Truck className="w-10 h-10 mb-2 opacity-20" />
            <p className="text-sm">Nenhum carregamento em andamento</p>
            <p className="text-xs mt-0.5">Clique em "Carregamento Manual" para começar</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {carregamentos.map((c, i) => (
              <CardCarregamento
                key={i}
                carregamento={c}
                todosCtes={todosCtes}
                modoApontamento={modoApontamento}
                onIniciarApontamento={onIniciarApontamento}
                onCancelarApontamento={onCancelarApontamento}
                onExcluirCarregamento={onExcluirCarregamento}
                onRemoverCte={onRemoverCte}
                onCarregarSSW={onCarregarSSW}
                onCarregarHub={onCarregarHub}
                loadingHub={loadingHub}
                hubCarregamentoPlaca={hubCarregamentoPlaca}
                onRecarregarCarregamentos={onRecarregarCarregamentos}
                importandoCarregamentos={importandoCarregamentos}
              />
            ))}
          </div>
        )}
      </div>

      {importandoCarregamentos && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="absolute inset-0 bg-white/35 dark:bg-black/35" />
          <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-4 shadow-xl">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              Atualizando Carregamentos
            </div>
          </div>
        </div>
      )}

      {modalAberto && (
        <ModalCriarCarregamento
          onConfirmar={handleCriar}
          onFechar={() => setModalAberto(false)}
        />
      )}
      {modalAutomaticoAberto && (
        <ModalCarregamentoAutomatico
          onConfirmar={onCarregamentoAutomatico}
          onFechar={() => setModalAutomaticoAberto(false)}
        />
      )}
      {modalImportarAberto && (
        <ModalImportarSSW
          onFechar={() => setModalImportarAberto(false)}
          onConcluir={onRecarregarCarregamentos}
          onExecutar={onImportarCarregamentos}
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
  const dominioUsuario = (user?.domain ?? '').trim().toUpperCase();
  const unidadeAtual = unidadeLogada.trim().toUpperCase();

  const shouldIgnoreDestinoRVE = (destinoRaw: string | null | undefined) => {
    if (dominioUsuario !== 'RVE') return false;
    const destino = (destinoRaw ?? '').trim().toUpperCase();
    if (!destino) return false;
    if (DESTINOS_IGNORADOS_RVE.has(destino)) return true;
    if (unidadeAtual === 'SAO' && destino === 'CAM') return true;
    if (unidadeAtual === 'CAM' && destino === 'SAO') return true;
    return false;
  };

  const [sigla] = useState<string>(unidadeLogada);

  type FiltrosDisponiveis = {
    unidadeDestino: string[];
    periodoEmissaoInicio: string;
    periodoEmissaoFim: string;
    periodoPrevisaoInicio: string;
    periodoPrevisaoFim: string;
  };

  const filtrosVazios: FiltrosDisponiveis = {
    unidadeDestino: [],
    periodoEmissaoInicio: '',
    periodoEmissaoFim: '',
    periodoPrevisaoInicio: '',
    periodoPrevisaoFim: '',
  };

  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FiltrosDisponiveis>(filtrosVazios);
  const [tempFilters, setTempFilters] = useState<FiltrosDisponiveis>(filtrosVazios);

  useEffect(() => {
    if (showFilters) setTempFilters(filters);
  }, [showFilters, filters]);

  const [linhasOrigem, setLinhasOrigem] = useState<LinhaCarregamento[]>([]);
  const [loadingLinhasOrigem, setLoadingLinhasOrigem] = useState(false);
  const [linhasHojeDialogOpen, setLinhasHojeDialogOpen] = useState(false);
  const [carregandoNroLinhaHoje, setCarregandoNroLinhaHoje] = useState<number | null>(null);
  const [linhasHojeSortKey, setLinhasHojeSortKey] = useState<'nro' | 'nome' | 'dest' | 'inter' | 'km'>('nro');
  const [linhasHojeSortDir, setLinhasHojeSortDir] = useState<'asc' | 'desc'>('asc');
  const [linhasHojeStatus, setLinhasHojeStatus] = useState<Record<number, LinhaHojeStatus>>({});
  const [loadingLinhasHojeStatus, setLoadingLinhasHojeStatus] = useState(false);

  const [resumoHojeDialogOpen, setResumoHojeDialogOpen] = useState(false);
  const [resumoHojePlaca, setResumoHojePlaca] = useState('');
  const [resumoHojeUnidades, setResumoHojeUnidades] = useState<{ unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[]>([]);
  const [resumoHojeDestinos, setResumoHojeDestinos] = useState<{ unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[]>([]);

  const [dados, setDados] = useState<DadosTransferencia | null>(null);
  const [loading, setLoading] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('');
  const [countdown, setCountdown] = useState(300);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [dadosEntrega, setDadosEntrega] = useState<DadosEntrega | null>(null);
  const [loadingEntrega, setLoadingEntrega] = useState(false);
  const [erroEntrega, setErroEntrega] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        setLoadingLinhasOrigem(true);
        const res = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/carregamento_automatico.php`,
          { method: 'POST', body: JSON.stringify({ acao: 'listar_linhas' }) },
          true
        );
        if (!ativo) return;
        if (res.success) setLinhasOrigem(res.linhas ?? []);
        else setLinhasOrigem([]);
      } catch {
        if (!ativo) return;
        setLinhasOrigem([]);
      } finally {
        if (ativo) setLoadingLinhasOrigem(false);
      }
    })();
    return () => { ativo = false; };
  }, []);

  const diaCarregaKey = React.useMemo(() => {
    const d = new Date().getDay();
    if (d === 0) return 'carrega_dom' as const;
    if (d === 1) return 'carrega_seg' as const;
    if (d === 2) return 'carrega_ter' as const;
    if (d === 3) return 'carrega_qua' as const;
    if (d === 4) return 'carrega_qui' as const;
    if (d === 5) return 'carrega_sex' as const;
    return 'carrega_sab' as const;
  }, []);

  const linhasCarregamHoje = React.useMemo(() => {
    return (linhasOrigem ?? []).filter((l) => (l as any)[diaCarregaKey] ?? true);
  }, [linhasOrigem, diaCarregaKey]);

  const linhasCarregamHojeOrdenadas = React.useMemo(() => {
    const dir = linhasHojeSortDir === 'asc' ? 1 : -1;
    const copy = [...linhasCarregamHoje];
    copy.sort((a, b) => {
      const aPode = (linhasHojeStatus[a.nro_linha]?.podeCarregar ?? true);
      const bPode = (linhasHojeStatus[b.nro_linha]?.podeCarregar ?? true);
      if (aPode !== bPode) return aPode ? -1 : 1;

      const aN = a.nro_linha ?? 0;
      const bN = b.nro_linha ?? 0;
      const aNome = (a.nome ?? '').toUpperCase();
      const bNome = (b.nome ?? '').toUpperCase();
      const aDest = (a.sigla_dest ?? '').toUpperCase();
      const bDest = (b.sigla_dest ?? '').toUpperCase();
      const aInter = (a.unidades ?? '').toUpperCase();
      const bInter = (b.unidades ?? '').toUpperCase();
      const aKm = a.km_ida ?? 0;
      const bKm = b.km_ida ?? 0;

      const cmp = (va: string | number, vb: string | number) => (va < vb ? -1 : va > vb ? 1 : 0);

      if (linhasHojeSortKey === 'nro') return cmp(aN, bN) * dir;
      if (linhasHojeSortKey === 'nome') return cmp(aNome, bNome) * dir;
      if (linhasHojeSortKey === 'dest') return cmp(aDest, bDest) * dir;
      if (linhasHojeSortKey === 'inter') return cmp(aInter, bInter) * dir;
      return cmp(aKm, bKm) * dir;
    });
    return copy;
  }, [linhasCarregamHoje, linhasHojeSortDir, linhasHojeSortKey, linhasHojeStatus]);

  const qtdLinhasHojeViaveis = React.useMemo(() => {
    return linhasCarregamHoje.reduce((s, l) => s + ((linhasHojeStatus[l.nro_linha]?.podeCarregar ?? true) ? 1 : 0), 0);
  }, [linhasCarregamHoje, linhasHojeStatus]);
  const [progressoEntrega, setProgressoEntrega] = useState(0);
  const progressoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [carregamentos, setCarregamentos] = useState<Carregamento[]>([]);
  const [loadingCarregamentos, setLoadingCarregamentos] = useState(false);
  const [modoApontamento, setModoApontamento] = useState<string | null>(null);
  const [ctesSelecionados, setCtesSelecionados] = useState<Map<number, Cte>>(new Map());
  const [importandoCarregamentos, setImportandoCarregamentos] = useState(false);
  const [importacaoAutomatica, setImportacaoAutomatica] = useState(true);
  const importandoCarregamentosRef = useRef(false);

  const [carregInexistDialogOpen, setCarregInexistDialogOpen] = useState(false);
  const [carregInexistLista, setCarregInexistLista] = useState<CarregamentoInexistente[]>([]);
  const [carregInexistSelecionados, setCarregInexistSelecionados] = useState<Set<string>>(new Set());
  const [carregInexistExcluindo, setCarregInexistExcluindo] = useState(false);
  const carregInexistLastKeyRef = useRef<string>('');

  const [hubCarregamentoPlaca, setHubCarregamentoPlaca] = useState<string | null>(null);
  const [dadosHub, setDadosHub] = useState<DadosHub | null>(null);
  const [loadingHub, setLoadingHub] = useState(false);
  const [hubEtapa, setHubEtapa] = useState<'sugestao' | 'confirmar' | null>(null);
  const [hubModalAberto, setHubModalAberto] = useState(false);
  const [hubModalCarregamento, setHubModalCarregamento] = useState<Carregamento | null>(null);
  const [hubModalDestino, setHubModalDestino] = useState('');
  const [hubModalUnidadesStr, setHubModalUnidadesStr] = useState('');

  const [unidadePermiteCarregamento, setUnidadePermiteCarregamento] = useState<boolean | null>(null);

  useEffect(() => {
      if (!sigla || isMTZ) return;
      apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/check_unidade_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ sigla }) },
        true
      ).then((res) => {
        if (res.success && res.efetua_carregamento === false) {
          setUnidadePermiteCarregamento(false);
        } else {
          setUnidadePermiteCarregamento(true);
        }
      }).catch(() => {
        setUnidadePermiteCarregamento(true);
      });
    }, [sigla]);

  const ctesJaCarregados = React.useMemo<Map<number, string>>(() => {
    const m = new Map<number, string>();
    for (const car of carregamentos) {
      for (const c of car.ctes) {
        // Usa seq_cte como chave primária (é o que o backend salva)
        if (c.seq_cte > 0) m.set(c.seq_cte, car.placa_provisoria);
        // Também indexa por nroCte para compatibilidade com dados SSW sem seqCte
        if ((c.nroCte ?? 0) > 0) m.set(c.nroCte as number, car.placa_provisoria);
      }
    }
    return m;
  }, [carregamentos]);

  const todosCtes = React.useMemo(() => {
    const lista: { nroCte: number; seqCte?: number; ctrc: string; destinatario: string; cidade: string; peso: string; cubagem: string }[] = [];
    const vistos = new Set<string>();
    const add = (nroCte: number, ctrc: string, destinatario: string, cidade: string, peso: string, cubagem: string, seqCte?: number) => {
      const key = seqCte ? `seq:${seqCte}` : `nro:${nroCte}`;
      if (vistos.has(key)) return;
      vistos.add(key);
      lista.push({ nroCte, seqCte, ctrc, destinatario, cidade, peso, cubagem });
    };
    if (dados?.ctes) {
      for (const c of dados.ctes) {
        add(c.nroCte, c.ctrc, c.destinatario, c.cidade, c.peso, c.cubagem, c.seqCte);
      }
    }
    if (dadosEntrega?.ctes) {
      for (const c of dadosEntrega.ctes) {
        add(c.nroCte, c.ctrc, c.destinatario, c.cidade, c.peso, c.cubagem, c.seqCte);
      }
    }
    for (const car of carregamentos) {
      for (const c of car.ctes) {
        if (c.ctrc) {
          add(c.nroCte ?? 0, c.ctrc, c.destinatario ?? '', c.cidade ?? '', c.peso ?? '', c.cubagem ?? '');
        }
      }
    }
    return lista;
  }, [dados, dadosEntrega, carregamentos]);

  const [abaAtiva, setAbaAtiva] = useState<'transferencia' | 'entrega' | 'todos'>('transferencia');

  type OrdemCol = 'totalCtes' | 'sigla' | 'armazem' | 'transito' | 'coletas' | 'totalVol' | 'totalFrete' | 'totalPeso' | 'totalCubagem' | 'piorSaida' | 'piorTransito';
  const [ordemCol, setOrdemCol]   = useState<OrdemCol>('totalCtes');
  const [ordemDir, setOrdemDir]   = useState<'asc' | 'desc'>('desc');

  const carregar = useCallback(async (siglaParam?: string) => {
    const s = siglaParam ?? sigla;
    if (!s) return;
    try {
      setLoading(true);
      setTransferLoaded(0);
      setTransferTotal(null);
      const res = await apiFetchWithProgress(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_disponiveis_transferencia.php`,
        { method: 'POST', body: JSON.stringify({ sigla: s }) },
        (p) => { setTransferLoaded(p.loaded); setTransferTotal(p.total); },
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
    setEntregaLoaded(0);
    setEntregaTotal(null);

    if (progressoRef.current) clearInterval(progressoRef.current);

    try {
      let lastTotal: number | null = null;
      const res = await apiFetchWithProgress(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_disponiveis_entrega.php`,
        { method: 'POST', body: JSON.stringify({ sigla: s }) },
        (p) => {
          setEntregaLoaded(p.loaded);
          setEntregaTotal(p.total);
          lastTotal = p.total;
          if (p.total && p.total > 0) setProgressoEntrega(Math.min(100, Math.floor((p.loaded / p.total) * 100)));
        },
        true
      );
      if (progressoRef.current) clearInterval(progressoRef.current);
      if (res?.success) setProgressoEntrega(100);
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

  const [transferLoaded, setTransferLoaded] = useState(0);
  const [transferTotal, setTransferTotal] = useState<number | null>(null);
  const [entregaLoaded, setEntregaLoaded] = useState(0);
  const [entregaTotal, setEntregaTotal] = useState<number | null>(null);

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
      } else {
        toast.error(res.message || 'Erro ao buscar carregamentos.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao buscar carregamentos.');
    }
    finally { setLoadingCarregamentos(false); }
  }, []);

  const handleImportarCarregamentos = useCallback(async () => {
    if (importandoCarregamentosRef.current) return { success: false, message: 'Importação já em andamento.' };
    importandoCarregamentosRef.current = true;
    setImportandoCarregamentos(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/importar_carregamentos_ssw.php`,
        { method: 'POST', body: JSON.stringify({}) },
        true
      );
      if (res?.success) {
        await carregarCarregamentos();
      }
      const inexist: CarregamentoInexistente[] = Array.isArray(res?.carregamentos_inexistentes) ? res.carregamentos_inexistentes : [];
      if (inexist.length > 0) {
        const key = inexist.map((i) => String(i.origem_ssw ?? '').toUpperCase()).sort().join('|');
        if (key && key !== carregInexistLastKeyRef.current && !carregInexistDialogOpen) {
          setCarregInexistLista(inexist);
          setCarregInexistSelecionados(new Set(inexist.map((i) => String(i.origem_ssw ?? '').toUpperCase())));
          setCarregInexistDialogOpen(true);
          carregInexistLastKeyRef.current = key;
        }
      }
      return res;
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao importar carregamentos do SSW' };
    } finally {
      importandoCarregamentosRef.current = false;
      setImportandoCarregamentos(false);
    }
  }, [carregarCarregamentos, carregInexistDialogOpen]);

  const excluirCarregamentosInexistentes = useCallback(async () => {
    const origens_ssw = Array.from(carregInexistSelecionados.values()).filter(Boolean);
    if (!origens_ssw.length) return;
    setCarregInexistExcluindo(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/importar_carregamentos_ssw.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'EXCLUIR_INEXISTENTES', origens_ssw }) },
        true
      );
      if (!res?.success) {
        toast.error(res?.message || 'Erro ao excluir carregamentos inexistentes do Presto');
        return;
      }
      toast.success(`${res.removidos ?? 0} carregamento(s) removido(s).`);
      setCarregInexistDialogOpen(false);
      setCarregInexistLista([]);
      setCarregInexistSelecionados(new Set());
      await carregarCarregamentos();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir carregamentos inexistentes do Presto');
    } finally {
      setCarregInexistExcluindo(false);
    }
  }, [carregarCarregamentos, carregInexistSelecionados]);

  const importarCarregamentosSSWObrigatorio = useCallback(async () => {
    const res = await handleImportarCarregamentos();
    if (!res?.success) {
      await carregarCarregamentos();
    }
    return res;
  }, [handleImportarCarregamentos, carregarCarregamentos]);

  useEffect(() => {
    if (!importacaoAutomatica) return;
    const id = setInterval(() => { void handleImportarCarregamentos(); }, 120000);
    return () => clearInterval(id);
  }, [importacaoAutomatica, handleImportarCarregamentos]);

  const handleCriarCarregamento = useCallback(async (placa: string, destino: string, paradas: string) => {
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'criar', placa, destino, paradas }) },
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

  const handleCarregamentoAutomatico = useCallback(async (placa: string, unidadeDestino: string, paradas: string[], nroLinha?: number): Promise<{ ok: boolean; placa?: string; resumo?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number }[]; resumoDestinos?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number }[] }> => {
    try {
      // Envia os CT-es disponíveis (do relatório 019) para o backend filtrar e inserir
      const ctesDisponiveis = (dados?.ctes ?? []).map(c => {
        const anyC: any = c as any;
        const unidadeDest = (anyC.unidadeDest ?? anyC.destinoCte ?? anyC.destino_cte ?? anyC.unidDest ?? anyC.destino ?? '') as string;
        const serCte = (anyC.serCte ?? anyC.ser_cte ?? '') as string;
        const uf = (anyC.uf ?? '') as string;
        const cidadeBase = (anyC.cidade ?? anyC.cidadeDest ?? '') as string;
        const cidade = uf && cidadeBase ? `${cidadeBase}/${uf}` : (anyC.cidade ?? '');
        return {
          nroCte: anyC.nroCte ?? 0,
          serCte,
          emissao: anyC.emissao ?? '',
          prevEnt: anyC.prevEnt ?? '',
          remetente: anyC.remetente ?? '',
          destinatario: anyC.destinatario ?? '',
          pagador: anyC.pagador ?? '',
          cidade,
          vlrNf: anyC.vlrNf ?? anyC.vlr_merc ?? '',
          frete: anyC.frete ?? anyC.vlr_frete ?? '',
          peso: anyC.peso ?? '',
          cubagem: anyC.cubagem ?? '',
          qtdeVol: anyC.qtdeVol ?? anyC.qtde_vol ?? '',
          unidadeDest,
          unidadeCarregamento: anyC.unidadeCarregamento ?? anyC.unidade_carregamento ?? anyC.unidadeRelatorio ?? anyC.unidadeOrigem ?? anyC.sigla_emit ?? anyC.siglaEmit ?? anyC.unidOrig ?? anyC.origem ?? '',
        };
      });
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/carregamento_automatico.php`,
        { method: 'POST', body: JSON.stringify({ placa, unidadeDestino, paradas, nroLinha, ctesDisponiveis }) },
        true
      );
      if (res.success) {
        toast.success(res.message || 'Carregamento automático iniciado!');
        await carregarCarregamentos();
        return { ok: true, placa: res.placa, resumo: res.resumo_unidades, resumoDestinos: res.resumo_destinos };
      } else {
        toast.error(res.message || 'Erro ao iniciar carregamento automático');
        return { ok: false };
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao iniciar carregamento automático');
      return { ok: false };
    }
  }, [carregarCarregamentos, dados]);

  const handleCarregarLinhaHoje = useCallback(async (nroLinha: number) => {
    if (carregandoNroLinhaHoje) return;
    try {
      setCarregandoNroLinhaHoje(nroLinha);
      const result = await handleCarregamentoAutomatico('', '', [], nroLinha);
      if (result.ok && result.placa && ((result.resumo?.length ?? 0) > 0 || (result.resumoDestinos?.length ?? 0) > 0)) {
        setResumoHojePlaca(result.placa);
        setResumoHojeUnidades((result.resumo as any) ?? []);
        setResumoHojeDestinos((result.resumoDestinos as any) ?? []);
        setResumoHojeDialogOpen(true);
      }
      setLinhasHojeDialogOpen(false);
    } finally {
      setCarregandoNroLinhaHoje(null);
    }
  }, [carregandoNroLinhaHoje, handleCarregamentoAutomatico]);

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
      const ctesPayload = Array.from(ctesSelecionados.values()).map(c => ({
        seqCte: c.seqCte ?? 0,
        nroCte: c.nroCte,
        serCte: c.serCte,
        emissao: c.emissao,
        prevEnt: c.prevEnt,
        remetente: c.remetente,
        destinatario: c.destinatario,
        pagador: c.pagador,
        cidade: `${c.cidade}/${c.uf}`,
        vlrNf: c.vlrNf,
        frete: c.frete,
        peso: c.peso,
        cubagem: c.cubagem,
        qtdeVol: c.qtdeVol,
        unidadeDest: c.unidadeDest,
        unidadeCarregamento: c.unidadeCarregamento ?? (c as any).unidadeCarregamento ?? (c as any).unidade_carregamento ?? (c as any).unidadeRelatorio ?? (c as any).unidadeOrigem ?? (c as any).sigla_emit ?? (c as any).siglaEmit ?? '',
      }));
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'adicionar_ctes', placa: modoApontamento, ctes: ctesPayload }) },
        true
      );
      if (res.success) {
        toast.success(`${res.adicionados ?? ctesSelecionados.size} CT-e(s) adicionado(s) ao carregamento ${modoApontamento}.`);
        setCtesSelecionados(new Map());
        setModoApontamento(null);
        await carregarCarregamentos();
      } else {
        toast.error(res.message || 'Erro ao adicionar CT-es');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao adicionar CT-es');
    }
  }, [modoApontamento, ctesSelecionados, carregarCarregamentos]);

  const toggleCte = useCallback((cte: Cte) => {
    const id = cteId(cte);
    setCtesSelecionados(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, cte);
      return next;
    });
  }, []);

  const handleCarregarSSW = useCallback((_placa: string) => {
    toast.info('Em breve: integração com SSW para carregar o manifesto.');
  }, []);

  const getDestinoCarregamento = useCallback((car: Carregamento): string | null => {
    if (car.destino) return car.destino;
    const m = car.placa_provisoria.match(/^[A-Z0-9]{2,5}-([A-Z0-9]{2,5})$/);
    if (m?.[1]) return m[1];
    const freq = new Map<string, number>();
    for (const c of car.ctes) {
      const cidade = (c.cidade ?? '').trim().toUpperCase();
      if (!cidade || !/^[A-Z0-9]{2,5}$/.test(cidade)) continue;
      freq.set(cidade, (freq.get(cidade) ?? 0) + 1);
    }
    let best: string | null = null;
    let bestN = 0;
    for (const [k, n] of freq.entries()) {
      if (n > bestN) { best = k; bestN = n; }
    }
    return best;
  }, []);

  const abrirHub = useCallback(async (car: Carregamento) => {
    if (!sigla) return;
    if (loadingHub) return;
    if (car.capacidade_ton === null || car.capacidade_m3 === null) {
      toast.error('Defina a capacidade do veículo para completar via Hub.');
      return;
    }

    const destino = getDestinoCarregamento(car);
    if (!destino) {
      toast.error('Não foi possível identificar o destino do carregamento.');
      return;
    }

    setHubModalCarregamento(car);
    setHubModalDestino(destino);

    const paradasDoCarregamento = (car.paradas || '').split(',').map(p => p.trim().toUpperCase()).filter(Boolean);
    setHubModalUnidadesStr(paradasDoCarregamento.join(', '));
    setHubModalAberto(true);

    setHubCarregamentoPlaca(car.placa_provisoria);
    setHubEtapa('sugestao');
    setLoadingHub(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_hub_compartilhado.php`,
        { method: 'POST', body: JSON.stringify({ sigla, destino, modo: 'sugestao' }) },
        true
      );
      if (res.success) {
        const sugeridas = Array.isArray(res.unidades_sugeridas) ? res.unidades_sugeridas : [];
        if (sugeridas.length > 0 && paradasDoCarregamento.length === 0) {
          setHubModalUnidadesStr(sugeridas.join(', '));
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao buscar sugestão de unidades.');
    } finally {
      setLoadingHub(false);
      setHubEtapa(null);
    }
  }, [sigla, loadingHub, getDestinoCarregamento]);

  const confirmarHub = useCallback(async () => {
    if (!sigla) return;
    const car = hubModalCarregamento;
    const destino = hubModalDestino.trim().toUpperCase();
    if (!car) return;
    if (!destino) { toast.error('Destino do carregamento não definido.'); return; }
    if (car.capacidade_ton === null || car.capacidade_m3 === null) { toast.error('Defina a capacidade do veículo.'); return; }
    if (loadingHub) return;

    const unidades = hubModalUnidadesStr
      .split(',')
      .map(u => u.trim().toUpperCase())
      .filter(Boolean)
      .filter(u => /^[A-Z0-9]{2,5}$/.test(u));
    const ordemDestinos = [destino, ...unidades];
    const idxDestino = new Map<string, number>();
    ordemDestinos.forEach((d, i) => { if (d) idxDestino.set(d, i); });
    const destinosPermitidos = new Set<string>(ordemDestinos);

    const parsePrevEntTs = (s: string): number => {
      const m = s?.match(/^(\d{2})\/(\d{2})$/);
      if (!m) return Number.POSITIVE_INFINITY;
      const dia = parseInt(m[1], 10);
      const mes = parseInt(m[2], 10);
      if (dia <= 0 || mes <= 0 || mes > 12) return Number.POSITIVE_INFINITY;
      const hoje = new Date();
      const anoBase = hoje.getFullYear();
      const cand = new Date(anoBase, mes - 1, dia);
      const diff = cand.getTime() - new Date(anoBase, hoje.getMonth(), hoje.getDate()).getTime();
      if (diff < -180 * 86400 * 1000) {
        return new Date(anoBase + 1, mes - 1, dia).getTime();
      }
      return cand.getTime();
    };

    const ctesNoCarregamento = new Set<number>(
      car.ctes.flatMap(c => {
        const ids: number[] = [];
        if (c.seq_cte > 0) ids.push(c.seq_cte);
        if ((c.nroCte ?? 0) > 0) ids.push(c.nroCte as number);
        return ids;
      })
    );

    const ctesDetalhados = car.ctes.map(c => {
      // Busca no todosCtes: primeiro por seqCte (PK do banco), depois por nroCte
      const detSSW = todosCtes.find(e =>
        (c.seq_cte > 0 && e.seqCte === c.seq_cte) ||
        (c.seq_cte > 0 && e.nroCte === c.seq_cte) ||
        ((c.nroCte ?? 0) > 0 && e.nroCte === c.nroCte)
      );
      // Fallback: usa dados que já vieram do banco via get_carregamentos.php
      const det = detSSW ?? {
        ctrc: c.ctrc || `#${c.seq_cte}`,
        nroCte: c.nroCte ?? 0,
        destinatario: c.destinatario ?? '',
        cidade: c.cidade ?? '',
        peso: c.peso ?? '',
        cubagem: c.cubagem ?? '',
      };
      return { ...c, det, key: c.seq_cte };
    });

    const pesoAtualKg = ctesDetalhados.reduce((s, c) => s + parsePeso(c.det?.peso ?? ''), 0);
    const cubAtualM3 = ctesDetalhados.reduce((s, c) => s + parseCubagem(c.det?.cubagem ?? ''), 0);

    const capKg = car.capacidade_ton * 1000;
    const capM3 = car.capacidade_m3;
    let restoKg = capKg - pesoAtualKg;
    let restoM3 = capM3 - cubAtualM3;
    if (restoKg <= 0 || restoM3 <= 0) {
      toast.info('Este carregamento já está no limite de capacidade.');
      return;
    }

    setHubCarregamentoPlaca(car.placa_provisoria);
    setHubEtapa('confirmar');
    setLoadingHub(true);
    setDadosHub(null);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_hub_compartilhado.php`,
        { method: 'POST', body: JSON.stringify({ sigla, destino, unidades }) },
        true
      );

      if (!res.success) {
        toast.error(res.message || 'Erro ao carregar hub');
        return;
      }

      if (!res.unidades || res.unidades.length === 0) {
        toast.info('Nenhuma unidade retornada pelo Hub.');
        return;
      }

      setDadosHub({ unidades: res.unidades, dados: res.dados });

      const hubs = Object.values(res.dados as Record<string, { ctes: Cte[]; erro: string | null }>).flatMap(u => u.ctes ?? []);
      const candidatos = hubs
        .filter(c => destinosPermitidos.has(c.unidadeDest))
        .filter(c => !shouldIgnoreDestinoRVE(c.unidadeDest))
        .filter(c => !ctesNoCarregamento.has(c.nroCte))
        .filter(c => !ctesJaCarregados.has(c.nroCte));

      if (candidatos.length === 0) {
        toast.info('Nenhum CT-e elegível no Hub para completar este carregamento.');
        return;
      }

      candidatos.sort((a, b) => {
        const pa = idxDestino.has(a.unidadeDest) ? (idxDestino.get(a.unidadeDest) as number) : 999;
        const pb = idxDestino.has(b.unidadeDest) ? (idxDestino.get(b.unidadeDest) as number) : 999;
        if (pa !== pb) return pa - pb;
        const da = parsePrevEntTs(a.prevEnt);
        const db = parsePrevEntTs(b.prevEnt);
        if (da !== db) return da - db;
        return (a.nroCte ?? 0) - (b.nroCte ?? 0);
      });

      const selecionarCtes: Cte[] = [];
      for (const c of candidatos) {
        const p = parsePeso(c.peso);
        const v = parseCubagem(c.cubagem);
        if (p <= 0 && v <= 0) continue;
        if (p > restoKg || v > restoM3) continue;
        selecionarCtes.push(c);
        restoKg -= p;
        restoM3 -= v;
        if (restoKg <= 0 || restoM3 <= 0) break;
      }

      if (selecionarCtes.length === 0) {
        toast.info('Nenhum CT-e do Hub cabe na capacidade restante do veículo.');
        return;
      }

      const ctesPayloadHub = selecionarCtes.map(c => ({
        seqCte: c.seqCte ?? 0,
        nroCte: c.nroCte,
        serCte: c.serCte,
        emissao: c.emissao,
        prevEnt: c.prevEnt,
        remetente: c.remetente,
        destinatario: c.destinatario,
        pagador: c.pagador,
        cidade: `${c.cidade}/${c.uf}`,
        vlrNf: c.vlrNf,
        frete: c.frete,
        peso: c.peso,
        cubagem: c.cubagem,
        qtdeVol: c.qtdeVol,
        unidadeDest: c.unidadeDest,
        unidadeCarregamento: c.unidadeCarregamento ?? (c as any).unidadeCarregamento ?? (c as any).unidade_carregamento ?? (c as any).unidadeRelatorio ?? (c as any).unidadeOrigem ?? (c as any).sigla_emit ?? (c as any).siglaEmit ?? '',
      }));

      const resAdd = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'adicionar_ctes', placa: car.placa_provisoria, ctes: ctesPayloadHub }) },
        true
      );

      if (!resAdd.success) {
        toast.error(resAdd.message || 'Erro ao adicionar CT-es do Hub');
        return;
      }

      toast.success(`Hub: ${resAdd.adicionados ?? selecionarCtes.length} CT-e(s) adicionados ao carregamento ${car.placa_provisoria}.`);
      setHubModalAberto(false);
      setHubModalCarregamento(null);
      setHubModalDestino('');
      setHubModalUnidadesStr('');
      await carregarCarregamentos();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao completar carregamento via Hub');
    } finally {
      setLoadingHub(false);
      setHubEtapa(null);
    }
  }, [sigla, hubModalCarregamento, hubModalDestino, hubModalUnidadesStr, loadingHub, todosCtes, ctesJaCarregados, carregarCarregamentos, dominioUsuario, unidadeAtual]);

  const toggleTodos = useCallback((ctes: Cte[], selecionar: boolean) => {
    setCtesSelecionados(prev => {
      const next = new Map(prev);
      ctes.forEach(c => {
        const id = cteId(c);
        if (selecionar) next.set(id, c);
        else next.delete(id);
      });
      return next;
    });
  }, []);

  const handleAtualizarTransferencia = useCallback(async () => {
    if (!sigla) return;
    await importarCarregamentosSSWObrigatorio();
    await carregar();
  }, [sigla, importarCarregamentosSSWObrigatorio, carregar]);

  useEffect(() => {
    if (isMTZ) {
      toast.error('Acesso não permitido para a unidade MTZ. Faça login em uma unidade específica.');
      return;
    }
    if (!sigla) return;
    let ativo = true;
    void (async () => {
      await importarCarregamentosSSWObrigatorio();
      if (!ativo) return;
      await carregar();
      await carregarEntrega();
    })();
    return () => { ativo = false; };
  }, [sigla, isMTZ, carregar, carregarEntrega, importarCarregamentosSSWObrigatorio]);

  useEffect(() => {
    if (!sigla) return;
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          void importarCarregamentosSSWObrigatorio().finally(() => { void carregar(); });
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [sigla, carregar, importarCarregamentosSSWObrigatorio]);



  const hasFiltrosAtivos =
    (filters.unidadeDestino?.length ?? 0) > 0 ||
    !!filters.periodoEmissaoInicio ||
    !!filters.periodoEmissaoFim ||
    !!filters.periodoPrevisaoInicio ||
    !!filters.periodoPrevisaoFim;

  const parseDataISO = (v: string): Date | null => {
    const s = (v ?? '').trim();
    if (!s) return null;
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const parseDataBR = (v: string): Date | null => {
    const s = (v ?? '').trim();
    if (!s || s === '—') return null;
    const m = s.match(/^(\d{2})\/(\d{2})(?:\/(\d{2}|\d{4}))?$/);
    if (!m) return null;
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    const anoRaw = m[3];
    const ano = !anoRaw
      ? new Date().getFullYear()
      : (anoRaw.length === 2 ? 2000 + parseInt(anoRaw, 10) : parseInt(anoRaw, 10));
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    const d = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const parseDiaMesBR = (v: string, ano: number): Date | null => {
    const s = (v ?? '').trim();
    if (!s || s === '—') return null;
    const m = s.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return null;
    const dia = parseInt(m[1], 10);
    const mes = parseInt(m[2], 10);
    if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
    const d = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const inRange = (d: Date, start: Date | null, end: Date | null): boolean => {
    const t = d.getTime();
    if (start && t < start.getTime()) return false;
    if (end && t > end.getTime()) return false;
    return true;
  };

  const matchesRangeBR = (v: string, start: Date | null, end: Date | null): boolean => {
    if (!start && !end) return true;
    const s = (v ?? '').trim();
    if (!s || s === '—') return false;
    const full = parseDataBR(s);
    if (full) return inRange(full, start, end);
    const hasOnlyDayMonth = /^\d{2}\/\d{2}$/.test(s);
    if (!hasOnlyDayMonth) return false;
    const anoStart = start ? start.getFullYear() : new Date().getFullYear();
    const anoEnd = end ? end.getFullYear() : anoStart;
    const cand1 = parseDiaMesBR(s, anoStart);
    if (cand1 && inRange(cand1, start, end)) return true;
    if (anoEnd !== anoStart) {
      const cand2 = parseDiaMesBR(s, anoEnd);
      if (cand2 && inRange(cand2, start, end)) return true;
    }
    return false;
  };

  const emissaoInicio = parseDataISO(filters.periodoEmissaoInicio);
  const emissaoFim = parseDataISO(filters.periodoEmissaoFim);
  const previsaoInicio = parseDataISO(filters.periodoPrevisaoInicio);
  const previsaoFim = parseDataISO(filters.periodoPrevisaoFim);

  const ctesTransferFiltrados = React.useMemo(() => {
    const list: Cte[] = [];
    if (dados?.ctes) list.push(...dados.ctes);
    if (dadosHub) {
      for (const unidadeData of Object.values(dadosHub.dados)) {
        if (unidadeData?.ctes?.length) list.push(...unidadeData.ctes);
      }
    }
    return list.filter((cte) => {
      if (shouldIgnoreDestinoRVE(cte.unidadeDest)) return false;
      if (filters.unidadeDestino?.length) {
        if (!filters.unidadeDestino.includes((cte.unidadeDest ?? '').toUpperCase())) return false;
      }
      if (emissaoInicio || emissaoFim) {
        const d = parseDataBR(cte.emissao);
        if (!d) return false;
        if (!inRange(d, emissaoInicio, emissaoFim)) return false;
      }
      if (previsaoInicio || previsaoFim) {
        if (!matchesRangeBR(cte.prevEnt, previsaoInicio, previsaoFim)) return false;
      }
      return true;
    });
  }, [dados, dadosHub, filters.unidadeDestino, emissaoInicio, emissaoFim, previsaoInicio, previsaoFim, dominioUsuario, unidadeAtual]);

  useEffect(() => {
    let ativo = true;
    setLoadingLinhasHojeStatus(true);
    const t = window.setTimeout(() => {
      if (!ativo) return;
      const MIN_TON = 27;
      const MIN_M3 = 67;

      const hasDiretaPorDestino = new Set<string>();
      for (const l of linhasCarregamHoje) {
        const unidades = (l.unidades ?? '').trim();
        const dest = (l.sigla_dest ?? '').trim().toUpperCase();
        if (!dest) continue;
        if (!unidades) hasDiretaPorDestino.add(dest);
      }

      const totalsPorDestino: Record<string, { pesoKg: number; cubagem: number; frete: number }> = {};
      for (const cte of ctesTransferFiltrados) {
        if (cte.emTransito) continue;
        const dest = (cte.unidadeDest ?? '').trim().toUpperCase();
        if (!dest) continue;
        if (!totalsPorDestino[dest]) totalsPorDestino[dest] = { pesoKg: 0, cubagem: 0, frete: 0 };
        totalsPorDestino[dest].pesoKg += parsePeso(cte.peso);
        totalsPorDestino[dest].cubagem += parseCubagem(cte.cubagem);
        totalsPorDestino[dest].frete += parseMoeda(cte.frete);
      }

      const diretaLotaPorDestino = new Set<string>();
      for (const dest of hasDiretaPorDestino) {
        const t = totalsPorDestino[dest] ?? { pesoKg: 0, cubagem: 0, frete: 0 };
        const ton = t.pesoKg / 1000;
        if (ton >= MIN_TON || t.cubagem >= MIN_M3) diretaLotaPorDestino.add(dest);
      }

      const status: Record<number, LinhaHojeStatus> = {};
      for (const l of linhasCarregamHoje) {
        const nro = l.nro_linha ?? 0;
        const dest = (l.sigla_dest ?? '').trim().toUpperCase();
        const unidades = (l.unidades ?? '').trim();
        const totals = (dest && totalsPorDestino[dest]) ? totalsPorDestino[dest] : { pesoKg: 0, cubagem: 0, frete: 0 };
        const bloqueada = !!unidades && diretaLotaPorDestino.has(dest);
        status[nro] = {
          podeCarregar: !bloqueada,
          motivoBloqueio: bloqueada ? 'Linha direta já atinge a capacidade mínima (67m³ / 27t) para o destino final.' : null,
          freteTotalDestino: totals.frete,
          pesoKgDestino: totals.pesoKg,
          cubagemDestino: totals.cubagem,
        };
      }

      setLinhasHojeStatus(status);
      setLoadingLinhasHojeStatus(false);
    }, 0);

    return () => {
      ativo = false;
      window.clearTimeout(t);
    };
  }, [ctesTransferFiltrados, linhasCarregamHoje]);

  const coletasTransferFiltradas = React.useMemo(() => {
    const list = dados?.coletas ? [...dados.coletas] : [];
    if (!filters.unidadeDestino?.length) return list;
    const allowed = new Set(filters.unidadeDestino.map((u) => u.toUpperCase()));
    return list.filter((c) => allowed.has((c.unidadeDest ?? '').toUpperCase()));
  }, [dados, filters.unidadeDestino]);

  const ctesEntregaFiltrados = React.useMemo(() => {
    const list = dadosEntrega?.ctes ? [...dadosEntrega.ctes] : [];
    return list.filter((cte) => {
      if (shouldIgnoreDestinoRVE(cte.unidadeDest)) return false;
      if (!previsaoInicio && !previsaoFim) return true;
      return matchesRangeBR(cte.prevEnt, previsaoInicio, previsaoFim);
    });
  }, [dadosEntrega, previsaoInicio, previsaoFim, dominioUsuario, unidadeAtual]);

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
    const addCte = (cte: Cte) => {
      const key = cte.unidadeDest;
      if (!map[key]) {
        map[key] = { sigla: key, nome: cte.nomeDest, armazem: [], transito: [], coletas: [], totalCtes: 0, totalVol: 0, totalPeso: 0, totalCubagem: 0, totalFrete: 0 };
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
      map[key].totalFrete   += parseMoeda(cte.frete);
    };
    for (const cte of ctesTransferFiltrados) addCte(cte);
    for (const coleta of coletasTransferFiltradas.filter(c => !c.paraEntrega)) {
      const key = coleta.unidadeDest || 'SEM DESTINO';
      if (!map[key]) {
        const nomeGrupo = key === 'SEM DESTINO' ? (coleta.cidadeDest || key) : key;
        map[key] = { sigla: key, nome: nomeGrupo, armazem: [], transito: [], coletas: [], totalCtes: 0, totalVol: 0, totalPeso: 0, totalCubagem: 0, totalFrete: 0 };
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
        case 'totalFrete':   return mult * (a.totalFrete - b.totalFrete);
        case 'totalPeso':    return mult * (a.totalPeso - b.totalPeso);
        case 'totalCubagem': return mult * (a.totalCubagem - b.totalCubagem);
        case 'piorSaida':    return mult * ((ORDEM_INDICADOR[getPiorIndicador([...a.armazem, ...a.transito], 'indicadorSaida') ?? ''] ?? 0) - (ORDEM_INDICADOR[getPiorIndicador([...b.armazem, ...b.transito], 'indicadorSaida') ?? ''] ?? 0));
        case 'piorTransito': return mult * ((ORDEM_INDICADOR[getPiorIndicador(a.transito, 'atrasoTransf') ?? ''] ?? 0) - (ORDEM_INDICADOR[getPiorIndicador(b.transito, 'atrasoTransf') ?? ''] ?? 0));
        default:             return mult * (b.totalCtes - a.totalCtes);
      }
    });
  }, [dados, ctesTransferFiltrados, coletasTransferFiltradas, ordemCol, ordemDir]);

  const totalArmazem  = ctesTransferFiltrados.filter(c => !c.emTransito).length ?? 0;
  const totalTransito = ctesTransferFiltrados.filter(c => c.emTransito).length ?? 0;
  const totalColetas  = coletasTransferFiltradas.length ?? 0;
  const totalVol      = grupos.reduce((s, g) => s + g.totalVol, 0);
  const totalPeso     = grupos.reduce((s, g) => s + g.totalPeso, 0);
  const totalCubagem  = grupos.reduce((s, g) => s + g.totalCubagem, 0);
  const coletasAtrasadas = coletasTransferFiltradas.filter(c => c.statusColeta === 'atrasada' || c.statusColeta === 'coletada_atrasada').length ?? 0;
  const ctesTransitoAlerta = ctesTransferFiltrados.filter(c => c.emTransito && (c.atrasoTransf === 'vermelho' || c.atrasoTransf === 'laranja')).length ?? 0;

  const gruposSetor: GrupoSetor[] = React.useMemo(() => {
    if (!dadosEntrega) return [];
    const map: Record<string, GrupoSetor> = {};
    for (const cte of ctesEntregaFiltrados) {
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
  }, [dadosEntrega, ctesEntregaFiltrados]);

  const totalEntregaArmazem  = ctesEntregaFiltrados.filter(c => !c.emTransito).length ?? 0;
  const totalEntregaTransito = ctesEntregaFiltrados.filter(c => c.emTransito).length ?? 0;
  const totalEntregaVol      = gruposSetor.reduce((s, g) => s + g.totalVol, 0);
  const totalEntregaPeso     = gruposSetor.reduce((s, g) => s + g.totalPeso, 0);
  const totalEntregaCubagem  = gruposSetor.reduce((s, g) => s + g.totalCubagem, 0);
  const entregaAtrasadosTransito = ctesEntregaFiltrados.filter(c => c.emTransito && c.diasAtraso > 0).length ?? 0;

  const totalGeralArmazem  = totalArmazem + totalEntregaArmazem;
  const totalGeralTransito = totalTransito + totalEntregaTransito;
  const totalGeralVol      = totalVol + totalEntregaVol;
  const totalGeralPeso     = totalPeso + totalEntregaPeso;
  const totalGeralCubagem  = totalCubagem + totalEntregaCubagem;

  const ctesTransferTodos = React.useMemo(() => {
    return ctesTransferFiltrados;
  }, [ctesTransferFiltrados]);

  const totalGeralFrete =
    ctesTransferTodos.reduce((s, c) => s + parseMoeda(c.frete), 0) +
    (ctesEntregaFiltrados.reduce((s, c) => s + parseMoeda(c.frete), 0) ?? 0);

  const totalGeralMercadoria =
    ctesTransferTodos.reduce((s, c) => s + parseMoeda(c.vlrNf), 0) +
    (ctesEntregaFiltrados.reduce((s, c) => s + parseMoeda(c.vlrMerc), 0) ?? 0) +
    (coletasTransferFiltradas.reduce((s, c) => s + parseMoeda(c.valMerc), 0) ?? 0);

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
          {(loading || loadingEntrega) && !isMTZ && (
            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span>Transf.</span>
              <span className="font-mono">{formatBytes(transferLoaded)}{transferTotal ? `/${formatBytes(transferTotal)}` : ''}</span>
              <span>Ent.</span>
              <span className="font-mono">{formatBytes(entregaLoaded)}{entregaTotal ? `/${formatBytes(entregaTotal)}` : ''}</span>
            </div>
          )}
          {!isMTZ && (
            <>
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
                <DialogContent className="sm:max-w-[700px] bg-white dark:bg-slate-900 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros</DialogTitle>
                    <DialogDescription className="text-slate-600 dark:text-slate-400">
                      Os filtros são aplicados após carregar os dados do SSW (não alteram a importação).
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
                    <div className="space-y-6 py-4">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="text-slate-900 dark:text-slate-100">Período de Emissão do CT-e</Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Aplica-se apenas aos disponíveis para transferência</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                            <Input
                              type="date"
                              value={tempFilters.periodoEmissaoInicio}
                              onChange={(e) => setTempFilters({ ...tempFilters, periodoEmissaoInicio: e.target.value })}
                              className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                            <Input
                              type="date"
                              value={tempFilters.periodoEmissaoFim}
                              onChange={(e) => setTempFilters({ ...tempFilters, periodoEmissaoFim: e.target.value })}
                              className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="text-slate-900 dark:text-slate-100">Período de Previsão de Entrega</Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Aplica-se aos disponíveis para transferência e para entrega</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                            <Input
                              type="date"
                              value={tempFilters.periodoPrevisaoInicio}
                              onChange={(e) => setTempFilters({ ...tempFilters, periodoPrevisaoInicio: e.target.value })}
                              className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                            <Input
                              type="date"
                              value={tempFilters.periodoPrevisaoFim}
                              onChange={(e) => setTempFilters({ ...tempFilters, periodoPrevisaoFim: e.target.value })}
                              className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Aplica-se apenas aos disponíveis para transferência</p>
                        <UnidadesMultiSelect
                          value={tempFilters.unidadeDestino}
                          onChange={(value) => setTempFilters({ ...tempFilters, unidadeDestino: value })}
                          domain={user?.domain}
                          label="Unidade(s) Destino"
                          emptyHint={<><strong>Nenhuma unidade selecionada</strong> = sem filtro (todas as unidades)</>}
                        />
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
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Aplicar Filtros
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          )}
          {!isMTZ && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { void handleAtualizarTransferencia(); }}
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
      {isMTZ || unidadePermiteCarregamento === false ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
          <Building2 className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium">{isMTZ ? 'Acesso não disponível para a unidade MTZ' : 'Unidade não configurada para efetuar carregamentos'}</p>
          <p className="text-sm mt-1">{isMTZ ? 'Faça login em uma unidade específica para visualizar este painel.' : 'Verifique o CADASTRO DE UNIDADES.'}</p>
        </div>
      ) : loading && !dados ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
          <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
          <p className="text-base">Aguarde...</p>
          <p className="text-sm mt-1">Isso pode levar alguns segundos</p>
          <div className="mt-4 w-full max-w-md space-y-1 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center justify-between">
              <span>Transferência</span>
              <span className="font-mono">
                {formatBytes(transferLoaded)}{transferTotal ? ` / ${formatBytes(transferTotal)}` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Entrega</span>
              <span className="font-mono">
                {formatBytes(entregaLoaded)}{entregaTotal ? ` / ${formatBytes(entregaTotal)}` : ''}
              </span>
            </div>
          </div>
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
              if (entregaAtrasadosTransito > 0) parts.push(`${entregaAtrasadosTransito} c/ atraso entrega`);
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
                bgColor: (ctesTransitoAlerta > 0 || entregaAtrasadosTransito > 0)
                  ? 'bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800'
                  : 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',
                textColor: (ctesTransitoAlerta > 0 || entregaAtrasadosTransito > 0) ? 'text-orange-700 dark:text-orange-300' : 'text-blue-700 dark:text-blue-300',
                emptyColor: (ctesTransitoAlerta > 0 || entregaAtrasadosTransito > 0) ? '#ffedd5' : '#dbeafe',
                emptyColorDark: (ctesTransitoAlerta > 0 || entregaAtrasadosTransito > 0) ? '#431407' : '#1e3a8a',
                cor: (ctesTransitoAlerta > 0 || entregaAtrasadosTransito > 0) ? '#f97316' : '#3b82f6',
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
              { valor: `${(totalGeralPeso / 1000).toFixed(1)}t`,  label: 'Peso Total', icon: Weight,  corBg: 'bg-amber-100 dark:bg-amber-900/40',  corTexto: 'text-amber-600 dark:text-amber-400' },
              { valor: `${totalGeralCubagem.toFixed(1)} m³`,       label: 'Cubagem',    icon: Box,     corBg: 'bg-teal-100 dark:bg-teal-900/40',   corTexto: 'text-teal-600 dark:text-teal-400' },
              { valor: totalGeralFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), label: 'Valor de Frete',      icon: Wallet,     corBg: 'bg-sky-100 dark:bg-sky-900/40',      corTexto: 'text-sky-600 dark:text-sky-400' },
              { valor: totalGeralMercadoria.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), label: 'Valor de Mercadoria', icon: DollarSign, corBg: 'bg-emerald-100 dark:bg-emerald-900/40', corTexto: 'text-emerald-600 dark:text-emerald-400' },
              { valor: totalGeralVol.toLocaleString('pt-BR'), label: 'Volumes',    icon: Package, corBg: 'bg-purple-100 dark:bg-purple-900/40', corTexto: 'text-purple-600 dark:text-purple-400' },
            ];

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
              </div>
            );
          })()}

          <Card
            role="button"
            tabIndex={0}
            onClick={() => { if (!loadingLinhasOrigem) setLinhasHojeDialogOpen(true); }}
            onKeyDown={(e) => { if (!loadingLinhasOrigem && (e.key === 'Enter' || e.key === ' ')) setLinhasHojeDialogOpen(true); }}
            className={`dark:bg-slate-900 dark:border-slate-700 transition-colors ${
              (loadingLinhasOrigem || loadingLinhasHojeStatus) ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/70'
            }`}
          >
            <CardContent className="min-h-16 px-3 py-2">
              <div className="h-full flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/40 shrink-0">
                  <AlertCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="flex-1 min-w-0 text-left text-sm text-slate-800 dark:text-slate-200 truncate">
                  <span className="font-semibold">
                    {(loadingLinhasOrigem || loadingLinhasHojeStatus) ? '...' : `${qtdLinhasHojeViaveis}/${linhasOrigem.length}`}
                  </span>
                  {' '}linha(s) com carregamento disponível para hoje
                </div>
              </div>
            </CardContent>
          </Card>

          <Dialog open={linhasHojeDialogOpen} onOpenChange={setLinhasHojeDialogOpen}>
            <DialogContent className="sm:max-w-[1100px] h-[calc(100vh-80px)] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Linhas que carregam hoje</DialogTitle>
                <DialogDescription>Linhas com origem na unidade atual e frequência ativa para o dia de hoje</DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="grid grid-cols-[60px_minmax(0,1fr)_55px_minmax(0,1fr)_60px_120px_120px_110px] gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    <button
                      type="button"
                      className="text-left hover:text-slate-800 dark:hover:text-slate-100"
                      onClick={() => {
                        if (linhasHojeSortKey === 'nro') setLinhasHojeSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setLinhasHojeSortKey('nro'); setLinhasHojeSortDir('asc'); }
                      }}
                    >
                      Nº {linhasHojeSortKey === 'nro' && (
                        linhasHojeSortDir === 'asc'
                          ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" />
                          : <ChevronDown className="w-3 h-3 inline ml-1" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="text-left hover:text-slate-800 dark:hover:text-slate-100"
                      onClick={() => {
                        if (linhasHojeSortKey === 'nome') setLinhasHojeSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setLinhasHojeSortKey('nome'); setLinhasHojeSortDir('asc'); }
                      }}
                    >
                      Nome {linhasHojeSortKey === 'nome' && (
                        linhasHojeSortDir === 'asc'
                          ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" />
                          : <ChevronDown className="w-3 h-3 inline ml-1" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="text-left hover:text-slate-800 dark:hover:text-slate-100"
                      onClick={() => {
                        if (linhasHojeSortKey === 'dest') setLinhasHojeSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setLinhasHojeSortKey('dest'); setLinhasHojeSortDir('asc'); }
                      }}
                    >
                      Dest. {linhasHojeSortKey === 'dest' && (
                        linhasHojeSortDir === 'asc'
                          ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" />
                          : <ChevronDown className="w-3 h-3 inline ml-1" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="text-left hover:text-slate-800 dark:hover:text-slate-100"
                      onClick={() => {
                        if (linhasHojeSortKey === 'inter') setLinhasHojeSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setLinhasHojeSortKey('inter'); setLinhasHojeSortDir('asc'); }
                      }}
                    >
                      Intermediárias {linhasHojeSortKey === 'inter' && (
                        linhasHojeSortDir === 'asc'
                          ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" />
                          : <ChevronDown className="w-3 h-3 inline ml-1" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="text-right hover:text-slate-800 dark:hover:text-slate-100"
                      onClick={() => {
                        if (linhasHojeSortKey === 'km') setLinhasHojeSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        else { setLinhasHojeSortKey('km'); setLinhasHojeSortDir('asc'); }
                      }}
                    >
                      Km {linhasHojeSortKey === 'km' && (
                        linhasHojeSortDir === 'asc'
                          ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" />
                          : <ChevronDown className="w-3 h-3 inline ml-1" />
                      )}
                    </button>
                    <span className="text-right">Min. frete</span>
                    <span className="text-right">Frete atual</span>
                    <span className="text-right">Ação</span>
                  </div>
                  {(loadingLinhasOrigem || loadingLinhasHojeStatus) ? (
                    <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando linhas...
                    </div>
                  ) : linhasCarregamHojeOrdenadas.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma linha está configurada para carregar hoje.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {linhasCarregamHojeOrdenadas.map((l) => {
                        const s = linhasHojeStatus[l.nro_linha];
                        const pode = s?.podeCarregar ?? true;
                        const minFrete = (l.vlr_min_frete ?? 0);
                        const freteAtual = s?.freteTotalDestino ?? 0;
                        const motivo = s?.motivoBloqueio ?? '';
                        return (
                          <div
                            key={l.nro_linha}
                            title={!pode ? motivo : undefined}
                            className={`grid grid-cols-[60px_minmax(0,1fr)_55px_minmax(0,1fr)_60px_120px_120px_110px] gap-2 px-3 py-2 text-sm items-center ${!pode ? 'opacity-50' : ''}`}
                          >
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{String(l.nro_linha ?? 0).padStart(3, '0')}</span>
                            <span className="truncate text-slate-800 dark:text-slate-200">{l.nome || '-'}</span>
                            <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{(l.sigla_dest ?? '').toUpperCase() || '-'}</span>
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate">{(l.unidades ?? '').toUpperCase() || '-'}</span>
                            <span className="text-right font-mono text-xs text-slate-600 dark:text-slate-400">{(l.km_ida ?? 0).toLocaleString('pt-BR')}</span>
                            <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-200 tabular-nums">
                              {minFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-200 tabular-nums">
                              {freteAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <div className="flex justify-end">
                              {pode ? (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white"
                                  onClick={() => handleCarregarLinhaHoje(l.nro_linha)}
                                  disabled={carregandoNroLinhaHoje !== null}
                                >
                                  {carregandoNroLinhaHoje === l.nro_linha ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                                  Carregar
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-500 dark:text-slate-400">Indisponível</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <Button variant="outline" size="sm" onClick={() => setLinhasHojeDialogOpen(false)}>Fechar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={resumoHojeDialogOpen} onOpenChange={setResumoHojeDialogOpen}>
            <DialogContent className="sm:max-w-[690px]">
              <DialogHeader>
                <DialogTitle>Resumo · Carregamento {resumoHojePlaca}</DialogTitle>
                <DialogDescription>CT-es adicionados por unidade de destino</DialogDescription>
              </DialogHeader>
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden min-w-0">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Por unidade carregadora</p>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    <span>Unid.</span>
                    <span className="text-right">CT-es</span>
                    <span className="text-right">Kg</span>
                    <span className="text-right">M³</span>
                    <span className="text-right">Frete</span>
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {resumoHojeUnidades.length === 0 ? <div className="px-3 py-3 text-xs text-slate-400 text-center">—</div> : resumoHojeUnidades.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 px-2 py-1.5 text-xs">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{r.unidade || '-'}</span>
                        <span className="text-right font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">{r.qtd}</span>
                        <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.peso_kg ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                        <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.cubagem ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                        <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.frete ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-1.5 text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-300">Total</span>
                    <span className="text-right font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">{resumoHojeUnidades.reduce((s, r) => s + r.qtd, 0)}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums">{resumoHojeUnidades.reduce((s, r) => s + (r.peso_kg ?? 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums">{resumoHojeUnidades.reduce((s, r) => s + (r.cubagem ?? 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums">{resumoHojeUnidades.reduce((s, r) => s + (r.frete ?? 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>

                <div className="flex-1 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden min-w-0">
                  <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Por unidade destino</p>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                    <span>Unid.</span>
                    <span className="text-right">CT-es</span>
                    <span className="text-right">Kg</span>
                    <span className="text-right">M³</span>
                    <span className="text-right">Frete</span>
                  </div>
                  <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {resumoHojeDestinos.length === 0 ? <div className="px-3 py-3 text-xs text-slate-400 text-center">—</div> : resumoHojeDestinos.map((r, idx) => (
                      <div key={idx} className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 px-2 py-1.5 text-xs">
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{r.unidade || '-'}</span>
                        <span className="text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{r.qtd}</span>
                        <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.peso_kg ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                        <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.cubagem ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                        <span className="text-right font-mono text-[10px] tabular-nums text-slate-600 dark:text-slate-400">{(r.frete ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_38px_54px_48px_74px] gap-1 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-2 py-1.5 text-xs font-semibold">
                    <span className="text-slate-600 dark:text-slate-300">Total</span>
                    <span className="text-right font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">{resumoHojeDestinos.reduce((s, r) => s + r.qtd, 0)}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums">{resumoHojeDestinos.reduce((s, r) => s + (r.peso_kg ?? 0), 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums">{resumoHojeDestinos.reduce((s, r) => s + (r.cubagem ?? 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                    <span className="text-right font-mono text-[10px] tabular-nums">{resumoHojeDestinos.reduce((s, r) => s + (r.frete ?? 0), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setResumoHojeDialogOpen(false)}>Fechar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <CarregamentoArea
            sigla={sigla}
            carregamentos={carregamentos}
            loadingCarregamentos={loadingCarregamentos}
            modoApontamento={modoApontamento}
            onIniciarApontamento={placa => { setModoApontamento(placa); setCtesSelecionados(new Map()); }}
            onCancelarApontamento={() => { setModoApontamento(null); setCtesSelecionados(new Map()); setDadosHub(null); setHubCarregamentoPlaca(null); }}
            onCriarCarregamento={handleCriarCarregamento}
            onExcluirCarregamento={handleExcluirCarregamento}
            onRemoverCte={handleRemoverCte}
            onCarregarSSW={handleCarregarSSW}
            onCarregarHub={abrirHub}
            loadingHub={loadingHub}
            hubCarregamentoPlaca={hubCarregamentoPlaca}
            onRecarregarCarregamentos={carregarCarregamentos}
            onImportarCarregamentos={handleImportarCarregamentos}
            importandoCarregamentos={importandoCarregamentos}
            importacaoAutomatica={importacaoAutomatica}
            onToggleImportacaoAutomatica={setImportacaoAutomatica}
            onCarregamentoAutomatico={handleCarregamentoAutomatico}
            todosCtes={todosCtes}
          />

          <Dialog open={carregInexistDialogOpen} onOpenChange={(open) => { if (!open) setCarregInexistDialogOpen(false); }}>
            <DialogContent className="sm:max-w-[780px]">
              <DialogHeader>
                <DialogTitle>Carregamentos do SSW não encontrados</DialogTitle>
                <DialogDescription>
                  A importação do SSW encontrou carregamentos que não existem mais no SSW, mas ainda estão no Presto. Deseja excluir do Presto também?
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-700 dark:text-slate-300">
                    <strong>{carregInexistLista.length}</strong> carregamento(s) listado(s)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setCarregInexistSelecionados(new Set(carregInexistLista.map((i) => String(i.origem_ssw ?? '').toUpperCase())))}
                    >
                      Selecionar todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                      onClick={() => setCarregInexistSelecionados(new Set())}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="grid grid-cols-[32px_140px_minmax(0,1fr)_90px] gap-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span />
                    <span>Origem SSW</span>
                    <span>Placa (Presto)</span>
                    <span className="text-right">CT-es</span>
                  </div>
                  <div className="max-h-[45vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {carregInexistLista.map((i, idx) => {
                      const origem = String(i.origem_ssw ?? '').toUpperCase();
                      const checked = carregInexistSelecionados.has(origem);
                      return (
                        <button
                          key={`${origem}-${idx}`}
                          className="w-full grid grid-cols-[32px_140px_minmax(0,1fr)_90px] gap-2 px-3 py-2 text-sm text-left hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                          onClick={() => {
                            setCarregInexistSelecionados(prev => {
                              const next = new Set(prev);
                              if (checked) next.delete(origem);
                              else next.add(origem);
                              return next;
                            });
                          }}
                        >
                          <span className="flex items-center justify-center">
                            {checked ? <CheckSquare className="w-4 h-4 text-amber-500" /> : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
                          </span>
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{origem || '-'}</span>
                          <span className="text-slate-600 dark:text-slate-400 truncate">{i.placa_provisoria || '-'}</span>
                          <span className="text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">{Number(i.total_ctes ?? 0).toLocaleString('pt-BR')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="outline" onClick={() => setCarregInexistDialogOpen(false)} disabled={carregInexistExcluindo}>
                    Manter no Presto
                  </Button>
                  <Button
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={excluirCarregamentosInexistentes}
                    disabled={carregInexistExcluindo || carregInexistSelecionados.size === 0}
                  >
                    {carregInexistExcluindo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Excluir selecionados
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {hubModalAberto && hubModalCarregamento && (
            <ModalHub
              placa={hubModalCarregamento.placa_provisoria}
              origem={sigla}
              destino={hubModalDestino}
              unidadesStr={hubModalUnidadesStr}
              onChangeUnidades={setHubModalUnidadesStr}
              onConfirmar={confirmarHub}
              onFechar={() => { if (!loadingHub) { setHubModalAberto(false); setHubModalCarregamento(null); setHubModalDestino(''); setHubModalUnidadesStr(''); } }}
              loadingSugestao={loadingHub && hubEtapa === 'sugestao'}
              loadingConfirmar={loadingHub && hubEtapa === 'confirmar'}
            />
          )}

          {dadosHub && modoApontamento && (
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-700">
              <Share2 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <span className="text-sm text-violet-800 dark:text-violet-300 flex-1">
                Hub ativo: exibindo CT-es de <strong>{dadosHub.unidades.join(', ')}</strong> integrados aos grupos abaixo
              </span>
              <Button size="sm" variant="outline" className="text-xs h-7 border-violet-300 text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-950/50" onClick={() => { setDadosHub(null); setHubCarregamentoPlaca(null); }}>
                <X className="w-3 h-3 mr-1" />Limpar hub
              </Button>
            </div>
          )}

          {modoApontamento && ctesSelecionados.size > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-sm text-amber-800 dark:text-amber-300 flex-1">
                <strong>{ctesSelecionados.size}</strong> CT-e{ctesSelecionados.size !== 1 ? 's' : ''} selecionado{ctesSelecionados.size !== 1 ? 's' : ''} para <strong>{modoApontamento}</strong>
              </span>
              <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-white text-xs h-8" onClick={handleConfirmarApontamento}>
                <CheckSquare className="w-3.5 h-3.5 mr-1.5" />Confirmar
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-8 border-amber-300 text-amber-700 dark:text-amber-400" onClick={() => { setModoApontamento(null); setCtesSelecionados(new Map()); setDadosHub(null); setHubCarregamentoPlaca(null); }}>
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
              <Filter className="w-4 h-4" />
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
                      const toggleOrdem = (col: OrdemCol) => {
                        if (ordemCol === col) setOrdemDir(d => d === 'desc' ? 'asc' : 'desc');
                        else { setOrdemCol(col); setOrdemDir('desc'); }
                      };
                      const ThBtn = ({ col, children, align }: { col: OrdemCol; children: React.ReactNode; align?: 'left' | 'center' | 'right' }) => {
                        const cls =
                          align === 'right' ? 'justify-end w-full text-right' :
                          align === 'center' ? 'justify-center w-full text-center' :
                          'justify-start text-left';
                        return (
                        <button
                          onClick={() => toggleOrdem(col)}
                          className={`flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors ${cls}`}
                        >
                          {children}
                          {ordemCol === col
                            ? (ordemDir === 'desc' ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronDown className="w-3 h-3 shrink-0 rotate-180" />)
                            : <span className="w-3 h-3 shrink-0 flex items-center justify-center opacity-40 text-[10px] leading-none">↕</span>}
                        </button>
                        );
                      };
                      return (
                        <>
                          <div className="grid bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 px-4 py-2"
                            style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px 78px 78px 120px 60px' }}>
                            <span />
                            <ThBtn col="sigla">Destino</ThBtn>
                            <span />
                            <ThBtn col="piorSaida" align="center">Perf. saída</ThBtn>
                            <ThBtn col="armazem" align="center">Piso</ThBtn>
                            <ThBtn col="transito" align="center">Trans.</ThBtn>
                            <ThBtn col="coletas" align="center">Coletas</ThBtn>
                            <ThBtn col="totalVol" align="center">Volumes</ThBtn>
                            <ThBtn col="totalPeso" align="center">Peso</ThBtn>
                            <ThBtn col="totalCubagem" align="center">Cubagem</ThBtn>
                            <ThBtn col="totalFrete" align="right">Frete (R$)</ThBtn>
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">CSV</span>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                              {(() => {
                                const maxPeso     = Math.max(...grupos.map(g => g.totalPeso), 1);
                                const maxCubagem  = Math.max(...grupos.map(g => g.totalCubagem), 1);
                                const ctesNoCarregamentoAtual = modoApontamento
                                  ? new Set(carregamentos.find(c => c.placa_provisoria === modoApontamento)?.ctes.map(c => c.seq_cte) ?? [])
                                  : undefined;
                                return grupos.map((g, i) => (
                                  <GrupoDestinoCard key={i} grupo={g} maxPeso={maxPeso} maxCubagem={maxCubagem} modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamentoAtual} ctesJaCarregados={ctesJaCarregados} onToggleCte={toggleCte} onToggleTodos={toggleTodos} />
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
                            ctesJaCarregados={ctesJaCarregados}
                            onToggleCte={toggleCte}
                            onToggleTodos={toggleTodos}
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
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1 font-mono">
                        {formatBytes(entregaLoaded)}{entregaTotal ? ` / ${formatBytes(entregaTotal)}` : ''}
                      </p>
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
                      style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px 78px 78px 120px 60px' }}>
                      <span /><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Destino</span><span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Perf. saída</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Piso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Trans.</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Coletas</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Volumes</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Peso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Cubagem</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Frete (R$)</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">CSV</span>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(() => {
                        const maxPeso     = Math.max(...grupos.map(g => g.totalPeso), 1);
                        const maxCubagem  = Math.max(...grupos.map(g => g.totalCubagem), 1);
                        const ctesNoCarregamentoAtual = modoApontamento
                          ? new Set(carregamentos.find(c => c.placa_provisoria === modoApontamento)?.ctes.map(c => c.seq_cte) ?? [])
                          : undefined;
                        return grupos.map((g, i) => (
                          <GrupoDestinoCard key={i} grupo={g} maxPeso={maxPeso} maxCubagem={maxCubagem} modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamentoAtual} ctesJaCarregados={ctesJaCarregados} onToggleCte={toggleCte} onToggleTodos={toggleTodos} />
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
                          <GrupoSetorCard key={i} grupo={g} maxPeso={maxPeso} maxCubagem={maxCubagem} modoApontamento={modoApontamento} ctesSelecionados={ctesSelecionados} ctesNoCarregamento={ctesNoCarregamentoAtual} ctesJaCarregados={ctesJaCarregados} onToggleCte={toggleCte} onToggleTodos={toggleTodos} />
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
