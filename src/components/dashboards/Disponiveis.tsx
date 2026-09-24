import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { usePageTitle } from '../../hooks/usePageTitle';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { ENVIRONMENT } from '../../config/environment';
import { apiFetch, apiFetchWithProgress } from '../../utils/apiUtils';
import { toast } from 'sonner';
import { UnidadesMultiSelect } from '../admin/UnidadesMultiSelect';
import { useConfirmDialog, usePromptDialog, type ConfirmDialogOptions, type PromptDialogOptions } from '../ui/alert-dialog';
import {
  Warehouse,
  Truck,
  PackageSearch,
  RefreshCw,
  ChevronUp,
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
  Loader2,
  CalendarDays,
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
  RotateCcw,
  CircleHelp,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useTooltipStyle } from './CustomTooltip';
import { FilterSelectVeiculo } from './FilterSelectVeiculo';

const DESTINOS_IGNORADOS_RVE = new Set<string>(['SAL', 'DK4', 'TNE', 'DEV']);
const AVISO_SIMULACAO_TITULO =
  'Atenção: os carregamentos criados são SIMULAÇÕES para medição e otimização da operação, e não irão para o TMS.';
const AVISO_SIMULACAO_DESC =
  'Após finalizar as simulações, clique em Iniciar. Então comece a conferência de carregamento no TMS. O carregamento será automaticamente alimentado nesta tela.';

function abrirAvisoSimulacao(confirmar: (opts: ConfirmDialogOptions) => Promise<boolean>) {
  void confirmar({
    title: 'Carregamentos em simulação',
    description: `${AVISO_SIMULACAO_TITULO}\n\n${AVISO_SIMULACAO_DESC}`,
    confirmText: 'Entendi',
    cancelText: 'Fechar',
  });
}

interface Cte {
  ctrc: string;
  serCte: string;
  nroCte: number;
  seqCte?: number;
  placaColeta?: string;
  tipo: string;
  emissao: string;
  chegadaUnid?: string;
  unidAtual?: string;
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
  nomeDest?: string;
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
  emissao: string;
  chegadaUnid?: string;
  unidAtual?: string;
  setor: string;
  setorNome?: string;
  setorCepIni?: string;
  setorCepFin?: string;
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
  nome?: string;
  cepIni?: string;
  cepFin?: string;
  armazem: CteEntrega[];
  transito: CteEntrega[];
  totalCtes: number;
  totalVol: number;
  totalPeso: number;
  totalCubagem: number;
  totalFrete: number;
  totalVlrNf: number;
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
  totalVlrNf: number;
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
  seq_carregamento?: number | null;
  placa_provisoria: string;
  origem_criacao?: 'MANUAL' | 'AUTO' | 'SSW' | null;
  modo_carregamento?: 'ENTREGA' | 'TRANSFERENCIA' | null;
  setores_entrega?: string | null;
  adiado?: boolean | null;
  total_ctes: number;
  total_frete?: number;
  total_mercadoria?: number;
  total_peso?: number;
  total_cubagem?: number;
  data_criacao: string;
  hora_criacao: string;
  login_criacao: string;
  data_finalizacao?: string | null;
  hora_finalizacao?: string | null;
  login_finalizacao?: string | null;
  nro_linha?: number | null;
  linha_nome?: string | null;
  linha_dest?: string | null;
  linha_unidades?: string | null;
  capacidade_ton: number | null;
  capacidade_m3: number | null;
  vlr_min_frete?: number | null;
  vlr_frete_carreteiro?: number | null;
  destino?: string | null;
  destinos_card?: string | null;
  paradas?: string | null;
  ctes: CteCarregamento[];
}

/** Retorna o ID canônico de um CT-e para uso em seleção/apontamento.
 *  Prefere seqCte (PK do banco) quando disponível, cai em nroCte como fallback. */
const cteId = (cte: Cte): number => (cte.seqCte && cte.seqCte > 0) ? cte.seqCte : cte.nroCte;

const cteKey = (cte: any): string => {
  const seq = Number(cte?.seqCte ?? cte?.seq_cte ?? 0) || 0;
  if (seq > 0) return `seq:${seq}`;
  const ctrc = String(cte?.ctrc ?? '').trim().toUpperCase();
  if (ctrc) return `ctrc:${ctrc}`;
  const ser = String(cte?.serCte ?? cte?.ser_cte ?? '').trim().toUpperCase();
  const nro = Number(cte?.nroCte ?? cte?.nro_cte ?? 0) || 0;
  if (ser && nro > 0) return `ser:${ser}|nro:${nro}`;
  if (nro > 0) return `nro:${nro}`;
  return '';
};

