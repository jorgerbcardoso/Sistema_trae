import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Lock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { toast } from 'sonner';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // ✅ Helper para obter caminho de login baseado no domínio
  const getLoginPath = (domain?: string) => {
    return domain === 'ACV' ? '/login-aceville' : '/login';
  };
  
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingToken, setIsValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userDomain, setUserDomain] = useState<string>('');

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    
    if (!tokenFromUrl) {
      setError('Token de recuperação não fornecido');
      setIsValidatingToken(false);
      return;
    }
    
    setToken(tokenFromUrl);
    // Poderia validar o token aqui, mas faremos na submissão
    setTokenValid(true);
    setIsValidatingToken(false);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validações
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 4) {
      setError('A senha deve ter no mínimo 4 caracteres');
      return;
    }

    setIsLoading(true);
    setIsSubmitting(true);
    
    try {
      // No Figma Make, simular reset
      if (ENVIRONMENT.isFigmaMake) {
        toast.success('Senha redefinida com sucesso (MOCK)!');
        setIsLoading(false);
        navigate(getLoginPath());
        return;
      }
      
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/auth/reset-password.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: token,
          new_password: newPassword
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('Senha redefinida com sucesso!');
        setUserDomain(data.domain || '');
        // Redirecionar para login após 3 segundos
        setTimeout(() => {
          // ✅ Redirecionar para login-aceville se domínio for ACV
          const loginPath = data.domain === 'ACV' ? '/login-aceville' : '/login';
          navigate(loginPath);
        }, 3000);
      } else {
        setError(data.error || 'Erro ao redefinir senha');
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor. Tente novamente.');
      setIsSubmitting(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isValidatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Card className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-4" />
            <p className="text-slate-300">Validando token...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Card className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <CardTitle className="text-slate-100">Token Inválido</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              O link de recuperação está inválido ou expirado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate(getLoginPath())}
              className="w-full"
            >
              Voltar para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
        <Card className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
              <CardTitle className="text-slate-100">Senha Redefinida!</CardTitle>
            </div>
            <CardDescription className="text-slate-400">
              Sua senha foi alterada com sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="bg-green-900/20 border-green-800 text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Você será redirecionado para a página de login em instantes...
              </AlertDescription>
            </Alert>
            <Button 
              onClick={() => navigate(getLoginPath(userDomain))}
              className="w-full mt-4"
            >
              Ir para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: 'url(https://webpresto.com.br/images/fundo-site.png)' }}
    >
      {/* Overlay escuro */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      <Card className="w-full max-w-md relative z-10 bg-slate-800/90 backdrop-blur-sm border-slate-700 shadow-2xl">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
              <Lock className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center text-slate-100">
            Redefinir Senha
          </CardTitle>
          <CardDescription className="text-center text-slate-400">
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4 pt-6">{/* Adicionado pt-6 para consistência */}
            {error && (
              <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-red-300">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="newPassword" className="text-slate-300">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite sua nova senha"
                disabled={isLoading}
                className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500"
                autoFocus
              />
              <p className="text-xs text-slate-400">Mínimo de 4 caracteres</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-slate-300">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite novamente sua nova senha"
                disabled={isLoading}
                className="bg-slate-700/50 border-slate-600 text-slate-100 placeholder:text-slate-400 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redefinindo...
                </>
              ) : (
                'Redefinir Senha'
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-slate-400 hover:text-slate-300 hover:bg-slate-700/50"
              onClick={() => navigate(getLoginPath(userDomain))}
              disabled={isLoading}
            >
              Voltar para Login
            </Button>
          </CardContent>
        </form>
      </Card>
    </div>
  );
}