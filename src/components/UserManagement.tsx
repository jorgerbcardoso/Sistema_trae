import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { PasswordInput } from './ui/password-input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { apiFetch } from '../utils/apiUtils';
import { 
  ArrowLeft, 
  UserPlus, 
  Edit, 
  Edit2,
  Trash2, 
  Save, 
  X, 
  User, 
  Mail, 
  Lock, 
  Shield,
  Loader2,
  Building2,
  RotateCcw,
  FolderTree,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  FilterX
} from 'lucide-react';
import { ENVIRONMENT } from '../config/environment';
import { handleApiResponse } from '../utils/apiResponseHandler';
import { AdminLayout } from './layouts/AdminLayout';
import { usePageTitle } from '../hooks/usePageTitle';
import { FilterSelectUnidadeSingle } from './cadastros/FilterSelectUnidadeSingle';
import { SetoresManagement } from './admin/SetoresManagement';
import { FilterSelectSetor } from './admin/FilterSelectSetor';
import { getSetorColorClasses, formatSetorNumber } from '../utils/setorColors';
import { UsersTable } from './admin/UsersTable';

interface UserData {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  domain: string;
  unidade: string; // ✅ NOVO
  troca_unidade: boolean; // ✅ NOVO
  aprova_orcamento: boolean; // ✅ NOVO - Permissão para aprovar orçamentos
  nro_setor?: number; // ✅ NOVO - Setor do usuário
  setor_descricao?: string; // ✅ NOVO - Descrição do setor
  created_at?: string;
}

interface Setor {
  nro_setor: number;
  descricao: string;
}

