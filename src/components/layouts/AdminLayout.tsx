import React, { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { getLogoUrl } from '../../config/clientLogos';
import { ArrowLeft, Printer, LogOut, Building2, User } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
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
      // Primeiro tentamos o objeto user, se não existir, buscamos no localStorage
      const userDomain = user?.domain || localStorage.getItem('presto_domain');
      console.log('🔍 [AdminLayout] Domínio do usuário para redirecionamento:', userDomain);
      
      sessionStorage.clear();
      await logout();
      
      // Verificar se é domínio Aceville para redirecionar corretamente
      const isAceville = userDomain === 'ACV';
      const loginPath = isAceville ? '/login-aceville' : '/login';
      
      console.log(`✅ [AdminLayout] Logout completo, redirecionando para ${loginPath}`);
      
      navigate(loginPath, { replace: true });
    } catch (error) {
      console.error('❌ [AdminLayout] Erro durante logout:', error);
      navigate('/login', { replace: true });
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
                    className="hidden md:flex border-border hover:bg-accent print:hidden"
                  >
                    <Printer className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Imprimir</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {/* Botão Logout */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleLogout}
                    className="hidden md:flex border-border hover:bg-accent print:hidden"
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