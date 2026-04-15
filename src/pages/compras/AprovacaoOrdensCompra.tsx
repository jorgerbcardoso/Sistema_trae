import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Checkbox } from '../../components/ui/checkbox';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
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
import {
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  RotateCcw,
  Loader2,
  X,
  ShoppingCart,
  ClipboardList,
  Info,
  Printer,
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_ORDENS_COMPRA, MOCK_ORDEM_COMPRA_ITENS, MOCK_CENTROS_CUSTO } from '../../utils/estoqueModData';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { FilterSelectCentroCusto } from '../../components/shared/FilterSelectCentroCusto';
import { FilterSelectSetorWithAll } from '../../components/admin/FilterSelectSetorWithAll';
import { toUpperCase } from '../../utils/stringUtils';

interface OrdemCompra {
  seq_ordem_compra: number;
  unidade: string;
  nro_ordem_compra: string;
  seq_centro_custo: number;
  nro_centro_custo?: string;
  centro_custo_descricao?: string;
  centro_custo_unidade?: string;
  nro_setor?: number;
  setor_descricao?: string;
  placa?: string; // ✅ NOVO: Placa do veículo
  aprovada: string; // 'N' = Pendente, 'S' = Aprovada, 'R' = Reprovada
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

export default function AprovacaoOrdensCompra() {
  usePageTitle('Aprovação de Ordens de Compra');

  const { user } = useAuth();
  const [ordens, setOrdens] = useState<OrdemCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const [processando, setProcessando] = useState(false);
  
  const unidadeAtual = user?.unidade_atual || user?.unidade || 'MTZ';
  const unidadeAtualUpper = unidadeAtual.toUpperCase();
  const isMtzOrAll = unidadeAtualUpper === 'MTZ' || unidadeAtualUpper === 'ALL';
  
  // Filtros
  const [statusFiltro, setStatusFiltro] = useState<'TODAS' | 'PENDENTES' | 'APROVADAS' | 'REPROVADAS'>('TODAS');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [unidadeFiltro, setUnidadeFiltro] = useState<string>(isMtzOrAll ? 'TODAS' : unidadeAtual);
  const [centroCustoFiltro, setCentroCustoFiltro] = useState<string>('');
  const [setorFiltro, setSetorFiltro] = useState<string>('');

  // Modal de detalhes
  const [mostrarDetalhesModal, setMostrarDetalhesModal] = useState(false);
  const [ordemDetalhes, setOrdemDetalhes] = useState<OrdemCompra | null>(null);
  const [itensDetalhes, setItensDetalhes] = useState<any[]>([]);

  // Modal de aprovação
  const [mostrarModalAprovacao, setMostrarModalAprovacao] = useState(false);
  const [ordemParaAprovar, setOrdemParaAprovar] = useState<OrdemCompra | null>(null);
  const [orcarSelecionado, setOrcarSelecionado] = useState('N');

  // ✅ Modal de reprovação
  const [mostrarModalReprovacao, setMostrarModalReprovacao] = useState(false);
  const [ordemParaReprovar, setOrdemParaReprovar] = useState<OrdemCompra | null>(null);
  const [motivoReprovacao, setMotivoReprovacao] = useState('');

  // Seleção múltipla
  const [ordensSelecionadas, setOrdensSelecionadas] = useState<number[]>([]);
  const [modalAprovacaoLote, setModalAprovacaoLote] = useState(false);

  type SortField = 'nro_ordem_compra' | 'centro_custo_descricao' | 'data_inclusao' | 'qtd_itens' | 'aprovada' | 'orcar';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

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

  useEffect(() => {
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    
    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(trintaDiasAtras.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (dataInicio && dataFim) {
      carregarOrdens();
    }
  }, [statusFiltro, dataInicio, dataFim, unidadeFiltro, centroCustoFiltro, setorFiltro]);

  const carregarOrdens = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 500));
        let dadosFiltrados = [...MOCK_ORDENS_COMPRA];
        
        if (statusFiltro === 'PENDENTES') {
          dadosFiltrados = dadosFiltrados.filter(o => o.aprovada === 'N');
        } else if (statusFiltro === 'APROVADAS') {
          dadosFiltrados = dadosFiltrados.filter(o => o.aprovada === 'S');
        } else if (statusFiltro === 'REPROVADAS') {
          dadosFiltrados = dadosFiltrados.filter(o => o.aprovada === 'R');
        }
        
