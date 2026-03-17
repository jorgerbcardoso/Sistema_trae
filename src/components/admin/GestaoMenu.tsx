import { useAuth } from '../../contexts/AuthContext';
import { ENVIRONMENT } from '../../config/environment';
import {
  mockGetAllMenu,
  mockCreateSection,
  mockUpdateSection,
  mockDeleteSection,
  mockCreateMenuItem,
  mockUpdateMenuItem,
  mockDeleteMenuItem
} from '../../mocks/mockData';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { 
  Menu, 
  Plus, 
  Edit2, 
  Trash2, 
  FolderOpen, 
  FileText,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Eye,
  EyeOff,
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
  Box,
  Shield
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminLayout } from '../layouts/AdminLayout';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { Badge } from '../ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Switch } from '../ui/switch';
import { IconPicker } from '../ui/icon-picker'; // ✅ NOVO: Seletor visual de ícones

// ================================================================
// TIPOS
// ================================================================

interface MenuSection {
  id: number;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  display_order: number;
  is_active: boolean;
}

interface MenuItem {
  id: number;
  section_id: number;
  code: string;
  name: string;
  description: string | null;
  icon: string;
  route_path: string;
  component_path: string;
  is_available: boolean;
  status: 'active' | 'development' | 'deprecated';
  ordem: number; // ✅ Campo ordem
}

interface MenuWithItems {
  section: MenuSection;
  items: MenuItem[];
}

type FormMode = 'create-section' | 'edit-section' | 'create-item' | 'edit-item' | null;

interface SectionFormData {
  code: string;
  name: string;
  description: string;
  icon: string;
  display_order: number;
  is_active: boolean;
}

interface ItemFormData {
  section_id: number;
  code: string;
  name: string;
  description: string;
  icon: string;
  route_path: string;
  component_path: string;
  is_available: boolean;
  status: 'active' | 'development' | 'deprecated';
  ordem: number; // ✅ Campo ordem
}

// ================================================================
// ÍCONES DISPONÍVEIS (lucide-react)
// ================================================================

const AVAILABLE_ICONS = [
  'BarChart3',
  'TrendingUp',
  'Package',
  'Truck',
  'Route',
  'DollarSign',
  'FolderPlus',
  'FolderOpen',
  'FileText',
  'FileSpreadsheet',
  'Building2',
  'User',
  'UserPlus',
  'Settings',
  'Shield',
  'Calendar',
  'CheckSquare',
  'RefreshCw',
  'Menu'
];

// ================================================================
// COMPONENTE PRINCIPAL
// ================================================================

