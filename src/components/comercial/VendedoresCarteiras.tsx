import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  X,
  Download,
  RefreshCw,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Phone,
  Building2,
  UserSquare2,
  Info,
} from 'lucide-react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
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
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch, getDefaultHeaders } from '../../utils/apiUtils';
import { SortableTableHeader, useSortableTable } from '../table/SortableTableHeader';
import { useConfirmDialog } from '../ui/alert-dialog';

/**
 * ================================================================
 * COMERCIAL - VENDEDORES E CARTEIRAS
 * ================================================================
 * - Lista os vendedores (tabela [dominio]_vendedor) com totais da carteira
 * - Permite abrir a carteira do vendedor e definir o status da negociação
 *   de cada cliente (tabela [dominio]_vendedor_cliente: status + data_status)
 * - Importa vendedores e carteiras do TMS
 * - Exporta CSV (vendedores + clientes + status)
 * - Busca um cliente e mostra o(s) vendedor(es) responsáveis
 * ================================================================
 */

const API = `${ENVIRONMENT.apiBaseUrl}/comercial/vendedores_carteiras.php`;
const ITEMS_PER_PAGE = 70;
const ITEMS_PER_PAGE_CARTEIRA = 70;

type StatusCodigo = 'C' | 'D' | 'P' | 'N';

const STATUS_LIST: { value: StatusCodigo; label: string; badge: string }[] = [
  {
    value: 'C',
    label: 'CONQUISTA',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  },
  {
    value: 'N',
    label: 'EM NEGOCIAÇÃO',
    badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200',
  },
  {
    value: 'P',
    label: 'EM PROSPECÇÃO',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  },
  {
    value: 'D',
    label: 'CADASTRADO',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
];

const STATUS_MAP: Record<string, { label: string; badge: string }> = STATUS_LIST.reduce(
  (acc, s) => {
    acc[s.value] = { label: s.label, badge: s.badge };
    return acc;
  },
  {} as Record<string, { label: string; badge: string }>
);

interface Vendedor {
  login: string;
  nome: string;
  tele_venda: boolean;
  qtd_clientes: number;
  qtd_conquista: number;
  qtd_negociacao: number;
  qtd_prospeccao: number;
  qtd_cadastrado: number;
}

interface TotaisVendedores {
  vendedores: number;
  clientes: number;
  conquista: number;
  negociacao: number;
  prospeccao: number;
  cadastrado: number;
}

interface ClienteCarteira {
  cnpj: string;
  cnpj_fmt: string;
  nome: string;
  cidade: string;
  uf: string;
  data_ult_mvto: string;
  status: StatusCodigo;
  status_label: string;
  data_status: string;
}

interface TotaisCarteira {
  total: number;
  C: number;
  D: number;
  P: number;
  N: number;
}

interface VendedorDoCliente {
  login: string;
  nome: string;
  tele_venda: boolean;
  status: StatusCodigo;
  status_label: string;
  data_status: string;
}

interface ClienteBusca {
  cnpj: string;
  cnpj_fmt: string;
  nome: string;
  cidade: string;
  uf: string;
  vendedores: VendedorDoCliente[];
}

function hojeBR(): string {
  return new Date().toLocaleDateString('pt-BR');
}

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? STATUS_MAP['D'];
  return <Badge className={`${info.badge} text-[11px] h-5 px-2 whitespace-nowrap`}>{info.label}</Badge>;
}

