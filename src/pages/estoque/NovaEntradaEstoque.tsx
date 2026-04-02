import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
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
  TableFooter,
} from '../../components/ui/table';
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
  Save,
  ArrowLeft,
  Package,
  PackagePlus,
  ShoppingCart,
  Barcode,
  FileText,
  Warehouse,
  MapPin,
  BarChart3,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Search
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { FilterSelectEstoque } from '../../components/shared/FilterSelectEstoque';
import { lerChaveNFe, validarChaveNFe, formatarCNPJ } from '../../utils/nfeUtils';
import {
  MOCK_ESTOQUES,
  MOCK_ITENS,
  MOCK_POSICOES,
  MOCK_PEDIDOS,
  MOCK_PEDIDO_ITENS
} from '../../utils/estoqueModData';
import { MOCK_FORNECEDORES } from '../../mocks/estoqueComprasMocks';

interface Estoque {
  seq_estoque: number;
  descricao: string;
  unidade: string;
}

interface Item {
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  vlr_item: number;
}

interface Posicao {
  seq_posicao: number;
  seq_estoque: number;
  seq_item: number | null;
  rua: string;
  altura: string;
  coluna: string;
  saldo: number;
  localizacao?: string;
  ativa: 'S' | 'N';
}

interface ItemEntrada {
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_pedida: number; // Quantidade no pedido (se via pedido)
  qtde_recebida: number; // Quantidade efetivamente recebida
  seq_posicao: number | null;
  posicao_descricao: string;
  vlr_unitario: number;
  vlr_total: number;
  divergente: boolean; // Indica se há divergência entre pedido e recebimento
}

interface Fornecedor {
  seq_fornecedor: number;
  cnpj: string;
  nome: string;
}

interface Pedido {
  seq_pedido: number;
  unidade: string;
  nro_pedido: string;
  seq_fornecedor: number;
  seq_orcamento?: number | null;
  fornecedor_nome: string;
  status?: string;
  vlr_total: number;
  qtd_itens?: number;
  qtd_total_itens?: number;
  tipo_pedido?: string;
  inclusao_info?: string;
  data_inclusao?: string;
  hora_inclusao?: string;
  login_inclusao?: string;
}

