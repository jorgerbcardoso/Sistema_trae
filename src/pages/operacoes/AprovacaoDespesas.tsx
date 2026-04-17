import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '@/components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  DollarSign, 
  FileText, 
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  Clock,
  CheckCheck,
  Building2,
  FileCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MessageSquare,
  Send,
  Trash2,
  Info,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { apiFetch } from '@/utils/apiUtils';
import { formatarValorBR, formatarDataBR } from '@/utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FilterSelectUnidadeSingle } from '@/components/cadastros/FilterSelectUnidadeSingle';
import { EventoSearchInput } from '@/components/shared/EventoSearchInput';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ✅ TIPO DA DESPESA
interface Despesa {
  seq_lancamento: number;
  lancamento?: string; // ✅ Apenas o número ou formato "130068-21"
  data: string;
  tipo_lancamento: string;
  evento: string;
  evento_descricao: string;
  veiculo?: string;
  motorista?: string;
  unidade: string;
  valor: number;
  nf?: string;
  fornecedor?: string;
  observacao?: string;
  historico?: string;
  usuario_lancamento: string;
  data_inclusao: string;
  data_vencimento: string;
  data_pagamento: string;
  competencia: string;
  boleto: string;
  orcamento: number;
  comprometido: number;
  saldo: number;
  valor_parcela: number;
  juros: number;
  desconto: number;
  valor_final: number;
  repasse: string;
  aprovada?: boolean;
  data_aprovacao_presto?: string;
  hora_aprovacao_presto?: string;
  login_aprovacao_presto?: string;
}

// ✅ FORMATAR NRO_LANCTO NO PADRÃO AAA000000
const formatarNroLancamento = (unidade: string, lancamento?: string): string => {
  if (!lancamento) return `${unidade}000000`;
  
  // Formato recebido: "130068-21" → Extrair parte numérica antes do hífen
  const partes = lancamento.split('-');
  const numero = partes[0].padStart(6, '0'); // Garantir 6 dígitos
  
  return `${unidade}${numero}`;
};

// ✅ FILTROS
interface Filtros {
  periodo_inicio: string;
  periodo_fim: string;
  status: 'TODAS' | 'APROVADAS' | 'NAO_APROVADAS';
  codigo_evento?: string;
  unidade: string;
}

// ✅ INDICADORES
interface Indicadores {
  total_despesas: number;
  valor_total: number;
  aprovadas: number;
  pendentes: number;
  valor_aprovado: number;
  valor_pendente: number;
}

// ✅ DADOS DO GRÁFICO DONUT
interface EventoTotal {
  codigo: string;
  nome: string;
  valor: number;
  quantidade: number;
  cor: string;
}

// ✅ CORES PARA O GRÁFICO
const CORES_EVENTOS = [
  '#10b981', // emerald-500
  '#3b82f6', // blue-500
  '#f59e0b', // amber-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#f97316', // orange-500
  '#6366f1', // indigo-500
];

// ✅ FUNÇÃO PARA FORMATAR MOEDA
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// ✅ DADOS MOCK PARA DESENVOLVIMENTO
const MOCK_DESPESAS_PENDENTES: Despesa[] = [
  {
    seq_lancamento: 1001,
    lancamento: '130068-21',
    data: '2026-02-26',
    tipo_lancamento: 'DESPESA',
    evento: '101',
    evento_descricao: 'COMBUSTÍVEL',
    veiculo: 'ABC-1234',
    motorista: 'JOÃO SILVA',
    unidade: 'MTZ',
    valor: 450.00,
    nf: '12345',
    fornecedor: 'POSTO SHELL',
    observacao: 'Abastecimento completo',
    usuario_lancamento: 'admin',
    data_inclusao: '2026-02-26',
    data_vencimento: '2026-03-26',
    data_pagamento: '2026-03-26',
    competencia: '02/2026',
    boleto: 'BOL123',
    orcamento: 1000,
    comprometido: 450,
    saldo: 550,
    valor_parcela: 450,
    juros: 0,
    desconto: 0,
    valor_final: 450,
    repasse: '',
    aprovada: false
  }
];

