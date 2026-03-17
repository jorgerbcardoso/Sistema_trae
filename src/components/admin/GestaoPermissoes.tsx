import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import { 
  Shield, 
  Search, 
  Save, 
  Copy,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Package,
  TrendingUp,
  Settings,
  Truck,
  BarChart3,
  UserPlus,
  Route,
  DollarSign,
  FolderPlus,
  Calendar,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  Building2,
  User,
  RefreshCw,
  UserCheck,
  Warehouse,
  MapPin,
  Tag,
  ArrowDownCircle,
  ArrowUpCircle,
  ClipboardCheck,
  Calculator,
  CheckSquare,
  CheckCircle,
  ShoppingBag,
  ShoppingCart,
  Menu as MenuIcon,
  Box,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { mockGetMenu } from '../../mocks/mockData';

interface MenuItem {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  section_id: number;
  section_code: string;
  section_name: string;
  section_icon: string;
  ordem: number;
}

interface MenuSection {
  id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  items: MenuItem[];
}

interface UserSearchResult {
  username: string;
  name: string;
  email: string;
  domain: string;
  is_admin?: boolean;
  unidade?: string;
}

// ✅ Converter dados do mock para estrutura de seções
const getMockMenuBySection = async (domain: string): Promise<MenuSection[]> => {
  const menuData = await mockGetMenu(domain);
  
  if (!menuData.success || !menuData.menu?.sections) {
    return [];
  }
  
  return menuData.menu.sections.map((section: any) => ({
    id: section.id,
    code: section.code,
    name: section.name,
    description: section.description || '',
    icon: section.icon,
    items: (section.items || [])
      .map((item: any) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        description: item.description || '',
        icon: item.icon,
        section_id: section.id,
        section_code: section.code,
        section_name: section.name,
        section_icon: section.icon,
        ordem: item.ordem || item.display_order || 999
      }))
      .sort((a: any, b: any) => a.ordem - b.ordem) // ✅ Ordenar pela ordem definida
  }));
};

// ✅ Dados MOCK para desenvolvimento no Figma Make
const MOCK_USERS: UserSearchResult[] = [
  { username: 'joao.silva', name: 'João Silva', email: 'joao.silva@empresa.com', domain: 'ACV', is_admin: true, unidade: 'MATRIZ' },
  { username: 'maria.santos', name: 'Maria Santos', email: 'maria.santos@empresa.com', domain: 'ACV', is_admin: false, unidade: 'FILIAL SP' },
  { username: 'pedro.oliveira', name: 'Pedro Oliveira', email: 'pedro.oliveira@empresa.com', domain: 'ACV', is_admin: false, unidade: 'FILIAL RJ' },
  { username: 'ana.costa', name: 'Ana Costa', email: 'ana.costa@empresa.com', domain: 'VCS', is_admin: true, unidade: 'SEDE' },
  { username: 'carlos.souza', name: 'Carlos Souza', email: 'carlos.souza@empresa.com', domain: 'VCS', is_admin: false, unidade: 'CENTRO' },
];

const MOCK_USER_PERMISSIONS: Record<string, number[]> = {
  'joao.silva': [1, 2, 3, 4, 5],
  'maria.santos': [1, 2, 3, 4, 5, 6, 7, 8],
  'pedro.oliveira': [1, 2, 3],
  'ana.costa': [1, 2, 3, 4, 5, 6],
  'carlos.souza': [1, 3, 5],
};

interface GestaoPermissoesProps {
  permissions?: {
    can_access: boolean;
    can_create?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
    can_export?: boolean;
  };
}

