/**
 * SERVIÇO DE GERENCIAMENTO DE DOMÍNIOS
 * 
 * Gerencia a configuração de domínios de forma dinâmica usando localStorage
 * Permite alternar entre MOCK e BACKEND em tempo de desenvolvimento
 */

import { MOCK_DOMAINS } from '../mocks/mockData';

// ============================================
// TIPOS E INTERFACES
// ============================================

export type DataSource = 'MOCK' | 'BACKEND';

export interface Domain {
  domain: string;
  name: string;
  client_name: string;
  website: string;
  email: string;
  modalidade: 'CARGAS' | 'PASSAGEIROS';
  data_source: DataSource;
  favicon_url: string;
  controla_linhas: boolean;
  total_users: number;
  total_permissions: number;
  last_created: string;
  is_super_admin: boolean;
  is_active: boolean;
  ssw_domain: string;
  ssw_username: string;
  ssw_password: string;
  ssw_cpf: string;
}

export interface DomainOverride {
  name?: string;
  client_name?: string;
  website?: string;
  email?: string;
  data_source?: DataSource;
  favicon_url?: string;
  controla_linhas?: boolean;
  is_active?: boolean;
  ssw_domain?: string;
  ssw_username?: string;
  ssw_password?: string;
  ssw_cpf?: string;
}

export interface DomainOverrides {
  [domainCode: string]: DomainOverride;
}

// ============================================
// CONSTANTES
// ============================================

const STORAGE_KEY = 'presto_domain_overrides';
const CUSTOM_DOMAINS_KEY = 'presto_custom_domains';
const CUSTOM_USERS_KEY = 'presto_custom_users';
const CUSTOM_PERMISSIONS_KEY = 'presto_custom_permissions';

// ============================================
// FUNÇÕES DE STORAGE
// ============================================

/**
 * Obter overrides do localStorage
 */
function getOverrides(): DomainOverrides {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {};
  }
}

/**
 * Salvar overrides no localStorage
 */
function saveOverrides(overrides: DomainOverrides): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch (error) {
    // Erro ao salvar overrides
  }
}

/**
 * Obter domínios customizados do localStorage
 */