export default function NovaEntradaEstoque() {
  usePageTitle('Nova Entrada no Estoque');

  const navigate = useNavigate();
  const { user } = useAuth();

  // Tipo de entrada
  const [tipoEntrada, setTipoEntrada] = useState<'MANUAL' | 'PEDIDO'>('PEDIDO');

  // Estados principais
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [observacao, setObservacao] = useState('');

  // Estoque selecionado
  const [estoqueSelecionado, setEstoqueSelecionado] = useState<Estoque | null>(null);
  const [estoques, setEstoques] = useState<Estoque[]>([]);

  // Dados da NF-e (para entrada via pedido)
  const [chaveNfe, setChaveNfe] = useState('');
  const [fornecedorNfe, setFornecedorNfe] = useState<Fornecedor | null>(null);
  const [serieNfe, setSerieNfe] = useState('');
  const [numeroNfe, setNumeroNfe] = useState('');
  const [cnpjNfe, setCnpjNfe] = useState('');

  // Pedido selecionado (para entrada via pedido)
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null);
  const [pedidosDisponiveis, setPedidosDisponiveis] = useState<Pedido[]>([]); // NOVO: Lista de pedidos para escolha
  const [etapaEntradaPedido, setEtapaEntradaPedido] = useState<'NFE' | 'PEDIDO' | 'SELECAO_PEDIDO' | 'CONFERENCIA'>('NFE');

  // Itens da entrada
  const [itensEntrada, setItensEntrada] = useState<ItemEntrada[]>([]);

  // Modal de seleção de item (entrada manual)
  const [modalItem, setModalItem] = useState(false);
  const [itensDisponiveis, setItensDisponiveis] = useState<Item[]>([]);
  const [buscaItem, setBuscaItem] = useState('');

  // Modal de seleção de fornecedor
  const [modalFornecedor, setModalFornecedor] = useState(false);
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState<Fornecedor[]>([]);
  const [buscaFornecedor, setBuscaFornecedor] = useState('');

  // Modal de seleção de posição
  const [modalPosicao, setModalPosicao] = useState(false);
  const [posicoesDisponiveis, setPosicoesDisponiveis] = useState<Posicao[]>([]);
  const [itemParaPosicao, setItemParaPosicao] = useState<number | null>(null);
  const [buscaPosicao, setBuscaPosicao] = useState('');

  // Modal de criar nova posição
  const [modalCriarPosicao, setModalCriarPosicao] = useState(false);
  const [novaPosicaoRua, setNovaPosicaoRua] = useState('');
  const [novaPosicaoAltura, setNovaPosicaoAltura] = useState('');
  const [novaPosicaoColuna, setNovaPosicaoColuna] = useState('');
  const [criandoPosicao, setCriandoPosicao] = useState(false);

  // Modal de confirmação de divergências
  const [modalDivergencias, setModalDivergencias] = useState(false);

  useEffect(() => {
    carregarEstoques();
  }, []);

  useEffect(() => {
    if (tipoEntrada === 'MANUAL') {
      carregarItens();
    }
  }, [tipoEntrada]);

  useEffect(() => {
    if (tipoEntrada === 'PEDIDO') {
      carregarFornecedores();
    }
  }, [tipoEntrada]);

  const carregarEstoques = async () => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        setEstoques(MOCK_ESTOQUES.filter(e => e.ativo === 'S'));
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php?ativo=S`,
          { method: 'GET' }
        );

        if (data.success) {
          setEstoques(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar estoques:', error);
    }
  };

  const carregarItens = async (search = '') => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        const filtrados = MOCK_ITENS.filter(i => 
          i.ativo === 'S' && (
            !search || 
            i.codigo.toLowerCase().includes(search.toLowerCase()) ||
            i.descricao.toLowerCase().includes(search.toLowerCase())
          )
        );
        setItensDisponiveis(filtrados);
      } else {
        // BACKEND - Buscar no servidor com filtro
        let url = `${ENVIRONMENT.apiBaseUrl}/estoque/itens.php?ativo=S`;
        if (search && search.trim() !== '') {
          url += `&search=${encodeURIComponent(search)}`;
        }
        
        const data = await apiFetch(url, { method: 'GET' });

        if (data.success) {
          setItensDisponiveis(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    }
  };

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
        // BACKEND - Buscar no servidor com filtro
        let url = `${ENVIRONMENT.apiBaseUrl}/estoque/fornecedores.php`;
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

  const processarChaveNFe = () => {
    if (!validarChaveNFe(chaveNfe)) {
      toast.error('Chave NF-e inválida! Deve conter 44 dígitos.');
      return;
    }

    const dados = lerChaveNFe(chaveNfe);
    
    if (!dados.valido) {
      toast.error(dados.erro || 'Erro ao processar chave NF-e');
      return;
    }

    // Atualizar os campos com os dados da NF-e
    setCnpjNfe(dados.cnpjFormatado);
    setSerieNfe(dados.serie);
    setNumeroNfe(dados.numero);

    // Buscar fornecedor pelo CNPJ
    buscarFornecedorPorCNPJ(dados.cnpj);

    toast.success('Chave NF-e processada com sucesso!');
  };

  const buscarFornecedorPorCNPJ = async (cnpj: string) => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Simular busca de fornecedor
        const fornecedorEncontrado = MOCK_FORNECEDORES.find(f => 
          f.cnpj.replace(/\D/g, '') === cnpj.replace(/\D/g, '')
        );

        if (fornecedorEncontrado) {
          setFornecedorNfe(fornecedorEncontrado);
          setEtapaEntradaPedido('PEDIDO');
        } else {
          toast.error('Fornecedor não encontrado no cadastro. Por favor, cadastre o fornecedor primeiro.');
        }
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/fornecedores.php?cnpj=${cnpj}`,
          { method: 'GET' }
        );

        if (data.success && data.data) {
          setFornecedorNfe(data.data);
          setEtapaEntradaPedido('PEDIDO');
        } else {
          toast.error('Fornecedor não encontrado no cadastro.');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar fornecedor:', error);
    }
  };

  const buscarPedido = async () => {
    // VALIDAÇÃO #4: Não pode buscar pedido sem estoque selecionado
    if (!estoqueSelecionado) {
      toast.error('Selecione um estoque primeiro!');
      return;
    }
    
    if (!fornecedorNfe) {
      toast.error('Selecione um fornecedor');
      return;
    }

    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Buscar TODOS os pedidos ENTREGUES do fornecedor
        await new Promise(resolve => setTimeout(resolve, 500));
        
        console.log('🔍 Buscando pedidos para fornecedor:', fornecedorNfe);
        console.log('📦 Todos os pedidos MOCK:', MOCK_PEDIDOS);
        
        const pedidosEncontrados = MOCK_PEDIDOS.filter(
          p => p.seq_fornecedor === fornecedorNfe.seq_fornecedor && 
               p.status === 'ENTREGUE'
        );
        
        console.log('✅ Pedidos ENTREGUES encontrados:', pedidosEncontrados);
        
        if (pedidosEncontrados.length > 0) {
          // CORREÇÃO #2 e #3: Armazenar TODOS os pedidos e NÃO carregar itens automaticamente
          const pedidosFormatados = pedidosEncontrados.map(p => {
            // Calcular dados extras do mock
            const itensDoPedido = MOCK_PEDIDO_ITENS.filter(item => item.seq_pedido === p.seq_pedido);
            const qtd_itens = itensDoPedido.length;
            const qtd_total_itens = itensDoPedido.reduce((sum, item) => sum + item.qtde_item, 0);
            const tipo_pedido = p.seq_orcamento ? 'ORÇAMENTO' : 'MANUAL';
            
            // Formatar data/hora de inclusão
            const dataFormatada = p.data_inclusao ? new Date(p.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit'
            }) : '';
            const horaFormatada = p.hora_inclusao ? p.hora_inclusao.substring(0, 5) : '';
            const inclusao_info = `${dataFormatada} ${horaFormatada} ${p.login_inclusao || ''}`.trim();
            
            // Formatar nro_pedido com unidade
            const nroPedidoFormatado = `${p.unidade}${p.nro_pedido.toString().padStart(6, '0')}`;
            
            return {
              seq_pedido: p.seq_pedido,
              unidade: p.unidade,
              nro_pedido: nroPedidoFormatado,
              seq_fornecedor: p.seq_fornecedor,
              seq_orcamento: p.seq_orcamento,
              fornecedor_nome: fornecedorNfe.nome,
              status: p.status,
              vlr_total: p.vlr_total,
              qtd_itens,
              qtd_total_itens,
              tipo_pedido,
              inclusao_info
            };
          });
          
          setPedidosDisponiveis(pedidosFormatados);
          setEtapaEntradaPedido('SELECAO_PEDIDO');
          toast.success(`${pedidosEncontrados.length} pedido(s) encontrado(s)! Selecione um para conferir.`);
        } else {
          toast.error('Nenhum pedido entregue encontrado para este fornecedor.');
        }
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/entrada_estoque.php?action=buscar-pedidos&seq_fornecedor=${fornecedorNfe.seq_fornecedor}`,
          { method: 'GET' }
        );

        if (data.success && data.data && data.data.length > 0) {
          setPedidosDisponiveis(data.data);
          setEtapaEntradaPedido('SELECAO_PEDIDO');
          toast.success(`${data.data.length} pedido(s) encontrado(s)! Selecione um para conferir.`);
        } else {
          toast.error('Nenhum pedido encontrado para este fornecedor.');
        }
      }
    } catch (error) {
      console.error('Erro ao buscar pedido:', error);
    } finally {
      setLoading(false);
    }
  };

  // NOVA FUNÇÃO #3: Selecionar pedido específico
  const selecionarPedidoParaEntrada = async (pedido: Pedido) => {
    setPedidoSelecionado(pedido);
    setLoading(true);
    try {
      await carregarItensPedido(pedido.seq_pedido);
      setEtapaEntradaPedido('CONFERENCIA');
      toast.success(`Pedido ${pedido.nro_pedido} carregado com sucesso!`);
    } catch (error) {
      console.error('Erro ao carregar itens do pedido:', error);
      toast.error('Erro ao carregar itens do pedido');
    } finally {
      setLoading(false);
    }
  };

  const carregarItensPedido = async (seq_pedido: number) => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const itensPedido = MOCK_PEDIDO_ITENS
          .filter(i => i.seq_pedido === seq_pedido)
          .map(item => {
            const itemInfo = MOCK_ITENS.find(it => it.seq_item === item.seq_item);
            
            return {
              seq_item: item.seq_item,
              codigo: itemInfo?.codigo || '',
              descricao: itemInfo?.descricao || '',
              unidade_medida: itemInfo?.unidade_medida_sigla || '',
              qtde_pedida: item.qtde_item,
              qtde_recebida: item.qtde_item, // Inicialmente igual ao pedido
              seq_posicao: null,
              posicao_descricao: '',
              vlr_unitario: item.vlr_unitario,
              vlr_total: item.vlr_total,
              divergente: false
            };
          });

        setItensEntrada(itensPedido);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/entrada_estoque.php?action=itens-pedido&seq_pedido=${seq_pedido}`,
          { method: 'GET' }
        );

        if (data.success) {
          setItensEntrada(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar itens do pedido:', error);
    }
  };

  const carregarPosicoes = async (seq_item: number) => {
    if (!estoqueSelecionado) {
      toast.error('Selecione um estoque primeiro');
      return;
    }

    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const posicoesFiltradas = MOCK_POSICOES
          .filter(p => 
            p.seq_estoque === estoqueSelecionado.seq_estoque &&
            (p.seq_item === seq_item || p.seq_item === null) &&
            p.ativa === 'S'
          )
          .map(p => ({
            ...p,
            localizacao: `RUA ${p.rua} - ALT ${p.altura} - COL ${p.coluna}`
          }));

        setPosicoesDisponiveis(posicoesFiltradas);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php?seq_estoque=${estoqueSelecionado.seq_estoque}&seq_item=${seq_item}&ativa=S`,
          { method: 'GET' }
        );

        if (data.success) {
          // Formatar a localização para cada posição
          const posicoesFormatadas = (data.data || []).map((p: any) => ({
            ...p,
            localizacao: `RUA ${p.rua} - ALT ${p.altura} - COL ${p.coluna}`
          }));
          setPosicoesDisponiveis(posicoesFormatadas);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar posições:', error);
    }
  };

  const adicionarItem = (item: Item) => {
    if (!estoqueSelecionado) {
      toast.error('Selecione um estoque primeiro');
      return;
    }

    if (itensEntrada.find(i => i.seq_item === item.seq_item)) {
      toast.error('Item já adicionado');
      return;
    }

    const novoItem: ItemEntrada = {
      seq_item: item.seq_item,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade_medida: item.unidade_medida,
      qtde_pedida: 0,
      qtde_recebida: 0,
      seq_posicao: null,
      posicao_descricao: '',
      vlr_unitario: item.vlr_item,
      vlr_total: 0,
      divergente: false
    };

    setItensEntrada([...itensEntrada, novoItem]);
    setModalItem(false);
    setBuscaItem('');
    toast.success('Item adicionado');
  };

  const removerItem = (seq_item: number) => {
    setItensEntrada(itensEntrada.filter(i => i.seq_item !== seq_item));
    toast.success('Item removido');
  };

  const atualizarQuantidadeRecebida = (seq_item: number, qtde: string) => {
    const quantidade = parseFloat(qtde.replace(',', '.')) || 0;
    
    setItensEntrada(itensEntrada.map(item => {
      if (item.seq_item === seq_item) {
        const vlr_total = quantidade * item.vlr_unitario;
        const divergente = tipoEntrada === 'PEDIDO' && quantidade !== item.qtde_pedida;
        return { ...item, qtde_recebida: quantidade, vlr_total, divergente };
      }
      return item;
    }));
  };

  const atualizarValorUnitario = (seq_item: number, valor: string) => {
    const vlrUnitario = parseFloat(valor.replace(',', '.')) || 0;
    
    setItensEntrada(itensEntrada.map(item => {
      if (item.seq_item === seq_item) {
        const vlr_total = item.qtde_recebida * vlrUnitario;
        return { ...item, vlr_unitario: vlrUnitario, vlr_total };
      }
      return item;
    }));
  };

  const abrirModalPosicao = (seq_item: number) => {
    setItemParaPosicao(seq_item);
    carregarPosicoes(seq_item);
    setModalPosicao(true);
  };

  const selecionarPosicao = (posicao: Posicao) => {
    if (itemParaPosicao === null) return;

    setItensEntrada(itensEntrada.map(item => {
      if (item.seq_item === itemParaPosicao) {
        return {
          ...item,
          seq_posicao: posicao.seq_posicao,
          posicao_descricao: posicao.localizacao || ''
        };
      }
      return item;
    }));

    setModalPosicao(false);
    setBuscaPosicao('');
    setItemParaPosicao(null);
    toast.success('Posição selecionada');
  };

  const abrirModalCriarPosicao = () => {
    setNovaPosicaoRua('');
    setNovaPosicaoAltura('');
    setNovaPosicaoColuna('');
    setModalCriarPosicao(true);
  };

  const criarNovaPosicao = async () => {
    if (!estoqueSelecionado) {
      toast.error('Estoque não selecionado');
      return;
    }

    if (!itemParaPosicao) {
      toast.error('Item não selecionado');
      return;
    }

    if (!novaPosicaoRua || !novaPosicaoAltura || !novaPosicaoColuna) {
      toast.error('Preencha todos os campos da posição');
      return;
    }

    setCriandoPosicao(true);
    try {
      const data = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php`,
        {
          method: 'POST',
          body: JSON.stringify({
            seq_estoque: estoqueSelecionado.seq_estoque,
            rua: novaPosicaoRua.toUpperCase(),
            altura: novaPosicaoAltura.toUpperCase(),
            coluna: novaPosicaoColuna.toUpperCase(),
            seq_item: itemParaPosicao,
            ativa: 'S'
          })
        }
      );

      if (data.success && data.seq_posicao) {
        const novaPosicao: Posicao = {
          seq_posicao: parseInt(data.seq_posicao),
          seq_estoque: estoqueSelecionado.seq_estoque,
          rua: novaPosicaoRua.toUpperCase(),
          altura: novaPosicaoAltura.toUpperCase(),
          coluna: novaPosicaoColuna.toUpperCase(),
          seq_item: itemParaPosicao,
          saldo: 0,
          localizacao: `RUA ${novaPosicaoRua.toUpperCase()} - ALT ${novaPosicaoAltura.toUpperCase()} - COL ${novaPosicaoColuna.toUpperCase()}`,
          ativa: 'S'
        };

        // Selecionar a nova posição
        selecionarPosicao(novaPosicao);
        setModalCriarPosicao(false);
        toast.success('Posição criada e selecionada com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao criar posição:', error);
      toast.error('Erro ao criar posição');
    } finally {
      setCriandoPosicao(false);
    }
  };

  const calcularTotalGeral = (): number => {
    return itensEntrada.reduce((sum, item) => sum + item.vlr_total, 0);
  };

  // ========================================
  // CÁLCULOS DE TOTAIS
  // ========================================
  
  const calcularTotais = () => {
    const totalQtdePedida = itensEntrada.reduce((sum, item) => sum + (item.qtde_pedida || 0), 0);
    const totalQtdeRecebida = itensEntrada.reduce((sum, item) => sum + item.qtde_recebida, 0);
    const totalValor = itensEntrada.reduce((sum, item) => sum + item.vlr_total, 0);
    
    return {
      totalQtdePedida,
      totalQtdeRecebida,
      totalValor,
      totalItens: itensEntrada.length
    };
  };

  const verificarDivergencias = (): boolean => {
    return itensEntrada.some(item => item.divergente);
  };

  const salvarEntrada = async () => {
    // Validações
    if (!estoqueSelecionado) {
      toast.error('Selecione um estoque');
      return;
    }

    if (tipoEntrada === 'PEDIDO' && !pedidoSelecionado) {
      toast.error('Selecione um pedido');
      return;
    }

    if (itensEntrada.length === 0) {
      toast.error('Adicione pelo menos um item');
      return;
    }

    const itemSemQuantidade = itensEntrada.find(item => item.qtde_recebida <= 0);
    if (itemSemQuantidade) {
      toast.error(`Item "${itemSemQuantidade.descricao}" não possui quantidade recebida informada`);
      return;
    }

    const itemSemPosicao = itensEntrada.find(item => !item.seq_posicao);
    if (itemSemPosicao) {
      toast.error(`Item "${itemSemPosicao.descricao}" não possui posição informada`);
      return;
    }

    // Verificar divergências entre pedido e recebimento
    if (tipoEntrada === 'PEDIDO' && verificarDivergencias()) {
      const itensDivergentes = itensEntrada.filter(item => item.divergente);
      const totalDivergencias = itensDivergentes.length;
      
      toast.warning(
        `${totalDivergencias} ${totalDivergencias === 1 ? 'item possui' : 'itens possuem'} quantidade diferente do pedido. Revise antes de confirmar.`,
        { duration: 5000 }
      );
      
      setModalDivergencias(true);
      return;
    }

    await confirmarSalvamento();
  };

  const confirmarSalvamento = async () => {
    setModalDivergencias(false);
    setSalvando(true);
    
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Entrada no estoque realizada com sucesso!');
        
        setTimeout(() => {
          navigate('/estoque/entrada');
        }, 500);
      } else {
        // BACKEND
        const payload = {
          tipo_entrada: tipoEntrada,
          seq_estoque: estoqueSelecionado.seq_estoque,
          seq_pedido: tipoEntrada === 'PEDIDO' ? pedidoSelecionado?.seq_pedido : null,
          seq_fornecedor: fornecedorNfe?.seq_fornecedor || null,
          ser_nf: serieNfe || null,
          nro_nf: numeroNfe || null,
          chave_nfe: chaveNfe || null,
          observacao: observacao.toUpperCase(),
          itens: itensEntrada.map(item => ({
            seq_item: item.seq_item,
            seq_posicao: item.seq_posicao,
            qtde_pedida: item.qtde_pedida,
            qtde_recebida: item.qtde_recebida,
            vlr_unitario: item.vlr_unitario,
            vlr_total: item.vlr_total
          }))
        };

        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/entrada_estoque.php`,
          {
            method: 'POST',
            body: JSON.stringify(payload)
          }
        );

        console.log('✅ Resposta da API após salvar entrada:', data);

        // ✅ NAVEGAÇÃO IMEDIATA APÓS SUCESSO
        // Navega se data.success === true (confirmado pelo PHP msg())
        if (data && data.success === true) {
          console.log('✅ Entrada salva com sucesso! Navegando para /estoque/entrada...');
          navigate('/estoque/entrada');
        } else if (!data || data.success === undefined) {
          // Se não houver data.success, assume sucesso (fallback)
          console.log('⚠️ Resposta sem success explícito, navegando por segurança...');
          navigate('/estoque/entrada');
        } else {
          console.error('❌ Erro ao salvar entrada:', data);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar entrada:', error);
    } finally {
      setSalvando(false);
    }
  };

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // ✅ Debounce na busca de itens - chama API a cada digitação
  useEffect(() => {
    const timer = setTimeout(() => {
      if (modalItem) {
        carregarItens(buscaItem);
      }
    }, 500); // 500ms de debounce

    return () => clearTimeout(timer);
  }, [buscaItem, modalItem]);

  // Recarregar itens ao abrir modal
  useEffect(() => {
    if (modalItem) {
      carregarItens(buscaItem);
    }
  }, [modalItem]);

  const posicoesFiltradas = posicoesDisponiveis.filter(posicao =>
    posicao.localizacao?.toLowerCase().includes(buscaPosicao.toLowerCase()) ||
    posicao.rua.toLowerCase().includes(buscaPosicao.toLowerCase()) ||
    posicao.altura.toLowerCase().includes(buscaPosicao.toLowerCase()) ||
    posicao.coluna.toLowerCase().includes(buscaPosicao.toLowerCase())
  );

  // ✅ Debounce na busca de fornecedores - chama API a cada digitação
  useEffect(() => {
    const timer = setTimeout(() => {
      if (modalFornecedor) {
        carregarFornecedores(buscaFornecedor);
      }
    }, 500); // 500ms de debounce

    return () => clearTimeout(timer);
  }, [buscaFornecedor, modalFornecedor]);

  // Recarregar fornecedores ao abrir modal
  useEffect(() => {
    if (modalFornecedor) {
      carregarFornecedores(buscaFornecedor);
    }
  }, [modalFornecedor]);

  const totalGeral = calcularTotalGeral();
  const itensDivergentes = itensEntrada.filter(i => i.divergente);

  // CONDIÇÃO CRÍTICA: Exibe seção de itens
  const exibirSecaoItens = (tipoEntrada === 'MANUAL' && estoqueSelecionado !== null) || 
                           (tipoEntrada === 'PEDIDO' && etapaEntradaPedido === 'CONFERENCIA' && pedidoSelecionado !== null);

  console.log('🔍 DEBUG NovaEntradaEstoque:', {
    tipoEntrada,
    estoqueSelecionado,
    exibirSecaoItens,
    etapaEntradaPedido,
    pedidoSelecionado,
    fornecedorNfe,
    pedidosDisponiveis
  });

  return (
    <AdminLayout
      title="NOVA ENTRADA NO ESTOQUE"
      description="Registre uma nova entrada no estoque"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Botão Voltar */}
        <Button variant="outline" onClick={() => navigate('/estoque/entrada')} className="gap-2">
          <ArrowLeft className="size-4" />
          Voltar para Entradas
        </Button>

        {/* Tipo de Entrada */}
        <Card>
          <CardHeader>
            <CardTitle>Tipo de Entrada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-all border-2 ${
                  tipoEntrada === 'MANUAL'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => {
                  setTipoEntrada('MANUAL');
                  setPedidoSelecionado(null);
                  setPedidosDisponiveis([]);
                  setItensEntrada([]);
                  setChaveNfe('');
                  setFornecedorNfe(null);
                  setSerieNfe('');
                  setNumeroNfe('');
                  setEtapaEntradaPedido('NFE');
                }}
              >
                <CardContent className="pt-6 text-center">
                  <PackagePlus className="size-12 mx-auto mb-3 text-blue-600" />
                  <h3 className="font-bold text-lg mb-1">Entrada Manual</h3>
                  <p className="text-sm text-gray-500">
                    Informe itens e quantidades manualmente
                  </p>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all border-2 ${
                  tipoEntrada === 'PEDIDO'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                    : 'hover:border-gray-300'
                }`}
                onClick={() => {
                  setTipoEntrada('PEDIDO');
                  setItensEntrada([]);
                }}
              >
                <CardContent className="pt-6 text-center">
                  <ShoppingCart className="size-12 mx-auto mb-3 text-green-600" />
                  <h3 className="font-bold text-lg mb-1">Receber Pedido</h3>
                  <p className="text-sm text-gray-500">
                    Receba itens de um pedido de compras
                  </p>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Dados Gerais */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Warehouse className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle>Dados Gerais</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Informações básicas da entrada
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estoque de Destino */}
            <FilterSelectEstoque
              value={estoqueSelecionado?.seq_estoque.toString() || ''}
              onChange={async (value) => {
                console.log('🔔 onChange chamado com value:', value);
                if (value && value !== 'ALL') {
                  const seq = parseInt(value);
                  
                  // 🔥 BUSCAR ESTOQUE DO BACKEND DIRETO!
                  try {
                    if (ENVIRONMENT.isFigmaMake) {
                      const estoque = MOCK_ESTOQUES.find(est => est.seq_estoque === seq);
                      console.log('📦 Estoque MOCK encontrado:', estoque);
                      setEstoqueSelecionado(estoque || null);
                    } else {
                      // BUSCAR DO BACKEND
                      const data = await apiFetch(
                        `${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php`,
                        { method: 'GET' }
                      );
                      
                      if (data.success && data.data) {
                        // 🔥 BACKEND RETORNA seq_estoque como STRING! Converter para comparar
                        const estoque = data.data.find((e: any) => parseInt(e.seq_estoque) === seq);
                        console.log('📦 Estoque BACKEND encontrado:', estoque);
                        setEstoqueSelecionado(estoque || null);
                      }
                    }
                  } catch (error) {
                    console.error('Erro ao buscar estoque:', error);
                  }
                  
                  // BUG FIX #5: Limpar itens ao mudar estoque
                  setItensEntrada([]);
                  setPedidoSelecionado(null);
                  setPedidosDisponiveis([]);
                  setEtapaEntradaPedido('NFE');
                  
                  // Scroll suave para a seção de itens após selecionar estoque (entrada manual)
                  if (tipoEntrada === 'MANUAL') {
                    setTimeout(() => {
                      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                    }, 100);
                  }
                } else {
                  setEstoqueSelecionado(null);
                  setItensEntrada([]);
                }
              }}
              showAll={false}
              apenasAtivos={true}
              label="Estoque de Destino"
              placeholder="Selecione o estoque..."
              disabled={salvando || (tipoEntrada === 'PEDIDO' && etapaEntradaPedido !== 'NFE')}
            />

            {/* Observação */}
            <div className="grid gap-2">
              <Label htmlFor="observacao">Observação</Label>
              <Textarea
                id="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value.toUpperCase())}
                placeholder="OBSERVAÇÕES SOBRE A ENTRADA..."
                rows={3}
                disabled={salvando}
              />
            </div>

            {/* 🆕 ALERTA: Próximo passo para entrada manual */}
            {tipoEntrada === 'MANUAL' && !estoqueSelecionado && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <PackagePlus className="size-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-1">
                      Próximo Passo
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Selecione o <strong>Estoque de Destino</strong> acima para começar a adicionar itens à entrada.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Entrada via Pedido - Leitura NF-e */}
        {tipoEntrada === 'PEDIDO' && etapaEntradaPedido === 'NFE' && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Barcode className="size-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle>Leitura da Nota Fiscal Eletrônica</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Informe a chave da NF-e (44 dígitos) ou os dados manualmente
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="chave-nfe">Chave NF-e (44 dígitos)</Label>
                <div className="flex gap-2">
                  <Input
                    id="chave-nfe"
                    type="text"
                    value={chaveNfe}
                    onChange={(e) => setChaveNfe(e.target.value.replace(/\D/g, ''))}
                    placeholder="00000000000000000000000000000000000000000000"
                    maxLength={44}
                    className="font-mono"
                  />
                  <Button onClick={processarChaveNFe} className="gap-2" disabled={chaveNfe.length !== 44}>
                    <Barcode className="size-4" />
                    Processar
                  </Button>
                </div>
                {chaveNfe && chaveNfe.length !== 44 && (
                  <p className="text-sm text-red-600 mt-1">
                    A chave deve ter exatamente 44 dígitos. Atual: {chaveNfe.length}
                  </p>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Ou informe os dados manualmente:</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fornecedor-manual">Fornecedor</Label>
                    <div className="flex gap-2">
                      <Input
                        id="fornecedor-manual"
                        type="text"
                        value={fornecedorNfe?.nome || ''}
                        placeholder="Clique para selecionar"
                        readOnly
                        className="cursor-pointer"
                        onClick={() => setModalFornecedor(true)}
                      />
                      <Button 
                        variant="outline" 
                        onClick={() => setModalFornecedor(true)}
                        className="gap-2"
                      >
                        <Search className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="serie-nfe">Série</Label>
                    <Input
                      id="serie-nfe"
                      type="text"
                      value={serieNfe}
                      onChange={(e) => setSerieNfe(e.target.value)}
                      placeholder="1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="numero-nfe">Número</Label>
                    <Input
                      id="numero-nfe"
                      type="text"
                      value={numeroNfe}
                      onChange={(e) => setNumeroNfe(e.target.value)}
                      placeholder="12345"
                    />
                  </div>
                </div>
                <Button 
                  className="mt-4" 
                  onClick={() => {
                    // VALIDAÇÃO #4: Não pode continuar sem estoque
                    if (!estoqueSelecionado) {
                      toast.error('Selecione um estoque primeiro!');
                      return;
                    }
                    if (fornecedorNfe && serieNfe && numeroNfe) {
                      setEtapaEntradaPedido('PEDIDO');
                    } else {
                      toast.error('Informe o fornecedor, série e número da NF-e');
                    }
                  }}
                  disabled={!fornecedorNfe || !serieNfe || !numeroNfe || !estoqueSelecionado}
                >
                  Continuar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Entrada via Pedido - Buscar Pedido */}
        {tipoEntrada === 'PEDIDO' && etapaEntradaPedido === 'PEDIDO' && fornecedorNfe && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <FileText className="size-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle>Dados da NF-e Confirmados</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Confira os dados extraídos da nota fiscal
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600 font-medium">Fornecedor</p>
                  <p className="font-bold">{fornecedorNfe.nome}</p>
                  <p className="text-sm text-gray-500">{fornecedorNfe.cnpj}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Série NF-e</p>
                  <p className="font-bold text-lg">{serieNfe}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 font-medium">Número NF-e</p>
                  <p className="font-bold text-lg">{numeroNfe}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={buscarPedido} className="gap-2" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="size-4" />
                      Buscar Pedido
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setEtapaEntradaPedido('NFE')}>
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* NOVO: Seleção de Pedido (CORREÇÃO #2 e #3) */}
        {tipoEntrada === 'PEDIDO' && etapaEntradaPedido === 'SELECAO_PEDIDO' && pedidosDisponiveis.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ShoppingCart className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Selecione o Pedido para Entrada</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    {pedidosDisponiveis.length} pedido(s) encontrado(s) para o fornecedor {fornecedorNfe?.nome}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {pedidosDisponiveis.map((pedido) => (
                <Card
                  key={pedido.seq_pedido}
                  className="cursor-pointer hover:border-blue-500 hover:shadow-md transition-all border-2"
                  onClick={() => selecionarPedidoParaEntrada(pedido)}
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center">
                      {/* Coluna 1: Ícone */}
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                        <ShoppingCart className="size-6 text-blue-600 dark:text-blue-400" />
                      </div>

                      {/* Coluna 2: Informações do pedido (grid interno com colunas alinhadas) */}
                      <div className="grid grid-cols-[180px_100px_1px_120px_1px_150px] gap-3 items-center">
                        {/* Pedido + Tipo */}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-lg">{pedido.nro_pedido}</span>
                            {pedido.tipo_pedido && (
                              <Badge variant={pedido.tipo_pedido === 'ORÇAMENTO' ? 'default' : 'secondary'} className="text-xs">
                                {pedido.tipo_pedido}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {pedido.inclusao_info || 'Sem info'}
                          </p>
                        </div>

                        {/* Itens */}
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Itens</p>
                          <p className="font-bold text-base">{pedido.qtd_itens || 0}</p>
                        </div>

                        {/* Separador 1 */}
                        <div className="h-10 w-px bg-gray-300 dark:bg-gray-600"></div>

                        {/* Qtd Total */}
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Qtd Total</p>
                          <p className="font-semibold text-base">
                            {pedido.qtd_total_itens ? formatarValor(pedido.qtd_total_itens) : '0'}
                          </p>
                        </div>

                        {/* Separador 2 */}
                        <div className="h-10 w-px bg-gray-300 dark:bg-gray-600"></div>

                        {/* Valor Total */}
                        <div className="text-center">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Valor Total</p>
                          <p className="text-base font-bold text-green-600 dark:text-green-400">
                            R$ {formatarValor(pedido.vlr_total)}
                          </p>
                        </div>
                      </div>

                      {/* Coluna 3: Botão */}
                      <Button size="sm" className="gap-2">
                        <CheckCircle className="size-4" />
                        Selecionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <div className="flex gap-2 pt-4">
                <Button variant="outline" onClick={() => setEtapaEntradaPedido('PEDIDO')}>
                  Voltar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Itens da Entrada - SEÇÃO CRÍTICA */}
        {exibirSecaoItens && (
          <>
            {/* Info do Pedido (se entrada via pedido) */}
            {tipoEntrada === 'PEDIDO' && pedidoSelecionado && (
              <Card className="border-2 border-green-500">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{pedidoSelecionado.nro_pedido}</h3>
                      <p className="text-sm text-gray-500">
                        Fornecedor: {pedidoSelecionado.fornecedor_nome}
                      </p>
                      <p className="text-sm text-gray-500">
                        NF-e: Série {serieNfe} / Nº {numeroNfe}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Valor Total</p>
                      <p className="text-2xl font-bold text-green-600">
                        R$ {formatarValor(pedidoSelecionado.vlr_total)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tabela de Itens */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <Package className="size-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle>
                        {tipoEntrada === 'PEDIDO' ? 'Conferência de Itens' : 'Itens da Entrada'}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        {tipoEntrada === 'PEDIDO' 
                          ? 'Confira as quantidades recebidas'
                          : 'Adicione os itens que estão entrando no estoque'}
                      </p>
                    </div>
                  </div>
                  {tipoEntrada === 'MANUAL' && (
                    <Button onClick={() => setModalItem(true)} className="gap-2">
                      <Plus className="size-4" />
                      Adicionar Item
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {itensEntrada.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="size-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum item adicionado</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Alerta de Divergências */}
                    {tipoEntrada === 'PEDIDO' && itensDivergentes.length > 0 && (
                      <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/20 p-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="size-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                              Atenção: Divergências Detectadas
                            </h4>
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              {itensDivergentes.length} {itensDivergentes.length === 1 ? 'item possui' : 'itens possuem'} quantidade recebida diferente da quantidade pedida.
                              Revise os valores destacados na tabela antes de finalizar.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Código</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-center">Unid.</TableHead>
                            {tipoEntrada === 'PEDIDO' && (
                              <TableHead className="text-right">Qtd. Pedida</TableHead>
                            )}
                            <TableHead className="text-right">Qtd. Recebida</TableHead>
                            <TableHead className="text-right">Vlr. Unit. (R$)</TableHead>
                            <TableHead className="text-right">Vlr. Total (R$)</TableHead>
                            <TableHead>Posição</TableHead>
                            {tipoEntrada === 'MANUAL' && (
                              <TableHead className="text-center">Ações</TableHead>
                            )}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {itensEntrada.map((item, index) => (
                            <TableRow 
                              key={item.seq_item} 
                              className={`${index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''} ${item.divergente ? 'bg-yellow-50 dark:bg-yellow-950/20' : ''}`}
                            >
                              <TableCell className="font-mono font-semibold">
                                {item.divergente && (
                                  <AlertTriangle className="size-4 text-yellow-600 inline mr-2" />
                                )}
                                {item.codigo}
                              </TableCell>
                              <TableCell className="font-medium">{item.descricao}</TableCell>
                              <TableCell className="text-center">{item.unidade_medida}</TableCell>
                              {tipoEntrada === 'PEDIDO' && (
                                <TableCell className="text-right font-medium">
                                  {item.qtde_pedida.toFixed(2)}
                                </TableCell>
                              )}
                              <TableCell>
                                <div className="flex justify-end">
                                  <Input
                                    type="number"
                                    step="any"
                                    value={item.qtde_recebida || ''}
                                    onChange={(e) => atualizarQuantidadeRecebida(item.seq_item, e.target.value)}
                                    className={`w-24 text-right ${item.divergente ? 'border-yellow-500' : ''}`}
                                    placeholder="0,00"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end">
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={item.vlr_unitario || ''}
                                    onChange={(e) => atualizarValorUnitario(item.seq_item, e.target.value)}
                                    className="w-28 text-right"
                                    placeholder="0,00"
                                    disabled={tipoEntrada === 'PEDIDO'}
                                  />
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-bold text-green-600">
                                {formatarValor(item.vlr_total)}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant={item.posicao_descricao ? "default" : "outline"}
                                  onClick={() => abrirModalPosicao(item.seq_item)}
                                  className="gap-1"
                                >
                                  <MapPin className="size-3" />
                                  {item.posicao_descricao || 'Selecionar'}
                                </Button>
                              </TableCell>
                              {tipoEntrada === 'MANUAL' && (
                                <TableCell className="text-center">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => removerItem(item.seq_item)}
                                    title="Remover"
                                  >
                                    <Trash2 className="size-4 text-red-600" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell colSpan={2} className="font-bold">
                              TOTAIS ({calcularTotais().totalItens} {calcularTotais().totalItens === 1 ? 'item' : 'itens'})
                              {itensDivergentes.length > 0 && (
                                <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 border-yellow-400">
                                  <AlertTriangle className="size-3 mr-1" />
                                  {itensDivergentes.length} divergente(s)
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-center font-bold">-</TableCell>
                            {tipoEntrada === 'PEDIDO' && (
                              <TableCell className="text-right font-bold">
                                {calcularTotais().totalQtdePedida.toFixed(2)}
                              </TableCell>
                            )}
                            <TableCell className="text-right font-bold">
                              {calcularTotais().totalQtdeRecebida.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-bold">-</TableCell>
                            <TableCell className="text-right font-bold text-green-600 dark:text-green-400 text-lg">
                              R$ {formatarValor(calcularTotais().totalValor)}
                            </TableCell>
                            <TableCell className="font-bold">-</TableCell>
                            {tipoEntrada === 'MANUAL' && (
                              <TableCell className="text-center font-bold">-</TableCell>
                            )}
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Botões de Ação */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={() => navigate('/estoque/entrada')}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button
                onClick={salvarEntrada}
                disabled={salvando || !estoqueSelecionado || itensEntrada.length === 0}
                className="gap-2"
              >
                {salvando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    Confirmar Entrada
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {/* Modal de Seleção de Item */}
        <Dialog open={modalItem} onOpenChange={setModalItem}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Selecionar Item</DialogTitle>
              <DialogDescription>
                Escolha o item para adicionar à entrada
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  value={buscaItem}
                  onChange={(e) => setBuscaItem(e.target.value)}
                  placeholder="Buscar por código ou descrição..."
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {itensDisponiveis.map((item) => (
                  <Card
                    key={item.seq_item}
                    className="cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => adicionarItem(item)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold">{item.codigo}</span>
                            <span className="font-medium">{item.descricao}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span>Unid: {item.unidade_medida}</span>
                            <span>Valor: R$ {formatarValor(item.vlr_item)}</span>
                          </div>
                        </div>
                        <Button size="sm" className="gap-2">
                          <Plus className="size-4" />
                          Adicionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {itensDisponiveis.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="size-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum item encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Seleção de Posição */}
        <Dialog open={modalPosicao} onOpenChange={setModalPosicao}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Selecionar Posição no Estoque</DialogTitle>
              <DialogDescription>
                Escolha a posição onde o item será armazenado
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                  <Input
                    value={buscaPosicao}
                    onChange={(e) => setBuscaPosicao(e.target.value)}
                    placeholder="Buscar por localização..."
                    className="pl-10"
                  />
                </div>
                <Button onClick={abrirModalCriarPosicao} className="gap-2">
                  <Plus className="size-4" />
                  Nova Posição
                </Button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {posicoesFiltradas.map((posicao) => (
                  <Card
                    key={posicao.seq_posicao}
                    className="cursor-pointer hover:border-purple-500 transition-colors"
                    onClick={() => selecionarPosicao(posicao)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <MapPin className="size-5 text-purple-600" />
                            <span className="font-bold text-lg">{posicao.localizacao}</span>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            Saldo atual: {posicao.saldo.toFixed(2)}
                            {posicao.seq_item && ' (Posição já contém este item)'}
                          </div>
                        </div>
                        <Button size="sm" className="gap-2">
                          <Plus className="size-4" />
                          Selecionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {posicoesFiltradas.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="size-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma posição disponível</p>
                    <Button onClick={abrirModalCriarPosicao} className="mt-4 gap-2">
                      <Plus className="size-4" />
                      Criar Nova Posição
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Criar Nova Posição */}
        <Dialog open={modalCriarPosicao} onOpenChange={setModalCriarPosicao}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Posição</DialogTitle>
              <DialogDescription>
                Cadastre uma nova posição no estoque {estoqueSelecionado?.descricao}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="nova-rua">Rua</Label>
                  <Input
                    id="nova-rua"
                    value={novaPosicaoRua}
                    onChange={(e) => setNovaPosicaoRua(e.target.value.toUpperCase())}
                    placeholder="A"
                    disabled={criandoPosicao}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nova-altura">Altura</Label>
                  <Input
                    id="nova-altura"
                    value={novaPosicaoAltura}
                    onChange={(e) => setNovaPosicaoAltura(e.target.value.toUpperCase())}
                    placeholder="1"
                    disabled={criandoPosicao}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nova-coluna">Coluna</Label>
                  <Input
                    id="nova-coluna"
                    value={novaPosicaoColuna}
                    onChange={(e) => setNovaPosicaoColuna(e.target.value.toUpperCase())}
                    placeholder="01"
                    disabled={criandoPosicao}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setModalCriarPosicao(false)}
                  disabled={criandoPosicao}
                >
                  Cancelar
                </Button>
                <Button onClick={criarNovaPosicao} disabled={criandoPosicao} className="gap-2">
                  {criandoPosicao ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Criar e Selecionar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Confirmação de Divergências */}
        <Dialog open={modalDivergencias} onOpenChange={setModalDivergencias}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-6 text-yellow-600" />
                Divergências Encontradas
              </DialogTitle>
              <DialogDescription>
                As quantidades recebidas divergem do pedido. Confira os itens abaixo:
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 p-4">
                <h4 className="font-medium mb-3">Itens com Divergência:</h4>
                <div className="space-y-2">
                  {itensDivergentes.map((item) => (
                    <div key={item.seq_item} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded">
                      <div>
                        <p className="font-medium">{item.descricao}</p>
                        <p className="text-sm text-gray-500">Código: {item.codigo}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">
                          <span className="text-gray-600">Pedido:</span>{' '}
                          <span className="font-medium">{item.qtde_pedida.toFixed(2)}</span>
                        </p>
                        <p className="text-sm">
                          <span className="text-gray-600">Recebido:</span>{' '}
                          <span className="font-medium text-yellow-700">{item.qtde_recebida.toFixed(2)}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => setModalDivergencias(false)}
                >
                  Revisar Quantidades
                </Button>
                <Button
                  onClick={confirmarSalvamento}
                  className="gap-2 bg-yellow-600 hover:bg-yellow-700"
                >
                  <CheckCircle className="size-4" />
                  Confirmar Mesmo Assim
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Seleção de Fornecedor */}
        <Dialog open={modalFornecedor} onOpenChange={setModalFornecedor}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Selecionar Fornecedor</DialogTitle>
              <DialogDescription>
                Escolha o fornecedor para a NF-e
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  value={buscaFornecedor}
                  onChange={(e) => setBuscaFornecedor(e.target.value)}
                  placeholder="Buscar por nome ou CNPJ..."
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {fornecedoresDisponiveis.map((fornecedor) => (
                  <Card
                    key={fornecedor.seq_fornecedor}
                    className="cursor-pointer hover:border-purple-500 transition-colors"
                    onClick={() => {
                      setFornecedorNfe(fornecedor);
                      setModalFornecedor(false);
                      setBuscaFornecedor('');
                    }}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold">{fornecedor.nome}</h3>
                          <p className="text-sm text-gray-500">CNPJ: {fornecedor.cnpj}</p>
                          {fornecedor.email && (
                            <p className="text-sm text-gray-500 mt-1">
                              {fornecedor.email}
                            </p>
                          )}
                        </div>
                        <Button size="sm" className="gap-2">
                          <Plus className="size-4" />
                          Adicionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {fornecedoresDisponiveis.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="size-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum fornecedor encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
