import React from 'react';
import { useNavigate } from 'react-router';
import { LogOut, Menu, ArrowLeft, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { getLogoUrl, shouldShowSystemName } from '../config/clientLogos';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { UserProfileDropdown } from './UserProfileDropdown';
import { useTheme } from './ThemeProvider';

interface AppLayoutProps {
  children: React.ReactNode;
  showBackButton?: boolean;
}

/**
 * Layout padrão do sistema com header e navegação
 * REGRA: Todas as páginas internas devem usar este layout
 */
export function AppLayout({ children, showBackButton = true }: AppLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const { theme, toggleTheme } = useTheme();

  const logoUrl = getLogoUrl(user?.domain || '');
  const showSystemName = shouldShowSystemName(user?.domain || '');

  const handleBackToMenu = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo e Nome do Sistema */}
            <div className="flex items-center gap-4">
              {showBackButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBackToMenu}
                  className="gap-2"
                >
                  <ArrowLeft className="size-4" />
                  Menu
                </Button>
              )}
              
              <div className="flex items-center gap-3">
                <ImageWithFallback
                  src={logoUrl}
                  alt="Logo"
                  className="h-10 w-auto object-contain"
                />
                {showSystemName && (
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      SISTEMA PRESTO
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {user?.client_name || 'Gestão de Transportes'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Ações do usuário */}
            <div className="flex items-center gap-2">
              {/* Toggle de tema */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="h-9 w-9 p-0"
              >
                {theme === 'dark' ? (
                  <Sun className="size-4" />
                ) : (
                  <Moon className="size-4" />
                )}
              </Button>

              {/* Informações do usuário */}
              <div className="hidden md:flex flex-col items-end mr-3">
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {user?.full_name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {user?.domain?.toUpperCase()} • {user?.username}
                </span>
              </div>

              {/* Botão de logout */}
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="gap-2"
              >
                <LogOut className="size-4" />
                <span className="hidden md:inline">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="container mx-auto">
        {children}
      </main>
    </div>
  );
}
