import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { DateInput } from '../ui/date-input';
import { cn } from '../ui/utils';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { useConfirmDialog } from '../ui/alert-dialog';

/**
 * ================================================================
 * COMERCIAL - AGENDA DE VENDAS
 * ================================================================
 * Calendário de compromissos por vendedor. Cada compromisso liga um
 * cliente da carteira do vendedor a uma ação de venda pré-cadastrada
 * ([dominio]_acao_venda).
 *
 * Ao confirmar o cumprimento da ação, o status da ação passa a valer
 * para o vínculo vendedor x cliente ([dominio]_vendedor_cliente) e
 * data_status é atualizado. Antes da confirmação, nada muda no funil.
 *
 * Perfil: o login do vendedor é o mesmo login da Presto, então quem
 * está em [dominio]_vendedor vê apenas a própria agenda; os demais
 * escolhem quais vendedores querem acompanhar.
 * ================================================================
 */

const API = `${ENVIRONMENT.apiBaseUrl}/comercial/agenda_vendas.php`;

const DIAS_ATRAS_PADRAO = 10;
const DIAS_FRENTE_PADRAO = 20;

const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const STATUS_BADGE: Record<string, string> = {
  D: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  P: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  N: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  C: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  R: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
};

interface AcaoVenda {
  codigo: number;
  descricao: string;
  status: string;
  status_label: string;
}

interface Vendedor {
  login: string;
  nome: string;
  qtd_clientes?: number;
}

interface AgendaItem {
  seq_agenda: number;
  data: string;
  login: string;
  vendedor_nome: string;
  cnpj: string;
  cnpj_fmt: string;
  cliente_nome: string;
  codigo_acao_venda: number;
  acao_descricao: string;
  acao_status: string;
  acao_status_label: string;
  observacao: string;
  cumprida: boolean;
  data_cumprimento: string | null;
}

interface ClienteCarteira {
  cnpj: string;
  cnpj_fmt: string;
  nome: string;
  cidade: string;
  uf: string;
  status: string;
  status_label: string;
}

interface Eu {
  login: string;
  nome: string;
  is_admin: boolean;
  is_vendedor: boolean;
}

interface Payload {
  success: boolean;
  eu: Eu;
  vendedores: Vendedor[];
  acoes: AcaoVenda[];
  agenda: AgendaItem[];
  periodo: { ini: string; fim: string; hoje: string };
}

// ============================================================
// DATAS
// ============================================================

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** Converte 'YYYY-MM-DD' em Date local (meio-dia, evita fuso). */
function parseYmd(s: string): Date {
  const [a, m, d] = s.split('-').map(Number);
  return new Date(a, (m || 1) - 1, d || 1, 12, 0, 0);
}

