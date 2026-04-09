/**
 * Configuração de Logos por Domínio
 * 
 * Define qual logo deve ser exibida para cada domínio do sistema
 */

export interface DomainLogoConfig {
  domain: string;
  clientName: string;
  logoLight: string;  // Logo para tema claro
  logoDark: string;   // Logo para tema escuro
  loginLogo: string;  // Logo para tela de login
  favicon: string;    // Favicon específico do cliente
  showSystemName: boolean; // Se deve mostrar "Sistema Presto" ou nome do cliente
  systemTitle: string; // Título da aba do navegador
}

export const DOMAIN_LOGOS: Record<string, DomainLogoConfig> = {
  // Super Admin - Presto Tecnologia
  'XXX': {
    domain: 'XXX',
    clientName: 'Sistema Presto',
    logoLight: 'https://webpresto.com.br/images/logo-verde-simples.png',
    logoDark: 'https://sistema.webpresto.com.br/images/logo-branca-simples.png',
    loginLogo: 'https://webpresto.com.br/images/logo-branca.png',
    favicon: 'https://webpresto.com.br/favicon.png', // ✅ CORRIGIDO: usar .png
    showSystemName: true,
    systemTitle: 'Sistema Presto - Gestão de Transportes'
  },
  
  // Viação Cruzeiro do Sul
  'VCS': {
    domain: 'VCS',
    clientName: 'Viação Cruzeiro do Sul',
    logoLight: 'https://webpresto.com.br/images/logo-verde-simples.png',
    logoDark: 'https://sistema.webpresto.com.br/images/logo-branca-simples.png',
    loginLogo: 'https://webpresto.com.br/images/logo-branca.png',
    favicon: 'https://webpresto.com.br/favicon.png', // ✅ CORRIGIDO: usar .png
    showSystemName: true,
    systemTitle: 'Sistema Presto - Gestão de Transportes'
  },
  
  // Aceville Transportes - CLIENTE ESPECIAL
  'ACV': {
    domain: 'ACV',
    clientName: 'Aceville Transportes',
    logoLight: 'https://www.webpresto.com.br/images/logos_clientes/aceville.png',
    logoDark: 'https://www.webpresto.com.br/images/logos_clientes/aceville.png',
    loginLogo: 'https://www.webpresto.com.br/images/logos_clientes/aceville.png',
    favicon: 'https://webpresto.com.br/images/logos_clientes/aceville_favicon.png',
    showSystemName: false, // NÃO mostrar "Sistema Presto"
    systemTitle: 'Aceville - Sistema de Gestão'
  }
};

/**
 * Retorna a configuração de logo para um domínio
 * Se não encontrar, retorna configuração padrão
 */
export function getLogoConfig(domain?: string): DomainLogoConfig {
  if (!domain) {
    return DOMAIN_LOGOS['XXX']; // Padrão
  }
  
  const config = DOMAIN_LOGOS[domain.toUpperCase()];
  
  if (!config) {
    // Domínio não configurado - usar padrão Presto
    return {
      domain: domain,
      clientName: `Empresa ${domain}`,
      logoLight: 'https://webpresto.com.br/images/logo-verde-simples.png',
      logoDark: 'https://sistema.webpresto.com.br/images/logo-branca-simples.png',
      loginLogo: 'https://webpresto.com.br/images/logo-branca.png',
      favicon: 'https://webpresto.com.br/favicon.png', // ✅ CORRIGIDO: usar .png no fallback
      showSystemName: true,
      systemTitle: 'Sistema Presto - Gestão de Transportes'
    };
  }
  
  return config;
}

/**
 * Retorna a URL do logo baseado no domínio e tema
 */
export function getLogoUrl(domain: string | undefined, theme: 'light' | 'dark'): string {
  const config = getLogoConfig(domain);
  return theme === 'dark' ? config.logoDark : config.logoLight;
}

/**
 * Retorna a URL do logo para tela de login
 */
export function getLoginLogoUrl(domain?: string): string {
  const config = getLogoConfig(domain);
  return config.loginLogo;
}

/**
 * Verifica se deve mostrar "Sistema Presto" ou apenas o nome do cliente
 */
export function shouldShowSystemName(domain?: string): boolean {
  const config = getLogoConfig(domain);
  return config.showSystemName;
}

/**
 * Retorna o título do sistema para a aba do navegador
 */
export function getSystemTitle(domain?: string): string {
  const config = getLogoConfig(domain);
  return config.systemTitle;
}

/**
 * Retorna o favicon específico do cliente
 * ⚠️ ATENÇÃO: Esta função SEMPRE retorna o favicon hardcoded (não busca do localStorage)
 * Para usar o favicon do banco de dados, use clientConfig.favicon_url diretamente
 */
export function getFaviconUrl(domain?: string): string {
  // SEMPRE usar configuração hardcoded
  // O favicon do banco de dados deve vir do clientConfig.favicon_url
  const config = getLogoConfig(domain);
  console.log(`🎨 [getFaviconUrl] Favicon hardcoded para ${domain}: ${config.favicon}`);
  return config.favicon;
}

/**
 * Retorna o favicon hardcoded da configuração DOMAIN_LOGOS
 * NÃO busca do localStorage - apenas da configuração estática
 * Use esta função quando quiser garantir que está usando o favicon correto do domínio
 */
export function getFaviconUrlHardcoded(domain?: string): string {
  const config = getLogoConfig(domain);
  console.log(`🎨 [getFaviconUrlHardcoded] Favicon hardcoded para ${domain}: ${config.favicon}`);
  return config.favicon;
}