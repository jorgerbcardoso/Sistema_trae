import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import { Routes, Route, Link } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL, ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';
import { getComponent } from './ComponentRegistry';
import { getMenu } from '../services/menuService';
import DomainPermissions from '../pages/admin/DomainPermissions';
import GestaoDominios from './admin/GestaoDominios';
import { GestaoMenu } from './admin/GestaoMenu';

/**
 * ROTEADOR DINÂMICO
 * 
 * Carrega componentes dinamicamente baseado no component_path do banco de dados
 * Em DEV/MOCK: Usa dados mockados
 * Em PRODUCTION: Usa API real
 */

// ============================================
// COMPONENTE DE LOADING
// ============================================

const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
      <p className="text-gray-600">CARREGANDO...</p>
    </div>
  </div>
);

// ============================================
// WRAPPER PARA ROTAS PROTEGIDAS
// ============================================

interface ProtectedComponentProps {
  componentPath: string;
  permissions?: {
    can_access: boolean;
    can_create?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
    can_export?: boolean;
  };
}

const ProtectedComponent: React.FC<ProtectedComponentProps> = ({ 
  componentPath, 
  permissions 
}) => {
  // Verificar se tem permissão de acesso
  if (permissions && !permissions.can_access) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">ACESSO NEGADO</h2>
          <p className="text-gray-600">Você não tem permissão para acessar esta funcionalidade.</p>
        </div>
      </div>
    );
  }

  // Buscar componente no registro
  const Component = getComponent(componentPath);

  return (
    <Suspense fallback={<PageLoader />}>
      <Component permissions={permissions} />
    </Suspense>
  );
};

// ============================================
// INTERFACES
// ============================================

export interface MenuItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  icon: string;
  route_path: string;
  component_path: string;
  is_available: boolean;
  status: string;
  permissions?: {
    can_access: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
    can_export: boolean;
  };
}

export interface MenuSection {
  code: string;
  name: string;
  icon: string;
  items: MenuItem[];
}

// ============================================
// COMPONENTE PRINCIPAL DO ROTEADOR
// ============================================

export const DynamicRouter: React.FC = () => {
  const { user, token } = useAuth();
  const [menuData, setMenuData] = useState<MenuSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMenu = async () => {
      if (!user) {
        return;
      }

      try {
        // ✅ SEMPRE usar getMenu (que filtra por permissões)
        // Nunca usar mockGetMenu porque ele não filtra!
        const result = await getMenu(user.domain, user.username, user.is_admin);
        
        if (result.success) {
          setMenuData(result.menu.sections);
        }
      } catch (error) {
        // Silenciar erro
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [user, token]);

  if (loading) {
    return <PageLoader />;
  }

  // ✅ CONSTRUIR ARRAY DE ROTAS DE FORMA SEGURA
  const dynamicRoutes: React.ReactElement[] = [];
  
  menuData.forEach((section) => {
    section.items.forEach((item) => {
      // Validar item
      if (!item || !item.route_path || !item.component_path) {
        console.warn('⚠️ [DynamicRouter] Item inválido ignorado:', item);
        return; // Skip itens inválidos
      }
      
      // Remover barra inicial porque estamos dentro de um Route wildcard
      const routePath = item.route_path.startsWith('/') 
        ? item.route_path.slice(1) 
        : item.route_path;
      
      const route = (
        <Route
          key={item.id}
          path={routePath}
          element={
            <ProtectedComponent
              componentPath={item.component_path}
              permissions={item.permissions}
            />
          }
        />
      );
      
      dynamicRoutes.push(route);
    });
  });
  
  console.log('🔍 [DynamicRouter] Total de rotas dinâmicas:', dynamicRoutes.length);
  console.log('🔍 [DynamicRouter] Rotas válidas:', dynamicRoutes.filter(r => r !== undefined).length);

  return (
    <React.Fragment>
      {/* Rota manual: Gestão de Domínios - APENAS XXX + presto */}
      <Route
        path="admin/domains"
        element={<GestaoDominios permissions={{
          can_access: true,
          can_create: true,
          can_edit: true,
          can_delete: true,
          can_export: true
        }} />}
      />
      
      {/* Rota manual: Permissões de Domínio */}
      <Route
        path="admin/domains/permissions"
        element={<DomainPermissions />}
      />
      
      {/* Rota manual: Gestão do Menu */}
      <Route
        path="admin/menu"
        element={<GestaoMenu />}
      />
      
      {/* Rotas dinâmicas do menu */}
      {dynamicRoutes}
      
      {/* Rota 404 */}
      <Route 
        path="*" 
        element={
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">PÁGINA NÃO ENCONTRADA</h2>
              <p className="text-gray-600 mb-4">A página que você procura não existe.</p>
              <Link 
                to="/" 
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Voltar ao Menu Principal
              </Link>
            </div>
          </div>
        } 
      />
    </React.Fragment>
  );
};

export default DynamicRouter;