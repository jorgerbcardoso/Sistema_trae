import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, ChevronLeft, ChevronRight, Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { handleAPIResponse } from '../../utils/apiUtils';
import { toUpperCase } from '../../utils/stringUtils';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { UnidadesMultiSelect } from '../admin/UnidadesMultiSelect';

interface Unidade {
  sigla: string;
  nome: string;
  cnpj: string;
  latitude: string;
  longitude: string;
  unidades_compart: string;
}

const ITEMS_PER_PAGE = 100;

export function CadastroUnidades() {
  const { user } = useAuth();
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedUnidade, setSelectedUnidade] = useState<Unidade | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: keyof Unidade; direction: 'asc' | 'desc' }>({
    key: 'sigla',
    direction: 'asc',
  });

  const [formData, setFormData] = useState({
    sigla: '',
    nome: '',
    cnpj: '',
    latitude: '',
    longitude: '',
    unidadesHubby: [] as string[],
  });

  usePageTitle('Cadastro de Unidades');

  useEffect(() => {
    loadUnidades();
  }, [user?.domain]);

  const loadUnidades = async () => {
    try {
      setIsLoading(true);
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;

      if (useMock) {
        setUnidades([]);
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/sistema/api/cadastros/unidades.php?domain=${user?.domain}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Domain': user?.domain || '',
        },
      });

      const data = await handleAPIResponse(response);

      if (data.success) {
        setUnidades((data.data || []) as Unidade[]);
      } else {
        if (!data.toast && data.error) {
          toast.error(data.error);
        }
        setUnidades([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar unidades:', error);
      toast.error(error.message || 'Erro ao carregar unidades');
      setUnidades([]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseUnidadesCompart = (csv: string): string[] => {
    if (!csv) return [];
    return csv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  };

  const handleNew = () => {
    setFormData({
      sigla: '',
      nome: '',
      cnpj: '',
      latitude: '',
      longitude: '',
      unidadesHubby: [],
    });
    setSelectedUnidade(null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (unidade: Unidade) => {
    setFormData({
      sigla: unidade.sigla,
      nome: unidade.nome,
      cnpj: unidade.cnpj,
      latitude: unidade.latitude,
      longitude: unidade.longitude,
      unidadesHubby: parseUnidadesCompart(unidade.unidades_compart),
    });
    setSelectedUnidade(unidade);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.sigla.trim()) {
      toast.error('Sigla é obrigatória');
      return;
    }
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;

      if (useMock) {
        toast.info('Cadastro de Unidades não disponível no modo mock');
        return;
      }

      const siglaUpper = toUpperCase(formData.sigla).trim();
      const nomeUpper = toUpperCase(formData.nome).trim();

      const body = {
        sigla: siglaUpper,
        nome: nomeUpper,
        cnpj: formData.cnpj.trim(),
        latitude: formData.latitude.trim(),
        longitude: formData.longitude.trim(),
        unidades_compart: formData.unidadesHubby.join(','),
      };

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/sistema/api/cadastros/unidades.php?domain=${user?.domain}`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Domain': user?.domain || '',
        },
        body: JSON.stringify(body),
      });

      const data = await handleAPIResponse(response);
      const isSuccess = data.success || (data.toast && data.toast.type === 'success');

      if (isSuccess) {
        setIsDialogOpen(false);
        setSelectedUnidade(null);
        setIsEditing(false);
        setFormData({
          sigla: '',
          nome: '',
          cnpj: '',
          latitude: '',
          longitude: '',
          unidadesHubby: [],
        });
        await loadUnidades();
      } else {
        if (!data.toast) {
          toast.error(data.error || 'Erro ao salvar unidade');
        }
      }
    } catch (error: any) {
      console.error('Erro ao salvar unidade:', error);
      toast.error(error.message || 'Erro ao salvar unidade');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (unidade: Unidade) => {
    if (!confirm(`Deseja realmente excluir a unidade "${unidade.sigla} - ${unidade.nome}"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;

      if (useMock) {
        toast.info('Cadastro de Unidades não disponível no modo mock');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`/sistema/api/cadastros/unidades.php?domain=${user?.domain}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Domain': user?.domain || '',
        },
        body: JSON.stringify({
          sigla: unidade.sigla,
        }),
      });

      const data = await handleAPIResponse(response);
      const isSuccess = data.success || (data.toast && data.toast.type === 'success');

      if (isSuccess) {
        await loadUnidades();
      } else {
        if (!data.toast) {
          toast.error(data.error || 'Erro ao excluir unidade');
        }
      }
    } catch (error: any) {
      console.error('Erro ao excluir unidade:', error);
      toast.error(error.message || 'Erro ao excluir unidade');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportUnidades = async () => {
    try {
      setIsImporting(true);

      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      if (useMock) {
        toast.info('Importação de unidades não disponível no modo mock');
        return;
      }

      const token = localStorage.getItem('auth_token');
      const response = await fetch('/sistema/api/cadastros/import_unidades.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Domain': user?.domain || '',
        },
        body: JSON.stringify({
          domain: user?.domain,
        }),
      });

      const data = await handleAPIResponse(response);
      if (data.needsInput) {
        return;
      }

      const isSuccess = data.success || (data.toast && data.toast.type === 'success');
      if (isSuccess) {
        await loadUnidades();
      }
    } catch (error: any) {
      console.error('Erro ao importar unidades:', error);
      if (!error.message?.includes('needsInput')) {
        toast.error(error.message || 'Erro ao importar unidades');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const filteredUnidades = useMemo(() => {
    if (!searchTerm.trim()) return unidades;
    const s = searchTerm.toUpperCase();
    return unidades.filter((u) => u.sigla.toUpperCase().includes(s) || u.nome.toUpperCase().includes(s));
  }, [unidades, searchTerm]);

  const sortedUnidades = useMemo(() => {
    const sortable = [...filteredUnidades];
    sortable.sort((a, b) => {
      const av = (a[sortConfig.key] ?? '') as any;
      const bv = (b[sortConfig.key] ?? '') as any;
      if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
      if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortable;
  }, [filteredUnidades, sortConfig]);

  const totalPages = Math.ceil(sortedUnidades.length / ITEMS_PER_PAGE);
  const paginatedUnidades = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedUnidades.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedUnidades, currentPage]);

  const handleSort = (key: keyof Unidade) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Unidade) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="size-4 ml-2 inline opacity-50" />;
    if (sortConfig.direction === 'asc') return <ArrowUp className="size-4 ml-2 inline text-blue-600 dark:text-blue-400" />;
    return <ArrowDown className="size-4 ml-2 inline text-blue-600 dark:text-blue-400" />;
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  return (
    <AdminLayout title="Cadastro de Unidades" description="Gerenciar unidades do sistema e importação">
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Building2 className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Cadastro de Unidades</CardTitle>
                  <CardDescription>Gerenciar unidades do domínio {toUpperCase(user?.domain || '')}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleImportUnidades} variant="outline" className="gap-2" disabled={isImporting || isLoading}>
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="size-4" />
                      Importar Unidades
                    </>
                  )}
                </Button>
                <Button onClick={handleNew} className="gap-2" disabled={isLoading}>
                  <Plus className="size-4" />
                  Nova Unidade
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : unidades.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Building2 className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma unidade cadastrada</p>
                <p className="text-sm mt-1">Clique em "Nova Unidade" para começar</p>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-4" />
                    <Input
                      type="text"
                      placeholder="Filtrar por sigla ou nome..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                  {searchTerm && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      Encontradas {filteredUnidades.length} unidade(s) de {unidades.length} total
                    </p>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px] cursor-pointer" onClick={() => handleSort('sigla')}>
                        Sigla
                        {getSortIcon('sigla')}
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('nome')}>
                        Nome
                        {getSortIcon('nome')}
                      </TableHead>
                      <TableHead className="w-[160px] cursor-pointer" onClick={() => handleSort('cnpj')}>
                        CNPJ
                        {getSortIcon('cnpj')}
                      </TableHead>
                      <TableHead className="w-[120px] cursor-pointer" onClick={() => handleSort('latitude')}>
                        Latitude
                        {getSortIcon('latitude')}
                      </TableHead>
                      <TableHead className="w-[120px] cursor-pointer" onClick={() => handleSort('longitude')}>
                        Longitude
                        {getSortIcon('longitude')}
                      </TableHead>
                      <TableHead className="cursor-pointer" onClick={() => handleSort('unidades_compart')}>
                        Unidades do Hubby
                        {getSortIcon('unidades_compart')}
                      </TableHead>
                      <TableHead className="w-[120px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedUnidades.map((u) => (
                      <TableRow key={u.sigla}>
                        <TableCell className="font-mono font-bold">{u.sigla}</TableCell>
                        <TableCell>{u.nome}</TableCell>
                        <TableCell>{u.cnpj || '-'}</TableCell>
                        <TableCell>{u.latitude || '-'}</TableCell>
                        <TableCell>{u.longitude || '-'}</TableCell>
                        <TableCell>{u.unidades_compart || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(u)} className="h-8 w-8 p-0">
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(u)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, sortedUnidades.length)} de {sortedUnidades.length} registros
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handlePreviousPage} disabled={currentPage === 1}>
                        <ChevronLeft className="size-4 mr-1" />
                        Anterior
                      </Button>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Página {currentPage} de {totalPages}
                      </div>
                      <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                        Próxima
                        <ChevronRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Unidade' : 'Nova Unidade'}</DialogTitle>
            <DialogDescription>{isEditing ? `Atualize os dados da unidade ${selectedUnidade?.sigla}` : 'Cadastre uma nova unidade no sistema'}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sigla">
                  Sigla <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="sigla"
                  value={formData.sigla}
                  onChange={(e) => setFormData((p) => ({ ...p, sigla: e.target.value }))}
                  disabled={isSaving || isEditing}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">
                  Nome <span className="text-red-500">*</span>
                </Label>
                <Input id="nome" value={formData.nome} onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))} disabled={isSaving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input id="cnpj" value={formData.cnpj} onChange={(e) => setFormData((p) => ({ ...p, cnpj: e.target.value }))} disabled={isSaving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input id="latitude" value={formData.latitude} onChange={(e) => setFormData((p) => ({ ...p, latitude: e.target.value }))} disabled={isSaving} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input id="longitude" value={formData.longitude} onChange={(e) => setFormData((p) => ({ ...p, longitude: e.target.value }))} disabled={isSaving} />
              </div>

              <div className="col-span-1 md:col-span-2">
                <UnidadesMultiSelect
                  value={formData.unidadesHubby}
                  onChange={(value) => setFormData((p) => ({ ...p, unidadesHubby: value }))}
                  domain={user?.domain}
                  label="Unidades do Hubby"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false);
              }}
              disabled={isSaving}
            >
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
