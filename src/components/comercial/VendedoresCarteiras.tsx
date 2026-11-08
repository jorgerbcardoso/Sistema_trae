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
  Percent,
} from 'lucide-react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
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
import { Switch } from '../ui/switch';
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

type StatusCodigo = 'C' | 'D' | 'P' | 'N' | 'R';

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
  {
    value: 'R',
    label: 'RECONQUISTA',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
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
  qtd_reconquista: number;
  qtd_cadastrado: number;
}

interface TotaisVendedores {
  vendedores: number;
  clientes: number;
  conquista: number;
  negociacao: number;
  prospeccao: number;
  reconquista: number;
  cadastrado: number;
}

interface ClienteCarteira extends ComissaoPeriodo {
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

interface ComissaoPeriodo {
  perc_conquista: number | null;
  data_ini_conquista: string | null;
  data_fin_conquista: string | null;
  perc_manutencao: number | null;
  data_ini_manutencao: string | null;
  data_fin_manutencao: string | null;
  perc_manutencao2: number | null;
  data_ini_manutencao2: string | null;
  data_fin_manutencao2: string | null;
}

type ComissaoFormState = Record<keyof ComissaoPeriodo, string>;

interface DefinicaoPeriodo {
  rotulo: string;
  perc: keyof ComissaoPeriodo;
  ini: keyof ComissaoPeriodo;
  fin: keyof ComissaoPeriodo;
}

const PERIODOS_COMISSAO: DefinicaoPeriodo[] = [
  { rotulo: 'Conquista', perc: 'perc_conquista', ini: 'data_ini_conquista', fin: 'data_fin_conquista' },
  { rotulo: 'Manutenção', perc: 'perc_manutencao', ini: 'data_ini_manutencao', fin: 'data_fin_manutencao' },
  { rotulo: 'Manutenção 2', perc: 'perc_manutencao2', ini: 'data_ini_manutencao2', fin: 'data_fin_manutencao2' },
];

function criarComissaoVazia(): ComissaoFormState {
  return {
    perc_conquista: '',
    data_ini_conquista: '',
    data_fin_conquista: '',
    perc_manutencao: '',
    data_ini_manutencao: '',
    data_fin_manutencao: '',
    perc_manutencao2: '',
    data_ini_manutencao2: '',
    data_fin_manutencao2: '',
  };
}

function formatarPercentualBR(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resumoComissao(cliente: ClienteCarteira): string {
  return PERIODOS_COMISSAO.map((p) => cliente[p.perc])
    .filter((v): v is number => v !== null && v !== undefined)
    .map((v) => `${formatarPercentualBR(v)}%`)
    .join(' · ');
}

interface TotaisCarteira {
  total: number;
  C: number;
  D: number;
  P: number;
  N: number;
  R: number;
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

/** Parâmetros de comissão da empresa ([dominio]_emp_param) — exibição informativa. */
interface ParametrosComissao {
  com_vend_desc_pis_cofins: boolean;
  com_vend_desc_icms: boolean;
  com_vend_apenas_liq: boolean;
  com_vend_apenas_entr: boolean;
}

const PARAMS_COMISSAO_DISPLAY: {
  key: keyof ParametrosComissao;
  label: string;
  title: string;
}[] = [
  {
    key: 'com_vend_desc_pis_cofins',
    label: 'Desconta PIS/COFINS',
    title: 'A base de cálculo da comissão desconta o PIS/COFINS do frete.',
  },
  {
    key: 'com_vend_desc_icms',
    label: 'Desconta ICMS',
    title: 'A base de cálculo da comissão desconta o ICMS do frete.',
  },
  {
    key: 'com_vend_apenas_liq',
    label: 'Só CT-es liquidados',
    title: 'A comissão é paga apenas sobre CT-es liquidados.',
  },
  {
    key: 'com_vend_apenas_entr',
    label: 'Só CT-es entregues',
    title: 'A comissão é paga apenas sobre CT-es entregues.',
  },
];

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
  const [salvandoTeleVendas, setSalvandoTeleVendas] = useState<string | null>(null);

  // ============ CARTEIRA (DIALOG) ============
  const [carteiraOpen, setCarteiraOpen] = useState(false);
  const [carteiraVendedor, setCarteiraVendedor] = useState<Vendedor | null>(null);
  const [clientes, setClientes] = useState<ClienteCarteira[]>([]);
  const [totaisCarteira, setTotaisCarteira] = useState<TotaisCarteira | null>(null);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [paginaCarteira, setPaginaCarteira] = useState(1);
  const [salvandoCnpj, setSalvandoCnpj] = useState<string | null>(null);
  const [statusCarteiraFiltro, setStatusCarteiraFiltro] = useState<StatusCodigo | null>(null);

  // ============ COMISSÃO (DIALOG) ============
  const [comissaoOpen, setComissaoOpen] = useState(false);
  const [comissaoCliente, setComissaoCliente] = useState<ClienteCarteira | null>(null);
  const [comissaoForm, setComissaoForm] = useState<ComissaoFormState>(criarComissaoVazia);
  const [salvandoComissao, setSalvandoComissao] = useState(false);

  // ============ PARÂMETROS DE COMISSÃO DA EMPRESA (DISPLAY) ============
  const [paramsComissao, setParamsComissao] = useState<ParametrosComissao | null>(null);

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

  // Carrega os parâmetros de comissão da empresa apenas para exibição no topo.
  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const resp = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/admin/empresa_parametros.php`,
          { method: 'GET' },
          true
        );
        if (!ativo || !resp?.success) return;
        const p = resp.params ?? {};
        setParamsComissao({
          com_vend_desc_pis_cofins: !!p.com_vend_desc_pis_cofins,
          com_vend_desc_icms: !!p.com_vend_desc_icms,
          com_vend_apenas_liq: !!p.com_vend_apenas_liq,
          com_vend_apenas_entr: !!p.com_vend_apenas_entr,
        });
      } catch {
        // Exibição apenas informativa — falha não bloqueia a tela.
      }
    })();
    return () => {
      ativo = false;
    };
  }, [user?.domain]);

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

  const abrirCarteira = (vendedor: Vendedor, status: StatusCodigo | null = null) => {
    setCarteiraVendedor(vendedor);
    setClientes([]);
    setTotaisCarteira(null);
    setBuscaCliente('');
    setPaginaCarteira(1);
    setStatusCarteiraFiltro(status);
    setCarteiraOpen(true);
    carregarClientes(vendedor.login);
  };

  // ============ AÇÕES ============
  const alterarTeleVendas = async (vendedor: Vendedor, habilitado: boolean) => {
    const teleVendaAnterior = vendedor.tele_venda;
    setSalvandoTeleVendas(vendedor.login);
    setVendedores((prev) =>
      prev.map((v) => (v.login === vendedor.login ? { ...v, tele_venda: habilitado } : v))
    );

    try {
      const resp = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify({
          action: 'update_tele_venda',
          login: vendedor.login,
          tele_venda: habilitado,
        }),
      });
      if (!resp?.success) {
        setVendedores((prev) =>
          prev.map((v) =>
            v.login === vendedor.login ? { ...v, tele_venda: teleVendaAnterior } : v
          )
        );
      }
    } catch (e) {
      console.error('Erro ao atualizar tele-vendas:', e);
      setVendedores((prev) =>
        prev.map((v) =>
          v.login === vendedor.login ? { ...v, tele_venda: teleVendaAnterior } : v
        )
      );
    } finally {
      setSalvandoTeleVendas(null);
    }
  };

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

  const abrirComissao = (cliente: ClienteCarteira) => {
    setComissaoCliente(cliente);
    setComissaoForm({
      perc_conquista: formatarPercentualBR(cliente.perc_conquista),
      data_ini_conquista: cliente.data_ini_conquista ?? '',
      data_fin_conquista: cliente.data_fin_conquista ?? '',
      perc_manutencao: formatarPercentualBR(cliente.perc_manutencao),
      data_ini_manutencao: cliente.data_ini_manutencao ?? '',
      data_fin_manutencao: cliente.data_fin_manutencao ?? '',
      perc_manutencao2: formatarPercentualBR(cliente.perc_manutencao2),
      data_ini_manutencao2: cliente.data_ini_manutencao2 ?? '',
      data_fin_manutencao2: cliente.data_fin_manutencao2 ?? '',
    });
    setComissaoOpen(true);
  };

  const limparPeriodoComissao = (periodo: DefinicaoPeriodo) => {
    setComissaoForm((prev) => ({ ...prev, [periodo.perc]: '', [periodo.ini]: '', [periodo.fin]: '' }));
  };

  const salvarComissao = async () => {
    if (!comissaoCliente || !carteiraVendedor) return;

    const payload: Record<string, string | number | null> = {
      action: 'update_comissao',
      login: carteiraVendedor.login,
      cnpj: comissaoCliente.cnpj,
    };

    let periodosPreenchidos = 0;

    for (const periodo of PERIODOS_COMISSAO) {
      const percRaw = comissaoForm[periodo.perc].trim();
      const iniRaw = comissaoForm[periodo.ini].trim();
      const finRaw = comissaoForm[periodo.fin].trim();

      const usado = percRaw !== '' || iniRaw !== '' || finRaw !== '';

      if (!usado) {
        payload[periodo.perc] = null;
        payload[periodo.ini] = null;
        payload[periodo.fin] = null;
        continue;
      }

      if (percRaw === '' || iniRaw === '' || finRaw === '') {
        toast.error(`Preencha o percentual e as datas inicial e final do período ${periodo.rotulo}.`);
        return;
      }

      const percNum = Number(percRaw.replace(',', '.'));
      if (!Number.isFinite(percNum) || percNum < 0 || percNum > 100) {
        toast.error(`O percentual do período ${periodo.rotulo} deve estar entre 0 e 100.`);
        return;
      }

      if (iniRaw > finRaw) {
        toast.error(`No período ${periodo.rotulo}, a data inicial não pode ser posterior à final.`);
        return;
      }

      payload[periodo.perc] = percNum;
      payload[periodo.ini] = iniRaw;
      payload[periodo.fin] = finRaw;
      periodosPreenchidos++;
    }

    if (periodosPreenchidos === 0) {
      toast.error('Informe ao menos um período de comissão (Conquista, Manutenção ou Manutenção 2).');
      return;
    }

    try {
      setSalvandoComissao(true);
      const resp = await apiFetch(API, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!resp?.success) return;

      setClientes((prev) =>
        prev.map((c) =>
          c.cnpj === comissaoCliente.cnpj
            ? {
                ...c,
                perc_conquista: payload.perc_conquista as number | null,
                data_ini_conquista: payload.data_ini_conquista as string | null,
                data_fin_conquista: payload.data_fin_conquista as string | null,
                perc_manutencao: payload.perc_manutencao as number | null,
                data_ini_manutencao: payload.data_ini_manutencao as string | null,
                data_fin_manutencao: payload.data_fin_manutencao as string | null,
                perc_manutencao2: payload.perc_manutencao2 as number | null,
                data_ini_manutencao2: payload.data_ini_manutencao2 as string | null,
                data_fin_manutencao2: payload.data_fin_manutencao2 as string | null,
              }
            : c
        )
      );
      setComissaoOpen(false);
    } catch (e) {
      console.error('Erro ao salvar comissão:', e);
    } finally {
      setSalvandoComissao(false);
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
    return clientes.filter(
      (c) =>
        (!termo ||
          c.nome.toLowerCase().includes(termo) ||
          c.cnpj_fmt.toLowerCase().includes(termo) ||
          c.cidade.toLowerCase().includes(termo)) &&
        (!statusCarteiraFiltro || c.status === statusCarteiraFiltro)
    );
  }, [clientes, buscaCliente, statusCarteiraFiltro]);

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

            {paramsComissao && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Regras de comissão:
                </span>
                {PARAMS_COMISSAO_DISPLAY.map(({ key, label, title }) => {
                  const ativo = paramsComissao[key];
                  return (
                    <Badge
                      key={key}
                      variant="outline"
                      title={ativo ? title : `Inativo — ${title}`}
                      className={`gap-1.5 text-[11px] h-5 px-2 whitespace-nowrap font-normal ${
                        ativo
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-500'
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          ativo ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                        }`}
                      />
                      {label}
                    </Badge>
                  );
                })}
              </div>
            )}

            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">
              Clique sobre os números para ver os clientes.
            </p>
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
              <div className="rounded-md border border-border overflow-hidden [&>div]:overflow-x-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="login"
                        label="Login"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[8%] !px-2 !py-2 text-[11px] leading-tight"
                      />
                      <SortableTableHeader
                        field="nome"
                        label="Nome"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[18%] !px-2 !py-2 text-[11px] leading-tight"
                      />
                      <SortableTableHeader
                        field="tele_venda"
                        label="Tele-vendas"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[8%] !px-2 !py-2 text-[11px] leading-tight text-center [&>button]:mx-auto"
                      />
                      {([
                        ['qtd_cadastrado', 'Cadastrados'],
                        ['qtd_prospeccao', 'Prospecção'],
                        ['qtd_negociacao', 'Negociação'],
                        ['qtd_conquista', 'Conquista'],
                        ['qtd_reconquista', 'Reconquista'],
                      ] as const).map(([field, label]) => (
                        <SortableTableHeader
                          key={field}
                          field={field}
                          label={label}
                          currentSortField={vendedorSort.sortField}
                          currentSortDirection={vendedorSort.sortDirection}
                          onSort={vendedorSort.handleSort}
                          className="w-[10%] !px-2 !py-2 text-[11px] leading-tight text-center [&>button]:mx-auto"
                        />
                      ))}
                      <SortableTableHeader
                        field="qtd_clientes"
                        label="Total"
                        currentSortField={vendedorSort.sortField}
                        currentSortDirection={vendedorSort.sortDirection}
                        onSort={vendedorSort.handleSort}
                        className="w-[16%] !px-2 !py-2 text-[11px] leading-tight text-center [&>button]:mx-auto"
                      />
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
                          <TableCell className="p-2 font-mono text-xs truncate" title={v.login}>
                            {v.login}
                          </TableCell>
                          <TableCell className="p-2 font-medium truncate max-w-0" title={v.nome}>
                            {v.nome}
                          </TableCell>
                          <TableCell className="p-2 text-center">
                            <Switch
                              checked={v.tele_venda}
                              onCheckedChange={(checked) => alterarTeleVendas(v, checked)}
                              disabled={Boolean(salvandoTeleVendas)}
                              aria-label={`Tele-vendas para ${v.nome}`}
                              title={v.tele_venda ? 'Desativar tele-vendas' : 'Ativar tele-vendas'}
                              className="scale-90"
                            />
                          </TableCell>
                          {([
                            ['D', 'qtd_cadastrado', 'text-slate-600 dark:text-slate-300'],
                            ['P', 'qtd_prospeccao', 'text-amber-600 dark:text-amber-400'],
                            ['N', 'qtd_negociacao', 'text-indigo-600 dark:text-indigo-400'],
                            ['C', 'qtd_conquista', 'text-emerald-600 dark:text-emerald-400'],
                            ['R', 'qtd_reconquista', 'text-rose-600 dark:text-rose-400'],
                          ] as const).map(([status, field, color]) => (
                            <TableCell key={status} className="p-2 text-center tabular-nums">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={`h-7 min-w-8 px-1 font-semibold ${v[field] > 0 ? color : 'text-slate-400'}`}
                                onClick={() => abrirCarteira(v, status)}
                                disabled={v[field] === 0}
                                title={`Ver clientes ${STATUS_MAP[status].label.toLowerCase()}`}
                              >
                                {v[field]}
                              </Button>
                            </TableCell>
                          ))}
                          <TableCell className="p-2 text-center tabular-nums">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 min-w-8 px-1 font-semibold"
                              onClick={() => abrirCarteira(v)}
                              disabled={v.qtd_clientes === 0}
                              title="Ver todos os clientes da carteira"
                            >
                              {v.qtd_clientes}
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
                  <StatusBadge status="D" />
                  <span className="tabular-nums">{totais.cadastrado}</span>
                  <StatusBadge status="P" />
                  <span className="tabular-nums">{totais.prospeccao}</span>
                  <StatusBadge status="N" />
                  <span className="tabular-nums">{totais.negociacao}</span>
                  <StatusBadge status="C" />
                  <span className="tabular-nums">{totais.conquista}</span>
                  <StatusBadge status="R" />
                  <span className="tabular-nums">{totais.reconquista}</span>
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
        <DialogContent className="max-w-6xl h-[90vh] max-h-[90vh] min-h-0 overflow-hidden !flex flex-col">
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
              {statusCarteiraFiltro
                ? `Clientes com status ${STATUS_MAP[statusCarteiraFiltro].label}`
                : 'Defina o status da negociação de cada cliente da carteira'}
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
              {statusCarteiraFiltro && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9"
                  onClick={() => {
                    setStatusCarteiraFiltro(null);
                    setPaginaCarteira(1);
                  }}
                >
                  Ver todos os status
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
                  {statusCarteiraFiltro
                    ? `${totaisCarteira[statusCarteiraFiltro]} cliente(s) neste status`
                    : `${totaisCarteira.total} cliente(s) na carteira`}
                </span>
                {!statusCarteiraFiltro && (
                  <>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <StatusBadge status="D" />
                    <span className="tabular-nums">{totaisCarteira.D}</span>
                    <StatusBadge status="P" />
                    <span className="tabular-nums">{totaisCarteira.P}</span>
                    <StatusBadge status="N" />
                    <span className="tabular-nums">{totaisCarteira.N}</span>
                    <StatusBadge status="C" />
                    <span className="tabular-nums">{totaisCarteira.C}</span>
                    <StatusBadge status="R" />
                    <span className="tabular-nums">{totaisCarteira.R}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
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
                        className="w-[150px]"
                      />
                      <SortableTableHeader
                        field="uf"
                        label="UF"
                        currentSortField={clienteSort.sortField}
                        currentSortDirection={clienteSort.sortDirection}
                        onSort={clienteSort.handleSort}
                        className="w-[60px]"
                      />
                      <TableHead className="w-[110px] px-4 py-3 text-xs uppercase tracking-wider">
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
                        className="w-[110px]"
                      />
                      <TableHead className="w-[150px] px-4 py-3 text-xs uppercase tracking-wider text-right">
                        Comissão
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientesPagina.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-500 py-10">
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
                          <TableCell className="px-4">
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className={`text-xs tabular-nums truncate ${
                                  resumoComissao(c) ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'
                                }`}
                                title={resumoComissao(c) || 'Nenhum período de comissão definido'}
                              >
                                {resumoComissao(c) || 'Não definida'}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 shrink-0"
                                onClick={() => abrirComissao(c)}
                                title="Definir comissão do vendedor"
                              >
                                <Percent className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
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
        <DialogContent className="max-w-3xl h-[90vh] max-h-[90vh] min-h-0 overflow-hidden !flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <UserSquare2 className="w-4 h-4" />
              Cliente — {buscaGlobal}
            </DialogTitle>
            <DialogDescription>Vendedor(es) responsáveis pela carteira deste cliente</DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 py-2 space-y-3">
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

      {/* ================= DIALOG: COMISSÃO ================= */}
      <Dialog open={comissaoOpen} onOpenChange={setComissaoOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] min-h-0 overflow-hidden !flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Comissão do vendedor
            </DialogTitle>
            <DialogDescription>
              {comissaoCliente ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {comissaoCliente.nome}
                  </span>
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono text-[11px]">
                    {comissaoCliente.cnpj_fmt}
                  </Badge>
                </span>
              ) : (
                'Períodos e percentuais de comissão'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 py-2 space-y-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Informe ao menos um período. Um período é considerado quando o percentual, a data
              inicial e a data final estiverem preenchidos.
            </p>

            {PERIODOS_COMISSAO.map((periodo) => (
              <div key={periodo.perc} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{periodo.rotulo}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() => limparPeriodoComissao(periodo)}
                    disabled={salvandoComissao}
                  >
                    <X className="w-3.5 h-3.5" />
                    Limpar
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Percentual (%)</Label>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0,00"
                      className="h-9"
                      value={comissaoForm[periodo.perc]}
                      onChange={(e) =>
                        setComissaoForm((prev) => ({ ...prev, [periodo.perc]: e.target.value }))
                      }
                      disabled={salvandoComissao}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data inicial</Label>
                    <Input
                      type="date"
                      className="h-9"
                      value={comissaoForm[periodo.ini]}
                      onChange={(e) =>
                        setComissaoForm((prev) => ({ ...prev, [periodo.ini]: e.target.value }))
                      }
                      disabled={salvandoComissao}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data final</Label>
                    <Input
                      type="date"
                      className="h-9"
                      value={comissaoForm[periodo.fin]}
                      onChange={(e) =>
                        setComissaoForm((prev) => ({ ...prev, [periodo.fin]: e.target.value }))
                      }
                      disabled={salvandoComissao}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t pt-3 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComissaoOpen(false)}
              disabled={salvandoComissao}
            >
              Cancelar
            </Button>
            <Button size="sm" className="gap-2" onClick={salvarComissao} disabled={salvandoComissao}>
              {salvandoComissao && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar
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
    case 'R':
      return 'qtd_reconquista';
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
