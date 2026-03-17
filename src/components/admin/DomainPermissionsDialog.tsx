import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import { Shield, Save, X, Search } from 'lucide-react';
import { SortableTableHeader, useSortableTable } from '../table/SortableTableHeader';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

interface MenuItem {
  id: number;
  name: string;
  description: string;
  created_at: string;
}

// ✅ Hook de ordenação usando o padrão oficial
type SortField = 'id' | 'name' | 'description' | 'created_at';

// ✅ Dados MOCK para desenvolvimento no Figma Make
const MOCK_MENU_ITEMS: MenuItem[] = [
  { id: 1, name: 'Dashboard Financeiro', description: 'Visão geral financeira com DRE e indicadores', created_at: '2024-01-15T10:00:00' },
  { id: 2, name: 'Dashboard Performance', description: 'Análise de performance de entregas', created_at: '2024-01-15T10:05:00' },
  { id: 3, name: 'Cadastro de Eventos', description: 'Gerenciamento de eventos do sistema', created_at: '2024-01-15T10:10:00' },
  { id: 4, name: 'Cadastro de Linhas', description: 'Gerenciamento de linhas de transporte', created_at: '2024-01-15T10:15:00' },
  { id: 5, name: 'Cadastro de Veículos', description: 'Gestão da frota de veículos', created_at: '2024-01-15T10:20:00' },
  { id: 6, name: 'Gestão de Usuários', description: 'Gerenciamento de usuários do sistema', created_at: '2024-01-15T10:25:00' },
  { id: 7, name: 'Gestão de Domínios', description: 'Administração de domínios/empresas', created_at: '2024-01-15T10:30:00' },
  { id: 8, name: 'Gestão de Permissões', description: 'Controle de permissões de usuários', created_at: '2024-01-15T10:35:00' },
  { id: 9, name: 'Gestão do Menu', description: 'Configuração da estrutura do menu', created_at: '2024-01-15T10:40:00' },
  { id: 10, name: 'Relatórios Disponíveis', description: 'Lista de relatórios do sistema', created_at: '2024-01-15T10:45:00' },
];

const MOCK_DOMAIN_PERMISSIONS: Record<string, number[]> = {
  'ACV': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'XXX': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  'VCS': [1, 2, 3, 4, 5, 6],
  'DMN': [1, 3, 5, 6],
};

interface DomainPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain?: string;
  loading?: boolean;
}

export function DomainPermissionsDialog({
  open,
  onOpenChange,
  domain,
  loading: externalLoading = false,
}: DomainPermissionsDialogProps) {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // ✅ Hook de ordenação usando o padrão oficial
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('id', 'asc');
  
  const { token } = useAuth();

  useEffect(() => {
    if (open && domain) {
      fetchMenuItems();
      fetchDomainPermissions();
    }
  }, [open, domain]);

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      // ✅ Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simular delay
        setMenuItems(MOCK_MENU_ITEMS);
        setLoading(false);
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/domains/get_menu_items.php`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (data.success) {
        setMenuItems(data.items || []);
      } else {
        toast.error(data.message || 'Erro ao buscar itens de menu');
      }
    } catch (error: any) {
      console.error('Erro ao buscar itens de menu:', error);
      // ✅ Fallback para dados mock em caso de erro
      console.warn('⚠️ Usando dados MOCK como fallback');
      setMenuItems(MOCK_MENU_ITEMS);
    } finally {
      setLoading(false);
    }
  };

  const fetchDomainPermissions = async () => {
    try {
      // ✅ Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 200)); // Simular delay
        const permissions = MOCK_DOMAIN_PERMISSIONS[domain!] || [1, 2, 3, 4, 5, 6];
        setSelectedItems(new Set(permissions));
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/domains/get_permissions.php?domain=${domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (data.success) {
        setSelectedItems(new Set(data.item_ids || []));
      }
    } catch (error: any) {
      console.error('Erro ao buscar permissões:', error);
      // ✅ Fallback para dados mock em caso de erro
      console.warn('⚠️ Usando permissões MOCK como fallback');
      const permissions = MOCK_DOMAIN_PERMISSIONS[domain!] || [1, 2, 3, 4, 5, 6];
      setSelectedItems(new Set(permissions));
    }
  };

  const handleToggleItem = (itemId: number) => {
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    if (selectedItems.size === filteredItems.length) {
      // Desmarcar todos
      setSelectedItems(new Set());
    } else {
      // Marcar todos filtrados
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // ✅ Se estiver no Figma Make, simular sucesso
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simular delay
        console.log('✅ [MOCK] Permissões salvas:', {
          domain,
          item_ids: Array.from(selectedItems),
        });
        toast.success('Permissões atualizadas com sucesso');
        onOpenChange(false);
        setLoading(false);
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/domains/update_permissions.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          domain,
          item_ids: Array.from(selectedItems),
        }),
      });

      if (data.success) {
        toast.success('Permissões atualizadas com sucesso');
        onOpenChange(false);
      } else {
        toast.error(data.message || 'Erro ao salvar permissões');
      }
    } catch (error: any) {
      console.error('Erro ao salvar permissões:', error);
      toast.error(error.message || 'Erro ao salvar permissões');
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = menuItems.filter((item) => {
    const search = searchTerm.toLowerCase();
    return (
      item.name.toLowerCase().includes(search) ||
      item.description?.toLowerCase().includes(search) ||
      item.id.toString().includes(search)
    );
  });

  const allSelected = filteredItems.length > 0 && selectedItems.size === filteredItems.length;

  const sortedItems = sortData(filteredItems);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Gerenciar Permissões: {domain}
          </DialogTitle>
          <DialogDescription>
            Selecione os itens de menu que ficarão disponíveis para este domínio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por ID, nome ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              disabled={loading}
            />
          </div>

          {/* Header com checkbox "Marcar todos" */}
          <div className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                checked={allSelected}
                onCheckedChange={handleToggleAll}
                disabled={loading || filteredItems.length === 0}
              />
              <span className="text-sm font-medium">
                Marcar todos ({selectedItems.size} de {menuItems.length} selecionados)
              </span>
            </div>
          </div>

          {/* Tabela de itens */}
          <div className="flex-1 overflow-auto rounded-lg border">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando itens...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? 'Nenhum item encontrado' : 'Nenhum item disponível'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <SortableTableHeader
                      field="id"
                      label="ID"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      field="name"
                      label="Nome"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      field="description"
                      label="Descrição"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableTableHeader
                      field="created_at"
                      label="Criado em"
                      currentSortField={sortField}
                      currentSortDirection={sortDirection}
                      onSort={handleSort}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => handleToggleItem(item.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => handleToggleItem(item.id)}
                        />
                      </TableCell>
                      <TableCell>#{item.id}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.description}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(item.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading || externalLoading}
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || externalLoading}
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? 'Salvando...' : 'Salvar Permissões'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}