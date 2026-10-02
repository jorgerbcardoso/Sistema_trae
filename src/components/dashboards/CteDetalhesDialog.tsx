import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Package, Truck, Building2, MapPin, Weight, Box, CalendarDays, DollarSign, FileText, Car, AlertCircle } from 'lucide-react';
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
  cidadeEntrega?: string;
  unidadeEntrega?: string;
  cepEntrega?: string;
  enderecoEntrega?: string;
  bairroEntrega?: string;
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
  return <span className={`w-2 h-2 rounded-full inline-block ${cls}`} title={title} />;
}

function Campo({ label, valor, icon: Icon, mono, highlight }: { label: string; valor?: React.ReactNode; icon?: any; mono?: boolean; highlight?: boolean }) {
  const vazio = valor === undefined || valor === null || valor === '' || (typeof valor === 'string' && valor.trim() === '');
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 flex items-center gap-1">
        {Icon && <Icon className="w-2.5 h-2.5" />}
        {label}
      </span>
      {vazio ? (
        <span className="text-xs text-slate-300 dark:text-slate-600">-</span>
      ) : (
        <span
          className={`text-xs truncate ${mono ? 'font-mono tabular-nums' : ''} ${
            highlight ? 'font-semibold text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
          }`}
        >
          {valor}
        </span>
      )}
    </div>
  );
}

function Secao({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        <span className="w-1 h-3 bg-indigo-500/70 rounded-full" />
        {title}
      </h4>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 pl-2.5 border-l border-slate-200 dark:border-slate-700/70">
        {children}
      </div>
    </div>
  );
}

