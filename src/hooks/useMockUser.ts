/**
 * Hook para simular troca de usuário/unidade no Figma Make
 * Permite testar o comportamento do sistema com diferentes unidades
 */

import { useEffect } from 'react';
import { ENVIRONMENT } from '../config/environment';

export function useMockUser() {
  useEffect(() => {
    // Só configurar mock user se estiver no Figma Make e não houver usuário logado
    if (ENVIRONMENT.isFigmaMake && !localStorage.getItem('auth_token')) {
      console.log('🎭 [useMockUser] Configurando usuário mockado para Figma Make');
      
      // 🔥 Criar usuário mock com unidade PIN (NÃO-MTZ) para testar bloqueios
      const mockUser = {
        id: 1,
        user_id: 1,
        username: 'DEMO',
        email: 'demo@webpresto.com.br',
        full_name: 'Usuário Demo',
        is_admin: false,
        is_super_admin: false,
        domain: 'DEMO',
        client_id: 1,
        client_name: 'Cliente Demo',
        unidade: 'PIN', // 🔥 UNIDADE NÃO-MTZ para testar bloqueio!
        unidade_atual: 'PIN', // 🔥 Unidade atual selecionada
        troca_unidade: false // 🔥 NÃO pode trocar de unidade (para testar bloqueio)
      };
      
      // 🔥 SETAR TODOS OS TOKENS NECESSÁRIOS
      localStorage.setItem('presto_user', JSON.stringify(mockUser));
      localStorage.setItem('auth_token', 'mock_token_figma_make');
      localStorage.setItem('mock_user', JSON.stringify(mockUser));
      localStorage.setItem('presto_domain', 'DEMO');
      
      console.log('✅ [useMockUser] Usuário mockado configurado (UNIDADE PIN):', mockUser);
    }
  }, []);
}