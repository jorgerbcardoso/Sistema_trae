import { toast } from 'sonner';
import { ENVIRONMENT } from '../config/environment';
import { 
  mockListarEstoques, 
  mockCriarEstoque, 
  mockAtualizarEstoque, 
  mockToggleEstoque 
} from '../mocks/estoqueMocks';
import {
  mockGetTiposItem,
  mockCreateTipoItem,
  mockUpdateTipoItem,
  mockGetEstoques,
  mockCreateEstoque,
  mockUpdateEstoque,
  mockGetUnidadesMedida,
  mockGetItens,
  mockCreateItem,
  mockUpdateItem,
  mockDeleteItem,
  mockGetInventarios,
  mockGetInventarioDetalhes,
  mockCreateInventario,
  mockUpdateInventarioContagens,
  mockFinalizarInventario,
  mockDeleteInventario
} from '../mocks/mockData';

/**
 * ================================================================
 * FUNÇÃO AUXILIAR: OBTER HEADERS PADRÃO PARA TODAS AS REQUISIÇÕES
 * ================================================================
 * Retorna headers padrão incluindo:
 * - Authorization (token)
 * - X-Domain (domínio do cliente)
 * - X-Unidade (unidade atual selecionada)
 * - Content-Type
 */
export function getDefaultHeaders(): HeadersInit {
  const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
  
  // Obter dados do usuário do localStorage
  const userStr = localStorage.getItem('presto_user');
  let domain = '';
  let unidade = '';
  
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      domain = user.domain || '';
      unidade = user.unidade_atual || user.unidade || '';
    } catch (e) {
      console.error('❌ [apiUtils] Erro ao parsear usuário do localStorage:', e);
    }
  }
  
  // Em localhost, não enviar headers customizados para evitar CORS
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
    ...(isLocalhost ? {} : {
      'X-Domain': domain,
      'X-Unidade': unidade
    })
  };
}

/**
 * Tipo de pergunta do backend
 */
export interface PHPQuestion {
  id: string;
  text: string;
  type: 'text' | 'textarea' | 'confirm' | 'number' | 'select' | 'evento';
  defaultValue?: any;
  options?: Array<{ value: string; label: string }>; // Para tipo 'select'
}

/**
 * Callback para quando o backend pedir input do usuário
 */
type QuestionCallback = (questions: PHPQuestion | PHPQuestion[], onAnswer: (answers: Record<string, any>) => void) => void;

let questionHandler: QuestionCallback | null = null;

/**
 * Registrar handler global para perguntas do backend
 * Deve ser chamado uma vez no App.tsx ou componente principal
 */
export function setQuestionHandler(handler: QuestionCallback) {
  questionHandler = handler;
}

/**
 * ================================================================
 * INTERCEPTOR GLOBAL DE RESPOSTAS DE API
 * ================================================================
 * Processa mensagens de toast vindas do PHP (função msg())
 * E processa perguntas interativas (função ask())
 * 
 * ✅ PADRÃO UNIVERSAL: Todas as respostas JSON são processadas aqui
 * 
 * @param response - Response da API
 * @param suppressToast - Se true, não exibe toasts automáticos (opcional)
 */
