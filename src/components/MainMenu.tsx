import React, { useState, useEffect } from 'react';
import { 
  Home, 
  LogOut, 
  Settings, 
  Shield,
  TrendingUp,
  Package,
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
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { ENVIRONMENT } from '../config/environment';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { toast } from 'sonner';
import { getMenu } from '../services/menuService';
import { MenuSection, MenuItem } from '../types/menu';
import { usePageTitle } from '../hooks/usePageTitle';
import { getLogoUrl, shouldShowSystemName } from '../config/clientLogos';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useNavigate } from 'react-router';
import { UserProfileDropdown } from './UserProfileDropdown';
import { mockGetMenu } from '../mocks/mockData';
import { useTheme } from './ThemeProvider';
import { Badge } from './ui/badge';
import { FilterSelectUnidadeSingle } from './cadastros/FilterSelectUnidadeSingle';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Label } from './ui/label';

export function MainMenu() {
  const { user, logout, changeUnidade } = useAuth();
  const navigate = useNavigate();
  const [menuSections, setMenuSections] = useState<MenuSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [showUnidadeSelector, setShowUnidadeSelector] = useState(false);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  
  // ✅ NOVO: Controle de seções expandidas com localStorage
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('menu_expanded_sections');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Atualizar título da página dinamicamente
  usePageTitle('Menu Principal');

  // ✅ NOVO: Restaurar posição do scroll quando o componente montar
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem('menu_scroll_position');
    if (savedScrollPosition) {
      setTimeout(() => {
        window.scrollTo(0, parseInt(savedScrollPosition, 10));
      }, 100);
    }

    // Salvar posição do scroll antes de desmontar
    return () => {
      sessionStorage.setItem('menu_scroll_position', window.scrollY.toString());
    };
  }, []);

  // ✅ NOVO: Salvar estado das seções expandidas no localStorage sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem('menu_expanded_sections', JSON.stringify(Array.from(expandedSections)));
    } catch (error) {
      console.error('Erro ao salvar estado do menu:', error);
    }
  }, [expandedSections]);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        // ✅ Respeitar use_mock_data do usuário
        const useMock = user?.use_mock_data ?? true;
        
        let result;
        
        if (ENVIRONMENT.useMockData || ENVIRONMENT.isFigmaMake) {
          // Usar dados mockados diretamente
          result = await getMenu(user?.domain || 'VCS', user?.username, user?.is_admin);
        } else {
          // Tentar backend real, com fallback para mock
          try {
            result = await getMenu(user?.domain || 'VCS', user?.username, user?.is_admin);
          } catch (backendError) {
            result = await mockGetMenu(user?.domain || 'VCS', user?.username);
          }
        }
        
        if (result.success && result.menu.sections) {
          // Converter formato do mockData para o formato esperado pelo MainMenu
          const convertedMenu = result.menu.sections.map((section: any) => ({
            section: {
              id: section.id,
              code: section.code,
              name: section.name,
              description: section.description || '',
              icon: section.icon,
              display_order: section.display_order,
              is_active: true
            },
            items: section.items.map((item: any) => {
              return {
                id: item.id,
                code: item.code,
                name: item.name,
                description: item.description || '',
                icon: item.icon,
                route_path: item.route_path,
                display_order: item.display_order,
                is_active: true,
                is_available: item.is_available,
                status: item.status,
                status_message: item.status_message || null,
                ordem: item.ordem || 999 // ✅ NOVO: Ordem do item dentro da seção
              };
            }).sort((a: any, b: any) => a.ordem - b.ordem) // ✅ Ordenar itens pela coluna ordem
          }));
          
          setMenuSections(convertedMenu);
        } else {
          setMenuSections(getFallbackMenu());
        }
        
        setIsLoading(false);
      } catch (error) {
        setMenuSections(getFallbackMenu());
        setIsLoading(false);
      }
    };
    
    loadMenu();
  }, [user]);

  const fetchMenu = async () => {
    try {
      // No Figma Make, não buscar menu do backend
      if (ENVIRONMENT.isFigmaMake) {
        return;
      }
      
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/sistema/api/menu/get_with_permissions.php', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setMenuSections(data.menu);
      } else {
        setMenuSections(getFallbackMenu());
      }
    } catch (error) {
      // Usar menu de fallback em caso de erro
      setMenuSections(getFallbackMenu());
    } finally {
      setIsLoading(false);
    }
  };

  const getFallbackMenu = (): MenuSection[] => {
    return [
      {
        section: {
          id: 1,
          code: 'FINANCEIRO',
          name: 'Gestão Financeira',
          description: 'Módulos de gestão financeira',
          icon: 'TrendingUp',
          display_order: 1,
          is_active: true
        },
        items: [
          {
            id: 1,
            code: 'DASHBOARD',
            name: 'Dashboard Financeiro',
            description: 'Visão geral dos dados financeiros',
            icon: 'BarChart3',
            route_path: '/financeiro/dashboard',
            display_order: 1,
            is_active: true,
            is_available: true,
            status: 'released'
          },
          {
            id: 2,
            code: 'LINHAS',
            name: 'Resultado das Linhas',
            description: 'Resultado operacional por linha de transporte',
            icon: 'Route',
            route_path: '/dashboards/linhas',
            display_order: 2,
            is_active: true,
            is_available: true,
            status: 'released'
          }
        ]
      },
      {
        section: {
          id: 2,
          code: 'CADASTROS',
          name: 'Cadastros',
          description: 'Gerenciamento de cadastros',
          icon: 'Package',
          display_order: 2,
          is_active: true
        },
        items: [
          {
            id: 2,
            code: 'USERS',
            name: 'Gestão de Usuários',
            description: 'Gerenciamento de usuários do sistema',
            icon: 'UserPlus',
            route_path: '/cadastros/usuarios',
            display_order: 1,
            is_active: true,
            is_available: true,
            status: 'released'
          },
          {
            id: 3,
            code: 'GRUPOS_EVENTOS',
            name: 'Grupos de Eventos',
            description: 'Gerenciamento de grupos de eventos',
            icon: 'FolderOpen',
            route_path: '/cadastros/grupos-eventos',
            display_order: 2,
            is_active: true,
            is_available: true,
            status: 'released'
          },
          {
            id: 4,
            code: 'CADASTRO_LINHAS',
            name: 'Cadastro de Linhas',
            description: 'Gerenciamento de linhas de transporte',
            icon: 'Route',
            route_path: '/cadastros/linhas',
            display_order: 3,
            is_active: true,
            is_available: true,
            status: 'released'
          },
          {
            id: 19,
            code: 'VENDEDORES',
            name: 'CADASTRO DE VENDEDORES',
            description: 'Importação dos vendedores e definição de setores',
            icon: 'UserCheck',
            route_path: '/cadastros/vendedores',
            display_order: 4,
            is_active: true,
            is_available: true,
            status: 'released'
          }
        ]
      }
    ];
  };

  const handleLogout = async () => {
    try {
      // 🔥 CRÍTICO: Salvar domínio ANTES de chamar logout() porque logout() limpa o user
      const userDomain = user?.domain;
      
      // Limpar sessionStorage
      sessionStorage.clear();
      
      // Executar logout (limpa user, token, etc)
      await logout();
      
      // Verificar se é domínio Aceville para redirecionar corretamente
      const isAceville = userDomain === 'ACV';
      const loginPath = isAceville ? '/login-aceville' : '/login';
      
      // Usar navigate ao invés de window.location para manter o controle do React Router
      navigate(loginPath, { replace: true });
    } catch (error) {
      // Mesmo com erro, forçar navegação para login
      // Tentar recuperar do localStorage antes de redirecionar
      const storedDomain = localStorage.getItem('presto_domain');
      const isAceville = storedDomain === 'ACV';
      const loginPath = isAceville ? '/login-aceville' : '/login';
      navigate(loginPath, { replace: true });
    }
  };

  const handleMenuClick = (item: MenuItem) => {
    if (!item.is_available) {
      toast.warning(item.status_message || 'Funcionalidade em Desenvolvimento', {
        description: 'Esta funcionalidade estará disponível em breve.'
      });
      return;
    }
    
    navigate(item.route_path);
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
      'ChevronDown': <ChevronDown className="w-5 h-5" />,
      'ChevronRight': <ChevronRight className="w-5 h-5" />
    };
    return icons[iconName] || <Package className="w-5 h-5" />;
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // ✅ NOVO: Handler para trocar unidade
  const handleChangeUnidade = () => {
    if (selectedUnidade && selectedUnidade !== user?.unidade_atual) {
      changeUnidade(selectedUnidade);
      toast.success('Unidade alterada com sucesso!', {
        description: `Você está operando agora na unidade ${selectedUnidade}`
      });
      setShowUnidadeSelector(false);
    }
  };

  // ✅ Calcular unidades permitidas (incluir unidade padrão)
  const allowedUnidadesArray = (() => {
    // Se não tem unidades permitidas definidas, retorna undefined (todas permitidas)
    if (!user?.unidades || user.unidades.trim() === '') {
      return undefined;
    }
    
    // Se tem unidades permitidas, adicionar a unidade padrão
    const permitidas = user.unidades.split(',').map(u => u.trim());
    const unidadePadrao = user.unidade?.trim();
    
    // Combinar e remover duplicatas (a unidade padrão SEMPRE deve estar disponível)
    const todas = unidadePadrao 
      ? Array.from(new Set([unidadePadrao, ...permitidas]))
      : permitidas;
    
    return todas;
  })();

  // ✅ NOVO: Toggle de expansão de seção
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

  const { theme } = useTheme();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-400">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header Moderno com Glassmorphism */}
      <header className="bg-card border-b border-border shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg blur-sm opacity-50 animate-pulse"></div>
              <ImageWithFallback
                key={theme}
                src={getLogoUrl(user?.domain, theme)}
                alt="Logo"
                className="relative h-10 w-10 object-contain p-1 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Nome do Sistema e Cliente - Condicional baseado no domínio */}
            <div className="flex-1 min-w-0">
              {shouldShowSystemName(user?.domain) ? (
                <>
                  <h1 className="text-slate-100 header-title-main truncate">
                    {user?.client_name || 'VIAÇÃO CRUZEIRO DO SUL'}
                  </h1>
                  <p className="text-slate-400 header-subtitle-main hidden md:block truncate">
                    Sistema de Gestão
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-slate-100 header-title-main truncate">
                    {user?.client_name || 'Sistema de Gestão'}
                  </h1>
                  <p className="text-slate-400 header-subtitle-main hidden md:block truncate">
                    Sistema de Gestão
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* ✅ NOVO: Botão para Trocar Unidade - APENAS no Menu Principal */}
            {user?.unidade_atual && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUnidadeSelector(true)}
                className="border-slate-600 hover:bg-slate-800 hidden md:flex hover:shadow-md transition-all hover:scale-105 header-title-main lowercase first-letter:uppercase"
                disabled={!user?.troca_unidade}
              >
                <Building2 className="w-4 h-4 mr-2" />
                <span className="header-title-main">{user.unidade_atual}</span>
                {user.troca_unidade && <RefreshCw className="w-3 h-3 ml-2" />}
              </Button>
            )}
            
            {/* Botão Tema REMOVIDO */}
            <div className="relative">
              <div
                className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
              >
                <Avatar className="h-9 w-9 ring-2 ring-blue-500/20 ring-offset-2 dark:ring-offset-slate-900 transition-all hover:ring-blue-500/50">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs font-bold">
                    {getInitials(user?.full_name || user?.username || 'U')}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block">
                  <p className="header-title-main text-slate-900 dark:text-slate-100">
                    {user?.full_name || user?.username}
                  </p>
                  <p className="header-subtitle-main text-slate-500 dark:text-slate-400">
                    {user?.email}
                  </p>
                </div>
              </div>
              <UserProfileDropdown
                isOpen={isProfileDropdownOpen}
                onClose={() => setIsProfileDropdownOpen(false)}
                userName={user?.full_name || user?.username || ''}
                userEmail={user?.email || ''}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="dark:border-slate-600 dark:hover:bg-slate-800 hover:shadow-md transition-all hover:scale-105 hover:border-red-300 hover:text-red-600 dark:hover:border-red-700 dark:hover:text-red-400"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Header com Gradiente */}
        <div className="mb-8">
          <div className="relative p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 dark:from-blue-500/20 dark:via-purple-500/20 dark:to-pink-500/20 border border-slate-200/50 dark:border-slate-700/50 backdrop-blur-sm">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-5 dark:opacity-10"></div>
            <div className="relative">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 dark:from-blue-400 dark:via-purple-400 dark:to-pink-400 bg-clip-text text-transparent mb-2">
                Bem-vindo(a), {user?.full_name?.split(' ')[0] || user?.username}!
              </h2>
              <p className="text-slate-600 dark:text-slate-400 font-medium">
                Selecione um módulo para começar
              </p>
            </div>
          </div>
        </div>

        {/* Menu Sections */}
        <div className="space-y-4">
          {menuSections.map((section) => {
            const isExpanded = expandedSections.has(section.section.code);
            const itemCount = section.items.length;
            const availableCount = section.items.filter(i => i.is_available).length;
            
            return (
              <Card 
                key={section.section.code} 
                className="overflow-hidden border-border shadow-lg hover:shadow-xl transition-all duration-300 bg-card/80 backdrop-blur-sm"
              >
                {/* Section Header - Clickable com visual melhorado */}
                <div
                  className="flex items-center justify-between p-5 cursor-pointer hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 dark:hover:from-blue-950/30 dark:hover:to-purple-950/30 transition-all duration-200 group"
                  onClick={() => toggleSection(section.section.code)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="relative">
                      <div className={`absolute inset-0 rounded-xl blur-md transition-opacity duration-200 ${
                        isExpanded 
                          ? 'opacity-30 bg-gradient-to-br from-blue-400 to-purple-500' 
                          : 'opacity-0'
                      }`}></div>
                      <div className={`relative p-3 rounded-xl transition-all duration-200 ${
                        isExpanded
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg scale-110'
                          : 'bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 group-hover:scale-105'
                      }`}>
                        <div className={`transition-colors ${
                          isExpanded 
                            ? 'text-white' 
                            : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {getIconComponent(section.section.icon)}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
                        {section.section.name}
                        <Badge 
                          variant="secondary" 
                          className="text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        >
                          {itemCount} {itemCount === 1 ? 'item' : 'itens'}
                        </Badge>
                        {availableCount < itemCount && (
                          <Badge 
                            variant="outline" 
                            className="text-xs font-semibold text-amber-600 dark:text-amber-400 border-amber-500 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30"
                          >
                            {availableCount} disponíveis
                          </Badge>
                        )}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                        {section.section.description}
                      </p>
                    </div>
                  </div>
                  <div 
                    className={`text-slate-400 dark:text-slate-500 transition-all duration-300 ${
                      isExpanded ? 'rotate-0 text-blue-600 dark:text-blue-400' : 'rotate-[-90deg]'
                    }`}
                  >
                    <ChevronDown className="w-6 h-6" />
                  </div>
                </div>

                {/* Section Content - Collapsible com animação melhorada */}
                <div
                  className="transition-all duration-300 ease-in-out overflow-hidden"
                  style={{
                    maxHeight: isExpanded ? `${section.items.length * 200}px` : '0px',
                    opacity: isExpanded ? 1 : 0
                  }}
                >
                  <div className="p-5 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-b from-slate-50/30 to-transparent dark:from-slate-950/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                      {section.items.map((item) => {
                        return (
                          <Card
                            key={item.code}
                            className={`relative overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border-slate-200/50 dark:border-slate-700/50 hover:-translate-y-1 ${
                              !item.is_available ? 'opacity-60' : 'hover:border-blue-300 dark:hover:border-blue-700'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMenuClick(item);
                            }}
                          >
                            {/* Gradiente de fundo no hover */}
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950/30 dark:via-purple-950/30 dark:to-pink-950/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                            
                            <CardHeader className="relative p-4 pb-3">
                              <div className="flex items-center gap-3 mb-3">
                                <div className={`relative p-2 rounded-lg transition-all duration-200 ${
                                  item.is_available 
                                    ? 'bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 group-hover:from-blue-200 group-hover:to-purple-200 dark:group-hover:from-blue-800/50 dark:group-hover:to-purple-800/50 group-hover:scale-110' 
                                    : 'bg-slate-100 dark:bg-slate-800'
                                }`}>
                                  <div className={`${
                                    item.is_available 
                                      ? 'text-blue-600 dark:text-blue-400' 
                                      : 'text-slate-400'
                                  }`}>
                                    {getIconComponent(item.icon)}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-sm font-bold leading-tight text-slate-900 dark:text-slate-100">
                                    {item.name}
                                  </CardTitle>
                                </div>
                              </div>
                              <CardDescription className="text-xs line-clamp-2 font-medium text-slate-600 dark:text-slate-400">
                                {item.description}
                              </CardDescription>
                            </CardHeader>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          {menuSections.length === 0 && (
            <Card className="text-center py-12">
              <CardContent>
                <Package className="h-16 w-16 mx-auto text-slate-400 mb-4" />
                <h3 className="text-xl text-slate-900 dark:text-slate-100 mb-2">
                  Nenhum menu disponível
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Entre em contato com o administrador
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      {/* ✅ NOVO: Dialog de Troca de Unidade */}
      <Dialog open={showUnidadeSelector} onOpenChange={setShowUnidadeSelector}>
        <DialogContent className="dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100">Trocar Unidade</DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              Selecione a unidade que deseja operar
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Unidade Atual</Label>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  {user?.unidade_atual || 'Nenhuma'}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="dark:text-slate-200">Nova Unidade</Label>
              <FilterSelectUnidadeSingle
                value={selectedUnidade}
                onChange={setSelectedUnidade}
                allowedUnidades={allowedUnidadesArray}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowUnidadeSelector(false)}
              className="dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleChangeUnidade}
              disabled={!selectedUnidade || selectedUnidade === user?.unidade_atual}
              variant="default"
            >
              Confirmar Troca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}