function getCustomDomains(): Domain[] {
  try {
    const stored = localStorage.getItem(CUSTOM_DOMAINS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Salvar domínios customizados no localStorage
 */
function saveCustomDomains(domains: Domain[]): void {
  try {
    localStorage.setItem(CUSTOM_DOMAINS_KEY, JSON.stringify(domains));
  } catch (error) {
    // Erro ao salvar domínios customizados
  }
}

/**
 * Obter usuários customizados do localStorage
 */
function getCustomUsers(): any[] {
  try {
    const stored = localStorage.getItem(CUSTOM_USERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Salvar usuários customizados no localStorage
 */
function saveCustomUsers(users: any[]): void {
  try {
    localStorage.setItem(CUSTOM_USERS_KEY, JSON.stringify(users));
  } catch (error) {
    // Erro ao salvar usuários customizados
  }
}

/**
 * Obter permissões customizadas do localStorage
 */
function getCustomPermissions(): any[] {
  try {
    const stored = localStorage.getItem(CUSTOM_PERMISSIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    return [];
  }
}

/**
 * Salvar permissões customizadas no localStorage
 */
function saveCustomPermissions(permissions: any[]): void {
  try {
    localStorage.setItem(CUSTOM_PERMISSIONS_KEY, JSON.stringify(permissions));
  } catch (error) {
    // Erro ao salvar permissões customizadas
  }
}

/**
 * Converter domínio mockado para formato do serviço
 */
function convertMockDomain(mockDomain: any): Domain {
  return {
    domain: mockDomain.domain,
    name: mockDomain.name,
    client_name: mockDomain.client_name,
    website: mockDomain.website,
    email: mockDomain.email,
    modalidade: mockDomain.modalidade,
    data_source: mockDomain.use_mock_data === false ? 'BACKEND' : 'MOCK', // Converter use_mock_data
    favicon_url: mockDomain.favicon_url, // Adicionar favicon_url
    controla_linhas: mockDomain.controla_linhas, // Adicionar controla_linhas
    total_users: mockDomain.total_users,
    total_permissions: mockDomain.total_permissions,
    last_created: mockDomain.last_created,
    is_super_admin: mockDomain.is_super_admin,
    is_active: mockDomain.is_active,
    ssw_domain: mockDomain.ssw_domain,
    ssw_username: mockDomain.ssw_username,
    ssw_password: mockDomain.ssw_password,
    ssw_cpf: mockDomain.ssw_cpf,
  };
}

/**
 * Obter todos os domínios com overrides aplicados
 */
export function getDomains(): Domain[] {
  const overrides = getOverrides();
  const customDomains = getCustomDomains();
  
  // Processar domínios base do MOCK_DOMAINS
  const baseDomains = MOCK_DOMAINS.map(mockDomain => {
    const domain = convertMockDomain(mockDomain);
    const override = overrides[domain.domain];
    
    if (override) {
      return {
        ...domain,
        ...override, // Aplicar overrides
      };
    }
    
    return domain;
  });
  
  // Adicionar apenas domínios customizados que NÃO existem nos MOCK_DOMAINS
  const baseDomainCodes = MOCK_DOMAINS.map(d => d.domain.toUpperCase());
  const customDomainsConverted = customDomains
    .filter(customDomain => !baseDomainCodes.includes(customDomain.domain.toUpperCase()))
    .map(customDomain => convertMockDomain(customDomain));
  
  // Combinar tudo (sem duplicações)
  return [...baseDomains, ...customDomainsConverted];
}

/**
 * Obter um domínio específico com overrides aplicados
 */
export function getDomain(domainCode: string): Domain | null {
  const domains = getDomains();
  
  // Buscar com case-insensitive
  const found = domains.find(d => d.domain.toUpperCase() === domainCode.toUpperCase());
  
  return found || null;
}

/**
 * Atualizar fonte de dados de um domínio
 */
export function updateDomainDataSource(domainCode: string, dataSource: DataSource): void {
  const overrides = getOverrides();
  
  if (!overrides[domainCode]) {
    overrides[domainCode] = {};
  }
  
  overrides[domainCode].data_source = dataSource;
  saveOverrides(overrides);
  
  console.log(`✅ Fonte de dados do domínio ${domainCode} alterada para: ${dataSource}`);
}

/**
 * Atualizar URL do favicon de um domínio
 */
export function updateDomainFavicon(domainCode: string, faviconUrl: string): void {
  const overrides = getOverrides();
  
  if (!overrides[domainCode]) {
    overrides[domainCode] = {};
  }
  
  overrides[domainCode].favicon_url = faviconUrl;
  saveOverrides(overrides);
  
  console.log(`✅ Favicon do domínio ${domainCode} alterado para: ${faviconUrl || 'PADRÃO'}`);
}

/**
 * Atualizar informações completas de um domínio
 */
export function updateDomain(domainCode: string, updates: Partial<DomainOverride>): void {
  const overrides = getOverrides();
  
  if (!overrides[domainCode]) {
    overrides[domainCode] = {};
  }
  
  overrides[domainCode] = {
    ...overrides[domainCode],
    ...updates,
  };
  
  saveOverrides(overrides);
  
  console.log(`✅ Domínio ${domainCode} atualizado:`, updates);
}

/**
 * Resetar todos os overrides (voltar ao padrão do mockData)
 */
export function resetDomainOverrides(): void {
  localStorage.removeItem(STORAGE_KEY);
  console.log('🔄 Overrides resetados - usando configuração padrão');
}

/**
 * Resetar override de um domínio específico
 */
export function resetDomainOverride(domainCode: string): void {
  const overrides = getOverrides();
  delete overrides[domainCode];
  saveOverrides(overrides);
  console.log(`🔄 Override do domínio ${domainCode} resetado`);
}

/**
 * Verificar se um domínio deve usar MOCK ou BACKEND
 * Lógica:
 * - Localhost → SEMPRE BACKEND (forçado)
 * - Figma Make → SEMPRE MOCK
 * - Outros → Verifica atributo data_source do domínio
 */
export function shouldUseMockData(domainCode: string): boolean {
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  // Detectar ambiente Figma Make
  const isFigmaMake = hostname.includes('figma.com') ||
                      hostname.includes('esm.sh') ||
                      hostname.includes('fig.run') ||
                      hostname === '' ||
                      window.location.href.includes('figma');
  
  // Figma Make sempre usa MOCK
  if (isFigmaMake) {
    return true;
  }

  // Em produção (não localhost e não Figma), SEMPRE preferir BACKEND
  // a menos que o domínio não exista nos MOCK_DOMAINS (domínio novo)
  if (!isLocalhost && !isFigmaMake) {
    // Se o domínio for um dos "base" (VCS, ACV, XXX), forçar BACKEND em produção
    const baseDomainCodes = ['VCS', 'ACV', 'XXX'];
    if (baseDomainCodes.includes(domainCode.toUpperCase())) {
      return false;
    }
  }
  
  // Localhost ou domínio customizado: verificar configuração
  const domain = getDomain(domainCode);
  
  if (!domain) {
    return !isLocalhost; // Default to MOCK if not found, unless localhost
  }
  
  return domain.data_source === 'MOCK';
}

/**
 * Obter estatísticas dos domínios
 */
export function getDomainStats() {
  const domains = getDomains();
  const overrides = getOverrides();
  
  return {
    total: domains.length,
    active: domains.filter(d => d.is_active).length,
    mock: domains.filter(d => d.data_source === 'MOCK').length,
    backend: domains.filter(d => d.data_source === 'BACKEND').length,
    hasOverrides: Object.keys(overrides).length > 0,
    overridesCount: Object.keys(overrides).length,
  };
}

/**
 * Adicionar novo domínio mock (para Figma Make)
 * Inicializa automaticamente com usuários e permissões do domínio XXX
 */
export function addMockDomain(domainCode: string, formData: any): void {
  const customDomains = getCustomDomains();
  const customUsers = getCustomUsers();
  
  // ============================================
  // 1. CRIAR O DOMÍNIO
  // ============================================
  const newDomain = {
    domain: domainCode,
    name: formData.name,
    client_name: formData.name,
    website: formData.website || '',
    email: formData.email || '',
    modalidade: formData.modalidade || 'CARGAS',
    use_mock_data: formData.use_mock_data !== false,
    favicon_url: formData.favicon_url || '',
    controla_linhas: formData.controla_linhas || false,
    total_users: 2, // Usuários padrão: presto e admin
    total_permissions: 17, // Total de funcionalidades disponíveis
    last_created: new Date().toISOString().split('T')[0],
    is_super_admin: false,
    is_active: true,
    ssw_domain: formData.ssw_domain || domainCode,
    ssw_username: formData.ssw_username || 'presto',
    ssw_password: formData.ssw_password || 'web@pres',
    ssw_cpf: formData.ssw_cpf || '11111160',
  };
  
  customDomains.push(newDomain);
  saveCustomDomains(customDomains);
  
  console.log(`✅ Domínio ${domainCode} criado:`, newDomain);
  
  // ============================================
  // 2. CRIAR USUÁRIOS PADRÃO (baseado no XXX)
  // ============================================
  
  // Buscar próximo ID disponível
  const nextUserId = customUsers.length > 0 
    ? Math.max(...customUsers.map(u => u.id)) + 1 
    : 1000; // IDs customizados começam em 1000
  
  const defaultUsers = [
    {
      id: nextUserId,
      domain: domainCode,
      username: 'presto',
      email: `presto@${formData.email?.split('@')[1] || 'example.com'}`,
      full_name: 'USUÁRIO PADRÃO',
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: nextUserId + 1,
      domain: domainCode,
      username: 'admin',
      email: `admin@${formData.email?.split('@')[1] || 'example.com'}`,
      full_name: `ADMINISTRADOR ${domainCode}`,
      is_active: true,
      created_at: new Date().toISOString()
    }
  ];
  
  // Adicionar usuários ao storage
  customUsers.push(...defaultUsers);
  saveCustomUsers(customUsers);
  
  console.log(`✅ Usuários criados para ${domainCode}:`, defaultUsers.map(u => u.username));
  
  // ============================================
  // 3. CRIAR PERMISSÕES PADRÃO (baseado no XXX)
  // ============================================
  
  // Por enquanto, não vamos criar permissões específicas no localStorage
  // pois o menu já retorna permissões padrão para novos domínios
  
  console.log(`✅ Domínio ${domainCode} totalmente inicializado e pronto para uso!`);
}

/**
 * Atualizar domínio mock existente (para Figma Make)
 */
export function updateMockDomain(domainCode: string, formData: Partial<any>): void {
  const customDomains = getCustomDomains();
  const overrides = getOverrides();
  
  // Verificar se é um domínio customizado
  const customIndex = customDomains.findIndex(d => d.domain === domainCode);
  if (customIndex !== -1) {
    // Atualizar domínio customizado
    if (formData.name) {
      customDomains[customIndex].name = formData.name;
      customDomains[customIndex].client_name = formData.name;
    }
    if (formData.modalidade !== undefined) customDomains[customIndex].modalidade = formData.modalidade;
    if (formData.website !== undefined) customDomains[customIndex].website = formData.website;
    if (formData.email !== undefined) customDomains[customIndex].email = formData.email;
    if (formData.favicon_url !== undefined) customDomains[customIndex].favicon_url = formData.favicon_url;
    if (formData.controla_linhas !== undefined) customDomains[customIndex].controla_linhas = formData.controla_linhas;
    if (formData.use_mock_data !== undefined) customDomains[customIndex].use_mock_data = formData.use_mock_data;
    if (formData.ssw_domain !== undefined) customDomains[customIndex].ssw_domain = formData.ssw_domain;
    if (formData.ssw_username !== undefined) customDomains[customIndex].ssw_username = formData.ssw_username;
    if (formData.ssw_password !== undefined) customDomains[customIndex].ssw_password = formData.ssw_password;
    if (formData.ssw_cpf !== undefined) customDomains[customIndex].ssw_cpf = formData.ssw_cpf;
    
    saveCustomDomains(customDomains);
    console.log(`✅ Domínio customizado ${domainCode} atualizado:`, formData);
  } else {
    // É um domínio base - usar overrides
    if (!overrides[domainCode]) {
      overrides[domainCode] = {};
    }
    
    // Atualizar override com os novos dados
    if (formData.name) overrides[domainCode].client_name = formData.name;
    if (formData.modalidade !== undefined) overrides[domainCode].modalidade = formData.modalidade;
    if (formData.website !== undefined) overrides[domainCode].website = formData.website;
    if (formData.email !== undefined) overrides[domainCode].email = formData.email;
    if (formData.favicon_url !== undefined) overrides[domainCode].favicon_url = formData.favicon_url;
    if (formData.controla_linhas !== undefined) overrides[domainCode].controla_linhas = formData.controla_linhas;
    if (formData.use_mock_data !== undefined) {
      overrides[domainCode].data_source = formData.use_mock_data ? 'MOCK' : 'BACKEND';
    }
    if (formData.ssw_domain !== undefined) overrides[domainCode].ssw_domain = formData.ssw_domain;
    if (formData.ssw_username !== undefined) overrides[domainCode].ssw_username = formData.ssw_username;
    if (formData.ssw_password !== undefined) overrides[domainCode].ssw_password = formData.ssw_password;
    if (formData.ssw_cpf !== undefined) overrides[domainCode].ssw_cpf = formData.ssw_cpf;
    
    saveOverrides(overrides);
    console.log(`✅ Domínio base ${domainCode} atualizado via overrides:`, formData);
  }
}

/**
 * Remover/Desativar domínio mock (para Figma Make)
 */
export function removeMockDomain(domainCode: string): void {
  const customDomains = getCustomDomains();
  const overrides = getOverrides();
  
  // Verificar se é um domínio customizado
  const customIndex = customDomains.findIndex(d => d.domain === domainCode);
  if (customIndex !== -1) {
    // Marcar como inativo
    customDomains[customIndex].is_active = false;
    saveCustomDomains(customDomains);
    console.log(`✅ Domínio customizado ${domainCode} desativado`);
  } else {
    // É um domínio base - usar overrides
    if (!overrides[domainCode]) {
      overrides[domainCode] = {};
    }
    
    overrides[domainCode].is_active = false;
    saveOverrides(overrides);
    console.log(`✅ Domínio base ${domainCode} desativado via overrides`);
  }
}