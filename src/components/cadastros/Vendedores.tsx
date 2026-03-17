import React, { useState, useEffect, useMemo } from 'react';
import { Pencil, Save, X, Download, Users, ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { toUpperCase } from '../../utils/stringUtils';
import { AdminLayout } from '../layouts/AdminLayout';
import { Checkbox } from '../ui/checkbox';
import { useNavigate } from 'react-router';
import { SortableTableHeader, useSortableTable } from '../table/SortableTableHeader';

interface Vendedor {
  codigo: string; // login
  nome: string;
  tele_venda: boolean;
  qtd_clientes: number;
}

// ✅ PADRÃO: Limite de 100 registros por página
const ITEMS_PER_PAGE = 100;

// ✅ MOCK DATA para Figma Make
const mockVendedores: Vendedor[] = [
  { codigo: 'joao', nome: 'JOÃO SILVA', tele_venda: false, qtd_clientes: 15 },
  { codigo: 'maria', nome: 'MARIA SANTOS', tele_venda: true, qtd_clientes: 23 },
  { codigo: 'pedro', nome: 'PEDRO OLIVEIRA', tele_venda: false, qtd_clientes: 8 },
  { codigo: 'ana', nome: 'ANA COSTA', tele_venda: true, qtd_clientes: 31 },
  { codigo: 'carlos', nome: 'CARLOS LIMA', tele_venda: false, qtd_clientes: 12 },
  { codigo: 'julia', nome: 'JÚLIA FERREIRA', tele_venda: true, qtd_clientes: 19 },
  { codigo: 'lucas', nome: 'LUCAS ALMEIDA', tele_venda: false, qtd_clientes: 7 },
  { codigo: 'fernanda', nome: 'FERNANDA ROCHA', tele_venda: true, qtd_clientes: 27 },
];

export function Vendedores() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    codigo: '',
    nome: '',
    tele_venda: false
  });

  // ✅ Hook de ordenação com SortableTableHeader
  type SortField = 'codigo' | 'nome' | 'tele_venda' | 'qtd_clientes';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('nome', 'asc');

  usePageTitle('Cadastro de Vendedores');

  useEffect(() => {
    loadVendedores();
  }, [user?.domain]);

  const loadVendedores = async () => {
    try {
      setIsLoading(true);
      
      // ✅ REGRA: No Figma Make, SEMPRE usar mock
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        // Simular delay de carregamento
        await new Promise(resolve => setTimeout(resolve, 800));
        setVendedores(mockVendedores);
      } else {
        // ✅ Usar apiFetch() em vez de fetch()
        const response = await apiFetch('/sistema/api/cadastros/vendedores.php');

        if (response.success) {
          setVendedores(response.vendedores || []);
        } else {
          setVendedores([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar vendedores:', error);
      setVendedores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (vendedor: Vendedor) => {
    setFormData({
      codigo: vendedor.codigo,
      nome: vendedor.nome,
      tele_venda: vendedor.tele_venda
    });
    setSelectedVendedor(vendedor);
    setIsDialogOpen(true);
  };

  const handleViewClientes = (vendedor: Vendedor) => {
    // Navegar para a página de clientes do vendedor
    navigate(`/cadastros/clientes-vendedor?login=${encodeURIComponent(vendedor.codigo)}&nome=${encodeURIComponent(vendedor.nome)}`);
  };

  const handleSave = async () => {
    try {
      // Validações
      if (!formData.nome.trim()) {
        toast.error('Nome do vendedor é obrigatório');
        return;
      }

      setIsSaving(true);

      // ✅ REGRA: No Figma Make, SEMPRE usar mock
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        // Simular delay de salvamento
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Atualizar vendedor no mock
        setVendedores(prev => prev.map(v => 
          v.codigo === formData.codigo 
            ? { ...v, nome: toUpperCase(formData.nome), tele_venda: formData.tele_venda }
            : v
        ));
        
        toast.success('Vendedor atualizado com sucesso!');
        setIsDialogOpen(false);
        return;
      }

      // ✅ API real usando apiFetch()
      await apiFetch('/sistema/api/cadastros/vendedores.php', {
        method: 'POST',
        body: JSON.stringify({
          action: 'update',
          codigo: formData.codigo,
          nome: toUpperCase(formData.nome),
          tele_venda: formData.tele_venda
        })
      });

      // ✅ REGRA: Recarregar lista após CRUD
      await loadVendedores();
      
      // ✅ Fechar dialog após recarregar
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Erro ao salvar vendedor:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async () => {
    try {
      const confirmed = window.confirm(
        'Esta operação irá importar todos os vendedores e carteiras do SSW.\n\n' +
        '⚠️ ATENÇÃO: O processo pode levar alguns minutos.\n\n' +
        'Deseja continuar?'
      );

      if (!confirmed) return;

      setIsImporting(true);
      toast.info('Iniciando importação... Aguarde, pode levar alguns minutos.');

      // ✅ REGRA: No Figma Make, SEMPRE usar mock
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        // Simular importação demorada
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Adicionar mais vendedores ao mock
        const novosVendedores: Vendedor[] = [
          { codigo: 'roberto', nome: 'ROBERTO MENDES', tele_venda: false, qtd_clientes: 5 },
          { codigo: 'camila', nome: 'CAMILA SOUZA', tele_venda: true, qtd_clientes: 18 },
          { codigo: 'bruno', nome: 'BRUNO ARAÚJO', tele_venda: false, qtd_clientes: 10 },
        ];
        
        setVendedores(prev => [...prev, ...novosVendedores]);
        toast.success('Importação concluída! 3 novos vendedores importados.');
        return;
      }

      // ✅ API real usando apiFetch()
      await apiFetch('/sistema/api/cadastros/importar_vendedores.php', {
        method: 'POST'
      });

      await loadVendedores(); // ✅ REGRA: Recarregar lista após importação
    } catch (error) {
      console.error('Erro ao importar vendedores:', error);
    } finally {
      setIsImporting(false);
    }
  };

  // ============================================
  // FILTRO E ORDENAÇÃO
  // ============================================
  const filteredVendedores = useMemo(() => {
    let filtered = [...vendedores];

    // Aplicar filtro de busca (case-insensitive)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.codigo.toLowerCase().includes(term) ||
        v.nome.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [vendedores, searchTerm]);

  // ✅ Aplicar ordenação usando hook
  const sortedVendedores = sortData(filteredVendedores);

  // ============================================
  // PAGINAÇÃO (100 registros por página)
  // ============================================
  const totalPages = Math.ceil(sortedVendedores.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedVendedores = sortedVendedores.slice(startIndex, endIndex);

  return (
    <AdminLayout
      title="CADASTRO DE VENDEDORES"
      description="Importação dos vendedores e definição de setores"
      icon={Users}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Vendedores</CardTitle>
            <CardDescription>
              Gerenciamento de Vendedores e Carteiras
            </CardDescription>
          </div>
          <Button
            onClick={handleImport}
            disabled={isImporting || isLoading}
            className="gap-2"
          >
            <Download className="w-4 h-4" />
            {isImporting ? 'Importando...' : 'Importar'}
          </Button>
        </CardHeader>

        <CardContent>
          {/* FILTRO DE BUSCA */}
          <div className="mb-4 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por login ou nome..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset para primeira página ao filtrar
                }}
                className="pl-10"
              />
            </div>
            {searchTerm && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Limpar
              </Button>
            )}
          </div>

          {/* LOADING */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* TABELA COM SORTABLE HEADERS */}
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHeader
                        field="codigo"
                        label="Login"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="w-[150px]"
                      />
                      <SortableTableHeader
                        field="nome"
                        label="Nome"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="tele_venda"
                        label="Tele-venda"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="w-[120px] text-center"
                      />
                      <SortableTableHeader
                        field="qtd_clientes"
                        label="Clientes"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="w-[120px] text-center"
                      />
                      <TableHead className="w-[180px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedVendedores.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                          {searchTerm ? 'Nenhum vendedor encontrado com esse filtro' : 'Nenhum vendedor cadastrado. Clique em "Importar" para começar.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedVendedores.map((vendedor) => (
                        <TableRow key={vendedor.codigo}>
                          <TableCell className="font-medium">{vendedor.codigo}</TableCell>
                          <TableCell>{vendedor.nome}</TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              vendedor.tele_venda
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                            }`}>
                              {vendedor.tele_venda ? 'Sim' : 'Não'}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium text-blue-600">
                              {vendedor.qtd_clientes}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewClientes(vendedor)}
                                title="Ver Clientes"
                              >
                                <Users className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(vendedor)}
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* PAGINAÇÃO */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Exibindo {startIndex + 1} a {Math.min(endIndex, sortedVendedores.length)} de {sortedVendedores.length} vendedores
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Página {currentPage} de {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* DIALOG DE EDIÇÃO */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vendedor</DialogTitle>
            <DialogDescription>
              Altere o nome e a configuração de tele-venda do vendedor
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Login</Label>
              <Input
                value={formData.codigo}
                disabled
                className="bg-slate-100 dark:bg-slate-800"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nome">Nome do Vendedor *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Digite o nome do vendedor"
                maxLength={100}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="tele_venda"
                checked={formData.tele_venda}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, tele_venda: checked === true }))
                }
              />
              <Label 
                htmlFor="tele_venda" 
                className="cursor-pointer font-normal"
              >
                É vendedor de tele-venda
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}