export async function handleAPIResponse(response: Response, suppressToast = false): Promise<any> {
  // ================================================================
  // 1. VERIFICAR SE A SESSÃO EXPIROU (401)
  // ================================================================
  if (response.status === 401) {
    console.error('❌ [apiUtils] Sessão expirada (401), fazendo logout automático...');
    
    // Limpar autenticação local
    localStorage.removeItem('auth_token');
    localStorage.removeItem('presto_auth_token');
    localStorage.removeItem('presto_domain');
    localStorage.removeItem('presto_user_id');
    localStorage.removeItem('presto_user');
    localStorage.removeItem('presto_client_config');
    localStorage.removeItem('mock_user');
    sessionStorage.removeItem('auth_verified');
    
    // Mostrar mensagem
    toast.error('Sua sessão expirou. Você será redirecionado para o login.', {
      duration: 3000
    });
    
    // Aguardar 1 segundo e redirecionar
    setTimeout(() => {
      const storedDomain = localStorage.getItem('presto_domain');
      if (storedDomain === 'ACV') {
        window.location.href = '/sistema/login-aceville';
      } else {
        window.location.href = '/sistema/login';
      }
    }, 1000);
    
    // Retornar erro
    return {
      success: false,
      error: 'Sessão expirada',
      authenticated: false
    };
  }
  
  // ================================================================
  // 2. VERIFICAR CONTENT-TYPE
  // ================================================================
  const contentType = response.headers.get('content-type');
  
  console.log('🔍 [apiUtils] Content-Type:', contentType);
  
  // Se não for JSON, retornar response original (ex: download de arquivo)
  if (!contentType || !contentType.includes('application/json')) {
    console.log('⚠️ [apiUtils] Não é JSON, retornando response original');
    
    // ✅ ADICIONAR LOG DO CONTEÚDO HTML PARA DEBUG
    const textContent = await response.clone().text();
    console.error('❌ [apiUtils] CONTEÚDO HTML RECEBIDO (provável erro PHP):', textContent);
    
    return response;
  }

  // ================================================================
  // 3. PARSEAR JSON
  // ================================================================
  const data = await response.json();
  
  console.log('📦 [apiUtils] Dados recebidos:', JSON.stringify(data, null, 2));
  
  // ================================================================
  // 4. INTERCEPTAR E EXIBIR TOAST (se houver)
  // ================================================================
  if (data.toast && !suppressToast) {
    const { message, type } = data.toast;
    
    console.log('🔔 [apiUtils] Toast detectado:', { message, type });
    
    // ✅ CONFIGURAÇÃO PADRÃO: closeButton ativo em TODOS os toasts
    const toastOptions = {
      closeButton: true
    };
    
    // Exibir toast de acordo com o tipo
    switch (type) {
      case 'success':
        toast.success(message, toastOptions);
        console.log('✅ [apiUtils] Toast de sucesso exibido');
        break;
      case 'error':
        toast.error(message, toastOptions);
        console.log('❌ [apiUtils] Toast de erro exibido');
        break;
      case 'warning':
        toast.warning(message, toastOptions);
        console.log('⚠️ [apiUtils] Toast de aviso exibido');
        break;
      case 'info':
      default:
        toast.info(message, toastOptions);
        console.log('ℹ️ [apiUtils] Toast de info exibido');
        break;
    }
    
    // ✅ MESCLAR dados extras do toast no data principal
    if (data.toast.extra_data) {
      console.log('📎 [apiUtils] Dados extras detectados no toast:', data.toast.extra_data);
      Object.assign(data, data.toast.extra_data);
    }
  } else if (data.success === false && !suppressToast) {
    // ✅ NOVO: Se não tem objeto toast, mas tem error ou message em uma resposta de erro, exibir como toast
    const errorMessage = data.error || data.message;
    if (errorMessage) {
      console.log('❌ [apiUtils] Erro detectado (sem objeto toast):', errorMessage);
      toast.error(errorMessage, { closeButton: true });
    }
  } else {
    console.log('⚠️ [apiUtils] Nenhum toast encontrado na resposta');
  }
  
  // ================================================================
  // 5. VERIFICAR SE O BACKEND ESTÁ PEDINDO INPUT DO USUÁRIO
  // ================================================================
  if (data.needsInput && questionHandler) {
    // Pode ser uma pergunta única ou múltiplas perguntas
    const questions = data.questions || data.question;
    
    if (!questions) {
      console.error('Backend solicitou input mas não enviou perguntas');
      return data;
    }
    
    // Criar uma Promise que será resolvida quando o usuário responder
    return new Promise((resolve) => {
      questionHandler!(questions, async (answers) => {
        console.log('📤 [apiUtils] Enviando respostas ao backend:', answers);
        
        // Refazer a requisição com as respostas
        const originalRequest = data.originalRequest;
        
        // ✅ ACUMULAR respostas - MERGE com respostas anteriores (_answers já existentes)
        const previousAnswers = originalRequest.body?._answers || {};
        const accumulatedAnswers = {
          ...previousAnswers,  // ← Respostas de ask() anteriores
          ...answers           // ← Novas respostas
        };
        
        console.log('📋 [apiUtils] Respostas anteriores:', previousAnswers);
        console.log('📋 [apiUtils] Novas respostas:', answers);
        console.log('✅ [apiUtils] Respostas acumuladas:', accumulatedAnswers);
        
        // Adicionar respostas acumuladas ao body original
        const newBody = {
          ...originalRequest.body,
          _answers: accumulatedAnswers  // ← TODAS as respostas acumuladas
        };
        
        console.log('🔄 [apiUtils] Refazendo requisição com respostas...');
        console.log('📦 [apiUtils] Body completo:', newBody);
        
        // Refazer a requisição
        try {
          const token = localStorage.getItem('token') || localStorage.getItem('auth_token');
          
          // Construir URL completa - originalRequest.url pode ser relativo
          const url = originalRequest.url.startsWith('http') 
            ? originalRequest.url 
            : `${window.location.origin}${originalRequest.url}`;
          
          // Preservar domain do body original
          const domain = originalRequest.body?.domain || '';
          
          const retryResponse = await fetch(url, {
            method: originalRequest.method,
            headers: {
              'Content-Type': 'application/json',
              'Authorization': token ? `Bearer ${token}` : '',
              'X-Domain': domain
            },
            body: JSON.stringify(newBody)
          });
          
          console.log('✅ [apiUtils] Resposta recebida após respostas');
          
          // Processar resposta recursivamente (pode haver mais perguntas)
          const result = await handleAPIResponse(retryResponse);
          resolve(result);
        } catch (error) {
          console.error('❌ [apiUtils] Erro ao reenviar requisição com respostas:', error);
          toast.error('Erro ao processar resposta');
          resolve(data);
        }
      });
    });
  }
  
  // ================================================================
  // 6. RETORNAR DADOS
  // ================================================================
  return data;
}

