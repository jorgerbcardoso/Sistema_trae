import { useEffect } from 'react';
import { useSessionTimeout } from '../hooks/useSessionTimeout';

/**
 * ================================================================
 * COMPONENTE DE GERENCIAMENTO DE SESSÃO
 * ================================================================
 * Componente que ativa o monitoramento de timeout de sessão
 * Deve ser incluído dentro do AuthProvider
 */
export function SessionManager() {
  useSessionTimeout();
  
  return null; // Componente invisível
}
