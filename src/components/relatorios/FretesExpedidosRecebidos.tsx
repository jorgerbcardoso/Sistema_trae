import React, { useMemo, useRef, useState } from 'react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Inbox, Loader2, Send, Search, Truck, TrendingUp, Wallet, X } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Pie, PieChart, Cell, Legend, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

type TpCliente = '' | 'R' | 'D' | 'P';

type Filters = {
  sigla_unid: string;
  cgc_cliente: string;
  tp_cliente: TpCliente;
  periodo_emissao_ini: string;
  periodo_emissao_fim: string;
  periodo_entrega_ini: string;
  periodo_entrega_fim: string;
};

type RowAgg = {
  sigla: string;
  unidade: string;
  uf: string;
  quant_vol: number;
  quant_ctrc: number;
  peso_ton: number;
  val_merc: number;
  frete_cif: number;
  frete_fob: number;
  frete_ter: number;
  frete_sub: number;
  frete_tot: number;
};

type ApiData = {
  totals: {
    quant_vol: number;
    quant_ctrc: number;
    peso_ton: number;
    val_merc: number;
    frete_tot: number;
    frete_cif: number;
    frete_fob: number;
    frete_ter: number;
    frete_sub: number;
  };
  rows: RowAgg[];
};

type ApiResponse = {
  success: boolean;
  message?: string;
  expedidos: ApiData | null;
  recebidos: ApiData | null;
  meta?: any;
};

type StartResponse = {
  success: boolean;
  message?: string;
  status?: 'started';
  baseline_seq?: number;
  request_start_ts?: number;
};

type PollResponse = {
  success: boolean;
  message?: string;
  status?: 'pending' | 'ready';
  result?: 'empty' | 'links';
  ssw_seq?: number;
  acts?: string[];
};

type DownloadResponse = {
  success: boolean;
  message?: string;
  kind?: 'expedidos' | 'recebidos';
  filename?: string;
  data?: ApiData;
  meta?: {
    timing_ms?: Record<string, number>;
    size_bytes?: Record<string, number>;
  };
};

function getMesCorrentePeriod(): { ini: string; fim: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return { ini: fmt(start), fim: fmt(now) };
}

function diffDaysInclusive(ini: string, fim: string): number {
  const a = new Date(ini);
  const b = new Date(fim);
  const ms = b.getTime() - a.getTime();
  if (Number.isNaN(ms)) return 0;
  return Math.floor(ms / 86400000) + 1;
}