export default function GestaoPermissoes({ permissions }: GestaoPermissoesProps) {
  // Controle de etapas
  const [currentStep, setCurrentStep] = useState<'search' | 'permissions'>('search');
  
  // Estado de busca de usuário
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  
  // Estado de menu items e permissões
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estado de replicação
  const [showReplicateDialog, setShowReplicateDialog] = useState(false);
  const [usersToReplicate, setUsersToReplicate] = useState<Set<string>>(new Set());
  const [availableUsers, setAvailableUsers] = useState<UserSearchResult[]>([]);
  
  const { token, user } = useAuth();

  // Carregar usuários ao montar o componente
  useEffect(() => {
    loadAllUsers();
  }, []);

  // Buscar usuários quando o termo de busca muda
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (userSearch.trim().length >= 2) {
        searchUsers(userSearch);
      } else if (userSearch.trim().length === 0) {
        // Se campo vazio, mostrar todos
        loadAllUsers();
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [userSearch]);

  const loadAllUsers = async () => {
    setSearchLoading(true);
    try {
      // ✅ Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setSearchResults(MOCK_USERS);
        setShowSearchResults(true);
        setSearchLoading(false);
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/permissions/get_domain_users.php?domain=${user?.domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (data.success) {
        setSearchResults(data.users || []);
        setShowSearchResults((data.users || []).length > 0);
      }
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      // ✅ Fallback para dados mock
      setSearchResults(MOCK_USERS);
      setShowSearchResults(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const searchUsers = async (searchQuery: string) => {
    setSearchLoading(true);
    try {
      // ✅ Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const filtered = MOCK_USERS.filter(u => 
          u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSearchResults(filtered);
        setShowSearchResults(true);
        setSearchLoading(false);
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/permissions/search_users.php?search=${encodeURIComponent(searchQuery)}&domain=${user?.domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (data.success) {
        setSearchResults(data.users || []);
        setShowSearchResults((data.users || []).length > 0);
      }
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      // ✅ Fallback para dados mock em caso de erro
      const filtered = MOCK_USERS.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setSearchResults(filtered);
      setShowSearchResults(true);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectUser = (userResult: UserSearchResult) => {
    setSelectedUser(userResult);
    setUserSearch(userResult.username);
    setShowSearchResults(false);
    // Avançar direto para as permissões
    loadPermissionsForUser(userResult);
  };

  const handleClearUser = () => {
    setSelectedUser(null);
    setUserSearch('');
    setSearchResults([]);
    loadAllUsers();
  };

  const loadPermissionsForUser = async (userToLoad: UserSearchResult) => {
    setLoading(true);
    
    try {
      // Buscar itens disponíveis
      await fetchMenuItems();
      
      // Buscar permissões do usuário
      await fetchUserPermissions(userToLoad.username);
      
      // Avançar para a próxima etapa
      setCurrentStep('permissions');
    } catch (error) {
      console.error('Erro ao carregar permissões:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceToPermissions = async () => {
    if (!selectedUser) {
      toast.error('Selecione um usuário primeiro');
      return;
    }

    await loadPermissionsForUser(selectedUser);
  };

  const handleBackToSearch = () => {
    setCurrentStep('search');
    setSearchTerm('');
  };

  const fetchMenuItems = async () => {
    try {
      // ✅ Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const menuBySection = await getMockMenuBySection(user?.domain || 'XXX');
        setMenuSections(menuBySection);
        // Expandir todas as seções por padrão
        setExpandedSections(new Set(menuBySection.map(s => s.code)));
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/permissions/get_available_items.php?domain=${user?.domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (data.success) {
        setMenuSections(data.sections || []);
        setExpandedSections(new Set((data.sections || []).map((s: MenuSection) => s.code)));
      } else {
        toast.error(data.message || 'Erro ao buscar itens de menu');
      }
    } catch (error: any) {
      console.error('Erro ao buscar itens de menu:', error);
      // ✅ Fallback para dados mock
      const menuBySection = await getMockMenuBySection(user?.domain || 'XXX');
      setMenuSections(menuBySection);
      setExpandedSections(new Set(menuBySection.map(s => s.code)));
    }
  };

  const fetchUserPermissions = async (username: string) => {
    try {
      // ✅ Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const permissions = MOCK_USER_PERMISSIONS[username] || [1, 2, 3];
        setSelectedItems(new Set(permissions));
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/permissions/get_user_permissions.php?username=${username}&domain=${user?.domain}`, {
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
      // ✅ Fallback para dados mock
      const permissions = MOCK_USER_PERMISSIONS[username] || [1, 2, 3];
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

  const toggleSection = (sectionCode: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionCode)) {
        newSet.delete(sectionCode);
      } else {
        newSet.add(sectionCode);
      }
      return newSet;
    });
  };

  const handleToggleSectionItems = (section: MenuSection) => {
    const sectionItemIds = section.items.map(item => item.id);
    const allSectionItemsSelected = sectionItemIds.every(id => selectedItems.has(id));
    
    setSelectedItems((prev) => {
      const newSet = new Set(prev);
      if (allSectionItemsSelected) {
        // Desmarcar todos os itens da seção
        sectionItemIds.forEach(id => newSet.delete(id));
      } else {
        // Marcar todos os itens da seção
        sectionItemIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    const allItemIds = menuSections.flatMap(section => section.items.map(item => item.id));
    
    if (selectedItems.size === allItemIds.length) {
      // Desmarcar todos
      setSelectedItems(new Set());
    } else {
      // Marcar todos
      setSelectedItems(new Set(allItemIds));
    }
  };

  const handleSave = async () => {
    if (!selectedUser) {
      toast.error('Selecione um usuário primeiro');
      return;
    }

    setLoading(true);
    try {
      // ✅ Se estiver no Figma Make, simular sucesso
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ [MOCK] Permissões salvas:', {
          username: selectedUser.username,
          item_ids: Array.from(selectedItems),
        });
        toast.success('Permissões atualizadas com sucesso');
        setLoading(false);
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/permissions/update_user_permissions.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: selectedUser.username,
          domain: user?.domain,
          item_ids: Array.from(selectedItems),
        }),
      });

      if (data.success) {
        toast.success('Permissões atualizadas com sucesso');
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

  const handleOpenReplicateDialog = async () => {
    setLoading(true);
    try {
      // ✅ Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 200));
        const filtered = MOCK_USERS.filter(u => u.username !== selectedUser?.username);
        setAvailableUsers(filtered);
        setShowReplicateDialog(true);
        setLoading(false);
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/permissions/get_domain_users.php?domain=${user?.domain}&for_replication=true`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (data.success) {
        const filtered = (data.users || []).filter((u: UserSearchResult) => u.username !== selectedUser?.username);
        setAvailableUsers(filtered);
        setShowReplicateDialog(true);
      }
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error);
      const filtered = MOCK_USERS.filter(u => u.username !== selectedUser?.username);
      setAvailableUsers(filtered);
      setShowReplicateDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReplicatePermissions = async () => {
    if (usersToReplicate.size === 0) {
      toast.error('Selecione pelo menos um usuário');
      return;
    }

    setLoading(true);
    try {
      // ✅ Se estiver no Figma Make, simular sucesso
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('✅ [MOCK] Permissões replicadas:', {
          from: selectedUser?.username,
          to: Array.from(usersToReplicate),
          item_ids: Array.from(selectedItems),
        });
        toast.success(`Permissões replicadas para ${usersToReplicate.size} usuário(s)`);
        setShowReplicateDialog(false);
        setUsersToReplicate(new Set());
        setLoading(false);
        return;
      }

      const data = await apiFetch(`${API_BASE_URL}/admin/permissions/replicate_permissions.php`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from_username: selectedUser?.username,
          to_usernames: Array.from(usersToReplicate),
          domain: user?.domain,
          item_ids: Array.from(selectedItems),
        }),
      });

      if (data.success) {
        toast.success(`Permissões replicadas para ${usersToReplicate.size} usuário(s)`);
        setShowReplicateDialog(false);
        setUsersToReplicate(new Set());
      } else {
        toast.error(data.message || 'Erro ao replicar permissões');
      }
    } catch (error: any) {
      console.error('Erro ao replicar permissões:', error);
      toast.error(error.message || 'Erro ao replicar permissões');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReplicateUser = (username: string) => {
    setUsersToReplicate((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(username)) {
        newSet.delete(username);
      } else {
        newSet.add(username);
      }
      return newSet;
    });
  };

  const handleToggleAllReplicateUsers = () => {
    if (usersToReplicate.size === availableUsers.length) {
      setUsersToReplicate(new Set());
    } else {
      setUsersToReplicate(new Set(availableUsers.map(u => u.username)));
    }
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      'TrendingUp': <TrendingUp className="w-5 h-5" />,
      'Package': <Package className="w-5 h-5" />,
      'Truck': <Truck className="w-5 h-5" />,
      'BarChart3': <BarChart3 className="w-5 h-5" />,
      'UserPlus': <UserPlus className="w-5 h-5" />,
      'Settings': <Settings className="w-5 h-5" />,
      'Route': <Route className="w-5 h-5" />,
      'DollarSign': <DollarSign className="w-5 h-5" />,
      'FolderPlus': <FolderPlus className="w-5 h-5" />,
      'Calendar': <Calendar className="w-5 h-5" />,
      'FolderOpen': <FolderOpen className="w-5 h-5" />,
      'FileText': <FileText className="w-5 h-5" />,
      'FileSpreadsheet': <FileSpreadsheet className="w-5 h-5" />,
      'Building2': <Building2 className="w-5 h-5" />,
      'User': <User className="w-5 h-5" />,
      'RefreshCw': <RefreshCw className="w-5 h-5" />,
      'UserCheck': <UserCheck className="w-5 h-5" />,
      'Warehouse': <Warehouse className="w-5 h-5" />,
      'MapPin': <MapPin className="w-5 h-5" />,
      'Tag': <Tag className="w-5 h-5" />,
      'ArrowDownCircle': <ArrowDownCircle className="w-5 h-5" />,
      'ArrowUpCircle': <ArrowUpCircle className="w-5 h-5" />,
      'ClipboardCheck': <ClipboardCheck className="w-5 h-5" />,
      'Calculator': <Calculator className="w-5 h-5" />,
      'CheckSquare': <CheckSquare className="w-5 h-5" />,
      'CheckCircle': <CheckCircle className="w-5 h-5" />,
      'ShoppingBag': <ShoppingBag className="w-5 h-5" />,
      'ShoppingCart': <ShoppingCart className="w-5 h-5" />,
      'Menu': <MenuIcon className="w-5 h-5" />,
      'Box': <Box className="w-5 h-5" />,
    };
    return icons[iconName] || <Package className="w-5 h-5" />;
  };

  const filteredSections = menuSections.map(section => ({
    ...section,
    items: section.items
      .filter(item => {
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        return (
          item.name.toLowerCase().includes(search) ||
          item.description?.toLowerCase().includes(search) ||
          item.id.toString().includes(search)
        );
      })
      .sort((a: any, b: any) => {
        // Ordenar pela ordem definida na gestão do menu
        const ordemA = a.ordem || a.display_order || 999;
        const ordemB = b.ordem || b.display_order || 999;
        return ordemA - ordemB;
      })
  })).filter(section => section.items.length > 0);

  const totalItems = menuSections.flatMap(s => s.items).length;
  const allSelected = totalItems > 0 && selectedItems.size === totalItems;

  return (
    <AdminLayout title="GESTÃO DE PERMISSÕES" description={user?.client_name || ''}>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div>
          <h1 className="flex items-center gap-2">
            <Shield className="w-6 h-6" />
            GESTÃO DE PERMISSÕES
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Definir permissões de acesso por usuário
          </p>
        </div>

        {/* ETAPA 1: Busca e Seleção de Usuário */}
        {currentStep === 'search' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                  <User className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold mb-2">Selecione o Usuário</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Busque por login ou nome do usuário que deseja gerenciar
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Buscar Usuário
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      placeholder="Digite o login ou nome do usuário..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10 pr-10 text-lg py-6"
                      disabled={loading}
                      autoFocus
                    />
                    {selectedUser && (
                      <button
                        onClick={handleClearUser}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  {userSearch.length > 0 && userSearch.length < 2 && (
                    <p className="text-sm text-gray-500 mt-2">
                      Digite pelo menos 2 caracteres para buscar
                    </p>
                  )}
                </div>

                {/* Resultados da busca */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="border rounded-lg divide-y max-h-80 overflow-y-auto bg-white dark:bg-gray-800">
                    {searchResults.map((result) => (
                      <button
                        key={result.username}
                        onClick={() => handleSelectUser(result)}
                        className="w-full px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-4"
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {result.username}
                            </span>
                            {result.unidade && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                                {result.unidade}
                              </span>
                            )}
                            {result.is_admin && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                ADMIN
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {result.name}
                          </div>
                        </div>
                        <div className="text-xs text-gray-500 hidden lg:block">
                          {result.email}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchLoading && (
                  <div className="text-center py-8 text-gray-500">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                    Buscando usuários...
                  </div>
                )}

                {!showSearchResults && userSearch.length >= 2 && !searchLoading && searchResults.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Nenhum usuário encontrado
                  </div>
                )}

                {/* Usuário selecionado */}
                {selectedUser && !showSearchResults && (
                  <div className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-lg text-blue-900 dark:text-blue-100">
                          {selectedUser.username}
                        </div>
                        <div className="text-blue-700 dark:text-blue-300">
                          {selectedUser.name}
                        </div>
                        <div className="text-sm text-blue-600 dark:text-blue-400">
                          {selectedUser.email}
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      onClick={handleAdvanceToPermissions}
                      disabled={loading}
                      className="w-full py-6 text-lg"
                      size="lg"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin w-5 h-5 border-3 border-white border-t-transparent rounded-full mr-2"></div>
                          Carregando...
                        </>
                      ) : (
                        <>
                          Avançar para Permissões
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 2: Gerenciamento de Permissões (Com Seções) */}
        {currentStep === 'permissions' && selectedUser && (
          <div className="space-y-6">
            {/* Card de informações do usuário */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={handleBackToSearch}
                    disabled={loading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                  </Button>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {selectedUser.username}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedUser.name}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleOpenReplicateDialog}
                    disabled={loading || selectedItems.size === 0}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Replicar Acessos
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={loading}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {loading ? 'Salvando...' : 'Salvar Permissões'}
                  </Button>
                </div>
              </div>
            </div>

            {/* Card principal com seções */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 space-y-4">
                <div>
                  <h2 className="text-lg font-semibold">Permissões de Acesso</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Selecione os itens de menu que ficarão disponíveis para este usuário
                  </p>
                </div>

                {/* Busca e contador */}
                <div className="flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar por nome ou descrição..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleToggleAll}
                      disabled={loading || totalItems === 0}
                    />
                    <span className="text-sm font-medium">
                      Marcar todos ({selectedItems.size} de {totalItems} selecionados)
                    </span>
                  </div>
                </div>

                {/* Seções organizadas */}
                <div className="space-y-3">
                  {loading ? (
                    <div className="text-center py-12 text-gray-500">
                      Carregando itens...
                    </div>
                  ) : filteredSections.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      {searchTerm ? 'Nenhum item encontrado' : 'Nenhum item disponível'}
                    </div>
                  ) : (
                    filteredSections.map((section) => {
                      const isExpanded = expandedSections.has(section.code);
                      const sectionItemIds = section.items.map(item => item.id);
                      const selectedCount = sectionItemIds.filter(id => selectedItems.has(id)).length;
                      const allSectionItemsSelected = sectionItemIds.length > 0 && selectedCount === sectionItemIds.length;
                      
                      return (
                        <Card key={section.code} className="overflow-hidden">
                          {/* Section Header */}
                          <div
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-200 dark:border-gray-700"
                            onClick={() => toggleSection(section.code)}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                                <div className="text-blue-600 dark:text-blue-400">
                                  {getIconComponent(section.icon)}
                                </div>
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                  {section.name}
                                  <Badge variant="secondary" className="text-xs">
                                    {section.items.length} {section.items.length === 1 ? 'item' : 'itens'}
                                  </Badge>
                                  {selectedCount > 0 && (
                                    <Badge className="text-xs bg-blue-600 text-white">
                                      {selectedCount} selecionados
                                    </Badge>
                                  )}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {section.description}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={allSectionItemsSelected}
                                onCheckedChange={() => handleToggleSectionItems(section)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div className="text-gray-400 dark:text-gray-500 transition-transform duration-200" style={{
                                transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
                              }}>
                                <ChevronDown className="w-5 h-5" />
                              </div>
                            </div>
                          </div>

                          {/* Section Content */}
                          {isExpanded && (
                            <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {section.items.map((item) => {
                                  const isSelected = selectedItems.has(item.id);
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex items-start gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-colors cursor-pointer"
                                      onClick={() => handleToggleItem(item.id)}
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggleItem(item.id)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="text-blue-600 dark:text-blue-400">
                                            {getIconComponent(item.icon)}
                                          </div>
                                          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                            {item.name}
                                          </h4>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                          {item.description}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialog de Replicação */}
      <Dialog open={showReplicateDialog} onOpenChange={setShowReplicateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Replicar Permissões</DialogTitle>
            <DialogDescription>
              Selecione os usuários que receberão as mesmas permissões de {selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Checkbox
                checked={usersToReplicate.size === availableUsers.length && availableUsers.length > 0}
                onCheckedChange={handleToggleAllReplicateUsers}
              />
              <span className="text-sm font-medium">
                Selecionar todos ({usersToReplicate.size} de {availableUsers.length})
              </span>
            </div>
            
            {availableUsers.map((userItem) => (
              <div
                key={userItem.username}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                onClick={() => handleToggleReplicateUser(userItem.username)}
              >
                <Checkbox
                  checked={usersToReplicate.has(userItem.username)}
                  onCheckedChange={() => handleToggleReplicateUser(userItem.username)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1">
                  <div className="font-medium">{userItem.username}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{userItem.name}</div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReplicateDialog(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleReplicatePermissions} disabled={loading || usersToReplicate.size === 0}>
              <Copy className="w-4 h-4 mr-2" />
              {loading ? 'Replicando...' : `Replicar para ${usersToReplicate.size} usuário(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}