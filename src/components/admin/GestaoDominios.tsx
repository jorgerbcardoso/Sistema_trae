import React, { useState, useEffect } from 'react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Edit2,
  Trash2,
  Shield,
  Globe,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Power,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { API_BASE_URL, ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { DomainFormDialog, DomainFormData } from './DomainFormDialog';
import { useNavigate } from 'react-router';
import { getDomains, getDomain, createDomain, updateDomain, deleteDomain } from '../../services/adminService';

interface Domain {
  domain: string;
  name: string;
  total_users: number;
  total_permissions: number;
  last_created: string;
  is_super_admin: boolean;
  is_active: boolean;
}

interface GestaoDominiosProps {
  permissions?: {
    can_access: boolean;
    can_create?: boolean;
    can_edit?: boolean;
    can_delete?: boolean;
    can_export?: boolean;
  };
}

export default function GestaoDominios({ permissions }: GestaoDominiosProps) {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [domainToDeactivate, setDomainToDeactivate] = useState<string | null>(null);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<DomainFormData> | undefined>(undefined);
  
  const { token, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const result = await getDomains(token!);
      
      if (result.success) {
        setDomains(result.domains);
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error('Erro ao buscar domínios:', error);
      toast.error(error.message || 'Erro ao buscar domínios');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateDialog = () => {
    setEditingDomain(null);
    setFormData(undefined);
    setShowFormDialog(true);
  };

  const handleOpenEditDialog = async (domainCode: string) => {
    setLoading(true);
    try {
      const result = await getDomain(domainCode, token!);
      
      if (result.success && result.domain) {
        setEditingDomain(domainCode);
        setFormData(result.domain);
        setShowFormDialog(true);
      } else {
        toast.error(result.message || 'Erro ao buscar dados do domínio');
      }
    } catch (error: any) {
      console.error('Erro ao buscar domínio:', error);
      toast.error(error.message || 'Erro ao buscar domínio');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForm = async (domainCode: string, data: DomainFormData) => {
    setLoading(true);
    try {
      let result;
      
      if (editingDomain) {
        // Editar domínio existente
        result = await updateDomain(editingDomain, data, token!);
      } else {
        // Criar novo domínio
        result = await createDomain(domainCode, data, token!);
      }
      
      if (result.success) {
        toast.success(result.message);
        setShowFormDialog(false);
        setEditingDomain(null);
        setFormData(undefined);
        fetchDomains();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error('Erro ao salvar domínio:', error);
      toast.error(error.message || 'Erro ao salvar domínio');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateDomain = async () => {
    if (!domainToDeactivate) return;

    setLoading(true);
    try {
      const result = await deleteDomain(domainToDeactivate, token!);
      
      if (result.success) {
        toast.success(`Domínio ${result.domain} deletado com sucesso!`);
        setShowDeactivateDialog(false);
        setDomainToDeactivate(null);
        fetchDomains();
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      console.error('Erro ao deletar domínio:', error);
      toast.error(error.message || 'Erro ao deletar domínio');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Gestão de Domínios" description={user?.client_name || ''}>
      {/* Criar Novo Domínio */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>CRIAR NOVO DOMÍNIO</CardTitle>
          <CardDescription>Clique no botão abaixo para criar um novo domínio no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            onClick={handleOpenCreateDialog}
            disabled={loading}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            CRIAR NOVO DOMÍNIO
          </Button>
          <p className="text-sm text-gray-500 mt-3">
            ℹ️ Serão criados automaticamente os usuários "presto" e "admin" com senha "presto123"
          </p>
        </CardContent>
      </Card>

      {/* Lista de Domínios */}
      <Card>
        <CardHeader>
          <CardTitle>DOMÍNIOS CADASTRADOS</CardTitle>
          <CardDescription>Total: {domains.length} domínios</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && domains.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              Carregando domínios...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {domains.map((domain) => (
                <Card key={domain.domain} className={`${domain.is_super_admin ? 'border-2 border-purple-500' : ''} ${!domain.is_active ? 'opacity-50' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Building2 className={`w-5 h-5 ${domain.is_super_admin ? 'text-purple-600' : 'text-blue-600'}`} />
                          <CardTitle className="text-lg">{domain.domain}</CardTitle>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{domain.name}</p>
                      </div>
                      <div className="flex gap-1">
                        {!domain.is_super_admin && domain.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDialog(domain.domain)}
                            title="Editar domínio"
                            className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                        {!domain.is_super_admin && domain.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDomainToDeactivate(domain.domain);
                              setShowDeactivateDialog(true);
                            }}
                            title="Desativar domínio"
                            className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {domain.is_super_admin && (
                      <div className="flex items-center gap-1 text-xs text-purple-600 font-medium">
                        <Shield className="w-3 h-3" />
                        SUPER ADMIN
                      </div>
                    )}
                    {!domain.is_active && (
                      <div className="flex items-center gap-1 text-xs text-orange-600 font-medium mt-1">
                        <Power className="w-3 h-3" />
                        DESATIVADO
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        Usuários
                      </span>
                      <span className="font-medium">{domain.total_users}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Shield className="w-4 h-4" />
                        Permissões
                      </span>
                      <div className="flex items-center gap-2">
                        {!domain.is_super_admin && domain.is_active && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('🔍 Navegando para permissões do domínio:', domain.domain);
                              navigate(`/admin/domain-permissions?domain=${domain.domain}`);
                            }}
                            title="Gerenciar permissões"
                            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="w-3 h-3" />
                          </Button>
                        )}
                        <span className="font-medium">{domain.total_permissions}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Desativação */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className="w-5 h-5 text-orange-600" />
              CONFIRMAR DESATIVAÇÃO
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar o domínio <strong>{domainToDeactivate}</strong>?
              <br /><br />
              ℹ️ Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Desativar o acesso ao sistema para este domínio</li>
                <li>Os usuários não poderão fazer login</li>
                <li>Os dados não serão excluídos (soft delete)</li>
                <li>É possível reativar o domínio posteriormente</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>CANCELAR</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeactivateDomain}
              className="bg-orange-600 hover:bg-orange-700"
              disabled={loading}
            >
              DESATIVAR DOMÍNIO
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Formulário (Criar/Editar) */}
      <DomainFormDialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) {
            setEditingDomain(null);
            setFormData(undefined);
          }
        }}
        domain={editingDomain || undefined}
        initialData={formData}
        onSubmit={handleSubmitForm}
        loading={loading}
      />
    </AdminLayout>
  );
}