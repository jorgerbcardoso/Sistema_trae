/**
 * SERVIÇO CENTRALIZADO DE API
 * 
 * Gerencia todas as requisições HTTP com:
 * - Autenticação automática (token + domínio)
 * - Rate limiting (controle de rajadas)
 * - Retry automático em caso de falha
 * - Logs detalhados para debugging
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { ENVIRONMENT } from '../config/environment';

// ============================================================================
// CONFIGURAÇÕES
// ============================================================================

const API_BASE_URL = ENVIRONMENT.apiBaseUrl;
const REQUEST_TIMEOUT = 30000; // 30 segundos
const MAX_RETRIES = 3;

// Rate Limiting: máximo de requisições por período
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requisições
const RATE_LIMIT_WINDOW_MS = 1000; // por segundo (1000ms)

// ============================================================================
// RATE LIMITER
// ============================================================================

class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Verifica se pode fazer uma requisição
   * Remove requisições antigas da janela de tempo
   */
  canMakeRequest(): boolean {
    const now = Date.now();
    
    // Remove requisições antigas (fora da janela de tempo)
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    // Verifica se atingiu o limite
    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    // Registra a nova requisição
    this.requests.push(now);
    return true;
  }

  /**
   * Retorna o tempo de espera até poder fazer nova requisição
   */
  getWaitTime(): number {
    if (this.requests.length === 0) return 0;
    
    const now = Date.now();
    const oldestRequest = this.requests[0];
    const timeElapsed = now - oldestRequest;
    
    return Math.max(0, this.windowMs - timeElapsed);
  }
}

// ============================================================================
// AXIOS INSTANCE COM INTERCEPTORS
// ============================================================================

class ApiService {
  private axiosInstance: AxiosInstance;
  private rateLimiter: RateLimiter;

  constructor() {
    // Criar instância do axios
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: REQUEST_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Criar rate limiter
    this.rateLimiter = new RateLimiter(
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS
    );

    // Configurar interceptors
    this.setupInterceptors();
  }

  /**
   * Configura interceptors para requisições e respostas
   */
  private setupInterceptors() {
    // ========================================================================
    // REQUEST INTERCEPTOR
    // ========================================================================
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        // Verificar rate limiting
        if (!this.rateLimiter.canMakeRequest()) {
          const waitTime = this.rateLimiter.getWaitTime();
          console.warn(`[API] Aguardando ${waitTime}ms devido ao rate limit...`);
          
          // Aguardar antes de fazer a requisição
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Obter dados de autenticação do localStorage
        const authData = this.getAuthData();

        if (!authData) {
          console.error('[API] Usuário não autenticado. Redirecionando para login...');
          throw new Error('Usuário não autenticado');
        }

        // Adicionar headers de autenticação
        config.headers['X-Auth-Token'] = authData.token;
        config.headers['X-Domain'] = authData.domain;
        config.headers['X-User-ID'] = authData.userId;

        // Log da requisição
        console.log('[API] →', {
          method: config.method?.toUpperCase(),
          url: config.url,
          domain: authData.domain,
          params: config.params,
          data: config.data,
        });

        return config;
      },
      (error) => {
        console.error('[API] Erro no request interceptor:', error);
        return Promise.reject(error);
      }
    );