export function UserManagement() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [unidade, setUnidade] = useState(''); // ✅ NOVO
  const [trocaUnidade, setTrocaUnidade] = useState(true); // ✅ NOVO - padrão true
  const [aprovaOrcamento, setAprovaOrcamento] = useState(false); // ✅ NOVO - padrão false
  const [nroSetor, setNroSetor] = useState<number | null>(1); // ✅ NOVO - Setor do usuário (padrão: GERAL)
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<UserData[]>([]);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editUnidade, setEditUnidade] = useState(''); // ✅ NOVO
  const [editTrocaUnidade, setEditTrocaUnidade] = useState(true); // ✅ NOVO
  const [editAprovaOrcamento, setEditAprovaOrcamento] = useState(false); // ✅ NOVO
  const [editNroSetor, setEditNroSetor] = useState<number | null>(null); // ✅ NOVO - Setor do usuário
  const [editSetorDescricao, setEditSetorDescricao] = useState(''); // ✅ NOVO - Descrição do setor
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false); // ✅ NOVO
  
  // Atualizar título da página
  usePageTitle('GERENCIAMENTO DE USUÁRIOS');

  // Carregar usuários ao montar o componente
  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      
      // No Figma Make, usar dados mock
      if (ENVIRONMENT.isFigmaMake) {
        // ✅ MOCK: Criar usuários de exemplo baseados no domínio
        const mockUsers: UserData[] = [
          {
            id: 1,
            domain: user?.domain || 'ACV',
            username: 'admin',
            email: 'admin@aceville.com.br',
            full_name: 'Administrador Sistema',
            is_admin: true,
            is_active: true,
            unidade: 'MTZ',
            troca_unidade: true,
            aprova_orcamento: true,
            nro_setor: 1,
            setor_descricao: 'GERAL',
            created_at: '2024-01-15T10:00:00'
          },
          {
            id: 2,
            domain: user?.domain || 'ACV',
            username: 'operador1',
            email: 'operador1@aceville.com.br',
            full_name: 'João Silva',
            is_admin: false,
            is_active: true,
            unidade: 'MTZ',
            troca_unidade: true,
            aprova_orcamento: false,
            nro_setor: 1,
            setor_descricao: 'GERAL',
            created_at: '2024-02-20T14:30:00'
          },
          {
            id: 3,
            domain: user?.domain || 'ACV',
            username: 'operador2',
            email: 'operador2@aceville.com.br',
            full_name: 'Maria Santos',
            is_admin: false,
            is_active: true,
            unidade: 'MTZ',
            troca_unidade: true,
            aprova_orcamento: false,
            nro_setor: 1,
            setor_descricao: 'GERAL',
            created_at: '2024-03-10T09:15:00'
          },
          {
            id: 4,
            domain: user?.domain || 'ACV',
            username: 'supervisor',
            email: 'supervisor@aceville.com.br',
            full_name: 'Carlos Oliveira',
            is_admin: true,
            is_active: true,
            unidade: 'MTZ',
            troca_unidade: true,
            aprova_orcamento: true,
            nro_setor: 1,
            setor_descricao: 'GERAL',
            created_at: '2024-01-20T11:45:00'
          },
          {
            id: 5,
            domain: user?.domain || 'ACV',
            username: 'inativo',
            email: 'inativo@aceville.com.br',
            full_name: 'Usuário Inativo',
            is_admin: false,
            is_active: false,
            unidade: 'MTZ',
            troca_unidade: true,
            aprova_orcamento: false,
            nro_setor: 1,
            setor_descricao: 'GERAL',
            created_at: '2023-12-01T08:00:00'
          }
        ];
        
        setUsers(mockUsers);
        setIsLoading(false);
        return;
      }
      
      // ✅ apiFetch já processa JSON e intercepta toasts
      const data = await apiFetch(`/sistema/api/users/list.php?domain=${user?.domain}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (data.success) {
        // Filtrar usuário PRESTO da listagem
        const filteredUsers = (data.users || []).filter((u: UserData) => 
          u.username.toLowerCase() !== 'presto'
        );
        setUsers(filteredUsers);
      } else {
        // Se success=false, garantir array vazio
        setUsers([]);
      }
    } catch (err: any) {
      console.error('Erro ao carregar usuários:', err);
      // Em caso de erro, garantir array vazio
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validações
    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 4) {
      setError('A senha deve ter no mínimo 4 caracteres');
      return;
    }

    if (username.length < 3) {
      setError('O username deve ter no mínimo 3 caracteres');
      return;
    }

    if (fullName.length < 3) {
      setError('O nome deve ter no mínimo 3 caracteres');
      return;
    }

    // ✅ VALIDAR UNIDADE (OBRIGATÓRIO)
    if (!unidade || unidade.trim() === '') {
      setError('Unidade é obrigatória');
      return;
    }

    setIsLoading(true);

    try {
      // ✅ apiFetch já processa JSON e intercepta toasts
      const data = await apiFetch('/sistema/api/users/create.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          domain: user?.domain,
          username: username.toLowerCase(),
          full_name: fullName.toUpperCase(),
          email: email.toLowerCase(),
          password: password,
          is_admin: isAdmin,
          unidade: unidade,
          troca_unidade: trocaUnidade,
          aprova_orcamento: aprovaOrcamento,
          nro_setor: nroSetor
        })
      });

      // Se foi sucesso, limpar form e recarregar
      if (data.success) {
        setUsername('');
        setFullName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setIsAdmin(false);
        setUnidade('');
        setTrocaUnidade(true);
        setAprovaOrcamento(false);
        setNroSetor(1);
        setShowCreateForm(false);
        await loadUsers();
      }
    } catch (err: any) {
      setError('Erro ao criar usuário');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (userToEdit: UserData) => {
    setEditingUser(userToEdit);
    setEditFullName(userToEdit.full_name);
    setEditEmail(userToEdit.email);
    setEditPassword('');
    setEditIsAdmin(userToEdit.is_admin);
    setEditUnidade(userToEdit.unidade);
    setEditTrocaUnidade(userToEdit.troca_unidade);
    setEditAprovaOrcamento(userToEdit.aprova_orcamento);
    setEditNroSetor(userToEdit.nro_setor || null);
    setEditSetorDescricao(userToEdit.setor_descricao || '');
    setShowEditDialog(true); // ✅ NOVO
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditFullName('');
    setEditEmail('');
    setEditPassword('');
    setEditIsAdmin(false);
    setEditUnidade('');
    setEditTrocaUnidade(true);
    setEditAprovaOrcamento(false);
    setEditNroSetor(null);
    setEditSetorDescricao('');
    setShowEditDialog(false); // ✅ NOVO
  };

  const handleSaveEdit = async () => {
    if (editFullName.length < 3) {
      toast.error('O nome deve ter no mínimo 3 caracteres');
      return;
    }

    if (editPassword && editPassword.length < 4) {
      toast.error('A senha deve ter no mínimo 4 caracteres');
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        user_id: editingUser!.id,
        full_name: editFullName.toUpperCase(),
        email: editEmail.toLowerCase(),
        is_admin: editIsAdmin,
        unidade: editUnidade,
        troca_unidade: editTrocaUnidade,
        aprova_orcamento: editAprovaOrcamento,
        nro_setor: editNroSetor,
        setor_descricao: editSetorDescricao
      };

      if (editPassword) {
        payload.password = editPassword; // NÃO converter para minúsculas!
      }

      // ✅ USAR apiFetch para interceptação automática de toasts
      const data = await apiFetch('/sistema/api/users/update.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      // Se foi sucesso, limpar form e recarregar
      if (data.success) {
        setEditingUser(null);
        setEditFullName('');
        setEditEmail('');
        setEditPassword('');
        setEditIsAdmin(false);
        setEditUnidade('');
        setEditTrocaUnidade(true);
        setEditAprovaOrcamento(false);
        setEditNroSetor(null);
        setEditSetorDescricao('');
        setShowEditDialog(false); // ✅ Fechar dialog
        await loadUsers();
      }
    } catch (err: any) {
      console.error('❌ Erro ao atualizar usuário:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`Tem certeza que deseja desativar o usuário "${username}"?`)) {
      return;
    }

    setIsLoading(true);

    try {
      // ✅ USAR apiFetch para interceptação automática de toasts
      const data = await apiFetch('/sistema/api/users/delete.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });

      // Se foi sucesso, recarregar
      if (data.success) {
        await loadUsers();
      }
    } catch (err: any) {
      console.error('❌ Erro ao desativar usuário:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ NOVA FUNÇÃO: Reativar usuário inativo
  const handleReactivate = async (userId: number, username: string) => {
    if (!confirm(`Tem certeza que deseja reativar o usuário "${username}"?`)) {
      return;
    }

    setIsLoading(true);

    try {
      // ✅ USAR apiFetch para interceptação automática de toasts
      const data = await apiFetch('/sistema/api/users/reactivate.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });

      // Se foi sucesso, recarregar
      if (data.success) {
        await loadUsers();
      }
    } catch (err: any) {
      console.error('❌ Erro ao reativar usuário:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AdminLayout 
      title="GERENCIAMENTO DE USUÁRIOS"
      description={user?.client_name || ''}
    >
      {/* Main Content */}
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* ✅ NOVO: Cadastro de Setores */}
        <SetoresManagement />

        {/* Botão para criar novo usuário */}
        {!showCreateForm && (
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateForm(true)}>
              <UserPlus className="w-4 h-4 mr-2" />
              Novo Usuário
            </Button>
          </div>
        )}

        {/* Formulário de criação */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <UserPlus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle>Cadastrar Novo Usuário</CardTitle>
                    <CardDescription>
                      Preencha os dados abaixo para criar um novo usuário
                    </CardDescription>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowCreateForm(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">
                      Nome Completo
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Digite o nome completo"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isLoading}
                        autoFocus
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Será salvo em MAIÚSCULAS automaticamente
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">
                      Usuário (Login)
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="username"
                        type="text"
                        placeholder="Digite o username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Será salvo em minúsculas. Mínimo 3 caracteres.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">
                      Email
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="usuario@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nro-setor">
                      Setor
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <FilterSelectSetor
                      value={nroSetor}
                      onChange={(value) => setNroSetor(value)}
                    />
                    <p className="text-xs text-slate-500">
                      Selecione o setor do usuário
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">
                      Senha
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <PasswordInput
                        id="password"
                        type="password"
                        placeholder="Digite a senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      Mínimo 4 caracteres
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">
                      Confirmar Senha
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <PasswordInput
                        id="confirm-password"
                        type="password"
                        placeholder="Digite a senha novamente"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10"
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="is-admin" className="block">
                      Tipo de Usuário
                    </Label>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                      <Label 
                        htmlFor="is-admin" 
                        className="flex items-start gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center h-5">
                          <input
                            id="is-admin"
                            type="checkbox"
                            checked={isAdmin}
                            onChange={(e) => setIsAdmin(e.target.checked)}
                            disabled={isLoading}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-purple-600" />
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              Usuário Administrador
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Administradores têm acesso total ao sistema, incluindo gestão de usuários e configurações
                          </p>
                        </div>
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="unidade" className="block">
                      Unidade
                      <span className="text-red-500 ml-1">*</span>
                    </Label>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                      <FilterSelectUnidadeSingle
                        value={unidade}
                        onChange={(value) => setUnidade(value)}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        Selecione a unidade operacional do usuário
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="troca-unidade" className="block">
                      Permite Trocar de Unidade
                    </Label>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                      <Label 
                        htmlFor="troca-unidade" 
                        className="flex items-start gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center h-5">
                          <input
                            id="troca-unidade"
                            type="checkbox"
                            checked={trocaUnidade}
                            onChange={(e) => setTrocaUnidade(e.target.checked)}
                            disabled={isLoading}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Building2 className="w-4 h-4 text-purple-600" />
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              Permite Trocar de Unidade
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Se marcado, o usuário pode trocar de unidade no sistema
                          </p>
                        </div>
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label htmlFor="aprova-orcamento" className="block">
                      Permissão para Aprovar Orçamentos
                    </Label>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                      <Label 
                        htmlFor="aprova-orcamento" 
                        className="flex items-start gap-3 cursor-pointer group"
                      >
                        <div className="flex items-center h-5">
                          <input
                            id="aprova-orcamento"
                            type="checkbox"
                            checked={aprovaOrcamento}
                            onChange={(e) => setAprovaOrcamento(e.target.checked)}
                            disabled={isLoading}
                            className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Shield className="w-4 h-4 text-purple-600" />
                            <span className="font-medium text-slate-900 dark:text-slate-100">
                              Aprovar Orçamentos
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Se marcado, o usuário pode aprovar orçamentos no sistema
                          </p>
                        </div>
                      </Label>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Criar Usuário
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateForm(false)}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Lista de usuários */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Usuários Cadastrados</CardTitle>
                <CardDescription>
                  Gerencie os usuários do domínio {user?.client_name}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <UsersTable
              users={users}
              isLoading={isLoading}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReactivate={handleReactivate}
            />
          </CardContent>
        </Card>

        {/* Informações Adicionais */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            ℹ️ Informações Importantes
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Todos os nomes são salvos em MAIÚSCULAS automaticamente</li>
            <li>• Login e senha so salvos em minúsculas</li>
            <li>• Usuários ADMIN não podem ser excluídos</li>
            <li>• A exclusão é apenas uma desativação (soft delete)</li>
            <li>• Usuários inativos podem ser reativados a qualquer momento</li>
            <li>• O email é obrigatório para recuperação de senha</li>
            <li>• Administradores têm acesso total ao sistema</li>
          </ul>
        </div>
      </div>

      {/* ✅ Dialog de Edição */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        if (!open) handleCancelEdit();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Edit className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <DialogTitle>Editar Usuário</DialogTitle>
                <DialogDescription>
                  Atualize os dados do usuário @{editingUser?.username}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-full-name">
                  Nome Completo
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="edit-full-name"
                    type="text"
                    placeholder="Digite o nome completo"
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Será salvo em MAIÚSCULAS automaticamente
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">
                  Email
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="edit-email"
                    type="email"
                    placeholder="usuario@exemplo.com"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="pl-10"
                    required
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-nro-setor">
                  Setor
                  <span className="text-red-500 ml-1">*</span>
                </Label>
                <FilterSelectSetor
                  value={editNroSetor}
                  onChange={(value) => setEditNroSetor(value)}
                />
                <p className="text-xs text-slate-500">
                  Selecione o setor do usuário
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-password">
                  Nova Senha (opcional)
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <PasswordInput
                    id="edit-password"
                    type="password"
                    placeholder="Deixe em branco para manter a senha atual"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Mínimo 4 caracteres
                </p>
              </div>

              <div className="space-y-4">
                <Label htmlFor="edit-is-admin" className="block">
                  Tipo de Usuário
                </Label>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                  <Label 
                    htmlFor="edit-is-admin" 
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center h-5">
                      <input
                        id="edit-is-admin"
                        type="checkbox"
                        checked={editIsAdmin}
                        onChange={(e) => setEditIsAdmin(e.target.checked)}
                        disabled={isLoading}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          Usuário Administrador
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Administradores têm acesso total ao sistema
                      </p>
                    </div>
                  </Label>
                </div>
              </div>

              <div className="space-y-4">
                <Label htmlFor="edit-unidade" className="block">
                  Unidade
                </Label>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                  <FilterSelectUnidadeSingle
                    value={editUnidade}
                    onChange={(value) => setEditUnidade(value)}
                  />
                </div>
              </div>

              <div className="space-y-4 md:col-span-2">
                <Label htmlFor="edit-troca-unidade" className="block">
                  Permite Trocar de Unidade
                </Label>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                  <Label 
                    htmlFor="edit-troca-unidade" 
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center h-5">
                      <input
                        id="edit-troca-unidade"
                        type="checkbox"
                        checked={editTrocaUnidade}
                        onChange={(e) => setEditTrocaUnidade(e.target.checked)}
                        disabled={isLoading}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          Permite Trocar de Unidade
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Se marcado, o usuário pode trocar de unidade no sistema
                      </p>
                    </div>
                  </Label>
                </div>
              </div>

              <div className="space-y-4 md:col-span-2">
                <Label htmlFor="edit-aprova-orcamento" className="block">
                  Permissão para Aprovar Orçamentos
                </Label>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
                  <Label 
                    htmlFor="edit-aprova-orcamento" 
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <div className="flex items-center h-5">
                      <input
                        id="edit-aprova-orcamento"
                        type="checkbox"
                        checked={editAprovaOrcamento}
                        onChange={(e) => setEditAprovaOrcamento(e.target.checked)}
                        disabled={isLoading}
                        className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 focus:ring-offset-0"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-4 h-4 text-purple-600" />
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          Aprovar Orçamentos
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Se marcado, o usuário pode aprovar orçamentos no sistema
                      </p>
                    </div>
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSaveEdit}
                className="flex-1"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar Alterações
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}