function addDias(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function fmtCurto(s: string): string {
  return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
}

function vendedorHue(login: string): number {
  let hash = 0;
  for (let i = 0; i < login.length; i += 1) {
    hash = (hash * 31 + login.charCodeAt(i)) | 0;
  }
  return (((hash % 360000) + 360000) % 360000) / 1000;
}

// ============================================================
// COMPONENTE
// ============================================================

export function AgendaVendas() {
  const { user } = useAuth();
  usePageTitle('Agenda de Vendas');
  const { confirm: confirmar, dialog: confirmarDialog } = useConfirmDialog();

  const hoje = useMemo(() => new Date(), []);
  const [periodo, setPeriodo] = useState(() => ({
    ini: ymd(addDias(hoje, -DIAS_ATRAS_PADRAO)),
    fim: ymd(addDias(hoje, DIAS_FRENTE_PADRAO)),
  }));

  const [loading, setLoading] = useState(true);
  const [eu, setEu] = useState<Eu | null>(null);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [acoes, setAcoes] = useState<AcaoVenda[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [loginsFiltro, setLoginsFiltro] = useState<string[]>([]);

  // ============ DIALOG ============
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<AgendaItem | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [formData, setFormData] = useState(ymd(hoje));
  const [formLogin, setFormLogin] = useState('');
  const [formCnpj, setFormCnpj] = useState('');
  const [formCodigoAcao, setFormCodigoAcao] = useState('');
  const [formObservacao, setFormObservacao] = useState('');
  const [clientes, setClientes] = useState<ClienteCarteira[]>([]);
  const [carregandoClientes, setCarregandoClientes] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');

  const [cumprindo, setCumprindo] = useState<number | null>(null);

  const ehVendedor = !!eu?.is_vendedor;

  // ============ CARREGAMENTO ============
  const carregar = useCallback(async () => {
    try {
      setLoading(true);
      const qs = new URLSearchParams({ ini: periodo.ini, fim: periodo.fim });
      if (loginsFiltro.length > 0) {
        qs.set('login', loginsFiltro.join(','));
      }
      const resp = await apiFetch(`${API}?${qs.toString()}`);
      if (!resp?.success || !Array.isArray(resp.agenda)) {
        throw new Error(resp?.message || 'Falha ao carregar a agenda.');
      }
      const dados = resp as Payload;
      setEu(dados.eu);
      setVendedores(dados.vendedores ?? []);
      setAcoes(dados.acoes ?? []);
      setAgenda(dados.agenda ?? []);
    } catch (e) {
      console.error('Erro ao carregar a agenda:', e);
      setAgenda([]);
    } finally {
      setLoading(false);
    }
  }, [periodo.ini, periodo.fim, loginsFiltro]);

  useEffect(() => {
    carregar();
  }, [carregar, user?.domain]);

  // ============ GRADE DO CALENDÁRIO ============
  const dias = useMemo(() => {
    const inicio = parseYmd(periodo.ini);
    inicio.setDate(inicio.getDate() - inicio.getDay()); // volta ao domingo
    const fim = parseYmd(periodo.fim);
    fim.setDate(fim.getDate() + (6 - fim.getDay())); // avança ao sábado

    const lista: Date[] = [];
    let atual = new Date(inicio);
    while (atual <= fim) {
      lista.push(new Date(atual));
      atual = addDias(atual, 1);
    }
    return lista;
  }, [periodo.ini, periodo.fim]);

  const agendaPorDia = useMemo(() => {
    const mapa: Record<string, AgendaItem[]> = {};
    agenda.forEach((a) => {
      if (!mapa[a.data]) mapa[a.data] = [];
      mapa[a.data].push(a);
    });
    return mapa;
  }, [agenda]);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        c.cnpj_fmt.includes(termo) ||
        c.cnpj.includes(termo) ||
        `${c.cidade}/${c.uf}`.toLowerCase().includes(termo)
    );
  }, [clientes, buscaCliente]);

  // ============ PERÍODO ============
  const deslocarPeriodo = (dias: number) => {
    setPeriodo((p) => ({
      ini: ymd(addDias(parseYmd(p.ini), dias)),
      fim: ymd(addDias(parseYmd(p.fim), dias)),
    }));
  };

  const definirPeriodoPadrao = () => {
    setPeriodo({
      ini: ymd(addDias(new Date(), -DIAS_ATRAS_PADRAO)),
      fim: ymd(addDias(new Date(), DIAS_FRENTE_PADRAO)),
    });
  };

  const definirPeriodoRapido = (tipo: 'hoje' | 'semana' | 'mes') => {
    const agora = new Date();
    if (tipo === 'hoje') {
      const data = ymd(agora);
      setPeriodo({ ini: data, fim: data });
      return;
    }
    if (tipo === 'semana') {
      const inicio = new Date(agora);
      inicio.setDate(agora.getDate() - agora.getDay());
      const fim = addDias(inicio, 6);
      setPeriodo({ ini: ymd(inicio), fim: ymd(fim) });
      return;
    }
    const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 12);
    const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 12);
    setPeriodo({ ini: ymd(inicio), fim: ymd(fim) });
  };

  const alterarInicioPeriodo = (ini: string) => {
    if (!ini) return;
    setPeriodo((p) => ({ ini, fim: p.fim < ini ? ini : p.fim }));
  };

  const alterarFimPeriodo = (fim: string) => {
    if (!fim) return;
    setPeriodo((p) => ({ ini: p.ini > fim ? fim : p.ini, fim }));
  };

  const alternarVendedor = (login: string) => {
    setLoginsFiltro((atual) =>
      atual.includes(login) ? atual.filter((l) => l !== login) : [...atual, login]
    );
  };

  // ============ CARTEIRA ============
  const carregarClientes = useCallback(async (login: string) => {
    if (!login) {
      setClientes([]);
      return;
    }
    try {
      setCarregandoClientes(true);
      const resp = await apiFetch(`${API}?action=clientes&login=${encodeURIComponent(login)}`);
      setClientes(resp?.success && Array.isArray(resp.clientes) ? (resp.clientes as ClienteCarteira[]) : []);
    } catch (e) {
      console.error('Erro ao carregar a carteira do vendedor:', e);
      setClientes([]);
    } finally {
      setCarregandoClientes(false);
    }
  }, []);

  // ============ DIALOG ============
  const abrirNovo = (data?: string) => {
    setEditando(null);
    setFormData(data || ymd(hoje));
    setFormCnpj('');
    setFormCodigoAcao('');
    setFormObservacao('');
    setBuscaCliente('');

    if (ehVendedor) {
      setFormLogin(eu?.login ?? '');
      carregarClientes(eu?.login ?? '');
    } else {
      const inicial = loginsFiltro.length === 1 ? loginsFiltro[0] : '';
      setFormLogin(inicial);
      carregarClientes(inicial);
    }
    setDialogOpen(true);
  };

  const abrirEdicao = (item: AgendaItem) => {
    setEditando(item);
    setFormData(item.data);
    setFormLogin(item.login);
    setFormCnpj(item.cnpj);
    setFormCodigoAcao(String(item.codigo_acao_venda));
    setFormObservacao(item.observacao);
    setBuscaCliente('');
    setDialogOpen(true);
  };

  const trocarVendedorForm = (login: string) => {
    setFormLogin(login);
    setFormCnpj('');
    setBuscaCliente('');
    carregarClientes(login);
  };

  const salvar = async () => {
    if (!editando) {
      if (!formData) {
        toast.error('Informe a data do compromisso');
        return;
      }
      if (!formLogin) {
        toast.error('Informe o vendedor');
        return;
      }
      if (!formCnpj) {
        toast.error('Selecione o cliente');
        return;
      }
    }
    if (!formCodigoAcao) {
      toast.error('Selecione a ação de venda');
      return;
    }

    setSalvando(true);
    try {
      const resp = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify(
          editando
            ? {
                action: 'atualizar',
                seq_agenda: editando.seq_agenda,
                codigo_acao_venda: Number(formCodigoAcao),
                observacao: formObservacao,
              }
            : {
                action: 'criar',
                data: formData,
                login: formLogin,
                cnpj: formCnpj,
                codigo_acao_venda: Number(formCodigoAcao),
                observacao: formObservacao,
              }
        ),
      });
      if (!resp?.success) return;

      setDialogOpen(false);
      await carregar();
    } catch (e) {
      console.error('Erro ao salvar o compromisso:', e);
    } finally {
      setSalvando(false);
    }
  };

  const cumprir = async (item: AgendaItem) => {
    const ok = await confirmar({
      title: 'Confirmar cumprimento da ação',
      description: `Confirma que a ação "${item.acao_descricao}" foi cumprida para ${item.cliente_nome}? O status do cliente passará para "${
        item.acao_status_label || 'o status da ação'
      }".`,
      confirmText: 'Confirmar',
      cancelText: 'Cancelar',
    });
    if (!ok) return;

    setCumprindo(item.seq_agenda);
    try {
      const resp = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({ action: 'cumprir', seq_agenda: item.seq_agenda }),
      });
      if (!resp?.success) return;
      await carregar();
    } catch (e) {
      console.error('Erro ao confirmar o cumprimento:', e);
    } finally {
      setCumprindo(null);
    }
  };

  const nomeClienteSelecionado = clientes.find((c) => c.cnpj === formCnpj);

  return (
    <AdminLayout title="AGENDA DE VENDAS">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Agenda de vendas
            </CardTitle>
            <CardDescription>
              Programe as ações de venda para os clientes da carteira. Ao confirmar o cumprimento, o
              status do cliente passa a ser o status da ação.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={carregar} disabled={loading}>
              <RefreshCw className={cn('size-4 mr-1.5', loading && 'animate-spin')} />
              Recarregar
            </Button>
            <Button size="sm" onClick={() => abrirNovo()}>
              <Plus className="mr-1.5 size-4 text-emerald-300" />
              Nova ação
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-3">
          {/* ===== FILTROS ===== */}
          <div className="space-y-3 rounded-md border border-border/60 bg-muted/30 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex items-center gap-1 pb-0.5">
                <Button variant="outline" size="sm" className="h-8 w-8 px-0" onClick={() => deslocarPeriodo(-7)} title="Voltar 7 dias">
                  <ChevronLeft className="size-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={definirPeriodoPadrao}>
                  Padrão
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 px-0" onClick={() => deslocarPeriodo(7)} title="Avançar 7 dias">
                  <ChevronRight className="size-3.5" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">De</Label>
                <DateInput
                  value={periodo.ini}
                  onChange={(e) => alterarInicioPeriodo(e.target.value)}
                  className="h-8 w-[145px] text-xs"
                  aria-label="Data inicial do período"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">Até</Label>
                <DateInput
                  value={periodo.fim}
                  onChange={(e) => alterarFimPeriodo(e.target.value)}
                  className="h-8 w-[145px] text-xs"
                  aria-label="Data final do período"
                />
              </div>
              <div className="flex flex-wrap gap-1 pb-0.5">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => definirPeriodoRapido('hoje')}>Hoje</Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => definirPeriodoRapido('semana')}>Esta semana</Button>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => definirPeriodoRapido('mes')}>Este mês</Button>
              </div>
            </div>

            {ehVendedor ? (
              <Badge
                variant="outline"
                className="gap-1 border-primary/40 bg-primary/5 text-[11px] font-medium text-primary"
              >
                Minha agenda
                {eu?.nome ? ` · ${eu.nome}` : ''}
              </Badge>
            ) : (
              <div className="space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground">Vendedores</span>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  <button
                    type="button"
                    onClick={() => setLoginsFiltro([])}
                    className={cn(
                      'flex min-w-0 items-center justify-center rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                      loginsFiltro.length === 0
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                    )}
                  >
                    Todos
                  </button>
                  {vendedores.map((v) => {
                    const ativo = loginsFiltro.includes(v.login);
                    const hue = vendedorHue(v.login.toLowerCase());
                    return (
                      <button
                        key={v.login}
                        type="button"
                        onClick={() => alternarVendedor(v.login)}
                        className={cn(
                          'flex min-w-0 items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-left text-[11px] font-medium transition-colors',
                          ativo ? 'ring-1 ring-inset' : 'bg-background hover:bg-muted/60'
                        )}
                        style={{
                          borderColor: `hsl(${hue} 65% 55%)`,
                          color: `hsl(${hue} 65% 32%)`,
                          ...(ativo ? { backgroundColor: `hsl(${hue} 80% 93%)` } : {}),
                        }}
                      >
                        <span className="truncate">{v.nome || v.login}</span>
                        <span className="shrink-0 tabular-nums">({v.qtd_clientes ?? 0})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ===== LEGENDA ===== */}
          <div className="flex flex-wrap items-center gap-4 px-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-border bg-background" /> Dia útil
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border border-border bg-muted" /> Fim de semana
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm border-2 border-primary bg-background" /> Hoje
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-600" /> Ação cumprida
            </span>
          </div>

          {/* ===== CALENDÁRIO ===== */}
          <div className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-7 bg-muted/50">
              {SEMANA.map((d, i) => (
                <div
                  key={d}
                  className={cn(
                    'py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground',
                    (i === 0 || i === 6) && 'text-muted-foreground/70'
                  )}
                >
                  {d}
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-7 divide-x divide-y divide-border border-t border-border">
                {dias.map((dia) => {
                  const chave = ymd(dia);
                  const itens = agendaPorDia[chave] ?? [];
                  const fimDeSemana = dia.getDay() === 0 || dia.getDay() === 6;
                  const ehHoje = chave === ymd(hoje);
                  const dentroPeriodo = chave >= periodo.ini && chave <= periodo.fim;
                  const mesLabel = dia.getDate() === 1 || dia === dias[0] ? MESES_CURTOS[dia.getMonth()] : '';

                  return (
                    <div
                      key={chave}
                      className={cn(
                        'group flex min-h-[128px] flex-col gap-1 p-1.5',
                        fimDeSemana ? 'bg-muted/40' : 'bg-background',
                        !dentroPeriodo && 'opacity-40',
                        ehHoje && 'ring-1 ring-inset ring-primary'
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={cn(
                            'text-[11px] font-semibold tabular-nums',
                            ehHoje
                              ? 'flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground'
                              : 'text-foreground'
                          )}
                        >
                          {dia.getDate()}
                        </span>
                        <div className="flex items-center gap-1">
                          {mesLabel && (
                            <span className="text-[10px] uppercase text-muted-foreground">{mesLabel}</span>
                          )}
                          {dentroPeriodo && (
                            <button
                              type="button"
                              onClick={() => abrirNovo(chave)}
                              title="Agendar ação nesta data"
                              className="rounded p-0.5 text-emerald-600 opacity-0 transition-opacity hover:bg-emerald-500/10 hover:text-emerald-700 focus:opacity-100 group-hover:opacity-100"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        {itens.map((item) => (
                          <div
                            key={item.seq_agenda}
                            style={{ borderLeftColor: `hsl(${vendedorHue(item.login.toLowerCase())} 65% 48%)` }}
                            className={cn(
                              'rounded border border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight',
                              item.cumprida
                                ? 'border-emerald-300/70 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/40'
                                : 'border-border bg-card'
                            )}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span
                                className="truncate font-medium text-foreground"
                                title={item.cliente_nome || item.cnpj_fmt}
                              >
                                {item.cliente_nome || item.cnpj_fmt}
                              </span>
                              {item.cumprida && (
                                <CheckCircle2 className="mt-[1px] size-3 shrink-0 text-emerald-600" />
                              )}
                            </div>

                            <div className="mt-0.5 flex items-center gap-1">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'px-1 py-0 text-[9px] font-semibold leading-4',
                                  STATUS_BADGE[item.acao_status] ?? ''
                                )}
                              >
                                {item.acao_status_label || item.acao_status || '—'}
                              </Badge>
                            </div>

                            <p className="mt-0.5 truncate text-muted-foreground" title={item.acao_descricao}>
                              {item.acao_descricao || 'Ação não encontrada'}
                            </p>

                            {!ehVendedor && (
                              <p
                                className="mt-0.5 w-fit max-w-full truncate rounded px-1 text-[10px] font-medium"
                                style={{
                                  color: `hsl(${vendedorHue(item.login.toLowerCase())} 65% 32%)`,
                                  backgroundColor: `hsl(${vendedorHue(item.login.toLowerCase())} 80% 93%)`,
                                }}
                              >
                                {item.vendedor_nome || item.login}
                              </p>
                            )}

                            <div className="mt-1 flex items-center justify-end gap-0.5">
                              <button
                                type="button"
                                onClick={() => abrirEdicao(item)}
                                title="Alterar ação e observação"
                                className="rounded p-0.5 text-blue-600 hover:bg-blue-500/10 hover:text-blue-700"
                              >
                                <Pencil className="size-3" />
                              </button>
                              {!item.cumprida && (
                                <button
                                  type="button"
                                  onClick={() => cumprir(item)}
                                  disabled={cumprindo === item.seq_agenda}
                                  title="Confirmar cumprimento"
                                  className="rounded p-0.5 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 disabled:opacity-50"
                                >
                                  {cumprindo === item.seq_agenda ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== DIALOG: COMPROMISSO ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editando ? 'Alterar compromisso' : 'Nova ação na agenda'}</DialogTitle>
            <DialogDescription>
              {editando
                ? 'É possível alterar a ação de venda e a observação. O cliente permanece o mesmo.'
                : 'Selecione o vendedor, o cliente da carteira e a ação de venda.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <DateInput
                  value={formData}
                  disabled={!!editando}
                  onChange={(e) => setFormData(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Vendedor</Label>
                {ehVendedor || editando ? (
                  <div className="flex h-8 items-center rounded-md border border-input bg-muted/40 px-2 text-xs text-muted-foreground">
                    {editando
                      ? `${editando.vendedor_nome || editando.login}`
                      : `${eu?.nome || eu?.login || ''}`}
                  </div>
                ) : (
                  <Select value={formLogin} onValueChange={trocarVendedorForm}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendedores.map((v) => (
                        <SelectItem key={v.login} value={v.login} className="text-xs">
                          {v.nome || v.login}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Cliente</Label>
              {editando ? (
                <div className="flex h-8 items-center rounded-md border border-input bg-muted/40 px-2 text-xs text-muted-foreground">
                  {editando.cliente_nome || editando.cnpj_fmt}
                </div>
              ) : !formLogin ? (
                <p className="text-xs text-muted-foreground">Selecione o vendedor para carregar a carteira.</p>
              ) : (
                <>
                  {formCnpj && (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs">
                      <span className="truncate font-medium text-foreground">
                        {nomeClienteSelecionado?.nome || formCnpj}
                        {nomeClienteSelecionado?.cnpj_fmt ? ` · ${nomeClienteSelecionado.cnpj_fmt}` : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFormCnpj('')}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Limpar cliente"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={buscaCliente}
                      onChange={(e) => setBuscaCliente(e.target.value)}
                      placeholder="Buscar cliente por nome, CNPJ ou cidade..."
                      className="h-8 pl-7 text-xs"
                    />
                  </div>

                  <div className="max-h-44 overflow-y-auto rounded-md border border-border">
                    {carregandoClientes ? (
                      <div className="flex items-center justify-center py-6">
                        <Loader2 className="size-4 animate-spin text-primary" />
                      </div>
                    ) : clientesFiltrados.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                        Nenhum cliente encontrado na carteira.
                      </p>
                    ) : (
                      clientesFiltrados.map((c) => (
                        <button
                          key={c.cnpj}
                          type="button"
                          onClick={() => setFormCnpj(c.cnpj)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted',
                            formCnpj === c.cnpj && 'bg-primary/10'
                          )}
                        >
                          <span className="truncate font-medium text-foreground">{c.nome}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {c.cnpj_fmt}
                            {c.uf ? ` · ${[c.cidade, c.uf].filter(Boolean).join('/')}` : ''}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Ação de venda</Label>
              <Select value={formCodigoAcao} onValueChange={setFormCodigoAcao}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione a ação" />
                </SelectTrigger>
                <SelectContent>
                  {acoes.map((a) => (
                    <SelectItem key={a.codigo} value={String(a.codigo)} className="text-xs">
                      {a.codigo} — {a.descricao}
                      {a.status_label ? ` (${a.status_label})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {acoes.length === 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Nenhuma ação de venda cadastrada. Cadastre em Comercial › Ações de Venda.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Observação</Label>
              <Textarea
                value={formObservacao}
                onChange={(e) => setFormObservacao(e.target.value)}
                placeholder="Detalhes do compromisso (opcional)"
                className="min-h-[64px] text-xs"
                maxLength={500}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={salvando}>
              {salvando && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              {editando ? 'Salvar alterações' : 'Agendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmarDialog}
    </AdminLayout>
  );
}
