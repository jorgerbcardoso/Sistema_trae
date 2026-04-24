import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Calendar, Loader2, Search, Settings2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

interface ClienteAgendavel {
  cnpj: string;
  nome: string;
  cidade: string;
  agenda: boolean;
}

/**
 * CENTRAL DE AGENDAMENTO - Dashboard de Agendamento
 *
 * Dashboard para gestão e acompanhamento de agendamentos de coletas e entregas.
 * A estrutura segue o padrão dos demais dashboards do sistema.
 */
export function CentralAgendamento() {
  const { user } = useAuth();
  usePageTitle('Central de Agendamento');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [clientes, setClientes] = useState<ClienteAgendavel[]>([]);
  const [isLoadingClientes, setIsLoadingClientes] = useState(false);
  const [savingCnpjs, setSavingCnpjs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    loadClientes(searchTerm);
  }, [isDialogOpen, searchTerm]);

  const totalAgendaveis = useMemo(
    () => clientes.filter((cliente) => cliente.agenda).length,
    [clientes]
  );

  const loadClientes = async (search = '') => {
    try {
      setIsLoadingClientes(true);

      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/central-agendamento/clientes_agendaveis_list.php`,
        {
          method: 'POST',
          body: JSON.stringify({ search }),
        },
        true
      );

      if (response.success) {
        setClientes(response.clientes || []);
      } else {
        setClientes([]);
        toast.error(response.message || 'Erro ao carregar clientes agendáveis');
      }
    } catch (error: any) {
      console.error('Erro ao carregar clientes agendáveis:', error);
      setClientes([]);
      toast.error(error.message || 'Erro ao carregar clientes agendáveis');
    } finally {
      setIsLoadingClientes(false);
    }
  };

  const handleSearch = () => {
    setSearchTerm(searchDraft.trim());
  };

  const handleToggleAgenda = async (cliente: ClienteAgendavel, checked: boolean) => {
    const agenda = !!checked;

    setSavingCnpjs((prev) => new Set(prev).add(cliente.cnpj));
    setClientes((prev) =>
      prev.map((item) =>
        item.cnpj === cliente.cnpj
          ? {
              ...item,
              agenda,
            }
          : item
      )
    );

    try {
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/central-agendamento/clientes_agendaveis_update.php`,
        {
          method: 'POST',
          body: JSON.stringify({
            cnpj: cliente.cnpj,
            agenda,
          }),
        },
        true
      );

      if (response.success) {
        toast.success(
          agenda
            ? 'Cliente marcado como agendável'
            : 'Cliente removido dos agendáveis'
        );
      } else {
        throw new Error(response.message || 'Não foi possível salvar a alteração');
      }
    } catch (error: any) {
      setClientes((prev) =>
        prev.map((item) =>
          item.cnpj === cliente.cnpj
            ? {
                ...item,
                agenda: cliente.agenda,
              }
            : item
        )
      );
      toast.error(error.message || 'Erro ao atualizar cliente agendável');
    } finally {
      setSavingCnpjs((prev) => {
        const next = new Set(prev);
        next.delete(cliente.cnpj);
        return next;
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Central de Agendamento
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Dashboard para gestão e acompanhamento de agendamentos
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="gap-2"
          >
            <Settings2 className="h-4 w-4" />
            Clientes Agendáveis
          </Button>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Central de Agendamento</CardTitle>
              <CardDescription>
                Dashboard para gestão de agendamentos de coletas, entregas e recursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <div className="text-4xl mb-4">AG</div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Central de Agendamento
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Sistema de gestão de agendamentos em desenvolvimento
                </p>

                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Funcionalidades previstas:
                  </h4>
                  <ul className="text-left text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>• Agendamento de coletas e entregas</li>
                    <li>• Calendário de recursos e veículos</li>
                    <li>• Controle de prazos e horários</li>
                    <li>• Dashboard de performance</li>
                  </ul>
                </div>

                <div className="mt-4 text-xs text-slate-500 dark:text-slate-500">
                  Versão: 1.0.0 | Status: Desenvolvimento
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Métrica 1</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-slate-500 dark:text-slate-500">Em desenvolvimento</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Métrica 2</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-slate-500 dark:text-slate-500">Em desenvolvimento</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Métrica 3</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-slate-500 dark:text-slate-500">Em desenvolvimento</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-4xl h-[80vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle>Clientes Agendáveis</DialogTitle>
              <DialogDescription>
                Defina quais clientes agendam mercadorias com recorrência. A listagem traz até 500 registros, priorizando os clientes já marcados.
              </DialogDescription>
            </DialogHeader>

            <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 overflow-hidden">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        handleSearch();
                      }
                    }}
                    placeholder="Buscar por nome ou cidade do cliente"
                    className="pl-9"
                  />
                </div>
                <Button type="button" variant="outline" onClick={handleSearch} className="gap-2">
                  <Search className="h-4 w-4" />
                  Buscar
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Badge variant="secondary" className="gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {totalAgendaveis} agendáveis
                </Badge>
                <Badge variant="outline">
                  {clientes.length} registros exibidos
                </Badge>
                <span className="text-xs">Limite técnico de 500 registros por busca</span>
              </div>

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 grid grid-rows-[auto_minmax(0,1fr)] min-h-0 overflow-hidden">
                <div className="grid grid-cols-[80px_minmax(0,1fr)_220px_110px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                  <span>Agenda</span>
                  <span>Cliente</span>
                  <span>Cidade</span>
                  <span className="text-right">CNPJ</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {isLoadingClientes ? (
                      <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando clientes...
                      </div>
                    ) : clientes.length === 0 ? (
                      <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                        <Building2 className="h-6 w-6" />
                        Nenhum cliente encontrado para os filtros informados.
                      </div>
                    ) : (
                      clientes.map((cliente) => {
                        const isSaving = savingCnpjs.has(cliente.cnpj);

                        return (
                          <label
                            key={cliente.cnpj}
                            className="grid cursor-pointer grid-cols-[80px_minmax(0,1fr)_220px_110px] gap-3 px-4 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50"
                          >
                            <div className="flex items-center">
                              <Checkbox
                                checked={cliente.agenda}
                                disabled={isSaving}
                                onCheckedChange={(checked) => handleToggleAgenda(cliente, !!checked)}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                                {cliente.nome || 'CLIENTE SEM NOME'}
                              </div>
                            </div>
                            <div className="truncate self-center text-sm text-slate-600 dark:text-slate-300">
                              {cliente.cidade || '-'}
                            </div>
                            <div className="self-center text-right text-xs font-mono text-slate-500 dark:text-slate-400">
                              {isSaving ? 'Salvando...' : cliente.cnpj}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
