import { API_URL } from '../config/api';
import { ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';

/**
 * Altera a senha do usuário atual
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const token = localStorage.getItem('auth_token'); // ✅ CORRIGIDO: usar 'auth_token'
  
  if (!token) {
    throw new Error('Não autenticado');
  }
  
  // No Figma Make, simular alteração
  if (ENVIRONMENT.isFigmaMake) {
    console.log('✅ [MOCK] Senha alterada com sucesso');
    return;
  }
  
  // ✅ Usar apiFetch para interceptar toasts automaticamente
  const data = await apiFetch(`${API_URL}/users/change-password.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword
    })
  });
  
  if (!data.success) {
    throw new Error(data.error || 'Erro ao alterar senha');
  }
}

/**
 * Altera o email do usuário atual
 * Requer senha para confirmar
 * Invalida todas as sessões após a alteração
 */
export async function changeEmail(newEmail: string, password: string): Promise<void> {
  const token = localStorage.getItem('auth_token'); // ✅ CORRIGIDO: usar 'auth_token'
  
  if (!token) {
    throw new Error('Não autenticado');
  }
  
  // No Figma Make, simular alteração
  if (ENVIRONMENT.isFigmaMake) {
    console.log('✅ [MOCK] Email alterado com sucesso');
    return;
  }
  
  // ✅ Usar apiFetch para interceptar toasts automaticamente
  const data = await apiFetch(`${API_URL}/users/change-email.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      new_email: newEmail,
      password: password
    })
  });
  
  if (!data.success) {
    throw new Error(data.error || 'Erro ao alterar email');
  }
}