import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ShoppingBag, Package, CheckCircle, Clock, TrendingUp, FileText, Plus, Eye, Trash2, Edit, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import api from '../../utils/api';

interface Totalizadores {
  ordensDisponiveis: {
    total: number;
    valor_total: number;
  };
  pedidos: {
    total: number;
    pendentes: number;
    aprovados: number;
    entregues: number;
    valor_total: number;
  };
}

interface Pedido {
  seq_pedido: number;
  seq_orcamento: number;
  seq_ordem_compra: number;
  nro_ordem_compra: string;
  nro_pedido: string;
  seq_fornecedor: number;
  fornecedor_nome: string;
  unidade: string;
  data_inclusao: string;
  status: 'PENDENTE' | 'APROVADO' | 'ENTREGUE' | 'CANCELADO';
  orcar: 'S' | 'N';
  observacao: string;
  vlr_total: number;
  centro_custo_nro: string;
  centro_custo_descricao: string;
  qtd_itens: number;
}

export default function GeracaoPedidos() {
  usePageTitle('Geração de Pedidos');
  
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [totalizadores, setTotalizadores] = useState<Totalizadores>({
    ordensDisponiveis: { total: 0, valor_total: 0 },
    pedidos: { total: 0, pendentes: 0, aprovados: 0, entregues: 0, valor_total: 0 }
  });
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  
  // ✅ Hook de ordenação usando o padrão oficial
  type SortField = 'nro_pedido' | 'fornecedor_nome' | 'unidade' | 'data_inclusao' | 'status' | 'vlr_total';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  useEffect(() => {
    carregarDados();
  }, [filtroStatus]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      // ✅ BUSCAR DADOS REAIS - Ordens Disponíveis
      const responseOrdens = await api.get('/api/compras/pedidos.php', {
        params: { action: 'ordens_disponiveis' }
      });
      console.log('📦 Ordens Disponíveis:', responseOrdens.data);
      
      // ✅ BUSCAR DADOS REAIS - Totalizadores de Pedidos
      const responseTotalizadores = await api.get('/api/compras/pedidos.php', {
        params: { action: 'totalizadores' }
      });
      console.log('📊 Totalizadores:', responseTotalizadores.data);
      
      // ✅ BUSCAR DADOS REAIS - Lista de Pedidos
      const params: any = {};
      if (filtroStatus) {
        params.status = filtroStatus;
      }
      const responsePedidos = await api.get('/api/compras/pedidos.php', { params });
      console.log('📋 Pedidos:', responsePedidos.data);
      
      setTotalizadores({
        ordensDisponiveis: responseOrdens.data.data || { total: 0, valor_total: 0 },
        pedidos: responseTotalizadores.data.data || { total: 0, pendentes: 0, aprovados: 0, entregues: 0, valor_total: 0 }
      });
      
      setPedidos(responsePedidos.data.data || []);
    } catch (error) {
      console.error('❌ Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados dos pedidos');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDENTE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      APROVADO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      ENTREGUE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      CANCELADO: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    };
    return badges[status as keyof typeof badges] || badges.PENDENTE;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (date: string) => {
    if (!date) return '-';
    return new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <AdminLayout
        title="PEDIDOS"
        icon={<ShoppingBag className="w-6 h-6" />}
        breadcrumbs={[
          { label: 'Compras', path: '#' },
          { label: 'Pedidos' }
        ]}
      >
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Carregando pedidos...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="PEDIDOS"
      icon={<ShoppingBag className="w-6 h-6" />}
      breadcrumbs={[
        { label: 'Compras', path: '#' },
        { label: 'Pedidos' }
      ]}
    >
      {/* Cards Totalizadores */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
        {/* 🚨 CARD DE DEBUG - SE VOCÊ NÃO VER ESTE CARD, O ARQUIVO NÃO FOI DEPLOYADO */}
        <Card className="col-span-full border-4 border-red-600 bg-red-50 dark:bg-red-900/20">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 mb-2">
                🚨 ESTE É UM CARD DE DEBUG 🚨
              </div>
              <div className="text-sm text-red-700 dark:text-red-400">
                Se você vê este card, o arquivo foi deployado corretamente!
              </div>
              <div className="text-xs text-red-600 dark:text-red-500 mt-2">
                Deploy: {new Date().toISOString()}
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Card DESTAQUE: Ordens Disponíveis */}
        <Card className="col-span-1 md:col-span-2 border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 to-white dark:from-orange-900/10 dark:to-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Ordens Aprovadas (Orçar = Não)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                {totalizadores.ordensDisponiveis.total}
              </div>
              <div className="text-sm text-orange-600 dark:text-orange-400">
                disponíveis
              </div>
            </div>
            <div className="mt-2 text-sm text-orange-600 dark:text-orange-400">
              {formatCurrency(totalizadores.ordensDisponiveis.valor_total)}
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
              <AlertCircle className="w-3 h-3" />
              <span>Podem ser convertidas em pedidos</span>
            </div>
          </CardContent>
        </Card>

        {/* Total de Pedidos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Total Pedidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {totalizadores.pedidos.total}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {formatCurrency(totalizadores.pedidos.valor_total)}
            </div>
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
              {totalizadores.pedidos.pendentes}
            </div>
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              aguardando
            </div>
          </CardContent>
        </Card>

        {/* Aprovados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Aprovados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {totalizadores.pedidos.aprovados}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              em andamento
            </div>
          </CardContent>
        </Card>

        {/* Entregues */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Entregues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {totalizadores.pedidos.entregues}
            </div>
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              concluídos
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Ações */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex gap-2">
          <Button
            variant={filtroStatus === '' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('')}
          >
            Todos
          </Button>
          <Button
            variant={filtroStatus === 'PENDENTE' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('PENDENTE')}
          >
            Pendentes
          </Button>
          <Button
            variant={filtroStatus === 'APROVADO' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('APROVADO')}
          >
            Aprovados
          </Button>
          <Button
            variant={filtroStatus === 'ENTREGUE' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFiltroStatus('ENTREGUE')}
          >
            Entregues
          </Button>
        </div>
        
        <div className="sm:ml-auto">
          <Button
            onClick={() => toast.info('Funcionalidade em desenvolvimento')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Novo Pedido
          </Button>
        </div>
      </div>

      {/* Tabela de Pedidos */}
      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHeader
                  field="nro_pedido"
                  label="Pedido"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
                <TableHead>OC</TableHead>
                <SortableTableHeader
                  field="fornecedor_nome"
                  label="Fornecedor"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                />
                <SortableTableHeader
                  field="data_inclusao"
                  label="Data Pedido"
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
                <TableHead>Origem</TableHead>
                <SortableTableHeader
                  field="vlr_total"
                  label="Valor"
                  currentSortField={sortField}
                  currentSortDirection={sortDirection}
                  onSort={handleSort}
                  className="text-right"
                />
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortData(pedidos).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum pedido encontrado
                  </TableCell>
                </TableRow>
              ) : (
                sortData(pedidos).map((pedido) => (
                  <TableRow key={pedido.seq_pedido}>
                    <TableCell className="font-medium">
                      {pedido.nro_pedido}
                    </TableCell>
                    <TableCell>
                      {pedido.nro_ordem_compra}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{pedido.fornecedor_nome}</div>
                      <div className="text-xs text-muted-foreground">{pedido.centro_custo_nro}</div>
                    </TableCell>
                    <TableCell>
                      {formatDate(pedido.data_inclusao)}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(pedido.status)}`}>
                        {pedido.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                        pedido.orcar === 'S' 
                          ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {pedido.orcar === 'S' ? 'Orçamento' : 'Manual'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(pedido.vlr_total)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toast.info('Visualização em desenvolvimento')}
                          title="Visualizar"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {pedido.status === 'PENDENTE' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toast.info('Edição em desenvolvimento')}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Deseja realmente excluir este pedido?')) {
                                  toast.info('Exclusão em desenvolvimento');
                                }
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </AdminLayout>
  );
}