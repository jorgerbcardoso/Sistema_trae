import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Loader2, 
  ClipboardCheck, 
  Eye, 
  FileDown, 
  FileText, 
  Search,
  Filter,
  CheckCircle,
  Clock,
  Calendar,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { FilterSelectEstoque } from '../../components/shared/FilterSelectEstoque';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_INVENTARIOS } from '../../utils/estoqueModData';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';

interface Inventario {
  seq_inventario: number;
  nome_inventario: string;
  seq_estoque: number;
  status: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_conclusao: string | null;
  hora_conclusao: string | null;
  login_conclusao: string | null;
  nro_estoque: string;
  estoque_descricao: string;
  unidade: string;
  qtd_posicoes: number;
  qtd_contadas: number;
}

type SortField = 'nome_inventario' | 'estoque_descricao' | 'qtd_posicoes' | 'qtd_contadas' | 'data_inclusao' | 'status';

export default function Inventario() {
  usePageTitle('Inventários de Estoque');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [inventarios, setInventarios] = useState<Inventario[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Formulário de novo inventário
  const [nomeInventario, setNomeInventario] = useState('');
  const [seqEstoque, setSeqEstoque] = useState('');
  const [filtroRua, setFiltroRua] = useState('');
  const [filtroAltura, setFiltroAltura] = useState('');
  const [filtroColuna, setFiltroColuna] = useState('');

  // Filtros da lista
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => {
    // ✅ SUGERIR ÚLTIMOS 60 DIAS
    const hoje = new Date();
    const data60DiasAtras = new Date(hoje);
    data60DiasAtras.setDate(hoje.getDate() - 60);
    return data60DiasAtras.toISOString().split('T')[0];
  });
  const [filtroDataFim, setFiltroDataFim] = useState(() => {
    // ✅ SUGERIR DATA ATUAL
    return new Date().toISOString().split('T')[0];
  });
  const [filtroBusca, setFiltroBusca] = useState('');

  // ✅ Hook de ordenação
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  useEffect(() => {
    carregarInventarios();
  }, []);

  const carregarInventarios = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // 🆕 USAR MOCK NO FIGMA MAKE
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let inventariosFiltrados = [...MOCK_INVENTARIOS];
        
        // Aplicar filtro de status se houver
        if (filtroStatus) {
          inventariosFiltrados = inventariosFiltrados.filter(
            inv => inv.status === filtroStatus
          );
        }
        
        // Formatar dados
        const inventariosFormatados = inventariosFiltrados.map(inv => ({
          ...inv,
          qtd_posicoes: inv.qtd_posicoes || 0,
          qtd_contadas: 0 // Mock sempre começa com 0 contadas
        }));
        
        setInventarios(inventariosFormatados);
      } else {
        // BACKEND REAL
        const params = new URLSearchParams();
        if (filtroStatus) params.append('status', filtroStatus);
        if (filtroDataInicio) params.append('data_inicio', filtroDataInicio);
        if (filtroDataFim) params.append('data_fim', filtroDataFim);

        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/inventarios.php?${params}`);

        if (data.success) {
          // ✅ Converter strings para números
          const inventariosFormatados = (data.data || []).map((inv: any) => ({
            ...inv,
            qtd_posicoes: parseInt(inv.qtd_posicoes) || 0,
            qtd_contadas: parseInt(inv.qtd_contadas) || 0
          }));
          setInventarios(inventariosFormatados);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar inventários:', error);
      toast.error('Erro ao carregar inventários');
    } finally {
      setLoading(false);
    }
  };

  const abrirDialogNovo = () => {
    setNomeInventario('');
    setSeqEstoque('');
    setFiltroRua('');
    setFiltroAltura('');
    setFiltroColuna('');
    setDialogOpen(true);
  };

  const criarInventario = async () => {
    if (!seqEstoque || seqEstoque === 'ALL') {
      toast.error('Selecione um estoque');
      return;
    }

    if (!nomeInventario) {
      toast.error('Informe o nome do inventário');
      return;
    }

    setLoading(true);
    try {
      const filtros: any = {};
      // ✅ NORMALIZAR ALTURA E COLUNA: garantir números inteiros sem zeros à esquerda
      if (filtroRua) filtros.rua = filtroRua.toUpperCase().trim();
      if (filtroAltura) filtros.altura = parseInt(filtroAltura.trim(), 10).toString();
      if (filtroColuna) filtros.coluna = parseInt(filtroColuna.trim(), 10).toString();

      const tipoInventario = Object.keys(filtros).length === 0 ? 'GERAL' : 'PARCIAL';

      console.log('🔍 [Inventario] Criando inventário com filtros:', {
        seq_estoque: seqEstoque,
        filtros,
        tipoInventario
      });

      if (ENVIRONMENT.isFigmaMake) {
        // 🆕 USAR MOCK NO FIGMA MAKE
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Simular criação - no mock, mostrar mensagem de sucesso
        // Em produção, o backend retornará o número real de posições criadas
        const qtdPosicoesSimuladas = 7; // Simulação baseada nos mocks
        
        console.log('✅ [Inventario] Inventário criado com sucesso (MOCK)');
        
        toast.success(`Inventário ${tipoInventario.toLowerCase()} criado com ${qtdPosicoesSimuladas} posições!`);
        setDialogOpen(false);
        await carregarInventarios();
      } else {
        // BACKEND REAL
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/inventarios.php`, {
          method: 'POST',
          body: JSON.stringify({
            nome_inventario: nomeInventario.toUpperCase(),
            seq_estoque: seqEstoque,
            filtros
          })
        });

        if (data.success) {
          toast.success(`Inventário ${tipoInventario.toLowerCase()} criado com ${data.data.qtd_posicoes} posições!`);
          setDialogOpen(false);
          carregarInventarios();
        }
      }
    } catch (error) {
      console.error('Erro ao criar inventário:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelarInventario = async (seq: number) => {
    if (!confirm('Deseja realmente cancelar este inventário?')) return;

    setLoading(true);
    try {
      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/inventarios.php`, {
        method: 'DELETE',
        body: JSON.stringify({ seq_inventario: seq })
      });

      if (data.success) {
        toast.success('Inventário cancelado com sucesso!');
        carregarInventarios();
      }
    } catch (error) {
      console.error('Erro ao cancelar inventário:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirContagem = (seqInventario: number) => {
    navigate(`/estoque/inventario/${seqInventario}`);
  };

  const imprimirFicha = async (seqInventario: number) => {
    try {
      // ✅ PADRÃO: Usar API com HTML + wkhtmltopdf (igual aos pedidos)
      const url = `${ENVIRONMENT.apiBaseUrl}/estoque/inventario_pdf.php?seq_inventario=${seqInventario}`;
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include', // ✅ Envia cookies automaticamente
        headers: {
          'Accept': 'application/pdf'
        }
      });
      
      if (!response.ok) {
        // Tentar obter mensagem de erro
        try {
          const data = await response.json();
          throw new Error(data.message || data.error || `HTTP error! status: ${response.status}`);
        } catch {
          throw new Error(`Erro ao gerar PDF (status: ${response.status})`);
        }
      }
      
      // ✅ PADRÃO: Verificar se é PDF
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/pdf')) {
        throw new Error('Resposta inválida do servidor');
      }
      
      // ✅ PADRÃO: Ler mensagem de sucesso dos headers customizados
      const toastMessage = response.headers.get('X-Toast-Message');
      
      // ✅ PADRÃO: Download do PDF
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Inventario_${seqInventario}_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
      
      // ✅ PADRÃO: Exibir mensagem de sucesso
      toast.success(toastMessage || 'PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao gerar PDF');
    }
  };

  const getBadgeStatus = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string }> = {
      'PENDENTE': { variant: 'secondary', icon: Clock, label: 'PENDENTE' },
      'FINALIZADO': { variant: 'default', icon: CheckCircle, label: 'FINALIZADO' }
    };

    const config = statusConfig[status] || statusConfig['PENDENTE'];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="size-3" />
        {config.label}
      </Badge>
    );
  };

  const formatarData = (data: string): string => {
    if (!data) return '-';
    const partes = data.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return data;
  };

  // Aplicar filtros frontend
  const inventariosFiltrados = inventarios.filter(inv => {
    // Filtro de busca (nome do inventário ou estoque)
    if (filtroBusca) {
      const busca = filtroBusca.toLowerCase();
      const match = 
        inv.nome_inventario.toLowerCase().includes(busca) ||
        inv.estoque_descricao.toLowerCase().includes(busca) ||
        inv.unidade.toLowerCase().includes(busca);
      if (!match) return false;
    }

    return true;
  });

  // Estatísticas
  const totalInventarios = inventariosFiltrados.length;
  const totalPendentes = inventariosFiltrados.filter(i => i.status === 'PENDENTE').length;
  const totalFinalizados = inventariosFiltrados.filter(i => i.status === 'FINALIZADO').length;
  const totalPosicoes = inventariosFiltrados.reduce((sum, i) => sum + i.qtd_posicoes, 0);

  const limparFiltros = () => {
    setFiltroStatus('');
    setFiltroDataInicio(() => {
      const hoje = new Date();
      const data60DiasAtras = new Date(hoje);
      data60DiasAtras.setDate(hoje.getDate() - 60);
      return data60DiasAtras.toISOString().split('T')[0];
    });
    setFiltroDataFim(new Date().toISOString().split('T')[0]);
    setFiltroBusca('');
  };

  if (loading && inventarios.length === 0) {
    return (
      <AdminLayout title="INVENTÁRIOS DE ESTOQUE" description="Controle de inventários gerais e parciais">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="INVENTÁRIOS DE ESTOQUE"
      description="Controle de inventários gerais e parciais"
    >
      <div className="space-y-6">
        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <ClipboardCheck className="size-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total de Inventários</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{totalInventarios}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Todos os inventários</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950 dark:to-yellow-900 border-yellow-200 dark:border-yellow-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Clock className="size-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{totalPendentes}</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Em andamento</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="size-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Finalizados</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{totalFinalizados}</p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Concluídos</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="size-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Total de Posições</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{totalPosicoes}</p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Posições inventariadas</p>
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
                    placeholder="Buscar por nome ou estoque..."
                    className="pl-10"
                  />
                </div>
                <Button onClick={abrirDialogNovo} className="gap-2">
                  <Plus className="size-4" />
                  Novo Inventário
                </Button>
              </div>

              {/* Linha 2 - Filtros específicos */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                  >
                    <option value="">Todos os status</option>
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="FINALIZADO">FINALIZADO</option>
                  </select>
                </div>

                <div>
                  <Input
                    type="date"
                    value={filtroDataInicio}
                    onChange={(e) => setFiltroDataInicio(e.target.value)}
                    placeholder="Data início"
                  />
                </div>

                <div>
                  <Input
                    type="date"
                    value={filtroDataFim}
                    onChange={(e) => setFiltroDataFim(e.target.value)}
                    placeholder="Data fim"
                  />
                </div>

                <div>
                  <Button 
                    onClick={carregarInventarios} 
                    className="w-full gap-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Filtrando...
                      </>
                    ) : (
                      <>
                        <Search className="size-4" />
                        Filtrar
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Botão limpar filtros */}
              {(filtroStatus || filtroBusca) && (
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

        {/* Tabela de Inventários */}
        <Card>
          <CardContent className="pt-6">
            {inventariosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardCheck className="size-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Nenhum inventário encontrado</p>
                <p className="text-sm mt-1">
                  {inventarios.length === 0
                    ? 'Comece criando um novo inventário'
                    : 'Tente ajustar os filtros de busca'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="nome_inventario"
                        label="Nome"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="estoque_descricao"
                        label="Estoque"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="qtd_posicoes"
                        label="Posições"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHeader
                        field="qtd_contadas"
                        label="Contadas"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHeader
                        field="data_inclusao"
                        label="Data Criação"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead>Data Conclusão</TableHead>
                      <SortableTableHeader
                        field="status"
                        label="Status"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead className="text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortData(inventariosFiltrados).map((inv) => (
                      <TableRow key={inv.seq_inventario}>
                        <TableCell className="font-medium">
                          {inv.nome_inventario}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-bold text-blue-600">{inv.unidade}</div>
                            <div className="text-xs text-gray-500">{inv.estoque_descricao}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                            {inv.qtd_posicoes}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                            {inv.qtd_contadas || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-gray-400" />
                            {formatarData(inv.data_inclusao)} {inv.hora_inclusao}
                          </div>
                        </TableCell>
                        <TableCell>
                          {inv.data_conclusao ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4 text-gray-400" />
                              {formatarData(inv.data_conclusao)} {inv.hora_conclusao}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getBadgeStatus(inv.status)}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirContagem(inv.seq_inventario)}
                              className="gap-2"
                              title={inv.status === 'FINALIZADO' ? 'Visualizar' : 'Continuar contagem'}
                            >
                              {inv.status === 'FINALIZADO' ? (
                                <>
                                  <Eye className="size-4" />
                                  Ver
                                </>
                              ) : (
                                <>
                                  <FileText className="size-4" />
                                  Contar
                                </>
                              )}
                            </Button>
                            {inv.status === 'FINALIZADO' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => imprimirFicha(inv.seq_inventario)}
                                className="gap-2 text-green-600 hover:text-green-700"
                              >
                                <FileDown className="size-4" />
                                PDF
                              </Button>
                            )}
                            {inv.status === 'PENDENTE' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => cancelarInventario(inv.seq_inventario)}
                                className="gap-2 text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="size-4" />
                                Cancelar
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
      </div>

      {/* Dialog Novo Inventário */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-card-foreground">Novo Inventário</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome do Inventário *</Label>
              <Input
                id="nome"
                value={nomeInventario}
                onChange={(e) => setNomeInventario(e.target.value)}
                placeholder="Ex: INVENTÁRIO MENSAL - JANEIRO/2026"
                className="uppercase"
                maxLength={200}
              />
            </div>

            <div className="grid gap-2">
              <FilterSelectEstoque
                value={seqEstoque}
                onChange={setSeqEstoque}
                label="Estoque *"
              />
            </div>

            <div className="border-t pt-4 dark:border-slate-700">
              <h3 className="font-semibold text-sm mb-3 text-slate-900 dark:text-slate-100">
                Filtros (Opcional - deixe em branco para inventário GERAL)
              </h3>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="rua">Rua</Label>
                  <Input
                    id="rua"
                    value={filtroRua}
                    onChange={(e) => setFiltroRua(e.target.value)}
                    placeholder="Ex: A"
                    className="uppercase"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="altura">Altura</Label>
                  <Input
                    id="altura"
                    value={filtroAltura}
                    onChange={(e) => setFiltroAltura(e.target.value)}
                    placeholder="Ex: 1"
                    className="uppercase"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="coluna">Coluna</Label>
                  <Input
                    id="coluna"
                    value={filtroColuna}
                    onChange={(e) => setFiltroColuna(e.target.value)}
                    placeholder="Ex: 01"
                    className="uppercase"
                  />
                </div>
              </div>

              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-400">
                  💡 <strong>Tipo:</strong>{' '}
                  {!filtroRua && !filtroAltura && !filtroColuna
                    ? 'INVENTÁRIO GERAL (todas as posições do estoque)'
                    : 'INVENTÁRIO PARCIAL (apenas posições filtradas)'}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={criarInventario} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Inventário'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}