export default function AprovacaoDespesas() {
  const { user } = useAuth();
  const isMTZ = user?.unidade_atual === 'MTZ' || user?.unidade === 'MTZ';

  // ✅ PERÍODO PADRÃO: HOJE ATÉ HOJE
  const hoje = new Date();
  const dataHoje = hoje.toISOString().split('T')[0];

  const [filtros, setFiltros] = useState<Filtros>({
    periodo_inicio: dataHoje,
    periodo_fim: dataHoje,
    status: 'TODAS', // ✅ FILTRO PADRÃO: TODAS
    unidade: isMTZ ? '' : (user?.unidade_atual || user?.unidade || '') // ✅ MTZ = VAZIO, OUTRA = UNIDADE ATUAL
  });

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [despesasSelecionadas, setDespesasSelecionadas] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [indicadores, setIndicadores] = useState<Indicadores>({
    total_despesas: 0,
    valor_total: 0,
    aprovadas: 0,
    pendentes: 0,
    valor_aprovado: 0,
    valor_pendente: 0
  });
  const [eventosTotais, setEventosTotais] = useState<EventoTotal[]>([]);
  const [showFiltros, setShowFiltros] = useState(false); // ✅ OCULTO POR PADRÃO
  
  // ✅ PAGINAÇÃO
  const [paginaAtual, setPaginaAtual] = useState(1);
  const ITENS_POR_PAGINA = 50; // ✅ PADRÃO DO SISTEMA
  
  // ✅ ORDENAÇÃO
  const [ordenacao, setOrdenacao] = useState<'status' | 'data' | 'evento'>('status');

  // ✅ ESTADOS DOS DIALOGS
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    tipo: 'APROVACAO' | 'ESTORNO';
    seq?: number;
    nro?: string;
  }>({ open: false, tipo: 'APROVACAO' });

  const [obsDialog, setObsDialog] = useState<{
    open: boolean;
    seq?: number;
    nro?: string;
    texto: string;
    posReprovacao?: boolean;
  }>({ open: false, texto: '' });

  // ✅ CARREGAR DESPESAS
  useEffect(() => {
    carregarDespesas();
  }, []);

  const carregarDespesas = async () => {
    setLoading(true);
    try {
      // ✅ MODO PRODUÇÃO: Integração com API SSW
      const params = new URLSearchParams({
        periodo_inicio: filtros.periodo_inicio,
        periodo_fim: filtros.periodo_fim,
        status: filtros.status === 'TODAS' ? 'T' : filtros.status === 'APROVADAS' ? 'A' : 'N'
      });
      
      if (filtros.unidade) {
        params.append('unidade', filtros.unidade);
      }
      
      if (filtros.codigo_evento) {
        params.append('codigo_evento', filtros.codigo_evento);
      }
      
      const data = await apiFetch(`/sistema/api/operacoes/aprovacao-despesas.php?act=LISTAR&${params.toString()}`);
      
      const despesasRecebidas = (data.despesas || []);
      setDespesas(despesasRecebidas);
      
      // ✅ INICIALIZAR SELEÇÃO COM DESPESAS QUE JÁ VÊM MARCADAS (aprovada === true)
      const iniciais = new Set<number>();
      despesasRecebidas.forEach((d: Despesa) => {
        if (d.aprovada) {
          iniciais.add(d.seq_lancamento);
        }
      });
      setDespesasSelecionadas(iniciais);

      calcularIndicadores(despesasRecebidas);
      calcularEventosTotais(despesasRecebidas);
      
    } catch (error) {
      console.error('Erro ao carregar despesas:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar despesas');
    } finally {
      setLoading(false);
    }
  };

  // ✅ APLICAR FILTROS
  const aplicarFiltros = (todasDespesas: Despesa[]): Despesa[] => {
    return todasDespesas.filter(d => {
      // Filtro de status
      if (filtros.status === 'APROVADAS' && !d.aprovada) return false;
      if (filtros.status === 'NAO_APROVADAS' && d.aprovada) return false;

      // Filtro de unidade
      if (filtros.unidade && d.unidade !== filtros.unidade) return false;

      // Filtro de evento
      if (filtros.codigo_evento && d.evento !== filtros.codigo_evento) return false;

      // Filtro de período
      if (filtros.periodo_inicio && d.data < filtros.periodo_inicio) return false;
      if (filtros.periodo_fim && d.data > filtros.periodo_fim) return false;

      return true;
    });
  };

  // ✅ CALCULAR INDICADORES
  const calcularIndicadores = (despesasList: Despesa[]) => {
    const aprovadas = despesasList.filter(d => d.aprovada);
    const pendentes = despesasList.filter(d => !d.aprovada);

    setIndicadores({
      total_despesas: despesasList.length,
      valor_total: despesasList.reduce((sum, d) => sum + d.valor, 0),
      aprovadas: aprovadas.length,
      pendentes: pendentes.length,
      valor_aprovado: aprovadas.reduce((sum, d) => sum + d.valor, 0),
      valor_pendente: pendentes.reduce((sum, d) => sum + d.valor, 0)
    });
  };

  // ✅ CALCULAR TOTAIS POR EVENTO (COM CÓDIGO)
  const calcularEventosTotais = (despesasList: Despesa[]) => {
    const eventosMap = new Map<string, { codigo: string; nome: string; valor: number; quantidade: number }>();

    despesasList.forEach(d => {
      const key = d.evento;
      const atual = eventosMap.get(key) || { codigo: d.evento, nome: d.evento_descricao, valor: 0, quantidade: 0 };
      eventosMap.set(key, {
        codigo: d.evento,
        nome: d.evento_descricao,
        valor: atual.valor + d.valor,
        quantidade: atual.quantidade + 1
      });
    });

    const eventosArray: EventoTotal[] = Array.from(eventosMap.values()).map((dados, index) => ({
      codigo: dados.codigo,
      nome: dados.nome,
      valor: dados.valor,
      quantidade: dados.quantidade,
      cor: CORES_EVENTOS[index % CORES_EVENTOS.length]
    }));

    // Ordenar por valor decrescente
    eventosArray.sort((a, b) => b.valor - a.valor);

    setEventosTotais(eventosArray);
  };

  // ✅ SELECIONAR/DESSELECIONAR TODAS
  const toggleSelecionarTodas = () => {
    if (despesasSelecionadas.size === despesas.filter(d => !d.aprovada).length) {
      setDespesasSelecionadas(new Set());
    } else {
      const novasSelecoes = new Set(despesas.filter(d => !d.aprovada).map(d => d.seq_lancamento));
      setDespesasSelecionadas(novasSelecoes);
    }
  };

  // ✅ PAGINAÇÃO - CALCULAR DADOS
  const totalPaginas = Math.ceil(despesas.length / ITENS_POR_PAGINA);
  const indiceInicio = (paginaAtual - 1) * ITENS_POR_PAGINA + 1;
  const indiceFim = Math.min(paginaAtual * ITENS_POR_PAGINA, despesas.length);
  
  // ✅ RESETAR PARA PÁGINA 1 QUANDO CARREGAR DESPESAS OU MUDAR ORDENAÇÃO
  useEffect(() => {
    setPaginaAtual(1);
  }, [despesas.length, ordenacao]);
  
  // ✅ DADOS ORDENADOS
  const despesasOrdenadas = useMemo(() => {
    const despesasClone = [...despesas];
    
    switch (ordenacao) {
      case 'status':
        // Não aprovadas primeiro, depois aprovadas
        return despesasClone.sort((a, b) => {
          if (a.aprovada === b.aprovada) {
            // Se mesmo status, ordenar por data decrescente
            return new Date(b.data_pagamento).getTime() - new Date(a.data_pagamento).getTime();
          }
          return a.aprovada ? 1 : -1;
        });
        
      case 'data':
        // Data decrescente (mais recente primeiro)
        return despesasClone.sort((a, b) => {
          return new Date(b.data_pagamento).getTime() - new Date(a.data_pagamento).getTime();
        });
        
      case 'evento':
        // Ordenar por código de evento (crescente)
        return despesasClone.sort((a, b) => {
          return a.evento.localeCompare(b.evento);
        });
        
      default:
        return despesasClone;
    }
  }, [despesas, ordenacao]);
  
  // ✅ TOGGLE CARD CLICÁVEL (INDIVIDUAL)
  const handleCardClick = async (seqLancamento: number, aprovada: boolean) => {
    if (aprovada) return; // Não permite selecionar aprovadas na listagem (seria desaprovação individual)
    
    const novasSelecoes = new Set(despesasSelecionadas);
    const estaSelecionado = novasSelecoes.has(seqLancamento);
    
    // 1. Atualizar UI imediatamente para melhor UX
    if (estaSelecionado) {
      novasSelecoes.delete(seqLancamento);
    } else {
      novasSelecoes.add(seqLancamento);
    }
    setDespesasSelecionadas(novasSelecoes);

    // 2. Comunicar ao SSW via Backend
    try {
      await apiFetch('/sistema/api/operacoes/aprovacao-despesas.php?act=TOGGLE_INDIVIDUAL', {
        method: 'POST',
        body: JSON.stringify({
          seq_parcela: seqLancamento,
          selecionado: !estaSelecionado
        })
      });
    } catch (error) {
      console.error('Erro no toggle individual:', error);
      toast.error('Erro ao comunicar marcação ao SSW');
    }
  };

  // ✅ APROVAR SELECIONADAS (EM MASSA)
  const handleAprovarMassa = () => {
    if (despesasSelecionadas.size === 0) {
      toast.warning('Selecione ao menos uma despesa para aprovar');
      return;
    }
    setConfirmDialog({ open: true, tipo: 'APROVACAO' });
  };

  const aprovarSelecionadas = async () => {
    setLoading(true);
    try {
      await apiFetch('/sistema/api/operacoes/aprovacao-despesas.php?act=APROVAR', {
        method: 'POST',
        body: JSON.stringify({
          seq_parcelas: Array.from(despesasSelecionadas)
        })
      });
      
      toast.success('Aprovações realizadas com sucesso');
      await carregarDespesas();
      
    } catch (error) {
      console.error('Erro ao aprovar despesas:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao aprovar despesas');
    } finally {
      setLoading(false);
      setConfirmDialog({ ...confirmDialog, open: false });
    }
  };

  // ✅ REMOVER APROVAÇÃO (ESTORNO)
  const handleEstornoIndividual = (e: React.MouseEvent, seq: number, nro?: string) => {
    e.stopPropagation();
    // 1. Abrir dialog de observação primeiro (para capturar o motivo)
    setObsDialog({
      open: true,
      seq: seq,
      nro: nro,
      texto: '',
      posReprovacao: true
    });
  };

  const handleConfirmarReprovacaoComObs = () => {
    // 2. Após preencher a obs, abrir a confirmação final
    setConfirmDialog({ 
      open: true, 
      tipo: 'ESTORNO', 
      seq: obsDialog.seq, 
      nro: obsDialog.nro 
    });
  };

  const confirmarEstorno = async () => {
    if (!confirmDialog.seq) return;
    
    setLoading(true);
    try {
      await apiFetch('/sistema/api/operacoes/aprovacao-despesas.php?act=REMOVER_APROVACAO', {
        method: 'POST',
        body: JSON.stringify({
          seq_parcela: confirmDialog.seq,
          nro_lancamento: confirmDialog.nro,
          observacao: obsDialog.texto // ✅ Enviar observação/motivo junto com o estorno
        })
      });
      
      toast.success('Desaprovação realizada com sucesso');
      await carregarDespesas();
      
    } catch (error) {
      console.error('Erro ao remover aprovação:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao remover aprovação');
    } finally {
      setLoading(false);
      setConfirmDialog({ ...confirmDialog, open: false });
      setObsDialog({ ...obsDialog, open: false, texto: '' });
    }
  };

  // ✅ GERENCIAR OBSERVAÇÕES
  const handleAbrirObs = async (e: React.MouseEvent, despesa: Despesa) => {
    e.stopPropagation();
    
    setLoading(true);
    try {
      // ✅ 1. LER OBSERVAÇÃO DO SSW EM TEMPO REAL (act=COM)
      const data = await apiFetch(`/sistema/api/operacoes/aprovacao-despesas.php?act=LER_OBSERVACAO&seq_parcela=${despesa.seq_lancamento}&nro_lancamento=${despesa.lancamento}`);
      
      setObsDialog({
        open: true,
        seq: despesa.seq_lancamento,
        nro: despesa.lancamento,
        texto: data.observacao || '', // ✅ Usar valor que vem do SSW
        posReprovacao: false
      });
      
    } catch (error) {
      console.error('Erro ao ler observação:', error);
      toast.error('Erro ao buscar observação no SSW');
    } finally {
      setLoading(false);
    }
  };

  const salvarObservacao = async () => {
    if (!obsDialog.seq) return;

    setLoading(true);
    try {
      await apiFetch('/sistema/api/operacoes/aprovacao-despesas.php?act=SALVAR_OBSERVACAO', {
        method: 'POST',
        body: JSON.stringify({
          seq_parcela: obsDialog.seq,
          nro_lancamento: obsDialog.nro, 
          observacao: obsDialog.texto
        })
      });

      // Atualizar estado local para refletir a mudança visualmente
      setDespesas(prev => prev.map(d => 
        d.seq_lancamento === obsDialog.seq ? { ...d, observacao: obsDialog.texto } : d
      ));
      
      toast.success('Observação salva no SSW com sucesso');
      setObsDialog({ ...obsDialog, open: false });

    } catch (error) {
      console.error('Erro ao salvar observação:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar observação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout
      title="Aprovação de Despesas"
      description="Gerencie e aprove despesas pendentes"
    >
      {/* ✅ BOTÃO TOGGLE FILTROS */}
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFiltros(!showFiltros)}
        >
          <Filter className="h-4 w-4 mr-2" />
          {showFiltros ? 'Ocultar Filtros' : 'Mostrar Filtros'}
        </Button>
      </div>

      {/* ✅ FILTROS */}
      <AnimatePresence>
        {showFiltros && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Filtros</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2 min-w-0">
                    <Label>Período Início *</Label>
                    <Input
                      type="date"
                      required
                      value={filtros.periodo_inicio}
                      onChange={(e) => setFiltros({ ...filtros, periodo_inicio: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 min-w-0">
                    <Label>Período Fim *</Label>
                    <Input
                      type="date"
                      required
                      value={filtros.periodo_fim}
                      onChange={(e) => setFiltros({ ...filtros, periodo_fim: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2 min-w-0">
                    <Label>Status</Label>
                    <Select
                      value={filtros.status}
                      onValueChange={(value: 'TODAS' | 'APROVADAS' | 'NAO_APROVADAS') =>
                        setFiltros({ ...filtros, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TODAS">Todas</SelectItem>
                        <SelectItem value="APROVADAS">Aprovadas</SelectItem>
                        <SelectItem value="NAO_APROVADAS">Não Aprovadas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 min-w-0">
                    <FilterSelectUnidadeSingle
                      value={filtros.unidade || ''}
                      onChange={(value) => setFiltros({ ...filtros, unidade: value })}
                      disabled={!isMTZ}
                      label="Unidade"
                    />
                  </div>

                  <div className="space-y-2 min-w-0">
                    <EventoSearchInput
                      value={filtros.codigo_evento || ''}
                      onChange={(codigo) => setFiltros({ ...filtros, codigo_evento: codigo })}
                      label="Evento"
                      placeholder="Buscar evento..."
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <Button onClick={carregarDespesas} disabled={loading}>
                    {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Buscar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFiltros({
                        periodo_inicio: dataHoje,
                        periodo_fim: dataHoje,
                        status: 'TODAS',
                        unidade: isMTZ ? '' : (user?.unidade_atual || user?.unidade || '')
                      });
                    }}
                  >
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ INDICADORES - PADRÃO BI COMPRAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Total de Despesas */}
        <Card className="overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/20 dark:to-blue-900/10"></div>
          <CardContent className="pt-6 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-2">
                  Total de Despesas
                </p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mb-1">
                  {indicadores.total_despesas}
                </p>
                <p className="text-sm text-blue-700/70 dark:text-blue-400/70">
                  {formatCurrency(indicadores.valor_total)}
                </p>
              </div>
              <div className="bg-blue-500/10 p-3 rounded-lg">
                <FileText className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Aprovadas */}
        <Card className="overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/20 dark:to-green-900/10"></div>
          <CardContent className="pt-6 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-green-700 dark:text-green-400 uppercase tracking-wider mb-2">
                  Aprovadas
                </p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100 mb-1">
                  {indicadores.aprovadas}
                </p>
                <p className="text-sm text-green-700/70 dark:text-green-400/70">
                  {formatCurrency(indicadores.valor_aprovado)}
                </p>
              </div>
              <div className="bg-green-500/10 p-3 rounded-lg">
                <CheckCircle2 className="size-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pendentes */}
        <Card className="overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/20 dark:to-amber-900/10"></div>
          <CardContent className="pt-6 relative">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                  Pendentes
                </p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100 mb-1">
                  {indicadores.pendentes}
                </p>
                <p className="text-sm text-amber-700/70 dark:text-amber-400/70">
                  {formatCurrency(indicadores.valor_pendente)}
                </p>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-lg">
                <Clock className="size-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ✅ GRÁFICO DONUT - SEM BORDA BRANCA */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Despesas por Evento</CardTitle>
          <CardDescription>Distribuição de valores por tipo de despesa</CardDescription>
        </CardHeader>
        <CardContent>
          {eventosTotais.length > 0 ? (
            <div className="flex flex-col lg:flex-row items-center gap-6">
              <div className="w-full lg:w-1/2 h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={eventosTotais}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={0}
                      dataKey="valor"
                      stroke="none"
                    >
                      {eventosTotais.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700">
                              <p className="font-semibold text-sm">{data.codigo} - {data.nome}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatCurrency(data.valor)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {data.quantidade} despesa{data.quantidade !== 1 ? 's' : ''}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full lg:w-1/2 space-y-2">
                {eventosTotais.slice(0, 8).map((evento, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: evento.cor }}
                      />
                      <span className="text-sm font-medium truncate">
                        {evento.codigo} - {evento.nome}
                      </span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-sm font-semibold">
                        {formatCurrency(evento.valor)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {evento.quantidade} desp.
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              Nenhum dado disponível
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ LISTA DE DESPESAS (CARDS CLICÁVEIS - MOBILE FIRST) */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex-1">
              <CardTitle>Despesas</CardTitle>
              <CardDescription>
                {despesas.length} despesa{despesas.length !== 1 ? 's' : ''} encontrada{despesas.length !== 1 ? 's' : ''}
              </CardDescription>
            </div>
            
            <div className="flex flex-col md:flex-row items-center gap-4">
              {/* ✅ SELECT DE ORDENAÇÃO */}
              {despesas.length > 0 && (
                <div className="w-full md:w-48">
                  <Select
                    value={ordenacao}
                    onValueChange={(value: 'status' | 'data' | 'evento') => setOrdenacao(value)}
                  >
                    <SelectTrigger className="h-9 bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Ordenar por..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status">Status (Pendentes primeiro)</SelectItem>
                      <SelectItem value="data">Data (Mais recentes)</SelectItem>
                      <SelectItem value="evento">Evento (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button 
                onClick={handleAprovarMassa} 
                disabled={loading || despesasSelecionadas.size === 0}
                className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Aprovar Selecionadas ({despesasSelecionadas.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 bg-slate-50/30 dark:bg-slate-900/10">
          {/* ✅ ORIENTAÇÃO AO USUÁRIO */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-xl">
            <p className="text-sm text-blue-900 dark:text-blue-100 flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold">💡</span>
              <span>
                <strong>Dica:</strong> Clique nos cards das despesas pendentes para selecioná-las. Use o ícone de balão para ver/editar observações no SSW.
              </span>
            </p>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
              <p className="text-muted-foreground animate-pulse">Carregando despesas...</p>
            </div>
          ) : despesas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-xl">
              <FileText className="h-16 w-12 mb-4 opacity-20" />
              <p className="font-medium text-lg">Nenhuma despesa encontrada</p>
              <p className="text-sm">Ajuste os filtros de busca acima</p>
            </div>
          ) : (
            <div className="space-y-4">
              {despesasOrdenadas
                .slice((paginaAtual - 1) * ITENS_POR_PAGINA, paginaAtual * ITENS_POR_PAGINA)
                .map((despesa, index) => (
                <motion.div
                  key={despesa.seq_lancamento}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (index % 10) * 0.03 }}
                >
                  <Card 
                    className={`
                      relative group border-l-4 transition-all overflow-hidden
                      ${despesa.aprovada 
                        ? 'border-l-green-500 bg-white/80 dark:bg-slate-900/80 opacity-80' 
                        : 'border-l-amber-500 bg-white dark:bg-slate-900 cursor-pointer hover:shadow-lg hover:-translate-y-0.5'}
                      ${despesasSelecionadas.has(despesa.seq_lancamento) && !despesa.aprovada ? 'ring-2 ring-blue-500 border-l-blue-600 bg-blue-50/30 dark:bg-blue-900/10' : ''}
                    `}
                    onClick={() => handleCardClick(despesa.seq_lancamento, despesa.aprovada || false)}
                  >
                    <CardContent className="p-4 md:p-5">
                      <div className="flex flex-col md:flex-row gap-4 md:items-start justify-between">
                        {/* COLUNA ESQUERDA: IDENTIFICAÇÃO */}
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-2xl font-mono font-bold tracking-tight text-slate-900 dark:text-slate-100">
                              {formatarNroLancamento(despesa.unidade, despesa.lancamento)}
                            </span>
                            {despesa.aprovada ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> 
                                APROVADA
                                {despesa.login_aprovacao_presto && despesa.data_aprovacao_presto && (
                                  <span className="ml-1 opacity-80 text-[10px]">
                                    ({despesa.login_aprovacao_presto} {formatarDataBR(despesa.data_aprovacao_presto).substring(0, 8)} {despesa.hora_aprovacao_presto?.substring(0, 5)})
                                  </span>
                                )}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200">
                                <Clock className="h-3 w-3 mr-1" /> PENDENTE
                              </Badge>
                            )}
                            <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-600 dark:text-slate-400">
                              UNID: {despesa.unidade}
                            </span>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                              {despesa.evento} - {despesa.evento_descricao}
                            </p>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                              Fornecedor: <span className="text-slate-900 dark:text-slate-200">{despesa.fornecedor || 'NÃO INFORMADO'}</span>
                            </p>
                          </div>

                          {despesa.historico && (
                            <div className="p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800">
                              <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-400 italic">
                                "{despesa.historico}"
                              </p>
                            </div>
                          )}
                        </div>

                        {/* COLUNA CENTRAL: DATAS E INFO */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 py-3 md:py-0 border-y md:border-y-0 md:border-x border-slate-100 dark:border-slate-800 md:px-6">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Vencimento</p>
                            <p className="text-xs font-semibold">{formatarDataBR(despesa.data_vencimento)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Pagamento</p>
                            <p className="text-xs font-semibold">{formatarDataBR(despesa.data_pagamento)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Inclusão</p>
                            <p className="text-xs font-semibold">{formatarDataBR(despesa.data_inclusao)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Usuário</p>
                            <p className="text-xs font-semibold">{despesa.usuario_lancamento}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Competência</p>
                            <p className="text-xs font-semibold">{despesa.competencia}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold">NF/Boleto</p>
                            <p className="text-xs font-semibold truncate max-w-[80px]" title={despesa.boleto || despesa.nf}>
                              {despesa.boleto || despesa.nf || '-'}
                            </p>
                          </div>
                        </div>

                        {/* COLUNA DIREITA: VALORES E BI */}
                        <div className="md:text-right space-y-3 min-w-[180px]">
                          <div>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Valor Total</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">
                              {formatarValorBR(despesa.valor_final)}
                            </p>
                          </div>

                          <div className="p-2.5 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg space-y-1">
                            <p className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-bold text-center border-b border-blue-100 dark:border-blue-800 pb-1 mb-1">BI Orçamentário</p>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">Orçado:</span>
                              <span className="font-bold">{formatarValorBR(despesa.orcamento)}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">Saldo:</span>
                              <span className={`font-bold ${despesa.saldo < 0 ? 'text-red-500' : 'text-green-600'}`}>{formatarValorBR(despesa.saldo)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* RODAPÉ DO CARD: AÇÕES */}
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 px-3 rounded-full text-xs font-medium transition-colors ${
                              despesa.observacao ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400' : 'text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                            onClick={(e) => handleAbrirObs(e, despesa)}
                          >
                            <MessageSquare className={`h-3.5 w-3.5 mr-1.5 ${despesa.observacao ? 'fill-blue-500' : ''}`} />
                            {despesa.observacao ? 'Ver Observação' : 'Adicionar Obs'}
                          </Button>
                          
                          {despesa.veiculo && (
                            <span className="text-[10px] font-bold text-slate-500 uppercase px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded">
                              🚛 {despesa.veiculo}
                            </span>
                          )}
                        </div>

                        {despesa.aprovada && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full text-xs font-bold"
                            onClick={(e) => handleEstornoIndividual(e, despesa.seq_lancamento, despesa.lancamento)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Estornar Aprovação
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {/* PAGINAÇÃO */}
          {despesas.length > 0 && (
            <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-4 border-t pt-6">
              <div className="text-sm text-muted-foreground font-medium">
                Mostrando <span className="text-slate-900 dark:text-slate-100">{indiceInicio}</span> a <span className="text-slate-900 dark:text-slate-100">{indiceFim}</span> de <span className="text-slate-900 dark:text-slate-100">{despesas.length}</span> despesas
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaAtual(1)}
                  disabled={paginaAtual === 1}
                  className="h-9 w-9 p-0"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaAtual(prev => Math.max(1, prev - 1))}
                  disabled={paginaAtual === 1}
                  className="h-9 w-9 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="flex items-center bg-white dark:bg-slate-900 border rounded-md px-3 h-9">
                  <span className="text-sm font-bold">Página {paginaAtual} de {totalPaginas}</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaAtual(prev => Math.min(totalPaginas, prev + 1))}
                  disabled={paginaAtual === totalPaginas}
                  className="h-9 w-9 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPaginaAtual(totalPaginas)}
                  disabled={paginaAtual === totalPaginas}
                  className="h-9 w-9 p-0"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ✅ DIALOG DE CONFIRMAÇÃO (APROVAÇÃO/ESTORNO) */}
      <Dialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              {confirmDialog.tipo === 'APROVACAO' ? (
                <>
                  <CheckCircle2 className="size-6 text-green-600" />
                  Confirmar Aprovação
                </>
              ) : (
                <>
                  <AlertCircle className="size-6 text-amber-600" />
                  Confirmar Desaprovação
                </>
              )}
            </DialogTitle>
            <DialogDescription className="pt-2 text-base">
              {confirmDialog.tipo === 'APROVACAO' ? (
                `Deseja realmente aprovar as ${despesasSelecionadas.size} despesas selecionadas? Esta ação enviará os dados ao SSW.`
              ) : (
                <>
                  Deseja remover a aprovação da despesa <span className="font-mono font-bold">{confirmDialog.nro?.split('-')[0]}</span> no SSW?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmDialog({ ...confirmDialog, open: false })}>
              Cancelar
            </Button>
            <Button 
              className={confirmDialog.tipo === 'APROVACAO' ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'}
              onClick={confirmDialog.tipo === 'APROVACAO' ? aprovarSelecionadas : confirmarEstorno}
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ DIALOG DE OBSERVAÇÕES */}
      <Dialog open={obsDialog.open} onOpenChange={(open) => setObsDialog({ ...obsDialog, open })}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="size-5 text-blue-600" />
              {obsDialog.posReprovacao ? 'Informar Motivo da Reprovação' : 'Observações da Despesa'}
            </DialogTitle>
            <DialogDescription className="text-left">
              Lançamento: <span className="font-mono font-bold">{obsDialog.nro?.split('-')[0]}</span>
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="obs-text" className="mb-2 block">
              {obsDialog.posReprovacao ? 'Por que esta despesa está sendo reprovada?' : 'Texto da observação:'}
            </Label>
            <Textarea
              id="obs-text"
              placeholder="Digite aqui..."
              className="min-h-[150px] resize-none"
              value={obsDialog.texto}
              onChange={(e) => setObsDialog({ ...obsDialog, texto: e.target.value })}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setObsDialog({ ...obsDialog, open: false })}>
              {obsDialog.posReprovacao ? 'Cancelar' : 'Fechar'}
            </Button>
            <Button className="gap-2" onClick={obsDialog.posReprovacao ? handleConfirmarReprovacaoComObs : salvarObservacao}>
              <Send className="size-4" />
              {obsDialog.posReprovacao ? 'Próximo' : 'Salvar Observação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
