import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  ArrowLeft,
  Loader2,
  CheckCircle,
  ShoppingCart,
  Package,
  Plus,
  Mail,
  X,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { FilterSelectItem } from '../../components/estoque/FilterSelectItem';
import { formatCodigoCentroCusto } from '../../utils/formatters';
import { NovoItemDialog } from '../../components/shared/NovoItemDialog';
import { useMemo } from 'react';
import { MOCK_FORNECEDORES } from '../../mocks/estoqueComprasMocks';

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
  seq_ordem_compra?: number;
  nro_ordem_compra?: string;
  ja_atendida?: boolean;
  status?: string;
}

interface ItemSolicitacao {
  item: string;
  qtde_item: number;
  qtde_a_comprar: number; // Nova coluna - quantidade que irá para ordem de compra
  seq_item_selecionado?: number; // Item real selecionado
  saldo_estoque?: number; // Saldo em estoque
}

interface SaldoEstoque {
  seq_item: number;
  codigo: string;
  descricao: string;
  saldo_total: number;
}

export default function ConverterSolicitacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  usePageTitle('Converter Solicitação de Compra');

  const [loading, setLoading] = useState(true);
  const [convertendo, setConvertendo] = useState(false);
  const [solicitacao, setSolicitacao] = useState<SolicitacaoCompra | null>(null);
  const [itens, setItens] = useState<ItemSolicitacao[]>([]);
  const [saldosEstoque, setSaldosEstoque] = useState<Map<number, number>>(new Map());

  // ✅ NOVO: Dialog de criação rápida de item
  const [mostrarNovoItemDialog, setMostrarNovoItemDialog] = useState(false);
  const [itemIndexAtual, setItemIndexAtual] = useState<number | null>(null);

  // ✅ FLUXO RÁPIDO - GERAÇÃO AUTOMÁTICA DE PEDIDO
  const [dialogPerguntaFornecedor, setDialogPerguntaFornecedor] = useState(false);
  const [dialogPreenchimentoValores, setDialogPreenchimentoValores] = useState(false);
  const [dialogSolicitarAprovacao, setDialogSolicitarAprovacao] = useState(false);
  const [ordemGerada, setOrdemGerada] = useState<any>(null);
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<any | null>(null); // ✅ Objeto fornecedor completo
  const [modalFornecedor, setModalFornecedor] = useState(false); // ✅ Modal de busca
  const [buscaFornecedor, setBuscaFornecedor] = useState(''); // ✅ Busca
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState<any[]>([]); // ✅ Lista
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

  useEffect(() => {
    if (id) {
      carregarSolicitacao();
    }
  }, [id]);

  const carregarSolicitacao = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const mockSolicitacao: SolicitacaoCompra = {
          seq_solicitacao_compra: parseInt(id || '1'),
          unidade: 'MTZ',
          data_inclusao: '2026-02-28',
          hora_inclusao: '10:30:00',
          login_inclusao: 'joao',
          seq_centro_custo: 1,
          centro_custo_nro: '1',
          centro_custo_descricao: 'ADMINISTRATIVO',
          centro_custo_unidade: 'MTZ',
          nro_setor: 1,
          setor_descricao: 'COMPRAS',
          observacao: 'MATERIAL DE ESCRITÓRIO URGENTE',
        };

        const mockItens: ItemSolicitacao[] = [
          { item: 'CANETA AZUL', qtde_item: 100, qtde_a_comprar: 0 },
          { item: 'PAPEL A4', qtde_item: 10, qtde_a_comprar: 0 },
          { item: 'GRAMPEADOR', qtde_item: 5, qtde_a_comprar: 0 },
        ];

        setSolicitacao(mockSolicitacao);
        setItens(mockItens);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra_converter.php?seq_solicitacao_compra=${id}`,
          { method: 'GET' }
        );

        if (data.success) {
          setSolicitacao(data.solicitacao);
          setItens(data.itens || []);
          
          // Verificar se já foi atendida
          if (data.solicitacao?.ja_atendida || data.solicitacao?.status === 'A') {
            toast.warning('Esta solicitação já foi atendida e convertida em ordem de compra');
          }
        } else {
          toast.error('Solicitação não encontrada');
          navigate('/compras/solicitacoes-compra/converter');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar solicitação:', error);
      toast.error('Erro ao carregar solicitação');
      navigate('/compras/solicitacoes-compra/converter');
    } finally {
      setLoading(false);
    }
  };

  const selecionarItem = async (index: number, seqItem: string) => {
    if (!seqItem) {
      // Limpar seleção
      const novosItens = [...itens];
      novosItens[index].seq_item_selecionado = undefined;
      novosItens[index].saldo_estoque = undefined;
      setItens(novosItens);
      return;
    }

    const seqItemNum = parseInt(seqItem);

    // Atualizar item selecionado
    const novosItens = [...itens];
    novosItens[index].seq_item_selecionado = seqItemNum;
    setItens(novosItens);

    // Buscar saldo do estoque
    await buscarSaldoEstoque(seqItemNum, index);
  };

  const buscarSaldoEstoque = async (seqItem: number, index: number) => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - simular saldo
        await new Promise(resolve => setTimeout(resolve, 300));
        const saldoMock = Math.floor(Math.random() * 200);
        
        const novosItens = [...itens];
        novosItens[index].saldo_estoque = saldoMock;
        
        // Sugerir quantidade a comprar: qtde_item - saldo (mínimo 0)
        const qtdeSugerida = Math.max(0, novosItens[index].qtde_item - saldoMock);
        novosItens[index].qtde_a_comprar = qtdeSugerida;
        
        setItens(novosItens);

        setSaldosEstoque(prev => new Map(prev).set(seqItem, saldoMock));
      } else {
        // BACKEND
        const unidade = solicitacao?.unidade || user?.unidade_atual || user?.unidade || 'MTZ';
        
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/saldo_item.php?seq_item=${seqItem}&unidade=${unidade}`,
          { method: 'GET' }
        );

        if (data.success) {
          const saldo = data.saldo || 0;
          
          const novosItens = [...itens];
          novosItens[index].saldo_estoque = saldo;
          
          // Sugerir quantidade a comprar: qtde_item - saldo (mínimo 0)
          const qtdeSugerida = Math.max(0, novosItens[index].qtde_item - saldo);
          novosItens[index].qtde_a_comprar = qtdeSugerida;
          
          setItens(novosItens);

          setSaldosEstoque(prev => new Map(prev).set(seqItem, saldo));
        }
      }
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
    }
  };

  const converterEmOrdemCompra = async () => {
    // Verificar se já foi atendida
    if (solicitacao?.ja_atendida || solicitacao?.status === 'A') {
      toast.error('Esta solicitação já foi atendida e não pode ser convertida novamente');
      return;
    }
    
    // Validar que todos os itens foram traduzidos
    const itensNaoTraduzidos = itens.filter(item => !item.seq_item_selecionado);
    
    if (itensNaoTraduzidos.length > 0) {
      toast.error('Selecione um item real para cada descrição');
      return;
    }

    if (!solicitacao) return;

    // Filtrar itens com quantidade a comprar > 0
    const itensComprar = itens.filter(item => item.qtde_a_comprar > 0);

    try {
      setConvertendo(true);

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (itensComprar.length > 0) {
          // ✅ FLUXO RÁPIDO: Criar ordem mock e navegar para lista
          const nroOrdemMock = Math.floor(Math.random() * 1000) + 100; // Número entre 100-1099
          const ordemMock = {
            seq_ordem_compra: Date.now(),
            nro_ordem_compra: nroOrdemMock,
            unidade: solicitacao.unidade,
            seq_centro_custo: solicitacao.seq_centro_custo,
            aprovada: 'N',
            orcar: 'N'
          };
          
          // Preparar itens com valores zerados
          const itensParaPreenchimento = itensComprar.map(item => ({
            seq_item: item.seq_item_selecionado!,
            codigo: '', // Será buscado na tabela
            descricao: item.item,
            unidade_medida: '',
            qtde_item: item.qtde_a_comprar,
            vlr_unitario: 0
          }));
          
          // ✅ Navegar para ordens de compra e abrir dialog automaticamente
          console.log('🟢 MOCK - NAVEGANDO para ordens de compra com state:', {
            ordemRecemCriada: ordemMock,
            itensComValor: itensParaPreenchimento,
            abrirFluxoRapido: true
          });
          
          // ✅ CORREÇÃO: Resetar loading ANTES de navegar
          setConvertendo(false);
          
          navigate('/compras/ordens-compra', {
            state: {
              ordemRecemCriada: ordemMock,
              itensComValor: itensParaPreenchimento,
              abrirFluxoRapido: true
            }
          });
        } else {
          toast.success('Solicitação marcada como atendida (nenhum item para comprar)');
          setConvertendo(false);
          navigate('/compras/ordens-compra');
        }
      } else {
        // BACKEND
        const payload = {
          seq_solicitacao_compra: solicitacao.seq_solicitacao_compra,
          itens: itensComprar.map(item => ({
            seq_item: item.seq_item_selecionado,
            qtde_item: item.qtde_a_comprar,
          })),
        };

        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra_converter.php`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        console.log('🔍 [BACKEND] Resposta da conversão:', response);

        if (response.success) {
          // ✅ TEMPORÁRIO: Criar ordem mock para o fluxo rápido funcionar
          // (até que o backend retorne os dados completos)
          const nroOrdemMock = Math.floor(Math.random() * 1000) + 100;
          const ordemMock = {
            seq_ordem_compra: Date.now(),
            nro_ordem_compra: nroOrdemMock,
            unidade: solicitacao.unidade,
            seq_centro_custo: solicitacao.seq_centro_custo,
            aprovada: 'N',
            orcar: 'N'
          };
          
          // Preparar itens com valores zerados
          const itensParaPreenchimento = itensComprar.map(item => ({
            seq_item: item.seq_item_selecionado!,
            codigo: '',
            descricao: item.item,
            unidade_medida: '',
            qtde_item: item.qtde_a_comprar,
            vlr_unitario: 0
          }));
          
          console.log('🟢 BACKEND - NAVEGANDO para ordens de compra com state:', {
            ordemRecemCriada: ordemMock,
            itensComValor: itensParaPreenchimento,
            abrirFluxoRapido: true
          });
          
          setConvertendo(false);
          
          navigate('/compras/ordens-compra', {
            state: {
              ordemRecemCriada: ordemMock,
              itensComValor: itensParaPreenchimento,
              abrirFluxoRapido: true
            }
          });
        } else {
          setConvertendo(false);
        }
      }
    } catch (error) {
      console.error('Erro ao converter solicitação:', error);
      setConvertendo(false);
    }
  };

  const getSaldoBadgeColor = (saldo: number | undefined, qtdeSolicitada: number) => {
    if (saldo === undefined) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    
    if (saldo >= qtdeSolicitada) {
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    } else if (saldo > 0) {
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    } else {
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    }
  };

  const alterarQuantidadeComprar = (index: number, valor: string) => {
    const novosItens = [...itens];
    const quantidade = parseInt(valor) || 0;
    novosItens[index].qtde_a_comprar = quantidade >= 0 ? quantidade : 0;
    setItens(novosItens);
  };

  // ✅ FLUXO RÁPIDO: Prosseguir sem fornecedor
  const prosseguirSemFornecedor = () => {
    setDialogPerguntaFornecedor(false);
    toast.info('Ordem de compra criada. Prossiga com o fluxo normal de orçamento.');
    navigate('/compras/ordens-compra');
  };

  // ✅ FLUXO RÁPIDO: Carregar fornecedores
  const carregarFornecedores = async (search = '') => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const filtrados = MOCK_FORNECEDORES.filter(f => 
          f.nome.toLowerCase().includes(search.toLowerCase()) ||
          f.cnpj.includes(search)
        );
        setFornecedoresDisponiveis(filtrados);
      } else {
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
    console.log('🔵 [GERAR PEDIDO] INICIANDO');
    console.log('🔵 [GERAR PEDIDO] ordemGerada:', ordemGerada);
    console.log('🔵 [GERAR PEDIDO] seq_ordem_compra:', ordemGerada?.seq_ordem_compra);
    console.log('🔵 [GERAR PEDIDO] fornecedorSelecionado:', fornecedorSelecionado);
    
    if (!fornecedorSelecionado) {
      toast.error('Selecione um fornecedor');
      return;
    }

    const itensSemValor = itensComValor.filter(item => item.vlr_unitario <= 0);
    if (itensSemValor.length > 0) {
      toast.error('Informe valores para todos os itens');
      return;
    }

    if (!ordemGerada) {
      toast.error('Erro: ordem não encontrada');
      return;
    }

    if (!ordemGerada.seq_ordem_compra || ordemGerada.seq_ordem_compra <= 0) {
      console.error('❌ seq_ordem_compra INVÁLIDO:', ordemGerada);
      toast.error('Erro: ID da ordem de compra inválido');
      return;
    }

    console.log('✅ seq_ordem_compra válido:', ordemGerada.seq_ordem_compra);

    try {
      setGerandoPedido(true);

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1500));

        const novoPedido = {
          seq_pedido_compra: Date.now(),
          nro_pedido_compra: `PC-2026-${String(Date.now()).slice(-3)}`,
          unidade: ordemGerada.unidade,
          seq_fornecedor: fornecedorSelecionado.seq_fornecedor,
          seq_centro_custo: ordemGerada.seq_centro_custo, // ✅ CORREÇÃO: Centro de custo obrigatório
          vlr_total: calcularTotalPedido,
          status_aprovacao: 'A',
          itens: itensComValor
        };

        setPedidoGerado(novoPedido);
        setDialogPreenchimentoValores(false);
        setDialogSolicitarAprovacao(true);
        toast.success('Pedido gerado com sucesso!');
      } else {
        console.log('🟢 [BACKEND] Aprovando ordem:', ordemGerada.seq_ordem_compra);
        
        // BACKEND - Aprovar ordem
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_ordem_compra: ordemGerada.seq_ordem_compra,
            aprovar: true,
            orcar: 'N'
          })
        });
        
        console.log('✅ [BACKEND] Ordem aprovada');

        // BACKEND - Criar pedido
        const payloadPedido = {
          seq_ordem_compra: ordemGerada.seq_ordem_compra,
          seq_fornecedor: fornecedorSelecionado.seq_fornecedor,
          seq_centro_custo: ordemGerada.seq_centro_custo, // ✅ CORREÇÃO: Centro de custo obrigatório
          status_aprovacao: 'A',
          itens: itensComValor.map(item => ({
            seq_item: item.seq_item,
            qtde_item: item.qtde_item,
            vlr_unitario: item.vlr_unitario
          }))
        };

        const responsePedido = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php`, {
          method: 'POST',
          body: JSON.stringify(payloadPedido)
        });

        if (responsePedido.success && responsePedido.data) {
          setPedidoGerado(responsePedido.data);
          setDialogPreenchimentoValores(false);
          setDialogSolicitarAprovacao(true);
          toast.success('Pedido gerado com sucesso!');
        }
      }
    } catch (error) {
      console.error('Erro ao gerar pedido:', error);
      toast.error('Erro ao gerar pedido');
    } finally {
      setGerandoPedido(false);
    }
  };

  // ✅ FLUXO RÁPIDO: Solicitar aprovação
  const solicitarAprovacaoPedido = async () => {
    if (!pedidoGerado) {
      toast.error('Erro: pedido não encontrado');
      return;
    }

    try {
      setSolicitandoAprovacao(true);

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Solicitação de aprovação enviada com sucesso!');
        setDialogSolicitarAprovacao(false);
        navigate('/compras/ordens-compra');
      } else {
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/pedidos_solicitar_aprovacao.php`, {
          method: 'POST',
          body: JSON.stringify({
            seq_pedido_compra: pedidoGerado.seq_pedido_compra
          })
        });

        toast.success('Solicitação de aprovação enviada com sucesso!');
        setDialogSolicitarAprovacao(false);
        navigate('/compras/ordens-compra');
      }
    } catch (error) {
      console.error('Erro ao solicitar aprovação:', error);
      toast.error('Erro ao solicitar aprovação');
    } finally {
      setSolicitandoAprovacao(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="CONVERTER SOLICITAÇÃO" description="Carregando...">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
      </AdminLayout>
    );
  }

  if (!solicitacao) {
    return (
      <AdminLayout title="CONVERTER SOLICITAÇÃO" description="Solicitação não encontrada">
        <div className="text-center py-12">
          <p className="text-gray-500">Solicitação não encontrada</p>
          <Button onClick={() => navigate('/compras/solicitacoes-compra/converter')} className="mt-4">
            Voltar
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="CONVERTER SOLICITAÇÃO DE COMPRA"
      description={`Solicitação ${solicitacao.unidade}${String(solicitacao.seq_solicitacao_compra).padStart(6, '0')}`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Botão Voltar */}
        <Button
          variant="outline"
          onClick={() => navigate('/compras/solicitacoes-compra/converter')}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Voltar para Lista
        </Button>

        {/* Card de Informações da Solicitação */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ShoppingCart className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Informações da Solicitação</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Solicitação {solicitacao.unidade}{String(solicitacao.seq_solicitacao_compra).padStart(6, '0')}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-sm text-gray-500">Data:</Label>
                <p className="font-medium">
                  {new Date(solicitacao.data_inclusao).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Solicitante:</Label>
                <p className="font-medium uppercase">{solicitacao.login_inclusao}</p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Unidade:</Label>
                <p className="font-medium">{solicitacao.unidade}</p>
              </div>

              <div className="md:col-span-2">
                <Label className="text-sm text-gray-500">Centro de Custo:</Label>
                <p className="font-medium">
                  {formatCodigoCentroCusto(
                    solicitacao.centro_custo_unidade || '',
                    solicitacao.centro_custo_nro || ''
                  )} - {solicitacao.centro_custo_descricao}
                </p>
              </div>

              <div>
                <Label className="text-sm text-gray-500">Setor:</Label>
                <p className="font-medium">{solicitacao.setor_descricao || '-'}</p>
              </div>

              {/* ✅ Placa do Veículo - SEMPRE EXIBIR */}
              <div>
                <Label className="text-sm text-gray-500">Placa do Veículo:</Label>
                <p className="font-medium font-mono">
                  {solicitacao.placa || '-'}
                </p>
              </div>

              {solicitacao.observacao && (
                <div className="md:col-span-3">
                  <Label className="text-sm text-gray-500">Observação:</Label>
                  <p className="font-medium">{solicitacao.observacao}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card de Tradução de Itens */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <Package className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1">
                <CardTitle>Traduzir Itens Solicitados</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Selecione o item real correspondente a cada descrição
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Instruções */}
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Como proceder:</h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1.5">
                <li>• Selecione o <strong>item real</strong> correspondente a cada descrição solicitada</li>
                <li>• O sistema verificará o <strong>saldo em estoque</strong> automaticamente</li>
                <li>• A <strong>quantidade a comprar</strong> será sugerida (quantidade solicitada - saldo em estoque)</li>
                <li>• Você pode ajustar manualmente a quantidade a comprar para cada item</li>
                <li>• Itens com quantidade <strong>zerada não serão incluídos</strong> na ordem de compra</li>
                <li>• Se todos os itens ficarem zerados, a solicitação será marcada como <strong>atendida</strong> sem criar ordem de compra</li>
              </ul>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[30%]">Item Solicitado</TableHead>
                    <TableHead className="w-[10%] text-center">Quantidade</TableHead>
                    <TableHead className="w-[25%]">Item Real</TableHead>
                    <TableHead className="w-[10%] text-center">Saldo</TableHead>
                    <TableHead className="w-[15%] text-center">Qtd. a Comprar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itens.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{item.item}</TableCell>
                      <TableCell className="text-center font-medium">
                        {item.qtde_item}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <div className="flex-1">
                            <FilterSelectItem
                              value={item.seq_item_selecionado ? String(item.seq_item_selecionado) : ''}
                              onChange={(value) => selecionarItem(index, value)}
                              placeholder="Selecione o item..."
                              showAll={false}
                              compact={true}
                              hideLabel={true}
                            />
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              setItemIndexAtual(index);
                              setMostrarNovoItemDialog(true);
                            }}
                            title="Novo Item"
                            className="shrink-0"
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.seq_item_selecionado ? (
                          item.saldo_estoque !== undefined ? (
                            <Badge
                              className={getSaldoBadgeColor(item.saldo_estoque, item.qtde_item)}
                            >
                              {item.saldo_estoque.toLocaleString('pt-BR', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2,
                              })}
                            </Badge>
                          ) : (
                            <div className="flex justify-center">
                              <Loader2 className="size-4 animate-spin text-gray-400" />
                            </div>
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          value={item.qtde_a_comprar}
                          onChange={(e) => alterarQuantidadeComprar(index, e.target.value)}
                          className="w-24 text-center mx-auto"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Legenda de Saldos */}
            <div className="mt-4 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-green-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Saldo Suficiente</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-yellow-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Saldo Parcial</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="size-3 rounded-full bg-red-500"></div>
                <span className="text-gray-600 dark:text-gray-400">Sem Saldo</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão de Conversão */}
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/compras/solicitacoes-compra/converter')}
            disabled={convertendo}
          >
            Cancelar
          </Button>
          <Button
            onClick={converterEmOrdemCompra}
            disabled={convertendo || itens.some(i => !i.seq_item_selecionado)}
            className="gap-2"
          >
            {convertendo ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle className="size-4" />
                Confirmar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dialog de criação rápida de item */}
      <NovoItemDialog
        open={mostrarNovoItemDialog}
        onOpenChange={setMostrarNovoItemDialog}
        onItemCriado={(novoItem) => {
          if (itemIndexAtual !== null) {
            // Selecionar automaticamente o item recém-criado para a linha específica
            selecionarItem(itemIndexAtual, novoItem.seq_item.toString());
            toast.success('Item criado e selecionado com sucesso!');
          }
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
            <Button variant="outline" onClick={prosseguirSemFornecedor}>
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
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preencha os Valores dos Itens</DialogTitle>
            <DialogDescription>
              Informe o valor unitário para cada item da ordem de compra.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Descrição</TableHead>
                    <TableHead className="text-right min-w-[100px]">Quantidade</TableHead>
                    <TableHead className="text-right min-w-[150px]">Valor Unitário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensComValor.map((item) => (
                    <TableRow key={item.seq_item}>
                      <TableCell className="max-w-[200px] truncate" title={item.descricao}>{item.descricao}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {item.qtde_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.vlr_unitario || ''}
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

            <div className="flex justify-end pt-2 border-t">
              <div className="text-right">
                <p className="text-sm text-gray-500">Valor Total</p>
                <p className="text-2xl font-bold text-green-600">
                  R$ {calcularTotalPedido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogPreenchimentoValores(false)}
              disabled={gerandoPedido}
            >
              Cancelar
            </Button>
            <Button onClick={gerarPedidoRapido} disabled={gerandoPedido}>
              {gerandoPedido ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Package className="size-4 mr-2" />
                  Gerar Pedido
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ FLUXO RÁPIDO: Dialog de solicitação de aprovação */}
      <Dialog open={dialogSolicitarAprovacao} onOpenChange={setDialogSolicitarAprovacao}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-6 text-green-600" />
              Pedido Gerado com Sucesso!
            </DialogTitle>
            <DialogDescription>
              O pedido foi criado automaticamente e está pendente de aprovação.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {pedidoGerado && (
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-4 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-sm text-gray-500">Número do Pedido:</p>
                    <p className="font-semibold font-mono text-lg">{pedidoGerado.nro_pedido_compra}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Valor Total:</p>
                    <p className="font-semibold text-lg text-green-600">
                      R$ {calcularTotalPedido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-md border border-border max-h-60 overflow-y-auto overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Item</TableHead>
                    <TableHead className="text-right min-w-[100px]">Qtde</TableHead>
                    <TableHead className="text-right min-w-[100px]">Vlr. Unit.</TableHead>
                    <TableHead className="text-right min-w-[100px]">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensComValor.map((item) => (
                    <TableRow key={item.seq_item}>
                      <TableCell className="max-w-[180px] truncate" title={item.descricao}>{item.descricao}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {item.qtde_item.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        R$ {item.vlr_unitario.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right font-medium whitespace-nowrap">
                        R$ {(item.qtde_item * item.vlr_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogSolicitarAprovacao(false)}
              disabled={solicitandoAprovacao}
            >
              Fechar
            </Button>
            <Button onClick={solicitarAprovacaoPedido} disabled={solicitandoAprovacao}>
              {solicitandoAprovacao ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="size-4 mr-2" />
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
                  <ShoppingCart className="size-4 mx-auto mb-4 opacity-50" />
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