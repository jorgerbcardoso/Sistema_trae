import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Loader2,
  Plus,
  Search,
  FileText,
  DollarSign,
  Calendar,
  Filter,
  CheckCircle,
  Clock,
  Truck,
  XCircle,
  Eye,
  MapPin,
  Package,
  Hourglass
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_PEDIDOS, MOCK_PEDIDO_ITENS } from '../../utils/estoqueModData';
import { MOCK_FORNECEDORES } from '../../mocks/estoqueComprasMocks';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';

interface Pedido {
  seq_pedido: number;
  nro_pedido: string;
  nro_pedido_formatado?: string; // ✅ Campo formatado XXX000000
  seq_orcamento: number;
  seq_fornecedor: number;
  fornecedor_nome?: string;
  status: string;
  vlr_total: number;
  data_inclusao: string;
  observacao?: string;
  tipo_pedido?: string;
  data_fin?: string | null;
  unidade?: string; // ✅ Necessário para formatação
}

type SortField = 'nro_pedido_formatado' | 'tipo_pedido' | 'fornecedor_nome' | 'data_inclusao' | 'status' | 'vlr_total';

export default function Pedidos() {
  usePageTitle('Pedidos');

  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ordensCompraDisp, setOrdensCompraDisp] = useState(0);

  // Filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => {
    // ✅ Padrão: 30 dias atrás
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);
    return dataInicio.toISOString().split('T')[0];
  });
  const [filtroDataFim, setFiltroDataFim] = useState(() => {
    // ✅ Padrão: hoje
    return new Date().toISOString().split('T')[0];
  });
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');

  // ✅ Hook de ordenação
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  useEffect(() => {
    carregarPedidos();
    carregarOrdensCompraDisp();
  }, []);

  const carregarOrdensCompraDisp = async () => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK: Simular 12 ordens disponíveis
        await new Promise(resolve => setTimeout(resolve, 300));
        setOrdensCompraDisp(12);
      } else {
        // BACKEND: Buscar ordens aprovadas com orcar=N e seq_pedido=0
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php?action=ordens_disponiveis`,
          { method: 'GET' }
        );

        if (data.success) {
          setOrdensCompraDisp(data.data?.total || 0);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar ordens de compra disponíveis:', error);
    }
  };

  const carregarPedidos = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const pedidosComFornecedor = MOCK_PEDIDOS.map(pedido => {
          const fornecedor = MOCK_FORNECEDORES.find(f => f.seq_fornecedor === pedido.seq_fornecedor);
          return {
            ...pedido,
            fornecedor_nome: fornecedor?.nome || 'N/A',
            tipo_pedido: pedido.seq_orcamento === 0 ? 'MANUAL' : 'ORÇAMENTO',
            // ✅ Formatar número: XXX000000 (6 dígitos)
            nro_pedido_formatado: pedido.unidade + String(pedido.nro_pedido).padStart(6, '0')
          };
        });

        setPedidos(pedidosComFornecedor);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php`,
          { method: 'GET' }
        );

        if (data.success) {
          // ✅ Processar pedidos: formatar número e determinar tipo
          const pedidosProcessados = (data.data || []).map((pedido: any) => ({
            ...pedido,
            // Formatar número: XXX000000 (unidade + nro_pedido com 6 dígitos)
            nro_pedido_formatado: pedido.unidade + String(pedido.nro_pedido).padStart(6, '0'),
            // Determinar tipo: verificar seq_orcamento
            tipo_pedido: (pedido.seq_orcamento && pedido.seq_orcamento !== 0) ? 'ORÇAMENTO' : 'MANUAL'
          }));
          
          setPedidos(pedidosProcessados);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatarData = (data: string): string => {
    if (!data) return '-';
    const partes = data.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return data;
  };

  const getBadgeStatus = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      'A': { variant: 'outline', icon: Hourglass, label: 'AGUARDANDO APROVAÇÃO' },
      'AGUARDANDO': { variant: 'outline', icon: Hourglass, label: 'AGUARDANDO APROVAÇÃO' },
      'P': { variant: 'default', icon: CheckCircle, label: 'APROVADO' },
      'PENDENTE': { variant: 'default', icon: CheckCircle, label: 'APROVADO' },
      'E': { variant: 'default', icon: Truck, label: 'ENTREGUE' },
      'ENTREGUE': { variant: 'default', icon: Truck, label: 'ENTREGUE' },
      'F': { variant: 'default', icon: CheckCircle, label: 'FINALIZADO' },
      'FINALIZADO': { variant: 'default', icon: CheckCircle, label: 'FINALIZADO' },
      'C': { variant: 'destructive', icon: XCircle, label: 'CANCELADO' },
      'CANCELADO': { variant: 'destructive', icon: XCircle, label: 'CANCELADO' },
    };

    const config = statusConfig[status] || statusConfig['P'];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="size-3" />
        {config.label}
      </Badge>
    );
  };

  // Aplicar filtros
  const pedidosFiltrados = pedidos.filter(pedido => {
    // Filtro de busca (número pedido, fornecedor ou observação)
    if (filtroBusca) {
      const busca = filtroBusca.toLowerCase();
      const match = 
        pedido.nro_pedido.toLowerCase().includes(busca) ||
        pedido.fornecedor_nome?.toLowerCase().includes(busca) ||
        pedido.observacao?.toLowerCase().includes(busca);
      if (!match) return false;
    }

    // Filtro de status
    if (filtroStatus && pedido.status !== filtroStatus) {
      return false;
    }

    // Filtro de data início
    if (filtroDataInicio && pedido.data_inclusao < filtroDataInicio) {
      return false;
    }

    // Filtro de data fim
    if (filtroDataFim && pedido.data_inclusao > filtroDataFim) {
      return false;
    }

    return true;
  });

  // Estatísticas
  const totalPedidos = pedidosFiltrados.length;
  const totalValor = pedidosFiltrados.reduce((sum, p) => sum + p.vlr_total, 0);
  const totalAguardandoAprovacao = pedidosFiltrados.filter(p => p.status === 'A').length;
  const totalPendentes = pedidosFiltrados.filter(p => p.status === 'P').length;
  const totalFinalizados = pedidosFiltrados.filter(p => p.status === 'E').length; // ✅ ENTREGUE (E)

  const limparFiltros = () => {
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroStatus('');
    setFiltroBusca('');
  };

  if (loading) {
    return (
      <AdminLayout title="PEDIDOS" description="Gerenciamento de pedidos de compra">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="PEDIDOS"
      description="Gerencie pedidos de compra (via orçamento ou manuais)"
    >
      <div className="space-y-6">
        {/* Estatísticas - 6 cards em 2 linhas de 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. OCs Disponíveis */}
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="size-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">OCs Disponíveis</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{ordensCompraDisp}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Aprovadas sem orçar</p>
            </CardContent>
          </Card>

          {/* 2. Total de Pedidos */}
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <FileText className="size-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total de Pedidos</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalPedidos}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Todos os pedidos</p>
            </CardContent>
          </Card>

          {/* 3. Valor Total */}
          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="size-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Valor Total</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">R$ {formatarValor(totalValor)}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Soma de todos os pedidos</p>
            </CardContent>
          </Card>

          {/* 4. Aguardando Aprovação */}
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Hourglass className="size-8 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">Aguardando Aprovação</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{totalAguardandoAprovacao}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Pedidos pendentes</p>
            </CardContent>
          </Card>

          {/* 5. Pendentes */}
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="size-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{totalPendentes}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Aguardando entrega</p>
            </CardContent>
          </Card>

          {/* 6. Finalizados */}
          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200 dark:border-cyan-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="size-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-1">Finalizados</p>
              <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{totalFinalizados}</p>
              <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Pedidos concluídos</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros e Ações */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Linha 1 - Busca geral e botão novo */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    value={filtroBusca}
                    onChange={(e) => setFiltroBusca(e.target.value)}
                    placeholder="Buscar por número, fornecedor ou observação..."
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => navigate('/compras/pedidos/novo')} className="gap-2">
                  <Plus className="size-4" />
                  Novo Pedido Manual
                </Button>
              </div>

              {/* Linha 2 - Filtros específicos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Filtro de Status */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Todos os status</option>
                    <option value="A">AGUARDANDO APROVAÇÃO</option>
                    <option value="P">PENDENTE</option>
                    <option value="E">ENTREGUE</option>
                  </select>
                </div>

                {/* Filtro de Data Início */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Data Inclusão - Início
                  </label>
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                  />
                </div>

                {/* Filtro de Data Fim */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Data Inclusão - Fim
                  </label>
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                  />
                </div>
              </div>

              {/* Botão limpar filtros */}
              {(filtroStatus || filtroDataInicio || filtroDataFim || filtroBusca) && (
                <div className="flex justify-end">
                  <Button variant="outline" size="sm" onClick={limparFiltros} className="gap-2">
                    <Filter className="size-4" />
                    Limpar Filtros
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Pedidos */}
        <Card>
          <CardContent className="pt-6">
            {pedidosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="size-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum pedido encontrado</p>
                <p className="text-sm mt-1">
                  {pedidos.length === 0
                    ? 'Comece criando um novo pedido manual'
                    : 'Tente ajustar os filtros de busca'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="nro_pedido_formatado"
                        label="Número"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="tipo_pedido"
                        label="Tipo"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="fornecedor_nome"
                        label="Fornecedor"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="data_inclusao"
                        label="Data Inclusão"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="status"
                        label="Status"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="vlr_total"
                        label="Valor Total"
                        className="text-right"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead className="text-center px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortData(pedidosFiltrados).map((pedido) => (
                      <TableRow key={pedido.seq_pedido}>
                        <TableCell className="font-medium">
                          {pedido.nro_pedido_formatado || pedido.nro_pedido}
                        </TableCell>
                        <TableCell>
                          <Badge variant={pedido.tipo_pedido === 'MANUAL' ? 'secondary' : 'outline'}>
                            {pedido.tipo_pedido === 'MANUAL' ? (
                              <>
                                <FileText className="size-3 mr-1" />
                                MANUAL
                              </>
                            ) : (
                              <>
                                <MapPin className="size-3 mr-1" />
                                ORÇAMENTO
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>{pedido.fornecedor_nome}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-gray-400" />
                            {formatarData(pedido.data_inclusao)}
                          </div>
                        </TableCell>
                        <TableCell>{getBadgeStatus(pedido.status)}</TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          R$ {formatarValor(pedido.vlr_total)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/compras/pedidos/visualizar/${pedido.seq_pedido}`)}
                            className="gap-2"
                          >
                            <Eye className="size-4" />
                            Ver Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}