function SecaoRecolhivel({
  value,
  title,
  barClass = 'bg-indigo-500/70',
  preview,
  children,
  contentClassName,
}: {
  value: string;
  title: string;
  barClass?: string;
  preview: React.ReactNode;
  children: React.ReactNode;
  contentClassName?: string;
}) {
  return (
    <AccordionItem value={value} className="border-0">
      <AccordionTrigger className="py-0.5 hover:no-underline text-[10.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className={`w-1 h-3 rounded-full ${barClass}`} />
          {title}
        </span>
      </AccordionTrigger>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 pl-2.5 border-l border-slate-200 dark:border-slate-700/70 mt-1">
        {preview}
      </div>
      <AccordionContent className={contentClassName}>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 pl-2.5 border-l border-slate-200 dark:border-slate-700/70 mt-2">
          {children}
        </div>
      </AccordionContent>
    </AccordionItem>
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
  const temEntrega = Boolean(
    String(cte.cidadeEntrega ?? '').trim()
    || String(cte.unidadeEntrega ?? '').trim()
    || String(cte.cepEntrega ?? '').trim()
    || String(cte.enderecoEntrega ?? '').trim()
    || String(cte.bairroEntrega ?? '').trim()
  );
  const lucroNum = freteNum > 0 ? (freteNum - custoTotal) : 0;
  const lucroPctNum = freteNum > 0 ? ((lucroNum / freteNum) * 100) : null;
  const lucroPctTxt = lucroPctNum === null ? '' : `${lucroPctNum.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  const lucroOk = freteNum > 0 ? (lucroNum >= 0) : null;

  const [accordionValue, setAccordionValue] = useState<string[]>(() => (temCusto ? ['custo'] : []));
  useEffect(() => {
    setAccordionValue(temCusto ? ['custo'] : []);
  }, [ctrcDisplay, temCusto, temEntrega]);

  return (
    <Dialog open={openProp} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="!w-[92vw] !max-w-[650px] !max-h-[80vh] h-[80vh] overflow-hidden flex flex-col !p-0 gap-0">
        <DialogHeader className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <DialogTitle className="flex items-center gap-2 text-sm">
              <div className="w-7 h-7 rounded-md bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <div className="flex flex-col">
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100 tracking-wide">{ctrcDisplay || 'CT-e'}</span>
              </div>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {(cte.setor || cte.setorNome) && (
                <Badge className="bg-emerald-100 dark:bg-emerald-900/35 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10.5px] h-6 font-medium">
                  <MapPin className="w-2.5 h-2.5 mr-1" />
                  {cte.setor}{cte.setorNome && cte.setorNome !== cte.setor ? ` · ${cte.setorNome}` : ''}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3 pr-1">
          <Secao title="Identificação">
            <Campo label="CTRC" valor={ctrcDisplay} icon={FileText} mono />
            <Campo label="NF" valor={cte.nfiscal} mono />
            {cte.placaColeta && <Campo label="Placa Coleta" valor={cte.placaColeta} icon={Car} mono />}
            {(cte.unidadeOrigem) && <Campo label="Unid. Origem" valor={cte.unidadeOrigem} />}
          </Secao>

          <Accordion type="multiple" value={accordionValue} onValueChange={setAccordionValue} className="space-y-3">
            <SecaoRecolhivel
              value="datas"
              title="Datas"
              contentClassName="pt-1 pb-0"
              preview={
                <>
                  <Campo label="Emissão" valor={cte.emissao} icon={CalendarDays} mono />
                  <Campo label="Prev. Entrega" valor={cte.prevEnt} mono />
                </>
              }
            >
              <Campo label="Chegada Unid." valor={cte.chegadaUnid} mono />
              {cte.prevChegada && <Campo label="Prev. Chegada" valor={cte.prevChegada} mono />}
              {cte.agendamento && (
                <Campo
                  label="Agendamento"
                  valor={
                    <Badge className="bg-blue-100 dark:bg-blue-900/35 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[10.5px] w-fit font-medium">
                      {cte.agendamento}
                    </Badge>
                  }
                />
              )}
            </SecaoRecolhivel>

            <SecaoRecolhivel
              value="clientes"
              title="Clientes"
              contentClassName="pt-1 pb-0"
              preview={
                <>
                  <Campo label="Destinatário" valor={cte.destinatario} icon={Package} />
                  <Campo label="Pagador" valor={cte.pagador} icon={DollarSign} />
                </>
              }
            >
              <Campo label="Remetente" valor={cte.remetente} icon={Building2} />
              {cte.cnpjDest && <Campo label="CNPJ Dest." valor={cte.cnpjDest} mono />}
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
                label="Cidade"
                valor={[cte.bairro, [cte.cidade, cte.uf].filter(Boolean).join('/'), cte.cep].filter(Boolean).join(' · ')}
                icon={MapPin}
              />
            </SecaoRecolhivel>

            <SecaoRecolhivel
              value="valores"
              title="Valores e Medidas"
              contentClassName="pt-1 pb-0"
              preview={
                <>
                  <Campo label="Frete" valor={freteNum > 0 ? <span className="font-semibold">{fmtMoeda(freteNum)}</span> : undefined} mono />
                  <Campo label="Custo Total" valor={temCusto ? fmtMoeda(custoTotal) : undefined} mono highlight />
                </>
              }
            >
              <Campo
                label="Vlr. Mercadoria"
                valor={vlrMercNum > 0 ? <span className="font-semibold">{fmtMoeda(vlrMercNum)}</span> : undefined}
                icon={DollarSign}
                mono
              />
              <Campo
                label="Peso (Real)"
                valor={pesoNum > 0 ? <span className="font-medium">{fmtPeso(pesoNum)}</span> : undefined}
                icon={Weight}
                mono
              />
              <Campo
                label="Peso de Cálculo"
                valor={pesoCalcNum > 0 ? fmtPeso(pesoCalcNum) : undefined}
                mono
                highlight
              />
              <Campo label="Cubagem" valor={cubagemNum > 0 ? `${cubagemNum.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³` : undefined} mono />
              <Campo label="Volumes" valor={volNum > 0 ? fmtVol(volNum) : undefined} icon={Box} mono />
            </SecaoRecolhivel>

            {temEntrega && (
              <SecaoRecolhivel
                value="entrega"
                title="Entrega"
                barClass="bg-sky-500/70"
                contentClassName="pt-1 pb-0"
                preview={
                  <>
                    <Campo label="Cidade" valor={cte.cidadeEntrega} icon={MapPin} />
                    <Campo label="Unidade" valor={cte.unidadeEntrega} />
                  </>
                }
              >
                <Campo label="CEP" valor={cte.cepEntrega} mono />
                <Campo label="Bairro" valor={cte.bairroEntrega} />
                <div className="col-span-2">
                  <Campo label="Endereço" valor={cte.enderecoEntrega} icon={MapPin} />
                </div>
              </SecaoRecolhivel>
            )}

            {temCusto && (
              <SecaoRecolhivel
                value="custo"
                title="Composição do Custo"
                barClass="bg-pink-500/70"
                contentClassName="pt-1 pb-0"
                preview={
                  <>
                    <Campo label="Total" valor={fmtMoeda(custoTotal)} mono highlight />
                    <Campo
                      label="Resultado"
                      valor={
                        freteNum > 0 ? (
                          <Badge
                            className={`text-[10.5px] h-6 font-medium border ${
                              lucroOk === null
                                ? 'bg-slate-100 dark:bg-slate-900/35 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                                : lucroOk
                                  ? 'bg-emerald-100 dark:bg-emerald-900/35 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : 'bg-rose-100 dark:bg-rose-900/35 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {fmtMoeda(lucroNum)} · {lucroPctTxt}
                          </Badge>
                        ) : undefined
                      }
                    />
                  </>
                }
              >
                <div className="col-span-2 grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col gap-0.5">
                      {parcelas.map(p => {
                        const pct = custoTotal > 0 ? (p.valor / custoTotal) * 100 : 0;
                        return (
                          <div key={p.key} className="flex items-center justify-between gap-2 py-0.5 border-b border-slate-100 dark:border-slate-800/60 last:border-b-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: corMap[p.label] ?? '#64748b' }} />
                              <span className="text-[10.5px] text-slate-600 dark:text-slate-400 truncate">{p.label}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 text-[10.5px]">
                              <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500 w-8 text-right">{pct.toFixed(0)}%</span>
                              <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300 text-right w-[58px]">{fmtMoeda(p.valor)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="pt-1 mt-0.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
                      <span className="font-mono tabular-nums font-bold text-[11px] text-indigo-600 dark:text-indigo-400">{fmtMoeda(custoTotal)}</span>
                    </div>
                  </div>
                  <div className="h-44 shrink-0">
                    {donutData.length > 0 && (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={donutData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={34}
                            outerRadius={60}
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
                </div>
              </SecaoRecolhivel>
            )}
          </Accordion>

          {(cte.codUltOcor || cte.descUltOcor) && (
            <Secao title="Última Ocorrência">
              <div className="col-span-2">
                <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  <AlertCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {cte.codUltOcor && <span className="font-mono mr-1.5">{cte.codUltOcor}</span>}
                      {cte.descUltOcor}
                    </div>
                    {cte.dataUltOcor && (
                      <div className="text-[10.5px] text-slate-400 dark:text-slate-500">Registrado em {cte.dataUltOcor}</div>
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
