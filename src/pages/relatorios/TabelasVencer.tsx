import React, { useState } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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
import { getTabelasVencer } from '../../services/tabelasVencerService';
import { type TabelaVencer } from '../../mocks/mockData';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';

type SortField = keyof TabelaVencer;
type SortDirection = 'asc' | 'desc';

// ✅ Helpers para datas padrão
const getHoje = () => new Date().toISOString().split('T')[0];
const getUltimoDiaMes = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
};

const csvEscape = (value: string) => {
  const needsQuotes = value.includes('"') || value.includes(';') || value.includes('\n') || value.includes('\r');
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const formatNumeroCsv = (n: number) => {
  const s = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const trimmed = s.replace(/0+$/, '').replace(/,$/, '');
  return trimmed === '' ? '0' : trimmed;
};

const baixarCsvTabelasVencer = (dados: TabelaVencer[]) => {
  const semMov = 'Nao ha movimento para periodo informado.';
  const header = [
    'CNPJ',
    'CNPJ PAI GRUPO',
    'RAZAO SOCIAL',
    'POSSUI GRUPO',
    'TIPO',
    'VIGENCIA',
    'VENDEDOR',
    'ULTIMO MOVIMENTO',
    'TOTAL FRETE MES ANTERIOR',
    'TOTAL FRETE DOS ULTIMOS 3 MESES'
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(';'));

  for (const r of dados) {
    const cnpj = (r.cnpj ?? '').trim();
    const cnpjPai = (r.cnpj_pai_grupo ?? '').trim();
    const fm = typeof r.frete_mes_anterior === 'number' ? r.frete_mes_anterior : 0;
    const f3 = typeof r.frete_3_meses === 'number' ? r.frete_3_meses : 0;

    const fmOut = fm > 0 ? formatNumeroCsv(fm) : semMov;
    const f3Out = f3 > 0 ? formatNumeroCsv(f3) : semMov;

    const row = [
      cnpj ? `${cnpj}'` : '',
      cnpjPai ? `${cnpjPai}'` : '',
      (r.nome ?? '').toString(),
      (r.possui_grupo ?? '').toString(),
      (r.tp_tab ?? '').toString(),
      (r.vig_atual ?? '').toString(),
      (r.vendedor ?? '').toString(),
      (r.ultimo_movimento ?? '').toString(),
      fmOut,
      f3Out
    ];

    lines.push(row.map(v => csvEscape(String(v ?? ''))).join(';'));
  }

  const bom = '\uFEFF';
  const content = bom + lines.join('\r\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tabelas_vencer_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.csv`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

export default function TabelasVencer() {
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<TabelaVencer[]>([]);
  const [periodo, setPeriodo] = useState<{ inicio: string; fim: string } | null>(null);
  const [showTable, setShowTable] = useState(false);
  
  // ✅ FILTROS
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [dataInicio, setDataInicio] = useState(getHoje());
  const [dataFim, setDataFim] = useState(getUltimoDiaMes());
  
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
      'O sistema irá consultar as tabelas com vencimento no período informado.\n\n' +
      'Deseja continuar?'
    );

    if (!confirmed) return;

    setLoading(true);
    setShowTable(false);

    try {
      const response = await getTabelasVencer({
        data_inicio: dataInicio,
        data_fim: dataFim,
        unidade: filtroUnidade
      });
      
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
      baixarCsvTabelasVencer(dados);
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
    const av = (a as any)[sortField];
    const bv = (b as any)[sortField];

    const aNum = typeof av === 'number' ? av : Number.NaN;
    const bNum = typeof bv === 'number' ? bv : Number.NaN;
    const bothNum = !Number.isNaN(aNum) && !Number.isNaN(bNum);

    if (bothNum) {
      if (aNum < bNum) return sortDirection === 'asc' ? -1 : 1;
      if (aNum > bNum) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }

    const aStr = (av ?? '').toString();
    const bStr = (bv ?? '').toString();
    if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
    if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
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

  const formatFrete = (v?: number) => {
    if (!v || v <= 0) return '—';
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
    <AdminLayout title="Tabelas a vencer" description="Relatório de tabelas com vencimento no período informado">
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              Tabelas a vencer
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Relatório de tabelas com vencimento no período selecionado
            </p>
          </div>
        </div>

        {/* Card de Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
              <div className="space-y-2 lg:col-span-4">
                <Label className="text-xs font-bold">Unidade responsável</Label>
                <FilterSelectUnidadeSingle
                  value={filtroUnidade}
                  onChange={setFiltroUnidade}
                  placeholder="Todas as Unidades"
                  compact={true}
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label className="text-xs font-bold">Vencimento início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label className="text-xs font-bold">Vencimento fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-2 lg:col-span-4">
                <Button
                  onClick={handleGerar}
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white flex-1 font-bold"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Gerar relatório
                    </>
                  )}
                </Button>

                {showTable && dados.length > 0 && (
                  <Button
                    onClick={handleExportarExcel}
                    variant="outline"
                    className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 px-4 font-bold gap-2"
                    title="Exportar para Excel"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden xl:inline">Exportar</span>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Resultados */}
        {showTable && dados.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  <strong>{dados.length}</strong> registros encontrados
                  {periodo && <span> • Período: <strong>{periodo.inicio}</strong> até <strong>{periodo.fim}</strong></span>}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
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
                        Razão Social
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
                        Tipo
                        {renderSortIcon('tp_tab')}
                      </th>
                      <th 
                        onClick={() => handleSort('vig_atual')}
                        className="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Vigência
                        {renderSortIcon('vig_atual')}
                      </th>
                      <th 
                        onClick={() => handleSort('vendedor')}
                        className="text-left py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        Vendedor
                        {renderSortIcon('vendedor')}
                      </th>
                      <th 
                        onClick={() => handleSort('ultimo_movimento')}
                        className="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                      >
                        Último Mov.
                        {renderSortIcon('ultimo_movimento')}
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        Grupo
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        Frete M-1
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        Frete 3M
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDados.map((item, index) => (
                      <tr
                        key={index}
                        className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400 font-mono whitespace-nowrap">
                          {item.cnpj}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100">
                          <span className="block max-w-[420px] truncate" title={item.nome}>
                            {item.nome}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 text-xs">
                            {item.unidade}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {getTipoTabelaBadge(item.tp_tab)}
                        </td>
                        <td className="py-3 px-4 text-sm text-center text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                          {item.vig_atual}
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {item.vendedor || '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-center text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                          {item.ultimo_movimento?.trim() ? item.ultimo_movimento : '—'}
                        </td>
                        <td className="py-3 px-4 text-sm text-center whitespace-nowrap">
                          {item.possui_grupo === 'SIM' ? (
                            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                              SIM
                            </Badge>
                          ) : item.possui_grupo === 'NAO' ? (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200 text-xs">
                              NÃO
                            </Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                          {formatFrete(item.frete_mes_anterior)}
                        </td>
                        <td className="py-3 px-4 text-sm text-right text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap">
                          {formatFrete(item.frete_3_meses)}
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
                  Não foram encontradas tabelas com vencimento no período selecionado.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
