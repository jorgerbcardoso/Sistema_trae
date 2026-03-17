import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { 
  Building2, 
  Edit2, 
  Search, 
  X, 
  Globe, 
  Mail, 
  Hash, 
  Database,
  Users,
  Shield,
  CheckCircle2,
  XCircle,
  ArrowLeft
} from 'lucide-react';
import { AdminLayout } from './layouts/AdminLayout';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { 
  getDomains, 
  updateDomain, 
  type Domain, 
  type DataSource,
  type Modalidade,
  getDomainStats
} from '../services/domainService';

export function DomainManagement() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [filteredDomains, setFilteredDomains] = useState<Domain[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Estados do formulário de edição
  const [formData, setFormData] = useState({
    client_name: '',
    website: '',
    email: '',
    modalidade: 'CARGAS' as Modalidade,
    data_source: 'MOCK' as DataSource,
    is_active: true,
    favicon_url: '',
    controla_linhas: false,
    // Credenciais SSW
    ssw_domain: '',
    ssw_username: '',
    ssw_password: '',
    ssw_cpf: '',
  });
  
  const { user } = useAuth();
  const navigate = useNavigate();

  // Carregar domínios ao montar o componente
  useEffect(() => {
    loadDomains();
  }, []);

  // Filtrar domínios quando searchTerm mudar
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredDomains(domains);
    } else {
      const term = searchTerm.toLowerCase();
      setFilteredDomains(
        domains.filter(
          d => 
            d.domain.toLowerCase().includes(term) ||
            d.client_name.toLowerCase().includes(term) ||
            d.name.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, domains]);

  const loadDomains = () => {
    const loadedDomains = getDomains();
    setDomains(loadedDomains);
    setFilteredDomains(loadedDomains);
  };

  const handleEdit = (domain: Domain) => {
    setEditingDomain(domain);
    setFormData({
      client_name: domain.client_name,
      website: domain.website,
      email: domain.email,
      modalidade: domain.modalidade,
      data_source: domain.data_source,
      is_active: domain.is_active,
      favicon_url: domain.favicon_url || '',
      controla_linhas: domain.controla_linhas || false,
      // Credenciais SSW
      ssw_domain: domain.ssw_domain || '',
      ssw_username: domain.ssw_username || '',
      ssw_password: domain.ssw_password || '',
      ssw_cpf: domain.ssw_cpf || '',
    });
    setShowEditModal(true);
  };

  const handleCloseModal = () => {
    setShowEditModal(false);
    setEditingDomain(null);
    setFormData({
      client_name: '',
      website: '',
      email: '',
      modalidade: 'CARGAS',
      data_source: 'MOCK',
      is_active: true,
      favicon_url: '',
      controla_linhas: false,
      // Credenciais SSW
      ssw_domain: '',
      ssw_username: '',
      ssw_password: '',
      ssw_cpf: '',
    });
  };

  const handleSave = async () => {
    if (!editingDomain) return;

    try {
      // Validações
      if (!formData.client_name.trim()) {
        toast.error('Nome do cliente é obrigatório');
        return;
      }

      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        toast.error('Email inválido');
        return;
      }

      // Validações SSW
      if (formData.ssw_domain && formData.ssw_domain.length !== 3) {
        toast.error('Domínio SSW deve ter exatamente 3 letras');
        return;
      }

      if (formData.ssw_domain && !/^[A-Z]{3}$/.test(formData.ssw_domain)) {
        toast.error('Domínio SSW deve conter apenas letras maiúsculas');
        return;
      }

      if (formData.ssw_username && !/^[a-z0-9_]+$/.test(formData.ssw_username)) {
        toast.error('Usuário SSW deve conter apenas letras minúsculas, números e underline');
        return;
      }

      if (formData.ssw_password && !/^[a-z0-9@_.-]+$/.test(formData.ssw_password)) {
        toast.error('Senha SSW deve conter apenas letras minúsculas, números e caracteres especiais (@_.-) ');
        return;
      }

      if (formData.ssw_cpf && !/^\d{8}$/.test(formData.ssw_cpf.replace(/\D/g, ''))) {
        toast.error('CPF SSW deve conter exatamente 8 dígitos');
        return;
      }

      // Atualizar no serviço (salva no localStorage)
      updateDomain(editingDomain.domain, {
        client_name: formData.client_name.trim(),
        website: formData.website.trim(),
        email: formData.email.trim(),
        modalidade: formData.modalidade,
        data_source: formData.data_source,
        is_active: formData.is_active,
        favicon_url: formData.favicon_url,
        controla_linhas: formData.controla_linhas,
        // Credenciais SSW
        ssw_domain: formData.ssw_domain.toUpperCase(),
        ssw_username: formData.ssw_username.toLowerCase(),
        ssw_password: formData.ssw_password.toLowerCase(),
        ssw_cpf: formData.ssw_cpf.replace(/\D/g, ''), // Remover formatação
      });

      // Recarregar domínios
      loadDomains();

      toast.success('Domínio atualizado com sucesso!');
      handleCloseModal();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar domínio');
    }
  };

  const getModalidadeBadgeColor = (modalidade: string) => {
    switch (modalidade) {
      case 'CARGAS': return 'bg-blue-500';
      case 'PASSAGEIROS': return 'bg-green-500';
      case 'MISTA': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getDataSourceInfo = (dataSource: DataSource) => {
    if (dataSource === 'MOCK') {
      return {
        label: 'Mock Data',
        color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
        icon: <Database className="h-4 w-4" />
      };
    } else {
      return {
        label: 'Backend Real',
        color: 'bg-green-500/10 text-green-700 border-green-500/20',
        icon: <Database className="h-4 w-4" />
      };
    }
  };

  const stats = getDomainStats();

  return (
    <AdminLayout
      title="GESTÃO DE DOMÍNIOS"
      subtitle="Gerenciar domínios, modalidades e fonte de dados"
      icon={<Building2 className="h-6 w-6" />}
    >
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <Building2 className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total de Domínios</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Ativos</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-500/10 rounded-lg">
                <Database className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Mock Data</p>
                <p className="text-2xl font-bold">{stats.mock}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/10 rounded-lg">
                <Database className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Backend Real</p>
                <p className="text-2xl font-bold">{stats.backend}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Pesquisa */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Pesquisar por domínio ou nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
              >
                <X className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Grid de Cards de Domínios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDomains.map((domain) => {
          const dataSourceInfo = getDataSourceInfo(domain.data_source);
          
          return (
            <Card key={domain.domain} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{domain.domain}</CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {domain.name}
                      </CardDescription>
                    </div>
                  </div>
                  {domain.is_super_admin && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20">
                      <Shield className="h-3 w-3 mr-1" />
                      ADMIN
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Informações */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Hash className="h-4 w-4" />
                    <span className="truncate">{domain.client_name}</span>
                  </div>
                  
                  {domain.website && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Globe className="h-4 w-4" />
                      <span className="truncate">{domain.website}</span>
                    </div>
                  )}
                  
                  {domain.email && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Mail className="h-4 w-4" />
                      <span className="truncate">{domain.email}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>{domain.total_users} usuários</span>
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge className={getModalidadeBadgeColor(domain.modalidade)}>
                    {domain.modalidade}
                  </Badge>
                  
                  <Badge variant="outline" className={dataSourceInfo.color}>
                    {dataSourceInfo.icon}
                    <span className="ml-1">{dataSourceInfo.label}</span>
                  </Badge>
                  
                  {domain.is_active ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/20">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/20">
                      <XCircle className="h-3 w-3 mr-1" />
                      Inativo
                    </Badge>
                  )}
                </div>

                {/* Botão de Edição */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => handleEdit(domain)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Mensagem se não houver resultados */}
      {filteredDomains.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">
              {searchTerm ? 'Nenhum domínio encontrado com esse critério' : 'Nenhum domínio cadastrado'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal de Edição */}
      {showEditModal && editingDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain bg-slate-900 border-slate-700 text-white">{/* ✅ ADICIONADO overscroll-contain para permitir scroll */}
            <CardHeader className="border-b border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl text-white">Editar Domínio</CardTitle>
                  <CardDescription className="text-slate-400">
                    {editingDomain.domain} - {editingDomain.name}
                  </CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="pt-6">
              <div className="space-y-6">
                {/* Nome do Cliente */}
                <div>
                  <Label htmlFor="client_name" className="text-slate-300">Nome do Cliente *</Label>
                  <Input
                    id="client_name"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="Nome completo da empresa"
                    className="mt-1.5 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                {/* Website */}
                <div>
                  <Label htmlFor="website" className="text-slate-300">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="exemplo.com.br"
                    className="mt-1.5 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                {/* Email */}
                <div>
                  <Label htmlFor="email" className="text-slate-300">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="contato@exemplo.com.br"
                    className="mt-1.5 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                {/* Modalidade */}
                <div>
                  <Label htmlFor="modalidade" className="text-slate-300">Modalidade *</Label>
                  <select
                    id="modalidade"
                    value={formData.modalidade}
                    onChange={(e) => setFormData({ ...formData, modalidade: e.target.value as Modalidade })}
                    className="mt-1.5 w-full rounded-md border border-slate-600 bg-slate-800/50 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CARGAS">CARGAS</option>
                    <option value="PASSAGEIROS">PASSAGEIROS</option>
                    <option value="MISTA">MISTA</option>
                  </select>
                  <p className="text-xs text-slate-400 mt-1.5">
                    Define quais funcionalidades estarão disponíveis no sistema
                  </p>
                </div>

                {/* Controle de Linhas */}
                <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                  <Label className="text-base text-slate-300">Controle de Linhas</Label>
                  <p className="text-xs text-slate-400 mt-1 mb-3">
                    Define se a empresa utiliza controle de linhas de transporte
                  </p>
                  
                  <div className="space-y-3 mt-3">
                    <label className="flex items-start gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors bg-slate-800/50">
                      <input
                        type="radio"
                        name="controla_linhas"
                        value="true"
                        checked={formData.controla_linhas === true}
                        onChange={() => setFormData({ ...formData, controla_linhas: true })}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          <span className="font-medium text-white">Sim, controla linhas</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          A empresa possui controle de linhas de transporte. Dados serão buscados do backend.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors bg-slate-800/50">
                      <input
                        type="radio"
                        name="controla_linhas"
                        value="false"
                        checked={formData.controla_linhas === false}
                        onChange={() => setFormData({ ...formData, controla_linhas: false })}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-400" />
                          <span className="font-medium text-white">Não controla linhas</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          A empresa não possui controle de linhas. Dados serão sempre mockados (fictícios).
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="mt-3 p-3 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
                    <p className="text-xs text-yellow-300">
                      <strong>⚠️ Importante:</strong> Se a empresa não controla linhas, a aba "Linhas" no dashboard 
                      financeiro sempre exibirá dados fictícios, independente do ambiente.
                    </p>
                  </div>
                </div>

                {/* Fonte de Dados */}
                <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                  <Label htmlFor="data_source" className="text-base text-slate-300">Fonte de Dados *</Label>
                  <p className="text-xs text-slate-400 mt-1 mb-3">
                    Controle de onde o sistema busca os dados ao fazer login
                  </p>
                  
                  <div className="space-y-3 mt-3">
                    <label className="flex items-start gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors bg-slate-800/50">
                      <input
                        type="radio"
                        name="data_source"
                        value="MOCK"
                        checked={formData.data_source === 'MOCK'}
                        onChange={(e) => setFormData({ ...formData, data_source: e.target.value as DataSource })}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-yellow-400" />
                          <span className="font-medium text-white">Mock Data (Dados Simulados)</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Usa dados mockados no frontend. Ideal para desenvolvimento e testes.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors bg-slate-800/50">
                      <input
                        type="radio"
                        name="data_source"
                        value="BACKEND"
                        checked={formData.data_source === 'BACKEND'}
                        onChange={(e) => setFormData({ ...formData, data_source: e.target.value as DataSource })}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Database className="h-4 w-4 text-green-400" />
                          <span className="font-medium text-white">Backend Real (PHP + PostgreSQL)</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Conecta ao backend em produção. Requer API configurada no servidor.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                    <p className="text-xs text-blue-300">
                      <strong>💡 Nota:</strong> No Figma Make, sempre será usado Mock Data independente desta configuração. 
                      Em localhost, esta configuração é respeitada.
                    </p>
                  </div>
                </div>

                {/* Status de Ativação */}
                <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                  <Label className="text-base text-slate-300">Status do Domínio *</Label>
                  <p className="text-xs text-slate-400 mt-1 mb-3">
                    Domínios desativados não permitirão login
                  </p>
                  
                  <div className="space-y-3 mt-3">
                    <label className="flex items-start gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors bg-slate-800/50">
                      <input
                        type="radio"
                        name="is_active"
                        value="true"
                        checked={formData.is_active === true}
                        onChange={() => setFormData({ ...formData, is_active: true })}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          <span className="font-medium text-white">Ativo</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Usuários podem fazer login normalmente neste domínio.
                        </p>
                      </div>
                    </label>

                    <label className="flex items-start gap-3 p-3 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors bg-slate-800/50">
                      <input
                        type="radio"
                        name="is_active"
                        value="false"
                        checked={formData.is_active === false}
                        onChange={() => setFormData({ ...formData, is_active: false })}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-400" />
                          <span className="font-medium text-white">Inativo</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Bloqueará o login de todos os usuários deste domínio.
                        </p>
                      </div>
                    </label>
                  </div>

                  <div className="mt-3 p-3 bg-red-900/20 border border-red-800/30 rounded-lg">
                    <p className="text-xs text-red-300">
                      <strong>⚠️ Atenção:</strong> Desativar um domínio impedirá que TODOS os usuários 
                      façam login até que seja reativado.
                    </p>
                  </div>
                </div>

                {/* Credenciais SSW */}
                <div className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                  <Label className="text-base text-slate-300">Credenciais SSW</Label>
                  <p className="text-xs text-slate-400 mt-1 mb-3">
                    Informe as credenciais para acesso ao sistema SSW
                  </p>
                  
                  <div className="space-y-3 mt-3">
                    <div>
                      <Label htmlFor="ssw_domain" className="text-slate-300">Domínio SSW *</Label>
                      <Input
                        id="ssw_domain"
                        value={formData.ssw_domain}
                        onChange={(e) => setFormData({ ...formData, ssw_domain: e.target.value.toUpperCase() })}
                        placeholder="XXX"
                        maxLength={3}
                        className="mt-1.5 uppercase bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        3 letras maiúsculas
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="ssw_username" className="text-slate-300">Usuário SSW *</Label>
                      <Input
                        id="ssw_username"
                        value={formData.ssw_username}
                        onChange={(e) => setFormData({ ...formData, ssw_username: e.target.value.toLowerCase() })}
                        placeholder="presto"
                        className="mt-1.5 lowercase bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Apenas letras minúsculas, números e underline
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="ssw_password" className="text-slate-300">Senha SSW *</Label>
                      <Input
                        id="ssw_password"
                        type="password"
                        value={formData.ssw_password}
                        onChange={(e) => setFormData({ ...formData, ssw_password: e.target.value.toLowerCase() })}
                        placeholder="web@pres"
                        className="mt-1.5 lowercase bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        Apenas letras minúsculas, números e caracteres especiais (@_.-) 
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="ssw_cpf" className="text-slate-300">CPF SSW *</Label>
                      <Input
                        id="ssw_cpf"
                        value={formData.ssw_cpf}
                        onChange={(e) => {
                          // Permitir apenas números
                          const value = e.target.value.replace(/\D/g, '');
                          setFormData({ ...formData, ssw_cpf: value });
                        }}
                        placeholder="11111160"
                        maxLength={8}
                        className="mt-1.5 bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500"
                      />
                      <p className="text-xs text-slate-400 mt-1">
                        8 dígitos numéricos
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                    <p className="text-xs text-blue-300">
                      <strong>💡 Padrão:</strong> Domínio = mesmo do Presto, Usuário = presto, Senha = web@pres, CPF = 11111160
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>

            <div className="border-t border-slate-700 p-6 flex justify-end gap-3 bg-slate-900">
              <Button
                variant="outline"
                onClick={handleCloseModal}
                className="border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Salvar Alterações
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AdminLayout>
  );
}