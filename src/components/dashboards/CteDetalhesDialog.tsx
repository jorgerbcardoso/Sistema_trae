import React, { useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Info, Package, Truck, Building2, MapPin, Weight, Box, CalendarDays, DollarSign, FileText, Car, AlertCircle } from 'lucide-react';
import { useTooltipStyle } from './CustomTooltip';

export interface CteCustoParcela {
  key: string;
  label: string;
  valor: number;
}

export interface CteDetalhesData {
  ctrc?: string;
  serCte?: string;
  nroCte?: number | string;
  seqCte?: number;
  emissao?: string;
  chegadaUnid?: string;
  unidAtual?: string;
  prevEnt?: string;
  prevChegada?: string;
  agendamento?: string;
  nfiscal?: string;
  pedido?: string;
  manifesto?: string;
  remetente?: string;
  pagador?: string;
  destinatario?: string;
  cnpjDest?: string;
  endereco?: string;
  cidade?: string;
  bairro?: string;
  cep?: string;
  uf?: string;
  setor?: string;
  setorNome?: string;
  unidadeDest?: string;
  nomeDest?: string;
  unidadeOrigem?: string;
  placaColeta?: string;
  vlrNf?: string | number;
  vlrMerc?: string | number;
  frete?: string | number;
  peso?: string | number;
  pesoCalc?: string | number;
  pesoReal?: string | number;
  cubagem?: string | number;
  qtdeVol?: string | number;
  codUltOcor?: string;
  descUltOcor?: string;
  dataUltOcor?: string;
  diasAtraso?: number;
  emTransito?: boolean;
  indicadorSaida?: string | null;
  atrasoTransf?: string | null;
  atrasoEntrega?: string | null;
  custoSeguro?: string | number;
  custoIcms?: string | number;
  custoPisCofins?: string | number;
  custoGris?: string | number;
  custoPedagio?: string | number;
  custoExpedicao?: string | number;
  custoTransbordo?: string | number;
  custoVendedor?: string | number;
  custoRecepcao?: string | number;
  custoDespDiv?: string | number;
  custoTransferenciaReal?: string | number;
  [key: string]: any;
}

const CUSTO_CAMPOS: { key: keyof CteDetalhesData; label: string; cor: string }[] = [
  { key: 'custoSeguro', label: 'Seguro', cor: '#6366f1' },
  { key: 'custoIcms', label: 'ICMS', cor: '#8b5cf6' },
  { key: 'custoPisCofins', label: 'PIS/Cofins', cor: '#a855f7' },
  { key: 'custoGris', label: 'GRIS', cor: '#d946ef' },
  { key: 'custoPedagio', label: 'Pedágio', cor: '#ec4899' },
  { key: 'custoExpedicao', label: 'Expedição', cor: '#f43f5e' },
  { key: 'custoTransbordo', label: 'Transbordo', cor: '#f97316' },
  { key: 'custoVendedor', label: 'Vendedor', cor: '#f59e0b' },
  { key: 'custoRecepcao', label: 'Recepção', cor: '#eab308' },
  { key: 'custoDespDiv', label: 'Desp. Diversas', cor: '#84cc16' },
  { key: 'custoTransferenciaReal', label: 'Transferência', cor: '#10b981' },
];

const COR_INDICADOR: Record<string, string> = {
  verde: 'bg-green-500',
  amarelo: 'bg-yellow-400',
  laranja: 'bg-orange-500',
  vermelho: 'bg-red-600',
};

const parseNum = (v: any): number => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const raw = String(v).trim();
  if (!raw) return 0;
  const cleaned = raw.replace(/[^\d,.\-]/g, '');
  if (!cleaned) return 0;
  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');
  let normalized = cleaned;
  if (hasComma && hasDot) normalized = cleaned.replace(/\./g, '').replace(',', '.');
  else if (hasComma) normalized = cleaned.replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
};

const fmtMoeda = (v: number): string =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtPeso = (v: number): string => {
  if (v >= 1000) return `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`;
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
};

const fmtVol = (v: number): string =>
  `${v.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} vol`;

function IndicadorDot({ cor, title }: { cor: string | null | undefined; title?: string }) {
  const cls = cor && COR_INDICADOR[cor] ? COR_INDICADOR[cor] : 'bg-slate-300 dark:bg-slate-600';
  return <span className={`w-2.5 h-2.5 rounded-full inline-block ${cls}`} title={title} />;
}

function Campo({ label, valor, icon: Icon, mono }: { label: string; valor?: React.ReactNode; icon?: any; mono?: boolean }) {
  const vazio = valor === undefined || valor === null || valor === '' || (typeof valor === 'string' && valor.trim() === '');
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </span>
      {vazio ? (
        <span className="text-xs text-slate-300 dark:text-slate-600">-</span>
      ) : (
        <span className={`text-xs text-slate-700 dark:text-slate-300 truncate ${mono ? 'font-mono tabular-nums' : ''}`}>
          {valor}
        </span>
      )}
    </div>
  );
}

