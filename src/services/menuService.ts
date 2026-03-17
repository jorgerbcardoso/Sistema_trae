import { ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';
import { MOCK_MENU_XXX, MOCK_MENU_VCS } from '../mocks/mockData';

function getAuthToken(): string | null {
  return localStorage.getItem('auth_token');
}

/**
 * 🎯 GET MENU - Busca menu do usuário
 * 
 * - No servidor: Busca do banco (menu_items + domain_menu_items + user_permissions)
 * - No Figma Make: Usa dados mock
 * 
 * O menu é filtrado baseado nas permissões do usuário no banco de dados.
 */
export async function getMenu(domain: string, username?: string, isAdmin?: boolean): Promise<any> {
  // ✅ Se estiver no Figma Make ou useMockData, usar mock
  if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
    return getMenuMock(domain, username, isAdmin);
  }

  // ✅ SERVIDOR: Buscar menu real do banco de dados
  try {
    const token = getAuthToken();
    if (!token) {
      throw new Error('Token não encontrado');
    }

    const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/menu/get_user_menu.php`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (data.success) {
      // ✅ Converter formato da API para formato esperado pelo MainMenu
      const convertedSections = data.sections.map((section: any) => ({
        id: section.id,
        code: section.code,
        name: section.name,
        description: section.description,
        icon: section.icon,
        display_order: section.order,
        items: section.items.map((item: any) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          description: item.description,
          icon: item.icon,
          route_path: item.route,
          component_path: item.component, // ✅ CORRIGIDO: estava faltando!
          display_order: 1, // Não temos ordem nos itens ainda
          is_available: true,
          status: item.status
        }))
      }));

      return {
        success: true,
        use_mock: false,
        menu: {
          sections: convertedSections
        }
      };
    }

    // Se API retornou erro, usar mock
    return getMenuMock(domain, username, isAdmin);

  } catch (error) {
    console.error('❌ Erro ao buscar menu do servidor:', error);
    // Fallback para mock
    return getMenuMock(domain, username, isAdmin);
  }
}

/**
 * 🎯 GET MENU MOCK - Retorna menu mockado filtrado por permissões
 * 
 * Usado no Figma Make ou como fallback em caso de erro
 */
function getMenuMock(domain: string, username?: string, isAdmin?: boolean): any {
  // 🔥 REGRA ESPECIAL: Usuário "presto" SEMPRE é admin (independente do campo no banco)
  if (username?.toLowerCase() === 'presto') {
    isAdmin = true;
  }
  
  // Determinar qual menu base usar
  let baseMenu;
  if (domain === 'XXX') {
    baseMenu = JSON.parse(JSON.stringify(MOCK_MENU_XXX)); // Deep clone
  } else {
    baseMenu = JSON.parse(JSON.stringify(MOCK_MENU_VCS)); // Deep clone
  }
  
  // 🔒 FILTRAR SEÇÃO DE ADMINISTRAÇÃO POR PERMISSÕES
  const filteredSections = baseMenu.sections.map((section: any) => {
    if (section.code === 'admin') {
      const filteredItems = section.items.filter((item: any) => {
        const itemCode = item.code;
        
        // GESTÃO DE DOMÍNIOS: Apenas XXX + presto
        if (itemCode === 'admin_dominios') {
          const canView = domain === 'XXX' && username?.toLowerCase() === 'presto';
          return canView;
        }
        
        // GESTÃO DE PERMISSÕES: Apenas admins
        if (itemCode === 'admin_permissoes') {
          const canView = isAdmin === true;
          return canView;
        }
        
        // GESTÃO DE USUÁRIOS: Apenas admins
        if (itemCode === 'admin_usuarios') {
          const canView = isAdmin === true;
          return canView;
        }
        
        // Outros itens: permitir
        return true;
      });
      
      // Se não sobrou nenhum item, remover a seção inteira
      if (filteredItems.length === 0) {
        return null;
      }
      
      return {
        ...section,
        items: filteredItems
      };
    }
    
    return section;
  }).filter(Boolean); // Remove seções null
  
  return {
    success: true,
    use_mock: true,
    menu: {
      sections: filteredSections
    }
  };
}