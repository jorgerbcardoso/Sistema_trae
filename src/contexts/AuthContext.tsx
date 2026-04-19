import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ENVIRONMENT } from '../config/environment';
import { toast } from 'sonner';
import { 
  getSystemTitle,
  getLogoConfig
} from '../config/clientLogos';
import { getDomain, shouldUseMockData } from '../services/domainService';
import { mockLogin as mockLoginData } from '../mocks/mockData';
import { setFaviconByDomain, resetFavicon, setFavicon } from '../utils/faviconManager';

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  client_id?: number;
  client_name: string;
  domain: string;
  is_admin?: boolean; // ✅ Campo para identificar se o usuário é administrador
  use_mock_data?: boolean; // ✅ Adicionar flag para controlar MOCK vs BACKEND
  unidade: string; // ✅ NOVO: Unidade do usuário
  troca_unidade: boolean; // ✅ NOVO: Permissão para trocar de unidade
  unidade_atual?: string; // ✅ NOVO: Unidade atualmente selecionada (pode ser diferente da unidade do cadastro)
  nro_setor?: number; // ✅ NOVO: Setor responsável do usuário
  unidades?: string; // ✅ NOVO: Unidades permitidas (CSV) - se vazio, pode trocar para qualquer unidade
}

interface ClientConfig {
  theme?: {
    primary_color?: string;
    secondary_color?: string;
    logo_light?: string;
    logo_dark?: string;
  };
  dashboards?: Array<{
    id: string;
    name: string;
    icon: string;
    enabled: boolean;
    order: number;
  }>;
  modules?: {
    overview?: boolean;
    revenue?: boolean;
    costs?: boolean;
    lines?: boolean;
    profitability?: boolean;
  };
  features?: {
    dark_mode?: boolean;
    print?: boolean;
    export_pdf?: boolean;
    export_excel?: boolean;
  };
  favicon_url?: string; // ✨ NOVO: URL do favicon específico do cliente
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  clientConfig: ClientConfig | null;
  loading: boolean;
  login: (domain: string, username: string, password: string) => Promise<void>;
  loginWithToken: (authToken: string, userData: User, config: ClientConfig) => void; // ✅ NOVO: Login direto com token
  logout: () => Promise<void>;
  updateClientConfig: (config: ClientConfig) => void;
  changeUnidade: (novaUnidade: string) => void; // ✅ NOVO: Função para trocar de unidade
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = ENVIRONMENT.apiBaseUrl;

/**
 * Função auxiliar para setar cookies
 */
function setCookie(name: string, value: string, days: number = 1) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

/**
 * Função auxiliar para deletar cookies
 */
function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

/**
 * Gera um token JWT-like para desenvolvimento
 * Em produção, o backend retornará um JWT real
 */
function generateMockToken(domain: string, userId: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    domain: domain,
    userId: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 horas
  }));
  const signature = btoa(`mock_signature_${domain}_${userId}`);
  
  return `${header}.${payload}.${signature}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [clientConfig, setClientConfig] = useState<ClientConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar autenticação ao carregar
  useEffect(() => {
    const verifyAuth = async () => {
      // Recuperar domínio salvo para verificar se deve usar MOCK
      const storedDomain = localStorage.getItem('presto_domain');
      const USE_MOCK = storedDomain ? shouldUseMockData(storedDomain) : ENVIRONMENT.useMockData;
      
      // IMPORTANTE: Em desenvolvimento MOCK, sempre limpar localStorage ao recarregar a página
      // Isso garante que sempre inicie na tela de login
      if (USE_MOCK && !sessionStorage.getItem('auth_verified')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('mock_user');
        sessionStorage.setItem('auth_verified', 'true');
        setLoading(false);
        return;
      }
      
      const storedToken = localStorage.getItem('auth_token');
      
      if (!storedToken) {
        setUser(null);
        setToken(null);
        setLoading(false);
        return;
      }

      try {
        if (USE_MOCK) {
          // Mock: Verificar token mockado
          const storedUser = localStorage.getItem('mock_user');
          
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            setToken(storedToken);
            setClientConfig({
              modules: {
                overview: true,
                revenue: true,
                costs: true,
                lines: true,
                profitability: true
              },
              features: {
                dark_mode: true,
                print: true,
                export_pdf: false,
                export_excel: false
              }
            });
          } else {
            localStorage.removeItem('auth_token');
            setToken(null);
          }
        } else {
          // Usar API real
          
          // 🆕 TENTAR RECUPERAR USUÁRIO DO LOCALSTORAGE PRIMEIRO (para rapidez na UI)
          const storedUser = localStorage.getItem('presto_user');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
              setToken(storedToken);
              
              // Tentar recuperar clientConfig do localStorage também
              const storedConfig = localStorage.getItem('presto_client_config');
              if (storedConfig) {
                setClientConfig(JSON.parse(storedConfig));
              }
              
              // ✅ NÃO RETORNAR! Continuar para verificar token e atualizar dados do usuário
              console.log('🔄 [AuthContext] Usuário carregado do cache, verificando dados frescos...');
            } catch (error) {
              console.error('❌ [AuthContext] Erro ao parsear usuário do cache:', error);
            }
          }
          
          // Verificar com o backend para obter os dados MAIS RECENTES
          const response = await fetch(`${API_BASE_URL}/auth/verify.php`, {
            headers: {
              'Authorization': `Bearer ${storedToken}`
            }
          });
          
          if (!response.ok) {
            throw new Error('Token inválido ou expirado');
          }
          
          const data = await response.json();

          if (data.authenticated) {
            // Buscar use_mock_data do domínio
            const domainInfo = getDomain(data.user.domain);
            const userWithMockFlag = {
              ...data.user,
              use_mock_data: domainInfo?.data_source === 'MOCK' || false
            };
            
            console.log('✅ [AuthContext] Dados frescos recebidos:', {
              full_name: userWithMockFlag.full_name,
              email: userWithMockFlag.email
            });

            setUser(userWithMockFlag);
            setToken(storedToken);
            setClientConfig(data.client_config);
            
            // ✅ Atualizar localStorage com os dados frescos
            localStorage.setItem('presto_user', JSON.stringify(userWithMockFlag));
            if (data.client_config) {
              localStorage.setItem('presto_client_config', JSON.stringify(data.client_config));
            }
          } else {
            console.warn('⚠️ [AuthContext] Token não autenticado no backend');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('presto_user');
            setUser(null);
            setToken(null);
          }
        }
      } catch (error) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('mock_user');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (domain: string, username: string, password: string) => {
    if (loading) return;

    try {
      setLoading(true);
      
      // ✅ PASSO 1: Determinar o hostname
      const hostname = window.location.hostname;
      const isRealProduction = hostname === 'webpresto.com.br' || 
                               hostname === 'sistemagestao.aceville.com.br' || 
                               /^\d+\.\d+\.\d+\.\d+$/.test(hostname);
      
      // ✅ PASSO 2: Determinar se usa MOCK ou BACKEND
      // 🔧 REGRA DE OURO: Se não for Figma Make, usar BACKEND real.
      const isFigmaMake = hostname.includes('figma.com') || hostname.includes('fig.run') || window.location.href.includes('figma');
      const USE_MOCK = isFigmaMake;
      
      // ✅ PASSO 3: Buscar informações do domínio
      let domainInfo: any = null;
      
      if (USE_MOCK) {
        // ✅ MODO MOCK/DESENVOLVIMENTO: SEMPRE criar domainInfo mockado
        
        // Lista de domínios mockados válidos com suas informações
        const mockDomainsMap: Record<string, any> = {
          'XXX': {
            domain: 'XXX',
            name: 'Presto Admin',
            client_name: 'Presto Admin',
            website: '',
            email: '',
            modalidade: 'Rodoviário',
            data_source: 'MOCK',
            favicon_url: '',
            controla_linhas: true,
            total_users: 0,
            total_permissions: 0,
            last_created: new Date().toISOString(),
            is_super_admin: true,
            is_active: true,
            ssw_domain: '',
            ssw_username: '',
            ssw_password: '',
            ssw_cpf: ''
          },
          'ACV': {
            domain: 'ACV',
            name: 'Aceville Transportes',
            client_name: 'Aceville Transportes',
            website: '',
            email: '',
            modalidade: 'Rodoviário',
            data_source: 'MOCK',
            favicon_url: '',
            controla_linhas: true,
            total_users: 0,
            total_permissions: 0,
            last_created: new Date().toISOString(),
            is_super_admin: false,
            is_active: true,
            ssw_domain: '',
            ssw_username: '',
            ssw_password: '',
            ssw_cpf: ''
          },
          'VCS': {
            domain: 'VCS',
            name: 'VCS Transportes',
            client_name: 'VCS Transportes',
            website: '',
            email: '',
            modalidade: 'Rodoviário',
            data_source: 'MOCK',
            favicon_url: '',
            controla_linhas: true,
            total_users: 0,
            total_permissions: 0,
            last_created: new Date().toISOString(),
            is_super_admin: false,
            is_active: true,
            ssw_domain: '',
            ssw_username: '',
            ssw_password: '',
            ssw_cpf: ''
          }
        };
        
        // Buscar domainInfo do mapa ou criar um genérico
        domainInfo = mockDomainsMap[domain.toUpperCase()] || {
          domain: domain.toUpperCase(),
          name: `${domain.toUpperCase()} - Cliente Mock`,
          client_name: `${domain.toUpperCase()} - Cliente Mock`,
          website: '',
          email: '',
          modalidade: 'Rodoviário',
          data_source: 'MOCK',
          favicon_url: '',
          controla_linhas: true,
          total_users: 0,
          total_permissions: 0,
          last_created: new Date().toISOString(),
          is_super_admin: false,
          is_active: true,
          ssw_domain: '',
          ssw_username: '',
          ssw_password: '',
          ssw_cpf: ''
        };
        
        console.log('✅ [AuthContext] DomainInfo MOCK criado:', JSON.stringify(domainInfo, null, 2));
      } else {
        // ✅ EM PRODUÇÃO: SEMPRE buscar da API (para garantir dados atualizados)
        
        try {
          const checkResponse = await fetch(`${ENVIRONMENT.apiBaseUrl}/domains/check.php?domain=${domain.toUpperCase()}`);
          
          console.log('🌐 [AuthContext] Status da resposta:', checkResponse.status);
          console.log('🌐 [AuthContext] Response OK?', checkResponse.ok);
          
          const checkResult = await checkResponse.json();
          
          console.log('🌐 [AuthContext] Resultado completo da API:', JSON.stringify(checkResult, null, 2));
          console.log('🌐 [AuthContext] checkResult.success:', checkResult.success);
          console.log('🌐 [AuthContext] checkResult.exists:', checkResult.exists);
          
          if (checkResult.success && checkResult.exists) {
            // ✅ Converter boolean do PostgreSQL (true/false ou 't'/'f' como string)
            const useMockData = checkResult.domain.use_mock_data === true || 
                                checkResult.domain.use_mock_data === 't' ||
                                checkResult.domain.use_mock_data === '1' ||
                                checkResult.domain.use_mock_data === 1;
            
            console.log('🔍 [AuthContext] use_mock_data do banco:', checkResult.domain.use_mock_data, 'tipo:', typeof checkResult.domain.use_mock_data);
            console.log('🔍 [AuthContext] useMockData convertido:', useMockData);
            
            domainInfo = {
              domain: checkResult.domain.domain,
              name: checkResult.domain.name,
              client_name: checkResult.domain.name,
              website: '',
              email: '',
              modalidade: checkResult.domain.modalidade,
              data_source: useMockData ? 'MOCK' : 'BACKEND',
              favicon_url: checkResult.domain.favicon_url,
              controla_linhas: checkResult.domain.controla_linhas,
              total_users: 0,
              total_permissions: 0,
              last_created: new Date().toISOString(),
              is_super_admin: checkResult.domain.domain === 'XXX',
              is_active: checkResult.domain.is_active,
              ssw_domain: '',
              ssw_username: '',
              ssw_password: '',
              ssw_cpf: ''
            };
            console.log('✅ [AuthContext] Domínio encontrado na API:', domainInfo);
            
            // ✅ SALVAR NO CACHE LOCAL para próximas consultas
            // Isso evita ter que buscar da API toda vez
            const customDomains = JSON.parse(localStorage.getItem('presto_custom_domains') || '[]');
            
            // Verificar se o domínio já existe no cache
            const existingIndex = customDomains.findIndex((d: any) => d.domain === checkResult.domain.domain);
            
            const cachedDomain = {
              domain: checkResult.domain.domain,
              name: checkResult.domain.name,
              client_name: checkResult.domain.name,
              website: '',
              email: '',
              modalidade: checkResult.domain.modalidade,
              use_mock_data: useMockData, // ✅ Usar boolean convertido
              favicon_url: checkResult.domain.favicon_url,
              controla_linhas: checkResult.domain.controla_linhas,
              total_users: 0,
              total_permissions: 0,
              last_created: new Date().toISOString(),
              is_super_admin: false,
              is_active: checkResult.domain.is_active,
              ssw_domain: '',
              ssw_username: '',
              ssw_password: '',
              ssw_cpf: ''
            };
            
            if (existingIndex !== -1) {
              // ✅ ATUALIZAR domínio existente (para pegar mudanças do banco)
              customDomains[existingIndex] = cachedDomain;
              console.log('🔄 [AuthContext] Domínio atualizado no cache:', cachedDomain);
            } else {
              // ✅ ADICIONAR novo domínio ao cache
              customDomains.push(cachedDomain);
              console.log('➕ [AuthContext] Domínio adicionado ao cache:', cachedDomain);
            }
            
            localStorage.setItem('presto_custom_domains', JSON.stringify(customDomains));
            console.log('💾 [AuthContext] Cache salvo. Total de domínios:', customDomains.length);
          } else {
            console.log('❌ [AuthContext] API retornou success=false ou exists=false');
          }
        } catch (error) {
          console.error('❌ [AuthContext] Erro ao consultar API de domínios:', error);
        }
      }
      
      console.log('🔍 [AuthContext] domainInfo final:', domainInfo);
      
      if (!domainInfo) {
        console.error('❌ [AuthContext] ERRO: domainInfo é null, lançando exceção');
        throw new Error('Domínio não encontrado no sistema');
      }
      
      if (!domainInfo.is_active) {
        throw new Error('Este domínio está temporariamente desativado. Entre em contato com o suporte.');
      }
      
      console.log(`✅ [AuthContext] Domínio ${domain} está ativo, prosseguindo com login...`);
      
      if (USE_MOCK) {
        console.log('🎭 [AuthContext] Usando autenticação MOCK (Figma Make / Desenvolvimento)');
        
        // ✅ USAR mockLogin do mockData.ts para ter usuários com unidades específicas
        try {
          const mockResult = await mockLoginData(domain.toUpperCase(), username.toLowerCase(), password);
          
          console.log('✅ [AuthContext] mockLogin executado com sucesso:', mockResult);
          
          const mockUser: User = {
            ...mockResult.user,
            use_mock_data: true,
            unidade: mockResult.user.unidade || 'MTZ',
            troca_unidade: true,
            unidade_atual: mockResult.user.unidade || 'MTZ'
          };
          
          const mockToken = mockResult.token;
          
          // 🎨 CRÍTICO: Obter logo do cliente da config
          const logoConfig = getLogoConfig(domain.toUpperCase());
          
          setUser(mockUser);
          setToken(mockToken);
          setClientConfig({
            theme: {
              logo_light: logoConfig.logoLight,
              logo_dark: logoConfig.logoDark
            },
            modules: {
              overview: true,
              revenue: true,
              costs: true,
              lines: true,
              profitability: true
            },
            features: {
              dark_mode: true,
              print: true,
              export_pdf: false,
              export_excel: false
            }
          });
          
          // Salvar no localStorage
          localStorage.setItem('auth_token', mockToken);
          localStorage.setItem('mock_user', JSON.stringify(mockUser));
          localStorage.setItem('presto_user', JSON.stringify(mockUser)); // ✅ CRÍTICO: getDefaultHeaders usa presto_user!
          localStorage.setItem('presto_domain', domain.toUpperCase());
          localStorage.setItem('presto_last_domain', domain.toUpperCase()); // ✅ Stick domain for logout redirect
          localStorage.setItem('presto_user_id', mockUser.id.toString());
          
          console.log('💾 [AuthContext] Usuário mock salvo no localStorage:', mockUser);
          console.log('💾 [AuthContext] presto_user salvo com unidade:', mockUser.unidade);
          
          // Configurar título
          const systemTitle = getSystemTitle(domain);
          document.title = systemTitle;
          
          // ✨ NÃO SETAR FAVICON AQUI - Deixar o App.tsx gerenciar
          console.log('🎨 [AuthContext] Favicon será gerenciado pelo App.tsx');
          
          console.log('✅ [AuthContext] Login MOCK realizado com sucesso!');
          return;
        } catch (mockError: any) {
          // Se mockLogin falhar, lançar erro
          console.error('❌ [AuthContext] mockLogin falhou:', mockError.message);
          throw new Error(mockError.message || 'Credenciais inválidas');
        }
      }
      
      // 🌐 BACKEND REAL (apenas quando NÃO for Figma Make)
      console.log('🌐 [AuthContext] Usando autenticação com BACKEND REAL');
      
      // ✅ PRODUÇÃO: Usar endpoint correto
      const endpoint = `${API_BASE_URL}/auth/login.php`;
      console.log('🔐 [AuthContext] Endpoint de login:', endpoint);
      console.log('🔐 [AuthContext] Enviando credenciais:', { domain, username, password: '***' });
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domain, username, password })
      });

      console.log('🔍 [AuthContext] Status da resposta:', response.status, response.statusText);
      console.log('🔍 [AuthContext] Response OK?', response.ok);
      console.log('🔍 [AuthContext] Content-Type:', response.headers.get('content-type'));
      
      // 🔥 CAPTURAR RESPOSTA RAW PRIMEIRO
      const rawText = await response.text();
      console.log('🔍 [AuthContext] RAW RESPONSE (primeiros 1000 chars):', rawText.substring(0, 1000));
      console.log('🔍 [AuthContext] RAW RESPONSE LENGTH:', rawText.length);
      
      // 🔥 CRÍTICO: Verificar se a resposta é JSON antes de parsear
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('❌ [AuthContext] Resposta não é JSON!');
        console.error('❌ [AuthContext] Content-Type:', contentType);
        console.error('❌ [AuthContext] Resposta completa:', rawText);
        
        throw new Error(`Erro no servidor: A API retornou HTML ao invés de JSON. Verifique se o endpoint ${endpoint} está correto e se o servidor PHP está funcionando.`);
      }
      
      // Parsear o texto como JSON
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.error('❌ [AuthContext] ERRO ao parsear JSON!');
        console.error('❌ [AuthContext] Resposta RAW:', rawText);
        throw new Error('Resposta inválida do servidor: ' + (e as Error).message);
      }
      
      console.log('🔍 [AuthContext] Dados recebidos do backend:');
      console.log('  - success:', data.success);
      console.log('  - token:', data.token ? data.token.substring(0, 20) + '...' : 'NENHUM');
      console.log('  - user:', data.user);
      console.log('  - user.nro_setor:', data.user?.nro_setor); // ✅ NOVO: Log específico do nro_setor
      console.log('  - debug:', data.debug);
      
      // Mostrar logs de debug no console
      if (data.debug && data.debug.logs) {
        console.log('📋 [DEBUG LOGS DO BACKEND]:');
        data.debug.logs.forEach((log: string) => console.log(log));
      } else {
        console.warn('⚠️ [AuthContext] Resposta não contém logs de debug!');
        console.warn('⚠️ [AuthContext] Estrutura recebida:', JSON.stringify(data, null, 2));
      }

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao fazer login');
      }

      if (data.success) {
        // ✅ ADICIONAR use_mock_data ao objeto user
        console.log('🔍 [AuthContext] domainInfo.data_source:', domainInfo.data_source);
        console.log('🔍 [AuthContext] use_mock_data será:', domainInfo.data_source === 'MOCK');
        
        const userWithMockFlag = {
          ...data.user,
          use_mock_data: domainInfo.data_source === 'MOCK' // ✅ Flag baseada no domínio
        };
        
        console.log('🔍 [AuthContext] userWithMockFlag:', userWithMockFlag);
        
        setUser(userWithMockFlag);
        setToken(data.token);
        setClientConfig(data.client_config || {
          modules: {
            overview: true,
            revenue: true,
            costs: true,
            lines: true,
            profitability: true
          },
          features: {
            dark_mode: true,
            print: true,
            export_pdf: false,
            export_excel: false
          }
        });
        
        console.log('🔍 [AuthContext] client_config recebido:', data.client_config);
        console.log('🔍 [AuthContext] favicon_url do client_config:', data.client_config?.favicon_url);
        
        // Salvar token e dados necessários para o apiService
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('presto_auth_token', data.token); // Para apiService
        localStorage.setItem('presto_domain', data.user.domain); // Para apiService
        localStorage.setItem('presto_last_domain', data.user.domain); // ✅ Stick domain for logout redirect
        localStorage.setItem('presto_user_id', data.user.id.toString()); // Para apiService
        
        // 🆕 SALVAR USUÁRIO COMPLETO COM use_mock_data NO LOCALSTORAGE
        localStorage.setItem('presto_user', JSON.stringify(userWithMockFlag));
        console.log('💾 [AuthContext] Usuário salvo no localStorage com use_mock_data:', userWithMockFlag.use_mock_data);
        
        // 🆕 SALVAR CLIENT_CONFIG NO LOCALSTORAGE
        if (data.client_config) {
          localStorage.setItem('presto_client_config', JSON.stringify(data.client_config));
          console.log('💾 [AuthContext] ClientConfig salvo no localStorage');
        }
        
        // 🆕 SALVAR COOKIES PARA BACKEND PHP
        setCookie('token', data.token, 1); // 1 dia
        setCookie('dominio', data.user.domain, 1);
        setCookie('usuario', data.user.username, 1);
        console.log('🍪 [AuthContext] Cookies salvos: token, dominio, usuario');
        
        // ✨ ATUALIZAR FAVICON: NÃO fazer nada aqui, deixar o App.tsx cuidar
        // O App.tsx vai usar clientConfig.favicon_url automaticamente
        console.log('🎨 [AuthContext] Favicon será atualizado pelo App.tsx usando clientConfig');
        
        console.log('✅ [AuthContext] Login bem-sucedido!');
      } else {
        throw new Error('Credenciais inválidas');
      }
    } catch (error: any) {
      console.error('❌ [AuthContext] Erro no login:', error);
      throw new Error(error.message || 'Erro ao conectar com o servidor');
    } finally {
      setLoading(false);
    }
  };

  // ✅ NOVO: Login direto com token (para auto-login via email)
  const loginWithToken = (authToken: string, userData: User, config: ClientConfig) => {
    console.log('🔐 [AuthContext] Login com token:', { userData, config });
    
    // Salvar token e dados do usuário
    setToken(authToken);
    setUser(userData);
    setClientConfig(config);
    
    // Persistir no localStorage
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('presto_user', JSON.stringify(userData));
    localStorage.setItem('presto_client_config', JSON.stringify(config));
    localStorage.setItem('presto_domain', userData.domain);
    localStorage.setItem('presto_last_domain', userData.domain); // ✅ Stick domain for logout redirect
    
    console.log('✅ [AuthContext] Login com token concluído');
  };

  const logout = async () => {
    try {
      // ✅ Recuperar domínio ANTES de limpar (para redirecionar corretamente)
      const storedDomain = localStorage.getItem('presto_domain');
      const USE_MOCK = storedDomain ? shouldUseMockData(storedDomain) : true;
      
      console.log('🚪 [AuthContext] === LOGOUT ===');
      console.log('🚪 [AuthContext] Domínio:', storedDomain);
      console.log('🚪 [AuthContext] Modo:', USE_MOCK ? 'MOCK' : 'BACKEND REAL');
      
      if (token && !USE_MOCK) {
        console.log('🌐 [AuthContext] Fazendo logout no backend...');
        await fetch(`${API_BASE_URL}/auth/logout.php`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } else {
        console.log('🎭 [AuthContext] Logout local (MOCK)');
      }
      
      // Limpar estado e localStorage ANTES do redirect
      setUser(null);
      setToken(null);
      setClientConfig(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('presto_auth_token');
      localStorage.removeItem('presto_domain');
      // ⚠️ NÃO REMOVER: presto_last_domain (usado para redirecionamento após logout)
      localStorage.removeItem('presto_user_id');
      localStorage.removeItem('mock_user');
      sessionStorage.removeItem('auth_verified');
      
      // 🆕 DELETAR COOKIES
      deleteCookie('token');
      deleteCookie('dominio');
      deleteCookie('usuario');
      console.log('🍪 [AuthContext] Cookies deletados');
      console.log('🧹 [AuthContext] Sessão limpa');
      
      // ✅ NÃO FAZER REDIRECIONAMENTO AQUI - Deixar o ProtectedRoute ou componente lidar
      
    } catch (error) {
      console.error('❌ [AuthContext] Erro ao fazer logout:', error);
      // Em caso de erro, ainda assim limpar estado
      setUser(null);
      setToken(null);
      setClientConfig(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('presto_auth_token');
      localStorage.removeItem('presto_domain');
      // ⚠️ NÃO REMOVER: presto_last_domain (usado para redirecionamento após logout)
      localStorage.removeItem('presto_user_id');
      localStorage.removeItem('mock_user');
      sessionStorage.removeItem('auth_verified');
      deleteCookie('token');
      deleteCookie('dominio');
      deleteCookie('usuario');
    }
  };

  const updateClientConfig = (config: ClientConfig) => {
    setClientConfig(config);
  };

  const changeUnidade = (novaUnidade: string) => {
    if (user && user.troca_unidade) {
      const updatedUser = {
        ...user,
        unidade_atual: novaUnidade
      };
      setUser(updatedUser);
      
      // ✅ Persistir no localStorage
      localStorage.setItem('presto_user', JSON.stringify(updatedUser));
      console.log('✅ [AuthContext] Unidade alterada para:', novaUnidade);
    } else if (user && !user.troca_unidade) {
      console.warn('⚠️ [AuthContext] Usuário não tem permissão para trocar de unidade');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      clientConfig, 
      loading, 
      login, 
      loginWithToken,
      logout, 
      updateClientConfig,
      changeUnidade
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}