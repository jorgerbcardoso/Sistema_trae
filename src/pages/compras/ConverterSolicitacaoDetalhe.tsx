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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
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
  Eye,
  Clock,
  Printer,
  Calendar,
  User,
  Building,
} from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '../../components/ui/textarea';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { FilterSelectItem } from '../../components/estoque/FilterSelectItem';
import { formatCodigoCentroCusto, formatarNumeroSolicitacao } from '../../utils/formatters';
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

interface EstoqueOption {
  seq_estoque: number;
  descricao: string;
  unidade: string;
  nro_estoque: string;
  ativo?: string;
}

interface PosicaoOption {
  seq_posicao: number;
  seq_estoque: number;
  seq_item: number | null;
  rua: string;
  altura: string;
  coluna: string;
  saldo: number;
  localizacao?: string;
  ativa?: string;
}

interface AlocacaoSaida {
  seq_estoque: number;
  estoque_label: string;
  seq_posicao: number;
  posicao_label: string;
  saldo_posicao: number;
  quantidade: number;
}

export default function ConverterSolicitacaoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, clientConfig } = useAuth();

  usePageTitle('Converter Solicitação de Compra');

  const [loading, setLoading] = useState(true);
  const [convertendo, setConvertendo] = useState(false);
  const [solicitacao, setSolicitacao] = useState<SolicitacaoCompra | null>(null);
  const [itens, setItens] = useState<ItemSolicitacao[]>([]);
  const [saldosEstoque, setSaldosEstoque] = useState<Map<number, number>>(new Map());

  const [estoquesSaida, setEstoquesSaida] = useState<EstoqueOption[]>([]);
  const [loadingEstoquesSaida, setLoadingEstoquesSaida] = useState(false);
  const [posicoesSaida, setPosicoesSaida] = useState<PosicaoOption[]>([]);
  const [loadingPosicoesSaida, setLoadingPosicoesSaida] = useState(false);
  const [modalSaidaOpen, setModalSaidaOpen] = useState(false);
  const [alocItemIndex, setAlocItemIndex] = useState<number | null>(null);
  const [alocSeqEstoque, setAlocSeqEstoque] = useState('');
  const [alocSeqPosicao, setAlocSeqPosicao] = useState('');
  const [alocQuantidade, setAlocQuantidade] = useState('');
  const [alocacoesByIndex, setAlocacoesByIndex] = useState<Record<number, AlocacaoSaida[]>>({});

  const [resumoOpen, setResumoOpen] = useState(false);
  const [resumoData, setResumoData] = useState<{
    seq_solicitacao_compra: number;
    nro_solicitacao_formatado: string;
    ordem?: { seq_ordem_compra: number; nro_ordem_compra?: string | number | null } | null;
    requisicoes: Array<{ seq_requisicao: number; seq_estoque: number; estoque_label: string }>;
    itens: Array<{
      descricao: string;
      qtde_solicitada: number;
      qtde_comprada: number;
      qtde_estoque: number;
      alocacoes: AlocacaoSaida[];
    }>;
  } | null>(null);

  // ✅ NOVO: Dialog de criação rápida de item
  const [mostrarNovoItemDialog, setMostrarNovoItemDialog] = useState(false);
  const [itemIndexAtual, setItemIndexAtual] = useState<number | null>(null);

  // ✅ Modal de Reprovação
  const [mostrarReprovarModal, setMostrarReprovarModal] = useState(false);
  const [motivoReprovacao, setMotivoReprovar] = useState('');
  const [reprovando, setReprovando] = useState(false);

  // ✅ Função para Reprovar
  const confirmarReprovacao = async () => {
    if (!motivoReprovacao.trim()) {
      toast.error('Informe o motivo da reprovação');
      return;
    }

    try {
      setReprovando(true);
      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'reprovar',
          seq_solicitacao_compra: solicitacao?.seq_solicitacao_compra,
          motivo: motivoReprovacao.toUpperCase()
        }),
      });

      if (data.success) {
        toast.success('Solicitação reprovada com sucesso!');
        setMostrarReprovarModal(false);
        setMotivoReprovar('');
        navigate('/compras/solicitacoes-compra/converter');
      }
    } catch (error) {
      console.error('Erro ao reprovar:', error);
    } finally {
      setReprovando(false);
    }
  };

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

  const alocItemAtual = useMemo(() => {
    if (alocItemIndex === null) return null;
    return itens[alocItemIndex] || null;
  }, [alocItemIndex, itens]);

  const alocacoesItemAtual = useMemo(() => {
    if (alocItemIndex === null) return [];
    return alocacoesByIndex[alocItemIndex] || [];
  }, [alocItemIndex, alocacoesByIndex]);

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
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/saldo_item.php?seq_item=${seqItem}&all_estoques=S`,
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

  const getQtdeEstoqueAlocada = (index: number) => {
    const alocs = alocacoesByIndex[index] || [];
    return alocs.reduce((acc, a) => acc + (Number(a.quantidade) || 0), 0);
  };

  const carregarEstoquesSaida = async () => {
    if (ENVIRONMENT.isFigmaMake) {
      setEstoquesSaida([
        { seq_estoque: 1, descricao: 'ESTOQUE MTZ', unidade: 'MTZ', nro_estoque: '1' },
        { seq_estoque: 2, descricao: 'ESTOQUE OFICINA', unidade: 'MTZ', nro_estoque: '2' },
      ]);
      return;
    }

    setLoadingEstoquesSaida(true);
    try {
      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php?ativo=S`, { method: 'GET' });
      if (data.success) {
        setEstoquesSaida((data.data || []).map((e: any) => ({
          seq_estoque: Number(e.seq_estoque),
          descricao: String(e.descricao || ''),
          unidade: String(e.unidade || ''),
          nro_estoque: String(e.nro_estoque || ''),
          ativo: e.ativo,
        })));
      }
    } catch (error) {
      console.error('Erro ao carregar estoques:', error);
    } finally {
      setLoadingEstoquesSaida(false);
    }
  };

  const carregarPosicoesSaida = async (seqEstoque: number, seqItem: number) => {
    if (ENVIRONMENT.isFigmaMake) {
      setPosicoesSaida([
        {
          seq_posicao: 101,
          seq_estoque: seqEstoque,
          seq_item: seqItem,
          rua: 'A',
          altura: '1',
          coluna: '1',
          saldo: 10,
          localizacao: 'RUA A - ALT 1 - COL 1',
          ativa: 'S',
        },
      ]);
      return;
    }

    setLoadingPosicoesSaida(true);
    try {
      const data = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php?seq_estoque=${seqEstoque}&seq_item=${seqItem}`,
        { method: 'GET' }
      );
      if (data.success) {
        const all = (data.data || []).map((p: any) => ({
          seq_posicao: Number(p.seq_posicao),
          seq_estoque: Number(p.seq_estoque),
          seq_item: p.seq_item === null || p.seq_item === undefined ? null : Number(p.seq_item),
          rua: String(p.rua || ''),
          altura: String(p.altura || ''),
          coluna: String(p.coluna || ''),
          saldo: Number(p.saldo || 0),
          localizacao: String(p.localizacao || `RUA ${String(p.rua || '').toUpperCase()} - ALT ${String(p.altura || '')} - COL ${String(p.coluna || '')}`),
          ativa: p.ativa,
        })) as PosicaoOption[];

        const filtradas = all
          .filter((p) => p.seq_item === seqItem && (p.ativa ?? 'S') === 'S' && (Number(p.saldo) || 0) > 0)
          .sort((a, b) => (Number(b.saldo) || 0) - (Number(a.saldo) || 0));

        setPosicoesSaida(filtradas);
      }
    } catch (error) {
      console.error('Erro ao carregar posições:', error);
    } finally {
      setLoadingPosicoesSaida(false);
    }
  };

  const abrirDialogSaida = async (index: number) => {
    const item = itens[index];
    if (!item?.seq_item_selecionado) {
      toast.error('Selecione o item real antes de usar estoque');
      return;
    }

    setAlocItemIndex(index);
    setAlocSeqEstoque('');
    setAlocSeqPosicao('');
    setAlocQuantidade('');
    setPosicoesSaida([]);

    if (estoquesSaida.length === 0 && !loadingEstoquesSaida) {
      await carregarEstoquesSaida();
    }

    setModalSaidaOpen(true);
  };

  const adicionarAlocacao = async () => {
    if (alocItemIndex === null) return;
    const item = itens[alocItemIndex];
    if (!item?.seq_item_selecionado) {
      toast.error('Selecione o item real');
      return;
    }

    const seqEstoque = parseInt(alocSeqEstoque);
    const seqPosicao = parseInt(alocSeqPosicao);
    const quantidade = parseFloat(alocQuantidade);

    if (!seqEstoque || !seqPosicao || !Number.isFinite(quantidade) || quantidade <= 0) {
      toast.error('Informe estoque, posição e quantidade');
      return;
    }

    const pos = posicoesSaida.find((p) => p.seq_posicao === seqPosicao);
    if (!pos) {
      toast.error('Posição inválida');
      return;
    }

    if (quantidade > (Number(pos.saldo) || 0)) {
      toast.error('Quantidade excede o saldo da posição');
      return;
    }

    const est = estoquesSaida.find((e) => e.seq_estoque === seqEstoque);
    const estoqueLabel = est ? `${est.unidade}${String(est.nro_estoque).padStart(2, '0')} - ${est.descricao}` : `Estoque ${seqEstoque}`;

    const nova: AlocacaoSaida = {
      seq_estoque: seqEstoque,
      estoque_label: estoqueLabel,
      seq_posicao: seqPosicao,
      posicao_label: pos.localizacao || `RUA ${pos.rua} - ALT ${pos.altura} - COL ${pos.coluna}`,
      saldo_posicao: Number(pos.saldo) || 0,
      quantidade,
    };

    setAlocacoesByIndex((prev) => {
      const next = { ...prev };
      const current = next[alocItemIndex] ? [...next[alocItemIndex]] : [];
      current.push(nova);
      next[alocItemIndex] = current;
      return next;
    });

    setAlocSeqPosicao('');
    setAlocQuantidade('');
  };

  const removerAlocacao = (index: number, idxAloc: number) => {
    setAlocacoesByIndex((prev) => {
      const next = { ...prev };
      const current = next[index] ? [...next[index]] : [];
      current.splice(idxAloc, 1);
      next[index] = current;
      return next;
    });
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

    // Validar cobertura: comprado + estoque >= solicitado
    for (let i = 0; i < itens.length; i++) {
      const it = itens[i];
      const qtdeComprada = Number(it.qtde_a_comprar) || 0;
      const qtdeEstoque = getQtdeEstoqueAlocada(i);
      if (qtdeComprada < 0) {
        toast.error(`Quantidade a comprar inválida para: ${it.item}`);
        return;
      }
      if (qtdeEstoque < 0) {
        toast.error(`Quantidade em estoque inválida para: ${it.item}`);
        return;
      }
      if (qtdeComprada + qtdeEstoque < (Number(it.qtde_item) || 0)) {
        toast.error(`A soma Comprada + Estoque deve ser >= Solicitada para: ${it.item}`);
        return;
      }
    }

    // Itens para comprar (ordem de compra)
    const itensComprar = itens.filter((item) => (Number(item.qtde_a_comprar) || 0) > 0);

    try {
      setConvertendo(true);

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1500));

        const requisicoesCriadas = Object.values(alocacoesByIndex).flat().length > 0 ? [{ seq_requisicao: 999, seq_estoque: 1, estoque_label: 'ESTOQUE (MOCK)' }] : [];
        const ordemMock = itensComprar.length > 0 ? { seq_ordem_compra: Date.now(), nro_ordem_compra: Math.floor(Math.random() * 1000) + 100 } : null;

        setResumoData({
          seq_solicitacao_compra: solicitacao.seq_solicitacao_compra,
          nro_solicitacao_formatado: formatarNumeroSolicitacao(solicitacao.unidade, solicitacao.seq_solicitacao_compra),
          ordem: ordemMock,
          requisicoes: requisicoesCriadas,
          itens: itens.map((it, idx) => ({
            descricao: it.item,
            qtde_solicitada: Number(it.qtde_item) || 0,
            qtde_comprada: Number(it.qtde_a_comprar) || 0,
            qtde_estoque: getQtdeEstoqueAlocada(idx),
            alocacoes: alocacoesByIndex[idx] || [],
          })),
        });
        setResumoOpen(true);
        setConvertendo(false);
      } else {
        // BACKEND
        const nroSolic = formatarNumeroSolicitacao(solicitacao.unidade, solicitacao.seq_solicitacao_compra);

        const requisicoesCriadas: Array<{ seq_requisicao: number; seq_estoque: number; estoque_label: string }> = [];
        const alocsAll = Object.entries(alocacoesByIndex).flatMap(([idx, alocs]) => (alocs || []).map((a) => ({ idx: Number(idx), a })));

        if (alocsAll.length > 0) {
          const porEstoque = new Map<number, { seq_estoque: number; estoque_label: string; itens: Array<{ seq_item: number; seq_posicao: number; quantidade: number }> }>();

          for (const entry of alocsAll) {
            const item = itens[entry.idx];
            if (!item?.seq_item_selecionado) {
              toast.error('Há alocações de estoque sem item real selecionado');
              setConvertendo(false);
              return;
            }

            const seqEstoque = entry.a.seq_estoque;
            const current = porEstoque.get(seqEstoque) || { seq_estoque: seqEstoque, estoque_label: entry.a.estoque_label, itens: [] };
            current.itens.push({
              seq_item: item.seq_item_selecionado,
              seq_posicao: entry.a.seq_posicao,
              quantidade: entry.a.quantidade,
            });
            porEstoque.set(seqEstoque, current);
          }

          for (const grp of porEstoque.values()) {
            const payloadReq = {
              seq_estoque: grp.seq_estoque,
              seq_cc: Number(solicitacao.seq_centro_custo),
              solicitante: String(solicitacao.login_inclusao || user?.username || 'SISTEMA').toUpperCase(),
              placa: solicitacao.placa ? String(solicitacao.placa).toUpperCase() : null,
              observacao: `SAÍDA AUTOMÁTICA - SOLICITAÇÃO ${nroSolic}`,
              itens: grp.itens,
            };

            const respReq = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/requisicoes.php`, {
              method: 'POST',
              body: JSON.stringify(payloadReq),
            });

            if (!respReq.success) {
              throw new Error(respReq.message || 'Erro ao criar requisição de saída');
            }

            const seqReq = Number(respReq.data?.seq_requisicao || respReq.seq_requisicao);
            requisicoesCriadas.push({ seq_requisicao: seqReq, seq_estoque: grp.seq_estoque, estoque_label: grp.estoque_label });
          }
        }

        const payloadOc = {
          seq_solicitacao_compra: solicitacao.seq_solicitacao_compra,
          itens: itensComprar.map((item) => ({
            seq_item: item.seq_item_selecionado,
            qtde_item: Number(item.qtde_a_comprar) || 0,
          })),
        };

        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra_converter.php`, {
          method: 'POST',
          body: JSON.stringify(payloadOc),
        });

        if (!response.success) {
          throw new Error(response.message || 'Erro ao converter solicitação');
        }

        const ordemCriada =
          response.data && response.data.seq_ordem_compra
            ? { seq_ordem_compra: parseInt(response.data.seq_ordem_compra), nro_ordem_compra: response.data.nro_ordem_compra || null }
            : null;

        setResumoData({
          seq_solicitacao_compra: solicitacao.seq_solicitacao_compra,
          nro_solicitacao_formatado: nroSolic,
          ordem: ordemCriada,
          requisicoes: requisicoesCriadas,
          itens: itens.map((it, idx) => ({
            descricao: it.item,
            qtde_solicitada: Number(it.qtde_item) || 0,
            qtde_comprada: Number(it.qtde_a_comprar) || 0,
            qtde_estoque: getQtdeEstoqueAlocada(idx),
            alocacoes: alocacoesByIndex[idx] || [],
          })),
        });
        setResumoOpen(true);
        toast.success('Processo concluído com sucesso!');
        setConvertendo(false);
      }
    } catch (error) {
      console.error('Erro ao converter solicitação:', error);
      toast.error('Erro ao processar: verifique saldos e tente novamente');
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

  // ✅ Função de Selecionar Fornecedor
  const selecionarFornecedor = (fornecedor: any) => {
    setFornecedorSelecionado(fornecedor);
    setModalFornecedor(false);
    setBuscaFornecedor('');
    toast.success('Fornecedor selecionado');
  };

  // ✅ Função de Impressão (Baseada no padrão de Solicitações)
  const imprimirSolicitacao = () => {
    if (!solicitacao) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    // ✅ PADRÃO OFICIAL: Logos com URLs absolutas para evitar quebra no print
    const logoUrl = user?.domain?.toUpperCase() === 'ACV' 
      ? 'https://webpresto.com.br/images/logos_clientes/aceville.png'
      : 'https://webpresto.com.br/images/logo_rel.png';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Solicitação ${formatarNumeroSolicitacao(solicitacao.unidade, solicitacao.seq_solicitacao_compra)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 15mm; font-size: 11pt; color: #000; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #2563eb; }
            .logo { max-width: 180px; max-height: 60px; object-fit: contain; }
            .header-info h1 { font-size: 16pt; color: #2563eb; margin-bottom: 3px; text-transform: uppercase; }
            .header-info p { font-size: 10pt; color: #666; }
            .documento-numero { font-size: 20pt; font-weight: bold; color: #1e40af; font-family: monospace; }
            .status-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 9pt; font-weight: bold; text-transform: uppercase; }
            .status-pendente { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
            .status-atendida { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
            .status-reprovada { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 11pt; font-weight: bold; color: #1e40af; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #e5e7eb; text-transform: uppercase; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
            .info-label { font-size: 8pt; color: #6b7280; font-weight: bold; text-transform: uppercase; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
            th { background-color: #1e40af; color: white; padding: 8px 10px; text-align: left; }
            td { border: 1px solid #e5e7eb; padding: 8px 10px; }
            .observacoes-box { background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 9pt; min-height: 60px; }
            .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 8pt; }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="display: flex; align-items: center; gap: 15px;">
              <img src="${logoUrl}" class="logo" />
              <div class="header-info">
                <h1>Solicitação de Compra</h1>
                <p>Sistema de Gestão</p>
              </div>
            </div>
            <div style="text-align: right;">
              <div class="documento-numero">${formatarNumeroSolicitacao(solicitacao.unidade, solicitacao.seq_solicitacao_compra)}</div>
              <div class="status-badge ${solicitacao.status === 'A' ? 'status-atendida' : solicitacao.status === 'R' ? 'status-reprovada' : 'status-pendente'}">
                ${solicitacao.status === 'A' ? 'APROVADA / ATENDIDA' : solicitacao.status === 'R' ? 'REPROVADA' : 'PENDENTE DE APROVAÇÃO'}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Informações Gerais</div>
            <div class="info-grid">
              <div>
                <div class="info-label">Data de Inclusão</div>
                <div>${new Date(solicitacao.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')} às ${solicitacao.hora_inclusao?.substring(0, 5)}</div>
              </div>
              <div>
                <div class="info-label">Usuário Solicitante</div>
                <div style="text-transform: uppercase;">${solicitacao.login_inclusao}</div>
              </div>
              <div>
                <div class="info-label">Centro de Custo</div>
                <div>${formatCodigoCentroCusto(solicitacao.centro_custo_unidade || '', solicitacao.centro_custo_nro || '')} - ${solicitacao.centro_custo_descricao}</div>
              </div>
              <div>
                <div class="info-label">Setor Responsável</div>
                <div>${solicitacao.setor_descricao || '-'}</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Itens da Solicitação</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 60px;">#</th>
                  <th>Descrição do Item</th>
                  <th style="width: 120px; text-align: right;">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                ${itens.map((item, index) => `
                  <tr>
                    <td>${index + 1}</td>
                    <td>${item.item}</td>
                    <td style="text-align: right;">${item.qtde_item}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Observações</div>
            <div class="observacoes-box">
              ${solicitacao.observacao || 'NENHUMA OBSERVAÇÃO INFORMADA.'}
            </div>
          </div>

          <div class="footer">
            Documento gerado em ${new Date().toLocaleString('pt-BR')} por ${user?.username?.toUpperCase()}<br/>
            © 2026 Sistema de Gestão Inteligente
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
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
        {/* Botões de Ação */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/compras/solicitacoes-compra/converter')}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            Voltar para Lista
          </Button>

          <Button
            variant="outline"
            onClick={imprimirSolicitacao}
            className="gap-2 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400"
          >
            <Printer className="size-4" />
            Imprimir Solicitação
          </Button>
        </div>

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
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-gray-500">
                      Solicitação {solicitacao.unidade}{String(solicitacao.seq_solicitacao_compra).padStart(6, '0')}
                    </p>
                    {solicitacao.status === 'A' ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Atendida
                      </Badge>
                    ) : solicitacao.status === 'R' ? (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        Reprovada
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                        Pendente
                      </Badge>
                    )}
                  </div>
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
                <li>• Defina a <strong>quantidade em estoque</strong> clicando no campo (escolha estoque, posição e quantidade)</li>
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
                    <TableHead className="w-[12%] text-center">Qtd. em Estoque</TableHead>
                    <TableHead className="w-[13%] text-center">Qtd. a Comprar</TableHead>
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
                          value={getQtdeEstoqueAlocada(index)}
                          readOnly
                          onClick={() => abrirDialogSaida(index)}
                          className="w-24 text-center mx-auto cursor-pointer"
                        />
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

        {/* Botões de Ação */}
        <div className="flex items-center justify-between border-t pt-6">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20"
              onClick={() => setMostrarReprovarModal(true)}
              disabled={convertendo || solicitacao?.status === 'A' || solicitacao?.status === 'R'}
            >
              <X className="size-4" />
              Reprovar
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={converterEmOrdemCompra}
              disabled={convertendo || solicitacao?.status === 'A' || solicitacao?.status === 'R' || itens.some(i => !i.seq_item_selecionado)}
              className="px-8 gap-2"
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
            
            <Button
              variant="outline"
              onClick={() => navigate('/compras/solicitacoes-compra/converter')}
              disabled={convertendo}
              className="px-8"
            >
              Voltar
            </Button>
          </div>
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

      <Dialog open={modalSaidaOpen} onOpenChange={setModalSaidaOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quantidade em Estoque</DialogTitle>
            <DialogDescription>
              Selecione o estoque, a posição de saída e a quantidade que será baixada do estoque.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Estoque de Saída</Label>
                <Select
                  value={alocSeqEstoque}
                  onValueChange={(value) => {
                    setAlocSeqEstoque(value);
                    setAlocSeqPosicao('');
                    setAlocQuantidade('');
                    setPosicoesSaida([]);

                    const seqEstoque = Number(value);
                    const seqItem = alocItemAtual?.seq_item_selecionado;
                    if (seqEstoque && seqItem) {
                      void carregarPosicoesSaida(seqEstoque, seqItem);
                    }
                  }}
                  disabled={loadingEstoquesSaida}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingEstoquesSaida ? 'Carregando...' : 'Selecione...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {estoquesSaida.map((e) => (
                      <SelectItem key={e.seq_estoque} value={String(e.seq_estoque)}>
                        {`${e.unidade}${String(e.nro_estoque).padStart(2, '0')} - ${e.descricao}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Posição de Saída</Label>
                <Select
                  value={alocSeqPosicao}
                  onValueChange={setAlocSeqPosicao}
                  disabled={!alocSeqEstoque || loadingPosicoesSaida}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingPosicoesSaida ? 'Carregando...' : 'Selecione...'} />
                  </SelectTrigger>
                  <SelectContent>
                    {posicoesSaida.map((p) => (
                      <SelectItem key={p.seq_posicao} value={String(p.seq_posicao)}>
                        {`${p.localizacao || `RUA ${p.rua} - ALT ${p.altura} - COL ${p.coluna}`} (${Number(p.saldo || 0).toLocaleString('pt-BR')})`}
                      </SelectItem>
                    ))}
                    {posicoesSaida.length === 0 && !loadingPosicoesSaida && (
                      <SelectItem value="__no_positions__" disabled>
                        Nenhuma posição com saldo
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantidade</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={alocQuantidade}
                    onChange={(e) => setAlocQuantidade(e.target.value)}
                    placeholder="0"
                  />
                  <Button
                    onClick={() => void adicionarAlocacao()}
                    disabled={!alocSeqEstoque || !alocSeqPosicao || !alocQuantidade}
                    className="shrink-0 gap-2"
                  >
                    <Plus className="size-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estoque</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alocacoesItemAtual.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Nenhuma alocação adicionada
                      </TableCell>
                    </TableRow>
                  ) : (
                    alocacoesItemAtual.map((a, idxAloc) => (
                      <TableRow key={`${a.seq_estoque}-${a.seq_posicao}-${idxAloc}`}>
                        <TableCell className="font-medium">{a.estoque_label}</TableCell>
                        <TableCell>{a.posicao_label}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(a.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => {
                              if (alocItemIndex === null) return;
                              removerAlocacao(alocItemIndex, idxAloc);
                            }}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="size-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {alocItemAtual ? (
                  <>
                    <span className="font-medium text-foreground">{alocItemAtual.item}</span>
                    <span>{` • Solicitada: ${Number(alocItemAtual.qtde_item || 0).toLocaleString('pt-BR')}`}</span>
                    <span>{` • Em estoque: ${getQtdeEstoqueAlocada(alocItemIndex ?? 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`}</span>
                  </>
                ) : (
                  <span>Selecione um item</span>
                )}
              </div>
              <Button variant="outline" onClick={() => setModalSaidaOpen(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resumoOpen} onOpenChange={setResumoOpen}>
        <DialogContent className="sm:max-w-[1000px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo</DialogTitle>
            <DialogDescription>Resumo do processamento da solicitação.</DialogDescription>
          </DialogHeader>

          {resumoData && (
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="pt-4 space-y-1">
                    <div className="text-sm text-muted-foreground">Solicitação</div>
                    <div className="font-mono font-semibold">{resumoData.nro_solicitacao_formatado}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 space-y-1">
                    <div className="text-sm text-muted-foreground">Ordem de Compra</div>
                    <div className="font-mono font-semibold">
                      {resumoData.ordem ? (
                        resumoData.ordem.nro_ordem_compra !== null &&
                        resumoData.ordem.nro_ordem_compra !== undefined &&
                        String(resumoData.ordem.nro_ordem_compra).trim() !== '' ? (
                          `${solicitacao?.unidade || ''}${String(resumoData.ordem.nro_ordem_compra).padStart(6, '0')}`.trim()
                        ) : (
                          `#${resumoData.ordem.seq_ordem_compra}`
                        )
                      ) : (
                        'Nenhuma'
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-4 space-y-1">
                    <div className="text-sm text-muted-foreground">Requisições de Saída</div>
                    <div className="font-mono font-semibold">{resumoData.requisicoes.length}</div>
                  </CardContent>
                </Card>
              </div>

              {resumoData.requisicoes.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Requisição</TableHead>
                        <TableHead>Estoque</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumoData.requisicoes.map((r) => (
                        <TableRow key={`${r.seq_estoque}-${r.seq_requisicao}`}>
                          <TableCell className="font-mono">{String(r.seq_requisicao).padStart(6, '0')}</TableCell>
                          <TableCell className="font-medium">{r.estoque_label}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Solicitada</TableHead>
                      <TableHead className="text-right">Em Estoque</TableHead>
                      <TableHead className="text-right">Comprada</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoData.itens.map((it, idx) => (
                      <TableRow key={`${it.descricao}-${idx}`}>
                        <TableCell className="font-medium">{it.descricao}</TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(it.qtde_solicitada || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(it.qtde_estoque || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Number(it.qtde_comprada || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {resumoData.itens.some((it) => (it.alocacoes || []).length > 0) && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Estoque</TableHead>
                        <TableHead>Posição</TableHead>
                        <TableHead className="text-right">Quantidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {resumoData.itens.flatMap((it) =>
                        (it.alocacoes || []).map((a, idx) => (
                          <TableRow key={`${it.descricao}-${a.seq_estoque}-${a.seq_posicao}-${idx}`}>
                            <TableCell className="font-medium">{it.descricao}</TableCell>
                            <TableCell>{a.estoque_label}</TableCell>
                            <TableCell>{a.posicao_label}</TableCell>
                            <TableCell className="text-right font-mono">
                              {Number(a.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setResumoOpen(false);
              }}
            >
              Fechar
            </Button>
            <Button
              onClick={() => {
                setResumoOpen(false);
                navigate('/compras/ordens-compra');
              }}
            >
              Ir para Ordens de Compra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ Modal de Reprovação */}
      <Dialog open={mostrarReprovarModal} onOpenChange={setMostrarReprovarModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <X className="size-5" />
              Reprovar Solicitação
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da reprovação para a solicitação {solicitacao.unidade}{String(solicitacao.seq_solicitacao_compra).padStart(6, '0')}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="motivo">Motivo da Reprovação *</Label>
              <Textarea
                id="motivo"
                placeholder="Descreva o motivo pelo qual esta solicitação está sendo reprovada..."
                className="min-h-[120px] uppercase"
                value={motivoReprovacao}
                onChange={(e) => setMotivoReprovar(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMostrarReprovarModal(false);
                setMotivoReprovar('');
              }}
              disabled={reprovando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmarReprovacao}
              disabled={reprovando || !motivoReprovacao.trim()}
              className="gap-2"
            >
              {reprovando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Reprovando...
                </>
              ) : (
                <>
                  <X className="size-4" />
                  Confirmar Reprovação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
