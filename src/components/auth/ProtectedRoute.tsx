import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  // ✅ SEGURANÇA: Verificar se AuthContext está disponível
  let user = null;
  let loading = true;
  
  try {
    const auth = useAuth();
    user = auth.user;
    loading = auth.loading;
  } catch (error) {
    console.warn('⚠️ [ProtectedRoute] AuthContext não disponível ainda');
    // Se AuthContext não está disponível, mostrar loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">
            Carregando...
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="text-slate-600 dark:text-slate-400">
            Verificando autenticação...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Detectar se é acesso via IP (Aceville)
    const hostname = window.location.hostname;
    const isIPAccess = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
    const isAcevilleIP = hostname === '35.247.234.77';
    
    if (isIPAccess || isAcevilleIP) {
      return <Navigate to="/login-aceville" replace />;
    } else {
      return <Navigate to="/login" replace />;
    }
  }

  return <>{children}</>;
}