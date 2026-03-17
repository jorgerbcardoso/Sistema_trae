import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  Plus,
  Trash2,
  Save,
  X,
  ShoppingCart,
  Users,
  Mail,
  Edit,
  Package,
  DollarSign,
  ArrowLeft,
  MapPin,
  Pencil,
  Loader2,
  Search,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { toast } from 'sonner';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { FilterSelectSetorWithAll } from '../../components/admin/FilterSelectSetorWithAll';

// Mock data para Figma Make
const MOCK_ORCAMENTOS = [
  {
    seq_orcamento: 1,
    nro_orcamento: '1',
    observacao: 'TESTE',
    status: 'PENDENTE',
  },
];
const MOCK_ORDENS: OrdemCompra[] = [];
const MOCK_FORNECEDORES: Fornecedor[] = [];
const MOCK_ORCAMENTO_COTACOES: any[] = [];
const MOCK_ORCAMENTO_ORDENS: any[] = [];
const MOCK_ORDENS_COMPRA: any[] = [];
const MOCK_ORDEM_COMPRA_ITENS: any[] = [];
const MOCK_ITENS: any[] = [];
const MOCK_ORCAMENTO_FORNECEDORES: any[] = [];

// ================================================================
// HELPER: Formatar número de ordem/centro de custo
// ================================================================
const formatarNumeroOrdem = (unidade: string, numero: string | number): string => {
  const num = String(numero).padStart(6, '0');
  return `${unidade}${num}`;
};

// Formatar hora para exibir apenas HH:MM
const formatarHora = (hora: string): string => {
  if (!hora) return '';
  // Remove segundos e milissegundos, mantém apenas HH:MM
  return hora.substring(0, 5);
};

interface OrdemCompra {
  seq_ordem_compra: number;
  nro_ordem_compra: string;
  unidade: string;
  nro_centro_custo?: string;
  centro_custo_descricao?: string;
  nro_setor?: number; // ✅ NOVO: Setor responsável
  setor_descricao?: string; // ✅ NOVO: Descrição do setor
  observacao?: string;
  itens?: ItemOrdem[];
  vlr_total_ordem?: number;
}

interface ItemOrdem {
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_item: number;
  vlr_item?: number;
  vlr_total?: number;
}

interface Fornecedor {
  seq_fornecedor: number;
  nome: string;
  cnpj: string;
  email?: string;
}

interface FornecedorSelecionado extends Fornecedor {
  email_cotacao: string;
}

