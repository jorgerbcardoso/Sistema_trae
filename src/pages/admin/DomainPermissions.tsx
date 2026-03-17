import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { useNavigate, useSearchParams } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { 
  Shield, 
  ArrowLeft, 
  X, 
  Save, 
  Search, 
  ChevronDown,
  ChevronRight,
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
  Box
} from 'lucide-react';
import { toast } from 'sonner';
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

// ✅ Mock Data organizado por seções
const getMockMenuBySection = async (domain: string): Promise<MenuSection[]> => {
  // ✅ Não passar username - vamos buscar TODOS os itens disponíveis para o domínio
  const menuData = await mockGetMenu(domain);
  
  if (!menuData.success || !menuData.menu?.sections) {
    return [];
  }
  
  // ✅ Converter a estrutura do mock para o formato esperado e ORDENAR os itens
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

const MOCK_DOMAIN_PERMISSIONS: Record<string, number[]> = {
  'ACV': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  'XXX': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
  'VCS': [1, 2, 3, 4, 5, 6],
  'DMN': [1, 3, 5, 6],
};

export default function DomainPermissions() {
  const [searchParams] = useSearchParams();
  const domain = searchParams.get('domain');
  const navigate = useNavigate();
  
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (domain) {
      fetchMenuItems();
      fetchDomainPermissions();
    }
  }, [domain]);

  const fetchMenuItems = async () => {
    setLoading(true);
    try {
      // ✅ Se estiver no Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
        await new Promise(resolve => setTimeout(resolve, 300)); // Simular delay
        const menuBySection = await getMockMenuBySection(domain!);
        setMenuSections(menuBySection);
        // Expandir todas as seções por padrão
        setExpandedSections(new Set(menuBySection.map(s => s.code)));
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
        setMenuSections(data.sections || []);
        setExpandedSections(new Set((data.sections || []).map((s: MenuSection) => s.code)));
      } else {
        toast.error(data.message || 'Erro ao buscar itens de menu');
      }
    } catch (error: any) {
      console.error('Erro ao buscar itens de menu:', error);
      // ✅ Fallback para dados mock em caso de erro
      console.warn('⚠️ Usando dados MOCK como fallback');
      const menuBySection = await getMockMenuBySection(domain!);
      setMenuSections(menuBySection);
      setExpandedSections(new Set(menuBySection.map(s => s.code)));
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
        navigate('/admin/dominios');
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
        navigate('/admin/dominios');
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

  // ✅ Se não houver domínio, mostrar mensagem de erro
  if (!domain) {
    return (
      <AdminLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <Shield className="w-16 h-16 text-gray-400" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Domínio não especificado</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Nenhum domínio foi informado para gerenciar permissões.
          </p>
          <Button onClick={() => navigate('/admin/dominios')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Gestão de Domínios
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/dominios')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div>
              <h1 className="flex items-center gap-2">
                <Shield className="w-6 h-6" />
                Gerenciar Permissões: {domain}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Selecione os itens de menu que ficarão disponíveis para este domínio
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/admin/dominios')}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
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

        {/* Card principal */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 space-y-4">
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
    </AdminLayout>
  );
}