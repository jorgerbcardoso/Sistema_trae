import React, { useEffect, useMemo, useState } from 'react';
import { 
  Building2, 
  Calendar, 
  CalendarCheck,
  Check, 
  CheckCircle, 
  Clock, 
  ClockCheck, 
  Filter, 
  Loader2, 
  Mail,
  Search, 
  Send,
  Settings2, 
  X,
  AlertCircle,
} from 'lucide-react';
import { PieChart, Pie, Cell } from 'recharts';
import { useTheme } from '../ThemeProvider';
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
import { CalendarioAgendamentos, DiaAgendamento } from './CalendarioAgendamentos';
import { toast } from 'sonner';

interface ClienteAgendavel {
  cnpj: string;
  nome: string;
  cidade: string;
  agenda: boolean;
}

interface Cte {
  ser_cte: string;
  nro_cte: string;
  data_emissao: string;
  data_prev_ent: string;
  data_prev_ent_iso: string;
  nome_pag: string;
  nome_dest: string;
  cnpj_dest: string;
  email_dest: string;
  ult_ocor: string;
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
  const { theme } = useTheme();
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
  const [relógios, setRelógios] = useState<Relógio[]>([
    { id: 1, nome: 'CT-es Agendáveis',          descricao: 'Clientes agendáveis sem ocorrência de agendamento',         quantidade: 0, percentual: 0, cor: '#6366f1', icone: 'CalendarCheck' },
    { id: 2, nome: 'Aguardando Agendamento',     descricao: 'CT-es com ocorrência 14 (aguardando agendamento)',          quantidade: 0, percentual: 0, cor: '#3b82f6', icone: 'Clock'         },
    { id: 3, nome: 'Agendados ainda no Prazo',   descricao: 'Ocorrência 15, previsão futura e sem entrega registrada',   quantidade: 0, percentual: 0, cor: '#10b981', icone: 'ClockCheck'    },
    { id: 4, nome: 'Agendamentos Cumpridos',     descricao: 'Entregues dentro do prazo previsto',                        quantidade: 0, percentual: 0, cor: '#059669', icone: 'CheckCircle', destaque: true },
    { id: 5, nome: 'Agendamentos Perdidos',      descricao: 'Sem entrega no prazo ou entregues com atraso',              quantidade: 0, percentual: 0, cor: '#ef4444', icone: 'AlertCircle'   },
  ]);
  const [isLoadingRelógios, setIsLoadingRelógios] = useState(false);

  const [cardDialogOpen, setCardDialogOpen] = useState(false);
  const [cardDialogId, setCardDialogId] = useState<number | null>(null);
  const [cardDialogNome, setCardDialogNome] = useState('');
  const [ctes, setCtes] = useState<Cte[]>([]);
  const [isLoadingCtes, setIsLoadingCtes] = useState(false);
  const [selectedCtes, setSelectedCtes] = useState<Set<string>>(new Set());
  const [selectedCnpjDest, setSelectedCnpjDest] = useState<string | null>(null);

  const [confirmAllDialogOpen, setConfirmAllDialogOpen] = useState(false);
  const [pendingCte, setPendingCte] = useState<Cte | null>(null);

  const [agendDialogOpen, setAgendDialogOpen] = useState(false);

  const [calendarioPeriodo, setCalendarioPeriodo] = useState<7 | 15 | 30>(15);
  const [calendarioDias, setCalendarioDias] = useState<DiaAgendamento[]>([]);
  const [isLoadingCalendario, setIsLoadingCalendario] = useState(false);
  const [agendEmail, setAgendEmail] = useState('');
  const [agendData, setAgendData] = useState('');
  const [isSendingAgend, setIsSendingAgend] = useState(false);

  interface Relógio {
    id: number;
    nome: string;
    descricao: string;
    quantidade: number;
    percentual: number;
    cor: string;
    icone: string;
    destaque?: boolean;
  }

