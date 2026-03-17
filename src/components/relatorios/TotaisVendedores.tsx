import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  FileSpreadsheet,
  Loader2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Users,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { FilterSelectVendedor } from './FilterSelectVendedor';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { MonthYearSelector } from './MonthYearSelector';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';
import { apiFetch } from '../../utils/apiUtils';

interface TotaisFilters {
  loginVendedor: string;
  unidade: string;
  apenasTeleVendas: boolean;
  mes: number;
  ano: number;
}

interface VendedorTotal {
  login: string;
  unid: string;
  vlr_frete1: number;
  vlr_frete2: number;
  vlr_frete3: number;
}

type SortField = keyof VendedorTotal;
type SortDirection = 'asc' | 'desc';

export function TotaisVendedores() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<VendedorTotal[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Ordenação
  const [sortField, setSortField] = useState<SortField>('login');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Paginação
  const ITEMS_PER_PAGE = 100;
  const [currentPage, setCurrentPage] = useState(1);
  
  // Agrupamento por vendedor
  const [agruparPorVendedor, setAgruparPorVendedor] = useState(false);
  
  const [filters, setFilters] = useState<TotaisFilters>({
    loginVendedor: '',
    unidade: '',
    apenasTeleVendas: false,
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear()
  });

  usePageTitle('Totais de Vendedores por Unidade');

  // ================================================================
  // CALCULAR MESES BASEADO NO FILTRO
  // ================================================================
  const getMesesLabels = useMemo(() => {
    const mes = filters.mes;
    const ano = filters.ano;
    
    // Mês passado (o mês selecionado)
    const mesPassado = `${String(mes).padStart(2, '0')}/${ano}`;
    
    // Mês anterior (1 mês antes)
    let mesAnteriorNum = mes - 1;
    let anoAnterior = ano;
    if (mesAnteriorNum < 1) {
      mesAnteriorNum = 12;
      anoAnterior = ano - 1;
    }
    const mesAnterior = `${String(mesAnteriorNum).padStart(2, '0')}/${anoAnterior}`;
    
    // 2 meses atrás
    let mes2AtrasNum = mes - 2;
    let ano2Atras = ano;
    if (mes2AtrasNum < 1) {
      mes2AtrasNum = mes2AtrasNum + 12;
      ano2Atras = ano - 1;
    }
    const mes2Atras = `${String(mes2AtrasNum).padStart(2, '0')}/${ano2Atras}`;
    
    return {
      mes1: mesPassado,      // Mês selecionado
      mes2: mesAnterior,     // 1 mês antes
      mes3: mes2Atras        // 2 meses antes
    };
  }, [filters.mes, filters.ano]);

  // ================================================================
  // BUSCAR DADOS
  // ================================================================
  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);

    try {
      if (ENVIRONMENT.isFigmaMake) {
        // ✅ Mock: Simular dados com vários registros para testar paginação
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const vendedores = ['JOAO.SILVA', 'MARIA.SANTOS', 'PEDRO.OLIVEIRA', 'ANA.COSTA', 'CARLOS.FERREIRA'];
        const unidades = ['FLN', 'SP', 'RJ', 'BH', 'POA'];
        
        const mockDados: VendedorTotal[] = [];
        for (let i = 0; i < 150; i++) {
          mockDados.push({
            login: filters.loginVendedor || vendedores[i % vendedores.length],
            unid: filters.unidade || unidades[i % unidades.length],
            vlr_frete1: Math.random() * 100000 + 10000,
            vlr_frete2: Math.random() * 90000 + 10000, // Valores variáveis para mostrar crescimento
            vlr_frete3: Math.random() * 80000 + 10000
          });
        }
        
        setDados(mockDados);
        
        if (mockDados.length === 0) {
          toast.info('Nenhum registro encontrado com os filtros aplicados.');
        }
      } else {
        // ✅ PRODUÇÃO: Chamar API otimizada
        const token = localStorage.getItem('auth_token');
        const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/totais_vendedores_json.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            login_vendedor: filters.loginVendedor,
            unidade: filters.unidade,
            apenas_tele_vendas: filters.apenasTeleVendas,
            mes: filters.mes,
            ano: filters.ano
          })
        });

        if (result.success) {
          setDados(result.dados || []);
          
          if (result.dados.length === 0) {
            toast.info('Nenhum registro encontrado com os filtros aplicados.');
          }
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset página quando buscar
  const handleSearchWithReset = async () => {
    setCurrentPage(1);
    await handleSearch();
  };

  // ================================================================
  // AGRUPAMENTO POR VENDEDOR
  // ================================================================
  const dadosProcessados = useMemo(() => {
    if (!agruparPorVendedor) return dados;

    // Agrupar por vendedor somando todas as unidades
    const agrupado: Record<string, VendedorTotal> = {};
    
    dados.forEach(item => {
      if (!agrupado[item.login]) {
        agrupado[item.login] = {
          login: item.login,
          unid: 'TODAS',
          vlr_frete1: 0,
          vlr_frete2: 0,
          vlr_frete3: 0
        };
      }
      
      agrupado[item.login].vlr_frete1 += item.vlr_frete1;
      agrupado[item.login].vlr_frete2 += item.vlr_frete2;
      agrupado[item.login].vlr_frete3 += item.vlr_frete3;
    });
    
    return Object.values(agrupado);
  }, [dados, agruparPorVendedor]);

  // Toggle agrupamento e resetar página
  const toggleAgrupamento = () => {
    setAgruparPorVendedor(!agruparPorVendedor);
    setCurrentPage(1);
  };

  // ================================================================
  // EXPORTAR EXCEL
  // ================================================================
  const handleExportExcel = async () => {
    if (dados.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    try {
      setLoading(true);
      
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast.success('Planilha exportada com sucesso! (MOCK)');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/totais_vendedores.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          login_vendedor: filters.loginVendedor,
          unidade: filters.unidade,
          apenas_tele_vendas: filters.apenasTeleVendas,
          dados: dadosProcessados, // Exportar dados conforme visualização atual
          meses_labels: getMesesLabels // ✅ ENVIAR LABELS DOS MESES
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao gerar planilha');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const hoje = new Date();
      const dataFormatada = hoje.toISOString().split('T')[0].replace(/-/g, '');
      const sufixo = agruparPorVendedor ? '_agrupado' : '';
      link.download = `totais_vendedores_${filters.loginVendedor}_${filters.unidade}${sufixo}_${dataFormatada}.xlsx`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Planilha exportada com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao exportar planilha:', error);
      toast.error('Erro ao exportar planilha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ================================================================
  // FORMATAÇÃO
  // ================================================================
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Calcular variação percentual
  const calcularVariacao = (valorAtual: number, valorAnterior: number): number => {
    if (valorAnterior === 0) return 0;
    return ((valorAtual - valorAnterior) / valorAnterior) * 100;
  };

  // Componente de indicador de crescimento
  const IndicadorCrescimento = ({ valorAtual, valorAnterior }: { valorAtual: number; valorAnterior: number }) => {
    const variacao = calcularVariacao(valorAtual, valorAnterior);
    const variacaoAbs = Math.abs(variacao);
    
    if (variacaoAbs < 0.01) {
      return (
        <div className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
          <Minus className="h-3 w-3" />
          <span>0%</span>
        </div>
      );
    }
    
    const isPositivo = variacao > 0;
    
    return (
      <div className={`inline-flex items-center gap-1 text-xs font-semibold ${
        isPositivo 
          ? 'text-emerald-600 dark:text-emerald-400' 
          : 'text-red-600 dark:text-red-400'
      }`}>
        {isPositivo ? (
          <TrendingUp className="h-3 w-3" />
        ) : (
          <TrendingDown className="h-3 w-3" />
        )}
        <span>{variacaoAbs.toFixed(1)}%</span>
      </div>
    );
  };

  // ================================================================
  // ORDENAÇÃO
  // ================================================================
  const sortDados = (list: VendedorTotal[], field: SortField, direction: SortDirection): VendedorTotal[] => {
    return [...list].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        return 0;
      }
    });
  };

  const toggleSortDirection = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const dadosSorted = sortDados(dadosProcessados, sortField, sortDirection);

  // Calcular totais
  const totals = dadosSorted.length > 0 ? {
    vlr_frete1: dadosSorted.reduce((sum, d) => sum + d.vlr_frete1, 0),
    vlr_frete2: dadosSorted.reduce((sum, d) => sum + d.vlr_frete2, 0),
    vlr_frete3: dadosSorted.reduce((sum, d) => sum + d.vlr_frete3, 0),
  } : null;

  // Paginação
  const totalPages = Math.ceil(dadosSorted.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = dadosSorted.slice(startIndex, endIndex);

  // ================================================================
  // COMPONENTE HEADER ORDENÁVEL
  // ================================================================
  const SortableHeader = ({ field, children, align = 'left' }: { field: SortField; children: React.ReactNode; align?: 'left' | 'right' }) => (
    <th 
      className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'} text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors`}
      onClick={() => toggleSortDirection(field)}
    >
      <div className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-30" />
        )}
      </div>
    </th>
  );

  return (
    <AdminLayout
      title="TOTAIS DE VENDEDORES POR UNIDADE"
      description="Planilha de vendas por vendedor e unidade dos últimos 3 meses"
    >
      {/* Card de Filtros */}
      <div className="mb-6">
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">
              Filtros de Pesquisa
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Filtro: Mês e Ano de Referência - PRIMEIRA LINHA (FULL WIDTH) */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="mesAno" className="text-slate-900 dark:text-slate-100">
                  Mês e Ano de Referência
                </Label>
                <MonthYearSelector
                  value={{ mes: filters.mes, ano: filters.ano }}
                  onChange={(period) => setFilters({ ...filters, mes: period.mes, ano: period.ano })}
                />
              </div>

              {/* Filtro: Vendedor */}
              <div className="space-y-2">
                <Label htmlFor="vendedor" className="text-slate-900 dark:text-slate-100">
                  Vendedor (Opcional)
                </Label>
                <FilterSelectVendedor
                  value={filters.loginVendedor}
                  onChange={(value) => setFilters({ ...filters, loginVendedor: value })}
                />
              </div>

              {/* Filtro: Unidade */}
              <div className="space-y-2">
                <Label htmlFor="unidade" className="text-slate-900 dark:text-slate-100">
                  Unidade (Opcional)
                </Label>
                <FilterSelectUnidadeSingle
                  value={filters.unidade}
                  onChange={(value) => setFilters({ ...filters, unidade: value })}
                />
              </div>

              {/* Filtro: Apenas Tele-Vendas */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="apenasTeleVendas"
                    checked={filters.apenasTeleVendas}
                    onCheckedChange={(checked) => setFilters({ ...filters, apenasTeleVendas: !!checked })}
                  />
                  <Label 
                    htmlFor="apenasTeleVendas" 
                    className="text-slate-900 dark:text-slate-100 cursor-pointer font-normal"
                  >
                    Selecionar apenas Tele-Vendas
                  </Label>
                </div>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={handleSearchWithReset}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Gerar Relatório
                  </>
                )}
              </Button>

              <Button
                onClick={handleExportExcel}
                disabled={loading || dados.length === 0}
                className="bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800 text-white disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Resultados */}
      {hasSearched && (
        <div className="max-w-[1600px] mx-auto">
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-3">
                  <span>Registros Encontrados</span>
                  <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
                    {dadosProcessados.length} {dadosProcessados.length === 1 ? 'registro' : 'registros'}
                  </span>
                </CardTitle>
                
                {/* Botão de Agrupamento */}
                {dados.length > 0 && (
                  <Button
                    onClick={toggleAgrupamento}
                    variant={agruparPorVendedor ? "default" : "outline"}
                    size="sm"
                    className={agruparPorVendedor 
                      ? "bg-purple-600 hover:bg-purple-700 dark:bg-purple-700 dark:hover:bg-purple-800 text-white" 
                      : "border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-900/20"
                    }
                  >
                    {agruparPorVendedor ? (
                      <>
                        <Building2 className="h-4 w-4 mr-2" />
                        Ver por Unidade
                      </>
                    ) : (
                      <>
                        <Users className="h-4 w-4 mr-2" />
                        Agrupar por Vendedor
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : dados.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum registro encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                <>
                  {/* Tabela com altura máxima fixa */}
                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px]" style={{ scrollbarWidth: 'thin' }}>
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800 sticky top-0 z-10">
                          <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                            <SortableHeader field="login">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                VENDEDOR
                              </span>
                            </SortableHeader>
                            <SortableHeader field="unid">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                UNIDADE
                              </span>
                            </SortableHeader>
                            <SortableHeader field="vlr_frete3" align="right">
                              {getMesesLabels.mes3}
                            </SortableHeader>
                            <th className="px-2 py-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                              <TrendingUp className="h-3 w-3 mx-auto" />
                            </th>
                            <SortableHeader field="vlr_frete2" align="right">
                              {getMesesLabels.mes2}
                            </SortableHeader>
                            <th className="px-2 py-3 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                              <TrendingUp className="h-3 w-3 mx-auto" />
                            </th>
                            <SortableHeader field="vlr_frete1" align="right">
                              {getMesesLabels.mes1}
                            </SortableHeader>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-700/50">
                          {currentItems.map((row, index) => (
                            <tr 
                              key={`${row.login}-${row.unid}-${index}`}
                              className={`
                                hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all duration-150
                                ${index % 2 === 0 ? 'bg-slate-50/30 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900/30'}
                              `}
                            >
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-700 dark:text-blue-400">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  {row.login}
                                </div>
                              </td>
                              <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                                row.unid === 'TODAS' 
                                  ? 'text-purple-700 dark:text-purple-400 font-bold' 
                                  : 'text-emerald-700 dark:text-emerald-400'
                              }`}>
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    row.unid === 'TODAS' ? 'bg-purple-500' : 'bg-emerald-500'
                                  }`}></span>
                                  {row.unid}
                                </div>
                              </td>
                              
                              {/* 2 MESES ATRÁS */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                                {formatCurrency(row.vlr_frete3)}
                              </td>
                              
                              {/* INDICADOR 1: 2 meses → 1 mês */}
                              <td className="px-2 py-3 whitespace-nowrap text-center">
                                <IndicadorCrescimento valorAtual={row.vlr_frete2} valorAnterior={row.vlr_frete3} />
                              </td>
                              
                              {/* MÊS ANTERIOR */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-slate-900 dark:text-slate-100">
                                {formatCurrency(row.vlr_frete2)}
                              </td>
                              
                              {/* INDICADOR 2: 1 mês → mês atual */}
                              <td className="px-2 py-3 whitespace-nowrap text-center">
                                <IndicadorCrescimento valorAtual={row.vlr_frete1} valorAnterior={row.vlr_frete2} />
                              </td>
                              
                              {/* MÊS PASSADO */}
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-slate-900 dark:text-slate-100">
                                {formatCurrency(row.vlr_frete1)}
                              </td>
                            </tr>
                          ))}
                          
                          {/* Linha de Totais */}
                          {totals && (
                            <tr className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900 dark:to-blue-800 font-bold border-t-2 border-blue-400 dark:border-blue-600 sticky bottom-0">
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100" colSpan={2}>
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                  TOTAIS
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatCurrency(totals.vlr_frete3)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-center">
                                <IndicadorCrescimento valorAtual={totals.vlr_frete2} valorAnterior={totals.vlr_frete3} />
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatCurrency(totals.vlr_frete2)}
                              </td>
                              <td className="px-2 py-4 whitespace-nowrap text-center">
                                <IndicadorCrescimento valorAtual={totals.vlr_frete1} valorAnterior={totals.vlr_frete2} />
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatCurrency(totals.vlr_frete1)}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Paginação */}
                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                        <span>Página {currentPage} de {totalPages}</span>
                        <span className="text-slate-400 dark:text-slate-500">•</span>
                        <span>Mostrando {startIndex + 1} - {Math.min(endIndex, dadosProcessados.length)} de {dadosProcessados.length}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="dark:border-slate-700 dark:hover:bg-slate-700"
                        >
                          Primeira
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="dark:border-slate-700 dark:hover:bg-slate-700"
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="dark:border-slate-700 dark:hover:bg-slate-700"
                        >
                          Próxima
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="dark:border-slate-700 dark:hover:bg-slate-700"
                        >
                          Última
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Card de Informações */}
      {!hasSearched && (
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Sobre este Relatório
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Este relatório mostra os <strong>totais de vendas por vendedor e unidade</strong> dos últimos 3 meses extraídos diretamente do SSW.
            </p>
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Agrupamento por Vendedor
              </h4>
              <ul className="list-disc list-inside text-sm text-purple-800 dark:text-purple-300 space-y-1 ml-2">
                <li>Clique em "Agrupar por Vendedor" para somar todas as unidades</li>
                <li>No modo agrupado, a coluna Unidade exibe "TODAS"</li>
                <li>Os valores são totalizados automaticamente</li>
                <li>A exportação Excel reflete o modo de visualização atual</li>
              </ul>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-emerald-900 dark:text-emerald-300 mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Indicadores de Crescimento
              </h4>
              <ul className="list-disc list-inside text-sm text-emerald-800 dark:text-emerald-300 space-y-1 ml-2">
                <li>Setas verdes indicam crescimento em relação ao mês anterior</li>
                <li>Setas vermelhas indicam queda em relação ao mês anterior</li>
                <li>Percentuais calculados automaticamente entre os períodos</li>
                <li>Linha de totais também exibe o crescimento geral</li>
              </ul>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">📋 Instruções de Uso</h4>
              <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1 ml-2">
                <li>Os filtros de vendedor e unidade são <strong>opcionais</strong></li>
                <li>Sem filtros: mostra todos os vendedores de todas as unidades</li>
                <li>Com filtros: mostra apenas os registros selecionados</li>
                <li>Clique em "Gerar Relatório" para visualizar os dados</li>
                <li>Use "Exportar Excel" para download da planilha completa</li>
                <li>Todas as colunas são ordenáveis (clique no cabeçalho)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </AdminLayout>
  );
}

export default TotaisVendedores;