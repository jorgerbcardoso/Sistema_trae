import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSystemTitle } from '../config/clientLogos';

/**
 * Hook para atualizar o título da página dinamicamente
 * baseado no domínio do cliente logado
 */
export function usePageTitle(pageTitle?: string) {
  const { user } = useAuth();
  
  useEffect(() => {
    // Obter título do sistema baseado no domínio
    const systemTitle = getSystemTitle(user?.domain);
    
    // Atualizar título (sempre usa o título fixo do domínio, ignorando pageTitle)
    document.title = systemTitle;
    
    console.log(`📄 [usePageTitle] Título atualizado: ${systemTitle}`);
    
    // Cleanup: restaurar título padrão ao desmontar (opcional)
    return () => {
      // Não fazer nada no cleanup para evitar piscar o título
    };
  }, [user?.domain]); // Monitora mudança de domínio
}