/**
 * GERENCIADOR DE FAVICON DINÂMICO
 * 
 * Permite alterar o favicon do sistema dinamicamente baseado no cliente/domínio
 * O favicon é buscado da configuração de clientLogos.ts
 */

import { getFaviconUrl, getFaviconUrlHardcoded } from '../config/clientLogos';

/**
 * Atualiza o favicon do documento
 */
export function setFavicon(faviconUrl: string): void {
  try {
    // Remover favicons existentes
    const existingFavicons = document.querySelectorAll('link[rel*="icon"]');
    existingFavicons.forEach(favicon => favicon.remove());
    
    // Criar novo elemento link para o favicon
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    link.href = faviconUrl;
    
    // Adicionar ao head
    document.head.appendChild(link);
    
    // Também adicionar como apple-touch-icon para dispositivos iOS
    const appleTouchIcon = document.createElement('link');
    appleTouchIcon.rel = 'apple-touch-icon';
    appleTouchIcon.href = faviconUrl;
    document.head.appendChild(appleTouchIcon);
  } catch (error) {
    // Erro silencioso ao atualizar favicon
  }
}

/**
 * Define o favicon baseado no domínio
 * ⚠️ ATENÇÃO: Busca do localStorage - pode retornar dados antigos!
 * Use setFaviconByDomainHardcoded() se quiser apenas o favicon da configuração DOMAIN_LOGOS
 */
export function setFaviconByDomain(domain: string | null | undefined): void {
  // Buscar favicon da configuração
  const faviconUrl = getFaviconUrl(domain || undefined);
  setFavicon(faviconUrl);
}

/**
 * Define o favicon baseado no domínio usando APENAS configuração hardcoded
 * NÃO busca do localStorage - usa apenas DOMAIN_LOGOS
 */
export function setFaviconByDomainHardcoded(domain: string | null | undefined): void {
  const faviconUrl = getFaviconUrlHardcoded(domain || undefined);
  setFavicon(faviconUrl);
}

/**
 * Restaura o favicon padrão do sistema
 */
export function resetFavicon(): void {
  const faviconUrl = getFaviconUrl();
  setFavicon(faviconUrl);
}

/**
 * Retorna o favicon configurado para um domínio
 */
export function getFaviconForDomain(domain?: string): string {
  return getFaviconUrl(domain);
}
