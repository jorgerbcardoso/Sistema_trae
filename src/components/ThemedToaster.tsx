import React from 'react';
import { Toaster } from 'sonner';
import { useTheme } from './ThemeProvider';

/**
 * Componente Toaster que segue automaticamente o tema do sistema
 * ✅ CLOSE BUTTON ATIVO EM TODOS OS TOASTS POR PADRÃO
 */
export function ThemedToaster() {
  const { theme } = useTheme();
  
  return (
    <Toaster 
      position="bottom-right" 
      theme={theme}
      richColors 
      closeButton
    />
  );
}