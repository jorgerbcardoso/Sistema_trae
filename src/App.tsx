import React from 'react';
import { RouterProvider } from 'react-router';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './components/ThemeProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ThemedToaster } from './components/ThemedToaster';
import { PHPQuestionHandler } from './components/shared/PHPQuestionHandler';
import { SessionManager } from './components/SessionManager';
import { router } from './routes.tsx';
import { useMockUser } from './hooks/useMockUser';

export default function App() {
  if (window.location.hostname === 'sistema.webpresto.com.br') {
    const { pathname, search, hash } = window.location;
    const rawBaseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBaseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
    const basePrefix = normalizedBaseUrl === '/' ? '' : normalizedBaseUrl;

    const targetPathname = pathname.startsWith(basePrefix)
      ? pathname
      : `${basePrefix}${pathname === '/' ? '' : pathname}`;

    window.location.replace(`https://webpresto.com.br${targetPathname}${search}${hash}`);
    return null;
  }

  // ✅ Configurar usuário mockado APENAS no Figma Make
  // No modo claro do navegador em produção, isso NÃO deve rodar.
  if (window.location.hostname.includes('figma')) {
    useMockUser();
  }
  
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <SessionManager />
          <RouterProvider router={router} />
          <ThemedToaster />
          <PHPQuestionHandler />
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
