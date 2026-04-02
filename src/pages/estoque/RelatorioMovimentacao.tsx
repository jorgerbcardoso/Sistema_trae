import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { 
  Loader2, 
  Search, 
  Printer, 
  FileText,
  FileSpreadsheet,
  Package,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  Eye
} from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner';
import { apiFetch } from '../../utils/apiUtils';
import {
  mockGetMovimentacoes,
  type MovimentacaoEstoque,
  type MovimentacaoFilters
} from '../../mocks/mockMovimentacaoEstoque';
import { MOCK_TIPOS_ITEM } from '../../mocks/estoqueComprasMocks';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { FilterSelectEstoque } from '../../components/shared/FilterSelectEstoque';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';

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

export default function RelatorioMovimentacao() {
  usePageTitle('Relatório de Movimentação');

  const { user, clientConfig } = useAuth();

  const [loading, setLoading] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [movimentacaoSelecionada, setMovimentacaoSelecionada] = useState<MovimentacaoEstoque | null>(null);
  
  const [filters, setFilters] = useState<MovimentacaoFilters>({
    unidade: user?.unidade_atual || 'MTZ', // 🔥 CORRIGIDO: usa unidade_atual
    seq_estoque: undefined,
    tipo: '',
    seq_tipo_item: undefined,
    seq_item: undefined,
    data_inicio: get30DaysAgo(),
    data_fim: getToday()
  });

  const canChangeUnidade = useMemo(() => {
    return user?.unidade_atual === 'MTZ'; // 🔥 CORRIGIDO: usa unidade_atual
  }, [user?.unidade_atual]);

  // 🔒 FORÇA a unidade do filtro quando usuário não é MTZ
  useEffect(() => {
    if (user?.unidade_atual && user.unidade_atual !== 'MTZ') {
      setFilters(prev => ({ ...prev, unidade: user.unidade_atual })); // 🔥 CORRIGIDO: usa unidade_atual
    }
  }, [user?.unidade_atual]); // 🔥 CORRIGIDO: dependência alterada

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      if (ENVIRONMENT.isFigmaMake) {
        const result = await mockGetMovimentacoes(filters);
        
        if (result.success) {
          setMovimentacoes(result.movimentacoes);
          
          if (result.movimentacoes.length === 0) {
            toast.info('Nenhuma movimentação encontrada com os filtros aplicados.');
          }
        }
      } else {
        // ✅ CORRIGIDO: Endpoint correto é /movimentacoes.php (plural)
        const result = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/movimentacoes.php`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
          }
        );

        if (result.success) {
          setMovimentacoes(result.data || []);
          
          if ((result.data || []).length === 0) {
            toast.info('Nenhuma movimentação encontrada com os filtros aplicados.');
          } else {
            toast.success(`${result.data.length} movimentação(ões) encontrada(s)!`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar movimentações:', error);
      toast.error('Erro ao buscar movimentações. Verifique os filtros e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    if (movimentacoes.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    try {
      setLoading(true);

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        toast.success('Planilha Excel exportada com sucesso!');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${ENVIRONMENT.apiBaseUrl}/estoque/exportar_movimentacao.php`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            filters,
            movimentacoes
          })
        }
      );

      // Verificar se é JSON (erro) ou BLOB (sucesso)
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao gerar planilha');
      }

      if (!response.ok) {
        throw new Error('Erro ao exportar planilha');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `movimentacao_estoque_${new Date().getTime()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Planilha Excel exportada com sucesso!');
    } catch (error: any) {
      console.error('❌ Erro ao exportar Excel:', error);
      toast.error(error.message || 'Erro ao exportar planilha Excel. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (movimentacoes.length === 0) {
      toast.error('Não há dados para imprimir');
      return;
    }

    // 🚨 CRÍTICO: Pegar logo do cliente da config
    const logoEmpresa = clientConfig?.theme?.logo_light || '';

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    const dataInicio = filters.data_inicio ? new Date(filters.data_inicio + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
    const dataFim = filters.data_fim ? new Date(filters.data_fim + 'T00:00:00').toLocaleDateString('pt-BR') : '-';
    const tipoDescricao = obterDescricaoTipo(filters.tipo || 'TODOS');

    // Obter domínio do usuário para logo do cliente
    const dominio = user?.domain?.toUpperCase() || 'PRESTO';
    const logoUrl = dominio === 'ACV' 
      ? 'https://sistema.webpresto.com.br/images/logos_clientes/aceville.png'
      : 'https://webpresto.com.br/images/logo_rel.png';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Relatório de Movimentação - ${dataInicio} a ${dataFim}</title>
        <style>
          @page {
            size: landscape;
            margin: 12mm;
          }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: Arial, sans-serif; 
            font-size: 8pt;
            color: #000;
            line-height: 1.2;
          }
          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 2px solid #2563eb;
          }
          .header-left {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .logo {
            max-width: 150px;
            max-height: 45px;
            object-fit: contain;
          }
          .header-info h1 {
            font-size: 12pt;
            color: #2563eb;
            margin-bottom: 2px;
          }
          .header-info p {
            font-size: 7pt;
            color: #666;
          }
          .header-right {
            text-align: right;
          }
          .header-right img {
            max-width: 120px;
            max-height: 40px;
            display: block;
            margin-left: auto;
            object-fit: contain;
          }
          .filters-section {
            background: #f3f4f6;
            padding: 6px 10px;
            border-radius: 4px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7pt;
          }
          .filters-left {
            display: flex;
            gap: 15px;
          }
          .filter-item {
            display: flex;
            gap: 4px;
          }
          .filter-label {
            font-weight: bold;
            color: #4b5563;
          }
          .filter-value {
            color: #1f2937;
          }
          .totals-row {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            background: #eff6ff;
            padding: 6px 10px;
            border-radius: 4px;
            margin-bottom: 8px;
            font-size: 8pt;
          }
          .total-item {
            display: flex;
            gap: 4px;
            align-items: center;
          }
          .total-label {
            font-weight: bold;
            color: #4b5563;
          }
          .total-value {
            font-weight: bold;
          }
          .total-movs { color: #2563eb; }
          .total-entradas { color: #059669; }
          .total-saidas { color: #dc2626; }
          .total-saldo { color: ${totais.saldo >= 0 ? '#059669' : '#dc2626'}; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7pt;
          }
          thead th {
            background-color: #1e40af;
            color: white;
            font-weight: bold;
            padding: 5px 3px;
            text-align: left;
            font-size: 7pt;
            border: 1px solid #1e3a8a;
            white-space: nowrap;
          }
          thead th.text-right {
            text-align: right;
          }
          thead th.text-center {
            text-align: center;
          }
          tbody td {
            border: 1px solid #e5e7eb;
            padding: 3px;
            vertical-align: top;
            font-size: 7pt;
            overflow: hidden;
            text-overflow: ellipsis;
            word-wrap: break-word;
            max-width: 0;
          }
          
          tbody td > div {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          
          tbody tr:nth-child(even) {
            background-color: #f9fafb;
          }
          .text-right {
            text-align: right;
          }
          .text-center {
            text-align: center;
          }
          .font-mono {
            font-family: 'Courier New', monospace;
          }
          .tipo-entrada {
            color: #059669;
            font-weight: bold;
          }
          .tipo-saida {
            color: #dc2626;
            font-weight: bold;
          }
          .codigo-item {
            font-weight: bold;
            font-family: 'Courier New', monospace;
            font-size: 7pt;
          }
          .desc-item {
            font-size: 6pt;
            color: #6b7280;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 150px;
          }
          tfoot td {
            background: #f3f4f6;
            font-weight: bold;
            padding: 5px 3px;
            border: 1px solid #d1d5db;
            font-size: 7pt;
          }
          .footer {
            margin-top: 10px;
            padding-top: 6px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #9ca3af;
            font-size: 6pt;
          }
          /* Larguras específicas para colunas */
          .col-data { width: 65px; min-width: 65px; max-width: 65px; }
          .col-tipo { width: 75px; min-width: 75px; max-width: 75px; }
          .col-item { width: 150px; min-width: 150px; max-width: 150px; }
          .col-estoque { width: 90px; min-width: 90px; max-width: 90px; }
          .col-local { width: 50px; min-width: 50px; max-width: 50px; }
          .col-qtde { width: 45px; min-width: 45px; max-width: 45px; }
          .col-vlr-unit { width: 50px; min-width: 50px; max-width: 50px; }
          .col-vlr-total { width: 55px; min-width: 55px; max-width: 55px; }
          .col-obs { width: auto; }
          @media print {
            body { padding: 0; }
            @page { margin: 8mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="header-left">
            <img src="${logoUrl}" alt="Logo Cliente" class="logo" crossorigin="anonymous" />
            <div class="header-info">
              <h1>RELATÓRIO DE MOVIMENTAÇÃO DE ESTOQUE</h1>
              <p>Sistema de Gestão</p>
            </div>
          </div>
          <div class="header-right">
            <img 
              src="https://webpresto.com.br/images/logo_rel.png" 
              alt="Sistema Presto" 
              crossorigin="anonymous"
            />
          </div>
        </div>

        <div class="filters-section">
          <div class="filters-left">
            <div class="filter-item">
              <span class="filter-label">Período:</span>
              <span class="filter-value">${dataInicio} até ${dataFim}</span>
            </div>
            <div class="filter-item">
              <span class="filter-label">Unidade:</span>
              <span class="filter-value">${filters.unidade}</span>
            </div>
            ${filters.tipo ? `
            <div class="filter-item">
              <span class="filter-label">Tipo:</span>
              <span class="filter-value">${tipoDescricao}</span>
            </div>
            ` : ''}
          </div>
          <div>
            <span class="filter-label">Gerado em:</span>
            <span class="filter-value">${new Date().toLocaleString('pt-BR')}</span>
          </div>
        </div>

        <div class="totals-row">
          <div class="total-item">
            <span class="total-label">Total:</span>
            <span class="total-value total-movs">${totais.qtdeTotal}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Entradas:</span>
            <span class="total-value total-entradas">${totais.qtdeEntradas} | R$ ${formatarValor(totais.totalEntradas)}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Saídas:</span>
            <span class="total-value total-saidas">${totais.qtdeSaidas} | R$ ${formatarValor(totais.totalSaidas)}</span>
          </div>
          <div class="total-item">
            <span class="total-label">Saldo:</span>
            <span class="total-value total-saldo">R$ ${formatarValor(totais.saldo)}</span>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th class="col-data">Data/Hora</th>
              <th class="col-tipo">Tipo</th>
              <th class="col-item">Item</th>
              <th class="col-estoque">Estoque</th>
              <th class="col-local text-center">Local.</th>
              <th class="col-qtde text-right">Qtde.</th>
              <th class="col-vlr-unit text-right">Vlr.Unit.</th>
              <th class="col-vlr-total text-right">Vlr.Total</th>
              <th class="col-obs">Observação</th>
            </tr>
          </thead>
          <tbody>
            ${movimentacoes.map(mvto => `
              <tr>
                <td class="col-data">
                  <div style="font-weight: bold;">${mvto.data_mvto}</div>
                  <div style="color: #9ca3af; font-size: 6pt;">${mvto.hora_mvto}</div>
                </td>
                <td class="col-tipo">
                  <span class="${mvto.mvto === 'E' ? 'tipo-entrada' : 'tipo-saida'}">
                    ${mvto.mvto === 'E' ? '▲' : '▼'} ${obterDescricaoTipo(mvto.tipo)}
                  </span>
                </td>
                <td class="col-item">
                  <div class="codigo-item">${mvto.codigo_item}</div>
                  <div class="desc-item" title="${mvto.descricao_item}">${mvto.descricao_item}</div>
                </td>
                <td class="col-estoque">
                  <div style="font-weight: bold; font-size: 7pt;">${mvto.unidade || '-'}</div>
                  <div style="font-size: 6pt; color: #6b7280;">${mvto.nro_estoque || ''} ${mvto.estoque_descricao || ''}</div>
                </td>
                <td class="col-local text-center font-mono">
                  ${mvto.localizacao || '-'}
                </td>
                <td class="col-qtde text-right font-mono" style="font-weight: bold;">
                  ${formatarValor(parseFloat(String(mvto.qtde_item)))}
                </td>
                <td class="col-vlr-unit text-right font-mono">
                  ${formatarValor(parseFloat(String(mvto.vlr_unitario)))}
                </td>
                <td class="col-vlr-total text-right font-mono" style="font-weight: bold;">
                  ${formatarValor(parseFloat(String(mvto.vlr_total)))}
                </td>
                <td class="col-obs" style="font-size: 6pt; color: #4b5563;">
                  ${(mvto.observacao || '-').substring(0, 50)}${(mvto.observacao && mvto.observacao.length > 50) ? '...' : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="7" class="text-right">TOTAL GERAL:</td>
              <td class="text-right font-mono">
                R$ ${formatarValor(movimentacoes.reduce((sum, m) => sum + parseFloat(String(m.vlr_total)), 0))}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div class="footer">
          <p>Sistema PRESTO - Gestão Completa para Transportadoras | Documento gerado em ${new Date().toLocaleString('pt-BR')}</p>
        </div>

        <script>
          // Aguardar o carregamento de todas as imagens antes de imprimir
          let imagesLoaded = 0;
          const totalImages = 2; // Logo Cliente + Logo Presto
          
          function checkAllImagesLoaded() {
            imagesLoaded++;
            if (imagesLoaded >= totalImages) {
              setTimeout(() => {
                window.print();
              }, 500);
            }
          }

          const images = document.querySelectorAll('img');
          images.forEach(img => {
            if (img.complete) {
              checkAllImagesLoaded();
            } else {
              img.onload = checkAllImagesLoaded;
              img.onerror = checkAllImagesLoaded;
            }
          });

          // Timeout de segurança
          setTimeout(() => {
            if (imagesLoaded < totalImages) {
              window.print();
            }
          }, 3000);
        </script>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
  };

  const calcularTotais = () => {
    const totalEntradas = movimentacoes
      .filter(m => m.mvto === 'E')
      .reduce((sum, m) => sum + parseFloat(String(m.vlr_total)), 0);

    const totalSaidas = movimentacoes
      .filter(m => m.mvto === 'S')
      .reduce((sum, m) => sum + parseFloat(String(m.vlr_total)), 0);

    const qtdeEntradas = movimentacoes.filter(m => m.mvto === 'E').length;
    const qtdeSaidas = movimentacoes.filter(m => m.mvto === 'S').length;

    return {
      totalEntradas,
      totalSaidas,
      saldo: totalEntradas - totalSaidas,
      qtdeEntradas,
      qtdeSaidas,
      qtdeTotal: movimentacoes.length
    };
  };

  const totais = calcularTotais();

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const obterDescricaoTipo = (tipo: string) => {
    switch (tipo) {
      case 'E': return 'Entrada Manual';
      case 'P': return 'Pedido';
      case 'I': return 'Inventário';
      case 'S': return 'Saída';
      case 'R': return 'Requisição';
      default: return tipo;
    }
  };

  const obterBadgeTipo = (tipo: string) => {
    const desc = obterDescricaoTipo(tipo);
    const variant = obterCorBadgeTipo(tipo);
    return { desc, variant };
  };

  const obterCorBadgeTipo = (tipo: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (tipo) {
      case 'P': return 'default'; // azul - Pedido
      case 'E': return 'secondary'; // cinza - Entrada Manual
      case 'I': return 'outline'; // outline - Inventário
      case 'S': return 'destructive'; // vermelho - Saída
      case 'R': return 'default'; // azul - Requisição
      default: return 'secondary';
    }
  };

  const handleVerDetalhes = (mvto: MovimentacaoEstoque) => {
    setMovimentacaoSelecionada(mvto);
    setDetalhesOpen(true);
  };

  return (
    <AdminLayout
      title="Relatório de Movimentação"
      description="Consulta de movimentações do estoque"
    >
      <div className="mb-6 no-print">
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Pesquisa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={filters.data_inicio}
                  onChange={(e) => setFilters({ ...filters, data_inicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={filters.data_fim}
                  onChange={(e) => setFilters({ ...filters, data_fim: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Unidade {!canChangeUnidade && <span className="text-xs text-gray-500">(Fixa)</span>}</Label>
                <FilterSelectUnidadeSingle
                  value={filters.unidade}
                  onChange={(value) => setFilters({ ...filters, unidade: value })}
                  disabled={!canChangeUnidade}
                />
              </div>

              <FilterSelectEstoque
                value={filters.seq_estoque?.toString() || 'ALL'}
                onChange={(value) =>
                  setFilters({ ...filters, seq_estoque: value === 'ALL' ? undefined : Number(value) })
                }
                label="Estoque"
                unidade={filters.unidade}
              />

              <div className="space-y-2">
                <Label>Tipo de Movimentação</Label>
                <Select
                  value={filters.tipo || 'TODOS'}
                  onValueChange={(value) => setFilters({ ...filters, tipo: value === 'TODOS' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="E">Entrada Manual</SelectItem>
                    <SelectItem value="P">Pedido</SelectItem>
                    <SelectItem value="I">Inventário</SelectItem>
                    <SelectItem value="S">Saída</SelectItem>
                    <SelectItem value="R">Requisição</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Item</Label>
                <Select
                  value={filters.seq_tipo_item?.toString() || 'TODOS'}
                  onValueChange={(value) =>
                    setFilters({ ...filters, seq_tipo_item: value === 'TODOS' ? undefined : Number(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    {MOCK_TIPOS_ITEM.filter(t => t.ativo === 'S').map((tipo) => (
                      <SelectItem key={tipo.seq_tipo_item} value={tipo.seq_tipo_item.toString()}>
                        {tipo.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Item (SEQ)</Label>
                <Input
                  type="number"
                  placeholder="Seq do Item"
                  value={filters.seq_item || ''}
                  onChange={(e) => setFilters({ ...filters, seq_item: e.target.value ? Number(e.target.value) : undefined })}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleSearch} className="gap-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    Buscar
                  </>
                )}
              </Button>

              {hasSearched && movimentacoes.length > 0 && (
                <>
                  <Button
                    onClick={handleExportExcel}
                    variant="outline"
                    className="gap-2"
                    disabled={loading}
                  >
                    <FileSpreadsheet className="size-4" />
                    Gerar Excel
                  </Button>

                  <Button onClick={handlePrint} variant="outline" className="gap-2">
                    <Printer className="size-4" />
                    Imprimir
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {hasSearched && movimentacoes.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 no-print">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Total de Movimentações</p>
                    <p className="text-2xl font-bold">{totais.qtdeTotal}</p>
                  </div>
                  <Package className="size-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Entradas ({totais.qtdeEntradas})</p>
                    <p className="text-2xl font-bold text-green-600">R$ {formatarValor(totais.totalEntradas)}</p>
                  </div>
                  <ArrowUpCircle className="size-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Saídas ({totais.qtdeSaidas})</p>
                    <p className="text-2xl font-bold text-red-600">R$ {formatarValor(totais.totalSaidas)}</p>
                  </div>
                  <ArrowDownCircle className="size-8 text-red-600 opacity-50" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Saldo do Período</p>
                    <p className={`text-2xl font-bold ${totais.saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      R$ {formatarValor(totais.saldo)}
                    </p>
                  </div>
                  {totais.saldo >= 0 ? (
                    <TrendingUp className="size-8 text-green-600 opacity-50" />
                  ) : (
                    <TrendingDown className="size-8 text-red-600 opacity-50" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {hasSearched && (
        <>
          {loading ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex items-center justify-center gap-3 text-gray-500">
                  <Loader2 className="size-6 animate-spin" />
                  <span>Carregando movimentações...</span>
                </div>
              </CardContent>
            </Card>
          ) : movimentacoes.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-gray-500">
                  <Package className="size-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma movimentação encontrada</p>
                  <p className="text-sm mt-1">Ajuste os filtros e tente novamente</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 dark:bg-slate-800">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold whitespace-nowrap">Data/Hora</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold">Movimento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">Tipo</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold">Estoque</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">Quantidade</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">Vlr. Unit.</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold whitespace-nowrap">Vlr. Total</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimentacoes.map((mvto) => {
                        const badgeInfo = obterBadgeTipo(mvto.tipo);
                        return (
                          <tr
                            key={mvto.seq_mvto_estoque}
                            className="border-t border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                          >
                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                              <div>{mvto.data_mvto}</div>
                              <div className="text-xs text-gray-500">{mvto.hora_mvto}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              {mvto.mvto === 'E' ? (
                                <span className="font-semibold text-green-600">Entrada</span>
                              ) : (
                                <span className="font-semibold text-red-600">Saída</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <Badge variant={badgeInfo.variant}>{badgeInfo.desc}</Badge>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-mono font-semibold">{mvto.codigo_item}</div>
                              <div className="text-xs text-gray-500">{mvto.descricao_item}</div>
                              <div className="text-xs text-gray-400">{mvto.tipo_item_descricao}</div>
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="font-semibold">{mvto.unidade || '-'}</div>
                              <div className="text-xs text-gray-500">{mvto.nro_estoque || ''} - {mvto.estoque_descricao || ''}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold">
                              {formatarValor(parseFloat(String(mvto.qtde_item)))}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              R$ {formatarValor(parseFloat(String(mvto.vlr_unitario)))}
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-semibold">
                              R$ {formatarValor(parseFloat(String(mvto.vlr_total)))}
                            </td>
                            <td className="px-4 py-3 text-sm text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleVerDetalhes(mvto)}
                                className="gap-2"
                              >
                                <Eye className="size-4" />
                                Ver Detalhes
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 dark:bg-slate-800 font-bold">
                      <tr>
                        <td colSpan={7} className="px-4 py-3 text-sm text-right">
                          TOTAL GERAL:
                        </td>
                        <td className="px-4 py-3 text-sm text-right">
                          R$ {formatarValor(movimentacoes.reduce((sum, m) => sum + parseFloat(String(m.vlr_total)), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Modal de Detalhes */}
      <Dialog open={detalhesOpen} onOpenChange={setDetalhesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Movimentação</DialogTitle>
            <DialogDescription>
              Informações completas da movimentação de estoque
            </DialogDescription>
          </DialogHeader>
          
          {movimentacaoSelecionada && (
            <div className="space-y-6">
              {/* Informações Gerais */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Data</Label>
                  <p className="font-semibold">{movimentacaoSelecionada.data_mvto}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Hora</Label>
                  <p className="font-semibold">{movimentacaoSelecionada.hora_mvto}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Movimento</Label>
                  <p className={`font-semibold ${movimentacaoSelecionada.mvto === 'E' ? 'text-green-600' : 'text-red-600'}`}>
                    {movimentacaoSelecionada.mvto === 'E' ? 'Entrada' : 'Saída'}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Tipo</Label>
                  <div className="mt-1">
                    <Badge variant={obterBadgeTipo(movimentacaoSelecionada.tipo).variant}>
                      {obterBadgeTipo(movimentacaoSelecionada.tipo).desc}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-xs text-gray-500">Item</Label>
                <div className="mt-1">
                  <p className="font-mono font-semibold">{movimentacaoSelecionada.codigo_item}</p>
                  <p className="text-sm text-gray-600">{movimentacaoSelecionada.descricao_item}</p>
                  <p className="text-xs text-gray-400">{movimentacaoSelecionada.tipo_item_descricao}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-xs text-gray-500">Estoque</Label>
                <div className="mt-1">
                  <p className="font-semibold">{movimentacaoSelecionada.unidade || '-'}</p>
                  <p className="text-sm text-gray-600">{movimentacaoSelecionada.nro_estoque || ''} - {movimentacaoSelecionada.estoque_descricao || ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <div>
                  <Label className="text-xs text-gray-500">Localização</Label>
                  <p className="font-mono font-semibold">{movimentacaoSelecionada.localizacao || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Quantidade</Label>
                  <p className="font-semibold">{formatarValor(parseFloat(String(movimentacaoSelecionada.qtde_item)))}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Valor Unitário</Label>
                  <p className="font-semibold">R$ {formatarValor(parseFloat(String(movimentacaoSelecionada.vlr_unitario)))}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Valor Total</Label>
                  <p className="font-semibold text-blue-600">R$ {formatarValor(parseFloat(String(movimentacaoSelecionada.vlr_total)))}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="text-xs text-gray-500">Observação</Label>
                <p className="text-sm text-gray-600 mt-1">{movimentacaoSelecionada.observacao || '-'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}