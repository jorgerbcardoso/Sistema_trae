import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  ClipboardList,
  Search,
  Filter,
  ArrowLeft,
  FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { FilterSelectCentroCusto } from '../../components/shared/FilterSelectCentroCusto';
import { FilterSelectSetor } from '../../components/admin/FilterSelectSetor';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { formatCodigoCentroCusto } from '../../utils/formatters';

// Helper: Obter data de hoje no formato YYYY-MM-DD
function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Obter data de 30 dias atrás no formato YYYY-MM-DD
function get30DaysAgo() {
  const today = new Date();
  today.setDate(today.getDate() - 30);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface SolicitacaoCompra {
  seq_solicitacao_compra: number;
  unidade: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  seq_centro_custo: number;
  centro_custo_nro?: string;
  centro_custo_descricao?: string;
  centro_custo_unidade?: string;
  nro_setor?: number;
  setor_descricao?: string;
  observacao: string;
  seq_ordem_compra?: number;
  nro_ordem_compra?: string;
  qtd_itens: number;
  status?: string;
}

export default function ConverterSolicitacoesCompra() {
  usePageTitle('Converter Solicitações de Compra');

  const { user } = useAuth();
  const navigate = useNavigate();
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoCompra[]>([]);
  const [loading, setLoading] = useState(false);
  const inicializadoRef = useRef(false);

  // Filtros temporários
  const [filtroUnidadeTemp, setFiltroUnidadeTemp] = useState('');
  const [filtroDataInicioTemp, setFiltroDataInicioTemp] = useState('');
  const [filtroDataFimTemp, setFiltroDataFimTemp] = useState('');
  const [filtroCentroCustoTemp, setFiltroCentroCustoTemp] = useState('');
  const [filtroSetorTemp, setFiltroSetorTemp] = useState<number | null>(null);

  // Filtros aplicados
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [filtroCentroCusto, setFiltroCentroCusto] = useState('');
  const [filtroSetor, setFiltroSetor] = useState<number | null>(null);

  // Inicialização única
  useEffect(() => {
    if (!inicializadoRef.current && user) {
      const hoje = getToday();
      const dias30Atras = get30DaysAgo();
      const unidadeAtual = user?.unidade_atual || user?.unidade || 'MTZ';
      const unidadeAtualUpper = unidadeAtual.toUpperCase();
      const isMtzOrAll = unidadeAtualUpper === 'MTZ' || unidadeAtualUpper === 'ALL';

      // ✅ CORREÇÃO: NÃO aplicar filtros automáticos
      // Mostrar TODAS as solicitações do domínio sem filtros iniciais
      setFiltroDataInicioTemp('');
      setFiltroDataFimTemp('');
      setFiltroDataInicio('');
      setFiltroDataFim('');

      // Unidade: sempre vazio (mostrar todas)
      setFiltroUnidadeTemp('');
      setFiltroUnidade('');

      // Setor: sempre vazio (mostrar todas)
      setFiltroSetorTemp(null);
      setFiltroSetor(null);

      inicializadoRef.current = true;

      // ✅ Carregar TODAS as solicitações sem filtros
      carregarSolicitacoes('', '', '', '', null);
    }
  }, [user]);

  const carregarSolicitacoes = async (
    dataInicio: string = filtroDataInicio,
    dataFim: string = filtroDataFim,
    unidade: string = filtroUnidade,
    centroCusto: string = filtroCentroCusto,
    setor: number | null = filtroSetor
  ) => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));
        const mockSolicitacoes: SolicitacaoCompra[] = [
          {
            seq_solicitacao_compra: 1,
            unidade: 'MTZ',
            data_inclusao: '2026-02-28',
            hora_inclusao: '10:30:00',
            login_inclusao: 'joao',
            seq_centro_custo: 1,
            centro_custo_nro: '1',
            centro_custo_descricao: 'ADMINISTRATIVO',
            centro_custo_unidade: 'MTZ',
            nro_setor: 1,
            setor_descricao: 'COMPRAS',
            observacao: 'MATERIAL DE ESCRITÓRIO URGENTE',
            qtd_itens: 3,
          },
          {
            seq_solicitacao_compra: 2,
            unidade: 'MTZ',
            data_inclusao: '2026-03-01',
            hora_inclusao: '14:15:00',
            login_inclusao: 'maria',
            seq_centro_custo: 2,
            centro_custo_nro: '2',
            centro_custo_descricao: 'MANUTENÇÃO',
            centro_custo_unidade: 'MTZ',
            nro_setor: 2,
            setor_descricao: 'MANUTENÇÃO',
            observacao: 'PEÇAS PARA FROTA',
            seq_ordem_compra: 123,
            nro_ordem_compra: 'MTZ000123',
            qtd_itens: 5,
          },
        ];
        
        // Aplicar filtros
        let filtradas = [...mockSolicitacoes];
        
        if (unidade) {
          filtradas = filtradas.filter(s => s.centro_custo_unidade === unidade);
        }
        
        if (dataInicio) {
          filtradas = filtradas.filter(s => s.data_inclusao >= dataInicio);
        }
        
        if (dataFim) {
          filtradas = filtradas.filter(s => s.data_inclusao <= dataFim);
        }
        
        if (centroCusto) {
          filtradas = filtradas.filter(s => String(s.seq_centro_custo) === String(centroCusto));
        }
        
        if (setor !== null) {
          filtradas = filtradas.filter(s => s.nro_setor === setor);
        }
        
        setSolicitacoes(filtradas);
      } else {
        // BACKEND
        const queryParams = new URLSearchParams();
        
        if (unidade) queryParams.append('unidade', unidade);
        if (dataInicio) queryParams.append('data_inicio', dataInicio);
        if (dataFim) queryParams.append('data_fim', dataFim);
        if (centroCusto) queryParams.append('seq_centro_custo', centroCusto);
        if (setor !== null) queryParams.append('nro_setor', String(setor));
        
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra_converter.php?${queryParams.toString()}`,
          { method: 'GET' }
        );

        if (data.success) {
          setSolicitacoes(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    setFiltroUnidade(filtroUnidadeTemp);
    setFiltroDataInicio(filtroDataInicioTemp);
    setFiltroDataFim(filtroDataFimTemp);
    setFiltroCentroCusto(filtroCentroCustoTemp);
    setFiltroSetor(filtroSetorTemp);

    // Chamar diretamente com os valores temporários
    carregarSolicitacoes(
      filtroDataInicioTemp,
      filtroDataFimTemp,
      filtroUnidadeTemp,
      filtroCentroCustoTemp,
      filtroSetorTemp
    );
  };

  const limparFiltros = () => {
    // ✅ CORREÇÃO: Limpar TODOS os filtros, sem aplicar filtros automáticos
    setFiltroUnidadeTemp('');
    setFiltroDataInicioTemp('');
    setFiltroDataFimTemp('');
    setFiltroCentroCustoTemp('');
    setFiltroSetorTemp(null);
    
    setFiltroUnidade('');
    setFiltroDataInicio('');
    setFiltroDataFim('');
    setFiltroCentroCusto('');
    setFiltroSetor(null);

    // ✅ Carregar TODAS as solicitações sem filtros
    carregarSolicitacoes('', '', '', '', null);
  };

  const iniciarConversao = (solicitacao: SolicitacaoCompra) => {
    if (solicitacao.seq_ordem_compra) {
      toast.error('Esta solicitação já foi convertida em ordem de compra');
      return;
    }

    // Navegar para tela de conversão
    navigate(`/compras/solicitacoes-compra/converter/${solicitacao.seq_solicitacao_compra}`);
  };

  const getSetorBadgeColor = (nroSetor: number | undefined) => {
    if (!nroSetor) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';

    const colors = [
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    ];

    return colors[(nroSetor - 1) % colors.length];
  };

  // Hook de ordenação
  type SortField = 'seq_solicitacao_compra' | 'data_inclusao' | 'centro_custo_descricao' | 'qtd_itens';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('data_inclusao', 'desc');

  return (
    <AdminLayout
      title="CONVERTER SOLICITAÇÕES DE COMPRA"
      description="Converter solicitações em ordens de compra"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Botão Voltar */}
        <Button
          variant="outline"
          onClick={() => navigate('/compras/ordens-compra')}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Voltar para Ordens de Compra
        </Button>

        {/* Card de Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Linha 1 - Filtros principais */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <FilterSelectUnidadeSingle
                  value={filtroUnidadeTemp}
                  onChange={setFiltroUnidadeTemp}
                  respectUserUnit={true}
                  compact={true}
                  label="Unidade"
                />
                
                <div className="grid gap-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={filtroDataInicioTemp}
                    onChange={(e) => setFiltroDataInicioTemp(e.target.value)}
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label>Data Fim</Label>
                  <Input
                    type="date"
                    value={filtroDataFimTemp}
                    onChange={(e) => setFiltroDataFimTemp(e.target.value)}
                  />
                </div>

                <FilterSelectSetor
                  value={filtroSetorTemp}
                  onChange={setFiltroSetorTemp}
                  allowClear={true}
                  label="Setor"
                  placeholder="Todos os setores"
                  suggestUserSetor={false}
                  apenasEfetuaCompras={true}
                />
              </div>

              {/* Linha 2 - Centro de Custo */}
              <div className="grid grid-cols-1">
                <FilterSelectCentroCusto
                  value={filtroCentroCustoTemp}
                  onChange={setFiltroCentroCustoTemp}
                  label="Centro de Custo"
                  placeholder="Todos os centros de custo"
                  allowClear={true}
                />
              </div>

              {/* Linha 3 - Botões de ação */}
              <div className="flex items-center justify-end gap-3">
                <Button onClick={aplicarFiltros} className="gap-2">
                  <Search className="size-4" />
                  Filtrar
                </Button>
                {(filtroUnidade || filtroDataInicio || filtroDataFim || filtroCentroCusto || filtroSetor) && (
                  <Button variant="outline" onClick={limparFiltros} className="gap-2">
                    <Filter className="size-4" />
                    Limpar Filtros
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card de Solicitações */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <ClipboardList className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>Solicitações Pendentes</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : solicitacoes.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <ClipboardList className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma solicitação encontrada</p>
                <p className="text-sm mt-1">Ajuste os filtros para visualizar mais solicitações</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="seq_solicitacao_compra"
                        label="Número"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="data_inclusao"
                        label="Data"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead>Solicitante</TableHead>
                      <SortableTableHeader
                        field="centro_custo_descricao"
                        label="Centro de Custo"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead>Setor</TableHead>
                      <SortableTableHeader
                        field="qtd_itens"
                        label="Itens"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortData(solicitacoes).map((solicitacao) => (
                      <TableRow key={solicitacao.seq_solicitacao_compra}>
                        <TableCell className="font-medium font-mono">
                          {solicitacao.unidade}{String(solicitacao.seq_solicitacao_compra).padStart(6, '0')}
                        </TableCell>
                        <TableCell>
                          {new Date(solicitacao.data_inclusao).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="uppercase">{solicitacao.login_inclusao}</TableCell>
                        <TableCell className="font-mono">
                          {formatCodigoCentroCusto(
                            solicitacao.centro_custo_unidade || '',
                            solicitacao.centro_custo_nro || ''
                          )} - {solicitacao.centro_custo_descricao}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSetorBadgeColor(solicitacao.nro_setor)}`}
                          >
                            {solicitacao.setor_descricao || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{solicitacao.qtd_itens}</TableCell>
                        <TableCell className="text-center">
                          {(solicitacao.status?.trim() === 'A') ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Atendida
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            {(solicitacao.status?.trim() !== 'A') ? (
                              <Button
                                onClick={() => iniciarConversao(solicitacao)}
                                className="gap-2"
                                size="sm"
                              >
                                <FolderOpen className="size-4" />
                                Abrir
                              </Button>
                            ) : (
                              <span className="text-sm text-gray-500 font-mono">
                                {solicitacao.nro_ordem_compra ? `OC: ${solicitacao.nro_ordem_compra}` : 'Atendida'}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}