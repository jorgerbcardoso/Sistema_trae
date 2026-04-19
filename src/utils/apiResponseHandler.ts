/**
 * HANDLER DE RESPOSTAS DA API
 * 
 * Processa respostas da API PHP que podem conter mensagens toast
 * com diferentes tipos (success, error, warning, info)
 */

import { toast } from 'sonner';

export interface ApiResponse {
  success: boolean;
  message?: string;
  toast?: {
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
  };
  [key: string]: any;
}

/**
 * Processa resposta da API e exibe toast apropriado se necessário
 * 
 * @param data Resposta da API
 * @param defaultSuccessMessage Mensagem padrão para sucesso (se não houver toast)
 * @param defaultErrorMessage Mensagem padrão para erro (se não houver toast)
 * @returns true se deve continuar processamento, false se deve parar
 */
export function handleApiResponse(
  data: ApiResponse,
  defaultSuccessMessage?: string,
  defaultErrorMessage?: string
): boolean {
  // Se tem toast na resposta, exibir e parar
  if (data.toast) {
    const toastType = data.toast.type || 'info';
    const message = data.toast.message;
    
    console.log(`🎨 [ApiResponse] Toast tipo: ${toastType}, mensagem: ${message}`);
    
    // Exibir toast com cor apropriada
    switch (toastType) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      case 'info':
      default:
        toast.info(message);
        break;
    }
    
    // Parar processamento se é uma mensagem de erro via toast
    return data.success === true;
  }
  
  // Se não tem toast, processar mensagem normal
  if (data.success) {
    if (defaultSuccessMessage) {
      toast.success(defaultSuccessMessage);
    }
    return true;
  } else {
    const errorMsg = data.error || data.message || defaultErrorMessage || 'Erro ao processar requisição';
    toast.error(errorMsg);
    return false;
  }
}

/**
 * Exibe toast baseado no tipo
 */
export function showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  switch (type) {
    case 'success':
      toast.success(message);
      break;
    case 'error':
      toast.error(message);
      break;
    case 'warning':
      toast.warning(message);
      break;
    case 'info':
    default:
      toast.info(message);
      break;
  }
}