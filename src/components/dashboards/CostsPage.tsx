import { toast } from "sonner";
import { 
  DollarSign, 
  Package, 
  Fuel, 
  Wrench, 
  Users, 
  TrendingUp, 
  FileSpreadsheet, 
  Sparkles,
  Shield,
  Activity,
  FileText,
  ChartBar,
  BarChart3,
  AlertCircle,
  Building
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { PeriodRange } from './PeriodFilter';
import { useDashboardData } from '../../hooks/useDashboardData';
import { periodRangeToDashboardPeriod } from '../../utils/dashboardUtils';
import { CostsData } from '../../services/dashboardService';
import { Label } from '../ui/label';
import React, { useState } from 'react';
import { ENVIRONMENT } from '../../config/environment';
import { useAuth } from '../../contexts/AuthContext';
import { useTooltipStyle } from './CustomTooltip';

const COLORS = ['#ef4444', '#f97316', '#3b82f6', '#8b5cf6', '#10b981'];

// ✅ CORREÇÃO 2: Função para selecionar ícones ÚNICOS dinamicamente baseado no nome do evento
const getIconForCategory = (categoryName: string, usedIcons: Set<any>) => {
  const name = categoryName.toLowerCase();
  
  // Lista de ícones disponíveis em ordem de prioridade
  const iconOptions = [
    { condition: () => name.includes('comissao') || name.includes('comissão') || name.includes('agente'), icon: DollarSign },
    { condition: () => name.includes('emprestimo') || name.includes('empréstimo') || name.includes('financiamento'), icon: DollarSign },
    { condition: () => name.includes('frete') || name.includes('transferencia') || name.includes('transferência') || name.includes('veiculo') || name.includes('veículo'), icon: DollarSign },
    { condition: () => name.includes('prestacao') || name.includes('prestação') || name.includes('transporte') || name.includes('municipal'), icon: Package },
    { condition: () => name.includes('combustivel') || name.includes('combustível') || name.includes('diesel') || name.includes('gasolina'), icon: Fuel },
    { condition: () => name.includes('manutencao') || name.includes('manutenção') || name.includes('reparo') || name.includes('oficina'), icon: Wrench },
    { condition: () => name.includes('pessoal') || name.includes('salario') || name.includes('salário') || name.includes('folha') || name.includes('funcionario') || name.includes('funcionário'), icon: Users },
    { condition: () => name.includes('tributo') || name.includes('imposto') || name.includes('taxa') || name.includes('icms') || name.includes('pis') || name.includes('cofins'), icon: DollarSign },
    { condition: () => name.includes('seguro'), icon: DollarSign },
    { condition: () => name.includes('financeiro') || name.includes('juros'), icon: TrendingUp },
    { condition: () => name.includes('compra') || name.includes('material') || name.includes('insumo'), icon: DollarSign },
    { condition: () => name.includes('cartao') || name.includes('cartão') || name.includes('pagamento'), icon: DollarSign },
    { condition: () => name.includes('administrativa') || name.includes('geral') || name.includes('demais'), icon: DollarSign },
    { condition: () => name.includes('aluguel') || name.includes('imovel') || name.includes('imóvel'), icon: DollarSign },
    { condition: () => name.includes('energia') || name.includes('agua') || name.includes('água') || name.includes('utilidade'), icon: DollarSign },
    { condition: () => name.includes('producao') || name.includes('produção') || name.includes('fabrica') || name.includes('fábrica'), icon: DollarSign },
  ];
  
  // Encontrar o ícone mais apropriado que ainda não foi usado
  for (const option of iconOptions) {
    if (option.condition() && !usedIcons.has(option.icon)) {
      return option.icon;
    }
  }
  
  // Se o ícone ideal já foi usado, procurar um alternativo não usado
  const fallbackIcons = [DollarSign, TrendingUp, Package, Shield, Activity, FileText, ChartBar, BarChart3];
  for (const icon of fallbackIcons) {
    if (!usedIcons.has(icon)) {
      return icon;
    }
  }
  
  // Último recurso: retornar Activity mesmo que já tenha sido usado
  return Activity;
};

interface CostsPageProps {
  viewMode?: 'GERAL' | 'CARGAS' | 'PASSAGEIROS';
  domainModalidade?: string;
  period: PeriodRange;
}

export function CostsPage({ viewMode = 'GERAL', domainModalidade = 'CARGAS', period }: CostsPageProps) {
  const { user } = useAuth();
  const tooltipStyle = useTooltipStyle();
  
  // ✅ NOVO: Estado para agrupar por Eventos ou Grupos
  const [groupBy, setGroupBy] = useState<'EVENTOS' | 'GRUPOS'>('EVENTOS');
  
  // Usar o hook para buscar dados (automático: MOCK ou BACKEND)
  const { data, loading, error, isMockData } = useDashboardData<CostsData>({
    type: 'costs',
    period: periodRangeToDashboardPeriod(period),
    viewMode,
    groupBy, // ✅ NOVO: Enviar groupBy para API
  });
  
  // ✅ PROTEÇÃO: Se data for null ou undefined, criar objeto vazio com defaults
  const safeData: CostsData = data || {
    total: 0,
    categoryTotals: {},
    unitCategoryTotals: {},
    costsByCategory: [],
    costsByUnitCargas: [],
    costsByUnitPassageiros: []
  };
  
  // ✅ NOVO: Função para exportar despesas por categoria
  const handleExportCategory = async (categoryName: string) => {
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
          viewMode,
          groupBy, // 'EVENTOS' ou 'GRUPOS'
          category: categoryName // ✅ NOVO: Filtro por categoria
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
            default:
              toast.info(message);
          }
          return;
        }
        
        // Se não tem toast, mas é JSON, é um erro
        toast.error('Erro ao exportar', {
          description: data.message || 'Resposta inesperada do servidor'
        });
        return;
      }

      // Se não for JSON, deve ser o CSV para download
      if (!response.ok) {
        throw new Error('Falha na exportação');
      }

      // Baixar o arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Nome do arquivo com categoria e data
      const categorySlug = categoryName.toLowerCase().replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `despesas_${categorySlug}_${dateStr}.csv`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Fechar toast de loading e mostrar sucesso
      toast.dismiss(loadingToastId);
      toast.success('Planilha exportada com sucesso!');

    } catch (error) {
      toast.dismiss(loadingToastId);
      
      toast.error('Erro ao exportar', {
        description: 'Não foi possível gerar a planilha. Tente novamente.'
      });
    }
  };

  // ✅ NOVO: Função para exportar despesas por unidade
  const handleExportUnit = async (unitName: string) => {
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
          viewMode,
          groupBy,
          unit: unitName // ✅ NOVO: Filtro por unidade
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
            default:
              toast.info(message);
          }
          return;
        }
        
        // Se não tem toast, mas é JSON, é um erro
        toast.error('Erro ao exportar', {
          description: data.message || 'Resposta inesperada do servidor'
        });
        return;
      }

      // Se não for JSON, deve ser o CSV para download
      if (!response.ok) {
        throw new Error('Falha na exportação');
      }

      // Baixar o arquivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Nome do arquivo com unidade e data
      const unitSlug = unitName.toLowerCase().replace(/\s+/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];
      a.download = `despesas_${unitSlug}_${dateStr}.csv`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Fechar toast de loading e mostrar sucesso
      toast.dismiss(loadingToastId);
      toast.success('Planilha exportada com sucesso!');

    } catch (error) {
      toast.dismiss(loadingToastId);
      
      toast.error('Erro ao exportar', {
        description: 'Não foi possível gerar a planilha. Tente novamente.'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Carregando dados...</p>
        </div>
      </div>
    );
  }

  // Se houver erro E não tiver dados
  if (error && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <p className="text-sm text-slate-500 mt-2">Tente novamente mais tarde</p>
        </div>
      </div>
    );
  }

  // Garantir que temos dados
  if (!data) {
    return null;
  }
  
  // Selecionar dados baseado no viewMode
  const getCostsData = () => {
    if (viewMode === 'CARGAS') return data.costsByCategoryCargas;
    if (viewMode === 'PASSAGEIROS') return data.costsByCategoryPassageiros;
    // GERAL: somar CARGAS + PASSAGEIROS
    return data.costsByCategoryCargas.map((cargas, index) => {
      const passageiros = data.costsByCategoryPassageiros[index];
      const combined: any = { month: cargas.month };
      
      // Somar dinamicamente todas as chaves (exceto 'month')
      Object.keys(cargas).forEach(key => {
        if (key !== 'month') {
          combined[key] = (cargas[key] || 0) + (passageiros[key] || 0);
        }
      });
      
      return combined;
    });
  };

  const getFuelEfficiency = () => {
    if (viewMode === 'CARGAS') return data.fuelEfficiencyCargas;
    if (viewMode === 'PASSAGEIROS') return data.fuelEfficiencyPassageiros;
    // GERAL: média ponderada (simplificada - usa CARGAS como padrão)
    return data.fuelEfficiencyCargas;
  };

  const costsByCategory = getCostsData();
  const fuelEfficiency = getFuelEfficiency();
  
  // ✅ Extrair dinamicamente os nomes dos eventos (categorias) do primeiro item dos dados
  const categoryKeys = costsByCategory.length > 0 
    ? Object.keys(costsByCategory[0]).filter(key => key !== 'month')
    : [];
  
  // ✅ CORREÇÃO: Usar categoryTotals do backend (respeitam período selecionado)
  // Os gráficos usam os 12 meses (costsByCategory), mas os cards usam o período
  let categoryTotals = data.categoryTotals || {};
  const totalCosts = data.totals?.total ?? 0;
  
  // 🔧 WORKAROUND: Se categoryTotals estiver vazio ou todos zerados, calcular manualmente
  const isCategoryTotalsEmpty = Object.values(categoryTotals).every(val => val === 0);
  
  if (isCategoryTotalsEmpty && costsByCategory.length > 0) {
    // Calcular totais somando os 12 meses (workaround temporário)
    categoryTotals = {};
    categoryKeys.forEach(key => {
      categoryTotals[key] = costsByCategory.reduce((sum, month) => sum + (month[key] || 0), 0);
    });
  }

  // ✅ Renderizar cards dinamicamente baseado nos eventos/categorias retornados
  const renderCategoryCards = () => {
    const usedIcons = new Set<any>();
    return categoryKeys.map((categoryKey, index) => {
      const value = categoryTotals[categoryKey] || 0;
      const percentage = totalCosts > 0 ? ((value / totalCosts) * 100).toFixed(1) : '0.0';
      const color = COLORS[index % COLORS.length];
      
      // ✅ Obter o componente de ícone dinamicamente
      const IconComponent = getIconForCategory(categoryKey, usedIcons);
      usedIcons.add(IconComponent);
      
      // Mapear cores para classes Tailwind
      const colorClasses: Record<string, any> = {
        '#ef4444': {
          bg: 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900',
          border: 'border-red-200 dark:border-red-800',
          title: 'text-red-700 dark:text-red-300',
          value: 'text-red-900 dark:text-red-100',
          subtitle: 'text-red-600 dark:text-red-400'
        },
        '#f97316': {
          bg: 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900',
          border: 'border-orange-200 dark:border-orange-800',
          title: 'text-orange-700 dark:text-orange-300',
          value: 'text-orange-900 dark:text-orange-100',
          subtitle: 'text-orange-600 dark:text-orange-400'
        },
        '#3b82f6': {
          bg: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
          border: 'border-blue-200 dark:border-blue-800',
          title: 'text-blue-700 dark:text-blue-300',
          value: 'text-blue-900 dark:text-blue-100',
          subtitle: 'text-blue-600 dark:text-blue-400'
        },
        '#8b5cf6': {
          bg: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
          border: 'border-purple-200 dark:border-purple-800',
          title: 'text-purple-700 dark:text-purple-300',
          value: 'text-purple-900 dark:text-purple-100',
          subtitle: 'text-purple-600 dark:text-purple-400'
        },
        '#10b981': {
          bg: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900',
          border: 'border-green-200 dark:border-green-800',
          title: 'text-green-700 dark:text-green-300',
          value: 'text-green-900 dark:text-green-100',
          subtitle: 'text-green-600 dark:text-green-400'
        }
      };

      const classes = colorClasses[color] || colorClasses['#3b82f6']; // fallback azul

      // ✅ CORREÇÃO: Title Case (capitalizar cada palavra)
      const formatTitle = (text: string) => {
        return text
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
      };

      return (
        <Card key={categoryKey} className={`bg-gradient-to-br ${classes.bg} ${classes.border} flex flex-col`}>
          {/* ✅ ALTURA FIXA para o header (garante alinhamento dos valores abaixo) */}
          <CardHeader className="pb-2 h-[72px] flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className={`text-sm ${classes.title} flex items-center gap-2`}>
                {/* ✅ Ícone fixo no topo */}
                <IconComponent className="w-4 h-4 flex-shrink-0" />
                {/* ✅ Título com Title Case */}
                <span className="leading-tight">{formatTitle(categoryKey)}</span>
              </CardTitle>
              {/* ✅ NOVO: Botão CSV no header (mesmo estilo do RevenuePage) */}
              <Button
                variant="ghost"
                size="sm"
                className={`h-7 ${classes.title} hover:bg-opacity-20 gap-1 px-2`}
                onClick={() => handleExportCategory(categoryKey)}
                title={`Exportar despesas de ${formatTitle(categoryKey)}`}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-xs font-medium">CSV</span>
              </Button>
            </div>
          </CardHeader>
          {/* ✅ Conteúdo alinhado (valores sempre na mesma posição) */}
          <CardContent className="flex-1 flex flex-col justify-start">
            <div className={classes.value}>
              R$ {(value / 1000000).toFixed(2)}M
            </div>
            <div className={`flex items-center gap-1 text-sm ${classes.subtitle} mt-1`}>
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {percentage}% do total
            </div>
          </CardContent>
        </Card>
      );
    });
  };

  // ✅ Renderizar áreas do gráfico dinamicamente
  const renderChartAreas = () => {
    return categoryKeys.map((categoryKey, index) => {
      const color = COLORS[index % COLORS.length];
      // ✅ Formatar nome para Title Case
      const formattedName = categoryKey
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      return (
        <Area 
          key={categoryKey}
          type="monotone" 
          dataKey={categoryKey} 
          stackId="1" 
          stroke={color} 
          fill={color} 
          fillOpacity={0.8} 
          name={formattedName}
        />
      );
    });
  };

  // ✅ Renderizar linhas do gráfico dinamicamente
  const renderChartLines = () => {
    return categoryKeys.map((categoryKey, index) => {
      const color = COLORS[index % COLORS.length];
      // ✅ Formatar nome para Title Case
      const formattedName = categoryKey
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      
      return (
        <Line 
          key={categoryKey}
          type="monotone" 
          dataKey={categoryKey} 
          stroke={color} 
          strokeWidth={2} 
          name={formattedName}
        />
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* ✅ NOVO: Toggle Agrupar por Eventos/Grupos */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 dark:text-slate-100 mb-1">Despesas / Custos</h2>
          <p className="text-slate-500 dark:text-slate-400">Análise detalhada das despesas por categoria</p>
        </div>
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
          <Label htmlFor="groupBy" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Agrupar por:
          </Label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGroupBy('EVENTOS')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                groupBy === 'EVENTOS'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Eventos
            </button>
            <button
              onClick={() => setGroupBy('GRUPOS')}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                groupBy === 'GRUPOS'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Grupos
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {renderCategoryCards()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Composição de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={costsByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis dataKey="month" stroke="#64748b" className="dark:stroke-slate-400" />
                <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                />
                <Legend />
                {renderChartAreas()}
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evolução de Custos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={costsByCategory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis dataKey="month" stroke="#64748b" className="dark:stroke-slate-400" />
                <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                />
                <Legend />
                {renderChartLines()}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ✅ SEÇÃO DE UNIDADES (SEMPRE VISÍVEL) */}
      <div className="border-t-2 border-slate-200 dark:border-slate-700 pt-8 mt-8">
        <div className="mb-6">
          <h2 className="text-slate-900 dark:text-slate-100 mb-1">Análise por Unidades</h2>
          <p className="text-slate-500 dark:text-slate-400">Distribuição das despesas por unidade organizacional</p>
        </div>

        {/* Cards de Unidades */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          {data.unitCategoryTotals && Object.keys(data.unitCategoryTotals).map((unitKey, index) => {
            const value = data.unitCategoryTotals[unitKey] || 0;
            const percentage = totalCosts > 0 ? ((value / totalCosts) * 100).toFixed(1) : '0.0';
            const color = COLORS[index % COLORS.length];
            
            const colorClasses: Record<string, any> = {
              '#ef4444': {
                bg: 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900',
                border: 'border-red-200 dark:border-red-800',
                title: 'text-red-700 dark:text-red-300',
                value: 'text-red-900 dark:text-red-100',
                subtitle: 'text-red-600 dark:text-red-400'
              },
              '#f97316': {
                bg: 'from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900',
                border: 'border-orange-200 dark:border-orange-800',
                title: 'text-orange-700 dark:text-orange-300',
                value: 'text-orange-900 dark:text-orange-100',
                subtitle: 'text-orange-600 dark:text-orange-400'
              },
              '#3b82f6': {
                bg: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900',
                border: 'border-blue-200 dark:border-blue-800',
                title: 'text-blue-700 dark:text-blue-300',
                value: 'text-blue-900 dark:text-blue-100',
                subtitle: 'text-blue-600 dark:text-blue-400'
              },
              '#8b5cf6': {
                bg: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900',
                border: 'border-purple-200 dark:border-purple-800',
                title: 'text-purple-700 dark:text-purple-300',
                value: 'text-purple-900 dark:text-purple-100',
                subtitle: 'text-purple-600 dark:text-purple-400'
              },
              '#10b981': {
                bg: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900',
                border: 'border-green-200 dark:border-green-800',
                title: 'text-green-700 dark:text-green-300',
                value: 'text-green-900 dark:text-green-100',
                subtitle: 'text-green-600 dark:text-green-400'
              }
            };

            const classes = colorClasses[color] || colorClasses['#3b82f6'];

            return (
              <Card key={unitKey} className={`bg-gradient-to-br ${classes.bg} ${classes.border} flex flex-col`}>
                <CardHeader className="pb-2 h-[72px] flex-shrink-0">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-sm ${classes.title} flex items-center gap-2`}>
                      <Building className="w-4 h-4 flex-shrink-0" />
                      <span className="leading-tight">{unitKey}</span>
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`h-7 ${classes.title} hover:bg-opacity-20 gap-1 px-2`}
                      onClick={() => handleExportUnit(unitKey)}
                      title={`Exportar despesas de ${unitKey}`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="text-xs font-medium">CSV</span>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-start">
                  <div className={classes.value}>
                    R$ {(value / 1000000).toFixed(2)}M
                  </div>
                  <div className={`flex items-center gap-1 text-sm ${classes.subtitle} mt-1`}>
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    {percentage}% do total
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Gráficos de Unidades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Unidades</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.unitCategoryTotals ? Object.entries(data.unitCategoryTotals).map(([name, value], index) => ({
                      name,
                      value,
                      fill: COLORS[index % COLORS.length]
                    })) : []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    innerRadius={50}
                    dataKey="value"
                    stroke="none"
                  >
                    {data.unitCategoryTotals && Object.keys(data.unitCategoryTotals).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Composição de Custos por Unidades</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.costsByUnitCargas || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                  <XAxis dataKey="month" stroke="#64748b" className="dark:stroke-slate-400" />
                  <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
                  <Tooltip 
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                  />
                  <Legend />
                  {data.unitCategoryTotals && Object.keys(data.unitCategoryTotals).map((unitKey, index) => {
                    const color = COLORS[index % COLORS.length];
                    return (
                      <Area
                        key={unitKey}
                        type="monotone"
                        dataKey={unitKey}
                        stackId="1"
                        stroke={color}
                        fill={color}
                        fillOpacity={0.8}
                        name={unitKey}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}