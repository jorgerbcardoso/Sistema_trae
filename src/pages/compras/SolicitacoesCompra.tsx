import { useState, useEffect, useRef } from 'react';
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
  Clock,
  Calendar,
  User,
  Printer,
  FileSpreadsheet,
  FileText,
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
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { FilterSelectVeiculo } from '../../components/dashboards/FilterSelectVeiculo';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { formatCodigoCentroCusto, formatarNumeroSolicitacao } from '../../utils/formatters';
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
  status: 'P' | 'A' | 'R'; // P = PENDENTE, A = ATENDIDA, R = REPROVADA
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

  const { user, clientConfig } = useAuth();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState(() => {
    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(hoje.getDate() - 3);
    return dataInicio.toISOString().split('T')[0];
  });
  
  const [filtroDataFim, setFiltroDataFim] = useState(() => {
    const hoje = new Date();
    return hoje.toISOString().split('T')[0];
  });
  const [filtroSetor, setFiltroSetor] = useState<number | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<'TODAS' | 'ATENDIDAS' | 'PENDENTES' | 'REPROVADAS'>('TODAS');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  // Hook de ordenação
  type SortField = 'seq_solicitacao_compra' | 'data_inclusao' | 'centro_custo_descricao' | 'qtd_itens';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  // ✅ FORÇAR UNIDADE DO USUÁRIO (SE NÃO-MTZ)
  useEffect(() => {
    const unidadeAtual = user?.unidade_atual || user?.unidade || 'MTZ';
    const unidadeAtualUpper = unidadeAtual.toUpperCase();
    const isMtzOrAll = unidadeAtualUpper === 'MTZ' || unidadeAtualUpper === 'ALL';
    
    if (!isMtzOrAll) {
      setFiltroUnidade(unidadeAtual);
    }
  }, [user]);

  useEffect(() => {
    carregarSolicitacoes();
  }, [filtroUnidade, filtroDataInicio, filtroDataFim, filtroSetor, filtroStatus]);

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

        // Aplicar filtros no MOCK (para simular comportamento real)
        const filtradas = mockSolicitacoes.filter(sol => {
          if (filtroUnidade && filtroUnidade !== 'ALL' && sol.unidade !== filtroUnidade) return false;
          if (filtroDataInicio && sol.data_inclusao < filtroDataInicio) return false;
          if (filtroDataFim && sol.data_inclusao > filtroDataFim) return false;
          if (filtroSetor && sol.nro_setor !== filtroSetor) return false;
          
          // PENDENTES = P, ATENDIDAS = A, REPROVADAS = R
          if (filtroStatus === 'ATENDIDAS' && sol.status !== 'A') return false;
          if (filtroStatus === 'PENDENTES' && sol.status !== 'P') return false;
          if (filtroStatus === 'REPROVADAS' && sol.status !== 'R') return false;
          
          return true;
        });

        setSolicitacoes(filtradas);
      } else {
        // BACKEND
        const queryParams = new URLSearchParams();
        if (filtroUnidade) queryParams.append('unidade', filtroUnidade);
        if (filtroDataInicio) queryParams.append('data_inicio', filtroDataInicio);
        if (filtroDataFim) queryParams.append('data_fim', filtroDataFim);
        if (filtroSetor) queryParams.append('nro_setor', filtroSetor.toString());
        if (filtroStatus) queryParams.append('status', filtroStatus);

        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php?${queryParams.toString()}`, {
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
        // ✅ Filtrar usuário 'presto' da lista de aprovadores (mesmo no mock)
        const aprovadoresFiltrados = mockUsuarios.filter(u => u.username.toLowerCase() !== 'presto');
        setUsuariosSetor(aprovadoresFiltrados);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/usuarios_setor.php?nro_setor=${solicitacao.nro_setor}`,
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
          setUsuariosSetor(aprovadoresFiltrados);
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
  const solicitacoesFiltradas = solicitacoes;

  // ✅ Função de Impressão (Baseada no padrão de Pedidos)
  const imprimirSolicitacao = () => {
    const printContent = printRef.current;
    if (!printContent || !solicitacaoDetalhes) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    // Logo do cliente e Presto
    const logoUrl = user?.domain?.toUpperCase() === 'ACV' 
      ? 'https://webpresto.com.br/images/logos_clientes/aceville.png'
      : 'https://webpresto.com.br/images/logo_rel.png';
    
    // Obter HTML do conteúdo oculto
    let htmlContent = printContent.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Solicitação ${formatarNumeroSolicitacao(solicitacaoDetalhes.unidade, solicitacaoDetalhes.seq_solicitacao_compra)}</title>
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
              max-width: 180px;
              max-height: 60px;
              object-fit: contain;
            }
            .header-info h1 {
              font-size: 16pt;
              color: #2563eb;
              margin-bottom: 3px;
              text-transform: uppercase;
            }
            .header-info p {
              font-size: 10pt;
              color: #666;
            }
            .header-right {
              text-align: right;
            }
            .header-right img {
              max-width: 100px;
              max-height: 45px;
            }
            .documento-numero {
              font-size: 20pt;
              font-weight: bold;
              color: #1e40af;
              margin-bottom: 5px;
              font-family: monospace;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 9pt;
              font-weight: bold;
              text-transform: uppercase;
            }
            .status-pendente {
              background: #fef3c7;
              color: #92400e;
              border: 1px solid #fcd34d;
            }
            .status-atendida {
              background: #d1fae5;
              color: #065f46;
              border: 1px solid #6ee7b7;
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
            .info-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 10px;
            }
            .info-item {
              margin-bottom: 8px;
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
              font-weight: 500;
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
              padding: 8px 10px;
              text-align: left;
              font-size: 9pt;
              text-transform: uppercase;
            }
            td {
              border: 1px solid #e5e7eb;
              padding: 8px 10px;
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
            .observacoes-box {
              background: #f9fafb;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              font-size: 9pt;
              line-height: 1.5;
              color: #374151;
              min-height: 60px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 15px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 8pt;
            }
            @media print {
              body { padding: 10mm; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <img src="${logoUrl}" alt="Sistema Presto" class="logo" />
              <div class="header-info">
                <h1>Solicitação de Compra</h1>
                <p>Sistema de Gestão</p>
              </div>
            </div>
            <div class="header-right">
              <div class="documento-numero">${formatarNumeroSolicitacao(solicitacaoDetalhes.unidade, solicitacaoDetalhes.seq_solicitacao_compra)}</div>
              <div class="status-badge ${solicitacaoDetalhes.status === 'A' ? 'status-atendida' : 'status-pendente'}">
                ${solicitacaoDetalhes.status === 'A' ? 'ATENDIDA' : 'PENDENTE DE APROVAÇÃO'}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Informações Gerais</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Data de Inclusão</div>
                <div class="info-value">${new Date(solicitacaoDetalhes.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')} às ${solicitacaoDetalhes.hora_inclusao?.substring(0, 5)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Usuário Solicitante</div>
                <div class="info-value">${solicitacaoDetalhes.login_inclusao?.toUpperCase()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Centro de Custo</div>
                <div class="info-value">
                  ${formatCodigoCentroCusto(solicitacaoDetalhes.centro_custo_unidade || '', solicitacaoDetalhes.centro_custo_nro || '')} - ${solicitacaoDetalhes.centro_custo_descricao}
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Setor Responsável</div>
                <div class="info-value">${solicitacaoDetalhes.setor_descricao || '-'}</div>
              </div>
              ${solicitacaoDetalhes.placa ? `
              <div class="info-item">
                <div class="info-label">Veículo / Placa</div>
                <div class="info-value">${solicitacaoDetalhes.placa}</div>
              </div>
              ` : ''}
              ${solicitacaoDetalhes.nro_ordem_compra ? `
              <div class="info-item">
                <div class="info-label">Ordem de Compra Gerada</div>
                <div class="info-value">${solicitacaoDetalhes.nro_ordem_compra}</div>
              </div>
              ` : ''}
            </div>
          </div>

          <div class="section">
            <div class="section-title">Itens da Solicitação</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 60px;" class="text-center">#</th>
                  <th>Descrição do Item</th>
                  <th style="width: 120px;" class="text-right">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                ${itensDetalhes.map((item, index) => `
                  <tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${item.item}</td>
                    <td class="text-right">${item.qtde_item}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Observações</div>
            <div class="observacoes-box">
              ${solicitacaoDetalhes.observacao || 'NENHUMA OBSERVAÇÃO INFORMADA.'}
            </div>
          </div>

          <div class="footer">
            Documento gerado em ${new Date().toLocaleString('pt-BR')} por ${user?.username?.toUpperCase()}<br/>
            © 2026 Sistema Presto - Gestão Inteligente
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

  // ✅ Função de Exportação para Excel (Baseada em RelatorioMovimentacao)
  const exportarExcel = async () => {
    if (solicitacoes.length === 0) {
      toast.error('Não há dados para exportar');
      return;
    }

    try {
      setLoading(true);

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Relatório Excel gerado com sucesso!');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${ENVIRONMENT.apiBaseUrl}/compras/exportar_solicitacoes.php`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            filters: {
              unidade: filtroUnidade,
              data_inicio: filtroDataInicio,
              data_fim: filtroDataFim,
              nro_setor: filtroSetor,
              status: filtroStatus
            },
            solicitacoes: sortData(solicitacoes),
            usuario_logado: user?.username
          })
        }
      );

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao gerar planilha');
      }

      if (!response.ok) throw new Error('Erro ao exportar planilha');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solicitacoes_compra_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Relatório Excel gerado com sucesso!');
    } catch (error: any) {
      console.error('Erro ao exportar Excel:', error);
      toast.error(error.message || 'Erro ao exportar planilha Excel');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Função de Impressão da Listagem (PDF Relatório)
  const imprimirListagem = () => {
    if (solicitacoes.length === 0) {
      toast.error('Não há dados para imprimir');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    const logoEmpresa = clientConfig?.theme?.logo_light || '';
    const isAceville = user?.domain?.toUpperCase() === 'ACV';
    const dataInicio = filtroDataInicio ? new Date(filtroDataInicio + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
    const dataFim = filtroDataFim ? new Date(filtroDataFim + 'T00:00:00').toLocaleDateString('pt-BR') : '-';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Solicitações de Compra</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body { font-family: Arial, sans-serif; font-size: 8pt; color: #000; }
          .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #2563eb; padding-bottom: 8px; margin-bottom: 10px; }
          .header-left { display: flex; align-items: center; gap: 10px; }
          .logo { max-width: 80px; max-height: 35px; }
          .header-info h1 { font-size: 12pt; color: #2563eb; margin: 0; text-transform: uppercase; }
          .header-info p { font-size: 7pt; color: #666; margin: 0; }
          .header-right { text-align: right; }
          .header-right img { max-width: 100px; max-height: 40px; }
          .filters-bar { background: #f3f4f6; padding: 5px 10px; border-radius: 4px; margin-bottom: 10px; display: flex; justify-content: space-between; font-size: 7pt; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #1e40af; color: white; padding: 6px 4px; text-align: left; font-size: 7pt; text-transform: uppercase; border: 1px solid #1e3a8a; }
          td { border: 1px solid #e5e7eb; padding: 5px 4px; vertical-align: middle; }
          tr:nth-child(even) { background: #f9fafb; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-mono { font-family: monospace; }
          .badge { padding: 2px 6px; border-radius: 10px; font-size: 6pt; font-weight: bold; text-transform: uppercase; }
          .badge-pendente { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
          .badge-atendida { background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7; }
          .badge-reprovada { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
          .footer { margin-top: 10px; padding-top: 5px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 6pt; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="${isAceville ? logoEmpresa : '/sistema/logo-presto.png'}" class="logo" />
            <div class="header-info">
              <h1>Relatório de Solicitações de Compra</h1>
              <p>Sistema PRESTO - Gestão Inteligente</p>
            </div>
          </div>
          <div class="header-right">
            <p style="font-size: 10pt; font-weight: bold; color: #1e40af;">LISTAGEM GERAL</p>
            <p style="font-size: 7pt; color: #666;">Gerado em ${new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>

        <div class="filters-bar">
          <div>
            <strong>Período:</strong> ${dataInicio} a ${dataFim} | 
            <strong>Unidade:</strong> ${filtroUnidade || 'TODAS'} | 
            <strong>Status:</strong> ${filtroStatus} |
            <strong>Solicitações do usuário:</strong> ${user?.username?.toUpperCase()}
          </div>
          <div>Total: ${solicitacoes.length} registros</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Número</th>
              <th style="width: 70px;">Data</th>
              <th>Centro de Custo</th>
              <th>Setor</th>
              <th style="width: 80px;">Placa</th>
              <th style="width: 50px;" class="text-center">Itens</th>
              <th style="width: 80px;" class="text-center">O.C.</th>
              <th style="width: 80px;" class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${sortData(solicitacoes).map(sol => `
              <tr>
                <td class="font-mono">${formatarNumeroSolicitacao(sol.unidade, sol.seq_solicitacao_compra)}</td>
                <td>${new Date(sol.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td>${formatCodigoCentroCusto(sol.centro_custo_unidade || '', sol.centro_custo_nro || '')} - ${sol.centro_custo_descricao}</td>
                <td>${sol.setor_descricao || '-'}</td>
                <td class="font-mono">${sol.placa || '-'}</td>
                <td class="text-center">${sol.qtd_itens}</td>
                <td class="text-center font-mono">${sol.nro_ordem_compra || '-'}</td>
                <td class="text-center">
                  <span class="badge ${sol.status === 'A' ? 'badge-atendida' : sol.status === 'R' ? 'badge-reprovada' : 'badge-pendente'}">
                    ${sol.status === 'A' ? 'Atendida' : sol.status === 'R' ? 'Reprovada' : 'Pendente'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Documento gerado por ${user?.username?.toUpperCase()} | © 2026 Sistema Presto
        </div>

        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              window.close();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
  };

  // Limpar filtros
  const limparFiltros = () => {
    // Restaurar período padrão (últimos 3 dias)
    const hoje = new Date();
    const dataInicio = new Date(hoje);
    dataInicio.setDate(hoje.getDate() - 3);
    
    const unidadeOriginal = user?.unidade_atual || user?.unidade || 'MTZ';
    const isMtzOrAll = unidadeOriginal.toUpperCase() === 'MTZ' || unidadeOriginal.toUpperCase() === 'ALL';

    setFiltroUnidade(isMtzOrAll ? '' : unidadeOriginal);
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ClipboardList className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Minhas Solicitações</CardTitle>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {solicitacoes.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportarExcel}
                      disabled={loading}
                      className="gap-2 border-green-200 hover:bg-green-50 dark:border-green-900 dark:hover:bg-green-900/20 text-green-700 dark:text-green-400"
                    >
                      <FileSpreadsheet className="size-4" />
                      Excel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={imprimirListagem}
                      disabled={loading}
                      className="gap-2 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                    >
                      <FileText className="size-4" />
                      Relatório PDF
                    </Button>
                  </>
                )}
                <Button onClick={abrirModalNovaSolicitacao} className="gap-2 ml-2">
                  <Plus className="size-4" />
                  Nova Solicitação
                </Button>
              </div>
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
                
                {(filtroDataInicio || filtroDataFim || filtroSetor || filtroStatus !== 'TODAS' || filtroUnidade) && (
                  <Button variant="ghost" onClick={limparFiltros} className="text-sm">
                    Limpar Filtros
                  </Button>
                )}
              </div>

              {mostrarFiltros && (
                <Card className="p-4 bg-gray-50 dark:bg-gray-900">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    {/* Unidade */}
                    <div>
                      <Label className="text-sm mb-2 block">Unidade</Label>
                      <FilterSelectUnidadeSingle
                        value={filtroUnidade}
                        onChange={setFiltroUnidade}
                        placeholder="Todas as unidades"
                        disabled={user?.unidade_atual?.toUpperCase() !== 'MTZ' && user?.unidade?.toUpperCase() !== 'MTZ' && user?.unidade?.toUpperCase() !== 'ALL'}
                      />
                    </div>

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
                          <SelectItem value="ATENDIDAS">ATENDIDAS</SelectItem>
                          <SelectItem value="REPROVADAS">REPROVADAS</SelectItem>
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
              <div className="rounded-md border overflow-x-auto">
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
                          {new Date(solicitacao.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')}
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
                          ) : solicitacao.status === 'R' ? (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              Reprovada
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
        <DialogContent className="sm:max-w-[750px] h-[85vh] flex flex-col p-0 overflow-hidden bg-card">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
            <DialogDescription>
              Visualizar informações completas da solicitação de compra
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
            {solicitacaoDetalhes && (
              <div className="grid gap-6">
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Status da Solicitação</Label>
                    <div className="flex items-center gap-2">
                      {solicitacaoDetalhes.status === 'A' ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 px-3 py-1 text-sm font-bold uppercase">
                          <CheckCircle className="size-3.5 mr-1.5" />
                          ATENDIDA
                        </Badge>
                      ) : solicitacaoDetalhes.status === 'R' ? (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800 px-3 py-1 text-sm font-bold uppercase">
                          <X className="size-3.5 mr-1.5" />
                          REPROVADA
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 px-3 py-1 text-sm font-bold uppercase">
                          <Clock className="size-3.5 mr-1.5" />
                          PENDENTE DE APROVAÇÃO
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Número</Label>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                      {formatarNumeroSolicitacao(solicitacaoDetalhes.unidade, solicitacaoDetalhes.seq_solicitacao_compra)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-sm text-gray-500 font-medium">Data de Inclusão:</Label>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {new Date(solicitacaoDetalhes.data_inclusao).toLocaleDateString('pt-BR')} às {solicitacaoDetalhes.hora_inclusao?.substring(0, 5)}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-500 font-medium">Usuário Solicitante:</Label>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 uppercase">
                      {solicitacaoDetalhes.login_inclusao}
                    </p>
                  </div>

                  <div className="col-span-2">
                    <Label className="text-sm text-gray-500 font-medium">Centro de Custo:</Label>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {formatCodigoCentroCusto(
                        solicitacaoDetalhes.centro_custo_unidade || '',
                        solicitacaoDetalhes.centro_custo_nro || ''
                      )} - {solicitacaoDetalhes.centro_custo_descricao}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-500 font-medium">Setor Responsável:</Label>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 uppercase">{solicitacaoDetalhes.setor_descricao || '-'}</p>
                  </div>

                  <div>
                    <Label className="text-sm text-gray-500 font-medium">Placa do Veículo:</Label>
                    <p className="font-semibold font-mono text-gray-900 dark:text-gray-100">
                      {solicitacaoDetalhes.placa || '-'}
                    </p>
                  </div>

                  {solicitacaoDetalhes.seq_ordem_compra && (
                    <div className="col-span-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded border border-blue-100 dark:border-blue-800">
                      <Label className="text-sm text-blue-600 dark:text-blue-400 font-bold">Ordem de Compra Gerada:</Label>
                      <p className="font-bold font-mono text-blue-700 dark:text-blue-300 text-lg">
                        {solicitacaoDetalhes.nro_ordem_compra}
                      </p>
                    </div>
                  )}

                  {solicitacaoDetalhes.observacao && (
                    <div className="col-span-2">
                      <Label className="text-sm text-gray-500 font-medium">Observações:</Label>
                      <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800 italic text-gray-700 dark:text-gray-300">
                        {solicitacaoDetalhes.observacao}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 mb-4">
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <ClipboardList className="size-4 text-gray-400" />
                    Itens da Solicitação ({itensDetalhes.length})
                  </h3>
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-gray-900/50">
                        <TableRow>
                          <TableHead>Descrição do Item</TableHead>
                          <TableHead className="text-right w-[120px]">Quantidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensDetalhes.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{item.item}</TableCell>
                            <TableCell className="text-right font-mono">{item.qtde_item}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 border-t bg-gray-50 dark:bg-gray-900/50 shrink-0 sm:justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={imprimirSolicitacao}
                className="gap-2 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400"
              >
                <Printer className="size-4" />
                Imprimir PDF
              </Button>

              {solicitacaoDetalhes && solicitacaoDetalhes.status === 'P' && !solicitacaoDetalhes.seq_ordem_compra && (
                <Button
                  onClick={() => {
                    setMostrarDetalhesModal(false);
                    abrirModalSolicitarAprovacao(solicitacaoDetalhes);
                  }}
                  variant="outline"
                  className="gap-2 border-orange-200 hover:bg-orange-50 dark:border-orange-900 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                >
                  <Mail className="size-4" />
                  Solicitar Aprovação
                </Button>
              )}
            </div>
            <Button variant="default" onClick={() => setMostrarDetalhesModal(false)} className="px-8">
              Fechar
            </Button>
          </DialogFooter>

          {/* Área Invisível para Impressão */}
          <div style={{ display: 'none' }}>
            <div ref={printRef}></div>
          </div>
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