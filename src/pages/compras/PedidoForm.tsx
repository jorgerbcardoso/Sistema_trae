import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Loader2,
  Plus,
  Search,
  X,
  ShoppingCart,
  User,
  Save,
  ArrowLeft,
  DollarSign,
  Package,
  FileText,
  Printer,
  Calendar,
  MapPin,
  Clock,
  Building2,
  Mail,
  Phone,
  CreditCard,
  CheckCircle,
  Truck,
  XCircle,
  Hash,
  UserCheck,
  Info,
  Trash2,
  Hourglass,
  Copy
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import {
  MOCK_ORDENS_COMPRA,
  MOCK_ORDEM_COMPRA_ITENS,
  MOCK_ITENS,
  MOCK_PEDIDOS,
  MOCK_PEDIDO_ITENS,
} from '../../utils/estoqueModData';
import { MOCK_FORNECEDORES } from '../../mocks/estoqueComprasMocks';
import { FilterSelectSetorWithAll } from '../../components/admin/FilterSelectSetorWithAll';

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
}

interface ItemOrdem {
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_item: number;
  vlr_unitario: number;
  vlr_total: number;
  vlr_item?: number; // ✅ Valor cadastrado no item
}

interface Fornecedor {
  seq_fornecedor: number;
  nome: string;
  cnpj: string;
  email?: string;
  telefone?: string;
  cidade_nome?: string;
}

interface ItemPedido {
  seq_pedido_item: number;
  seq_pedido: number;
  seq_item: number;
  codigo?: string;
  descricao?: string;
  unidade_medida?: string;
  qtde_item: number;
  vlr_unitario: number;
  vlr_total: number;
  observacao?: string;
}

interface Pedido {
  seq_pedido: number;
  unidade: string;
  nro_pedido: string;
  seq_orcamento: number;
  seq_fornecedor: number;
  status: string;
  vlr_total: number;
  observacao?: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_fin?: string | null;
  hora_fin?: string | null;
  login_fin?: string | null;
  ser_nf?: string | null;
  nro_nf?: string | null;
  chave_nfe?: string | null;
}

