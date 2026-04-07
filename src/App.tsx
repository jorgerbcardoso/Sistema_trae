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
