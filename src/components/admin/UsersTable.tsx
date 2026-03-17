import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { 
  Edit2, 
  Trash2, 
  RotateCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Shield,
  Building2,
  FolderTree,
  Filter,
  FilterX,
  User
} from 'lucide-react';
import { getSetorColorClasses } from '../../utils/setorColors';
import { FilterSelectSetor } from './FilterSelectSetor';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { FilterSelectAdmin } from './FilterSelectAdmin';

interface UserData {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  domain: string;
  unidade: string;
  troca_unidade: boolean;
  aprova_orcamento: boolean;
  nro_setor?: number;
  setor_descricao?: string;
  created_at?: string;
}

interface UsersTableProps {
  users: UserData[];
  isLoading: boolean;
  onEdit: (user: UserData) => void;
  onDelete: (userId: number, username: string) => void;
  onReactivate: (userId: number, username: string) => void;
}

type SortField = 'full_name' | 'username' | 'email' | 'setor_descricao' | 'unidade';
type SortDirection = 'asc' | 'desc' | null;

export function UsersTable({ users, isLoading, onEdit, onDelete, onReactivate }: UsersTableProps) {
  // Estados de ordenação
  const [sortField, setSortField] = useState<SortField>('full_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  
  // Estados de filtros
  const [filterSetor, setFilterSetor] = useState<number | null>(null);
  const [filterUnidade, setFilterUnidade] = useState('');
  const [filterAdmin, setFilterAdmin] = useState<'all' | 'yes' | 'no'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Limpar filtros
  const clearFilters = () => {
    setFilterSetor(null);
    setFilterUnidade('');
    setFilterAdmin('all');
    setSearchTerm('');
  };
  
  // Verificar se há filtros ativos
  const hasActiveFilters = filterSetor !== null || filterUnidade !== '' || filterAdmin !== 'all' || searchTerm !== '';
  
  // Função de ordenação
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField('full_name');
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Renderizar ícone de ordenação
  const getSortIcon = (field: SortField) => {
    if (sortField !== field || sortDirection === null) {
      return <ArrowUpDown className="w-4 h-4 ml-2" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4 ml-2" /> : 
      <ArrowDown className="w-4 h-4 ml-2" />;
  };
  
  // Filtrar e ordenar usuários
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];
    
    // Aplicar filtros
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(u => 
        u.full_name.toLowerCase().includes(search) ||
        u.username.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search)
      );
    }
    
    if (filterSetor !== null) {
      result = result.filter(u => u.nro_setor === filterSetor);
    }
    
    if (filterUnidade !== '') {
      result = result.filter(u => u.unidade === filterUnidade);
    }
    
    if (filterAdmin === 'yes') {
      result = result.filter(u => u.is_admin);
    } else if (filterAdmin === 'no') {
      result = result.filter(u => !u.is_admin);
    }
    
    // Aplicar ordenação
    if (sortDirection) {
      result.sort((a, b) => {
        let aValue: any = a[sortField] || '';
        let bValue: any = b[sortField] || '';
        
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    return result;
  }, [users, searchTerm, filterSetor, filterUnidade, filterAdmin, sortField, sortDirection]);
  
  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-600 dark:text-slate-400" />
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Filtros</h3>
            {hasActiveFilters && (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                {filteredAndSortedUsers.length} de {users.length}
              </Badge>
            )}
          </div>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={clearFilters}
              className="text-slate-600 dark:text-slate-400"
            >
              <FilterX className="w-4 h-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Busca */}
          <div className="space-y-2">
            <Label htmlFor="search">Buscar</Label>
            <Input
              id="search"
              type="text"
              placeholder="Nome, usuário ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Filtro Setor */}
          <div className="space-y-2">
            <Label htmlFor="filter-setor">Setor</Label>
            <FilterSelectSetor
              value={filterSetor}
              onChange={(value) => setFilterSetor(value)}
              allowClear
            />
          </div>
          
          {/* Filtro Unidade */}
          <div className="space-y-2">
            <Label htmlFor="filter-unidade">Unidade</Label>
            <FilterSelectUnidadeSingle
              value={filterUnidade}
              onChange={(value) => setFilterUnidade(value)}
            />
          </div>
          
          {/* Filtro Admin */}
          <div className="space-y-2">
            <Label htmlFor="filter-admin">Administrador</Label>
            <FilterSelectAdmin
              value={filterAdmin}
              onChange={(value) => setFilterAdmin(value)}
            />
          </div>
        </div>
      </div>
      
      {/* Tabela */}
      <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('full_name')}
                  className="font-medium flex items-center"
                >
                  Nome
                  {getSortIcon('full_name')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('username')}
                  className="font-medium flex items-center"
                >
                  Usuário
                  {getSortIcon('username')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('email')}
                  className="font-medium flex items-center"
                >
                  Email
                  {getSortIcon('email')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('setor_descricao')}
                  className="font-medium flex items-center"
                >
                  Setor
                  {getSortIcon('setor_descricao')}
                </Button>
              </TableHead>
              <TableHead>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleSort('unidade')}
                  className="font-medium flex items-center"
                >
                  Unidade
                  {getSortIcon('unidade')}
                </Button>
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <User className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                  <p className="text-slate-500">
                    {hasActiveFilters ? 'Nenhum usuário encontrado com os filtros aplicados' : 'Nenhum usuário cadastrado'}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell>@{u.username}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {u.setor_descricao && u.nro_setor ? (
                      <Badge variant="secondary" className={getSetorColorClasses(u.nro_setor)}>
                        <FolderTree className="w-3 h-3 mr-1" />
                        {u.setor_descricao}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {u.unidade ? (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        <Building2 className="w-3 h-3 mr-1" />
                        {u.unidade}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {u.is_admin && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                          <Shield className="w-3 h-3 mr-1" />
                          ADMIN
                        </Badge>
                      )}
                      {!u.is_active && (
                        <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          INATIVO
                        </Badge>
                      )}
                      {u.is_active && !u.is_admin && (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          ATIVO
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onEdit(u)}
                        disabled={isLoading}
                        title="Editar usuário"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      {!u.is_active && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => onReactivate(u.id, u.username)}
                          disabled={isLoading}
                          title="Reativar usuário"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      )}
                      {u.username.toLowerCase() !== 'admin' && u.is_active && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete(u.id, u.username)}
                          disabled={isLoading}
                          title="Desativar usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}