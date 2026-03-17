import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  FileSpreadsheet,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { FilterSelectVeiculo } from '../dashboards/FilterSelectVeiculo';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from 'sonner';
import { 
  getManifestos,
  exportarManifestosExcel,
  type Manifesto,
  type ManifestosFilters 
} from '../../services/conferenciaSaidasService';
import { ManifestosTable } from './ManifestosTable';

type SortField = keyof Manifesto;
type SortDirection = 'asc' | 'desc';

export function ConferenciaSaidas() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [manifestos, setManifestos] = useState<Manifesto[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  // ✅ ORDENAÇÃO INDEPENDENTE PARA CADA TABELA
  const [sortFieldFrota, setSortFieldFrota] = useState<SortField>('numero');
  const [sortDirectionFrota, setSortDirectionFrota] = useState<SortDirection>('desc');
  const [sortFieldTerceiros, setSortFieldTerceiros] = useState<SortField>('numero');
  const [sortDirectionTerceiros, setSortDirectionTerceiros] = useState<SortDirection>('desc');
  
  // Helper: Obter data de hoje no formato YYYY-MM-DD
  const getToday = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const [filters, setFilters] = useState<ManifestosFilters>({
    periodoEmissaoInicio: getToday(), // ✅ Padrão: hoje
    periodoEmissaoFim: getToday(),     // ✅ Padrão: hoje
    placa: '',
    unidadeOrigem: '',
    unidadeDestino: ''
  });

  usePageTitle('Conferência de Saídas');

  const handleExportExcel = async () => {
    if (manifestos.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    try {
      setLoading(true);
      
      // ✅ Chamar função de exportação passando OS MANIFESTOS que já temos!
      await exportarManifestosExcel(filters, manifestos);
      
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
      const result = await getManifestos(filters);
      
      if (result.success) {
        setManifestos(result.manifestos);
        
        if (result.manifestos.length === 0) {
          toast.info('Nenhum manifesto encontrado com os filtros aplicados.');
        }
      }
      // ✅ Se result.success === false, o msg() do PHP já exibiu o toast de erro
    } catch (error) {
      console.error('❌ Erro ao buscar manifestos:', error);
      // ✅ Se houve exception, o msg() do PHP já exibiu o toast de erro
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

  // Formatar peso
  const formatPeso = (value: number) => {
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  // ✅ FUNÇÃO AUXILIAR: Converter data+hora "DD/MM/YYYY HH:MM" para timestamp
  const parseDateTime = (dateTimeStr: string | null): number => {
    if (!dateTimeStr || dateTimeStr === '-') return 0;
    
    // Formato: "31/12/2024 23:59"
    const parts = dateTimeStr.split(' ');
    if (parts.length !== 2) return 0;
    
    const dateParts = parts[0].split('/');
    const timeParts = parts[1].split(':');
    
    if (dateParts.length !== 3 || timeParts.length !== 2) return 0;
    
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1; // JavaScript months are 0-indexed
    const year = parseInt(dateParts[2], 10);
    const hour = parseInt(timeParts[0], 10);
    const minute = parseInt(timeParts[1], 10);
    
    const date = new Date(year, month, day, hour, minute);
    return date.getTime();
  };

  // ✅ FUNÇÃO GENÉRICA: Ordenar lista de manifestos
  const sortManifestos = (list: Manifesto[], field: SortField, direction: SortDirection): Manifesto[] => {
    return [...list].sort((a, b) => {
      const aValue = a[field];
      const bValue = b[field];

      // ✅ CAMPOS DE DATA+HORA: ordenar cronologicamente
      if (field === 'horarioTerminoCarga' || field === 'horarioExpedicao' || field === 'horarioSaida') {
        const aTime = parseDateTime(aValue as string | null);
        const bTime = parseDateTime(bValue as string | null);
        return direction === 'asc' ? aTime - bTime : bTime - aTime;
      }

      // ✅ CAMPOS DE STRING: ordenar alfabeticamente
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } 
      // ✅ CAMPOS NUMÉRICOS: ordenar numericamente
      else if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      } 
      // ✅ VALORES NULOS: colocar no final
      else {
        if (aValue === null && bValue === null) return 0;
        if (aValue === null) return 1;
        if (bValue === null) return -1;
        return 0;
      }
    });
  };

  // ✅ FUNÇÃO: Ordenação composta por Expedição + Saída
  const sortManifestosComposta = (list: Manifesto[]): Manifesto[] => {
    return [...list].sort((a, b) => {
      // 1º critério: Expedição (dataEmissao) - cronológica
      const aExpedicao = a.dataEmissao || '';
      const bExpedicao = b.dataEmissao || '';
      
      if (aExpedicao !== bExpedicao) {
        // Converter DD/MM/YYYY para timestamp para ordenação cronológica
        const parseDate = (dateStr: string): number => {
          if (!dateStr || dateStr === '-') return 0;
          const parts = dateStr.split('/');
          if (parts.length !== 3) return 0;
          const day = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const year = parseInt(parts[2], 10);
          return new Date(year, month, day).getTime();
        };
        
        return parseDate(aExpedicao) - parseDate(bExpedicao);
      }
      
      // 2º critério: Saída (horarioSaida) - cronológica
      const aSaida = parseDateTime(a.horarioSaida);
      const bSaida = parseDateTime(b.horarioSaida);
      return aSaida - bSaida;
    });
  };

  // ✅ SEPARAR MANIFESTOS: FROTA vs TERCEIROS
  const rawManifestosFrota = manifestos.filter(m => m.tpPropriedade === 'F');
  const rawManifestosTerceiros = manifestos.filter(m => m.tpPropriedade !== 'F');

  // ✅ APLICAR ORDENAÇÃO COMPOSTA PADRÃO (Expedição + Saída)
  const manifestosFrotaSorted = sortManifestosComposta(rawManifestosFrota);
  const manifestosTerceirosSorted = sortManifestosComposta(rawManifestosTerceiros);

  // ✅ APLICAR ORDENAÇÃO CUSTOMIZADA (se o usuário clicar em alguma coluna)
  const manifestosFrota = sortFieldFrota !== 'numero' || sortDirectionFrota !== 'desc'
    ? sortManifestos(manifestosFrotaSorted, sortFieldFrota, sortDirectionFrota)
    : manifestosFrotaSorted;
    
  const manifestosTerceiros = sortFieldTerceiros !== 'numero' || sortDirectionTerceiros !== 'desc'
    ? sortManifestos(manifestosTerceirosSorted, sortFieldTerceiros, sortDirectionTerceiros)
    : manifestosTerceirosSorted;

  // ✅ CALCULAR TOTALIZADORES (TODOS os registros de cada lista)
  const calculateTotals = (manifestosList: Manifesto[]) => {
    return {
      totalFrete: manifestosList.reduce((sum, m) => sum + m.totalFrete, 0),
      totalCtrb: manifestosList.reduce((sum, m) => sum + m.ctrb, 0),
      totalPedagio: manifestosList.reduce((sum, m) => sum + m.pedagio, 0),
      totalPeso: manifestosList.reduce((sum, m) => sum + m.pesoTotal, 0),
      qtdRegistros: manifestosList.length
    };
  };

  const totalsFrota = manifestosFrota.length > 0 ? calculateTotals(manifestosFrota) : null;
  const totalsTerceiros = manifestosTerceiros.length > 0 ? calculateTotals(manifestosTerceiros) : null;

  // Função para alternar a direção de ordenação
  const toggleSortDirectionFrota = (field: SortField) => {
    if (sortFieldFrota === field) {
      setSortDirectionFrota(sortDirectionFrota === 'asc' ? 'desc' : 'asc');
    } else {
      setSortFieldFrota(field);
      setSortDirectionFrota('asc');
    }
  };

  const toggleSortDirectionTerceiros = (field: SortField) => {
    if (sortFieldTerceiros === field) {
      setSortDirectionTerceiros(sortDirectionTerceiros === 'asc' ? 'desc' : 'asc');
    } else {
      setSortFieldTerceiros(field);
      setSortDirectionTerceiros('asc');
    }
  };

  return (
    <AdminLayout 
      title="Conferência de Saídas"
      description="Relatório de manifestos expedidos"
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Período de Emissão */}
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">
                  Período de Emissão - Início
                </Label>
                <Input
                  type="date"
                  value={filters.periodoEmissaoInicio}
                  onChange={(e) => setFilters({...filters, periodoEmissaoInicio: e.target.value})}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">
                  Período de Emissão - Fim
                </Label>
                <Input
                  type="date"
                  value={filters.periodoEmissaoFim}
                  onChange={(e) => setFilters({...filters, periodoEmissaoFim: e.target.value})}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100"
                />
              </div>

              {/* Placa */}
              <div className="space-y-2 md:col-span-2">
                <Label className="text-slate-900 dark:text-slate-100">Placa</Label>
                <FilterSelectVeiculo
                  value={filters.placa || ''}
                  onChange={(value) => setFilters({...filters, placa: value})}
                />
              </div>

              {/* Unidade Origem */}
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">Unidade Origem</Label>
                <FilterSelectUnidadeSingle
                  value={filters.unidadeOrigem}
                  onChange={(value) => setFilters({...filters, unidadeOrigem: value})}
                />
              </div>

              {/* Unidade Destino */}
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">Unidade Destino</Label>
                <FilterSelectUnidadeSingle
                  value={filters.unidadeDestino}
                  onChange={(value) => setFilters({...filters, unidadeDestino: value})}
                />
              </div>
            </div>

            {/* Botão de Pesquisa */}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                onClick={handleSearch}
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
                disabled={loading || manifestos.length === 0}
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
                <span>Manifestos Encontrados</span>
                <span className="text-sm font-normal text-slate-600 dark:text-slate-400">
                  {manifestos.length} {manifestos.length === 1 ? 'registro' : 'registros'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 dark:text-blue-400" />
                </div>
              ) : manifestos.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  Nenhum manifesto encontrado com os filtros aplicados.
                </div>
              ) : (
                <>
                  {/* ✅ BLOCO 1: VEÍCULOS FROTA */}
                  {manifestosFrota.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                        VEÍCULOS FROTA ({manifestosFrota.length} {manifestosFrota.length === 1 ? 'manifesto' : 'manifestos'})
                      </h3>
                      
                      <ManifestosTable
                        manifestos={manifestosFrota}
                        sortField={sortFieldFrota}
                        sortDirection={sortDirectionFrota}
                        onToggleSort={toggleSortDirectionFrota}
                        formatCurrency={formatCurrency}
                        formatPeso={formatPeso}
                        totalFrete={totalsFrota?.totalFrete}
                        totalCtrb={totalsFrota?.totalCtrb}
                        totalPedagio={totalsFrota?.totalPedagio}
                        totalPeso={totalsFrota?.totalPeso}
                        qtdRegistros={totalsFrota?.qtdRegistros}
                      />
                    </div>
                  )}

                  {/* ✅ BLOCO 2: VEÍCULOS TERCEIROS */}
                  {manifestosTerceiros.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">
                        VEÍCULOS TERCEIROS ({manifestosTerceiros.length} {manifestosTerceiros.length === 1 ? 'manifesto' : 'manifestos'})
                      </h3>
                      
                      <ManifestosTable
                        manifestos={manifestosTerceiros}
                        sortField={sortFieldTerceiros}
                        sortDirection={sortDirectionTerceiros}
                        onToggleSort={toggleSortDirectionTerceiros}
                        formatCurrency={formatCurrency}
                        formatPeso={formatPeso}
                        totalFrete={totalsTerceiros?.totalFrete}
                        totalCtrb={totalsTerceiros?.totalCtrb}
                        totalPedagio={totalsTerceiros?.totalPedagio}
                        totalPeso={totalsTerceiros?.totalPeso}
                        qtdRegistros={totalsTerceiros?.qtdRegistros}
                      />
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