/**
 * ================================================================
 * WRAPPER PARA FETCH COM TRATAMENTO AUTOMÁTICO DE TOAST
 * ================================================================
 * ✅ USE ESTE EM TODAS AS CHAMADAS DE API
 * 
 * Inclui automaticamente:
 * - Authorization header (token)
 * - X-Domain header (domínio do cliente)
 * - X-Unidade header (unidade atual)
 * - Content-Type: application/json
 * 
 * @param url - URL da API
 * @param options - Opções do fetch
 * @param suppressToast - Se true, não exibe toasts automáticos (opcional)
 * 
 * Exemplo:
 *   const data = await apiFetch('/api/endpoint.php', { 
 *     method: 'POST', 
 *     body: JSON.stringify({...}) 
 *   }, true); // suppressToast = true
 */
export async function apiFetch(url: string, options?: RequestInit, suppressToast = false): Promise<any> {
  try {
    console.log('🌐 [apiFetch] Chamando:', url);
    console.log('🌐 [apiFetch] ENVIRONMENT.isFigmaMake:', ENVIRONMENT.isFigmaMake);
    
    // ✅ SE ESTIVER NO FIGMA MAKE, USAR MOCKS
    if (ENVIRONMENT.isFigmaMake) {
      console.log('🎭 [apiFetch] Modo FIGMA MAKE detectado - usando mocks');
      return await handleMockRequest(url, options);
    }
    
    // ✅ MERGE: Combinar headers padrão com headers personalizados
    const defaultHeaders = getDefaultHeaders();
    const customHeaders = options?.headers || {};
    
    const mergedOptions: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...customHeaders // Headers personalizados sobrescrevem os padrão se necessário
      }
    };
    
    console.log('📤 [apiFetch] Headers enviados:', mergedOptions.headers);
    
    const response = await fetch(url, mergedOptions);
    console.log('📥 [apiFetch] Resposta recebida:', response.status, response.statusText);
    return await handleAPIResponse(response, suppressToast);
  } catch (error) {
    console.error('❌ [apiFetch] Erro na requisição:', error);
    toast.error('Erro de comunicação com o servidor', { closeButton: true });
    throw error;
  }
}

/**
 * ================================================================
 * HANDLER DE REQUISIÇÕES MOCKADAS (FIGMA MAKE)
 * ================================================================
 */
