import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  X,
  ClipboardList,
  Eye,
  Mail,
  ShoppingCart,
  Filter,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner@2.0.3';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { toUpperCase, toUpperCaseInput } from '../../utils/stringUtils';
import { FilterSelectCentroCusto } from '../../components/shared/FilterSelectCentroCusto';
import { FilterSelectSetor } from '../../components/admin/FilterSelectSetor';
import { FilterSelectVeiculo } from '../../components/dashboards/FilterSelectVeiculo';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { formatCodigoCentroCusto } from '../../utils/formatters';
import { Checkbox } from '../../components/ui/checkbox';

interface SolicitacaoCompra {
  seq_solicitacao_compra: number;
  unidade: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  seq_centro_custo: number;
  centro_custo_nro?: string;
  centro_custo_descricao?: string;
  centro_custo_unidade?: string;
  nro_setor?: number;
  setor_descricao?: string;
  placa?: string; // ✅ Placa do veículo
  observacao: string;
  status: 'P' | 'A'; // P = PENDENTE, A = ATENDIDA
  seq_ordem_compra?: number;
  nro_ordem_compra?: string;
  qtd_itens: number;
}

interface ItemSolicitacao {
  item: string;
  qtde_item: number;
}

interface UsuarioSetor {
  id: number;
  username: string;
  full_name: string;
  email: string;
}

