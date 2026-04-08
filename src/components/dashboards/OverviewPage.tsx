import React from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { DollarSign, TrendingUp, TrendingDown, Building, Percent, Printer, FileSpreadsheet } from 'lucide-react';
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { toast } from "sonner";
import { PeriodRange } from './PeriodFilter';
import { useDashboardData } from '../../hooks/useDashboardData';
import { periodRangeToDashboardPeriod } from '../../utils/dashboardUtils';
import { OverviewData } from '../../services/dashboardService';
import { ENVIRONMENT } from '../../config/environment';
import { useTooltipStyle } from './CustomTooltip';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiUtils';
import { useRef } from 'react';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

interface OverviewPageProps {
  viewMode?: 'GERAL' | 'CARGAS' | 'PASSAGEIROS';
  domainModalidade?: string;
  period: PeriodRange;
}

export function OverviewPage({ viewMode = 'GERAL', domainModalidade = 'CARGAS', period }: OverviewPageProps) {
  const { data, loading, error, isMockData } = useDashboardData<OverviewData>({
    type: 'overview',
    period: periodRangeToDashboardPeriod(period),
    viewMode
  });
  const tooltipStyle = useTooltipStyle();
  const { user, clientConfig } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  // 🚨 CRÍTICO: Logo do cliente DEVE vir da config do domínio
  const clientLogo = clientConfig?.theme?.logo_light || '';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Carregando dados financeiros...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-destructive font-semibold">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Nenhum dado disponível</p>
      </div>
    );
  }

  // VALIDAÇÃO: Garantir que data tem a estrutura correta
  if (!data.monthly || !Array.isArray(data.monthly)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Erro: Dados em formato inválido</p>
          <p className="text-sm text-slate-500 mt-2">data.monthly não encontrado</p>
          <pre className="text-xs mt-4 bg-slate-100 dark:bg-slate-800 p-4 rounded overflow-auto max-w-xl">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  if (!data.units || !Array.isArray(data.units)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">Erro: Dados em formato inválido</p>
          <p className="text-sm text-slate-500 mt-2">data.units não encontrado</p>
          <pre className="text-xs mt-4 bg-slate-100 dark:bg-slate-800 p-4 rounded overflow-auto max-w-xl">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    );
  }

  // ✅ REGRA DE NEGÓCIO:
  // - Gráfico mensal: SEMPRE os últimos 12 meses (ignora período selecionado)
  // - Cards de totais: Usa valores da API já filtrados pelo período
  // - Units (unidades): Usa valores da API já filtrados pelo período
  const monthlyData = data.monthly; // Sempre 12 meses (backend já retorna assim)
  const unitData = data.units;

  // ✅ USAR TOTAIS QUE VÊM DA API (já filtrados pelo período selecionado)
  const totalReceita = data.receita_total || 0;
  const totalDespesas = data.despesas_total || 0;
  const totalLucro = data.lucro_liquido || 0;
  const margemLucro = data.margem_liquida || 0;

  // Função para exportar receitas
  const handleExportReceitas = async () => {
    // Verificar se está usando mockdata
    if (isMockData) {
      toast.warning('Exportação Indisponível', {
        description: 'A exportação de dados só funciona com dados reais do servidor. Os dados mockados não podem ser exportados.'
      });
      return;
    }

    // Criar toast de loading e guardar ID
    const loadingToastId = toast.info('Gerando planilha...', { 
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity // Não fechar automaticamente
    });

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/dre/export_receitas.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          period: periodRangeToDashboardPeriod(period),
          viewMode
        })
      });

      // IMPORTANTE: Verificar content-type ANTES de tentar baixar
      const contentType = response.headers.get('content-type');
      
      // Se for JSON, verificar se é um toast ou erro
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        // Fechar toast de loading
        toast.dismiss(loadingToastId);
        
        // Se tem toast, exibir e parar
        if (data.toast) {
          const toastType = data.toast.type || 'info';
          const message = data.toast.message;
          
          // Exibir toast com cor apropriada
          switch (toastType) {
            case 'success':
              toast.success(message);
              break;
            case 'error':
              toast.error(message);
              break;
            case 'warning':
              toast.warning(message);
              break;
            case 'info':
            default:
              toast.info(message);
              break;
          }
          return;
        }
        
        // Se tem erro
        if (data.error || !data.success) {
          toast.error('Erro ao gerar planilha', {
            description: data.error || 'Erro desconhecido'
          });
          return;
        }
      }

      // Se chegou aqui, é um arquivo CSV
      if (!response.ok) {
        toast.dismiss(loadingToastId);
        throw new Error('Erro ao gerar planilha');
      }

      // Download do arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extrair nome do arquivo do header Content-Disposition do PHP
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `receitas_${period.year}_${period.month || 'anual'}.csv`; // fallback
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Fechar toast de loading e mostrar sucesso
      toast.dismiss(loadingToastId);
      toast.success('Planilha gerada com sucesso!');
    } catch (error) {
      toast.dismiss(loadingToastId);
      toast.error('Erro ao gerar planilha', {
        description: 'Não foi possível gerar a planilha. Tente novamente.'
      });
    }
  };

  // Função para exportar despesas
  const handleExportDespesas = async () => {
    // Verificar se está usando mockdata
    if (isMockData) {
      toast.warning('Exportação Indisponível', {
        description: 'A exportação de dados só funciona com dados reais do servidor. Os dados mockados não podem ser exportados.'
      });
      return;
    }

    // Criar toast de loading e guardar ID
    const loadingToastId = toast.info('Gerando planilha...', { 
      description: 'Aguarde enquanto preparamos os dados.',
      duration: Infinity // Não fechar automaticamente
    });

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/dre/export_despesas.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          period: periodRangeToDashboardPeriod(period),
          viewMode
        })
      });

      // IMPORTANTE: Verificar content-type ANTES de tentar baixar
      const contentType = response.headers.get('content-type');
      
      // Se for JSON, verificar se é um toast ou erro
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        
        // Fechar toast de loading
        toast.dismiss(loadingToastId);
        
        // Se tem toast, exibir e parar
        if (data.toast) {
          const toastType = data.toast.type || 'info';
          const message = data.toast.message;
          
          // Exibir toast com cor apropriada
          switch (toastType) {
            case 'success':
              toast.success(message);
              break;
            case 'error':
              toast.error(message);
              break;
            case 'warning':
              toast.warning(message);
              break;
            case 'info':
            default:
              toast.info(message);
              break;
          }
          return;
        }
        
        // Se tem erro
        if (data.error || !data.success) {
          toast.error('Erro ao gerar planilha', {
            description: data.error || 'Erro desconhecido'
          });
          return;
        }
      }

      // Se chegou aqui, é um arquivo CSV
      if (!response.ok) {
        toast.dismiss(loadingToastId);
        throw new Error('Erro ao gerar planilha');
      }

      // Download do arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extrair nome do arquivo do header Content-Disposition do PHP
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `despesas_${period.year}_${period.month || 'anual'}.csv`; // fallback
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Fechar toast de loading e mostrar sucesso
      toast.dismiss(loadingToastId);
      toast.success('Planilha gerada com sucesso!');
    } catch (error) {
      toast.dismiss(loadingToastId);
      toast.error('Erro ao gerar planilha', {
        description: 'Não foi possível gerar a planilha. Tente novamente.'
      });
    }
  };

  const handlePrintDetailed = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    // Formatar período para exibição
    const periodDisplay = period.endMonth 
      ? `${String(period.startMonth).padStart(2, '0')}/${period.startYear} a ${String(period.endMonth).padStart(2, '0')}/${period.endYear}`
      : `${period.startYear}`;

    // 🚨 CRÍTICO: Pegar logo do cliente da config
    const logoCliente = clientConfig?.theme?.logo_light || '';
    
    // 🎨 REGRA: Se for ACV, usar logo do cliente TAMBÉM na esquerda
    const isAceville = user?.domain?.toUpperCase() === 'ACV';
    const logoEsquerda = isAceville ? logoCliente : 'https://webpresto.com.br/images/logo_rel.png';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>DRE - ${periodDisplay}</title>
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
              max-width: 120px;
              max-height: 50px;
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
            .header-right img {
              max-width: 100px;
              max-height: 45px;
            }
            .periodo-box {
              background: #f9fafb;
              padding: 12px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              margin-bottom: 20px;
              font-size: 10pt;
              text-align: center;
              font-weight: bold;
              color: #1e40af;
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
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
              font-size: 10pt;
            }
            tr {
              border-bottom: 1px solid #e5e7eb;
            }
            td {
              padding: 8px 6px;
            }
            .dre-label {
              color: #000;
            }
            .dre-label.subitem {
              padding-left: 30px;
              color: #4b5563;
            }
            .dre-value {
              text-align: right;
              font-weight: 500;
              color: #000;
            }
            .dre-value.negative {
              color: #dc2626;
            }
            tr.highlight {
              background-color: #eff6ff;
              font-weight: bold;
              border-top: 2px solid #2563eb;
              border-bottom: 2px solid #2563eb;
            }
            tr.highlight .dre-value {
              color: #10b981;
              font-size: 12pt;
            }
            /* ✅ CRÍTICO: Lucro líquido negativo deve ser vermelho */
            tr.highlight .dre-value.negative {
              color: #dc2626;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #9ca3af;
              font-size: 8pt;
            }
            @media print {
              body { padding: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <img src="${logoEsquerda}" alt="Sistema Presto" class="logo" />
              <div class="header-info">
                <h1>DEMONSTRAÇÃO DO RESULTADO (DRE)</h1>
                <p>Sistema PRESTO - Gestão de Transportadoras</p>
              </div>
            </div>
            <div class="header-right">
              <img src="${logoCliente}" alt="Logo Empresa" />
            </div>
          </div>

          <div class="periodo-box">
            PERÍODO: ${periodDisplay}
          </div>

          <div class="section">
            <div class="section-title">Demonstração do Resultado do Exercício</div>
            <table>
              <tbody>
                <tr>
                  <td class="dre-label">Receita Operacional Bruta</td>
                  <td class="dre-value">R$ ${totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="dre-label subitem">(-) Custos Operacionais</td>
                  <td class="dre-value negative">R$ ${(data.custos_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="dre-label">Lucro Bruto / EBITDA</td>
                  <td class="dre-value">R$ ${(data.ebitda || (totalReceita - (data.custos_total || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="dre-label subitem">(-) Impostos</td>
                  <td class="dre-value negative">R$ ${(data.impostos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="dre-label subitem">(-) Depreciação / Amortização</td>
                  <td class="dre-value negative">R$ ${(data.depreciacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td class="dre-label subitem">(-) Despesas Financeiras</td>
                  <td class="dre-value negative">R$ ${(data.despesas_financeiras || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr class="highlight">
                  <td class="dre-label">LUCRO LÍQUIDO</td>
                  <td class="dre-value${totalLucro < 0 ? ' negative' : ''}">R$ ${totalLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="footer">
            <p>Sistema PRESTO - Gestão de Transportadoras | www.webpresto.com.br</p>
            <p>Impresso em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    // ✅ CORREÇÃO CRÍTICA: Aguardar TODAS as imagens carregarem antes de imprimir
    const images = printWindow.document.getElementsByTagName('img');
    let loadedImages = 0;
    const totalImages = images.length;
    
    if (totalImages === 0) {
      // Se não há imagens, imprime imediatamente
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
      return;
    }
    
    const checkAllImagesLoaded = () => {
      loadedImages++;
      if (loadedImages === totalImages) {
        // Todas as imagens carregadas, aguarda mais 300ms e imprime
        setTimeout(() => {
          printWindow.print();
          printWindow.close();
        }, 300);
      }
    };
    
    // Adiciona listeners de load/error para todas as imagens
    Array.from(images).forEach((img) => {
      if (img.complete) {
        checkAllImagesLoaded();
      } else {
        img.addEventListener('load', checkAllImagesLoaded);
        img.addEventListener('error', () => {
          console.warn('Erro ao carregar imagem:', img.src);
          checkAllImagesLoaded(); // Continua mesmo com erro
        });
      }
    });
    
    // Timeout de segurança: se após 5 segundos não carregou, imprime mesmo assim
    setTimeout(() => {
      if (loadedImages < totalImages) {
        console.warn('Timeout: Algumas imagens não carregaram, imprimindo mesmo assim');
        printWindow.print();
        printWindow.close();
      }
    }, 5000);
  };

  const DRERow = ({ label, total, isSubItem = false, isHighlight = false, isNegative = false }: {
    label: string;
    total: number;
    isSubItem?: boolean;
    isHighlight?: boolean;
    isNegative?: boolean;
  }) => {
    const baseClasses = isHighlight 
      ? "py-2 font-bold border-b border-border" 
      : `py-2 ${isSubItem ? 'pl-6' : ''} border-b border-border/50`;
    
    const textClasses = isSubItem 
      ? "text-muted-foreground" 
      : "text-foreground";
    
    // ✅ CORREÇÃO: Se for highlight (Lucro Líquido) e valor negativo, usar vermelho
    const valueClasses = isNegative 
      ? "text-destructive" 
      : isHighlight && !isSubItem
      ? total < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";

    return (
      <div className={`flex justify-between items-center ${baseClasses}`}>
        <span className={textClasses}>{label}</span>
        <span className={valueClasses}>
          R$ {isNegative || total < 0 ? '(' : ''}{Math.abs(total).toLocaleString()}{isNegative || total < 0 ? ')' : ''}
        </span>
      </div>
    );
  };

  return (
    <main className="container mx-auto px-3 md:px-6 py-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground mb-1">Dashboard Financeiro</h2>
        <p className="text-muted-foreground">Visão geral de receitas, despesas e indicadores financeiros</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800 relative">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Receita Total
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-blue-700 dark:text-blue-300 hover:bg-blue-200/50 dark:hover:bg-blue-800 gap-1 px-2"
                onClick={handleExportReceitas}
                title="Exportar dados de receitas"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-xs font-medium">CSV</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              R$ {(totalReceita / 1000000).toFixed(2)}M
            </div>
            <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 mt-1">
              <TrendingUp className="w-3 h-3" />
              +12.5% vs per. ant.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800 relative">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Despesas Totais
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-red-700 dark:text-red-300 hover:bg-red-200/50 dark:hover:bg-red-800 gap-1 px-2"
                onClick={handleExportDespesas}
                title="Exportar dados de despesas"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-xs font-medium">CSV</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-900 dark:text-red-100">
              R$ {(totalDespesas / 1000000).toFixed(2)}M
            </div>
            <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 mt-1">
              <TrendingUp className="w-3 h-3" />
              +9.8% vs per. ant.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Lucro Líquido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
              R$ {(totalLucro / 1000000).toFixed(2)}M
            </div>
            <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 mt-1">
              <TrendingUp className="w-3 h-3" />
              +18.2% vs per. ant.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-purple-700 dark:text-purple-300 flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Margem Líquida
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
              {margemLucro.toFixed(1)}%
            </div>
            <div className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 mt-1">
              <TrendingUp className="w-3 h-3" />
              +1.2 p.p. vs per. ant.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Evolução Mensal (R$)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis dataKey="month" stroke="currentColor" className="opacity-50 text-[10px]" />
                <YAxis stroke="currentColor" className="opacity-50 text-[10px]" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                />
                <Legend />
                <Line type="monotone" dataKey="receita" stroke="#3b82f6" strokeWidth={2} name="Receita" />
                <Line type="monotone" dataKey="despesas" stroke="#ef4444" strokeWidth={2} name="Despesas" />
                <Line type="monotone" dataKey="lucro" stroke="#10b981" strokeWidth={2} name="Lucro" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Performance por Unidade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={unitData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="opacity-10" />
                <XAxis type="number" stroke="currentColor" className="opacity-50 text-[10px]" />
                <YAxis dataKey="unidade" type="category" stroke="currentColor" className="opacity-50 text-[10px]" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="receita" fill="#3b82f6" name="Receita" />
                <Bar dataKey="lucro" fill="#10b981" name="Lucro" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">Demonstração do Resultado - Resumo</CardTitle>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handlePrintDetailed}
              className="flex items-center gap-2 border-border hover:bg-accent text-foreground print:hidden"
            >
              <Printer className="w-4 h-4" />
              Imprimir DRE Detalhado
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* 1. Receita Operacional Bruta (+) */}
            <DRERow 
              label="Receita Operacional Bruta" 
              total={totalReceita} 
            />
            
            {/* 2. Custos Operacionais (-) */}
            <DRERow 
              label="(-) Custos Operacionais" 
              total={data.custos_total || 0} 
              isNegative={true} 
              isSubItem={true} 
            />
            
            {/* 3. Lucro Bruto / EBITDA */}
            <DRERow 
              label="Lucro Bruto / EBITDA" 
              total={data.ebitda || (totalReceita - (data.custos_total || 0))} 
            />
            
            {/* 4. Impostos (-) */}
            <DRERow 
              label="(-) Impostos" 
              total={data.impostos || 0} 
              isNegative={true} 
              isSubItem={true} 
            />
            
            {/* 5. Depreciação / Amortização (-) */}
            <DRERow 
              label="(-) Depreciação / Amortização" 
              total={data.depreciacao || 0} 
              isNegative={true} 
              isSubItem={true} 
            />
            
            {/* 6. Despesas Financeiras (-) */}
            <DRERow 
              label="(-) Despesas Financeiras" 
              total={data.despesas_financeiras || 0} 
              isNegative={true} 
              isSubItem={true} 
            />
            
            {/* 7. Lucro Líquido */}
            <DRERow 
              label="Lucro Líquido" 
              total={totalLucro} 
              isHighlight={true} 
            />
          </div>
        </CardContent>
      </Card>

      {/* ✅ Conteúdo para Impressão (oculto na tela) */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="header">
            <div className="header-left">
              <img src="https://webpresto.com.br/images/logo_rel.png" alt="Sistema Presto" className="logo" />
              <div className="header-info">
                <h1>DEMONSTRAÇÃO DO RESULTADO (DRE)</h1>
                <p>Sistema PRESTO - Gestão de Transportadoras</p>
              </div>
            </div>
            <div className="header-right">
              <img src={clientLogo} alt="Logo Empresa" />
            </div>
          </div>

          <div className="periodo-box">
            PERÍODO: {period.endMonth 
              ? `${String(period.startMonth).padStart(2, '0')}/${period.startYear} a ${String(period.endMonth).padStart(2, '0')}/${period.endYear}`
              : `${period.startYear}`
            }
          </div>

          <div className="section">
            <div className="section-title">Demonstração do Resultado do Exercício</div>
            <table>
              <tbody>
                <tr>
                  <td className="dre-label">Receita Operacional Bruta</td>
                  <td className="dre-value">R$ {totalReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className="dre-label subitem">(-) Custos Operacionais</td>
                  <td className="dre-value negative">R$ {(data.custos_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className="dre-label">Lucro Bruto / EBITDA</td>
                  <td className="dre-value">R$ {(data.ebitda || (totalReceita - (data.custos_total || 0))).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className="dre-label subitem">(-) Impostos</td>
                  <td className="dre-value negative">R$ {(data.impostos || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className="dre-label subitem">(-) Depreciação / Amortização</td>
                  <td className="dre-value negative">R$ {(data.depreciacao || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                  <td className="dre-label subitem">(-) Despesas Financeiras</td>
                  <td className="dre-value negative">R$ {(data.despesas_financeiras || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr className="highlight">
                  <td className="dre-label">LUCRO LÍQUIDO</td>
                  <td className={`dre-value${totalLucro < 0 ? ' negative' : ''}`}>R$ {totalLucro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="footer">
            <p>Sistema PRESTO - Gestão de Transportadoras | www.webpresto.com.br</p>
            <p>Impresso em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      </div>
    </main>
  );
}