function Secao({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1">
        {title}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 px-0.5">
        {children}
      </div>
    </div>
  );
}

export function calcularParcelasCusto(cte: CteDetalhesData): CteCustoParcela[] {
  const out: CteCustoParcela[] = [];
  for (const c of CUSTO_CAMPOS) {
    const v = parseNum(cte[c.key]);
    if (v > 0) out.push({ key: String(c.key), label: c.label, valor: v });
  }
  return out;
}

export function calcularCustoTotal(cte: CteDetalhesData): number {
  return CUSTO_CAMPOS.reduce((s, c) => s + parseNum(cte[c.key]), 0);
}

export interface CteDetalhesDialogProps {
  cte: CteDetalhesData | null | undefined;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CteDetalhesDialog({ cte, children, open: openProp, onOpenChange }: CteDetalhesDialogProps) {
  const tooltipStyle = useTooltipStyle();

  const parcelas = useMemo<CteCustoParcela[]>(() => (cte ? calcularParcelasCusto(cte) : []), [cte]);
  const custoTotal = useMemo(() => (cte ? calcularCustoTotal(cte) : 0), [cte]);
  const freteNum = parseNum(cte?.frete);
  const vlrMercNum = parseNum(cte?.vlrMerc ?? cte?.vlrNf);
  const pesoNum = parseNum(cte?.peso);
  const pesoCalcNum = parseNum(cte?.pesoCalc ?? cte?.pesoReal);
  const cubagemNum = parseNum(cte?.cubagem);
  const volNum = parseNum(cte?.qtdeVol);

  const donutData = useMemo(() => {
    const total = parcelas.reduce((s, p) => s + p.valor, 0);
    if (total <= 0) return [];
    return parcelas.map(p => ({
      name: p.label,
      value: p.valor,
      pct: (p.valor / total) * 100,
    }));
  }, [parcelas]);

  const corMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of CUSTO_CAMPOS) m[c.label] = c.cor;
    return m;
  }, []);

  if (!cte) {
    return <>{children}</>;
  }

  const ctrcDisplay = cte.ctrc || (cte.serCte && cte.nroCte ? `${cte.serCte}${String(cte.nroCte).padStart(6, '0')}` : '');
  const temCusto = custoTotal > 0 || donutData.length > 0;

  return (
    <Dialog open={openProp} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-[min(92vw,960px)] max-h-[calc(100vh-80px)] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="flex items-center gap-2.5 text-base">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wide">{ctrcDisplay || 'CT-e'}</span>
                <span className="text-[11px] font-normal text-slate-400 dark:text-slate-500 -mt-0.5">
                  {cte.emTransito ? (
                    <span className="inline-flex items-center gap-1"><Truck className="w-3 h-3 text-blue-500" /> Em trânsito</span>
                  ) : (
                    <span className="inline-flex items-center gap-1"><Building2 className="w-3 h-3 text-emerald-500" /> No armazém</span>
                  )}
                </span>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-1.5 flex-wrap">
              {cte.indicadorSaida && (
                <Badge variant="outline" className="text-[11px] h-6 border-slate-200 dark:border-slate-700">
                  <IndicadorDot cor={cte.indicadorSaida} />
                  <span className="ml-1.5">Saída</span>
                </Badge>
              )}
              {(cte.atrasoTransf || cte.atrasoEntrega) && (
                <Badge variant="outline" className="text-[11px] h-6 border-slate-200 dark:border-slate-700">
                  <IndicadorDot cor={cte.atrasoTransf ?? cte.atrasoEntrega} />
                  <span className="ml-1.5">
                    {cte.atrasoEntrega ? 'Entrega' : 'Transferência'}
                    {cte.diasAtraso ? ` · ${cte.diasAtraso}d` : ''}
                  </span>
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5 pr-2">
          <Secao title="Identificação">
            <Campo label="CTRC" valor={ctrcDisplay} icon={FileText} mono />
            <Campo label="NF" valor={cte.nfiscal} mono />
            <Campo label="Pedido" valor={cte.pedido} mono />
            <Campo label="Manifesto" valor={cte.manifesto} icon={Truck} mono />
            {(cte.setor || cte.setorNome) && (
              <Campo
                label="Setor"
                valor={
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                    <span className="font-medium">
                      {cte.setor}{cte.setorNome && cte.setorNome !== cte.setor ? ` · ${cte.setorNome}` : ''}
                    </span>
                  </span>
                }
              />
            )}
            {cte.placaColeta && (
              <Campo label="Placa Coleta" valor={cte.placaColeta} icon={Car} mono />
            )}
          </Secao>

          <Secao title="Datas">
            <Campo label="Emissão" valor={cte.emissao} icon={CalendarDays} mono />
            <Campo label="Chegada Unid." valor={cte.chegadaUnid} mono />
            {cte.unidAtual && <Campo label="Unid. Atual" valor={cte.unidAtual} />}
            <Campo label="Prev. Entrega" valor={cte.prevEnt} mono />
            {cte.prevChegada && <Campo label="Prev. Chegada" valor={cte.prevChegada} mono />}
            {cte.agendamento && (
              <Campo
                label="Agendamento"
                valor={
                  <Badge className="bg-blue-100 dark:bg-blue-900/35 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] w-fit font-medium">
                    {cte.agendamento}
                  </Badge>
                }
              />
            )}
          </Secao>

          <Secao title="Envolvidos">
            <Campo label="Remetente" valor={cte.remetente} icon={Building2} />
            <Campo label="Pagador" valor={cte.pagador} icon={DollarSign} />
            <Campo label="Destinatário" valor={cte.destinatario} icon={Package} />
            {(cte.unidadeDest || cte.nomeDest) && (
              <Campo
                label="Unid. Destino"
                valor={
                  <span>
                    <strong className="font-semibold">{cte.unidadeDest}</strong>
                    {cte.nomeDest && cte.nomeDest !== cte.unidadeDest ? ` · ${cte.nomeDest}` : ''}
                  </span>
                }
              />
            )}
            <Campo
              label="Endereço"
              valor={
                <div className="space-y-0.5 leading-tight">
                  {cte.endereco && <div>{cte.endereco}</div>}
                  {(cte.cidade || cte.uf || cte.cep) && (
                    <div className="text-slate-500 dark:text-slate-400">
                      {[cte.bairro, [cte.cidade, cte.uf].filter(Boolean).join('/'), cte.cep].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              }
              icon={MapPin}
            />
            {cte.cnpjDest && <Campo label="CNPJ Dest." valor={cte.cnpjDest} mono />}
          </Secao>

          <Secao title="Valores e Medidas">
            <Campo
              label="Vlr. Mercadoria"
              valor={vlrMercNum > 0 ? <strong className="font-semibold">{fmtMoeda(vlrMercNum)}</strong> : undefined}
              icon={DollarSign}
              mono
            />
            <Campo
              label="Frete"
              valor={freteNum > 0 ? <strong className="font-semibold">{fmtMoeda(freteNum)}</strong> : undefined}
              mono
            />
            <Campo
              label="Custo Total"
              valor={temCusto ? <strong className="font-semibold text-indigo-600 dark:text-indigo-400">{fmtMoeda(custoTotal)}</strong> : undefined}
              mono
            />
            <Campo
              label="Peso (Real)"
              valor={pesoNum > 0 ? <strong className="font-medium">{fmtPeso(pesoNum)}</strong> : undefined}
              icon={Weight}
              mono
            />
            <Campo
              label="Peso de Cálculo"
              valor={pesoCalcNum > 0 ? <strong className="font-medium text-indigo-600 dark:text-indigo-400">{fmtPeso(pesoCalcNum)}</strong> : undefined}
              mono
            />
            <Campo label="Cubagem" valor={cubagemNum > 0 ? `${cubagemNum.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³` : undefined} mono />
            <Campo label="Volumes" valor={volNum > 0 ? fmtVol(volNum) : undefined} icon={Box} mono />
          </Secao>

          {temCusto && (
            <div className="space-y-2.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 pb-1">
                Composição do Custo
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 px-0.5">
                <div className="md:col-span-2 h-52 shrink-0">
                  {donutData.length > 0 && (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={78}
                          stroke="none"
                          paddingAngle={2}
                        >
                          {donutData.map((entry, i) => (
                            <Cell key={i} fill={corMap[entry.name] ?? `hsl(${(i * 37) % 360}, 70%, 55%)`} />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          contentStyle={tooltipStyle as any}
                          formatter={(value: any, name: any) => [fmtMoeda(Number(value)), String(name)]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="md:col-span-3 flex flex-col gap-1.5 justify-center">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {parcelas.map(p => {
                      const pct = custoTotal > 0 ? (p.valor / custoTotal) * 100 : 0;
                      return (
                        <div key={p.key} className="flex items-center justify-between gap-2 py-0.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-sm shrink-0"
                              style={{ backgroundColor: corMap[p.label] ?? '#64748b' }}
                            />
                            <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{p.label}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-[11px]">
                            <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500 w-10 text-right">{pct.toFixed(0)}%</span>
                            <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 text-right w-[72px]">{fmtMoeda(p.valor)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
                    <span className="font-mono tabular-nums font-bold text-sm text-indigo-600 dark:text-indigo-400">{fmtMoeda(custoTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(cte.codUltOcor || cte.descUltOcor) && (
            <Secao title="Última Ocorrência">
              <div className="col-span-2 md:col-span-3">
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <AlertCircle className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {cte.codUltOcor && <span className="font-mono mr-2">{cte.codUltOcor}</span>}
                      {cte.descUltOcor}
                    </div>
                    {cte.dataUltOcor && (
                      <div className="text-[11px] text-slate-400 dark:text-slate-500">Registrado em {cte.dataUltOcor}</div>
                    )}
                  </div>
                </div>
              </div>
            </Secao>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CteDetalhesDialog;