export default function SolicitacoesCompra() {
  usePageTitle('Solicitações de Compra');

  const { user } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Formulário de nova solicitação
  const [mostrarModal, setMostrarModal] = useState(false);
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState('');
  const [setorSelecionado, setSetorSelecionado] = useState('');
  const [placa, setPlaca] = useState(''); // ✅ NOVO - Placa do veículo (opcional)
  const [observacoes, setObservacoes] = useState('');
  const [itens, setItens] = useState<ItemSolicitacao[]>([]);
  const [itemTemp, setItemTemp] = useState('');
  const [qtdeTemp, setQtdeTemp] = useState('');

  // Modal de detalhes
  const [mostrarDetalhesModal, setMostrarDetalhesModal] = useState(false);
  const [solicitacaoDetalhes, setSolicitacaoDetalhes] = useState<SolicitacaoCompra | null>(null);
  const [itensDetalhes, setItensDetalhes] = useState<ItemSolicitacao[]>([]);

  // Modal de solicitação de aprovação
  const [mostrarModalAprovacao, setMostrarModalAprovacao] = useState(false);
  const [solicitacaoParaAprovacao, setSolicitacaoParaAprovacao] = useState<SolicitacaoCompra | null>(null);
  const [usuariosSetor, setUsuariosSetor] = useState<UsuarioSetor[]>([]);
  const [usuariosSelecionados, setUsuariosSelecionados] = useState<number[]>([]);
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // Modal de confirmação de aprovação
  const [mostrarDialogConfirmacao, setMostrarDialogConfirmacao] = useState(false);
  const [solicitacaoRecemCriada, setSolicitacaoRecemCriada] = useState<SolicitacaoCompra | null>(null);

  // Modal de exclusão
  const [mostrarModalExclusao, setMostrarModalExclusao] = useState(false);
  const [solicitacaoParaExcluir, setSolicitacaoParaExcluir] = useState<SolicitacaoCompra | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Filtros
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => {
    // Últimos 30 dias como padrão
    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(hoje.getDate() - 30);
    return dataInicio.toISOString().split('T')[0];
  });
  const [filtroDataFim, setFiltroDataFim] = useState(() => {
    // Data de hoje como padrão
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  });
  const [filtroSetor, setFiltroSetor] = useState<number | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'TODAS' | 'CONVERTIDAS' | 'PENDENTES'>('TODAS');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Hook de ordenação
  type SortField = 'seq_solicitacao_compra' | 'data_inclusao' | 'centro_custo_descricao' | 'qtd_itens';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  useEffect(() => {
    carregarSolicitacoes();
  }, []);

  const carregarSolicitacoes = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));
        const mockSolicitacoes: SolicitacaoCompra[] = [
          {
            seq_solicitacao_compra: 1,
            unidade: 'MTZ',
            data_inclusao: '2026-02-28',
            hora_inclusao: '10:30:00',
            login_inclusao: user?.username || 'admin',
            seq_centro_custo: 1,
            centro_custo_nro: '1',
            centro_custo_descricao: 'ADMINISTRATIVO',
            centro_custo_unidade: 'MTZ',
            nro_setor: 1,
            setor_descricao: 'COMPRAS',
            observacao: 'Material de escritório urgente',
            status: 'P',
            qtd_itens: 3,
          },
          {
            seq_solicitacao_compra: 2,
            unidade: 'MTZ',
            data_inclusao: '2026-03-01',
            hora_inclusao: '14:15:00',
            login_inclusao: user?.username || 'admin',
            seq_centro_custo: 2,
            centro_custo_nro: '2',
            centro_custo_descricao: 'MANUTENÇÃO',
            centro_custo_unidade: 'MTZ',
            nro_setor: 2,
            setor_descricao: 'MANUTENÇÃO',
            observacao: 'Peças para frota',
            status: 'A',
            seq_ordem_compra: 123,
            nro_ordem_compra: 'MTZ000123',
            qtd_itens: 5,
          },
        ];
        setSolicitacoes(mockSolicitacoes);
      } else {
        // BACKEND
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php`, {
          method: 'GET',
        });

        if (data.success) {
          setSolicitacoes(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalNovaSolicitacao = () => {
    setCentroCustoSelecionado('');
    setSetorSelecionado('');
    setPlaca(''); // ✅ NOVO - Limpar placa
    setObservacoes('');
    setItens([]);
    setItemTemp('');
    setQtdeTemp('');
    setMostrarModal(true);
  };

  const adicionarItem = () => {
    if (!itemTemp.trim()) {
      toast.error('Informe a descrição do item');
      return;
    }

    const qtde = parseInt(qtdeTemp);
    if (!qtde || qtde <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    setItens([...itens, { item: itemTemp.toUpperCase(), qtde_item: qtde }]);
    setItemTemp('');
    setQtdeTemp('');
  };

  const removerItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
  };

  const salvarSolicitacao = async () => {
    // Validações
    if (!centroCustoSelecionado) {
      toast.error('Selecione o centro de custo');
      return;
    }

    if (!setorSelecionado) {
      toast.error('Selecione o setor responsável');
      return;
    }

    if (itens.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    try {
      setSalvando(true);

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Buscar dados do centro de custo (mock)
        const centroCustoMock = [
          { seq: 1, nro: '1', descricao: 'ADMINISTRATIVO', unidade: 'MTZ' },
          { seq: 2, nro: '2', descricao: 'MANUTENÇÃO', unidade: 'MTZ' },
          { seq: 3, nro: '3', descricao: 'OPERACIONAL', unidade: 'MTZ' },
        ];
        
        const centroCusto = centroCustoMock.find(cc => cc.seq === parseInt(centroCustoSelecionado));
        
        // Buscar dados do setor (mock)
        const setorMock = [
          { nro: 1, descricao: 'COMPRAS' },
          { nro: 2, descricao: 'MANUTENÇÃO' },
          { nro: 3, descricao: 'ADMINISTRATIVO' },
          { nro: 4, descricao: 'FINANCEIRO' },
          { nro: 5, descricao: 'RECURSOS HUMANOS' },
        ];
        
        const setor = setorMock.find(s => s.nro === parseInt(setorSelecionado));
        
        const novaSolicitacao: SolicitacaoCompra = {
          seq_solicitacao_compra: solicitacoes.length + 1,
          unidade: user?.unidade_atual || user?.unidade || 'MTZ',
          data_inclusao: new Date().toISOString().split('T')[0],
          hora_inclusao: new Date().toTimeString().split(' ')[0],
          login_inclusao: user?.username || 'admin',
          seq_centro_custo: parseInt(centroCustoSelecionado),
          centro_custo_nro: centroCusto?.nro || '',
          centro_custo_descricao: centroCusto?.descricao || '',
          centro_custo_unidade: centroCusto?.unidade || 'MTZ',
          nro_setor: parseInt(setorSelecionado),
          setor_descricao: setor?.descricao || '',
          placa: placa ? placa.toUpperCase() : null, // ✅ Placa do veículo
          observacao: observacoes.toUpperCase(),
          status: 'P',
          qtd_itens: itens.length,
        };

        setSolicitacoes([novaSolicitacao, ...solicitacoes]);
        setMostrarModal(false);
        
        // Abrir dialog de confirmação para solicitar aprovação
        setSolicitacaoRecemCriada(novaSolicitacao);
        setTimeout(() => {
          setMostrarDialogConfirmacao(true);
        }, 500);
      } else {
        // BACKEND
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php`, {
          method: 'POST',
          body: JSON.stringify({
            seq_centro_custo: parseInt(centroCustoSelecionado),
            nro_setor: parseInt(setorSelecionado),
            placa: placa ? placa.toUpperCase() : null, // ✅ NOVO - Placa do veículo
            observacao: observacoes.toUpperCase(),
            itens: itens,
          }),
        });

        if (data.success) {
          // Recarregar a lista de solicitações
          await carregarSolicitacoes();
          setMostrarModal(false);
          
          // ✅ Buscar a solicitação recém-criada e perguntar se deseja solicitar aprovação
          if (data.solicitacao) {
            // Backend retorna a solicitação completa
            setSolicitacaoRecemCriada(data.solicitacao);
            setTimeout(() => {
              setMostrarDialogConfirmacao(true);
            }, 300);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao salvar solicitação:', error);
    } finally {
      setSalvando(false);
    }
  };

  const visualizarDetalhes = async (solicitacao: SolicitacaoCompra) => {
    setSolicitacaoDetalhes(solicitacao);

    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        const itensMock: ItemSolicitacao[] = [
          { item: 'CANETA AZUL', qtde_item: 100 },
          { item: 'PAPEL A4', qtde_item: 10 },
          { item: 'GRAMPEADOR', qtde_item: 5 },
        ];
        setItensDetalhes(itensMock);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php?seq_solicitacao_compra=${solicitacao.seq_solicitacao_compra}&action=itens`,
          { method: 'GET' }
        );

        if (data.success) {
          setItensDetalhes(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    }

    setMostrarDetalhesModal(true);
  };

  const abrirModalSolicitarAprovacao = async (solicitacao: SolicitacaoCompra) => {
    setSolicitacaoParaAprovacao(solicitacao);
    setUsuariosSelecionados([]);

    // Buscar usuários do setor
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        const mockUsuarios: UsuarioSetor[] = [
          { id: 1, username: 'joao', full_name: 'JOÃO DA SILVA', email: 'joao@empresa.com' },
          { id: 2, username: 'maria', full_name: 'MARIA SANTOS', email: 'maria@empresa.com' },
        ];
        setUsuariosSetor(mockUsuarios);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/usuarios_setor.php?nro_setor=${solicitacao.nro_setor}`,
          { method: 'GET' }
        );

        if (data.success) {
          setUsuariosSetor(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar usuários do setor:', error);
    }

    setMostrarModalAprovacao(true);
  };

  const toggleUsuarioSelecionado = (userId: number) => {
    setUsuariosSelecionados(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const enviarSolicitacaoAprovacao = async () => {
    if (usuariosSelecionados.length === 0) {
      toast.error('Selecione pelo menos um usuário');
      return;
    }

    if (!solicitacaoParaAprovacao) return;

    try {
      setEnviandoEmail(true);

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success(`Email enviado para ${usuariosSelecionados.length} usuário(s)!`);
      } else {
        // BACKEND
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php`, {
          method: 'PUT',
          body: JSON.stringify({
            action: 'solicitar_aprovacao',
            seq_solicitacao_compra: solicitacaoParaAprovacao.seq_solicitacao_compra,
            usuarios_ids: usuariosSelecionados,
          }),
        });
      }

      setMostrarModalAprovacao(false);
    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
    } finally {
      setEnviandoEmail(false);
    }
  };

  // Confirmar envio de aprovação (Dialog)
  const confirmarEnvioAprovacao = () => {
    if (!solicitacaoRecemCriada) return;
    setMostrarDialogConfirmacao(false);
    abrirModalSolicitarAprovacao(solicitacaoRecemCriada);
  };

  // Abrir modal de exclusão
  const abrirModalExclusao = (solicitacao: SolicitacaoCompra) => {
    setSolicitacaoParaExcluir(solicitacao);
    setMostrarModalExclusao(true);
  };

  // Excluir solicitação
  const excluirSolicitacao = async () => {
    if (!solicitacaoParaExcluir) return;

    try {
      setExcluindo(true);

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Remover da lista
        setSolicitacoes(solicitacoes.filter(
          s => s.seq_solicitacao_compra !== solicitacaoParaExcluir.seq_solicitacao_compra
        ));
        
        toast.success('Solicitação excluída com sucesso!');
      } else {
        // BACKEND
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php`, {
          method: 'DELETE',
          body: JSON.stringify({
            seq_solicitacao_compra: solicitacaoParaExcluir.seq_solicitacao_compra,
          }),
        });
        
        await carregarSolicitacoes();
      }

      setMostrarModalExclusao(false);
      setSolicitacaoParaExcluir(null);
    } catch (error) {
      console.error('Erro ao excluir solicitação:', error);
    } finally {
      setExcluindo(false);
    }
  };

  const getSetorBadgeColor = (nroSetor: number | undefined) => {
    if (!nroSetor) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

    const colors = [
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    ];

    return colors[(nroSetor - 1) % colors.length];
  };

  // Função de filtro
  const solicitacoesFiltradas = solicitacoes.filter(sol => {
    // Filtro de data início
    if (filtroDataInicio && sol.data_inclusao < filtroDataInicio) return false;
    
    // Filtro de data fim
    if (filtroDataFim && sol.data_inclusao > filtroDataFim) return false;
    
    // Filtro de setor
    if (filtroSetor && sol.nro_setor !== filtroSetor) return false;
    
    // Filtro de status
    if (filtroStatus === 'CONVERTIDAS' && !sol.seq_ordem_compra) return false;
    if (filtroStatus === 'PENDENTES' && sol.seq_ordem_compra) return false;
    
    return true;
  });

  // Formatar número da solicitação
  const formatarNumeroSolicitacao = (unidade: string, seq: number): string => {
    return `${unidade}${String(seq).padStart(6, '0')}`;
  };

  // Limpar filtros
  const limparFiltros = () => {
    // Restaurar período padrão (últimos 30 dias)
    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(hoje.getDate() - 30);
    
    setFiltroDataInicio(dataInicio.toISOString().split('T')[0]);
    setFiltroDataFim(hoje.toISOString().split('T')[0]);
    setFiltroSetor(null);
    setFiltroStatus('TODAS');
  };

  return (
    <AdminLayout
      title="SOLICITAÇÕES DE COMPRA"
      description="Gerenciar solicitações de compra"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Card de Nova Solicitação */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ClipboardList className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Minhas Solicitações</CardTitle>
              </div>
              <Button onClick={abrirModalNovaSolicitacao} className="gap-2">
                <Plus className="size-4" />
                Nova Solicitação
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="outline"
                  onClick={() => setMostrarFiltros(!mostrarFiltros)}
                  className="gap-2"
                >
                  <Filter className="size-4" />
                  {mostrarFiltros ? 'Ocultar Filtros' : 'Mostrar Filtros'}
                </Button>
                
                {(filtroDataInicio || filtroDataFim || filtroSetor || filtroStatus !== 'TODAS') && (
                  <Button variant="ghost" onClick={limparFiltros} className="text-sm">
                    Limpar Filtros
                  </Button>
                )}
              </div>

              {mostrarFiltros && (
                <Card className="p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Período */}
                    <div>
                      <Label className="text-sm mb-2 block">Data Início</Label>
                      <Input
                        type="date"
                        value={filtroDataInicio}
                        onChange={(e) => setFiltroDataInicio(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label className="text-sm mb-2 block">Data Fim</Label>
                      <Input
                        type="date"
                        value={filtroDataFim}
                        onChange={(e) => setFiltroDataFim(e.target.value)}
                      />
                    </div>

                    {/* Setor */}
                    <div>
                      <Label className="text-sm mb-2 block">Setor</Label>
                      <FilterSelectSetor
                        value={filtroSetor}
                        onChange={setFiltroSetor}
                        allowClear={true}
                        placeholder="Todos os setores"
                        apenasEfetuaCompras={true}
                      />
                    </div>

                    {/* Status */}
                    <div>
                      <Label className="text-sm mb-2 block">Status</Label>
                      <Select value={filtroStatus} onValueChange={(value: any) => setFiltroStatus(value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TODAS">TODAS</SelectItem>
                          <SelectItem value="PENDENTES">PENDENTES</SelectItem>
                          <SelectItem value="CONVERTIDAS">CONVERTIDAS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : solicitacoes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma solicitação encontrada</p>
                <p className="text-sm mt-1">Crie sua primeira solicitação de compra</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="seq_solicitacao_compra"
                        label="Número"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="data_inclusao"
                        label="Data"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="centro_custo_descricao"
                        label="Centro de Custo"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead>Setor</TableHead>
                      <SortableTableHeader
                        field="qtd_itens"
                        label="Itens"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <TableHead className="text-center font-mono">Ordem de Compra</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortData(solicitacoesFiltradas).map((solicitacao) => (
                      <TableRow key={solicitacao.seq_solicitacao_compra}>
                        <TableCell className="font-medium font-mono">
                          {formatarNumeroSolicitacao(solicitacao.unidade, solicitacao.seq_solicitacao_compra)}
                        </TableCell>
                        <TableCell>
                          {new Date(solicitacao.data_inclusao).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCodigoCentroCusto(
                            solicitacao.centro_custo_unidade || '',
                            solicitacao.centro_custo_nro || ''
                          )} - {solicitacao.centro_custo_descricao}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSetorBadgeColor(solicitacao.nro_setor)}`}
                          >
                            {solicitacao.setor_descricao || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{solicitacao.qtd_itens}</TableCell>
                        <TableCell className="text-center font-mono">
                          {solicitacao.nro_ordem_compra || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {solicitacao.status === 'A' ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Atendida
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => visualizarDetalhes(solicitacao)}
                              title="Visualizar"
                            >
                              <Eye className="size-4" />
                            </Button>
                            
                            {!solicitacao.seq_ordem_compra && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => abrirModalSolicitarAprovacao(solicitacao)}
                                title="Solicitar Aprovação"
                              >
                                <Mail className="size-4 text-blue-600" />
                              </Button>
                            )}
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => abrirModalExclusao(solicitacao)}
                              title="Excluir"
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
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

      {/* Modal de Nova Solicitação */}
      <Dialog open={mostrarModal} onOpenChange={setMostrarModal}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Compra</DialogTitle>
            <DialogDescription>
              Preencha os dados da solicitação de compra
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Centro de Custo */}
            <div>
              <FilterSelectCentroCusto
                value={centroCustoSelecionado}
                onChange={setCentroCustoSelecionado}
              />
            </div>

            {/* Setor */}
            <div>
              <FilterSelectSetor
                value={setorSelecionado}
                onChange={setSetorSelecionado}
                suggestUserSetor={true}
                apenasEfetuaCompras={true}
              />
            </div>

            {/* Placa do Veículo (opcional) */}
            <div>
              <FilterSelectVeiculo
                value={placa}
                onChange={setPlaca}
                placeholder="Placa do veículo (opcional)"
              />
            </div>

            {/* Observações */}
            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={observacoes}
                onChange={(e) => setObservacoes(toUpperCaseInput(e.target.value))}
                placeholder="OBSERVAÇÕES DA SOLICITAÇÃO..."
                rows={3}
              />
            </div>

            {/* Adicionar Item */}
            <div className="border-t pt-4">
              <Label className="text-base font-semibold mb-3 block">Itens da Solicitação</Label>
              <div className="grid grid-cols-[1fr_150px_auto] gap-2 mb-3">
                <div>
                  <Input
                    placeholder="DESCRIÇÃO DO ITEM"
                    value={itemTemp}
                    onChange={(e) => setItemTemp(toUpperCaseInput(e.target.value))}
                    onKeyPress={(e) => e.key === 'Enter' && adicionarItem()}
                  />
                </div>
                <div>
                  <Input
                    type="number"
                    placeholder="Qtde"
                    value={qtdeTemp}
                    onChange={(e) => setQtdeTemp(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && adicionarItem()}
                  />
                </div>
                <Button onClick={adicionarItem} type="button">
                  <Plus className="size-4" />
                </Button>
              </div>

              {/* Lista de Itens */}
              {itens.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-[100px] text-right">Quantidade</TableHead>
                        <TableHead className="w-[60px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.item}</TableCell>
                          <TableCell className="text-right">{item.qtde_item}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removerItem(index)}
                            >
                              <Trash2 className="size-4 text-red-600" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMostrarModal(false)}
              disabled={salvando}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={salvarSolicitacao} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes */}
      <Dialog open={mostrarDetalhesModal} onOpenChange={setMostrarDetalhesModal}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
            <DialogDescription>
              Visualizar informações completas da solicitação de compra
            </DialogDescription>
          </DialogHeader>

          {solicitacaoDetalhes && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Número:</Label>
                  <p className="font-medium">{String(solicitacaoDetalhes.seq_solicitacao_compra).padStart(6, '0')}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Data:</Label>
                  <p className="font-medium">
                    {new Date(solicitacaoDetalhes.data_inclusao).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="col-span-2">
                  <Label className="text-sm text-gray-500">Centro de Custo:</Label>
                  <p className="font-medium">
                    {formatCodigoCentroCusto(
                      solicitacaoDetalhes.centro_custo_unidade || '',
                      solicitacaoDetalhes.centro_custo_nro || ''
                    )} - {solicitacaoDetalhes.centro_custo_descricao}
                  </p>
                </div>

                <div>
                  <Label className="text-sm text-gray-500">Setor:</Label>
                  <p className="font-medium">{solicitacaoDetalhes.setor_descricao || '-'}</p>
                </div>

                {/* ✅ Placa do Veículo - SEMPRE EXIBIR */}
                <div>
                  <Label className="text-sm text-gray-500">Placa do Veículo:</Label>
                  <p className="font-medium font-mono">
                    {solicitacaoDetalhes.placa || '-'}
                  </p>
                </div>

                {solicitacaoDetalhes.seq_ordem_compra && (
                  <div>
                    <Label className="text-sm text-gray-500">Ordem de Compra:</Label>
                    <p className="font-medium font-mono">{solicitacaoDetalhes.nro_ordem_compra}</p>
                  </div>
                )}

                {solicitacaoDetalhes.observacao && (
                  <div className="col-span-2">
                    <Label className="text-sm text-gray-500">Observações:</Label>
                    <p className="font-medium">{solicitacaoDetalhes.observacao}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Itens ({itensDetalhes.length})</h3>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itensDetalhes.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.item}</TableCell>
                          <TableCell className="text-right">{item.qtde_item}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setMostrarDetalhesModal(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Solicitação de Aprovação */}
      <Dialog open={mostrarModalAprovacao} onOpenChange={setMostrarModalAprovacao}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Solicitar Aprovação por Email</DialogTitle>
            <DialogDescription>
              Selecione os usuários do setor que receberão a notificação
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {usuariosSetor.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Nenhum usuário encontrado neste setor</p>
              </div>
            ) : (
              <div className="space-y-2">
                {usuariosSetor.map((usuario) => (
                  <div
                    key={usuario.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => toggleUsuarioSelecionado(usuario.id)}
                  >
                    <Checkbox
                      checked={usuariosSelecionados.includes(usuario.id)}
                      onCheckedChange={() => toggleUsuarioSelecionado(usuario.id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{usuario.full_name}</p>
                      <p className="text-sm text-gray-500">{usuario.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMostrarModalAprovacao(false)}
              disabled={enviandoEmail}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={enviarSolicitacaoAprovacao}
              disabled={enviandoEmail || usuariosSelecionados.length === 0}
            >
              {enviandoEmail ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="size-4 mr-2" />
                  Enviar ({usuariosSelecionados.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Aprovação */}
      <Dialog open={mostrarDialogConfirmacao} onOpenChange={setMostrarDialogConfirmacao}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Solicitação Criada com Sucesso</DialogTitle>
            <DialogDescription>
              Deseja solicitar a aprovação desta solicitação por email?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMostrarDialogConfirmacao(false)}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={confirmarEnvioAprovacao}
            >
              <Mail className="size-4 mr-2" />
              Solicitar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Exclusão */}
      <Dialog open={mostrarModalExclusao} onOpenChange={setMostrarModalExclusao}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Excluir Solicitação</DialogTitle>
            <DialogDescription>
              Tem certeza de que deseja excluir esta solicitação de compra?
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMostrarModalExclusao(false)}
              disabled={excluindo}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={excluirSolicitacao}
              disabled={excluindo}
            >
              {excluindo ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="size-4 mr-2" />
                  Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}