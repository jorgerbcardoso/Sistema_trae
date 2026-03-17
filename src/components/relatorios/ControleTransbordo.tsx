import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import {
  FileSpreadsheet,
  Search,
  Loader2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';
import { 
  getTransbordos,
  exportarTransbordosExcel,
  type Transbordo,
  type TransbordoFilters 
} from '../../services/controleTransbordoService';
import { MonthYearFilter, formatMonthYearPeriod, type MonthYearPeriod } from './MonthYearFilter';
import { MonthYearSelector } from './MonthYearSelector';

type SortField = keyof Transbordo;
type SortDirection = 'asc' | 'desc';

export function ControleTransbordo() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [transbordos, setTransbordos] = useState<Transbordo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Ordenação
  const [sortField, setSortField] = useState<SortField>('unidadeTransbordo');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Helper: Obter mês e ano atual
  const getCurrentMonthYear = () => {
    const today = new Date();
    return {
      mes: today.getMonth() + 1,
      ano: today.getFullYear()
    };
  };
  
  const currentDate = getCurrentMonthYear();
  
  const [filters, setFilters] = useState<TransbordoFilters>({
    mes: currentDate.mes,
    ano: currentDate.ano,
    unidadeTransbordo: '',
    unidadeOrigem: '',
    unidadeDestino: ''
  });

  usePageTitle('Controle de Transbordo');

  const handleExportExcel = async () => {
    if (transbordos.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    try {
      setLoading(true);
      await exportarTransbordosExcel(filters, transbordos);
      toast.success(`Planilha Excel exportada com sucesso!`);
    } catch (error) {
      console.error('❌ Erro ao exportar Excel:', error);
      toast.error('Erro ao exportar planilha Excel. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    
    try {
      const result = await getTransbordos(filters);
      
      if (result.success) {
        setTransbordos(result.transbordos);
        
        if (result.transbordos.length === 0) {
          toast.info('Nenhum registro encontrado com os filtros aplicados.');
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar transbordos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formatar número
  const formatNumber = (value: number, decimals: number = 0) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(value);
  };

  // Ordenação
  const sortTransbordos = (list: Transbordo[], field: SortField, direction: SortDirection): Transbordo[] => {
    return [...list].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      } else {
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
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

  const transbordosSorted = sortTransbordos(transbordos, sortField, sortDirection);

  // Calcular totalizadores (sem participação)
  const totals = transbordosSorted.length > 0 ? {
    qtdeCtes: transbordosSorted.reduce((sum, t) => sum + t.qtdeCtes, 0),
    qtdeVol: transbordosSorted.reduce((sum, t) => sum + t.qtdeVol, 0),
    pesoCalc: transbordosSorted.reduce((sum, t) => sum + t.pesoCalc, 0),
    freteCif: transbordosSorted.reduce((sum, t) => sum + t.freteCif, 0),
    freteFob: transbordosSorted.reduce((sum, t) => sum + t.freteFob, 0),
    freteTer: transbordosSorted.reduce((sum, t) => sum + t.freteTer, 0),
    freteTotal: transbordosSorted.reduce((sum, t) => sum + t.freteTotal, 0),
    icms: transbordosSorted.reduce((sum, t) => sum + t.icms, 0),
  } : null;

  // Paginação
  const ITEMS_PER_PAGE = 50;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(transbordosSorted.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentItems = transbordosSorted.slice(startIndex, endIndex);

  // Reset página quando filtros mudarem
  const handleSearchWithReset = async () => {
    setCurrentPage(1);
    await handleSearch();
  };

  // Componente para cabeçalho de coluna ordenável
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th 
      className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
      onClick={() => toggleSortDirection(field)}
    >
      <div className="flex items-center gap-1.5">
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
      title="Controle de Transbordo"
      description="Relação e controle de volumes transbordados"
    >
      {/* Filtros */}
      <div className="mb-6">
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100">
              Filtros de Pesquisa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Linha 1: Período */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-900 dark:text-slate-100">
                    Período de Referência
                  </Label>
                  <MonthYearSelector
                    value={{ mes: filters.mes, ano: filters.ano }}
                    onChange={(value) => setFilters({...filters, mes: value.mes, ano: value.ano})}
                  />
                </div>
              </div>

              {/* Linha 2: Unidades */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Unidade Transbordo */}
                <div className="space-y-2">
                  <Label className="text-slate-900 dark:text-slate-100">Unidade Transbordo</Label>
                  <FilterSelectUnidadeSingle
                    value={filters.unidadeTransbordo || ''}
                    onChange={(value) => setFilters({...filters, unidadeTransbordo: value})}
                  />
                </div>

                {/* Unidade Origem */}
                <div className="space-y-2">
                  <Label className="text-slate-900 dark:text-slate-100">Unidade Origem</Label>
                  <FilterSelectUnidadeSingle
                    value={filters.unidadeOrigem || ''}
                    onChange={(value) => setFilters({...filters, unidadeOrigem: value})}
                  />
                </div>

                {/* Unidade Destino */}
                <div className="space-y-2">
                  <Label className="text-slate-900 dark:text-slate-100">Unidade Destino</Label>
                  <FilterSelectUnidadeSingle
                    value={filters.unidadeDestino || ''}
                    onChange={(value) => setFilters({...filters, unidadeDestino: value})}
                  />
                </div>
              </div>
            </div>

            {/* Botão de Pesquisa */}
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
                disabled={loading || transbordos.length === 0}
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
              <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center justify-between">
                <span>Registros Encontrados</span>
                <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
                  {transbordos.length} {transbordos.length === 1 ? 'registro' : 'registros'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : transbordos.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  Nenhum registro encontrado com os filtros aplicados.
                </div>
              ) : (
                <>
                  {/* Tabela com altura máxima fixa */}
                  <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="overflow-x-auto overflow-y-auto max-h-[600px]" style={{ scrollbarWidth: 'thin' }}>
                      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                        <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800 sticky top-0 z-10">
                          <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                            <SortableHeader field="unidadeTransbordo">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                Unid. Transbordo
                              </span>
                            </SortableHeader>
                            <SortableHeader field="unidadeOrigem">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                Unid. Origem
                              </span>
                            </SortableHeader>
                            <SortableHeader field="unidadeDestino">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                Unid. Destino
                              </span>
                            </SortableHeader>
                            <SortableHeader field="qtdeCtes">Qtde. CT-es</SortableHeader>
                            <SortableHeader field="qtdeVol">Qtde. Vol.</SortableHeader>
                            <SortableHeader field="pesoCalc">Peso (ton)</SortableHeader>
                            <SortableHeader field="participacao">Partic. (%)</SortableHeader>
                            <SortableHeader field="freteCif">Frete CIF</SortableHeader>
                            <SortableHeader field="freteFob">Frete FOB</SortableHeader>
                            <SortableHeader field="freteTer">Frete Terc.</SortableHeader>
                            <SortableHeader field="freteTotal">Frete Total</SortableHeader>
                            <SortableHeader field="icms">ICMS</SortableHeader>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-900/50 divide-y divide-slate-100 dark:divide-slate-700/50">
                          {currentItems.map((transbordo, index) => (
                            <tr 
                              key={transbordo.id} 
                              className={`
                                hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all duration-150
                                ${index % 2 === 0 ? 'bg-slate-50/30 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900/30'}
                              `}
                            >
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-700 dark:text-blue-400">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                  {transbordo.unidadeTransbordo}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-emerald-700 dark:text-emerald-400">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {transbordo.unidadeOrigem}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-purple-700 dark:text-purple-400">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                  {transbordo.unidadeDestino}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300 font-medium">
                                {formatNumber(transbordo.qtdeCtes)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300 font-medium">
                                {formatNumber(transbordo.qtdeVol)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300 font-medium">
                                {formatNumber(transbordo.pesoCalc, 2)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                  {formatNumber(transbordo.participacao, 2)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300">
                                {formatCurrency(transbordo.freteCif)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300">
                                {formatCurrency(transbordo.freteFob)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300">
                                {formatCurrency(transbordo.freteTer)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrency(transbordo.freteTotal)}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-slate-700 dark:text-slate-300">
                                {formatCurrency(transbordo.icms)}
                              </td>
                            </tr>
                          ))}
                          
                          {/* Linha de Totalizadores */}
                          {totals && (
                            <tr className="bg-gradient-to-r from-blue-100 to-blue-50 dark:from-blue-900 dark:to-blue-800 font-bold border-t-2 border-blue-400 dark:border-blue-600 sticky bottom-0">
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100" colSpan={3}>
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                                  TOTAIS
                                </div>
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatNumber(totals.qtdeCtes)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatNumber(totals.qtdeVol)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatNumber(totals.pesoCalc, 2)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-slate-400 dark:text-slate-500">
                                —
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatCurrency(totals.freteCif)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatCurrency(totals.freteFob)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatCurrency(totals.freteTer)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200 font-extrabold">
                                {formatCurrency(totals.freteTotal)}
                              </td>
                              <td className="px-4 py-4 whitespace-nowrap text-sm text-right text-blue-900 dark:text-blue-200">
                                {formatCurrency(totals.icms)}
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
                        <span>Mostrando {startIndex + 1} - {Math.min(endIndex, transbordos.length)} de {transbordos.length}</span>
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
    </AdminLayout>
  );
}