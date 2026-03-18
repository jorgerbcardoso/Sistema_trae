import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getSystemTitle } from '../config/clientLogos';
import { setFaviconByDomainHardcoded } from '../utils/faviconManager';

/**
 * Hook para atualizar o título da página E FAVICON dinamicamente
 * baseado no domínio do cliente logado
 * 
 * ✅ REGRA CRÍTICA: Sempre usa o domínio do usuário logado para definir o favicon
 * NUNCA permite que o favicon seja alterado por componentes individuais
 */
export function usePageTitle(pageTitle?: string) {
  const { user } = useAuth();
  
  useEffect(() => {
    // Obter título do sistema baseado no domínio
    const systemTitle = getSystemTitle(user?.domain);
    
    // Atualizar título (sempre usa o título fixo do domínio, ignorando pageTitle)
    document.title = systemTitle;
    
    // ✅ CRÍTICO: SEMPRE atualizar o favicon para o domínio do usuário logado
    // Isso garante que, independente de qual tela o usuário está,
    // o favicon sempre reflete o domínio correto
    if (user?.domain) {
      setFaviconByDomainHardcoded(user.domain);
      console.log(`🎨 [usePageTitle] Favicon forçado para domínio: ${user.domain}`);
    }
    
    console.log(`📄 [usePageTitle] Título atualizado: ${systemTitle}`);
    
    // Cleanup: restaurar título padrão ao desmontar (opcional)
    return () => {
      // Não fazer nada no cleanup para evitar piscar o título
    };
  }, [user?.domain]); // Monitora mudança de domínio
}