export function VendedoresCarteiras() {
  const { user } = useAuth();
  usePageTitle('Vendedores e Carteiras');
  const { confirm: confirmar, dialog: confirmarDialog } = useConfirmDialog();

  const [loading, setLoading] = useState(true);
  const [importando, setImportando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [totais, setTotais] = useState<TotaisVendedores | null>(null);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);

  // ============ CARTEIRA (DIALOG) ============
  const [carteiraOpen, setCarteiraOpen] = useState(false);
  const [carteiraVendedor, setCarteiraVendedor] = useState<Vendedor | null>(null);
  const [clientes, setClientes] = useState<ClienteCarteira[]>([]);
  const [totaisCarteira, setTotaisCarteira] = useState<TotaisCarteira | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [paginaCarteira, setPaginaCarteira] = useState(1);
  const [salvandoCnpj, setSalvandoCnpj] = useState<string | null>(null);

  // ============ BUSCA DE CLIENTE (DIALOG) ============
  const [buscaGlobal, setBuscaGlobal] = useState('');
  const [resultadoBusca, setResultadoBusca] = useState<ClienteBusca[] | null>(null);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [buscaOpen, setBuscaOpen] = useState(false);

  // ============ ORDENAÇÃO ============
  type VendedorSortField =
    | 'login'
    | 'nome'
    | 'tele_venda'
    | 'qtd_clientes'
    | 'qtd_conquista'
    | 'qtd_negociacao'
    | 'qtd_prospeccao'
    | 'qtd_cadastrado';
  const vendedorSort = useSortableTable<VendedorSortField>('nome', 'asc');

  type ClienteSortField =
    | 'cnpj'
    | 'nome'
    | 'cidade'
    | 'uf'
    | 'data_ult_mvto'
    | 'status'
    | 'data_status';
  const clienteSort = useSortableTable<ClienteSortField>('nome', 'asc');

  // ============ CARREGAMENTO ============
  const carregarVendedores = useCallback(async () => {
    try {
      setLoading(true);
      const resp = await apiFetch(API);
      if (resp?.success) {
        setVendedores(resp.vendedores || []);
        setTotais(resp.totais || null);
      } else {
        setVendedores([]);
        setTotais(null);
      }
    } catch (e) {
      console.error('Erro ao carregar vendedores:', e);
      setVendedores([]);
      setTotais(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarVendedores();
  }, [carregarVendedores, user?.domain]);

  const carregarClientes = useCallback(async (login: string) => {
    try {
      setLoadingClientes(true);
      const resp = await apiFetch(`${API}?action=clientes&login=${encodeURIComponent(login)}`);
      if (resp?.success) {
        setClientes(resp.clientes || []);
        setTotaisCarteira(resp.totais || null);
      } else {
        setClientes([]);
        setTotaisCarteira(null);
      }
    } catch (e) {
      console.error('Erro ao carregar carteira:', e);
      setClientes([]);
      setTotaisCarteira(null);
    } finally {
      setLoadingClientes(false);
    }
  }, []);

  const abrirCarteira = (vendedor: Vendedor) => {
    setCarteiraVendedor(vendedor);
    setClientes([]);
    setTotaisCarteira(null);
    setBuscaCliente('');
    setPaginaCarteira(1);
    setCarteiraOpen(true);
    carregarClientes(vendedor.login);
  };

  // ============ AÇÕES ============
  const alterarStatus = async (cliente: ClienteCarteira, novoStatus: StatusCodigo) => {
    if (!carteiraVendedor || novoStatus === cliente.status) return;

    const anterior = {
      status: cliente.status,
      status_label: cliente.status_label,
      data_status: cliente.data_status,
    };

    setSalvandoCnpj(cliente.cnpj);
    setClientes((prev) =>
      prev.map((c) =>
        c.cnpj === cliente.cnpj
          ? {
              ...c,
              status: novoStatus,
              status_label: STATUS_MAP[novoStatus]?.label ?? '',
              data_status: hojeBR(),
            }
          : c
      )
    );

    try {
      const resp = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_status',
          login: carteiraVendedor.login,
          cnpj: cliente.cnpj,
          status: novoStatus,
        }),
      });

      if (!resp?.success) {
        setClientes((prev) =>
          prev.map((c) => (c.cnpj === cliente.cnpj ? { ...c, ...anterior } : c))
        );
        return;
      }

      if (totaisCarteira) {
        setTotaisCarteira({
          ...totaisCarteira,
          [anterior.status]: Math.max(0, (totaisCarteira[anterior.status] ?? 0) - 1),
          [novoStatus]: (totaisCarteira[novoStatus] ?? 0) + 1,
        });
      }
      setVendedores((prev) =>
        prev.map((v) =>
          v.login === carteiraVendedor.login ? ajustarContadores(v, anterior.status, novoStatus) : v
        )
      );
    } catch (e) {
      console.error('Erro ao atualizar status:', e);
      setClientes((prev) =>
        prev.map((c) => (c.cnpj === cliente.cnpj ? { ...c, ...anterior } : c))
      );
    } finally {
      setSalvandoCnpj(null);
    }
  };

  const importar = async () => {
    const ok = await confirmar({
      title: 'Importar vendedores e carteiras',
      description:
        'A importação traz do TMS todos os vendedores e as carteiras de clientes, reescrevendo os vínculos existentes.\n\nOs status de negociação já definidos são preservados.\n\nDeseja continuar?',
      confirmText: 'Importar',
    });
    if (!ok) return;

    try {
      setImportando(true);
      await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({ action: 'importar' }),
      });
      await carregarVendedores();
    } catch (e) {
      console.error('Erro ao importar vendedores:', e);
    } finally {
      setImportando(false);
    }
  };

  const exportarCsv = async () => {
    try {
      setExportando(true);
      const resp = await fetch(`${API}?action=exportar`, {
        method: 'GET',
        headers: getDefaultHeaders(),
      });

      if (!resp.ok) {
        toast.error('Falha ao exportar a planilha');
        return;
      }

      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendedores_carteiras_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Planilha exportada');
    } catch (e: any) {
      toast.error('Erro ao exportar', { description: e?.message || 'Falha inesperada.' });
    } finally {
      setExportando(false);
    }
  };

  const buscarCliente = async () => {
    const termo = buscaGlobal.trim();
    if (termo === '') {
      toast.error('Informe o nome ou o CNPJ do cliente');
      return;
    }

    try {
      setBuscandoCliente(true);
      setBuscaOpen(true);
      setResultadoBusca(null);
      const resp = await apiFetch(`${API}?action=buscar_cliente&q=${encodeURIComponent(termo)}`);
      if (resp?.success) {
        setResultadoBusca(resp.clientes || []);
      } else {
        setResultadoBusca([]);
      }
    } catch (e) {
      console.error('Erro ao buscar cliente:', e);
      setResultadoBusca([]);
    } finally {
      setBuscandoCliente(false);
    }
  };

  // ============ DERIVADOS ============
  const vendedoresFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return vendedores;
    return vendedores.filter(
      (v) => v.login.toLowerCase().includes(termo) || v.nome.toLowerCase().includes(termo)
    );
  }, [vendedores, busca]);

  const vendedoresOrdenados = useMemo(
    () => vendedorSort.sortData(vendedoresFiltrados),
    [vendedoresFiltrados, vendedorSort]
  );

  const totalPaginas = Math.max(1, Math.ceil(vendedoresOrdenados.length / ITEMS_PER_PAGE));
  const inicio = (pagina - 1) * ITEMS_PER_PAGE;
  const vendedoresPagina = vendedoresOrdenados.slice(inicio, inicio + ITEMS_PER_PAGE);

  const clientesFiltrados = useMemo(() => {
    const termo = buscaCliente.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(termo) ||
        c.cnpj_fmt.toLowerCase().includes(termo) ||
        c.cidade.toLowerCase().includes(termo)
    );
  }, [clientes, buscaCliente]);

  const clientesOrdenados = useMemo(
    () => clienteSort.sortData(clientesFiltrados),
    [clientesFiltrados, clienteSort]
  );

  const totalPaginasCarteira = Math.max(
    1,
    Math.ceil(clientesOrdenados.length / ITEMS_PER_PAGE_CARTEIRA)
  );
  const inicioCarteira = (paginaCarteira - 1) * ITEMS_PER_PAGE_CARTEIRA;
  const clientesPagina = clientesOrdenados.slice(
    inicioCarteira,
    inicioCarteira + ITEMS_PER_PAGE_CARTEIRA
  );

  return (
    <AdminLayout title="VENDEDORES E CARTEIRAS">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4 gap-4">
          <div className="min-w-0">
            <CardTitle>Vendedores</CardTitle>
            <CardDescription>
              Carteiras de clientes e status da negociação
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={importar}
              disabled={importando || loading}
            >
              {importando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {importando ? 'Importando...' : 'Importar do TMS'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={exportarCsv}
              disabled={exportando}
            >
              {exportando ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Exportar CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* FILTROS */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar vendedor por login ou nome..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                className="pl-10 h-9"
              />
            </div>
            {busca && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 h-9"
                onClick={() => {
                  setBusca('');
                  setPagina(1);
                }}
              >
                <X className="w-4 h-4" />
                Limpar
              </Button>
            )}

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block" />

            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar cliente (nome ou CNPJ) e ver o vendedor..."
                value={buscaGlobal}
                onChange={(e) => setBuscaGlobal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') buscarCliente();
                }}
                className="pl-10 h-9"
              />
            </div>
            <Button size="sm" className="gap-2 h-9" onClick={buscarCliente} disabled={buscandoCliente}>
              {buscandoCliente ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              Buscar cliente
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <>
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="login"
                        label="Login"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[130px]"
                      />
                      <SortableTableHeader
                        field="nome"
                        label="Nome"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                      />
                      <SortableTableHeader
                        field="tele_venda"
                        label="Tele-venda"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[110px]"
                      />
                      <SortableTableHeader
                        field="qtd_clientes"
                        label="Clientes"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[100px]"
                      />
                      <SortableTableHeader
                        field="qtd_conquista"
                        label="Conquista"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[100px]"
                      />
                      <SortableTableHeader
                        field="qtd_negociacao"
                        label="Negociação"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[110px]"
                      />
                      <SortableTableHeader
                        field="qtd_prospeccao"
                        label="Prospecção"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[110px]"
                      />
                      <SortableTableHeader
                        field="qtd_cadastrado"
                        label="Cadastrado"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[110px]"
                      />
                      <TableHead className="w-[140px] text-right">Carteira</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendedoresPagina.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-slate-500 py-10">
                          {busca
                            ? 'Nenhum vendedor encontrado para essa busca.'
                            : 'Nenhum vendedor cadastrado. Clique em "Importar do TMS" para começar.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      vendedoresPagina.map((v) => (
                        <TableRow key={v.login}>
                          <TableCell className="font-mono text-xs">{v.login}</TableCell>
                          <TableCell className="font-medium">{v.nome}</TableCell>
                          <TableCell>
                            {v.tele_venda ? (
                              <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 text-[11px] h-5 px-2">
                                <Phone className="w-3 h-3 mr-1" />
                                SIM
                              </Badge>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-semibold tabular-nums">{v.qtd_clientes}</TableCell>
                          <TableCell className="tabular-nums">
                            <span className={v.qtd_conquista > 0 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                              {v.qtd_conquista}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <span className={v.qtd_negociacao > 0 ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}>
                              {v.qtd_negociacao}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <span className={v.qtd_prospeccao > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-400'}>
                              {v.qtd_prospeccao}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            <span className={v.qtd_cadastrado > 0 ? 'font-semibold text-slate-600 dark:text-slate-300' : 'text-slate-400'}>
                              {v.qtd_cadastrado}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 h-8"
                              onClick={() => abrirCarteira(v)}
                              disabled={v.qtd_clientes === 0}
                              title="Ver clientes da carteira"
                            >
                              <Users className="w-3.5 h-3.5" />
                              Ver carteira
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* TOTALIZADORES */}
              {totais && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {vendedoresFiltrados.length} vendedor(es)
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">|</span>
                  <span>
                    <strong className="text-slate-800 dark:text-slate-100">{totais.clientes}</strong> clientes
                  </span>
                  <StatusBadge status="C" />
                  <span className="tabular-nums">{totais.conquista}</span>
                  <StatusBadge status="N" />
                  <span className="tabular-nums">{totais.negociacao}</span>
                  <StatusBadge status="P" />
                  <span className="tabular-nums">{totais.prospeccao}</span>
                  <StatusBadge status="D" />
                  <span className="tabular-nums">{totais.cadastrado}</span>
                </div>
              )}

              {/* PAGINAÇÃO */}
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Exibindo {inicio + 1} a {Math.min(inicio + ITEMS_PER_PAGE, vendedoresOrdenados.length)} de{' '}
                    {vendedoresOrdenados.length}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      disabled={pagina === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Página {pagina} de {totalPaginas}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                      disabled={pagina === totalPaginas}
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ================= DIALOG: CARTEIRA ================= */}
      <Dialog open={carteiraOpen} onOpenChange={setCarteiraOpen}>
        <DialogContent className="max-w-5xl h-[calc(100vh-80px)] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              Carteira de {carteiraVendedor?.nome ?? '—'}
              {carteiraVendedor?.login && (
                <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono text-[11px]">
                  {carteiraVendedor.login}
                </Badge>
              )}
              {carteiraVendedor?.tele_venda && (
                <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 text-[11px]">
                  <Phone className="w-3 h-3 mr-1" />
                  TELE-VENDA
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Defina o status da negociação de cada cliente da carteira
            </DialogDescription>
          </DialogHeader>

          <div className="shrink-0 py-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Buscar cliente na carteira..."
                  value={buscaCliente}
                  onChange={(e) => {
                    setBuscaCliente(e.target.value);
                    setPaginaCarteira(1);
                  }}
                  className="pl-10 h-9"
                />
              </div>
              {buscaCliente && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 h-9"
                  onClick={() => {
                    setBuscaCliente('');
                    setPaginaCarteira(1);
                  }}
                >
                  <X className="w-4 h-4" />
                  Limpar
                </Button>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 h-9"
                  onClick={() => carteiraVendedor && carregarClientes(carteiraVendedor.login)}
                  disabled={loadingClientes}
                >
                  {loadingClientes ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Atualizar
                </Button>
              </div>
            </div>

            {totaisCarteira && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {totaisCarteira.total} cliente(s)
                </span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <StatusBadge status="C" />
                <span className="tabular-nums">{totaisCarteira.C}</span>
                <StatusBadge status="N" />
                <span className="tabular-nums">{totaisCarteira.N}</span>
                <StatusBadge status="P" />
                <span className="tabular-nums">{totaisCarteira.P}</span>
                <StatusBadge status="D" />
                <span className="tabular-nums">{totaisCarteira.D}</span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain pr-1">
            {loadingClientes ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : (
              <div className="rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="cnpj"
                        label="CNPJ"
                        currentSortField={clienteSort.sortField}
                        currentSortDirection={clienteSort.sortDirection}
                        onSort={clienteSort.handleSort}
                        className="w-[170px]"
                      />
                      <SortableTableHeader
                        field="nome"
                        label="Cliente"
                        currentSortField={clienteSort.sortField}
                        currentSortDirection={clienteSort.sortDirection}
                        onSort={clienteSort.handleSort}
                      />
                      <SortableTableHeader
                        field="cidade"
                        label="Cidade"
                        currentSortField={clienteSort.sortField}
                        currentSortDirection={clienteSort.sortDirection}
                        onSort={clienteSort.handleSort}
                        className="w-[180px]"
                      />
                      <SortableTableHeader
                        field="uf"
                        label="UF"
                        currentSortField={clienteSort.sortField}
                        currentSortDirection={clienteSort.sortDirection}
                        onSort={clienteSort.handleSort}
                        className="w-[70px]"
                      />
                      <TableHead className="w-[130px] px-6 py-3 text-xs uppercase tracking-wider">
                        Últ. Movto
                      </TableHead>
                      <SortableTableHeader
                        field="status"
                        label="Status"
                        currentSortField={clienteSort.sortField}
                        currentSortDirection={clienteSort.sortDirection}
                        onSort={clienteSort.handleSort}
                        className="w-[210px]"
                      />
                      <SortableTableHeader
                        field="data_status"
                        label="Data Status"
                        currentSortField={clienteSort.sortField}
                        currentSortDirection={clienteSort.sortDirection}
                        onSort={clienteSort.handleSort}
                        className="w-[130px]"
                      />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesPagina.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                          {buscaCliente
                            ? 'Nenhum cliente encontrado nessa carteira.'
                            : 'Este vendedor não possui clientes na carteira.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      clientesPagina.map((c) => (
                        <TableRow key={c.cnpj}>
                          <TableCell className="font-mono text-xs">{c.cnpj_fmt}</TableCell>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300">{c.cidade}</TableCell>
                          <TableCell className="text-center font-medium">{c.uf}</TableCell>
                          <TableCell className="text-slate-500 text-xs">{c.data_ult_mvto || '—'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={c.status}
                                onValueChange={(v) => alterarStatus(c, v as StatusCodigo)}
                                disabled={salvandoCnpj === c.cnpj}
                              >
                                <SelectTrigger className="h-8 w-[180px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUS_LIST.map((s) => (
                                    <SelectItem key={s.value} value={s.value} className="text-xs">
                                      {s.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {salvandoCnpj === c.cnpj && (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">{c.data_status || '—'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="shrink-0 border-t pt-3 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {clientesOrdenados.length > ITEMS_PER_PAGE_CARTEIRA
                ? `Exibindo ${inicioCarteira + 1} a ${Math.min(
                    inicioCarteira + ITEMS_PER_PAGE_CARTEIRA,
                    clientesOrdenados.length
                  )} de ${clientesOrdenados.length}`
                : `${clientesOrdenados.length} cliente(s)`}
            </div>
            <div className="flex items-center gap-2">
              {totalPaginasCarteira > 1 && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaCarteira((p) => Math.max(1, p - 1))}
                    disabled={paginaCarteira === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </Button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Página {paginaCarteira} de {totalPaginasCarteira}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPaginaCarteira((p) => Math.min(totalPaginasCarteira, p + 1))}
                    disabled={paginaCarteira === totalPaginasCarteira}
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={() => setCarteiraOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= DIALOG: BUSCA DE CLIENTE ================= */}
      <Dialog open={buscaOpen} onOpenChange={setBuscaOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <UserSquare2 className="w-4 h-4" />
              Cliente — {buscaGlobal}
            </DialogTitle>
            <DialogDescription>Vendedor(es) responsáveis pela carteira deste cliente</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain pr-1 py-2 space-y-3">
            {buscandoCliente ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
              </div>
            ) : !resultadoBusca || resultadoBusca.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                <Info className="w-6 h-6" />
                Nenhum cliente encontrado.
              </div>
            ) : (
              resultadoBusca.map((c) => (
                <div
                  key={c.cnpj}
                  className="rounded-lg border border-border p-4 space-y-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-semibold truncate">{c.nome}</span>
                      <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono text-[11px]">
                        {c.cnpj_fmt}
                      </Badge>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {c.cidade ? `${c.cidade}${c.uf ? ` / ${c.uf}` : ''}` : '—'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {c.vendedores.map((v) => (
                      <div
                        key={`${c.cnpj}-${v.login}`}
                        className="flex items-center gap-2 flex-wrap rounded-md bg-slate-50 dark:bg-slate-800/50 px-3 py-2"
                      >
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-medium text-sm">{v.nome}</span>
                        <span className="font-mono text-[11px] text-slate-500">{v.login}</span>
                        {v.tele_venda && (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200 text-[10px] h-5 px-2">
                            <Phone className="w-3 h-3 mr-1" />
                            TELE-VENDA
                          </Badge>
                        )}
                        <span className="ml-auto flex items-center gap-2">
                          <StatusBadge status={v.status} />
                          <span className="text-[11px] text-slate-500 tabular-nums">
                            {v.data_status || '—'}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="shrink-0 border-t pt-3 flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setBuscaOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {confirmarDialog}
    </AdminLayout>
  );
}

function campoContador(status: string): keyof Vendedor {
  switch (status) {
    case 'C':
      return 'qtd_conquista';
    case 'N':
      return 'qtd_negociacao';
    case 'P':
      return 'qtd_prospeccao';
    default:
      return 'qtd_cadastrado';
  }
}

function ajustarContadores(v: Vendedor, de: string, para: string): Vendedor {
  const campoDe = campoContador(de);
  const campoPara = campoContador(para);
  const next = { ...v };
  next[campoDe] = Math.max(0, (v[campoDe] as number) - 1);
  next[campoPara] = ((v[campoPara] as number) || 0) + 1;
  return next;
}
