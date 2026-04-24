import React, { useEffect, useMemo, useState } from 'react';
import { 
  Building2, 
  Calendar, 
  Check, 
  CheckCircle, 
  Clock, 
  ClockCheck, 
  Filter, 
  Loader2, 
  Search, 
  Settings2, 
  X,
  AlertCircle
} from 'lucide-react';
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
  DialogTrigger,
} from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { FilterSelectCliente } from './FilterSelectCliente';
import { FilterSelectUnidadeOrdered } from '../cadastros/FilterSelectUnidadeOrdered';
import { toast } from 'sonner';

interface ClienteAgendavel {
  cnpj: string;
  nome: string;
  cidade: string;
  agenda: boolean;
}

interface Filters {
  periodoEmissaoInicio: string;
  periodoEmissaoFim: string;
  periodoPrevisaoInicio: string;
  periodoPrevisaoFim: string;
  unidadeDestino: string[];
  cnpjPagador: string;
  cnpjDestinatario: string;
}

function getLast30DaysPeriod() {
  const now = new Date();
  const past = new Date();
  past.setDate(now.getDate() - 30);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    inicio: formatDate(past),
    fim: formatDate(now)
  };
}

function formatPeriodDisplay(inicio: string, fim: string): string {
  if (!inicio && !fim) return '';

  const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10)
    };
  };

  const start = parseDate(inicio);
  const end = parseDate(fim);

  if (!start || !end) return '';

  if (start.month === end.month && start.year === end.year) {
    return `${MONTHS[start.month - 1]} ${start.year}`;
  }

  if (start.year === end.year) {
    return `${MONTHS[start.month - 1]} - ${MONTHS[end.month - 1]} ${start.year}`;
  }

  return `${MONTHS[start.month - 1]} ${start.year} - ${MONTHS[end.month - 1]} ${end.year}`;
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
  const defaultPeriod = getLast30DaysPeriod();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [clientes, setClientes] = useState<ClienteAgendavel[]>([]);
  const [isLoadingClientes, setIsLoadingClientes] = useState(false);
  const [savingCnpjs, setSavingCnpjs] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<Filters>({
    periodoEmissaoInicio: defaultPeriod.inicio,
    periodoEmissaoFim: defaultPeriod.fim,
    periodoPrevisaoInicio: '',
    periodoPrevisaoFim: '',
    unidadeDestino: [],
    cnpjPagador: '',
    cnpjDestinatario: '',
  });
  const [tempFilters, setTempFilters] = useState<Filters>(filters);
  const [relógios, setRelógios] = useState<Relógio[]>([]);
  const [isLoadingRelógios, setIsLoadingRelógios] = useState(false);

  interface Relógio {
    id: number;
    nome: string;
    descricao: string;
    quantidade: number;
    percentual: number;
    cor: string;
    icone: string;
  }

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    loadClientes(searchTerm);
  }, [isDialogOpen, searchTerm]);

  useEffect(() => {
    carregarRelógios();
  }, [filters]);

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

  const applyFilters = () => {
    setFilters({ ...tempFilters });
    setShowFilters(false);
  };

  const cancelFilters = () => {
    setTempFilters({ ...filters });
    setShowFilters(false);
  };

  const clearFilters = () => {
    const emptyFilters: Filters = {
      periodoEmissaoInicio: '',
      periodoEmissaoFim: '',
      periodoPrevisaoInicio: '',
      periodoPrevisaoFim: '',
      unidadeDestino: [],
      cnpjPagador: '',
      cnpjDestinatario: '',
    };

    setTempFilters(emptyFilters);
  };

  const getIcone = (nome: string) => {
    const icones: Record<string, React.ElementType> = {
      CheckCircle,
      Clock,
      ClockCheck,
      AlertCircle
    };
    return icones[nome] || null;
  };

  const getPeriodDisplay = () => {
    const emissionPeriod = formatPeriodDisplay(filters.periodoEmissaoInicio, filters.periodoEmissaoFim);
    const previsaoPeriod = formatPeriodDisplay(filters.periodoPrevisaoInicio, filters.periodoPrevisaoFim);

    if (emissionPeriod && previsaoPeriod) {
      return `${emissionPeriod} | Prev.: ${previsaoPeriod}`;
    }

    if (emissionPeriod) return emissionPeriod;
    if (previsaoPeriod) return `Prev.: ${previsaoPeriod}`;
    return 'Sem período definido';
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

  const carregarRelógios = async () => {
    try {
      setIsLoadingRelógios(true);

      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/central-agendamento/get_cards.php`,
        {
          method: 'POST',
          body: JSON.stringify({ filters }),
        },
        true
      );

      if (response.success) {
        setRelógios(response.relógios || []);
      } else {
        setRelógios([]);
        toast.error(response.message || 'Erro ao carregar relógios');
      }
    } catch (error: any) {
      console.error('Erro ao carregar relógios:', error);
      setRelógios([]);
      toast.error(error.message || 'Erro ao carregar relógios');
    } finally {
      setIsLoadingRelógios(false);
    }
  };

  const headerActions = (
    <div className="flex items-center gap-2 md:gap-4">
      <div className="text-right print:block">
        <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm hidden md:block">Período</p>
        <p className="text-slate-900 dark:text-slate-100 text-xs md:text-base">{getPeriodDisplay()}</p>
      </div>

      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
                >
                  <Filter className="w-4 h-4" />
                </Button>
              </DialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>Filtrar Período</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DialogContent className="sm:max-w-[700px] bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-slate-100">Filtros de Pesquisa</DialogTitle>
            <DialogDescription className="text-slate-600 dark:text-slate-400">
              Personalize a visualização filtrando por período, unidade e empresas
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <Label className="text-slate-900 dark:text-slate-100">Período de Emissão</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoEmissaoInicio}
                    onChange={(e) => setTempFilters({...tempFilters, periodoEmissaoInicio: e.target.value})}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoEmissaoFim}
                    onChange={(e) => setTempFilters({...tempFilters, periodoEmissaoFim: e.target.value})}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-slate-900 dark:text-slate-100">Período de Previsão de Entrega</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">Data Início</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoPrevisaoInicio}
                    onChange={(e) => setTempFilters({...tempFilters, periodoPrevisaoInicio: e.target.value})}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-600 dark:text-slate-400">Data Fim</Label>
                  <Input
                    type="date"
                    value={tempFilters.periodoPrevisaoFim}
                    onChange={(e) => setTempFilters({...tempFilters, periodoPrevisaoFim: e.target.value})}
                    className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">Unidade(s) Destino</Label>
                <FilterSelectUnidadeOrdered
                  value={tempFilters.unidadeDestino}
                  onChange={(value) => setTempFilters({...tempFilters, unidadeDestino: value})}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">CNPJ Pagador</Label>
                <FilterSelectCliente
                  type="pagador"
                  value={tempFilters.cnpjPagador}
                  onChange={(value) => setTempFilters({...tempFilters, cnpjPagador: value})}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">CNPJ Destinatário</Label>
                <FilterSelectCliente
                  type="destinatario"
                  value={tempFilters.cnpjDestinatario}
                  onChange={(value) => setTempFilters({...tempFilters, cnpjDestinatario: value})}
                />
              </div>
            </div>

            <div className="flex justify-between gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4 mr-2" />
                Limpar Tudo
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={cancelFilters}
                  className="dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={applyFilters}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Aplicar Filtros
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="outline"
        onClick={() => setIsDialogOpen(true)}
        className="gap-2 dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
      >
        <Settings2 className="h-4 w-4" />
        <span className="hidden md:inline">Clientes Agendáveis</span>
      </Button>
    </div>
  );

  return (
    <DashboardLayout
      title="Central de Agendamento"
      description={user?.client_name}
      headerActions={headerActions}
    >
      <main className="container mx-auto px-3 md:px-6 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Central de Agendamento</h2>
          <p className="text-slate-500 dark:text-slate-400">
            Acompanhamento de mercadorias agendadas, filtros operacionais e análises de performance
          </p>
        </div>

        <div className="grid gap-6">
          {/* CARDS DE RELOGIOS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isLoadingRelógios ? (
              <div className="col-span-1 md:col-span-2 lg:col-span-4 flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                <span className="ml-3 text-slate-500 dark:text-slate-400">Carregando relógios...</span>
              </div>
            ) : relógios.length === 0 ? (
              <div className="col-span-1 md:col-span-2 lg:col-span-4 flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">Nenhum dado encontrado para os filtros selecionados</p>
              </div>
            ) : (
              relógios.map((relógio) => {
                const Icone = getIcone(relógio.icone);
                return (
                  <Card key={relógio.id} className="border-l-4" style={{ borderLeftColor: relógio.cor }}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center gap-2">
                        {Icone && <Icone className="h-5 w-5" style={{ color: relógio.cor }} />}
                        <CardTitle className="text-sm font-semibold" style={{ color: relógio.cor }}>
                          {relógio.nome}
                        </CardTitle>
                      </div>
                      <CardDescription className="text-xs mt-1">{relógio.descricao}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-3xl font-bold" style={{ color: relógio.cor }}>
                            {relógio.quantidade}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {relógio.percentual}% do total
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          <div className="grid gap-6">
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
      </main>
    </DashboardLayout>
  );
}
