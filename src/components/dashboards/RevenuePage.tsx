import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { MapPin, Ticket, Luggage, Package, FileSpreadsheet, TrendingUp, FileEdit } from "lucide-react";
import { PeriodRange } from './PeriodFilter';
import { useDashboardData } from '../../hooks/useDashboardData';
import { periodRangeToDashboardPeriod } from '../../utils/dashboardUtils';
import { RevenueData } from '../../services/dashboardService';
import { useAuth } from '../../contexts/AuthContext';
import { useTooltipStyle } from './CustomTooltip';
import { useState } from 'react';
import { LancamentosReceitasPage } from './LancamentosReceitasPage';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface RevenuePageProps {
  viewMode?: 'GERAL' | 'CARGAS' | 'PASSAGEIROS';
  domainModalidade?: string;
  period: PeriodRange;
}

export function RevenuePage({ viewMode = 'GERAL', domainModalidade = 'CARGAS', period }: RevenuePageProps) {
  const tooltipStyle = useTooltipStyle();
  const { user } = useAuth();
  const [showLancamentos, setShowLancamentos] = useState(false);
  const { data, loading, error, isMockData } = useDashboardData<RevenueData>({
    type: 'revenue',
    period: periodRangeToDashboardPeriod(period),
    viewMode
  });

  // Se estiver mostrando lançamentos, renderizar a página de lançamentos
  if (showLancamentos) {
    return (
      <LancamentosReceitasPage
        period={period}
        onBack={() => setShowLancamentos(false)}
      />
    );
  }

  const handleExportUnit = async (unitName: string) => {
    const loadingToastId = toast.loading('Gerando planilha de receitas...');
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const csvData = data?.monthly.map(month => ({
        mes: month.month,
        receita: month[unitName] || 0
      })) || [];
      
      const csvContent = [
        'Mês,Receita',
        ...csvData.map(row => `${row.mes},${row.receita}`)
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `receitas_${unitName.toLowerCase()}_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      toast.dismiss(loadingToastId);
      toast.success('Planilha gerada com sucesso!');
    } catch (error) {
      toast.dismiss(loadingToastId);
      toast.error('Erro ao gerar planilha', {
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

  if (!data) {
    return null;
  }

  // Garantir dados seguros
  const safeData = {
    monthly: data.monthly || [],
    units: data.units || [],
    revenueByUnitCargas: data.revenueByUnitCargas || [],
    revenueByUnitPassageiros: data.revenueByUnitPassageiros || [],
    ticketMedioByUnitCargas: data.ticketMedioByUnitCargas || [],
    ticketMedioByUnitPassageiros: data.ticketMedioByUnitPassageiros || [],
    unitTotals: data.unitTotals || {},
    total: data.receita_total || 0
  };

  // Selecionar dados baseado no viewMode
  const getRevenueData = () => {
    if (viewMode === 'CARGAS') return safeData.revenueByUnitCargas;
    if (viewMode === 'PASSAGEIROS') return safeData.revenueByUnitPassageiros;
    // GERAL: somar CARGAS + PASSAGEIROS dinamicamente
    return safeData.revenueByUnitCargas.map((cargas, index) => {
      const passageiros = safeData.revenueByUnitPassageiros[index];
      const merged: any = { month: cargas.month };
      
      // Somar dinamicamente todas as unidades
      Object.keys(cargas).forEach(key => {
        if (key !== 'month') {
          merged[key] = (cargas[key] || 0) + (passageiros[key] || 0);
        }
      });
      
      return merged;
    });
  };

  const getTicketData = () => {
    if (viewMode === 'CARGAS') return safeData.ticketMedioByUnitCargas;
    if (viewMode === 'PASSAGEIROS') return safeData.ticketMedioByUnitPassageiros;
    // GERAL: média ponderada (simplificada - usa CARGAS como padrão)
    return safeData.ticketMedioByUnitCargas;
  };

  const revenueByUnit = getRevenueData();
  const ticketMedioByUnit = getTicketData();
  
  // Extrair nomes das unidades dinamicamente dos dados (exceto 'month' e 'Demais')
  const unitNames = revenueByUnit.length > 0 
    ? Object.keys(revenueByUnit[0]).filter(key => key !== 'month' && key !== 'Demais')
    : [];
  
  // USAR unitTotals da API (totais do período selecionado)
  const unitTotals = safeData.unitTotals || {};
  const totalRevenue = safeData.total || 0;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-slate-900 dark:text-slate-100 mb-1">Receitas Operacionais</h2>
          <p className="text-slate-500 dark:text-slate-400">Análise detalhada das receitas por unidade</p>
        </div>
        <Button
          onClick={() => setShowLancamentos(true)}
          className="gap-2"
          variant="outline"
        >
          <FileEdit className="h-4 w-4" />
          Lançamentos Manuais
        </Button>
      </div>

      {/* Cards Especiais para PASSAGEIROS */}
      {viewMode === 'PASSAGEIROS' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-950 dark:to-sky-900 border-sky-200 dark:border-sky-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-sky-700 dark:text-sky-300 flex items-center gap-2">
                <Ticket className="w-4 h-4" />
                Bilhetes de Passagem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sky-900 dark:text-sky-100">
                R$ 1.35M
              </div>
              <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 mt-1">
                <TrendingUp className="w-3 h-3" />
                82.5% do total
              </div>
              <div className="text-xs text-sky-700 dark:text-sky-300 mt-2">
                39.400 bilhetes vendidos
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900 border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <Luggage className="w-4 h-4" />
                Excesso de Bagagem
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-amber-900 dark:text-amber-100">
                R$ 185K
              </div>
              <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 mt-1">
                <TrendingUp className="w-3 h-3" />
                11.3% do total
              </div>
              <div className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                3.250 cobranças
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900 border-teal-200 dark:border-teal-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-teal-700 dark:text-teal-300 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Transporte de Mercadorias
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-teal-900 dark:text-teal-100">
                R$ 95K
              </div>
              <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 mt-1">
                <TrendingUp className="w-3 h-3" />
                6.2% do total
              </div>
              <div className="text-xs text-teal-700 dark:text-teal-300 mt-2">
                850 encomendas
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cards de Unidades - Renderização Dinâmica */}
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${unitNames.length + 1} gap-4`}>
        {unitNames.map((unitName, index) => {
          const colors = [
            { bg: 'from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-700 dark:text-blue-300', value: 'text-blue-900 dark:text-blue-100' },
            { bg: 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', value: 'text-green-900 dark:text-green-100' },
            { bg: 'from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900', border: 'border-purple-200 dark:border-purple-800', text: 'text-purple-700 dark:text-purple-300', value: 'text-purple-900 dark:text-purple-100' },
          ];
          const color = colors[index % colors.length];
          
          return (
            <Card key={unitName} className={`bg-gradient-to-br ${color.bg} ${color.border}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className={`text-sm ${color.text} flex items-center gap-2`}>
                    <MapPin className="w-4 h-4" />
                    {unitName}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`h-7 ${color.text} hover:bg-${color.bg.split(' ')[0].replace('from-', '')}-200 gap-1 px-2`}
                    onClick={() => handleExportUnit(unitName)}
                    title={`Exportar receitas de ${unitName}`}
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="text-xs font-medium">CSV</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className={color.value}>
                  R$ {(unitTotals[unitName] / 1000000).toFixed(2)}M
                </div>
                <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 mt-1">
                  <TrendingUp className="w-3 h-3" />
                  {totalRevenue > 0 ? ((unitTotals[unitName] / totalRevenue) * 100).toFixed(1) : '0.0'}% do total
                </div>
              </CardContent>
            </Card>
          );
        })}
        
        {/* Card de Demais (sempre por último) */}
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-orange-700 dark:text-orange-300 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Demais
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-800 gap-1 px-2"
                onClick={() => handleExportUnit('Demais')}
                title="Exportar receitas de Demais"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span className="text-xs font-medium">CSV</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-orange-900 dark:text-orange-100">
              R$ {(unitTotals.Demais / 1000000).toFixed(2)}M
            </div>
            <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400 mt-1">
              <TrendingUp className="w-3 h-3" />
              {totalRevenue > 0 ? ((unitTotals.Demais / totalRevenue) * 100).toFixed(1) : '0.0'}% do total
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Receita por Unidade - Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueByUnit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis dataKey="month" stroke="#64748b" className="dark:stroke-slate-400" />
                <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                />
                <Legend />
                {unitNames.map((unitName, index) => {
                  const colors = ['#3b82f6', '#10b981', '#8b5cf6'];
                  return (
                    <Area 
                      key={unitName}
                      type="monotone" 
                      dataKey={unitName} 
                      stackId="1" 
                      stroke={colors[index % colors.length]} 
                      fill={colors[index % colors.length]} 
                      fillOpacity={0.6} 
                      name={unitName} 
                    />
                  );
                })}
                <Area type="monotone" dataKey="Demais" stackId="1" stroke="#f97316" fill="#f97316" fillOpacity={0.6} name="Demais" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Ticket Médio por Unidade
              {viewMode === 'CARGAS' && <span className="text-sm text-slate-500 dark:text-slate-400"> (CT-e)</span>}
              {viewMode === 'PASSAGEIROS' && <span className="text-sm text-slate-500 dark:text-slate-400"> (Bilhete)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={ticketMedioByUnit}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis dataKey="month" stroke="#64748b" className="dark:stroke-slate-400" />
                <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                />
                <Legend />
                {unitNames.map((unitName, index) => {
                  const colors = ['#3b82f6', '#10b981', '#8b5cf6'];
                  return (
                    <Line 
                      key={unitName}
                      type="monotone" 
                      dataKey={unitName} 
                      stroke={colors[index % colors.length]} 
                      strokeWidth={2} 
                      name={unitName} 
                    />
                  );
                })}
                <Line type="monotone" dataKey="Demais" stroke="#f97316" strokeWidth={2} name="Demais" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comparativo de Receitas por Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={revenueByUnit}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
              <XAxis dataKey="month" stroke="#64748b" className="dark:stroke-slate-400" />
              <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
              <Tooltip 
                contentStyle={tooltipStyle}
                formatter={(value: number) => `R$ ${value.toLocaleString()}`}
              />
              <Legend />
              {unitNames.map((unitName, index) => {
                const colors = ['#3b82f6', '#10b981', '#8b5cf6'];
                return (
                  <Bar 
                    key={unitName}
                    dataKey={unitName} 
                    fill={colors[index % colors.length]} 
                    name={unitName} 
                  />
                );
              })}
              <Bar dataKey="Demais" fill="#f97316" name="Demais" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}