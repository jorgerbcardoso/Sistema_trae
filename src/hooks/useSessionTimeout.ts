import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ENVIRONMENT } from '../config/environment';
import { toast } from 'sonner';

/**
 * ================================================================
 * HOOK DE TIMEOUT DE SESSÃO
 * ================================================================
 * Monitora atividade do usuário e expira a sessão após 36 horas de inatividade
 * 
 * FUNCIONALIDADES:
 * - ✅ Detecta atividade do usuário (mouse, teclado, scroll, touch)
 * - ✅ Reseta timer a cada atividade
 * - ✅ Verifica sessão no backend a cada 5 minutos
 * - ✅ Logout automático após 36 horas de inatividade
 * - ✅ Aviso 5 minutos antes de expirar
 * - ✅ Detecta sessão expirada no backend e faz logout imediato
 */

const INACTIVITY_TIMEOUT = 36 * 60 * 60 * 1000; // 36 horas em milissegundos
const WARNING_BEFORE_TIMEOUT = 5 * 60 * 1000; // Aviso 5 minutos antes
const BACKEND_CHECK_INTERVAL = 5 * 60 * 1000; // Verificar backend a cada 5 minutos

export function useSessionTimeout() {
  // ✅ TODOS OS HOOKS DEVEM VIR PRIMEIRO (Rules of Hooks)
  const lastActivityRef = useRef<number>(Date.now());
  const warningShownRef = useRef<boolean>(false);
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const backendCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isLoggingOutRef = useRef<boolean>(false); // 🆕 Proteção contra logout múltiplo
  
  // ✅ SEGURANÇA: Verificar se AuthContext está disponível
  let auth;
  let user = null;
  let logout = async () => {};
  
  try {
    auth = useAuth();
    user = auth.user;
    logout = auth.logout;
  } catch (error) {
    console.warn('⚠️ [useSessionTimeout] AuthContext não disponível ainda, pulando...');
    // Não retornar aqui - continuar mas não fazer nada
  }
  
  /**
   * Verifica se a sessão está válida no backend
   */
  const checkBackendSession = useCallback(async () => {
    // Não verificar em modo mock/Figma
    if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
      return true;
    }

    try {
      const token = localStorage.getItem('auth_token');
      
      if (!token) {
        console.log('⚠️ [SessionTimeout] Sem token, fazendo logout...');
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          await logout();
        }
        return false;
      }

      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/auth/verify.php`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok || response.status === 401) {
        console.log('❌ [SessionTimeout] Sessão expirada no backend (status ' + response.status + '), fazendo logout...');
        toast.error('Sua sessão expirou. Faça login novamente.');
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          await logout();
        }
        return false;
      }

      const data = await response.json();

      if (!data.authenticated) {
        console.log('❌ [SessionTimeout] Sessão não autenticada no backend, fazendo logout...');
        toast.error('Sua sessão expirou. Faça login novamente.');
        if (!isLoggingOutRef.current) {
          isLoggingOutRef.current = true;
          await logout();
        }
        return false;
      }

      console.log('✅ [SessionTimeout] Sessão válida no backend');
      return true;
    } catch (error) {
      console.error('❌ [SessionTimeout] Erro ao verificar sessão no backend:', error);
      // Em caso de erro de rede, não fazer logout automático
      // Apenas logar o erro
      return true;
    }
  }, [logout]);

  /**
   * Mostra aviso de inatividade
   */
  const showInactivityWarning = useCallback(() => {
    if (!warningShownRef.current) {
      console.log('⚠️ [SessionTimeout] Mostrando aviso de inatividade');
      toast.warning('Você será desconectado em 5 minutos por inatividade.', {
        duration: 10000
      });
      warningShownRef.current = true;
    }
  }, []);

  /**
   * Executa logout por inatividade
   */
  const handleInactivityLogout = useCallback(async () => {
    console.log('⏰ [SessionTimeout] Timeout de inatividade atingido, fazendo logout...');
    toast.error('Você foi desconectado por inatividade.');
    if (!isLoggingOutRef.current) {
      isLoggingOutRef.current = true;
      await logout();
    }
  }, [logout]);

  /**
   * Reseta os timers de inatividade
   */
  const resetInactivityTimers = useCallback(() => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;

    // Só resetar se passou mais de 10 segundos desde a última atividade
    // Evita resetar a cada pixel de movimento do mouse
    if (timeSinceLastActivity < 10000) {
      return;
    }

    console.log('🔄 [SessionTimeout] Atividade detectada, resetando timers');
    lastActivityRef.current = now;
    warningShownRef.current = false;

    // Limpar timers existentes
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
    }
    if (warningTimeoutIdRef.current) {
      clearTimeout(warningTimeoutIdRef.current);
    }

    // Configurar novo timer de aviso
    warningTimeoutIdRef.current = setTimeout(() => {
      showInactivityWarning();
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE_TIMEOUT);

    // Configurar novo timer de logout
    timeoutIdRef.current = setTimeout(() => {
      handleInactivityLogout();
    }, INACTIVITY_TIMEOUT);
  }, [showInactivityWarning, handleInactivityLogout]);

  /**
   * Setup dos listeners e timers
   */
  useEffect(() => {
    // Só ativar se o usuário estiver logado
    if (!user) {
      return;
    }

    console.log('✅ [SessionTimeout] Iniciando monitoramento de sessão');

    // Eventos que indicam atividade do usuário
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    // Adicionar listeners de atividade
    activityEvents.forEach(event => {
      document.addEventListener(event, resetInactivityTimers, { passive: true });
    });

    // Iniciar timers iniciais
    resetInactivityTimers();

    // Iniciar verificação periódica no backend
    backendCheckIntervalRef.current = setInterval(() => {
      console.log('🔍 [SessionTimeout] Verificando sessão no backend...');
      checkBackendSession();
    }, BACKEND_CHECK_INTERVAL);

    // Verificação imediata
    checkBackendSession();

    // Cleanup
    return () => {
      console.log('🧹 [SessionTimeout] Limpando monitoramento de sessão');
      
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetInactivityTimers);
      });

      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
      if (warningTimeoutIdRef.current) {
        clearTimeout(warningTimeoutIdRef.current);
      }
      if (backendCheckIntervalRef.current) {
        clearInterval(backendCheckIntervalRef.current);
      }
    };
  }, [user, resetInactivityTimers, checkBackendSession]);

  return {
    resetTimer: resetInactivityTimers
  };
}