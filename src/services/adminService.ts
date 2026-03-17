/**
 * SERVIÇO ADMINISTRATIVO
 * 
 * Funções auxiliares para gerenciamento administrativo
 * Integrado com backend PHP
 */

import { getDomains as getDomainsList, Domain, addMockDomain, updateMockDomain, removeMockDomain } from './domainService';
import { API_BASE_URL, ENVIRONMENT } from '../config/environment';
import { DomainFormData } from '../components/admin/DomainFormDialog';
import { apiFetch } from '../utils/apiUtils';

// Detectar se está no Figma Make (sem backend disponível)
const isFigmaMake = ENVIRONMENT.isFigmaMake;

/**
 * Buscar todos os domínios
 */
export async function getDomains(token: string) {
  // No Figma Make, usar dados mock
  if (isFigmaMake) {
    try {
      const domains = getDomainsList();
      return {
        success: true,
        domains: domains,
        message: 'Domínios carregados com sucesso (MOCK)'
      };
    } catch (error: any) {
      return {
        success: false,
        domains: [],
        message: error.message || 'Erro ao carregar domínios'
      };
    }
  }

  // Em produção, usar API
  try {
    // ✅ apiFetch já retorna JSON processado e intercepta toasts
    const data = await apiFetch(`${API_BASE_URL}/admin/domains/list.php`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    return {
      success: true,
      domains: data.domains || [],
      message: data.message || 'Domínios carregados com sucesso'
    };
  } catch (error: any) {
    console.error('Erro ao buscar domínios:', error);
    
    // Se for erro de rede/JSON, retornar dados mock como fallback
    if (error.message.includes('JSON') || error.message.includes('Resposta inválida')) {
      console.warn('⚠️ Usando dados MOCK como fallback');
      const domains = getDomainsList();
      return {
        success: true,
        domains: domains,
        message: 'Domínios carregados com sucesso (MOCK - fallback)'
      };
    }
    
    return {
      success: false,
      domains: [],
      message: error.message || 'Erro ao carregar domínios'
    };
  }
}

/**
 * Buscar um domínio específico
 */
export async function getDomain(domainCode: string, token: string) {
  // No Figma Make, usar dados mock
  if (isFigmaMake) {
    try {
      const domains = getDomainsList();
      const domain = domains.find(d => d.domain === domainCode);
      
      if (!domain) {
        return {
          success: false,
          domain: null,
          message: 'Domínio não encontrado'
        };
      }
      
      // Converter para formato do formulário
      return {
        success: true,
        domain: {
          name: domain.name,
          cnpj: '',
          phone: '',
          address: '',
          website: domain.website || '',
          email: domain.email || '',
          modalidade: domain.modalidade || 'CARGAS',
          favicon_url: domain.favicon_url || '',
          controla_linhas: domain.controla_linhas || false,
          use_mock_data: domain.data_source === 'MOCK',
          ssw_domain: domain.ssw_domain || '',
          ssw_username: domain.ssw_username || '',
          ssw_password: domain.ssw_password || '',
          ssw_cpf: domain.ssw_cpf || '',
          logo_light: '',
          logo_dark: '',
          primary_color: '#3b82f6',
          secondary_color: '#8b5cf6',
          modules: '',
        },
        message: 'Domínio carregado com sucesso (MOCK)'
      };
    } catch (error: any) {
      console.error('Erro ao buscar domínio:', error);
      return {
        success: false,
        domain: null,
        message: error.message || 'Erro ao carregar domínio'
      };
    }
  }

  // Em produção, usar API
  try {
    // ✅ apiFetch já retorna JSON processado e intercepta toasts
    const data = await apiFetch(`${API_BASE_URL}/admin/domains/get.php?domain=${domainCode}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    return {
      success: true,
      domain: data.domain,
      message: 'Domínio carregado com sucesso'
    };
  } catch (error: any) {
    console.error('Erro ao buscar domínio:', error);
    return {
      success: false,
      domain: null,
      message: error.message || 'Erro ao carregar domínio'
    };
  }
}

/**
 * Criar novo domínio
 */
export async function createDomain(domainCode: string, formData: DomainFormData, token: string) {
  // No Figma Make, simular criação
  if (isFigmaMake) {
    try {
      // Validar formato
      if (!/^[A-Z]{3}$/.test(domainCode)) {
        throw new Error('Domínio deve ter exatamente 3 letras maiúsculas');
      }
      
      // Verificar se já existe
      const domains = getDomainsList();
      if (domains.find(d => d.domain === domainCode)) {
        throw new Error('Domínio já existe');
      }
      
      // Simular sucesso
      console.log('✅ [MOCK] Domínio criado:', domainCode, formData);
      addMockDomain(domainCode, formData);
      return {
        success: true,
        domain: domainCode,
        message: `Domínio ${domainCode} criado com sucesso (MOCK)`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Erro ao criar domínio'
      };
    }
  }

  // Em produção, usar API
  try {
    // ✅ apiFetch já retorna JSON processado e intercepta toasts
    const data = await apiFetch(`${API_BASE_URL}/admin/domains/create.php`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: domainCode,
        ...formData,
      }),
    });
    
    return {
      success: true,
      domain: data.domain,
      message: data.message || `Domínio ${domainCode} criado com sucesso`
    };
  } catch (error: any) {
    console.error('Erro ao criar domínio:', error);
    return {
      success: false,
      message: error.message || 'Erro ao criar domínio'
    };
  }
}

/**
 * Atualizar domínio
 */
export async function updateDomain(domainCode: string, formData: Partial<DomainFormData>, token: string) {
  // No Figma Make, simular atualização
  if (isFigmaMake) {
    try {
      console.log('✅ [MOCK] Domínio atualizado:', domainCode, formData);
      updateMockDomain(domainCode, formData);
      return {
        success: true,
        domain: domainCode,
        message: `Domínio ${domainCode} atualizado com sucesso (MOCK)`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Erro ao atualizar domínio'
      };
    }
  }

  // Em produção, usar API
  try {
    // ✅ apiFetch já retorna JSON processado e intercepta toasts
    const data = await apiFetch(`${API_BASE_URL}/admin/domains/update.php`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: domainCode,
        ...formData,
      }),
    });
    
    return {
      success: true,
      domain: data.domain,
      message: data.message || `Domínio ${domainCode} atualizado com sucesso`
    };
  } catch (error: any) {
    console.error('Erro ao atualizar domínio:', error);
    return {
      success: false,
      message: error.message || 'Erro ao atualizar domínio'
    };
  }
}

/**
 * Deletar/Desativar domínio
 */
export async function deleteDomain(domainCode: string, token: string) {
  // No Figma Make, simular deleção
  if (isFigmaMake) {
    try {
      if (domainCode === 'XXX') {
        throw new Error('Não é possível deletar o domínio super admin');
      }
      
      console.log('✅ [MOCK] Domínio deletado:', domainCode);
      removeMockDomain(domainCode);
      return {
        success: true,
        domain: domainCode,
        message: `Domínio ${domainCode} desativado com sucesso (MOCK)`
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || 'Erro ao desativar domínio'
      };
    }
  }

  // Em produção, usar API
  try {
    // ✅ apiFetch já retorna JSON processado e intercepta toasts
    const data = await apiFetch(`${API_BASE_URL}/admin/domains/delete.php`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: domainCode,
      }),
    });
    
    return {
      success: true,
      domain: data.domain,
      message: data.message || `Domínio ${domainCode} desativado com sucesso`
    };
  } catch (error: any) {
    console.error('Erro ao deletar domínio:', error);
    return {
      success: false,
      message: error.message || 'Erro ao desativar domínio'
    };
  }
}

/**
 * Buscar permissões de um domínio
 */
export async function getPermissions(domainCode: string, token: string) {
  // No Figma Make, retornar permissões mock
  if (isFigmaMake) {
    return {
      success: true,
      permissions: [],
      message: 'Permissões carregadas com sucesso (MOCK)'
    };
  }

  try {
    // ✅ apiFetch já retorna JSON processado e intercepta toasts
    const data = await apiFetch(`${API_BASE_URL}/admin/permissions/get_domain_permissions.php?domain=${domainCode}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    return {
      success: true,
      permissions: data.permissions || [],
      message: 'Permissões carregadas com sucesso'
    };
  } catch (error: any) {
    console.error('Erro ao buscar permissões:', error);
    return {
      success: false,
      permissions: [],
      message: error.message || 'Erro ao carregar permissões'
    };
  }
}

/**
 * Atualizar permissões de um módulo
 */
export async function updatePermission(
  domainCode: string,
  moduleId: number,
  permissions: any,
  token: string
) {
  // No Figma Make, simular atualização
  if (isFigmaMake) {
    console.log('✅ [MOCK] Permissões atualizadas:', domainCode, moduleId, permissions);
    return {
      success: true,
      message: 'Permissões atualizadas com sucesso (MOCK)'
    };
  }

  try {
    // ✅ apiFetch já retorna JSON processado e intercepta toasts
    const data = await apiFetch(`${API_BASE_URL}/admin/permissions/update_domain_permissions.php`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain: domainCode,
        module_id: moduleId,
        permissions: permissions,
      }),
    });
    
    return {
      success: true,
      message: 'Permissões atualizadas com sucesso'
    };
  } catch (error: any) {
    console.error('Erro ao atualizar permissões:', error);
    return {
      success: false,
      message: error.message || 'Erro ao atualizar permissões'
    };
  }
}