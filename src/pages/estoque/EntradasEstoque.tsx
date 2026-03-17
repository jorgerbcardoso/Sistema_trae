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
  Eye,
  ArrowDownCircle,
  Calendar,
  ShoppingCart,
  Package,
  Warehouse,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Filter,
  DollarSign,
  FileText,
  Edit
} from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';

interface EntradaEstoque {
  seq_entrada: number; // Agrupamento (MIN(seq_mvto_estoque))
  unidade: string;
  seq_estoque: number;
  estoque_descricao: string;
  tipo_entrada: 'MANUAL' | 'PEDIDO';
  seq_pedido: number | null;
  nro_pedido: string | null;
  seq_fornecedor: number | null;
  fornecedor_nome: string | null;
  ser_nf: string | null;
  nro_nf: string | null;
  chave_nfe: string | null;
  observacao: string | null;
  data_entrada: string;
  hora_entrada: string;
  login_entrada: string;
  qtd_itens: number;
  vlr_total: number;
}

type SortField = keyof EntradaEstoque;
type SortDirection = 'asc' | 'desc';

export default function EntradasEstoque() {
  usePageTitle('Entradas no Estoque');

  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [entradas, setEntradas] = useState<EntradaEstoque[]>([]);

  // Ordenação
  const [sortField, setSortField] = useState<SortField>('data_entrada');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Filtros temporários (antes de aplicar)
  const [filtroTipoTemp, setFiltroTipoTemp] = useState('');
  const [filtroDataInicioTemp, setFiltroDataInicioTemp] = useState('');
  const [filtroDataFimTemp, setFiltroDataFimTemp] = useState('');
  const [filtroBuscaTemp, setFiltroBuscaTemp] = useState('');

  // Filtros aplicados (após clicar em "Filtrar")
  const [filtroTipo, setFiltroTipo] = useState('');
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

  useEffect(() => {
    carregarEntradas();
  }, []);

  const carregarEntradas = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const entradasMock: EntradaEstoque[] = [
          {
            seq_entrada: 1,
            unidade: 'MTZ',
            seq_estoque: 1,
            estoque_descricao: 'ESTOQUE GERAL MATRIZ',
            tipo_entrada: 'PEDIDO',
            seq_pedido: 4,
            nro_pedido: '4',
            seq_fornecedor: 2,
            fornecedor_nome: 'AUTO PEÇAS SILVA LTDA',
            ser_nf: '1',
            nro_nf: '12345',
            chave_nfe: '35260112345678000195550010000123451234567890',
            observacao: 'RECEBIMENTO CONFORME PEDIDO',
            data_entrada: '2026-02-12',
            hora_entrada: '10:30:00',
            login_entrada: 'admin',
            qtd_itens: 5,
            vlr_total: 12300.00
          },
          {
            seq_entrada: 2,
            unidade: 'MTZ',
            seq_estoque: 1,
            estoque_descricao: 'ESTOQUE GERAL MATRIZ',
            tipo_entrada: 'MANUAL',
            seq_pedido: null,
            nro_pedido: null,
            seq_fornecedor: null,
            fornecedor_nome: null,
            ser_nf: null,
            nro_nf: null,
            chave_nfe: null,
            observacao: 'COMPRA EMERGENCIAL - MATERIAL DE ESCRITÓRIO',
            data_entrada: '2026-02-11',
            hora_entrada: '14:15:00',
            login_entrada: 'admin',
            qtd_itens: 3,
            vlr_total: 850.50
          },
          {
            seq_entrada: 3,
            unidade: 'SAO',
            seq_estoque: 3,
            estoque_descricao: 'ESTOQUE GERAL SÃO PAULO',
            tipo_entrada: 'PEDIDO',
            seq_pedido: 1,
            nro_pedido: '1',
            seq_fornecedor: 5,
            fornecedor_nome: 'PAPELARIA PRESENTE LTDA',
            ser_nf: '2',
            nro_nf: '98765',
            chave_nfe: '35260198765432000187550020000987651987654321',
            observacao: null,
            data_entrada: '2026-02-10',
            hora_entrada: '09:00:00',
            login_entrada: 'joao',
            qtd_itens: 4,
            vlr_total: 3500.00
          },
        ];

        setEntradas(entradasMock);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/entrada_estoque.php?action=listar`,
          { method: 'GET' }
        );

        if (data.success) {
          setEntradas(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar entradas:', error);
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

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const obterBadgeTipo = (tipo: 'MANUAL' | 'PEDIDO') => {
    if (tipo === 'PEDIDO') {
      return (
        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
          <ShoppingCart className="size-3" />
          PEDIDO
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="gap-1">
        <Package className="size-3" />
        MANUAL
      </Badge>
    );
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
    setFiltroTipo(filtroTipoTemp);
    setFiltroDataInicio(filtroDataInicioTemp);
    setFiltroDataFim(filtroDataFimTemp);
    setFiltroBusca(filtroBuscaTemp);
  };

  const limparFiltros = () => {
    setFiltroTipoTemp('');
    setFiltroDataInicioTemp('');
    setFiltroDataFimTemp('');
    setFiltroBuscaTemp('');
    setFiltroTipo('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroBusca('');
  };

  // Aplicar filtros
  let entradasFiltradas = [...entradas];

  // Filtro de busca
  if (filtroBusca) {
    const busca = filtroBusca.toLowerCase();
    entradasFiltradas = entradasFiltradas.filter(e =>
      e.estoque_descricao.toLowerCase().includes(busca) ||
      e.nro_pedido?.toLowerCase().includes(busca) ||
      e.fornecedor_nome?.toLowerCase().includes(busca) ||
      e.nro_nf?.toLowerCase().includes(busca) ||
      e.observacao?.toLowerCase().includes(busca)
    );
  }

  // Filtro por tipo
  if (filtroTipo) {
    entradasFiltradas = entradasFiltradas.filter(e => e.tipo_entrada === filtroTipo);
  }

  // Filtro de data início
  if (filtroDataInicio) {
    entradasFiltradas = entradasFiltradas.filter(e => e.data_entrada >= filtroDataInicio);
  }

  // Filtro de data fim
  if (filtroDataFim) {
    entradasFiltradas = entradasFiltradas.filter(e => e.data_entrada <= filtroDataFim);
  }

  // Ordenar
  entradasFiltradas.sort((a, b) => {
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
  const totalEntradas = entradasFiltradas.length;
  const totalItens = entradasFiltradas.reduce((sum, e) => sum + e.qtd_itens, 0);
  const valorTotal = entradasFiltradas.reduce((sum, e) => sum + e.vlr_total, 0);
  const totalManuais = entradasFiltradas.filter(e => e.tipo_entrada === 'MANUAL').length;
  const totalPedidos = entradasFiltradas.filter(e => e.tipo_entrada === 'PEDIDO').length;

  if (loading) {
    return (
      <AdminLayout title="ENTRADAS NO ESTOQUE" description="Gerenciamento de entradas no estoque">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="ENTRADAS NO ESTOQUE"
      description="Gerencie todas as entradas no estoque"
    >
      <div className="space-y-6">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <ArrowDownCircle className="size-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total de Entradas</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalEntradas}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Todas as entradas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="size-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Valor Total</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">R$ {formatarValor(valorTotal)}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Soma de todas entradas</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="size-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Total de Itens</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{totalItens}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Itens recebidos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Edit className="size-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Entradas Manuais</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{totalManuais}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Sem pedido vinculado</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900 border-cyan-200 dark:border-cyan-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="size-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-1">Via Pedido</p>
              <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{totalPedidos}</p>
              <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">Vinculadas a pedidos</p>
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
                    placeholder="Buscar por estoque, pedido, fornecedor, NF ou observação..."
                    className="pl-10"
                  />
                </div>
                <Button onClick={() => navigate('/estoque/entrada/nova')} className="gap-2">
                  <Plus className="size-4" />
                  Nova Entrada
                </Button>
              </div>

              {/* Linha 2 - Filtros específicos */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <select
                    value={filtroTipoTemp}
                    onChange={(e) => setFiltroTipoTemp(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">Todos os tipos</option>
                    <option value="MANUAL">MANUAL</option>
                    <option value="PEDIDO">PEDIDO</option>
                  </select>
                </div>

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
                {(filtroTipo || filtroDataInicio || filtroDataFim || filtroBusca) && (
                  <Button variant="outline" size="sm" onClick={limparFiltros} className="gap-2">
                    <Filter className="size-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Entradas */}
        <Card>
          <CardContent className="pt-6">
            {entradasFiltradas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ArrowDownCircle className="size-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhuma entrada encontrada</p>
                <p className="text-sm mt-1">
                  {entradas.length === 0
                    ? 'Clique em "Nova Entrada" para registrar uma entrada'
                    : 'Tente ajustar os filtros de busca'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="data_entrada">Data/Hora</SortableHeader>
                      <SortableHeader field="tipo_entrada">Tipo</SortableHeader>
                      <SortableHeader field="estoque_descricao">Estoque</SortableHeader>
                      <SortableHeader field="nro_pedido">Pedido</SortableHeader>
                      <SortableHeader field="fornecedor_nome">Fornecedor</SortableHeader>
                      <TableHead className="text-center">Qtd. Itens</TableHead>
                      <SortableHeader field="vlr_total" className="text-right">Valor Total</SortableHeader>
                      <SortableHeader field="login_entrada">Usuário</SortableHeader>
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entradasFiltradas.map((entrada) => (
                      <TableRow key={entrada.seq_entrada}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-gray-400" />
                            <div>
                              <div className="font-medium">{formatarData(entrada.data_entrada)}</div>
                              <div className="text-xs text-gray-500">{formatarHora(entrada.hora_entrada)}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{obterBadgeTipo(entrada.tipo_entrada)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Warehouse className="size-4 text-purple-600" />
                            <span className="font-medium">{entrada.estoque_descricao}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {entrada.tipo_entrada === 'PEDIDO' ? (
                            <div>
                              <div className="font-medium">
                                {entrada.unidade}{String(entrada.nro_pedido || '').padStart(7, '0')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {entrada.fornecedor_nome || <span className="text-gray-400">-</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{entrada.qtd_itens}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                          R$ {formatarValor(entrada.vlr_total)}
                        </TableCell>
                        <TableCell className="text-sm">{entrada.login_entrada.toLowerCase()}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/estoque/entrada/${entrada.seq_entrada}`)}
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