import React, { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { getLogoUrl } from '../../config/clientLogos';
import { ArrowLeft, Printer, Moon, Sun, LogOut, Building2, User } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleBackToMenu = () => {
    navigate('/');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = async () => {
    try {
      // 🔥 CRÍTICO: Salvar domínio ANTES de chamar logout() porque logout() limpa o user
      const userDomain = user?.domain;
      console.log('🔍 [AdminLayout] Domínio do usuário antes do logout:', userDomain);
      
      sessionStorage.clear();
      await logout();
      
      // Verificar se é domínio Aceville para redirecionar corretamente
      const isAceville = userDomain === 'ACV';
      const loginPath = isAceville ? '/login-aceville' : '/login';
      
      console.log(`✅ [AdminLayout] Logout completo, redirecionando para ${loginPath}`);
      navigate(loginPath, { replace: true });
    } catch (error) {
      console.error('❌ [AdminLayout] Erro durante logout:', error);
      // Mesmo com erro, forçar navegação para login
      // Tentar recuperar do localStorage antes de redirecionar
      const storedDomain = localStorage.getItem('presto_domain');
      const isAceville = storedDomain === 'ACV';
      const loginPath = isAceville ? '/login-aceville' : '/login';
      console.log(`⚠️ [AdminLayout] Redirecionando após erro para ${loginPath}`);
      navigate(loginPath, { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm print:relative print:border-0">
        <div className="container mx-auto px-3 md:px-6 h-12 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBackToMenu}
              className="print:hidden"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden md:inline menu-button-text">Menu</span>
            </Button>
            <ImageWithFallback 
              key={theme}
              src={getLogoUrl(user?.domain, theme)}
              alt="Logo" 
              className="h-6 md:h-8 w-6 md:w-8 object-contain" 
            />
            <div className="flex-1 min-w-0 hidden md:block">
              <h1 className="text-foreground header-title-reduced truncate">{title}</h1>
              <p className="text-muted-foreground header-subtitle-reduced hidden md:block truncate">
                {description || user?.client_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* ✅ NOVO: Exibir Usuário e Unidade */}
            <div className="hidden lg:flex items-center gap-2 mr-2">
              <Badge variant="secondary" className="bg-muted text-foreground">
                <User className="w-3 h-3 mr-1" />
                {user?.username}
              </Badge>
              {user?.unidade_atual && (
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  <Building2 className="w-3 h-3 mr-1" />
                  {user.unidade_atual}
                </Badge>
              )}
            </div>
            
            {/* Botão Imprimir */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrint}
                    className="hidden md:flex dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
                  >
                    <Printer className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Imprimir</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Botão Tema - DESATIVADO POR ENQUANTO */}
            {false && (
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="hidden md:flex dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </Button>
            )}
            
            {/* Botão Logout */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleLogout}
                    className="hidden md:flex dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sair</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 md:px-6 py-6">
        {children}
      </main>
    </div>
  );
}