import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, location } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
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
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Loader2,
  ArrowLeft,
  CheckCircle,
  MapPin,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Save,
  Edit,
  Users,
  Pencil,
  Printer,
  Package,
  User,
  CreditCard,
  CalendarClock,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { Label } from '../../components/ui/label';
import {
  MOCK_ORCAMENTOS,
  MOCK_ORCAMENTO_COTACOES,
  MOCK_ORDEM_COMPRA_ITENS,
  MOCK_ITENS,
  MOCK_ORCAMENTO_FORNECEDORES,
  MOCK_ORCAMENTO_ORDENS
} from '../../utils/estoqueModData';
import { MOCK_FORNECEDORES } from '../../mocks/estoqueComprasMocks';
import { ModalColetaPrecos } from '../../components/compras/ModalColetaPrecos';
import { DialogEnviarPedidos } from '../../components/compras/DialogEnviarPedidos';

interface ItemMapa {
  seq_item: number;
  seq_ordem_compra: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_item: number;
  vlr_estoque: number;
  cotacoes: CotacaoFornecedor[];
}

interface CotacaoFornecedor {
  seq_fornecedor: number;
  fornecedor_nome: string;
  vlr_fornecedor?: number;
  vlr_total?: number;
  selecionado: string;
  seq_orcamento_cotacao?: number;
}

interface Fornecedor {
  seq_fornecedor: number;
  nome: string;
  email?: string;
  status?: string;
  condicao_pgto?: string;  // ✅ NOVO
  data_prev_ent?: string;  // ✅ NOVO
}

