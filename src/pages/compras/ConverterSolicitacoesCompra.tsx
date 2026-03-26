import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
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
  ClipboardList,
  Search,
  Filter,
  ArrowLeft,
  FolderOpen,
  FileSpreadsheet,
  FileText,
  Eye,
  X,
  CheckCircle,
  Clock,
  Printer,
  Loader2,
  Calendar,
  User,
  ShoppingCart,
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { FilterSelectCentroCusto } from '../../components/shared/FilterSelectCentroCusto';
import { FilterSelectSetor } from '../../components/admin/FilterSelectSetor';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { formatCodigoCentroCusto, formatarNumeroSolicitacao } from '../../utils/formatters';

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
  observacao: string;
  seq_ordem_compra?: number;
  nro_ordem_compra?: string;
  qtd_itens: number;
  status?: string;
}

export default function ConverterSolicitacoesCompra() {
  usePageTitle('Converter Solicitações de Compra');

  const { user, clientConfig } = useAuth();
  const navigate = useNavigate();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const inicializadoRef = useRef(false);

  // Modal de detalhes (Reuso do padrão de SolicitacoesCompra)
  const [mostrarDetalhesModal, setMostrarDetalhesModal] = useState(false);
  const [solicitacaoDetalhes, setSolicitacaoDetalhes] = useState<SolicitacaoCompra | null>(null);
  const [itensDetalhes, setItensDetalhes] = useState<any[]>([]);
  const printRef = useRef<HTMLDivElement>(null);

  // Modal de Reprovação
  const [mostrarReprovarModal, setMostrarReprovarModal] = useState(false);
  const [motivoReprovacao, setMotivoReprovar] = useState('');
  const [solicitacaoParaReprovar, setSolicitacaoParaReprovar] = useState<SolicitacaoCompra | null>(null);
  const [reprovando, setReprovando] = useState(false);

  // ✅ Função para Visualizar Detalhes
  const visualizarDetalhes = async (solicitacao: SolicitacaoCompra) => {
    setSolicitacaoDetalhes(solicitacao);
    setItensDetalhes([]);

    try {
      const data = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php?seq_solicitacao_compra=${solicitacao.seq_solicitacao_compra}&action=itens`,
        { method: 'GET' }
      );

      if (data.success) {
        setItensDetalhes(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    }

    setMostrarDetalhesModal(true);
  };

  // ✅ Função para Reprovar
  const confirmarReprovacao = async () => {
    if (!solicitacaoParaReprovar) return;
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
          seq_solicitacao_compra: solicitacaoParaReprovar.seq_solicitacao_compra,
          motivo: motivoReprovacao.toUpperCase()
        }),
      });

      if (data.success) {
        toast.success('Solicitação reprovada com sucesso!');
        setMostrarReprovarModal(false);
        setMotivoReprovar('');
        carregarSolicitacoes(); // Recarregar lista
      }
    } catch (error) {
      console.error('Erro ao reprovar:', error);
    } finally {
      setReprovando(false);
    }
  };

  // ✅ Função de Impressão (Baseada no padrão de Solicitações)
  const imprimirSolicitacao = () => {
    if (!solicitacaoDetalhes) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const logoCliente = clientConfig?.theme?.logo_light || '';
    const isAceville = user?.domain?.toUpperCase() === 'ACV';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Solicitação ${formatarNumeroSolicitacao(solicitacaoDetalhes.unidade, solicitacaoDetalhes.seq_solicitacao_compra)}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 15mm; font-size: 11pt; color: #000; }
            .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid #2563eb; }
            .logo { max-width: 120px; max-height: 50px; }
            .header-info h1 { font-size: 16pt; color: #2563eb; margin-bottom: 3px; text-transform: uppercase; }
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
              <img src="${isAceville ? logoCliente : '/sistema/logo-presto.png'}" class="logo" />
              <div class="header-info">
                <h1>Solicitação de Compra</h1>
                <p>Sistema de Gestão Presto</p>
              </div>
            </div>
            <div style="text-align: right;">
              <div class="documento-numero">${formatarNumeroSolicitacao(solicitacaoDetalhes.unidade, solicitacaoDetalhes.seq_solicitacao_compra)}</div>
              <div class="status-badge ${solicitacaoDetalhes.status === 'A' ? 'status-atendida' : solicitacaoDetalhes.status === 'R' ? 'status-reprovada' : 'status-pendente'}">
                ${solicitacaoDetalhes.status === 'A' ? 'APROVADA / ATENDIDA' : solicitacaoDetalhes.status === 'R' ? 'REPROVADA' : 'PENDENTE DE APROVAÇÃO'}
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Informações Gerais</div>
            <div class="info-grid">
              <div>
                <div class="info-label">Data de Inclusão</div>
                <div>${new Date(solicitacaoDetalhes.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')} às ${solicitacaoDetalhes.hora_inclusao?.substring(0, 5)}</div>
              </div>
              <div>
                <div class="info-label">Usuário Solicitante</div>
                <div style="text-transform: uppercase;">${solicitacaoDetalhes.login_inclusao}</div>
              </div>
              <div>
                <div class="info-label">Centro de Custo</div>
                <div>${formatCodigoCentroCusto(solicitacaoDetalhes.centro_custo_unidade || '', solicitacaoDetalhes.centro_custo_nro || '')} - ${solicitacaoDetalhes.centro_custo_descricao}</div>
              </div>
              <div>
                <div class="info-label">Setor Responsável</div>
                <div>${solicitacaoDetalhes.setor_descricao || '-'}</div>
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
                ${itensDetalhes.map((item, index) => `
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
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  // ✅ Função de Exportação para Excel (Baseada em SolicitacoesCompra)
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
              status: 'TODAS' // Na visão de O.C. mostramos todas
            },
            solicitacoes: getSolicitacoesOrdenadas(solicitacoes),
            usuario_logado: '' // Vazio para indicar "Todas as solicitações"
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
      a.download = `solicitacoes_geral_${new Date().getTime()}.xlsx`;
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
        <title>Relatório Geral de Solicitações de Compra</title>
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
              <h1>Relatório Geral de Solicitações de Compra</h1>
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
            <strong>Status:</strong> TODAS |
            <strong>Solicitações:</strong> GERAL (TODOS OS USUÁRIOS)
          </div>
          <div>Total: ${solicitacoes.length} registros</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 80px;">Número</th>
              <th style="width: 70px;">Data</th>
              <th style="width: 100px;">Solicitante</th>
              <th>Centro de Custo</th>
              <th>Setor</th>
              <th style="width: 50px;" class="text-center">Itens</th>
              <th style="width: 100px;" class="text-center">O.C.</th>
              <th style="width: 80px;" class="text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            ${getSolicitacoesOrdenadas(solicitacoes).map(sol => `
              <tr>
                <td class="font-mono">${formatarNumeroSolicitacao(sol.unidade, sol.seq_solicitacao_compra)}</td>
                <td>${new Date(sol.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                <td class="uppercase">${sol.login_inclusao}</td>
                <td>${formatCodigoCentroCusto(sol.centro_custo_unidade || '', sol.centro_custo_nro || '')} - ${sol.centro_custo_descricao}</td>
                <td>${sol.setor_descricao || '-'}</td>
                <td class="text-center">${sol.qtd_itens}</td>
                <td class="text-center font-mono">${sol.nro_ordem_compra || '-'}</td>
                <td class="text-center">
                  <span class="badge ${sol.status?.trim() === 'A' ? 'badge-atendida' : sol.status?.trim() === 'R' ? 'badge-reprovada' : 'badge-pendente'}">
                    ${sol.status?.trim() === 'A' ? 'Atendida' : sol.status?.trim() === 'R' ? 'Reprovada' : 'Pendente'}
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

  // Filtros temporários
  const [filtroUnidadeTemp, setFiltroUnidadeTemp] = useState('');
  const [filtroDataInicioTemp, setFiltroDataInicioTemp] = useState('');
  const [filtroDataFimTemp, setFiltroDataFimTemp] = useState('');
  const [filtroCentroCustoTemp, setFiltroCentroCustoTemp] = useState('');
  const [filtroSetorTemp, setFiltroSetorTemp] = useState<number | null>(null);

  // Filtros aplicados
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroCentroCusto, setFiltroCentroCusto] = useState('');
  const [filtroSetor, setFiltroSetor] = useState<number | null>(null);

  // Inicialização única
  useEffect(() => {
    if (!inicializadoRef.current && user) {
      console.log('🔄 [CONVERSÃO] Inicializando tela de conversão:', {
        username: user.username,
        nro_setor: user.nro_setor,
        tipo_setor: typeof user.nro_setor
      });

      // ✅ REGRA: Iniciar com o setor do usuário logado se ele possuir um
      const setorUsuario = (user?.nro_setor !== undefined && user?.nro_setor !== null) 
        ? Number(user.nro_setor) 
        : null;
      
      console.log('🎯 [CONVERSÃO] Setor determinado para filtro inicial:', setorUsuario);

      // ✅ REGRA: Período padrão de 30 dias
      const hoje = getToday();
      const trintaDiasAtras = get30DaysAgo();

      setFiltroDataInicioTemp(trintaDiasAtras);
      setFiltroDataFimTemp(hoje);
      setFiltroDataInicio(trintaDiasAtras);
      setFiltroDataFim(hoje);

      setFiltroUnidadeTemp('');
      setFiltroUnidade('');

      setFiltroSetorTemp(setorUsuario);
      setFiltroSetor(setorUsuario);

      inicializadoRef.current = true;

      // ✅ Carregar solicitações respeitando o setor do usuário e o período de 30 dias
      carregarSolicitacoes(trintaDiasAtras, hoje, '', '', setorUsuario);
    }
  }, [user]);

  const carregarSolicitacoes = async (
    dataInicio: string = filtroDataInicio,
    dataFim: string = filtroDataFim,
    unidade: string = filtroUnidade,
    centroCusto: string = filtroCentroCusto,
    setor: number | null = filtroSetor
  ) => {
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
            login_inclusao: 'joao',
            seq_centro_custo: 1,
            centro_custo_nro: '1',
            centro_custo_descricao: 'ADMINISTRATIVO',
            centro_custo_unidade: 'MTZ',
            nro_setor: 1,
            setor_descricao: 'COMPRAS',
            observacao: 'MATERIAL DE ESCRITÓRIO URGENTE',
            qtd_itens: 3,
          },
          {
            seq_solicitacao_compra: 2,
            unidade: 'MTZ',
            data_inclusao: '2026-03-01',
            hora_inclusao: '14:15:00',
            login_inclusao: 'maria',
            seq_centro_custo: 2,
            centro_custo_nro: '2',
            centro_custo_descricao: 'MANUTENÇÃO',
            centro_custo_unidade: 'MTZ',
            nro_setor: 2,
            setor_descricao: 'MANUTENÇÃO',
            observacao: 'PEÇAS PARA FROTA',
            seq_ordem_compra: 123,
            nro_ordem_compra: 'MTZ000123',
            qtd_itens: 5,
          },
        ];
        
        // Aplicar filtros
        let filtradas = [...mockSolicitacoes];
        
        if (unidade) {
          filtradas = filtradas.filter(s => s.centro_custo_unidade === unidade);
        }
        
        if (dataInicio) {
          filtradas = filtradas.filter(s => s.data_inclusao >= dataInicio);
        }
        
        if (dataFim) {
          filtradas = filtradas.filter(s => s.data_inclusao <= dataFim);
        }
        
        if (centroCusto) {
          filtradas = filtradas.filter(s => String(s.seq_centro_custo) === String(centroCusto));
        }
        
        if (setor !== null) {
          filtradas = filtradas.filter(s => s.nro_setor === setor);
        }
        
        setSolicitacoes(filtradas);
      } else {
        // BACKEND
        const queryParams = new URLSearchParams();
        
        // Adicionar source=oc para evitar o filtro de login_inclusao no backend
        queryParams.append('source', 'oc');
        
        if (unidade) queryParams.append('unidade', unidade);
        if (dataInicio) queryParams.append('data_inicio', dataInicio);
        if (dataFim) queryParams.append('data_fim', dataFim);
        if (centroCusto) queryParams.append('seq_centro_custo', centroCusto);
        if (setor !== null) queryParams.append('nro_setor', String(setor));
        
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php?${queryParams.toString()}`,
          { method: 'GET' }
        );

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

  const aplicarFiltros = () => {
    setFiltroUnidade(filtroUnidadeTemp);
    setFiltroDataInicio(filtroDataInicioTemp);
    setFiltroDataFim(filtroDataFimTemp);
    setFiltroCentroCusto(filtroCentroCustoTemp);
    setFiltroSetor(filtroSetorTemp);

    // Chamar diretamente com os valores temporários
    carregarSolicitacoes(
      filtroDataInicioTemp,
      filtroDataFimTemp,
      filtroUnidadeTemp,
      filtroCentroCustoTemp,
      filtroSetorTemp
    );
  };

  const limparFiltros = () => {
    // ✅ CORREÇÃO: Limpar filtros, mas restaurar período padrão de 30 dias
    const hoje = getToday();
    const trintaDiasAtras = get30DaysAgo();
    
    setFiltroUnidadeTemp('');
    setFiltroDataInicioTemp(trintaDiasAtras);
    setFiltroDataFimTemp(hoje);
    setFiltroCentroCustoTemp('');
    setFiltroSetorTemp(null);
    
    setFiltroUnidade('');
    setFiltroDataInicio(trintaDiasAtras);
    setFiltroDataFim(hoje);
    setFiltroCentroCusto('');
    setFiltroSetor(null);

    // ✅ Carregar solicitações com período padrão e sem outros filtros
    carregarSolicitacoes(trintaDiasAtras, hoje, '', '', null);
  };

  const iniciarConversao = (solicitacao: SolicitacaoCompra) => {
    if (solicitacao.seq_ordem_compra) {
      toast.error('Esta solicitação já foi convertida em ordem de compra');
      return;
    }

    // Navegar para tela de conversão
    navigate(`/compras/solicitacoes-compra/converter/${solicitacao.seq_solicitacao_compra}`);
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

  // Hook de ordenação
  type SortField = 'seq_solicitacao_compra' | 'data_inclusao' | 'centro_custo_descricao' | 'qtd_itens';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  // ✅ Função para ordenar as solicitações (Pendentes primeiro)
  const getSolicitacoesOrdenadas = (dados: SolicitacaoCompra[]) => {
    return [...sortData(dados)].sort((a, b) => {
      // PENDENTES (status diferente de 'A') vêm primeiro
      const statusA = a.status?.trim() === 'A' ? 1 : 0;
      const statusB = b.status?.trim() === 'A' ? 1 : 0;
      
      if (statusA !== statusB) return statusA - statusB;
      
      // Se o status for o mesmo, mantém a ordenação do hook useSortableTable
      return 0;
    });
  };

  return (
    <AdminLayout
      title="CONVERTER SOLICITAÇÕES DE COMPRA"
      description="Converter solicitações em ordens de compra"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Botão Voltar */}
        <Button
          variant="outline"
          onClick={() => navigate('/compras/ordens-compra')}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Voltar para Ordens de Compra
        </Button>

        {/* Card de Filtros */}
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
                  suggestUserSetor={false}
                  apenasEfetuaCompras={true}
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

        {/* Card de Solicitações */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ClipboardList className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Solicitações Cadastradas</CardTitle>
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
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : solicitacoes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma solicitação encontrada</p>
                <p className="text-sm mt-1">Ajuste os filtros para visualizar mais solicitações</p>
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
                      <TableHead>Solicitante</TableHead>
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
                      <TableHead className="text-center">O.C.</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSolicitacoesOrdenadas(solicitacoes).map((solicitacao) => (
                      <TableRow key={solicitacao.seq_solicitacao_compra}>
                        <TableCell className="font-medium font-mono">
                          {solicitacao.unidade}{String(solicitacao.seq_solicitacao_compra).padStart(6, '0')}
                        </TableCell>
                        <TableCell>
                          {new Date(solicitacao.data_inclusao).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="uppercase">{solicitacao.login_inclusao}</TableCell>
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
                        <TableCell className="text-center font-medium">
                          {solicitacao.qtd_itens}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {solicitacao.nro_ordem_compra || '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {solicitacao.status?.trim() === 'A' ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Atendida
                            </Badge>
                          ) : solicitacao.status?.trim() === 'R' ? (
                            <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              Reprovada
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {solicitacao.status?.trim() === 'P' || !solicitacao.status ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:hover:bg-red-900/20"
                                  onClick={() => {
                                    setSolicitacaoParaReprovar(solicitacao);
                                    setMostrarReprovarModal(true);
                                  }}
                                >
                                  <X className="size-4" />
                                  Reprovar
                                </Button>
                                <Button
                                  onClick={() => iniciarConversao(solicitacao)}
                                  className="gap-2"
                                  size="sm"
                                >
                                  <FolderOpen className="size-4" />
                                  Abrir
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => visualizarDetalhes(solicitacao)}
                                className="h-8 w-8 p-0"
                                title="Visualizar Detalhes"
                              >
                                <Eye className="size-4 text-blue-600" />
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

      {/* ✅ Modal de Detalhes (Reuso de SolicitacoesCompra) */}
      <Dialog open={mostrarDetalhesModal} onOpenChange={setMostrarDetalhesModal}>
        <DialogContent className="sm:max-w-[750px] h-[85vh] flex flex-col p-0 overflow-hidden bg-card">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ClipboardList className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle>Detalhes da Solicitação</DialogTitle>
                  <DialogDescription>
                    Informações completas da solicitação de compra
                  </DialogDescription>
                </div>
              </div>
              {solicitacaoDetalhes && (
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                    {solicitacaoDetalhes.unidade}{String(solicitacaoDetalhes.seq_solicitacao_compra).padStart(6, '0')}
                  </span>
                  <div className="flex items-center gap-2">
                    {solicitacaoDetalhes.status === 'A' ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800 px-3 py-1 text-sm font-bold uppercase">
                        <CheckCircle className="size-3.5 mr-1.5" />
                        APROVADA / ATENDIDA
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
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
            {solicitacaoDetalhes && (
              <div className="space-y-6">
                {/* Cabeçalho de Informações */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase font-bold">Data de Inclusão</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Calendar className="size-4 text-blue-500" />
                      {new Date(solicitacaoDetalhes.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase font-bold">Hora</Label>
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Clock className="size-4 text-blue-500" />
                      {solicitacaoDetalhes.hora_inclusao?.substring(0, 5)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase font-bold">Solicitante</Label>
                    <div className="flex items-center gap-2 text-sm font-medium uppercase">
                      <User className="size-4 text-blue-500" />
                      {solicitacaoDetalhes.login_inclusao}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 uppercase font-bold">Setor</Label>
                    <div className="text-sm font-medium uppercase">
                      {solicitacaoDetalhes.setor_descricao || '-'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border">
                    <Label className="text-xs text-gray-500 uppercase font-bold mb-2 block">Centro de Custo</Label>
                    <div className="text-sm font-semibold">
                      {formatCodigoCentroCusto(solicitacaoDetalhes.centro_custo_unidade || '', solicitacaoDetalhes.centro_custo_nro || '')} - {solicitacaoDetalhes.centro_custo_descricao}
                    </div>
                  </div>
                </div>

                {/* Tabela de Itens */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <ShoppingCart className="size-4 text-blue-600" />
                      Itens da Solicitação
                    </Label>
                    <Badge variant="outline">{itensDetalhes.length} itens</Badge>
                  </div>
                  
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-gray-50 dark:bg-gray-900/50">
                        <TableRow>
                          <TableHead className="w-[60px] text-center">#</TableHead>
                          <TableHead>Descrição do Item</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itensDetalhes.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="text-center font-mono text-xs text-gray-500">
                              {index + 1}
                            </TableCell>
                            <TableCell className="font-medium">{item.item}</TableCell>
                            <TableCell className="text-right font-bold text-blue-600 dark:text-blue-400">
                              {item.qtde_item}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Observações</Label>
                  <div className="p-4 bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/30 rounded-lg text-sm italic text-gray-700 dark:text-gray-300 min-h-[80px]">
                    {solicitacaoDetalhes.observacao || 'Nenhuma observação informada.'}
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
            </div>
            <Button variant="default" onClick={() => setMostrarDetalhesModal(false)} className="px-8">
              Fechar
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
              Informe o motivo da reprovação para a solicitação {solicitacaoParaReprovar && formatarNumeroSolicitacao(solicitacaoParaReprovar.unidade, solicitacaoParaReprovar.seq_solicitacao_compra)}.
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
    </AdminLayout>
  );
}