import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { Building2, Save, X } from 'lucide-react';

export interface DomainFormData {
  name: string;
  cnpj: string;
  phone: string;
  address: string;
  website: string;
  email: string;
  modalidade: string;
  favicon_url: string;
  controla_linhas: boolean;
  use_mock_data: boolean;
  aprova_pedidos_manuais: boolean;
  ssw_domain: string;
  ssw_username: string;
  ssw_password: string;
  ssw_cpf: string;
  logo_light: string;
  logo_dark: string;
}

interface DomainFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain?: string; // Se fornecido, é edição. Se não, é criação
  initialData?: Partial<DomainFormData>;
  onSubmit: (domain: string, data: DomainFormData) => Promise<void>;
  loading?: boolean;
}

const emptyFormData: DomainFormData = {
  name: '',
  cnpj: '',
  phone: '',
  address: '',
  website: '',
  email: '',
  modalidade: 'CARGAS',
  favicon_url: '',
  controla_linhas: false,
  use_mock_data: true,
  aprova_pedidos_manuais: false,
  ssw_domain: '',
  ssw_username: '',
  ssw_password: '',
  ssw_cpf: '',
  logo_light: '',
  logo_dark: '',
};

export function DomainFormDialog({
  open,
  onOpenChange,
  domain,
  initialData,
  onSubmit,
  loading = false,
}: DomainFormDialogProps) {
  const [domainCode, setDomainCode] = useState(domain || '');
  const [formData, setFormData] = useState<DomainFormData>(emptyFormData);

  const isEditMode = !!domain;

  useEffect(() => {
    if (open) {
      if (initialData) {
        setFormData({ ...emptyFormData, ...initialData });
      } else {
        setFormData(emptyFormData);
      }
      setDomainCode(domain || '');
    }
  }, [open, domain, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!isEditMode && !domainCode) {
      toast.error('Digite um código de domínio válido');
      return;
    }

    if (!isEditMode && !/^[A-Z]{3}$/.test(domainCode)) {
      toast.error('Domínio deve ter exatamente 3 letras maiúsculas');
      return;
    }

    if (!formData.name) {
      toast.error('Nome da empresa é obrigatório');
      return;
    }

    // NÃO fechar aqui! O onSubmit em GestaoDominios já cuida disso
    await onSubmit(domainCode, formData);
  };

  const handleChange = (field: keyof DomainFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto overscroll-contain">{/* ✅ ADICIONADO overscroll-contain para permitir scroll */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {isEditMode ? `Editar Domínio: ${domain}` : 'Criar Novo Domínio'}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Atualize as informações do domínio abaixo'
              : 'Preencha as informações para criar um novo domínio'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6 py-4">
            {/* CÓDIGO DO DOMÍNIO (apenas na criação) */}
            {!isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="domain">Código do Domínio *</Label>
                <Input
                  id="domain"
                  placeholder="ABC"
                  value={domainCode}
                  onChange={(e) => setDomainCode(e.target.value.toUpperCase().slice(0, 3))}
                  maxLength={3}
                  required
                  disabled={loading}
                  className="uppercase"
                />
                <p className="text-xs text-gray-500">
                  Código de 3 letras maiúsculas (ex: ABC, XYZ)
                </p>
              </div>
            )}

            {/* INFORMAÇÕES BÁSICAS */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 border-b pb-2">
                Informações Básicas
              </h3>

              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Nome completo da empresa"
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => handleChange('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="(00) 0000-0000"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  placeholder="Endereço completo"
                  disabled={loading}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleChange('website', e.target.value)}
                    placeholder="https://www.exemplo.com.br"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="contato@exemplo.com.br"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* CONFIGURAÇÕES DO SISTEMA */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 border-b pb-2">
                Configurações do Sistema
              </h3>

              <div className="space-y-2">
                <Label htmlFor="modalidade">Modalidade</Label>
                <select
                  id="modalidade"
                  value={formData.modalidade}
                  onChange={(e) => handleChange('modalidade', e.target.value)}
                  disabled={loading}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CARGAS">CARGAS</option>
                  <option value="PASSAGEIROS">PASSAGEIROS</option>
                  <option value="MISTO">MISTO</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="favicon_url">Favicon URL</Label>
                <Input
                  id="favicon_url"
                  value={formData.favicon_url}
                  onChange={(e) => handleChange('favicon_url', e.target.value)}
                  placeholder="https://exemplo.com.br/favicon.ico"
                  disabled={loading}
                />
              </div>

              <div className="flex flex-col space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="controla_linhas"
                    checked={formData.controla_linhas}
                    onCheckedChange={(checked) => handleChange('controla_linhas', checked)}
                    disabled={loading}
                  />
                  <Label htmlFor="controla_linhas" className="cursor-pointer">
                    Controla Linhas
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="use_mock_data"
                    checked={formData.use_mock_data}
                    onCheckedChange={(checked) => handleChange('use_mock_data', checked)}
                    disabled={loading}
                  />
                  <Label htmlFor="use_mock_data" className="cursor-pointer">
                    Usar Dados Mock (Dashboard)
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="aprova_pedidos_manuais"
                    checked={formData.aprova_pedidos_manuais}
                    onCheckedChange={(checked) => handleChange('aprova_pedidos_manuais', checked)}
                    disabled={loading}
                  />
                  <Label htmlFor="aprova_pedidos_manuais" className="cursor-pointer">
                    Aprova Pedidos Manuais
                  </Label>
                </div>
              </div>
            </div>

            {/* CREDENCIAIS SSW */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 border-b pb-2">
                Credenciais SSW
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssw_domain">SSW Domain</Label>
                  <Input
                    id="ssw_domain"
                    value={formData.ssw_domain}
                    onChange={(e) => handleChange('ssw_domain', e.target.value)}
                    placeholder="sswsuite.com.br"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssw_username">SSW Username</Label>
                  <Input
                    id="ssw_username"
                    value={formData.ssw_username}
                    onChange={(e) => handleChange('ssw_username', e.target.value)}
                    placeholder="usuario"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ssw_password">SSW Password</Label>
                  <Input
                    id="ssw_password"
                    type="password"
                    value={formData.ssw_password}
                    onChange={(e) => handleChange('ssw_password', e.target.value)}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ssw_cpf">SSW CPF</Label>
                  <Input
                    id="ssw_cpf"
                    value={formData.ssw_cpf}
                    onChange={(e) => handleChange('ssw_cpf', e.target.value)}
                    placeholder="000.000.000-00"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* BRANDING */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-300 border-b pb-2">
                Branding
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="logo_light">Logo Light URL</Label>
                  <Input
                    id="logo_light"
                    value={formData.logo_light}
                    onChange={(e) => handleChange('logo_light', e.target.value)}
                    placeholder="https://exemplo.com.br/logo-light.png"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo_dark">Logo Dark URL</Label>
                  <Input
                    id="logo_dark"
                    value={formData.logo_dark}
                    onChange={(e) => handleChange('logo_dark', e.target.value)}
                    placeholder="https://exemplo.com.br/logo-dark.png"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : isEditMode ? 'Atualizar' : 'Criar Domínio'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}