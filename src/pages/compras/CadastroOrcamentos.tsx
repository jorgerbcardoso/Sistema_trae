import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Loader2,
  Plus,
  Eye,
  Edit,
  FileText,
  MapPin,
  X,
  Package,
  CheckCircle,
  Mail,
  Search,
  Filter,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_ORCAMENTOS } from '../../utils/estoqueModData';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';

// Helper: Obter data de hoje no formato YYYY-MM-DD
function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Obter data de 30 dias atrás no formato YYYY-MM-DD
function get30DaysAgo() {
  const today = new Date();
  today.setDate(today.getDate() - 30);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface Orcamento {
  seq_orcamento: number;
  unidade: string;
  nro_orcamento: string;
  status: string;
  observacao: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_aprovacao?: string;
  hora_aprovacao?: string;
  login_aprovacao?: string;
  qtd_ordens: number;
}

export default function CadastroOrcamentos() {
  usePageTitle('Orçamentos');

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ✅ FILTROS - Temporários (antes de aplicar)
  const [filtroUnidadeTemp, setFiltroUnidadeTemp] = useState('');
  const [filtroDataInicioTemp, setFiltroDataInicioTemp] = useState('');
  const [filtroDataFimTemp, setFiltroDataFimTemp] = useState('');
  const [filtroStatusTemp, setFiltroStatusTemp] = useState<'TODOS' | 'PENDENTE' | 'APROVADO'>('TODOS');

  // ✅ FILTROS - Aplicados (após clicar em "Filtrar")
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'TODOS' | 'PENDENTE' | 'APROVADO'>('TODOS');

  // ✅ Estados para dialog de pedidos gerados
  const [dialogPedidos, setDialogPedidos] = useState(false);
  const [pedidosGerados, setPedidosGerados] = useState<any[]>([]);
  const [enviandoEmails, setEnviandoEmails] = useState(false);

  // ✅ Hook de ordenação
  type SortField = 'nro_orcamento' | 'unidade' | 'data_inclusao' | 'login_inclusao' | 'qtd_ordens' | 'status';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  // ✅ Período padrão: últimos 30 dias
  useEffect(() => {
    const hoje = getToday();
    const dias30Atras = get30DaysAgo();
    
    setFiltroDataInicioTemp(dias30Atras);
    setFiltroDataFimTemp(hoje);
    setFiltroDataInicio(dias30Atras);
    setFiltroDataFim(hoje);
  }, []);

  // ✅ Forçar unidade do usuário (se não-MTZ)
  useEffect(() => {
    const unidadeAtual = user?.unidade_atual || user?.unidade || 'MTZ';
    const unidadeAtualUpper = unidadeAtual.toUpperCase();
    const isMtzOrAll = unidadeAtualUpper === 'MTZ' || unidadeAtualUpper === 'ALL';
    
    if (!isMtzOrAll) {
      setFiltroUnidadeTemp(unidadeAtual);
      setFiltroUnidade(unidadeAtual);
    }
  }, [user]);

  useEffect(() => {
    carregarOrcamentos();
  }, []);

  // ✅ useEffect para processar mensagens/dialogs vindos de outras telas
  useEffect(() => {
    const state = location.state as any;
    
    if (state?.toastMessage) {
      // Exibir toast de sucesso (usado no estorno)
      toast.success(state.toastMessage);
      
      // Limpar state após um pequeno delay para garantir que o toast aparece
      setTimeout(() => {
        navigate(location.pathname, { replace: true, state: {} });
      }, 100);
    } else if (state?.pedidosGerados && state.pedidosGerados.length > 0) {
      // Exibir dialog com pedidos gerados (usado na aprovação)
      console.log('📦 Pedidos gerados recebidos:', state.pedidosGerados);
      setPedidosGerados(state.pedidosGerados);
      setDialogPedidos(true);
      
      // Limpar state após um pequeno delay para garantir que o dialog abre
      setTimeout(() => {
        navigate(location.pathname, { replace: true, state: {} });
      }, 100);
    }
  }, [location.state, navigate]);

  const carregarOrcamentos = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));
        setOrcamentos(MOCK_ORCAMENTOS);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php`,
          { method: 'GET' }
        );

        if (data.success) {
          setOrcamentos(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar orçamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const novoOrcamento = () => {
    navigate('/compras/orcamentos/novo');
  };

  const editarOrcamento = (orcamento: Orcamento) => {
    navigate(`/compras/orcamentos/editar/${orcamento.seq_orcamento}`);
  };

  const visualizarOrcamento = (orcamento: Orcamento) => {
    navigate(`/compras/orcamentos/editar/${orcamento.seq_orcamento}`);
  };

  const abrirMapa = (orcamento: Orcamento) => {
    navigate(`/compras/orcamentos/mapa/${orcamento.seq_orcamento}`);
  };

  const cancelarOrcamento = async (orcamento: Orcamento) => {
    if (orcamento.status !== 'PENDENTE') {
      toast.error('Apenas orçamentos pendentes podem ser cancelados');
      return;
    }

    if (!window.confirm(`Tem certeza que deseja cancelar o orçamento ${orcamento.nro_orcamento}?`)) {
      return;
    }

    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));
        setOrcamentos(prev => prev.map(o =>
          o.seq_orcamento === orcamento.seq_orcamento
            ? { ...o, status: 'CANCELADO' }
            : o
        ));
        toast.success('Orçamento cancelado com sucesso!');
      } else {
        // BACKEND
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php`, {
          method: 'DELETE',
          body: JSON.stringify({
            seq_orcamento: orcamento.seq_orcamento
          })
        });

        await carregarOrcamentos();
      }
    } catch (error) {
      console.error('Erro ao cancelar orçamento:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDENTE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      APROVADO: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      CANCELADO: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-700';
  };

  const formatarNumeroOrcamento = (orcamento: Orcamento) => {
    // Formato: XXX000000 (unidade + número com 6 dígitos)
    const numero = String(orcamento.nro_orcamento).padStart(6, '0');
    return `${orcamento.unidade}${numero}`;
  };

  // ✅ FUNÇÃO: Enviar pedidos em lote para fornecedores
  const enviarPedidosEmLote = async () => {
    // Confirmação
    if (!window.confirm(
      `Deseja enviar todos os ${pedidosGerados.length} pedidos por email aos fornecedores?\\n\\n` +
      `Os pedidos serão enviados automaticamente para os emails cadastrados.`
    )) {
      return;
    }

    setEnviandoEmails(true);
    
    let enviados = 0;
    let comErro = 0;

    try {
      for (const pedido of pedidosGerados) {
        try {
          // Se não tiver email no fornecedor, pular
          if (!pedido.fornecedor_email) {
            console.log(`⚠️ Pedido ${pedido.nro_pedido_formatado}: Fornecedor sem email cadastrado`);
            comErro++;
            continue;
          }

          console.log(`📧 Enviando pedido ${pedido.nro_pedido_formatado} para ${pedido.fornecedor_email}...`);

          // Chamar API de envio de email (mesma do PedidoDetalhes)
          await apiFetch(
            `${ENVIRONMENT.apiBaseUrl}/compras/enviar_pedido_email.php`,
            {
              method: 'POST',
              body: JSON.stringify({
                seq_pedido: pedido.seq_pedido,
                email_fornecedor: pedido.fornecedor_email,
              }),
            }
          );

          enviados++;
          console.log(`✅ Pedido ${pedido.nro_pedido_formatado} enviado com sucesso!`);
        } catch (error) {
          console.error(`❌ Erro ao enviar pedido ${pedido.nro_pedido_formatado}:`, error);
          comErro++;
        }
      }

      // Exibir resultado final
      if (enviados > 0) {
        toast.success(`${enviados} email(s) enviado(s) dos ${pedidosGerados.length} pedidos gerados`);
      }
      
      if (comErro > 0) {
        toast.warning(`${comErro} pedido(s) não puderam ser enviados (sem email cadastrado ou erro no envio)`);
      }

      // Fechar dialog
      setDialogPedidos(false);
    } finally {
      setEnviandoEmails(false);
    }
  };

  // ✅ APLICAR FILTROS
  const aplicarFiltros = () => {
    setFiltroUnidade(filtroUnidadeTemp);
    setFiltroDataInicio(filtroDataInicioTemp);
    setFiltroDataFim(filtroDataFimTemp);
    setFiltroStatus(filtroStatusTemp);
  };

  const limparFiltros = () => {
    const unidadeAtual = user?.unidade_atual || user?.unidade || 'MTZ';
    const unidadeAtualUpper = unidadeAtual.toUpperCase();
    const isNonMTZ = unidadeAtualUpper !== 'MTZ' && unidadeAtualUpper !== 'ALL';
    
    setFiltroUnidadeTemp(isNonMTZ ? unidadeAtual : '');
    setFiltroDataInicioTemp('');
    setFiltroDataFimTemp('');
    setFiltroStatusTemp('TODOS');
    
    setFiltroUnidade(isNonMTZ ? unidadeAtual : '');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroStatus('TODOS');
  };

  // ✅ ORÇAMENTOS FILTRADOS
  const orcamentosFiltrados = useMemo(() => {
    let filtrados = [...orcamentos];

    // Filtro de unidade
    if (filtroUnidade) {
      filtrados = filtrados.filter(o => o.unidade === filtroUnidade);
    }

    // Filtro de período
    if (filtroDataInicio) {
      filtrados = filtrados.filter(o => o.data_inclusao >= filtroDataInicio);
    }
    if (filtroDataFim) {
      filtrados = filtrados.filter(o => o.data_inclusao <= filtroDataFim);
    }

    // Filtro de status
    if (filtroStatus !== 'TODOS') {
      filtrados = filtrados.filter(o => o.status === filtroStatus);
    }

    return filtrados;
  }, [orcamentos, filtroUnidade, filtroDataInicio, filtroDataFim, filtroStatus]);

  return (
    <AdminLayout
      title="ORÇAMENTOS"
      description="Gestão de orçamentos e cotações com fornecedores"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ✅ CARD DE FILTROS */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Linha 1 - Filtros principais */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <FilterSelectUnidadeSingle
                  value={filtroUnidadeTemp}
                  onChange={setFiltroUnidadeTemp}
                  respectUserUnit={true}
                  compact={true}
                  label="Unidade"
                />
                
                <div className="grid gap-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={filtroDataInicioTemp}
                    onChange={(e) => setFiltroDataInicioTemp(e.target.value)}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={filtroDataFimTemp}
                    onChange={(e) => setFiltroDataFimTemp(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={filtroStatusTemp} onValueChange={(value: any) => setFiltroStatusTemp(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos os Status</SelectItem>
                      <SelectItem value="PENDENTE">Pendente</SelectItem>
                      <SelectItem value="APROVADO">Aprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Linha 2 - Botões de ação */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  {orcamentosFiltrados.length} orçamento(s) encontrado(s)
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={aplicarFiltros} className="gap-2">
                    <Search className="size-4" />
                    Filtrar
                  </Button>
                  {(filtroUnidade || filtroDataInicio || filtroDataFim || filtroStatus !== 'TODOS') && (
                    <Button variant="outline" onClick={limparFiltros} className="gap-2">
                      <Filter className="size-4" />
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Listagem */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileText className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>
                  Orçamentos ({orcamentosFiltrados.length})
                </CardTitle>
              </div>
              <Button onClick={novoOrcamento} className="gap-2">
                <Plus className="size-4" />
                Novo Orçamento
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : orcamentosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum orçamento encontrado</p>
                <p className="text-sm mt-1">
                  {filtroStatus === 'TODOS' && !filtroUnidade && !filtroDataInicio && !filtroDataFim
                    ? 'Clique em "Novo Orçamento" para começar'
                    : 'Ajuste os filtros para visualizar outros orçamentos'
                  }
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="nro_orcamento"
                        label="Número"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="unidade"
                        label="Unidade"
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
                        field="login_inclusao"
                        label="Login"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="qtd_ordens"
                        label="Qtd. Ordens"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHeader
                        field="status"
                        label="Status"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortData(orcamentosFiltrados).map((orcamento) => (
                      <TableRow key={orcamento.seq_orcamento}>
                        <TableCell className="font-medium">{formatarNumeroOrcamento(orcamento)}</TableCell>
                        <TableCell>{orcamento.unidade}</TableCell>
                        <TableCell>
                          {new Date(orcamento.data_inclusao).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>{orcamento.login_inclusao}</TableCell>
                        <TableCell className="text-center">{orcamento.qtd_ordens}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(orcamento.status)}`}
                          >
                            {orcamento.status}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {orcamento.observacao || '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {/* Ver/Editar (sempre disponível) */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => visualizarOrcamento(orcamento)}
                              title={orcamento.status === 'PENDENTE' ? 'Editar' : 'Visualizar'}
                            >
                              {orcamento.status === 'PENDENTE' ? (
                                <Edit className="size-4 text-blue-600" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </Button>

                            {/* Mapa (qualquer status) */}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirMapa(orcamento)}
                              title="Ver Mapa de Cotação"
                            >
                              <MapPin className="size-4 text-green-600" />
                            </Button>

                            {/* Cancelar (apenas pendentes) */}
                            {orcamento.status === 'PENDENTE' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelarOrcamento(orcamento)}
                                title="Cancelar"
                              >
                                <X className="size-4 text-red-600" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card Informativo - Processo de Orçamento */}
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="text-blue-900 dark:text-blue-100 text-base">
              📋 Como funciona o processo de orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <p><strong>1. Criar Orçamento:</strong> Selecione as ordens de compra aprovadas (com ORÇAR=S) e os fornecedores participantes</p>
            <p><strong>2. Coletar Preços:</strong> Informe os preços de cada fornecedor ou solicite por e-mail</p>
            <p><strong>3. Mapa de Cotação:</strong> Compare preços e selecione os melhores fornecedores para cada item</p>
            <p><strong>4. Finalizar:</strong> Ao aprovar o orçamento, pedidos serão gerados automaticamente para cada fornecedor</p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Dialog de Pedidos Gerados (exibido após aprovação) */}
      <Dialog open={dialogPedidos} onOpenChange={setDialogPedidos}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-6 text-green-600" />
              Orçamento Aprovado!
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>{pedidosGerados.length} pedido(s) gerado(s) com sucesso:</strong>
            </p>
            
            <div className="space-y-2">
              {pedidosGerados.map((pedido, index) => {
                const nroPedido = pedido.nro_pedido_formatado || 'N/A';
                const valor = `R$ ${(pedido.vlr_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                const fornecedor = pedido.fornecedor_nome || 'N/A';
                
                return (
                  <div key={pedido.seq_pedido} className="text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-gray-100">{nroPedido}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{fornecedor}</div>
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{valor}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
            <Button
              onClick={enviarPedidosEmLote}
              disabled={enviandoEmails}
              variant="outline"
              className="gap-2"
            >
              {enviandoEmails ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Mail className="size-4" />
              )}
              Enviar Pedidos por Email
            </Button>
            <Button onClick={() => setDialogPedidos(false)}>
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}