async function handleMockRequest(url: string, options?: RequestInit): Promise<any> {
  console.log('🎭 [MOCK] Processando requisição mockada:', url);
  
  // Obter dados do usuário
  const userStr = localStorage.getItem('presto_user');
  let unidadeUsuario = '';
  let isMTZ = false;
  
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      unidadeUsuario = user.unidade_atual || user.unidade || '';
      isMTZ = unidadeUsuario.toUpperCase() === 'MTZ';
    } catch (e) {
      console.error('❌ [MOCK] Erro ao parsear usuário:', e);
    }
  }
  
  // Simular delay de rede
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // ✅ ROUTER DE MOCKS PARA ESTOQUES
  if (url.includes('/estoque/estoques.php')) {
    const method = options?.method || 'GET';
    
    // Extrair query params da URL
    const urlObj = new URL(url, window.location.origin);
    const params = new URLSearchParams(urlObj.search);
    
    if (method === 'GET') {
      // LISTAR ESTOQUES
      if (params.get('seq_estoque')) {
        // Buscar estoque específico - não implementado no mock ainda
        return { success: false, message: 'Mock não implementado para busca específica' };
      } else {
        // Listar todos
        return mockListarEstoques({
          unidade: params.get('unidade') || undefined,
          ativo: params.get('ativo') || undefined,
          unidadeUsuario,
          isMTZ
        });
      }
    } else if (method === 'POST') {
      // CRIAR ESTOQUE
      const body = options?.body ? JSON.parse(options.body as string) : {};
      return mockCriarEstoque(body);
    } else if (method === 'PUT') {
      // ATUALIZAR ESTOQUE
      const body = options?.body ? JSON.parse(options.body as string) : {};
      return mockAtualizarEstoque(body.seq_estoque, body);
    } else if (method === 'DELETE') {
      // INATIVAR/REATIVAR ESTOQUE
      const seq_estoque = parseInt(params.get('seq_estoque') || '0');
      const ativo = params.get('ativo') || 'N';
      return mockToggleEstoque(seq_estoque, ativo);
    }
  }
  
  // ✅ ROUTER DE MOCKS PARA TIPOS DE ITEM
  if (url.includes('/estoque/tipos_item.php')) {
    const method = options?.method || 'GET';
    
    if (method === 'GET') {
      return mockGetTiposItem();
    } else if (method === 'POST') {
      const body = options?.body ? JSON.parse(options.body as string) : {};
      return mockCreateTipoItem(body);
    } else if (method === 'PUT') {
      const body = options?.body ? JSON.parse(options.body as string) : {};
      return mockUpdateTipoItem(body);
    }
  }
  
  // ✅ ROUTER DE MOCKS PARA UNIDADES DE MEDIDA
  if (url.includes('/estoque/unidades_medida.php')) {
    const method = options?.method || 'GET';
    
    if (method === 'GET') {
      return mockGetUnidadesMedida();
    }
  }
  
  // ✅ ROUTER DE MOCKS PARA ITENS
  if (url.includes('/estoque/itens.php')) {
    const method = options?.method || 'GET';
    
    // Extrair query params da URL
    const urlObj = new URL(url, window.location.origin);
    const params = new URLSearchParams(urlObj.search);
    
    if (method === 'GET') {
      // LISTAR ITENS
      if (params.get('seq_item')) {
        // Buscar item específico - não implementado no mock ainda
        return { success: false, message: 'Mock não implementado para busca específica' };
      } else {
        // Listar todos
        return mockGetItens({
          unidade: params.get('unidade') || undefined,
          ativo: params.get('ativo') || undefined,
          unidadeUsuario,
          isMTZ
        });
      }
    } else if (method === 'POST') {
      // CRIAR ITEM
      const body = options?.body ? JSON.parse(options.body as string) : {};
      return mockCreateItem(body);
    } else if (method === 'PUT') {
      // ATUALIZAR ITEM
      const body = options?.body ? JSON.parse(options.body as string) : {};
      return mockUpdateItem(body.seq_item, body);
    } else if (method === 'DELETE') {
      // EXCLUIR ITEM
      const seq_item = parseInt(params.get('seq_item') || '0');
      return mockDeleteItem(seq_item);
    }
  }
  
  // ✅ ROUTER DE MOCKS PARA INVENTÁRIOS
  if (url.includes('/estoque/inventarios.php')) {
    const method = options?.method || 'GET';
    const body = options?.body ? JSON.parse(options.body as string) : {};
    const effectiveMethod = body._method || method;
    
    // Extrair query params da URL
    const urlObj = new URL(url, window.location.origin);
    const params = new URLSearchParams(urlObj.search);
    
    if (effectiveMethod === 'GET') {
      // LISTAR INVENTÁRIOS
      return mockGetInventarios({
        status: params.get('status') || undefined,
        seq_estoque: params.get('seq_estoque') || undefined
      });
    } else if (effectiveMethod === 'GET_DETALHES') {
      // OBTER DETALHES DE INVENTÁRIO
      return mockGetInventarioDetalhes(body.seq_inventario);
    } else if (effectiveMethod === 'POST' || method === 'POST') {
      // CRIAR INVENTÁRIO
      return mockCreateInventario(body);
    } else if (effectiveMethod === 'PUT') {
      // ATUALIZAR CONTAGENS
      return mockUpdateInventarioContagens(body);
    } else if (effectiveMethod === 'FINALIZAR') {
      // FINALIZAR INVENTÁRIO
      return mockFinalizarInventario(body.seq_inventario);
    } else if (effectiveMethod === 'DELETE') {
      // CANCELAR INVENTÁRIO
      return mockDeleteInventario(body.seq_inventario);
    }
  }
  
  // ✅ ROUTER DE MOCKS PARA SETORES
  if (url.includes('/admin/setores.php')) {
    const method = options?.method || 'GET';
    
    if (method === 'GET') {
      // LISTAR SETORES
      return {
        success: true,
        setores: [
          { nro_setor: 1, descricao: 'COMPRAS', efetua_compras: true },
          { nro_setor: 2, descricao: 'MANUTENÇÃO', efetua_compras: true },
          { nro_setor: 3, descricao: 'ADMINISTRAÇÃO', efetua_compras: true },
          { nro_setor: 4, descricao: 'OPERACIONAL', efetua_compras: false },
          { nro_setor: 5, descricao: 'FINANCEIRO', efetua_compras: false },
          { nro_setor: 6, descricao: 'RH', efetua_compras: false },
          { nro_setor: 7, descricao: 'TI', efetua_compras: true }
        ]
      };
    }
  }
  
  // Se não matchear nenhuma rota, retornar erro
  console.warn('⚠️ [MOCK] Rota não mockada:', url);
  return { 
    success: false, 
    message: 'Mock não implementado para esta rota' 
  };
}