  const cardConfig: Record<number, { bgColor: string; textColor: string; emptyColor: string; emptyColorDark: string }> = {
    1: { bgColor: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950 dark:to-indigo-900 border-indigo-200 dark:border-indigo-800', textColor: 'text-indigo-700 dark:text-indigo-300', emptyColor: '#e0e7ff', emptyColorDark: '#1e1b4b' },
    2: { bgColor: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800',     textColor: 'text-blue-700 dark:text-blue-300',   emptyColor: '#dbeafe', emptyColorDark: '#1e3a8a' },
    3: { bgColor: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 border-emerald-200 dark:border-emerald-800', textColor: 'text-emerald-700 dark:text-emerald-300', emptyColor: '#d1fae5', emptyColorDark: '#064e3b' },
    4: { bgColor: 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800',   textColor: 'text-green-700 dark:text-green-300',   emptyColor: '#dcfce7', emptyColorDark: '#14532d' },
    5: { bgColor: 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800',             textColor: 'text-red-700 dark:text-red-300',     emptyColor: '#fee2e2', emptyColorDark: '#7f1d1d' },
  };

  useEffect(() => {
    if (!isDialogOpen) {
      return;
    }

    loadClientes(searchTerm);
  }, [isDialogOpen, searchTerm]);

  useEffect(() => {
    carregarRelógios();
  }, [filters]);

  useEffect(() => {
    carregarCalendario();
  }, [filters, calendarioPeriodo]);

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
      CalendarCheck,
      CheckCircle,
      Clock,
      ClockCheck,
      AlertCircle,
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

      if (response.success && Array.isArray(response.data?.relogios) && response.data.relogios.length > 0) {
        setRelógios(response.data.relogios);
      } else if (!response.success) {
        toast.error(response.message || 'Erro ao carregar relógios');
      }
    } catch (error: any) {
      console.error('Erro ao carregar relógios:', error);
      toast.error(error.message || 'Erro ao carregar relógios');
    } finally {
      setIsLoadingRelógios(false);
    }
  };

  const carregarCalendario = async () => {
    try {
      setIsLoadingCalendario(true);
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/central-agendamento/get_calendario_agendamentos.php`,
        {
          method: 'POST',
          body: JSON.stringify({ periodo: calendarioPeriodo, filters }),
        },
        true
      );
      if (response.success) {
        setCalendarioDias(response.data?.diasData || []);
      } else {
        toast.error(response.message || 'Erro ao carregar calendário');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar calendário');
    } finally {
      setIsLoadingCalendario(false);
    }
  };

  const abrirCardDialog = async (relógio: Relógio) => {
    setCardDialogId(relógio.id);
    setCardDialogNome(relógio.nome);
    setSelectedCtes(new Set());
    setSelectedCnpjDest(null);
    setCtes([]);
    setCardDialogOpen(true);
    setIsLoadingCtes(true);

    try {
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/central-agendamento/get_ctes_card.php`,
        { method: 'POST', body: JSON.stringify({ cardId: relógio.id, filters }) },
        true
      );
      if (response.success) {
        const ctesData: Cte[] = response.data?.ctes || [];
        setCtes(ctesData);

        if (relógio.id === 1 && ctesData.length > 0) {
          setAgendEmail(ctesData[0].email_dest || '');
        }
      } else {
        toast.error(response.message || 'Erro ao carregar CT-es');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao carregar CT-es');
    } finally {
      setIsLoadingCtes(false);
    }
  };

  const selecionarCte = (cte: Cte) => {
    setSelectedCtes((prev) => new Set(prev).add(cte.nro_cte));
    setSelectedCnpjDest(cte.cnpj_dest);
    if (!selectedCnpjDest) {
      setAgendEmail(cte.email_dest || '');
      setAgendData(cte.data_prev_ent_iso || '');
    }
  };

  const handleToggleCte = (cte: Cte, checked: boolean) => {
    if (checked) {
      if (selectedCnpjDest && selectedCnpjDest !== cte.cnpj_dest) {
        toast.warning('Selecione apenas CT-es do mesmo destinatário');
        return;
      }
      if (!selectedCnpjDest) {
        const outrosCtesDest = ctes.filter((c) => c.cnpj_dest === cte.cnpj_dest && c.nro_cte !== cte.nro_cte);
        if (outrosCtesDest.length > 0) {
          setPendingCte(cte);
          setConfirmAllDialogOpen(true);
          return;
        }
      }
      selecionarCte(cte);
    } else {
      setSelectedCtes((prev) => {
        const next = new Set(prev);
        next.delete(cte.nro_cte);
        if (next.size === 0) {
          setSelectedCnpjDest(null);
          setAgendEmail('');
        }
        return next;
      });
    }
  };

  const handleConfirmAllDest = (marcarTodos: boolean) => {
    if (!pendingCte) return;
    setConfirmAllDialogOpen(false);
    if (marcarTodos) {
      const ctesDoDest = ctes.filter((c) => c.cnpj_dest === pendingCte.cnpj_dest);
      setSelectedCtes(new Set(ctesDoDest.map((c) => c.nro_cte)));
      setSelectedCnpjDest(pendingCte.cnpj_dest);
      setAgendEmail(pendingCte.email_dest || '');
      setAgendData(pendingCte.data_prev_ent_iso || '');
    } else {
      selecionarCte(pendingCte);
    }
    setPendingCte(null);
  };

  const abrirDialogAgendamento = () => {
    if (selectedCtes.size === 0) {
      toast.warning('Selecione ao menos um CT-e');
      return;
    }
    setAgendDialogOpen(true);
  };

  const handleSolicitarAgendamento = async () => {
    if (!agendEmail || !agendData) {
      toast.warning('Informe o e-mail e a data sugerida');
      return;
    }
    setIsSendingAgend(true);
    try {
      const ctesSelecionados = ctes.filter((c) => selectedCtes.has(c.nro_cte));
      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/central-agendamento/solicitar_agendamento.php`,
        {
          method: 'POST',
          body: JSON.stringify({
            email: agendEmail,
            dataSugerida: agendData,
            cnpjDest: selectedCnpjDest,
            ctes: ctesSelecionados,
          }),
        },
        true
      );
      if (response.success) {
        toast.success('Solicitação de agendamento enviada com sucesso!');
        setAgendDialogOpen(false);
        setSelectedCtes(new Set());
        setSelectedCnpjDest(null);
      } else {
        toast.error(response.message || 'Erro ao enviar solicitação');
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao enviar solicitação');
    } finally {
      setIsSendingAgend(false);
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

        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          <Calendar className="h-4 w-4 shrink-0" />
          Clique nos cards para visualizar os CT-es do grupo.
        </div>

        <div className="grid gap-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            {relógios.map((relógio) => {
              const Icone = getIcone(relógio.icone);
              const cfg = cardConfig[relógio.id] ?? cardConfig[1];
              const donutData = [
                { name: 'value', value: relógio.percentual },
                { name: 'empty', value: Math.max(0, 100 - relógio.percentual) },
              ];

              return (
                <Card
                  key={relógio.id}
                  className={`${cfg.bgColor} cursor-pointer transition-shadow hover:shadow-md`}
                  onClick={() => abrirCardDialog(relógio)}
                >
                  <CardHeader className="pb-2 h-[56px]">
                    <CardTitle className={`text-sm ${cfg.textColor} flex items-center gap-2`}>
                      {Icone && <Icone className="w-4 h-4 shrink-0" />}
                      {relógio.nome}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        {isLoadingRelógios ? (
                          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                        ) : (
                          <>
                            <div className={`text-2xl font-bold tabular-nums ${cfg.textColor}`}>
                              {relógio.percentual.toFixed(1)}%
                            </div>
                            <p className={`text-sm mt-1 ${cfg.textColor}`}>
                              {relógio.quantidade} CT-e{relógio.quantidade !== 1 ? 's' : ''}
                            </p>
                          </>
                        )}
                      </div>
                      <div style={{ width: 80, height: 80 }}>
                        <PieChart width={80} height={80}>
                          <Pie
                            data={donutData}
                            cx={40}
                            cy={40}
                            innerRadius={20}
                            outerRadius={35}
                            startAngle={90}
                            endAngle={-270}
                            dataKey="value"
                            stroke="none"
                          >
                            <Cell fill={relógio.cor} />
                            <Cell fill={theme === 'dark' ? cfg.emptyColorDark : cfg.emptyColor} />
                          </Pie>
                        </PieChart>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <CalendarioAgendamentos
            periodo={calendarioPeriodo}
            setPeriodo={setCalendarioPeriodo}
            diasData={calendarioDias}
            loading={isLoadingCalendario}
          />

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

        <Dialog open={cardDialogOpen} onOpenChange={(open) => { setCardDialogOpen(open); if (!open) { setSelectedCtes(new Set()); setSelectedCnpjDest(null); } }}>
          <DialogContent className="max-w-5xl h-[85vh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden">
            <DialogHeader className="shrink-0">
              <DialogTitle>{cardDialogNome}</DialogTitle>
              <DialogDescription>
                {cardDialogId === 1
                  ? 'Selecione CT-es do mesmo destinatário para solicitar agendamento.'
                  : 'Lista de CT-es neste grupo.'}
              </DialogDescription>
            </DialogHeader>

            <div className={`grid h-full min-h-0 gap-3 overflow-hidden ${cardDialogId === 1 ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]'}`}>
              {cardDialogId === 1 && (
                <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 dark:border-indigo-800 dark:bg-indigo-950">
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    Selecione CT-es de <strong>um único destinatário</strong> por vez para solicitar agendamento.
                    {selectedCtes.size > 0 && (
                      <span className="ml-2 font-semibold">{selectedCtes.size} selecionado{selectedCtes.size !== 1 ? 's' : ''}</span>
                    )}
                  </p>
                  <Button
                    size="sm"
                    className="shrink-0 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={selectedCtes.size === 0}
                    onClick={abrirDialogAgendamento}
                  >
                    <Mail className="h-4 w-4" />
                    Solicitar Agendamento
                  </Button>
                </div>
              )}

              <div className="rounded-lg border border-slate-200 dark:border-slate-800 grid grid-rows-[auto_minmax(0,1fr)] min-h-0 overflow-hidden">
                <div className={`grid gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 ${cardDialogId === 1 ? 'grid-cols-[32px_90px_minmax(0,1fr)_minmax(0,1fr)_120px_100px_100px_minmax(0,1fr)]' : 'grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)_120px_100px_100px_minmax(0,1fr)]'}`}>
                  {cardDialogId === 1 && <span></span>}
                  <span>CT-e</span>
                  <span>Pagador</span>
                  <span>Destinatário</span>
                  <span>CNPJ</span>
                  <span>Emissão</span>
                  <span>Prev. Entrega</span>
                  <span>Últ. Ocorrência</span>
                </div>

                <div className="min-h-0 overflow-y-auto">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {isLoadingCtes ? (
                      <div className="flex h-40 items-center justify-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Carregando CT-es...
                      </div>
                    ) : ctes.length === 0 ? (
                      <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-slate-500">
                        <CheckCircle className="h-6 w-6" />
                        Nenhum CT-e encontrado neste grupo.
                      </div>
                    ) : (
                      ctes.map((cte) => {
                        const isSelected = selectedCtes.has(cte.nro_cte);
                        const isDisabled = cardDialogId === 1 && !!selectedCnpjDest && selectedCnpjDest !== cte.cnpj_dest;
                        return (
                          <div
                            key={`${cte.ser_cte}-${cte.nro_cte}`}
                            className={`grid gap-2 px-4 py-2 text-sm ${cardDialogId === 1 ? 'grid-cols-[32px_90px_minmax(0,1fr)_minmax(0,1fr)_120px_100px_100px_minmax(0,1fr)]' : 'grid-cols-[90px_minmax(0,1fr)_minmax(0,1fr)_120px_100px_100px_minmax(0,1fr)]'} ${isDisabled ? 'opacity-40' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'} ${isSelected ? 'bg-indigo-50 dark:bg-indigo-950/40' : ''}`}
                          >
                            {cardDialogId === 1 && (
                              <div className="flex items-center">
                                <Checkbox
                                  checked={isSelected}
                                  disabled={isDisabled}
                                  onCheckedChange={(checked) => handleToggleCte(cte, !!checked)}
                                />
                              </div>
                            )}
                            <span className="font-mono text-xs self-center text-slate-700 dark:text-slate-300">{cte.ser_cte}{String(cte.nro_cte).padStart(6, '0')}</span>
                            <span className="truncate self-center text-slate-700 dark:text-slate-300">{cte.nome_pag || '-'}</span>
                            <span className="truncate self-center font-medium text-slate-900 dark:text-slate-100">{cte.nome_dest || '-'}</span>
                            <span className="self-center font-mono text-xs text-slate-500 dark:text-slate-400">{cte.cnpj_dest || '-'}</span>
                            <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_emissao}</span>
                            <span className="self-center text-slate-500 dark:text-slate-400">{cte.data_prev_ent}</span>
                            <span className="truncate self-center text-slate-500 dark:text-slate-400">{cte.ult_ocor || '-'}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={confirmAllDialogOpen} onOpenChange={setConfirmAllDialogOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Marcar todos os CT-es?</DialogTitle>
              <DialogDescription>
                Deseja marcar todos os CT-es deste destinatário?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <Button variant="outline" onClick={() => handleConfirmAllDest(false)} className="dark:border-slate-700">
                Não
              </Button>
              <Button onClick={() => handleConfirmAllDest(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                Sim
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={agendDialogOpen} onOpenChange={setAgendDialogOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>Solicitar Agendamento</DialogTitle>
              <DialogDescription>
                Informe a data sugerida e o e-mail do destinatário. O e-mail será salvo no cadastro do cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">Data Sugerida</Label>
                <Input
                  type="date"
                  value={agendData}
                  onChange={(e) => setAgendData(e.target.value)}
                  className="dark:bg-slate-800 dark:border-slate-700 dark:[color-scheme:dark]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-900 dark:text-slate-100">E-mail do Cliente</Label>
                <Input
                  type="email"
                  placeholder="email@cliente.com.br"
                  value={agendEmail}
                  onChange={(e) => setAgendEmail(e.target.value)}
                  className="dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {selectedCtes.size} CT-e{selectedCtes.size !== 1 ? 's' : ''} selecionado{selectedCtes.size !== 1 ? 's' : ''} para agendamento.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
              <Button variant="outline" onClick={() => setAgendDialogOpen(false)} className="dark:border-slate-700">
                Cancelar
              </Button>
              <Button
                onClick={handleSolicitarAgendamento}
                disabled={isSendingAgend || !agendEmail || !agendData}
                className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {isSendingAgend ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar Solicitação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </DashboardLayout>
  );
}