export default function OrcamentoForm() {
  const { seq_orcamento } = useParams();
  const isEdicao = !!seq_orcamento;
  usePageTitle(isEdicao ? 'Editar Orçamento' : 'Novo Orçamento');

  const navigate = useNavigate();
  const { user } = useAuth();

  // Estados principais
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [estornando, setEstornando] = useState(false);
  const [observacao, setObservacao] = useState('');
  const [statusOrcamento, setStatusOrcamento] = useState('PENDENTE');
  const [nroOrcamento, setNroOrcamento] = useState('');
  const [unidadeOrcamento, setUnidadeOrcamento] = useState('');
  const [dataInclusao, setDataInclusao] = useState('');
  const [horaInclusao, setHoraInclusao] = useState('');
  const [loginInclusao, setLoginInclusao] = useState('');
  const [modoVisualizacao, setModoVisualizacao] = useState(false);

  // ✅ Estados de aprovação
  const [dataAprovacao, setDataAprovacao] = useState('');
  const [horaAprovacao, setHoraAprovacao] = useState('');
  const [loginAprovacao, setLoginAprovacao] = useState('');
  const [pedidosGerados, setPedidosGerados] = useState<any[]>([]);

  // Ordens de Compra
  const [ordensDisponiveis, setOrdensDisponiveis] = useState<OrdemCompra[]>([]);
  const [ordensSelecionadas, setOrdensSelecionadas] = useState<OrdemCompra[]>([]);
  const [modalOrdens, setModalOrdens] = useState(false);
  const [buscaOrdem, setBuscaOrdem] = useState('');
  const [setorFiltroOrdens, setSetorFiltroOrdens] = useState<string>(''); // ✅ NOVO: Filtro de setor para ordens

  // Fornecedores
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState<Fornecedor[]>([]);
  const [fornecedoresSelecionados, setFornecedoresSelecionados] = useState<FornecedorSelecionado[]>([]);
  const [modalFornecedores, setModalFornecedores] = useState(false);
  const [buscaFornecedor, setBuscaFornecedor] = useState('');

  // 🆕 Estados para solicitação de cotação
  const [enviandoCotacao, setEnviandoCotacao] = useState<number | null>(null);
  
  // 🆕 Estado para cotações (dados reais da API)
  const [cotacoes, setCotacoes] = useState<any[]>([]);

  useEffect(() => {
    if (isEdicao) {
      carregarOrcamento();
      carregarCotacoes(); // ✅ Carregar cotações
    }
    carregarOrdensDisponiveis();
    carregarFornecedores();
  }, []);

  // ✅ Recarregar ordens quando o filtro de setor mudar
  useEffect(() => {
    carregarOrdensDisponiveis();
  }, [setorFiltroOrdens]);

  const carregarOrcamento = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Carregar dados do orçamento
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const orcamento = MOCK_ORCAMENTOS.find(o => o.seq_orcamento === Number(seq_orcamento));
        
        if (orcamento) {
          // Carregar dados básicos
          setObservacao(orcamento.observacao || '');
          setStatusOrcamento(orcamento.status || 'PENDENTE');
          setNroOrcamento(orcamento.nro_orcamento || '');
          
          // Carregar ordens vinculadas ao orçamento
          await carregarOrdensDoOrcamento();
          
          // Carregar fornecedores vinculados ao orçamento
          await carregarFornecedoresDoOrcamento();
        } else {
          toast.error('Orçamento não encontrado');
          navigate('/compras/orcamentos');
        }
      } else {
        // BACKEND - Carregar dados do orçamento
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=detalhes&seq_orcamento=${seq_orcamento}`,
          { method: 'GET' }
        );

        if (data.success) {
          setObservacao(data.data.observacao || '');
          setStatusOrcamento(data.data.status || 'PENDENTE');
          setNroOrcamento(data.data.nro_orcamento || '');
          setUnidadeOrcamento(data.data.unidade || '');
          setDataInclusao(data.data.data_inclusao || '');
          setHoraInclusao(data.data.hora_inclusao || '');
          setLoginInclusao(data.data.login_inclusao || '');
          
          // ✅ Campos de aprovação
          setDataAprovacao(data.data.data_aprovacao || '');
          setHoraAprovacao(data.data.hora_aprovacao || '');
          setLoginAprovacao(data.data.login_aprovacao || '');
          
          // Carregar ordens e fornecedores do orçamento
          await carregarOrdensDoOrcamento();
          await carregarFornecedoresDoOrcamento();
          
          // ✅ Buscar pedidos gerados (se aprovado)
          if (data.data.status === 'APROVADO') {
            await carregarPedidosGerados();
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar orçamento:', error);
    } finally {
      setLoading(false);
    }
  };

  const carregarCotacoes = async () => {
    if (ENVIRONMENT.isFigmaMake) {
      // MOCK - Carregar cotações
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const cotações = MOCK_ORCAMENTO_COTACOES
        .filter(c => c.seq_orcamento === Number(seq_orcamento));
      
      setCotacoes(cotações);
    } else {
      // BACKEND - Carregar cotações
      const data = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=cotacoes&seq_orcamento=${seq_orcamento}`,
        { method: 'GET' }
      );

      if (data.success) {
        setCotacoes(data.data || []);
      }
    }
  };

  const carregarOrdensDoOrcamento = async () => {
    if (ENVIRONMENT.isFigmaMake) {
      // MOCK - Buscar ordens vinculadas ao orçamento
      const ordensVinculadas = MOCK_ORCAMENTO_ORDENS
        .filter(oo => oo.seq_orcamento === Number(seq_orcamento))
        .map(oo => {
          const ordem = MOCK_ORDENS_COMPRA.find(o => o.seq_ordem_compra === oo.seq_ordem_compra);
          if (!ordem) return null;
          
          // Buscar itens da ordem
          const itens = MOCK_ORDEM_COMPRA_ITENS
            .filter(oi => oi.seq_ordem_compra === ordem.seq_ordem_compra)
            .map(oi => {
              const item = MOCK_ITENS.find(i => i.seq_item === oi.seq_item);
              return {
                seq_item: oi.seq_item,
                codigo: oi.codigo,
                descricao: oi.descricao,
                unidade_medida: oi.unidade_medida,
                qtde_item: oi.qtde_item,
                vlr_item: item?.vlr_item || 0,
                vlr_total: (item?.vlr_item || 0) * oi.qtde_item
              };
            });

          const vlr_total_ordem = itens.reduce((sum, item) => sum + (item.vlr_total || 0), 0);

          return {
            ...ordem,
            itens,
            vlr_total_ordem
          };
        })
        .filter(o => o !== null) as OrdemCompra[];
      
      setOrdensSelecionadas(ordensVinculadas);
    } else {
      // BACKEND - Buscar ordens do orçamento
      const data = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=ordens-orcamento&seq_orcamento=${seq_orcamento}`,
        { method: 'GET' }
      );

      if (data.success) {
        setOrdensSelecionadas(data.data || []);
      }
    }
  };

  const carregarFornecedoresDoOrcamento = async () => {
    if (ENVIRONMENT.isFigmaMake) {
      // MOCK - Buscar fornecedores vinculados ao orçamento
      const fornecedoresVinculados = MOCK_ORCAMENTO_FORNECEDORES
        .filter(of => of.seq_orcamento === Number(seq_orcamento))
        .map(of => {
          const fornecedor = MOCK_FORNECEDORES.find(f => f.seq_fornecedor === of.seq_fornecedor);
          if (!fornecedor) return null;
          
          return {
            ...fornecedor,
            email_cotacao: of.email || fornecedor.email || ''
          };
        })
        .filter(f => f !== null) as FornecedorSelecionado[];
      
      setFornecedoresSelecionados(fornecedoresVinculados);
    } else {
      // BACKEND - Buscar fornecedores do orçamento
      const data = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=fornecedores-orcamento&seq_orcamento=${seq_orcamento}`,
        { method: 'GET' }
      );

      if (data.success) {
        setFornecedoresSelecionados(data.data || []);
      }
    }
  };

  const carregarPedidosGerados = async () => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        setPedidosGerados([]);
      } else {
        // BACKEND - Buscar pedidos gerados pelo orçamento
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=mapa&seq_orcamento=${seq_orcamento}`,
          { method: 'GET' }
        );

        if (data.success && data.data) {
          setPedidosGerados(data.data.pedidos_gerados || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar pedidos gerados:', error);
    }
  };

  const carregarOrdensDisponiveis = async () => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Filtrar apenas ordens aprovadas com ORCAR = S
        const ordensFiltradas = MOCK_ORDENS_COMPRA
          .filter(o => o.aprovada === 'S' && o.orcar === 'S')
          .map(ordem => {
            // Buscar itens da ordem
            const itens = MOCK_ORDEM_COMPRA_ITENS
              .filter(oi => oi.seq_ordem_compra === ordem.seq_ordem_compra)
              .map(oi => {
                // ✅ CORREÇÃO: Em NOVO ORÇAMENTO, não preencher valores!
                const vlrItemEstoque = isEdicao ? (MOCK_ITENS.find(i => i.seq_item === oi.seq_item)?.vlr_item || 0) : 0;
                
                return {
                  seq_item: oi.seq_item,
                  codigo: oi.codigo,
                  descricao: oi.descricao,
                  unidade_medida: oi.unidade_medida,
                  qtde_item: oi.qtde_item,
                  vlr_item: vlrItemEstoque,
                  vlr_total: vlrItemEstoque * oi.qtde_item
                };
              });

            const vlr_total_ordem = itens.reduce((sum, item) => sum + (item.vlr_total || 0), 0);

            return {
              ...ordem,
              itens,
              vlr_total_ordem
            };
          });

        setOrdensDisponiveis(ordensFiltradas);
      } else {
        // BACKEND
        let url = `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=ordens-disponiveis`;
        
        // ✅ Adicionar filtro de setor se selecionado
        if (setorFiltroOrdens && setorFiltroOrdens !== '') {
          url += `&nro_setor=${setorFiltroOrdens}`;
        }
        
        const data = await apiFetch(url, { method: 'GET' });

        if (data.success) {
          setOrdensDisponiveis(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar ordens disponíveis:', error);
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

  const adicionarOrdem = (ordem: OrdemCompra) => {
    if (ordensSelecionadas.find(o => o.seq_ordem_compra === ordem.seq_ordem_compra)) {
      toast.error('Ordem de compra já adicionada');
      return;
    }

    setOrdensSelecionadas([...ordensSelecionadas, ordem]);
    toast.success('Ordem de compra adicionada');
  };

  const removerOrdem = (seq_ordem_compra: number) => {
    setOrdensSelecionadas(ordensSelecionadas.filter(o => o.seq_ordem_compra !== seq_ordem_compra));
    toast.success('Ordem de compra removida');
  };

  const adicionarFornecedor = (fornecedor: Fornecedor) => {
    if (fornecedoresSelecionados.find(f => f.seq_fornecedor === fornecedor.seq_fornecedor)) {
      toast.error('Fornecedor já adicionado');
      return;
    }

    setFornecedoresSelecionados([
      ...fornecedoresSelecionados,
      {
        ...fornecedor,
        email_cotacao: fornecedor.email || ''
      }
    ]);
    toast.success('Fornecedor adicionado');
  };

  const removerFornecedor = (seq_fornecedor: number) => {
    setFornecedoresSelecionados(fornecedoresSelecionados.filter(f => f.seq_fornecedor !== seq_fornecedor));
    toast.success('Fornecedor removido');
  };

  const atualizarEmailFornecedor = (seq_fornecedor: number, email: string) => {
    setFornecedoresSelecionados(fornecedoresSelecionados.map(f =>
      f.seq_fornecedor === seq_fornecedor
        ? { ...f, email_cotacao: email }
        : f
    ));
  };

  // 🆕 FUNÇÃO: Solicitar cotação por email
  const solicitarCotacao = async (fornecedor: FornecedorSelecionado) => {
    // Validar email
    if (!fornecedor.email_cotacao || !fornecedor.email_cotacao.includes('@')) {
      toast.error('Informe um email válido para o fornecedor');
      return;
    }

    // ✅ CONFIRMAÇÃO antes de enviar
    const confirmar = window.confirm(
      `Deseja enviar solicitação de cotação para:\n\n` +
      `Fornecedor: ${fornecedor.nome}\n` +
      `Email: ${fornecedor.email_cotacao}\n\n` +
      `Um código de acesso será gerado e enviado ao fornecedor.`
    );

    if (!confirmar) {
      return;
    }

    setEnviandoCotacao(fornecedor.seq_fornecedor);
    
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Simular envio de email
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast.success(`Email de cotação enviado para ${fornecedor.nome}!`);
      } else {
        // BACKEND - Chamar API de envio
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/solicitar_cotacao.php`,
          {
            method: 'POST',
            body: JSON.stringify({
              seq_orcamento: Number(seq_orcamento),
              seq_fornecedor: fornecedor.seq_fornecedor,
              email: fornecedor.email_cotacao
            })
          }
        );

        if (data.success) {
          toast.success(`Email de cotação enviado para ${fornecedor.nome}!`);
        }
      }
    } catch (error) {
      console.error('Erro ao solicitar cotação:', error);
    } finally {
      setEnviandoCotacao(null);
    }
  };

  // 🆕 FUNÇÃO: Navegar para coleta de preços
  const abrirModalPrecos = (fornecedor: FornecedorSelecionado) => {
    if (!isEdicao || !seq_orcamento) {
      toast.error('Salve o orçamento antes de informar os preços');
      return;
    }
    navigate(`/compras/orcamentos/coleta/${seq_orcamento}/${fornecedor.seq_fornecedor}?origem=orcamento`);
  };

  const salvarOrcamento = async () => {
    // Validações
    if (ordensSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma ordem de compra');
      return;
    }

    if (fornecedoresSelecionados.length === 0) {
      toast.error('Selecione pelo menos um fornecedor');
      return;
    }

    setSalvando(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // ✅ CORREÇÃO: Gerar número do orçamento e recarregar
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Se for novo orçamento, gerar número e redirecionar para edição
        if (!isEdicao) {
          const novoNumero = `ORC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
          
          toast.success(`Orçamento ${novoNumero} criado com sucesso!`);
          
          setTimeout(() => {
            navigate('/compras/orcamentos/editar/1');
          }, 500);
        } else {
          // Se for edição, apenas salvar alterações
          toast.success('Alterações salvas com sucesso!');
          await carregarOrcamento(); // Recarregar dados
        }
      } else {
        // BACKEND
        const payload = {
          unidade: user?.unidade || 'MTZ',
          observacao: observacao.toUpperCase(),
          ordens_compra: ordensSelecionadas.map(o => o.seq_ordem_compra),
          fornecedores: fornecedoresSelecionados.map(f => ({
            seq_fornecedor: f.seq_fornecedor,
            email: f.email_cotacao
          }))
        };

        if (isEdicao) {
          // PUT para edição
          const data = await apiFetch(
            `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php`,
            {
              method: 'PUT',
              body: JSON.stringify({
                ...payload,
                seq_orcamento: Number(seq_orcamento)
              })
            }
          );

          if (data.success) {
            toast.success('Alterações salvas com sucesso!');
            await carregarOrcamento();
          }
        } else {
          // POST para novo
          const data = await apiFetch(
            `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php`,
            {
              method: 'POST',
              body: JSON.stringify(payload)
            }
          );

          if (data.success) {
            toast.success(`Orçamento ${data.nro_orcamento} criado com sucesso!`);
            navigate(`/compras/orcamentos/editar/${data.seq_orcamento}`);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao salvar orçamento:', error);
    } finally {
      setSalvando(false);
    }
  };

  const estornarAprovacao = async () => {
    // Confirmação
    const confirmar = window.confirm(
      'ATENÇÃO: Deseja realmente ESTORNAR a aprovação deste orçamento?\n\n' +
      '⚠️ Esta ação irá:\n' +
      '• Excluir TODOS os pedidos gerados\n' +
      '• Retornar o orçamento para status PENDENTE\n' +
      '• Limpar as informações de aprovação\n\n' +
      'Não será possível estornar se algum pedido estiver ENTREGUE.'
    );

    if (!confirmar) return;

    setEstornando(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Aprovação estornada com sucesso!');
        navigate('/compras/orcamentos');
      } else {
        // BACKEND - Estornar aprovação
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_aprovacao.php`, {
          method: 'POST',
          body: JSON.stringify({
            seq_orcamento: Number(seq_orcamento)
          })
        });

        if (response.success) {
          toast.success('Aprovação estornada! O orçamento voltou ao status PENDENTE.');
          navigate('/compras/orcamentos', {
            state: { toastMessage: 'Aprovação estornada com sucesso! O orçamento voltou ao status PENDENTE.' }
          });
        }
      }
    } catch (error) {
      console.error('Erro ao estornar aprovação:', error);
    } finally {
      setEstornando(false);
    }
  };

  // ✅ Filtro de setor é aplicado no BACKEND, aqui apenas busca por texto
  const ordensFiltradas = ordensDisponiveis.filter(ordem => {
    const matchBusca = ordem.nro_ordem_compra.toLowerCase().includes(buscaOrdem.toLowerCase()) ||
      ordem.centro_custo_descricao?.toLowerCase().includes(buscaOrdem.toLowerCase()) ||
      ordem.observacao?.toLowerCase().includes(buscaOrdem.toLowerCase());
    
    return matchBusca;
  });

  // ✅ Debounce na busca de fornecedores - chama API a cada digitação
  useEffect(() => {
    const timer = setTimeout(() => {
      if (modalFornecedores) {
        carregarFornecedores(buscaFornecedor);
      }
    }, 500); // 500ms de debounce

    return () => clearTimeout(timer);
  }, [buscaFornecedor, modalFornecedores]);

  // Recarregar fornecedores ao abrir modal
  useEffect(() => {
    if (modalFornecedores) {
      carregarFornecedores(buscaFornecedor);
    }
  }, [modalFornecedores]);

  const totalOrcamento = ordensSelecionadas.reduce((sum, ordem) => sum + (ordem.vlr_total_ordem || 0), 0);
  const totalItens = ordensSelecionadas.reduce((sum, ordem) => sum + (ordem.itens?.length || 0), 0);

  // Verificar se pode editar
  const podeEditar = !isEdicao || statusOrcamento === 'PENDENTE';

  // Função para formatar valores em padrão brasileiro
  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // 🆕 Funço para contar cotações preenchidas por fornecedor
  const contarCotacoesFornecedor = (seq_fornecedor: number): number => {
    if (!isEdicao) return 0;
    
    // ✅ CORREÇÃO: Usar dados reais do estado cotacoes
    const cotacoesFornecedor = cotacoes.filter(
      c => c.seq_fornecedor === seq_fornecedor && 
           c.vlr_fornecedor !== null && 
           c.vlr_fornecedor > 0
    );
    
    return cotacoesFornecedor.length;
  };

  if (loading) {
    return (
      <AdminLayout title={isEdicao ? 'EDITAR ORÇAMENTO' : 'NOVO ORÇAMENTO'}>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  // ✅ Formatar número do orçamento no padrão AAA000000
  const numeroOrcamentoFormatado = nroOrcamento 
    ? `${unidadeOrcamento}${String(nroOrcamento).padStart(6, '0')}`
    : '';

  return (
    <AdminLayout
      title={isEdicao ? (podeEditar ? `EDITAR ORÇAMENTO - ${numeroOrcamentoFormatado}` : `VISUALIZAR ORÇAMENTO - ${numeroOrcamentoFormatado}`) : 'NOVO ORÇAMENTO'}
      description={podeEditar ? "Selecione as ordens de compra e fornecedores para cotação" : `Orçamento ${statusOrcamento} - Visualização`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Botão Voltar */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/compras/orcamentos')} className="gap-2">
            <ArrowLeft className="size-4" />
            Voltar para Listagem
          </Button>

          {!podeEditar && (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="text-sm px-3 py-1">
                {statusOrcamento}
              </Badge>
              <Button 
                variant="outline" 
                onClick={() => navigate(`/compras/orcamentos/mapa/${seq_orcamento}`)}
                className="gap-2"
              >
                <MapPin className="size-4" />
                Ver Mapa de Cotação
              </Button>
            </div>
          )}
        </div>

        {/* Card de Informações do Orçamento (somente em edição) */}
        {isEdicao && (
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="size-5" />
                Informações do Orçamento
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Número do Orçamento */}
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Número do Orçamento</Label>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {formatarNumeroOrdem(unidadeOrcamento, nroOrcamento)}
                  </p>
                </div>

                {/* Total de Ordens */}
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Ordens de Compra</Label>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {ordensSelecionadas.length} {ordensSelecionadas.length === 1 ? 'ordem' : 'ordens'}
                  </p>
                  <p className="text-sm text-gray-500">{totalItens} {totalItens === 1 ? 'item' : 'itens'}</p>
                </div>

                {/* Total de Fornecedores */}
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Fornecedores</Label>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {fornecedoresSelecionados.length} {fornecedoresSelecionados.length === 1 ? 'fornecedor' : 'fornecedores'}
                  </p>
                </div>

                {/* Data/Hora/Usuário Inclusão */}
                <div>
                  <Label className="text-xs text-gray-600 dark:text-gray-400">Criado em</Label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {dataInclusao && new Date(dataInclusao).toLocaleDateString('pt-BR')} {formatarHora(horaInclusao)}
                  </p>
                  <p className="text-sm text-gray-500">por {loginInclusao.toLowerCase()}</p>
                </div>
              </div>

              {/* ✅ Informações de Aprovação (quando status = APROVADO) */}
              {statusOrcamento === 'APROVADO' && (
                  <div className="mt-6 pt-6 border-t border-blue-300 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-4">
                      <CheckCircle className="size-5 text-green-600" />
                      <h3 className="font-bold text-green-700 dark:text-green-400">Orçamento Aprovado</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-4">
                      {/* Data de Aprovação */}
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-gray-400">Data de Aprovação</Label>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {dataAprovacao && new Date(dataAprovacao).toLocaleDateString('pt-BR')}
                        </p>
                      </div>

                      {/* Hora de Aprovação */}
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-gray-400">Hora de Aprovação</Label>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {formatarHora(horaAprovacao)}
                        </p>
                      </div>

                      {/* Usuário que Aprovou */}
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-gray-400">Aprovado por</Label>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {loginAprovacao?.toLowerCase() || ''}
                        </p>
                      </div>

                      {/* Quantidade de Pedidos */}
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-gray-400">Pedidos Gerados</Label>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {pedidosGerados.length} {pedidosGerados.length === 1 ? 'pedido' : 'pedidos'}
                        </p>
                      </div>
                    </div>

                    {/* Lista de Pedidos Gerados */}
                    {pedidosGerados.length > 0 && (
                      <div>
                        <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Pedidos:</Label>
                        <div className="flex flex-wrap gap-2">
                          {pedidosGerados.map((pedido, index) => (
                            <div
                              key={index}
                              className="inline-flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700"
                            >
                              <Package className="size-4 text-green-700 dark:text-green-400" />
                              <span className="font-mono font-bold text-sm text-green-700 dark:text-green-400">
                                {pedido.nro_pedido_formatado}
                              </span>
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                ({pedido.fornecedor_nome})
                              </span>
                              <span className="text-xs font-bold text-green-600">
                                R$ {formatarValor(pedido.vlr_total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* PASSO 1: Ordens de Compra */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ShoppingCart className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>PASSO 1: Ordens de Compra</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Selecione as ordens de compra aprovadas para orçamento
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-48">
                  <FilterSelectSetorWithAll
                    value={setorFiltroOrdens}
                    onChange={setSetorFiltroOrdens}
                    suggestUserSetor={true}
                    label=""
                    apenasEfetuaCompras={true}
                  />
                </div>
                <Button onClick={() => setModalOrdens(true)} className="gap-2" disabled={!podeEditar}>
                  <Plus className="size-4" />
                  Adicionar Ordem
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ordensSelecionadas.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <ShoppingCart className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma ordem de compra selecionada</p>
                <p className="text-sm mt-1">Clique em "Adicionar Ordem" para começar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordensSelecionadas.map((ordem) => (
                  <Card key={ordem.seq_ordem_compra} className="border-2">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-lg">{formatarNumeroOrdem(ordem.unidade, ordem.nro_ordem_compra)}</span>
                            <span className="text-sm text-gray-500">
                              {ordem.nro_centro_custo && formatarNumeroOrdem(ordem.unidade, ordem.nro_centro_custo)} - {ordem.centro_custo_descricao}
                            </span>
                          </div>
                          {ordem.observacao && (
                            <p className="text-sm text-gray-500 mt-1">{ordem.observacao}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-sm font-medium text-blue-600">
                              {ordem.itens?.length || 0} {ordem.itens?.length === 1 ? 'item' : 'itens'}
                            </span>
                            <span className="text-sm font-bold text-green-600">
                              Valor Estoque: R$ {formatarValor(ordem.vlr_total_ordem || 0)}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removerOrdem(ordem.seq_ordem_compra)}
                          title="Remover"
                          disabled={!podeEditar}
                        >
                          <X className="size-4 text-red-600" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Código</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead className="text-center">Unid.</TableHead>
                              <TableHead className="text-right">Qtd.</TableHead>
                              <TableHead className="text-right">Vlr. Unit.</TableHead>
                              <TableHead className="text-right">Vlr. Total</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ordem.itens?.map((item) => (
                              <TableRow key={item.seq_item}>
                                <TableCell className="font-medium">{item.codigo}</TableCell>
                                <TableCell>{item.descricao}</TableCell>
                                <TableCell className="text-center">{item.unidade_medida}</TableCell>
                                <TableCell className="text-right">{parseFloat(item.qtde_item || 0).toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                  R$ {parseFloat(item.vlr_item || 0).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  R$ {parseFloat(item.vlr_total || 0).toFixed(2)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Resumo */}
                <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between text-lg font-bold">
                      <div className="flex items-center gap-6">
                        <span className="text-blue-900 dark:text-blue-100">
                          <Package className="size-5 inline mr-2" />
                          Total: {ordensSelecionadas.length} {ordensSelecionadas.length === 1 ? 'ordem' : 'ordens'}
                        </span>
                        <span className="text-blue-900 dark:text-blue-100">
                          {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <span className="text-green-700 dark:text-green-400">
                        <DollarSign className="size-5 inline mr-1" />
                        R$ {formatarValor(totalOrcamento)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>

        {/* PASSO 2: Fornecedores */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Users className="size-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle>PASSO 2: Fornecedores</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Selecione os fornecedores que participarão da cotação
                  </p>
                </div>
              </div>
              <Button onClick={() => setModalFornecedores(true)} className="gap-2" disabled={!podeEditar}>
                <Plus className="size-4" />
                Adicionar Fornecedor
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* ⚠️ AVISO GLOBAL: Salvar antes de preencher preços */}
            {!isEdicao && fornecedoresSelecionados.length > 0 && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-800 rounded-lg flex-shrink-0">
                    <Save className="size-5 text-amber-700 dark:text-amber-200" />
                  </div>
                  <div>
                    <h4 className="font-bold text-amber-900 dark:text-amber-100 mb-1">
                      ⚠️ Ação Necessária: Salvar Orçamento
                    </h4>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      Para <strong>preencher valores</strong> e <strong>enviar cotações por email</strong> aos fornecedores, você precisa primeiro <strong>criar o orçamento</strong> clicando no botão "Criar Orçamento" no final da página.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {fornecedoresSelecionados.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum fornecedor selecionado</p>
                <p className="text-sm mt-1">Clique em "Adicionar Fornecedor" para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {fornecedoresSelecionados.map((fornecedor) => {
                  const qtdeCotacoes = contarCotacoesFornecedor(fornecedor.seq_fornecedor);
                  const itensPreenchidos = qtdeCotacoes;
                  const itensFaltantes = totalItens - qtdeCotacoes;
                  
                  return (
                  <Card key={fornecedor.seq_fornecedor} className="border-2">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        {/* Header do Fornecedor */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="font-bold text-lg">{fornecedor.nome}</h3>
                              {isEdicao && totalItens > 0 && (
                                <Badge className={itensPreenchidos === totalItens 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                                  : itensPreenchidos > 0
                                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100'
                                }>
                                  {itensPreenchidos}/{totalItens} {itensPreenchidos === totalItens ? 'completo' : 'preenchidos'}
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-500 mt-1">CNPJ: {fornecedor.cnpj}</p>
                          </div>
                          {podeEditar && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removerFornecedor(fornecedor.seq_fornecedor)}
                              title="Remover"
                            >
                              <X className="size-4 text-red-600" />
                            </Button>
                          )}
                        </div>

                        {/* Email e Ações */}
                        <div className="space-y-3">
                          <div>
                            <Label>E-mail para Cotação</Label>
                            <div className="relative mt-1">
                              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                              <Input
                                type="email"
                                value={fornecedor.email_cotacao}
                                onChange={(e) => atualizarEmailFornecedor(fornecedor.seq_fornecedor, e.target.value)}
                                placeholder="email@fornecedor.com.br"
                                className="pl-10"
                                disabled={!podeEditar}
                              />
                            </div>
                          </div>

                          {/* Botões de Ação */}
                          <div className="flex items-center gap-3">
                            {/* Botão Principal: Preencher/Editar Preços */}
                            <Button
                              onClick={() => abrirModalPrecos(fornecedor)}
                              className="gap-2 flex-1"
                              disabled={!isEdicao}
                              title={!isEdicao ? "Salve o orçamento primeiro" : ""}
                            >
                              <Pencil className="size-4" />
                              {qtdeCotacoes > 0 ? 'Editar Preços' : 'Preencher Preços'} ({totalItens} itens)
                            </Button>

                            {/* Botão Secundário: Enviar Coleta de Preços */}
                            <Button
                              variant="outline"
                              className="gap-2"
                              disabled={!isEdicao || enviandoCotacao === fornecedor.seq_fornecedor}
                              onClick={() => solicitarCotacao(fornecedor)}
                              title={!isEdicao ? "Salve o orçamento primeiro" : ""}
                            >
                              {enviandoCotacao === fornecedor.seq_fornecedor ? (
                                <>
                                  <Loader2 className="size-4 animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <Mail className="size-4" />
                                  Enviar Coleta de Preços
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )})}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Observações */}
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value.toUpperCase())}
              placeholder="INFORMAÇÕES ADICIONAIS SOBRE O ORÇAMENTO..."
              rows={3}
              disabled={!podeEditar}
            />
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/compras/orcamentos')}
            disabled={salvando}
          >
            Cancelar
          </Button>
          
          {podeEditar ? (
            <div className="flex gap-3">
              {/* ✅ CORREÇÃO: 2 Botões separados - Salvar e Ver Mapa */}
              <Button
                onClick={salvarOrcamento}
                disabled={salvando || ordensSelecionadas.length === 0 || fornecedoresSelecionados.length === 0}
                variant="outline"
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
                    {isEdicao ? 'Salvar Alterações' : 'Criar Orçamento'}
                  </>
                )}
              </Button>
              
              {/* Botão "Ver Mapa" só aparece em edição */}
              {isEdicao && (
                <Button
                  onClick={() => navigate(`/compras/orcamentos/mapa/${seq_orcamento}`)}
                  className="gap-2"
                  disabled={salvando}
                >
                  <MapPin className="size-4" />
                  Ver Mapa de Cotação
                </Button>
              )}
            </div>
          ) : (
            <div className="flex gap-3">
              {/* Botão ESTORNAR APROVAÇÃO (somente quando APROVADO) */}
              {statusOrcamento === 'APROVADO' && (
                <Button
                  variant="destructive"
                  onClick={estornarAprovacao}
                  disabled={estornando}
                  className="gap-2"
                >
                  {estornando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Estornando...
                    </>
                  ) : (
                    <>
                      <XCircle className="size-4" />
                      Estornar Aprovação
                    </>
                  )}
                </Button>
              )}

              <Button
                onClick={() => navigate(`/compras/orcamentos/mapa/${seq_orcamento}`)}
                className="gap-2"
              >
                <MapPin className="size-4" />
                Ver Mapa
              </Button>
            </div>
          )}
        </div>

        {/* Modal de Seleção de Ordens */}
        <Dialog open={modalOrdens} onOpenChange={setModalOrdens}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Selecionar Ordem de Compra</DialogTitle>
              <DialogDescription>
                Apenas ordens aprovadas com orçamento solicitado (ORÇAR=S)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <Input
                  value={buscaOrdem}
                  onChange={(e) => setBuscaOrdem(e.target.value)}
                  placeholder="Buscar por número, centro de custo ou observação..."
                  className="pl-10"
                />
              </div>

              <div className="space-y-2">
                {ordensFiltradas.map((ordem) => (
                  <Card
                    key={ordem.seq_ordem_compra}
                    className="cursor-pointer hover:border-blue-500 transition-colors"
                    onClick={() => {
                      adicionarOrdem(ordem);
                      setModalOrdens(false);
                      setBuscaOrdem('');
                    }}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="font-bold">{formatarNumeroOrdem(ordem.unidade, ordem.nro_ordem_compra)}</span>
                            <span className="text-sm text-gray-500">
                              {ordem.nro_centro_custo && formatarNumeroOrdem(ordem.unidade, ordem.nro_centro_custo)} - {ordem.centro_custo_descricao}
                            </span>
                          </div>
                          {ordem.observacao && (
                            <p className="text-sm text-gray-500 mt-1">{ordem.observacao}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-sm text-blue-600">
                              {ordem.itens?.length || 0} itens
                            </span>
                            <span className="text-sm font-medium text-green-600">
                              R$ {ordem.vlr_total_ordem?.toFixed(2)}
                            </span>
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

                {ordensFiltradas.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="size-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma ordem de compra encontrada</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Seleção de Fornecedores */}
        <Dialog open={modalFornecedores} onOpenChange={setModalFornecedores}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Selecionar Fornecedor</DialogTitle>
              <DialogDescription>
                Escolha os fornecedores que participarão da cotaão
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

              <div className="space-y-2">
                {fornecedoresDisponiveis.map((fornecedor) => (
                  <Card
                    key={fornecedor.seq_fornecedor}
                    className="cursor-pointer hover:border-purple-500 transition-colors"
                    onClick={() => {
                      adicionarFornecedor(fornecedor);
                      setModalFornecedores(false);
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
                              <Mail className="size-3 inline mr-1" />
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
                    <Users className="size-12 mx-auto mb-4 opacity-50" />
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