import { useEffect, useRef } from 'react';

interface UseInactivityTimeoutOptions {
  /**
   * Tempo de inatividade em milissegundos antes de executar o callback
   * @default 7200000 (2 horas)
   */
  timeout?: number;
  
  /**
   * Callback executado quando o timeout de inatividade é atingido
   */
  onTimeout: () => void;
  
  /**
   * Se deve monitorar eventos do usuário
   * @default true
   */
  enabled?: boolean;
}

/**
 * Hook que detecta inatividade do usuário e executa um callback após o timeout
 * 
 * Monitora os seguintes eventos:
 * - mousemove: movimento do mouse
 * - mousedown: cliques do mouse
 * - keydown: teclas pressionadas
 * - touchstart: toques na tela (mobile)
 * - scroll: rolagem da página
 * 
 * @example
 * ```tsx
 * useInactivityTimeout({
 *   timeout: 7200000, // 2 horas
 *   onTimeout: () => logout(),
 *   enabled: !!user
 * });
 * ```
 */
export function useInactivityTimeout({
  timeout = 7200000, // 2 horas por padrão
  onTimeout,
  enabled = true
}: UseInactivityTimeoutOptions) {
  const timeoutIdRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  // Atualizar ref do callback
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    // Se não estiver habilitado, não fazer nada
    if (!enabled) {
      return;
    }

    // Função para resetar o timer de inatividade
    const resetTimer = () => {
      // Limpar timeout anterior se existir
      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }

      // Criar novo timeout
      timeoutIdRef.current = setTimeout(() => {
        onTimeoutRef.current();
      }, timeout);
    };

    // Eventos que indicam atividade do usuário
    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll'
    ];

    // Adicionar listeners para todos os eventos
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Iniciar o timer pela primeira vez
    resetTimer();

    // Cleanup: remover listeners e limpar timeout
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });

      if (timeoutIdRef.current) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [timeout, enabled]);
}
