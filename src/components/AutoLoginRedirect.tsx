import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';
import { ENVIRONMENT } from '../config/environment';

/**
 * ================================================================
 * AUTO-LOGIN REDIRECT
 * ================================================================
 * Gerencia redirecionamento de links de aprovação de orçamento
 * 
 * FLUXO CORRETO:
 * 1. Link: ?token=XXX&orcamento=4&domain=DMN
 * 2. Se usuário JÁ está logado → validar token → redirecionar para mapa
 * 3. Se usuário NÃO está logado → salvar params → redirecionar para LOGIN
 * 4. Após login manual → validar token → redirecionar para mapa
 * 
 * IMPORTANTE: NÃO faz auto-login! Token serve apenas para validar a solicitação!
 */

export function AutoLoginRedirect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const orcamento = searchParams.get('orcamento');
    const pedido = searchParams.get('pedido'); // ✅ NOVO: Suporte para pedidos
    const domain = searchParams.get('domain');

    console.log('🔍 [AutoLogin] Iniciando verificação');
    console.log('🔍 Token:', token);
    console.log('🔍 Orcamento:', orcamento);
    console.log('🔍 Pedido:', pedido);
    console.log('🔍 Domain:', domain);
    console.log('🔍 User:', user);

    // ✅ CASO 1A: Link de aprovação de ORÇAMENTO (tem token + orcamento)
    if (token && orcamento && domain) {
      console.log('📧 [AutoLogin] Link de aprovação de ORÇAMENTO detectado');

      // ✅ Se usuário JÁ está logado → validar e redirecionar
      if (user) {
        console.log('✅ [AutoLogin] Usuário já está logado, validando permissão...');
        validateAndRedirect(token, orcamento, domain, user, 'orcamento');
      } 
      // ❌ Se usuário NÃO está logado → salvar params e ir pro login
      else {
        console.log('🔐 [AutoLogin] Usuário não está logado, redirecionando para login...');
        
        // Salvar parâmetros no sessionStorage para recuperar após login
        sessionStorage.setItem('approval_token', token);
        sessionStorage.setItem('approval_orcamento', orcamento);
        sessionStorage.setItem('approval_domain', domain);
        
        // NÃO mostrar toast aqui - vai mostrar na tela de login
        redirectToLogin(domain);
      }
      
      return;
    }

    // ✅ CASO 1B: Link de aprovação de PEDIDO (tem token + pedido)
    if (token && pedido && domain) {
      console.log('📧 [AutoLogin] Link de aprovação de PEDIDO detectado');

      // ✅ Se usuário JÁ está logado → validar e redirecionar
      if (user) {
        console.log('✅ [AutoLogin] Usuário já está logado, validando permissão...');
        validateAndRedirect(token, pedido, domain, user, 'pedido');
      } 
      // ❌ Se usuário NÃO está logado → salvar params e ir pro login
      else {
        console.log('🔐 [AutoLogin] Usuário não está logado, redirecionando para login...');
        
        // Salvar parâmetros no sessionStorage para recuperar após login
        sessionStorage.setItem('approval_token', token);
        sessionStorage.setItem('approval_pedido', pedido);
        sessionStorage.setItem('approval_domain', domain);
        
        // NÃO mostrar toast aqui - vai mostrar na tela de login
        redirectToLogin(domain);
      }
      
      return;
    }

    // ✅ CASO 2: Sem token - apenas redirecionamento padrão
    if (user) {
      console.log('✅ [AutoLogin] Usuário logado sem token, indo para menu');
      
      // ✅ VERIFICAR SE HÁ PARÂMETROS SALVOS (após login manual)
      const savedToken = sessionStorage.getItem('approval_token');
      const savedOrcamento = sessionStorage.getItem('approval_orcamento');
      const savedPedido = sessionStorage.getItem('approval_pedido');
      const savedDomain = sessionStorage.getItem('approval_domain');
      
      if (savedToken && savedDomain) {
        console.log('🔄 [AutoLogin] Parâmetros encontrados no sessionStorage, validando...');
        
        // Limpar sessionStorage para evitar loops
        sessionStorage.removeItem('approval_token');
        sessionStorage.removeItem('approval_orcamento');
        sessionStorage.removeItem('approval_pedido');
        sessionStorage.removeItem('approval_domain');
        
        // Validar e redirecionar
        if (savedOrcamento) {
          validateAndRedirect(savedToken, savedOrcamento, savedDomain, user, 'orcamento');
        } else if (savedPedido) {
          validateAndRedirect(savedToken, savedPedido, savedDomain, user, 'pedido');
        }
        return;
      }
      
      navigate('/menu', { replace: true });
    } else {
      console.log('➡️ [AutoLogin] Sem usuário e sem token, indo para login');
      redirectToLogin(null);
    }

  }, [searchParams, user, navigate]);

  /**
   * Valida token de aprovação e redireciona para o mapa
   */
  async function validateAndRedirect(token: string, id: string, domain: string, currentUser: any, tipo: 'orcamento' | 'pedido') {
    if (validating) return;
    setValidating(true);

    try {
      // ✅ NOVO: Diferentes APIs para orçamento vs pedido
      const apiUrl = tipo === 'orcamento' 
        ? `${ENVIRONMENT.apiBaseUrl}/orcamentos/validar_token_aprovacao.php`
        : `${ENVIRONMENT.apiBaseUrl}/compras/pedidos_validar_token.php`;
      
      console.log(`📡 [AutoLogin] Validando token de aprovação de ${tipo}...`);

      const requestBody = tipo === 'orcamento'
        ? { 
            token_acesso: token, 
            seq_orcamento: parseInt(id),
            domain: domain
          }
        : {
            token_acesso: token,
            seq_pedido: parseInt(id),
            domain: domain
          };

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ [AutoLogin] Token válido! Redirecionando para ${tipo}...`);
        
        // Limpar sessionStorage
        sessionStorage.removeItem('approval_token');
        sessionStorage.removeItem('approval_orcamento');
        sessionStorage.removeItem('approval_pedido');
        sessionStorage.removeItem('approval_domain');
        
        // Redirecionar para a tela apropriada
        if (tipo === 'orcamento') {
          navigate(`/compras/orcamentos/mapa/${id}`, { 
            replace: true,
            state: { fromApprovalLink: true }
          });
        } else {
          // ✅ CORRIGIDO: Redirecionar para rota correta de visualização do pedido
          navigate(`/compras/pedidos/visualizar/${id}`, { 
            replace: true,
            state: { fromApprovalLink: true }
          });
        }
      } else {
        console.error('❌ [AutoLogin] Token inválido:', data.message);
        toast.error(data.message || 'Token de aprovação inválido ou expirado');
        navigate('/menu', { replace: true });
      }
    } catch (error) {
      console.error('❌ [AutoLogin] Erro ao validar token:', error);
      toast.error('Erro ao validar link de aprovação');
      navigate('/menu', { replace: true });
    } finally {
      setValidating(false);
    }
  }

  /**
   * Redireciona para tela de login apropriada
   */
  function redirectToLogin(domain: string | null) {
    const hostname = window.location.hostname;
    const isIPAccess = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
    const isAcevilleIP = hostname === '35.247.234.77';

    if (domain === 'ACV' || isIPAccess || isAcevilleIP) {
      navigate('/login-aceville', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400 font-medium text-lg">
          {validating ? 'Validando permissões...' : 'Redirecionando...'}
        </p>
      </div>
    </div>
  );
}