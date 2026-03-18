import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Loader2,
  Plus,
  Trash2,
  CheckCircle,
  X,
  ShoppingCart,
  Eye,
  Pencil,
  Search,
  Filter,
  ClipboardList,
  Mail,
  Package,
  Info,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { toUpperCase } from '../../utils/stringUtils';
import { MOCK_ORDENS_COMPRA, MOCK_ORDEM_COMPRA_ITENS, MOCK_CENTROS_CUSTO, MOCK_ITENS } from '../../utils/estoqueModData';
import { MOCK_FORNECEDORES } from '../../mocks/estoqueComprasMocks';
import { FilterSelectCentroCusto } from '../../components/shared/FilterSelectCentroCusto';
import { FilterSelectItem } from '../../components/estoque/FilterSelectItem';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { formatCodigoCentroCusto } from '../../utils/formatters';
import { FilterSelectSetor } from '../../components/admin/FilterSelectSetor';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { NovoItemDialog } from '../../components/shared/NovoItemDialog';
import { FilterSelectVeiculo } from '../../components/dashboards/FilterSelectVeiculo';
import { FilterSelectFornecedor } from '../../components/shared/FilterSelectFornecedor'; // ✅ NOVO: Busca de fornecedor

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

interface OrdemCompra {
  seq_ordem_compra: number;
  unidade: string;
  nro_ordem_compra: string;
  seq_centro_custo: number;
  centro_custo_nro?: string;
  centro_custo_descricao?: string;
  centro_custo_unidade?: string;
  nro_setor?: number; // ✅ NOVO: Setor responsável
  setor_descricao?: string; // ✅ NOVO: Descrição do setor
  placa?: string; // ✅ NOVO: Placa do veículo
  aprovada: string;
  orcar: string;
  observacao: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_aprovacao?: string;
  hora_aprovacao?: string;
  login_aprovacao?: string;
  motivo_reprovacao?: string;
  qtd_itens: number;
}

interface ItemOrdemCompra {
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_item: number;
}

interface CentroCusto {
  seq_centro_custo: number;
  nro_centro_custo: string;
  descricao: string;
  unidade: string;
  ativo: string;
}