    // ========================================================================
    // RESPONSE INTERCEPTOR
    // ========================================================================
    this.axiosInstance.interceptors.response.use(
      (response) => {
        // Log da resposta
        console.log('[API] ←', {
          status: response.status,
          url: response.config.url,
          data: response.data,
        });

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Log do erro
        console.error('[API] ✗ Erro:', {
          status: error.response?.status,
          url: originalRequest?.url,
          message: error.message,
          data: error.response?.data,
        });

        // ====================================================================
        // TRATAMENTO DE ERRO 401 (Não autenticado)
        // ====================================================================
        if (error.response?.status === 401) {
          console.warn('[API] Token inválido ou expirado. Redirecionando para login...');
          
          // 🔥 CRÍTICO: Determinar caminho de login ANTES de limpar dados
          const loginPath = this.getLoginPath();
          console.log('🔍 [ApiService] Caminho de login determinado:', loginPath);
          
          // Agora limpar autenticação
          this.clearAuthData();
          
          // Redirecionar para login
          console.log('➡️ [ApiService] Redirecionando para:', loginPath);
          window.location.href = loginPath;
          
          return Promise.reject(error);
        }

        // ====================================================================
        // TRATAMENTO DE ERRO 403 (Domínio inativo)
        // ====================================================================
        if (error.response?.status === 403) {
          console.warn('[API] Domínio inativo ou sem permissão.');
          
          const errorData = error.response.data as any;
          if (errorData?.message?.includes('inativo')) {
            // 🔥 CRÍTICO: Determinar caminho de login ANTES de limpar dados
            const loginPath = this.getLoginPath();
            
            // Limpar autenticação
            this.clearAuthData();
            
            // Redirecionar para login com mensagem
            window.location.href = `${loginPath}?error=domain_inactive`;
          }
          
          return Promise.reject(error);
        }

        // ====================================================================
        // RETRY AUTOMÁTICO (Erro 5xx ou timeout)
        // ====================================================================
        if (
          originalRequest &&
          !originalRequest._retry &&
          (error.code === 'ECONNABORTED' || 
           (error.response?.status && error.response.status >= 500))
        ) {
          originalRequest._retry = true;

          console.warn('[API] Tentando novamente em 2 segundos...');
          await new Promise(resolve => setTimeout(resolve, 2000));

          return this.axiosInstance(originalRequest);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Obtém dados de autenticação do localStorage
   */
  private getAuthData(): { token: string; domain: string; userId: string } | null {
    try {
      const authToken = localStorage.getItem('presto_auth_token');
      const domain = localStorage.getItem('presto_domain');
      const userId = localStorage.getItem('presto_user_id');

      if (!authToken || !domain || !userId) {
        return null;
      }

      return {
        token: authToken,
        domain: domain,
        userId: userId,
      };
    } catch (error) {
      console.error('[API] Erro ao obter dados de autenticação:', error);
      return null;
    }
  }

  /**
   * Limpa dados de autenticação do localStorage
   */
  private clearAuthData() {
    localStorage.removeItem('presto_auth_token');
    localStorage.removeItem('presto_domain');
    localStorage.removeItem('presto_user_id');
    localStorage.removeItem('presto_user');
  }

  /**
   * 🔥 CRÍTICO: Determina o caminho de login correto baseado no domínio
   * - Domínio ACV (Aceville) → /login-aceville
   * - Acesso via IP → /login-aceville
   * - Outros domínios → /login
   */
  private getLoginPath(): string {
    try {
      console.log('🔍🔍🔍 [ApiService.getLoginPath] INICIANDO DETERMINAÇÃO DO CAMINHO');
      
      // 1. Tentar ler domínio do localStorage
      const storedDomain = localStorage.getItem('presto_domain');
      console.log('🔍🔍🔍 [ApiService.getLoginPath] Domínio lido do localStorage:', storedDomain);
      
      // 2. Se for Aceville, redirecionar para tela customizada
      if (storedDomain === 'ACV') {
        console.log('✅✅✅ [ApiService.getLoginPath] DOMÍNIO ACV DETECTADO → /login-aceville');
        return '/login-aceville';
      }
      
      // 3. Verificar se acesso é via IP (fallback)
      const hostname = window.location.hostname;
      console.log('🔍🔍🔍 [ApiService.getLoginPath] Hostname:', hostname);
      
      const isIPAccess = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
      console.log('🔍🔍🔍 [ApiService.getLoginPath] É acesso via IP?', isIPAccess);
      
      if (isIPAccess) {
        console.log('✅✅✅ [ApiService.getLoginPath] ACESSO VIA IP DETECTADO → /login-aceville');
        return '/login-aceville';
      }
      
      // 4. Padrão: login convencional
      console.log('⚠️⚠️⚠️ [ApiService.getLoginPath] Nenhuma condição atendida → /login');
      return '/login';
    } catch (error) {
      console.error('❌❌❌ [ApiService.getLoginPath] ERRO:', error);
      return '/login';
    }
  }

  // ==========================================================================
  // MÉTODOS PÚBLICOS
  // ==========================================================================

  /**
   * GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.get<T>(url, config);
    return response.data;
  }

  /**
   * POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.post<T>(url, data, config);
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.put<T>(url, data, config);
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.delete<T>(url, config);
    return response.data;
  }

  /**
   * PATCH request
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.axiosInstance.patch<T>(url, data, config);
    return response.data;
  }
}

// ============================================================================
// EXPORTAR INSTÂNCIA SINGLETON
// ============================================================================

export const apiService = new ApiService();

// ============================================================================
// TIPOS AUXILIARES
// ============================================================================

export interface ApiError {
  message: string;
  status?: number;
  data?: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}