import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Save, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, Route as RouteIcon } from 'lucide-react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { toUpperCase } from '../../utils/stringUtils';
import { FilterSelectUnidadeSingle } from './FilterSelectUnidadeSingle';
import { FilterSelectUnidadeOrdered } from './FilterSelectUnidadeOrdered';
import {
  listLinhas,
  createLinha,
  updateLinha,
  deleteLinha,
  validateUnidades,
  Linha
} from '../../services/linhasService';

// ✅ PADRÃO: Limite de 100 registros por página
const ITEMS_PER_PAGE = 100;

export function CadastroLinhas() {
  const { user } = useAuth();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedLinha, setSelectedLinha] = useState<Linha | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Linha;
    direction: 'asc' | 'desc';
  }>({ key: 'nome', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    sigla_emit: '',
    sigla_dest: '',
    unidades: [] as string[],
    km_ida: ''
  });

  usePageTitle('Cadastro de Linhas');

  useEffect(() => {
    loadLinhas();
  }, [user?.domain]);

  const loadLinhas = async () => {
    try {
      setIsLoading(true);
      const result = await listLinhas(user?.domain || '');
      
      if (result.success) {
        setLinhas(result.linhas || []);
      } else {
        setLinhas([]);
      }
    } catch (error) {
      setLinhas([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setFormData({
      nome: '',
      sigla_emit: '',
      sigla_dest: '',
      unidades: [],
      km_ida: ''
    });
    setSelectedLinha(null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (linha: Linha) => {
    setFormData({
      nome: linha.nome,
      sigla_emit: linha.sigla_emit,
      sigla_dest: linha.sigla_dest,
      unidades: linha.unidades.split(',').filter(u => u.trim()),
      km_ida: String(linha.km_ida)
    });
    setSelectedLinha(linha);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    // Validações
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!formData.sigla_emit.trim()) {
      toast.error('Unidade de origem é obrigatória');
      return;
    }

    if (!formData.sigla_dest.trim()) {
      toast.error('Unidade de destino é obrigatória');
      return;
    }

    if (!formData.km_ida || parseFloat(formData.km_ida) <= 0) {
      toast.error('Distância deve ser um número maior que zero');
      return;
    }

    // Validar se origem e destino são iguais
    if (formData.sigla_emit.toUpperCase() === formData.sigla_dest.toUpperCase()) {
      toast.error('Unidade de origem e destino não podem ser iguais');
      return;
    }

    // Validar se há repetição de unidades
    const todasUnidades = [
      formData.sigla_emit.toUpperCase(),
      ...formData.unidades.map(u => u.toUpperCase()),
      formData.sigla_dest.toUpperCase()
    ];

    const unidadesUnicas = new Set(todasUnidades);
    if (unidadesUnicas.size !== todasUnidades.length) {
      toast.error('Não pode haver repetição de unidades na linha');
      return;
    }

    try {
      setIsSaving(true);

      const nomeUpper = toUpperCase(formData.nome);
      const unidadesStr = formData.unidades.map(u => u.toUpperCase()).join(',');

      // Validar se todas as unidades existem na base
      const validacao = await validateUnidades(
        user?.domain || '',
        [formData.sigla_emit.toUpperCase(), formData.sigla_dest.toUpperCase(), ...formData.unidades.map(u => u.toUpperCase())]
      );

      if (!validacao.success || !validacao.valid) {
        toast.error(validacao.error || 'Uma ou mais unidades não existem na base de dados');
        return;
      }

      const requestData = {
        nome: nomeUpper,
        sigla_emit: formData.sigla_emit.toUpperCase(),
        sigla_dest: formData.sigla_dest.toUpperCase(),
        unidades: unidadesStr,
        km_ida: parseFloat(formData.km_ida)
      };

      let result;
      if (isEditing && selectedLinha) {
        result = await updateLinha(user?.domain || '', selectedLinha.nro_linha, requestData);
      } else {
        result = await createLinha(user?.domain || '', requestData);
      }

      if (result.success) {
        setIsDialogOpen(false);
        await loadLinhas();
      }
    } catch (error) {
      // Erro já tratado pelo service
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (linha: Linha) => {
    if (!window.confirm(`Tem certeza que deseja excluir a linha "${linha.nome}"?`)) {
      return;
    }

    try {
      const result = await deleteLinha(user?.domain || '', linha.nro_linha);
      
      if (result.success) {
        await loadLinhas();
      }
    } catch (error) {
      // Erro já tratado pelo service
    }
  };

  const handleSort = (key: keyof Linha) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Linha) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="size-4 ml-2 inline opacity-50" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="size-4 ml-2 inline text-blue-600 dark:text-blue-400" />;
    }
    return <ArrowDown className="size-4 ml-2 inline text-blue-600 dark:text-blue-400" />;
  };

  // ✅ Filtrar linhas por nome, origem, destino ou unidades
  const filteredLinhas = useMemo(() => {
    if (!searchTerm.trim()) {
      return linhas;
    }
    const term = searchTerm.toLowerCase();
    return linhas.filter(linha => 
      linha.nome.toLowerCase().includes(term) ||
      linha.sigla_emit.toLowerCase().includes(term) ||
      linha.sigla_dest.toLowerCase().includes(term) ||
      linha.unidades.toLowerCase().includes(term)
    );
  }, [linhas, searchTerm]);

  // ✅ Ordenar linhas
  const sortedLinhas = useMemo(() => {
    const sorted = [...filteredLinhas].sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === 'string') {
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredLinhas, sortConfig]);

  // ✅ Paginar linhas
  const paginatedLinhas = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedLinhas.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedLinhas, currentPage]);

  const totalPages = Math.ceil(sortedLinhas.length / ITEMS_PER_PAGE);

  return (
    <AdminLayout 
      title="Cadastro de Linhas"
      description={`Gerenciar linhas de transporte do domínio ${toUpperCase(user?.domain || '')}`}
    >
      {/* Conteúdo Principal */}
      <div>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <RouteIcon className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Cadastro de Linhas</CardTitle>
                  <CardDescription>
                    Gerenciar linhas de transporte do domínio {toUpperCase(user?.domain || '')}
                  </CardDescription>
                </div>
              </div>
              {/* ✅ PADRÃO: Botões de ação no card, não no header */}
              <div className="flex gap-2">
                <Button onClick={handleNew} className="gap-2" disabled={isLoading}>
                  <Plus className="size-4" />
                  Nova Linha
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : linhas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <RouteIcon className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma linha cadastrada</p>
                <p className="text-sm mt-1">Clique em "Nova Linha" para começar</p>
              </div>
            ) : (
              <>
                {/* ✅ Campo de busca */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-4" />
                    <Input
                      type="text"
                      placeholder="Filtrar por nome, origem, destino ou unidades..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>

                {sortedLinhas.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Nenhuma linha encontrada com os filtros aplicados</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead 
                              className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" 
                              onClick={() => handleSort('nro_linha')}
                            >
                              <div className="flex items-center">
                                Nº
                                {getSortIcon('nro_linha')}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" 
                              onClick={() => handleSort('nome')}
                            >
                              <div className="flex items-center">
                                Nome
                                {getSortIcon('nome')}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" 
                              onClick={() => handleSort('sigla_emit')}
                            >
                              <div className="flex items-center">
                                Origem
                                {getSortIcon('sigla_emit')}
                              </div>
                            </TableHead>
                            <TableHead className="w-[250px]">
                              Unidades
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" 
                              onClick={() => handleSort('sigla_dest')}
                            >
                              <div className="flex items-center">
                                Destino
                                {getSortIcon('sigla_dest')}
                              </div>
                            </TableHead>
                            <TableHead 
                              className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" 
                              onClick={() => handleSort('km_ida')}
                            >
                              <div className="flex items-center">
                                Distância (km)
                                {getSortIcon('km_ida')}
                              </div>
                            </TableHead>
                            <TableHead className="text-right w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedLinhas.map((linha) => (
                            <TableRow key={linha.nro_linha}>
                              <TableCell className="font-medium">{linha.nro_linha}</TableCell>
                              <TableCell>{linha.nome}</TableCell>
                              <TableCell>{linha.sigla_emit}</TableCell>
                              <TableCell>
                                <span className="text-xs font-mono">{linha.unidades}</span>
                              </TableCell>
                              <TableCell>{linha.sigla_dest}</TableCell>
                              <TableCell>{linha.km_ida.toLocaleString('pt-BR')}</TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(linha)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(linha)}
                                  >
                                    <Trash2 className="size-4 text-red-500" />
                                  </Button>
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
                          Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, sortedLinhas.length)} de {sortedLinhas.length} linhas
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
              {isEditing ? 'Editar Linha' : 'Nova Linha'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da linha de transporte
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Nome */}
            <div className="grid gap-2">
              <Label htmlFor="nome">Nome da Linha *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: LINHA SP-RJ"
              />
            </div>

            {/* Origem */}
            <div className="grid gap-2">
              <Label>Unidade de Origem *</Label>
              <FilterSelectUnidadeSingle
                value={formData.sigla_emit}
                onChange={(value) => setFormData({ ...formData, sigla_emit: value })}
              />
            </div>

            {/* Unidades Intermediárias */}
            <div className="grid gap-2">
              <Label>Unidades Intermediárias</Label>
              <FilterSelectUnidadeOrdered
                value={formData.unidades}
                onChange={(value) => setFormData({ ...formData, unidades: value })}
              />
              <p className="text-xs text-slate-500">
                Campo opcional. A ordem de seleção será mantida. Você também pode digitar as siglas separadas por vírgula.
              </p>
            </div>

            {/* Destino */}
            <div className="grid gap-2">
              <Label>Unidade de Destino *</Label>
              <FilterSelectUnidadeSingle
                value={formData.sigla_dest}
                onChange={(value) => setFormData({ ...formData, sigla_dest: value })}
              />
            </div>

            {/* Distância */}
            <div className="grid gap-2">
              <Label htmlFor="km_ida">Distância (km) *</Label>
              <Input
                id="km_ida"
                type="number"
                step="1"
                min="0"
                value={formData.km_ida}
                onChange={(e) => setFormData({ ...formData, km_ida: e.target.value })}
                placeholder="Ex: 450"
              />
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