export default function CadastroOrdensCompra() {
  usePageTitle('Ordens de Compra');

  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // 🔍 DEBUG: Log quando componente renderiza
  console.log('🔵 [COMPONENTE] CadastroOrdensCompra RENDERIZADO');
  console.log('🔵 [COMPONENTE] location.state:', location.state);
  
  const [ordens, setOrdens] = useState<OrdemCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarDetalhesModal, setMostrarDetalhesModal] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);
  const [ordemEdicao, setOrdemEdicao] = useState<OrdemCompra | null>(null);
  
  // ✅ NOVO: Contador de solicitações pendentes
  const [qtdSolicitacoesPendentes, setQtdSolicitacoesPendentes] = useState(0);
  const [loadingSolicitacoes, setLoadingSolicitacoes] = useState(false);

  // Dados do formulário
  const [centroCustoSelecionado, setCentroCustoSelecionado] = useState('');
  const [setorSelecionado, setSetorSelecionado] = useState<number | null>(null); // ✅ NOVO: Setor responsável
  const [placa, setPlaca] = useState(''); // ✅ NOVO: Placa do veículo
  const [observacao, setObservacao] = useState('');
  const [itensOrdem, setItensOrdem] = useState<ItemOrdemCompra[]>([]);

  // Para adicionar itens
  const [itemSelecionado, setItemSelecionado] = useState('');
  const [quantidadeItem, setQuantidadeItem] = useState('');

  // ✅ NOVO: Dialog de criação rápida de item
  const [mostrarNovoItemDialog, setMostrarNovoItemDialog] = useState(false);

  // ✅ MELHORIA 2: Busca de centro de custo
  const [buscaCentroCusto, setBuscaCentroCusto] = useState('');

  // ✅ FLUXO RÁPIDO - GERAÇÃO AUTOMÁTICA DE PEDIDO
  const [dialogPerguntaFornecedor, setDialogPerguntaFornecedor] = useState(false);
  const [dialogPreenchimentoValores, setDialogPreenchimentoValores] = useState(false);
  const [dialogSolicitarAprovacao, setDialogSolicitarAprovacao] = useState(false);
  const [ordemProcessada, setOrdemProcessada] = useState<OrdemCompra | null>(null);
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<any | null>(null); // ✅ Objeto fornecedor completo
  const [modalFornecedor, setModalFornecedor] = useState(false); // ✅ Modal de busca de fornecedor
  const [buscaFornecedor, setBuscaFornecedor] = useState(''); // ✅ Busca de fornecedor
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState<any[]>([]); // ✅ Lista de fornecedores
  const [itensComValor, setItensComValor] = useState<Array<{
    seq_item: number;
    codigo: string;
    descricao: string;
    unidade_medida: string;
    qtde_item: number;
    vlr_unitario: number;
  }>>([]);
  const [pedidoGerado, setPedidoGerado] = useState<any>(null);
  const [gerandoPedido, setGerandoPedido] = useState(false);
  const [solicitandoAprovacao, setSolicitandoAprovacao] = useState(false);

  // ✅ NOVO: Estados para aprovação de pedidos
  const [usuariosAprovadores, setUsuariosAprovadores] = useState<any[]>([]);
  const [aprovadoresSelecionados, setAprovadoresSelecionados] = useState<number[]>([]);

  // Lista de centros de custo e itens disponíveis
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [itensDisponiveis, setItensDisponiveis] = useState<any[]>([]);

  // Detalhes da ordem selecionada
  const [ordemDetalhes, setOrdemDetalhes] = useState<OrdemCompra | null>(null);
  const [itensDetalhes, setItensDetalhes] = useState<any[]>([]);

  // ✅ FILTROS - Temporários (antes de aplicar)
  const [filtroUnidadeTemp, setFiltroUnidadeTemp] = useState('');
  const [filtroDataInicioTemp, setFiltroDataInicioTemp] = useState('');
  const [filtroDataFimTemp, setFiltroDataFimTemp] = useState('');
  const [filtroCentroCustoTemp, setFiltroCentroCustoTemp] = useState('');
  const [filtroSetorTemp, setFiltroSetorTemp] = useState<number | null>(null);

  // ✅ FILTROS - Aplicados (após clicar em "Filtrar")
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroCentroCusto, setFiltroCentroCusto] = useState('');
  const [filtroSetor, setFiltroSetor] = useState<number | null>(null);

  // ✅ PERÍODO PADRÃO: ÚLTIMOS 30 DIAS
  useEffect(() => {
    const hoje = getToday();
    const dias30Atras = get30DaysAgo();
    
    setFiltroDataInicioTemp(dias30Atras);
    setFiltroDataFimTemp(hoje);
    setFiltroDataInicio(dias30Atras);
    setFiltroDataFim(hoje);
  }, []);

  // ✅ FORÇAR UNIDADE DO USUÁRIO (SE NÃO-MTZ)
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
    carregarOrdens();
    carregarCentrosCusto();
    carregarItens();
    carregarUsuariosAprovadores(); // ✅ NOVO: Carregar aprovadores
    carregarQuantidadeSolicitacoesPendentes(); // ✅ NOVO: Carregar contador de solicitações pendentes
  }, []);

  // ✅ FLUXO RÁPIDO: Detectar ordem recém-criada via navegação
  useEffect(() => {
    console.log('🔍 [DEBUG] useEffect disparado - location:', location);
    console.log('🔍 [DEBUG] location.state:', location.state);
    
    const state = location.state as any;
    if (state?.abrirFluxoRapido && state?.ordemRecemCriada) {
      console.log('🟢 [FLUXO RÁPIDO] Ordem recém-criada detectada:', state.ordemRecemCriada);
      
      // Exibir toast de sucesso com número formatado
      const nroOrdemFormatado = `${state.ordemRecemCriada.unidade}${String(state.ordemRecemCriada.nro_ordem_compra).padStart(6, '0')}`;
      toast.success(`Ordem de compra ${nroOrdemFormatado} criada com sucesso!`);
      
      // ✅ IMPORTANTE: Adicionar ordem na lista (para MOCK funcionar)
      if (ENVIRONMENT.isFigmaMake) {
        console.log('🟢 [FLUXO RÁPIDO] Adicionando ordem na lista (MOCK)');
        setOrdens(prev => [state.ordemRecemCriada, ...prev]);
      } else {
        console.log('🟢 [FLUXO RÁPIDO] Recarregando ordens (BACKEND)');
        // No backend, recarregar a lista para pegar a ordem criada
        carregarOrdens();
      }
      
      // Preparar dados para o fluxo rápido
      console.log('🟢 [FLUXO RÁPIDO] Preparando dados:', {
        ordemProcessada: state.ordemRecemCriada,
        itensComValor: state.itensComValor
      });
      setOrdemProcessada(state.ordemRecemCriada);
      setItensComValor(state.itensComValor || []);
      
      // ✅ CORREÇÃO: Abrir dialog IMEDIATAMENTE
      console.log('🟢 [FLUXO RÁPIDO] Abrindo dialog de fornecedor...');
      setDialogPerguntaFornecedor(true);
      
      // Limpar o state DEPOIS de um delay
      setTimeout(() => {
        console.log('🟢 [FLUXO RÁPIDO] Limpando location.state');
        navigate(location.pathname, { replace: true, state: {} });
      }, 500);
    } else {
      console.log('❌ [DEBUG] Condições não atendidas:', {
        abrirFluxoRapido: state?.abrirFluxoRapido,
        temOrdemRecemCriada: !!state?.ordemRecemCriada,
        state: state
      });
    }
  }, [location]);

  // ✅ RECARREGAR CONTADOR ao voltar para a página
  useEffect(() => {
    const handleFocus = () => {
      carregarQuantidadeSolicitacoesPendentes();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const carregarOrdens = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));
        let dadosFiltrados = [...MOCK_ORDENS_COMPRA];
        
        // ✅ Filtro por unidade - MTZ/ALL vê tudo, outros só da sua unidade
        const unidadeAtual = user?.unidade_atual || user?.unidade || 'MTZ';
        const unidadeAtualUpper = unidadeAtual.toUpperCase();
        const isMtzOrAll = unidadeAtualUpper === 'MTZ' || unidadeAtualUpper === 'ALL';
        
        if (!isMtzOrAll) {
          dadosFiltrados = dadosFiltrados.filter(o => {
            // Buscar centro de custo para validar a unidade
            const cc = MOCK_CENTROS_CUSTO.find(c => c.seq_centro_custo === o.seq_centro_custo);
            return cc?.unidade === unidadeAtual;
          });
        }
        
        // Adicionar unidade do centro de custo
        dadosFiltrados = dadosFiltrados.map(o => {
          const cc = MOCK_CENTROS_CUSTO.find(c => c.seq_centro_custo === o.seq_centro_custo);
          return {
            ...o,
            centro_custo_unidade: cc?.unidade
          };
        });
        
        setOrdens(dadosFiltrados);
      } else {
        // BACKEND
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php`, {
          method: 'GET'
        });
        if (data.success) {
          setOrdens(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar ordens:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarCentrosCusto = async () => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        let filtrados = MOCK_CENTROS_CUSTO.filter(cc => cc.ativo === 'S');
        
        // ✅ Regra de unidades - MTZ/ALL vê todos, outros só da sua unidade
        const unidadeAtual = user?.unidade_atual || user?.unidade || 'MTZ';
        const unidadeAtualUpper = unidadeAtual.toUpperCase();
        const isMtzOrAll = unidadeAtualUpper === 'MTZ' || unidadeAtualUpper === 'ALL';
        
        if (!isMtzOrAll) {
          filtrados = filtrados.filter(cc => cc.unidade === unidadeAtual);
        }
        
        setCentrosCusto(filtrados);
      } else {
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/centros_custo.php?ativo=S`, {
          method: 'GET'
        });
        if (data.success) {
          setCentrosCusto(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar centros de custo:', error);
    }
  };

  const carregarItens = async () => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        setItensDisponiveis(MOCK_ITENS.filter(i => i.ativo === 'S'));
      } else {
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/itens.php?ativo=S`, {
          method: 'GET'
        });
        if (data.success) {
          setItensDisponiveis(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    }
  };

  const abrirModalNovo = () => {
    setModoEdicao(false);
    setOrdemEdicao(null);
    setCentroCustoSelecionado('');
    setSetorSelecionado(null); // ✅ NOVO: Setor responsável
    setPlaca(''); // ✅ NOVO: Placa do veículo
    setObservacao('');
    setItensOrdem([]);
    setItemSelecionado('');
    setQuantidadeItem('');
    setBuscaCentroCusto('');
    setMostrarModal(true);
  };

  const abrirModalEditar = (ordem: OrdemCompra) => {
    if (ordem.aprovada === 'S') {
      toast.error('Não é possível editar uma ordem aprovada');
      return;
    }

    setModoEdicao(true);
    setOrdemEdicao(ordem);
    setCentroCustoSelecionado(ordem.seq_centro_custo.toString());
    setSetorSelecionado(ordem.nro_setor || null); // ✅ NOVO: Setor responsável
    setPlaca(ordem.placa || ''); // ✅ NOVO: Placa do veículo
    setObservacao(ordem.observacao || '');
    setItemSelecionado('');
    setQuantidadeItem('');
    setBuscaCentroCusto('');

    // Carregar itens da ordem
    carregarItensOrdem(ordem.seq_ordem_compra);

    setMostrarModal(true);
  };

  const carregarItensOrdem = async (seqOrdem: number) => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        const itensMock = MOCK_ORDEM_COMPRA_ITENS
          .filter(i => i.seq_ordem_compra === seqOrdem)
          .map(i => ({
            seq_item: i.seq_item,
            codigo: i.codigo,
            descricao: i.descricao,
            unidade_medida: i.unidade_medida,
            qtde_item: i.qtde_item
          }));
        setItensOrdem(itensMock);
      } else {
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php?seq_ordem_compra=${seqOrdem}&action=itens`,
          { method: 'GET' }
        );
        if (data.success) {
          setItensOrdem(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar itens da ordem:', error);
    }
  };

  const fecharModal = () => {
    setMostrarModal(false);
  };

  const adicionarItem = () => {
    if (!itemSelecionado) {
      toast.error('Selecione um item');
      return;
    }

    const qtde = parseFloat(quantidadeItem);
    if (!qtde || qtde <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    // Verificar se item já foi adicionado
    if (itensOrdem.find(i => i.seq_item === parseInt(itemSelecionado))) {
      toast.error('Este item já foi adicionado');
      return;
    }

    const item = itensDisponiveis.find(i => i.seq_item === parseInt(itemSelecionado));
    if (!item) return;

    setItensOrdem([
      ...itensOrdem,
      {
        seq_item: item.seq_item,
        codigo: item.codigo,
        descricao: item.descricao,
        unidade_medida: item.unidade_medida_sigla,
        qtde_item: qtde
      }
    ]);

    setItemSelecionado('');
    setQuantidadeItem('');
  };

  const removerItem = (seqItem: number) => {
    setItensOrdem(itensOrdem.filter(i => i.seq_item !== seqItem));
  };

  const salvar = async () => {
    console.log('🟣 [SALVAR ORDEM] ========== INICIANDO ==========');
    console.log('🟣 [SALVAR ORDEM] modoEdicao:', modoEdicao);
    console.log('🟣 [SALVAR ORDEM] ordemEdicao:', ordemEdicao);
    console.log('🟣 [SALVAR ORDEM] itensOrdem:', itensOrdem);
    
    // Validações
    if (!centroCustoSelecionado) {
      toast.error('Selecione um centro de custo');
      return;
    }

    if (itensOrdem.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    try {
      setSalvando(true);

      if (ENVIRONMENT.isFigmaMake) {
        console.log('🟣 [SALVAR ORDEM] Modo MOCK (Figma Make)');
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 800));

        if (modoEdicao && ordemEdicao) {
          // Editar
          setOrdens(prev => prev.map(o =>
            o.seq_ordem_compra === ordemEdicao.seq_ordem_compra
              ? {
                  ...o,
                  seq_centro_custo: parseInt(centroCustoSelecionado),
                  nro_setor: setorSelecionado || undefined, // ✅ NOVO: Setor responsável
                  placa: placa || undefined, // ✅ NOVO: Placa do veículo
                  observacao: toUpperCase(observacao),
                  qtd_itens: itensOrdem.length
                }
              : o
          ));
          toast.success('Ordem de compra atualizada com sucesso');
        } else {
          // Nova ordem
          const cc = centrosCusto.find(c => c.seq_centro_custo === parseInt(centroCustoSelecionado));
          const novaOrdem: OrdemCompra = {
            seq_ordem_compra: Math.max(...ordens.map(o => o.seq_ordem_compra), 0) + 1,
            unidade: user?.unidade || 'MTZ',
            nro_ordem_compra: `OC-2026-${String(ordens.length + 1).padStart(3, '0')}`,
            seq_centro_custo: parseInt(centroCustoSelecionado),
            centro_custo_nro: cc?.nro_centro_custo,
            centro_custo_descricao: cc?.descricao,
            centro_custo_unidade: cc?.unidade,
            nro_setor: setorSelecionado || undefined, // ✅ NOVO: Setor responsável
            placa: placa || undefined, // ✅ NOVO: Placa do veículo
            aprovada: 'N',
            orcar: 'N',
            observacao: toUpperCase(observacao),
            data_inclusao: new Date().toISOString().split('T')[0],
            hora_inclusao: new Date().toTimeString().split(' ')[0],
            login_inclusao: user?.username || 'ADMIN',
            qtd_itens: itensOrdem.length
          };
          setOrdens([novaOrdem, ...ordens]);
          
          // ✅ FLUXO RÁPIDO: Guardar ordem processada e abrir dialog de pergunta
          console.log('🟢 [MOCK] Ordem criada:', novaOrdem);
          console.log('🟢 [MOCK] seq_ordem_compra:', novaOrdem.seq_ordem_compra);
          setOrdemProcessada(novaOrdem);
          
          // Preparar itens com valores zerados para preenchimento
          const itensParaPreenchimento = itensOrdem.map(item => ({
            ...item,
            vlr_unitario: 0
          }));
          setItensComValor(itensParaPreenchimento);
          console.log('🟢 [MOCK] Itens preparados:', itensParaPreenchimento);
          
          toast.success('Ordem de compra criada com sucesso');
        }

        setMostrarModal(false);
        
        // ✅ FLUXO RÁPIDO: Abrir dialog perguntando sobre fornecedor (apenas para nova ordem)
        if (!modoEdicao) {
          console.log('🟢 [MOCK] Abrindo dialog de pergunta sobre fornecedor');
          console.log('🟢 [MOCK] ordemProcessada antes de abrir dialog:', ordemProcessada);
          setDialogPerguntaFornecedor(true);
        }
      } else {
        // BACKEND
        const payload = {
          unidade: user?.unidade || 'MTZ',
          seq_centro_custo: parseInt(centroCustoSelecionado),
          nro_setor: setorSelecionado || undefined, // ✅ NOVO: Setor responsável
          placa: placa || undefined, // ✅ NOVO: Placa do veículo
          observacao: toUpperCase(observacao),
          itens: itensOrdem.map(i => ({
            seq_item: i.seq_item,
            qtde_item: i.qtde_item
          }))
        };

        if (modoEdicao && ordemEdicao) {
          await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php`, {
            method: 'PUT',
            body: JSON.stringify({
              ...payload,
              seq_ordem_compra: ordemEdicao.seq_ordem_compra
            })
          });
          toast.success('Ordem de compra atualizada com sucesso');
          
          setMostrarModal(false);
          await carregarOrdens();
          await carregarQuantidadeSolicitacoesPendentes(); // ✅ Recarregar contador
        } else {
          // ✅ FLUXO RÁPIDO: Preparar dados ANTES de enviar (para garantir que itens não se percam)
          const itensParaPreenchimento = itensOrdem.map(item => ({
            ...item,
            vlr_unitario: 0
          }));
          setItensComValor(itensParaPreenchimento);
          
          // Criar objeto temporário da ordem (será substituído pela resposta do backend)
          console.log('🟢 [BACKEND] Enviando ordem para o backend...');
          
          // Enviar para o backend
          const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
          
          console.log('✅ [CRIAR ORDEM] Resposta do backend:', response);
          
          // ✅ ATUALIZAR ordemProcessada com o seq_ordem_compra REAL do backend
          // Backend pode retornar: {"success":true, "seq_ordem_compra":"39", "nro_ordem_compra":28}
          // OU: {"success":true, "data": {"seq_ordem_compra":"39", "nro_ordem_compra":28}}
          const dadosOrdem = response.data || response;
          
          if (response.success && dadosOrdem.seq_ordem_compra) {
            const ordemReal = {
              seq_ordem_compra: parseInt(dadosOrdem.seq_ordem_compra),
              unidade: user?.unidade || 'MTZ',
              nro_ordem_compra: dadosOrdem.nro_ordem_compra?.toString() || `OC-${dadosOrdem.seq_ordem_compra}`,
              seq_centro_custo: parseInt(centroCustoSelecionado),
              aprovada: 'N',
              orcar: 'N',
              observacao: toUpperCase(observacao),
              data_inclusao: new Date().toISOString().split('T')[0],
              hora_inclusao: new Date().toTimeString().split(' ')[0],
              login_inclusao: user?.username || 'admin',
              qtd_itens: itensOrdem.length
            };
            
            setOrdemProcessada(ordemReal as any);
            console.log('✅ [CRIAR ORDEM] ordemProcessada atualizada:', ordemReal);
            
            // Preparar itens com valores zerados para preenchimento
            const itensParaPreenchimento = itensOrdem.map(item => ({
              ...item,
              vlr_unitario: 0
            }));
            setItensComValor(itensParaPreenchimento);
            console.log('✅ [CRIAR ORDEM] Itens preparados:', itensParaPreenchimento);
            
            toast.success('Ordem de compra criada com sucesso');
            
            setMostrarModal(false);
            await carregarOrdens();
            
            // ✅ FLUXO RÁPIDO: Abrir dialog perguntando sobre fornecedor SOMENTE APÓS atualizar ordemProcessada
            console.log('🟢 [BACKEND] Abrindo dialog de pergunta sobre fornecedor');
            console.log('🟢 [BACKEND] ordemProcessada antes de abrir dialog:', ordemReal);
            setDialogPerguntaFornecedor(true);
          } else {
            console.error('❌ [CRIAR ORDEM] Resposta inválida:', response);
            toast.error('Erro ao criar ordem: resposta inválida do servidor');
            setMostrarModal(false);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao salvar ordem:', error);
    } finally {
      setSalvando(false);
    }
  };

  const excluirOrdem = async (ordem: OrdemCompra) => {
    if (ordem.aprovada === 'S') {
      toast.error('Não é possível excluir uma ordem aprovada');
      return;
    }

    if (!window.confirm(`Tem certeza que deseja excluir a ordem ${ordem.nro_ordem_compra}?`)) {
      return;
    }

    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setOrdens(ordens.filter(o => o.seq_ordem_compra !== ordem.seq_ordem_compra));
      } else {
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php`, {
          method: 'DELETE',
          body: JSON.stringify({ seq_ordem_compra: ordem.seq_ordem_compra })
        });
        await carregarOrdens();
        await carregarQuantidadeSolicitacoesPendentes(); // ✅ Recarregar contador
      }
    } catch (error) {
      console.error('Erro ao excluir ordem:', error);
    }
  };

  const visualizarDetalhes = async (ordem: OrdemCompra) => {
    setOrdemDetalhes(ordem);

    try {
      if (ENVIRONMENT.isFigmaMake) {
        const itensMock = MOCK_ORDEM_COMPRA_ITENS
          .filter(i => i.seq_ordem_compra === ordem.seq_ordem_compra)
          .map(i => ({
            codigo: i.codigo,
            descricao: i.descricao,
            unidade_medida_sigla: i.unidade_medida,
            qtde_item: i.qtde_item
          }));
        setItensDetalhes(itensMock);
      } else {
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php?seq_ordem_compra=${ordem.seq_ordem_compra}&action=itens`,
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

  // ✅ MELHORIA 2: Filtrar centros de custo por busca (unidade e descrição)
  const centrosCustoFiltrados = useMemo(() => {
    if (!buscaCentroCusto.trim()) {
      return centrosCusto;
    }
    const termo = buscaCentroCusto.toLowerCase();
    return centrosCusto.filter(cc => 
      cc.unidade.toLowerCase().includes(termo) ||
      cc.nro_centro_custo.toLowerCase().includes(termo) ||
      cc.descricao.toLowerCase().includes(termo)
    );
  }, [centrosCusto, buscaCentroCusto]);

  // ✅ Hook de ordenação
  type SortField = 'nro_ordem_compra' | 'unidade' | 'centro_custo_descricao' | 'data_inclusao' | 'login_inclusao' | 'qtd_itens' | 'aprovada' | 'orcar';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  // ✅ Função para gerar cores do badge de setor
  const getSetorBadgeColor = (nroSetor: number | undefined) => {
    if (!nroSetor) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    
    const colors = [
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    ];
    
    return colors[(nroSetor - 1) % colors.length];
  };

  // ✅ APLICAR FILTROS
  const aplicarFiltros = () => {
    setFiltroUnidade(filtroUnidadeTemp);
    setFiltroDataInicio(filtroDataInicioTemp);
    setFiltroDataFim(filtroDataFimTemp);
    setFiltroCentroCusto(filtroCentroCustoTemp);
    setFiltroSetor(filtroSetorTemp);
  };

  const limparFiltros = () => {
    const unidadeAtual = user?.unidade_atual || user?.unidade || 'MTZ';
    const isNonMTZ = unidadeAtual && unidadeAtual !== 'MTZ';
    
    setFiltroUnidadeTemp(isNonMTZ ? unidadeAtual : '');
    setFiltroDataInicioTemp('');
    setFiltroDataFimTemp('');
    setFiltroCentroCustoTemp('');
    setFiltroSetorTemp(null);
    
    setFiltroUnidade(isNonMTZ ? unidadeAtual : '');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroCentroCusto('');
    setFiltroSetor(null);
  };

  // ✅ ORDENS FILTRADAS
  const ordensFiltradas = useMemo(() => {
    console.log('📊 [DEBUG] Iniciando filtros...');
    console.log('📊 [DEBUG] Total de ordens:', ordens.length);
    console.log('📊 [DEBUG] Filtros ativos:', {
      filtroUnidade,
      filtroDataInicio,
      filtroDataFim,
      filtroCentroCusto: filtroCentroCusto,
      filtroSetor: filtroSetor,
      filtroCentroCustoTipo: typeof filtroCentroCusto,
      filtroSetorTipo: typeof filtroSetor
    });

    let filtradas = [...ordens];

    // Filtro de unidade
    if (filtroUnidade) {
      filtradas = filtradas.filter(o => o.centro_custo_unidade === filtroUnidade);
      console.log('📊 [DEBUG] Após filtro unidade:', filtradas.length);
    }

    // Filtro de período
    if (filtroDataInicio) {
      filtradas = filtradas.filter(o => o.data_inclusao >= filtroDataInicio);
      console.log('📊 [DEBUG] Após filtro data início:', filtradas.length);
    }
    if (filtroDataFim) {
      filtradas = filtradas.filter(o => o.data_inclusao <= filtroDataFim);
      console.log('📊 [DEBUG] Após filtro data fim:', filtradas.length);
    }

    // Filtro de centro de custo
    if (filtroCentroCusto) {
      console.log('🔍 [DEBUG CENTRO CUSTO] Filtrando por:', filtroCentroCusto, 'tipo:', typeof filtroCentroCusto);
      console.log('🔍 [DEBUG CENTRO CUSTO] Ordens antes:', filtradas.map(o => ({ 
        seq: o.seq_ordem_compra, 
        seq_cc: o.seq_centro_custo, 
        tipo: typeof o.seq_centro_custo,
        comparacao_string: String(o.seq_centro_custo) === String(filtroCentroCusto),
        comparacao_number: Number(o.seq_centro_custo) === Number(filtroCentroCusto)
      })));
      
      filtradas = filtradas.filter(o => {
        // Normalizar ambos para string e comparar
        return String(o.seq_centro_custo) === String(filtroCentroCusto);
      });
      console.log('🔍 [DEBUG CENTRO CUSTO] Após filtro:', filtradas.length);
    }

    // Filtro de setor
    if (filtroSetor !== null) {
      console.log('🔍 [DEBUG SETOR] Filtrando por:', filtroSetor, 'tipo:', typeof filtroSetor);
      console.log('🔍 [DEBUG SETOR] Ordens antes:', filtradas.map(o => ({ 
        seq: o.seq_ordem_compra, 
        nro_setor: o.nro_setor, 
        tipo: typeof o.nro_setor,
        valor_nro_setor: o.nro_setor,
        comparacao_string: String(o.nro_setor) === String(filtroSetor),
        comparacao_number: Number(o.nro_setor) === Number(filtroSetor)
      })));
      
      filtradas = filtradas.filter(o => {
        // Normalizar ambos para string e comparar (trata undefined/null)
        if (o.nro_setor === undefined || o.nro_setor === null) {
          return false; // Se não tem setor, não passa no filtro
        }
        return String(o.nro_setor) === String(filtroSetor);
      });
      console.log('🔍 [DEBUG SETOR] Após filtro:', filtradas.length);
    }

    console.log('📊 [DEBUG] Total final após todos os filtros:', filtradas.length);
    return filtradas;
  }, [ordens, filtroUnidade, filtroDataInicio, filtroDataFim, filtroCentroCusto, filtroSetor]);

  // ✅ FLUXO RÁPIDO: Prosseguir sem fornecedor (fluxo normal)
  const prosseguirSemFornecedor = () => {
    setDialogPerguntaFornecedor(false);
    toast.info('Ordem de compra criada. Prossiga com o fluxo normal de orçamento.');
  };

  // ✅ FLUXO RÁPIDO: Carregar fornecedores
  const carregarFornecedores = async (search = '') => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        const filtrados = MOCK_FORNECEDORES.filter(f => 
          f.nome.toLowerCase().includes(search.toLowerCase()) ||
          f.cnpj.includes(search)
        );
        setFornecedoresDisponiveis(filtrados);
      } else {
        // BACKEND
        let url = `${ENVIRONMENT.apiBaseUrl}/compras/fornecedores.php`;
        if (search && search.trim() !== '') {
          url += `?search=${encodeURIComponent(search)}`;
        }
        
        const data = await apiFetch(url, { method: 'GET' });

        if (data.success) {
          setFornecedoresDisponiveis(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
    }
  };

  // ✅ FLUXO RÁPIDO: Selecionar fornecedor
  const selecionarFornecedor = (fornecedor: any) => {
    setFornecedorSelecionado(fornecedor);
    setModalFornecedor(false);
    setBuscaFornecedor('');
    toast.success('Fornecedor selecionado');
  };

  // ✅ FLUXO RÁPIDO: Abrir modal de fornecedor
  const abrirModalFornecedor = async () => {
    await carregarFornecedores();
    setModalFornecedor(true);
  };

  // ✅ FLUXO RÁPIDO: Iniciar preenchimento de valores
  const iniciarPreenchimentoValores = () => {
    console.log('🟡 [INICIAR PREENCHIMENTO] ========== INICIANDO ==========');
    console.log('🟡 [INICIAR PREENCHIMENTO] ordemProcessada:', JSON.stringify(ordemProcessada, null, 2));
    console.log('🟡 [INICIAR PREENCHIMENTO] seq_ordem_compra:', ordemProcessada?.seq_ordem_compra);
    console.log('🟡 [INICIAR PREENCHIMENTO] fornecedorSelecionado:', fornecedorSelecionado);
    console.log('🟡 [INICIAR PREENCHIMENTO] itensComValor:', itensComValor);
    
    if (!fornecedorSelecionado) {
      toast.error('Selecione um fornecedor');
      return;
    }
    setDialogPerguntaFornecedor(false);
    setDialogPreenchimentoValores(true);
  };

  // ✅ FLUXO RÁPIDO: Atualizar valor de um item
  const atualizarValorItem = (seqItem: number, valor: string) => {
    const vlr = parseFloat(valor) || 0;
    setItensComValor(prev => prev.map(item =>
      item.seq_item === seqItem
        ? { ...item, vlr_unitario: vlr }
        : item
    ));
  };

  // ✅ FLUXO RÁPIDO: Calcular total do pedido
  const calcularTotalPedido = useMemo(() => {
    return itensComValor.reduce((total, item) => {
      return total + (item.qtde_item * item.vlr_unitario);
    }, 0);
  }, [itensComValor]);

  // ✅ FLUXO RÁPIDO: Gerar pedido automaticamente
  const gerarPedidoRapido = async () => {
    console.log('🔵🔵🔵 [GERAR PEDIDO] ========== INICIANDO ==========');
    console.log('🔵 [GERAR PEDIDO] ordemProcessada:', JSON.stringify(ordemProcessada, null, 2));
    console.log('🔵 [GERAR PEDIDO] seq_ordem_compra:', ordemProcessada?.seq_ordem_compra);
    console.log('🔵 [GERAR PEDIDO] tipo do seq:', typeof ordemProcessada?.seq_ordem_compra);
    console.log('🔵 [GERAR PEDIDO] fornecedorSelecionado:', fornecedorSelecionado);
    console.log('🔵 [GERAR PEDIDO] itensComValor:', itensComValor);
    
    // Validar fornecedor
    if (!fornecedorSelecionado) {
      console.error('❌ [VALIDAÇÃO] Fornecedor não selecionado');
      toast.error('Selecione um fornecedor');
      return;
    }

    console.log('✅ [VALIDAÇÃO] Fornecedor OK');

    // Validar se todos os itens têm valor
    const itensSemValor = itensComValor.filter(item => item.vlr_unitario <= 0);
    if (itensSemValor.length > 0) {
      console.error('❌ [VALIDAÇÃO] Itens sem valor:', itensSemValor);
      toast.error('Informe valores para todos os itens');
      return;
    }

    console.log('✅ [VALIDAÇÃO] Todos os itens têm valor');

    if (!ordemProcessada) {
      console.error('❌ [VALIDAÇÃO] ordemProcessada é null/undefined');
      toast.error('Erro: ordem não encontrada');
      return;
    }

    console.log('✅ [VALIDAÇÃO] ordemProcessada existe');

    if (!ordemProcessada.seq_ordem_compra || ordemProcessada.seq_ordem_compra <= 0) {
      console.error('❌ [VALIDAÇÃO] seq_ordem_compra INVÁLIDO:', ordemProcessada);
      console.error('❌ [VALIDAÇÃO] seq_ordem_compra valor:', ordemProcessada.seq_ordem_compra);
      console.error('❌ [VALIDAÇÃO] seq_ordem_compra tipo:', typeof ordemProcessada.seq_ordem_compra);
      toast.error('Erro: ID da ordem de compra inválido');
      return;
    }

    console.log('✅ [VALIDAÇÃO] seq_ordem_compra válido:', ordemProcessada.seq_ordem_compra);

    try {
      setGerandoPedido(true);

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Simular processo completo
        await new Promise(resolve => setTimeout(resolve, 1500));

        // 1. Aprovar a ordem de compra (sem orçar)
        setOrdens(prev => prev.map(o =>
          o.seq_ordem_compra === ordemProcessada.seq_ordem_compra
            ? { ...o, aprovada: 'S', orcar: 'N', login_aprovacao: user?.username || 'ADMIN', data_aprovacao: new Date().toISOString().split('T')[0] }
            : o
        ));

        // 2. Gerar pedido MOCK
        const novoPedido = {
          seq_pedido_compra: Date.now(),
          nro_pedido_compra: `PC-2026-${String(Date.now()).slice(-3)}`,
          unidade: ordemProcessada.unidade || user?.unidade || 'MTZ',
          seq_fornecedor: fornecedorSelecionado.seq_fornecedor,
          seq_centro_custo: ordemProcessada.seq_centro_custo, // ✅ CORREÇÃO: Centro de custo obrigatório
          vlr_total: calcularTotalPedido,
          data_inclusao: new Date().toISOString().split('T')[0],
          status_aprovacao: 'A', // A = Aguardando aprovação
          itens: itensComValor
        };

        setPedidoGerado(novoPedido);
        setDialogPreenchimentoValores(false);
        setDialogSolicitarAprovacao(true);
      } else {
        console.log('🟢 [BACKEND] Aprovando ordem:', ordemProcessada.seq_ordem_compra);
        
        // ✅ BACKEND - PASSO 1: Aprovar ordem (orcar = N)
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_ordem_compra: ordemProcessada.seq_ordem_compra,
            aprovar: true,
            orcar: 'N'
          })
        });
        
        console.log('✅ [BACKEND] Ordem aprovada');

        // ✅ BACKEND - PASSO 2: Criar pedido
        const payloadPedido = {
          seq_ordem_compra: ordemProcessada.seq_ordem_compra,
          seq_fornecedor: fornecedorSelecionado.seq_fornecedor,
          seq_centro_custo: ordemProcessada.seq_centro_custo, // ✅ CORREÇÃO: Centro de custo obrigatório
          status_aprovacao: 'A', // A = Aguardando aprovação
          itens: itensComValor.map(item => ({
            seq_item: item.seq_item,
            qtde_item: item.qtde_item,
            vlr_unitario: item.vlr_unitario
          }))
        };

        const responsePedido = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php`, {
          method: 'POST',
          body: JSON.stringify(payloadPedido)
        }, true); // ✅ suppressToast = true (não exibir toast automático, usaremos dialog)

        if (responsePedido.success) {
          // ✅ Usar dados da resposta (pode estar em .data ou direto na raiz)
          const dadosPedido = responsePedido.data || responsePedido;
          
          setPedidoGerado(dadosPedido);
          setDialogPreenchimentoValores(false);
          setDialogSolicitarAprovacao(true);
          await carregarOrdens(); // Recarregar ordens para atualizar status
        }
      }
    } catch (error) {
      console.error('Erro ao gerar pedido:', error);
      toast.error('Erro ao gerar pedido');
    } finally {
      setGerandoPedido(false);
    }
  };

  // ✅ NOVO: Carregar usuários aprovadores
  const carregarUsuariosAprovadores = async () => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        setUsuariosAprovadores([
          { id: 1, username: 'admin', full_name: 'Administrador', email: 'admin@exemplo.com' },
          { id: 2, username: 'gerente', full_name: 'Gerente Compras', email: 'gerente@exemplo.com' }
        ]);
      } else {
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/usuarios_aprovadores.php`,
          { method: 'GET' }
        );
        
        if (data.success) {
          setUsuariosAprovadores(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuários aprovadores:', error);
    }
  };

  // ✅ NOVO: Carregar quantidade de solicitações pendentes
  const carregarQuantidadeSolicitacoesPendentes = async () => {
    try {
      setLoadingSolicitacoes(true);
      
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - simular 3 solicitações pendentes
        await new Promise(resolve => setTimeout(resolve, 300));
        setQtdSolicitacoesPendentes(3);
      } else {
        console.log('🔍 [SOLICITAÇÕES] Buscando solicitações pendentes...');
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php`,
          { method: 'GET' }
        );
        
        console.log('🔍 [SOLICITAÇÕES] Resposta da API:', data);
        
        if (data.success && data.data) {
          // Contar apenas as solicitações PENDENTES (status='P' ou status=null) e sem ordem de compra
          const pendentes = data.data.filter((sol: any) => 
            (sol.status === 'P' || sol.status === null) && !sol.seq_ordem_compra
          );
          console.log('🔍 [SOLICITAÇÕES] Total de solicitações:', data.data.length);
          console.log('🔍 [SOLICITAÇÕES] Solicitações pendentes (status=P ou null e sem ordem):', pendentes.length);
          setQtdSolicitacoesPendentes(pendentes.length);
        } else {
          console.warn('⚠️ [SOLICITAÇÕES] Resposta sem sucesso ou sem dados:', data);
          setQtdSolicitacoesPendentes(0);
        }
      }
    } catch (error) {
      console.error('❌ [SOLICITAÇÕES] Erro ao carregar solicitações pendentes:', error);
      setQtdSolicitacoesPendentes(0);
    } finally {
      setLoadingSolicitacoes(false);
    }
  };

  // ✅ FLUXO RÁPIDO: Solicitar aprovação do pedido
  const solicitarAprovacaoPedido = async () => {
    if (!pedidoGerado) {
      toast.error('Erro: pedido não encontrado');
      return;
    }

    // ✅ Validar se pelo menos um aprovador foi selecionado
    if (aprovadoresSelecionados.length === 0) {
      toast.error('Selecione pelo menos um aprovador');
      return;
    }

    try {
      setSolicitandoAprovacao(true);

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success(`Solicitação enviada para ${aprovadoresSelecionados.length} aprovador(es)!`);
      } else {
        // ✅ Enviar para múltiplos aprovadores
        for (const aprovadorId of aprovadoresSelecionados) {
          await apiFetch(
            `${ENVIRONMENT.apiBaseUrl}/compras/pedidos_solicitar_aprovacao.php`,
            {
              method: 'POST',
              body: JSON.stringify({
                seq_pedido: pedidoGerado.seq_pedido || pedidoGerado.seq_pedido_compra,
                usuario_aprovador_id: aprovadorId
              })
            }
          );
        }
        
        toast.success(`Solicitação enviada para ${aprovadoresSelecionados.length} aprovador(es)!`);
      }

      setDialogSolicitarAprovacao(false);
      setAprovadoresSelecionados([]); // ✅ Limpar seleção
    } catch (error) {
      console.error('Erro ao solicitar aprovação:', error);
      toast.error('Erro ao solicitar aprovação');
    } finally {
      setSolicitandoAprovacao(false);
    }
  };

  // ✅ NOVO: Iniciar fluxo de conversão em pedido (para ordem já criada)
  const iniciarConversaoEmPedido = async (ordem: OrdemCompra) => {
    // Carregar itens da ordem
    try {
      setOrdemProcessada(ordem);

      if (ENVIRONMENT.isFigmaMake) {
        const itensMock = MOCK_ORDEM_COMPRA_ITENS
          .filter(i => i.seq_ordem_compra === ordem.seq_ordem_compra)
          .map(i => ({
            seq_item: i.seq_item,
            codigo: i.codigo,
            descricao: i.descricao,
            unidade_medida: i.unidade_medida,
            qtde_item: i.qtde_item,
            vlr_unitario: 0
          }));
        setItensComValor(itensMock);
      } else {
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php?seq_ordem_compra=${ordem.seq_ordem_compra}&action=itens`,
          { method: 'GET' }
        );
        if (data.success) {
          const itensComValorZero = (data.data || []).map((item: any) => ({
            seq_item: item.seq_item,
            codigo: item.codigo,
            descricao: item.descricao,
            unidade_medida: item.unidade_medida,
            qtde_item: item.qtde_item,
            vlr_unitario: 0
          }));
          setItensComValor(itensComValorZero);
        }
      }

      // Resetar fornecedor
      setFornecedorSelecionado(null);

      // Abrir dialog de pergunta sobre fornecedor
      setDialogPerguntaFornecedor(true);
    } catch (error) {
      console.error('Erro ao carregar itens da ordem:', error);
      toast.error('Erro ao carregar itens da ordem');
    }
  };

  return (
    <AdminLayout
      title="ORDENS DE COMPRA"
      description="Gerenciamento de solicitações de compra"
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

                <FilterSelectSetor
                  value={filtroSetorTemp}
                  onChange={setFiltroSetorTemp}
                  allowClear={true}
                  label="Setor"
                  placeholder="Todos os setores"
                />
              </div>

              {/* Linha 2 - Centro de Custo */}
              <div className="grid grid-cols-1">
                <FilterSelectCentroCusto
                  value={filtroCentroCustoTemp}
                  onChange={setFiltroCentroCustoTemp}
                  label="Centro de Custo"
                  placeholder="Todos os centros de custo"
                  allowClear={true}
                />
              </div>

              {/* Linha 3 - Botões de ação */}
              <div className="flex items-center justify-end gap-3">
                <Button onClick={aplicarFiltros} className="gap-2">
                  <Search className="size-4" />
                  Filtrar
                </Button>
                {(filtroUnidade || filtroDataInicio || filtroDataFim || filtroCentroCusto || filtroSetor) && (
                  <Button variant="outline" onClick={limparFiltros} className="gap-2">
                    <Filter className="size-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ShoppingCart className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Ordens de Compra</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Button 
                    variant="outline" 
                    onClick={() => navigate('/compras/solicitacoes-compra/converter')} 
                    className="gap-2"
                    disabled={loading || loadingSolicitacoes}
                    title={qtdSolicitacoesPendentes > 0 ? `${qtdSolicitacoesPendentes} solicitação(ões) pendente(s) aguardando conversão` : 'Ver todas as solicitações de compra'}
                  >
                    {loadingSolicitacoes ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ClipboardList className="size-4" />
                    )}
                    Solicitações
                  </Button>
                  {/* ✅ Badge flutuante com quantidade de pendentes */}
                  {qtdSolicitacoesPendentes > 0 && !loadingSolicitacoes && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-900 animate-pulse">
                      {qtdSolicitacoesPendentes}
                    </span>
                  )}
                </div>
                <Button onClick={abrirModalNovo} className="gap-2" disabled={loading}>
                  <Plus className="size-4" />
                  Nova Ordem de Compra
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : ordens.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ShoppingCart className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma ordem de compra cadastrada</p>
                <p className="text-sm mt-1">Clique em "Nova Ordem de Compra" para começar</p>
              </div>
            ) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="nro_ordem_compra"
                        label="Número"
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
                      <SortableTableHeader
                        field="data_inclusao"
                        label="Data"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead className="text-right">Setor</TableHead>
                      <SortableTableHeader
                        field="qtd_itens"
                        label="Itens"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHeader
                        field="aprovada"
                        label="Status"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHeader
                        field="orcar"
                        label="Orçar"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortData(ordensFiltradas).map((ordem) => (
                      <TableRow key={ordem.seq_ordem_compra}>
                        <TableCell className="font-medium font-mono">
                          {ordem.unidade}{String(ordem.nro_ordem_compra).padStart(6, '0')}
                        </TableCell>
                        <TableCell className="font-mono">
                          {ordem.centro_custo_unidade}{String(ordem.nro_centro_custo).padStart(6, '0')} - {ordem.centro_custo_descricao}
                        </TableCell>
                        <TableCell>
                          {new Date(ordem.data_inclusao).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSetorBadgeColor(ordem.nro_setor)}`}
                          >
                            {ordem.setor_descricao || (ordem.nro_setor ? `Setor ${ordem.nro_setor}` : '-')}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{ordem.qtd_itens}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              ordem.aprovada === 'S'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : ordem.aprovada === 'R'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}
                          >
                            {ordem.aprovada === 'S' ? 'Aprovada' : ordem.aprovada === 'R' ? 'Reprovada' : 'Pendente'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {ordem.orcar === 'S' ? 'Sim' : 'Não'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => visualizarDetalhes(ordem)}
                              title="Visualizar"
                            >
                              <Eye className="size-4" />
                            </Button>
                            {ordem.aprovada === 'N' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => abrirModalEditar(ordem)}
                                  title="Editar"
                                >
                                  <Pencil className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => excluirOrdem(ordem)}
                                  title="Excluir"
                                >
                                  <Trash2 className="size-4 text-red-500" />
                                </Button>
                              </>
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

      {/* Modal de Cadastro/Edição */}
      <Dialog open={mostrarModal} onOpenChange={setMostrarModal}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modoEdicao && ordemEdicao 
                ? `Editar Ordem de Compra ${ordemEdicao.unidade}${ordemEdicao.nro_ordem_compra.padStart(6, '0')}` 
                : 'Nova Ordem de Compra'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da ordem de compra e adicione os itens necessários
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Centro de Custo com Busca */}
            <FilterSelectCentroCusto
              value={centroCustoSelecionado}
              onChange={setCentroCustoSelecionado}
              label="Centro de Custo *"
              placeholder="Selecione o centro de custo"
            />

            {/* Setor Responsável */}
            <FilterSelectSetor
              value={setorSelecionado}
              onChange={setSetorSelecionado}
              label="Setor Responsável"
              placeholder="Selecione o setor responsável"
              suggestUserSetor={true}
              apenasEfetuaCompras={true}
            />

            {/* Placa do Veículo */}
            <div className="grid gap-2">
              <Label htmlFor="placa">Placa do Veículo</Label>
              <FilterSelectVeiculo
                value={placa}
                onChange={setPlaca}
                placeholder="Buscar placa do veículo"
              />
            </div>

            {/* Observação */}
            <div className="grid gap-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Descreva o motivo desta ordem de compra..."
                rows={3}
              />
            </div>

            {/* Adicionar Item */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Adicionar Itens</h3>
              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <FilterSelectItem
                    value={itemSelecionado}
                    onChange={setItemSelecionado}
                    label="Item *"
                    placeholder="Buscar item..."
                    showAll={false}
                  />
                </div>
                <div className="col-span-1 flex items-end">
                  <Button 
                    onClick={() => setMostrarNovoItemDialog(true)} 
                    variant="outline"
                    className="w-full" 
                    type="button"
                    title="Novo Item"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                <div className="col-span-3">
                  <div className="grid gap-2">
                    <Label htmlFor="quantidade">Quantidade *</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      step="0.01"
                      value={quantidadeItem}
                      onChange={(e) => setQuantidadeItem(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div className="col-span-3 flex items-end">
                  <Button onClick={adicionarItem} className="w-full" type="button">
                    <Plus className="size-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            {/* Lista de Itens */}
            {itensOrdem.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Itens da Ordem ({itensOrdem.length})</h3>
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-center">Unidade</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itensOrdem.map((item) => (
                        <TableRow key={item.seq_item}>
                          <TableCell className="font-medium">{item.codigo}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell className="text-center">{item.unidade_medida}</TableCell>
                          <TableCell className="text-right">
                            {item.qtde_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removerItem(item.seq_item)}
                              title="Remover"
                            >
                              <Trash2 className="size-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={fecharModal}
              disabled={salvando}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
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
            <DialogTitle>Detalhes da Ordem de Compra</DialogTitle>
          </DialogHeader>

          {ordemDetalhes && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-gray-500">Número:</Label>
                  <p className="font-medium">{ordemDetalhes.nro_ordem_compra}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Data:</Label>
                  <p className="font-medium">
                    {new Date(ordemDetalhes.data_inclusao).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                
                {/* ✅ MELHORIA 1: Login de inclusão nos detalhes */}
                <div>
                  <Label className="text-sm text-gray-500">Login Inclusão:</Label>
                  <p className="font-medium">{ordemDetalhes.login_inclusao}</p>
                </div>
                
                {/* ✅ MELHORIA 4: Unidade */}
                <div>
                  <Label className="text-sm text-gray-500">Unidade:</Label>
                  <p className="font-medium">{ordemDetalhes.unidade}</p>
                </div>
                
                <div className="col-span-2">
                  <Label className="text-sm text-gray-500">Centro de Custo:</Label>
                  <p className="font-medium">
                    {ordemDetalhes.centro_custo_unidade}{String(ordemDetalhes.nro_centro_custo).padStart(6, '0')} - {ordemDetalhes.centro_custo_descricao}
                  </p>
                </div>
                
                {/* ✅ NOVO: Setor Responsável */}
                <div className="col-span-2">
                  <Label className="text-sm text-gray-500">Setor Responsável:</Label>
                  <p className="font-medium">
                    {ordemDetalhes.setor_descricao || (ordemDetalhes.nro_setor ? `Setor ${ordemDetalhes.nro_setor}` : 'Não informado')}
                  </p>
                </div>
                
                {/* ✅ NOVO: Placa do Veículo */}
                <div className="col-span-2">
                  <Label className="text-sm text-gray-500">Placa do Veículo:</Label>
                  <p className="font-medium font-mono">
                    {ordemDetalhes.placa || '-'}
                  </p>
                </div>
                
                <div>
                  <Label className="text-sm text-gray-500">Status:</Label>
                  <p className="font-medium">
                    {ordemDetalhes.aprovada === 'S' ? 'Aprovada' : ordemDetalhes.aprovada === 'R' ? 'Reprovada' : 'Pendente'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">Orçar:</Label>
                  <p className="font-medium">{ordemDetalhes.orcar === 'S' ? 'Sim' : 'Não'}</p>
                </div>
                
                {ordemDetalhes.motivo_reprovacao && (
                  <div className="col-span-2">
                    <Label className="text-sm text-gray-500">Motivo Reprovação:</Label>
                    <p className="font-medium text-red-600">{ordemDetalhes.motivo_reprovacao}</p>
                  </div>
                )}
                
                {ordemDetalhes.observacao && (
                  <div className="col-span-2">
                    <Label className="text-sm text-gray-500">Observação:</Label>
                    <div className="max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-800 p-3 rounded-md border">
                      <p className="font-medium whitespace-pre-wrap">{ordemDetalhes.observacao}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Itens ({itensDetalhes.length})</h3>
                <div className="max-h-96 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-center">Unidade</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itensDetalhes.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{item.codigo}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell className="text-center">{item.unidade_medida_sigla || item.unidade_medida}</TableCell>
                          <TableCell className="text-right">
                            {parseFloat(item.qtde_item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setMostrarDetalhesModal(false)}>
              Fechar
            </Button>
            {ordemDetalhes && ordemDetalhes.aprovada === 'N' && (
              <Button 
                onClick={() => {
                  setMostrarDetalhesModal(false);
                  iniciarConversaoEmPedido(ordemDetalhes);
                }}
              >
                <Package className="mr-2 h-4 w-4" />
                Converter em Pedido
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de criação rápida de item */}
      <NovoItemDialog
        open={mostrarNovoItemDialog}
        onOpenChange={setMostrarNovoItemDialog}
        onItemCriado={(novoItem) => {
          // Adicionar à lista de itens disponíveis
          setItensDisponiveis([...itensDisponiveis, novoItem]);
          // Selecionar automaticamente o item recém-criado
          setItemSelecionado(novoItem.seq_item.toString());
          toast.success('Item criado e selecionado com sucesso!');
        }}
      />

      {/* ✅ FLUXO RÁPIDO: Dialog de pergunta sobre fornecedor */}
      <Dialog open={dialogPerguntaFornecedor} onOpenChange={setDialogPerguntaFornecedor}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5 text-blue-600" />
              Você já tem fornecedor e valores?
            </DialogTitle>
            <DialogDescription>
              Para agilizar o processo, você pode gerar o pedido imediatamente informando o fornecedor e os valores dos itens.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Fornecedor *</Label>
              {fornecedorSelecionado ? (
                <Card className="border-2 border-green-500">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{fornecedorSelecionado.nome}</h3>
                        <p className="text-sm text-gray-500 truncate">CNPJ: {fornecedorSelecionado.cnpj}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFornecedorSelecionado(null);
                          abrirModalFornecedor();
                        }}
                        className="shrink-0"
                      >
                        <Search className="size-4 mr-2" />
                        Alterar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-20"
                  onClick={abrirModalFornecedor}
                >
                  <Search className="size-4 mr-2" />
                  Selecionar Fornecedor
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={prosseguirSemFornecedor}
            >
              <X className="size-4 mr-2" />
              Não, prosseguir normalmente
            </Button>
            <Button onClick={iniciarPreenchimentoValores}>
              <CheckCircle className="size-4 mr-2" />
              Sim, já tenho os valores
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ FLUXO RÁPIDO: Dialog de preenchimento de valores */}
      <Dialog open={dialogPreenchimentoValores} onOpenChange={setDialogPreenchimentoValores}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Preencha os Valores dos Itens</DialogTitle>
            <DialogDescription>
              Informe o valor unitário para cada item da ordem de compra.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4">
            <div className="rounded-md border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Código</TableHead>
                      <TableHead className="min-w-[180px]">Descrição</TableHead>
                      <TableHead className="text-center w-16">Unid.</TableHead>
                      <TableHead className="text-right w-24">Qtde</TableHead>
                      <TableHead className="text-right w-36">Valor Unit.</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {itensComValor.map((item) => (
                    <TableRow key={item.seq_item}>
                      <TableCell className="font-medium whitespace-nowrap">{item.codigo}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.descricao}>{item.descricao}</TableCell>
                      <TableCell className="text-center">{item.unidade_medida}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {item.qtde_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          value={item.vlr_unitario}
                          onChange={(e) => atualizarValorItem(item.seq_item, e.target.value)}
                          placeholder="0,00"
                          className="w-32 text-right"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t mt-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {calcularTotalPedido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogPreenchimentoValores(false)}
              disabled={gerandoPedido}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={gerarPedidoRapido} disabled={gerandoPedido}>
              {gerandoPedido ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Gerando Pedido...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Gerar Pedido
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ FLUXO RÁPIDO: Dialog de solicitação de aprovação */}
      <Dialog open={dialogSolicitarAprovacao} onOpenChange={setDialogSolicitarAprovacao}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-5 text-blue-600" />
              Pedido Criado - Necessita Aprovação
            </DialogTitle>
            <DialogDescription>
              {pedidoGerado && `O pedido ${pedidoGerado.nro_pedido_formatado} foi criado com sucesso!`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-md border border-blue-200 dark:border-blue-900">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                <strong>⚠️ Atenção:</strong> Este pedido ainda precisa de aprovação antes de ser enviado ao fornecedor.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deseja solicitar a aprovação agora? Selecione um ou mais aprovadores abaixo.
              </p>
            </div>

            <div>
              <Label className="mb-3 block">SELECIONE OS APROVADORES *</Label>
              <div className="space-y-2 max-h-60 overflow-y-auto border border-input rounded-md p-3">
                {usuariosAprovadores.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nenhum aprovador disponível
                  </p>
                ) : (
                  usuariosAprovadores.map(user => (
                    <div key={user.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md">
                      <Checkbox
                        id={`aprovador-${user.id}`}
                        checked={aprovadoresSelecionados.includes(user.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setAprovadoresSelecionados([...aprovadoresSelecionados, user.id]);
                          } else {
                            setAprovadoresSelecionados(aprovadoresSelecionados.filter(id => id !== user.id));
                          }
                        }}
                      />
                      <label
                        htmlFor={`aprovador-${user.id}`}
                        className="flex-1 text-sm cursor-pointer"
                      >
                        <div className="font-medium">{user.full_name}</div>
                        <div className="text-gray-500 text-xs">{user.email}</div>
                      </label>
                    </div>
                  ))
                )}
              </div>
              {aprovadoresSelecionados.length > 0 && (
                <p className="text-xs text-gray-500 mt-2">
                  {aprovadoresSelecionados.length} aprovador(es) selecionado(s)
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDialogSolicitarAprovacao(false);
                setAprovadoresSelecionados([]);
              }}
              disabled={solicitandoAprovacao}
            >
              Enviar Depois
            </Button>
            <Button 
              onClick={solicitarAprovacaoPedido}
              disabled={solicitandoAprovacao || aprovadoresSelecionados.length === 0}
            >
              {solicitandoAprovacao ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <UserCheck className="size-4 mr-2" />
                  Solicitar Aprovação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ FLUXO RÁPIDO: Modal de Seleção de Fornecedor */}
      <Dialog open={modalFornecedor} onOpenChange={setModalFornecedor}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar Fornecedor</DialogTitle>
            <DialogDescription>
              Escolha o fornecedor para este pedido
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                value={buscaFornecedor}
                onChange={(e) => {
                  setBuscaFornecedor(e.target.value);
                  carregarFornecedores(e.target.value);
                }}
                placeholder="Buscar por nome ou CNPJ..."
                className="pl-10"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {fornecedoresDisponiveis.map((fornecedor) => (
                <Card
                  key={fornecedor.seq_fornecedor}
                  className="cursor-pointer hover:border-purple-500 transition-colors"
                  onClick={() => selecionarFornecedor(fornecedor)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{fornecedor.nome}</h3>
                        <p className="text-sm text-gray-500 truncate">CNPJ: {fornecedor.cnpj}</p>
                        {fornecedor.email && (
                          <p className="text-sm text-gray-500 mt-1 truncate">E-mail: {fornecedor.email}</p>
                        )}
                      </div>
                      <Button size="sm" className="gap-2 shrink-0">
                        <Plus className="size-4" />
                        Selecionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {fornecedoresDisponiveis.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="size-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum fornecedor encontrado</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}