export default function MapaCotacao() {
  const { seq_orcamento } = useParams();
  usePageTitle('Mapa de Cotação');

  const navigate = useNavigate();
  const { user, clientConfig } = useAuth();
  
  // 🚨 CRÍTICO: Logo do cliente DEVE vir da config do domínio
  const clientLogo = clientConfig?.theme?.logo_light || '';

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  
  // ✅ NOVO: Estados para solicitação de aprovação
  const [solicitandoAprovacao, setSolicitandoAprovacao] = useState(false);
  const [dialogSolicitarAprovacao, setDialogSolicitarAprovacao] = useState(false);
  const [usuariosAprovadores, setUsuariosAprovadores] = useState<any[]>([]);
  const [aprovadorSelecionado, setAprovadorSelecionado] = useState<number | null>(null);
  
  // ✅ NOVO: Dialog para perguntar se deseja solicitar aprovação após salvar
  const [dialogPerguntarAprovacao, setDialogPerguntarAprovacao] = useState(false);

  const [orcamento, setOrcamento] = useState<any>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [itensMapa, setItensMapa] = useState<ItemMapa[]>([]);

  // Estado para o dialog de pedidos gerados
  const [dialogPedidos, setDialogPedidos] = useState(false);
  const [pedidosGerados, setPedidosGerados] = useState<any[]>([]);

  // Pedidos gerados na aprovação (quando orçamento já está aprovado)
  const [pedidosAprovacao, setPedidosAprovacao] = useState<any[]>([]);
  
  // ✅ Estado temporário para modal de coleta de preços (se precisar)
  const [fornecedorColeta, setFornecedorColeta] = useState<Fornecedor | null>(null);

  // Função para formatar valores em padrão brasileiro
  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Formatar hora para exibir apenas HH:MM
  const formatarHora = (hora: string): string => {
    if (!hora) return '';
    // Remove segundos e milissegundos, mantém apenas HH:MM
    return hora.substring(0, 5);
  };

  useEffect(() => {
    carregarMapa();
  }, [seq_orcamento]);

  const carregarMapa = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));

        const orcamentoMock = MOCK_ORCAMENTOS.find(o => o.seq_orcamento === Number(seq_orcamento));
        setOrcamento(orcamentoMock);

        // Buscar fornecedores do orçamento
        const fornecedoresMock = MOCK_ORCAMENTO_FORNECEDORES
          .filter(of => of.seq_orcamento === Number(seq_orcamento))
          .map(of => {
            const forn = MOCK_FORNECEDORES.find(f => f.seq_fornecedor === of.seq_fornecedor);
            return {
              seq_fornecedor: of.seq_fornecedor,
              nome: forn?.nome || '',
              email: of.email,
              status: of.status,
              condicao_pgto: of.condicao_pgto,  // ✅ NOVO
              data_prev_ent: of.data_prev_ent   // ✅ NOVO
            };
          });

        setFornecedores(fornecedoresMock);

        // Construir mapa de itens
        const ordensDoOrcamento = MOCK_ORCAMENTO_ORDENS
          .filter(oo => oo.seq_orcamento === Number(seq_orcamento))
          .map(oo => oo.seq_ordem_compra);

        const itensAgrupados: { [key: string]: ItemMapa } = {};

        ordensDoOrcamento.forEach(seqOrdem => {
          const itensOrdem = MOCK_ORDEM_COMPRA_ITENS.filter(oi => oi.seq_ordem_compra === seqOrdem);

          itensOrdem.forEach(itemOrdem => {
            const item = MOCK_ITENS.find(i => i.seq_item === itemOrdem.seq_item);
            const chave = `${itemOrdem.seq_item}-${seqOrdem}`;

            if (!itensAgrupados[chave]) {
              itensAgrupados[chave] = {
                seq_item: itemOrdem.seq_item,
                seq_ordem_compra: seqOrdem,
                codigo: itemOrdem.codigo,
                descricao: itemOrdem.descricao,
                unidade_medida: itemOrdem.unidade_medida,
                qtde_item: itemOrdem.qtde_item,
                vlr_estoque: item?.vlr_item || 0,
                cotacoes: []
              };
            }

            // Adicionar cotações de cada fornecedor para este item
            fornecedoresMock.forEach(forn => {
              const cotacao = MOCK_ORCAMENTO_COTACOES.find(c =>
                c.seq_orcamento === Number(seq_orcamento) &&
                c.seq_fornecedor === forn.seq_fornecedor &&
                c.seq_item === itemOrdem.seq_item &&
                c.seq_ordem_compra === seqOrdem
              );

              // ✅ CORREÇÃO 1: Não preencher valores se a cotação não existir!
              itensAgrupados[chave].cotacoes.push({
                seq_fornecedor: forn.seq_fornecedor,
                fornecedor_nome: forn.nome,
                vlr_fornecedor: cotacao?.vlr_fornecedor || undefined, // undefined ao invés de valor mockado!
                vlr_total: cotacao?.vlr_total || undefined,
                selecionado: cotacao?.selecionado || 'N',
                seq_orcamento_cotacao: cotacao?.seq_orcamento_cotacao
              });
            });
          });
        });

        setItensMapa(Object.values(itensAgrupados));
      } else {
        // BACKEND - Buscar mapa completo
        const dataMapa = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=mapa&seq_orcamento=${seq_orcamento}`,
          { method: 'GET' }
        );

        if (dataMapa.success && dataMapa.data) {
          setOrcamento(dataMapa.data.orcamento);
          setFornecedores(dataMapa.data.fornecedores);
          setItensMapa(dataMapa.data.itens_mapa);
          setPedidosAprovacao(dataMapa.data.pedidos_gerados || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mapa:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirColetaPrecos = (fornecedor: Fornecedor) => {
    // Navegar para a nova tela de coleta de preços
    navigate(`/compras/orcamentos/coleta/${seq_orcamento}/${fornecedor.seq_fornecedor}?origem=mapa`);
  };

  const salvarCotacaoFornecedor = async (cotacoes: any[]) => {
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Cotação salva com sucesso!');
        await carregarMapa();
      } else {
        // BACKEND
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_cotacoes.php`, {
          method: 'POST',
          body: JSON.stringify({
            seq_orcamento: Number(seq_orcamento),
            seq_fornecedor: fornecedorColeta.seq_fornecedor,
            cotacoes
          })
        });

        await carregarMapa();
      }
    } catch (error) {
      console.error('Erro ao salvar cotação:', error);
      throw error;
    }
  };

  const selecionarCotacao = (seqItem: number, seqOrdemCompra: number, seqFornecedor: number) => {
    setItensMapa(prev => prev.map(item => {
      if (item.seq_item === seqItem && item.seq_ordem_compra === seqOrdemCompra) {
        return {
          ...item,
          cotacoes: item.cotacoes.map(c => ({
            ...c,
            selecionado: Number(c.seq_fornecedor) === Number(seqFornecedor) ? 'S' : 'N'
          }))
        };
      }
      return item;
    }));
  };

  const salvarSelecoes = async () => {
    // Informar se há itens sem seleção, mas permitir salvar
    const itensSemSelecao = itensMapa.filter(item =>
      !item.cotacoes.some(c => c.selecionado === 'S' && c.vlr_fornecedor)
    );

    if (itensSemSelecao.length > 0) {
      const confirmar = window.confirm(
        `ATENÇÃO: ${itensSemSelecao.length} item(ns) não possui(em) fornecedor selecionado.\n\nDeseja salvar as escolhas mesmo assim?`
      );
      if (!confirmar) return;
    }

    setSalvando(true);
    try {
      // Coletar TODAS as seleções (seq_item, seq_ordem_compra, seq_fornecedor)
      const selecoes = itensMapa
        .filter(item => item.cotacoes.some(c => c.selecionado === 'S'))
        .map(item => {
          const cotacaoSelecionada = item.cotacoes.find(c => c.selecionado === 'S');
          return {
            seq_item: item.seq_item,
            seq_ordem_compra: item.seq_ordem_compra,
            seq_fornecedor: cotacaoSelecionada?.seq_fornecedor || 0
          };
        });

      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 600));
        // ✅ Não exibir toast aqui, pois o dialog já informa que foi salvo
      } else {
        // BACKEND - Salvar escolhas do mapa
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php`, {
          method: 'PUT',
          body: JSON.stringify({
            action: 'salvar_escolhas_mapa',
            seq_orcamento: Number(seq_orcamento),
            selecoes
          })
        });
      }
      
      // ✅ NOVO: Abrir dialog perguntando se deseja solicitar aprovação
      setDialogPerguntarAprovacao(true);
      
    } catch (error) {
      console.error('Erro ao salvar seleções:', error);
    } finally {
      setSalvando(false);
    }
  };

  // ✅ Função para aprovar orçamento
  const aprovarOrcamento = async () => {
    // ✅ VALIDAÇÃO: Verificar se usuário tem permissão
    if (user?.aprova_orcamento !== true) {
      toast.error('Usuário sem permissão para aprovar orçamentos.');
      return;
    }

    if (!orcamento) return;

    const confirmacao = window.confirm(
      `Tem certeza que deseja APROVAR o orçamento ${orcamento.unidade}${String(orcamento.nro_orcamento).padStart(7, '0')}?\n\nEsta ação não poderá ser desfeita.`
    );

    if (!confirmacao) return;

    setAprovando(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Simular pedidos gerados
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        const pedidosMock = [
          {
            nro_pedido_formatado: 'MTZ000001',
            fornecedor_nome: 'FORNECEDOR MOCK A',
            vlr_total: 1500.00
          },
          {
            nro_pedido_formatado: 'MTZ000002',
            fornecedor_nome: 'FORNECEDOR MOCK B',
            vlr_total: 2300.50
          }
        ];
        
        console.log('📦 Navegando para lista com pedidos MOCK:', pedidosMock);
        navigate('/compras/orcamentos', {
          state: { pedidosGerados: pedidosMock }
        });
      } else {
        // BACKEND - Aprovar orçamento e gerar pedidos
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_aprovacao.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_orcamento: Number(seq_orcamento)
          })
        });

        if (response.success) {
          console.log('📦 Navegando para lista com pedidos BACKEND:', response.pedidos_gerados);
          
          // ✅ Redirecionar IMEDIATAMENTE para a lista com os dados dos pedidos
          navigate('/compras/orcamentos', {
            state: { pedidosGerados: response.pedidos_gerados || [] }
          });
        }
      }
    } catch (error) {
      console.error('Erro ao aprovar orçamento:', error);
    } finally {
      setAprovando(false);
    }
  };
  
  // ✅ NOVO: Solicitar aprovação de orçamento
  const abrirDialogSolicitarAprovacao = async () => {
    // Validar se há itens selecionados
    const itensComSelecao = itensMapa.filter(item =>
      item.cotacoes.some(c => c.selecionado === 'S' && c.vlr_fornecedor)
    );

    if (itensComSelecao.length === 0) {
      toast.error('Selecione pelo menos um fornecedor antes de solicitar aprovação');
      return;
    }

    // Carregar usuários aprovadores
    try {
      setLoading(true);
      
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        const mockUsuarios = [
          { id: 1, username: 'supervisor', full_name: 'SUPERVISOR MOCK', email: 'supervisor@empresa.com' },
          { id: 2, username: 'gerente', full_name: 'GERENTE MOCK', email: 'gerente@empresa.com' },
          { id: 3, username: 'presto', full_name: 'PRESTO ADMIN', email: 'presto@sistema.com' }
        ];
        
        // ✅ CRÍTICO: Filtrar usuário "presto" se o usuário logado não for "presto"
        console.log('🔍 Usuário logado:', user?.username);
        const usuariosFiltrados = mockUsuarios.filter(u => {
          const ehPresto = u.username.toLowerCase() === 'presto';
          const usuarioLogadoEhPresto = user?.username?.toLowerCase() === 'presto';
          const deveExibir = !ehPresto || usuarioLogadoEhPresto;
          console.log(`👤 ${u.username}: ehPresto=${ehPresto}, usuarioLogadoEhPresto=${usuarioLogadoEhPresto}, deveExibir=${deveExibir}`);
          return deveExibir;
        });
        
        console.log('📋 Usuários filtrados:', usuariosFiltrados);
        setUsuariosAprovadores(usuariosFiltrados);
      } else {
        // BACKEND
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/usuarios_aprovadores.php`, {
          method: 'GET'
        });

        if (response.success) {
          // ✅ CRÍTICO: Filtrar usuário "presto" se o usuário logado não for "presto"
          console.log('🔍 Usuário logado:', user?.username);
          const usuariosFiltrados = response.data.filter((u: any) => {
            const ehPresto = u.username.toLowerCase() === 'presto';
            const usuarioLogadoEhPresto = user?.username?.toLowerCase() === 'presto';
            const deveExibir = !ehPresto || usuarioLogadoEhPresto;
            console.log(`👤 ${u.username}: ehPresto=${ehPresto}, usuarioLogadoEhPresto=${usuarioLogadoEhPresto}, deveExibir=${deveExibir}`);
            return deveExibir;
          });
          
          console.log('📋 Usuários filtrados:', usuariosFiltrados);
          setUsuariosAprovadores(usuariosFiltrados);
        }
      }
      
      setDialogSolicitarAprovacao(true);
    } catch (error) {
      console.error('Erro ao carregar aprovadores:', error);
      toast.error('Erro ao carregar usuários aprovadores');
    } finally {
      setLoading(false);
    }
  };

  const enviarSolicitacaoAprovacao = async () => {
    if (!aprovadorSelecionado) {
      toast.error('Selecione um usuário aprovador');
      return;
    }

    setSolicitandoAprovacao(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Solicitação de aprovação enviada com sucesso!');
        setDialogSolicitarAprovacao(false);
        setAprovadorSelecionado(null);
      } else {
        // BACKEND
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_solicitar_aprovacao.php`, {
          method: 'POST',
          body: JSON.stringify({
            seq_orcamento: Number(seq_orcamento),
            usuario_aprovador_id: aprovadorSelecionado
          })
        });

        if (response.success) {
          setDialogSolicitarAprovacao(false);
          setAprovadorSelecionado(null);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar solicitação:', error);
    } finally {
      setSolicitandoAprovacao(false);
    }
  };

  const calcularTotais = () => {
    let totalEstoque = 0;
    let totalSelecionado = 0;

    itensMapa.forEach(item => {
      totalEstoque += item.vlr_estoque * item.qtde_item;
      
      const cotacaoSelecionada = item.cotacoes.find(c => c.selecionado === 'S');
      if (cotacaoSelecionada && cotacaoSelecionada.vlr_fornecedor) {
        totalSelecionado += cotacaoSelecionada.vlr_fornecedor * item.qtde_item;
      }
    });

    const economia = totalEstoque - totalSelecionado;
    const percentual = totalEstoque > 0 ? (economia / totalEstoque) * 100 : 0;

    return { totalEstoque, totalSelecionado, economia, percentual };
  };

  const totais = calcularTotais();
  const podeEditar = orcamento?.status === 'PENDENTE';
  const todosItensComSelecao = itensMapa.every(item =>
    item.cotacoes.some(c => c.selecionado === 'S' && c.vlr_fornecedor)
  );

  // ✅ NOVO: Calcular a melhor data de entrega (mais próxima)
  const melhorDataEntrega = () => {
    const datasValidas = fornecedores
      .filter(f => f.data_prev_ent)
      .map(f => ({ seq_fornecedor: f.seq_fornecedor, data: new Date(f.data_prev_ent!) }))
      .filter(d => !isNaN(d.data.getTime()));
    
    if (datasValidas.length === 0) return null;
    
    const maisProxima = datasValidas.reduce((min, curr) => 
      curr.data < min.data ? curr : min
    );
    
    return maisProxima.seq_fornecedor;
  };

  const fornecedorMelhorData = melhorDataEntrega();

  // ✅ CORREÇÃO 2 e 3: Função de impressão usando o padrão do sistema!
  const imprimirMapa = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    // Construir HTML da tabela
    let tabelaHTML = '';
    itensMapa.forEach((item, index) => {
      let linhaCotacoes = '';
      fornecedores.forEach(forn => {
        const cotacao = item.cotacoes.find(c => Number(c.seq_fornecedor) === Number(forn.seq_fornecedor));
        const temValor = cotacao?.vlr_fornecedor && cotacao.vlr_fornecedor > 0;
        const selecionado = cotacao?.selecionado === 'S';
        
        linhaCotacoes += `
          <td style="padding: 4px; border: 1px solid #d1d5db; text-align: center; background-color: ${selecionado ? '#d1fae5' : (temValor ? '#fff' : '#f3f4f6')}; font-weight: ${selecionado ? 'bold' : 'normal'};">
            ${temValor ? `R$ ${cotacao?.vlr_fornecedor?.toFixed(2)} ${selecionado ? '✓' : ''}` : '-'}
          </td>
        `;
      });

      tabelaHTML += `
        <tr style="background-color: ${index % 2 === 0 ? '#fff' : '#f9fafb'};">
          <td style="padding: 4px; border: 1px solid #d1d5db; font-weight: bold;">${item.codigo}</td>
          <td style="padding: 4px; border: 1px solid #d1d5db; font-size: 7pt;">${item.descricao}</td>
          <td style="padding: 4px; border: 1px solid #d1d5db; text-align: center;">${item.unidade_medida}</td>
          <td style="padding: 4px; border: 1px solid #d1d5db; text-align: right;">${parseFloat(item.qtde_item || 0).toFixed(2)}</td>
          <td style="padding: 4px; border: 1px solid #d1d5db; text-align: right; font-weight: bold;">R$ ${parseFloat(item.vlr_estoque || 0).toFixed(2)}</td>
          ${linhaCotacoes}
        </tr>
      `;
    });

    // Construir linha de totais por fornecedor
    let linhaTotais = '';
    fornecedores.forEach(forn => {
      const totalFornecedor = itensMapa.reduce((sum, item) => {
        const cotacao = item.cotacoes.find(c => Number(c.seq_fornecedor) === Number(forn.seq_fornecedor));
        if (cotacao?.vlr_fornecedor) {
          return sum + (cotacao.vlr_fornecedor * item.qtde_item);
        }
        return sum;
      }, 0);

      linhaTotais += `<td style="padding: 6px 4px; border: 1px solid #d1d5db; text-align: center; background-color: #e5e7eb;">R$ ${totalFornecedor.toFixed(2)}</td>`;
    });

    // Construir cabeçalhos dos fornecedores
    let cabecalhosFornecedores = '';
    fornecedores.forEach(forn => {
      const nomeAbreviado = forn.nome.length > 12 ? forn.nome.substring(0, 12) + '...' : forn.nome;
      cabecalhosFornecedores += `<th style="padding: 6px 4px; border: 1px solid #1e40af; text-align: center; font-size: 6pt;">${nomeAbreviado}</th>`;
    });

    // ✅ NOVO: Construir seção de informações dos fornecedores (condição de pagamento e previsão de entrega)
    let infoFornecedoresHTML = '';
    fornecedores.forEach((forn, index) => {
      const temMelhorData = fornecedorMelhorData === forn.seq_fornecedor;
      const corBorda = temMelhorData ? '#059669' : '#e5e7eb';
      const bgCor = temMelhorData ? '#d1fae5' : '#fff';
      
      infoFornecedoresHTML += `
        <div style="border: 2px solid ${corBorda}; background-color: ${bgCor}; padding: 10px; border-radius: 6px;">
          <h4 style="margin: 0 0 8px 0; font-size: 9pt; color: #1e40af;">${forn.nome}</h4>
          ${forn.condicao_pgto ? `
            <div style="margin-bottom: 6px;">
              <strong style="font-size: 7pt; color: #6b7280;">Condição de Pagamento:</strong>
              <p style="font-size: 8pt; margin: 2px 0 0 0;">${forn.condicao_pgto}</p>
            </div>
          ` : ''}
          ${forn.data_prev_ent ? `
            <div>
              <strong style="font-size: 7pt; color: #6b7280;">Previsão de Entrega:</strong>
              <p style="font-size: 8pt; margin: 2px 0 0 0; ${temMelhorData ? 'color: #059669; font-weight: bold;' : ''}">${new Date(forn.data_prev_ent).toLocaleDateString('pt-BR')}${temMelhorData ? ' ⚡ MELHOR' : ''}</p>
            </div>
          ` : ''}
        </div>
      `;
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mapa de Cotação ${orcamento?.nro_orcamento || ''}</title>
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
              height: 50px;
            }
            .header-info h1 {
              font-size: 18pt;
              font-weight: bold;
              margin: 0;
              color: #1e40af;
            }
            .header-info p {
              font-size: 9pt;
              color: #6b7280;
              margin: 3px 0 0 0;
            }
            .header-right img {
              height: 45px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f3f4f6;
              border-radius: 6px;
            }
            .info-grid strong {
              font-size: 8pt;
              color: #6b7280;
            }
            .info-grid p {
              font-size: 10pt;
              font-weight: bold;
              margin: 2px 0 0 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 8pt;
              margin-bottom: 20px;
            }
            th {
              background-color: #2563eb;
              color: #fff;
              padding: 6px 4px;
              border: 1px solid #1e40af;
              font-weight: bold;
              text-align: left;
            }
            .resumo {
              margin-top: 20px;
              padding: 12px;
              background-color: #eff6ff;
              border-radius: 6px;
              border: 2px solid #2563eb;
            }
            .resumo-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr 1fr;
              gap: 15px;
              font-size: 9pt;
            }
            .resumo-grid strong {
              color: #6b7280;
            }
            .resumo-grid p {
              font-size: 12pt;
              font-weight: bold;
              margin: 3px 0 0 0;
            }
            .info-fornecedores {
              margin-top: 20px;
              margin-bottom: 20px;
            }
            .info-fornecedores h3 {
              font-size: 12pt;
              font-weight: bold;
              margin: 0 0 10px 0;
              color: #1e40af;
            }
            .fornecedores-grid {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
            }
            .footer {
              margin-top: 20px;
              padding-top: 10px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 7pt;
            }
            @media print {
              @page { size: landscape; margin: 10mm; }
              body { padding: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <img src="https://webpresto.com.br/images/logo_rel.png" alt="Sistema Presto" class="logo" />
              <div class="header-info">
                <h1>MAPA DE COTAÇÃO</h1>
                <p>Sistema PRESTO - Gestão de Transportadoras</p>
              </div>
            </div>
            <div class="header-right">
              <img src="${clientLogo}" alt="Logo Empresa" />
            </div>
          </div>

          <div class="info-grid">
            <div>
              <strong>ORÇAMENTO:</strong>
              <p>${orcamento?.nro_orcamento || ''}</p>
            </div>
            <div>
              <strong>STATUS:</strong>
              <p>${orcamento?.status || ''}</p>
            </div>
            <div>
              <strong>DATA:</strong>
              <p>${new Date().toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: left;">Código</th>
                <th style="text-align: left;">Descrição</th>
                <th style="text-align: center;">UN</th>
                <th style="text-align: right;">Qtd.</th>
                <th style="text-align: right;">Vlr. Estoque</th>
                ${cabecalhosFornecedores}
              </tr>
            </thead>
            <tbody>
              ${tabelaHTML}
            </tbody>
            <tfoot>
              <tr style="background-color: #f3f4f6; font-weight: bold;">
                <td colspan="5" style="padding: 6px 4px; border: 1px solid #d1d5db; text-align: right;">TOTAIS:</td>
                ${linhaTotais}
              </tr>
            </tfoot>
          </table>

          <div class="info-fornecedores">
            <h3>Informações dos Fornecedores</h3>
            <div class="fornecedores-grid">
              ${infoFornecedoresHTML}
            </div>
          </div>

          <div class="resumo">
            <div class="resumo-grid">
              <div>
                <strong>Valor Estoque:</strong>
                <p>R$ ${formatarValor(totais.totalEstoque)}</p>
              </div>
              <div>
                <strong>Valor Selecionado:</strong>
                <p style="color: #2563eb;">R$ ${formatarValor(totais.totalSelecionado)}</p>
              </div>
              <div>
                <strong>Economia:</strong>
                <p style="color: ${totais.economia >= 0 ? '#059669' : '#dc2626'};">
                  ${totais.economia >= 0 ? '+' : ''}R$ ${formatarValor(totais.economia)}
                </p>
              </div>
              <div>
                <strong>Percentual:</strong>
                <p style="color: ${totais.percentual >= 0 ? '#059669' : '#dc2626'};">
                  ${totais.percentual >= 0 ? '+' : ''}${totais.percentual.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>

          <div class="footer">
            <p>Impresso em ${new Date().toLocaleDateString('pt-BR')} às ${formatarHora(new Date().toLocaleTimeString('pt-BR'))} - Sistema PRESTO</p>
          </div>
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

  if (loading) {
    return (
      <AdminLayout title="MAPA DE COTAÇÃO">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={`MAPA DE COTAÇÃO - ${orcamento?.unidade || ''}${String(orcamento?.nro_orcamento || '').padStart(6, '0')}`}
      description="Compare preços e selecione os melhores fornecedores"
    >
      {/* CONTEÚDO DA TELA (escondido na impressão) */}
      <div className="max-w-[1600px] mx-auto space-y-6 no-print">
        {/* Cabeçalho com Ações */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <Button variant="outline" onClick={() => navigate(`/compras/orcamentos/editar/${seq_orcamento}`)} className="gap-2">
            <ArrowLeft className="size-4" />
            Voltar
          </Button>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Badge variant={orcamento?.status === 'PENDENTE' ? 'default' : 'secondary'} className="text-sm px-3 py-1">
              {orcamento?.status}
            </Badge>

            {/* ✅ CORREÇÃO 3: Botão de Impressão sempre disponível! */}
            <Button
              onClick={imprimirMapa}
              variant="outline"
              className="gap-2 flex-1 sm:flex-none"
            >
              <Printer className="size-4" />
              <span className="hidden sm:inline">Imprimir Mapa</span>
              <span className="sm:hidden">Imprimir</span>
            </Button>

            {podeEditar && (
              <>
                <Button
                  onClick={salvarSelecoes}
                  disabled={salvando}
                  variant="outline"
                  className="gap-2 flex-1 sm:flex-none"
                >
                  {salvando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      <span className="hidden sm:inline">Salvar Escolhas</span>
                      <span className="sm:hidden">Salvar</span>
                    </>
                  )}
                </Button>

                {/* ✅ NOVO: Botão Solicitar Aprovação (sempre visível se pode editar) */}
                <Button
                  onClick={abrirDialogSolicitarAprovacao}
                  disabled={solicitandoAprovacao}
                  variant="outline"
                  className="gap-2 flex-1 sm:flex-none"
                >
                  {solicitandoAprovacao ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Users className="size-4" />
                      <span className="hidden sm:inline">Solicitar Aprovação</span>
                      <span className="sm:hidden">Solicitar</span>
                    </>
                  )}
                </Button>

                {/* ✅ NOVO: Botão Aprovar - SEMPRE HABILITADO, validação no backend */}
                <Button
                  onClick={aprovarOrcamento}
                  disabled={aprovando}
                  className="gap-2 flex-1 sm:flex-none"
                >
                  {aprovando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Aprovando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="size-4" />
                      <span className="hidden sm:inline">Aprovar Orçamento</span>
                      <span className="sm:hidden">Aprovar</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Card de Resumo do Orçamento */}
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
                  {orcamento?.unidade || ''}{String(orcamento?.nro_orcamento || '').padStart(6, '0')}
                </p>
              </div>

              {/* Total de Itens */}
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Itens</Label>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {itensMapa.length} {itensMapa.length === 1 ? 'item' : 'itens'}
                </p>
                <p className="text-sm text-gray-500">para cotação</p>
              </div>

              {/* Total de Fornecedores */}
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Fornecedores</Label>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {fornecedores.length} {fornecedores.length === 1 ? 'fornecedor' : 'fornecedores'}
                </p>
              </div>

              {/* Data/Hora/Usuário Inclusão */}
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Criado em</Label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {orcamento?.data_inclusao && new Date(orcamento.data_inclusao).toLocaleDateString('pt-BR')} {formatarHora(orcamento?.hora_inclusao || '')}
                </p>
                <p className="text-sm text-gray-500">por {orcamento?.login_inclusao?.toLowerCase() || ''}</p>
              </div>
            </div>

            {/* ✅ Informações de Aprovação (quando status = APROVADO) */}
            {orcamento?.status === 'APROVADO' && (
              <div className="mt-6 pt-6 border-t border-blue-300 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="size-5 text-green-600" />
                  <h3 className="font-bold text-green-700 dark:text-green-400">Orçamento Aprovado</h3>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-4">
                  {/* Data de Aprovação */}
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Data de Aprovação</Label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {orcamento?.data_aprovacao && new Date(orcamento.data_aprovacao).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {/* Hora de Aprovação */}
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Hora de Aprovação</Label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatarHora(orcamento?.hora_aprovacao || '')}
                    </p>
                  </div>

                  {/* Usuário que Aprovou */}
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Aprovado por</Label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {orcamento?.login_aprovacao?.toLowerCase() || ''}
                    </p>
                  </div>

                  {/* Quantidade de Pedidos */}
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400">Pedidos Gerados</Label>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {pedidosAprovacao.length} {pedidosAprovacao.length === 1 ? 'pedido' : 'pedidos'}
                    </p>
                  </div>
                </div>

                {/* Lista de Pedidos Gerados */}
                {pedidosAprovacao.length > 0 && (
                  <div>
                    <Label className="text-xs text-gray-600 dark:text-gray-400 mb-2 block">Pedidos:</Label>
                    
                    {/* Versão Desktop - Cards Inline */}
                    <div className="hidden sm:flex flex-wrap gap-2">
                      {pedidosAprovacao.map((pedido, index) => (
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

                    {/* Versão Mobile - Cards Verticais */}
                    <div className="sm:hidden space-y-2">
                      {pedidosAprovacao.map((pedido, index) => (
                        <div
                          key={index}
                          className="flex flex-col gap-2 px-3 py-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-300 dark:border-green-700"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="size-4 text-green-700 dark:text-green-400" />
                            <span className="font-mono font-bold text-sm text-green-700 dark:text-green-400">
                              {pedido.nro_pedido_formatado}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 pl-6">
                            {pedido.fornecedor_nome}
                          </div>
                          <div className="text-xs font-bold text-green-600 pl-6">
                            R$ {formatarValor(pedido.vlr_total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card de Fornecedores - Coleta de Preços */}
        {podeEditar && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Users className="size-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>Fornecedores Participantes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {fornecedores.map(fornecedor => {
                  const qtdCotacoes = itensMapa.reduce((count, item) => {
                    const cotacao = item.cotacoes.find(c => Number(c.seq_fornecedor) === Number(fornecedor.seq_fornecedor));
                    return count + (cotacao && cotacao.vlr_fornecedor != null ? 1 : 0);
                  }, 0);

                  const totalItens = itensMapa.length;
                  const statusConcluido = qtdCotacoes === totalItens && totalItens > 0;
                  const temMelhorData = fornecedorMelhorData === fornecedor.seq_fornecedor;

                  return (
                    <Card key={fornecedor.seq_fornecedor} className={`border-2 ${temMelhorData ? 'border-green-500 bg-green-50/50 dark:bg-green-950/20' : ''}`}>
                      <CardContent className="pt-4">
                        <div className="space-y-3">
                          <div>
                            <h3 className="font-bold text-sm line-clamp-2">{fornecedor.nome}</h3>
                            <p className="text-xs text-gray-500">
                              {qtdCotacoes} de {totalItens} itens cotados
                            </p>
                          </div>

                          {/* ✅ Condição de Pagamento e Previsão de Entrega - SEMPRE VISÍVEL */}
                          <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-start gap-2">
                              <CreditCard className="size-4 text-blue-600 mt-0.5 flex-shrink-0" />
                              <div className="flex-1">
                                <p className="text-xs text-gray-500">Condição de Pagamento</p>
                                <p className="text-xs font-medium text-gray-900 dark:text-white">
                                  {fornecedor.condicao_pgto || '-'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <CalendarClock className={`size-4 mt-0.5 flex-shrink-0 ${temMelhorData ? 'text-green-600' : 'text-orange-600'}`} />
                              <div className="flex-1">
                                <p className="text-xs text-gray-500">Previsão de Entrega</p>
                                <div className="flex items-center gap-2">
                                  <p className={`text-xs font-medium ${temMelhorData ? 'text-green-700 dark:text-green-400 font-bold' : 'text-gray-900 dark:text-white'}`}>
                                    {fornecedor.data_prev_ent ? new Date(fornecedor.data_prev_ent).toLocaleDateString('pt-BR') : '-'}
                                  </p>
                                  {temMelhorData && (
                                    <Badge variant="default" className="text-xs bg-green-600 px-1.5 py-0">
                                      ⚡ Melhor
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => abrirColetaPrecos(fornecedor)}
                              className="flex-1 gap-2"
                            >
                              <Edit className="size-3" />
                              Informar Preços
                            </Button>

                            {statusConcluido && (
                              <Badge variant="default" className="text-xs bg-green-600">
                                ✓ Concluído
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mapa de Cotações */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <MapPin className="size-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle>Mapa de Cotações</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Código</TableHead>
                    <TableHead className="min-w-[200px]">Descrição</TableHead>
                    <TableHead className="text-center w-20">UN</TableHead>
                    <TableHead className="text-right w-24">Qtd.</TableHead>
                    <TableHead className="text-right w-32">Vlr. Est.</TableHead>
                    {fornecedores.map(forn => (
                      <TableHead key={forn.seq_fornecedor} className="text-center w-28">
                        <div className="font-bold text-xs truncate" title={forn.nome}>
                          {forn.nome.length > 15 ? forn.nome.substring(0, 15) + '...' : forn.nome}
                        </div>
                        <div className="text-xs font-normal text-gray-500">Valor</div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itensMapa.map((item, index) => (
                    <TableRow key={`${item.seq_item}-${item.seq_ordem_compra}`}>
                      <TableCell className="font-medium">{item.codigo}</TableCell>
                      <TableCell className="max-w-xs">{item.descricao}</TableCell>
                      <TableCell className="text-center">{item.unidade_medida}</TableCell>
                      <TableCell className="text-right">{parseFloat(item.qtde_item || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {parseFloat(item.vlr_estoque || 0).toFixed(2)}
                      </TableCell>
                      {fornecedores.map(forn => {
                        const cotacao = item.cotacoes.find(c => Number(c.seq_fornecedor) === Number(forn.seq_fornecedor));
                        const temValor = cotacao && cotacao.vlr_fornecedor != null && cotacao.vlr_fornecedor > 0;
                        
                        const economia = temValor
                          ? ((item.vlr_estoque - (cotacao?.vlr_fornecedor || 0)) / item.vlr_estoque) * 100
                          : 0;

                        return (
                          <TableCell
                            key={forn.seq_fornecedor}
                            className={`text-center cursor-pointer transition-colors ${
                              cotacao?.selecionado === 'S'
                                ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500'
                                : temValor
                                ? 'hover:bg-gray-100 dark:hover:bg-gray-800'
                                : 'bg-gray-50 dark:bg-gray-900/20'
                            }`}
                            onClick={() => {
                              if (podeEditar && temValor) {
                                selecionarCotacao(item.seq_item, item.seq_ordem_compra, forn.seq_fornecedor);
                              }
                            }}
                          >
                            {temValor ? (
                              <div className="space-y-1">
                                <div className="font-bold text-sm">
                                  R$ {cotacao?.vlr_fornecedor?.toFixed(2)}
                                </div>
                                <div className="flex items-center justify-center gap-1">
                                  {economia >= 0 ? (
                                    <TrendingDown className="size-3 text-green-600" />
                                  ) : (
                                    <TrendingUp className="size-3 text-red-600" />
                                  )}
                                  <span className={`text-xs ${economia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {economia.toFixed(1)}%
                                  </span>
                                </div>
                                {cotacao?.selecionado === 'S' && (
                                  <CheckCircle className="size-4 mx-auto text-green-600" />
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Card de Totais */}
        <Card className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950/20 dark:to-green-950/20 border-2">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Valor Estoque</p>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                  R$ {formatarValor(totais.totalEstoque)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Valor Selecionado</p>
                <p className="text-2xl font-bold text-blue-600">
                  R$ {formatarValor(totais.totalSelecionado)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Economia / Acréscimo</p>
                <p className={`text-2xl font-bold ${totais.economia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totais.economia >= 0 ? '+' : ''}R$ {formatarValor(totais.economia)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-1">Percentual</p>
                <p className={`text-2xl font-bold ${totais.percentual >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totais.percentual >= 0 ? '+' : ''}{totais.percentual.toFixed(1)}%
                </p>
              </div>
            </div>

            {!todosItensComSelecao && podeEditar && (
              <div className="mt-4 p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg text-center">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  ⚠️ Selecione um fornecedor para todos os itens antes de aprovar o orçamento
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Resumo dos Pedidos Gerados */}
      <Dialog open={dialogPedidos} onOpenChange={setDialogPedidos}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-6 text-green-600" />
              Orçamento Aprovado!
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              <strong>Pedidos gerados:</strong>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {pedidosGerados.map((pedido, index) => {
                const nroPedidoFormatado = `${pedido.unidade}${String(pedido.nro_pedido).padStart(7, '0')}`;
                const valor = `R$ ${formatarValor(pedido.vlr_total)}`;
                const separador = index === pedidosGerados.length - 1 ? '' : index === pedidosGerados.length - 2 ? ' e ' : ', ';
                return `${nroPedidoFormatado} (${valor})${separador}`;
              }).join('')}
            </p>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              onClick={() => {
                setDialogPedidos(false);
                navigate('/compras/orcamentos');
              }}
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ NOVO: Dialog perguntando se deseja solicitar aprovação após salvar */}
      <Dialog open={dialogPerguntarAprovacao} onOpenChange={setDialogPerguntarAprovacao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="size-6 text-green-600" />
              Escolhas Salvas
            </DialogTitle>
            <DialogDescription>
              As escolhas do mapa foram salvas com sucesso!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Deseja solicitar a aprovação deste orçamento agora?
            </p>

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogPerguntarAprovacao(false)}
              >
                Não, Agora Não
              </Button>
              <Button
                onClick={() => {
                  setDialogPerguntarAprovacao(false);
                  abrirDialogSolicitarAprovacao();
                }}
              >
                <Users className="size-4 mr-2" />
                Sim, Solicitar Aprovação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ NOVO: Dialog de Solicitar Aprovação */}
      <Dialog open={dialogSolicitarAprovacao} onOpenChange={setDialogSolicitarAprovacao}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="size-6 text-blue-600" />
              Solicitar Aprovação de Orçamento
            </DialogTitle>
            <DialogDescription>
              Selecione o usuário que irá aprovar este orçamento
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Lista de Usuários Aprovadores */}
            <div className="space-y-2">
              <Label>Usuários Aprovadores</Label>
              <div className="max-h-[400px] overflow-y-auto space-y-2 border rounded-lg p-3">
                {usuariosAprovadores.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Nenhum usuário aprovador disponível
                  </p>
                ) : (
                  usuariosAprovadores.map(usuario => (
                    <div
                      key={usuario.id}
                      onClick={() => setAprovadorSelecionado(usuario.id)}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        aprovadorSelecionado === usuario.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${
                          aprovadorSelecionado === usuario.id
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}>
                          <User className="size-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm">{usuario.full_name}</p>
                          <p className="text-xs text-gray-500">
                            {usuario.username} • {usuario.email}
                          </p>
                        </div>
                        {aprovadorSelecionado === usuario.id && (
                          <CheckCircle className="size-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setDialogSolicitarAprovacao(false);
                  setAprovadorSelecionado(null);
                }}
                disabled={solicitandoAprovacao}
              >
                Cancelar
              </Button>
              <Button
                onClick={enviarSolicitacaoAprovacao}
                disabled={solicitandoAprovacao || !aprovadorSelecionado}
                className="gap-2"
              >
                {solicitandoAprovacao ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="size-4" />
                    Enviar Solicitação
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}