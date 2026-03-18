import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  Ban,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';
import {
  mockListFornecedores,
  mockCreateFornecedor,
  mockUpdateFornecedor,
  mockDeleteFornecedor,
  mockImportFornecedores,
  mockSearchCidades
} from '../../mocks/mockData';

interface Fornecedor {
  seq_fornecedor: number;
  cnpj: string;
  nome: string;
  endereco: string;
  bairro: string;
  seq_cidade: number | null;
  cidade_nome: string;
  cidade_uf: string;
  email: string;
  telefone: string;
  ativo: string;
  data_inclusao: string;
  hora_inclusao: string;
  login_inclusao: string;
  data_alteracao: string | null;
  hora_alteracao: string | null;
  login_alteracao: string | null;
}

interface Cidade {
  seq_cidade: number;
  nome: string;
  uf: string;
  codigo_ibge: number;
  label: string;
}

type SortField = 'nome' | 'cnpj' | 'cidade_nome' | 'ativo';

export default function Fornecedores() {
  usePageTitle('Cadastro de Fornecedores');
  
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState(''); // ✅ NOVO: Input separado do termo de busca
  const [cidadeFilter, setCidadeFilter] = useState('');
  const [selectedCidadeFilter, setSelectedCidadeFilter] = useState<Cidade | null>(null); // ✅ NOVO: Cidade selecionada no filtro
  const [cidadeFilterSearch, setCidadeFilterSearch] = useState(''); // ✅ NOVO: Input de busca de cidade no filtro
  const [cidadeFilterOptions, setCidadeFilterOptions] = useState<Cidade[]>([]); // ✅ NOVO: Opções de cidades no filtro
  const [showCidadeFilterDropdown, setShowCidadeFilterDropdown] = useState(false); // ✅ NOVO: Mostrar dropdown do filtro
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  
  // ✅ Hook de ordenação usando o padrão oficial
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('nome', 'asc');
  
  // Modal de cadastro/edição
  const [showModal, setShowModal] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  const [formData, setFormData] = useState({
    cnpj: '',
    nome: '',
    endereco: '',
    bairro: '',
    seq_cidade: null as number | null,
    email: '',
    telefone: '',
    ativo: 'S'
  });
  
  // Autocomplete de cidades (no modal)
  const [cidadeSearch, setCidadeSearch] = useState('');
  const [cidades, setCidades] = useState<Cidade[]>([]);
  const [showCidadeDropdown, setShowCidadeDropdown] = useState(false);
  const [selectedCidade, setSelectedCidade] = useState<Cidade | null>(null);
  
  // Modal de confirmação de exclusão
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [fornecedorToDelete, setFornecedorToDelete] = useState<Fornecedor | null>(null);
  
  const { token } = useAuth();
  const limit = 200;

  // ✅ DEBOUNCE: Atualizar searchTerm após 300ms sem digitar
  useEffect(() => {
    // Só busca se tiver 3 ou mais caracteres OU se estiver vazio
    if (searchInput.length >= 3 || searchInput.length === 0) {
      const timer = setTimeout(() => {
        setSearchTerm(searchInput);
        setPage(1);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [searchInput]);

  useEffect(() => {
    fetchFornecedores();
  }, [page, searchTerm, cidadeFilter]);

  useEffect(() => {
    if (cidadeSearch.length >= 2) {
      fetchCidades();
    } else {
      setCidades([]);
    }
  }, [cidadeSearch]);

  useEffect(() => {
    if (cidadeFilterSearch.length >= 2) {
      fetchCidadesFilter();
    } else {
      setCidadeFilterOptions([]);
    }
  }, [cidadeFilterSearch]);

  const fetchFornecedores = async () => {
    setLoading(true);
    try {
      // Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        const data = await mockListFornecedores({
          search: searchTerm,
          cidade: cidadeFilter,
          page,
          limit
        });
        
        if (data.success) {
          setFornecedores(data.fornecedores || []);
          setTotal(data.total || 0);
        }
        setLoading(false);
        return;
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(cidadeFilter && { cidade: cidadeFilter })
      });

      const data = await apiFetch(`${API_BASE_URL}/compras/fornecedores/list.php?${queryParams}`);

      if (data.success) {
        setFornecedores(data.fornecedores || []);
        setTotal(data.total || 0);
      }
    } catch (error: any) {
      console.error('Erro ao buscar fornecedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCidades = async () => {
    try {
      // Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        const data = await mockSearchCidades(cidadeSearch);
        if (data.success) {
          setCidades(data.cidades || []);
        }
        return;
      }

      const queryParams = new URLSearchParams({
        search: cidadeSearch,
        limit: '50'
      });

      const data = await apiFetch(`${API_BASE_URL}/shared/cidades.php?${queryParams}`);

      if (data.success) {
        setCidades(data.cidades || []);
      }
    } catch (error: any) {
      console.error('Erro ao buscar cidades:', error);
    }
  };

  const fetchCidadesFilter = async () => {
    try {
      // Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        const data = await mockSearchCidades(cidadeFilterSearch);
        if (data.success) {
          setCidadeFilterOptions(data.cidades || []);
        }
        return;
      }

      const queryParams = new URLSearchParams({
        search: cidadeFilterSearch,
        limit: '50'
      });

      const data = await apiFetch(`${API_BASE_URL}/shared/cidades.php?${queryParams}`);

      if (data.success) {
        setCidadeFilterOptions(data.cidades || []);
      }
    } catch (error: any) {
      console.error('Erro ao buscar cidades:', error);
    }
  };

  const handleCreate = () => {
    setEditingFornecedor(null);
    setFormData({
      cnpj: '',
      nome: '',
      endereco: '',
      bairro: '',
      seq_cidade: null,
      email: '',
      telefone: '',
      ativo: 'S'
    });
    setSelectedCidade(null);
    setCidadeSearch('');
    setShowModal(true);
  };

  const handleEdit = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setFormData({
      cnpj: fornecedor.cnpj,
      nome: fornecedor.nome,
      endereco: fornecedor.endereco || '',
      bairro: fornecedor.bairro || '',
      seq_cidade: fornecedor.seq_cidade,
      email: fornecedor.email || '',
      telefone: fornecedor.telefone || '',
      ativo: fornecedor.ativo
    });
    
    if (fornecedor.cidade_nome && fornecedor.cidade_uf) {
      setSelectedCidade({
        seq_cidade: fornecedor.seq_cidade!,
        nome: fornecedor.cidade_nome,
        uf: fornecedor.cidade_uf,
        codigo_ibge: 0,
        label: `${fornecedor.cidade_nome} - ${fornecedor.cidade_uf}`
      });
      setCidadeSearch(`${fornecedor.cidade_nome} - ${fornecedor.cidade_uf}`);
    }
    
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      // Validações
      if (!formData.cnpj.trim()) {
        toast.error('CNPJ é obrigatório');
        return;
      }
      if (!formData.nome.trim()) {
        toast.error('Nome é obrigatório');
        return;
      }

      setLoading(true);

      // Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        const data = editingFornecedor
          ? await mockUpdateFornecedor({ ...formData, seq_fornecedor: editingFornecedor.seq_fornecedor })
          : await mockCreateFornecedor(formData);

        if (data.success) {
          toast.success(editingFornecedor ? 'Fornecedor atualizado com sucesso' : 'Fornecedor cadastrado com sucesso');
          setShowModal(false);
          fetchFornecedores();
        } else {
          toast.error(data.message || 'Erro ao salvar fornecedor');
        }
        setLoading(false);
        return;
      }

      const endpoint = editingFornecedor 
        ? `${API_BASE_URL}/compras/fornecedores/update.php`
        : `${API_BASE_URL}/compras/fornecedores/create.php`;

      const payload = editingFornecedor
        ? { ...formData, seq_fornecedor: editingFornecedor.seq_fornecedor }
        : formData;

      const data = await apiFetch(endpoint, {
        method: editingFornecedor ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });

      if (data.success) {
        setShowModal(false);
        // ✅ SEMPRE recarregar a lista após salvar com sucesso
        fetchFornecedores();
      }
    } catch (error: any) {
      console.error('Erro ao salvar fornecedor:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (fornecedor: Fornecedor) => {
    setFornecedorToDelete(fornecedor);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fornecedorToDelete) return;

    try {
      setLoading(true);

      // Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        const data = await mockDeleteFornecedor(fornecedorToDelete.seq_fornecedor);

        if (data.success) {
          toast.success(data.message || 'Status alterado com sucesso');
          setShowDeleteDialog(false);
          setFornecedorToDelete(null);
          fetchFornecedores();
        } else {
          toast.error(data.message || 'Erro ao alterar status');
        }
        setLoading(false);
        return;
      }

      const data = await apiFetch(
        `${API_BASE_URL}/compras/fornecedores/toggle-status.php`,
        {
          method: 'PUT',
          body: JSON.stringify({ seq_fornecedor: fornecedorToDelete.seq_fornecedor })
        }
      );

      if (data.success) {
        setShowDeleteDialog(false);
        setFornecedorToDelete(null);
        fetchFornecedores();
      }
    } catch (error: any) {
      console.error('Erro ao alterar status do fornecedor:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    try {
      setLoading(true);

      // Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        const data = await mockImportFornecedores();
        
        if (data.success) {
          toast.success(data.message || `Importação concluída: ${data.imported} novos, ${data.updated} atualizados`);
          fetchFornecedores();
        }
        setLoading(false);
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/compras/fornecedores/import.php`, {
        method: 'POST',
      });

      if (data.success) {
        toast.success(`Importação concluída: ${data.imported} novos, ${data.updated} atualizados`);
        fetchFornecedores();
      }
    } catch (error: any) {
      console.error('Erro ao importar fornecedores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCidade = (cidade: Cidade) => {
    setSelectedCidade(cidade);
    setFormData({ ...formData, seq_cidade: cidade.seq_cidade });
    setCidadeSearch(cidade.label);
    setShowCidadeDropdown(false);
  };

  const handleSelectCidadeFilter = (cidade: Cidade) => {
    setSelectedCidadeFilter(cidade);
    setCidadeFilter(cidade.nome); // ✅ Buscar por nome da cidade, não por ID
    setCidadeFilterSearch(cidade.label);
    setShowCidadeFilterDropdown(false);
    setPage(1);
  };

  const handleClearCidadeFilter = () => {
    setSelectedCidadeFilter(null);
    setCidadeFilter('');
    setCidadeFilterSearch('');
    setShowCidadeFilterDropdown(false);
    setPage(1);
  };

  const sortedFornecedores = sortData(fornecedores);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="flex items-center gap-2">
              <Building2 className="w-6 h-6" />
              Cadastro de Fornecedores
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gerenciar fornecedores da empresa
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleImport}
              disabled={loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Importar Fornecedores
            </Button>
            <Button onClick={handleCreate} disabled={loading}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Fornecedor
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-card rounded-lg shadow-sm border border-border p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                <AlertCircle className="w-3 h-3 mr-1" />
                Limite: 200 registros por consulta
              </Badge>
              <span className="text-xs text-muted-foreground">
                Use os filtros para refinar sua busca
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Buscar por Nome ou CNPJ</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Digite o nome ou CNPJ..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-10 bg-background text-foreground border-input"
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <Label>Filtrar por Cidade</Label>
              <div className="relative">
                {selectedCidadeFilter ? (
                  <div className="flex items-center gap-2 p-2 border border-input rounded-md bg-blue-50 dark:bg-blue-900/20">
                    <span className="text-sm flex-1">{selectedCidadeFilter.label}</span>
                    <button
                      onClick={handleClearCidadeFilter}
                      className="text-muted-foreground hover:text-destructive"
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Digite o nome da cidade..."
                      value={cidadeFilterSearch}
                      onChange={(e) => {
                        setCidadeFilterSearch(e.target.value);
                        setShowCidadeFilterDropdown(true);
                      }}
                      onFocus={() => setShowCidadeFilterDropdown(true)}
                      className="pl-10 bg-background text-foreground border-input"
                      disabled={loading}
                    />
                  </>
                )}
                {showCidadeFilterDropdown && cidadeFilterOptions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                    {cidadeFilterOptions.map((cidade) => (
                      <button
                        key={cidade.seq_cidade}
                        onClick={() => handleSelectCidadeFilter(cidade)}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                      >
                        {cidade.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <div className="bg-card rounded-lg shadow-sm border border-border">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              </div>
            ) : sortedFornecedores.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mx-auto mb-4" />
                <p>Nenhum fornecedor encontrado</p>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <SortableTableHeader
                        field="cnpj"
                        label="CNPJ"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <SortableTableHeader
                        field="nome"
                        label="Nome"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <SortableTableHeader
                        field="cidade_nome"
                        label="Cidade"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Contato
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <SortableTableHeader
                        field="ativo"
                        label="Status"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedFornecedores.map((fornecedor) => (
                    <tr key={fornecedor.seq_fornecedor} className="hover:bg-muted/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {fornecedor.cnpj}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium">
                        {fornecedor.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {fornecedor.cidade_nome ? (
                          <span>{fornecedor.cidade_nome} - {fornecedor.cidade_uf}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {fornecedor.telefone && <div>{fornecedor.telefone}</div>}
                        {fornecedor.email && <div className="text-muted-foreground text-xs">{fornecedor.email}</div>}
                        {!fornecedor.telefone && !fornecedor.email && <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {fornecedor.ativo === 'S' ? (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="w-3 h-3 mr-1" />
                            Inativo
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(fornecedor)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(fornecedor)}
                            title={fornecedor.ativo === 'S' ? 'Inativar' : 'Reativar'}
                          >
                            {fornecedor.ativo === 'S' ? (
                              <Ban className="w-4 h-4 text-orange-600" />
                            ) : (
                              <RotateCcw className="w-4 h-4 text-green-600" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          {total > limit && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="text-sm text-card-foreground">
                Mostrando {((page - 1) * limit) + 1} a {Math.min(page * limit, total)} de {total} registros
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1 || loading}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= Math.ceil(total / limit) || loading}
                >
                  Próximo
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de Cadastro/Edição */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingFornecedor ? 'Editar Fornecedor' : 'Novo Fornecedor'}
            </DialogTitle>
            <DialogDescription>
              {editingFornecedor 
                ? 'Atualize as informações do fornecedor' 
                : 'Preencha os dados do novo fornecedor'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CNPJ *</Label>
                <Input
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                  maxLength={20}
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                >
                  <option value="S">Ativo</option>
                  <option value="N">Inativo</option>
                </select>
              </div>
            </div>

            <div>
              <Label>Nome/Razão Social *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Digite o nome do fornecedor"
                maxLength={200}
              />
            </div>

            <div>
              <Label>Endereço</Label>
              <Input
                value={formData.endereco}
                onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                placeholder="Rua, número, complemento"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bairro</Label>
                <Input
                  value={formData.bairro}
                  onChange={(e) => setFormData({ ...formData, bairro: e.target.value })}
                  placeholder="Digite o bairro"
                  maxLength={100}
                />
              </div>
              <div className="relative">
                <Label>Cidade</Label>
                <Input
                  value={cidadeSearch}
                  onChange={(e) => {
                    setCidadeSearch(e.target.value);
                    setShowCidadeDropdown(true);
                  }}
                  onFocus={() => setShowCidadeDropdown(true)}
                  placeholder="Digite para buscar..."
                />
                {showCidadeDropdown && cidades.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-auto">
                    {cidades.map((cidade) => (
                      <button
                        key={cidade.seq_cidade}
                        onClick={() => handleSelectCidade(cidade)}
                        className="w-full text-left px-4 py-2 hover:bg-muted text-sm"
                      >
                        {cidade.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@fornecedor.com"
                  maxLength={200}
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 0000-0000"
                  maxLength={20}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Inativar/Reativar */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {fornecedorToDelete?.ativo === 'S' ? 'Confirmar Inativação' : 'Confirmar Reativação'}
            </DialogTitle>
            <DialogDescription>
              {fornecedorToDelete?.ativo === 'S' ? (
                <>
                  Tem certeza que deseja <strong>inativar</strong> o fornecedor <strong>{fornecedorToDelete?.nome}</strong>?
                  <br />
                  O fornecedor ficará inativo mas seus dados serão mantidos.
                </>
              ) : (
                <>
                  Tem certeza que deseja <strong>reativar</strong> o fornecedor <strong>{fornecedorToDelete?.nome}</strong>?
                  <br />
                  O fornecedor voltará a ficar ativo no sistema.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              variant={fornecedorToDelete?.ativo === 'S' ? 'destructive' : 'default'}
              onClick={handleDeleteConfirm} 
              disabled={loading}
            >
              {loading ? 'Processando...' : (fornecedorToDelete?.ativo === 'S' ? 'Inativar' : 'Reativar')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}