function formatCurrency(v: number): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNumber(v: number, digits = 0): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function csvEscape(v: any): string {
  const s = String(v ?? '');
  if (s.includes('"') || s.includes(';') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsv(kind: 'Expedidos' | 'Recebidos', data: ApiData, unidadeLabel: string): string {
  const header = [
    'Tipo',
    'Sigla',
    unidadeLabel,
    'UF',
    'CT-es',
    'Vol',
    'Peso (Ton)',
    'Valor Mercadoria',
    'Frete CIF',
    'Frete FOB',
    'Frete TER',
    'Frete SUB',
    'Frete Total',
  ];

  const lines: string[] = [];
  lines.push(header.map(csvEscape).join(';'));

  for (const r of data.rows || []) {
    lines.push(
      [
        kind,
        r.sigla,
        r.unidade,
        r.uf,
        formatNumber(r.quant_ctrc),
        formatNumber(r.quant_vol),
        formatNumber(r.peso_ton, 3),
        formatCurrency(r.val_merc),
        formatCurrency(r.frete_cif),
        formatCurrency(r.frete_fob),
        formatCurrency(r.frete_ter),
        formatCurrency(r.frete_sub),
        formatCurrency(r.frete_tot),
      ]
        .map(csvEscape)
        .join(';')
    );
  }

  lines.push(
    [
      kind,
      'TOTAL',
      '',
      '',
      formatNumber(data.totals.quant_ctrc),
      formatNumber(data.totals.quant_vol),
      formatNumber(data.totals.peso_ton, 3),
      formatCurrency(data.totals.val_merc),
      formatCurrency(data.totals.frete_cif),
      formatCurrency(data.totals.frete_fob),
      formatCurrency(data.totals.frete_ter),
      formatCurrency(data.totals.frete_sub),
      formatCurrency(data.totals.frete_tot),
    ]
      .map(csvEscape)
      .join(';')
  );

  return lines.join('\n');
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

type ClienteOption = { cnpj: string; nome: string; cidade?: string };

function ClienteSearchSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (cnpj: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<ClienteOption[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = useMemo(() => {
    if (!value) return null;
    const found = options.find((o) => o.cnpj === value);
    return found || { cnpj: value, nome: value };
  }, [options, value]);

  const searchClientes = async (term: string) => {
    setLoading(true);
    try {
      const res = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/search_clientes.php`, {
        method: 'POST',
        body: JSON.stringify({ search: term }),
      });
      if (res?.success) {
        setOptions(res.clientes || []);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-start text-left relative">
          <span className={`truncate ${value ? 'pr-20' : 'pr-10'}`}>
            {selected?.nome || 'Todos os clientes'}
          </span>
          {value && (
            <span
              role="button"
              tabIndex={0}
              className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hover:bg-accent rounded p-0.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange('');
                }
              }}
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </span>
          )}
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[520px] p-0" align="start">
        <div className="flex flex-col">
          <div className="flex items-center border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
            <Input
              placeholder="Digite 2+ caracteres para buscar..."
              value={searchValue}
              onChange={(e) => {
                const v = e.target.value;
                setSearchValue(v);
                if (v.trim().length >= 2) searchClientes(v.trim());
                else setOptions([]);
              }}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8"
            />
          </div>
          <div className="max-h-[420px] overflow-y-auto overscroll-contain p-1" onWheel={(e) => e.stopPropagation()}>
            {searchValue.trim().length < 2 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Digite pelo menos 2 caracteres para buscar...</div>
            ) : loading ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Buscando...</div>
            ) : options.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Nenhum cliente encontrado.</div>
            ) : (
              options.map((cliente) => (
                <div
                  key={cliente.cnpj}
                  onClick={() => {
                    onChange(cliente.cnpj);
                    setOpen(false);
                    setSearchValue('');
                  }}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-accent border-b last:border-0"
                >
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">{cliente.nome}</span>
                      <span className="text-xs text-muted-foreground font-mono">{cliente.cnpj}</span>
                    </div>
                    {cliente.cidade && <div className="text-xs text-muted-foreground">{cliente.cidade}</div>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function buildDonut(rows: RowAgg[]) {
  const top = rows.slice(0, 5);
  const rest = rows.slice(5);
  const demais = rest.reduce((acc, r) => acc + (Number(r.frete_tot) || 0), 0);
  const data = top.map((r) => ({ name: r.sigla, value: Number(r.frete_tot) || 0 }));
  if (demais > 0) data.push({ name: 'Demais', value: demais });
  return data.filter((d) => d.value > 0);
}

const DONUT_COLORS = ['#2563eb', '#16a34a', '#f97316', '#a855f7', '#06b6d4', '#ef4444', '#84cc16', '#64748b', '#0f172a'];

export function FretesExpedidosRecebidos() {
  const defaultPeriod = useMemo(() => getMesCorrentePeriod(), []);
  const [filters, setFilters] = useState<Filters>({
    sigla_unid: '',
    cgc_cliente: '',
    tp_cliente: 'P',
    periodo_emissao_ini: defaultPeriod.ini,
    periodo_emissao_fim: defaultPeriod.fim,
    periodo_entrega_ini: '',
    periodo_entrega_fim: '',
  });

  const [hasGenerated, setHasGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [tab, setTab] = useState<'expedidos' | 'recebidos'>('expedidos');
  const [dataExp, setDataExp] = useState<ApiData | null>(null);
  const [dataRec, setDataRec] = useState<ApiData | null>(null);
  const runRef = useRef(0);

  const [sortExp, setSortExp] = useState<{ key: keyof RowAgg; dir: 'asc' | 'desc' }>({ key: 'frete_tot', dir: 'desc' });
  const [sortRec, setSortRec] = useState<{ key: keyof RowAgg; dir: 'asc' | 'desc' }>({ key: 'frete_tot', dir: 'desc' });

  const rowsExpSorted = useMemo(() => {
    const rows = [...(dataExp?.rows || [])];
    const { key, dir } = sortExp;
    rows.sort((a, b) => {
      const av: any = (a as any)[key];
      const bv: any = (b as any)[key];
      let cmp = 0;
      if (typeof av === 'string' || typeof bv === 'string') cmp = String(av || '').localeCompare(String(bv || ''), 'pt-BR');
      else cmp = (Number(av) || 0) - (Number(bv) || 0);
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [dataExp, sortExp]);

  const rowsRecSorted = useMemo(() => {
    const rows = [...(dataRec?.rows || [])];
    const { key, dir } = sortRec;
    rows.sort((a, b) => {
      const av: any = (a as any)[key];
      const bv: any = (b as any)[key];
      let cmp = 0;
      if (typeof av === 'string' || typeof bv === 'string') cmp = String(av || '').localeCompare(String(bv || ''), 'pt-BR');
      else cmp = (Number(av) || 0) - (Number(bv) || 0);
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [dataRec, sortRec]);

  const toggleSort = (kind: 'expedidos' | 'recebidos', key: keyof RowAgg) => {
    if (kind === 'expedidos') {
      setSortExp((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
    } else {
      setSortRec((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));
    }
  };

  const sortIcon = (kind: 'expedidos' | 'recebidos', key: keyof RowAgg) => {
    const s = kind === 'expedidos' ? sortExp : sortRec;
    if (s.key !== key) return null;
    return <span className="ml-1 text-[10px] opacity-70">{s.dir === 'asc' ? '▲' : '▼'}</span>;
  };

  const validar = (f: Filters): string | null => {
    const hasEmissao = Boolean(f.periodo_emissao_ini || f.periodo_emissao_fim);
    const hasEntrega = Boolean(f.periodo_entrega_ini || f.periodo_entrega_fim);

    if (!hasEmissao && !hasEntrega) {
      return 'Informe pelo menos 1 período (emissão ou entrega).';
    }

    if (hasEmissao) {
      if (!f.periodo_emissao_ini || !f.periodo_emissao_fim) return 'Para filtrar por emissão, informe início e fim.';
      if (new Date(f.periodo_emissao_ini) > new Date(f.periodo_emissao_fim)) return 'Período de emissão inválido (início maior que fim).';
      if (diffDaysInclusive(f.periodo_emissao_ini, f.periodo_emissao_fim) > 31) return 'Período de emissão não pode ser maior que 31 dias.';
    }

    if (hasEntrega) {
      if (!f.periodo_entrega_ini || !f.periodo_entrega_fim) return 'Para filtrar por entrega, informe início e fim.';
      if (new Date(f.periodo_entrega_ini) > new Date(f.periodo_entrega_fim)) return 'Período de entrega inválido (início maior que fim).';
      if (diffDaysInclusive(f.periodo_entrega_ini, f.periodo_entrega_fim) > 31) return 'Período de entrega não pode ser maior que 31 dias.';
    }

    return null;
  };

  const gerar = async (f: Filters) => {
    const err = validar(f);
    if (err) {
      toast.error(err);
      return;
    }

    runRef.current += 1;
    const runId = runRef.current;

    setHasGenerated(true);
    setLoading(true);
    setStatus('Comandando relatório...');
    setDataExp(null);
    setDataRec(null);
    try {
      const start = (await apiFetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/fretes_expedidos_recebidos.php`, {
        method: 'POST',
        body: JSON.stringify({
          step: 'START',
          sigla_unid: f.sigla_unid || '',
          cgc_cliente: f.cgc_cliente || '',
          tp_cliente: f.tp_cliente || '',
          periodo_emissao_ini: f.periodo_emissao_ini,
          periodo_emissao_fim: f.periodo_emissao_fim,
          periodo_entrega_ini: f.periodo_entrega_ini || '',
          periodo_entrega_fim: f.periodo_entrega_fim || '',
        }),
      })) as StartResponse;

      if (runRef.current !== runId) return;
      if (!start?.success || start.status !== 'started' || !start.baseline_seq || !start.request_start_ts) {
        setStatus('');
        toast.error(start?.message || 'Não foi possível iniciar a geração no SSW.');
        return;
      }

      let acts: string[] = [];
      let empty = false;

      for (let i = 0; i < 25; i++) {
        if (runRef.current !== runId) return;

        const poll = (await apiFetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/fretes_expedidos_recebidos.php`, {
          method: 'POST',
          body: JSON.stringify({
            step: 'POLL',
            baseline_seq: start.baseline_seq,
            request_start_ts: start.request_start_ts,
          }),
        })) as PollResponse;

        if (runRef.current !== runId) return;

        if (!poll?.success) {
          setStatus('');
          toast.error(poll?.message || 'Falha ao consultar status no SSW (1440).');
          return;
        }

        if (poll.status === 'ready') {
          if (poll.result === 'empty') {
            empty = true;
            break;
          }
          acts = poll.acts || [];
          break;
        }

        await new Promise((r) => setTimeout(r, 1000));
      }

      if (runRef.current !== runId) return;

      if (empty) {
        setStatus('');
        toast.info('Nenhum registro encontrado para os parâmetros informados.');
        return;
      }

      if (!acts.length) {
        setStatus('');
        toast.error('O relatório foi concluído, mas não foi possível localizar os links de download.');
        return;
      }

      const rankAct = (a: string) => {
        const s = String(a || '').toUpperCase();
        if (s.includes('_E.SSWWEB')) return 1;
        if (s.includes('_R.SSWWEB')) return 2;
        return 9;
      };
      acts = [...acts].sort((a, b) => rankAct(a) - rankAct(b));

      setStatus('Relatório encontrado... Iniciando leitura');

      let exp: ApiData | null = null;
      let rec: ApiData | null = null;

      for (const act of acts) {
        if (runRef.current !== runId) return;

        if (String(act).toUpperCase().includes('_E.SSWWEB')) setStatus('Relatório encontrado... Iniciando leitura');
        if (String(act).toUpperCase().includes('_R.SSWWEB')) setStatus('Relatório encontrado... Iniciando leitura');

        const dl = (await apiFetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/fretes_expedidos_recebidos.php`, {
          method: 'POST',
          body: JSON.stringify({
            step: 'DOWNLOAD',
            act,
          }),
        })) as DownloadResponse;

        if (runRef.current !== runId) return;

        if (!dl?.success || !dl.data || !dl.kind) {
          toast.error(dl?.message || 'Falha ao baixar/processar arquivo do SSW.');
          continue;
        }

        if (dl.kind === 'expedidos') exp = dl.data;
        if (dl.kind === 'recebidos') rec = dl.data;
      }

      setDataExp(exp);
      setDataRec(rec);
      setStatus('Concluído');

      if (!exp && !rec) {
        toast.info('Nenhum dado disponível após o download.');
      } else if (!exp) {
        setTab('recebidos');
        toast.info('O SSW retornou apenas Recebidos para os parâmetros informados.');
      } else if (!rec) {
        setTab('expedidos');
        toast.info('O SSW retornou apenas Expedidos para os parâmetros informados.');
      }
    } finally {
      if (runRef.current === runId) setLoading(false);
    }
  };

  const donutExp = useMemo(() => (dataExp ? buildDonut(dataExp.rows) : []), [dataExp]);
  const donutRec = useMemo(() => (dataRec ? buildDonut(dataRec.rows) : []), [dataRec]);

  return (
    <AdminLayout
      title="FRETES EXPEDIDOS E RECEBIDOS"
      description="Consulta SSW 0057 (expedidos e recebidos)"
    >
      <div className="flex flex-col gap-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base">Filtros</CardTitle>
                <div className="text-sm text-muted-foreground">
                  Informe pelo menos 1 período (emissão ou entrega). Nenhum período pode exceder 31 dias.
                </div>
              </div>
              <Button
                onClick={() => {
                  gerar(filters);
                }}
                disabled={loading}
                className="gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Gerar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label>Unidade (opcional)</Label>
                <FilterSelectUnidadeSingle
                  value={filters.sigla_unid}
                  onChange={(v) => setFilters({ ...filters, sigla_unid: v || '' })}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente (CNPJ/CPF) (opcional)</Label>
                <ClienteSearchSelect
                  value={filters.cgc_cliente}
                  onChange={(cnpj) => setFilters({ ...filters, cgc_cliente: cnpj || '' })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de cliente</Label>
                <Select
                  value={filters.tp_cliente}
                  onValueChange={(v) => setFilters({ ...filters, tp_cliente: (v as TpCliente) || '' })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="P">Pagador (P)</SelectItem>
                    <SelectItem value="R">Remetente (R)</SelectItem>
                    <SelectItem value="D">Destinatário (D)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período de emissão (início)</Label>
                <Input
                  type="date"
                  value={filters.periodo_emissao_ini}
                  onChange={(e) => setFilters({ ...filters, periodo_emissao_ini: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Período de emissão (fim)</Label>
                <Input
                  type="date"
                  value={filters.periodo_emissao_fim}
                  onChange={(e) => setFilters({ ...filters, periodo_emissao_fim: e.target.value })}
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Período de entrega (início)</Label>
                <Input
                  type="date"
                  value={filters.periodo_entrega_ini}
                  onChange={(e) => setFilters({ ...filters, periodo_entrega_ini: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Período de entrega (fim)</Label>
                <Input
                  type="date"
                  value={filters.periodo_entrega_fim}
                  onChange={(e) => setFilters({ ...filters, periodo_entrega_fim: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {!hasGenerated ? null : (
          <div className="space-y-4">
            <div className="flex border-b border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setTab('expedidos')}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === 'expedidos'
                    ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Send className="w-4 h-4" />
                Expedidos
                {dataExp ? (
                  <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 text-xs">
                    {formatNumber(dataExp.totals.quant_ctrc)}
                  </Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs">-</Badge>
                )}
              </button>

              <button
                onClick={() => setTab('recebidos')}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  tab === 'recebidos'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Inbox className="w-4 h-4" />
                Recebidos
                {dataRec ? (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                    {formatNumber(dataRec.totals.quant_ctrc)}
                  </Badge>
                ) : (
                  <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs">-</Badge>
                )}
              </button>

              <div className="flex-1" />

              <div className="flex items-center gap-2 px-3">
                {loading ? (
                  <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 text-xs flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {status || 'Processando...'}
                  </Badge>
                ) : status ? (
                  <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">{status}</Badge>
                ) : null}
                <Button
                  variant="outline"
                  disabled={loading}
                  onClick={() => {
                    const isExp = tab === 'expedidos';
                    const data = isExp ? dataExp : dataRec;
                    if (!data) {
                      toast.info('Nenhum dado carregado para exportar.');
                      return;
                    }
                    const kind = isExp ? 'Expedidos' : 'Recebidos';
                    const unidadeLabel = isExp ? 'Unidade Destino' : 'Unidade Origem';
                    const rows = isExp ? rowsExpSorted : rowsRecSorted;
                    const csv = buildCsv(kind, { ...data, rows }, unidadeLabel);
                    const stamp = new Date();
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const name = `fretes_${kind.toLowerCase()}_${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}_${pad(stamp.getHours())}${pad(
                      stamp.getMinutes()
                    )}.csv`;
                    downloadCsv(name, csv);
                  }}
                >
                  CSV
                </Button>
              </div>
            </div>

            {tab === 'expedidos' ? (
              <div>
            {!dataExp ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum dado de Expedidos carregado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-fr content-start">
                  <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4 flex items-start gap-3">
                    <Truck className="w-5 h-5 text-cyan-600 dark:text-cyan-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-cyan-700 dark:text-cyan-200">CT-es</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{formatNumber(dataExp.totals.quant_ctrc)}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 flex items-start gap-3">
                    <Wallet className="w-5 h-5 text-indigo-600 dark:text-indigo-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-indigo-700 dark:text-indigo-200">Frete Total</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{formatCurrency(dataExp.totals.frete_tot)}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-200">Valor Mercadoria</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{formatCurrency(dataExp.totals.val_merc)}</div>
                    </div>
                  </div>
                </div>

                <Card className="lg:col-span-1 flex flex-col h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Frete por unidade (Top)</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-[260px]">
                    {donutExp.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RechartsTooltip
                            formatter={(value: any, name: any) => [formatCurrency(Number(value) || 0), String(name)]}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              color: 'hsl(var(--popover-foreground))',
                            }}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                          <Pie data={donutExp} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} stroke="none">
                            {donutExp.map((_, i) => (
                              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <div className="lg:col-span-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Lista (unidades)</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort('expedidos', 'unidade')}>
                              Unidade Destino{sortIcon('expedidos', 'unidade')}
                            </th>
                            <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort('expedidos', 'uf')}>
                              UF{sortIcon('expedidos', 'uf')}
                            </th>
                            <th className="py-2 pr-3 text-right cursor-pointer select-none" onClick={() => toggleSort('expedidos', 'quant_ctrc')}>
                              CT-es{sortIcon('expedidos', 'quant_ctrc')}
                            </th>
                            <th className="py-2 pr-3 text-right cursor-pointer select-none" onClick={() => toggleSort('expedidos', 'peso_ton')}>
                              Peso (Ton){sortIcon('expedidos', 'peso_ton')}
                            </th>
                            <th className="py-2 pr-3 text-right cursor-pointer select-none" onClick={() => toggleSort('expedidos', 'val_merc')}>
                              Valor Merc.{sortIcon('expedidos', 'val_merc')}
                            </th>
                            <th className="py-2 pr-3 text-right cursor-pointer select-none" onClick={() => toggleSort('expedidos', 'frete_tot')}>
                              Frete Total{sortIcon('expedidos', 'frete_tot')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rowsExpSorted.slice(0, 200).map((r) => (
                            <tr key={`${r.sigla}-${r.uf}`} className="border-b last:border-0">
                              <td className="py-2 pr-3">
                                <div className="font-medium">{r.sigla}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[340px]">{r.unidade}</div>
                              </td>
                              <td className="py-2 pr-3">{r.uf}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatNumber(r.quant_ctrc)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatNumber(r.peso_ton, 3)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.val_merc)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.frete_tot)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
              </div>
            ) : (
              <div>
            {!dataRec ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum dado de Recebidos carregado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3 auto-rows-fr content-start">
                  <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4 flex items-start gap-3">
                    <Truck className="w-5 h-5 text-cyan-600 dark:text-cyan-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-cyan-700 dark:text-cyan-200">CT-es</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{formatNumber(dataRec.totals.quant_ctrc)}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 flex items-start gap-3">
                    <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-emerald-700 dark:text-emerald-200">Frete Total</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{formatCurrency(dataRec.totals.frete_tot)}</div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 flex items-start gap-3">
                    <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-300 mt-0.5 shrink-0" />
                    <div className="flex flex-col">
                      <div className="text-xs font-medium text-indigo-700 dark:text-indigo-200">Valor Mercadoria</div>
                      <div className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{formatCurrency(dataRec.totals.val_merc)}</div>
                    </div>
                  </div>
                </div>

                <Card className="lg:col-span-1 flex flex-col h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Frete por unidade (Top)</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1 min-h-[260px]">
                    {donutRec.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Sem dados</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <RechartsTooltip
                            formatter={(value: any, name: any) => [formatCurrency(Number(value) || 0), String(name)]}
                            contentStyle={{
                              backgroundColor: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              color: 'hsl(var(--popover-foreground))',
                            }}
                          />
                          <Legend verticalAlign="bottom" height={36} />
                          <Pie data={donutRec} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} stroke="none">
                            {donutRec.map((_, i) => (
                              <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <div className="lg:col-span-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Lista (unidades)</CardTitle>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort('recebidos', 'unidade')}>
                              Unidade Origem{sortIcon('recebidos', 'unidade')}
                            </th>
                            <th className="py-2 pr-3 cursor-pointer select-none" onClick={() => toggleSort('recebidos', 'uf')}>
                              UF{sortIcon('recebidos', 'uf')}
                            </th>
                            <th className="py-2 pr-3 text-right cursor-pointer select-none" onClick={() => toggleSort('recebidos', 'quant_ctrc')}>
                              CT-es{sortIcon('recebidos', 'quant_ctrc')}
                            </th>
                            <th className="py-2 pr-3 text-right cursor-pointer select-none" onClick={() => toggleSort('recebidos', 'peso_ton')}>
                              Peso (Ton){sortIcon('recebidos', 'peso_ton')}
                            </th>
                            <th className="py-2 pr-3 text-right cursor-pointer select-none" onClick={() => toggleSort('recebidos', 'val_merc')}>
                              Valor Merc.{sortIcon('recebidos', 'val_merc')}
                            </th>
                            <th className="py-2 pr-3 text-right cursor-pointer select-none" onClick={() => toggleSort('recebidos', 'frete_tot')}>
                              Frete Total{sortIcon('recebidos', 'frete_tot')}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {rowsRecSorted.slice(0, 200).map((r) => (
                            <tr key={`${r.sigla}-${r.uf}`} className="border-b last:border-0">
                              <td className="py-2 pr-3">
                                <div className="font-medium">{r.sigla}</div>
                                <div className="text-xs text-muted-foreground truncate max-w-[340px]">{r.unidade}</div>
                              </td>
                              <td className="py-2 pr-3">{r.uf}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatNumber(r.quant_ctrc)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatNumber(r.peso_ton, 3)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.val_merc)}</td>
                              <td className="py-2 pr-3 text-right font-mono">{formatCurrency(r.frete_tot)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
