import { FilterSelectUnidadeSingle } from '../../components/cadastros/FilterSelectUnidadeSingle';
import { FilterSelectSetor } from '../../components/admin/FilterSelectSetor';
import { getSetorColorClasses, formatSetorNumber } from '../../utils/setorColors';
import { SetoresManagement } from '../../components/admin/SetoresManagement';
import { UnidadesMultiSelect } from '../../components/admin/UnidadesMultiSelect';

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Loader2,
  UserPlus,
  Edit,
  Trash2,
  RotateCcw,
  User,
  Mail,
  Lock,
  Shield,
  Building2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Filter,
  X,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { SortableTableHeader, useSortableTable } from '../../components/table/SortableTableHeader';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INTERFACES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface UserData {
  id: number;
  username: string;
  full_name: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  domain: string;
  unidade: string;
  troca_unidade: boolean;
  aprova_orcamento: boolean;
  nro_setor?: number;
  setor_descricao?: string;
  nro_setor_compra?: number; // ✅ NOVO - Setor para Compras
  setor_compra_descricao?: string; // ✅ NOVO - Descrição do setor de compras
  unidades?: string; // ✅ NOVO - Unidades permitidas (CSV)
  created_at?: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMPONENTE PRINCIPAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function CadastroUsuarios() {
  usePageTitle('Gerenciamento de Usuários');

  const navigate = useNavigate();
  const { user, token } = useAuth();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ESTADOS - LISTAGEM
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(false);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ESTADOS - CRIAÇÃO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [unidade, setUnidade] = useState('');
  const [trocaUnidade, setTrocaUnidade] = useState(true);
  const [aprovaOrcamento, setAprovaOrcamento] = useState(false);
  const [nroSetor, setNroSetor] = useState<number | null>(1);
  const [nroSetorCompra, setNroSetorCompra] = useState<number | null>(null); // ✅ NOVO - Setor para Compras
  const [unidadesPermitidas, setUnidadesPermitidas] = useState<string[]>([]); // ✅ NOVO - Unidades permitidas

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ESTADOS - EDIÇÃO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editIsAdmin, setEditIsAdmin] = useState(false);
  const [editUnidade, setEditUnidade] = useState('');
  const [editTrocaUnidade, setEditTrocaUnidade] = useState(true);
  const [editAprovaOrcamento, setEditAprovaOrcamento] = useState(false);
  const [editNroSetor, setEditNroSetor] = useState<number | null>(null);
  const [editNroSetorCompra, setEditNroSetorCompra] = useState<number | null>(null); // ✅ NOVO - Setor para Compras
  const [editUnidadesPermitidas, setEditUnidadesPermitidas] = useState<string[]>([]); // ✅ NOVO - Unidades permitidas

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ORDENAÇÃO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  type SortField = 'username' | 'full_name' | 'email' | 'unidade' | 'nro_setor' | 'created_at';
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<SortField>('created_at', 'desc');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGINAÇÃO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ESTADOS - FILTROS TEMPORÁRIOS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [filtroBuscaTemp, setFiltroBuscaTemp] = useState('');
  const [filtroEmailTemp, setFiltroEmailTemp] = useState('');
  const [filtroUnidadeTemp, setFiltroUnidadeTemp] = useState('');
  const [filtroSetorTemp, setFiltroSetorTemp] = useState<number | null>(null);
  const [filtroTipoTemp, setFiltroTipoTemp] = useState('todos');
  const [filtroStatusTemp, setFiltroStatusTemp] = useState('todos');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ESTADOS - FILTROS APLICADOS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const [filtroBusca, setFiltroBusca] = useState('');
  const [filtroEmail, setFiltroEmail] = useState('');
  const [filtroUnidade, setFiltroUnidade] = useState('');
  const [filtroSetor, setFiltroSetor] = useState<number | null>(null);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [filtroStatus, setFiltroStatus] = useState('todos');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EFFECTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  useEffect(() => {
    loadUsers();
  }, []);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FUNÇÕES - CARREGAR DADOS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const loadUsers = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK para ambiente de desenvolvimento
        await new Promise(resolve => setTimeout(resolve, 500));
        const mockUsers: UserData[] = [
          {
            id: 1,
            domain: user?.domain || 'DMN',
            username: 'admin',
            email: 'admin@dmn.com.br',
            full_name: 'ADMINISTRADOR SISTEMA',
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
            domain: user?.domain || 'DMN',
            username: 'operador1',
            email: 'operador1@dmn.com.br',
            full_name: 'JOÃO SILVA',
            is_admin: false,
            is_active: true,
            unidade: 'MTZ',
            troca_unidade: true,
            aprova_orcamento: false,
            nro_setor: 2,
            setor_descricao: 'OPERACIONAL',
            created_at: '2024-02-20T14:30:00'
          }
        ];
        setUsers(mockUsers);
      } else {
        // BACKEND - ✅ SEMPRE usar apiFetch()
        const data = await apiFetch(`/sistema/api/users/list.php?domain=${user?.domain}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (data.success) {
          // ✅ CRÍTICO: Filtrar usuário "presto" APENAS se o usuário logado NÃO for "presto"
          const usuarioLogadoEhPresto = user?.username?.toLowerCase() === 'presto';
          
          const filteredUsers = usuarioLogadoEhPresto 
            ? (data.users || []) // Se logado como presto, mostrar TODOS os usuários (incluindo presto)
            : (data.users || []).filter((u: UserData) => u.username.toLowerCase() !== 'presto'); // Caso contrário, ocultar presto
          
          setUsers(filteredUsers);
        }
      }
    } catch (error) {
      console.error('❌ Erro ao carregar usuários:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FUNÇÕES - CRIAR USUÁRIO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleCreate = async () => {
    // Validações
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 4) {
      toast.error('A senha deve ter no mínimo 4 caracteres');
      return;
    }

    if (username.length < 3) {
      toast.error('O username deve ter no mínimo 3 caracteres');
      return;
    }

    if (fullName.length < 3) {
      toast.error('O nome deve ter no mínimo 3 caracteres');
      return;
    }

    if (!unidade || unidade.trim() === '') {
      toast.error('Unidade é obrigatória');
      return;
    }

    setLoading(true);

    try {
      // ✅ SEMPRE usar apiFetch() - intercepta msg() automaticamente
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
          nro_setor: nroSetor,
          nro_setor_compra: nroSetorCompra, // ✅ NOVO - Setor para Compras
          unidades: unidadesPermitidas.join(',') // ✅ NOVO - Unidades permitidas
        })
      });

      // ✅ Backend usa msg() - Toast aparece automaticamente
      if (data.success) {
        // Limpar form
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
        setNroSetorCompra(null); // ✅ NOVO - Setor para Compras
        setUnidadesPermitidas([]); // ✅ NOVO - Unidades permitidas
        setShowCreateDialog(false);
        
        // Recarregar lista
        await loadUsers();
      }
    } catch (error) {
      console.error('❌ Erro ao criar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FUNÇÕES - EDITAR USUÁRIO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
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
    setEditNroSetorCompra(userToEdit.nro_setor_compra || null); // ✅ NOVO - Setor para Compras
    setEditUnidadesPermitidas(userToEdit.unidades ? userToEdit.unidades.split(',') : []); // ✅ NOVO - Unidades permitidas
    setShowEditDialog(true);
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

    setLoading(true);

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
        nro_setor_compra: editNroSetorCompra, // ✅ NOVO - Setor para Compras
        unidades: editUnidadesPermitidas.join(',') // ✅ NOVO - Unidades permitidas
      };

      if (editPassword) {
        payload.password = editPassword;
      }

      // ✅ SEMPRE usar apiFetch() - intercepta msg() automaticamente
      const data = await apiFetch('/sistema/api/users/update.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      // ✅ Backend usa msg() - Toast aparece automaticamente
      if (data.success) {
        setShowEditDialog(false);
        setEditingUser(null);
        await loadUsers();
      }
    } catch (error) {
      console.error('❌ Erro ao atualizar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FUNÇÕES - DELETAR/REATIVAR USUÁRIO
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const handleDelete = async (userId: number, username: string) => {
    if (!confirm(`Tem certeza que deseja desativar o usuário "${username}"?`)) {
      return;
    }

    setLoading(true);

    try {
      // ✅ SEMPRE usar apiFetch() - intercepta msg() automaticamente
      const data = await apiFetch('/sistema/api/users/delete.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });

      // ✅ Backend usa msg() - Toast aparece automaticamente
      if (data.success) {
        await loadUsers();
      }
    } catch (error) {
      console.error('❌ Erro ao desativar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReactivate = async (userId: number, username: string) => {
    if (!confirm(`Tem certeza que deseja reativar o usuário \"${username}\"?`)) {
      return;
    }

    setLoading(true);

    try {
      // ✅ SEMPRE usar apiFetch() - intercepta msg() automaticamente
      const data = await apiFetch('/sistema/api/users/reactivate.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: userId })
      });

      // ✅ Backend usa msg() - Toast aparece automaticamente
      if (data.success) {
        await loadUsers();
      }
    } catch (error) {
      console.error('❌ Erro ao reativar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // FUNÇÕES - FILTROS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const aplicarFiltros = () => {
    setFiltroBusca(filtroBuscaTemp);
    setFiltroEmail(filtroEmailTemp);
    setFiltroUnidade(filtroUnidadeTemp);
    setFiltroSetor(filtroSetorTemp);
    setFiltroTipo(filtroTipoTemp);
    setFiltroStatus(filtroStatusTemp);
    setCurrentPage(1); // Resetar para primeira página
  };

  const limparFiltros = () => {
    setFiltroBuscaTemp('');
    setFiltroEmailTemp('');
    setFiltroUnidadeTemp('');
    setFiltroSetorTemp(null);
    setFiltroTipoTemp('todos');
    setFiltroStatusTemp('todos');
    
    setFiltroBusca('');
    setFiltroEmail('');
    setFiltroUnidade('');
    setFiltroSetor(null);
    setFiltroTipo('todos');
    setFiltroStatus('todos');
    setCurrentPage(1);
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // DADOS FILTRADOS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const usuariosFiltrados = useMemo(() => {
    let resultado = [...users];

    // Filtro: Busca por login ou nome
    if (filtroBusca) {
      const termo = filtroBusca.toLowerCase();
      resultado = resultado.filter(u => 
        u.username.toLowerCase().includes(termo) ||
        u.full_name.toLowerCase().includes(termo)
      );
    }

    // Filtro: Email
    if (filtroEmail) {
      const termo = filtroEmail.toLowerCase();
      resultado = resultado.filter(u => u.email.toLowerCase().includes(termo));
    }

    // Filtro: Unidade
    if (filtroUnidade) {
      resultado = resultado.filter(u => u.unidade === filtroUnidade);
    }

    // Filtro: Setor
    if (filtroSetor !== null) {
      resultado = resultado.filter(u => u.nro_setor === filtroSetor);
    }

    // Filtro: Tipo (Admin ou Comum)
    if (filtroTipo === 'admin') {
      resultado = resultado.filter(u => u.is_admin);
    } else if (filtroTipo === 'comum') {
      resultado = resultado.filter(u => !u.is_admin);
    }

    // Filtro: Status (Ativo ou Inativo)
    if (filtroStatus === 'ativo') {
      resultado = resultado.filter(u => u.is_active);
    } else if (filtroStatus === 'inativo') {
      resultado = resultado.filter(u => !u.is_active);
    }

    return resultado;
  }, [users, filtroBusca, filtroEmail, filtroUnidade, filtroSetor, filtroTipo, filtroStatus]);

  // Verificar se há filtros ativos
  const hasFiltrosAtivos = filtroBusca || filtroEmail || filtroUnidade || filtroSetor !== null || 
                           filtroTipo !== 'todos' || filtroStatus !== 'todos';

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RENDER
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <AdminLayout
      title="Gerenciamento de Usuários"
      description={user?.client_name || ''}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ✅ Cadastro de Setores */}
        <SetoresManagement />

        {/* ✅ Botão Novo Usuário */}
        <div className="flex justify-end">
          <Button onClick={() => setShowCreateDialog(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        </div>

        {/* ✅ Lista de Usuários */}
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
            {loading && users.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <User className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p className="text-lg font-medium">Nenhum usuário cadastrado</p>
                <p className="text-sm mt-2">Clique em "Novo Usuário" para começar</p>
              </div>
            ) : (
              <>
                {/* ✅ FILTROS */}
                <Card className="mb-6 bg-slate-50 dark:bg-slate-900/50">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Busca por Login ou Nome */}
                      <div className="space-y-2">
                        <Label htmlFor="filtro-busca" className="text-sm font-medium">
                          Login ou Nome
                        </Label>
                        <div className="relative">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <Input
                            id="filtro-busca"
                            placeholder="Buscar por login ou nome"
                            value={filtroBuscaTemp}
                            onChange={(e) => setFiltroBuscaTemp(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      {/* Busca por Email */}
                      <div className="space-y-2">
                        <Label htmlFor="filtro-email" className="text-sm font-medium">
                          Email
                        </Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <Input
                            id="filtro-email"
                            placeholder="Buscar por email"
                            value={filtroEmailTemp}
                            onChange={(e) => setFiltroEmailTemp(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && aplicarFiltros()}
                            className="pl-10"
                          />
                        </div>
                      </div>

                      {/* Unidade */}
                      <div className="space-y-2">
                        <Label htmlFor="filtro-unidade" className="text-sm font-medium">
                          Unidade
                        </Label>
                        <FilterSelectUnidadeSingle
                          value={filtroUnidadeTemp}
                          onChange={(value) => setFiltroUnidadeTemp(value)}
                          placeholder="Todas as unidades"
                        />
                      </div>

                      {/* Setor */}
                      <div className="space-y-2">
                        <Label htmlFor="filtro-setor" className="text-sm font-medium">
                          Setor
                        </Label>
                        <FilterSelectSetor
                          value={filtroSetorTemp}
                          onChange={(value) => setFiltroSetorTemp(value)}
                          placeholder="Todos os setores"
                          allowClear={true}
                        />
                      </div>

                      {/* Tipo */}
                      <div className="space-y-2">
                        <Label htmlFor="filtro-tipo" className="text-sm font-medium">
                          Tipo
                        </Label>
                        <Select value={filtroTipoTemp} onValueChange={setFiltroTipoTemp}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos os tipos" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="comum">Comum</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Status */}
                      <div className="space-y-2">
                        <Label htmlFor="filtro-status" className="text-sm font-medium">
                          Status
                        </Label>
                        <Select value={filtroStatusTemp} onValueChange={setFiltroStatusTemp}>
                          <SelectTrigger>
                            <SelectValue placeholder="Todos os status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Botões */}
                    <div className="flex items-center gap-2 mt-4">
                      <Button onClick={aplicarFiltros} size="sm" className="gap-2">
                        <Filter className="h-4 w-4" />
                        Aplicar Filtros
                      </Button>
                      {hasFiltrosAtivos && (
                        <Button onClick={limparFiltros} size="sm" variant="outline" className="gap-2">
                          <X className="h-4 w-4" />
                          Limpar Filtros
                        </Button>
                      )}
                      {hasFiltrosAtivos && (
                        <span className="text-sm text-slate-600 dark:text-slate-400 ml-2">
                          {usuariosFiltrados.length} usuário(s) encontrado(s)
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* ✅ TABELA */}
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHeader
                          field="username"
                          label="Login"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHeader
                          field="full_name"
                          label="Nome Completo"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHeader
                          field="email"
                          label="Email"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHeader
                          field="unidade"
                          label="Unidade"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <SortableTableHeader
                          field="nro_setor"
                          label="Setor"
                          currentSortField={sortField}
                          currentSortDirection={sortDirection}
                          onSort={handleSort}
                        />
                        <TableHead>Tipo</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortData(usuariosFiltrados).slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((userData) => (
                        <TableRow key={userData.id}>
                          <TableCell className="font-mono text-sm">
                            {userData.username}
                          </TableCell>
                          <TableCell className="font-medium">
                            {userData.full_name}
                          </TableCell>
                          <TableCell className="text-sm text-slate-600 dark:text-slate-400">
                            {userData.email}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {userData.unidade}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {userData.nro_setor && (
                              <div
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${getSetorColorClasses(userData.nro_setor)}`}
                              >
                                <span className="font-mono">{formatSetorNumber(userData.nro_setor)}</span>
                                <span>{userData.setor_descricao || 'GERAL'}</span>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {userData.is_admin ? (
                              <Badge className="bg-purple-600">
                                <Shield className="w-3 h-3 mr-1" />
                                Admin
                              </Badge>
                            ) : (
                              <Badge variant="outline">Operador</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {userData.is_active ? (
                              <Badge className="bg-green-600">Ativo</Badge>
                            ) : (
                              <Badge variant="destructive">Inativo</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {userData.is_active ? (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(userData)}
                                    disabled={loading}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  {/* ✅ CRÍTICO: Não mostrar botão de delete para usuário "presto" */}
                                  {userData.username.toLowerCase() !== 'presto' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDelete(userData.id, userData.username)}
                                      disabled={loading}
                                    >
                                      <Trash2 className="w-4 h-4 text-red-600" />
                                    </Button>
                                  )}
                                </>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleReactivate(userData.id, userData.username)}
                                  disabled={loading}
                                >
                                  <RotateCcw className="w-4 h-4 text-green-600" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* ✅ PAGINAÇÃO - Padrão do Sistema */}
                  {usuariosFiltrados.length > ITEMS_PER_PAGE && (
                    <div className="mt-4 flex items-center justify-between px-4 py-3 border-t">
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, usuariosFiltrados.length)} de {usuariosFiltrados.length} usuários
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1 || loading}
                          size="sm"
                          variant="outline"
                        >
                          <ChevronsLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1 || loading}
                          size="sm"
                          variant="outline"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="text-sm text-slate-600 dark:text-slate-400 min-w-[100px] text-center">
                          Página {currentPage} de {Math.ceil(usuariosFiltrados.length / ITEMS_PER_PAGE)}
                        </div>
                        <Button
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === Math.ceil(usuariosFiltrados.length / ITEMS_PER_PAGE) || loading}
                          size="sm"
                          variant="outline"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                        <Button
                          onClick={() => setCurrentPage(Math.ceil(usuariosFiltrados.length / ITEMS_PER_PAGE))}
                          disabled={currentPage === Math.ceil(usuariosFiltrados.length / ITEMS_PER_PAGE) || loading}
                          size="sm"
                          variant="outline"
                        >
                          <ChevronsRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ✅ Informações */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Informações importantes:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
              <li>Todos os nomes são salvos em MAIÚSCULAS automaticamente</li>
              <li>Login e email são salvos em minúsculas</li>
              <li>Senha deve ter no mínimo 4 caracteres</li>
              <li>A exclusão é soft delete (usuário pode ser reativado)</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>

      {/* ✅ DIALOG: Criar Usuário */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cadastrar Novo Usuário</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para criar um novo usuário no sistema
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome Completo */}
              <div className="space-y-2">
                <Label htmlFor="fullName">
                  Nome Completo <span className="text-red-500">*</span>
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
                    disabled={loading}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Será salvo em MAIÚSCULAS automaticamente
                </p>
              </div>

              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username">
                  Usuário (Login) <span className="text-red-500">*</span>
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
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Será salvo em minúsculas. Mínimo 3 caracteres.
                </p>
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-red-500">*</span>
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
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Setor */}
              <div className="space-y-2">
                <Label htmlFor="nro-setor">
                  Setor <span className="text-red-500">*</span>
                </Label>
                <FilterSelectSetor
                  value={nroSetor}
                  onChange={(value) => setNroSetor(value)}
                />
              </div>

              {/* ✅ NOVO - Setor para Compras */}
              <div className="space-y-2">
                <Label htmlFor="nro-setor-compra">
                  Setor para Compras
                </Label>
                <FilterSelectSetor
                  value={nroSetorCompra}
                  onChange={(value) => setNroSetorCompra(value)}
                  apenasEfetuaCompras={true}
                  placeholder="Selecione o setor de compras"
                  allowClear={true}
                />
                <p className="text-xs text-slate-500">
                  Setor ao qual este usuário se reporta para compras (opcional)
                </p>
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <Label htmlFor="password">
                  Senha <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Digite a senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
                <p className="text-xs text-slate-500">
                  Mínimo 4 caracteres
                </p>
              </div>

              {/* Confirmar Senha */}
              <div className="space-y-2">
                <Label htmlFor="confirm-password">
                  Confirmar Senha <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Digite a senha novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Unidade */}
              <div className="space-y-2">
                <Label htmlFor="unidade">
                  Unidade <span className="text-red-500">*</span>
                </Label>
                <FilterSelectUnidadeSingle
                  value={unidade}
                  onChange={(value) => setUnidade(value)}
                />
              </div>

              {/* Tipo de Usuário */}
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <div className="flex items-center gap-2 border rounded-lg p-3">
                  <input
                    id="is-admin"
                    type="checkbox"
                    checked={isAdmin}
                    onChange={(e) => setIsAdmin(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 rounded"
                  />
                  <Label htmlFor="is-admin" className="cursor-pointer font-normal flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-600" />
                    Administrador
                  </Label>
                </div>
              </div>

              {/* Permissões */}
              <div className="space-y-2">
                <Label>Permissões</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border rounded-lg p-3">
                    <input
                      id="troca-unidade"
                      type="checkbox"
                      checked={trocaUnidade}
                      onChange={(e) => setTrocaUnidade(e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4 rounded"
                    />
                    <Label htmlFor="troca-unidade" className="cursor-pointer font-normal flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Trocar Unidade
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 border rounded-lg p-3">
                    <input
                      id="aprova-orcamento"
                      type="checkbox"
                      checked={aprovaOrcamento}
                      onChange={(e) => setAprovaOrcamento(e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4 rounded"
                    />
                    <Label htmlFor="aprova-orcamento" className="cursor-pointer font-normal flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Aprovar Orçamentos
                    </Label>
                  </div>
                </div>
              </div>
              
              {/* ✅ NOVO - Seleção de Unidades Permitidas (só aparece se "Trocar Unidade" estiver marcado) */}
              {trocaUnidade && (
                <div className="col-span-2">
                  <UnidadesMultiSelect
                    value={unidadesPermitidas}
                    onChange={setUnidadesPermitidas}
                    domain={user?.domain}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleCreate} disabled={loading} className="flex-1">
              {loading ? (
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
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ DIALOG: Editar Usuário */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize os dados do usuário @{editingUser?.username}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nome Completo */}
              <div className="space-y-2">
                <Label htmlFor="edit-full-name">
                  Nome Completo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-full-name"
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="edit-email">
                  Email <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* Nova Senha */}
              <div className="space-y-2">
                <Label htmlFor="edit-password">
                  Nova Senha (opcional)
                </Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Deixe em branco para não alterar"
                  disabled={loading}
                />
              </div>

              {/* Setor */}
              <div className="space-y-2">
                <Label>Setor</Label>
                <FilterSelectSetor
                  value={editNroSetor}
                  onChange={(value) => setEditNroSetor(value)}
                />
              </div>

              {/* ✅ NOVO - Setor para Compras */}
              <div className="space-y-2">
                <Label>Setor para Compras</Label>
                <FilterSelectSetor
                  value={editNroSetorCompra}
                  onChange={(value) => setEditNroSetorCompra(value)}
                  apenasEfetuaCompras={true}
                  placeholder="Selecione o setor de compras"
                  allowClear={true}
                />
                <p className="text-xs text-slate-500">
                  Setor ao qual este usuário se reporta para compras (opcional)
                </p>
              </div>

              {/* Unidade */}
              <div className="space-y-2">
                <Label>Unidade</Label>
                <FilterSelectUnidadeSingle
                  value={editUnidade}
                  onChange={(value) => setEditUnidade(value)}
                />
              </div>

              {/* Tipo de Usuário */}
              <div className="space-y-2">
                <Label>Tipo de Usuário</Label>
                <div className="flex items-center gap-2 border rounded-lg p-3">
                  <input
                    id="edit-is-admin"
                    type="checkbox"
                    checked={editIsAdmin}
                    onChange={(e) => setEditIsAdmin(e.target.checked)}
                    disabled={loading}
                    className="w-4 h-4 rounded"
                  />
                  <Label htmlFor="edit-is-admin" className="cursor-pointer font-normal flex items-center gap-2">
                    <Shield className="w-4 h-4 text-purple-600" />
                    Administrador
                  </Label>
                </div>
              </div>

              {/* Permissões */}
              <div className="space-y-2">
                <Label>Permissões</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border rounded-lg p-3">
                    <input
                      id="edit-troca-unidade"
                      type="checkbox"
                      checked={editTrocaUnidade}
                      onChange={(e) => setEditTrocaUnidade(e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4 rounded"
                    />
                    <Label htmlFor="edit-troca-unidade" className="cursor-pointer font-normal flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Trocar Unidade
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 border rounded-lg p-3">
                    <input
                      id="edit-aprova-orcamento"
                      type="checkbox"
                      checked={editAprovaOrcamento}
                      onChange={(e) => setEditAprovaOrcamento(e.target.checked)}
                      disabled={loading}
                      className="w-4 h-4 rounded"
                    />
                    <Label htmlFor="edit-aprova-orcamento" className="cursor-pointer font-normal flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Aprovar Orçamentos
                    </Label>
                  </div>
                </div>
              </div>
              
              {/* ✅ NOVO - Seleção de Unidades Permitidas (só aparece se "Trocar Unidade" estiver marcado) */}
              {editTrocaUnidade && (
                <div className="col-span-2">
                  <UnidadesMultiSelect
                    value={editUnidadesPermitidas}
                    onChange={setEditUnidadesPermitidas}
                    domain={user?.domain}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSaveEdit} disabled={loading} className="flex-1">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}