const primeiraNfNfs = (nfs: string): string => {
  const raw = String(nfs ?? '').trim();
  if (!raw) return '';
  const first = raw.split(',')[0]?.trim() ?? '';
  if (!first) return '';
  const parts = first.split('/').map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[1] : parts[0];
};

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
  const { user } = useAuth();
  const unidadeLogada = (user?.unidade_atual || user?.unidade || '').trim().toUpperCase();
  const siglaUsuario3 = (unidadeLogada || '').slice(0, 3);
  const [coletaFiltro, setColetaFiltro] = useState<'todos' | 'minha' | 'outra' | 'sem'>('todos');

  const getGrupoColeta = (cte: Cte): { tipo: 'minha' | 'outra' | 'sem'; title: string } => {
    const placaColeta = String(cte.placaColeta ?? '').trim().toUpperCase();
    if (placaColeta === 'ARMAZEM') return { tipo: 'sem', title: 'Sem coleta (cliente trouxe ao armazém)' };
    const ser = String(cte.serCte ?? '').trim().toUpperCase().slice(0, 3);
    if (ser && siglaUsuario3 && ser === siglaUsuario3) return { tipo: 'minha', title: `Coletado pela unidade ${siglaUsuario3}` };
    return { tipo: 'outra', title: 'Coletado por outra unidade' };
  };

  const contagemColeta = React.useMemo(() => {
    const acc = { minha: 0, outra: 0, sem: 0 };
    for (const c of ctes) {
      const g = getGrupoColeta(c);
      if (g.tipo === 'minha') acc.minha += 1;
      else if (g.tipo === 'sem') acc.sem += 1;
      else acc.outra += 1;
    }
    return acc;
  }, [ctes, siglaUsuario3]);

  const ctesFiltrados = React.useMemo(() => {
    if (coletaFiltro === 'todos') return ctes;
    return ctes.filter((c) => getGrupoColeta(c).tipo === coletaFiltro);
  }, [ctes, coletaFiltro, siglaUsuario3]);

  type SortCol =
    | 'ctrc'
    | 'nfiscal'
    | 'emissao'
    | 'chegadaUnid'
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
    const copy = [...ctesFiltrados];
    const getStr = (v: any) => String(v ?? '').toUpperCase().trim();
    const getNum = (cte: Cte): number => {
      switch (sortCol) {
        case 'vlrNf': return parseMoeda(cte.vlrNf);
        case 'frete': return parseMoeda(cte.frete);
        case 'peso': return parsePeso(cte.peso);
        case 'cubagem': return parseCubagem(cte.cubagem);
        case 'qtdeVol': return parseInt(String(cte.qtdeVol ?? '').replace(/\D/g, ''), 10) || 0;
        case 'emissao': return toDateVal(cte.emissao);
        case 'chegadaUnid': return toDateVal(cte.chegadaUnid ?? '');
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
        case 'chegadaUnid':
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
  }, [ctesFiltrados, sortCol, sortDir]);

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

  const selecionaveis = ctesFiltrados.filter(c => {
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
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2 overflow-x-auto">
        <Button
          type="button"
          size="sm"
          variant={coletaFiltro === 'todos' ? 'default' : 'outline'}
          className={coletaFiltro === 'todos' ? 'h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900' : 'h-8 text-xs'}
          onClick={() => setColetaFiltro('todos')}
        >
          Todos
          <Badge className="ml-2 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[10px]">{ctes.length}</Badge>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={coletaFiltro === 'minha' ? 'default' : 'outline'}
          className={coletaFiltro === 'minha' ? 'h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white' : 'h-8 text-xs'}
          onClick={() => setColetaFiltro('minha')}
        >
          <Truck className="w-3.5 h-3.5 mr-1" />
          Minha coleta
          <Badge className="ml-2 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 text-[10px]">{contagemColeta.minha}</Badge>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={coletaFiltro === 'outra' ? 'default' : 'outline'}
          className={coletaFiltro === 'outra' ? 'h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white' : 'h-8 text-xs'}
          onClick={() => setColetaFiltro('outra')}
        >
          <Share2 className="w-3.5 h-3.5 mr-1" />
          Outra unidade
          <Badge className="ml-2 bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-200 text-[10px]">{contagemColeta.outra}</Badge>
        </Button>
        <Button
          type="button"
          size="sm"
          variant={coletaFiltro === 'sem' ? 'default' : 'outline'}
          className={coletaFiltro === 'sem' ? 'h-8 text-xs bg-slate-600 hover:bg-slate-700 text-white' : 'h-8 text-xs'}
          onClick={() => setColetaFiltro('sem')}
        >
          <Warehouse className="w-3.5 h-3.5 mr-1" />
          Sem coleta
          <Badge className="ml-2 bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[10px]">{contagemColeta.sem}</Badge>
        </Button>
      </div>
      <table className="w-full text-[11px]">
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
            <th className="px-3 py-2 text-center w-[68px] font-semibold">Coleta</th>
            <th className="px-3 py-2 text-right w-[86px]"><ThBtn col="nfiscal" align="right">NF</ThBtn></th>
            <th className="px-3 py-2 text-left"><ThBtn col="emissao">Emissão</ThBtn></th>
            <th className="px-3 py-2 text-left"><ThBtn col="chegadaUnid">Chegada na Unid.</ThBtn></th>
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
                <td className="px-3 py-2 text-center">
                  {(() => {
                    const g = getGrupoColeta(cte);
                    const icon =
                      g.tipo === 'sem' ? <Warehouse className="w-4 h-4 text-slate-500 mx-auto" /> :
                      g.tipo === 'minha' ? <Truck className="w-4 h-4 text-emerald-600 mx-auto" /> :
                      <Share2 className="w-4 h-4 text-indigo-600 mx-auto" />;
                    const placa = String(cte.placaColeta ?? '').trim();
                    return (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center justify-center w-full">{icon}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[260px]">
                            <div className="text-xs">
                              <div className="font-semibold">{g.title}</div>
                              {placa !== '' && <div className="opacity-80 mt-1">Placa coleta: {placa}</div>}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap" title={cte.nfiscal || ''}>
                  {cte.nfiscal || '-'}
                </td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400">{cte.emissao}</td>
                <td className={`px-3 py-2 whitespace-nowrap ${cte.indicadorSaida ? TEXTO_INDICADOR[cte.indicadorSaida] : 'text-slate-600 dark:text-slate-400'}`}>
                  {cte.chegadaUnid || ''}
                </td>
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

  const pctEntregueNoPrazo = (() => {
    const comEntrega = [...grupo.armazem, ...grupo.transito].filter(c => c.indicadorSaida !== null);
    if (comEntrega.length === 0) return null;
    const noPrazo = comEntrega.filter(c => c.indicadorSaida === 'verde').length;
    return Math.round((noPrazo / comEntrega.length) * 100);
  })();

  const exportarDestinoCSV = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    const lista = [...grupo.armazem, ...grupo.transito];
    if (!lista.length) return;

    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmtMoeda = (n: number) => n.toFixed(2).replace('.', ',');
    const fmtNum = (n: number, dec: number) => n.toFixed(dec).replace('.', ',');
    const diasParado = (chegada: string) => {
      const s = String(chegada ?? '').trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return '';
      const dt = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), 0, 0, 0, 0);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diff = Math.floor((hoje.getTime() - dt.getTime()) / 86400000);
      return diff >= 0 && Number.isFinite(diff) ? String(diff) : '';
    };

    const header = [
      'Destino',
      'CTRC',
      'NF',
      'Situação',
      'Emissão',
      'Chegada na Unid.',
      'Parado (dias)',
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
        esc(c.chegadaUnid || ''),
        esc(diasParado(c.chegadaUnid || '')),
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

  return (
    <div className="overflow-hidden">
      <button
        className="w-full grid px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
        style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px 78px 78px 120px 120px 60px' }}
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
        <span className="flex items-center justify-end text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 pr-3">
          {grupo.totalVlrNf.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
    emissao: c.emissao || '',
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
      <table className="w-full text-[11px]">
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
            <th className="px-3 py-2 text-left font-semibold">Emissão</th>
            <th className="px-3 py-2 text-left font-semibold">Chegada na Unid.</th>
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
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.emissao || ''}</td>
                <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">{cte.chegadaUnid || ''}</td>
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

  const exportarSetorCSV = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    const lista = [...grupo.armazem, ...grupo.transito];
    if (!lista.length) return;

    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmtMoeda = (n: number) => n.toFixed(2).replace('.', ',');
    const fmtNum = (n: number, dec: number) => n.toFixed(dec).replace('.', ',');
    const diasParado = (chegada: string) => {
      const s = String(chegada ?? '').trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return '';
      const dt = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), 0, 0, 0, 0);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diff = Math.floor((hoje.getTime() - dt.getTime()) / 86400000);
      return diff >= 0 && Number.isFinite(diff) ? String(diff) : '';
    };

    const header = [
      'Setor',
      'CTRC',
      'Emissão',
      'Chegada na Unid.',
      'Parado (dias)',
      'NF',
      'Situação',
      'Pagador',
      'Destinatário',
      'CNPJ Dest.',
      'Cidade',
      'Bairro',
      'CEP',
      'Endereço',
      'Prev. Ent.',
      'Agendamento',
      'Vlr. Merc.',
      'Frete (R$)',
      'Peso (kg)',
      'Cubagem (m³)',
      'Volumes',
      'Últ. Ocorrência',
      'Data Últ. Ocorrência',
      'Prev. Chegada',
      'Manifesto',
      'Dias atraso',
    ];

    const rows = lista.map((c) => {
      const situacao = c.emTransito ? 'A CAMINHO' : 'NO ARMAZÉM';
      const ultOcor = [c.codUltOcor, c.descUltOcor].filter(Boolean).join(' - ');
      return [
        esc(grupo.setor),
        esc(c.ctrc),
        esc(c.emissao || ''),
        esc(c.chegadaUnid || ''),
        esc(diasParado(c.chegadaUnid || '')),
        esc(c.nfiscal || ''),
        esc(situacao),
        esc(c.pagador || ''),
        esc(c.destinatario || ''),
        esc(c.cnpjDest || ''),
        esc(c.cidade || ''),
        esc(c.bairro || ''),
        esc(c.cep || ''),
        esc(c.endereco || ''),
        esc(c.prevEnt || ''),
        esc(c.agendamento || ''),
        fmtMoeda(parseMoeda(c.vlrMerc)),
        fmtMoeda(parseMoeda(c.frete)),
        fmtNum(parsePeso(c.peso), 2),
        fmtNum(parseCubagem(c.cubagem), 3),
        esc(c.qtdeVol || ''),
        esc(ultOcor),
        esc(c.dataUltOcor || ''),
        esc(c.prevChegada || ''),
        esc(c.manifesto || ''),
        esc(c.diasAtraso ?? 0),
      ];
    });

    const csv = [header.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctes_entrega_${String(grupo.setor || 'setor').replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden">
      <button
        className="w-full grid px-4 py-2.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm"
        style={{ gridTemplateColumns: '28px 60px minmax(0,1fr) 70px 70px 70px 70px minmax(80px,1fr) minmax(80px,1fr) 120px 120px 60px' }}
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
        <span className="flex items-center justify-end text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 pr-3">
          {grupo.totalFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="flex items-center justify-end text-right font-mono tabular-nums text-xs text-slate-700 dark:text-slate-300 pr-3">
          {grupo.totalVlrNf.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="flex items-center justify-center pl-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-[11px]" onClick={exportarSetorCSV}>
            <FileDown className="w-3.5 h-3.5 mr-1" />CSV
          </Button>
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
  abaAtiva: 'transferencia' | 'entrega' | 'todos';
  sigla: string;
  carregamentos: Carregamento[];
  loadingCarregamentos: boolean;
  carregamentosTransferOpen: boolean;
  setCarregamentosTransferOpen: React.Dispatch<React.SetStateAction<boolean>>;
  carregamentosEntregaOpen: boolean;
  setCarregamentosEntregaOpen: React.Dispatch<React.SetStateAction<boolean>>;
  carregamentosCalendario: Carregamento[];
  loadingCarregamentosCalendario: boolean;
  linhasOrigem: LinhaCarregamento[];
  loadingLinhasOrigem: boolean;
  totalsPorUnidadeParaLinhas: Record<string, { pesoKg: number; cubagem: number; frete: number; prevMinTs?: number }>;
  gruposSetorEntrega: GrupoSetor[];
  confirmar: (opts: ConfirmDialogOptions) => Promise<boolean>;
  perguntarTexto: (opts: PromptDialogOptions) => Promise<string | null>;
  modoApontamento: string | null;
  onIniciarApontamento: (placa: string) => void;
  onCancelarApontamento: () => void;
  onCriarCarregamento: (placa: string, destino: string, paradas: string) => void;
  onCarregamentoAutomaticoEntrega: (placa: string, setores: string[]) => Promise<{ ok: boolean; message?: string; total?: number; fora?: number; cap_tipo?: string }>;
  onFinalizarCarregamento: (placa: string) => Promise<boolean>;
  onExcluirCarregamento: (carregamento: Carregamento) => Promise<boolean>;
  onRemoverCte: (placa: string, seqCte: number) => void;
  onCarregarSSW: (placa: string) => void;
  onCarregarRota: (carregamento: Carregamento) => void;
  loadingRota: boolean;
  rotaCarregamentoPlaca: string | null;
  onRecarregarCarregamentos: () => Promise<void>;
  onImportarCarregamentos: (opts?: { silent?: boolean }) => Promise<any>;
  importandoCarregamentos: boolean;
  onImportarVeiculos: () => Promise<any>;
  importandoVeiculos: boolean;
  importacaoAutomatica: boolean;
  onToggleImportacaoAutomatica: (ativo: boolean) => void;
  obrigarPlacasReais: boolean;
  onToggleObrigarPlacasReais: (ativo: boolean) => void;
  onCarregamentoAutomatico: (placa: string, unidadeDestino: string, paradas: string[], nroLinha?: number, opts?: { recarregar?: boolean; silent?: boolean; forcarMinFrete?: boolean }) => Promise<{
    ok: boolean;
    placa?: string;
    message?: string;
    resumo?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
    resumoDestinos?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
  }>;
  todosCtes: { nroCte: number; seqCte?: number; ctrc: string; destinatario: string; cidade: string; peso: string; cubagem: string }[];
  cteKeysDisponiveisTransferencia: Set<string>;
  cteKeysDisponiveisEntrega: Set<string>;
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

function ModalCriarCarregamento({
  modo,
  onConfirmar,
  onFechar,
}: {
  modo: 'transferencia' | 'entrega';
  onConfirmar: (placa: string, destino: string, paradas: string) => void;
  onFechar: () => void;
}) {
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
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {modo === 'entrega' ? 'Novo Carregamento de Entrega' : 'Novo Carregamento'}
            </h3>
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
          {modo !== 'entrega' ? (
            <>
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
            </>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Setor(es) de entrega <span className="font-normal text-slate-400">(opcional)</span></label>
              <input
                type="text"
                value={paradas}
                onChange={e => setParadas(e.target.value.toUpperCase())}
                placeholder="Ex: CENTRO, PITUBA"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Você poderá apontar documentos manualmente e até misturar com Transferência.
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3 px-6 pb-5">
          <Button variant="outline" className="flex-1" onClick={onFechar}>Cancelar</Button>
          <Button
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
            disabled={modo === 'entrega' ? !placaFinal.trim() : (!placaFinal.trim() || !destino.trim())}
            onClick={() => {
              if (!placaFinal.trim()) return;
              if (modo === 'entrega') onConfirmar(placaFinal.trim(), '', paradas.trim());
              else onConfirmar(placaFinal.trim(), destino.trim(), paradas.trim());
            }}
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

function parseUnidadesCsv(csv?: string | null): string[] {
  const s = (csv ?? '').trim();
  if (!s) return [];
  return s
    .split(/[,\s;]+/)
    .map((u) => u.trim().toUpperCase())
    .filter((u) => !!u && /^[A-Z0-9]{2,5}$/.test(u));
}

function parseDestinoFromPlaca(placa?: string | null): string | null {
  const p = (placa ?? '').trim().toUpperCase();
  const m = p.match(/^[A-Z0-9]{2,5}-([A-Z0-9]{2,5})$/);
  return m?.[1] ? m[1] : null;
}

function escolherIntermediariasLinha(
  unidadesCsv: string | null | undefined,
  destino: string | null | undefined,
  intermediariasUsadas: Set<string>,
  totalsPorUnidade: Record<string, { pesoKg: number; cubagem: number; frete: number; prevMinTs?: number }>,
  limite: number
): string[] {
  const dest = (destino ?? '').trim().toUpperCase();
  const base = parseUnidadesCsv(unidadesCsv).filter((u) => u !== dest);
  const unicas = Array.from(new Set(base));
  const filtradas = unicas.filter((u) => {
    const t = totalsPorUnidade[u] ?? { pesoKg: 0, cubagem: 0, frete: 0 };
    return (t.pesoKg ?? 0) > 0 || (t.cubagem ?? 0) > 0 || (t.frete ?? 0) > 0;
  });
  filtradas.sort((a, b) => {
    const aPrev = totalsPorUnidade[a]?.prevMinTs ?? Number.POSITIVE_INFINITY;
    const bPrev = totalsPorUnidade[b]?.prevMinTs ?? Number.POSITIVE_INFINITY;
    if (aPrev !== bPrev) return aPrev - bPrev;

    const ca = totalsPorUnidade[a]?.cubagem ?? 0;
    const cb = totalsPorUnidade[b]?.cubagem ?? 0;
    if (ca !== cb) return cb - ca;

    const pa = totalsPorUnidade[a]?.pesoKg ?? 0;
    const pb = totalsPorUnidade[b]?.pesoKg ?? 0;
    if (pa !== pb) return pb - pa;

    const fa = totalsPorUnidade[a]?.frete ?? 0;
    const fb = totalsPorUnidade[b]?.frete ?? 0;
    if (fa !== fb) return fb - fa;

    const aUsed = intermediariasUsadas.has(a) ? 1 : 0;
    const bUsed = intermediariasUsadas.has(b) ? 1 : 0;
    if (aUsed !== bUsed) return aUsed - bUsed;

    return a.localeCompare(b);
  });
  return filtradas.slice(0, Math.max(0, limite));
}

function CardCarregamento({
  carregamento,
  unidadeAtual,
  todosCtes,
  cteKeysDisponiveisTransferencia,
  cteKeysDisponiveisEntrega,
  veiculoCapacidades,
  modoApontamento,
  confirmar,
  onIniciarApontamento,
  onCancelarApontamento,
  onExcluirCarregamento,
  onRemoverCte,
  onCarregarSSW,
  onCarregarRota,
  loadingRota,
  rotaCarregamentoPlaca,
  onRecarregarCarregamentos,
  onImportarCarregamentos,
  importandoCarregamentos,
}: {
  carregamento: Carregamento;
  unidadeAtual: string;
  todosCtes: { nroCte: number; seqCte?: number; ctrc: string; destinatario: string; cidade: string; peso: string; cubagem: string }[];
  cteKeysDisponiveisTransferencia: Set<string>;
  cteKeysDisponiveisEntrega: Set<string>;
  veiculoCapacidades?: { tipo: string; capacidade_ton: number; capacidade_m3: number }[];
  modoApontamento: string | null;
  confirmar: (opts: ConfirmDialogOptions) => Promise<boolean>;
  onIniciarApontamento: (placa: string) => void;
  onCancelarApontamento: () => void;
  onExcluirCarregamento: (carregamento: Carregamento) => Promise<boolean>;
  onRemoverCte: (placa: string, seqCte: number) => void;
  onCarregarSSW: (placa: string) => void;
  onCarregarRota: (carregamento: Carregamento) => void;
  loadingRota: boolean;
  rotaCarregamentoPlaca: string | null;
  onRecarregarCarregamentos: () => Promise<void>;
  onImportarCarregamentos: (opts?: { auto_importar_veiculos?: boolean; ignorar_veiculos_faltantes?: boolean }) => Promise<any>;
  importandoCarregamentos: boolean;
}) {
  const [editarPlacaDialogOpen, setEditarPlacaDialogOpen] = useState(false);
  const [editarPlacaTipo, setEditarPlacaTipo] = useState<'real' | 'ficticia'>('real');
  const [editarPlacaReal, setEditarPlacaReal] = useState('');
  const [editarPlacaFicticia, setEditarPlacaFicticia] = useState('');
  const [editandoCapacidade, setEditandoCapacidade] = useState(false);
  const [novaCapTon, setNovaCapTon] = useState('');
  const [novaCapM3, setNovaCapM3] = useState('');
  const [novaVlrMinFrete, setNovaVlrMinFrete] = useState('');
  const [novaVlrFreteCarreteiro, setNovaVlrFreteCarreteiro] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [reativandoAdiado, setReativandoAdiado] = useState(false);
  const [iniciarDialogOpen, setIniciarDialogOpen] = useState(false);
  const [placaVerdadeira, setPlacaVerdadeira] = useState('');
  const [iniciandoSimulacao, setIniciandoSimulacao] = useState(false);
  const [cteDetalheDialogOpen, setCteDetalheDialogOpen] = useState(false);
  const [cteDetalheLista, setCteDetalheLista] = useState<any[]>([]);
  const [cteDetalheTotais, setCteDetalheTotais] = useState<any>(null);
  const [loadingCteDetalhe, setLoadingCteDetalhe] = useState(false);
  const [cteDetalheSelecionados, setCteDetalheSelecionados] = useState<Set<number>>(new Set());
  const cteDetalheListaRef = useRef<any[]>([]);
  const cteDetalheTituloRef = useRef<string>('');
  const [centralizadoraDialogOpen, setCentralizadoraDialogOpen] = useState(false);
  const [centralizadoraSigla, setCentralizadoraSigla] = useState('');
  const [centralizadoraUnidades, setCentralizadoraUnidades] = useState<string[]>([]);
  const [cteDetalheSortKey, setCteDetalheSortKey] = useState<'cte' | 'carr' | 'emissao' | 'prev' | 'dest' | 'pagador' | 'frete' | 'peso' | 'cub'>('cte');
  const [cteDetalheSortDir, setCteDetalheSortDir] = useState<'asc' | 'desc'>('asc');
  const modoCarregCteDetalhe = String((carregamento as any).modo_carregamento ?? (carregamento as any).modoCarregamento ?? '').trim().toUpperCase();
  const setoresEntregaCteDetalhe = String((carregamento as any).setores_entrega ?? (carregamento as any).setoresEntrega ?? '').trim();
  const isEntregaCteDetalhe = modoCarregCteDetalhe === 'ENTREGA' || (setoresEntregaCteDetalhe !== '' && String(carregamento.destino ?? '').trim() === '');

  const cteDetalheListaOrdenada = React.useMemo(() => {
    const parseBrDate = (v: any): number => {
      const s = String(v ?? '').trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return 0;
      const dd = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      const yy = parseInt(m[3], 10);
      const dt = new Date(yy, mm - 1, dd, 0, 0, 0, 0);
      const t = dt.getTime();
      return Number.isFinite(t) ? t : 0;
    };

    const keyOf = (c: any): any => {
      switch (cteDetalheSortKey) {
        case 'cte': return String(c?.ctrc ?? '');
        case 'carr': return String(c?.unidade_carregamento ?? '');
        case 'emissao': return parseBrDate(c?.data_emissao);
        case 'prev': return parseBrDate(c?.data_prev_ent);
        case 'dest': return isEntregaCteDetalhe ? String(c?.setor ?? '') : String(c?.sigla_dest ?? '');
        case 'pagador': return isEntregaCteDetalhe ? String(c?.destinatario ?? '') : String(c?.nome_pag ?? '');
        case 'frete': return Number(c?.vlr_frete ?? 0) || 0;
        case 'peso': return Number(c?.peso ?? 0) || 0;
        case 'cub': return Number(c?.cubagem ?? 0) || 0;
        default: return '';
      }
    };

    const withIdx = (cteDetalheLista ?? []).map((c, i) => ({ c, i }));
    withIdx.sort((a, b) => {
      const va = keyOf(a.c);
      const vb = keyOf(b.c);
      let cmp = 0;
      if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
      else cmp = String(va).localeCompare(String(vb), 'pt-BR');
      if (cmp === 0) cmp = a.i - b.i;
      return cteDetalheSortDir === 'asc' ? cmp : -cmp;
    });
    return withIdx.map(x => x.c);
  }, [cteDetalheLista, cteDetalheSortKey, cteDetalheSortDir]);

  const toggleCteDetalheSort = (key: typeof cteDetalheSortKey) => {
    if (cteDetalheSortKey === key) setCteDetalheSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setCteDetalheSortKey(key); setCteDetalheSortDir('asc'); }
  };

  const abrirIniciarSimulacao = async () => {
    const ok = await confirmar({
      title: 'Iniciar carregamento via TMS?',
      description: 'Atenção: a simulação do carregamento será limpa, para início do carregamento atráves do TMS, por bipagem ou manualmente.',
      confirmText: 'Continuar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    const seq = Number(carregamento.seq_carregamento ?? 0) || 0;
    if (seq <= 0) {
      toast.error('Não foi possível identificar o seq_carregamento deste carregamento.');
      return;
    }
    setPlacaVerdadeira('');
    setIniciarDialogOpen(true);
  };

  const confirmarIniciarSimulacao = async () => {
    if (iniciandoSimulacao) return;
    const seq = Number(carregamento.seq_carregamento ?? 0) || 0;
    const placa = placaVerdadeira.trim().toUpperCase();
    if (seq <= 0) { toast.error('seq_carregamento não informado.'); return; }
    if (!placa) { toast.error('Informe a placa verdadeira (veículo cadastrado).'); return; }
    setIniciandoSimulacao(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'iniciar_simulacao', seq_carregamento: seq, placa }) },
        true
      );
      if (res?.success) {
        toast.success(`Carregamento ${placa} iniciado no modo TMS.`);
        setIniciarDialogOpen(false);
        await onImportarCarregamentos();
      } else {
        toast.error(res?.message || 'Erro ao iniciar carregamento.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao iniciar carregamento.');
    } finally {
      setIniciandoSimulacao(false);
    }
  };

  const finalizarELevarAoSSW = async () => {
    if (finalizando) return;
    const placa = carregamento.placa_provisoria;
    const ok = await confirmar({
      title: 'Finalizar carregamento?',
      description: `Finalizar o carregamento ${placa}?`,
      confirmText: 'Finalizar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    setFinalizando(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'finalizar_carregamento', placa }) },
        true
      );
      if (res?.success) {
        toast.success(`Carregamento ${placa} finalizado.`);
        await onRecarregarCarregamentos();
      } else {
        toast.error(res?.message || 'Erro ao finalizar carregamento.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao finalizar carregamento.');
    } finally {
      setFinalizando(false);
    }
  };

  const reativarCarregamentoAdiado = async () => {
    if (reativandoAdiado) return;
    const seq = Number((carregamento as any).seq_carregamento ?? 0) || 0;
    if (seq <= 0) {
      toast.error('Não foi possível identificar o seq_carregamento deste carregamento.');
      return;
    }
    const ok = await confirmar({
      title: 'Reativar carregamento?',
      description: `Reativar o carregamento adiado ${carregamento.placa_provisoria}? Isso remove o registro adiado para que a linha volte a ficar disponível.`,
      confirmText: 'Reativar',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    try {
      setReativandoAdiado(true);
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/carregamento_automatico.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'reativar_adiado', seq_carregamento: seq }) },
        true
      );
      if (res?.success) {
        toast.success('Carregamento reativado.');
        await onRecarregarCarregamentos();
      } else {
        toast.error(res?.message || 'Erro ao reativar carregamento.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao reativar carregamento.');
    } finally {
      setReativandoAdiado(false);
    }
  };

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
        { method: 'POST', body: JSON.stringify({ placa: carregamento.placa_provisoria, seq_carregamento: carregamento.seq_carregamento ?? null }) },
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
    const ok = await confirmar({
      title: 'Excluir CT-es do carregamento?',
      description: `Excluir ${qtd} CT-e(s) selecionado(s) deste carregamento?`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
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
    const header = ['CTRC', 'NFs', 'Carr.', 'Emissão', 'Prev. Entr..', 'Dest.', 'Pagador', 'Frete (R$)', 'Peso (Kg)', 'Cub. (m³)'];
    const rows = lista.map((c: any) => [
      c.ctrc,
      `"${String(c.nfs ?? '').replace(/"/g, '""')}"`,
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

  const abrirEditarPlaca = () => {
    setEditarPlacaDialogOpen(true);
    setEditarPlacaReal('');
    setEditarPlacaFicticia(String(carregamento.placa_provisoria ?? '').toUpperCase());
    setEditarPlacaTipo('real');
  };

  const handleSalvarPlaca = async () => {
    const placaNova = (editarPlacaTipo === 'real' ? editarPlacaReal : editarPlacaFicticia).trim().toUpperCase();
    if (!placaNova) return;
    if (placaNova === String(carregamento.placa_provisoria ?? '').trim().toUpperCase()) {
      setEditarPlacaDialogOpen(false);
      return;
    }
    setSalvandoEdicao(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'atualizar_placa', placa_antiga: carregamento.placa_provisoria, placa_nova: placaNova }) },
        true
      );
      if (res.success) {
        toast.success('Placa atualizada.');
        if (ativo) onCancelarApontamento();
        setEditarPlacaDialogOpen(false);
        await onRecarregarCarregamentos();
      }
      else toast.error(res.message || 'Erro ao atualizar placa.');
    } catch (e: any) { toast.error(e.message || 'Erro ao atualizar placa.'); }
    finally { setSalvandoEdicao(false); }
  };

  const handleSalvarCapacidade = async () => {
    const capTonNum = novaCapTon !== '' ? parseFloat(novaCapTon) : null;
    const capM3Num = novaCapM3 !== '' ? parseFloat(novaCapM3) : null;
    const vlrMinNum = novaVlrMinFrete !== '' ? parseFloat(novaVlrMinFrete) : null;
    const vlrTerNum = novaVlrFreteCarreteiro !== '' ? parseFloat(novaVlrFreteCarreteiro) : null;
    const mudouTon = capTonNum !== null && carregamento.capacidade_ton !== null
      ? Math.abs(capTonNum - carregamento.capacidade_ton) > 0.0001
      : capTonNum !== carregamento.capacidade_ton;
    const mudouM3 = capM3Num !== null && carregamento.capacidade_m3 !== null
      ? Math.abs(capM3Num - carregamento.capacidade_m3) > 0.0001
      : capM3Num !== carregamento.capacidade_m3;
    const mudouMinFrete = vlrMinNum !== null && carregamento.vlr_min_frete !== null && carregamento.vlr_min_frete !== undefined
      ? Math.abs(vlrMinNum - (carregamento.vlr_min_frete as number)) > 0.0001
      : vlrMinNum !== (carregamento.vlr_min_frete ?? null);
    const mudouFreteTer = vlrTerNum !== null && carregamento.vlr_frete_carreteiro !== null && carregamento.vlr_frete_carreteiro !== undefined
      ? Math.abs(vlrTerNum - (carregamento.vlr_frete_carreteiro as number)) > 0.0001
      : vlrTerNum !== (carregamento.vlr_frete_carreteiro ?? null);

    if (mudouTon || mudouM3 || mudouMinFrete || mudouFreteTer) {
      const linhas: string[] = [];
      if (mudouMinFrete) linhas.push('- Min. Frete: será alterado também na linha (tabela [dominio]_linha).');
      if (mudouTon || mudouM3) linhas.push('- Capacidades: serão alteradas também no veículo (tabela [dominio]_veiculo).');
      if (mudouFreteTer) linhas.push('- Frete Ter.: será alterado no carregamento.');
      const ok = await confirmar({
        title: 'Confirmar alteração dos parâmetros?',
        description: linhas.join('\n'),
        confirmText: 'Confirmar',
        cancelText: 'Cancelar',
      });
      if (!ok) return;
    }

    setSalvandoEdicao(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'atualizar_capacidade', placa: carregamento.placa_provisoria, seq_carregamento: carregamento.seq_carregamento ?? null, cap_ton: capTonNum, cap_m3: capM3Num, vlr_min_frete: vlrMinNum, vlr_frete_carreteiro: vlrTerNum, destino, paradas: (paradasArray || []).join(','), nro_linha: carregamento.nro_linha ?? null }) },
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
    : (carregamento.origem_criacao === 'MANUAL'
      ? `Criado: ${formatData(carregamento.data_criacao)} ${String(carregamento.hora_criacao ?? '').slice(0, 5)}`
      : null);
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

  const unidadesComCtes = new Set<string>(
    carregamento.ctes
      .map((c) => {
        const d = (c.destino_cte ?? (c as any).unidadeDest ?? (c as any).destino ?? '').trim().toUpperCase();
        if (d) return d;
        const cidade = (c.cidade ?? '').trim().toUpperCase();
        if (cidade && /^[A-Z0-9]{2,5}$/.test(cidade)) return cidade;
        return '';
      })
      .filter(Boolean)
  );

  const unidadesReais = (() => {
    if (carregamento.ctes.length === 0) {
      const out: string[] = [];
      const seen = new Set<string>();
      for (const u of todasUnidades) {
        const x = String(u ?? '').trim().toUpperCase();
        if (!x || !/^[A-Z0-9]{2,5}$/.test(x)) continue;
        if (seen.has(x)) continue;
        seen.add(x);
        out.push(x);
      }
      const central = Boolean((carregamento as any).destino_centralizadora) ? String(destino || '').trim().toUpperCase() : '';
      if (central && /^[A-Z0-9]{2,5}$/.test(central) && !out.includes(central)) out.unshift(central);
      return out;
    }
    const destinosCard = String((carregamento as any).destinos_card ?? (carregamento as any).destinosCard ?? '').trim();
    if (destinosCard) {
      const allowed = new Set<string>();
      for (const u of todasUnidades) {
        const x = String(u ?? '').trim().toUpperCase();
        if (x && /^[A-Z0-9]{2,5}$/.test(x)) allowed.add(x);
      }
      for (const u of Array.from(unidadesComCtes)) {
        const x = String(u ?? '').trim().toUpperCase();
        if (x && /^[A-Z0-9]{2,5}$/.test(x)) allowed.add(x);
      }
      const parts = destinosCard
        .split(',')
        .map((p) => p.trim().toUpperCase())
        .filter((u) => !!u && /^[A-Z0-9]{2,5}$/.test(u));
      const out: string[] = [];
      const seen = new Set<string>();
      for (const u of parts) {
        if (allowed.size > 0 && !allowed.has(u)) continue;
        if (seen.has(u)) continue;
        seen.add(u);
        out.push(u);
      }
      const central = Boolean((carregamento as any).destino_centralizadora) ? String(destino || '').trim().toUpperCase() : '';
      if (central && /^[A-Z0-9]{2,5}$/.test(central) && !out.includes(central)) out.unshift(central);
      return out;
    }
    const out: string[] = [];
    const seen = new Set<string>();
    for (const u of todasUnidades) {
      if (!u) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      if (!unidadesComCtes.has(u)) continue;
      out.push(u);
    }
    for (const u of Array.from(unidadesComCtes)) {
      if (!u) continue;
      if (seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    const central = Boolean((carregamento as any).destino_centralizadora) ? String(destino || '').trim().toUpperCase() : '';
    if (central && /^[A-Z0-9]{2,5}$/.test(central) && !out.includes(central)) out.unshift(central);
    return out;
  })();

  const unidadesDestinoFull = unidadesReais.join(', ');

  const unidadesDestinoTexto = (() => {
    if (unidadesReais.length === 0) return null;
    const last = unidadesReais[unidadesReais.length - 1];
    const centralSigla = Boolean((carregamento as any).destino_centralizadora) ? String(destino || '').trim().toUpperCase() : '';
    const rawCentral = String((carregamento as any).unidades_compart ?? '').trim();
    const centralUnidades = Array.from(new Set(
      rawCentral
        .split(/[,\s;]+/)
        .map((p) => p.trim().toUpperCase())
        .filter((u) => !!u && /^[A-Z0-9]{2,5}$/.test(u))
    ));
    const isCentral = (u: string) => !!centralSigla && u === centralSigla && centralUnidades.length > 0;
    const renderUnidade = (u: string, opts?: { bold?: boolean }) => {
      if (isCentral(u)) {
        return (
          <button
            type="button"
            className={`font-mono ${opts?.bold ? 'font-bold' : 'font-semibold'} text-indigo-700 dark:text-indigo-300 hover:underline shrink-0`}
            onClick={(e) => {
              e.stopPropagation();
              setCentralizadoraSigla(u);
              setCentralizadoraUnidades(centralUnidades);
              setCentralizadoraDialogOpen(true);
            }}
            title="Clique para ver unidades compartilhadas"
          >
            {u}
          </button>
        );
      }
      return <span className={`font-mono ${opts?.bold ? 'font-bold' : ''}`}>{u}</span>;
    };

    if (unidadesReais.length === 1) return renderUnidade(last, { bold: true });

    if (unidadesReais.length === 2) {
      const first = unidadesReais[0];
      return (
        <span className="min-w-0 flex items-center whitespace-nowrap">
          <span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap">{renderUnidade(first)}</span>
          <span className="shrink-0">, </span>
          <span className="shrink-0">{renderUnidade(last, { bold: true })}</span>
        </span>
      );
    }

    const centralInList = !!centralSigla && unidadesReais[0] === centralSigla && isCentral(centralSigla);
    if (centralInList) {
      const middle = unidadesReais.slice(1, -1);
      return (
        <span className="min-w-0 flex items-center whitespace-nowrap">
          <span className="shrink-0">{renderUnidade(centralSigla)}</span>
          <span className="shrink-0">, </span>
          {middle.length > 0 ? (
            <>
              <span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap">{middle.join(', ')}</span>
              <span className="shrink-0">, </span>
            </>
          ) : null}
          <span className="shrink-0">{renderUnidade(last, { bold: true })}</span>
        </span>
      );
    }

    const prefix = unidadesReais.slice(0, -1).join(', ');
    return (
      <span className="min-w-0 flex items-center whitespace-nowrap">
        <span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap">{prefix}</span>
        <span className="shrink-0">, </span>
        <span className="shrink-0">{renderUnidade(last, { bold: true })}</span>
      </span>
    );
  })();

  const origemTag = (() => {
    const o = (carregamento.origem_criacao ?? null);
    if (o === 'SSW') return { label: 'SSW', className: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200' };
    if (o === 'AUTO') return { label: 'Auto', className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200' };
    if (o === 'MANUAL') return { label: 'Manual', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
    return null;
  })();

  const isAdiado = Boolean((carregamento as any).adiado);

  const isSimulado = Boolean((carregamento as any).simulado);
  const modoDeclarado = String((carregamento as any).modo_carregamento ?? '').trim().toUpperCase();
  const setoresEntrega = String((carregamento as any).setores_entrega ?? '').trim();
  const isEntregaCarreg = modoDeclarado === 'ENTREGA' || (setoresEntrega !== '' && String(carregamento.destino ?? '').trim() === '');
  const isTransferCarreg = modoDeclarado === 'TRANSFERENCIA' || (!isEntregaCarreg && !setoresEntrega);

  const setoresReais = useMemo(() => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (s: string) => {
      const x = String(s ?? '').trim().toUpperCase();
      if (!x) return;
      if (seen.has(x)) return;
      seen.add(x);
      out.push(x);
    };
    for (const c of (carregamento.ctes ?? [])) {
      const setor = String((c as any).setor ?? (c as any).setor_cte ?? '').trim();
      if (setor) add(setor);
    }
    if (out.length === 0) {
      for (const s of String(setoresEntrega ?? '').split(',')) add(s);
    }
    return out;
  }, [carregamento.ctes, setoresEntrega]);

  const setoresFull = setoresReais.join(', ');
  const setoresTexto = (() => {
    if (setoresReais.length === 0) return null;
    const last = setoresReais[setoresReais.length - 1];
    if (setoresReais.length === 1) return <span className="font-mono font-bold">{last}</span>;
    if (setoresReais.length === 2) {
      return (
        <span className="min-w-0 flex items-center whitespace-nowrap">
          <span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap font-mono">{setoresReais[0]}</span>
          <span className="shrink-0">, </span>
          <span className="shrink-0 font-mono font-bold">{last}</span>
        </span>
      );
    }
    const prefix = setoresReais.slice(0, -1).join(', ');
    return (
      <span className="min-w-0 flex items-center whitespace-nowrap">
        <span className="min-w-0 shrink overflow-hidden text-ellipsis whitespace-nowrap font-mono">{prefix}</span>
        <span className="shrink-0">, </span>
        <span className="shrink-0 font-mono font-bold">{last}</span>
      </span>
    );
  })();

  const carregamentoIniciado = !isSimulado && !isEntregaCarreg && (carregamento.origem_criacao === 'AUTO' || carregamento.origem_criacao === 'SSW');

  const tipoCounts = useMemo(() => {
    const un = (unidadeAtual ?? '').trim().toUpperCase();
    let entrega = 0;
    let transf = 0;
    for (const c of carregamento.ctes) {
      const d = (c.destino_cte ?? (c as any).unidadeDest ?? (c as any).destino ?? '').trim().toUpperCase();
      if (!d) continue;
      if (un && d === un) entrega += 1;
      else transf += 1;
    }
    return { entrega, transf };
  }, [carregamento.ctes, unidadeAtual]);

  const temEntrega = isEntregaCarreg || tipoCounts.entrega > 0;
  const temTransferencia = (!isEntregaCarreg && (isTransferCarreg || tipoCounts.transf > 0));
  const dominante = isEntregaCarreg
    ? 'ENTREGA'
    : temEntrega || temTransferencia
      ? (tipoCounts.entrega > tipoCounts.transf ? 'ENTREGA' : 'TRANSFERENCIA')
      : (carregamentoIniciado ? 'TRANSFERENCIA' : null);

  const sugestaoVeiculo = useMemo(() => {
    if (!isEntregaCarreg) return null;
    const caps = Array.isArray(veiculoCapacidades) ? veiculoCapacidades : [];
    if (caps.length === 0) return 'Ajustar capacidades';
    const pesoTon = (Number(totalPeso) || 0) / 1000;
    const cub = Number(totalCubagem) || 0;
    if (pesoTon <= 0 && cub <= 0) return null;
    const norm = caps
      .map((c) => ({
        tipo: String(c.tipo ?? '').trim(),
        ton: Number((c as any).capacidade_ton ?? (c as any).ton ?? 0) || 0,
        m3: Number((c as any).capacidade_m3 ?? (c as any).m3 ?? 0) || 0,
      }))
      .filter((c) => !!c.tipo && (c.ton > 0 || c.m3 > 0))
      .sort((a, b) => (a.ton - b.ton) || (a.m3 - b.m3) || a.tipo.localeCompare(b.tipo));
    if (norm.length === 0) return 'Ajustar capacidades';
    const ok = norm.find((c) => (c.ton <= 0 || c.ton >= pesoTon) && (c.m3 <= 0 || c.m3 >= cub));
    if (ok) return ok.tipo;
    return norm[norm.length - 1].tipo;
  }, [isEntregaCarreg, veiculoCapacidades, totalPeso, totalCubagem]);

  const capacidadeSugerida = useMemo(() => {
    if (!isEntregaCarreg) return null;
    const caps = Array.isArray(veiculoCapacidades) ? veiculoCapacidades : [];
    if (caps.length === 0) return null;
    const pesoTon = (Number(totalPeso) || 0) / 1000;
    const cub = Number(totalCubagem) || 0;
    if (pesoTon <= 0 && cub <= 0) return null;
    const norm = caps
      .map((c) => ({
        tipo: String(c.tipo ?? '').trim(),
        ton: Number((c as any).capacidade_ton ?? (c as any).ton ?? 0) || 0,
        m3: Number((c as any).capacidade_m3 ?? (c as any).m3 ?? 0) || 0,
      }))
      .filter((c) => !!c.tipo && (c.ton > 0 || c.m3 > 0))
      .sort((a, b) => (a.ton - b.ton) || (a.m3 - b.m3) || a.tipo.localeCompare(b.tipo));
    if (norm.length === 0) return null;
    const ok = norm.find((c) => (c.ton <= 0 || c.ton >= pesoTon) && (c.m3 <= 0 || c.m3 >= cub));
    if (ok) return { ton: ok.ton, m3: ok.m3 };
    const max = norm[norm.length - 1];
    return { ton: max.ton, m3: max.m3 };
  }, [isEntregaCarreg, veiculoCapacidades, totalPeso, totalCubagem]);

  const bordaBaseClass = isSimulado
    ? 'border-orange-300 dark:border-orange-800'
    : dominante === 'ENTREGA'
      ? 'border-emerald-400 dark:border-emerald-600'
      : dominante === 'TRANSFERENCIA'
        ? 'border-indigo-300 dark:border-indigo-800'
        : 'border-slate-200 dark:border-slate-700';

  const ativoRingClass = ativo
    ? (isSimulado
      ? 'ring-2 ring-orange-300 dark:ring-orange-800 shadow-lg shadow-orange-100 dark:shadow-orange-900/30'
      : dominante === 'ENTREGA'
        ? 'ring-2 ring-emerald-300 dark:ring-emerald-800 shadow-lg shadow-emerald-100 dark:shadow-emerald-900/30'
        : 'ring-2 ring-indigo-300 dark:ring-indigo-800 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30')
    : '';

  const bordaCardClass = `${bordaBaseClass} ${ativoRingClass}`;

  return (
    <div className={`rounded-xl border-2 transition-all duration-200 ${bordaCardClass} bg-white dark:bg-slate-900 overflow-hidden`}>
      <div className="px-4 pt-4 pb-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 mb-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <Badge className={`min-w-0 max-w-full h-6 px-2 text-xs font-mono inline-flex items-center gap-1 ${ativo ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                <Truck className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{carregamento.placa_provisoria}</span>
              </Badge>
              <button
                type="button"
                onClick={abrirEditarPlaca}
                disabled={salvandoEdicao}
                className="text-slate-400 hover:text-indigo-500 disabled:opacity-50 shrink-0"
                title="Editar placa"
              >
                <Pencil className="w-3 h-3" />
              </button>
              {carregamento.seq_carregamento ? (
                <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 text-[10px] h-5 px-2 font-mono shrink-0">
                  {String(carregamento.seq_carregamento).padStart(6, '0')}
                </Badge>
              ) : null}
            </div>

            <Dialog open={centralizadoraDialogOpen} onOpenChange={setCentralizadoraDialogOpen}>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Centralizadora · {centralizadoraSigla || '—'}</DialogTitle>
                  <DialogDescription>Unidades envolvidas na centralização</DialogDescription>
                </DialogHeader>
                {centralizadoraUnidades.length === 0 ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">Nenhuma unidade encontrada.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {centralizadoraUnidades.map((u) => (
                      <Badge key={u} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-mono">{u}</Badge>
                    ))}
                  </div>
                )}
                <div className="flex justify-end pt-3">
                  <Button variant="outline" size="sm" onClick={() => setCentralizadoraDialogOpen(false)}>Fechar</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 justify-end flex-wrap">
            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">
              {carregamento.total_ctes} CT-e{carregamento.total_ctes !== 1 ? 's' : ''}
            </Badge>
          </div>

          <div className="col-span-2 flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 min-w-0 flex-nowrap">
            <span className="font-semibold text-slate-600 dark:text-slate-300">{isEntregaCarreg ? 'Setor(es):' : 'Destino(s):'}</span>
            {(isEntregaCarreg ? setoresTexto : unidadesDestinoTexto)
              ? (
                <span className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span className="font-mono text-slate-600 dark:text-slate-400 min-w-0 flex-1" title={isEntregaCarreg ? setoresFull : unidadesDestinoFull}>
                    {isEntregaCarreg ? setoresTexto : unidadesDestinoTexto}
                  </span>
                </span>
              )
              : <span className="font-mono text-slate-400 dark:text-slate-500">-</span>
            }
          </div>

          <div className="col-span-2 mt-1 flex items-center gap-2 min-w-0">
            {origemTag ? (
              <Badge className={`${origemTag.className} text-[10px] h-5 px-2 w-fit shrink-0`}>{origemTag.label}</Badge>
            ) : null}
            {isAdiado ? (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 text-[10px] h-5 px-2 w-fit shrink-0">Adiado</Badge>
            ) : null}
            <p className="text-[10px] whitespace-nowrap truncate min-w-0 flex-1 text-slate-400 dark:text-slate-500">
              {infoCriacao ?? ''}
            </p>
            {isSimulado ? (
              <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold shrink-0">
                simulação
              </span>
            ) : null}
          </div>
        </div>

        {editandoCapacidade && (
          <div className="mb-3 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30 space-y-2">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Parâmetros do carregamento</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-0">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Cap. Ton (t)</label>
                <input type="number" min="0" step="0.1" className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" value={novaCapTon} onChange={e => setNovaCapTon(e.target.value)} placeholder="Ex: 15" />
              </div>
              <div className="min-w-0">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Cap. Vol (m³)</label>
                <input type="number" min="0" step="0.1" className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" value={novaCapM3} onChange={e => setNovaCapM3(e.target.value)} placeholder="Ex: 40" />
              </div>
              <div className="min-w-0">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Min. Frete (R$)</label>
                <input type="number" min="0" step="0.01" className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" value={novaVlrMinFrete} onChange={e => setNovaVlrMinFrete(e.target.value)} placeholder="Ex: 3500" />
              </div>
              <div className="min-w-0">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Frete Ter. (R$)</label>
                <input type="number" min="0" step="0.01" className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400" value={novaVlrFreteCarreteiro} onChange={e => setNovaVlrFreteCarreteiro(e.target.value)} placeholder="Ex: 1200" />
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
            <div className="flex items-center gap-1.5">
              {temTransferencia ? (
                <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200 text-[11px] h-5 px-2">
                  Transferência
                </Badge>
              ) : null}
              {temEntrega ? (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 text-[11px] h-5 px-2">
                  Entrega
                </Badge>
              ) : null}
              {sugestaoVeiculo ? (
                <Badge
                  className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[11px] h-5 px-2"
                  title="Tipo de veículo sugerido pela capacidade configurada"
                >
                  Veículo: <span className="font-mono font-semibold ml-1">{sugestaoVeiculo}</span>
                </Badge>
              ) : null}
            </div>
            <BarraCapacidade
              valor={totalPeso / 1000}
              capacidade={(isEntregaCarreg ? (capacidadeSugerida?.ton ?? null) : null) ?? carregamento.capacidade_ton!}
              corGradient="linear-gradient(90deg, #7c3aed, #8b5cf6)"
              label="Peso (ton)"
            />
            <BarraCapacidade
              valor={totalCubagem}
              capacidade={(isEntregaCarreg ? (capacidadeSugerida?.m3 ?? null) : null) ?? carregamento.capacidade_m3!}
              corGradient="linear-gradient(90deg, #0369a1, #0ea5e9)"
              label="Cubagem (m³)"
            />
            <BarraFreteSegmentada cif={freteCif} fob={freteFob} minimo={carregamento.vlr_min_frete ?? null} />
            <div className="flex-1 min-w-0">
              {(() => {
                const totalFrete = (Number.isFinite(freteCif) ? freteCif : 0) + (Number.isFinite(freteFob) ? freteFob : 0);
                const ter = Number(carregamento.vlr_frete_carreteiro ?? 0) || 0;
                const pct = totalFrete > 0 ? Math.max(0, Math.min((ter / totalFrete) * 100, 100)) : 0;
                const fmt = (v: number) => (Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                return (
                  <>
                    <div className="flex items-center justify-between mb-1 gap-2">
                      <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Frete Ter. (R$)</span>
                      <span className="text-[10px] font-bold whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {fmt(ter)}{totalFrete > 0 ? ` (${pct.toFixed(0)}%)` : ''}
                      </span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-2.5 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${pct}%`, backgroundImage: 'linear-gradient(90deg, #dc2626, #f87171)' }}
                        title={totalFrete > 0 ? `Frete Terceiro: ${fmt(ter)} (${pct.toFixed(0)}%)` : `Frete Terceiro: ${fmt(ter)}`}
                      />
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        ) : (
          <div className="flex gap-4 mb-3 text-xs text-slate-500 dark:text-slate-400">
            <span><Weight className="w-3 h-3 inline mr-1" />{(totalPeso / 1000).toFixed(3)}t</span>
            <span><Box className="w-3 h-3 inline mr-1" />{totalCubagem.toFixed(3)}m³</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          {!ativo ? (
            <Button
              size="sm"
              className={carregamentoIniciado ? 'h-8 bg-slate-300 hover:bg-slate-300 text-slate-600 text-xs' : 'h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs'}
              onClick={() => onIniciarApontamento(carregamento.placa_provisoria)}
              title="Apontar CT-es neste carregamento"
              disabled={carregamentoIniciado || isAdiado}
            >
              <CheckSquare className="w-3.5 h-3.5 mr-1" />Apont.
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-8 border-emerald-400 text-emerald-700 dark:text-emerald-400 text-xs" onClick={onCancelarApontamento} title="Cancelar apontamento">
              <X className="w-3.5 h-3.5 mr-1" />Canc.
            </Button>
          )}
          {!!(carregamento as any).simulado && !isEntregaCarreg ? (
            <Button
              size="sm"
              className="h-8 bg-emerald-500 hover:bg-emerald-600 text-white text-xs"
              onClick={abrirIniciarSimulacao}
              title="Iniciar carregamento via TMS"
              disabled={importandoCarregamentos || iniciandoSimulacao}
            >
              {iniciandoSimulacao ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Truck className="w-3.5 h-3.5 mr-1" />}Iniciar
            </Button>
          ) : (
            isAdiado ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-amber-300 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={reativarCarregamentoAdiado}
                disabled={reativandoAdiado || importandoCarregamentos}
                title="Reativar carregamento adiado"
              >
                {reativandoAdiado ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RotateCcw className="w-3.5 h-3.5 mr-1" />}Reativar
              </Button>
            ) : (
              <Button size="sm" className="h-8 bg-sky-500 hover:bg-sky-600 text-white text-xs" onClick={finalizarELevarAoSSW} title="Finalizar o carregamento" disabled={finalizando || importandoCarregamentos}>
                {finalizando ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Truck className="w-3.5 h-3.5 mr-1" />}Finalizar
              </Button>
            )
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={loadingRota || carregamento.ctes.length === 0}
            className={
              (loadingRota || carregamento.ctes.length === 0)
                ? 'h-8 text-xs border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                : `h-8 text-xs border-indigo-300 dark:border-indigo-700 ${loadingRota && rotaCarregamentoPlaca === carregamento.placa_provisoria ? 'text-indigo-400' : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30'}`
            }
            onClick={() => onCarregarRota(carregamento)}
            title={carregamento.ctes.length === 0 ? 'Carregamento sem CT-es' : 'Ver rota e pontos de entrega do carregamento'}
          >
            {loadingRota && rotaCarregamentoPlaca === carregamento.placa_provisoria
              ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
              : <MapPin className="w-3.5 h-3.5 mr-1" />
            }
            Rota
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-red-300 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={() => { void onExcluirCarregamento(carregamento); }}
            title="Excluir carregamento"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" />Excluir
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40"
            onClick={() => { setNovaCapTon(carregamento.capacidade_ton?.toString() ?? ''); setNovaCapM3(carregamento.capacidade_m3?.toString() ?? ''); setNovaVlrMinFrete(carregamento.vlr_min_frete?.toString() ?? ''); setNovaVlrFreteCarreteiro(carregamento.vlr_frete_carreteiro?.toString() ?? ''); setEditandoCapacidade(v => !v); }}
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

        </div>
      </div>
      <Dialog open={editarPlacaDialogOpen} onOpenChange={setEditarPlacaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Alterar placa</DialogTitle>
            <DialogDescription>Escolha uma placa real (cadastrada) ou informe uma placa fictícia.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={editarPlacaTipo === 'real' ? 'border-indigo-300 text-indigo-700 dark:text-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30' : undefined}
              onClick={() => setEditarPlacaTipo('real')}
            >
              Placa real
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={editarPlacaTipo === 'ficticia' ? 'border-indigo-300 text-indigo-700 dark:text-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/30' : undefined}
              onClick={() => setEditarPlacaTipo('ficticia')}
            >
              Placa fictícia
            </Button>
          </div>

          {editarPlacaTipo === 'real' ? (
            <div className="space-y-2">
              <Label>Placa cadastrada</Label>
              <FilterSelectVeiculo value={editarPlacaReal} onChange={setEditarPlacaReal} placeholder="Digite a placa para buscar no cadastro" />
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Placa fictícia</Label>
              <Input
                value={editarPlacaFicticia}
                placeholder="Ex: VIX-TESTE01"
                onChange={(e) => setEditarPlacaFicticia(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleSalvarPlaca(); }}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditarPlacaDialogOpen(false)} disabled={salvandoEdicao}>Cancelar</Button>
            <Button
              type="button"
              onClick={() => void handleSalvarPlaca()}
              disabled={salvandoEdicao || !(editarPlacaTipo === 'real' ? editarPlacaReal.trim() : editarPlacaFicticia.trim())}
            >
              {salvandoEdicao ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={iniciarDialogOpen} onOpenChange={(open) => { if (!iniciandoSimulacao) setIniciarDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Iniciar carregamento (TMS)</DialogTitle>
            <DialogDescription>Informe a placa verdadeira do veículo (cadastrada) para iniciar o carregamento via TMS.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Placa verdadeira</Label>
            <FilterSelectVeiculo value={placaVerdadeira} onChange={setPlacaVerdadeira} placeholder="Digite a placa para buscar no cadastro" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIniciarDialogOpen(false)} disabled={iniciandoSimulacao}>Cancelar</Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600 text-white" onClick={confirmarIniciarSimulacao} disabled={iniciandoSimulacao || !placaVerdadeira.trim()}>
              {iniciandoSimulacao ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Iniciar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={cteDetalheDialogOpen} onOpenChange={setCteDetalheDialogOpen}>
        <DialogContent className="w-[96vw] max-w-6xl h-[82vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
          <div className="shrink-0 pr-20 flex flex-col gap-1.5">
            <DialogHeader>
              <DialogTitle>
                CT-es · Carregamento{carregamento.seq_carregamento ? ` ${String(carregamento.seq_carregamento).padStart(6, '0')}` : ''} · {carregamento.placa_provisoria}
              </DialogTitle>
              <DialogDescription>Selecione os CT-es e clique em “Excluir selecionados” para remover do carregamento</DialogDescription>
            </DialogHeader>

            {/* Destinos do carregamento */}
            {(() => {
              const valid = (u: string) => !!u && /^[A-Z0-9]{2,5}$/.test(u);
              const fromCtes = new Set(
                (cteDetalheLista ?? [])
                  .map((c) => String((c as any).sigla_dest ?? '').trim().toUpperCase())
                  .filter(valid)
              );

              const paradasArr = (carregamento.paradas || '').split(',').map(p => p.trim().toUpperCase()).filter(valid);
              const destFinal = String(carregamento.destino ?? '').trim().toUpperCase();
              const base = [...paradasArr, destFinal].filter(valid);

              const out: string[] = [];
              const seen = new Set<string>();
              for (const u of base) {
                if (fromCtes.size > 0 && !fromCtes.has(u)) continue;
                if (seen.has(u)) continue;
                seen.add(u);
                out.push(u);
              }
              if (fromCtes.size > 0) {
                for (const u of Array.from(fromCtes)) {
                  if (seen.has(u)) continue;
                  seen.add(u);
                  out.push(u);
                }
              } else {
                for (const u of base) {
                  if (seen.has(u)) continue;
                  seen.add(u);
                  out.push(u);
                }
              }

              if (out.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5">
                  {out.map((u, i) => (
                    <span key={`${u}-${i}`} className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-mono ${i === out.length - 1 ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 font-bold' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
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
              <div className="grid grid-cols-[28px_105px_70px_45px_70px_80px_70px_minmax(320px,1fr)_90px_75px_75px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
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
                <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('cte')}>
                  CT-e{cteDetalheSortKey === 'cte' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
                <span>NFs</span>
                <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('carr')}>
                  Carr.{cteDetalheSortKey === 'carr' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
                <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('emissao')}>
                  Emissão{cteDetalheSortKey === 'emissao' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
                <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('prev')}>
                  Prev. Entr..{cteDetalheSortKey === 'prev' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
                <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('dest')}>
                  {isEntregaCteDetalhe ? 'Setor' : 'Dest.'}{cteDetalheSortKey === 'dest' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
                <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('pagador')}>
                  {isEntregaCteDetalhe ? 'Destinatário' : 'Pagador'}{cteDetalheSortKey === 'pagador' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
                <button type="button" className="text-right hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('frete')}>
                  Frete (R$){cteDetalheSortKey === 'frete' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
                <button type="button" className="text-right hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('peso')}>
                  Peso (Kg){cteDetalheSortKey === 'peso' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
                <button type="button" className="text-right hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteDetalheSort('cub')}>
                  Cub. (m³){cteDetalheSortKey === 'cub' ? (cteDetalheSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
                </button>
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
                    {cteDetalheListaOrdenada.map((cte, idx) => {
                      const id = Number((cte as any).seq_cte ?? 0);
                      const checked = id > 0 && cteDetalheSelecionados.has(id);
                      return (
                      <div
                        key={idx}
                        className="grid grid-cols-[28px_105px_70px_45px_70px_80px_70px_minmax(320px,1fr)_90px_75px_75px] gap-2 px-3 py-2 text-[13px] hover:bg-slate-50 dark:hover:bg-slate-900/50"
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
                        <span className="self-center font-mono text-xs text-slate-600 dark:text-slate-400">{primeiraNfNfs(String((cte as any).nfs ?? '')) || '-'}</span>
                        <span className="self-center font-mono text-xs text-slate-600 dark:text-slate-400">{cte.unidade_carregamento || '-'}</span>
                        <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_emissao || '-'}</span>
                        <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_prev_ent || '-'}</span>
                        {isEntregaCteDetalhe ? (
                          <span className="self-center font-mono text-xs text-slate-600 dark:text-slate-400">
                            {String((cte as any).setor ?? '').trim() || '-'}
                          </span>
                        ) : (
                          <span
                            className="self-center font-mono text-xs text-slate-600 dark:text-slate-400"
                            title={(cte as any).sigla_dest_principal && (cte as any).sigla_dest_principal !== cte.sigla_dest ? `Hub: ${(cte as any).sigla_dest_principal}` : undefined}
                          >
                            {cte.sigla_dest ?? '-'}
                          </span>
                        )}
                        <span className="self-center truncate text-slate-600 dark:text-slate-300">
                          {(isEntregaCteDetalhe ? (cte as any).destinatario : cte.nome_pag) || '-'}
                        </span>
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
              <div className="grid grid-cols-[28px_105px_70px_45px_70px_80px_70px_minmax(320px,1fr)_90px_75px_75px] gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                <span className="text-slate-500 dark:text-slate-400">{cteDetalheSelecionados.size > 0 ? `${cteDetalheSelecionados.size} selecionado(s)` : ''}</span>
                <span className="text-slate-500 dark:text-slate-400">{cteDetalheLista.length} CT-es</span>
                <span />
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
  destino_centralizadora?: boolean;
  unidades_compart?: string;
  km_ida: number | null;
  km_volta: number | null;
  vlr_min_frete?: number | null;
  multi_carr_diario?: boolean;
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
  atingiuMinFrete: boolean;
};

type ResumoMassaLinha = {
  nro_linha: number;
  placa: string;
  destino: string;
  intermediarias: string;
  status: 'criado' | 'erro';
  msg: string;
};

type SobrasCarregamento = {
  placa: string;
  destino: string;
  paradas: string[];
  nro_linha?: number;
  sobras: { qtd: number; peso_kg?: number; cubagem?: number; frete?: number };
  capacidade?: { peso_kg?: number; cubagem?: number };
  uso?: { peso_kg?: number; cubagem?: number; frete?: number };
};

function ModalCarregamentoAutomatico({ onConfirmar, onFechar, confirmar, perguntarTexto, linhasOrigem, loadingLinhasOrigem, carregamentos, siglaUnidade, totalsPorUnidadeParaLinhas }: {
  onConfirmar: (placa: string, unidadeDestino: string, paradas: string[], nroLinha?: number, opts?: { recarregar?: boolean; silent?: boolean; forcarMinFrete?: boolean }) => Promise<{
    ok: boolean;
    placa?: string;
    message?: string;
    resumo?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
    resumoDestinos?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
    destino?: string;
    paradas?: string[];
    nro_linha?: number;
    sobras?: { qtd: number; peso_kg?: number; cubagem?: number; frete?: number };
    capacidade?: { peso_kg?: number; cubagem?: number };
    uso?: { peso_kg?: number; cubagem?: number; frete?: number };
  }>;
  onFechar: () => void;
  confirmar: (opts: ConfirmDialogOptions) => Promise<boolean>;
  perguntarTexto: (opts: PromptDialogOptions) => Promise<string | null>;
  linhasOrigem: LinhaCarregamento[];
  loadingLinhasOrigem: boolean;
  carregamentos: Carregamento[];
  siglaUnidade: string;
  totalsPorUnidadeParaLinhas: Record<string, { pesoKg: number; cubagem: number; frete: number; prevMinTs?: number }>;
}) {
  const [modo, setModo] = useState<'automatico' | 'manual'>('automatico');
  const [placa, setPlaca] = useState('');
  const [unidadeDestino, setUnidadeDestino] = useState('');
  const [paradasStr, setParadasStr] = useState('');
  const [loading, setLoading] = useState(false);
  const [linhasSelecionadas, setLinhasSelecionadas] = useState<Set<number>>(new Set());
  const [buscaLinha, setBuscaLinha] = useState('');
  const [ordemLinhas, setOrdemLinhas] = useState<'destino' | 'intermediarias'>('destino');
  const [ordemDirLinhas, setOrdemDirLinhas] = useState<'asc' | 'desc'>('asc');

  const { diaCarregaKeyHoje, diaCarregaKeyOntem } = React.useMemo(() => {
    const d = new Date().getDay();
    const map = [
      'carrega_dom',
      'carrega_seg',
      'carrega_ter',
      'carrega_qua',
      'carrega_qui',
      'carrega_sex',
      'carrega_sab',
    ] as const;
    const hoje = map[d] ?? 'carrega_seg';
    const ontem = map[(d + 6) % 7] ?? 'carrega_seg';
    return { diaCarregaKeyHoje: hoje, diaCarregaKeyOntem: ontem };
  }, []);

  const linhasHoje = React.useMemo(() => {
    const filtradas = (linhasOrigem ?? []).filter((l) => {
      const carregaHoje = ((l as any)[diaCarregaKeyHoje] ?? true) as any;
      const carregaOntem = ((l as any)[diaCarregaKeyOntem] ?? true) as any;
      return !!carregaHoje || !!carregaOntem;
    });
    const seen = new Set<number>();
    return filtradas.filter((l) => {
      const n = (l.nro_linha ?? 0) as number;
      if (!Number.isFinite(n) || n <= 0) return true;
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  }, [linhasOrigem, diaCarregaKeyHoje, diaCarregaKeyOntem]);

  const intermediariasUsadas = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of (carregamentos ?? [])) {
      const d = (c.destino ?? parseDestinoFromPlaca(c.placa_provisoria) ?? '').trim().toUpperCase();
      if (d) set.add(d);
      for (const u of parseUnidadesCsv(c.paradas ?? '')) set.add(u);
    }
    return set;
  }, [carregamentos]);

  const getIntermediariasEfetivas = React.useCallback((l: LinhaCarregamento): string[] => {
    const limite = (l as any).destino_centralizadora ? 999 : 2;
    return escolherIntermediariasLinha(l.unidades, l.sigla_dest, intermediariasUsadas, totalsPorUnidadeParaLinhas, limite);
  }, [intermediariasUsadas, totalsPorUnidadeParaLinhas]);

  const statusPorLinha = React.useMemo(() => {
    const MIN_TON = 27;
    const MIN_M3 = 67;

    const placasExistentes = new Set((carregamentos ?? []).map((c) => (c.placa_provisoria ?? '').trim().toUpperCase()).filter(Boolean));
    const linhasEmCarregamento = new Set<number>(
      (carregamentos ?? [])
        .map((c: any) => (c?.nro_linha ?? c?.nroLinha ?? 0) as number)
        .filter((n: any) => Number.isFinite(n) && (n as number) > 0) as number[]
    );

    const hasDiretaPorDestino = new Set<string>();
    for (const l of linhasHoje) {
      const unidades = (l.unidades ?? '').trim();
      const dest = (l.sigla_dest ?? '').trim().toUpperCase();
      if (!dest) continue;
      if (!unidades) hasDiretaPorDestino.add(dest);
    }

    const diretaLotaPorDestino = new Set<string>();
    for (const dest of hasDiretaPorDestino) {
      const t = totalsPorUnidadeParaLinhas[dest] ?? { pesoKg: 0, cubagem: 0, frete: 0 };
      const ton = t.pesoKg / 1000;
      if (ton >= MIN_TON || t.cubagem >= MIN_M3) diretaLotaPorDestino.add(dest);
    }

    const out: Record<number, LinhaHojeStatus> = {};
    for (const l of linhasHoje) {
      const nro = l.nro_linha ?? 0;
      const dest = (l.sigla_dest ?? '').trim().toUpperCase();
      const intermediarias = getIntermediariasEfetivas(l);
      const unidadesRota = Array.from(new Set([dest, ...intermediarias].filter(Boolean)));

      const totals = unidadesRota.reduce(
        (acc, u) => {
          const t = totalsPorUnidadeParaLinhas[u] ?? { pesoKg: 0, cubagem: 0, frete: 0 };
          acc.pesoKg += t.pesoKg;
          acc.cubagem += t.cubagem;
          acc.frete += t.frete;
          return acc;
        },
        { pesoKg: 0, cubagem: 0, frete: 0 }
      );

      const minFreteRaw = (l.vlr_min_frete ?? 0);
      const minFrete = Number.isFinite(minFreteRaw as number) && (minFreteRaw as number) > 0 ? (minFreteRaw as number) : 0;
      const atingiuMinFrete = minFrete <= 0 ? true : totals.frete >= minFrete;

      const placaAuto = dest ? `${siglaUnidade}-${dest}` : '';
      const jaExistePlaca = placaAuto ? placasExistentes.has(placaAuto) : false;
      const jaExisteLinha = nro > 0 && linhasEmCarregamento.has(nro);
      const jaExiste = jaExistePlaca || jaExisteLinha;
      const bloqueadaPorDireta = intermediarias.length > 0 && diretaLotaPorDestino.has(dest);

      const motivos: string[] = [];
      if (jaExisteLinha) motivos.push(`Linha ${String(nro).padStart(3, '0')} já possui carregamento iniciado.`);
      if (jaExistePlaca) motivos.push(`Carregamento ${placaAuto} já existe.`);
      if (bloqueadaPorDireta) motivos.push('Linha direta já atinge a capacidade mínima (67m³ / 27t) para o destino final.');

      const bloqueada = jaExiste || bloqueadaPorDireta;
      out[nro] = {
        podeCarregar: !bloqueada,
        motivoBloqueio: bloqueada ? motivos.join(' ') : null,
        freteTotalDestino: totals.frete,
        pesoKgDestino: totals.pesoKg,
        cubagemDestino: totals.cubagem,
        atingiuMinFrete,
      };
    }

    return out;
  }, [carregamentos, getIntermediariasEfetivas, linhasHoje, siglaUnidade, totalsPorUnidadeParaLinhas]);

  const placasExistentes = React.useMemo(() => {
    return new Set((carregamentos ?? []).map((c) => (c.placa_provisoria ?? '').trim().toUpperCase()).filter(Boolean));
  }, [carregamentos]);

  const linhasHojeSemCriadas = React.useMemo(() => {
    const orig = (siglaUnidade ?? '').trim().toUpperCase();
    const linhasEmCarregamento = new Set<number>(
      (carregamentos ?? [])
        .map((c: any) => (c?.nro_linha ?? c?.nroLinha ?? 0) as number)
        .filter((n: any) => Number.isFinite(n) && (n as number) > 0) as number[]
    );
    return linhasHoje.filter((l) => {
      const nro = l.nro_linha ?? 0;
      if (nro > 0 && linhasEmCarregamento.has(nro)) return false;
      const dest = (l.sigla_dest ?? '').trim().toUpperCase();
      const placaAuto = dest ? `${orig}-${dest}` : '';
      if (!placaAuto) return true;
      return !placasExistentes.has(placaAuto);
    });
  }, [carregamentos, linhasHoje, placasExistentes, siglaUnidade]);

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
          if ((result.sobras?.qtd ?? 0) > 0) {
            setSobrasItens([
              {
                placa: String(result.placa).trim().toUpperCase(),
                destino: String(result.destino ?? unidadeDestino).trim().toUpperCase(),
                paradas: Array.isArray(result.paradas) ? result.paradas : paradas,
                nro_linha: result.nro_linha ?? 0,
                sobras: result.sobras ?? { qtd: 0 },
                capacidade: result.capacidade,
                uso: result.uso,
              },
            ]);
            setSobrasNext('resumo');
            setSobrasDialogOpen(true);
          } else {
            setResumoDialogOpen(true);
          }
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
  const [resumoMassaDialogOpen, setResumoMassaDialogOpen] = useState(false);
  const [resumoMassaItens, setResumoMassaItens] = useState<ResumoMassaLinha[]>([]);

  const [sobrasDialogOpen, setSobrasDialogOpen] = useState(false);
  const [sobrasItens, setSobrasItens] = useState<SobrasCarregamento[]>([]);
  const [sobrasNext, setSobrasNext] = useState<'fechar' | 'resumo' | 'resumo_massa'>('fechar');

  const [placasDialogOpen, setPlacasDialogOpen] = useState(false);
  const [placasDialogLinhas, setPlacasDialogLinhas] = useState<Array<{ nro: number; nome: string; destino: string; intermediarias: string }>>([]);
  const [placasDialogValues, setPlacasDialogValues] = useState<Record<number, string>>({});
  const [placasDialogOrdem, setPlacasDialogOrdem] = useState<number[]>([]);
  const [placasDialogMinFreteAbaixo, setPlacasDialogMinFreteAbaixo] = useState<number[]>([]);

  const iniciarPlacasDialog = (linhas: number[]) => {
    const porNro = new Map<number, LinhaCarregamento>();
    for (const l of linhasHojeSemCriadas) porNro.set(l.nro_linha ?? 0, l);
    const ordenadas = linhas.slice().sort((a, b) => a - b);
    const rows = ordenadas.map((nro) => {
      const l = porNro.get(nro);
      const interEfetivas = l ? getIntermediariasEfetivas(l) : [];
      return {
        nro,
        nome: (l?.nome ?? '').trim() || '-',
        destino: (l?.sigla_dest ?? '').trim().toUpperCase() || '-',
        intermediarias: interEfetivas.length ? interEfetivas.join(', ') : '-',
      };
    });
    const abaixoMin = ordenadas.filter((nro) => !(statusPorLinha[nro]?.atingiuMinFrete ?? true));
    setPlacasDialogOrdem(ordenadas);
    setPlacasDialogLinhas(rows);
    setPlacasDialogMinFreteAbaixo(abaixoMin);
    setPlacasDialogValues((prev) => {
      const next: Record<number, string> = { ...(prev || {}) };
      for (const nro of ordenadas) {
        if (!next[nro]) next[nro] = '';
      }
      return next;
    });
    setPlacasDialogOpen(true);
  };

  const executarAutomaticoComPlacas = async () => {
    if (loading) return;
    if (placasDialogOrdem.length === 0) return;

    const multi = placasDialogOrdem.length > 1;

    if (placasDialogMinFreteAbaixo.length > 0) {
      const msg = multi
        ? 'Atenção: um ou mais carregamentos não atingem o frete mínimo. Continuar?'
        : `Atenção: as cargas disponíveis para a linha ${String(placasDialogOrdem[0]).padStart(3, '0')} não atingem o frete mínimo! Continuar?`;
      const ok = await confirmar({
        title: 'Frete mínimo não atingido',
        description: msg,
        confirmText: 'Continuar',
        cancelText: 'Cancelar',
      });
      if (!ok) return;
    }

    try {
      setLoading(true);
      const itens: ResumoMassaLinha[] = [];
      const sobras: SobrasCarregamento[] = [];
      let lastOk: { placa?: string; resumo?: any[]; resumoDestinos?: any[] } | null = null;
      let okCount = 0;
      let failCount = 0;

      const porNro = new Map<number, LinhaCarregamento>();
      for (const l of linhasHojeSemCriadas) porNro.set(l.nro_linha ?? 0, l);

      for (let i = 0; i < placasDialogOrdem.length; i++) {
        const nro = placasDialogOrdem[i];
        const isLast = i === placasDialogOrdem.length - 1;
        const placaReal = (placasDialogValues[nro] ?? '').trim().toUpperCase();
        const forcarMinFrete = placasDialogMinFreteAbaixo.includes(nro);

        const linha = porNro.get(nro);
        const destinoLinha = (linha?.sigla_dest ?? '').trim().toUpperCase();
        const intermediarias = linha ? getIntermediariasEfetivas(linha).join(', ') : '';

        const result = await onConfirmar(placaReal, '', [], nro, { recarregar: isLast, silent: true, forcarMinFrete });
        if (result.ok) {
          okCount++;
          lastOk = result;
          if ((result.sobras?.qtd ?? 0) > 0) {
            const destinoEf = String(result.destino ?? '').trim().toUpperCase() || destinoLinha || '-';
            sobras.push({
              placa: String(result.placa ?? placaReal).trim().toUpperCase(),
              destino: destinoEf,
              paradas: Array.isArray(result.paradas) ? result.paradas : [],
              nro_linha: nro,
              sobras: result.sobras ?? { qtd: 0 },
              capacidade: result.capacidade,
              uso: result.uso,
            });
          }
        } else {
          failCount++;
        }
        itens.push({
          nro_linha: nro,
          placa: result.placa ?? placaReal,
          destino: destinoLinha || '-',
          intermediarias: intermediarias || '-',
          status: result.ok ? 'criado' : 'erro',
          msg: (result.message ?? '').trim() || (result.ok ? 'Criado' : 'Falha ao carregar'),
        });
      }

      setPlacasDialogOpen(false);

      if (multi) {
        setResumoMassaItens(itens);
        if (sobras.length > 0) {
          setSobrasItens(sobras);
          setSobrasNext('resumo_massa');
          setSobrasDialogOpen(true);
        } else {
          setResumoMassaDialogOpen(true);
        }
        if (okCount > 0) toast.success(`${okCount} carregamento(s) criado(s).`);
        if (failCount > 0) toast.error(`${failCount} linha(s) falharam ao carregar.`);
        if (okCount > 0) abrirAvisoSimulacao(confirmar);
        return;
      }

      if (okCount > 0) abrirAvisoSimulacao(confirmar);
      if (lastOk?.placa && ((lastOk.resumo?.length ?? 0) > 0 || (lastOk.resumoDestinos?.length ?? 0) > 0)) {
        setResumoPlaca(lastOk.placa);
        setResumoUnidades((lastOk.resumo as any) ?? []);
        setResumoDestinos((lastOk.resumoDestinos as any) ?? []);
        if (sobras.length > 0) {
          setSobrasItens(sobras);
          setSobrasNext('resumo');
          setSobrasDialogOpen(true);
        } else {
          setResumoDialogOpen(true);
        }
      } else {
        onFechar();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarAutomatico = async () => {
    if (loading) return;
    const selecionadas = Array.from(linhasSelecionadas.values()).filter((n) => Number.isFinite(n) && n > 0);
    if (selecionadas.length === 0) { toast.error('Selecione ao menos uma linha.'); return; }
    const invalidas = selecionadas.filter((n) => !(statusPorLinha[n]?.podeCarregar ?? false));
    if (invalidas.length > 0) { toast.error('Há linhas selecionadas indisponíveis para carregamento.'); return; }
    iniciarPlacasDialog(selecionadas);
  };

  const handleFecharResumo = () => {
    setResumoDialogOpen(false);
    onFechar();
  };

  const handleFecharSobras = () => {
    setSobrasDialogOpen(false);
    const next = sobrasNext;
    setSobrasNext('fechar');
    if (next === 'resumo') setResumoDialogOpen(true);
    else if (next === 'resumo_massa') setResumoMassaDialogOpen(true);
    else onFechar();
  };

  const criarAdicionalComPlaca = async (
    item: SobrasCarregamento,
    placaReal: string,
    currentItems: SobrasCarregamento[],
    opts?: { recarregar?: boolean; silent?: boolean }
  ) => {
    const isLinha = (item.nro_linha ?? 0) > 0;
    const result = await onConfirmar(
      placaReal,
      isLinha ? '' : item.destino,
      isLinha ? [] : (item.paradas ?? []),
      isLinha ? (item.nro_linha ?? 0) : undefined,
      { recarregar: opts?.recarregar ?? true, silent: opts?.silent ?? false }
    );
    if (!result.ok) return { ok: false, result, nextItems: currentItems };
    const nextItems = currentItems.filter((s) => s !== item);
    if ((result.sobras?.qtd ?? 0) > 0) {
      nextItems.push({
        placa: String(result.placa ?? placaReal).trim().toUpperCase(),
        destino: String(result.destino ?? item.destino).trim().toUpperCase(),
        paradas: Array.isArray(result.paradas) ? result.paradas : (item.paradas ?? []),
        nro_linha: (result.nro_linha ?? item.nro_linha) || 0,
        sobras: result.sobras ?? { qtd: 0 },
        capacidade: result.capacidade,
        uso: result.uso,
      });
    }
    return { ok: true, result, nextItems };
  };

  const handleCriarAdicional = async (item: SobrasCarregamento) => {
    if (loading) return;
    const hint = item.nro_linha ? ` para a linha ${String(item.nro_linha).padStart(3, '0')}` : ` para o destino ${item.destino}`;
    const placaInformada = await perguntarTexto({
      title: 'Criar carregamento adicional',
      description: `Informe a placa / identificação do veículo${hint}:`,
      label: 'Placa / Identificação',
      placeholder: 'Ex: ABC1234 ou ROTA-01',
      confirmText: 'Criar',
      cancelText: 'Cancelar',
    });
    const placaReal = (placaInformada ?? '').trim().toUpperCase();
    if (!placaReal) return;
    try {
      setLoading(true);
      const r = await criarAdicionalComPlaca(item, placaReal, sobrasItens, { recarregar: true });
      if (r.ok) {
        setSobrasItens(r.nextItems);
        if (r.nextItems.length === 0) handleFecharSobras();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCriarAdicionaisTodos = async () => {
    if (loading) return;
    if (sobrasItens.length === 0) return;
    try {
      setLoading(true);
      let okCount = 0;
      let failCount = 0;
      const snapshot = sobrasItens.slice();
      let current = sobrasItens.slice();
      for (let i = 0; i < snapshot.length; i++) {
        const item = snapshot[i];
        if (!current.includes(item)) continue;
        const hint = item.nro_linha ? `linha ${String(item.nro_linha).padStart(3, '0')}` : `destino ${item.destino}`;
        const placaInformada = await perguntarTexto({
          title: 'Criar carregamento adicional',
          description: `Informe a placa / identificação do veículo para ${hint}:`,
          label: 'Placa / Identificação',
          placeholder: 'Ex: ABC1234 ou ROTA-01',
          confirmText: 'Criar',
          cancelText: 'Parar',
        });
        const placaReal = (placaInformada ?? '').trim().toUpperCase();
        if (!placaReal) break;
        const r = await criarAdicionalComPlaca(item, placaReal, current, { recarregar: true, silent: true });
        if (r.ok) {
          okCount++;
          current = r.nextItems;
          setSobrasItens(current);
        } else {
          failCount++;
        }
      }
      if (okCount > 0) toast.success(`${okCount} carregamento(s) adicional(is) criado(s).`);
      if (failCount > 0) toast.error(`${failCount} item(ns) falharam ao criar adicional.`);
      if (okCount > 0) abrirAvisoSimulacao(confirmar);
      if (current.length === 0) handleFecharSobras();
    } finally {
      setLoading(false);
    }
  };

  const handleFecharResumoMassa = () => {
    setResumoMassaDialogOpen(false);
    onFechar();
  };

  const toggleOrdemLinhas = (col: 'destino' | 'intermediarias') => {
    if (ordemLinhas === col) setOrdemDirLinhas(d => d === 'asc' ? 'desc' : 'asc');
    else { setOrdemLinhas(col); setOrdemDirLinhas('asc'); }
  };

  const linhasVisiveis = React.useMemo(() => {
    const q = buscaLinha.trim().toUpperCase();
    const filtradas = q
      ? linhasHojeSemCriadas.filter(l => (l.sigla_dest ?? '').toUpperCase().includes(q) || (l.unidades ?? '').toUpperCase().includes(q))
      : linhasHojeSemCriadas.slice();

    const dir = ordemDirLinhas === 'asc' ? 1 : -1;
    filtradas.sort((a, b) => {
      const va = (ordemLinhas === 'destino' ? (a.sigla_dest ?? '') : (a.unidades ?? '')).toUpperCase();
      const vb = (ordemLinhas === 'destino' ? (b.sigla_dest ?? '') : (b.unidades ?? '')).toUpperCase();
      const cmp = va.localeCompare(vb);
      if (cmp !== 0) return cmp * dir;
      return ((a.nro_linha ?? 0) - (b.nro_linha ?? 0)) * dir;
    });
    return filtradas;
  }, [linhasHojeSemCriadas, buscaLinha, ordemLinhas, ordemDirLinhas]);

  const podeIniciar = modo === 'automatico'
    ? (() => {
        const selecionadas = Array.from(linhasSelecionadas.values());
        if (selecionadas.length === 0) return false;
        if (loadingLinhasOrigem) return false;
        return selecionadas.every((n) => !!statusPorLinha[n]?.podeCarregar);
      })()
    : !!unidadeDestino.trim();

  const toggleLinha = (nro: number) => {
    setLinhasSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(nro)) next.delete(nro);
      else next.add(nro);
      return next;
    });
  };

  const handleCarregarTodasPossiveis = async () => {
    if (loading) return;
    const possiveis = linhasHojeSemCriadas
      .map((l) => l.nro_linha ?? 0)
      .filter((n) => n > 0 && (statusPorLinha[n]?.podeCarregar ?? false));
    if (possiveis.length === 0) { toast.error('Nenhuma linha disponível para carregar.'); return; }
    setLinhasSelecionadas(new Set(possiveis));
    iniciarPlacasDialog(possiveis);
  };

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
                    {loadingLinhasOrigem ? 'Carregando...' : `${linhasVisiveis.length} linha(s)`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {linhasSelecionadas.size} selecionada(s)
                  </span>
                </div>

                <input
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
                  placeholder="Buscar sigla (destino ou intermediárias)..."
                  value={buscaLinha}
                  onChange={e => setBuscaLinha(e.target.value.toUpperCase())}
                  disabled={loading || loadingLinhasOrigem}
                />

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                  <div className="grid grid-cols-[84px_1fr] items-center gap-2 px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-700 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <button
                      type="button"
                      className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                      onClick={() => toggleOrdemLinhas('destino')}
                      disabled={loading || loadingLinhasOrigem}
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
                      disabled={loading || loadingLinhasOrigem}
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
                    {loadingLinhasOrigem ? (
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
                        const nro = l.nro_linha ?? 0;
                        const selecionada = nro > 0 && linhasSelecionadas.has(nro);
                        const destino = (l.sigla_dest ?? '').trim().toUpperCase() || '-';
                        const interEfetivas = getIntermediariasEfetivas(l);
                        const inter = interEfetivas.length ? interEfetivas.join(', ') : '-';
                        const nome = (l.nome ?? '').trim();
                        const st = statusPorLinha[nro];
                        const podeLinha = st?.podeCarregar ?? false;
                        const motivo = st?.motivoBloqueio ?? '';
                        return (
                          <div
                            key={l.nro_linha}
                            title={!podeLinha ? motivo : undefined}
                            className={`w-full text-left px-2.5 py-1.5 border-b border-slate-100 dark:border-slate-800 transition-colors ${selecionada ? 'bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'} ${!podeLinha ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => { if (!loading && podeLinha && nro > 0) toggleLinha(nro); }}
                          >
                            <div className="grid grid-cols-[18px_84px_1fr] items-start gap-2">
                              <div className="pt-0.5">
                                <input
                                  type="checkbox"
                                  checked={selecionada}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => { if (!loading && podeLinha && nro > 0) toggleLinha(nro); }}
                                  disabled={loading || !podeLinha || nro <= 0}
                                  className="h-3.5 w-3.5 accent-indigo-600"
                                />
                              </div>
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
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loading || loadingLinhasOrigem || linhasHojeSemCriadas.filter(l => (statusPorLinha[l.nro_linha ?? 0]?.podeCarregar ?? false)).length === 0}
                    onClick={handleCarregarTodasPossiveis}
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ListTree className="w-3.5 h-3.5 mr-1.5" />}
                    Carregar todas as possíveis
                  </Button>
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
            {loading ? 'Processando...' : (modo === 'automatico' ? 'Carregar selecionadas' : 'Iniciar')}
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
      <Dialog open={sobrasDialogOpen} onOpenChange={(v) => { if (!v) handleFecharSobras(); else setSobrasDialogOpen(true); }}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Sobras no armazém</DialogTitle>
            <DialogDescription>Há mercadoria além do que coube no(s) veículo(s). Criar carregamento adicional?</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden min-w-0">
            <div className="grid grid-cols-[140px_70px_minmax(0,1fr)_100px_110px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <span>Carregamento</span>
              <span>Dest.</span>
              <span>Sobras</span>
              <span className="text-right">Uso</span>
              <span className="text-right">Ação</span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {sobrasItens.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">—</div>
              ) : sobrasItens.map((s, idx) => {
                const sob = s.sobras ?? { qtd: 0 };
                const cap = s.capacidade ?? {};
                const uso = s.uso ?? {};
                const usoStr = (cap.peso_kg && cap.peso_kg > 0)
                  ? `${Math.min(999, Math.round(((uso.peso_kg ?? 0) / cap.peso_kg) * 100))}%`
                  : (cap.cubagem && cap.cubagem > 0)
                    ? `${Math.min(999, Math.round(((uso.cubagem ?? 0) / cap.cubagem) * 100))}%`
                    : '—';
                const detalhe = [
                  `${sob.qtd || 0} CT-e(s)`,
                  `${(sob.peso_kg ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`,
                  `${(sob.cubagem ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} m³`,
                  `${(sob.frete ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`,
                  s.paradas?.length ? `Paradas: ${s.paradas.join(', ')}` : '',
                  (s.nro_linha ?? 0) > 0 ? `Linha: ${String(s.nro_linha).padStart(3, '0')}` : '',
                ].filter(Boolean).join(' · ');
                return (
                  <div key={`${s.placa}-${idx}`} className="grid grid-cols-[140px_70px_minmax(0,1fr)_100px_110px] gap-2 px-3 py-2 text-xs items-center">
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{s.placa}</span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{s.destino || '-'}</span>
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate" title={detalhe}>{detalhe}</span>
                    <span className="text-right font-mono text-[11px] text-slate-600 dark:text-slate-300">{usoStr}</span>
                    <div className="flex justify-end">
                      <Button size="sm" className="h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={() => handleCriarAdicional(s)} disabled={loading}>
                        Criar adicional
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" className="h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white" onClick={handleCriarAdicionaisTodos} disabled={loading || sobrasItens.length === 0}>
              Criar adicionais (todos)
            </Button>
            <Button variant="outline" size="sm" onClick={handleFecharSobras} disabled={loading}>Agora não</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={resumoMassaDialogOpen} onOpenChange={(v) => { if (!v) handleFecharResumoMassa(); else setResumoMassaDialogOpen(true); }}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>Resumo · Carregamentos em massa</DialogTitle>
            <DialogDescription>Resultados por linha selecionada</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden min-w-0">
            <div className="grid grid-cols-[70px_120px_60px_minmax(0,1fr)_90px_minmax(0,1fr)] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <span>Linha</span>
              <span>Placa</span>
              <span>Dest.</span>
              <span>Intermediárias</span>
              <span>Status</span>
              <span>Mensagem</span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {resumoMassaItens.length === 0 ? (
                <div className="px-3 py-4 text-xs text-slate-400 text-center">—</div>
              ) : resumoMassaItens.map((r) => (
                <div key={r.nro_linha} className="grid grid-cols-[70px_120px_60px_minmax(0,1fr)_90px_minmax(0,1fr)] gap-2 px-3 py-2 text-xs items-center">
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{String(r.nro_linha).padStart(3, '0')}</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{r.placa}</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{r.destino}</span>
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">{r.intermediarias}</span>
                  <span className={`text-[11px] font-bold ${r.status === 'criado' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                    {r.status === 'criado' ? 'CRIADO' : 'ERRO'}
                  </span>
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{r.msg}</span>
                </div>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3">
              <span className="font-semibold">
                Total: {resumoMassaItens.length} · Criados: {resumoMassaItens.filter(i => i.status === 'criado').length} · Erros: {resumoMassaItens.filter(i => i.status === 'erro').length}
              </span>
            </div>
          </div>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={handleFecharResumoMassa}>Fechar</Button>
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

      {placasDialogOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-3xl mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-indigo-500" />
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Informe a placa / identificação</h3>
              </div>
              <button
                onClick={() => setPlacasDialogOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                disabled={loading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-[70px_minmax(0,1fr)_80px_minmax(0,1fr)_170px] gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Linha</span>
                  <span>Nome</span>
                  <span>Dest.</span>
                  <span>Intermediárias</span>
                  <span>Placa / ident.</span>
                </div>
                <div className="max-h-[55vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {placasDialogLinhas.map((l) => (
                    <div key={l.nro} className="grid grid-cols-[70px_minmax(0,1fr)_80px_minmax(0,1fr)_170px] gap-2 px-3 py-2 text-sm items-center">
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{String(l.nro).padStart(3, '0')}</span>
                      <span className="truncate text-slate-800 dark:text-slate-200">{l.nome}</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{l.destino}</span>
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate">{l.intermediarias}</span>
                      <input
                        value={placasDialogValues[l.nro] ?? ''}
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase();
                          setPlacasDialogValues((prev) => ({ ...(prev || {}), [l.nro]: v }));
                        }}
                        placeholder="Ex: ABC1D23"
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 font-mono"
                        disabled={loading}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="outline" size="sm" onClick={() => setPlacasDialogOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button size="sm" className="bg-indigo-500 hover:bg-indigo-600 text-white" onClick={executarAutomaticoComPlacas} disabled={loading}>
                {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                Continuar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalRotaCarregamento({
  carregamento,
  dados,
  onFechar,
}: {
  carregamento: Carregamento;
  dados: any;
  onFechar: () => void;
}) {
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [mapboxToken, setMapboxToken] = useState(() => {
    try {
      const fromStorage = window.localStorage.getItem('mapbox_token');
      if (fromStorage && fromStorage.trim()) return fromStorage.trim();
    } catch {}
    const envToken = (import.meta as any)?.env?.VITE_MAPBOX_TOKEN;
    return typeof envToken === 'string' ? envToken : '';
  });
  const autoGeoRef = useRef<string | null>(null);
  const getToken = useCallback((): string => {
    try {
      const v = window.localStorage.getItem('mapbox_token');
      if (v && v.trim()) return v.trim();
    } catch {}
    const envToken = (import.meta as any)?.env?.VITE_MAPBOX_TOKEN;
    if (typeof envToken === 'string' && envToken.trim()) return envToken.trim();
    return mapboxToken.trim();
  }, [mapboxToken]);

  useEffect(() => {
    const t = getToken();
    if (t && t !== mapboxToken) setMapboxToken(t);
  }, [getToken]);

  const carregarTokenServidor = useCallback(async () => {
    try {
      const resp = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_mapbox_token.php`,
        { method: 'POST', body: JSON.stringify({}) },
        true
      );
      const t = String(resp?.token ?? '').trim();
      if (!t) return;
      try { window.localStorage.setItem('mapbox_token', t); } catch {}
      setMapboxToken(t);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getToken()) return;
    void carregarTokenServidor();
  }, [carregarTokenServidor, getToken]);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);

  const [coordsByKey, setCoordsByKey] = useState<Record<string, { lat: number; lng: number }>>({});
  const [geoStatusByKey, setGeoStatusByKey] = useState<Record<string, 'pending' | 'loading' | 'ok' | 'error'>>({});
  const [geoErrorByKey, setGeoErrorByKey] = useState<Record<string, string>>({});
  const [geoRunning, setGeoRunning] = useState(false);
  const [geoHydrated, setGeoHydrated] = useState(false);

  const [abertos, setAbertos] = useState<Set<string>>(() => new Set());
  const [cteRotaSortKey, setCteRotaSortKey] = useState<'ctrc' | 'dest' | 'emissao' | 'prev' | 'peso' | 'frete'>('ctrc');
  const [cteRotaSortDir, setCteRotaSortDir] = useState<'asc' | 'desc'>('asc');

  const carregarInfo = dados?.carregamento ?? {};
  const origem = String(carregarInfo?.unidade_origem ?? '').toUpperCase();
  const paradas = Array.isArray(carregarInfo?.paradas) ? (carregarInfo.paradas as string[]) : [];

  const unidadesMap = useMemo(() => {
    const m = new Map<string, { sigla: string; nome: string; lat: number | null; lng: number | null }>();
    const arr = Array.isArray(dados?.unidades) ? dados.unidades : [];
    for (const u of arr) {
      const sigla = String(u?.sigla ?? '').toUpperCase();
      if (!sigla) continue;
      const lat = u?.latitude !== null && u?.latitude !== undefined && String(u.latitude) !== '' ? Number(u.latitude) : null;
      const lng = u?.longitude !== null && u?.longitude !== undefined && String(u.longitude) !== '' ? Number(u.longitude) : null;
      const latN = Number.isFinite(lat as any) ? (lat as number) : null;
      const lngN = Number.isFinite(lng as any) ? (lng as number) : null;
      const latFinal = sigla === 'FEC' ? null : (latN === 0 && lngN === 0 ? null : latN);
      const lngFinal = sigla === 'FEC' ? null : (latN === 0 && lngN === 0 ? null : lngN);
      m.set(sigla, { sigla, nome: String(u?.nome ?? ''), lat: latFinal, lng: lngFinal });
    }
    return m;
  }, [dados]);

  const unidadesOrdem = useMemo(() => {
    const out: string[] = [];
    const push = (u: string) => {
      const s = u.trim().toUpperCase();
      if (!s) return;
      if (!/^[A-Z0-9]{2,5}$/.test(s)) return;
      if (out.includes(s)) return;
      out.push(s);
    };
    push(origem);
    for (const p of paradas) push(p);
    return out;
  }, [origem, paradas]);

  const grupos = useMemo(() => {
    const ctes = Array.isArray(dados?.ctes) ? dados.ctes : [];

    const padCte = (ser: string, nro: number) => {
      const n = Number.isFinite(nro) && nro > 0 ? String(nro).padStart(6, '0') : '';
      return ser && n ? `${ser}${n}` : '';
    };

    const norm = (s: any) => String(s ?? '').trim();
    const normKey = (s: any) => norm(s).toUpperCase().replace(/\s+/g, ' ');
    const normEnd = (s: any) => norm(s).toUpperCase().replace(/\s+/g, ' ');
    const isValidSigla = (s: string) => /^[A-Z0-9]{2,5}$/.test(s);

    const destinosEntrega = new Map<string, {
      key: string;
      tipo: 'ENTREGA';
      unidade: string;
      titulo: string;
      query: string;
      destinatario: string;
      endereco: string;
      bairro: string;
      cep: string;
      cidade: string;
      uf: string;
      ctes: { ser: string; nro: number; ordem: number; ctrc: string; destino: string; emissao: string; prev: string; peso: number; frete: number; cubagem: number; qtde_vol: number; cidade: string; destinatario: string }[];
      lat: number | null;
      lng: number | null;
    }>();
    const destinosTransfer = new Map<string, {
      key: string;
      tipo: 'TRANSFERENCIA';
      unidade: string;
      titulo: string;
      ctes: { ser: string; nro: number; ordem: number; ctrc: string; destino: string; emissao: string; prev: string; peso: number; frete: number; cubagem: number; qtde_vol: number; cidade: string; destinatario: string }[];
      lat: number | null;
      lng: number | null;
    }>();

    for (const c of ctes) {
      const ser = normKey(c?.ser_cte ?? '');
      const nro = Number(c?.nro_cte ?? 0);
      const destinoCte = normKey(c?.destino_cte ?? '');
      const unidadeDestino = (isValidSigla(destinoCte) ? destinoCte : (unidadesOrdem[unidadesOrdem.length - 1] ?? ''));

      const endereco = normEnd(c?.endereco_entrega ?? '');
      const bairro = normEnd(c?.bairro_entrega ?? '');
      const cep = normEnd(c?.cep_entrega ?? '');
      const cidade = normEnd(c?.cidade_entrega ?? '');
      const uf = normEnd(c?.uf_entrega ?? '');
      const destinatario = normEnd(c?.destinatario ?? '');
      const isFec = unidadeDestino === 'FEC';
      const hasEnderecoReal = endereco !== '' || bairro !== '' || cep !== '' || cidade !== '' || uf !== '';
      const hasEndereco = hasEnderecoReal || isFec;

      const ctrc = padCte(ser, nro);
      const peso = c?.peso !== null && c?.peso !== undefined && String(c.peso) !== '' ? Number(c.peso) : 0;
      const frete = c?.vlr_frete !== null && c?.vlr_frete !== undefined && String(c.vlr_frete) !== '' ? Number(c.vlr_frete) : 0;
      const cubagem = c?.cubagem !== null && c?.cubagem !== undefined && String(c.cubagem) !== '' ? Number(c.cubagem) : 0;
      const qtdeVol = c?.qtde_vol !== null && c?.qtde_vol !== undefined && String(c.qtde_vol) !== '' ? Number(c.qtde_vol) : 0;
      const cidadeDestino = norm(c?.cidade_entrega ?? c?.cidade_destino_cte ?? '');
      const emissao = norm(c?.data_emissao ?? '');
      const prev = norm(c?.data_prev_ent ?? '');
      const ordem = Number(c?.ordem ?? 0) || 0;
      const itemCte = { ser, nro, ordem, ctrc, destino: unidadeDestino, emissao, prev, peso: Number.isFinite(peso) ? peso : 0, frete: Number.isFinite(frete) ? frete : 0, cubagem: Number.isFinite(cubagem) ? cubagem : 0, qtde_vol: Number.isFinite(qtdeVol) ? qtdeVol : 0, cidade: cidadeDestino, destinatario };

      if (hasEndereco) {
        const baseTitulo = (isFec && !hasEnderecoReal)
          ? [destinatario, ctrc ? `CT-e ${ctrc}` : '', 'Endereço incompleto'].filter(Boolean).join(' · ')
          : [
            destinatario,
            endereco ? `${endereco}${bairro ? `, ${bairro}` : ''}` : (bairro ? bairro : ''),
            [cep, cidade && uf ? `${cidade}/${uf}` : (cidade || uf)].filter(Boolean).join(' · ')
          ].filter(Boolean).join(' · ');
        const query = (isFec && !hasEnderecoReal) ? '' : [endereco, bairro, cep, cidade, uf].filter(Boolean).join(', ');
        const key = (isFec && !hasEnderecoReal)
          ? `${unidadeDestino}|${ctrc || `${ser}-${nro}`}`
          : `${unidadeDestino}|${destinatario}|${endereco}|${bairro}|${cep}|${cidade}|${uf}`;
        const g = destinosEntrega.get(key) ?? {
          key,
          tipo: 'ENTREGA' as const,
          unidade: unidadeDestino,
          titulo: baseTitulo || (unidadeDestino ? `Entrega (${unidadeDestino})` : 'Entrega'),
          query,
          destinatario,
          endereco,
          bairro,
          cep,
          cidade,
          uf,
          ctes: [],
          lat: null,
          lng: null,
        };
        const lat = c?.latitude_entrega !== null && c?.latitude_entrega !== undefined && String(c.latitude_entrega) !== '' ? Number(c.latitude_entrega) : null;
        const lng = c?.longitude_entrega !== null && c?.longitude_entrega !== undefined && String(c.longitude_entrega) !== '' ? Number(c.longitude_entrega) : null;
        if (g.lat === null && Number.isFinite(lat as any) && Number.isFinite(lng as any)) {
          g.lat = lat as number;
          g.lng = lng as number;
        }
        g.ctes.push(itemCte);
        destinosEntrega.set(key, g);
      } else if (isValidSigla(unidadeDestino) && unidadeDestino !== 'FEC') {
        const key = unidadeDestino;
        const u = unidadesMap.get(unidadeDestino);
        const g = destinosTransfer.get(key) ?? {
          key,
          tipo: 'TRANSFERENCIA' as const,
          unidade: unidadeDestino,
          titulo: unidadeDestino,
          ctes: [],
          lat: u?.lat ?? null,
          lng: u?.lng ?? null,
        };
        g.ctes.push(itemCte);
        destinosTransfer.set(key, g);
      }
    }

    const listEntrega = Array.from(destinosEntrega.values()).sort((a, b) => (a.unidade || '').localeCompare(b.unidade || '') || a.titulo.localeCompare(b.titulo));
    const listTransf = Array.from(destinosTransfer.values()).sort((a, b) => a.unidade.localeCompare(b.unidade));

    const ordemIdx = new Map<string, number>();
    unidadesOrdem.forEach((u, i) => ordemIdx.set(u, i));
    listEntrega.sort((a, b) => ((ordemIdx.get(a.unidade) ?? 999) - (ordemIdx.get(b.unidade) ?? 999)) || a.titulo.localeCompare(b.titulo));
    listTransf.sort((a, b) => ((ordemIdx.get(a.unidade) ?? 999) - (ordemIdx.get(b.unidade) ?? 999)) || a.titulo.localeCompare(b.titulo));

    return { entrega: listEntrega, transferencia: listTransf };
  }, [dados, unidadesMap, unidadesOrdem]);

  const transfByUnidade = useMemo(() => new Map(grupos.transferencia.map((g) => [g.unidade, g])), [grupos.transferencia]);
  const entregaByKey = useMemo(() => new Map(grupos.entrega.map((g) => [g.key, g])), [grupos.entrega]);

  const defaultParadasOrder = useMemo(() => {
    const out: string[] = [];
    const used = new Set<string>();
    for (let i = 1; i < unidadesOrdem.length; i++) {
      const u = unidadesOrdem[i];
      const t = transfByUnidade.get(u);
      if (t) {
        const k = `T:${t.unidade}`;
        out.push(k);
        used.add(k);
      }
      for (const e of grupos.entrega.filter((g) => g.unidade === u)) {
        const k = `E:${e.key}`;
        out.push(k);
        used.add(k);
      }
    }
    for (const t of grupos.transferencia) {
      const k = `T:${t.unidade}`;
      if (used.has(k)) continue;
      used.add(k);
      out.push(k);
    }
    for (const e of grupos.entrega) {
      const k = `E:${e.key}`;
      if (used.has(k)) continue;
      used.add(k);
      out.push(k);
    }
    const minPorKey = new Map<string, number>();
    for (const k of out) {
      let min = Number.POSITIVE_INFINITY;
      if (k.startsWith('T:')) {
        const sigla = k.slice(2);
        const g = transfByUnidade.get(sigla);
        if (g?.ctes) {
          for (const c of g.ctes as any[]) {
            const o = Number((c as any).ordem ?? 0) || 0;
            if (o > 0 && o < min) min = o;
          }
        }
      } else if (k.startsWith('E:')) {
        const gKey = k.slice(2);
        const g = entregaByKey.get(gKey);
        if (g?.ctes) {
          for (const c of g.ctes as any[]) {
            const o = Number((c as any).ordem ?? 0) || 0;
            if (o > 0 && o < min) min = o;
          }
        }
      }
      if (Number.isFinite(min)) minPorKey.set(k, min);
    }
    const hasAny = Array.from(minPorKey.values()).some((v) => Number.isFinite(v));
    if (!hasAny) return out;
    const idxBase = new Map<string, number>();
    out.forEach((k, i) => idxBase.set(k, i));
    return [...out].sort((a, b) => {
      const oa = minPorKey.get(a) ?? Number.POSITIVE_INFINITY;
      const ob = minPorKey.get(b) ?? Number.POSITIVE_INFINITY;
      if (oa !== ob) return oa - ob;
      return (idxBase.get(a) ?? 0) - (idxBase.get(b) ?? 0);
    });
  }, [entregaByKey, grupos.entrega, grupos.transferencia, transfByUnidade, unidadesOrdem]);

  const [paradasOrder, setParadasOrder] = useState<string[]>([]);

  const paradasOrderEfetiva = useMemo(() => {
    const keysAll = new Set<string>([
      ...grupos.transferencia.map((g) => `T:${g.unidade}`),
      ...grupos.entrega.map((g) => `E:${g.key}`),
    ]);
    const base = (paradasOrder.length > 0 ? paradasOrder : defaultParadasOrder).filter((k) => keysAll.has(k));
    const out: string[] = [];
    const used = new Set<string>();
    for (const k of base) {
      if (used.has(k)) continue;
      used.add(k);
      out.push(k);
    }
    for (const k of defaultParadasOrder) {
      if (!keysAll.has(k) || used.has(k)) continue;
      used.add(k);
      out.push(k);
    }
    return out;
  }, [defaultParadasOrder, grupos.entrega, grupos.transferencia, paradasOrder]);

  useEffect(() => {
    const initial: Record<string, { lat: number; lng: number }> = {};
    const status: Record<string, 'pending' | 'loading' | 'ok' | 'error'> = {};
    for (const g of grupos.entrega) {
      if (g.lat !== null && g.lng !== null && !(g.lat === 0 && g.lng === 0)) {
        initial[g.key] = { lat: g.lat, lng: g.lng };
        status[g.key] = 'ok';
      } else {
        status[g.key] = 'pending';
      }
    }
    setGeoHydrated(false);
    setCoordsByKey(initial);
    setGeoStatusByKey(status);
    setGeoErrorByKey({});
    setGeoRunning(false);
    setAbertos(new Set());
    setParadasOrder(defaultParadasOrder);
    setGeoHydrated(true);
  }, [carregamento.placa_provisoria, defaultParadasOrder]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasCss = !!document.getElementById('leaflet-css');
    const hasJs = !!document.getElementById('leaflet-js');

    if (!hasCss) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!hasJs) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setLeafletLoaded(true);
      document.body.appendChild(script);
    } else {
      setLeafletLoaded(true);
    }
  }, []);

  const calcDist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
    const toRad = (n: number) => (n * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat);
    const la2 = toRad(b.lat);
    const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
  };

  const pontosOrdenados = useMemo(() => {
    const getUnidCoord = (sigla: string): { lat: number; lng: number } | null => {
      if (sigla === 'FEC') return null;
      const u = unidadesMap.get(sigla);
      if (!u) return null;
      if (!Number.isFinite(u.lat as any) || !Number.isFinite(u.lng as any)) return null;
      if ((u.lat as number) === 0 && (u.lng as number) === 0) return null;
      return { lat: u.lat as number, lng: u.lng as number };
    };

    const pontos: { key: string; tipo: 'UNIDADE' | 'ENTREGA'; titulo: string; lat: number; lng: number }[] = [];

    const origemCoord = getUnidCoord(origem);
    if (origemCoord) pontos.push({ key: `U:${origem}`, tipo: 'UNIDADE', titulo: origem, ...origemCoord });

    const usedUnit = new Set<string>();
    if (origem) usedUnit.add(origem);

    const pushUnit = (sigla: string) => {
      const s = String(sigla ?? '').trim().toUpperCase();
      if (!s || usedUnit.has(s)) return;
      const c = getUnidCoord(s);
      if (!c) return;
      pontos.push({ key: `U:${s}`, tipo: 'UNIDADE', titulo: s, ...c });
      usedUnit.add(s);
    };

    for (const k of paradasOrderEfetiva) {
      if (k.startsWith('T:')) {
        pushUnit(k.slice(2));
      } else if (k.startsWith('E:')) {
        const gKey = k.slice(2);
        const g = entregaByKey.get(gKey);
        const c = coordsByKey[gKey];
        if (!g || !c) continue;
        pontos.push({ key: `E:${gKey}`, tipo: 'ENTREGA', titulo: g.titulo, lat: c.lat, lng: c.lng });
      }
    }

    const finalSigla = unidadesOrdem[unidadesOrdem.length - 1];
    if (finalSigla) pushUnit(finalSigla);

    return pontos;
  }, [coordsByKey, entregaByKey, origem, paradasOrderEfetiva, unidadesMap, unidadesOrdem]);

  const [routeCoords, setRouteCoords] = useState<{ lat: number; lng: number }[]>([]);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [xlsxLoading, setXlsxLoading] = useState(false);

  useEffect(() => {
    const fetchRoute = async () => {
      if (pontosOrdenados.length < 2) { setRouteCoords([]); return; }
      setRouteLoading(true);
      try {
        const coordsStr = pontosOrdenados.map((p) => `${p.lng},${p.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
        const resp = await fetch(url);
        const data = await resp.json();
        const distM = Number(data?.routes?.[0]?.distance ?? 0) || 0;
        setRouteDistanceKm(distM > 0 ? (distM / 1000) : null);
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coordinates) && coordinates.length > 0) {
          const converted = coordinates.map((c: any) => ({ lat: c[1], lng: c[0] }));
          setRouteCoords(converted);
          return;
        }
      } catch {}
      setRouteCoords(pontosOrdenados.map((p) => ({ lat: p.lat, lng: p.lng })));
      setRouteDistanceKm(null);
      setRouteLoading(false);
    };
    void fetchRoute().finally(() => setRouteLoading(false));
  }, [pontosOrdenados]);

  useEffect(() => {
    if (!leafletLoaded) return;
    if (!mapContainerRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView([-15, -55], 4);
      L.tileLayer(`${ENVIRONMENT.apiBaseUrl}/map/osm_tile.php?z={z}&x={x}&y={y}`, {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;
    for (const l of layersRef.current) {
      try { map.removeLayer(l); } catch {}
    }
    layersRef.current = [];

    const markers: any[] = [];
    pontosOrdenados.forEach((p, idx) => {
      const bg = p.tipo === 'UNIDADE' ? '#2563eb' : '#059669';
      const icon = L.divIcon({
        className: 'custom-pin-icon',
        html: `
          <div style="position: relative; width: 30px; height: 40px;">
            <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow-rota-${idx}" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
                </filter>
              </defs>
              <path d="M15 0C8.373 0 3 5.373 3 12c0 9 12 28 12 28s12-19 12-28c0-6.627-5.373-12-12-12z"
                    fill="${bg}"
                    stroke="white"
                    stroke-width="2"
                    filter="url(#shadow-rota-${idx})"/>
              <circle cx="15" cy="12" r="7" fill="white"/>
              <text x="15" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="${bg}">${idx + 1}</text>
            </svg>
          </div>
        `,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        popupAnchor: [0, -40],
      });
      const m = L.marker([p.lat, p.lng], { icon }).addTo(map);
      if (p.tipo === 'UNIDADE') {
        const sigla = String(p.titulo ?? '').toUpperCase();
        const nome = unidadesMap.get(sigla)?.nome ?? '';
        m.bindPopup(`UNIDADE ${sigla}<br/>${nome}`);
      } else {
        const groupKey = String(p.key ?? '').startsWith('E:') ? String(p.key ?? '').slice(2) : '';
        const g = grupos.entrega.find((x) => x.key === groupKey);
        const tipo = (g?.unidade ?? '') === 'FEC' ? 'FEC' : 'ENTREGA';
        const destinatario = g?.destinatario ?? '';
        const endereco = g?.endereco ?? '';
        const bairro = g?.bairro ?? '';
        const cep = g?.cep ?? '';
        const cidade = g?.cidade ?? '';
        const uf = g?.uf ?? '';
        const ctesTxt = Array.isArray(g?.ctes)
          ? g!.ctes.slice(0, 6).map((c: any) => c?.ctrc).filter(Boolean).join(', ') + (g!.ctes.length > 6 ? '…' : '')
          : '';
        m.bindPopup(`
          <div style="font-size:12px;line-height:1.35">
            <div style="font-weight:700;margin-bottom:6px">${tipo}</div>
            ${destinatario ? `<div><span style="color:#64748b">Destinatário:</span> ${destinatario}</div>` : ''}
            ${endereco ? `<div><span style="color:#64748b">Endereço:</span> ${endereco}</div>` : ''}
            ${bairro ? `<div><span style="color:#64748b">Bairro:</span> ${bairro}</div>` : ''}
            ${cep ? `<div><span style="color:#64748b">CEP:</span> ${cep}</div>` : ''}
            ${(cidade || uf) ? `<div><span style="color:#64748b">Cidade:</span> ${cidade}${cidade && uf ? '/' : ''}${uf}</div>` : ''}
            ${Array.isArray(g?.ctes) ? `<div><span style="color:#64748b">CT-es:</span> ${g!.ctes.length}${ctesTxt ? ` · ${ctesTxt}` : ''}</div>` : ''}
          </div>
        `);
      }
      markers.push(m);
    });
    layersRef.current.push(...markers);

    if (routeCoords.length >= 2) {
      const poly = L.polyline(routeCoords.map((c) => [c.lat, c.lng]), { color: '#1e3a8a', weight: 4, opacity: 0.85 }).addTo(map);
      layersRef.current.push(poly);
    }

    const all = [...pontosOrdenados.map((p) => [p.lat, p.lng] as [number, number]), ...routeCoords.map((c) => [c.lat, c.lng] as [number, number])];
    if (all.length > 0) {
      const bounds = L.latLngBounds(all);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [leafletLoaded, pontosOrdenados, routeCoords]);

  const focarRota = useCallback(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;
    const all = [...pontosOrdenados.map((p) => [p.lat, p.lng] as [number, number]), ...routeCoords.map((c) => [c.lat, c.lng] as [number, number])];
    if (all.length === 0) return;
    const bounds = L.latLngBounds(all);
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [pontosOrdenados, routeCoords]);

  const ctesOrdem = useMemo(() => {
    const out: { ser_cte: string; nro_cte: number }[] = [];
    const seen = new Set<string>();
    const push = (c: any) => {
      const ser = String(c?.ser_cte ?? c?.ser ?? c?.serCte ?? '').trim().toUpperCase();
      const nro = Number(c?.nro_cte ?? c?.nro ?? c?.nroCte ?? 0) || 0;
      if (!ser || nro <= 0) return;
      const k = `${ser}|${nro}`;
      if (seen.has(k)) return;
      seen.add(k);
      out.push({ ser_cte: ser, nro_cte: nro });
    };
    for (const k of paradasOrderEfetiva) {
      if (k.startsWith('T:')) {
        const sigla = k.slice(2);
        const g = transfByUnidade.get(sigla);
        if (!g?.ctes) continue;
        for (const c of g.ctes) push(c);
      } else if (k.startsWith('E:')) {
        const gKey = k.slice(2);
        const g = entregaByKey.get(gKey);
        if (!g?.ctes) continue;
        for (const c of g.ctes) push(c);
      }
    }
    return out;
  }, [entregaByKey, paradasOrderEfetiva, transfByUnidade]);

  const ordemSyncRef = useRef<{ t: any; sig: string }>({ t: null, sig: '' });

  const salvarOrdemCtes = useCallback(async (ctes: { ser_cte: string; nro_cte: number }[]) => {
    if (!carregamento?.placa_provisoria) return;
    if (!Array.isArray(ctes) || ctes.length === 0) return;
    try {
      await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_ordem_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ unidade: origem, placa: carregamento.placa_provisoria, ctes }) },
        true
      );
    } catch {
    }
  }, [carregamento?.placa_provisoria, origem]);

  useEffect(() => {
    const sig = ctesOrdem.map((c) => `${c.ser_cte}${String(c.nro_cte)}`).join('|');
    if (!sig) return;
    if (ordemSyncRef.current.sig === sig) return;
    ordemSyncRef.current.sig = sig;
    if (ordemSyncRef.current.t) clearTimeout(ordemSyncRef.current.t);
    ordemSyncRef.current.t = setTimeout(() => { void salvarOrdemCtes(ctesOrdem); }, 650);
    return () => {
      if (ordemSyncRef.current.t) clearTimeout(ordemSyncRef.current.t);
    };
  }, [ctesOrdem, salvarOrdemCtes]);

  const exportarOrdemCarregamento = useCallback(async () => {
    if (xlsxLoading) return;
    setXlsxLoading(true);
    try {
      await salvarOrdemCtes(ctesOrdem);
      const entregaByKey = new Map(grupos.entrega.map((g) => [g.key, g]));
      const entregaKeysEmOrdem: string[] = [];
      for (const p of pontosOrdenados) {
        if (p.tipo !== 'ENTREGA') continue;
        const key = String(p.key ?? '');
        const groupKey = key.startsWith('E:') ? key.slice(2) : '';
        if (!groupKey) continue;
        if (entregaKeysEmOrdem.includes(groupKey)) continue;
        entregaKeysEmOrdem.push(groupKey);
      }

      const entregaKeysPorUnidade = new Map<string, string[]>();
      for (const k of entregaKeysEmOrdem) {
        const g = entregaByKey.get(k);
        if (!g) continue;
        const u = String(g.unidade ?? '').toUpperCase();
        if (!entregaKeysPorUnidade.has(u)) entregaKeysPorUnidade.set(u, []);
        entregaKeysPorUnidade.get(u)!.push(k);
      }

      const transfByUnidade = new Map(grupos.transferencia.map((g) => [String(g.unidade ?? '').toUpperCase(), g]));
      const linhas: any[] = [];
      const addLinhas = (setor: string, destinatario: string, cidade: string, ctes: any[]) => {
        for (const c of ctes) {
          linhas.push({
            setor,
            destinatario,
            cidade,
            ctrc: c?.ctrc ?? '',
            peso: c?.peso ?? 0,
            cubagem: c?.cubagem ?? 0,
            volume: c?.qtde_vol ?? 0,
            obs: '',
          });
        }
      };

      for (const uSigla of unidadesOrdem.slice(1)) {
        const unidade = String(uSigla ?? '').toUpperCase();
        if (unidade !== 'FEC') {
          const tg = transfByUnidade.get(unidade);
          if (tg) {
            const uNome = unidadesMap.get(unidade)?.nome ?? '';
            const destinatario = `UNIDADE ${unidade}${uNome ? ` - ${uNome}` : ''}`;
            addLinhas(unidade, destinatario, uNome, tg.ctes);
          }
        }

        const keys = entregaKeysPorUnidade.get(unidade) ?? [];
        for (const k of keys) {
          const g = entregaByKey.get(k);
          if (!g) continue;
          const cidade = [g.cidade, g.uf].filter(Boolean).join('/');
          const destinatario = g.destinatario || g.titulo || 'ENTREGA';
          addLinhas(unidade || g.unidade || '', destinatario, cidade, g.ctes);
        }
      }

      for (const k of entregaKeysEmOrdem) {
        const g = entregaByKey.get(k);
        if (!g) continue;
        const u = String(g.unidade ?? '').toUpperCase();
        if (unidadesOrdem.includes(u)) continue;
        const cidade = [g.cidade, g.uf].filter(Boolean).join('/');
        const destinatario = g.destinatario || g.titulo || 'ENTREGA';
        addLinhas(u || g.unidade || '', destinatario, cidade, g.ctes);
      }

      const rotaTxt = unidadesOrdem.filter(Boolean).join(' → ');
      const mapImage = await (async () => {
        try {
          const map = mapRef.current;
          if (!map || !map.getContainer) return null;
          const container = map.getContainer() as HTMLElement;
          if (!container) return null;
          const cRect = container.getBoundingClientRect();
          const w = Math.max(1, Math.floor(cRect.width));
          const h = Math.max(1, Math.floor(cRect.height));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          const waitLoaded = async (img: HTMLImageElement) => {
            if (img.complete && img.naturalWidth > 0) return;
            await new Promise<void>((resolve) => {
              const onDone = () => { cleanup(); resolve(); };
              const cleanup = () => {
                img.removeEventListener('load', onDone);
                img.removeEventListener('error', onDone);
              };
              img.addEventListener('load', onDone);
              img.addEventListener('error', onDone);
            });
          };

          const tiles = Array.from(container.querySelectorAll('img.leaflet-tile')) as HTMLImageElement[];
          await Promise.all(tiles.map(waitLoaded));
          for (const img of tiles) {
            if (!img.complete || img.naturalWidth <= 0) continue;
            const r = img.getBoundingClientRect();
            const x = r.left - cRect.left;
            const y = r.top - cRect.top;
            ctx.drawImage(img, x, y, r.width, r.height);
          }

          const drawSvgEl = async (svgEl: SVGSVGElement, x: number, y: number, width: number, height: number) => {
            const cloned = svgEl.cloneNode(true) as SVGSVGElement;
            cloned.setAttribute('width', String(width));
            cloned.setAttribute('height', String(height));
            const rawStyle = cloned.getAttribute('style') || '';
            const cleanStyle = rawStyle
              .replace(/transform\s*:[^;]+;?/gi, '')
              .replace(/translate3d\s*\([^)]*\)/gi, '')
              .replace(/translate\s*\([^)]*\)/gi, '')
              .trim();
            if (cleanStyle !== rawStyle) cloned.setAttribute('style', cleanStyle);
            cloned.removeAttribute('transform');
            (cloned as any).style && ((cloned as any).style.transform = '');
            const svg = new XMLSerializer().serializeToString(cloned);
            const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            try {
              const img = new Image();
              await new Promise<void>((resolve) => {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                img.src = url;
              });
              if (img.width > 0 && img.height > 0) {
                ctx.drawImage(img, x, y, width, height);
              }
            } finally {
              URL.revokeObjectURL(url);
            }
          };

          const overlaySvg = container.querySelector('.leaflet-overlay-pane svg') as SVGSVGElement | null;
          if (overlaySvg) {
            const r = overlaySvg.getBoundingClientRect();
            await drawSvgEl(overlaySvg, r.left - cRect.left, r.top - cRect.top, r.width, r.height);
          }

          const markerSvgs = Array.from(container.querySelectorAll('.leaflet-marker-pane .leaflet-marker-icon svg')) as SVGSVGElement[];
          for (const svgEl of markerSvgs) {
            const iconEl = svgEl.closest('.leaflet-marker-icon') as HTMLElement | null;
            if (!iconEl) continue;
            const r = iconEl.getBoundingClientRect();
            await drawSvgEl(svgEl, r.left - cRect.left, r.top - cRect.top, r.width, r.height);
          }

          return canvas.toDataURL('image/png');
        } catch {
          return null;
        }
      })();

      const token = localStorage.getItem('auth_token');
      const resp = await fetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/exportar_ordem_carregamento.php`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ unidade: origem, placa: carregamento.placa_provisoria, rota: rotaTxt, rota_km: routeDistanceKm, linhas, map_image: mapImage }),
        }
      );
      if (!resp.ok) {
        const txt = await resp.text();
        try { throw new Error(JSON.parse(txt).message || 'Erro ao exportar'); }
        catch { throw new Error('Erro ao exportar planilha'); }
      }
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
        const txt = await resp.text();
        try { throw new Error(JSON.parse(txt).message || 'Erro ao exportar'); }
        catch { throw new Error('Erro ao exportar planilha'); }
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ordem_carregamento_${carregamento.placa_provisoria}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Planilha gerada com sucesso!');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao gerar planilha.');
    } finally {
      setXlsxLoading(false);
    }
  }, [xlsxLoading, grupos.entrega, grupos.transferencia, pontosOrdenados, unidadesOrdem, unidadesMap, origem, carregamento.placa_provisoria, routeDistanceKm]);

  const geocodeEndereco = async (query: string): Promise<{ lat: number; lng: number } | null> => {
    const token = getToken();
    if (!token) return null;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${encodeURIComponent(token)}&limit=1&country=BR&language=pt`;
    const resp = await fetch(url);
    const json = await resp.json();
    const center = json?.features?.[0]?.center;
    if (!Array.isArray(center) || center.length < 2) return null;
    const lng = Number(center[0]);
    const lat = Number(center[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  };

  const persistirGeoloc = async (ser: string, nro: number, lat: number, lng: number) => {
    await apiFetch(
      `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_geoloc_entrega.php`,
      { method: 'POST', body: JSON.stringify({ ser_cte: ser, nro_cte: nro, latitude: lat, longitude: lng }) },
      true
    );
  };

  const iniciarGeocoding = async () => {
    if (geoRunning) return;
    const tokenNow = getToken();
    if (!tokenNow) { toast.error('Token Mapbox não configurado.'); return; }
    const pendentes = grupos.entrega.filter((g) => (geoStatusByKey[g.key] ?? 'pending') === 'pending');
    if (pendentes.length === 0) return;
    setGeoRunning(true);
    try {
      for (const g of pendentes) {
        setGeoStatusByKey((prev) => ({ ...prev, [g.key]: 'loading' }));
        setGeoErrorByKey((prev) => {
          const next = { ...prev };
          delete next[g.key];
          return next;
        });
        try {
          const q = String(g.query ?? '').trim();
          if (!q) {
            setGeoStatusByKey((prev) => ({ ...prev, [g.key]: 'error' }));
            setGeoErrorByKey((prev) => ({ ...prev, [g.key]: 'Endereço incompleto' }));
            continue;
          }
          const coord = await geocodeEndereco(q);
          if (!coord) {
            setGeoStatusByKey((prev) => ({ ...prev, [g.key]: 'error' }));
            setGeoErrorByKey((prev) => ({ ...prev, [g.key]: 'Não encontrado' }));
            continue;
          }
          for (const c of g.ctes) {
            try { await persistirGeoloc(c.ser, c.nro, coord.lat, coord.lng); } catch {}
          }
          setCoordsByKey((prev) => ({ ...prev, [g.key]: coord }));
          setGeoStatusByKey((prev) => ({ ...prev, [g.key]: 'ok' }));
          await new Promise((r) => setTimeout(r, 150));
        } catch (e: any) {
          setGeoStatusByKey((prev) => ({ ...prev, [g.key]: 'error' }));
          setGeoErrorByKey((prev) => ({ ...prev, [g.key]: (e?.message || 'Erro') }));
        }
      }
    } finally {
      setGeoRunning(false);
    }
  };

  useEffect(() => {
    const token = getToken();
    const placa = carregamento.placa_provisoria;
    if (!token) return;
    if (!geoHydrated) return;
    if (geoRunning) return;
    if (autoGeoRef.current === placa) return;
    const pendentes = grupos.entrega.filter((g) => (geoStatusByKey[g.key] ?? 'pending') === 'pending');
    if (pendentes.length === 0) return;
    autoGeoRef.current = placa;
    void iniciarGeocoding();
  }, [carregamento.placa_provisoria, getToken, geoHydrated, geoRunning, grupos.entrega, geoStatusByKey, iniciarGeocoding]);

  const totalEnt = grupos.entrega.length;
  const okEnt = grupos.entrega.filter((g) => geoStatusByKey[g.key] === 'ok').length;
  const pct = totalEnt > 0 ? Math.round((okEnt / totalEnt) * 100) : 100;

  const toggleAberto = (key: string) => {
    setAbertos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const moverParada = useCallback((key: string, delta: -1 | 1) => {
    setParadasOrder((prev) => {
      const base = (prev.length > 0 ? [...prev] : [...defaultParadasOrder]);
      const idx = base.indexOf(key);
      if (idx < 0) return base;
      const nextIdx = idx + delta;
      if (nextIdx < 0 || nextIdx >= base.length) return base;
      const next = [...base];
      const tmp = next[idx];
      next[idx] = next[nextIdx];
      next[nextIdx] = tmp;
      return next;
    });
  }, [defaultParadasOrder]);

  const toggleCteRotaSort = (key: 'ctrc' | 'dest' | 'emissao' | 'prev' | 'peso' | 'frete') => {
    setCteRotaSortKey((prev) => {
      if (prev === key) {
        setCteRotaSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setCteRotaSortDir('asc');
      return key;
    });
  };

  const totaisLista = useMemo(() => {
    const all = [...grupos.transferencia, ...grupos.entrega];
    let peso = 0;
    let frete = 0;
    for (const g of all) {
      for (const c of g.ctes) {
        peso += Number(c.peso ?? 0) || 0;
        frete += Number((c as any).frete ?? 0) || 0;
      }
    }
    return { peso, frete };
  }, [grupos.entrega, grupos.transferencia]);

  const renderCtes = (items: { ser: string; nro: number; ctrc: string; destino: string; emissao: string; prev: string; peso?: number; frete?: number }[]) => {
    const list = [...items];
    const dir = cteRotaSortDir === 'asc' ? 1 : -1;
    const cmpStr = (a: string, b: string) => a.localeCompare(b);
    const cmpNum = (a: number, b: number) => a - b;
    list.sort((a, b) => {
      if (cteRotaSortKey === 'ctrc') return cmpStr(String(a.ctrc ?? ''), String(b.ctrc ?? '')) * dir;
      if (cteRotaSortKey === 'dest') return cmpStr(String(a.destino ?? ''), String(b.destino ?? '')) * dir;
      if (cteRotaSortKey === 'emissao') return cmpStr(String(a.emissao ?? ''), String(b.emissao ?? '')) * dir;
      if (cteRotaSortKey === 'prev') return cmpStr(String(a.prev ?? ''), String(b.prev ?? '')) * dir;
      if (cteRotaSortKey === 'frete') return cmpNum(Number(a.frete ?? 0) || 0, Number(b.frete ?? 0) || 0) * dir;
      return cmpNum(Number(a.peso ?? 0) || 0, Number(b.peso ?? 0) || 0) * dir;
    });
    const totPeso = list.reduce((s, c) => s + (Number(c.peso ?? 0) || 0), 0);
    const totFrete = list.reduce((s, c) => s + (Number(c.frete ?? 0) || 0), 0);
    return (
      <div className="mt-2 pl-6">
        <div className="rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1fr)_44px_56px_56px_64px_72px] gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
            <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteRotaSort('ctrc')}>
              CT-e{cteRotaSortKey === 'ctrc' ? (cteRotaSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
            </button>
            <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteRotaSort('dest')}>
              Dest.{cteRotaSortKey === 'dest' ? (cteRotaSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
            </button>
            <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteRotaSort('emissao')}>
              Emissão{cteRotaSortKey === 'emissao' ? (cteRotaSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
            </button>
            <button type="button" className="text-left hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteRotaSort('prev')}>
              Prev{cteRotaSortKey === 'prev' ? (cteRotaSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
            </button>
            <button type="button" className="text-right hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteRotaSort('peso')}>
              Peso (kg){cteRotaSortKey === 'peso' ? (cteRotaSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
            </button>
            <button type="button" className="text-right hover:text-slate-800 dark:hover:text-slate-100" onClick={() => toggleCteRotaSort('frete')}>
              Frete (R$){cteRotaSortKey === 'frete' ? (cteRotaSortDir === 'asc' ? <ChevronDown className="w-3 h-3 inline ml-1 rotate-180" /> : <ChevronDown className="w-3 h-3 inline ml-1" />) : null}
            </button>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {list.map((c) => (
              <div key={`${c.ser}-${c.nro}`} className="grid grid-cols-[minmax(0,1fr)_44px_56px_56px_64px_72px] gap-1.5 px-2 py-1 text-[11px]">
                <span className="font-mono text-slate-700 dark:text-slate-200 truncate">{c.ctrc || `${c.ser}${String(c.nro).padStart(6, '0')}`}</span>
                <span className="font-mono text-slate-600 dark:text-slate-400 truncate">{String(c.destino ?? '').toUpperCase()}</span>
                <span className="text-slate-600 dark:text-slate-400">{formatData(String(c.emissao ?? '')) || '-'}</span>
                <span className="text-slate-600 dark:text-slate-400">{formatData(String(c.prev ?? '')) || '-'}</span>
                <span className="text-right font-mono text-slate-700 dark:text-slate-200">{(Number(c.peso ?? 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                <span className="text-right font-mono text-slate-700 dark:text-slate-200">{(Number(c.frete ?? 0) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_44px_56px_56px_64px_72px] gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            <span className="text-slate-600 dark:text-slate-300">Total</span>
            <span />
            <span />
            <span />
            <span className="text-right font-mono">{totPeso.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
            <span className="text-right font-mono">{totFrete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>
    );
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-[min(1100px,calc(100vw-32px))] h-[min(760px,calc(100vh-100px))] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                Rota · Carregamento{carregamento.seq_carregamento ? ` ${String(carregamento.seq_carregamento).padStart(6, '0')}` : ''} · {carregamento.placa_provisoria}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {unidadesOrdem.length > 1 ? `${unidadesOrdem[0]} → ${unidadesOrdem.slice(1).join(' → ')}` : unidadesOrdem[0]}
              </p>
            </div>
          </div>
          <button onClick={!geoRunning ? onFechar : undefined} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" disabled={geoRunning}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300 mb-1">
              <span className="font-semibold">Geolocalização</span>
              <span>
                {geoRunning ? `Processando… ${okEnt}/${totalEnt}` : (totalEnt > 0 && okEnt === totalEnt ? 'Concluída' : `${okEnt}/${totalEnt} (${pct}%)`)}
                {routeLoading ? ' · Rota…' : ''}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className="h-2 bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => { void iniciarGeocoding(); }}
              disabled={geoRunning}
              title={!getToken() ? 'Token Mapbox não configurado' : undefined}
            >
              {geoRunning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5 mr-1.5" />}
              Geolocalizar
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => { void exportarOrdemCarregamento(); }}
              disabled={xlsxLoading}
            >
              {xlsxLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5 mr-1.5" />}
              Ordem de Carregamento
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_520px]">
          <div className="min-h-0 p-4">
            <div className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">
              {!leafletLoaded && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-400">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />Carregando mapa...
                </div>
              )}
              {routeLoading && (
                <div className="absolute top-12 right-2 z-[1100] bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Calculando rota...
                </div>
              )}
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2 z-[1100] h-8 text-xs"
                onClick={focarRota}
                disabled={!leafletLoaded || (pontosOrdenados.length === 0 && routeCoords.length === 0)}
              >
                <MapPin className="w-3.5 h-3.5 mr-1.5" />
                Focar rota
              </Button>
              <div ref={mapContainerRef} className="w-full h-full" />
            </div>
          </div>

          <div className="min-h-0 border-l border-slate-200 dark:border-slate-700 p-4 flex flex-col">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Destinos</div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-1">
              {paradasOrderEfetiva.map((k, idx) => {
                if (k.startsWith('T:')) {
                  const sigla = k.slice(2);
                  const g = transfByUnidade.get(sigla);
                  if (!g) return null;
                  const aberto = abertos.has(k);
                  const uNome = unidadesMap.get(g.unidade)?.nome ?? '';
                  const isFirst = idx === 0;
                  const isLast = idx === paradasOrderEfetiva.length - 1;
                  return (
                    <div key={k} className="mb-2">
                      <div className="flex gap-1 items-stretch">
                        <div className="w-9 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-800 dark:text-indigo-200 flex items-center justify-center font-extrabold text-lg tabular-nums">
                          {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAberto(k)}
                          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left"
                        >
                          {aberto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{g.unidade}{uNome ? ` · ${uNome}` : ''}</div>
                              <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">Transf.</span>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">Transferência · {g.ctes.length} CT-e(s)</div>
                          </div>
                        </button>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            className="h-[26px] w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); moverParada(k, -1); }}
                            disabled={isFirst}
                            title="Mover para cima"
                          >
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          </button>
                          <button
                            type="button"
                            className="mt-1 h-[26px] w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); moverParada(k, 1); }}
                            disabled={isLast}
                            title="Mover para baixo"
                          >
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          </button>
                        </div>
                      </div>
                      {aberto && renderCtes(g.ctes)}
                    </div>
                  );
                }

                if (k.startsWith('E:')) {
                  const gKey = k.slice(2);
                  const g = entregaByKey.get(gKey);
                  if (!g) return null;
                  const aberto = abertos.has(k);
                  const status = geoStatusByKey[g.key] ?? 'pending';
                  const statusLabel = status === 'ok' ? 'ok' : status === 'loading' ? 'buscando...' : status === 'error' ? 'erro' : 'pendente';
                  const cor = status === 'ok'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : status === 'error'
                      ? 'text-red-700 dark:text-red-400'
                      : 'text-amber-700 dark:text-amber-400';
                  const isFec = String(g.unidade ?? '').toUpperCase() === 'FEC';
                  const isFirst = idx === 0;
                  const isLast = idx === paradasOrderEfetiva.length - 1;
                  return (
                    <div key={k} className="mb-2">
                      <div className="flex gap-1 items-stretch">
                        <div className={`w-9 shrink-0 rounded-lg border border-slate-200 dark:border-slate-700 ${isFec ? 'bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'} flex items-center justify-center font-extrabold text-lg tabular-nums`}>
                          {idx + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleAberto(k)}
                          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left"
                        >
                          {aberto ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-normal leading-snug">
                                {g.destinatario || g.titulo}
                              </div>
                              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isFec ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>{isFec ? 'FEC' : 'Entrega'}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-normal leading-snug mt-0.5">
                              {[
                                g.endereco ? `${g.endereco}${g.bairro ? `, ${g.bairro}` : ''}` : (g.bairro || ''),
                                [g.cep, g.cidade && g.uf ? `${g.cidade}/${g.uf}` : (g.cidade || g.uf)].filter(Boolean).join(' · ')
                              ].filter(Boolean).join(' · ') || 'Endereço não informado'}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {isFec ? 'FEC' : 'Entrega'} · {g.ctes.length} CT-e(s) · <span className={cor}>{statusLabel}</span>
                              {status === 'error' && geoErrorByKey[g.key] ? ` (${geoErrorByKey[g.key]})` : ''}
                            </div>
                          </div>
                        </button>
                        <div className="flex flex-col">
                          <button
                            type="button"
                            className="h-[26px] w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); moverParada(k, -1); }}
                            disabled={isFirst}
                            title="Mover para cima"
                          >
                            <ChevronUp className="w-4 h-4 text-slate-500" />
                          </button>
                          <button
                            type="button"
                            className="mt-1 h-[26px] w-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/40 disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-900 flex items-center justify-center"
                            onClick={(e) => { e.stopPropagation(); moverParada(k, 1); }}
                            disabled={isLast}
                            title="Mover para baixo"
                          >
                            <ChevronDown className="w-4 h-4 text-slate-500" />
                          </button>
                        </div>
                      </div>
                      {aberto && renderCtes(g.ctes)}
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-[11px] text-slate-700 dark:text-slate-200 flex items-center justify-between gap-3">
              <span className="font-semibold">Totais</span>
              <div className="flex items-center gap-3">
                <span className="font-mono">Peso: {totaisLista.peso.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} kg</span>
                <span className="font-mono">Frete: {totaisLista.frete.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ModalImportarSSW({ onFechar, onConcluir, onExecutar }: { onFechar: () => void; onConcluir: () => Promise<void>; onExecutar: (opts?: { auto_importar_veiculos?: boolean; ignorar_veiculos_faltantes?: boolean }) => Promise<any> }) {
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

function ModalCarregamentoAutomaticoEntrega({
  setores,
  onConfirmar,
  onFechar,
}: {
  setores: GrupoSetor[];
  onConfirmar: (setores: string[]) => Promise<void>;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<Set<string>>(() => new Set());

  const setoresFiltrados = useMemo(() => {
    const b = busca.trim().toUpperCase();
    const list = [...(setores ?? [])];
    list.sort((a, b) => (b.totalCtes - a.totalCtes) || a.setor.localeCompare(b.setor));
    if (!b) return list;
    return list.filter((s) => {
      const alvo = [
        String(s.setor ?? ''),
        String(s.nome ?? ''),
        String(s.cepIni ?? ''),
        String(s.cepFin ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toUpperCase();
      return alvo.includes(b);
    });
  }, [setores, busca]);

  const toggleSel = (s: string) => {
    const k = String(s ?? '').trim();
    if (!k) return;
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const selected = Array.from(selecionados).map((s) => s.trim()).filter(Boolean);
  const podeCarregarSelecionados = selected.length > 0;
  const podeCarregarTodos = setoresFiltrados.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Carregamento Automático · Entrega</h3>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Buscar setor</label>
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value.toUpperCase())}
              placeholder="Ex: CENTRO"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              autoFocus
            />
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Será gerado 1 carregamento por setor. A placa será preenchida automaticamente com a sigla do setor (você pode editar depois).
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="grid grid-cols-[36px_minmax(0,1fr)_80px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
              <span />
              <span>Setor</span>
              <span className="text-right">CT-es</span>
            </div>
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {setoresFiltrados.length === 0 ? (
                <div className="px-3 py-6 text-xs text-slate-400 text-center">—</div>
              ) : (
                setoresFiltrados.map((s) => {
                  const k = String(s.setor ?? '').trim();
                  const checked = selecionados.has(k);
                  const nome = String(s.nome ?? '').trim();
                  const cepIni = String(s.cepIni ?? '').trim();
                  const cepFin = String(s.cepFin ?? '').trim();
                  const cepLabel =
                    cepIni && cepFin ? `CEP ${cepIni}–${cepFin}` : (cepIni ? `CEP ini ${cepIni}` : (cepFin ? `CEP fin ${cepFin}` : ''));
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleSel(k)}
                      className="w-full grid grid-cols-[36px_minmax(0,1fr)_80px] gap-2 px-3 py-2 text-xs items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 text-left"
                    >
                      <div className={`h-4 w-4 rounded border ${checked ? 'bg-emerald-500 border-emerald-500' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'}`} />
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-slate-800 dark:text-slate-200 truncate">{k || 'SEM SETOR'}</div>
                        {nome || cepLabel ? (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {[nome, cepLabel].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </div>
                      <span className="text-right font-mono text-[11px] text-slate-600 dark:text-slate-300">{s.totalCtes}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-6 pb-5 justify-end">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button
            variant="outline"
            disabled={!podeCarregarTodos}
            onClick={() => onConfirmar(setoresFiltrados.map((s) => String(s.setor ?? '').trim()).filter(Boolean))}
          >
            Carregar todos
          </Button>
          <Button
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
            disabled={!podeCarregarSelecionados}
            onClick={() => onConfirmar(selected)}
          >
            Carregar selecionados
          </Button>
        </div>
      </div>
    </div>
  );
}

function CarregamentoArea({
  abaAtiva,
  sigla,
  carregamentos,
  loadingCarregamentos,
  carregamentosTransferOpen,
  setCarregamentosTransferOpen,
  carregamentosEntregaOpen,
  setCarregamentosEntregaOpen,
  carregamentosCalendario,
  loadingCarregamentosCalendario,
  linhasOrigem,
  loadingLinhasOrigem,
  totalsPorUnidadeParaLinhas,
  gruposSetorEntrega,
  confirmar,
  perguntarTexto,
  modoApontamento,
  onIniciarApontamento,
  onCancelarApontamento,
  onCriarCarregamento,
  onCarregamentoAutomaticoEntrega,
  onFinalizarCarregamento,
  onExcluirCarregamento,
  onRemoverCte,
  onCarregarSSW,
  onCarregarRota,
  loadingRota,
  rotaCarregamentoPlaca,
  onRecarregarCarregamentos,
  onImportarCarregamentos,
  importandoCarregamentos,
  onImportarVeiculos,
  importandoVeiculos,
  importacaoAutomatica,
  onToggleImportacaoAutomatica,
  obrigarPlacasReais,
  onToggleObrigarPlacasReais,
  onCarregamentoAutomatico,
  todosCtes,
  cteKeysDisponiveisTransferencia,
  cteKeysDisponiveisEntrega,
}: CarregamentoAreaProps) {
  const [modalCriarModo, setModalCriarModo] = useState<'transferencia' | 'entrega' | null>(null);
  const [modalAutomaticoModo, setModalAutomaticoModo] = useState<'transferencia' | 'entrega' | null>(null);
  const [modalImportarAberto, setModalImportarAberto] = useState(false);
  const [loadingEntregaAuto, setLoadingEntregaAuto] = useState(false);
  const [excluindoTodosEntrega, setExcluindoTodosEntrega] = useState(false);
  const [resumoEntregaOpen, setResumoEntregaOpen] = useState(false);
  const [resumoEntregaItens, setResumoEntregaItens] = useState<{ setor: string; placa: string; inseridos: number; fora: number; cap_tipo?: string }[]>([]);
  const [capDialogOpen, setCapDialogOpen] = useState(false);
  const [capLoading, setCapLoading] = useState(false);
  const [capSaving, setCapSaving] = useState(false);
  const [capItems, setCapItems] = useState<{ tipo: string; capacidade_ton: string; capacidade_m3: string }[]>([]);
  const tooltipStyle = useTooltipStyle();
  const isAtivoCarregamento = useCallback((c: Carregamento) => {
    const dt = String((c as any)?.data_finalizacao ?? (c as any)?.dataFinalizacao ?? '').trim();
    return dt === '';
  }, []);
  const isEntregaCarregamento = useCallback((c: Carregamento) => {
    const modo = String((c as any)?.modo_carregamento ?? (c as any)?.modoCarregamento ?? '').trim().toUpperCase();
    if (modo === 'ENTREGA') return true;
    const setores = String((c as any)?.setores_entrega ?? (c as any)?.setoresEntrega ?? '').trim();
    if (setores) return true;
    return false;
  }, []);

  const carregamentosEntrega = React.useMemo(() => {
    return (carregamentos ?? []).filter((c) => isAtivoCarregamento(c) && isEntregaCarregamento(c));
  }, [carregamentos, isAtivoCarregamento, isEntregaCarregamento]);

  const carregamentosTransferencia = React.useMemo(() => {
    return (carregamentos ?? []).filter((c) => isAtivoCarregamento(c) && !isEntregaCarregamento(c));
  }, [carregamentos, isAtivoCarregamento, isEntregaCarregamento]);

  const carregamentosTransferNaoSimulados = React.useMemo(() => {
    return carregamentosTransferencia.filter((c: any) => !c?.simulado);
  }, [carregamentosTransferencia]);

  const handleCriar = (placa: string, destino: string, paradas: string) => {
    setModalCriarModo(null);
    onCriarCarregamento(placa, destino, paradas);
  };

  const handleCarregarAutomaticoEntrega = async (setores: string[]) => {
    if (loadingEntregaAuto) return;
    try {
      setLoadingEntregaAuto(true);
      const setoresOk = (setores ?? []).map((s) => String(s ?? '').trim().toUpperCase()).filter(Boolean);
      if (setoresOk.length === 0) return;

      const placasUsadas = new Set(
        (carregamentos ?? [])
          .map((c) => String(c.placa_provisoria ?? '').trim().toUpperCase())
          .filter(Boolean)
      );

      let okCount = 0;
      let errCount = 0;
      let totalCtes = 0;
      let totalFora = 0;
      const resumo: { setor: string; placa: string; inseridos: number; fora: number; cap_tipo?: string }[] = [];
      const erros: string[] = [];

      for (const setor of setoresOk) {
        let placa = setor;
        if (placasUsadas.has(placa)) {
          for (let i = 2; i <= 99; i += 1) {
            const p = `${setor}-${i}`;
            if (!placasUsadas.has(p)) { placa = p; break; }
          }
        }
        placasUsadas.add(placa);

        const res = await onCarregamentoAutomaticoEntrega(placa, [setor]);
        if (res.ok) {
          const add = Number(res.total ?? 0) || 0;
          const fora = Number(res.fora ?? 0) || 0;
          if (add > 0) {
            okCount += 1;
            totalCtes += add;
            totalFora += fora;
            resumo.push({ setor, placa, inseridos: add, fora, cap_tipo: res.cap_tipo });
          } else {
            totalFora += fora;
            resumo.push({ setor, placa, inseridos: 0, fora, cap_tipo: res.cap_tipo });
          }
        } else {
          errCount += 1;
          erros.push(`${setor}: ${res.message || 'Erro ao gerar carregamento'}`);
        }
      }

      setResumoEntregaItens(resumo);
      setResumoEntregaOpen(true);
      if (errCount > 0) {
        toast.error(erros.slice(0, 3).join(' · ') + (erros.length > 3 ? ` (+${erros.length - 3})` : ''));
      }

      setModalAutomaticoModo(null);
    } finally {
      setLoadingEntregaAuto(false);
    }
  };

  const loadCapacidades = async () => {
    try {
      setCapLoading(true);
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/veiculo_capacidade.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'listar' }) },
        true
      );
      if (!res?.success) {
        toast.error(res?.message ? String(res.message) : 'Erro ao carregar capacidades');
        setCapItems([]);
        return;
      }
      const items = Array.isArray(res.items) ? res.items : [];
      setCapItems(items.map((it: any) => ({
        tipo: String(it?.tipo ?? '').trim(),
        capacidade_ton: it?.capacidade_ton == null ? '' : String(it.capacidade_ton),
        capacidade_m3: it?.capacidade_m3 == null ? '' : String(it.capacidade_m3),
      })));
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar capacidades');
      setCapItems([]);
    } finally {
      setCapLoading(false);
    }
  };

  const salvarCapacidades = async () => {
    if (capSaving) return;
    try {
      setCapSaving(true);
      const payload = capItems.map((it) => ({
        tipo: String(it.tipo ?? '').trim().toUpperCase(),
        capacidade_ton: String(it.capacidade_ton ?? '').trim() === '' ? null : Number(it.capacidade_ton),
        capacidade_m3: String(it.capacidade_m3 ?? '').trim() === '' ? null : Number(it.capacidade_m3),
      }));
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/veiculo_capacidade.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'salvar', items: payload }) },
        true
      );
      if (!res?.success) {
        toast.error(res?.message ? String(res.message) : 'Erro ao salvar capacidades');
        return;
      }
      toast.success('Capacidades atualizadas.');
      setCapDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar capacidades');
    } finally {
      setCapSaving(false);
    }
  };

  useEffect(() => {
    if (!capDialogOpen) return;
    void loadCapacidades();
  }, [capDialogOpen]);

  useEffect(() => {
    if (!carregamentosEntregaOpen) return;
    if (capLoading) return;
    if (capItems.length > 0) return;
    void loadCapacidades();
  }, [carregamentosEntregaOpen, capLoading, capItems.length]);

  const veiculoCapacidades = React.useMemo(() => {
    return capItems
      .map((it) => ({
        tipo: String(it.tipo ?? '').trim(),
        capacidade_ton: Number(String(it.capacidade_ton ?? '').replace(',', '.')) || 0,
        capacidade_m3: Number(String(it.capacidade_m3 ?? '').replace(',', '.')) || 0,
      }))
      .filter((it) => !!it.tipo);
  }, [capItems]);

  const [dragEntregaOrigem, setDragEntregaOrigem] = useState<string | null>(null);
  const [dragEntregaOver, setDragEntregaOver] = useState<string | null>(null);

  const fundirEntrega = async (placaOrig: string, placaDest: string) => {
    const orig = String(placaOrig ?? '').trim().toUpperCase();
    const dest = String(placaDest ?? '').trim().toUpperCase();
    if (!orig || !dest || orig === dest) return;

    const ok = await confirmar({
      title: 'Fundir carregamentos de entrega?',
      description: `Mover os CT-es do carregamento ${orig} para ${dest} (juntando setores)?`,
      confirmText: 'Fundir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'fundir_entrega', placa_origem: orig, placa_destino: dest }) },
        true
      );
      if (!res?.success) {
        toast.error(res?.message || 'Erro ao fundir carregamentos.');
        return;
      }
      toast.success(`Carregamentos fundidos. Setores: ${String(res.setores ?? '').trim() || '-'}`);
      await onRecarregarCarregamentos();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao fundir carregamentos.');
    }
  };

  const handleExcluirTodosEntrega = async () => {
    if (excluindoTodosEntrega) return;
    const qtd = carregamentosEntrega.length;
    if (qtd <= 0) return;
    const ok = await confirmar({
      title: 'Excluir todos os carregamentos de entrega?',
      description: `Excluir TODOS os ${qtd} carregamento(s) de entrega em andamento da unidade ${sigla}?`,
      confirmText: 'Excluir todos',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      setExcluindoTodosEntrega(true);
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'deletar_todos_entrega' }) },
        true
      );
      if (res?.success) {
        toast.success('Carregamentos de entrega excluídos.');
        await onRecarregarCarregamentos();
      } else {
        toast.error(res?.message || 'Erro ao excluir carregamentos de entrega.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao excluir carregamentos de entrega.');
    } finally {
      setExcluindoTodosEntrega(false);
    }
  };

  const handleExcluirTodos = async () => {
    const ok = await confirmar({
      title: 'Finalizar todos os carregamentos?',
      description: `Finalizar TODOS os ${carregamentos.length} carregamento(s) da unidade ${sigla}?`,
      confirmText: 'Finalizar todos',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'excluir_todos' }) },
        true
      );
      if (res.success) {
        toast.success('Todos os carregamentos foram finalizados.');
        onRecarregarCarregamentos();
      } else {
        toast.error(res.message || 'Erro ao finalizar carregamentos.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao finalizar carregamentos.');
    }
  };

  const [calOpen, setCalOpen] = useState(false);
  const [calTipo, setCalTipo] = useState<'todos' | 'transferencia' | 'entrega'>('todos');
  const [diaSel, setDiaSel] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const hojeKey = React.useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);
  const diasScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!calOpen) return;
    const el = diasScrollRef.current;
    if (!el) return;
    window.setTimeout(() => {
      if (!diasScrollRef.current) return;
      diasScrollRef.current.scrollLeft = diasScrollRef.current.scrollWidth;
    }, 0);
  }, [calOpen]);

  const ultimosDias = React.useMemo(() => {
    let base = new Date();
    base.setHours(0, 0, 0, 0);

    const list = Array.isArray(carregamentosCalendario) ? carregamentosCalendario : [];
    let maxTs = base.getTime();
    for (const c of list) {
      const keys = [String((c as any)?.data_criacao ?? ''), String((c as any)?.data_finalizacao ?? '')]
        .map((s) => s.trim().slice(0, 10))
        .filter(Boolean);
      for (const k of keys) {
        const m = k.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) continue;
        const t = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 0, 0, 0, 0).getTime();
        if (!Number.isNaN(t) && t > maxTs) maxTs = t;
      }
    }
    if (maxTs > base.getTime()) base = new Date(maxTs);

    const arr: string[] = [];
    for (let i = 29; i >= 0; i -= 1) {
      const x = new Date(base);
      x.setDate(base.getDate() - i);
      arr.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`);
    }
    return arr;
  }, [carregamentosCalendario]);

  useEffect(() => {
    const list = Array.isArray(carregamentosCalendario) ? carregamentosCalendario : [];
    if (list.length === 0) return;
    const lastKey = ultimosDias[ultimosDias.length - 1];
    if (!lastKey) return;
    setDiaSel((prev) => {
      const p = String(prev ?? '').trim();
      if (!p) return lastKey;
      const min = ultimosDias[0];
      if (min && (p < min || p > lastKey)) return lastKey;
      return p;
    });
  }, [carregamentosCalendario, ultimosDias]);

  const toKey = (v: any): string => {
    const s = String(v ?? '').trim();
    if (!s) return '';
    const mIso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (mIso) return `${mIso[1]}-${mIso[2]}-${mIso[3]}`;
    const mBr = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (mBr) return `${mBr[3]}-${mBr[2]}-${mBr[1]}`;
    return '';
  };

  const toTs = (dateKey: string, timeVal: any): number | null => {
    const dKey = String(dateKey ?? '').trim();
    if (!dKey) return null;
    const m = dKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const time = String(timeVal ?? '').trim();
    const tm = time.match(/^(\d{2}):(\d{2})(?::(\d{2}))?/);
    const hh = tm ? parseInt(tm[1], 10) : 0;
    const mm = tm ? parseInt(tm[2], 10) : 0;
    const ss = tm && tm[3] ? parseInt(tm[3], 10) : 0;
    const dt = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), hh, mm, ss, 0);
    const t = dt.getTime();
    return Number.isNaN(t) ? null : t;
  };

  const fmtHora = (dateKey: string, timeVal: any): string => {
    const dKey = toKey(dateKey);
    if (!dKey) return '';
    const time = String(timeVal ?? '').trim();
    if (!time) return '';
    const tm = time.match(/^(\d{2}):(\d{2})/);
    if (!tm) return time;
    return `${tm[1]}:${tm[2]}`;
  };

  const fmtDiaBr = (key: string): string => {
    const m = String(key ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    return `${m[3]}/${m[2]}`;
  };

  const fmtDiaBrAno = (key: string): string => {
    const m = String(key ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return '';
    return `${m[3]}/${m[2]}/${m[1]}`;
  };

  const fmtDuracao = (mins: number): string => {
    if (!Number.isFinite(mins) || mins < 0) return '';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h <= 0) return `${m}min`;
    if (m <= 0) return `${h}h`;
    return `${h}h${String(m).padStart(2, '0')}`;
  };

  const calList = React.useMemo(() => {
    const list = Array.isArray(carregamentosCalendario) ? carregamentosCalendario : [];
    if (calTipo === 'todos') return list;
    if (calTipo === 'entrega') return list.filter((c) => isEntregaCarregamento(c));
    return list.filter((c) => !isEntregaCarregamento(c));
  }, [carregamentosCalendario, calTipo, isEntregaCarregamento]);

  const calNorm = React.useMemo(() => {
    return calList.map((c) => {
      const iniKey = toKey((c as any).data_criacao);
      const fimKey = toKey((c as any).data_finalizacao);
      return { c, iniKey, fimKey };
    });
  }, [calList]);

  const isPresentOnDay = (x: { iniKey: string; fimKey: string }, dayKey: string): boolean => {
    if (!x.iniKey) return false;
    if (x.iniKey > dayKey) return false;
    if (x.fimKey && x.fimKey < dayKey) return false;
    return true;
  };

  const calCountByDay = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const d of ultimosDias) {
      let count = 0;
      for (const x of calNorm) {
        if (isPresentOnDay(x as any, d)) count += 1;
      }
      m.set(d, count);
    }
    return m;
  }, [ultimosDias, calNorm]);

  const calDailySeries = React.useMemo(() => {
    return ultimosDias.map((d) => {
      let frete = 0;
      let freteTer = 0;
      let merc = 0;
      let peso = 0;
      let cub = 0;
      let totalDurMin = 0;
      let countDur = 0;
      for (const x of calNorm) {
        if (!isPresentOnDay(x as any, d)) continue;
        const c = (x as any).c as Carregamento;
        frete += Number(c.total_frete ?? 0) || 0;
        freteTer += Number((c as any).vlr_frete_carreteiro ?? 0) || 0;
        merc += Number(c.total_mercadoria ?? 0) || 0;
        peso += Number(c.total_peso ?? 0) || 0;
        cub += Number(c.total_cubagem ?? 0) || 0;
      }

      for (const x of calNorm) {
        const iniKey = (x as any).iniKey as string;
        if (!iniKey || iniKey !== d) continue;
        const c = (x as any).c as Carregamento;
        const iniTs = toTs(d, (c as any).hora_criacao);
        if (iniTs == null) continue;
        const fimKey = (x as any).fimKey as string;
        const fimTs = fimKey ? toTs(fimKey, (c as any).hora_finalizacao) : null;
        let endTs: number;
        if (fimTs != null && fimTs > 0) endTs = fimTs;
        else if (d < hojeKey) {
          const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          endTs = m ? new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10), 23, 59, 59, 0).getTime() : Date.now();
        } else endTs = Date.now();

        const durMin = Math.max(0, Math.round((endTs - iniTs) / 60000));
        totalDurMin += durMin;
        countDur += 1;
      }

      const avgTempoMin = countDur > 0 ? totalDurMin / countDur : null;
      return {
        iso: d,
        label: d === hojeKey ? 'HOJE' : fmtDiaBr(d),
        frete,
        freteTer,
        merc,
        peso,
        cub,
        avgTempoMin,
      };
    });
  }, [ultimosDias, calNorm, hojeKey]);

  type CalSortCol =
    | 'placa'
    | 'destino'
    | 'frete'
    | 'frete_ter'
    | 'frete_ter_pct'
    | 'merc'
    | 'peso'
    | 'cub'
    | 'inicio'
    | 'fim'
    | 'tempo';

  const [calSortCol, setCalSortCol] = useState<CalSortCol>('inicio');
  const [calSortDir, setCalSortDir] = useState<'asc' | 'desc'>('desc');
  const [calPage, setCalPage] = useState(1);
  const pageSize = 10;
  const [calDetalheOpen, setCalDetalheOpen] = useState(false);
  const [calDetalheItem, setCalDetalheItem] = useState<Carregamento | null>(null);
  const [calCtesOpen, setCalCtesOpen] = useState(false);
  const [calCtesLoading, setCalCtesLoading] = useState(false);
  const [calCtesLista, setCalCtesLista] = useState<any[]>([]);
  const [calCtesTotais, setCalCtesTotais] = useState<any>(null);
  const [calAtualizandoCtes, setCalAtualizandoCtes] = useState(false);
  const [calVolMode, setCalVolMode] = useState<'frete' | 'peso' | 'cub' | 'merc'>('frete');

  const abrirDetalheCarregamento = (c: Carregamento) => {
    setCalDetalheItem(c);
    setCalDetalheOpen(true);
  };

  const abrirCtesCarregamento = async (placa: string, seqCarregamento?: number | null) => {
    const p = String(placa ?? '').trim().toUpperCase();
    if (!p) return;
    setCalCtesOpen(true);
    setCalCtesLista([]);
    setCalCtesTotais(null);
    setCalCtesLoading(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_ctes_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ placa: p, seq_carregamento: seqCarregamento ?? null }) },
        true
      );
      if (res?.success) {
        setCalCtesLista(res.ctes ?? []);
        setCalCtesTotais(res.totais ?? null);
      } else {
        toast.error(res?.message || 'Erro ao carregar CT-es');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao carregar CT-es');
    } finally {
      setCalCtesLoading(false);
    }
  };

  const atualizarCtesCarregamento = async (c: Carregamento) => {
    const placa = String(c?.placa_provisoria ?? '').trim().toUpperCase();
    if (!placa || calAtualizandoCtes) return;
    const dataRef = toKey((c as any)?.data_finalizacao ?? '');
    setCalAtualizandoCtes(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'atualizar_ctes_ssw', placa, data_ref: dataRef || null }) },
        true
      );
      if (res?.success) {
        const qtdSsw = Number(res.qtd_ssw ?? 0) || 0;
        const qtdPresto = Number(res.qtd_presto ?? 0) || 0;
        const added = Number(res.added ?? 0) || 0;
        if (qtdSsw > 0 && qtdPresto !== qtdSsw && added === 0) {
          const dbg = res?.debug ?? {};
          const manCount = Number(dbg.manifestos_count ?? 0) || 0;
          const manOk = Number(dbg.manifestos_xml_ok ?? 0) || 0;
          const pairs = Number(dbg.pairs_count ?? 0) || 0;
          const found = Number(dbg.cte_found_count ?? 0) || 0;
          toast.error(`SSW ${qtdSsw} · Presto ${qtdPresto} · +0. Debug: manifestos ${manCount} (ok ${manOk}) · chaves ${pairs} · CT-es no banco ${found}.`);
        } else {
          toast.success(`CT-es atualizados: +${added} (SSW ${qtdSsw} · Presto ${qtdPresto}).`);
        }
        await onRecarregarCarregamentos();
        if (calCtesOpen) {
          await abrirCtesCarregamento(placa, (c as any)?.seq_carregamento ?? null);
        }
      } else {
        toast.error(res?.message || 'Falha ao atualizar CT-es');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Falha ao atualizar CT-es');
    } finally {
      setCalAtualizandoCtes(false);
    }
  };

  useEffect(() => {
    setCalPage(1);
  }, [diaSel]);

  const calItemsDia = React.useMemo(() => {
    return calNorm
      .filter((x) => isPresentOnDay(x as any, diaSel))
      .map((x) => x.c);
  }, [calNorm, diaSel]);

  const fmtMoney = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const fmtMoneySemSimbolo = (n: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const fmtNum = (n: number, dec: number) =>
    (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

  const fmtCompact = (v: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${Math.round(n / 1_000)}k`;
    return String(Math.round(n));
  };

  const dtLabel = (dateKey: string, timeVal: any): string => {
    const k = toKey(dateKey);
    if (!k) return '';
    const h = fmtHora(k, timeVal);
    return `${fmtDiaBrAno(k)}${h ? ` ${h}` : ''}`;
  };

  const dtLabelSemAno = (dateKey: string, timeVal: any): string => {
    const k = toKey(dateKey);
    if (!k) return '';
    const h = fmtHora(k, timeVal);
    return `${fmtDiaBr(k)}${h ? ` ${h}` : ''}`;
  };

  const calSorted = React.useMemo(() => {
    const dir = calSortDir === 'asc' ? 1 : -1;
    const now = Date.now();
    const getStr = (v: any) => String(v ?? '').trim().toUpperCase();
    const getNum = (c: Carregamento): number => {
      switch (calSortCol) {
        case 'frete': return Number(c.total_frete ?? 0) || 0;
        case 'frete_ter': return Number((c as any).vlr_frete_carreteiro ?? 0) || 0;
        case 'frete_ter_pct': {
          const total = Number(c.total_frete ?? 0) || 0;
          const ter = Number((c as any).vlr_frete_carreteiro ?? 0) || 0;
          return total > 0 ? (ter / total) * 100 : 0;
        }
        case 'merc': return Number(c.total_mercadoria ?? 0) || 0;
        case 'peso': return Number(c.total_peso ?? 0) || 0;
        case 'cub': return Number(c.total_cubagem ?? 0) || 0;
        case 'inicio': {
          const k = toKey(c.data_criacao);
          return toTs(k, c.hora_criacao) ?? 0;
        }
        case 'fim': {
          const k = toKey(c.data_finalizacao);
          return k ? (toTs(k, c.hora_finalizacao) ?? 0) : 0;
        }
        case 'tempo': {
          const iniK = toKey(c.data_criacao);
          const iniTs = toTs(iniK, c.hora_criacao);
          if (iniTs == null) return 0;
          const fimK = toKey(c.data_finalizacao);
          const fimTs = fimK ? toTs(fimK, c.hora_finalizacao) : null;
          const end = fimTs ?? now;
          return Math.max(0, Math.round((end - iniTs) / 60000));
        }
        default:
          return 0;
      }
    };
    const copy = [...calItemsDia];
    copy.sort((a, b) => {
      if (calSortCol === 'placa') return dir * getStr(a.placa_provisoria).localeCompare(getStr(b.placa_provisoria));
      if (calSortCol === 'destino') return dir * getStr(a.destino).localeCompare(getStr(b.destino));
      if (calSortCol === 'frete' || calSortCol === 'frete_ter' || calSortCol === 'frete_ter_pct' || calSortCol === 'merc' || calSortCol === 'peso' || calSortCol === 'cub' || calSortCol === 'inicio' || calSortCol === 'fim' || calSortCol === 'tempo') {
        return dir * (getNum(a) - getNum(b));
      }
      return 0;
    });
    return copy;
  }, [calItemsDia, calSortCol, calSortDir]);

  const calTotals = React.useMemo(() => {
    return calSorted.reduce(
      (acc, c) => {
        acc.frete += Number(c.total_frete ?? 0) || 0;
        acc.freteTer += Number((c as any).vlr_frete_carreteiro ?? 0) || 0;
        acc.merc += Number(c.total_mercadoria ?? 0) || 0;
        acc.peso += Number(c.total_peso ?? 0) || 0;
        acc.cub += Number(c.total_cubagem ?? 0) || 0;
        return acc;
      },
      { frete: 0, freteTer: 0, merc: 0, peso: 0, cub: 0 }
    );
  }, [calSorted]);

  const totalPages = Math.max(1, Math.ceil(calSorted.length / pageSize));
  const calPageSafe = Math.min(Math.max(calPage, 1), totalPages);

  useEffect(() => {
    if (calPage !== calPageSafe) setCalPage(calPageSafe);
  }, [calPage, calPageSafe]);

  const calPageItems = React.useMemo(() => {
    const start = (calPageSafe - 1) * pageSize;
    return calSorted.slice(start, start + pageSize);
  }, [calSorted, calPageSafe]);

  const toggleCalSort = (col: CalSortCol) => {
    if (calSortCol === col) setCalSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setCalSortCol(col);
      setCalSortDir(col === 'placa' || col === 'destino' ? 'asc' : 'desc');
    }
  };

  const CalTh = ({ col, children, align }: { col: CalSortCol; children: React.ReactNode; align?: 'left' | 'right' | 'center' }) => {
    const base =
      align === 'right' ? 'justify-end text-right' :
      align === 'center' ? 'justify-center text-center' :
      'justify-start text-left';
    return (
      <button
        type="button"
        onClick={() => toggleCalSort(col)}
        className={`w-full flex items-center gap-1 font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors ${base}`}
      >
        {children}
        {calSortCol === col
          ? (calSortDir === 'asc' ? <ChevronDown className="w-3 h-3 shrink-0 rotate-180" /> : <ChevronDown className="w-3 h-3 shrink-0" />)
          : <span className="w-3 h-3 shrink-0 flex items-center justify-center opacity-40 text-[10px] leading-none">↕</span>}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700"
          onClick={() => setCalOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Calendário de carregamentos</h3>
            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">30 dias</Badge>
            <div
              className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={`h-7 px-2 text-[11px] font-semibold ${calTipo === 'transferencia' ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                onClick={() => setCalTipo('transferencia')}
              >
                Transferência
              </button>
              <button
                type="button"
                className={`h-7 px-2 text-[11px] font-semibold border-l border-slate-200 dark:border-slate-700 ${calTipo === 'entrega' ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                onClick={() => setCalTipo('entrega')}
              >
                Entrega
              </button>
              <button
                type="button"
                className={`h-7 px-2 text-[11px] font-semibold border-l border-slate-200 dark:border-slate-700 ${calTipo === 'todos' ? 'bg-indigo-600 text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                onClick={() => setCalTipo('todos')}
              >
                Todos
              </button>
            </div>
            {loadingCarregamentosCalendario ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : null}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${calOpen ? 'rotate-180' : ''}`} />
        </button>

        {calOpen && (
          <div className="p-4 space-y-3">
            <div ref={diasScrollRef} className="flex items-center gap-2 overflow-x-auto pb-1">
              {ultimosDias.map((k) => {
                const isSel = k === diaSel;
                const count = calCountByDay.get(k) ?? 0;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`h-8 px-2 rounded-md border text-[11px] font-semibold shrink-0 flex items-center gap-2 ${
                      isSel
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                    onClick={() => setDiaSel(k)}
                    title={fmtDiaBrAno(k)}
                  >
                    <span className="font-mono">{k === hojeKey ? 'HOJE' : fmtDiaBr(k)}</span>
                    <Badge className={isSel ? 'bg-white/20 text-white text-[10px]' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[10px]'}>
                      {count}
                    </Badge>
                  </button>
                );
              })}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{fmtDiaBrAno(diaSel)}</div>
                <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                  <span>Frete: <span className="font-mono font-semibold">{fmtMoney(calTotals.frete)}</span></span>
                  <span>Merc.: <span className="font-mono font-semibold">{fmtMoney(calTotals.merc)}</span></span>
                  <span>Registros: <span className="font-mono font-semibold">{calSorted.length}</span></span>
                </div>
              </div>
              <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] text-slate-600 dark:text-slate-300">
                Clique sobre o carregamento para detalhes
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      <th className="px-3 py-2 text-left"><CalTh col="placa">Placa</CalTh></th>
                      <th className="px-3 py-2 text-left"><CalTh col="destino">Destino</CalTh></th>
                      <th className="px-3 py-2 text-right"><CalTh col="frete" align="right">Frete (R$)</CalTh></th>
                      <th className="px-3 py-2 text-right"><CalTh col="frete_ter" align="right">Frete Ter. (R$)</CalTh></th>
                      <th className="px-3 py-2 text-right"><CalTh col="frete_ter_pct" align="right">% Ter.</CalTh></th>
                      <th className="px-3 py-2 text-right"><CalTh col="merc" align="right">Mercadoria (R$)</CalTh></th>
                      <th className="px-3 py-2 text-right"><CalTh col="peso" align="right">Peso</CalTh></th>
                      <th className="px-3 py-2 text-right"><CalTh col="cub" align="right">Cubagem</CalTh></th>
                      <th className="px-3 py-2 text-left"><CalTh col="inicio">Início</CalTh></th>
                      <th className="px-3 py-2 text-left"><CalTh col="fim">Fim</CalTh></th>
                      <th className="px-3 py-2 text-right"><CalTh col="tempo" align="right">Tempo</CalTh></th>
                      <th className="px-2 py-2 text-center w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {calPageItems.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="px-3 py-6 text-center text-[11px] text-slate-500 dark:text-slate-400">Nenhum carregamento para o dia.</td>
                      </tr>
                    ) : calPageItems.map((c) => {
                      const iniK = toKey(c.data_criacao);
                      const fimK = toKey(c.data_finalizacao);
                      const iniTs = toTs(iniK, c.hora_criacao);
                      const fimTs = fimK ? toTs(fimK, c.hora_finalizacao) : null;
                      const end = fimTs ?? Date.now();
                      const durMin = iniTs != null ? Math.max(0, Math.round((end - iniTs) / 60000)) : null;
                      const isFinalizado = !!fimK;
                      const freteTotal = Number(c.total_frete ?? 0) || 0;
                      const freteTer = Number((c as any).vlr_frete_carreteiro ?? 0) || 0;
                      const pctTer = freteTotal > 0 ? Math.max(0, Math.min((freteTer / freteTotal) * 100, 999)) : 0;
                      const pctClass = pctTer < 30
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : pctTer <= 60
                          ? 'text-yellow-700 dark:text-yellow-400'
                          : pctTer <= 80
                            ? 'text-orange-700 dark:text-orange-400'
                            : 'text-red-700 dark:text-red-400';
                      return (
                        <tr
                          key={`${String((c as any).seq_carregamento ?? '')}-${String(c.placa_provisoria ?? '')}`}
                          className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer ${
                            isFinalizado ? 'bg-emerald-50/60 dark:bg-emerald-950/15' : 'bg-red-50/60 dark:bg-red-950/15'
                          }`}
                          onClick={() => abrirDetalheCarregamento(c)}
                        >
                          <td className="px-3 py-2 font-mono font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {(c as any).seq_carregamento ? (
                                <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                                  {String((c as any).seq_carregamento).padStart(6, '0')}
                                </span>
                              ) : null}
                              <span>{String(c.placa_provisoria ?? '').toUpperCase()}</span>
                              {(c as any).adiado ? (
                                <span className="text-[10px] font-semibold text-amber-800 dark:text-amber-300">ADIADO</span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {(() => {
                              const anyC = c as any;
                              const lista = String(anyC.destinos_card ?? c.destinos_card ?? '').toUpperCase();
                              if (lista) return lista;
                              return String(c.destino ?? '').toUpperCase() || '-';
                            })()}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtMoneySemSimbolo(freteTotal)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtMoneySemSimbolo(freteTer)}</td>
                          <td className={`px-3 py-2 text-right font-mono tabular-nums whitespace-nowrap ${freteTotal > 0 ? pctClass : 'text-slate-500 dark:text-slate-400'}`}>{freteTotal > 0 ? `${pctTer.toFixed(0)}%` : '—'}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtMoneySemSimbolo(Number(c.total_mercadoria ?? 0) || 0)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtNum(Number(c.total_peso ?? 0) || 0, 2)}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{fmtNum(Number(c.total_cubagem ?? 0) || 0, 3)}</td>
                          <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{iniK ? dtLabelSemAno(iniK, c.hora_criacao) : ''}</td>
                          <td className="px-3 py-2 font-mono text-slate-600 dark:text-slate-400 whitespace-nowrap">{fimK ? dtLabelSemAno(fimK, c.hora_finalizacao) : ''}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300 whitespace-nowrap">{durMin != null ? fmtDuracao(durMin) : ''}</td>
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-transparent hover:border-red-200 dark:hover:border-red-900 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-500"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onExcluirCarregamento(c);
                              }}
                              title="Excluir carregamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-700">
                      <td className="px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{fmtMoneySemSimbolo(calTotals.frete)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{fmtMoneySemSimbolo(calTotals.freteTer)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {calTotals.frete > 0 ? `${Math.max(0, Math.min((calTotals.freteTer / calTotals.frete) * 100, 999)).toFixed(0)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{fmtMoneySemSimbolo(calTotals.merc)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{fmtNum(calTotals.peso, 2)}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{fmtNum(calTotals.cub, 3)}</td>
                      <td className="px-3 py-2" colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>

              <Dialog
                open={calDetalheOpen}
                onOpenChange={(v) => {
                  setCalDetalheOpen(v);
                  if (!v) setCalDetalheItem(null);
                }}
              >
                <DialogContent className="sm:max-w-[760px]">
                  <DialogHeader>
                    <DialogTitle>
                      Carregamento{calDetalheItem?.seq_carregamento ? ` ${String(calDetalheItem.seq_carregamento).padStart(6, '0')}` : ''} · {String(calDetalheItem?.placa_provisoria ?? '').toUpperCase()}
                    </DialogTitle>
                    <DialogDescription>Detalhes do carregamento selecionado</DialogDescription>
                  </DialogHeader>
                  {(() => {
                    const c = calDetalheItem;
                    if (!c) return null;
                    const iniK = toKey(c.data_criacao);
                    const fimK = toKey(c.data_finalizacao);
                    const iniTs = toTs(iniK, c.hora_criacao);
                    const fimTs = fimK ? toTs(fimK, c.hora_finalizacao) : null;
                    const end = fimTs ?? Date.now();
                    const durMin = iniTs != null ? Math.max(0, Math.round((end - iniTs) / 60000)) : null;
                    const freteTotal = Number(c.total_frete ?? 0) || 0;
                    const freteTer = Number((c as any).vlr_frete_carreteiro ?? 0) || 0;
                    const pctTer = freteTotal > 0 ? Math.max(0, Math.min((freteTer / freteTotal) * 100, 999)) : 0;
                    const pctClass = pctTer < 30
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : pctTer <= 60
                        ? 'text-yellow-700 dark:text-yellow-400'
                        : pctTer <= 80
                          ? 'text-orange-700 dark:text-orange-400'
                          : 'text-red-700 dark:text-red-400';
                    const linhaNum = Number(c.nro_linha ?? 0) || 0;
                    const linhaNome = String(c.linha_nome ?? '').trim();
                    const linhaLabel = linhaNum > 0 ? `${String(linhaNum).padStart(3, '0')}${linhaNome ? ` - ${linhaNome}` : ''}` : '-';
                    return (
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={fimK ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}>
                            {fimK ? 'Finalizado' : 'Em andamento'}
                          </Badge>
                          {String(c.origem_criacao ?? '').trim() ? (
                            <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              Origem: {String(c.origem_criacao ?? '').trim()}
                            </Badge>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Linha</div>
                            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 truncate" title={linhaLabel}>{linhaLabel}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Destino</div>
                            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {(() => {
                                const anyC = c as any;
                                const lista = String(anyC.destinos_card ?? c.destinos_card ?? '').toUpperCase();
                                if (lista) return lista;
                                return String(c.destino ?? '').toUpperCase() || '-';
                              })()}
                            </div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 sm:col-span-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Paradas (intermediárias)</div>
                            <div className="text-sm font-mono text-slate-700 dark:text-slate-200 break-words">{String(c.paradas ?? '') || '—'}</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Frete total (R$)</div>
                            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtMoney(freteTotal)}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Frete Ter. (R$)</div>
                            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtMoney(freteTer)}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">% Ter.</div>
                            <div className={`text-sm font-mono font-semibold ${freteTotal > 0 ? pctClass : 'text-slate-500 dark:text-slate-400'}`}>{freteTotal > 0 ? `${pctTer.toFixed(0)}%` : '—'}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Mercadoria (R$)</div>
                            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtMoney(Number(c.total_mercadoria ?? 0) || 0)}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Peso (kg)</div>
                            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtNum(Number(c.total_peso ?? 0) || 0, 2)}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Cubagem (m³)</div>
                            <div className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{fmtNum(Number(c.total_cubagem ?? 0) || 0, 3)}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Início</div>
                            <div className="text-sm font-mono text-slate-800 dark:text-slate-200">{iniK ? dtLabel(iniK, c.hora_criacao) : '—'}</div>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2">
                            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">Fim</div>
                            <div className="text-sm font-mono text-slate-800 dark:text-slate-200">{fimK ? dtLabel(fimK, c.hora_finalizacao) : '—'}</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs text-slate-600 dark:text-slate-300">
                            Tempo: <span className="font-mono font-semibold">{durMin != null ? fmtDuracao(durMin) : '—'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {!fimK ? (
                              <Button
                                type="button"
                                size="sm"
                                className="bg-sky-500 hover:bg-sky-600 text-white"
                                onClick={async () => {
                                  const placa = String(c.placa_provisoria ?? '').trim().toUpperCase();
                                  if (!placa) return;
                                  const finalizou = await onFinalizarCarregamento(placa);
                                  if (finalizou) setCalDetalheOpen(false);
                                }}
                              >
                                Finalizar
                              </Button>
                            ) : null}
                            {fimK ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={calAtualizandoCtes}
                                onClick={() => void atualizarCtesCarregamento(c)}
                              >
                                {calAtualizandoCtes ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                                Atualizar CT-es
                              </Button>
                            ) : null}
                            <Button type="button" variant="outline" size="sm" onClick={() => abrirCtesCarregamento(String(c.placa_provisoria ?? ''), (c as any).seq_carregamento ?? null)}>
                              Ver CT-es
                            </Button>
                            <Button type="button" variant="outline" size="sm" onClick={() => setCalDetalheOpen(false)}>
                              Fechar
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </DialogContent>
              </Dialog>

              <Dialog open={calCtesOpen} onOpenChange={setCalCtesOpen}>
                <DialogContent className="max-w-4xl h-[80vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
                  <DialogHeader>
                    <DialogTitle>
                      CT-es · Carregamento{calDetalheItem?.seq_carregamento ? ` ${String(calDetalheItem.seq_carregamento).padStart(6, '0')}` : ''} · {String(calDetalheItem?.placa_provisoria ?? '').toUpperCase()}
                    </DialogTitle>
                    <DialogDescription>Lista de CT-es envolvidos no carregamento</DialogDescription>
                  </DialogHeader>
                  <div className="min-h-0 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="grid grid-cols-[105px_70px_45px_70px_80px_55px_minmax(0,1fr)_90px_75px_75px] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                      <span>CTRC</span>
                      <span>NFs</span>
                      <span>Carr.</span>
                      <span>Emissão</span>
                      <span>Prev. Entr.</span>
                      <span>Dest.</span>
                      <span>Pagador</span>
                      <span className="text-right">Frete (R$)</span>
                      <span className="text-right">Peso (Kg)</span>
                      <span className="text-right">Cub. (m³)</span>
                    </div>
                    <div className="min-h-0 overflow-y-auto">
                      {calCtesLoading ? (
                        <div className="px-3 py-6 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Carregando CT-es...
                        </div>
                      ) : calCtesLista.length === 0 ? (
                        <div className="px-3 py-6 text-xs text-slate-500 dark:text-slate-400 text-center">—</div>
                      ) : calCtesLista.map((cte: any, idx: number) => (
                        <div key={`${cte.seq_cte ?? idx}-${idx}`} className="grid grid-cols-[105px_70px_45px_70px_80px_55px_minmax(0,1fr)_90px_75px_75px] gap-2 px-3 py-2 text-[11px] border-b border-slate-100 dark:border-slate-800">
                          <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{cte.ctrc}</span>
                          <span className="self-center font-mono text-xs text-slate-600 dark:text-slate-400">{primeiraNfNfs(String(cte.nfs ?? '')) || '-'}</span>
                          <span className="self-center font-mono text-xs text-slate-600 dark:text-slate-400">{cte.unidade_carregamento || '-'}</span>
                          <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_emissao || '-'}</span>
                          <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_prev_ent || '-'}</span>
                          <span
                            className="self-center font-mono text-xs text-slate-600 dark:text-slate-400"
                            title={(cte.sigla_dest_principal && cte.sigla_dest_principal !== cte.sigla_dest) ? `Hub: ${cte.sigla_dest_principal}` : undefined}
                          >
                            {cte.sigla_dest ?? '-'}
                          </span>
                          <span className="self-center truncate text-slate-600 dark:text-slate-300">{cte.nome_pag || '-'}</span>
                          <span className="self-center text-right font-mono text-xs font-semibold text-indigo-700 dark:text-indigo-300">{Number(cte.vlr_frete ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{Number(cte.peso ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="self-center text-right font-mono text-xs text-slate-600 dark:text-slate-400">{Number(cte.cubagem ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                        </div>
                      ))}
                    </div>
                    {calCtesTotais && (
                      <div className="grid grid-cols-[105px_70px_45px_70px_80px_55px_minmax(0,1fr)_90px_75px_75px] gap-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        <span className="text-slate-600 dark:text-slate-300">Total</span>
                        <span className="text-slate-500 dark:text-slate-400">{calCtesLista.length} CT-es</span>
                        <span />
                        <span />
                        <span />
                        <span />
                        <span />
                        <span className="text-right font-mono text-indigo-700 dark:text-indigo-300">{Number(calCtesTotais.vlr_frete ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-right font-mono">{Number(calCtesTotais.peso ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-right font-mono">{Number(calCtesTotais.cubagem ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</span>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>

              <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-600 dark:text-slate-300">
                  Página <span className="font-mono font-semibold">{calPageSafe}</span> / <span className="font-mono font-semibold">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" className="h-8 text-[11px]" disabled={calPageSafe <= 1} onClick={() => setCalPage((p) => Math.max(1, p - 1))}>
                    Anterior
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 text-[11px]" disabled={calPageSafe >= totalPages} onClick={() => setCalPage((p) => Math.min(totalPages, p + 1))}>
                    Próxima
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Série diária</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      type="button"
                      size="sm"
                      variant={calVolMode === 'frete' ? 'default' : 'outline'}
                      className={calVolMode === 'frete' ? 'h-7 px-2 text-[11px] bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200' : 'h-7 px-2 text-[11px] dark:border-slate-700'}
                      onClick={() => setCalVolMode('frete')}
                    >
                      Frete (R$)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={calVolMode === 'peso' ? 'default' : 'outline'}
                      className={calVolMode === 'peso' ? 'h-7 px-2 text-[11px] bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200' : 'h-7 px-2 text-[11px] dark:border-slate-700'}
                      onClick={() => setCalVolMode('peso')}
                    >
                      Peso (Kg)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={calVolMode === 'cub' ? 'default' : 'outline'}
                      className={calVolMode === 'cub' ? 'h-7 px-2 text-[11px] bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200' : 'h-7 px-2 text-[11px] dark:border-slate-700'}
                      onClick={() => setCalVolMode('cub')}
                    >
                      Cubagem (m³)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={calVolMode === 'merc' ? 'default' : 'outline'}
                      className={calVolMode === 'merc' ? 'h-7 px-2 text-[11px] bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200' : 'h-7 px-2 text-[11px] dark:border-slate-700'}
                      onClick={() => setCalVolMode('merc')}
                    >
                      Valor Merc. (R$)
                    </Button>
                  </div>
                </div>
                <div className="h-[240px] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={calDailySeries} margin={{ top: 10, right: 18, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                      <XAxis dataKey="label" interval="preserveStartEnd" />
                      <YAxis tickFormatter={(v) => fmtCompact(Number(v))} />
                      <RechartsTooltip
                        contentStyle={tooltipStyle as any}
                        formatter={(v: any, name: any) => {
                          const n = Number(v);
                          const key = String(name || '');
                          if (key === 'Frete total') return [fmtMoney(n), key];
                          if (key === 'Frete Ter.') return [fmtMoney(n), key];
                          if (key === 'Valor Merc.') return [fmtMoney(n), key];
                          if (key === 'Cubagem') return [fmtNum(n, 3), `${key} (m³)`];
                          if (key === 'Peso') return [fmtNum(n, 2), `${key} (Kg)`];
                          return [String(v ?? ''), key];
                        }}
                        labelFormatter={(l: any) => `Dia ${String(l || '')}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {calVolMode === 'frete' && (
                        <Line type="monotone" dataKey="frete" name="Frete total" stroke="#4f46e5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      )}
                      {calVolMode === 'frete' && (
                        <Line type="monotone" dataKey="freteTer" name="Frete Ter." stroke="#dc2626" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      )}
                      {calVolMode === 'peso' && (
                        <Line type="monotone" dataKey="peso" name="Peso" stroke="#7c3aed" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      )}
                      {calVolMode === 'cub' && (
                        <Line type="monotone" dataKey="cub" name="Cubagem" stroke="#2563eb" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      )}
                      {calVolMode === 'merc' && (
                        <Line type="monotone" dataKey="merc" name="Valor Merc." stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Tempo médio de carregamento</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">por dia</div>
                </div>
                <div className="h-[200px] p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={calDailySeries} margin={{ top: 10, right: 18, bottom: 10, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                      <XAxis dataKey="label" interval="preserveStartEnd" />
                      <YAxis tickFormatter={(v) => fmtDuracao(Math.round(Number(v) || 0))} />
                      <RechartsTooltip
                        contentStyle={tooltipStyle as any}
                        formatter={(v: any) => {
                          const n = Number(v);
                          if (!Number.isFinite(n)) return ['—', 'Tempo médio'];
                          return [fmtDuracao(Math.round(n)), 'Tempo médio'];
                        }}
                        labelFormatter={(l: any) => `Dia ${String(l || '')}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="avgTempoMin"
                        name="Tempo médio"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 overflow-hidden relative ${importandoCarregamentos ? 'ring-2 ring-indigo-200 dark:ring-indigo-900' : ''}`}>
        {importandoCarregamentos && (
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-500 animate-pulse" />
        )}
        <button
          type="button"
          className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          onClick={() => setCarregamentosTransferOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Carregamentos Transferência</h3>
            {loadingCarregamentos && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            {importandoCarregamentos ? (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Atualizando...
              </Badge>
            ) : carregamentosTransferencia.length > 0 ? (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                {carregamentosTransferencia.length} carregamento{carregamentosTransferencia.length !== 1 ? 's' : ''}
              </Badge>
            ) : null}
            {modoApontamento && (
              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-xs flex items-center gap-1">
                <CheckSquare className="w-3 h-3" />
                Apontando para: <strong>{modoApontamento}</strong>
              </Badge>
            )}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${carregamentosTransferOpen ? 'rotate-180' : ''}`} />
        </button>

        {carregamentosTransferOpen && (
          <>
            <div className="flex flex-wrap gap-2 justify-end px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-sky-300 text-sky-700 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30"
                onClick={() => setModalImportarAberto(true)}
                disabled={importandoCarregamentos || importandoVeiculos}
              >
                <FileDown className="w-3.5 h-3.5 mr-1.5" />Imp. carregamentos
              </Button>
              <div className="inline-flex items-center gap-1.5 px-2 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Auto</span>
                <Switch checked={importacaoAutomatica} onCheckedChange={onToggleImportacaoAutomatica} disabled={importandoCarregamentos} />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">Obrigar placas reais</span>
                <Switch checked={obrigarPlacasReais} onCheckedChange={onToggleObrigarPlacasReais} disabled={importandoCarregamentos} />
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => setModalCriarModo('transferencia')}
                disabled={importandoCarregamentos}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />Carr. Manual
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-indigo-300 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                onClick={() => setModalAutomaticoModo('transferencia')}
                disabled={importandoCarregamentos}
              >
                <ListTree className="w-3.5 h-3.5 mr-1.5" />Carr. Automático
              </Button>
            </div>

            {carregamentosTransferencia.length === 0 && !loadingCarregamentos ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                <Truck className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">Nenhum carregamento de transferência em andamento</p>
                <p className="text-xs mt-0.5">Clique em "Carr. Manual" para começar</p>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {carregamentosTransferencia.map((c, i) => (
                  <CardCarregamento
                    key={i}
                    carregamento={c}
                    unidadeAtual={sigla}
                    todosCtes={todosCtes}
                    cteKeysDisponiveisTransferencia={cteKeysDisponiveisTransferencia}
                    cteKeysDisponiveisEntrega={cteKeysDisponiveisEntrega}
                    veiculoCapacidades={undefined}
                    modoApontamento={modoApontamento}
                    confirmar={confirmar}
                    onIniciarApontamento={onIniciarApontamento}
                    onCancelarApontamento={onCancelarApontamento}
                    onExcluirCarregamento={onExcluirCarregamento}
                    onRemoverCte={onRemoverCte}
                    onCarregarSSW={onCarregarSSW}
                    onCarregarRota={onCarregarRota}
                    loadingRota={loadingRota}
                    rotaCarregamentoPlaca={rotaCarregamentoPlaca}
                    onRecarregarCarregamentos={onRecarregarCarregamentos}
                    onImportarCarregamentos={onImportarCarregamentos}
                    importandoCarregamentos={importandoCarregamentos}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 overflow-hidden">
        <button
          type="button"
          className="w-full flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          onClick={() => setCarregamentosEntregaOpen((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Carregamentos de Entrega</h3>
            {loadingCarregamentos && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
            {carregamentosEntrega.length > 0 ? (
              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                {carregamentosEntrega.length} carregamento{carregamentosEntrega.length !== 1 ? 's' : ''}
              </Badge>
            ) : null}
          </div>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${carregamentosEntregaOpen ? 'rotate-180' : ''}`} />
        </button>

        {carregamentosEntregaOpen && (
          <>
            <div className="flex flex-wrap gap-2 justify-end px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-red-300 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                onClick={() => { void handleExcluirTodosEntrega(); }}
                disabled={excluindoTodosEntrega || carregamentosEntrega.length === 0}
                title={carregamentosEntrega.length === 0 ? 'Nenhum carregamento de entrega em andamento' : 'Excluir todos os carregamentos de entrega'}
              >
                {excluindoTodosEntrega ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                Excluir todos
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-emerald-300 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => setModalCriarModo('entrega')}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />Carr. Manual
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-indigo-300 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                onClick={() => setModalAutomaticoModo('entrega')}
                disabled={loadingEntregaAuto}
              >
                {loadingEntregaAuto ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ListTree className="w-3.5 h-3.5 mr-1.5" />}
                Carr. Automático
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-slate-300 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={() => setCapDialogOpen(true)}
              >
                <Gauge className="w-3.5 h-3.5 mr-1.5" />Ajustar capacidades
              </Button>
              <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[11px] h-8 px-2 flex items-center">
                Arraste um card e solte em outro para juntar setores
              </Badge>
            </div>

            {carregamentosEntrega.length === 0 && !loadingCarregamentos ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
                <Truck className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm">Nenhum carregamento de entrega em andamento</p>
                <p className="text-xs mt-0.5">Clique em "Carr. Manual" para começar</p>
              </div>
            ) : (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {carregamentosEntrega.map((c, i) => {
                  const placa = String(c.placa_provisoria ?? '').trim().toUpperCase();
                  const isOver = !!dragEntregaOver && placa === dragEntregaOver;
                  const isDragging = !!dragEntregaOrigem && placa === dragEntregaOrigem;
                  return (
                    <div
                      key={i}
                      draggable
                      onDragStart={(e) => {
                        setDragEntregaOrigem(placa || null);
                        setDragEntregaOver(null);
                        try { e.dataTransfer.setData('text/plain', placa); } catch {}
                        try { e.dataTransfer.effectAllowed = 'move'; } catch {}
                      }}
                      onDragEnd={() => {
                        setDragEntregaOrigem(null);
                        setDragEntregaOver(null);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!placa) return;
                        if (dragEntregaOrigem && placa !== dragEntregaOrigem) setDragEntregaOver(placa);
                      }}
                      onDragLeave={() => setDragEntregaOver(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        const placaDest = placa;
                        const placaOrig = String(dragEntregaOrigem ?? '').trim().toUpperCase() || String(e.dataTransfer.getData('text/plain') ?? '').trim().toUpperCase();
                        setDragEntregaOver(null);
                        setDragEntregaOrigem(null);
                        if (!placaOrig || !placaDest || placaOrig === placaDest) return;
                        void fundirEntrega(placaOrig, placaDest);
                      }}
                      className={`${isOver ? 'ring-2 ring-emerald-400 rounded-xl' : ''} ${isDragging ? 'opacity-50' : ''}`}
                      title="Arraste e solte sobre outro carregamento para juntar setores"
                    >
                    <CardCarregamento
                      carregamento={c}
                      unidadeAtual={sigla}
                      todosCtes={todosCtes}
                      cteKeysDisponiveisTransferencia={cteKeysDisponiveisTransferencia}
                      cteKeysDisponiveisEntrega={cteKeysDisponiveisEntrega}
                      veiculoCapacidades={veiculoCapacidades}
                      modoApontamento={modoApontamento}
                      confirmar={confirmar}
                      onIniciarApontamento={onIniciarApontamento}
                      onCancelarApontamento={onCancelarApontamento}
                      onExcluirCarregamento={onExcluirCarregamento}
                      onRemoverCte={onRemoverCte}
                      onCarregarSSW={onCarregarSSW}
                      onCarregarRota={onCarregarRota}
                      loadingRota={loadingRota}
                      rotaCarregamentoPlaca={rotaCarregamentoPlaca}
                      onRecarregarCarregamentos={onRecarregarCarregamentos}
                      onImportarCarregamentos={onImportarCarregamentos}
                      importandoCarregamentos={importandoCarregamentos}
                    />
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={capDialogOpen} onOpenChange={setCapDialogOpen}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Ajustar capacidades por tipo</DialogTitle>
            <DialogDescription>Define a capacidade padrão (Ton / m³) para cada tipo de veículo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {capLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : capItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500">Nenhum tipo de veículo encontrado.</div>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Tipo</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 w-[160px]">Capacidade (Ton)</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 w-[160px]">Capacidade (m³)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {capItems.map((it, idx) => (
                      <tr key={it.tipo} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">{it.tipo}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={it.capacidade_ton}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCapItems((prev) => prev.map((p, i) => (i === idx ? { ...p, capacidade_ton: v } : p)));
                            }}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            value={it.capacidade_m3}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCapItems((prev) => prev.map((p, i) => (i === idx ? { ...p, capacidade_m3: v } : p)));
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCapDialogOpen(false)} disabled={capSaving}>
              Fechar
            </Button>
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={salvarCapacidades} disabled={capLoading || capSaving}>
              {capSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resumoEntregaOpen} onOpenChange={setResumoEntregaOpen}>
        <DialogContent className="sm:max-w-[760px]">
          <DialogHeader>
            <DialogTitle>Resumo · Carregamentos de Entrega</DialogTitle>
            <DialogDescription>Resultado da geração automática por setor.</DialogDescription>
          </DialogHeader>
          {(() => {
            const itens = Array.isArray(resumoEntregaItens) ? resumoEntregaItens : [];
            const totCar = itens.length;
            const totIns = itens.reduce((s, it) => s + (Number(it.inseridos ?? 0) || 0), 0);
            const totFora = itens.reduce((s, it) => s + (Number(it.fora ?? 0) || 0), 0);
            return (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">Carregamentos: {totCar}</Badge>
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">Inseridos: {totIns}</Badge>
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">Fora: {totFora}</Badge>
                </div>
                {itens.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500">Nenhum resultado.</div>
                ) : (
                  <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Setor</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300">Placa</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 w-[110px]">Inseridos</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 w-[90px]">Fora</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 w-[200px]">Veículo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itens.map((it, idx) => (
                          <tr key={`${it.setor}-${it.placa}-${idx}`} className="border-b border-slate-100 dark:border-slate-800">
                            <td className="px-3 py-2 font-mono text-xs text-slate-800 dark:text-slate-200">{String(it.setor ?? '').trim().toUpperCase()}</td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{String(it.placa ?? '').trim().toUpperCase()}</td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-slate-200">{Number(it.inseridos ?? 0) || 0}</td>
                            <td className="px-3 py-2 text-right font-semibold text-amber-700 dark:text-amber-300">{Number(it.fora ?? 0) || 0}</td>
                            <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">{String(it.cap_tipo ?? '')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setResumoEntregaOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {modalCriarModo && (
        <ModalCriarCarregamento
          modo={modalCriarModo}
          onConfirmar={handleCriar}
          onFechar={() => setModalCriarModo(null)}
        />
      )}
      {modalAutomaticoModo === 'entrega' && (
        <ModalCarregamentoAutomaticoEntrega
          onFechar={() => setModalAutomaticoModo(null)}
          setores={gruposSetorEntrega}
          onConfirmar={handleCarregarAutomaticoEntrega}
        />
      )}
      {modalAutomaticoModo === 'transferencia' && (
        <ModalCarregamentoAutomatico
          onConfirmar={onCarregamentoAutomatico}
          onFechar={() => setModalAutomaticoModo(null)}
          confirmar={confirmar}
          perguntarTexto={perguntarTexto}
          linhasOrigem={linhasOrigem}
          loadingLinhasOrigem={loadingLinhasOrigem}
          carregamentos={carregamentosTransferNaoSimulados}
          siglaUnidade={sigla}
          totalsPorUnidadeParaLinhas={totalsPorUnidadeParaLinhas}
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
  const location = useLocation();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { confirm: confirmar, dialog: confirmarDialog } = useConfirmDialog();
  const { prompt: perguntarTexto, dialog: perguntarTextoDialog } = usePromptDialog();

  const [pageVisible, setPageVisible] = useState(() => {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  });

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const unidadeLogada = user?.unidade_atual || user?.unidade || '';
  const sigla = unidadeLogada.trim().toUpperCase();
  const isMTZ = sigla === 'MTZ' || sigla === '';
  const dominioUsuario = (user?.domain ?? '').trim().toUpperCase();
  const unidadeAtual = sigla;
  const painelAtivo = pageVisible && location.pathname.includes('/dashboards/disponiveis');

  const shouldIgnoreDestinoRVE = (destinoRaw: string | null | undefined) => {
    if (dominioUsuario !== 'RVE') return false;
    const destino = (destinoRaw ?? '').trim().toUpperCase();
    if (!destino) return false;
    if (DESTINOS_IGNORADOS_RVE.has(destino)) return true;
    if (unidadeAtual === 'SAO' && destino === 'CAM') return true;
    if (unidadeAtual === 'CAM' && destino === 'SAO') return true;
    return false;
  };

  type FiltrosDisponiveis = {
    unidadeDestino: string[];
    periodoEmissaoInicio: string;
    periodoEmissaoFim: string;
    periodoPrevisaoInicio: string;
    periodoPrevisaoFim: string;
    tempoArmazemDe: string;
    tempoArmazemAte: string;
  };

  const filtrosVazios: FiltrosDisponiveis = {
    unidadeDestino: [],
    periodoEmissaoInicio: '',
    periodoEmissaoFim: '',
    periodoPrevisaoInicio: '',
    periodoPrevisaoFim: '',
    tempoArmazemDe: '',
    tempoArmazemAte: '',
  };

  const [showFilters, setShowFilters] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [filters, setFilters] = useState<FiltrosDisponiveis>(filtrosVazios);
  const [tempFilters, setTempFilters] = useState<FiltrosDisponiveis>(filtrosVazios);

  useEffect(() => {
    if (showFilters) setTempFilters(filters);
  }, [showFilters, filters]);

  const [linhasOrigem, setLinhasOrigem] = useState<LinhaCarregamento[]>([]);
  const [loadingLinhasOrigem, setLoadingLinhasOrigem] = useState(false);
  const [linhasHojeDialogOpen, setLinhasHojeDialogOpen] = useState(false);
  const [carregandoNroLinhaHoje, setCarregandoNroLinhaHoje] = useState<number | null>(null);
  const [adiandoNroLinhaHoje, setAdiandoNroLinhaHoje] = useState<number | null>(null);
  const [carregandoTodasLinhasHoje, setCarregandoTodasLinhasHoje] = useState(false);
  const [linhasHojeSortKey, setLinhasHojeSortKey] = useState<'nro' | 'nome' | 'dest' | 'inter' | 'km'>('nro');
  const [linhasHojeSortDir, setLinhasHojeSortDir] = useState<'asc' | 'desc'>('asc');
  const [linhasHojeStatus, setLinhasHojeStatus] = useState<Record<number, LinhaHojeStatus>>({});
  const [loadingLinhasHojeStatus, setLoadingLinhasHojeStatus] = useState(false);
  const [centralizadoraDialogOpen, setCentralizadoraDialogOpen] = useState(false);
  const [centralizadoraSigla, setCentralizadoraSigla] = useState('');
  const [centralizadoraUnidades, setCentralizadoraUnidades] = useState<string[]>([]);

  const [resumoHojeDialogOpen, setResumoHojeDialogOpen] = useState(false);
  const [resumoHojePlaca, setResumoHojePlaca] = useState('');
  const [resumoHojeUnidades, setResumoHojeUnidades] = useState<{ unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[]>([]);
  const [resumoHojeDestinos, setResumoHojeDestinos] = useState<{ unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[]>([]);
  const [resumoHojeMassaDialogOpen, setResumoHojeMassaDialogOpen] = useState(false);
  const [resumoHojeMassaItens, setResumoHojeMassaItens] = useState<ResumoMassaLinha[]>([]);

  const [dados, setDados] = useState<DadosTransferencia | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInicial, setLoadingInicial] = useState(false);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<string>('');

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
          { method: 'POST', body: JSON.stringify({ acao: 'listar_linhas', unidade: unidadeAtual }) },
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

  const { diaCarregaKeyHoje, diaCarregaKeyOntem } = React.useMemo(() => {
    const d = new Date().getDay();
    const map = [
      'carrega_dom',
      'carrega_seg',
      'carrega_ter',
      'carrega_qua',
      'carrega_qui',
      'carrega_sex',
      'carrega_sab',
    ] as const;
    const hoje = map[d] ?? 'carrega_seg';
    const ontem = map[(d + 6) % 7] ?? 'carrega_seg';
    return { diaCarregaKeyHoje: hoje, diaCarregaKeyOntem: ontem };
  }, []);

  const linhasCarregamHoje = React.useMemo(() => {
    const filtradas = (linhasOrigem ?? []).filter((l) => {
      const carregaHoje = ((l as any)[diaCarregaKeyHoje] ?? true) as any;
      const carregaOntem = ((l as any)[diaCarregaKeyOntem] ?? true) as any;
      return !!carregaHoje || !!carregaOntem;
    });
    const seen = new Set<number>();
    return filtradas.filter((l) => {
      const n = (l.nro_linha ?? 0) as number;
      if (!Number.isFinite(n) || n <= 0) return true;
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    });
  }, [linhasOrigem, diaCarregaKeyHoje, diaCarregaKeyOntem]);

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
  const [carregamentosCalendario, setCarregamentosCalendario] = useState<Carregamento[]>([]);
  const [loadingCarregamentosCalendario, setLoadingCarregamentosCalendario] = useState(false);
  const [modoApontamento, setModoApontamento] = useState<string | null>(null);
  const [ctesSelecionados, setCtesSelecionados] = useState<Map<number, Cte>>(new Map());
  const [importandoCarregamentos, setImportandoCarregamentos] = useState(false);
  const [importacaoAutomatica, setImportacaoAutomatica] = useState(true);
  const [obrigarPlacasReais, setObrigarPlacasReais] = useState(false);
  const [carregamentosTransferOpen, setCarregamentosTransferOpen] = useState(false);
  const [carregamentosEntregaOpen, setCarregamentosEntregaOpen] = useState(false);
  const obrigarPlacasReaisRef = useRef(false);
  useEffect(() => { obrigarPlacasReaisRef.current = obrigarPlacasReais; }, [obrigarPlacasReais]);
  const importandoCarregamentosRef = useRef(false);
  const [importandoVeiculos, setImportandoVeiculos] = useState(false);
  const importandoVeiculosRef = useRef(false);

  const obrigarPlacasReaisStorageKey = React.useMemo(() => {
    const dom = (dominioUsuario ?? '').trim().toUpperCase();
    const userKey = String((user as any)?.id ?? (user as any)?.username ?? (user as any)?.login ?? '').trim();
    if (!dom || !userKey) return '';
    return `presto:${dom}:${userKey}:disponiveis:obrigar_placas_reais`;
  }, [dominioUsuario, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!obrigarPlacasReaisStorageKey) { setObrigarPlacasReais(false); return; }
    const raw = window.localStorage.getItem(obrigarPlacasReaisStorageKey);
    const ativo = raw === '1' || raw === 'true' || raw === 'S';
    setObrigarPlacasReais(ativo);
  }, [obrigarPlacasReaisStorageKey]);

  const handleToggleObrigarPlacasReais = useCallback((ativo: boolean) => {
    setObrigarPlacasReais(ativo);
    if (typeof window === 'undefined') return;
    if (!obrigarPlacasReaisStorageKey) return;
    window.localStorage.setItem(obrigarPlacasReaisStorageKey, ativo ? '1' : '0');
  }, [obrigarPlacasReaisStorageKey]);

  const [hubCarregamentoPlaca, setHubCarregamentoPlaca] = useState<string | null>(null);
  const [dadosHub, setDadosHub] = useState<DadosHub | null>(null);
  const [loadingHub, setLoadingHub] = useState(false);
  const [hubEtapa, setHubEtapa] = useState<'sugestao' | 'confirmar' | null>(null);
  const [hubModalAberto, setHubModalAberto] = useState(false);
  const [hubModalCarregamento, setHubModalCarregamento] = useState<Carregamento | null>(null);
  const [hubModalDestino, setHubModalDestino] = useState('');
  const [hubModalUnidadesStr, setHubModalUnidadesStr] = useState('');

  const [rotaModalAberto, setRotaModalAberto] = useState(false);
  const [rotaCarregamento, setRotaCarregamento] = useState<Carregamento | null>(null);
  const [rotaDados, setRotaDados] = useState<any>(null);
  const [rotaCarregamentoPlaca, setRotaCarregamentoPlaca] = useState<string | null>(null);
  const [loadingRota, setLoadingRota] = useState(false);

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

  const cteKeysDisponiveisTransferencia = React.useMemo(() => {
    const s = new Set<string>();
    if (dados?.ctes) {
      for (const c of dados.ctes) {
        const k = cteKey(c);
        if (k) s.add(k);
      }
    }
    return s;
  }, [dados]);

  const cteKeysDisponiveisEntrega = React.useMemo(() => {
    const s = new Set<string>();
    if (dadosEntrega?.ctes) {
      for (const c of dadosEntrega.ctes) {
        const k = cteKey(c);
        if (k) s.add(k);
      }
    }
    return s;
  }, [dadosEntrega]);

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
        const d = res.data;
        const ctes = Array.isArray(d?.ctes)
          ? d.ctes.map((c: any) => ({
              ...c,
              emissao: String(c?.emissao ?? ''),
              chegadaUnid: String(c?.chegadaUnid ?? c?.data_chegada_unid ?? ''),
              unidAtual: String(c?.unidAtual ?? c?.unid_atual ?? ''),
            }))
          : [];
        setDados({ ...d, ctes });
        setUltimaAtualizacao(res.data.geradoEm);
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
        { method: 'POST', cache: 'no-store', body: JSON.stringify({ sigla: s, _nonce: Date.now() }) },
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
        const d = res.data;
        const ctes = Array.isArray(d?.ctes)
          ? d.ctes.map((c: any) => ({
              ...c,
              emissao: String(c?.emissao ?? ''),
              chegadaUnid: String(c?.chegadaUnid ?? c?.data_chegada_unid ?? ''),
              unidAtual: String(c?.unidAtual ?? c?.unid_atual ?? ''),
            }))
          : [];
        setDadosEntrega({ ...d, ctes });
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
        { method: 'POST', body: JSON.stringify({ unidade: sigla }) },
        true
      );
      if (res.success) {
        const lista = Array.isArray(res.carregamentos) ? res.carregamentos : [];
        setCarregamentos(lista.filter((c: any) => !(c?.data_finalizacao ?? c?.dataFinalizacao)));
      } else {
        toast.error(res.message || 'Erro ao buscar carregamentos.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao buscar carregamentos.');
    }
    finally { setLoadingCarregamentos(false); }
  }, [sigla]);

  const carregarCarregamentosCalendario = useCallback(async () => {
    setLoadingCarregamentosCalendario(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_carregamentos.php`,
        { method: 'POST', body: JSON.stringify({ unidade: sigla, modo: 'calendario', dias: 30 }) },
        true
      );
      if (res.success) {
        const lista = Array.isArray(res.carregamentos) ? res.carregamentos : [];
        setCarregamentosCalendario(lista);
      } else {
        toast.error(res.message || 'Erro ao buscar calendário de carregamentos.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao buscar calendário de carregamentos.');
    } finally {
      setLoadingCarregamentosCalendario(false);
    }
  }, [sigla]);

  useEffect(() => {
    if (!painelAtivo) return;
    if (!sigla || isMTZ) return;
    void carregarCarregamentosCalendario();
  }, [painelAtivo, sigla, isMTZ, carregamentos, carregarCarregamentosCalendario]);

  const importarCarregamentosBase = useCallback(async (opts?: { silent?: boolean }) => {
    if (importandoCarregamentosRef.current) return { success: false, message: 'Importação já em andamento.' };
    importandoCarregamentosRef.current = true;
    setImportandoCarregamentos(true);
    try {
      const obrigarAtivo = obrigarPlacasReaisRef.current ? true : false;
      const body: any = { obrigar_placas_reais: obrigarAtivo };
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/importar_carregamentos_ssw.php`,
        { method: 'POST', body: JSON.stringify(body) },
        true
      );
      if (res?.success) {
        await carregarCarregamentos();
      }
      const faltantes = Array.isArray((res as any)?.veiculos_faltantes) ? (res as any).veiculos_faltantes : [];
      if (obrigarAtivo && faltantes.length > 0) {
        if (opts?.silent) {
          const lista = faltantes.slice(0, 10).join(', ');
          const resto = faltantes.length > 10 ? ` (+${faltantes.length - 10} outras)` : '';
          toast.info(`Placas ignoradas por falta de cadastro: ${lista}${resto}`);
        }
      }
      return res;
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erro ao importar carregamentos do SSW' };
    } finally {
      importandoCarregamentosRef.current = false;
      setImportandoCarregamentos(false);
    }
  }, [carregarCarregamentos]);

  const handleImportarCarregamentos = useCallback(async (opts?: { silent?: boolean }) => {
    return importarCarregamentosBase(opts);
  }, [importarCarregamentosBase]);

  const handleImportarVeiculos = useCallback(async () => {
    if (importandoVeiculosRef.current) return { success: false, message: 'Importação já em andamento.' };
    importandoVeiculosRef.current = true;
    setImportandoVeiculos(true);
    try {
      toast.info('Importando veículos do SSW...');
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/importar_carregamentos_ssw.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'IMPORTAR_VEICULOS' }) },
        true
      );
      if (res?.success) {
        await Promise.all([
          carregar(),
          carregarEntrega(),
          carregarCarregamentos(),
          carregarCarregamentosCalendario(),
        ]);
        toast.success('Veículos importados com sucesso.');
      } else {
        toast.error(res?.message ? String(res.message) : 'Erro ao importar veículos');
        if (res?.details) {
          try { console.error('IMPORTAR_VEICULOS details:', res.details); } catch {}
        }
      }
      return res;
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao importar veículos');
      return { success: false, message: e?.message || 'Erro ao importar veículos' };
    } finally {
      importandoVeiculosRef.current = false;
      setImportandoVeiculos(false);
    }
  }, [carregar, carregarEntrega, carregarCarregamentos, carregarCarregamentosCalendario]);

  const importarCarregamentosSSWObrigatorio = useCallback(async () => {
    const res = await handleImportarCarregamentos();
    if (!res?.success) {
      await carregarCarregamentos();
    }
    return res;
  }, [handleImportarCarregamentos, carregarCarregamentos]);

  useEffect(() => {
    if (!painelAtivo) return;
    if (abaAtiva === 'entrega') return;
    if (!carregamentosTransferOpen) return;
    if (!importacaoAutomatica) return;
    const id = setInterval(() => { void handleImportarCarregamentos({ silent: true }); }, 300000);
    return () => clearInterval(id);
  }, [abaAtiva, painelAtivo, carregamentosTransferOpen, importacaoAutomatica, handleImportarCarregamentos]);

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

  const handleCarregamentoAutomaticoEntrega = useCallback(async (placa: string, setores: string[]) => {
    const placaOk = String(placa ?? '').trim().toUpperCase();
    const setoresOk = (Array.isArray(setores) ? setores : [])
      .map((s) => String(s ?? '').trim().toUpperCase())
      .filter(Boolean);

    if (!placaOk) return { ok: false, message: 'Informe a placa/identificação.' };

    const parsePrevEntTs = (v: string): number => {
      const s = String(v ?? '').trim();
      if (!s || s === '—') return Number.POSITIVE_INFINITY;
      const m = s.match(/^(\d{2})\/(\d{2})(?:\/(\d{2}|\d{4}))?$/);
      if (!m) return Number.POSITIVE_INFINITY;
      const dia = parseInt(m[1], 10);
      const mes = parseInt(m[2], 10);
      const anoRaw = m[3];
      const ano = !anoRaw
        ? new Date().getFullYear()
        : (anoRaw.length === 2 ? 2000 + parseInt(anoRaw, 10) : parseInt(anoRaw, 10));
      const d = new Date(ano, mes - 1, dia, 0, 0, 0, 0);
      const ts = d.getTime();
      return Number.isNaN(ts) ? Number.POSITIVE_INFINITY : ts;
    };

    const ctesBase = (() => {
      const previsaoInicio = parseDataISO(filters.periodoPrevisaoInicio);
      const previsaoFim = parseDataISO(filters.periodoPrevisaoFim);
      const tempoArmazemDe = (() => {
        const s = (filters.tempoArmazemDe ?? '').trim();
        if (!s) return null;
        const n = parseInt(s, 10);
        return Number.isFinite(n) ? Math.max(0, n) : null;
      })();
      const tempoArmazemAte = (() => {
        const s = (filters.tempoArmazemAte ?? '').trim();
        if (!s) return null;
        const n = parseInt(s, 10);
        return Number.isFinite(n) ? Math.max(0, n) : null;
      })();
      const list = dadosEntrega?.ctes ? [...dadosEntrega.ctes] : [];
      return list.filter((cte) => {
        if (shouldIgnoreDestinoRVE(cte.unidadeDest)) return false;
        if (previsaoInicio || previsaoFim) {
          if (!matchesRangeBR(cte.prevEnt, previsaoInicio, previsaoFim)) return false;
        }
        if (tempoArmazemDe !== null || tempoArmazemAte !== null) {
          if (cte.emTransito) return false;
          const dias = diasNoArmazem(cte.chegadaUnid);
          if (dias === null) return false;
          if (tempoArmazemDe !== null && dias < tempoArmazemDe) return false;
          if (tempoArmazemAte !== null && dias > tempoArmazemAte) return false;
        }
        return true;
      });
    })();
    const ctesSel = setoresOk.length === 0
      ? ctesBase
      : ctesBase.filter((c) => {
        const setorCte = String(c.setor ?? '').trim().toUpperCase();
        return setoresOk.some((s) => setorCte.includes(s));
      });

    if (ctesSel.length === 0) return { ok: false, message: 'Nenhum CT-e encontrado para os setores selecionados.' };

    try {
      let capsNorm: { tipo: string; ton: number; m3: number }[] = [];
      try {
        const capsRes = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/veiculo_capacidade.php`,
          { method: 'POST', body: JSON.stringify({ acao: 'listar' }) },
          true
        );
        if (capsRes?.success && Array.isArray(capsRes.items)) {
          capsNorm = capsRes.items
            .map((it: any) => ({
              tipo: String(it?.tipo ?? '').trim().toUpperCase(),
              ton: Number(String(it?.capacidade_ton ?? it?.ton ?? '').replace(',', '.')) || 0,
              m3: Number(String(it?.capacidade_m3 ?? it?.m3 ?? '').replace(',', '.')) || 0,
            }))
            .filter((c: any) => !!c.tipo && (c.ton > 0 || c.m3 > 0))
            .sort((a: any, b: any) => (a.ton - b.ton) || (a.m3 - b.m3) || a.tipo.localeCompare(b.tipo));
        }
      } catch (e: any) {
      }

      const maxCap = capsNorm.length > 0 ? capsNorm[capsNorm.length - 1] : null;
      const capMaxKg = maxCap && maxCap.ton > 0 ? maxCap.ton * 1000 : null;
      const capMaxM3 = maxCap && maxCap.m3 > 0 ? maxCap.m3 : null;

      const ctesOrdenados = [...ctesSel].sort((a, b) => {
        const ta = parsePrevEntTs(String((a as any).prevEnt ?? ''));
        const tb = parsePrevEntTs(String((b as any).prevEnt ?? ''));
        return (ta - tb) || (Number(a.nroCte ?? 0) - Number(b.nroCte ?? 0));
      });

      const ctesDentro: any[] = [];
      const ctesFora: any[] = [];
      let pesoKg = 0;
      let cubM3 = 0;
      for (const c of ctesOrdenados) {
        const wKg = parsePeso(String((c as any).peso ?? '0'));
        const vM3 = parseCubagem(String((c as any).cubagem ?? '0'));
        const novoPeso = pesoKg + (Number.isFinite(wKg) ? wKg : 0);
        const novoCub = cubM3 + (Number.isFinite(vM3) ? vM3 : 0);
        const okPeso = capMaxKg === null ? true : novoPeso <= (capMaxKg + 0.0001);
        const okCub = capMaxM3 === null ? true : novoCub <= (capMaxM3 + 0.0001);
        if (okPeso && okCub) {
          ctesDentro.push(c);
          pesoKg = novoPeso;
          cubM3 = novoCub;
        } else {
          ctesFora.push(c);
        }
      }

      const pesoTonSel = pesoKg / 1000;
      const capEscolhida = capsNorm.length > 0
        ? (capsNorm.find((c) => (c.ton <= 0 || c.ton >= pesoTonSel) && (c.m3 <= 0 || c.m3 >= cubM3)) ?? null)
        : null;
      const capAplicada = capEscolhida ?? maxCap;
      const capTipoResumo = capEscolhida
        ? capEscolhida.tipo
        : (maxCap ? maxCap.tipo : '');

      const criar = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'criar', placa: placaOk, destino: '', paradas: setoresOk.join(', '), origem_criacao: 'AUTO' }) },
        true
      );
      if (!criar?.success) return { ok: false, message: criar?.message || 'Erro ao criar carregamento.' };
      const seqCarregamento = Number(criar?.seq_carregamento ?? 0) || 0;

      const ctesPayload = ctesDentro.map((c) => ({
        nroCte: c.nroCte,
        serCte: c.serCte,
        setor: (c as any).setor ?? '',
        emissao: c.emissao ?? '',
        prevEnt: c.prevEnt ?? '',
        remetente: '',
        destinatario: c.destinatario ?? '',
        pagador: c.pagador ?? '',
        cidade: c.cidade ?? '',
        vlrNf: c.vlrMerc ?? '',
        frete: c.frete ?? '',
        peso: c.peso ?? '',
        cubagem: c.cubagem ?? '',
        qtdeVol: c.qtdeVol ?? '',
        unidadeDest: unidadeAtual,
        unidadeCarregamento: unidadeAtual,
      }));

      const add = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'adicionar_ctes', placa: placaOk, ctes: ctesPayload }) },
        true
      );
      if (!add?.success) return { ok: false, message: add?.message || 'Erro ao adicionar CT-es.' };
      const adicionados = Number(add?.adicionados ?? 0) || 0;
      const ignorados = Number(add?.ignorados ?? 0) || 0;

      if (adicionados <= 0) {
        await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
          { method: 'POST', body: JSON.stringify({ acao: 'deletar_carregamento', placa: placaOk, seq_carregamento: seqCarregamento || undefined }) },
          true
        );
        await carregarCarregamentos();
        return { ok: true, total: 0, fora: ctesSel.length, cap_tipo: capTipoResumo };
      }

      if (capAplicada && (capAplicada.ton > 0 || capAplicada.m3 > 0)) {
        try {
          await apiFetch(
            `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
            { method: 'POST', body: JSON.stringify({ acao: 'atualizar_capacidade', placa: placaOk, seq_carregamento: seqCarregamento || undefined, cap_ton: capAplicada.ton || null, cap_m3: capAplicada.m3 || null, destino: '', paradas: setoresOk.join(', '), nro_linha: null }) },
            true
          );
        } catch (e: any) {
        }
      }

      await carregarCarregamentos();
      return { ok: true, total: adicionados, fora: ctesFora.length + ignorados, cap_tipo: capTipoResumo };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Erro ao carregar setores.' };
    }
  }, [carregarCarregamentos, dadosEntrega, filters.periodoPrevisaoInicio, filters.periodoPrevisaoFim, filters.tempoArmazemDe, filters.tempoArmazemAte, unidadeAtual]);

  const handleFinalizarCarregamento = useCallback(async (placa: string) => {
    const ok = await confirmar({
      title: 'Finalizar carregamento?',
      description: `Finalizar o carregamento "${placa}"?`,
      confirmText: 'Finalizar',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return false;
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'finalizar_carregamento', placa }) },
        true
      );
      if (res.success) {
        toast.success(`Carregamento ${placa} finalizado.`);
        if (modoApontamento === placa) setModoApontamento(null);
        await carregarCarregamentos();
        return true;
      } else {
        toast.error(res.message || 'Erro ao finalizar carregamento');
        return false;
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao finalizar');
      return false;
    }
  }, [carregarCarregamentos, modoApontamento, confirmar]);

  const handleExcluirCarregamento = useCallback(async (carregamento: Carregamento) => {
    const placa = String(carregamento?.placa_provisoria ?? '').trim().toUpperCase();
    const seqCarregamento = Number((carregamento as any)?.seq_carregamento ?? 0) || 0;
    if (!placa && seqCarregamento <= 0) return false;
    const ok = await confirmar({
      title: 'Excluir carregamento?',
      description: `Excluir o carregamento "${placa}" da base?\n\nEssa ação remove o carregamento e não pode ser desfeita.`,
      confirmText: 'Excluir',
      cancelText: 'Cancelar',
      variant: 'destructive',
    });
    if (!ok) return false;
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'deletar_carregamento', placa, seq_carregamento: seqCarregamento || undefined }) },
        true
      );
      if (res.success) {
        toast.success(`Carregamento ${placa} excluído.`);
        if (modoApontamento === placa) setModoApontamento(null);
        await carregarCarregamentos();
        return true;
      } else {
        toast.error(res.message || 'Erro ao excluir carregamento');
        return false;
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao excluir');
      return false;
    }
  }, [carregarCarregamentos, modoApontamento, confirmar]);

  const handleCarregamentoAutomatico = useCallback(async (placa: string, unidadeDestino: string, paradas: string[], nroLinha?: number, opts?: { recarregar?: boolean; silent?: boolean; forcarMinFrete?: boolean }): Promise<{
    ok: boolean;
    placa?: string;
    message?: string;
    resumo?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
    resumoDestinos?: { unidade: string; qtd: number; peso_kg?: number; cubagem?: number; frete?: number }[];
    destino?: string;
    paradas?: string[];
    nro_linha?: number;
    sobras?: { qtd: number; peso_kg?: number; cubagem?: number; frete?: number };
    capacidade?: { peso_kg?: number; cubagem?: number };
    uso?: { peso_kg?: number; cubagem?: number; frete?: number };
  }> => {
    const recarregar = opts?.recarregar ?? true;
    const silent = opts?.silent ?? false;
    const forcarMinFrete = opts?.forcarMinFrete ?? false;
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
          unidadeDestOriginal: anyC.unidadeDestOriginal ?? anyC.unidade_dest_original ?? anyC.unidadeDestOrig ?? anyC.unidade_dest_orig ?? '',
          unidadeCarregamento: anyC.unidadeCarregamento ?? anyC.unidade_carregamento ?? anyC.unidadeRelatorio ?? anyC.unidadeOrigem ?? anyC.sigla_emit ?? anyC.siglaEmit ?? anyC.unidOrig ?? anyC.origem ?? '',
        };
      });
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/carregamento_automatico.php`,
        { method: 'POST', body: JSON.stringify({ unidade: unidadeAtual, placa, unidadeDestino, paradas, nroLinha, ctesDisponiveis, forcar_min_frete: forcarMinFrete }) },
        true
      );
      if (res.success) {
        const msg = String(res.message ?? '').trim();
        const resultados = Array.isArray(res.resultados) ? res.resultados : [];
        const criou = resultados.length > 0
          ? resultados.some((r: any) => String(r?.status ?? '').toLowerCase() === 'criado')
          : !(msg.toLowerCase().includes('já existe'));
        if (!silent) {
          toast.success(msg || 'Carregamento automático iniciado!');
          if (criou) abrirAvisoSimulacao(confirmar);
        }
        if (recarregar) await carregarCarregamentos();
        return {
          ok: true,
          placa: res.placa,
          message: res.message,
          resumo: res.resumo_unidades,
          resumoDestinos: res.resumo_destinos,
          destino: res.destino,
          paradas: res.paradas,
          nro_linha: res.nro_linha,
          sobras: res.sobras,
          capacidade: res.capacidade,
          uso: res.uso,
        };
      } else {
        if (!silent && !forcarMinFrete && String(res?.code ?? '') === 'MIN_FRETE') {
          const freteAtual = Number(res?.frete_atual ?? 0) || 0;
          const minFrete = Number(res?.min_frete ?? 0) || 0;
          const ok = await confirmar({
            title: 'Frete abaixo do mínimo',
            description: `Frete atual abaixo do mínimo da linha.\n\nFrete: ${freteAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\nMínimo: ${minFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\n\nContinuar mesmo assim?`,
            confirmText: 'Continuar',
            cancelText: 'Cancelar',
          });
          if (ok) {
            return await handleCarregamentoAutomatico(placa, unidadeDestino, paradas, nroLinha, { ...opts, forcarMinFrete: true });
          }
        }
        if (!silent) toast.error(res.message || 'Erro ao iniciar carregamento automático');
        return { ok: false, message: res.message };
      }
    } catch (e: any) {
      if (!silent) toast.error(e.message || 'Erro ao iniciar carregamento automático');
      return { ok: false, message: e?.message || 'Erro ao iniciar carregamento automático' };
    }
  }, [carregarCarregamentos, dados, confirmar, unidadeAtual]);

  const handleCarregarLinhaHoje = useCallback(async (nroLinha: number) => {
    if (carregandoNroLinhaHoje) return;
    try {
      const atingiuMin = (linhasHojeStatus[nroLinha]?.atingiuMinFrete ?? true);
      if (!atingiuMin) {
        const ok = await confirmar({
          title: 'Frete mínimo não atingido',
          description: `Atenção: as cargas disponíveis para a linha ${String(nroLinha).padStart(3, '0')} não atingem o frete mínimo! Continuar?`,
          confirmText: 'Continuar',
          cancelText: 'Cancelar',
        });
        if (!ok) return;
      }

      setCarregandoNroLinhaHoje(nroLinha);
      const result = await handleCarregamentoAutomatico('', '', [], nroLinha, { forcarMinFrete: !atingiuMin });
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
  }, [carregandoNroLinhaHoje, handleCarregamentoAutomatico, linhasHojeStatus, confirmar]);

  const handleAdiarLinhaHoje = useCallback(async (nroLinha: number) => {
    if (adiandoNroLinhaHoje !== null || carregandoNroLinhaHoje !== null || carregandoTodasLinhasHoje) return;
    const ok = await confirmar({
      title: 'Adiar carregamento',
      description: `Atenção: isso irá criar um carregamento adiado (sem CT-es) para a linha ${String(nroLinha).padStart(3, '0')}. Continuar?`,
      confirmText: 'Continuar',
      cancelText: 'Cancelar',
    });
    if (!ok) return;
    try {
      setAdiandoNroLinhaHoje(nroLinha);
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/carregamento_automatico.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'adiar_linha', unidade: unidadeAtual, nroLinha }) },
        true
      );
      if (res?.success) {
        toast.success('Carregamento adiado criado.');
        await carregarCarregamentos();
        await carregarCarregamentosCalendario();
      } else {
        toast.error(res?.message || 'Erro ao adiar carregamento.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao adiar carregamento.');
    } finally {
      setAdiandoNroLinhaHoje(null);
    }
  }, [adiandoNroLinhaHoje, carregandoNroLinhaHoje, carregandoTodasLinhasHoje, confirmar, carregarCarregamentos, carregarCarregamentosCalendario, unidadeAtual]);

  const carregamentosNaoSimulados = React.useMemo(() => {
    return (carregamentos ?? []).filter((c: any) => !c?.simulado);
  }, [carregamentos]);

  const placasExistentes = React.useMemo(() => {
    return new Set(carregamentosNaoSimulados.map((c) => (c.placa_provisoria ?? '').trim().toUpperCase()).filter(Boolean));
  }, [carregamentosNaoSimulados]);

  const linhasEmCarregamento = React.useMemo(() => {
    return new Set<number>(
      carregamentosNaoSimulados
        .map((c: any) => (c?.nro_linha ?? c?.nroLinha ?? 0) as number)
        .filter((n: any) => Number.isFinite(n) && (n as number) > 0) as number[]
    );
  }, [carregamentosNaoSimulados]);

  const linhasCarregamHojeVisiveis = React.useMemo(() => {
    const orig = (unidadeAtual ?? '').trim().toUpperCase();
    return linhasCarregamHojeOrdenadas.filter((l) => {
      const nro = l.nro_linha ?? 0;
      if (nro > 0 && linhasEmCarregamento.has(nro)) return false;
      const dest = (l.sigla_dest ?? '').trim().toUpperCase();
      const placaAuto = dest ? `${orig}-${dest}` : '';
      if (!placaAuto) return true;
      return !placasExistentes.has(placaAuto);
    });
  }, [linhasCarregamHojeOrdenadas, linhasEmCarregamento, placasExistentes, unidadeAtual]);

  const handleCarregarTodasLinhasHoje = useCallback(async () => {
    if (carregandoNroLinhaHoje !== null || carregandoTodasLinhasHoje) return;
    const possiveis = linhasCarregamHojeVisiveis
      .map((l) => l.nro_linha ?? 0)
      .filter((n) => n > 0 && (linhasHojeStatus[n]?.podeCarregar ?? false));
    if (possiveis.length === 0) {
      toast.error('Nenhuma linha disponível para carregar.');
      return;
    }
    try {
      const abaixoMin = possiveis.filter((n) => !(linhasHojeStatus[n]?.atingiuMinFrete ?? true));
      if (abaixoMin.length > 0) {
        const ok = await confirmar({
          title: 'Frete mínimo não atingido',
          description: 'Atenção: um ou mais carregamentos não atingem o frete mínimo. Continuar?',
          confirmText: 'Continuar',
          cancelText: 'Cancelar',
        });
        if (!ok) return;
      }

      setCarregandoTodasLinhasHoje(true);
      let okCount = 0;
      let failCount = 0;
      const porNro = new Map<number, LinhaCarregamento>();
      for (const l of linhasCarregamHojeVisiveis) porNro.set(l.nro_linha ?? 0, l);
      const itens: ResumoMassaLinha[] = [];
      for (let i = 0; i < possiveis.length; i++) {
        const nro = possiveis[i];
        const isLast = i === possiveis.length - 1;
        const result = await handleCarregamentoAutomatico('', '', [], nro, { recarregar: isLast, silent: true, forcarMinFrete: abaixoMin.includes(nro) });
        if (result.ok) {
          okCount++;
        } else {
          failCount++;
        }
        const linha = porNro.get(nro);
        const destino = (linha?.sigla_dest ?? '').trim().toUpperCase();
        const limiteInter = (linha as any)?.destino_centralizadora ? 999 : 2;
        const intermediarias = linha ? escolherIntermediariasLinha(linha.unidades, linha.sigla_dest, intermediariasUsadas, totalsPorUnidadeParaLinhas, limiteInter).join(', ') : '';
        itens.push({
          nro_linha: nro,
          placa: result.placa ?? '',
          destino: destino || '-',
          intermediarias: intermediarias || '-',
          status: result.ok ? 'criado' : 'erro',
          msg: (result.message ?? '').trim() || (result.ok ? 'Criado' : 'Falha ao carregar'),
        });
      }
      if (okCount > 0) toast.success(`${okCount} carregamento(s) criado(s).`);
      if (failCount > 0) toast.error(`${failCount} linha(s) falharam ao carregar.`);
      if (okCount > 0) abrirAvisoSimulacao(confirmar);
      setResumoHojeMassaItens(itens);
      setResumoHojeMassaDialogOpen(true);
      setLinhasHojeDialogOpen(false);
    } finally {
      setCarregandoTodasLinhasHoje(false);
    }
  }, [carregandoNroLinhaHoje, carregandoTodasLinhasHoje, handleCarregamentoAutomatico, linhasCarregamHojeVisiveis, linhasHojeStatus, confirmar]);

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
        setor: (c as any).setor ?? '',
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

  const abrirRota = useCallback(async (car: Carregamento) => {
    if (!sigla) return;
    if (loadingRota) return;
    setRotaCarregamentoPlaca(car.placa_provisoria);
    setLoadingRota(true);
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_rota_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ placa: car.placa_provisoria, unidade: sigla }) },
        true
      );
      if (res.success) {
        setRotaDados(res);
        setRotaCarregamento(car);
        setRotaModalAberto(true);
      } else {
        toast.error(res.message || 'Erro ao carregar rota do carregamento.');
      }
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar rota do carregamento.');
    } finally {
      setLoadingRota(false);
      setRotaCarregamentoPlaca(null);
    }
  }, [sigla, loadingRota]);

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
    setLoadingInicial(true);
    try {
      if (carregamentosTransferOpen) {
        await importarCarregamentosSSWObrigatorio();
      }
      await carregar();
    } finally {
      setLoadingInicial(false);
    }
  }, [sigla, carregamentosTransferOpen, importarCarregamentosSSWObrigatorio, carregar]);

  const verificarSaidasEmViagem = useCallback(async () => {
    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/salvar_carregamento.php`,
        { method: 'POST', body: JSON.stringify({ acao: 'verificar_saidas_ssw' }) },
        true
      );
      if (res?.success && (Number(res.updated ?? 0) || 0) > 0) {
        toast.info(`${res.updated} registro(s) finalizado(s) automaticamente (saída detectada no SSW).`);
      }
    } catch (e: any) {
    }
  }, []);

  useEffect(() => {
    if (!painelAtivo) return;
    if (isMTZ) {
      toast.error('Acesso não permitido para a unidade MTZ. Faça login em uma unidade específica.');
      return;
    }
    if (!sigla) return;
    let ativo = true;
    void (async () => {
      setLoadingInicial(true);
      try {
        await carregarCarregamentos();
        if (!ativo) return;
        await carregar();
        if (!ativo) return;
        await carregarEntrega();
      } finally {
        if (ativo) setLoadingInicial(false);
      }
    })();
    return () => { ativo = false; };
  }, [painelAtivo, sigla, isMTZ, carregar, carregarEntrega, carregarCarregamentos]);

  const hasFiltrosAtivos =
    (filters.unidadeDestino?.length ?? 0) > 0 ||
    !!filters.periodoEmissaoInicio ||
    !!filters.periodoEmissaoFim ||
    !!filters.periodoPrevisaoInicio ||
    !!filters.periodoPrevisaoFim ||
    !!filters.tempoArmazemDe ||
    !!filters.tempoArmazemAte;

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
  const tempoArmazemDe = (() => {
    const s = (filters.tempoArmazemDe ?? '').trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  })();
  const tempoArmazemAte = (() => {
    const s = (filters.tempoArmazemAte ?? '').trim();
    if (!s) return null;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  })();

  const diasNoArmazem = (chegadaUnid: string): number | null => {
    const d = parseDataBR(chegadaUnid);
    if (!d) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dt = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const diff = Math.floor((hoje.getTime() - dt.getTime()) / 86400000);
    return diff >= 0 && Number.isFinite(diff) ? diff : null;
  };

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
      if (tempoArmazemDe !== null || tempoArmazemAte !== null) {
        if (cte.emTransito) return false;
        const dias = diasNoArmazem(cte.chegadaUnid);
        if (dias === null) return false;
        if (tempoArmazemDe !== null && dias < tempoArmazemDe) return false;
        if (tempoArmazemAte !== null && dias > tempoArmazemAte) return false;
      }
      return true;
    });
  }, [dados, dadosHub, filters.unidadeDestino, emissaoInicio, emissaoFim, previsaoInicio, previsaoFim, tempoArmazemDe, tempoArmazemAte, dominioUsuario, unidadeAtual]);

  const totalsPorUnidadeParaLinhas = React.useMemo(() => {
    const totals: Record<string, { pesoKg: number; cubagem: number; frete: number; prevMinTs?: number }> = {};
    for (const cte of ctesTransferFiltrados) {
      if (cte.emTransito) continue;
      const dest = (cte.unidadeDest ?? '').trim().toUpperCase();
      if (!dest) continue;
      if (!totals[dest]) totals[dest] = { pesoKg: 0, cubagem: 0, frete: 0 };
      totals[dest].pesoKg += parsePeso(cte.peso);
      totals[dest].cubagem += parseCubagem(cte.cubagem);
      totals[dest].frete += parseMoeda(cte.frete);
      const prev = parseDataBR(String((cte as any).prevEnt ?? ''));
      if (prev) {
        const ts = prev.getTime();
        const cur = totals[dest].prevMinTs;
        totals[dest].prevMinTs = cur === undefined ? ts : Math.min(cur, ts);
      }
    }
    return totals;
  }, [ctesTransferFiltrados]);

  const intermediariasUsadas = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of (carregamentos ?? [])) {
      const d = (c.destino ?? parseDestinoFromPlaca(c.placa_provisoria) ?? '').trim().toUpperCase();
      if (d) set.add(d);
      for (const u of parseUnidadesCsv(c.paradas ?? '')) set.add(u);
    }
    return set;
  }, [carregamentos]);

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

      const totalsPorUnidade: Record<string, { pesoKg: number; cubagem: number; frete: number; prevMinTs?: number }> = {};
      for (const cte of ctesTransferFiltrados) {
        if (cte.emTransito) continue;
        const dest = (cte.unidadeDest ?? '').trim().toUpperCase();
        if (!dest) continue;
        if (!totalsPorUnidade[dest]) totalsPorUnidade[dest] = { pesoKg: 0, cubagem: 0, frete: 0 };
        totalsPorUnidade[dest].pesoKg += parsePeso(cte.peso);
        totalsPorUnidade[dest].cubagem += parseCubagem(cte.cubagem);
        totalsPorUnidade[dest].frete += parseMoeda(cte.frete);
        const prev = parseDataBR(String((cte as any).prevEnt ?? ''));
        if (prev) {
          const ts = prev.getTime();
          const cur = totalsPorUnidade[dest].prevMinTs;
          totalsPorUnidade[dest].prevMinTs = cur === undefined ? ts : Math.min(cur, ts);
        }
      }

      const diretaLotaPorDestino = new Set<string>();
      for (const dest of hasDiretaPorDestino) {
        const t = totalsPorUnidade[dest] ?? { pesoKg: 0, cubagem: 0, frete: 0 };
        const ton = t.pesoKg / 1000;
        if (ton >= MIN_TON || t.cubagem >= MIN_M3) diretaLotaPorDestino.add(dest);
      }

      const placasExistentes = new Set(carregamentosNaoSimulados.map((c) => (c.placa_provisoria ?? '').trim().toUpperCase()).filter(Boolean));
      const linhasEmCarregamento = new Set<number>(
        carregamentosNaoSimulados
          .map((c: any) => (c?.nro_linha ?? c?.nroLinha ?? 0) as number)
          .filter((n: any) => Number.isFinite(n) && (n as number) > 0) as number[]
      );

      const status: Record<number, LinhaHojeStatus> = {};
      for (const l of linhasCarregamHoje) {
        const nro = l.nro_linha ?? 0;
        const dest = (l.sigla_dest ?? '').trim().toUpperCase();
        const unidades = (l.unidades ?? '').trim();
        const limiteInter = (l as any).destino_centralizadora ? 999 : 2;
        const intermediarias = escolherIntermediariasLinha(unidades, dest, intermediariasUsadas, totalsPorUnidade, limiteInter);
        const unidadesRota = Array.from(new Set([dest, ...intermediarias].filter(Boolean)));

        const totals = unidadesRota.reduce(
          (acc, u) => {
            const t = totalsPorUnidade[u] ?? { pesoKg: 0, cubagem: 0, frete: 0 };
            acc.pesoKg += t.pesoKg;
            acc.cubagem += t.cubagem;
            acc.frete += t.frete;
            return acc;
          },
          { pesoKg: 0, cubagem: 0, frete: 0 }
        );

        const minFreteRaw = (l.vlr_min_frete ?? 0);
        const minFrete = Number.isFinite(minFreteRaw as number) && (minFreteRaw as number) > 0 ? (minFreteRaw as number) : 0;
        const atingiuMinFrete = minFrete <= 0 ? true : totals.frete >= minFrete;

        const placaAuto = dest ? `${unidadeAtual}-${dest}` : '';
        const jaExistePlaca = placaAuto ? placasExistentes.has(placaAuto) : false;
        const jaExisteLinha = nro > 0 && linhasEmCarregamento.has(nro);
        const jaExiste = jaExistePlaca || jaExisteLinha;

        const bloqueadaPorDireta = intermediarias.length > 0 && diretaLotaPorDestino.has(dest);

        const motivos: string[] = [];
        if (jaExisteLinha) motivos.push(`Linha ${String(nro).padStart(3, '0')} já possui carregamento iniciado.`);
        if (jaExistePlaca) motivos.push(`Carregamento ${placaAuto} já existe.`);
        if (bloqueadaPorDireta) motivos.push('Linha direta já atinge a capacidade mínima (67m³ / 27t) para o destino final.');
        const bloqueada = jaExiste || bloqueadaPorDireta;

        status[nro] = {
          podeCarregar: !bloqueada,
          motivoBloqueio: bloqueada ? motivos.join(' ') : null,
          freteTotalDestino: totals.frete,
          pesoKgDestino: totals.pesoKg,
          cubagemDestino: totals.cubagem,
          atingiuMinFrete,
        };
      }

      setLinhasHojeStatus(status);
      setLoadingLinhasHojeStatus(false);
    }, 0);

    return () => {
      ativo = false;
      window.clearTimeout(t);
    };
  }, [carregamentosNaoSimulados, ctesTransferFiltrados, intermediariasUsadas, linhasCarregamHoje, unidadeAtual]);

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
      if (previsaoInicio || previsaoFim) {
        if (!matchesRangeBR(cte.prevEnt, previsaoInicio, previsaoFim)) return false;
      }
      if (tempoArmazemDe !== null || tempoArmazemAte !== null) {
        if (cte.emTransito) return false;
        const dias = diasNoArmazem(cte.chegadaUnid);
        if (dias === null) return false;
        if (tempoArmazemDe !== null && dias < tempoArmazemDe) return false;
        if (tempoArmazemAte !== null && dias > tempoArmazemAte) return false;
      }
      return true;
    });
  }, [dadosEntrega, previsaoInicio, previsaoFim, tempoArmazemDe, tempoArmazemAte, dominioUsuario, unidadeAtual]);

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
        map[key] = { sigla: key, nome: cte.nomeDest, armazem: [], transito: [], coletas: [], totalCtes: 0, totalVol: 0, totalPeso: 0, totalCubagem: 0, totalFrete: 0, totalVlrNf: 0 };
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
      map[key].totalVlrNf   += parseMoeda(cte.vlrNf);
    };
    for (const cte of ctesTransferFiltrados) addCte(cte);
    for (const coleta of coletasTransferFiltradas.filter(c => !c.paraEntrega)) {
      const key = coleta.unidadeDest || 'SEM DESTINO';
      if (!map[key]) {
        const nomeGrupo = key === 'SEM DESTINO'
          ? (coleta.cidadeDest || key)
          : (String((coleta as any).nomeDest ?? '').trim() || key);
        map[key] = { sigla: key, nome: nomeGrupo, armazem: [], transito: [], coletas: [], totalCtes: 0, totalVol: 0, totalPeso: 0, totalCubagem: 0, totalFrete: 0, totalVlrNf: 0 };
      }
      map[key].coletas.push(coleta);
      const pesoColeta = parseFloat(coleta.peso.replace('.', '').replace(',', '.')) || 0;
      map[key].totalPeso    += pesoColeta;
      map[key].totalCubagem += pesoColeta * 0.0033333333333333;
      map[key].totalVlrNf   += parseMoeda(coleta.valMerc);
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
      const nomeSetor = String(cte.setorNome ?? '').trim();
      const cepIni = String(cte.setorCepIni ?? '').trim();
      const cepFin = String(cte.setorCepFin ?? '').trim();
      if (!map[key]) {
        map[key] = {
          setor: key,
          nome: nomeSetor || undefined,
          cepIni: cepIni || undefined,
          cepFin: cepFin || undefined,
          armazem: [],
          transito: [],
          totalCtes: 0,
          totalVol: 0,
          totalPeso: 0,
          totalCubagem: 0,
          totalFrete: 0,
          totalVlrNf: 0,
        };
      } else {
        if (!map[key].nome && nomeSetor) map[key].nome = nomeSetor;
        if (!map[key].cepIni && cepIni) map[key].cepIni = cepIni;
        if (!map[key].cepFin && cepFin) map[key].cepFin = cepFin;
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
      map[key].totalVlrNf   += parseMoeda(cte.vlrMerc);
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

  const exportarTransferenciaCSVTodasUnidades = () => {
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmtMoeda = (n: number) => n.toFixed(2).replace('.', ',');
    const fmtNum = (n: number, dec: number) => n.toFixed(dec).replace('.', ',');
    const diasParado = (chegada: string) => {
      const s = String(chegada ?? '').trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return '';
      const dt = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), 0, 0, 0, 0);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diff = Math.floor((hoje.getTime() - dt.getTime()) / 86400000);
      return diff >= 0 && Number.isFinite(diff) ? String(diff) : '';
    };

    const downloadCsv = (filename: string, header: string[], rows: string[][]) => {
      if (!rows.length) return;
      const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    const ctesArmazem = ctesTransferFiltrados.filter((c) => !c.emTransito);
    const ctesTransito = ctesTransferFiltrados.filter((c) => c.emTransito);
    const coletas = coletasTransferFiltradas.filter((c) => !c.paraEntrega);

    const headerCtes = [
      'Destino',
      'CTRC',
      'NF',
      'Situação',
      'Emissão',
      'Chegada na Unid.',
      'Parado (dias)',
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

    const rowsArmazem = ctesArmazem.map((c) => [
      esc(c.unidadeDest),
      esc(c.ctrc),
      esc(c.nfiscal || ''),
      esc('NO ARMAZÉM'),
      esc(c.emissao),
      esc(c.chegadaUnid || ''),
      esc(diasParado(c.chegadaUnid || '')),
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
    ]);

    const rowsTransito = ctesTransito.map((c) => [
      esc(c.unidadeDest),
      esc(c.ctrc),
      esc(c.nfiscal || ''),
      esc('EM TRÂNSITO'),
      esc(c.emissao),
      esc(c.chegadaUnid || ''),
      esc(diasParado(c.chegadaUnid || '')),
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
    ]);

    const headerColetas = [
      'Destino',
      'Coleta',
      'Remetente',
      'Cidade Rem.',
      'Cidade/UF Dest.',
      'Limite',
      'Coletada',
      'Vlr. Merc.',
      'Vol.',
      'Peso (kg)',
      'Status',
    ];

    const rowsColetas = coletas.map((c) => [
      esc(c.unidadeDest || 'SEM DESTINO'),
      esc(`${c.serColeta} ${c.nroColeta}`.trim()),
      esc(c.remetente),
      esc(c.cidadeRem),
      esc(`${c.cidadeDest || '-'}${c.ufDest ? `/${c.ufDest}` : ''}`),
      esc(c.dataHoreLim),
      esc(c.coletada || '-'),
      fmtMoeda(parseMoeda(c.valMerc)),
      esc(c.qtdeVol),
      fmtNum(parsePeso(c.peso), 2),
      esc(c.statusColeta),
    ]);

    downloadCsv('ctes_transferencia_armazem.csv', headerCtes, rowsArmazem);
    downloadCsv('ctes_transferencia_transito.csv', headerCtes, rowsTransito);
    downloadCsv('coletas_transferencia.csv', headerColetas, rowsColetas);
  };

  const exportarEntregaCSVTodosSetores = () => {
    const list = ctesEntregaFiltrados ? [...ctesEntregaFiltrados] : [];
    if (!list.length) return;

    list.sort((a, b) => {
      const sa = String(a.setor || '');
      const sb = String(b.setor || '');
      const c = sa.localeCompare(sb);
      if (c !== 0) return c;
      const ta = a.emTransito ? 1 : 0;
      const tb = b.emTransito ? 1 : 0;
      if (ta !== tb) return ta - tb;
      return String(a.ctrc || '').localeCompare(String(b.ctrc || ''));
    });

    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const fmtMoeda = (n: number) => n.toFixed(2).replace('.', ',');
    const fmtNum = (n: number, dec: number) => n.toFixed(dec).replace('.', ',');
    const diasParado = (chegada: string) => {
      const s = String(chegada ?? '').trim();
      const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (!m) return '';
      const dt = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10), 0, 0, 0, 0);
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const diff = Math.floor((hoje.getTime() - dt.getTime()) / 86400000);
      return diff >= 0 && Number.isFinite(diff) ? String(diff) : '';
    };

    const header = [
      'Setor',
      'CTRC',
      'Emissão',
      'Chegada na Unid.',
      'Parado (dias)',
      'NF',
      'Situação',
      'Pagador',
      'Destinatário',
      'CNPJ Dest.',
      'Cidade',
      'Bairro',
      'CEP',
      'Endereço',
      'Prev. Ent.',
      'Agendamento',
      'Vlr. Merc.',
      'Frete (R$)',
      'Peso (kg)',
      'Cubagem (m³)',
      'Volumes',
      'Últ. Ocorrência',
      'Data Últ. Ocorrência',
      'Prev. Chegada',
      'Manifesto',
      'Dias atraso',
    ];

    const rows = list.map((c) => {
      const situacao = c.emTransito ? 'A CAMINHO' : 'NO ARMAZÉM';
      const ultOcor = [c.codUltOcor, c.descUltOcor].filter(Boolean).join(' - ');
      return [
        esc(c.setor || ''),
        esc(c.ctrc),
        esc(c.emissao || ''),
        esc(c.chegadaUnid || ''),
        esc(diasParado(c.chegadaUnid || '')),
        esc(c.nfiscal || ''),
        esc(situacao),
        esc(c.pagador || ''),
        esc(c.destinatario || ''),
        esc(c.cnpjDest || ''),
        esc(c.cidade || ''),
        esc(c.bairro || ''),
        esc(c.cep || ''),
        esc(c.endereco || ''),
        esc(c.prevEnt || ''),
        esc(c.agendamento || ''),
        fmtMoeda(parseMoeda(c.vlrMerc)),
        fmtMoeda(parseMoeda(c.frete)),
        fmtNum(parsePeso(c.peso), 2),
        fmtNum(parseCubagem(c.cubagem), 3),
        esc(c.qtdeVol || ''),
        esc(ultOcor),
        esc(c.dataUltOcor || ''),
        esc(c.prevChegada || ''),
        esc(c.manifesto || ''),
        esc(c.diasAtraso ?? 0),
      ];
    });

    const csv = [header.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ctes_entrega_todos_setores.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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

                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="text-slate-900 dark:text-slate-100">Tempo no armazém (dias)</Label>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Baseado na Data de chegada na unidade (hoje - chegada)</p>
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
              <Dialog open={showManual} onOpenChange={setShowManual}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label="Manual"
                          className="relative dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
                        >
                          <CircleHelp className="w-4 h-4 text-slate-700 dark:text-slate-200" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Manual</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DialogContent className="sm:max-w-[920px] bg-white dark:bg-slate-900 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-slate-100">
                      Manual · Simulador de Carregamentos
                    </DialogTitle>
                    <DialogDescription className="text-slate-600 dark:text-slate-400">
                      Como usar o painel de “Disponíveis no Armazém” para montar, simular, iniciar (TMS) e acompanhar carregamentos.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
                    <div className="space-y-5 py-4">
                      <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                                Este painel funciona como um SIMULADOR de carregamentos
                              </p>
                              <Badge className="bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-100 text-[11px]">SIMULAÇÃO</Badge>
                              {sigla ? <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[11px]">Unidade: {sigla}</Badge> : null}
                              {dominioUsuario ? <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-[11px]">Domínio: {dominioUsuario}</Badge> : null}
                            </div>
                            <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
                              Carregamentos criados aqui servem para medição e otimização. Eles não seguem para o TMS automaticamente. Para operação real, use o botão Iniciar (TMS).
                            </p>
                          </div>
                        </div>
                      </div>

                      {dominioUsuario === 'RVE' && (
                        <div className="rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/30 p-4">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200">
                                Regra de placa no domínio RVE (4 últimos caracteres)
                              </p>
                              <p className="text-xs text-indigo-800 dark:text-indigo-300 mt-1">
                                No RVE, o sistema usa os 4 últimos caracteres da placa para relacionar veículo/capacidade e para agrupar importações do SSW.
                              </p>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white/70 dark:bg-slate-900/40 p-3">
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Na importação do SSW</p>
                                  <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                    <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Se a placa vier no formato de 7 caracteres (ex.: ABC1D23), o sistema considera os 4 últimos (ex.: 1D23).</span></li>
                                    <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Se existir carregamento em aberto com a mesma terminação (4 últimos), ele pode ser reaproveitado/agrupado.</span></li>
                                    <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Se houver veículo cadastrado com a mesma terminação, a placa “salva” pode ser ajustada para a placa cadastrada.</span></li>
                                  </ul>
                                </div>
                                <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white/70 dark:bg-slate-900/40 p-3">
                                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Ao editar / digitar placa</p>
                                  <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                                    <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Mantenha os 4 últimos caracteres coerentes com o veículo real quando quiser “casar” com capacidades/placas do cadastro.</span></li>
                                    <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Carregamentos simulados não são alterados pela importação do SSW.</span></li>
                                    <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Alguns destinos podem ser ignorados no RVE (ex.: SAL, DK4, TNE, DEV, e regras específicas SAO↔CAM).</span></li>
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <ListTree className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Visão geral do painel</p>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">1) Carregamentos (topo)</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Área para criar carregamentos (manual/automático), importar do SSW, iniciar via TMS, finalizar e apontar CT-es.
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">2) Disponíveis (abaixo)</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Listas por destino (transferência) e por setor (entrega), com totais, indicadores e exportação CSV.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Carregamentos (Simulação)</p>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Criar carregamento manual</p>
                            <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 font-black">•</span><span>Escolha “Placa livre” ou “Veículo cadastrado”.</span></li>
                              <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 font-black">•</span><span>Informe destino e, se quiser, paradas intermediárias.</span></li>
                              <li className="flex gap-2"><span className="text-emerald-600 dark:text-emerald-400 font-black">•</span><span>O carregamento nasce como simulação (borda/indicador visual no card).</span></li>
                            </ul>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Carregamento automático</p>
                            <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                              <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Seleciona linhas e gera simulações (inclusive em massa).</span></li>
                              <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>O painel mostra resumos e sugere intermediárias conforme regra do domínio/unidade.</span></li>
                            </ul>
                          </div>
                        </div>

                        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Ações no card do carregamento</p>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Apontar</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                Coloca o painel em modo seleção: você marca CT-es nas listas e confirma para adicionar ao carregamento.
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Editar placa (ícone lápis)</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                Permite trocar a placa por uma real ou fictícia, sem recriar o carregamento.
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Iniciar (TMS)</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                Converte a simulação para início operacional: limpa a simulação e pede a placa verdadeira. Depois, importa do SSW para alimentar os dados reais.
                              </p>
                            </div>
                            <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3">
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Finalizar / Excluir</p>
                              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                                Finalizar encerra o carregamento. Excluir remove o carregamento da base (com confirmação).
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <Download className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Importação do SSW</p>
                        </div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Importar carregamentos</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Atualiza os carregamentos vindos do SSW. O painel pode limpar dados antigos do SSW e trazer novamente os dados atuais.
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Importação automática</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Se habilitada, reimporta periodicamente para manter a tela sincronizada com o SSW.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Placas fictícias e “Obrigar placas reais”</p>
                          <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Agora, por garantia, a rotina de importação de carregamentos SEMPRE lê os veículos criados de ontem pra hoje e importa.</span></li>
                            <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Foi criada a chave “Obrigar placas reais”.</span></li>
                            <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Com a chave DESATIVADA, caso, mesmo importando os veículos mais recentes, os carregamentos vêm com placas fictícias.</span></li>
                            <li className="flex gap-2"><span className="text-indigo-600 dark:text-indigo-400 font-black">•</span><span>Com a chave ATIVADA, os carregamentos de placas reais serão importados e os com placas fictícias serão ignorados. Ao final do processo uma lista com as placas fictícias não importadas é exibida.</span></li>
                          </ul>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Finalização automática (SSW)</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            Ao abrir o painel, o sistema pode verificar placas “em andamento” que já saíram para viagem no SSW e finalizar automaticamente com a data/hora informada.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Disponíveis para Transferência</p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          Agrupa CT-es por destino. Clique no destino para expandir e ver as abas (No Armazém / Em Transferência / Em Coleta).
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Colunas e totais</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Mostra volumes, peso, cubagem, frete e valor total da NF por destino, com exportação CSV por destino e CSV geral.
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Indicador de saída</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Cores (verde/amarelo/laranja/vermelho) ajudam a priorizar atrasos de saída/manifesto conforme regras do painel.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Modo Apontamento</p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                            Ao clicar em Apontar em um carregamento, você pode selecionar CT-es nas tabelas. Quando houver CT-es selecionados, aparece uma barra para Confirmar e adicionar ao carregamento.
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <Home className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Disponíveis para Entrega</p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          Agrupa CT-es por setor. Mostra atrasos, volumes, peso, cubagem, frete e valor de NF, com CSV por setor e CSV geral.
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Filtros</p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          Use o botão de filtros no topo para refinar a visualização. Os filtros são aplicados após carregar os dados (não alteram a importação).
                        </p>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Períodos</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Filtra por emissão (transferência) e por previsão de entrega (transferência e entrega).
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Tempo no armazém</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Baseado na data de chegada na unidade: hoje - chegada (em dias).
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Calendário e acompanhamento</p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          A área de carregamentos inclui um calendário/lista para acompanhar carregamentos em andamento. Ao clicar em um carregamento não finalizado, o painel pode permitir finalizar pelo próprio dialog.
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <Share2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Hub (integração de unidades)</p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          Quando ativado em um carregamento, o Hub pode integrar CT-es de outras unidades aos grupos, facilitando a visualização e a montagem. Use “Limpar hub” para voltar à visão normal.
                        </p>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <Gauge className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ordenação, CSV e conferência</p>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Ordenar por coluna</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              No cabeçalho de “CT-es por Destino”, clique nas colunas para ordenar (ex.: destino, volume, peso, cubagem, frete).
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Exportar CSV</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              Há exportação por destino/setor e também CSV “tudo”. Use para análises e compartilhamento rápido.
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Detalhar CT-es do carregamento</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              No card do carregamento, o detalhamento lista CT-es vinculados, permite exportar CSV e remover CT-es selecionados (com confirmação).
                            </p>
                          </div>
                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Atualizar</p>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                              O botão Atualizar no topo recarrega os dados de transferência/SSW para manter a tela sincronizada.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                        <div className="flex items-center gap-2">
                          <Filter className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Aba “Todos os Disponíveis”</p>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                          Mostra, em uma única visão, os blocos de Transferência e Entrega. Útil para priorização rápida sem ficar alternando de aba.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button variant="outline" onClick={() => setShowManual(false)} className="dark:border-slate-700 dark:hover:bg-slate-800">
                      Fechar
                    </Button>
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
      ) : (loadingInicial || loading) && !dados ? (
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

          <div
            role="button"
            tabIndex={0}
            onClick={() => { if (!loadingLinhasOrigem) setLinhasHojeDialogOpen(true); }}
            onKeyDown={(e) => { if (!loadingLinhasOrigem && (e.key === 'Enter' || e.key === ' ')) setLinhasHojeDialogOpen(true); }}
            className={`bg-card text-card-foreground border-border rounded-xl border shadow-sm h-16 px-3 flex items-center dark:bg-slate-900 dark:border-slate-700 transition-colors ${
              (loadingLinhasOrigem || loadingLinhasHojeStatus) ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/70'
            }`}
          >
            <div className="w-full flex items-center justify-between gap-3 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/40 shrink-0">
                  <AlertCircle className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div className="min-w-0 text-left text-sm text-slate-800 dark:text-slate-200 truncate">
                  <span className="font-semibold">
                    {(loadingLinhasOrigem || loadingLinhasHojeStatus) ? '...' : `${qtdLinhasHojeViaveis}/${linhasOrigem.length}`}
                  </span>
                  {' '}linha(s) com carregamento disponível para hoje
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 border-rose-300 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  if (importandoCarregamentos) { toast.error('Aguarde: atualização do SSW em andamento.'); return; }
                  void handleImportarVeiculos();
                }}
                disabled={importandoVeiculos}
                title="Importar proprietários, veículos e motoristas do SSW"
              >
                {importandoVeiculos ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Truck className="w-3.5 h-3.5 mr-1.5" />}
                Importar veículos recentes
              </Button>
            </div>
          </div>

          <Dialog open={linhasHojeDialogOpen} onOpenChange={setLinhasHojeDialogOpen}>
            <DialogContent className="sm:max-w-[1100px] max-h-[calc(100vh-80px)] overflow-hidden flex flex-col">
              <DialogHeader>
                <DialogTitle>Linhas que carregam hoje</DialogTitle>
                <DialogDescription>Linhas com origem na unidade atual e frequência ativa para o dia de hoje</DialogDescription>
              </DialogHeader>
              <Dialog open={centralizadoraDialogOpen} onOpenChange={setCentralizadoraDialogOpen}>
                <DialogContent className="sm:max-w-[520px]">
                  <DialogHeader>
                    <DialogTitle>Centralizadora · {centralizadoraSigla || '—'}</DialogTitle>
                    <DialogDescription>Unidades envolvidas na centralização</DialogDescription>
                  </DialogHeader>
                  {centralizadoraUnidades.length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">Nenhuma unidade encontrada.</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {centralizadoraUnidades.map((u) => (
                        <Badge key={u} className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs font-mono">{u}</Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end pt-3">
                    <Button variant="outline" size="sm" onClick={() => setCentralizadoraDialogOpen(false)}>Fechar</Button>
                  </div>
                </DialogContent>
              </Dialog>
              <div className="overflow-y-auto pr-1 max-h-[calc(100vh-260px)]">
                <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <div className="grid grid-cols-[60px_minmax(0,1fr)_55px_minmax(0,1fr)_60px_120px_120px_170px] gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
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
                  ) : linhasCarregamHojeVisiveis.length === 0 ? (
                    <div className="px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {linhasCarregamHoje.length === 0
                        ? 'Nenhuma linha está configurada para carregar hoje.'
                        : 'Todas as linhas de hoje já possuem carregamento criado.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {linhasCarregamHojeVisiveis.map((l) => {
                        const nro = l.nro_linha ?? 0;
                        const s = linhasHojeStatus[nro];
                        const pode = s?.podeCarregar ?? true;
                        const minFrete = (l.vlr_min_frete ?? 0);
                        const freteAtual = s?.freteTotalDestino ?? 0;
                        const atingiuMin = s?.atingiuMinFrete ?? (minFrete ? freteAtual >= minFrete : true);
                        const motivo = s?.motivoBloqueio ?? '';
                        const limiteInter = (l as any).destino_centralizadora ? 999 : 2;
                        const interEfetivas = escolherIntermediariasLinha(l.unidades, l.sigla_dest, intermediariasUsadas, totalsPorUnidadeParaLinhas, limiteInter);
                        return (
                          <div
                            key={l.nro_linha}
                            title={!pode ? motivo : undefined}
                            className={`grid grid-cols-[60px_minmax(0,1fr)_55px_minmax(0,1fr)_60px_120px_120px_170px] gap-2 px-3 py-2 text-sm items-center ${!pode ? 'opacity-50' : ''}`}
                          >
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{String(l.nro_linha ?? 0).padStart(3, '0')}</span>
                            <span className="truncate text-slate-800 dark:text-slate-200">{l.nome || '-'}</span>
                            {(l as any).destino_centralizadora ? (
                              <button
                                type="button"
                                className="font-mono font-semibold text-indigo-700 dark:text-indigo-300 hover:underline text-left"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const sig = String(l.sigla_dest ?? '').trim().toUpperCase();
                                  const raw = String((l as any).unidades_compart ?? '').trim();
                                  const parts = raw
                                    .split(/[,\s;]+/)
                                    .map((p) => p.trim().toUpperCase())
                                    .filter((u) => !!u && /^[A-Z0-9]{2,5}$/.test(u));
                                  const uniq = Array.from(new Set(parts));
                                  setCentralizadoraSigla(sig);
                                  setCentralizadoraUnidades(uniq);
                                  setCentralizadoraDialogOpen(true);
                                }}
                                title="Clique para ver unidades compartilhadas"
                              >
                                {(l.sigla_dest ?? '').toUpperCase() || '-'}
                              </button>
                            ) : (
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{(l.sigla_dest ?? '').toUpperCase() || '-'}</span>
                            )}
                            <span className="font-mono text-xs text-slate-600 dark:text-slate-400 truncate">{interEfetivas.length ? interEfetivas.join(', ') : '-'}</span>
                            <span className="text-right font-mono text-xs text-slate-600 dark:text-slate-400">{(l.km_ida ?? 0).toLocaleString('pt-BR')}</span>
                            <span className="text-right font-mono text-xs text-slate-700 dark:text-slate-200 tabular-nums">
                              {minFrete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <span className={`text-right font-mono text-xs tabular-nums ${atingiuMin ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                              {freteAtual.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleAdiarLinhaHoje(nro)}
                                disabled={adiandoNroLinhaHoje !== null || carregandoNroLinhaHoje !== null || carregandoTodasLinhasHoje}
                              >
                                {adiandoNroLinhaHoje === nro ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                                Adiar
                              </Button>
                              <Button
                                size="sm"
                                className="h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                onClick={() => handleCarregarLinhaHoje(nro)}
                                disabled={!pode || carregandoNroLinhaHoje !== null || carregandoTodasLinhasHoje}
                                title={!pode ? motivo : undefined}
                              >
                                {carregandoNroLinhaHoje === nro ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                                Carregar
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
                <Button
                  size="sm"
                  className="h-8 text-xs bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleCarregarTodasLinhasHoje}
                  disabled={
                    loadingLinhasOrigem
                    || loadingLinhasHojeStatus
                    || carregandoNroLinhaHoje !== null
                    || carregandoTodasLinhasHoje
                    || linhasCarregamHojeVisiveis.filter((l) => {
                      const nro = l.nro_linha ?? 0;
                      return nro > 0 && (linhasHojeStatus[nro]?.podeCarregar ?? true);
                    }).length === 0
                  }
                >
                  {carregandoTodasLinhasHoje ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ListTree className="w-3.5 h-3.5 mr-1.5" />}
                  {carregandoTodasLinhasHoje ? 'Carregando...' : 'Carregar todas as possíveis'}
                </Button>
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
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden min-w-0">
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
                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
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
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setResumoHojeDialogOpen(false)}>Fechar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={resumoHojeMassaDialogOpen} onOpenChange={setResumoHojeMassaDialogOpen}>
            <DialogContent className="sm:max-w-[900px]">
              <DialogHeader>
                <DialogTitle>Resumo · Carregamentos em massa</DialogTitle>
                <DialogDescription>Resultados por linha</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden min-w-0">
                <div className="grid grid-cols-[70px_120px_60px_minmax(0,1fr)_90px_minmax(0,1fr)] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <span>Linha</span>
                  <span>Placa</span>
                  <span>Dest.</span>
                  <span>Intermediárias</span>
                  <span>Status</span>
                  <span>Mensagem</span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {resumoHojeMassaItens.length === 0 ? (
                    <div className="px-3 py-4 text-xs text-slate-400 text-center">—</div>
                  ) : resumoHojeMassaItens.map((r) => (
                    <div key={r.nro_linha} className="grid grid-cols-[70px_120px_60px_minmax(0,1fr)_90px_minmax(0,1fr)] gap-2 px-3 py-2 text-xs items-center">
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300">{String(r.nro_linha).padStart(3, '0')}</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 truncate">{r.placa}</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{r.destino}</span>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate">{r.intermediarias}</span>
                      <span className={`text-[11px] font-bold ${r.status === 'criado' ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                        {r.status === 'criado' ? 'CRIADO' : 'ERRO'}
                      </span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 truncate">{r.msg}</span>
                    </div>
                  ))}
                </div>
                <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between gap-3">
                  <span className="font-semibold">
                    Total: {resumoHojeMassaItens.length} · Criados: {resumoHojeMassaItens.filter(i => i.status === 'criado').length} · Erros: {resumoHojeMassaItens.filter(i => i.status === 'erro').length}
                  </span>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setResumoHojeMassaDialogOpen(false)}>Fechar</Button>
              </div>
            </DialogContent>
          </Dialog>

          <CarregamentoArea
            abaAtiva={abaAtiva}
            sigla={sigla}
            carregamentos={carregamentos}
            loadingCarregamentos={loadingCarregamentos}
            carregamentosTransferOpen={carregamentosTransferOpen}
            setCarregamentosTransferOpen={setCarregamentosTransferOpen}
            carregamentosEntregaOpen={carregamentosEntregaOpen}
            setCarregamentosEntregaOpen={setCarregamentosEntregaOpen}
            carregamentosCalendario={carregamentosCalendario}
            loadingCarregamentosCalendario={loadingCarregamentosCalendario}
            linhasOrigem={linhasOrigem}
            loadingLinhasOrigem={loadingLinhasOrigem}
            totalsPorUnidadeParaLinhas={totalsPorUnidadeParaLinhas}
            gruposSetorEntrega={gruposSetor}
            confirmar={confirmar}
            perguntarTexto={perguntarTexto}
            modoApontamento={modoApontamento}
            onIniciarApontamento={placa => { setModoApontamento(placa); setCtesSelecionados(new Map()); }}
            onCancelarApontamento={() => { setModoApontamento(null); setCtesSelecionados(new Map()); setDadosHub(null); setHubCarregamentoPlaca(null); }}
            onCriarCarregamento={handleCriarCarregamento}
            onCarregamentoAutomaticoEntrega={handleCarregamentoAutomaticoEntrega}
            onFinalizarCarregamento={handleFinalizarCarregamento}
            onExcluirCarregamento={handleExcluirCarregamento}
            onRemoverCte={handleRemoverCte}
            onCarregarSSW={handleCarregarSSW}
            onCarregarRota={abrirRota}
            loadingRota={loadingRota}
            rotaCarregamentoPlaca={rotaCarregamentoPlaca}
            onRecarregarCarregamentos={carregarCarregamentos}
            onImportarCarregamentos={handleImportarCarregamentos}
            importandoCarregamentos={importandoCarregamentos}
            onImportarVeiculos={handleImportarVeiculos}
            importandoVeiculos={importandoVeiculos}
            importacaoAutomatica={importacaoAutomatica}
            onToggleImportacaoAutomatica={setImportacaoAutomatica}
            obrigarPlacasReais={obrigarPlacasReais}
            onToggleObrigarPlacasReais={handleToggleObrigarPlacasReais}
            onCarregamentoAutomatico={handleCarregamentoAutomatico}
            todosCtes={todosCtes}
            cteKeysDisponiveisTransferencia={cteKeysDisponiveisTransferencia}
            cteKeysDisponiveisEntrega={cteKeysDisponiveisEntrega}
          />

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

          {rotaModalAberto && rotaCarregamento && rotaDados && (
            <ModalRotaCarregamento
              carregamento={rotaCarregamento}
              dados={rotaDados}
              onFechar={() => { setRotaModalAberto(false); setRotaCarregamento(null); setRotaDados(null); }}
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
                    <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={exportarTransferenciaCSVTodasUnidades}>
                      <FileDown className="w-3.5 h-3.5 mr-1.5" />
                      CSV (tudo)
                    </Button>
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
                            style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px 78px 78px 120px 120px 60px' }}>
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
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Vlr NF (R$)</span>
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
                    <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={exportarEntregaCSVTodosSetores}>
                      <FileDown className="w-3.5 h-3.5 mr-1.5" />
                      CSV (tudo)
                    </Button>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => carregarEntrega()}>
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
                      style={{ gridTemplateColumns: '28px 60px minmax(0,1fr) 70px 70px 70px 70px minmax(80px,1fr) minmax(80px,1fr) 120px 120px 60px' }}>
                      <span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Setor</span>
                      <span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Atraso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Piso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">A caminho</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Volumes</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Peso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Cubagem</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Frete (R$)</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Vlr NF (R$)</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">CSV</span>
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
                      style={{ gridTemplateColumns: '28px 80px minmax(0,1fr) 80px 70px 70px 60px 70px 78px 78px 120px 120px 60px' }}>
                      <span /><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Destino</span><span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Perf. saída</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Piso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Trans.</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Coletas</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Volumes</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Peso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Cubagem</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Frete (R$)</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Vlr NF (R$)</span>
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
                      style={{ gridTemplateColumns: '28px 60px minmax(0,1fr) 70px 70px 70px 70px minmax(80px,1fr) minmax(80px,1fr) 120px 120px 60px' }}>
                      <span /><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Setor</span><span />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Atraso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Piso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">A caminho</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Volumes</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Peso</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">Cubagem</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Frete (R$)</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Vlr NF (R$)</span>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-center">CSV</span>
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
      {confirmarDialog}
      {perguntarTextoDialog}
    </DashboardLayout>
  );
}
