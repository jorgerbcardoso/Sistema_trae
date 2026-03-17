import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Filter,
  Search,
  Calendar,
  Warehouse,
  User,
  FileText,
  Package,
  CheckCircle,
  AlertCircle,
  X,
  Eye,
  ArrowUpCircle,
  ShoppingBag,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_REQUISICOES } from '../../utils/estoqueModData';

interface Requisicao {
  seq_requisicao: number;
  seq_estoque: number;
  estoque_descricao: string;
  estoque_unidade: string;
  nro_estoque: number;
  seq_centro_custo: number;
  cc_descricao: string;
  login: string;
  solicitante: string;
  observacao: string;
  data_atendimento: string;
  hora_atendimento: string;
  login_atendimento: string;
  placa: string;
  status: string;
  qtd_itens: number;
}

type SortField = keyof Requisicao;
type SortDirection = 'asc' | 'desc';

export default function SaidaEstoque() {
  usePageTitle('Saídas do Estoque');

  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('data_atendimento');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filtros temporários (antes de aplicar)
  const [filtroDataInicioTemp, setFiltroDataInicioTemp] = useState('');
  const [filtroDataFimTemp, setFiltroDataFimTemp] = useState('');
  const [filtroBuscaTemp, setFiltroBuscaTemp] = useState('');

  // Filtros aplicados (após clicar em "Filtrar")
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroBusca, setFiltroBusca] = useState('');

  // ✅ DEFINIR PERÍODO PADRÃO: ÚLTIMOS 30 DIAS
  useEffect(() => {
    const hoje = new Date();
    const dataFim = hoje.toISOString().split('T')[0];
    
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);
    const dataInicioFormatada = dataInicio.toISOString().split('T')[0];
    
    setFiltroDataInicioTemp(dataInicioFormatada);
    setFiltroDataFimTemp(dataFim);
    setFiltroDataInicio(dataInicioFormatada);
    setFiltroDataFim(dataFim);
  }, []);

  // ✅ EXIBIR TOAST DE SUCESSO APÓS CRIAÇÃO
  useEffect(() => {
    if (location.state?.message) {
      const { message, type } = location.state as { message: string; type: 'success' | 'error' };
      
      if (type === 'success') {
        toast.success(message);
      } else {
        toast.error(message);
      }
      
      // Limpar o state para não exibir novamente
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location, navigate]);

  useEffect(() => {
    carregarRequisicoes();
  }, []);

  const carregarRequisicoes = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const requisicoesFormatadas = MOCK_REQUISICOES.map(req => ({
          seq_requisicao: req.seq_requisicao,
          seq_estoque: 1,
          estoque_descricao: req.estoque_descricao || 'ESTOQUE PRINCIPAL',
          estoque_unidade: 'ACV',
          nro_estoque: 1,
          seq_centro_custo: 1,
          cc_descricao: 'CENTRO CUSTO',
          login: req.login,
          solicitante: req.solicitante,
          observacao: req.observacao,
          data_atendimento: req.data_atendimento,
          hora_atendimento: req.hora_atendimento,
          login_atendimento: req.login_atendimento,
          placa: '',
          status: 'ATENDIDA',
          qtd_itens: req.qtd_itens
        }));
        
        setRequisicoes(requisicoesFormatadas);
      } else {
        // BACKEND
        const url = `${ENVIRONMENT.apiBaseUrl}/estoque/requisicoes.php`;

        const data = await apiFetch(url, {
          method: 'GET'
        });

        if (data.success) {
          setRequisicoes(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar requisições:', error);
      toast.error('Erro ao carregar saídas de estoque');
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string): string => {
    if (!data) return '-';
    const partes = data.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return data;
  };

  const formatarHora = (hora: string): string => {
    if (!hora) return '-';
    return hora.substring(0, 5); // HH:MM
  };

  const formatarCodigo = (unidade: string, numero: number): string => {
    const numeroFormatado = String(numero).padStart(6, '0');
    return `${unidade}${numeroFormatado}`;
  };

  // ✅ ORDENAÇÃO
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ field, children, className = '' }: { field: SortField; children: React.ReactNode; className?: string }) => {
    const isSorted = sortField === field;
    const Icon = isSorted ? (sortDirection === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

    return (
      <TableHead
        className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`}
        onClick={() => toggleSort(field)}
      >
        <div className="flex items-center gap-2">
          {children}
          <Icon className="size-4" />
        </div>
      </TableHead>
    );
  };

  // ✅ APLICAR FILTROS
  const aplicarFiltros = () => {
    setFiltroDataInicio(filtroDataInicioTemp);
    setFiltroDataFim(filtroDataFimTemp);
    setFiltroBusca(filtroBuscaTemp);
  };

  const limparFiltros = () => {
    setFiltroDataInicioTemp('');
    setFiltroDataFimTemp('');
    setFiltroBuscaTemp('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroBusca('');
  };

  // Aplicar filtros
  let requisicoesFiltraadas = [...requisicoes];

  // Filtro de busca
  if (filtroBusca) {
    const busca = filtroBusca.toLowerCase();
    requisicoesFiltraadas = requisicoesFiltraadas.filter(r =>
      r.estoque_descricao?.toLowerCase().includes(busca) ||
      r.solicitante?.toLowerCase().includes(busca) ||
      r.observacao?.toLowerCase().includes(busca) ||
      String(r.seq_requisicao).includes(busca)
    );
  }

  // Filtro de data início
  if (filtroDataInicio) {
    requisicoesFiltraadas = requisicoesFiltraadas.filter(r => r.data_atendimento >= filtroDataInicio);
  }

  // Filtro de data fim
  if (filtroDataFim) {
    requisicoesFiltraadas = requisicoesFiltraadas.filter(r => r.data_atendimento <= filtroDataFim);
  }

  // Ordenar
  requisicoesFiltraadas.sort((a, b) => {
    let aVal: any = a[sortField];
    let bVal: any = b[sortField];

    // Tratar valores nulos
    if (aVal === null || aVal === undefined) return sortDirection === 'asc' ? 1 : -1;
    if (bVal === null || bVal === undefined) return sortDirection === 'asc' ? -1 : 1;

    // Comparação numérica para valores numéricos
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    // Converter para string para comparação
    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Estatísticas
  const totalSaidas = requisicoesFiltraadas.length;
  const totalItens = requisicoesFiltraadas.reduce((sum, r) => sum + Number(r.qtd_itens), 0);
  const estoquesUnicos = new Set(requisicoesFiltraadas.map(r => r.seq_requisicao)).size;
  const solicitantesUnicos = new Set(requisicoesFiltraadas.map(r => r.solicitante.toUpperCase())).size;

  if (loading) {
    return (
      <AdminLayout title="SAÍDAS DO ESTOQUE" description="Gerenciamento de saídas do estoque">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="SAÍDAS DO ESTOQUE"
      description="Gerencie todas as saídas do estoque"
    >
      <div className="space-y-6">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <ArrowUpCircle className="size-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">Total de Saídas</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{totalSaidas}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Requisições registradas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="size-8 text-orange-600 dark:text-orange-400" />
              </div>
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300 mb-1">Total de Itens</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{totalItens}</p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Itens retirados</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Warehouse className="size-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Requisições</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{estoquesUnicos}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Saídas únicas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <User className="size-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Solicitantes</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{solicitantesUnicos}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Pessoas diferentes</p>
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
                    value={filtroBuscaTemp}
                    onChange={(e) => setFiltroBuscaTemp(e.target.value)}
                    placeholder="Buscar por estoque, solicitante, observação ou nº requisição..."
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => navigate('/estoque/saida/nova')} className="gap-2">
                  <Plus className="size-4" />
                  Nova Saída
                </Button>
              </div>

              {/* Linha 2 - Filtros de período */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Input
                    type="date"
                    value={filtroDataInicioTemp}
                    onChange={(e) => setFiltroDataInicioTemp(e.target.value)}
                    placeholder="Data início"
                  />
                </div>

                <div>
                  <Input
                    type="date"
                    value={filtroDataFimTemp}
                    onChange={(e) => setFiltroDataFimTemp(e.target.value)}
                    placeholder="Data fim"
                  />
                </div>
              </div>

              {/* Linha 3 - Botões de ação */}
              <div className="flex items-center justify-end gap-3">
                <Button onClick={aplicarFiltros} className="gap-2">
                  <Search className="size-4" />
                  Filtrar
                </Button>
                {(filtroDataInicio || filtroDataFim || filtroBusca) && (
                  <Button variant="outline" size="sm" onClick={limparFiltros} className="gap-2">
                    <Filter className="size-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Saídas */}
        <Card>
          <CardContent className="pt-6">
            {requisicoesFiltraadas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ArrowUpCircle className="size-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma saída encontrada</p>
                <p className="text-sm mt-1">
                  {requisicoes.length === 0
                    ? 'Clique em "Nova Saída" para registrar uma saída'
                    : 'Tente ajustar os filtros de busca'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="seq_requisicao">Nº Requisição</SortableHeader>
                      <SortableHeader field="data_atendimento">Data/Hora</SortableHeader>
                      <SortableHeader field="estoque_descricao">Estoque</SortableHeader>
                      <SortableHeader field="solicitante">Solicitante</SortableHeader>
                      <TableHead>Observação</TableHead>
                      <TableHead className="text-center">Qtd. Itens</TableHead>
                      <SortableHeader field="login_atendimento">Atendente</SortableHeader>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requisicoesFiltraadas.map((req) => (
                      <TableRow key={req.seq_requisicao}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ShoppingBag className="size-4 text-blue-600" />
                            <span className="font-medium font-mono">
                              {String(req.seq_requisicao).padStart(6, '0')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{formatarData(req.data_atendimento)}</div>
                              <div className="text-xs text-gray-500">{formatarHora(req.hora_atendimento)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Warehouse className="size-4 text-purple-600" />
                            <div>
                              <div className="font-medium">{req.estoque_descricao}</div>
                              <div className="text-xs text-gray-500 font-mono">
                                {formatarCodigo(req.estoque_unidade, req.nro_estoque)}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="size-4 text-blue-600" />
                            <span className="font-medium">{req.solicitante.toUpperCase()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {req.observacao ? (
                            <div className="flex items-center gap-2 max-w-xs">
                              <FileText className="size-4 text-gray-400 flex-shrink-0" />
                              <span className="text-sm text-gray-600 dark:text-gray-300 truncate">
                                {req.observacao}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="font-mono">{req.qtd_itens}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{req.login_atendimento.toLowerCase()}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/estoque/requisicoes/${req.seq_requisicao}`)}
                            className="gap-2"
                          >
                            <Eye className="size-4" />
                            Ver
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