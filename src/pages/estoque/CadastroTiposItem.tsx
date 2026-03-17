import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Plus, Edit, Trash2, Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Checkbox } from '../../components/ui/checkbox';
import { apiFetch } from '../../utils/apiUtils';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';

interface TipoItem {
  seq_tipo_item: number;
  descricao: string;
  ativo: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_alteracao?: string;
  hora_alteracao?: string;
  login_alteracao?: string;
}

interface FormData {
  seq_tipo_item?: number;
  descricao: string;
  ativo: string;
}

type SortField = 'seq_tipo_item' | 'descricao' | 'ativo';

export default function CadastroTiposItem() {
  usePageTitle('Cadastro de Tipos de Item');

  const [tipos, setTipos] = useState<TipoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [filtroAtivos, setFiltroAtivos] = useState(false);
  const [busca, setBusca] = useState('');

  const [formData, setFormData] = useState<FormData>({
    descricao: '',
    ativo: 'S'
  });

  // ✅ Hook de ordenação
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('descricao', 'asc');

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarTipos();
    }, 500);
    return () => clearTimeout(timer);
  }, [filtroAtivos, busca]);

  const carregarTipos = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroAtivos) params.append('ativo', 'S');
      if (busca) params.append('busca', busca);

      const url = `${ENVIRONMENT.apiBaseUrl}/estoque/tipos_item.php${params.toString() ? '?' + params.toString() : ''}`;
      const data = await apiFetch(url);

      if (data.success) {
        setTipos(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar tipos:', error);
      toast.error('Erro ao carregar tipos de item');
    } finally {
      setLoading(false);
    }
  };

  const abrirDialog = (tipo?: TipoItem) => {
    if (tipo) {
      setFormData({
        seq_tipo_item: tipo.seq_tipo_item,
        descricao: tipo.descricao,
        ativo: tipo.ativo
      });
      setEditando(true);
    } else {
      setFormData({
        descricao: '',
        ativo: 'S'
      });
      setEditando(false);
    }
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!formData.descricao.trim()) {
      toast.error('A descrição é obrigatória');
      return;
    }

    setLoading(true);
    try {
      const method = editando ? 'PUT' : 'POST';
      const payload = {
        ...formData,
        descricao: formData.descricao.toUpperCase()
      };

      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/tipos_item.php`, {
        method,
        body: JSON.stringify(payload)
      });

      if (data.success) {
        toast.success(editando ? 'Tipo atualizado com sucesso!' : 'Tipo cadastrado com sucesso!');
        setDialogOpen(false);
        carregarTipos();
      } else {
        toast.error(data.message || 'Erro ao salvar tipo de item');
      }
    } catch (error) {
      console.error('Erro ao salvar tipo:', error);
      toast.error('Erro ao salvar tipo de item');
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (seq_tipo_item: number) => {
    if (!confirm('Deseja realmente inativar este tipo de item?')) return;

    setLoading(true);
    try {
      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/tipos_item.php`, {
        method: 'DELETE',
        body: JSON.stringify({ seq_tipo_item })
      });

      if (data.success) {
        toast.success('Tipo de item inativado com sucesso!');
        carregarTipos();
      } else {
        toast.error(data.message || 'Erro ao excluir tipo de item');
      }
    } catch (error) {
      console.error('Erro ao excluir tipo:', error);
      toast.error('Erro ao excluir tipo de item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="CADASTRO DE TIPOS DE ITEM"
      description="Gerenciar tipos/categorias de itens do estoque"
    >
      <div className="max-w-[1600px] mx-auto">
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Tipos de Item Cadastrados
              </CardTitle>
              <div className="flex items-center gap-4">
                <Input
                  placeholder="Buscar por descrição..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-[300px] dark:bg-slate-800 dark:border-slate-700"
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="filtroAtivos"
                    checked={filtroAtivos}
                    onCheckedChange={(checked) => setFiltroAtivos(!!checked)}
                  />
                  <Label htmlFor="filtroAtivos" className="text-slate-900 dark:text-slate-100 cursor-pointer font-normal">
                    Apenas ativos
                  </Label>
                </div>
                <Button
                  onClick={() => abrirDialog()}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Tipo
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
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="seq_tipo_item"
                        label="Código"
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
                        field="ativo"
                        label="Status"
                        className="text-center"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <TableHead className="text-center px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortData(tipos).map((tipo) => (
                      <TableRow key={tipo.seq_tipo_item}>
                        <TableCell className="font-mono">{tipo.seq_tipo_item}</TableCell>
                        <TableCell>{tipo.descricao}</TableCell>
                        <TableCell className="text-center">
                          <span className={tipo.ativo === 'S' ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}>
                            {tipo.ativo === 'S' ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirDialog(tipo)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {tipo.ativo === 'S' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => excluir(tipo.seq_tipo_item)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {tipos.length === 0 && (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    Nenhum tipo de item cadastrado
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
              {editando ? 'Editar Tipo de Item' : 'Novo Tipo de Item'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="descricao" className="text-card-foreground">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value.toUpperCase() })}
                placeholder="Ex: PEÇAS ELÉTRICAS"
                className="bg-background text-foreground border-input"
                maxLength={200}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="ativo"
                checked={formData.ativo === 'S'}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked ? 'S' : 'N' })}
              />
              <Label htmlFor="ativo" className="text-slate-900 dark:text-slate-100 cursor-pointer font-normal">
                Ativo
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
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