        if (dataInicio) {
          dadosFiltrados = dadosFiltrados.filter(o => o.data_inclusao >= dataInicio);
        }
        if (dataFim) {
          dadosFiltrados = dadosFiltrados.filter(o => o.data_inclusao <= dataFim);
        }
        
        if (!isMtzOrAll) {
          dadosFiltrados = dadosFiltrados.filter(o => {
            const cc = MOCK_CENTROS_CUSTO.find(c => c.seq_centro_custo === o.seq_centro_custo);
            return cc?.unidade === unidadeAtual;
          });
        }
        
        if (centroCustoFiltro && centroCustoFiltro !== 'TODOS') {
          dadosFiltrados = dadosFiltrados.filter(o => o.seq_centro_custo.toString() === centroCustoFiltro);
        }
        
        if (setorFiltro && setorFiltro !== 'TODOS') {
          dadosFiltrados = dadosFiltrados.filter(o => o.nro_setor?.toString() === setorFiltro);
        }
        
        setOrdens(dadosFiltrados);
      } else {
        const params = new URLSearchParams();
        params.append('status', statusFiltro);
        if (dataInicio) params.append('data_inicio', dataInicio);
        if (dataFim) params.append('data_fim', dataFim);
        if (unidadeFiltro && unidadeFiltro !== 'TODAS') params.append('unidade', unidadeFiltro);
        if (centroCustoFiltro && centroCustoFiltro !== 'TODOS') params.append('seq_centro_custo', centroCustoFiltro);
        if (setorFiltro && setorFiltro !== 'TODOS') params.append('nro_setor', setorFiltro);
        
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/aprovar_ordens_compra.php?${params}`,
          { method: 'GET' }
        );
        
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

  const abrirModalAprovacao = (ordem: OrdemCompra) => {
    setOrdemParaAprovar(ordem);
    setOrcarSelecionado('N');
    setMostrarModalAprovacao(true);
  };

  // ✅ Abrir modal de reprovação
  const abrirModalReprovacao = (ordem: OrdemCompra) => {
    setOrdemParaReprovar(ordem);
    setMotivoReprovacao('');
    setMostrarModalReprovacao(true);
  };

  const aprovarOrdem = async () => {
    if (!ordemParaAprovar) return;

    try {
      setProcessando(true);

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setOrdens(prev => prev.map(o =>
          o.seq_ordem_compra === ordemParaAprovar.seq_ordem_compra
            ? {
                ...o,
                aprovada: 'S',
                orcar: orcarSelecionado,
                data_aprovacao: new Date().toISOString().split('T')[0],
                hora_aprovacao: new Date().toTimeString().split(' ')[0],
                login_aprovacao: user?.username || 'ADMIN'
              }
            : o
        ));
        
        toast.success('Ordem de compra aprovada com sucesso!');
      } else {
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/aprovar_ordens_compra.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_ordem_compra: ordemParaAprovar.seq_ordem_compra,
            acao: 'aprovar',
            orcar: orcarSelecionado
          })
        });
        
        if (response.success) {
          toast.success(response.message || 'Ordem de compra aprovada com sucesso!');
          await carregarOrdens();
        } else {
          toast.error(response.message || 'Erro ao aprovar ordem');
          setProcessando(false);
          return;
        }
      }

      setMostrarModalAprovacao(false);
      setMostrarDetalhesModal(false);
      setOrdemParaAprovar(null);
    } catch (error) {
      console.error('Erro ao aprovar ordem:', error);
    } finally {
      setProcessando(false);
    }
  };

  // ✅ Reprovar ordem de compra
  const reprovarOrdem = async () => {
    if (!ordemParaReprovar) return;

    if (!motivoReprovacao.trim()) {
      toast.error('Informe o motivo da reprovação');
      return;
    }

    try {
      setProcessando(true);

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setOrdens(prev => prev.map(o =>
          o.seq_ordem_compra === ordemParaReprovar.seq_ordem_compra
            ? {
                ...o,
                aprovada: 'R',
                motivo_reprovacao: toUpperCase(motivoReprovacao),
                // Concatenar motivo na observação
                observacao: o.observacao 
                  ? `${o.observacao} | REPROVADA EM ${new Date().toLocaleDateString('pt-BR')}: ${toUpperCase(motivoReprovacao)}`
                  : `REPROVADA EM ${new Date().toLocaleDateString('pt-BR')}: ${toUpperCase(motivoReprovacao)}`,
                data_aprovacao: new Date().toISOString().split('T')[0],
                hora_aprovacao: new Date().toTimeString().split(' ')[0],
                login_aprovacao: user?.username || 'ADMIN'
              }
            : o
        ));
        
        toast.success('Ordem de compra reprovada com sucesso!');
      } else {
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/aprovar_ordens_compra.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_ordem_compra: ordemParaReprovar.seq_ordem_compra,
            acao: 'reprovar',
            motivo_reprovacao: toUpperCase(motivoReprovacao)
          })
        });
        
        toast.success('Ordem de compra reprovada com sucesso!');
        await carregarOrdens();
      }

      setMostrarModalReprovacao(false);
      setMostrarDetalhesModal(false);
      setOrdemParaReprovar(null);
      setMotivoReprovacao('');
    } catch (error) {
      console.error('Erro ao reprovar ordem:', error);
    } finally {
      setProcessando(false);
    }
  };

  const estornarAprovacao = async (ordem: OrdemCompra) => {
    if (!window.confirm(`Tem certeza que deseja estornar a aprovação da ordem ${ordem.nro_ordem_compra}?`)) {
      return;
    }

    try {
      setProcessando(true);

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setOrdens(prev => prev.map(o =>
          o.seq_ordem_compra === ordem.seq_ordem_compra
            ? {
                ...o,
                aprovada: 'N',
                orcar: 'N',
                data_aprovacao: undefined,
                hora_aprovacao: undefined,
                login_aprovacao: undefined
              }
            : o
        ));
        
        toast.success('Aprovação estornada com sucesso!');
      } else {
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/aprovar_ordens_compra.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_ordem_compra: ordem.seq_ordem_compra,
            acao: 'estornar'
          })
        });
        
        if (response.success) {
          toast.success(response.message || 'Aprovação estornada com sucesso!');
          await carregarOrdens();
        } else {
          toast.error(response.message || 'Erro ao estornar aprovação');
        }
      }
    } catch (error) {
      console.error('Erro ao estornar aprovação:', error);
    } finally {
      setProcessando(false);
    }
  };

  const limparFiltros = () => {
    const hoje = new Date();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(hoje.getDate() - 30);
    
    setDataFim(hoje.toISOString().split('T')[0]);
    setDataInicio(trintaDiasAtras.toISOString().split('T')[0]);
    setStatusFiltro('TODAS');
    setUnidadeFiltro(isMtzOrAll ? 'TODAS' : unidadeAtual);
    setCentroCustoFiltro('');
    setSetorFiltro('');
  };

  const toggleSelecionarOrdem = (seqOrdem: number) => {
    setOrdensSelecionadas(prev =>
      prev.includes(seqOrdem)
        ? prev.filter(id => id !== seqOrdem)
        : [...prev, seqOrdem]
    );
  };

  const toggleSelecionarTodas = () => {
    if (ordensSelecionadas.length === ordensPendentes.length) {
      setOrdensSelecionadas([]);
    } else {
      setOrdensSelecionadas(ordensPendentes.map(o => o.seq_ordem_compra));
    }
  };

  const abrirModalAprovacaoLote = () => {
    if (ordensSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma ordem para aprovar');
      return;
    }
    setOrcarSelecionado('N');
    setModalAprovacaoLote(true);
  };

  const aprovarOrdensLote = async () => {
    try {
      setProcessando(true);

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setOrdens(prev => prev.map(o =>
          ordensSelecionadas.includes(o.seq_ordem_compra)
            ? {
                ...o,
                aprovada: 'S',
                orcar: orcarSelecionado,
                data_aprovacao: new Date().toISOString().split('T')[0],
                hora_aprovacao: new Date().toTimeString().split(' ')[0],
                login_aprovacao: user?.username || 'ADMIN'
              }
            : o
        ));
        
        toast.success(`${ordensSelecionadas.length} ordem(ns) de compra aprovada(s) com sucesso!`);
      } else {
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/aprovar_ordens_compra.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_ordens_compra: ordensSelecionadas,
            acao: 'aprovar',
            orcar: orcarSelecionado
          })
        });

        if (response.success) {
          toast.success(response.message || 'Ordens aprovadas com sucesso');
        }
        
        await carregarOrdens();
      }

      setModalAprovacaoLote(false);
      setOrdensSelecionadas([]);
    } catch (error) {
      console.error('Erro ao aprovar ordens em lote:', error);
    } finally {
      setProcessando(false);
    }
  };

  const estornarOrdensLote = async () => {
    if (ordensSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma ordem para estornar');
      return;
    }

    if (!window.confirm(`Tem certeza que deseja estornar ${ordensSelecionadas.length} ordem(ns) de compra?`)) {
      return;
    }

    try {
      setProcessando(true);

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        setOrdens(prev => prev.map(o =>
          ordensSelecionadas.includes(o.seq_ordem_compra)
            ? {
                ...o,
                aprovada: 'N',
                orcar: 'N',
                data_aprovacao: undefined,
                hora_aprovacao: undefined,
                login_aprovacao: undefined
              }
            : o
        ));
        
        toast.success(`${ordensSelecionadas.length} aprovação(ões) estornada(s) com sucesso!`);
      } else {
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/aprovar_ordens_compra.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_ordens_compra: ordensSelecionadas,
            acao: 'estornar'
          })
        });

        if (response.success) {
          toast.success(response.message || 'Aprovações estornadas com sucesso');
        }
        
        await carregarOrdens();
      }

      setOrdensSelecionadas([]);
    } catch (error) {
      console.error('Erro ao estornar aprovações em lote:', error);
    } finally {
      setProcessando(false);
    }
  };

  const ordensPendentes = ordens.filter(o => o.aprovada === 'N');
  const ordensAprovadas = ordens.filter(o => o.aprovada === 'S');
  
  const todasPendentesSelecionadas = ordensPendentes.length > 0 && 
    ordensPendentes.every(o => ordensSelecionadas.includes(o.seq_ordem_compra));
  
  // ✅ Função auxiliar para renderizar o status
  const renderStatus = (aprovada: string) => {
    if (aprovada === 'S') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Aprovada
        </span>
      );
    } else if (aprovada === 'R') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
          Reprovada
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
          Pendente
        </span>
      );
    }
  };

  // ✅ Função de Impressão (Baseada no padrão de CadastroOrdensCompra)
  const imprimirOrdemCompra = () => {
    if (!ordemDetalhes) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    // Logo do cliente e Presto
    const logoUrl = user?.domain?.toUpperCase() === 'ACV' 
      ? 'https://webpresto.com.br/images/logos_clientes/aceville.png'
      : 'https://webpresto.com.br/images/logo_rel.png';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ordem de Compra ${ordemDetalhes.unidade}${String(ordemDetalhes.nro_ordem_compra).padStart(6, '0')}</title>
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
            .status-aprovada {
              background: #d1fae5;
              color: #065f46;
              border: 1px solid #6ee7b7;
            }
            .status-reprovada {
              background: #fee2e2;
              color: #991b1b;
              border: 1px solid #fca5a5;
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
                <h1>Ordem de Compra</h1>
                <p>Sistema de Gestão</p>
              </div>
            </div>
            <div class="header-right">
              <div class="documento-numero">${ordemDetalhes.unidade}${String(ordemDetalhes.nro_ordem_compra).padStart(6, '0')}</div>
              <div class="status-badge ${ordemDetalhes.aprovada === 'S' ? 'status-aprovada' : ordemDetalhes.aprovada === 'R' ? 'status-reprovada' : 'status-pendente'}">
                ${ordemDetalhes.aprovada === 'S' ? 'APROVADA' : ordemDetalhes.aprovada === 'R' ? 'REPROVADA' : 'PENDENTE'}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Informações Gerais</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Data de Inclusão</div>
                <div class="info-value">${new Date(ordemDetalhes.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')} às ${ordemDetalhes.hora_inclusao?.substring(0, 5)}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Usuário Solicitante</div>
                <div class="info-value">${ordemDetalhes.login_inclusao?.toUpperCase()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Centro de Custo</div>
                <div class="info-value">
                  ${ordemDetalhes.centro_custo_unidade || ''}${String(ordemDetalhes.nro_centro_custo || '').padStart(6, '0')} - ${ordemDetalhes.centro_custo_descricao || ''}
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Setor Responsável</div>
                <div class="info-value">${ordemDetalhes.setor_descricao || '-'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Unidade</div>
                <div class="info-value">${ordemDetalhes.unidade}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Veículo / Placa</div>
                <div class="info-value">${ordemDetalhes.placa || '-'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Deve Orçar?</div>
                <div class="info-value">${ordemDetalhes.orcar === 'S' ? 'SIM' : 'NÃO'}</div>
              </div>
            </div>
          </div>

          ${ordemDetalhes.aprovada !== 'N' ? `
          <div class="section">
            <div class="section-title">Informações de Aprovação</div>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Aprovado/Reprovado por</div>
                <div class="info-value">${ordemDetalhes.login_aprovacao?.toUpperCase() || '-'}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Data/Hora</div>
                <div class="info-value">${ordemDetalhes.data_aprovacao ? new Date(ordemDetalhes.data_aprovacao + 'T00:00:00').toLocaleDateString('pt-BR') : ''} ${ordemDetalhes.hora_aprovacao?.substring(0, 5) || ''}</div>
              </div>
              ${ordemDetalhes.motivo_reprovacao ? `
              <div class="info-item" style="grid-column: span 2;">
                <div class="info-label">Motivo da Reprovação</div>
                <div class="info-value" style="color: #991b1b;">${ordemDetalhes.motivo_reprovacao}</div>
              </div>
              ` : ''}
            </div>
          </div>
          ` : ''}

          <div class="section">
            <div class="section-title">Itens da Ordem de Compra</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 60px;" class="text-center">#</th>
                  <th style="width: 100px;">Código</th>
                  <th>Descrição do Item</th>
                  <th style="width: 80px;" class="text-center">Unid.</th>
                  <th style="width: 100px;" class="text-right">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                ${itensDetalhes.map((item, index) => `
                  <tr>
                    <td class="text-center">${index + 1}</td>
                    <td class="font-mono">${item.codigo}</td>
                    <td>${item.descricao}</td>
                    <td class="text-center">${item.unidade_medida_sigla || item.unidade_medida}</td>
                    <td class="text-right">${parseFloat(item.qtde_item).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Observações</div>
            <div class="observacoes-box">
              ${ordemDetalhes.observacao || 'NENHUMA OBSERVAÇÃO INFORMADA.'}
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
  const aprovarOrdemDetalhes = () => {
    if (!ordemDetalhes) return;
    setOrdemParaAprovar(ordemDetalhes);
    setOrcarSelecionado('N');
    setMostrarModalAprovacao(true);
  };

  // ✅ Reprovar ordem do dialog de detalhes
  const reprovarOrdemDetalhes = () => {
    if (!ordemDetalhes) return;
    setOrdemParaReprovar(ordemDetalhes);
    setMotivoReprovacao('');
    setMostrarModalReprovacao(true);
  };
  
  return (
    <AdminLayout
      title="APROVAÇÃO DE ORDENS DE COMPRA"
      description="Aprovação e reprovação de ordens de compra"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Card de Filtros */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Filter className="size-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>Filtros</CardTitle>
              </div>
              <Button variant="outline" onClick={limparFiltros} className="gap-2">
                <RotateCcw className="size-4" />
                Limpar Filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Linha 1: Status */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={statusFiltro} onValueChange={(value: any) => setStatusFiltro(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDENTES">Pendentes</SelectItem>
                    <SelectItem value="APROVADAS">Aprovadas</SelectItem>
                    <SelectItem value="REPROVADAS">Reprovadas</SelectItem>
                    <SelectItem value="TODAS">Todas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2: Período */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="grid gap-2">
                <Label htmlFor="dataInicio">Data Início</Label>
                <Input
                  id="dataInicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="dataFim">Data Fim</Label>
                <Input
                  id="dataFim"
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>

            {/* Linha 3: Unidade, Centro de Custo e Setor */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="grid gap-2">
                <Label>Unidade</Label>
                <FilterSelectUnidadeSingle
                  value={unidadeFiltro}
                  onChange={setUnidadeFiltro}
                  disabled={!isMtzOrAll}
                  compact
                />
              </div>

              <div>
                <FilterSelectCentroCusto
                  value={centroCustoFiltro}
                  onChange={setCentroCustoFiltro}
                  unidadeFiltro={unidadeFiltro === 'TODAS' ? undefined : unidadeFiltro}
                />
              </div>

              <div>
                <FilterSelectSetorWithAll
                  value={setorFiltro}
                  onChange={setSetorFiltro}
                  suggestUserSetor={true}
                />
              </div>

              <div className="flex items-end">
                <Button onClick={carregarOrdens} className="w-full gap-2" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      <Filter className="size-4" />
                      Aplicar Filtros
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Listagem */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ShoppingCart className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>
                  Ordens de Compra ({ordens.length})
                  {ordensSelecionadas.length > 0 && (
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({ordensSelecionadas.length} selecionada{ordensSelecionadas.length > 1 ? 's' : ''})
                    </span>
                  )}
                </CardTitle>
              </div>
              
              {ordensSelecionadas.length > 0 && (
                <div className="flex gap-2">
                  {(statusFiltro === 'PENDENTES' || statusFiltro === 'TODAS') && (
                    <Button 
                      onClick={abrirModalAprovacaoLote} 
                      className="gap-2"
                      disabled={processando}
                    >
                      <CheckCircle className="size-4" />
                      Aprovar Selecionadas ({ordensSelecionadas.length})
                    </Button>
                  )}
                  
                  {(statusFiltro === 'APROVADAS' || statusFiltro === 'TODAS') && (
                    <Button 
                      onClick={estornarOrdensLote} 
                      variant="outline"
                      className="gap-2"
                      disabled={processando}
                    >
                      <RotateCcw className="size-4" />
                      Estornar Selecionadas ({ordensSelecionadas.length})
                    </Button>
                  )}
                </div>
              )}
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
                <p>Nenhuma ordem de compra encontrada</p>
                <p className="text-sm mt-1">Ajuste os filtros para visualizar outras ordens</p>
              </div>
            ) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={todasPendentesSelecionadas}
                          onCheckedChange={toggleSelecionarTodas}
                          aria-label="Selecionar todas"
                        />
                      </TableHead>
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
                        label="Data Inclusão"
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
                    {sortData(ordens).map((ordem) => (
                      <TableRow key={ordem.seq_ordem_compra}>
                        <TableCell>
                          <Checkbox
                            checked={ordensSelecionadas.includes(ordem.seq_ordem_compra)}
                            onCheckedChange={() => toggleSelecionarOrdem(ordem.seq_ordem_compra)}
                            aria-label={`Selecionar ordem ${ordem.nro_ordem_compra}`}
                            disabled={ordem.aprovada !== 'N'}
                          />
                        </TableCell>
                        <TableCell className="font-medium font-mono">
                          {ordem.unidade}{String(ordem.nro_ordem_compra).padStart(6, '0')}
                        </TableCell>
                        <TableCell className="font-mono">
                          {ordem.centro_custo_unidade}{String(ordem.nro_centro_custo).padStart(6, '0')} - {ordem.centro_custo_descricao}
                        </TableCell>
                        <TableCell>
                          {new Date(ordem.data_inclusao).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSetorBadgeColor(ordem.nro_setor)}`}
                          >
                            {ordem.setor_descricao || (ordem.nro_setor ? `Setor ${ordem.nro_setor}` : '-')}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{ordem.qtd_itens}</TableCell>
                        <TableCell className="text-center">
                          {renderStatus(ordem.aprovada)}
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
                                  onClick={() => abrirModalAprovacao(ordem)}
                                  title="Aprovar"
                                  disabled={processando}
                                >
                                  <CheckCircle className="size-4 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => abrirModalReprovacao(ordem)}
                                  title="Reprovar"
                                  disabled={processando}
                                >
                                  <XCircle className="size-4 text-red-600" />
                                </Button>
                              </>
                            )}
                            
                            {ordem.aprovada === 'S' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => estornarAprovacao(ordem)}
                                title="Estornar Aprovação"
                                disabled={processando}
                              >
                                <RotateCcw className="size-4 text-orange-600" />
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

      {/* Modal de Detalhes */}
      <Dialog open={mostrarDetalhesModal} onOpenChange={setMostrarDetalhesModal}>
        <DialogContent className="sm:max-w-[800px] h-[85vh] flex flex-col p-0 overflow-hidden bg-card">
          <DialogHeader className="p-6 pb-2 shrink-0 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <ClipboardList className="size-6 text-blue-600" />
              Detalhes da Ordem de Compra
            </DialogTitle>
            <DialogDescription>
              Visualizar informações completas da ordem de compra
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 p-6 space-y-6">
            {ordemDetalhes && (
              <div className="grid gap-6">
                {/* Cabeçalho de Status e Número */}
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Status da Ordem</Label>
                    <div className="flex items-center gap-2">
                      {ordemDetalhes.aprovada === 'S' ? (
                        <div className="flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                          <CheckCircle className="size-3.5 mr-1.5" />
                          APROVADA
                        </div>
                      ) : ordemDetalhes.aprovada === 'R' ? (
                        <div className="flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                          <X className="size-3.5 mr-1.5" />
                          REPROVADA
                        </div>
                      ) : (
                        <div className="flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                          <Info className="size-3.5 mr-1.5" />
                          AGUARDANDO APROVAÇÃO
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <Label className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Número</Label>
                    <p className="text-xl font-black text-blue-600 dark:text-blue-400 font-mono">
                      {ordemDetalhes.unidade}{String(ordemDetalhes.nro_ordem_compra).padStart(6, '0')}
                    </p>
                  </div>
                </div>

                {/* Grid de Informações */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500 font-medium">Data de Inclusão:</Label>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {new Date(ordemDetalhes.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')} às {ordemDetalhes.hora_inclusao?.substring(0, 5)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500 font-medium">Solicitante:</Label>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 uppercase">
                        {ordemDetalhes.login_inclusao}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500 font-medium">Unidade:</Label>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {ordemDetalhes.unidade}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500 font-medium">Centro de Custo:</Label>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono">
                        {ordemDetalhes.centro_custo_unidade}{String(ordemDetalhes.nro_centro_custo).padStart(6, '0')}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {ordemDetalhes.centro_custo_descricao}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500 font-medium">Setor Responsável:</Label>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {ordemDetalhes.setor_descricao || (ordemDetalhes.nro_setor ? `Setor ${ordemDetalhes.nro_setor}` : 'Não informado')}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500 font-medium">Veículo / Placa:</Label>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 font-mono">
                        {ordemDetalhes.placa || '-'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Opções Extras */}
                <div className="grid grid-cols-2 gap-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                  <div className="space-y-1">
                    <Label className="text-sm text-gray-500 font-medium">Orçar:</Label>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {ordemDetalhes.orcar === 'S' ? 'SIM (Obrigatório)' : 'NÃO'}
                    </p>
                  </div>
                  {ordemDetalhes.aprovada !== 'N' && (
                    <div className="space-y-1">
                      <Label className="text-sm text-gray-500 font-medium">Aprovação por:</Label>
                      <p className="font-semibold text-gray-900 dark:text-gray-100 uppercase">
                        {ordemDetalhes.login_aprovacao} em {ordemDetalhes.data_aprovacao ? new Date(ordemDetalhes.data_aprovacao + 'T00:00:00').toLocaleDateString('pt-BR') : ''}
                      </p>
                    </div>
                  )}
                </div>

                {/* Motivo Reprovação */}
                {ordemDetalhes.motivo_reprovacao && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-lg">
                    <Label className="text-sm text-red-600 dark:text-red-400 font-bold uppercase mb-1 block">Motivo da Reprovação</Label>
                    <p className="text-sm text-red-700 dark:text-red-300 font-medium italic">
                      "{ordemDetalhes.motivo_reprovacao}"
                    </p>
                  </div>
                )}

                {/* Observações */}
                {ordemDetalhes.observacao && (
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-500 font-bold uppercase">Observações</Label>
                    <div className="bg-white dark:bg-gray-950 p-4 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm min-h-[80px]">
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap italic">
                        {ordemDetalhes.observacao}
                      </p>
                    </div>
                  </div>
                )}

                {/* Tabela de Itens */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 uppercase text-sm">Itens da Ordem ({itensDetalhes.length})</h3>
                  </div>
                  <div className="rounded-lg border overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-gray-900">
                        <TableRow>
                          <TableHead className="w-24">Código</TableHead>
                          <TableHead>Descrição do Item</TableHead>
                          <TableHead className="text-center w-24">Unidade</TableHead>
                          <TableHead className="text-right w-32">Quantidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensDetalhes.map((item, idx) => (
                          <TableRow key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                            <TableCell className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{item.codigo}</TableCell>
                            <TableCell className="text-sm font-medium">{item.descricao}</TableCell>
                            <TableCell className="text-center text-xs text-gray-500">{item.unidade_medida_sigla || item.unidade_medida}</TableCell>
                            <TableCell className="text-right font-black text-gray-900 dark:text-gray-100">
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
          </div>

          <DialogFooter className="flex justify-between items-center border-t p-6 shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={imprimirOrdemCompra}
                className="gap-2 border-blue-200 hover:bg-blue-50 dark:border-blue-900 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-400 shadow-sm"
              >
                <Printer className="size-4" />
                Imprimir PDF
              </Button>
              {ordemDetalhes && ordemDetalhes.aprovada === 'N' && (
                <>
                  <Button 
                    onClick={aprovarOrdemDetalhes} 
                    disabled={processando}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm"
                  >
                    <CheckCircle className="size-4" />
                    Aprovar Ordem
                  </Button>
                  <Button 
                    onClick={reprovarOrdemDetalhes} 
                    disabled={processando}
                    variant="destructive"
                    className="gap-2 shadow-sm"
                  >
                    <XCircle className="size-4" />
                    Reprovar
                  </Button>
                </>
              )}
            </div>

            <Button variant="default" onClick={() => setMostrarDetalhesModal(false)} className="px-8 shadow-md">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Aprovação */}
      <Dialog open={mostrarModalAprovacao} onOpenChange={setMostrarModalAprovacao}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Aprovar Ordem de Compra</DialogTitle>
            <DialogDescription>
              Confirme a aprovação da ordem {ordemParaAprovar?.nro_ordem_compra}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Esta ordem será orçada?</Label>
              <Select value={orcarSelecionado} onValueChange={setOrcarSelecionado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N">Não orçar</SelectItem>
                  <SelectItem value="S">Sim, orçar</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                {orcarSelecionado === 'S' 
                  ? 'A ordem será incluída no orçamento para cotação com fornecedores'
                  : 'A ordem será processada diretamente sem orçamento'
                }
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMostrarModalAprovacao(false)}
              disabled={processando}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={aprovarOrdem} disabled={processando}>
              {processando ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Aprovando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Aprovar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ Modal de Reprovação */}
      <Dialog open={mostrarModalReprovacao} onOpenChange={setMostrarModalReprovacao}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Reprovar Ordem de Compra</DialogTitle>
            <DialogDescription>
              Informe o motivo da reprovação da ordem {ordemParaReprovar?.nro_ordem_compra}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="motivo_reprovacao">Motivo da Reprovação *</Label>
              <Textarea
                id="motivo_reprovacao"
                value={motivoReprovacao}
                onChange={(e) => setMotivoReprovacao(e.target.value)}
                placeholder="Descreva o motivo da reprovação..."
                rows={4}
              />
              <p className="text-sm text-gray-500">
                O motivo será concatenado na observação da ordem de compra
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMostrarModalReprovacao(false)}
              disabled={processando}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              onClick={reprovarOrdem} 
              disabled={processando || !motivoReprovacao.trim()}
              variant="destructive"
            >
              {processando ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Reprovando...
                </>
              ) : (
                <>
                  <XCircle className="size-4 mr-2" />
                  Reprovar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Aprovação em Lote */}
      <Dialog open={modalAprovacaoLote} onOpenChange={setModalAprovacaoLote}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Aprovar Ordens de Compra em Lote</DialogTitle>
            <DialogDescription>
              Confirme a aprovação das {ordensSelecionadas.length} ordens selecionadas
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Estas ordens serão orçadas?</Label>
              <Select value={orcarSelecionado} onValueChange={setOrcarSelecionado}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N">Não orçar</SelectItem>
                  <SelectItem value="S">Sim, orçar</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-gray-500">
                {orcarSelecionado === 'S' 
                  ? 'As ordens serão incluídas no orçamento para cotação com fornecedores'
                  : 'As ordens serão processadas diretamente sem orçamento'
                }
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalAprovacaoLote(false)}
              disabled={processando}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={aprovarOrdensLote} disabled={processando}>
              {processando ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Aprovando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Aprovar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}