import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';
import { apiFetch } from '../../utils/apiUtils';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Button } from '../../components/ui/button';
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
  DollarSign,
  ShoppingCart,
  Package,
  TrendingUp,
  Users,
  BarChart3
} from 'lucide-react';
import {
  mockGetDashboardCompras,
  getUltimoMesFechado,
  type DashboardComprasFilters,
  type DashboardComprasData
} from '../../mocks/dashboardComprasMocks';
import { MOCK_TIPOS_ITEM } from '../../mocks/estoqueComprasMocks';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { ItemSearchInput } from '../../components/shared/ItemSearchInput';
import { FornecedorSearchInput } from '../../components/shared/FornecedorSearchInput';
import { EvolucaoChart } from '../../components/compras/EvolucaoChart';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// Paleta de cores para gráficos (seguindo padrão dos dashboards existentes)
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function DashboardCompras() {
  usePageTitle('Dashboard de Compras');

  const { user } = useAuth();
  const ultimoMes = getUltimoMesFechado();

  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardComprasData | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // 🆕 Detectar se usuário é MTZ (pode ver todas unidades) ou não (só vê sua própria)
  const unidadeLogada = user?.unidade_atual || 'MTZ';
  const isMTZ = unidadeLogada === 'MTZ';

  const [filters, setFilters] = useState<DashboardComprasFilters>({
    periodo_inclusao_inicio: ultimoMes.inicio,
    periodo_inclusao_fim: ultimoMes.fim,
    unidade: isMTZ ? undefined : unidadeLogada, // MTZ: livre, Outras: bloqueado na própria
    seq_tipo_item: undefined,
    seq_item: undefined,
    seq_fornecedor: undefined
  });

  // 🆕 Carregar dados automaticamente ao montar o componente
  useEffect(() => {
    handleSearch();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      if (ENVIRONMENT.isFigmaMake) {
        const result = await mockGetDashboardCompras({
          ...filters,
          unidade_logada: unidadeLogada // 🆕 Passar unidade logada para aplicar regras de acesso
        });

        if (result.success) {
          setDashboardData(result.data);

          if (result.data.total_pedidos === 0) {
            toast.info('Nenhum pedido encontrado com os filtros aplicados.');
          }
        }
      } else {
        const result = await apiFetch(
          '/sistema/api/compras/dashboard.php',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(filters)
          }
        );

        if (result.success) {
          setDashboardData(result.data);

          if (result.data.total_pedidos === 0) {
            toast.info('Nenhum pedido encontrado com os filtros aplicados.');
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatarMoeda = (valor: number) => {
    return `R$ ${formatarValor(valor)}`;
  };

  // ✅ Helper: Transformar dados do backend para o formato do EvolucaoChart
  const transformarDadosEvolucao = (dadosBackend: any) => {
    if (!dadosBackend || !dadosBackend.periodos || !dadosBackend.series) {
      return [];
    }

    const { periodos, series } = dadosBackend;

    // Transformar de:
    // { periodos: ["12/02", "19/02"], series: [{ label: "ABC", data: [10, 20] }] }
    // Para:
    // [{ mes_label: "12/02", "ABC": 10 }, { mes_label: "19/02", "ABC": 20 }]
    
    return periodos.map((periodo: string, index: number) => {
      const obj: any = { mes_label: periodo };
      
      series.forEach((serie: any) => {
        obj[serie.label] = serie.data[index] || 0;
      });
      
      return obj;
    });
  };

  // Custom tooltip para os gráficos
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-slate-100">{label}</p>
          {payload.map((entry: any, index: number) => {
            const entryName = String(entry.name || '');
            const shouldFormatAsMoney = entryName.includes('Valor') || entryName.includes('R$');
            
            return (
              <p key={index} style={{ color: entry.color }} className="text-sm">
                {entryName}: {shouldFormatAsMoney ? formatarMoeda(entry.value) : entry.value}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <AdminLayout
      title="Dashboard de Compras"
      description="Análise completa e indicadores do setor de compras"
    >
      {/* Filtros */}
      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Análise</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Período Inclusão - Início *</Label>
                <Input
                  type="date"
                  required
                  value={filters.periodo_inclusao_inicio || ''}
                  onChange={(e) => setFilters({ ...filters, periodo_inclusao_inicio: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Período Inclusão - Fim *</Label>
                <Input
                  type="date"
                  required
                  value={filters.periodo_inclusao_fim || ''}
                  onChange={(e) => setFilters({ ...filters, periodo_inclusao_fim: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Unidade</Label>
                <FilterSelectUnidadeSingle
                  value={filters.unidade || ''}
                  onChange={(value) => setFilters({ ...filters, unidade: value })}
                  disabled={!isMTZ} 
                />
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

              {/* ✅ BUSCA POR NOME - ITEM */}
              <ItemSearchInput
                value={filters.seq_item?.toString() || ''}
                onChange={(seq) => setFilters({ ...filters, seq_item: seq ? Number(seq) : undefined })}
                label="Item"
                seqTipoItem={filters.seq_tipo_item}
              />

              {/* ✅ BUSCA POR NOME - FORNECEDOR */}
              <FornecedorSearchInput
                value={filters.seq_fornecedor?.toString() || ''}
                onChange={(seq) => setFilters({ ...filters, seq_fornecedor: seq ? Number(seq) : undefined })}
                label="Fornecedor"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleSearch} className="gap-2" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPIs */}
      {hasSearched && dashboardData && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
            {/* Valor Total */}
            <Card className="overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10"></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">
                      Valor Total
                    </p>
                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                      {formatarMoeda(dashboardData.valor_total)}
                    </p>
                  </div>
                  <div className="bg-blue-500/10 p-3 rounded-lg">
                    <DollarSign className="size-6 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total de Pedidos */}
            <Card className="overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10"></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wider mb-2">
                      Total de Pedidos
                    </p>
                    <p className="text-2xl font-bold text-green-900 dark:text-green-100 mb-1">
                      {dashboardData.total_pedidos}
                    </p>
                  </div>
                  <div className="bg-green-500/10 p-3 rounded-lg">
                    <ShoppingCart className="size-6 text-green-600 dark:text-green-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total de Itens */}
            <Card className="overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/20 dark:to-purple-900/10"></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-2">
                      Total de Itens
                    </p>
                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mb-1">
                      {dashboardData.total_itens}
                    </p>
                  </div>
                  <div className="bg-purple-500/10 p-3 rounded-lg">
                    <Package className="size-6 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Médio */}
            <Card className="overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-950/20 dark:to-orange-900/10"></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-orange-700 dark:text-orange-400 uppercase tracking-wider mb-2">
                      Ticket Médio
                    </p>
                    <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mb-1">
                      {formatarMoeda(dashboardData.ticket_medio)}
                    </p>
                  </div>
                  <div className="bg-orange-500/10 p-3 rounded-lg">
                    <TrendingUp className="size-6 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Fornecedores */}
            <Card className="overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-teal-50 to-teal-100/50 dark:from-teal-950/20 dark:to-teal-900/10"></div>
              <CardContent className="pt-6 relative">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-teal-700 dark:text-teal-400 uppercase tracking-wider mb-2">
                      Fornecedores
                    </p>
                    <p className="text-2xl font-bold text-teal-900 dark:text-teal-100 mb-1">
                      {dashboardData.total_fornecedores}
                    </p>
                  </div>
                  <div className="bg-teal-500/10 p-3 rounded-lg">
                    <Users className="size-6 text-teal-600 dark:text-teal-400" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 🆕 PRIMEIRO GRÁFICO: Evolução Total do Valor de Compras */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Evolução Total do Valor de Compras</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dashboardData.evolucao_total}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="periodo_label" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="valor" 
                    stroke="#3b82f6" 
                    strokeWidth={3}
                    name="Valor Total (R$)"
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 🆕 Gráficos de Evolução (Empilhado/Paralelo) - 2 colunas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <EvolucaoChart
              title="Evolução por Fornecedor (Top 3)"
              data={transformarDadosEvolucao(dashboardData.evolucao_por_fornecedor)}
              colors={COLORS}
            />

            <EvolucaoChart
              title="Evolução por Item (Top 3)"
              data={transformarDadosEvolucao(dashboardData.evolucao_por_item)}
              colors={COLORS}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <EvolucaoChart
              title="Evolução por Unidade"
              data={transformarDadosEvolucao(dashboardData.evolucao_por_unidade)}
              colors={COLORS}
            />

            <EvolucaoChart
              title="Evolução por Centro de Custo (Top 3)"
              data={transformarDadosEvolucao(dashboardData.evolucao_por_centro_custo)}
              colors={COLORS}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <EvolucaoChart
              title="Evolução por Setor (Top 3)"
              data={transformarDadosEvolucao(dashboardData.evolucao_por_setor)}
              colors={COLORS}
            />

            {/* Divisão por Unidade */}
            <Card>
              <CardHeader>
                <CardTitle>Divisão por Unidade</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboardData.por_unidade}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="valor"
                      label={(entry) => `${entry.unidade} (${entry.percentual.toFixed(1)}%)`}
                      stroke="none"
                    >
                      {dashboardData.por_unidade.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {dashboardData.por_unidade.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{item.unidade}</span>
                      </div>
                      <span className="text-gray-600">{formatarMoeda(item.valor)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos: Divisões (Donut) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Divisão por Centro de Custo */}
            <Card>
              <CardHeader>
                <CardTitle>Divisão por Centro de Custo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboardData.por_centro_custo}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="valor"
                      label={(entry) => `${entry.percentual.toFixed(1)}%`}
                      stroke="none"
                    >
                      {dashboardData.por_centro_custo.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {dashboardData.por_centro_custo.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <span className="font-medium">{item.descricao}</span>
                          <span className="text-xs text-gray-500 ml-2">({item.unidade})</span>
                        </div>
                      </div>
                      <span className="text-gray-600">{formatarMoeda(item.valor)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Divisão por Setor */}
            <Card>
              <CardHeader>
                <CardTitle>Divisão por Setor</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={dashboardData.por_setor}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="valor"
                      label={(entry) => `${entry.percentual.toFixed(1)}%`}
                      stroke="none"
                    >
                      {dashboardData.por_setor.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {dashboardData.por_setor.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{item.descricao}</span>
                      </div>
                      <span className="text-gray-600">{formatarMoeda(item.valor)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos: Top 4 + Outros (Barras Horizontais) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top Tipos de Item */}
            <Card>
              <CardHeader>
                <CardTitle>Top Tipos de Item</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.por_tipo_item} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="descricao" type="category" width={150} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="valor" fill="#3b82f6" name="Valor (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Itens */}
            <Card>
              <CardHeader>
                <CardTitle>Top Itens Comprados</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={dashboardData.por_item} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="descricao" type="category" width={150} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="valor" fill="#10b981" name="Valor (R$)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabela: Top Fornecedores */}
          <Card className="shadow-lg">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/50 border-b">
              <CardTitle className="flex items-center gap-2">
                <Users className="size-5 text-blue-600" />
                Top 5 Fornecedores
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800 dark:to-slate-900 border-b-2 border-slate-200 dark:border-slate-700">
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Posição
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Fornecedor
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        CNPJ
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Valor Total
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Pedidos
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        Participação
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {dashboardData.por_fornecedor.map((fornecedor, index) => {
                      const medalColors = [
                        'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white',
                        'bg-gradient-to-br from-gray-300 to-gray-500 text-white',
                        'bg-gradient-to-br from-orange-400 to-orange-600 text-white',
                        'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-900',
                        'bg-gradient-to-br from-blue-100 to-blue-200 text-blue-900'
                      ];
                      
                      return (
                        <tr
                          key={fornecedor.seq_fornecedor}
                          className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${medalColors[index]} font-bold text-sm shadow-md`}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {fornecedor.nome}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                              {fornecedor.cnpj}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                              {formatarMoeda(fornecedor.valor)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              {fornecedor.qtde_pedidos}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                {fornecedor.percentual.toFixed(1)}%
                              </span>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-1">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-1.5 rounded-full transition-all duration-300"
                                  style={{ width: `${fornecedor.percentual}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Estado vazio */}
      {hasSearched && !loading && (!dashboardData || dashboardData.total_pedidos === 0) && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <BarChart3 className="size-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum pedido encontrado</p>
              <p className="text-sm mt-1">Ajuste os filtros e tente novamente</p>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}