export default function PedidoForm() {
  const { seq_pedido } = useParams();
  const isVisualizacao = !!seq_pedido;
  usePageTitle(isVisualizacao ? 'Visualizar Pedido' : 'Novo Pedido Manual');

  const navigate = useNavigate();
  const { user, clientConfig } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  // 🚨 CRÍTICO: Logo do cliente DEVE vir da config do domínio
  const clientLogo = clientConfig?.theme?.logo_light || '';

  // Estados principais
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [observacao, setObservacao] = useState('');

  // Pedido carregado (modo visualização ou edição)
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [isPedidoOrcado, setIsPedidoOrcado] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false); // Pedido manual + pendente = edição

  // Fornecedor (único para pedido manual)
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState<Fornecedor | null>(null);
  const [fornecedoresDisponiveis, setFornecedoresDisponiveis] = useState<Fornecedor[]>([]);
  const [modalFornecedor, setModalFornecedor] = useState(false);
  const [buscaFornecedor, setBuscaFornecedor] = useState('');

  // Ordens de Compra
  const [ordensDisponiveis, setOrdensDisponiveis] = useState<OrdemCompra[]>([]);
  const [ordensSelecionadas, setOrdensSelecionadas] = useState<OrdemCompra[]>([]);
  const [modalOrdens, setModalOrdens] = useState(false);
  const [buscaOrdem, setBuscaOrdem] = useState('');
  const [setorFiltroOrdens, setSetorFiltroOrdens] = useState<string>(''); // ✅ NOVO: Filtro de setor para ordens

  // Valores dos itens (editáveis)
  const [valoresItens, setValoresItens] = useState<Record<number, number>>({});

  // ✅ NOVO: Estados para envio de pedido ao fornecedor
  const [dialogEnviarFornecedor, setDialogEnviarFornecedor] = useState(false);
  const [emailFornecedor, setEmailFornecedor] = useState('');
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  // ✅ NOVO: Dialog de confirmação após criar pedido manual
  const [dialogConfirmarEnvio, setDialogConfirmarEnvio] = useState(false);
  const [pedidoCriado, setPedidoCriado] = useState<{seq_pedido: number; nro_pedido_formatado: string; status?: string} | null>(null);

  // ✅ NOVO: Estados para aprovação de pedidos
  const [usuariosAprovadores, setUsuariosAprovadores] = useState<any[]>([]);
  const [dialogSolicitarAprovacao, setDialogSolicitarAprovacao] = useState(false);
  const [aprovadorSelecionado, setAprovadorSelecionado] = useState('');
  const [aprovadoresSelecionados, setAprovadoresSelecionados] = useState<number[]>([]); // ✅ NOVO: múltiplos aprovadores
  const [enviandoAprovacao, setEnviandoAprovacao] = useState(false);
  const [aprovandoPedido, setAprovandoPedido] = useState(false);
  const [duplicando, setDuplicando] = useState(false); // ✅ NOVO: Estado para duplicação
  const [dialogNecessitaAprovacao, setDialogNecessitaAprovacao] = useState(false);

  useEffect(() => {
    if (isVisualizacao) {
      carregarPedido();
    } else {
      carregarOrdensDisponiveis();
      carregarFornecedores();
    }
    // ✅ Sempre carregar usuários aprovadores
    carregarUsuariosAprovadores();
  }, []);

  const carregarPedido = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const pedidoMock = MOCK_PEDIDOS.find(p => p.seq_pedido === parseInt(seq_pedido!));
        if (!pedidoMock) {
          toast.error('Pedido não encontrado');
          navigate('/compras/pedidos');
          return;
        }

        setPedido(pedidoMock);
        setIsPedidoOrcado(pedidoMock.seq_orcamento !== 0);
        setObservacao(pedidoMock.observacao || '');

        // Carregar fornecedor
        const fornecedor = MOCK_FORNECEDORES.find(f => f.seq_fornecedor === pedidoMock.seq_fornecedor);
        setFornecedorSelecionado(fornecedor || null);

        // Carregar itens do pedido
        const itens = MOCK_PEDIDO_ITENS
          .filter(i => i.seq_pedido === pedidoMock.seq_pedido)
          .map(item => {
            const itemInfo = MOCK_ITENS.find(it => it.seq_item === item.seq_item);
            return {
              ...item,
              codigo: itemInfo?.codigo || '',
              descricao: itemInfo?.descricao || '',
              unidade_medida: itemInfo?.unidade_medida || ''
            };
          });

        setItensPedido(itens);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php?action=detalhes&seq_pedido=${seq_pedido}`,
          { method: 'GET' }
        );

        if (data.success) {
          setPedido(data.data.pedido);
          setItensPedido(data.data.itens || []); // ✅ Garantir array
          setIsPedidoOrcado(data.data.pedido.seq_orcamento !== 0 && data.data.pedido.seq_orcamento !== null);
          setObservacao(data.data.pedido.observacao || '');
          
          // ✅ Fornecedor pode vir como objeto completo ou null
          if (data.data.fornecedor) {
            setFornecedorSelecionado(data.data.fornecedor);
          }
          
          // ✅ Modo edição: pedido manual + pendente
          setModoEdicao(
            data.data.pedido.status === 'PENDENTE' && 
            (data.data.pedido.seq_orcamento === 0 || data.data.pedido.seq_orcamento === null)
          );
        }
      }
    } catch (error) {
      console.error('Erro ao carregar pedido:', error);
      toast.error('Erro ao carregar pedido');
    } finally {
      setLoading(false);
    }
  };

  const carregarOrdensDisponiveis = async () => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Apenas ordens aprovadas com ORCAR = N
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const ordensFiltradas = MOCK_ORDENS_COMPRA
          .filter(o => o.aprovada === 'S' && o.orcar === 'N')
          .map(ordem => {
            const itens = MOCK_ORDEM_COMPRA_ITENS
              .filter(oi => oi.seq_ordem_compra === ordem.seq_ordem_compra)
              .map(oi => ({
                seq_item: oi.seq_item,
                codigo: oi.codigo,
                descricao: oi.descricao,
                unidade_medida: oi.unidade_medida,
                qtde_item: oi.qtde_item,
                vlr_unitario: 0,
                vlr_total: 0
              }));

            return {
              ...ordem,
              itens
            };
          });

        setOrdensDisponiveis(ordensFiltradas);
      } else {
        // BACKEND - Lista completa de ordens disponíveis (aprovada=S, orcar=N)
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/ordens_compra.php?aprovada=S&orcar=N`,
          { method: 'GET' }
        );

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
          (f.nome || '').toLowerCase().includes((search || '').toLowerCase()) ||
          (f.cnpj || '').includes(search || '')
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
          // ✅ Ajustar para exibir o usuário 'presto' apenas se o usuário logado for 'presto'
          const aprovadoresFiltrados = (data.data || []).filter((u: any) => {
            const isPrestoUser = u.username?.toLowerCase() === 'presto';
            const loggedAsPresto = user?.username?.toLowerCase() === 'presto';
            
            if (isPrestoUser && !loggedAsPresto) return false;
            return true;
          });
          setUsuariosAprovadores(aprovadoresFiltrados);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar usuários aprovadores:', error);
    }
  };

  const handleSolicitarAprovacao = async () => {
    // ✅ NOVO: Suporta múltiplos aprovadores
    if (aprovadoresSelecionados.length === 0) {
      toast.error('Selecione pelo menos um aprovador');
      return;
    }

    const seqPedido = pedido?.seq_pedido || pedidoCriado?.seq_pedido;
    if (!seqPedido) {
      toast.error('Pedido não encontrado');
      return;
    }

    setEnviandoAprovacao(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
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
                seq_pedido: seqPedido,
                usuario_aprovador_id: aprovadorId
              })
            }
          );
        }
      }

      setDialogSolicitarAprovacao(false);
      setDialogNecessitaAprovacao(false);
      setAprovadorSelecionado('');
      setAprovadoresSelecionados([]); // ✅ Limpar seleção múltipla
      
      // Se foi após criação, navegar para lista
      if (pedidoCriado) {
        setPedidoCriado(null);
        setTimeout(() => navigate('/compras/pedidos'), 300);
      } else {
        // Recarregar pedido
        carregarPedido();
      }
    } catch (error) {
      console.error('Erro ao solicitar aprovação:', error);
    } finally {
      setEnviandoAprovacao(false);
    }
  };

  const handleAprovarPedido = async () => {
    if (!confirm('Tem certeza que deseja aprovar este pedido?')) {
      return;
    }

    setAprovandoPedido(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Pedido aprovado!');
        navigate('/compras/pedidos');
      } else {
        await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/pedidos_aprovacao.php`,
          {
            method: 'POST',
            body: JSON.stringify({
              seq_pedido: parseInt(seq_pedido!)
            })
          }
        );

        // ✅ Redirecionar para lista de pedidos após aprovação
        setTimeout(() => navigate('/compras/pedidos'), 500);
      }
    } catch (error) {
      console.error('Erro ao aprovar pedido:', error);
    } finally {
      setAprovandoPedido(false);
    }
  };

  // ✅ NOVO: Duplicar pedido existente
  const handleDuplicarPedido = async () => {
    if (!pedido || !itensPedido.length) return;
    
    // ✅ Pedir confirmação ao usuário
    if (!confirm('Deseja realmente duplicar este pedido?\n\nUm novo pedido IDÊNTICO será gerado, e ele precisará passar por um novo processo de aprovação.')) {
      return;
    }

    setDuplicando(true);
    try {
      // Preparar payload idêntico ao pedido atual
      const payload = {
        unidade: pedido.unidade,
        seq_fornecedor: pedido.seq_fornecedor,
        seq_orcamento: null, // Sempre manual
        observacao: `[DUPLICADO DO PEDIDO ${pedido.unidade}${String(pedido.nro_pedido).padStart(6, '0')}] ${pedido.observacao || ''}`.toUpperCase(),
        vlr_total: pedido.vlr_total,
        itens: itensPedido.map(item => ({
          seq_item: item.seq_item,
          qtde_item: item.qtde_item,
          vlr_unitario: item.vlr_unitario,
          vlr_total: item.vlr_total
        }))
      };

      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data && data.success && data.seq_pedido) {
        // Armazenar dados do novo pedido para o dialog de sucesso
        setPedidoCriado({
          seq_pedido: data.seq_pedido,
          nro_pedido_formatado: data.nro_pedido_formatado,
          status: data.status || 'A'
        });
        
        // Pequeno delay para garantir que o estado do pedidoCriado foi processado
        setTimeout(() => {
          setDialogNecessitaAprovacao(true);
        }, 100);
      }
    } catch (error) {
      console.error('Erro ao duplicar pedido:', error);
      toast.error('Erro ao duplicar pedido');
    } finally {
      setDuplicando(false);
    }
  };

  const selecionarFornecedor = (fornecedor: Fornecedor) => {
    setFornecedorSelecionado(fornecedor);
    setModalFornecedor(false);
    setBuscaFornecedor('');
    toast.success('Fornecedor selecionado');
  };

  const removerFornecedor = () => {
    setFornecedorSelecionado(null);
    toast.success('Fornecedor removido');
  };

  const adicionarOrdem = (ordem: OrdemCompra) => {
    if (ordensSelecionadas.find(o => o.seq_ordem_compra === ordem.seq_ordem_compra)) {
      toast.error('Ordem de compra já adicionada');
      return;
    }

    setOrdensSelecionadas([...ordensSelecionadas, ordem]);
    
    // Inicializar valores dos itens com 0
    ordem.itens?.forEach(item => {
      setValoresItens(prev => ({
        ...prev,
        [item.seq_item]: 0
      }));
    });

    toast.success('Ordem de compra adicionada');
  };

  const removerOrdem = (seq_ordem_compra: number) => {
    const ordem = ordensSelecionadas.find(o => o.seq_ordem_compra === seq_ordem_compra);
    
    // Remover valores dos itens da ordem
    ordem?.itens?.forEach(item => {
      setValoresItens(prev => {
        const novos = { ...prev };
        delete novos[item.seq_item];
        return novos;
      });
    });

    setOrdensSelecionadas(ordensSelecionadas.filter(o => o.seq_ordem_compra !== seq_ordem_compra));
    toast.success('Ordem de compra removida');
  };

  const atualizarValorItem = (seq_item: number, valor: string) => {
    const valorNumerico = parseFloat(valor.replace(',', '.')) || 0;
    setValoresItens(prev => ({
      ...prev,
      [seq_item]: valorNumerico
    }));
  };

  const calcularTotalItem = (seq_item: number, qtde: number | string): number => {
    const vlrUnitario = valoresItens[seq_item] || 0;
    const qtdeNum = Number(qtde || 0);
    return vlrUnitario * qtdeNum;
  };

  const calcularTotalGeral = (): number => {
    if (isVisualizacao) {
      return Number(pedido?.vlr_total || 0);
    }
    
    let total = 0;
    ordensSelecionadas.forEach(ordem => {
      ordem.itens?.forEach(item => {
        total += calcularTotalItem(item.seq_item, item.qtde_item);
      });
    });
    return total;
  };

  const formatarValor = (valor: number | string): string => {
    const num = Number(valor || 0);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatarData = (data: string): string => {
    if (!data) return '-';
    const partes = data.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return data;
  };

  const imprimirPedido = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    // 🚨 CRÍTICO: Pegar logo do cliente da config e substituir no HTML
    const logoCliente = clientConfig?.theme?.logo_light || '';
    let htmlContent = printContent.innerHTML;
    
    // Substituir APENAS a imagem da logo do cliente (que tem alt="Logo Empresa")
    htmlContent = htmlContent.replace(
      /<img[^>]*alt="Logo Empresa"[^>]*>/gi,
      `<img src="${logoCliente}" alt="Logo Empresa" />`
    );
    
    // 🎨 REGRA: Se for ACV, substituir TAMBÉM a logo da Presto pela logo do cliente
    const isAceville = user?.domain?.toUpperCase() === 'ACV';
    if (isAceville) {
      htmlContent = htmlContent.replace(
        /<img[^>]*alt="Sistema Presto"[^>]*>/gi,
        `<img src="${logoCliente}" alt="Sistema Presto" class="logo" />`
      );
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Pedido ${pedido?.nro_pedido || ''}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 15mm; 
              font-size: 11pt;
              color: #000;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 3px solid #2563eb;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .logo {
              width: 150px;
              height: 60px;
              object-fit: contain;
            }
            .logo-presto {
              width: 100px;
              height: 40px;
              object-fit: contain;
            }
            .header-info h1 {
              font-size: 16pt;
              color: #2563eb;
              margin-bottom: 3px;
            }
            .header-info p {
              font-size: 10pt;
              color: #666;
            }
            .header-right {
              text-align: right;
            }
            .pedido-numero {
              font-size: 20pt;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 5px;
            }
            .pedido-tipo {
              display: inline-block;
              padding: 4px 12px;
              background: #dbeafe;
              color: #1e40af;
              border-radius: 12px;
              font-size: 9pt;
              font-weight: bold;
            }
            .section {
              margin-bottom: 20px;
            }
            .section-title {
              font-size: 11pt;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 8px;
              padding-bottom: 4px;
              border-bottom: 2px solid #e5e7eb;
              text-transform: uppercase;
            }
            .info-row {
              display: flex;
              gap: 15px;
              margin-bottom: 8px;
            }
            .info-col {
              flex: 1;
            }
            .info-label {
              font-size: 8pt;
              color: #6b7280;
              font-weight: bold;
              text-transform: uppercase;
              margin-bottom: 2px;
            }
            .info-value {
              font-size: 10pt;
              color: #000;
            }
            .fornecedor-box {
              background: #f9fafb;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            .fornecedor-nome {
              font-size: 11pt;
              font-weight: bold;
              color: #000;
              margin-bottom: 5px;
            }
            .fornecedor-info {
              font-size: 9pt;
              color: #4b5563;
              line-height: 1.4;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 9pt;
            }
            th {
              background-color: #1e40af;
              color: white;
              font-weight: bold;
              padding: 8px 6px;
              text-align: left;
              font-size: 9pt;
            }
            td {
              border: 1px solid #e5e7eb;
              padding: 6px;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .total-section {
              margin-top: 15px;
              background: #eff6ff;
              padding: 12px 15px;
              border-radius: 6px;
              border: 2px solid #2563eb;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .total-label {
              font-size: 12pt;
              font-weight: bold;
              color: #1e40af;
            }
            .total-value {
              font-size: 18pt;
              font-weight: bold;
              color: #2563eb;
            }
            .observacoes {
              background: #fffbeb;
              padding: 10px;
              border-radius: 6px;
              border: 1px solid #fcd34d;
              font-size: 9pt;
              line-height: 1.5;
              color: #000;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 8pt;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-weight: bold;
              font-size: 9pt;
            }
            .status-aguardando {
              background: #fef3c7;
              color: #92400e;
              border: 1px solid #fcd34d;
            }
            .status-aprovado {
              background: #d1fae5;
              color: #065f46;
              border: 1px solid #6ee7b7;
            }
            .status-entregue {
              background: #dbeafe;
              color: #1e40af;
              border: 1px solid #93c5fd;
            }
            .status-finalizado {
              background: #d1fae5;
              color: #065f46;
              border: 1px solid #6ee7b7;
            }
            @media print {
              body { padding: 10mm; }
            }
          </style>
        </head>
        <body>
          ${htmlContent}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // ✅ NOVO: Abrir dialog para enviar pedido ao fornecedor
  const abrirDialogEnviarFornecedor = () => {
    setEmailFornecedor(fornecedorSelecionado?.email || '');
    setDialogEnviarFornecedor(true);
  };

  // ✅ NOVO: Confirmar envio após criar pedido
  const confirmarEnvioAposCriacao = () => {
    setDialogConfirmarEnvio(false);
    // Preparar o dialog de envio com o email do fornecedor
    setEmailFornecedor(fornecedorSelecionado?.email || '');
    // Criar objeto pedido temporário para a função de envio funcionar
    if (pedidoCriado) {
      setPedido({ ...pedido, seq_pedido: pedidoCriado.seq_pedido } as any);
    }
    setDialogEnviarFornecedor(true);
  };

  // ✅ NOVO: Cancelar envio e voltar para lista
  const cancelarEnvioAposCriacao = () => {
    setDialogConfirmarEnvio(false);
    setPedidoCriado(null);
    navigate('/compras/pedidos');
  };

  // ✅ NOVO: Enviar pedido ao fornecedor por email
  const enviarPedidoFornecedor = async () => {
    if (!emailFornecedor || !emailFornecedor.trim()) {
      toast.error('Informe o email do fornecedor');
      return;
    }

    // Validar email básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailFornecedor.trim())) {
      toast.error('Email inválido');
      return;
    }

    setEnviandoEmail(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success(`Pedido enviado com sucesso para ${emailFornecedor}`);
        setDialogEnviarFornecedor(false);
        // ✅ Se foi após criação, navegar para lista
        if (pedidoCriado) {
          setPedidoCriado(null);
          setTimeout(() => navigate('/compras/pedidos'), 300);
        }
      } else {
        // BACKEND - O PDF é gerado internamente no backend
        // ✅ Usar pedidoCriado se existir, senão usar pedido
        const seqPedidoEnvio = pedidoCriado?.seq_pedido || pedido?.seq_pedido;
        
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/enviar_pedido_email.php`, {
          method: 'POST',
          body: JSON.stringify({
            seq_pedido: seqPedidoEnvio,
            email_fornecedor: emailFornecedor.trim()
          })
        });

        if (response.success) {
          // ✅ Não exibir toast aqui - mensagem já vem do backend via msg()
          setDialogEnviarFornecedor(false);
          
          // ✅ Se foi após criação, navegar para lista
          if (pedidoCriado) {
            setPedidoCriado(null);
            setTimeout(() => navigate('/compras/pedidos'), 300);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao enviar pedido:', error);
    } finally {
      setEnviandoEmail(false);
    }
  };

  const salvarPedido = async () => {
    // Validações
    if (!fornecedorSelecionado) {
      toast.error('Selecione um fornecedor');
      return;
    }

    if (ordensSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma ordem de compra');
      return;
    }

    // Verificar se todos os itens têm valores informados
    let temItemSemValor = false;
    ordensSelecionadas.forEach(ordem => {
      ordem.itens?.forEach(item => {
        if (!valoresItens[item.seq_item] || valoresItens[item.seq_item] === 0) {
          temItemSemValor = true;
        }
      });
    });

    if (temItemSemValor) {
      toast.error('Informe o valor unitário de todos os itens');
      return;
    }

    setSalvando(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // ✅ Gerar número do pedido mock
        const nroPedidoMock = Math.floor(Math.random() * 1000) + 1;
        const unidadePedido = user?.unidade || 'MTZ';
        const nroPedidoFormatadoMock = unidadePedido + String(nroPedidoMock).padStart(6, '0');
        
        toast.success('Pedido manual criado com sucesso!');
        
        // ✅ Exibir dialog perguntando se quer enviar email
        setPedidoCriado({
          seq_pedido: 999999, // Mock
          nro_pedido_formatado: nroPedidoFormatadoMock
        });
        setDialogConfirmarEnvio(true);
      } else {
        // BACKEND
        const itens = ordensSelecionadas.flatMap(ordem =>
          ordem.itens?.map(item => ({
            seq_item: item.seq_item,
            qtde_item: item.qtde_item,
            vlr_unitario: valoresItens[item.seq_item],
            vlr_total: calcularTotalItem(item.seq_item, item.qtde_item)
          })) || []
        );

        // ✅ COLETAR seq_ordem_compra das ordens selecionadas
        const ordensCompra = ordensSelecionadas.map(ordem => ordem.seq_ordem_compra);

        const payload = {
          unidade: user?.unidade || 'MTZ',
          seq_fornecedor: fornecedorSelecionado.seq_fornecedor,
          seq_orcamento: 0, // Pedido manual
          observacao: observacao.toUpperCase(),
          vlr_total: calcularTotalGeral(),
          itens,
          ordens_compra: ordensCompra // ✅ ENVIAR ORDENS PARA ATUALIZAR seq_pedido
        };

        // ✅ DEBUG: Logar itens antes de enviar
        console.log('🔍 [PedidoForm] PAYLOAD COMPLETO:', payload);
        console.log('🔍 [PedidoForm] ITENS ENVIADOS:', itens);
        itens.forEach((item, index) => {
          console.log(`🔍 [PedidoForm] ITEM ${index}:`, item);
        });

        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php`,
          {
            method: 'POST',
            body: JSON.stringify(payload)
          }
        );

        console.log('🔍 [PedidoForm] DATA RECEBIDO:', data);
        console.log('🔍 [PedidoForm] data.seq_pedido:', data?.seq_pedido);
        console.log('🔍 [PedidoForm] data.nro_pedido_formatado:', data?.nro_pedido_formatado);
        console.log('🔍 [PedidoForm] data.status:', data?.status);

        // ✅ Toast já é exibido automaticamente pelo backend via msg()
        // ✅ Após criar pedido, verificar se necessita aprovação
        if (data?.seq_pedido) {
          console.log('✅ [PedidoForm] ENTRANDO NO IF - Vai exibir dialog!');
          setPedidoCriado({
            seq_pedido: data.seq_pedido,
            nro_pedido_formatado: data.nro_pedido_formatado,
            status: data.status
          });
          
          // ✅ Se status é 'A' (aguardando aprovação), exibir dialog de necessita aprovação
          if (data.status === 'A') {
            setDialogNecessitaAprovacao(true);
          } else {
            // Se não necessita aprovação, exibir dialog perguntando se quer enviar email
            setDialogConfirmarEnvio(true);
          }
        } else {
          console.log('❌ [PedidoForm] NÃO ENTROU NO IF - Navegando direto');
          // Se não retornar seq_pedido (erro ou versão antiga da API), navegar normalmente
          navigate('/compras/pedidos');
        }
      }
    } catch (error) {
      console.error('Erro ao salvar pedido:', error);
      toast.error('Erro ao salvar pedido');
    } finally {
      setSalvando(false);
    }
  };

  const getBadgeStatus = (status: string) => {
    const statusConfig: Record<string, { variant: any; icon: any; label: string; class?: string }> = {
      'A': { variant: 'outline', icon: Hourglass, label: 'AGUARDANDO APROVAÇÃO', class: 'status-aguardando' },
      'AGUARDANDO': { variant: 'outline', icon: Hourglass, label: 'AGUARDANDO APROVAÇÃO', class: 'status-aguardando' },
      'P': { variant: 'default', icon: CheckCircle, label: 'APROVADO', class: 'status-aprovado' },
      'APROVADO': { variant: 'default', icon: CheckCircle, label: 'APROVADO', class: 'status-aprovado' },
      'E': { variant: 'default', icon: Truck, label: 'ENTREGUE', class: 'status-entregue' },
      'ENTREGUE': { variant: 'default', icon: Truck, label: 'ENTREGUE', class: 'status-entregue' },
      'F': { variant: 'default', icon: CheckCircle, label: 'FINALIZADO', class: 'status-finalizado' },
      'FINALIZADO': { variant: 'default', icon: CheckCircle, label: 'FINALIZADO', class: 'status-finalizado' },
      'C': { variant: 'destructive', icon: XCircle, label: 'CANCELADO' },
      'CANCELADO': { variant: 'destructive', icon: XCircle, label: 'CANCELADO' },
    };
    return statusConfig[status] || statusConfig['A'];
  };

  const ordensFiltradas = ordensDisponiveis.filter(ordem => {
    // Filtro de busca textual
    const matchBusca = (ordem.nro_ordem_compra || '').toLowerCase().includes((buscaOrdem || '').toLowerCase()) ||
      (ordem.centro_custo_descricao || '').toLowerCase().includes((buscaOrdem || '').toLowerCase()) ||
      (ordem.observacao || '').toLowerCase().includes((buscaOrdem || '').toLowerCase());
    
    // ✅ Filtro de setor
    const matchSetor = !setorFiltroOrdens || setorFiltroOrdens === '' || 
      ordem.nro_setor?.toString() === setorFiltroOrdens;
    
    return matchBusca && matchSetor;
  });

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
  const totalItens = isVisualizacao 
    ? (itensPedido?.length || 0) // ✅ Garantir que existe
    : ordensSelecionadas.reduce((sum, ordem) => sum + (ordem.itens?.length || 0), 0);

  if (loading) {
    return (
      <AdminLayout title={isVisualizacao ? 'VISUALIZAR PEDIDO' : 'NOVO PEDIDO MANUAL'}>
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  // ========================================
  // MODO VISUALIZAÇÃO
  // ========================================
  if (isVisualizacao && pedido) {
    const statusConfig = getBadgeStatus(pedido.status);
    const StatusIcon = statusConfig.icon;
    
    return (
      <AdminLayout
        title="DETALHES DO PEDIDO"
        description={`Pedido ${pedido.unidade}${String(pedido.nro_pedido).padStart(6, '0')}`}
      >
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Botões de Ação - RESPONSIVO */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <Button variant="outline" onClick={() => navigate('/compras/pedidos')} className="gap-2 w-full sm:w-auto">
              <ArrowLeft className="size-4" />
              Voltar
            </Button>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {pedido.status === 'P' && !isPedidoOrcado && (
                <Button 
                  variant="destructive" 
                  onClick={async () => {
                    if (!confirm('Tem certeza que deseja CANCELAR este pedido manual?\n\n⚠️ ATENÇÃO:\n• O pedido será EXCLUÍDO\n• Os itens do pedido serão REMOVIDOS\n• As ordens de compra voltarão a ficar LIVRES\n\nEsta ação NÃO pode ser desfeita!')) return;
                    
                    try {
                      await apiFetch(
                        `${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php?seq_pedido=${pedido.seq_pedido}`,
                        { method: 'DELETE' }
                      );
                      // ✅ Não exibir toast - mensagem já vem do backend
                      navigate('/compras/pedidos');
                    } catch (error) {
                      console.error('Erro ao cancelar pedido:', error);
                    }
                  }}
                  className="gap-2 w-full sm:w-auto"
                >
                  <XCircle className="size-4" />
                  Cancelar Pedido
                </Button>
              )}

              {/* BOTÃO: Excluir Pedido (apenas se status = 'A' ou 'P' E for manual) */}
              {(pedido.status === 'A' || pedido.status === 'P') && !isPedidoOrcado && (
                <Button 
                  variant="destructive" 
                  onClick={async () => {
                    if (!confirm('Tem certeza que deseja EXCLUIR este pedido manual?\n\n⚠️ ATENÇÃO:\n• O pedido será PERMANENTEMENTE EXCLUÍDO\n• Os itens do pedido serão REMOVIDOS\n• As ordens de compra voltarão a ficar LIVRES\n\nEsta ação NÃO pode ser desfeita!')) return;
                    
                    try {
                      await apiFetch(
                        `${ENVIRONMENT.apiBaseUrl}/compras/pedidos.php?seq_pedido=${pedido.seq_pedido}`,
                        { method: 'DELETE' }
                      );
                      // ✅ Não exibir toast - mensagem já vem do backend
                      navigate('/compras/pedidos');
                    } catch (error) {
                      console.error('Erro ao excluir pedido:', error);
                    }
                  }}
                  className="gap-2 w-full sm:w-auto"
                >
                  <Trash2 className="size-4" />
                  Excluir Pedido
                </Button>
              )}

              {/* BOTÃO: Solicitar Aprovação (apenas se status = 'A') */}
              {pedido.status === 'A' && (
                <Button 
                  onClick={() => setDialogSolicitarAprovacao(true)} 
                  variant="default"
                  className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
                >
                  <UserCheck className="size-4" />
                  Solicitar Aprovação
                </Button>
              )}

              {/* BOTÃO: Aprovar Pedido (apenas se usuário pode aprovar E status = 'A') */}
              {pedido.status === 'A' && user?.aprova_orcamento && (
                <Button 
                  onClick={handleAprovarPedido} 
                  variant="default"
                  className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
                  disabled={aprovandoPedido}
                >
                  {aprovandoPedido ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Aprovando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="size-4" />
                      Aprovar Pedido
                    </>
                  )}
                </Button>
              )}

              {/* BOTÃO: Enviar Pedido */}
              <Button 
                onClick={abrirDialogEnviarFornecedor} 
                variant="default" 
                className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
              >
                <Mail className="size-4" />
                Enviar Pedido
              </Button>
              
              <Button 
                onClick={imprimirPedido} 
                variant="default" 
                className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
              >
                <Printer className="size-4" />
                Imprimir Pedido
              </Button>

              {/* BOTÃO: Duplicar Pedido */}
              <Button 
                onClick={handleDuplicarPedido} 
                className="gap-2 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
                disabled={duplicando}
              >
                {duplicando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Duplicando...
                  </>
                ) : (
                  <>
                    <Copy className="size-4" />
                    Duplicar Pedido
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Card Principal com Header Destaque - RESPONSIVO */}
          <Card className="border-t-4 border-t-blue-500 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:gap-0">
                <div className="flex items-center gap-3 sm:gap-4 w-full lg:w-auto">
                  <div className="p-2 sm:p-3 bg-blue-600 rounded-xl flex-shrink-0">
                    <FileText className="size-6 sm:size-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                      <h2 className="text-2xl sm:text-3xl font-bold text-blue-900 dark:text-blue-100 truncate">
                        {pedido.unidade}{String(pedido.nro_pedido).padStart(6, '0')}
                      </h2>
                      <Badge variant={statusConfig.variant} className="gap-1.5 px-3 py-1 w-fit">
                        <StatusIcon className="size-4" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="size-3 sm:size-4 flex-shrink-0" />
                        <span className="truncate">{formatarData(pedido.data_inclusao)} às {pedido.hora_inclusao}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="size-3 sm:size-4 flex-shrink-0" />
                        <span className="truncate">{(pedido.login_inclusao || '').toLowerCase()}</span>
                      </div>
                      <Badge variant={isPedidoOrcado ? 'default' : 'secondary'} className="gap-1 w-fit">
                        {isPedidoOrcado ? <MapPin className="size-3" /> : <FileText className="size-3" />}
                        {isPedidoOrcado ? 'VIA ORÇAMENTO' : 'MANUAL'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="text-left lg:text-right w-full lg:w-auto">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Valor Total</p>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">
                    R$ {formatarValor(pedido.vlr_total)}
                  </p>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Informações do Pedido */}
                <Card className="bg-gray-50 dark:bg-gray-900">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Info className="size-5 text-blue-600" />
                      Informações do Pedido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium">Número do Pedido</p>
                      <p className="font-bold text-blue-600">{pedido.unidade}{String(pedido.nro_pedido).padStart(6, '0')}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Unidade</p>
                      <p className="font-semibold">{pedido.unidade}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 font-medium">Número de Itens</p>
                      <p className="font-semibold">{itensPedido?.length || 0}</p>
                    </div>
                    {pedido.seq_orcamento > 0 && (
                      <div>
                        <p className="text-gray-500 font-medium">Seq. Orçamento</p>
                        <p className="font-semibold">{pedido.seq_orcamento}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Dados do Fornecedor */}
                <Card className="bg-purple-50 dark:bg-purple-950/20 lg:col-span-2">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="size-5 text-purple-600" />
                      Fornecedor
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <p className="text-gray-500 font-medium">Nome</p>
                      <p className="font-bold text-lg">{fornecedorSelecionado?.nome || 'N/A'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 font-medium">CNPJ</p>
                        <p className="font-semibold">{fornecedorSelecionado?.cnpj || 'N/A'}</p>
                      </div>
                      {fornecedorSelecionado?.telefone && (
                        <div>
                          <p className="text-gray-500 font-medium flex items-center gap-1">
                            <Phone className="size-3" /> Telefone
                          </p>
                          <p className="font-semibold">{fornecedorSelecionado.telefone}</p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {fornecedorSelecionado?.email && (
                        <div>
                          <p className="text-gray-500 font-medium flex items-center gap-1">
                            <Mail className="size-3" /> E-mail
                          </p>
                          <p className="font-semibold text-xs">{fornecedorSelecionado.email}</p>
                        </div>
                      )}
                      {fornecedorSelecionado?.cidade_nome && (
                        <div>
                          <p className="text-gray-500 font-medium flex items-center gap-1">
                            <MapPin className="size-3" /> Cidade
                          </p>
                          <p className="font-semibold">{fornecedorSelecionado.cidade_nome}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          {/* Alerta para pedidos orçados */}
          {isPedidoOrcado && (
            <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <Info className="size-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-blue-900 dark:text-blue-100 text-lg">
                      Este pedido foi gerado via ORÇAMENTO
                    </p>
                    <p className="text-blue-700 dark:text-blue-300 mt-1">
                      Pedidos gerados via orçamento não podem ser editados. Esta é uma visualização apenas para consulta e impressão.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Itens do Pedido */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Package className="size-6 text-blue-600" />
                  Itens do Pedido
                </CardTitle>
                <Badge variant="outline" className="text-base px-3 py-1">
                  {itensPedido?.length || 0} {(itensPedido?.length || 0) === 1 ? 'item' : 'itens'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-600 hover:bg-blue-600">
                      <TableHead className="text-white">Código</TableHead>
                      <TableHead className="text-white">Descrição</TableHead>
                      <TableHead className="text-white text-center">Unid.</TableHead>
                      <TableHead className="text-white text-right">Quantidade</TableHead>
                      <TableHead className="text-white text-right">Vlr. Unitário</TableHead>
                      <TableHead className="text-white text-right">Vlr. Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itensPedido.map((item, index) => (
                      <TableRow key={item.seq_pedido_item} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''}>
                        <TableCell className="font-mono font-semibold">{item.codigo}</TableCell>
                        <TableCell className="font-medium">{item.descricao}</TableCell>
                        <TableCell className="text-center">{item.unidade_medida}</TableCell>
                        <TableCell className="text-right">{Number(item.qtde_item || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">R$ {formatarValor(item.vlr_unitario)}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">
                          R$ {formatarValor(item.vlr_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Total Card */}
              <Card className="mt-6 bg-gradient-to-r from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-2 border-green-500">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <DollarSign className="size-10 text-green-600" />
                      <div>
                        <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                          VALOR TOTAL DO PEDIDO
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-500">
                          Baseado em {itensPedido?.length || 0} {(itensPedido?.length || 0) === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                    </div>
                    <p className="text-4xl font-bold text-green-700 dark:text-green-400">
                      R$ {formatarValor(pedido.vlr_total)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Observações */}
          {pedido.observacao && (
            <Card className="border-l-4 border-l-yellow-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="size-5 text-yellow-600" />
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-lg">
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {pedido.observacao}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conteúdo para Impressão (oculto na tela) */}
          <div className="hidden">
            <div ref={printRef}>
              <div className="header">
                <div className="header-left">
                  <img src={clientLogo} alt="Logo Empresa" className="logo" width="150" height="60" />
                  <div className="header-info">
                    <h1>PEDIDO DE COMPRA</h1>
                    <p>{user?.domain?.toUpperCase() === 'ACV' ? 'PEDIDO DE COMPRA' : `${clientConfig?.name || 'Transportadora'} by PRESTO`}</p>
                  </div>
                </div>
                <div className="header-right">
                  {user?.domain?.toUpperCase() !== 'ACV' && (
                    <img src="https://webpresto.com.br/images/logo_rel.png" alt="Sistema Presto" className="logo-presto" width="100" height="40" />
                  )}
                </div>
              </div>

              <div className="section">
                <div className="pedido-numero">{pedido.unidade}{String(pedido.nro_pedido).padStart(6, '0')}</div>
                <span className="pedido-tipo">{isPedidoOrcado ? 'VIA ORÇAMENTO' : 'MANUAL'}</span>
                {' '}
                <span className={`status-badge ${statusConfig.class}`}>
                  {statusConfig.label}
                </span>
              </div>

              <div className="section">
                <div className="section-title">Informações do Pedido</div>
                <div className="info-row">
                  <div className="info-col">
                    <div className="info-label">Unidade</div>
                    <div className="info-value">{pedido.unidade}</div>
                  </div>
                  <div className="info-col">
                    <div className="info-label">Data de Inclusão</div>
                    <div className="info-value">{formatarData(pedido.data_inclusao)} às {pedido.hora_inclusao}</div>
                  </div>
                  <div className="info-col">
                    <div className="info-label">Usuário</div>
                    <div className="info-value">{(pedido.login_inclusao || '').toLowerCase()}</div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-title">Fornecedor</div>
                <div className="fornecedor-box">
                  <div className="fornecedor-nome">{fornecedorSelecionado?.nome || 'N/A'}</div>
                  <div className="fornecedor-info">
                    <strong>CNPJ:</strong> {fornecedorSelecionado?.cnpj || 'N/A'}
                    {fornecedorSelecionado?.telefone && (
                      <> | <strong>Telefone:</strong> {fornecedorSelecionado.telefone}</>
                    )}
                    {fornecedorSelecionado?.email && (
                      <> | <strong>E-mail:</strong> {fornecedorSelecionado.email}</>
                    )}
                    {fornecedorSelecionado?.cidade_nome && (
                      <> | <strong>Cidade:</strong> {fornecedorSelecionado.cidade_nome}</>
                    )}
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="section-title">Itens do Pedido</div>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '12%' }}>Código</th>
                      <th style={{ width: '38%' }}>Descrição</th>
                      <th style={{ width: '8%' }} className="text-center">Unid.</th>
                      <th style={{ width: '12%' }} className="text-right">Quantidade</th>
                      <th style={{ width: '15%' }} className="text-right">Vlr. Unit. (R$)</th>
                      <th style={{ width: '15%' }} className="text-right">Vlr. Total (R$)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itensPedido.map((item) => (
                      <tr key={item.seq_pedido_item}>
                        <td>{item.codigo}</td>
                        <td>{item.descricao}</td>
                        <td className="text-center">{item.unidade_medida}</td>
                        <td className="text-right">{Number(item.qtde_item || 0).toFixed(2)}</td>
                        <td className="text-right">{formatarValor(item.vlr_unitario)}</td>
                        <td className="text-right"><strong>{formatarValor(item.vlr_total)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pedido.observacao && (
                <div className="section">
                  <div className="section-title">Observações</div>
                  <div className="observacoes">{pedido.observacao}</div>
                </div>
              )}

              <div className="total-section">
                <span className="total-label">VALOR TOTAL DO PEDIDO</span>
                <span className="total-value">R$ {formatarValor(pedido.vlr_total)}</span>
              </div>

              <div className="footer">
                <p>Sistema PRESTO - Gestão de Transportadoras | www.webpresto.com.br</p>
                <p>Impresso em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ Dialog de Envio ao Fornecedor */}
        <Dialog open={dialogEnviarFornecedor} onOpenChange={setDialogEnviarFornecedor}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="size-6 text-blue-600" />
                Enviar Pedido ao Fornecedor
              </DialogTitle>
              <DialogDescription>
                Confirme o email do fornecedor para enviar o pedido em PDF
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email-fornecedor">Email do Fornecedor</Label>
                <Input
                  id="email-fornecedor"
                  type="email"
                  placeholder="fornecedor@empresa.com"
                  value={emailFornecedor}
                  onChange={(e) => setEmailFornecedor(e.target.value)}
                  disabled={enviandoEmail}
                />
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-900">
                <p className="flex items-start gap-2">
                  <Info className="size-4 mt-0.5 flex-shrink-0" />
                  <span>
                    O pedido será enviado em PDF com todos os detalhes exibidos na impressão.
                  </span>
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDialogEnviarFornecedor(false)}
                disabled={enviandoEmail}
              >
                Cancelar
              </Button>
              <Button
                onClick={enviarPedidoFornecedor}
                disabled={enviandoEmail}
                className="gap-2"
              >
                {enviandoEmail ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ✅ Dialog de Confirmação após criar pedido (Duplicação) */}
        <Dialog open={dialogConfirmarEnvio} onOpenChange={(open) => {
          if (!open) {
            cancelarEnvioAposCriacao();
          } else {
            setDialogConfirmarEnvio(open);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="size-6 text-green-600" />
                Pedido Criado com Sucesso!
              </DialogTitle>
              <DialogDescription>
                {pedidoCriado?.nro_pedido_formatado}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deseja enviar o pedido via email para o fornecedor?
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={cancelarEnvioAposCriacao}>Não</Button>
              <Button onClick={confirmarEnvioAposCriacao} className="gap-2">
                <Mail className="size-4" />
                Sim, Enviar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Solicitar Aprovação do Pedido (Duplicação) */}
        <Dialog open={dialogSolicitarAprovacao} onOpenChange={setDialogSolicitarAprovacao}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Aprovação do Pedido</DialogTitle>
              <DialogDescription>
                Selecione o usuário que aprovará este pedido manual
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="aprovador">APROVADOR *</Label>
                <select
                  id="aprovador"
                  value={aprovadorSelecionado}
                  onChange={(e) => setAprovadorSelecionado(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                >
                  <option value="">SELECIONE UM APROVADOR</option>
                  {usuariosAprovadores.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogSolicitarAprovacao(false)} disabled={enviandoAprovacao}>Cancelar</Button>
              <Button onClick={handleSolicitarAprovacao} disabled={enviandoAprovacao || !aprovadorSelecionado}>
                {enviandoAprovacao ? <><Loader2 className="size-4 mr-2 animate-spin" />Enviando...</> : <><Mail className="size-4 mr-2" />Enviar Solicitação</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Pedido Necessita Aprovação (Duplicação) */}
        <Dialog open={dialogNecessitaAprovacao} onOpenChange={setDialogNecessitaAprovacao}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="size-5 text-blue-600" />
                Pedido Criado - Necessita Aprovação
              </DialogTitle>
              <DialogDescription>
                O pedido {pedidoCriado?.nro_pedido_formatado} foi criado com sucesso!
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
                    <p className="text-sm text-gray-500 text-center py-4">Nenhum aprovador disponível</p>
                  ) : (
                    usuariosAprovadores.map(user => (
                      <div key={user.id} className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md">
                        <Checkbox
                          id={`aprovador-criacao-dup-${user.id}`}
                          checked={aprovadoresSelecionados.includes(user.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setAprovadoresSelecionados([...aprovadoresSelecionados, user.id]);
                            else setAprovadoresSelecionados(aprovadoresSelecionados.filter(id => id !== user.id));
                          }}
                        />
                        <label htmlFor={`aprovador-criacao-dup-${user.id}`} className="flex-1 text-sm cursor-pointer">
                          <div className="font-medium">{user.full_name}</div>
                          <div className="text-gray-500 text-xs">{user.email}</div>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setDialogNecessitaAprovacao(false); setPedidoCriado(null); }}>Fechar</Button>
              <Button onClick={handleSolicitarAprovacao} disabled={enviandoAprovacao || aprovadoresSelecionados.length === 0}>
                {enviandoAprovacao ? <><Loader2 className="size-4 mr-2 animate-spin" />Enviando...</> : <><UserCheck className="size-4 mr-2" />Solicitar Aprovação</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    );
  }

  // ========================================
  // MODO CRIAÇÃO (PEDIDO MANUAL)
  // ========================================
  return (
    <AdminLayout
      title="NOVO PEDIDO MANUAL"
      description="Crie um pedido sem passar por orçamento"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Botão Voltar */}
        <Button variant="outline" onClick={() => navigate('/compras/pedidos')} className="gap-2">
          <ArrowLeft className="size-4" />
          Voltar para Listagem
        </Button>

        {/* PASSO 1: Fornecedor */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <User className="size-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle>PASSO 1: Fornecedor</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  Selecione o fornecedor para este pedido
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!fornecedorSelecionado ? (
              <div className="text-center py-8">
                <User className="size-12 mx-auto mb-4 opacity-50 text-gray-500" />
                <p className="text-gray-500 mb-4">Nenhum fornecedor selecionado</p>
                <Button onClick={() => setModalFornecedor(true)} className="gap-2">
                  <Plus className="size-4" />
                  Selecionar Fornecedor
                </Button>
              </div>
            ) : (
              <Card className="border-2 border-purple-200">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{fornecedorSelecionado.nome}</h3>
                      <p className="text-sm text-gray-500">CNPJ: {fornecedorSelecionado.cnpj}</p>
                      {fornecedorSelecionado.email && (
                        <p className="text-sm text-gray-500 mt-1">E-mail: {fornecedorSelecionado.email}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={removerFornecedor}
                      title="Remover"
                    >
                      <X className="size-4 text-red-600" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* PASSO 2: Ordens de Compra */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ShoppingCart className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>PASSO 2: Ordens de Compra</CardTitle>
                  <p className="text-sm text-gray-500 mt-1">
                    Selecione as ordens aprovadas (ORCAR = N)
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
                  />
                </div>
                <Button
                  onClick={() => setModalOrdens(true)}
                  className="gap-2"
                  disabled={!fornecedorSelecionado}
                >
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
                <p className="text-sm mt-1">
                  {!fornecedorSelecionado
                    ? 'Selecione um fornecedor primeiro'
                    : 'Clique em "Adicionar Ordem" para começar'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {ordensSelecionadas.map((ordem) => {
                  // ✅ FORMATAR NÚMERO DA ORDEM: XXX000000
                  const nroOrdemFormatado = `${ordem.unidade}${String(ordem.nro_ordem_compra).padStart(6, '0')}`;
                  
                  return (
                    <Card key={ordem.seq_ordem_compra} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-lg text-foreground">{nroOrdemFormatado}</span>
                              <span className="text-sm text-muted-foreground">
                                {ordem.nro_centro_custo} - {ordem.centro_custo_descricao}
                              </span>
                            </div>
                            {ordem.observacao && (
                              <p className="text-sm text-muted-foreground mt-1">{ordem.observacao}</p>
                            )}
                          </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removerOrdem(ordem.seq_ordem_compra)}
                          title="Remover"
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
                              <TableHead className="text-right">Vlr. Cadastrado (R$)</TableHead>
                              <TableHead className="text-right">Vlr. Negociado (R$)</TableHead>
                              <TableHead className="text-right">Vlr. Total (R$)</TableHead>
                              <TableHead className="text-right">Economia</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ordem.itens?.map((item) => {
                              const vlrCadastrado = (item.vlr_item || 0) * item.qtde_item; // ✅ CORRIGIDO: Valor total cadastrado (vlr_item * qtde)
                              const vlrNegociado = valoresItens[item.seq_item] || 0;
                              const vlrTotalNegociado = vlrNegociado * item.qtde_item; // ✅ Valor total negociado
                              const economia = vlrCadastrado > 0 && vlrTotalNegociado > 0 
                                ? ((vlrCadastrado - vlrTotalNegociado) / vlrCadastrado) * 100 
                                : 0;
                              const economiaValida = !isNaN(economia) && isFinite(economia);
                              
                              return (
                                <TableRow key={item.seq_item}>
                                  <TableCell className="font-medium">{item.codigo}</TableCell>
                                  <TableCell>{item.descricao}</TableCell>
                                  <TableCell className="text-center">{item.unidade_medida}</TableCell>
                                  <TableCell className="text-right">{Number(item.qtde_item || 0).toFixed(2)}</TableCell>
                                  <TableCell className="text-right text-gray-600 font-medium">
                                    {formatarValor(vlrCadastrado)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Input
                                      type="text"
                                      value={valoresItens[item.seq_item]?.toString().replace('.', ',') || '0,00'}
                                      onChange={(e) => atualizarValorItem(item.seq_item, e.target.value)}
                                      className="w-28 text-right ml-auto"
                                      placeholder="0,00"
                                    />
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {formatarValor(calcularTotalItem(item.seq_item, item.qtde_item))}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {economiaValida && vlrCadastrado > 0 && vlrTotalNegociado > 0 ? (
                                      <span className={economia > 0 ? 'text-green-600 font-semibold' : economia < 0 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                                        {economia > 0 ? '+' : ''}{economia.toFixed(2)}%
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">-</span>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}

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
                          <FileText className="size-5 inline mr-2" />
                          {totalItens} {totalItens === 1 ? 'item' : 'itens'}
                        </span>
                      </div>
                      <span className="text-green-700 dark:text-green-400 text-2xl">
                        <DollarSign className="size-6 inline mr-1" />
                        R$ {formatarValor(totalGeral)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
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
              placeholder="INFORMAÇÕES ADICIONAIS SOBRE O PEDIDO..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => navigate('/compras/pedidos')}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            onClick={salvarPedido}
            disabled={salvando || !fornecedorSelecionado || ordensSelecionadas.length === 0}
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
                Criar Pedido Manual
              </>
            )}
          </Button>
        </div>

        {/* Modal de Seleção de Fornecedor */}
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
                    onClick={() => selecionarFornecedor(fornecedor)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold">{fornecedor.nome}</h3>
                          <p className="text-sm text-gray-500">CNPJ: {fornecedor.cnpj}</p>
                          {fornecedor.email && (
                            <p className="text-sm text-gray-500 mt-1">E-mail: {fornecedor.email}</p>
                          )}
                        </div>
                        <Button size="sm" className="gap-2">
                          <Plus className="size-4" />
                          Selecionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {fornecedoresDisponiveis.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <User className="size-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhum fornecedor encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Seleção de Ordens */}
        <Dialog open={modalOrdens} onOpenChange={setModalOrdens}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Selecionar Ordem de Compra</DialogTitle>
              <DialogDescription>
                Apenas ordens aprovadas com compra direta (ORCAR=N)
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
                {ordensFiltradas.map((ordem) => {
                  // ✅ FORMATAR NÚMERO DA ORDEM: XXX000000
                  const nroOrdemFormatado = `${ordem.unidade}${String(ordem.nro_ordem_compra).padStart(6, '0')}`;
                  
                  return (
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
                              <span className="font-bold text-foreground">{nroOrdemFormatado}</span>
                              <span className="text-sm text-muted-foreground">
                                {ordem.nro_centro_custo} - {ordem.centro_custo_descricao}
                              </span>
                            </div>
                            {ordem.observacao && (
                              <p className="text-sm text-muted-foreground mt-1">{ordem.observacao}</p>
                            )}
                            <p className="text-sm text-blue-600 mt-2">
                              {ordem.itens?.length || 0} {ordem.itens?.length === 1 ? 'item' : 'itens'}
                            </p>
                          </div>
                          <Button size="sm" className="gap-2">
                            <Plus className="size-4" />
                            Adicionar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

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

        {/* ✅ Dialog de Confirmação após criar pedido */}
        <Dialog open={dialogConfirmarEnvio} onOpenChange={(open) => {
          if (!open) {
            // ✅ Se fechar o dialog (ESC ou X), navegar para lista
            cancelarEnvioAposCriacao();
          } else {
            setDialogConfirmarEnvio(open);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="size-6 text-green-600" />
                Pedido Criado com Sucesso!
              </DialogTitle>
              <DialogDescription>
                {pedidoCriado?.nro_pedido_formatado}
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deseja enviar o pedido via email para o fornecedor?
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={cancelarEnvioAposCriacao}
              >
                Não
              </Button>
              <Button
                onClick={confirmarEnvioAposCriacao}
                className="gap-2"
              >
                <Mail className="size-4" />
                Sim, Enviar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ✅ Dialog de Envio ao Fornecedor */}
        <Dialog open={dialogEnviarFornecedor} onOpenChange={setDialogEnviarFornecedor}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mail className="size-6 text-blue-600" />
                Enviar Pedido ao Fornecedor
              </DialogTitle>
              <DialogDescription>
                Confirme o email do fornecedor para enviar o pedido em PDF
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email-fornecedor">Email do Fornecedor</Label>
                <Input
                  id="email-fornecedor"
                  type="email"
                  placeholder="fornecedor@empresa.com"
                  value={emailFornecedor}
                  onChange={(e) => setEmailFornecedor(e.target.value)}
                  disabled={enviandoEmail}
                />
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-md border border-blue-200 dark:border-blue-900">
                <p className="flex items-start gap-2">
                  <Info className="size-4 mt-0.5 flex-shrink-0" />
                  <span>
                    O pedido será enviado em PDF com todos os detalhes exibidos na impressão.
                  </span>
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDialogEnviarFornecedor(false)}
                disabled={enviandoEmail}
              >
                Cancelar
              </Button>
              <Button
                onClick={enviarPedidoFornecedor}
                disabled={enviandoEmail}
                className="gap-2"
              >
                {enviandoEmail ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="size-4" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Solicitar Aprovação do Pedido */}
        <Dialog open={dialogSolicitarAprovacao} onOpenChange={setDialogSolicitarAprovacao}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Solicitar Aprovação do Pedido</DialogTitle>
              <DialogDescription>
                Selecione o usuário que aprovará este pedido manual
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="aprovador">APROVADOR *</Label>
                <select
                  id="aprovador"
                  value={aprovadorSelecionado}
                  onChange={(e) => setAprovadorSelecionado(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm mt-1"
                >
                  <option value="">SELECIONE UM APROVADOR</option>
                  {usuariosAprovadores.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => setDialogSolicitarAprovacao(false)}
                disabled={enviandoAprovacao}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSolicitarAprovacao}
                disabled={enviandoAprovacao || !aprovadorSelecionado}
              >
                {enviandoAprovacao ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="size-4 mr-2" />
                    Enviar Solicitação
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog: Pedido Necessita Aprovação */}
        <Dialog open={dialogNecessitaAprovacao} onOpenChange={setDialogNecessitaAprovacao}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Info className="size-5 text-blue-600" />
                Pedido Criado - Necessita Aprovação
              </DialogTitle>
              <DialogDescription>
                O pedido {pedidoCriado?.nro_pedido_formatado} foi criado com sucesso!
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
                          id={`aprovador-criacao-${user.id}`}
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
                          htmlFor={`aprovador-criacao-${user.id}`}
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

            <div className="flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setDialogNecessitaAprovacao(false);
                  setPedidoCriado(null);
                  navigate('/compras/pedidos');
                }}
                disabled={enviandoAprovacao}
              >
                Enviar Depois
              </Button>
              <Button 
                onClick={handleSolicitarAprovacao}
                disabled={enviandoAprovacao || aprovadoresSelecionados.length === 0}
              >
                {enviandoAprovacao ? (
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
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}