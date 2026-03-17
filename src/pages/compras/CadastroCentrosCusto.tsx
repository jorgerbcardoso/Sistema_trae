import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Save, X, ChevronLeft, ChevronRight, Search, DollarSign } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toUpperCase } from '../../utils/stringUtils';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { MOCK_CENTROS_CUSTO } from '../../utils/estoqueModData';
import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import { formatCodigoCentroCusto } from '../../utils/formatters';

// ✅ PADRÃO: Limite de 100 registros por página
const ITEMS_PER_PAGE = 100;

interface CentroCusto {
  seq_centro_custo: number;
  unidade: string;
  nro_centro_custo: string;
  descricao: string;
  ativo: string;
  data_inclusao?: string;
  hora_inclusao?: string;
  login_inclusao?: string;
  data_alteracao?: string;
  hora_alteracao?: string;
  login_alteracao?: string;
}

type SortField = 'unidade' | 'nro_centro_custo' | 'descricao' | 'ativo';

export default function CadastroCentrosCusto() {
  const { user } = useAuth();
  const [centrosCusto, setCentrosCusto] = useState<CentroCusto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCentro, setSelectedCentro] = useState<CentroCusto | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    unidade: '',
    nro_centro_custo: '',
    descricao: '',
    ativo: 'S'
  });

  // ✅ Hook de ordenação
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('nro_centro_custo', 'asc');

  usePageTitle('Cadastro de Centros de Custo');

  useEffect(() => {
    loadCentrosCusto();
  }, [user?.domain]);

  const loadCentrosCusto = async () => {
    try {
      setIsLoading(true);

      if (ENVIRONMENT.isFigmaMake) {
        // ✅ MOCK DATA
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Filtrar por unidade se não for MTZ
        let dadosFiltrados = [...MOCK_CENTROS_CUSTO];
        if (user?.unidade && user.unidade !== 'MTZ') {
          dadosFiltrados = dadosFiltrados.filter(cc => cc.unidade === user.unidade);
        }
        
        setCentrosCusto(dadosFiltrados);
      } else {
        // ✅ BACKEND
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/centros_custo.php`, {
          method: 'GET'
        });

        if (data.success) {
          setCentrosCusto(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar centros de custo:', error);
      setCentrosCusto([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setFormData({
      unidade: user?.unidade || '',
      nro_centro_custo: '',
      descricao: '',
      ativo: 'S'
    });
    setSelectedCentro(null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (centro: CentroCusto) => {
    setFormData({
      unidade: centro.unidade,
      nro_centro_custo: centro.nro_centro_custo,
      descricao: centro.descricao,
      ativo: centro.ativo
    });
    setSelectedCentro(centro);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    // Validações
    if (!formData.unidade.trim()) {
      toast.error('Unidade é obrigatória');
      return;
    }

    if (!formData.nro_centro_custo.trim()) {
      toast.error('Número do centro de custo é obrigatório');
      return;
    }

    if (!formData.descricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    try {
      setIsSaving(true);

      if (ENVIRONMENT.isFigmaMake) {
        // ✅ MOCK: Simular salvamento
        await new Promise(resolve => setTimeout(resolve, 800));

        if (isEditing) {
          // Editar
          setCentrosCusto(prev => prev.map(cc =>
            cc.seq_centro_custo === selectedCentro?.seq_centro_custo
              ? {
                  ...cc,
                  unidade: toUpperCase(formData.unidade),
                  nro_centro_custo: toUpperCase(formData.nro_centro_custo),
                  descricao: toUpperCase(formData.descricao),
                  ativo: formData.ativo
                }
              : cc
          ));
        } else {
          // Novo
          const novoCentro: CentroCusto = {
            seq_centro_custo: Math.max(...centrosCusto.map(cc => cc.seq_centro_custo), 0) + 1,
            unidade: toUpperCase(formData.unidade),
            nro_centro_custo: toUpperCase(formData.nro_centro_custo),
            descricao: toUpperCase(formData.descricao),
            ativo: formData.ativo,
            data_inclusao: new Date().toISOString().split('T')[0],
            hora_inclusao: new Date().toTimeString().split(' ')[0],
            login_inclusao: user?.username || 'SISTEMA'
          };
          setCentrosCusto(prev => [...prev, novoCentro]);
        }

        setIsDialogOpen(false);
      } else {
        // ✅ BACKEND
        const payload = {
          unidade: toUpperCase(formData.unidade),
          nro_centro_custo: toUpperCase(formData.nro_centro_custo),
          descricao: toUpperCase(formData.descricao),
          ativo: formData.ativo
        };

        if (isEditing && selectedCentro) {
          await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/centros_custo.php`, {
            method: 'PUT',
            body: JSON.stringify({
              ...payload,
              seq_centro_custo: selectedCentro.seq_centro_custo
            })
          });
        } else {
          await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/centros_custo.php`, {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }

        setIsDialogOpen(false);
        await loadCentrosCusto();
      }
    } catch (error) {
      console.error('Erro ao salvar centro de custo:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (centro: CentroCusto) => {
    if (!window.confirm(`Tem certeza que deseja inativar o centro de custo "${centro.nro_centro_custo} - ${centro.descricao}"?`)) {
      return;
    }

    try {
      if (ENVIRONMENT.isFigmaMake) {
        // ✅ MOCK: Simular inativação
        await new Promise(resolve => setTimeout(resolve, 500));
        setCentrosCusto(prev => prev.map(cc =>
          cc.seq_centro_custo === centro.seq_centro_custo
            ? { ...cc, ativo: 'N' }
            : cc
        ));
      } else {
        // ✅ BACKEND
        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/centros_custo.php`, {
          method: 'DELETE',
          body: JSON.stringify({ seq_centro_custo: centro.seq_centro_custo })
        });

        await loadCentrosCusto();
      }
    } catch (error) {
      console.error('Erro ao inativar centro de custo:', error);
    }
  };

  // ✅ Filtrar dados
  const filteredCentrosCusto = useMemo(() => {
    if (!searchTerm.trim()) {
      return centrosCusto;
    }
    const term = searchTerm.toLowerCase();
    return centrosCusto.filter(cc =>
      cc.nro_centro_custo?.toLowerCase().includes(term) ||
      cc.descricao?.toLowerCase().includes(term) ||
      cc.unidade?.toLowerCase().includes(term)
    );
  }, [centrosCusto, searchTerm]);

  // ✅ Ordenar dados
  const sortedCentrosCusto = useMemo(() => {
    return sortData(filteredCentrosCusto);
  }, [filteredCentrosCusto, sortData]);

  // ✅ Paginar dados
  const paginatedCentrosCusto = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedCentrosCusto.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedCentrosCusto, currentPage]);

  const totalPages = Math.ceil(sortedCentrosCusto.length / ITEMS_PER_PAGE);

  return (
    <AdminLayout
      title="CADASTRO DE CENTROS DE CUSTO"
      description="Gerenciamento de centros de custo para controle de compras"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* ✅ PADRÃO: Ícone colorido */}
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <DollarSign className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Centros de Custo</CardTitle>
                  <CardDescription>
                    Gerenciamento de centros de custo do domínio {toUpperCase(user?.domain || '')}
                  </CardDescription>
                </div>
              </div>
              {/* ✅ PADRÃO: Botões de ação no card, não no header */}
              <div className="flex gap-2">
                <Button onClick={handleNew} className="gap-2" disabled={isLoading}>
                  <Plus className="size-4" />
                  Novo Centro de Custo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : centrosCusto.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <DollarSign className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum centro de custo cadastrado</p>
                <p className="text-sm mt-1">Clique em "Novo Centro de Custo" para começar</p>
              </div>
            ) : (
              <>
                {/* ✅ Campo de busca */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-4" />
                    <Input
                      type="text"
                      placeholder="Filtrar por número, descrição ou unidade..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>

                {sortedCentrosCusto.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Nenhum centro de custo encontrado com os filtros aplicados</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <SortableTableHeader
                              field="unidade"
                              label="Unidade"
                              currentSortField={sortField}
                              currentSortDirection={sortDirection}
                              onSort={handleSort}
                            />
                            <SortableTableHeader
                              field="nro_centro_custo"
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
                              field="ativo"
                              label="Status"
                              currentSortField={sortField}
                              currentSortDirection={sortDirection}
                              onSort={handleSort}
                              className="w-[100px]"
                            />
                            <TableHead className="text-right w-[100px] px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedCentrosCusto.map((centro) => (
                            <TableRow key={centro.seq_centro_custo}>
                              <TableCell className="font-medium">{centro.unidade}</TableCell>
                              <TableCell className="font-mono">{formatCodigoCentroCusto(centro.unidade, centro.nro_centro_custo)}</TableCell>
                              <TableCell>{centro.descricao}</TableCell>
                              <TableCell>
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    centro.ativo === 'S'
                                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  }`}
                                >
                                  {centro.ativo === 'S' ? 'Ativo' : 'Inativo'}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(centro)}
                                    title="Editar"
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  {centro.ativo === 'S' && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDelete(centro)}
                                      title="Inativar"
                                    >
                                      <Trash2 className="size-4 text-red-500" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Paginação */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, sortedCentrosCusto.length)} de {sortedCentrosCusto.length} registros
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="size-4" />
                          </Button>
                          <span className="text-sm">
                            Página {currentPage} de {totalPages}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                          >
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do centro de custo
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="unidade">Unidade *</Label>
              <FilterSelectUnidadeSingle
                id="unidade"
                value={formData.unidade}
                onChange={(value) => setFormData({ ...formData, unidade: value })}
                disabled={user?.unidade !== 'MTZ'}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nro_centro_custo">Número *</Label>
              <Input
                id="nro_centro_custo"
                value={formData.nro_centro_custo}
                onChange={(e) => setFormData({ ...formData, nro_centro_custo: e.target.value })}
                placeholder="Ex: CC-001"
                maxLength={20}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: PRODUÇÃO - LINHA 01"
                maxLength={200}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ativo">Status *</Label>
              <Select
                value={formData.ativo}
                onValueChange={(value) => setFormData({ ...formData, ativo: value })}
              >
                <SelectTrigger id="ativo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="S">Ativo</SelectItem>
                  <SelectItem value="N">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}