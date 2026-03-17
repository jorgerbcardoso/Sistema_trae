import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, Percent, 
  Target, CheckCircle, AlertCircle, Scale, Truck, 
  Gauge, MapPin 
} from 'lucide-react';
import { PeriodRange } from './PeriodFilter';
import { useDashboardData } from '../../hooks/useDashboardData';
import { periodRangeToDashboardPeriod } from '../../utils/dashboardUtils';
import { ProfitabilityData } from '../../services/dashboardService';
import { useTooltipStyle } from './CustomTooltip';

interface ProfitabilityPageProps {
  viewMode?: 'GERAL' | 'CARGAS' | 'PASSAGEIROS';
  domainModalidade?: string;
  period: PeriodRange;
}

export function ProfitabilityPage({ viewMode = 'GERAL', domainModalidade = 'CARGAS', period }: ProfitabilityPageProps) {
  console.log('🎬 [ProfitabilityPage] Renderizando. viewMode:', viewMode, 'period:', period);
  
  const tooltipStyle = useTooltipStyle();
  
  // Usar o hook para buscar dados (automático: MOCK ou BACKEND)
  const { data, loading, error, isMockData } = useDashboardData<ProfitabilityData>({
    type: 'profitability',
    period: periodRangeToDashboardPeriod(period),
    viewMode,
  });

  console.log('📊 [ProfitabilityPage] Dados recebidos:', { data, loading, error, isMockData });

  // Se estiver carregando
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

  console.log('✅ [ProfitabilityPage] Dados válidos, renderizando dashboard');
  
  // ✅ PROGRAMAÇÃO DEFENSIVA: Garantir que arrays sempre existam
  const profitabilityDataCargas = data.profitabilityDataCargas || [];
  const profitabilityDataPassageiros = data.profitabilityDataPassageiros || [];
  const unitProfitabilityCargas = data.unitProfitabilityCargas || [];
  const unitProfitabilityPassageiros = data.unitProfitabilityPassageiros || [];
  
  // ✅ CORREÇÃO CRÍTICA: Usar métricas do período para os cards (não média dos 12 meses)
  const periodMetrics = data.periodMetrics || {
    margemBruta: 0,
    margemOperacional: 0,
    margemLiquida: 0,
    ebitda: 0,
    roi: 0
  };

  console.log('🔍 [ProfitabilityPage] Arrays verificados:', {
    cargas: profitabilityDataCargas.length,
    passageiros: profitabilityDataPassageiros.length,
    unitsCargas: unitProfitabilityCargas.length,
    unitsPassageiros: unitProfitabilityPassageiros.length
  });
  
  console.log('💰 [ProfitabilityPage] Métricas do período:', periodMetrics);
  
  // Selecionar dados baseado no viewMode
  const getProfitabilityData = () => {
    if (viewMode === 'CARGAS') return profitabilityDataCargas;
    if (viewMode === 'PASSAGEIROS') return profitabilityDataPassageiros;
    
    // GERAL: média ponderada entre CARGAS e PASSAGEIROS
    // Se não houver dados de cargas, usar apenas passageiros (e vice-versa)
    if (profitabilityDataCargas.length === 0 && profitabilityDataPassageiros.length > 0) {
      return profitabilityDataPassageiros;
    }
    if (profitabilityDataPassageiros.length === 0 && profitabilityDataCargas.length > 0) {
      return profitabilityDataCargas;
    }
    
    // Se ambos têm dados, fazer média ponderada
    return profitabilityDataCargas.map((cargas, index) => {
      const passageiros = profitabilityDataPassageiros[index] || {
        month: cargas.month,
        margemBruta: 0,
        margemOperacional: 0,
        margemLiquida: 0,
        ebitda: 0,
        roi: 0
      };
      return {
        month: cargas.month,
        margemBruta: ((cargas.margemBruta * 0.75 + passageiros.margemBruta * 0.25)),
        margemOperacional: ((cargas.margemOperacional * 0.75 + passageiros.margemOperacional * 0.25)),
        margemLiquida: ((cargas.margemLiquida * 0.75 + passageiros.margemLiquida * 0.25)),
        ebitda: cargas.ebitda + passageiros.ebitda,
        roi: ((cargas.roi * 0.75 + passageiros.roi * 0.25)),
      };
    });
  };

  const getUnitData = () => {
    if (viewMode === 'CARGAS') return unitProfitabilityCargas;
    if (viewMode === 'PASSAGEIROS') return unitProfitabilityPassageiros;
    
    // GERAL: somar CARGAS + PASSAGEIROS
    // Se não houver dados de cargas, usar apenas passageiros (e vice-versa)
    if (unitProfitabilityCargas.length === 0 && unitProfitabilityPassageiros.length > 0) {
      return unitProfitabilityPassageiros;
    }
    if (unitProfitabilityPassageiros.length === 0 && unitProfitabilityCargas.length > 0) {
      return unitProfitabilityCargas;
    }
    
    // ✅ CORREÇÃO: Verificar se passageiros[index] existe antes de acessar propriedades
    return unitProfitabilityCargas.map((cargas, index) => {
      const passageiros = unitProfitabilityPassageiros[index] || {
        unidade: cargas.unidade,
        receita: 0,
        custo: 0,
        lucro: 0,
        margem: 0
      };
      
      const receita = cargas.receita + passageiros.receita;
      const custo = cargas.custo + passageiros.custo;
      const lucro = cargas.lucro + passageiros.lucro;
      
      return {
        unidade: cargas.unidade,
        receita,
        custo,
        lucro,
        margem: receita > 0 ? (lucro / receita) * 100 : 0,
      };
    });
  };

  const profitabilityData = getProfitabilityData();
  const unitProfitability = getUnitData();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-slate-900 dark:text-slate-100 mb-1">Análise de Rentabilidade</h2>
        <p className="text-slate-500 dark:text-slate-400">Indicadores de performance e lucratividade</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
              <Target className="w-4 h-4" />
              Margem Operacional
            </CardTitle>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">(receita menos despesas oper.)</p>
          </CardHeader>
          <CardContent>
            <div className="text-blue-900 dark:text-blue-100">{periodMetrics.margemOperacional.toFixed(1)}%</div>
            <div className="text-sm text-blue-600 dark:text-blue-300 mt-1">Média do período</div>
            <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400 mt-2">
              <CheckCircle className="w-3 h-3" />
              Acima da meta (33%)
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Margem Bruta
            </CardTitle>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">(receita menos desp. oper. menos imp.)</p>
          </CardHeader>
          <CardContent>
            <div className="text-emerald-900 dark:text-emerald-100">{periodMetrics.margemBruta.toFixed(1)}%</div>
            <div className="text-sm text-emerald-600 dark:text-emerald-300 mt-1">Média do período</div>
            <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400 mt-2">
              <CheckCircle className="w-3 h-3" />
              Acima da meta (28%)
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900 border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-violet-700 dark:text-violet-300 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Margem Líquida
            </CardTitle>
            <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">(receita menos todas as despesas)</p>
          </CardHeader>
          <CardContent>
            <div className="text-violet-900 dark:text-violet-100">{periodMetrics.margemLiquida.toFixed(1)}%</div>
            <div className="text-sm text-violet-600 dark:text-violet-300 mt-1">Média do período</div>
            <div className="flex items-center gap-1 text-sm text-green-700 dark:text-green-400 mt-2">
              <CheckCircle className="w-3 h-3" />
              Acima da meta (22%)
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolução das Margens (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={profitabilityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis dataKey="month" stroke="#64748b" className="dark:stroke-slate-400" />
                <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Legend />
                <Line type="monotone" dataKey="margemOperacional" stroke="#3b82f6" strokeWidth={2} name="Margem Operacional" />
                <Line type="monotone" dataKey="margemBruta" stroke="#10b981" strokeWidth={2} name="Margem Bruta" />
                <Line type="monotone" dataKey="margemLiquida" stroke="#8b5cf6" strokeWidth={2} name="Margem Líquida" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>EBITDA Mensal (R$)</CardTitle>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              * EBITDA = Receita Total sem Impostos
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitabilityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-slate-700" />
                <XAxis dataKey="month" stroke="#64748b" className="dark:stroke-slate-400" />
                <YAxis stroke="#64748b" className="dark:stroke-slate-400" />
                <Tooltip 
                  contentStyle={tooltipStyle}
                  formatter={(value: number) => `R$ ${value.toLocaleString()}`}
                />
                <Legend />
                <Bar dataKey="ebitda" fill="#3b82f6" name="EBITDA" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rentabilidade por Unidade</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-700 dark:text-slate-300">Unidade</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Receita</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Custo</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Lucro</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Margem</th>
                  <th className="text-center py-3 px-4 text-slate-700 dark:text-slate-300">Status</th>
                </tr>
              </thead>
              <tbody>
                {unitProfitability.map((row) => (
                  <tr key={row.unidade} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{row.unidade}</td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">R$ {row.receita.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">R$ {row.custo.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">R$ {row.lucro.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{row.margem.toFixed(1)}%</td>
                    <td className="py-3 px-4 text-center">
                      {row.margem >= 30 ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Ótimo
                        </span>
                      ) : row.margem >= 25 ? (
                        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 text-sm">
                          <CheckCircle className="w-4 h-4" />
                          Bom
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-yellow-600 dark:text-yellow-400 text-sm">
                          <AlertCircle className="w-4 h-4" />
                          Atenção
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Análise de Break-Even</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-700 dark:text-slate-300">Custos Fixos Mensais</span>
                  <span className="text-slate-900 dark:text-slate-100">R$ 285.000</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-700 dark:text-slate-300">Margem de Contribuição</span>
                  <span className="text-slate-900 dark:text-slate-100">42,5%</span>
                </div>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-700 dark:text-slate-300">Ponto de Equilíbrio (R$)</span>
                  <span className="text-slate-900 dark:text-slate-100">R$ 670.588</span>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-slate-900 dark:text-slate-100">Receita Média Mensal</span>
                  <span className="text-slate-900 dark:text-slate-100">R$ 617.500</span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 mt-3">
                  <div className="bg-green-600 dark:bg-green-500 h-3 rounded-full flex items-center justify-end pr-2" style={{ width: '92%' }}>
                    <span className="text-xs text-white">92%</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm text-green-600 dark:text-green-400">Margem de segurança: 8%</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicadores Chave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
                    <span className="text-emerald-900 dark:text-emerald-100">Receita por Kg</span>
                  </div>
                  <span className="text-emerald-900 dark:text-emerald-100">R$ 1,85</span>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-300 mt-1">+6,2% vs período anterior</p>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-green-700 dark:text-green-300" />
                    <span className="text-green-900 dark:text-green-100">Receita por Veículo</span>
                  </div>
                  <span className="text-green-900 dark:text-green-100">R$ 51.458</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-300 mt-1">+12,3% vs período anterior</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-purple-700 dark:text-purple-300" />
                    <span className="text-purple-900 dark:text-purple-100">Taxa de Ocupação</span>
                  </div>
                  <span className="text-purple-900 dark:text-purple-100">87,5%</span>
                </div>
                <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">+3,2 p.p. vs período anterior</p>
              </div>
              <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-700 dark:text-amber-300" />
                    <span className="text-amber-900 dark:text-amber-100">Km Rodado Total</span>
                  </div>
                  <span className="text-amber-900 dark:text-amber-100">1.375.000 km</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">Média mensal: 137.500 km</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}