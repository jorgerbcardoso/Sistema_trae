import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Separator } from '../../components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '../../components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { usePageTitle } from '../../hooks/usePageTitle';
import {
  Bell,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  FileDown,
  FileText,
  Gauge,
  MapPin,
  Package,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../components/ui/utils';

type PortalTenant = {
  id: string;
  nome: string;
  slogan: string;
  corPrimaria: string;
  corSecundaria: string;
  logoUrl?: string;
};

type PortalCliente = {
  nome: string;
  documento: string;
  email: string;
  contrato: string;
};

type TrackingEvento = {
  id: string;
  dataHora: string;
  titulo: string;
  detalhe: string;
  local: string;
  tipo: 'ok' | 'warn' | 'done';
};

type Remessa = {
  id: string;
  ctrc: string;
  nf: string;
  origem: string;
  destino: string;
  previsaoEntrega: string;
  statusLabel: string;
  statusTipo: 'ok' | 'warn' | 'done';
  volume: number;
  pesoKg: number;
  valorMercadoria: number;
  eventos: TrackingEvento[];
};

type Coleta = {
  id: string;
  solicitadaEm: string;
  janela: string;
  endereco: string;
  referencia: string;
  status: 'aberta' | 'confirmada' | 'concluida' | 'cancelada';
};

type Cotacao = {
  id: string;
  solicitadaEm: string;
  origem: string;
  destino: string;
  pesoKg: number;
  volumeM3: number;
  prazoDias: number;
  valor: number;
  status: 'respondida' | 'em_analise' | 'expirada';
};

type Fatura = {
  id: string;
  competencia: string;
  vencimento: string;
  valor: number;
  status: 'aberta' | 'paga' | 'vencida';
};

type Emissao = {
  id: string;
  competencia: string;
  qtdeCtes: number;
  totalFrete: number;
  totalPesoKg: number;
};

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

const TENANTS: PortalTenant[] = [
  {
    id: 'aurora',
    nome: 'Aurora Transportes',
    slogan: 'Transporte inteligente com visibilidade ponta a ponta',
    corPrimaria: '#2563eb',
    corSecundaria: '#0ea5e9',
  },
  {
    id: 'brisa',
    nome: 'BrisaLog',
    slogan: 'Sua carga no tempo certo, com segurança',
    corPrimaria: '#16a34a',
    corSecundaria: '#22c55e',
  },
];

const CLIENTE: PortalCliente = {
  nome: 'Comercial ACME LTDA',
  documento: '12.345.678/0001-90',
  email: 'logistica@acme.com.br',
  contrato: 'CONTR-2047',
};

const REMESSAS: Remessa[] = [
  {
    id: 'R-10493',
    ctrc: 'CTRC 018394',
    nf: 'NF 88410',
    origem: 'SAO/SP · Centro',
    destino: 'BHZ/MG · Contagem',
    previsaoEntrega: '07/10',
    statusLabel: 'Saiu para entrega',
    statusTipo: 'warn',
    volume: 12,
    pesoKg: 742.4,
    valorMercadoria: 186400,
    eventos: [
      { id: 'e1', dataHora: '06/10 09:10', titulo: 'Coleta realizada', detalhe: 'Mercadoria recebida no CD de origem', local: 'SAO/SP', tipo: 'ok' },
      { id: 'e2', dataHora: '06/10 12:45', titulo: 'Em transferência', detalhe: 'Saída para unidade de consolidação', local: 'SAO/SP', tipo: 'ok' },
      { id: 'e3', dataHora: '06/10 23:20', titulo: 'Chegada na unidade', detalhe: 'Triagem e roteirização', local: 'BHZ/MG', tipo: 'ok' },
      { id: 'e4', dataHora: '07/10 08:05', titulo: 'Saiu para entrega', detalhe: 'Motorista: J. Souza · Placa BRA-2E19', local: 'BHZ/MG', tipo: 'warn' },
    ],
  },
  {
    id: 'R-10502',
    ctrc: 'CTRC 018421',
    nf: 'NF 88486',
    origem: 'CWB/PR · CIC',
    destino: 'FLN/SC · São José',
    previsaoEntrega: '06/10',
    statusLabel: 'Entregue',
    statusTipo: 'done',
    volume: 6,
    pesoKg: 203.9,
    valorMercadoria: 48200,
    eventos: [
      { id: 'e1', dataHora: '05/10 14:12', titulo: 'Coleta realizada', detalhe: 'Coleta no remetente', local: 'CWB/PR', tipo: 'ok' },
      { id: 'e2', dataHora: '05/10 18:40', titulo: 'Em transferência', detalhe: 'Transferência para destino', local: 'CWB/PR', tipo: 'ok' },
      { id: 'e3', dataHora: '06/10 06:15', titulo: 'Saiu para entrega', detalhe: 'Rota urbana', local: 'FLN/SC', tipo: 'ok' },
      { id: 'e4', dataHora: '06/10 10:22', titulo: 'Entregue', detalhe: 'Recebedor: P. Martins (RG ****)', local: 'FLN/SC', tipo: 'done' },
    ],
  },
  {
    id: 'R-10528',
    ctrc: 'CTRC 018503',
    nf: 'NF 88641',
    origem: 'POA/RS · Gravataí',
    destino: 'RVE/BA · Salvador',
    previsaoEntrega: '09/10',
    statusLabel: 'Em transferência',
    statusTipo: 'ok',
    volume: 28,
    pesoKg: 1180.1,
    valorMercadoria: 292000,
    eventos: [
      { id: 'e1', dataHora: '06/10 08:02', titulo: 'Coleta realizada', detalhe: 'Documentos conferidos', local: 'POA/RS', tipo: 'ok' },
      { id: 'e2', dataHora: '06/10 20:30', titulo: 'Em transferência', detalhe: 'Linha interestadual (hub)', local: 'POA/RS', tipo: 'ok' },
    ],
  },
  {
    id: 'R-10531',
    ctrc: 'CTRC 018511',
    nf: 'NF 88662',
    origem: 'RVE/BA · Camaçari',
    destino: 'SAO/SP · Guarulhos',
    previsaoEntrega: '08/10',
    statusLabel: 'Ocorrência registrada',
    statusTipo: 'warn',
    volume: 2,
    pesoKg: 32.8,
    valorMercadoria: 8900,
    eventos: [
      { id: 'e1', dataHora: '06/10 11:31', titulo: 'Coleta realizada', detalhe: 'Coleta no fornecedor', local: 'CAM/BA', tipo: 'ok' },
      { id: 'e2', dataHora: '06/10 16:10', titulo: 'Ocorrência registrada', detalhe: 'Divergência de embalagem (sem impacto)', local: 'CAM/BA', tipo: 'warn' },
      { id: 'e3', dataHora: '06/10 19:05', titulo: 'Em transferência', detalhe: 'Saída para unidade de origem', local: 'CAM/BA', tipo: 'ok' },
    ],
  },
];

const COLETAS: Coleta[] = [
  {
    id: 'C-22031',
    solicitadaEm: '06/10 10:18',
    janela: '06/10 · 13:00–16:00',
    endereco: 'Av. Industrial, 1200 · Contagem/MG',
    referencia: 'Docas 3–5 · Recepção Logística',
    status: 'confirmada',
  },
  {
    id: 'C-22044',
    solicitadaEm: '06/10 15:42',
    janela: '07/10 · 09:00–12:00',
    endereco: 'Rod. BR-101, Km 210 · São José/SC',
    referencia: 'Portaria 2',
    status: 'aberta',
  },
];

const COTACOES: Cotacao[] = [
  { id: 'Q-11802', solicitadaEm: '06/10 09:05', origem: 'SAO/SP', destino: 'BHZ/MG', pesoKg: 820, volumeM3: 3.4, prazoDias: 2, valor: 1260.5, status: 'respondida' },
  { id: 'Q-11811', solicitadaEm: '06/10 11:20', origem: 'CWB/PR', destino: 'FLN/SC', pesoKg: 210, volumeM3: 0.8, prazoDias: 1, valor: 480.2, status: 'respondida' },
  { id: 'Q-11829', solicitadaEm: '06/10 16:02', origem: 'RVE/BA', destino: 'SAO/SP', pesoKg: 50, volumeM3: 0.15, prazoDias: 4, valor: 230, status: 'em_analise' },
];

const FATURAS: Fatura[] = [
  { id: 'FAT-2026-09', competencia: '09/2026', vencimento: '10/10/2026', valor: 18542.18, status: 'aberta' },
  { id: 'FAT-2026-08', competencia: '08/2026', vencimento: '10/09/2026', valor: 16210.44, status: 'paga' },
  { id: 'FAT-2026-07', competencia: '07/2026', vencimento: '10/08/2026', valor: 17180.32, status: 'vencida' },
];

const EMISSOES: Emissao[] = [
  { id: 'E-2026-10', competencia: '10/2026 (parcial)', qtdeCtes: 42, totalFrete: 28110.55, totalPesoKg: 9802.4 },
  { id: 'E-2026-09', competencia: '09/2026', qtdeCtes: 188, totalFrete: 124880.22, totalPesoKg: 46810.1 },
  { id: 'E-2026-08', competencia: '08/2026', qtdeCtes: 173, totalFrete: 116340.9, totalPesoKg: 43122.6 },
];

type PortalView =
  | 'dashboard'
  | 'tracking'
  | 'coletas'
  | 'cotacoes'
  | 'faturas'
  | 'emissoes'
  | 'relatorio-faturas'
  | 'comprovante';

function statusBadgeVariant(tipo: 'ok' | 'warn' | 'done') {
  if (tipo === 'done') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
  if (tipo === 'warn') return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';
  return 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200';
}

function statusFaturaBadge(st: Fatura['status']) {
  if (st === 'paga') return { label: 'Paga', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' };
  if (st === 'vencida') return { label: 'Vencida', cls: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
  return { label: 'Aberta', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' };
}

function statusColetaBadge(st: Coleta['status']) {
  if (st === 'concluida') return { label: 'Concluída', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' };
  if (st === 'confirmada') return { label: 'Confirmada', cls: 'bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200' };
  if (st === 'cancelada') return { label: 'Cancelada', cls: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' };
  return { label: 'Aberta', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' };
}

function statusCotacaoBadge(st: Cotacao['status']) {
  if (st === 'respondida') return { label: 'Respondida', cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' };
  if (st === 'expirada') return { label: 'Expirada', cls: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' };
  return { label: 'Em análise', cls: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200' };
}

function Timeline({ eventos, corPrimaria }: { eventos: TrackingEvento[]; corPrimaria: string }) {
  return (
    <div className="space-y-3">
      {eventos.map((ev, idx) => {
        const isLast = idx === eventos.length - 1;
        const dotCls = ev.tipo === 'done' ? 'bg-emerald-500' : (ev.tipo === 'warn' ? 'bg-amber-500' : 'bg-sky-500');
        return (
          <div key={ev.id} className="grid grid-cols-[26px_minmax(0,1fr)] gap-3">
            <div className="relative flex justify-center">
              <div className={cn('w-3 h-3 rounded-full ring-4 ring-white dark:ring-slate-900', dotCls)} style={{ backgroundColor: ev.tipo === 'ok' ? corPrimaria : undefined }} />
              {!isLast && <div className="absolute top-3 bottom-[-14px] w-[2px] bg-slate-200 dark:bg-slate-800" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{ev.titulo}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{ev.detalhe}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono text-slate-700 dark:text-slate-200">{ev.dataHora}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{ev.local}</div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AreaClienteDemo() {
  usePageTitle('Área do Cliente · Demo');
  const navigate = useNavigate();

  const [logged, setLogged] = useState(false);
  const [tenantId, setTenantId] = useState<PortalTenant['id']>('aurora');
  const [tenantCustom, setTenantCustom] = useState<PortalTenant | null>(null);

  const tenant = useMemo(() => {
    const base = TENANTS.find((t) => t.id === tenantId) ?? TENANTS[0];
    return tenantCustom ? { ...base, ...tenantCustom } : base;
  }, [tenantCustom, tenantId]);

  const [view, setView] = useState<PortalView>('dashboard');
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string>(REMESSAS[0]?.id ?? '');

  const remessasFiltradas = useMemo(() => {
    const s = q.trim().toUpperCase();
    if (!s) return REMESSAS;
    return REMESSAS.filter((r) => {
      const alvo = [r.id, r.ctrc, r.nf, r.origem, r.destino, r.statusLabel].join(' ').toUpperCase();
      return alvo.includes(s);
    });
  }, [q]);

  const remessaSel = useMemo(() => {
    return REMESSAS.find((r) => r.id === selectedId) ?? REMESSAS[0];
  }, [selectedId]);

  const primaryStyle = { '--portal-primary': tenant.corPrimaria, '--portal-secondary': tenant.corSecundaria } as React.CSSProperties;

  const navItem = (id: PortalView, label: string, Icon: React.ElementType, badge?: string) => (
    <button
      type="button"
      onClick={() => setView(id)}
      className={cn(
        'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
        view === id ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
      )}
    >
      <Icon className="w-4 h-4" style={view === id ? { color: tenant.corPrimaria } : undefined} />
      <span className="flex-1 text-left">{label}</span>
      {badge ? <Badge className="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 text-[10px]">{badge}</Badge> : null}
    </button>
  );

  if (!logged) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 p-4" style={primaryStyle}>
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100">{tenant.nome}</CardTitle>
              <div className="text-sm text-slate-600 dark:text-slate-300">{tenant.slogan}</div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge className="bg-[var(--portal-primary)] text-white">White-label</Badge>
                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">Rastreamento</Badge>
                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">Coletas</Badge>
                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">Cotações</Badge>
                <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">Faturas</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Disponibilidade</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">24/7</div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Atualização</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Em tempo real</div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Integrações</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">APIs SSW</div>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">Segurança</div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Controle por usuário</div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/40">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Ambiente de demonstração</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Dados fictícios com fluxo completo de rastreamento, coletas, cotações e faturamento.
                    </div>
                  </div>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Settings className="w-4 h-4" />
                        Marca
                      </Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>White-label</SheetTitle>
                        <SheetDescription>Troque logo, cores e identidade visual para simular cada transportadora.</SheetDescription>
                      </SheetHeader>
                      <div className="px-4 space-y-4">
                        <div className="space-y-2">
                          <Label>Transportadora</Label>
                          <select
                            value={tenantId}
                            onChange={(e) => { setTenantId(e.target.value); setTenantCustom(null); }}
                            className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm"
                          >
                            {TENANTS.map((t) => (
                              <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                          </select>
                        </div>
                        <Separator />
                        <div className="space-y-2">
                          <Label>Cor primária</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              value={tenantCustom?.corPrimaria ?? tenant.corPrimaria}
                              onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), corPrimaria: e.target.value }))}
                              className="h-9 w-14 p-1"
                            />
                            <Input
                              value={tenantCustom?.corPrimaria ?? tenant.corPrimaria}
                              onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), corPrimaria: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Cor secundária</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="color"
                              value={tenantCustom?.corSecundaria ?? tenant.corSecundaria}
                              onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), corSecundaria: e.target.value }))}
                              className="h-9 w-14 p-1"
                            />
                            <Input
                              value={tenantCustom?.corSecundaria ?? tenant.corSecundaria}
                              onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), corSecundaria: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Logo (URL)</Label>
                          <Input
                            placeholder="https://..."
                            value={tenantCustom?.logoUrl ?? ''}
                            onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), logoUrl: e.target.value }))}
                          />
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg text-slate-900 dark:text-slate-100">Acesso do cliente</CardTitle>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Simulação de login em um site da transportadora (ambiente fictício).
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Documento</Label>
                <Input value={CLIENTE.documento} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input value={CLIENTE.email} readOnly />
              </div>
              <div className="space-y-1.5">
                <Label>Senha</Label>
                <Input value="demo" readOnly />
              </div>
              <Button
                className="w-full bg-[var(--portal-primary)] text-white hover:opacity-90"
                onClick={() => setLogged(true)}
              >
                Entrar
              </Button>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Este é um demo hardcoded com dados mock. Na versão real, a autenticação pode ser por usuário/senha, token, SSO ou links de acesso.
              </div>
              <Separator />
              <Button variant="outline" className="w-full" onClick={() => navigate('/login')}>
                Voltar ao sistema
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const metricas = useMemo(() => {
    const emTransito = REMESSAS.filter((r) => r.statusTipo !== 'done').length;
    const entregues = REMESSAS.filter((r) => r.statusTipo === 'done').length;
    const faturasAbertas = FATURAS.filter((f) => f.status === 'aberta' || f.status === 'vencida').length;
    const coletasAbertas = COLETAS.filter((c) => c.status === 'aberta' || c.status === 'confirmada').length;
    return { emTransito, entregues, faturasAbertas, coletasAbertas };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" style={primaryStyle}>
      <div className="sticky top-0 z-20 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/70 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {tenant.logoUrl ? (
              <img src={tenant.logoUrl} alt={tenant.nome} className="h-8 w-8 rounded-md object-cover border border-slate-200 dark:border-slate-800" />
            ) : (
              <div className="h-8 w-8 rounded-md bg-[var(--portal-primary)] text-white flex items-center justify-center font-bold">A</div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{tenant.nome}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{CLIENTE.nome} · {CLIENTE.contrato}</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.message('Notificações (demo)')}>
              <Bell className="w-4 h-4" />
              Alertas
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="w-4 h-4" />
                  Marca
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>White-label</SheetTitle>
                  <SheetDescription>Personalize logo e cores da transportadora (demo).</SheetDescription>
                </SheetHeader>
                <div className="px-4 space-y-4">
                  <div className="space-y-2">
                    <Label>Transportadora</Label>
                    <select
                      value={tenantId}
                      onChange={(e) => { setTenantId(e.target.value); setTenantCustom(null); }}
                      className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm"
                    >
                      {TENANTS.map((t) => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Cor primária</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={tenantCustom?.corPrimaria ?? tenant.corPrimaria}
                        onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), corPrimaria: e.target.value }))}
                        className="h-9 w-14 p-1"
                      />
                      <Input
                        value={tenantCustom?.corPrimaria ?? tenant.corPrimaria}
                        onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), corPrimaria: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor secundária</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={tenantCustom?.corSecundaria ?? tenant.corSecundaria}
                        onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), corSecundaria: e.target.value }))}
                        className="h-9 w-14 p-1"
                      />
                      <Input
                        value={tenantCustom?.corSecundaria ?? tenant.corSecundaria}
                        onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), corSecundaria: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Logo (URL)</Label>
                    <Input
                      placeholder="https://..."
                      value={tenantCustom?.logoUrl ?? ''}
                      onChange={(e) => setTenantCustom((p) => ({ ...(p ?? {} as any), logoUrl: e.target.value }))}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="outline" size="sm" onClick={() => { setLogged(false); setView('dashboard'); }}>
              Sair
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4">
        <div className="space-y-3">
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Gauge className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                Visão geral
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Em trânsito</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{metricas.emTransito}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Entregues</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{metricas.entregues}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Faturas</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{metricas.faturasAbertas}</div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Coletas</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{metricas.coletasAbertas}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-slate-900 dark:text-slate-100">Acesso rápido</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {navItem('dashboard', 'Painel', Gauge)}
              {navItem('tracking', 'Rastreamento', Truck, String(REMESSAS.length))}
              {navItem('coletas', 'Solicitar coleta', ClipboardList, String(COLETAS.length))}
              {navItem('cotacoes', 'Cotação de frete', Receipt, String(COTACOES.length))}
              {navItem('faturas', '2ª via de faturas', FileText, String(FATURAS.length))}
              {navItem('emissoes', 'Relatório de emissões', Package)}
              {navItem('relatorio-faturas', 'Relatório de faturas', Receipt)}
              {navItem('comprovante', 'Comprovante de entrega', ShieldCheck)}
            </CardContent>
          </Card>
        </div>

        <div className="min-w-0">
          {view === 'dashboard' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[var(--portal-primary)] text-white flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold text-slate-900 dark:text-slate-100">Área do Cliente</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">
                      Acesso a rastreamento, coletas, cotações, faturas e relatórios com identidade visual da transportadora.
                    </div>
                  </div>
                  <Button variant="outline" className="gap-2" onClick={() => { setView('tracking'); }}>
                    <Search className="w-4 h-4" />
                    Rastrear
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Truck className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                      Remessas em destaque
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {REMESSAS.slice(0, 3).map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-900/40"
                        onClick={() => { setSelectedId(r.id); setView('tracking'); }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{r.ctrc}</div>
                          <Badge className={cn('text-[10px] h-5 px-2', statusBadgeVariant(r.statusTipo))}>{r.statusLabel}</Badge>
                          <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">Prev. {r.previsaoEntrega}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                          {r.origem} <ChevronRight className="inline w-3 h-3 mx-1 opacity-60" /> {r.destino}
                        </div>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 dark:border-slate-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <FileText className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                      Faturas recentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {FATURAS.map((f) => {
                      const st = statusFaturaBadge(f.status);
                      return (
                        <div key={f.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{f.competencia}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Venc. {f.vencimento}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">{money.format(f.valor)}</div>
                            <Badge className={cn('text-[10px] h-5 px-2', st.cls)}>{st.label}</Badge>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setView('faturas')}>
                        <FileText className="w-4 h-4" />
                        Abrir faturas
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {view === 'tracking' && (
            <div className="space-y-4">
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Truck className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                    Rastreamento
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por CTRC, NF, origem, destino..." className="pl-9" />
                      </div>
                      <Button variant="outline" className="gap-2" onClick={() => toast.message('Busca avançada (demo)')}>
                        <MapPin className="w-4 h-4" />
                        Filtros
                      </Button>
                    </div>
                    <ScrollArea className="h-[60vh] pr-3">
                      <div className="space-y-2">
                        {remessasFiltradas.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => setSelectedId(r.id)}
                            className={cn(
                              'w-full rounded-xl border p-3 text-left transition-colors',
                              r.id === selectedId
                                ? 'border-[var(--portal-primary)] bg-slate-50 dark:bg-slate-900/40'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/30'
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <div className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">{r.ctrc}</div>
                              <Badge className={cn('text-[10px] h-5 px-2', statusBadgeVariant(r.statusTipo))}>{r.statusLabel}</Badge>
                              <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400">Prev. {r.previsaoEntrega}</span>
                            </div>
                            <div className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">
                              {r.origem} <ChevronRight className="inline w-3 h-3 mx-1 opacity-60" /> {r.destino}
                            </div>
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                              <span className="font-mono">{r.nf}</span>
                              <span>{r.volume} vol · {num.format(r.pesoKg)} kg</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="min-w-0 space-y-3">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="flex-1 min-w-[220px]">
                          <div className="flex items-center gap-2">
                            <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100">{remessaSel.ctrc}</div>
                            <Badge className={cn('text-[10px] h-5 px-2', statusBadgeVariant(remessaSel.statusTipo))}>{remessaSel.statusLabel}</Badge>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{remessaSel.nf} · Prev. {remessaSel.previsaoEntrega}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.message('Compartilhar link (demo)')}>
                            <FileDown className="w-4 h-4" />
                            PDF
                          </Button>
                          <Button size="sm" className="gap-2 bg-[var(--portal-primary)] text-white hover:opacity-90" onClick={() => toast.success('Solicitação registrada (demo)')}>
                            <ShieldCheck className="w-4 h-4" />
                            Solicitar POD
                          </Button>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Origem</div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{remessaSel.origem}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Destino</div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{remessaSel.destino}</div>
                        </div>
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">Mercadoria</div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {remessaSel.volume} vol · {num.format(remessaSel.pesoKg)} kg
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">{money.format(remessaSel.valorMercadoria)}</div>
                        </div>
                      </div>
                    </div>

                    <Card className="border-slate-200 dark:border-slate-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                          <CalendarClock className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                          Linha do tempo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Timeline eventos={remessaSel.eventos} corPrimaria={tenant.corPrimaria} />
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {view === 'coletas' && (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                  Solicitação de coletas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/40">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nova coleta</div>
                  <div className="mt-2 grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Endereço</Label>
                      <Input defaultValue="Av. Industrial, 1200 · Contagem/MG" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Janela</Label>
                      <Input defaultValue="08/10 · 13:00–16:00" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Referência</Label>
                      <Input defaultValue="Docas 3–5" />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button className="bg-[var(--portal-primary)] text-white hover:opacity-90" onClick={() => toast.success('Coleta solicitada (demo)')}>
                      Solicitar coleta
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Solicitada</TableHead>
                        <TableHead>Janela</TableHead>
                        <TableHead>Endereço</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {COLETAS.map((c) => {
                        const st = statusColetaBadge(c.status);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.id}</TableCell>
                            <TableCell className="text-xs">{c.solicitadaEm}</TableCell>
                            <TableCell className="text-xs">{c.janela}</TableCell>
                            <TableCell className="text-xs">{c.endereco}</TableCell>
                            <TableCell>
                              <Badge className={cn('text-[10px] h-5 px-2', st.cls)}>{st.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {view === 'cotacoes' && (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                  Cotações de frete
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/40">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Nova cotação</div>
                  <div className="mt-2 grid grid-cols-1 lg:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label>Origem</Label>
                      <Input defaultValue="SAO/SP" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Destino</Label>
                      <Input defaultValue="BHZ/MG" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Peso (kg)</Label>
                      <Input defaultValue="820" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Volume (m³)</Label>
                      <Input defaultValue="3,40" />
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button className="bg-[var(--portal-primary)] text-white hover:opacity-90" onClick={() => toast.success('Cotação solicitada (demo)')}>
                      Solicitar cotação
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Solicitada</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Destino</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {COTACOES.map((c) => {
                        const st = statusCotacaoBadge(c.status);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">{c.id}</TableCell>
                            <TableCell className="text-xs">{c.solicitadaEm}</TableCell>
                            <TableCell className="text-xs">{c.origem}</TableCell>
                            <TableCell className="text-xs">{c.destino}</TableCell>
                            <TableCell className="text-xs text-right">{money.format(c.valor)}</TableCell>
                            <TableCell>
                              <Badge className={cn('text-[10px] h-5 px-2', st.cls)}>{st.label}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {view === 'faturas' && (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                  2ª via de faturas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {FATURAS.map((f) => {
                        const st = statusFaturaBadge(f.status);
                        return (
                          <TableRow key={f.id}>
                            <TableCell className="text-xs font-semibold">{f.competencia}</TableCell>
                            <TableCell className="text-xs">{f.vencimento}</TableCell>
                            <TableCell className="text-xs text-right">{money.format(f.valor)}</TableCell>
                            <TableCell>
                              <Badge className={cn('text-[10px] h-5 px-2', st.cls)}>{st.label}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" size="sm" className="gap-2" onClick={() => toast.message('Boleto (demo)')}>
                                  <Receipt className="w-4 h-4" />
                                  Boleto
                                </Button>
                                <Button size="sm" className="gap-2 bg-[var(--portal-primary)] text-white hover:opacity-90" onClick={() => toast.message('PDF gerado (demo)')}>
                                  <FileDown className="w-4 h-4" />
                                  PDF
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {view === 'emissoes' && (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Package className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                  Relatório de emissões
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Competência</TableHead>
                        <TableHead className="text-right">CT-es</TableHead>
                        <TableHead className="text-right">Frete</TableHead>
                        <TableHead className="text-right">Peso</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {EMISSOES.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs font-semibold">{r.competencia}</TableCell>
                          <TableCell className="text-xs text-right">{r.qtdeCtes}</TableCell>
                          <TableCell className="text-xs text-right">{money.format(r.totalFrete)}</TableCell>
                          <TableCell className="text-xs text-right">{num.format(r.totalPesoKg)} kg</TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => toast.message('CSV exportado (demo)')}>
                              <FileDown className="w-4 h-4" />
                              CSV
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {view === 'relatorio-faturas' && (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                  Relatório de faturas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs defaultValue="resumo">
                  <TabsList>
                    <TabsTrigger value="resumo">Resumo</TabsTrigger>
                    <TabsTrigger value="detalhado">Detalhado</TabsTrigger>
                  </TabsList>
                  <TabsContent value="resumo" className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Total em aberto</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          {money.format(FATURAS.filter(f => f.status !== 'paga').reduce((a, b) => a + b.valor, 0))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Qtd. faturas</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{FATURAS.length}</div>
                      </div>
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">Pagas</div>
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{FATURAS.filter(f => f.status === 'paga').length}</div>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" className="bg-[var(--portal-primary)] text-white hover:opacity-90 gap-2" onClick={() => toast.message('PDF (demo)')}>
                        <FileDown className="w-4 h-4" />
                        Exportar PDF
                      </Button>
                    </div>
                  </TabsContent>
                  <TabsContent value="detalhado" className="space-y-3">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Competência</TableHead>
                            <TableHead>Vencimento</TableHead>
                            <TableHead className="text-right">Valor</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {FATURAS.map((f) => {
                            const st = statusFaturaBadge(f.status);
                            return (
                              <TableRow key={f.id}>
                                <TableCell className="text-xs font-semibold">{f.competencia}</TableCell>
                                <TableCell className="text-xs">{f.vencimento}</TableCell>
                                <TableCell className="text-xs text-right">{money.format(f.valor)}</TableCell>
                                <TableCell>
                                  <Badge className={cn('text-[10px] h-5 px-2', st.cls)}>{st.label}</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {view === 'comprovante' && (
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" style={{ color: tenant.corPrimaria }} />
                  Solicitar comprovante de entrega (POD)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/40">
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Solicitação</div>
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>CTRC</Label>
                      <Input defaultValue={remessaSel.ctrc} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>E-mail para envio</Label>
                      <Input defaultValue={CLIENTE.email} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Formato</Label>
                      <select className="w-full h-9 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-sm">
                        <option>PDF</option>
                        <option>Imagem</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button className="bg-[var(--portal-primary)] text-white hover:opacity-90" onClick={() => toast.success('Solicitação registrada e será enviada por e-mail (demo)')}>
                      Solicitar comprovante
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CTRC</TableHead>
                        <TableHead>NF</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {REMESSAS.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{r.ctrc}</TableCell>
                          <TableCell className="font-mono text-xs">{r.nf}</TableCell>
                          <TableCell>
                            <Badge className={cn('text-[10px] h-5 px-2', statusBadgeVariant(r.statusTipo))}>{r.statusLabel}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => { setSelectedId(r.id); toast.message('Abrindo POD (demo)'); }}>
                              <FileText className="w-4 h-4" />
                              Solicitar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
