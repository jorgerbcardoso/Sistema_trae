import { useState, useEffect } from 'react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Plus, Edit, Trash2, Loader2, Search, Package, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Checkbox } from '../ui/checkbox';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { MOCK_ESTOQUES } from '../../utils/estoqueModData';
import { SortableTableHeader, useSortableTable } from '../table/SortableTableHeader';

interface Estoque {
  seq_estoque: number;
  unidade: string;
  nro_estoque: string;
  descricao: string;
  ativo: string;
  data_inclusao: string;
  login_inclusao: string;
  qtd_posicoes: number;
  qtd_itens: number;
}

interface FormData {
  seq_estoque?: number;
  unidade: string;
  nro_estoque: string;
  descricao: string;
  ativo: string;
}

export function CadastroEstoques() {
  usePageTitle('Cadastro de Estoques');

  const { user } = useAuth();
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [filtroAtivos, setFiltroAtivos] = useState(false);

  // ✅ Hook de ordenação
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<
    'unidade' | 'nro_estoque' | 'descricao' | 'qtd_posicoes' | 'qtd_itens' | 'ativo'
  >('nro_estoque', 'asc');

  const unidadeOperacional = user?.unidade_atual || user?.unidade || '';
  const isMTZ = unidadeOperacional.toUpperCase() === 'MTZ';

  const [formData, setFormData] = useState<FormData>({
    unidade: '',
    nro_estoque: '',
    descricao: '',
    ativo: 'S'
  });

  useEffect(() => {
    carregarEstoques();
  }, [filtroAtivos, unidadeOperacional]);

  const carregarEstoques = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let estoquesFiltr = MOCK_ESTOQUES.map(e => ({
          seq_estoque: e.seq_estoque,
          unidade: e.unidade,
          nro_estoque: e.nro_estoque,
          descricao: e.descricao,
          ativo: e.ativo,
          data_inclusao: e.data_inclusao,
          login_inclusao: e.login_inclusao,
          qtd_posicoes: 0,
          qtd_itens: 0
        }));
        
        if (!isMTZ && unidadeOperacional) {
          estoquesFiltr = estoquesFiltr.filter(e => e.unidade === unidadeOperacional.toUpperCase());
        }
        
        if (filtroAtivos) {
          estoquesFiltr = estoquesFiltr.filter(e => e.ativo === 'S');
        }
        
        setEstoques(estoquesFiltr);
      } else {
        const params = new URLSearchParams();
        
        if (!isMTZ && unidadeOperacional) {
          params.append('unidade', unidadeOperacional.toUpperCase());
        }
        
        if (filtroAtivos) {
          params.append('ativo', 'S');
        }

        const url = `${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php${params.toString() ? `?${params.toString()}` : ''}`;
        const data = await apiFetch(url, { method: 'GET' });
        
        if (data.success) {
          setEstoques(data.data || []);
        } else {
          toast.error(data.message || 'Erro ao carregar estoques');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar estoques:', error);
      toast.error('Erro ao carregar estoques');
    } finally {
      setLoading(false);
    }
  };

  const abrirDialog = (estoque?: Estoque) => {
    if (estoque) {
      setEditando(true);
      setFormData({
        seq_estoque: estoque.seq_estoque,
        unidade: estoque.unidade,
        nro_estoque: estoque.nro_estoque,
        descricao: estoque.descricao,
        ativo: estoque.ativo
      });
    } else {
      setEditando(false);
      setFormData({
        unidade: '',
        nro_estoque: '',
        descricao: '',
        ativo: 'S'
      });
    }
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!formData.unidade || !formData.nro_estoque || !formData.descricao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        unidade: formData.unidade.toUpperCase(),
        nro_estoque: formData.nro_estoque.toUpperCase(),
        descricao: formData.descricao.toUpperCase()
      };

      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 500));
        toast.success(editando ? 'Estoque atualizado com sucesso!' : 'Estoque cadastrado com sucesso!');
        setDialogOpen(false);
        carregarEstoques();
      } else {
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php`,
          {
            method: editando ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
          }
        );

        if (data.success) {
          toast.success(data.message || (editando ? 'Estoque atualizado com sucesso!' : 'Estoque cadastrado com sucesso!'));
          setDialogOpen(false);
          carregarEstoques();
        } else {
          toast.error(data.message || 'Erro ao salvar estoque');
        }
      }
    } catch (error) {
      console.error('Erro ao salvar estoque:', error);
      toast.error('Erro ao salvar estoque');
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (seqEstoque: number) => {
    if (!confirm('Deseja realmente inativar este estoque?')) return;

    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 300));
        toast.success('Estoque inativado com sucesso!');
        carregarEstoques();
      } else {
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php`,
          {
            method: 'DELETE',
            body: JSON.stringify({ seq_estoque: seqEstoque })
          }
        );

        if (data.success) {
          toast.success(data.message || 'Estoque inativado com sucesso!');
          carregarEstoques();
        } else {
          toast.error(data.message || 'Erro ao inativar estoque');
        }
      }
    } catch (error) {
      console.error('Erro ao inativar estoque:', error);
      toast.error('Erro ao inativar estoque');
    } finally {
      setLoading(false);
    }
  };

  const reativar = async (estoque: Estoque) => {
    if (!confirm(`Deseja realmente reativar o estoque ${estoque.nro_estoque}?`)) return;

    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 300));
        toast.success('Estoque reativado com sucesso!');
        carregarEstoques();
      } else {
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php`,
          {
            method: 'PUT',
            body: JSON.stringify({ ...estoque, ativo: 'S' })
          }
        );

        if (data.success) {
          toast.success(data.message || 'Estoque reativado com sucesso!');
          carregarEstoques();
        } else {
          toast.error(data.message || 'Erro ao reativar estoque');
        }
      }
    } catch (error) {
      console.error('Erro ao reativar estoque:', error);
      toast.error('Erro ao reativar estoque');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="CADASTRO DE ESTOQUES"
      icon={<Package className="w-6 h-6" />}
      breadcrumbs={[
        { label: 'Estoque', path: '#' },
        { label: 'Cadastro de Estoques' }
      ]}
    >
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl font-bold text-card-foreground">
                Lista de Estoques
              </CardTitle>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600">
                  <Checkbox
                    id="filtroAtivos"
                    checked={filtroAtivos}
                    onCheckedChange={(checked) => setFiltroAtivos(!!checked)}
                  />
                  <Label htmlFor="filtroAtivos" className="text-slate-900 dark:text-slate-100 cursor-pointer font-medium">
                    Apenas ativos
                  </Label>
                </div>
                <Button
                  onClick={() => abrirDialog()}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Estoque
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800">
                    <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                      <SortableTableHeader
                        field="unidade"
                        label="Unidade"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="nro_estoque"
                        label="Número"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="descricao"
                        label="Descrição"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="qtd_posicoes"
                        label="Posições"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHeader
                        field="qtd_itens"
                        label="Itens"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHeader
                        field="ativo"
                        label="Status"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortData(estoques).map((estoque) => (
                      <tr key={estoque.seq_estoque} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{estoque.unidade}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono">{estoque.nro_estoque}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{estoque.descricao}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {estoque.qtd_posicoes || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                            {estoque.qtd_itens || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            estoque.ativo === 'S' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {estoque.ativo === 'S' ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirDialog(estoque)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {estoque.ativo === 'S' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => excluir(estoque.seq_estoque)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {estoque.ativo === 'N' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => reativar(estoque)}
                                className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {estoques.length === 0 && (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    Nenhum estoque cadastrado
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px] bg-card" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-card-foreground">
              {editando ? 'Editar Estoque' : 'Novo Estoque'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Campo Unidade */}
            <div className="space-y-2">
              <Label htmlFor="unidade" className="text-card-foreground">Unidade *</Label>
              {isMTZ ? (
                <FilterSelectUnidadeSingle
                  value={formData.unidade}
                  onChange={(value) => setFormData({ ...formData, unidade: value })}
                  label="Unidade"
                  disabled={editando}
                />
              ) : (
                <Input
                  id="unidade"
                  value={unidadeOperacional}
                  disabled
                  className="bg-muted"
                />
              )}
            </div>

            {/* Campo Número */}
            <div className="space-y-2">
              <Label htmlFor="nro_estoque" className="text-card-foreground">Número *</Label>
              <Input
                id="nro_estoque"
                value={formData.nro_estoque}
                onChange={(e) => setFormData({ ...formData, nro_estoque: e.target.value.toUpperCase() })}
                placeholder="Ex: EST001"
                disabled={editando}
              />
            </div>

            {/* Campo Descrição */}
            <div className="space-y-2">
              <Label htmlFor="descricao" className="text-card-foreground">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value.toUpperCase() })}
                placeholder="Ex: ALMOXARIFADO GERAL"
              />
            </div>

            {/* Campo Status */}
            {editando && (
              <div className="space-y-2">
                <Label htmlFor="ativo" className="text-card-foreground">Status</Label>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="ativo"
                    checked={formData.ativo === 'S'}
                    onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked ? 'S' : 'N' })}
                  />
                  <Label htmlFor="ativo" className="cursor-pointer text-card-foreground">
                    Ativo
                  </Label>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={salvar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
