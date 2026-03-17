/**
 * ============================================================================
 * TEMPLATE PADRÃO PARA TELAS DE CADASTRO - SISTEMA PRESTO
 * ============================================================================
 * 
 * Este arquivo serve como TEMPLATE e DOCUMENTAÇÃO do padrão estabelecido
 * para todas as telas de cadastro do Sistema Presto.
 * 
 * BASEADO EM: /components/cadastros/CadastroEventos.tsx
 * APROVADO EM: Janeiro/2026
 * ATUALIZADO EM: Janeiro/2026 - Migrado para AdminLayout
 * 
 * ============================================================================
 * REGRAS OBRIGATÓRIAS:
 * ============================================================================
 * 
 * 1. ✅ MOCK DATA OBRIGATÓRIO
 *    - Toda funcionalidade deve ter dados mockados
 *    - Mock deve simular comportamento real (delays, validações)
 *    - Usar ENVIRONMENT.isFigmaMake para decidir entre mock e API
 * 
 * 2. ✅ ADMINLAYOUT OBRIGATÓRIO
 *    - TODAS as telas de cadastro/relatório devem usar <AdminLayout>
 *    - NÃO criar headers customizados inline
 *    - Props: title (obrigatório), description (opcional)
 * 
 * 3. ✅ CARD PRINCIPAL
 *    - Ícone colorido ao lado do título (bg-blue-100 dark:bg-blue-900)
 *    - Botões de ação NO CardHeader, não no header da página
 *    - Botões SEM cor verde customizada (usar padrão do sistema)
 * 
 * 4. ✅ TABELAS 100% ORDENÁVEIS
 *    - Todas as colunas clicáveis com hover:bg-slate-100
 *    - Ícones de ordenação: ArrowUpDown, ArrowUp, ArrowDown
 *    - Ícones de ordenação com cor azul quando ativo
 * 
 * 5. ✅ PAGINAÇÃO OBRIGATÓRIA
 *    - Limite fixo: 100 registros por página
 *    - Mostrar contadores: "Mostrando X a Y de Z registros"
 * 
 * 6. ✅ LOADING STATES
 *    - Estado inicial: isLoading = true
 *    - Loading spinner: border-b-2 border-gray-900 dark:border-gray-100
 *    - Estado vazio com ícone e mensagem
 * 
 * 7. ✅ STRINGS EM MAIÚSCULAS
 *    - Usar toUpperCase() do utils/stringUtils.ts
 *    - Aplicar antes de salvar no backend
 * 
 * 8. ✅ RECARREGAR LISTA APÓS CRUD
 *    - Sempre chamar loadData() após create/update/delete
 * 
 * 9. ✅ TOASTS APENAS PARA ERROS
 *    - Nunca mostrar toast de sucesso
 *    - PHP msg() automaticamente exibe toasts via apiUtils
 * 
 * 10. ✅ BUSCA/FILTRO
 *     - Campo de busca com ícone Search
 *     - Filtro em tempo real
 *     - Resetar para página 1 ao filtrar
 * 
 * 11. ✅ TEMA ESCURO
 *     - Inputs de data: ícone branco/visível no dark mode
 *     - Todos os componentes com suporte a dark mode
 * 
 * 12. ✅ CONTAINER
 *     - Usar <div className="max-w-6xl mx-auto space-y-6"> dentro do AdminLayout
 * 
 * ============================================================================
 * ESTRUTURA DO COMPONENTE:
 * ============================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Save, X, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, Package } from 'lucide-react';
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
import { AdminLayout } from '../layouts/AdminLayout';

// ✅ PADRÃO: Limite de 100 registros por página
const ITEMS_PER_PAGE = 100;

export function TemplatePadraoCadastro() {
  const { user } = useAuth();
  const [dados, setDados] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  }>({ key: 'nome', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    campo1: '',
    campo2: ''
  });

  usePageTitle('Nome da Tela');

  useEffect(() => {
    loadDados();
  }, [user?.domain]);

  const loadDados = async () => {
    try {
      setIsLoading(true);
      // Chamar service aqui
      setDados([]);
    } catch (error) {
      setDados([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setFormData({ campo1: '', campo2: '' });
    setSelectedItem(null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setFormData({ campo1: item.campo1, campo2: item.campo2 });
    setSelectedItem(item);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    // Validações
    if (!formData.campo1.trim()) {
      toast.error('Campo 1 é obrigatório');
      return;
    }

    try {
      setIsSaving(true);
      // Chamar service de create/update
      setIsDialogOpen(false);
      await loadDados();
    } catch (error) {
      // Erro já tratado pelo service
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: any) => {
    if (!window.confirm(`Tem certeza que deseja excluir "${item.nome}"?`)) {
      return;
    }

    try {
      // Chamar service de delete
      await loadDados();
    } catch (error) {
      // Erro já tratado pelo service
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="size-4 ml-2 inline opacity-50" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="size-4 ml-2 inline text-blue-600 dark:text-blue-400" />;
    }
    return <ArrowDown className="size-4 ml-2 inline text-blue-600 dark:text-blue-400" />;
  };

  // ✅ Filtrar dados
  const filteredDados = useMemo(() => {
    if (!searchTerm.trim()) {
      return dados;
    }
    const term = searchTerm.toLowerCase();
    return dados.filter(item => 
      item.nome?.toLowerCase().includes(term)
    );
  }, [dados, searchTerm]);

  // ✅ Ordenar dados
  const sortedDados = useMemo(() => {
    const sorted = [...filteredDados].sort((a, b) => {
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
  }, [filteredDados, sortConfig]);

  // ✅ Paginar dados
  const paginatedDados = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return sortedDados.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [sortedDados, currentPage]);

  const totalPages = Math.ceil(sortedDados.length / ITEMS_PER_PAGE);

  // ✅ PADRÃO: Features
  const features = {
    print: true,
    dark_mode: true
  };

  return (
    <AdminLayout
      title="Nome da Tela"
      description="Descrição da funcionalidade do domínio"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* ✅ PADRÃO: Ícone colorido */}
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Package className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Título da Tela</CardTitle>
                  <CardDescription>
                    Descrição da funcionalidade do domínio {toUpperCase(user?.domain || '')}
                  </CardDescription>
                </div>
              </div>
              {/* ✅ PADRÃO: Botões de ação no card, não no header */}
              <div className="flex gap-2">
                <Button onClick={handleNew} className="gap-2" disabled={isLoading}>
                  <Plus className="size-4" />
                  Novo Item
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : dados.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Package className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum registro cadastrado</p>
                <p className="text-sm mt-1">Clique em "Novo Item" para começar</p>
              </div>
            ) : (
              <>
                {/* ✅ Campo de busca */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-4" />
                    <Input
                      type="text"
                      placeholder="Filtrar por..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="pl-10"
                    />
                  </div>
                </div>

                {sortedDados.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <p>Nenhum registro encontrado com os filtros aplicados</p>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead 
                              className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800" 
                              onClick={() => handleSort('id')}
                            >
                              <div className="flex items-center">
                                ID
                                {getSortIcon('id')}
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
                            <TableHead className="text-right w-[100px]">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedDados.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.id}</TableCell>
                              <TableCell>{item.nome}</TableCell>
                              <TableCell>
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEdit(item)}
                                  >
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(item)}
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
                          Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, sortedDados.length)} de {sortedDados.length} registros
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
              {isEditing ? 'Editar Item' : 'Novo Item'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do item
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="campo1">Campo 1 *</Label>
              <Input
                id="campo1"
                value={formData.campo1}
                onChange={(e) => setFormData({ ...formData, campo1: e.target.value })}
                placeholder="Digite..."
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