export function GestaoMenu() {
  const { user } = useAuth();
  const [menuData, setMenuData] = useState<MenuWithItems[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  
  // Dialogs
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'section' | 'item'; id: number; name: string } | null>(null);
  
  // Form Data
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [sectionForm, setSectionForm] = useState<SectionFormData>({
    code: '',
    name: '',
    description: '',
    icon: 'Menu',
    display_order: 1,
    is_active: true
  });
  const [itemForm, setItemForm] = useState<ItemFormData>({
    section_id: 0,
    code: '',
    name: '',
    description: '',
    icon: 'FileText',
    route_path: '',
    component_path: '',
    is_available: true,
    status: 'development',
    ordem: 1 // ✅ Campo ordem
  });

  usePageTitle('Gestão do Menu');

  // ================================================================
  // CARREGAR DADOS
  // ================================================================

  useEffect(() => {
    fetchMenuData();
  }, []);

  const fetchMenuData = async () => {
    setLoading(true);
    try {
      const response = ENVIRONMENT.useMockData
        ? await mockGetAllMenu()
        : await apiFetch('/sistema/api/menu/get_all_menu.php');
      if (response.success) {
        setMenuData(response.data);
        // Expandir todas as seções por padrão
        const allSectionIds = new Set(response.data.map((m: MenuWithItems) => m.section.id));
        setExpandedSections(allSectionIds);
      }
    } catch (error) {
      console.error('Erro ao carregar menu:', error);
    } finally {
      setLoading(false);
    }
  };

  // ================================================================
  // HANDLERS - SEÇÕES
  // ================================================================

  const handleCreateSection = () => {
    const maxOrder = menuData.length > 0 
      ? Math.max(...menuData.map(m => m.section.display_order))
      : 0;
    
    setSectionForm({
      code: '',
      name: '',
      description: '',
      icon: 'Menu',
      display_order: maxOrder + 1,
      is_active: true
    });
    setEditingSectionId(null);
    setFormMode('create-section');
  };

  const handleEditSection = (section: MenuSection) => {
    setSectionForm({
      code: section.code,
      name: section.name,
      description: section.description || '',
      icon: section.icon,
      display_order: section.display_order,
      is_active: section.is_active
    });
    setEditingSectionId(section.id);
    setFormMode('edit-section');
  };

  const handleSaveSection = async () => {
    setLoading(true);
    try {
      const endpoint = editingSectionId 
        ? '/sistema/api/menu/update_section.php'
        : '/sistema/api/menu/create_section.php';
      
      const payload = editingSectionId
        ? { id: editingSectionId, ...sectionForm }
        : sectionForm;

      const response = ENVIRONMENT.useMockData
        ? await (editingSectionId ? mockUpdateSection(payload) : mockCreateSection(payload))
        : await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

      if (response.success) {
        toast.success(editingSectionId ? 'Seção atualizada!' : 'Seção criada!');
        setFormMode(null);
        fetchMenuData();
      }
    } catch (error) {
      console.error('Erro ao salvar seção:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSection = async () => {
    if (!deleteTarget || deleteTarget.type !== 'section') return;
    
    setLoading(true);
    try {
      const response = ENVIRONMENT.useMockData
        ? await mockDeleteSection(deleteTarget.id)
        : await apiFetch('/sistema/api/menu/delete_section.php', {
          method: 'POST',
          body: JSON.stringify({ id: deleteTarget.id })
        });

      if (response.success) {
        toast.success('Seção excluída!');
        setDeleteTarget(null);
        fetchMenuData();
      }
    } catch (error) {
      console.error('Erro ao excluir seção:', error);
    } finally {
      setLoading(false);
    }
  };

  // ================================================================
  // HANDLERS - ITENS
  // ================================================================

  const handleCreateItem = (sectionId: number) => {
    setItemForm({
      section_id: sectionId,
      code: '',
      name: '',
      description: '',
      icon: 'FileText',
      route_path: '',
      component_path: '',
      is_available: true,
      status: 'development',
      ordem: 1 // ✅ Campo ordem
    });
    setEditingItemId(null);
    setFormMode('create-item');
  };

  const handleEditItem = (item: MenuItem) => {
    setItemForm({
      section_id: item.section_id,
      code: item.code,
      name: item.name,
      description: item.description || '',
      icon: item.icon,
      route_path: item.route_path,
      component_path: item.component_path,
      is_available: item.is_available,
      status: item.status,
      ordem: item.ordem // ✅ Campo ordem
    });
    setEditingItemId(item.id);
    setFormMode('edit-item');
  };

  const handleSaveItem = async () => {
    setLoading(true);
    try {
      const endpoint = editingItemId 
        ? '/sistema/api/menu/update_item.php'
        : '/sistema/api/menu/create_item.php';
      
      const payload = editingItemId
        ? { id: editingItemId, ...itemForm }
        : itemForm;

      const response = ENVIRONMENT.useMockData
        ? await (editingItemId ? mockUpdateMenuItem(payload) : mockCreateMenuItem(payload))
        : await apiFetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload)
        });

      if (response.success) {
        toast.success(editingItemId ? 'Item atualizado!' : 'Item criado!');
        setFormMode(null);
        fetchMenuData();
      }
    } catch (error) {
      console.error('Erro ao salvar item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget || deleteTarget.type !== 'item') return;
    
    setLoading(true);
    try {
      const response = ENVIRONMENT.useMockData
        ? await mockDeleteMenuItem(deleteTarget.id)
        : await apiFetch('/sistema/api/menu/delete_item.php', {
          method: 'POST',
          body: JSON.stringify({ id: deleteTarget.id })
        });

      if (response.success) {
        toast.success('Item excluído!');
        setDeleteTarget(null);
        fetchMenuData();
      }
    } catch (error) {
      console.error('Erro ao excluir item:', error);
    } finally {
      setLoading(false);
    }
  };

  // ================================================================
  // ✅ NOVOS HANDLERS - MOVER ITEM PARA CIMA/BAIXO
  // ================================================================

  const handleMoveItemUp = async (item: MenuItem, itemsInSection: MenuItem[]) => {
    // Encontrar item anterior (ordem imediatamente menor)
    const currentIndex = itemsInSection.findIndex(i => i.id === item.id);
    if (currentIndex <= 0) return; // Já está no topo

    const previousItem = itemsInSection[currentIndex - 1];
    
    setLoading(true);
    try {
      // Atualizar item atual com a ordem do item anterior
      const response = await apiFetch('/sistema/api/menu/update_item.php', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          section_id: item.section_id,
          code: item.code,
          name: item.name,
          description: item.description,
          icon: item.icon,
          route_path: item.route_path,
          component_path: item.component_path,
          is_available: item.is_available,
          status: item.status,
          ordem: previousItem.ordem // ✅ Trocar ordem com o anterior
        })
      });

      if (response.success) {
        toast.success('Item movido para cima!');
        fetchMenuData();
      }
    } catch (error) {
      console.error('Erro ao mover item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMoveItemDown = async (item: MenuItem, itemsInSection: MenuItem[]) => {
    // Encontrar próximo item (ordem imediatamente maior)
    const currentIndex = itemsInSection.findIndex(i => i.id === item.id);
    if (currentIndex >= itemsInSection.length - 1) return; // Já está no final

    const nextItem = itemsInSection[currentIndex + 1];
    
    setLoading(true);
    try {
      // Atualizar item atual com a ordem do próximo item
      const response = await apiFetch('/sistema/api/menu/update_item.php', {
        method: 'POST',
        body: JSON.stringify({
          id: item.id,
          section_id: item.section_id,
          code: item.code,
          name: item.name,
          description: item.description,
          icon: item.icon,
          route_path: item.route_path,
          component_path: item.component_path,
          is_available: item.is_available,
          status: item.status,
          ordem: nextItem.ordem // ✅ Trocar ordem com o próximo
        })
      });

      if (response.success) {
        toast.success('Item movido para baixo!');
        fetchMenuData();
      }
    } catch (error) {
      console.error('Erro ao mover item:', error);
    } finally {
      setLoading(false);
    }
  };

  // ================================================================
  // HELPERS
  // ================================================================

  const toggleSection = (sectionId: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      active: { variant: 'default', label: 'ATIVO' },
      development: { variant: 'secondary', label: 'DESENVOLVIMENTO' },
      deprecated: { variant: 'destructive', label: 'DESCONTINUADO' }
    };
    
    const config = variants[status] || variants.active;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // ✅ Função para renderizar ícones dinamicamente
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
      'Menu': <Menu className="w-5 h-5" />,
      'Box': <Box className="w-5 h-5" />,
      'Shield': <Shield className="w-5 h-5" />,
    };
    return icons[iconName] || <Package className="w-5 h-5" />;
  };

  const getIconComponentSmall = (iconName: string) => {
    const icons: Record<string, React.ReactNode> = {
      'TrendingUp': <TrendingUp className="w-4 h-4" />,
      'Package': <Package className="w-4 h-4" />,
      'Truck': <Truck className="w-4 h-4" />,
      'BarChart3': <BarChart3 className="w-4 h-4" />,
      'UserPlus': <UserPlus className="w-4 h-4" />,
      'Settings': <Settings className="w-4 h-4" />,
      'Route': <Route className="w-4 h-4" />,
      'DollarSign': <DollarSign className="w-4 h-4" />,
      'FolderPlus': <FolderPlus className="w-4 h-4" />,
      'Calendar': <Calendar className="w-4 h-4" />,
      'FolderOpen': <FolderOpen className="w-4 h-4" />,
      'FileText': <FileText className="w-4 h-4" />,
      'FileSpreadsheet': <FileSpreadsheet className="w-4 h-4" />,
      'Building2': <Building2 className="w-4 h-4" />,
      'User': <User className="w-4 h-4" />,
      'RefreshCw': <RefreshCw className="w-4 h-4" />,
      'UserCheck': <UserCheck className="w-4 h-4" />,
      'Warehouse': <Warehouse className="w-4 h-4" />,
      'MapPin': <MapPin className="w-4 h-4" />,
      'Tag': <Tag className="w-4 h-4" />,
      'ArrowDownCircle': <ArrowDownCircle className="w-4 h-4" />,
      'ArrowUpCircle': <ArrowUpCircle className="w-4 h-4" />,
      'ClipboardCheck': <ClipboardCheck className="w-4 h-4" />,
      'Calculator': <Calculator className="w-4 h-4" />,
      'CheckSquare': <CheckSquare className="w-4 h-4" />,
      'CheckCircle': <CheckCircle className="w-4 h-4" />,
      'ShoppingBag': <ShoppingBag className="w-4 h-4" />,
      'ShoppingCart': <ShoppingCart className="w-4 h-4" />,
      'Menu': <Menu className="w-4 h-4" />,
      'Box': <Box className="w-4 h-4" />,
      'Shield': <Shield className="w-4 h-4" />,
    };
    return icons[iconName] || <Package className="w-4 h-4" />;
  };

  // ================================================================
  // RENDERIZAÇÃO
  // ================================================================

  return (
    <AdminLayout
      title="Gestão do Menu"
      description={user?.client_name || ''}
    >
      <div className="space-y-6">
        {/* Header com botão criar seção */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-slate-900 dark:text-slate-100">
              Gerenciar Menu do Sistema
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Configure seções e itens do menu principal
            </p>
          </div>
          <Button onClick={handleCreateSection} disabled={loading}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Seção
          </Button>
        </div>

        {/* Lista de Seções e Itens */}
        {loading && menuData.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-slate-500">
                Carregando...
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {menuData.map((menu) => {
              const isExpanded = expandedSections.has(menu.section.id);
              
              return (
                <Card key={menu.section.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSection(menu.section.id)}
                          className="h-8 w-8 p-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                        
                        <GripVertical className="w-4 h-4 text-slate-400" />
                        
                        <div className="text-blue-600 dark:text-blue-400">
                          {getIconComponent(menu.section.icon)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-base">
                              {menu.section.name}
                            </CardTitle>
                            <Badge variant="outline" className="text-xs">
                              {menu.section.code}
                            </Badge>
                            {!menu.section.is_active && (
                              <Badge variant="destructive">INATIVO</Badge>
                            )}
                          </div>
                          {menu.section.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              {menu.section.description}
                            </p>
                          )}
                          <p className="text-xs text-slate-400 mt-1">
                            Ordem: {menu.section.display_order} • Ícone: {menu.section.icon} • {menu.items.length} itens
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCreateItem(menu.section.id)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Novo Item
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditSection(menu.section)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget({
                            type: 'section',
                            id: menu.section.id,
                            name: menu.section.name
                          })}
                          disabled={menu.items.length > 0}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && menu.items.length > 0 && (
                    <CardContent className="pt-0">
                      <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-700 ml-6 pl-4">
                        {(() => {
                          const sortedItems = menu.items.sort((a, b) => a.ordem - b.ordem);
                          return sortedItems.map((item, index) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {/* ✅ SETAS PARA CIMA/BAIXO */}
                              <div className="flex flex-col gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                                  onClick={() => handleMoveItemUp(item, sortedItems)}
                                  disabled={loading || index === 0}
                                  title="Mover para cima"
                                >
                                  <ArrowUpCircle className={`w-4 h-4 ${index === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-blue-600 dark:text-blue-400'}`} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                                  onClick={() => handleMoveItemDown(item, sortedItems)}
                                  disabled={loading || index === sortedItems.length - 1}
                                  title="Mover para baixo"
                                >
                                  <ArrowDownCircle className={`w-4 h-4 ${index === sortedItems.length - 1 ? 'text-slate-300 dark:text-slate-600' : 'text-blue-600 dark:text-blue-400'}`} />
                                </Button>
                              </div>

                              <Badge variant="outline" className="text-xs font-mono w-8 justify-center">
                                {item.ordem}
                              </Badge>
                              <GripVertical className="w-4 h-4 text-slate-300" />
                              <div className="text-slate-600 dark:text-slate-400">
                                {getIconComponentSmall(item.icon)}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
                                    {item.name}
                                  </span>
                                  <Badge variant="outline" className="text-xs">
                                    {item.code}
                                  </Badge>
                                  {getStatusBadge(item.status)}
                                  {item.is_available ? (
                                    <Eye className="w-3 h-3 text-green-600" />
                                  ) : (
                                    <EyeOff className="w-3 h-3 text-slate-400" />
                                  )}
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  {item.route_path}
                                </p>
                                <p className="text-xs text-slate-400">
                                  Componente: {item.component_path} • Ícone: {item.icon}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditItem(item)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteTarget({
                                  type: 'item',
                                  id: item.id,
                                  name: item.name
                                })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ));
                        })()}
                      </div>
                    </CardContent>
                  )}

                  {isExpanded && menu.items.length === 0 && (
                    <CardContent className="pt-0">
                      <div className="text-center py-8 text-slate-500 text-sm">
                        Nenhum item nesta seção
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Dialog: Criar/Editar Seção */}
        <Dialog open={formMode === 'create-section' || formMode === 'edit-section'} onOpenChange={() => setFormMode(null)}>
          <DialogContent className="max-w-2xl dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="dark:text-slate-100">
                {formMode === 'create-section' ? 'Nova Seção' : 'Editar Seção'}
              </DialogTitle>
              <DialogDescription className="dark:text-slate-400">
                Configure os dados da seção do menu
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Código *</Label>
                  <Input
                    value={sectionForm.code}
                    onChange={(e) => setSectionForm({ ...sectionForm, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: DASHBOARDS"
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Nome *</Label>
                  <Input
                    value={sectionForm.name}
                    onChange={(e) => setSectionForm({ ...sectionForm, name: e.target.value.toUpperCase() })}
                    placeholder="Ex: DASHBOARDS"
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-200">Descrição</Label>
                <Textarea
                  value={sectionForm.description}
                  onChange={(e) => setSectionForm({ ...sectionForm, description: e.target.value.toUpperCase() })}
                  placeholder="Ex: PAINÉIS ANALÍTICOS E INDICADORES"
                  className="dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <IconPicker
                    label="Ícone *"
                    value={sectionForm.icon}
                    onChange={(value) => setSectionForm({ ...sectionForm, icon: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Ordem de Exibição *</Label>
                  <Input
                    type="number"
                    value={sectionForm.display_order}
                    onChange={(e) => setSectionForm({ ...sectionForm, display_order: parseInt(e.target.value) })}
                    min={1}
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={sectionForm.is_active}
                  onCheckedChange={(checked) => setSectionForm({ ...sectionForm, is_active: checked })}
                />
                <Label className="dark:text-slate-200">Seção Ativa</Label>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormMode(null)} className="dark:border-slate-600">
                Cancelar
              </Button>
              <Button onClick={handleSaveSection} disabled={loading || !sectionForm.code || !sectionForm.name}>
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Criar/Editar Item */}
        <Dialog open={formMode === 'create-item' || formMode === 'edit-item'} onOpenChange={() => setFormMode(null)}>
          <DialogContent className="max-w-2xl dark:bg-slate-900">
            <DialogHeader>
              <DialogTitle className="dark:text-slate-100">
                {formMode === 'create-item' ? 'Novo Item' : 'Editar Item'}
              </DialogTitle>
              <DialogDescription className="dark:text-slate-400">
                Configure os dados do item do menu
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Código *</Label>
                  <Input
                    value={itemForm.code}
                    onChange={(e) => setItemForm({ ...itemForm, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="Ex: dashboard_dre"
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Nome *</Label>
                  <Input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value.toUpperCase() })}
                    placeholder="Ex: DASHBOARD FINANCEIRO"
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="dark:text-slate-200">Descrição</Label>
                <Textarea
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value.toUpperCase() })}
                  placeholder="Ex: DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO"
                  className="dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Rota *</Label>
                  <Input
                    value={itemForm.route_path}
                    onChange={(e) => setItemForm({ ...itemForm, route_path: e.target.value.toLowerCase() })}
                    placeholder="Ex: /dashboards/dre"
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Componente *</Label>
                  <Input
                    value={itemForm.component_path}
                    onChange={(e) => setItemForm({ ...itemForm, component_path: e.target.value })}
                    placeholder="Ex: dashboards/FinanceiroDashboard"
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <IconPicker
                    label="Ícone *"
                    value={itemForm.icon}
                    onChange={(value) => setItemForm({ ...itemForm, icon: value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Status *</Label>
                  <Select
                    value={itemForm.status}
                    onValueChange={(value: any) => setItemForm({ ...itemForm, status: value })}
                  >
                    <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="development">Desenvolvimento</SelectItem>
                      <SelectItem value="deprecated">Descontinuado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="dark:text-slate-200">Ordem na Seção *</Label>
                  <Input
                    type="number"
                    value={itemForm.ordem}
                    onChange={(e) => {
                      const val = e.target.value;
                      setItemForm({ ...itemForm, ordem: val === '' ? 1 : parseInt(val) || 1 });
                    }}
                    min={1}
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define a posição do item dentro da seção
                  </p>
                </div>
                <div className="flex items-center space-x-2 mt-6">
                  <Switch
                    checked={itemForm.is_available}
                    onCheckedChange={(checked) => setItemForm({ ...itemForm, is_available: checked })}
                  />
                  <Label className="dark:text-slate-200">Item Disponível</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setFormMode(null)} className="dark:border-slate-600">
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveItem} 
                disabled={loading || !itemForm.code || !itemForm.name || !itemForm.route_path || !itemForm.component_path}
              >
                {loading ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Confirmar Exclusão */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent className="dark:bg-slate-900">
            <AlertDialogHeader>
              <AlertDialogTitle className="dark:text-slate-100">
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription className="dark:text-slate-400">
                Tem certeza que deseja excluir {deleteTarget?.type === 'section' ? 'a seção' : 'o item'} "{deleteTarget?.name}"?
                {deleteTarget?.type === 'section' && ' A seção deve estar vazia para ser excluída.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="dark:border-slate-600">Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={deleteTarget?.type === 'section' ? handleDeleteSection : handleDeleteItem}
                className="bg-red-600 hover:bg-red-700"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}

export default GestaoMenu;