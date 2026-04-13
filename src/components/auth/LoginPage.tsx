import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, LogIn, Eye, EyeOff, Building2, User, Lock, HelpCircle, Mail, MessageCircle, Key } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { ImageWithFallback } from '../figma/ImageWithFallback';

export function LoginPage() {
  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [showSecretDialog, setShowSecretDialog] = useState(false);
  const [secretPassword, setSecretPassword] = useState('');
  const [secretError, setSecretError] = useState('');
  const [clientConfig, setClientConfig] = useState<any>(null);
  
  // ✅ Detectar se o navegador está em modo claro
  const [isBrowserLight, setIsBrowserLight] = useState(false);

  useEffect(() => {
    // Verificar preferência inicial
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    setIsBrowserLight(mediaQuery.matches);

    // Ouvir mudanças em tempo real
    const handler = (e: MediaQueryListEvent) => setIsBrowserLight(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  // ✅ Buscar config do domínio para carregar logos prioritárias
  useEffect(() => {
    const fetchDomainConfig = async () => {
      if (domain.length === 3) {
        try {
          const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/domains/check.php?domain=${domain.toUpperCase()}`);
          const data = await response.json();
          if (data.success && data.domain) {
            const config: any = {};
            if (data.domain.logo_light || data.domain.logo_dark) {
              config.theme = {
                logo_light: data.domain.logo_light,
                logo_dark: data.domain.logo_dark
              };
            }
            setClientConfig(config);
          } else {
            setClientConfig(null);
          }
        } catch (error) {
          console.warn('⚠️ [Login] Erro ao carregar config do domínio:', error);
          setClientConfig(null);
        }
      } else {
        setClientConfig(null);
      }
    };

    fetchDomainConfig();
  }, [domain]);

  // ✅ SEMPRE chamar hooks antes de qualquer return condicional
  const navigate = useNavigate();
  
  // ✅ SEGURANÇA: Verificar se AuthContext está disponível
  let auth;
  try {
    auth = useAuth();
  } catch (error) {
    console.warn('⚠️ [LoginPage] AuthContext não disponível ainda');
    // Retornar loading state temporário
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Carregando...</span>
        </div>
      </div>
    );
  }
  
  const { login, user } = auth;

  // Carregar valores salvos do localStorage
  useEffect(() => {
    // Recuperar último domínio e usuário
    const savedDomain = localStorage.getItem('last_domain');
    const savedUsername = localStorage.getItem('last_username');
    if (savedDomain) setDomain(savedDomain);
    if (savedUsername) setUsername(savedUsername);
    
    // ✅ Verificar se tem link de aprovação pendente
    // Toast SÓ aparece se usuário NÃO está logado (precisa fazer login)
    const approvalToken = sessionStorage.getItem('approval_token');
    const approvalOrcamento = sessionStorage.getItem('approval_orcamento');
    const approvalDomain = sessionStorage.getItem('approval_domain');
    
    if (approvalToken && approvalOrcamento && approvalDomain && !user) {
      // 🔥 CRÍTICO: Toast só aparece se usuário NÃO está logado
      toast.info('Faça login para acessar o orçamento solicitado', {
        description: `Orçamento #${approvalOrcamento}`,
        duration: 5000
      });
    }
  }, []); // ✅ Roda apenas UMA VEZ na montagem inicial

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Salvar domínio e usuário no localStorage para próximo login
      localStorage.setItem('last_domain', domain);
      localStorage.setItem('last_username', username);
      
      await login(domain, username, password);
      
      // ✅ VERIFICAR SE TEM LINK DE APROVAÇÃO PENDENTE
      const approvalToken = sessionStorage.getItem('approval_token');
      const approvalOrcamento = sessionStorage.getItem('approval_orcamento');
      const approvalDomain = sessionStorage.getItem('approval_domain');
      
      if (approvalToken && approvalOrcamento && approvalDomain) {
        console.log('🔐 [Login] Link de aprovação detectado, validando token...');
        
        // Validar token e redirecionar
        await validateApprovalToken(approvalToken, approvalOrcamento, approvalDomain);
      } else {
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Valida token de aprovação após login bem-sucedido
   */
  async function validateApprovalToken(token: string, orcamento: string, domain: string) {
    try {
      const apiUrl = `${ENVIRONMENT.apiBaseUrl}/orcamentos/validar_token_aprovacao.php`;
      
      console.log('📡 [Login] Validando token de aprovação...');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ 
          token_acesso: token, 
          seq_orcamento: parseInt(orcamento),
          domain: domain  // ✅ CORRETO - API espera 'domain', não 'dominio'
        }),
      });

      const data = await response.json();

      if (data.success) {
        console.log('✅ [Login] Token válido! Redirecionando para mapa...');
        
        // Limpar sessionStorage
        sessionStorage.removeItem('approval_token');
        sessionStorage.removeItem('approval_orcamento');
        sessionStorage.removeItem('approval_domain');
        
        // Redirecionar para o mapa
        navigate(`/compras/orcamentos/mapa/${orcamento}`, { 
          replace: true,
          state: { fromApprovalLink: true }
        });
      } else {
        console.error('❌ [Login] Token inválido:', data.message);
        toast.error(data.message || 'Token de aprovação inválido ou expirado');
        
        // Limpar sessionStorage
        sessionStorage.removeItem('approval_token');
        sessionStorage.removeItem('approval_orcamento');
        sessionStorage.removeItem('approval_domain');
        
        navigate('/menu', { replace: true });
      }
    } catch (error) {
      console.error('❌ [Login] Erro ao validar token:', error);
      toast.error('Erro ao validar link de aprovação');
      
      // Limpar sessionStorage
      sessionStorage.removeItem('approval_token');
      sessionStorage.removeItem('approval_orcamento');
      sessionStorage.removeItem('approval_domain');
      
      navigate('/menu', { replace: true });
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault(); // ✅ Prevenir reload da página
    
    if (!domain) {
      setError('Digite o domínio');
      return;
    }
    
    if (!email) {
      setError('Digite seu email');
      return;
    }

    setIsLoading(true);
    setError(''); // Limpar erros anteriores
    setResetMessage(''); // Limpar mensagens anteriores

    try {
      // No Figma Make, simular envio
      if (ENVIRONMENT.isFigmaMake) {
        setResetMessage('Se o email existir em nossa base, você receberá um link para redefinir sua senha');
        setIsLoading(false);
        return;
      }
      
      // 🔥 USAR ENDPOINT CORRETO - /auth/forgot-password.php
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/auth/forgot-password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email,
          domain: domain.toUpperCase()
        })
      });
      
      const data = await response.json();

      if (data.success) {
        setResetMessage(data.message || 'Se o email existir em nossa base, você receberá um link para redefinir sua senha');
        setError('');
      } else {
        setError(data.message || 'Erro ao solicitar recuperação de senha');
      }
    } catch (err: any) {
      console.error('❌ [Login] Erro ao solicitar recuperação de senha:', err);
      setError('Erro ao conectar com o servidor. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSecretLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setSecretError('');
    
    // Verificar senha secreta
    if (secretPassword === 'Presto2!') {
      // Senha correta - redirecionar para login da Aceville
      navigate('/login-aceville');
    } else {
      setSecretError('Senha incorreta');
    }
  };

  if (showForgotPassword) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
        style={{ backgroundImage: 'url(https://webpresto.com.br/images/fundo-site.png)' }}
      >
        {/* Overlay - CLARO ou ESCURO baseado no navegador */}
        <div className={`absolute inset-0 ${isBrowserLight ? 'bg-white/60' : 'bg-black/60'}`}></div>
        
        <Card className={`w-full max-w-md shadow-2xl relative z-10 backdrop-blur-md border ${
          isBrowserLight 
            ? 'bg-white/50 border-white/20' 
            : 'bg-slate-900/75 border-slate-700'
        }`}>
          {/* Botão de Ajuda */}
          <div className="absolute top-[13px] right-[13px] z-20">
            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={`h-10 w-10 rounded-full cursor-pointer p-0 ${
                  isBrowserLight
                    ? 'bg-slate-100/80 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white'
                }`}
                onClick={() => setShowHelp(!showHelp)}
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
              
              {showHelp && (
                <div className={`absolute top-12 right-0 w-56 border rounded-lg shadow-xl p-2 z-20 ${
                  isBrowserLight
                    ? 'bg-white border-slate-200'
                    : 'bg-slate-800 border-slate-700'
                }`}>
                  <a
                    href="mailto:contato@webpresto.com.br"
                    className={`flex items-center gap-3 px-3 py-2 rounded transition-colors no-underline cursor-pointer ${
                      isBrowserLight
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-200 hover:bg-slate-700'
                    }`}
                    onClick={() => setShowHelp(false)}
                  >
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">Email</span>
                  </a>
                  <a
                    href="https://wa.me/5563991330276"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 px-3 py-2 rounded transition-colors no-underline cursor-pointer ${
                      isBrowserLight
                        ? 'text-slate-700 hover:bg-slate-100'
                        : 'text-slate-200 hover:bg-slate-700'
                    }`}
                    onClick={() => setShowHelp(false)}
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span className="text-sm">WhatsApp</span>
                  </a>
                </div>
              )}
            </div>
          </div>
          
          <CardHeader className="space-y-1 text-center" style={{ paddingTop: '60px' }}>
            <div className="flex justify-center mb-6">
            <ImageWithFallback
              src={getLogoUrl(domain, isBrowserLight ? 'light' : 'dark', clientConfig)}
              alt="Logo"
              className="h-16 object-contain"
            />
          </div>
            <CardTitle className={`text-2xl ${isBrowserLight ? 'text-slate-900' : 'text-white'}`}>Recuperar Senha</CardTitle>
            <CardDescription className={`text-sm ${isBrowserLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Digite seu email e domínio para receber o link de recuperação
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleForgotPassword}>
            <CardContent className="space-y-4 pt-6">
              {error && (
                <Alert variant="destructive" className={`${isBrowserLight ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {resetMessage && (
                <Alert className={`${isBrowserLight ? 'bg-green-50 border-green-200 text-green-800' : 'bg-green-900/20 border-green-800 text-green-300'}`}>
                  <AlertDescription className="whitespace-pre-wrap">{resetMessage}</AlertDescription>
                </Alert>
              )}
              <div className="relative">
                <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="forgot-domain"
                  type="text"
                  placeholder="Domínio"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value.toUpperCase())}
                  className={`pl-10 uppercase ${
                    isBrowserLight 
                      ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400' 
                      : 'bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400'
                  }`}
                  maxLength={3}
                  required
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <div className="pb-6">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`pl-10 ${
                      isBrowserLight 
                        ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400' 
                        : 'bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400'
                    }`}
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Solicitar Recuperação'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={`w-full cursor-pointer ${
                  isBrowserLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
                onClick={() => setShowForgotPassword(false)}
                disabled={isLoading}
              >
                Voltar ao Login
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(https://webpresto.com.br/images/fundo-site.png)' }}
    >
      {/* Overlay - CLARO ou ESCURO baseado no navegador */}
      <div className={`absolute inset-0 ${isBrowserLight ? 'bg-white/60' : 'bg-black/60'}`}></div>
      
      <Card className={`w-full max-w-md shadow-2xl relative z-10 backdrop-blur-md border ${
        isBrowserLight 
          ? 'bg-white/50 border-white/20' 
          : 'bg-slate-900/75 border-slate-700'
      }`}>
        {/* Botão de Ajuda */}
        <div className="absolute top-[13px] right-[13px] z-20">
          <div className="relative">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={`h-10 w-10 rounded-full cursor-pointer p-0 ${
                isBrowserLight
                  ? 'bg-slate-100/80 hover:bg-slate-200 text-slate-600 hover:text-slate-900'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white'
              }`}
              onClick={() => setShowHelp(!showHelp)}
            >
              <HelpCircle className="h-5 w-5" />
            </Button>
            
            {showHelp && (
              <div className={`absolute top-12 right-0 w-56 border rounded-lg shadow-xl p-2 z-20 ${
                isBrowserLight
                  ? 'bg-white border-slate-200'
                  : 'bg-slate-800 border-slate-700'
              }`}>
                <a
                  href="mailto:contato@webpresto.com.br"
                  className={`flex items-center gap-3 px-3 py-2 rounded transition-colors no-underline cursor-pointer ${
                    isBrowserLight
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                  onClick={() => setShowHelp(false)}
                >
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">Email</span>
                </a>
                <a
                  href="https://wa.me/5563991330276"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 px-3 py-2 rounded transition-colors no-underline cursor-pointer ${
                    isBrowserLight
                      ? 'text-slate-700 hover:bg-slate-100'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                  onClick={() => setShowHelp(false)}
                >
                  <MessageCircle className="h-4 w-4" />
                  <span className="text-sm">WhatsApp</span>
                </a>
              </div>
            )}
          </div>
        </div>
        
        <CardHeader className="space-y-1 text-center" style={{ paddingTop: '60px' }}>
          <div className="flex justify-center mb-6">
            <ImageWithFallback
              src={getLogoUrl(domain, isBrowserLight ? 'light' : 'dark', clientConfig)}
              alt="Logo"
              className="h-20 object-contain"
            />
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 relative">
            {error && (
              <Alert variant="destructive" className={`${isBrowserLight ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="relative">
              <Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="domain"
                type="text"
                placeholder="Domínio"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className={`pl-10 ${
                  isBrowserLight 
                    ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400' 
                    : 'bg-background/50 border-border text-foreground placeholder:text-muted-foreground'
                }`}
                maxLength={3}
                required
                disabled={isLoading}
                autoFocus
              />
            </div>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="username"
                type="text"
                placeholder="Login"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`pl-10 ${
                  isBrowserLight 
                    ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400' 
                    : 'bg-background/50 border-border text-foreground placeholder:text-muted-foreground'
                }`}
                required
                disabled={isLoading}
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type="password"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`pl-10 ${
                  isBrowserLight 
                    ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400' 
                    : 'bg-background/50 border-border text-foreground placeholder:text-muted-foreground'
                }`}
                required
                disabled={isLoading}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-6">
            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={isLoading}
              variant="default"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
            
            <button
              type="button"
              className={`w-full text-sm transition-colors cursor-pointer bg-transparent border-none ${
                isBrowserLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-300 hover:text-white'
              }`}
              onClick={() => setShowForgotPassword(true)}
              disabled={isLoading}
            >
              Esqueci minha senha
            </button>
          </CardFooter>
        </form>
      </Card>
      
      <Dialog open={showSecretDialog} onOpenChange={setShowSecretDialog}>
        <DialogContent className={`sm:max-w-[425px] border backdrop-blur-md ${
          isBrowserLight 
            ? 'bg-white/70 border-white/20 text-slate-900' 
            : 'bg-slate-900/80 border-slate-700 text-white'
        }`}>
          <DialogHeader>
            <DialogTitle className={`text-xl ${isBrowserLight ? 'text-slate-900' : 'text-white'}`}>Login Secreto</DialogTitle>
            <DialogDescription className={`text-sm ${isBrowserLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Digite a senha secreta para acessar o sistema.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSecretLogin}>
            <CardContent className="space-y-4">
              {secretError && (
                <Alert variant="destructive" className={`${isBrowserLight ? 'bg-red-50 border-red-200 text-red-800' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                  <AlertDescription>{secretError}</AlertDescription>
                </Alert>
              )}
              <div className="relative">
                <Key className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  id="secret-password"
                  type="password"
                  placeholder="Senha Secreta"
                  value={secretPassword}
                  onChange={(e) => setSecretPassword(e.target.value)}
                  className={`pl-10 ${
                    isBrowserLight 
                      ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400' 
                      : 'bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-400'
                  }`}
                  required
                  disabled={isLoading}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-4 pb-4">
              <Button
                type="submit"
                className="w-full cursor-pointer"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={`w-full cursor-pointer ${
                  isBrowserLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
                onClick={() => setShowSecretDialog(false)}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </CardFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}