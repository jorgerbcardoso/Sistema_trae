import React, { useState } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
  FileSpreadsheet, 
  AlertCircle, 
  Loader2,
  Download,
  Calendar,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { toast } from 'sonner';
import { getTabelasVencer, exportarTabelasVencerExcel } from '../../services/tabelasVencerService';
import { type TabelaVencer } from '../../mocks/mockData';

type SortField = keyof TabelaVencer;
type SortDirection = 'asc' | 'desc';

export default function TabelasVencer() {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<TabelaVencer[]>([]);
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const [showTable, setShowTable] = useState(false);
  
  // ✅ ESTADOS DE ORDENAÇÃO
  const [sortField, setSortField] = useState<SortField>('vig_atual');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // ✅ ESTADOS DE PAGINAÇÃO
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 75;

  const handleGerar = async () => {
    // Pedir confirmação
    const confirmed = window.confirm(
      '⚠️ ATENÇÃO: Esta operação pode demorar alguns minutos.\n\n' +
      'O sistema irá consultar todas as tabelas com vencimento até o final do mês corrente.\n\n' +
      'Deseja continuar?'
    );

    if (!confirmed) return;

    setLoading(true);
    setShowTable(false);

    try {
      const response = await getTabelasVencer();
      
      setDados(response.data);
      setPeriodo(response.periodo);
      setShowTable(true);
      
      toast.success('Relatório gerado com sucesso!', {
        description: `${response.total} registros encontrados.`
      });
    } catch (error) {
      toast.error('Erro ao gerar relatório', {
        description: 'Não foi possível processar os dados. Tente novamente.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportarExcel = async () => {
    if (dados.length === 0) {
      toast.warning('Nenhum dado para exportar');
      return;
    }

    try {
      setLoading(true);
      
      // ✅ Chamar função de exportação via backend PHP
      await exportarTabelasVencerExcel(dados, periodo);
      
      toast.success('Arquivo CSV exportado com sucesso!');
    } catch (error) {
      console.error('❌ Erro ao exportar CSV:', error);
      toast.error('Erro ao exportar', {
        description: 'Não foi possível gerar o arquivo CSV.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: SortField) => {
    const newDirection = sortField === field ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortField(field);
    setSortDirection(newDirection);
    setCurrentPage(1); // ✅ Resetar para primeira página ao ordenar
  };

  const sortedDados = [...dados].sort((a, b) => {
    if (a[sortField] < b[sortField]) return sortDirection === 'asc' ? -1 : 1;
    if (a[sortField] > b[sortField]) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const paginatedDados = sortedDados.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const totalPages = Math.ceil(sortedDados.length / ITEMS_PER_PAGE);

  // ✅ HELPER: Renderizar ícone de ordenação
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 inline-block text-slate-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1 inline-block text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-4 h-4 ml-1 inline-block text-blue-600 dark:text-blue-400" />;
  };

  // ✅ HELPER: Badge colorido para Tipo de Tabela
  const getTipoTabelaBadge = (tipo: string) => {
    const badges: Record<string, { color: string; darkColor: string }> = {
      'Frete Peso': { color: 'bg-blue-100 text-blue-800', darkColor: 'dark:bg-blue-900 dark:text-blue-200' },
      'Frete Valor': { color: 'bg-green-100 text-green-800', darkColor: 'dark:bg-green-900 dark:text-green-200' },
      'Redespacho': { color: 'bg-yellow-100 text-yellow-800', darkColor: 'dark:bg-yellow-900 dark:text-yellow-200' },
      'Balcão': { color: 'bg-purple-100 text-purple-800', darkColor: 'dark:bg-purple-900 dark:text-purple-200' },
      'Expresso': { color: 'bg-red-100 text-red-800', darkColor: 'dark:bg-red-900 dark:text-red-200' },
    };

    const badge = badges[tipo] || { color: 'bg-slate-100 text-slate-800', darkColor: 'dark:bg-slate-800 dark:text-slate-200' };

    return (
      <Badge variant="secondary" className={`${badge.color} ${badge.darkColor} text-xs font-medium`}>
        {tipo}
      </Badge>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-slate-900 dark:text-slate-100 mb-1">
              Tabelas a Vencer
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Relatório de tabelas com vencimento até o fim do mês
            </p>
          </div>
        </div>

        {/* Card de Informações */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Informações Importantes
                </h3>
                <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                  <li className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Serão listadas todas as tabelas com vencimento até <strong>{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('pt-BR')}</strong>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Esta operação pode demorar alguns minutos devido ao volume de dados
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Download className="w-4 h-4 flex-shrink-0" />
                    <span>
                      Após gerar o relatório, você poderá exportar os dados para Excel
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botão Gerar */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGerar}
            disabled={loading}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Gerando Relatório...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Gerar Relatório
              </>
            )}
          </Button>

          {showTable && dados.length > 0 && (
            <Button
              onClick={handleExportarExcel}
              variant="outline"
              size="lg"
              className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          )}
        </div>

        {/* Tabela de Resultados */}
        {showTable && dados.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <strong>{dados.length}</strong> registros encontrados
                  {periodo && <span> • Vencimento até: <strong>{periodo.fim}</strong></span>}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th 
                        onClick={() => handleSort('vendedor')}
                        className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Vendedor
                        {renderSortIcon('vendedor')}
                      </th>
                      <th 
                        onClick={() => handleSort('cnpj')}
                        className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        CNPJ
                        {renderSortIcon('cnpj')}
                      </th>
                      <th 
                        onClick={() => handleSort('nome')}
                        className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Nome
                        {renderSortIcon('nome')}
                      </th>
                      <th 
                        onClick={() => handleSort('unidade')}
                        className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Unidade
                        {renderSortIcon('unidade')}
                      </th>
                      <th 
                        onClick={() => handleSort('tp_tab')}
                        className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Tipo Tabela
                        {renderSortIcon('tp_tab')}
                      </th>
                      <th 
                        onClick={() => handleSort('qtde_tab')}
                        className="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Qtde
                        {renderSortIcon('qtde_tab')}
                      </th>
                      <th 
                        onClick={() => handleSort('vig_atual')}
                        className="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Validade
                        {renderSortIcon('vig_atual')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDados.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100">
                          {item.vendedor}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 font-mono">
                          {item.cnpj}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100">
                          {item.nome}
                        </td>
                        <td className="py-3 px-4 text-sm text-center">
                          <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 text-xs">
                            {item.unidade}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {getTipoTabelaBadge(item.tp_tab)}
                        </td>
                        <td className="py-3 px-4 text-sm text-center">
                          <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-md font-semibold text-xs">
                            {item.qtde_tab}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-center text-slate-600 dark:text-slate-400 font-medium">
                          {item.vig_atual}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginação */}
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Mostrando {paginatedDados.length} de {sortedDados.length} registros
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    size="sm"
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    size="sm"
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Página {currentPage} de {totalPages}
                  </div>
                  <Button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    size="sm"
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    size="sm"
                    className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Estado vazio após carregar */}
        {showTable && dados.length === 0 && (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Nenhuma tabela a vencer
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Não foram encontradas tabelas com vencimento até o fim do mês.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}