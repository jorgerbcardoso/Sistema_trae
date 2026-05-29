import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { FilterSelectVeiculo } from './FilterSelectVeiculo';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { apiFetch } from '../../utils/apiUtils';
import { ENVIRONMENT } from '../../config/environment';
import { toast } from 'sonner';
import {
  Loader2,
  FileSpreadsheet,
  Truck,
  Package,
  PackageCheck,
  Weight,
  DollarSign,
  Percent,
  BarChart3,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Building2,
} from 'lucide-react';

interface Operacao {
  placa: string;
  tipo: string;
  tipoCodigo: string;
  dataBaixa: string;
  ctrc: string;
  nf: string;
  nomeRemetente: string;
  nomeExpedidor: string;
  nomeDestinatario: string;
  nomeRecebedor: string;
  cidadeEntrega: string;
  nomePagador: string;
  romaneio: string;
  pesoCalculo: number;
  qtVol: number;
  valMerc: number;
  vlrFrete: number;
  ctrbOs: number;
  percCtrb: number;
}

interface Totais {
  coletas: number;
  entregas: number;
  total: number;
  peso: number;
  frete: number;
  valMerc: number;
  ctrbOs: number;
  vol: number;
  percCtrb: number;
}

type SortField = keyof Operacao;
type SortDir = 'asc' | 'desc';

function formatMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNum(v: number, dec = 3) {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

function getDataPadrao() {
  const hoje = new Date();
  const primeiroDia = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const fmt = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  };
  return { ini: fmt(primeiroDia), fin: fmt(hoje) };
}

export function ColetaEntrega() {
  const { user, logout, clientConfig } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const unidadeAtual = user?.unidade_atual || user?.unidade || '';
  const isMTZ = unidadeAtual === 'MTZ';

  const datas = getDataPadrao();
  const [dataIni, setDataIni] = useState(datas.ini);
  const [dataFin, setDataFin] = useState(datas.fin);
  const [placa, setPlaca] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingExcel, setLoadingExcel] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [totais, setTotais] = useState<Totais | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [sortField, setSortField] = useState<SortField>('dataBaixa');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const operacoesOrdenadas = [...operacoes].sort((a, b) => {
    const va = a[sortField];
    const vb = b[sortField];
    if (typeof va === 'number' && typeof vb === 'number') {
      return sortDir === 'asc' ? va - vb : vb - va;
    }
    const sa = String(va ?? '').toLowerCase();
    const sb = String(vb ?? '').toLowerCase();
    return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
  });

  const handleGerar = async () => {
    if (!dataIni || !dataFin) {
      toast.error('Informe o período.');
      return;
    }

    setLoading(true);
    setElapsed(0);
    setHasSearched(false);
    setOperacoes([]);
    setTotais(null);

    const timer = setInterval(() => {
      setElapsed(e => e + 1);
    }, 1000);

    try {
      const res = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/coleta-entrega/get_coleta_entrega.php`,
        {
          method: 'POST',
          body: JSON.stringify({ data_ini: dataIni, data_fin: dataFin, placa }),
        },
        true
      );

      clearInterval(timer);
      setElapsed(0);

      if (res.success) {
        setOperacoes(res.operacoes ?? []);
        setTotais(res.totais ?? null);
        setHasSearched(true);
        if ((res.operacoes ?? []).length === 0) {
          toast.info('Nenhuma operação encontrada para o período.');
        }
      } else {
        toast.error(res.message || 'Erro ao gerar relatório.');
      }
    } catch (e: any) {
      clearInterval(timer);
      setElapsed(0);
      toast.error(e.message || 'Erro ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportarExcel = async () => {
    if (operacoes.length === 0) {
      toast.error('Não há dados para exportar.');
      return;
    }

    setLoadingExcel(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `${ENVIRONMENT.apiBaseUrl}/dashboards/coleta-entrega/exportar_excel.php`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            operacoes,
            totais,
            filters: { data_ini: dataIni, data_fin: dataFin, unidade: user?.unidade ?? '' },
          }),
        }
      );

      if (!response.ok) {
        const txt = await response.text();
        try {
          const j = JSON.parse(txt);
          throw new Error(j.message || 'Erro ao exportar');
        } catch {
          throw new Error('Erro ao exportar planilha');
        }
      }

      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `coleta_entrega_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Planilha Excel exportada com sucesso!');
    } catch (e: any) {
      toast.error(e.message || 'Erro ao exportar planilha.');
    } finally {
      setLoadingExcel(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 ml-1 text-blue-400" />
      : <ChevronDown className="h-3 w-3 ml-1 text-blue-400" />;
  };

  const ThHeader = ({ field, label, className = '' }: { field: SortField; label: string; className?: string }) => (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-white ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center">
        {label}
        <SortIcon field={field} />
      </span>
    </th>
  );

  return (
    <DashboardLayout
      user={user}
      logout={logout}
      theme={theme}
      toggleTheme={toggleTheme}
      navigate={navigate}
      clientConfig={clientConfig}
      title="COLETA E ENTREGA"
      subtitle="LEVANTAMENTO DE COLETAS E ENTREGAS DA UNIDADE"
    >
      <div className="space-y-6">

        {isMTZ ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-slate-500">
            <Building2 className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg font-medium">Acesso não disponível para a unidade MTZ</p>
            <p className="text-sm mt-1">Faça login em uma unidade específica para visualizar este painel.</p>
          </div>
        ) : (
        <>

        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2 text-base">
              <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Data Início</Label>
                <Input
                  type="text"
                  value={dataIni}
                  onChange={e => setDataIni(e.target.value)}
                  placeholder="DD/MM/AA"
                  maxLength={8}
                  className="dark:bg-slate-800 dark:border-slate-700 font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Data Fim</Label>
                <Input
                  type="text"
                  value={dataFin}
                  onChange={e => setDataFin(e.target.value)}
                  placeholder="DD/MM/AA"
                  maxLength={8}
                  className="dark:bg-slate-800 dark:border-slate-700 font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-600 dark:text-slate-400">Placa (opcional)</Label>
                <FilterSelectVeiculo
                  value={placa}
                  onChange={setPlaca}
                  placeholder="Todas as placas"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleGerar}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {loading ? (
                    <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {elapsed > 0 ? `Aguardando... ${elapsed}s` : 'Processando...'}
                  </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Gerar Relatório
                    </>
                  )}
                </Button>
                {hasSearched && (
                  <Button
                    onClick={handleExportarExcel}
                    disabled={loadingExcel || operacoes.length === 0}
                    variant="outline"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    {loadingExcel ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {loading && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                      Relatório enviado ao SSW. Aguardando processamento...
                    </p>
                    <div className="mt-2 bg-blue-200 dark:bg-blue-800 rounded-full h-2 overflow-hidden">
                      <div className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full animate-pulse w-full" />
                    </div>
                  </div>
                  <span className="text-lg font-mono font-bold text-blue-700 dark:text-blue-300 min-w-[3rem] text-right">
                    {elapsed}s
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {hasSearched && totais && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="dark:bg-slate-900/90 dark:border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                    <Package className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Coletas</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totais.coletas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-900/90 dark:border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <PackageCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Entregas</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totais.entregas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-900/90 dark:border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
                    <Truck className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totais.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-900/90 dark:border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Weight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Peso Total</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatNum(totais.peso)} kg</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-900/90 dark:border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                    <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Vlr Frete</p>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatMoeda(totais.frete)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="dark:bg-slate-900/90 dark:border-slate-700">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                    <Percent className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">% CTRB/Frete</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totais.percCtrb.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {hasSearched && (
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center justify-between text-base">
                <span className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Operações
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                    {operacoes.length} {operacoes.length === 1 ? 'registro' : 'registros'}
                  </span>
                  <Button
                    onClick={handleExportarExcel}
                    disabled={loadingExcel || operacoes.length === 0}
                    size="sm"
                    variant="outline"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                  >
                    {loadingExcel ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Exportando...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Exportar Excel
                      </>
                    )}
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {operacoes.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                  Nenhuma operação encontrada para o período informado.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800 dark:bg-slate-950">
                        <ThHeader field="dataBaixa" label="Data" />
                        <ThHeader field="tipoCodigo" label="Tipo" />
                        <ThHeader field="placa" label="Placa" />
                        <ThHeader field="ctrc" label="CTRC" />
                        <ThHeader field="nf" label="NF" />
                        <ThHeader field="nomeRemetente" label="Remetente" />
                        <ThHeader field="nomeDestinatario" label="Destinatário" />
                        <ThHeader field="cidadeEntrega" label="Cidade" />
                        <ThHeader field="nomePagador" label="Pagador" />
                        <ThHeader field="romaneio" label="Romaneio" />
                        <ThHeader field="pesoCalculo" label="Peso" className="text-right" />
                        <ThHeader field="qtVol" label="Vol" className="text-right" />
                        <ThHeader field="valMerc" label="Vlr Merc" className="text-right" />
                        <ThHeader field="vlrFrete" label="Vlr Frete" className="text-right" />
                        <ThHeader field="ctrbOs" label="CTRB/OS" className="text-right" />
                        <ThHeader field="percCtrb" label="% CTRB" className="text-right" />
                      </tr>
                    </thead>
                    <tbody>
                      {operacoesOrdenadas.map((op, idx) => (
                        <tr
                          key={idx}
                          className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
                            op.tipoCodigo === 'C'
                              ? 'bg-orange-50/60 dark:bg-orange-900/10'
                              : idx % 2 === 0
                              ? 'bg-white dark:bg-slate-900'
                              : 'bg-blue-50/40 dark:bg-blue-900/10'
                          }`}
                        >
                          <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {op.dataBaixa}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <Badge
                              className={`text-[10px] font-semibold ${
                                op.tipoCodigo === 'C'
                                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                              }`}
                              variant="outline"
                            >
                              {op.tipo}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 font-mono font-bold text-xs text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            {op.placa}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {op.ctrc}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {op.nf}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={op.nomeRemetente}>
                            {op.nomeRemetente}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-700 dark:text-slate-300 max-w-[160px] truncate" title={op.nomeDestinatario}>
                            {op.nomeDestinatario}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {op.cidadeEntrega}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400 max-w-[140px] truncate" title={op.nomePagador}>
                            {op.nomePagador}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {op.romaneio}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatNum(op.pesoCalculo)}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {op.qtVol}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatMoeda(op.valMerc)}
                          </td>
                          <td className="px-3 py-2 text-xs text-right font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatMoeda(op.vlrFrete)}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {op.ctrbOs > 0 ? formatMoeda(op.ctrbOs) : '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-right whitespace-nowrap">
                            {op.percCtrb > 0 ? (
                              <span className={`font-semibold ${op.percCtrb > 100 ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                {op.percCtrb.toFixed(1)}%
                              </span>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {totais && (
                      <tfoot>
                        <tr className="bg-slate-800 dark:bg-slate-950 font-semibold">
                          <td colSpan={10} className="px-3 py-2 text-xs text-slate-200 whitespace-nowrap">
                            TOTAL — {totais.total} operações ({totais.coletas} coletas / {totais.entregas} entregas)
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-200 whitespace-nowrap">
                            {formatNum(totais.peso)}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-200 whitespace-nowrap">
                            {totais.vol}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-200 whitespace-nowrap">
                            {formatMoeda(totais.valMerc)}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-emerald-300 whitespace-nowrap">
                            {formatMoeda(totais.frete)}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-200 whitespace-nowrap">
                            {totais.ctrbOs > 0 ? formatMoeda(totais.ctrbOs) : '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-right text-slate-200 whitespace-nowrap">
                            {totais.percCtrb > 0 ? `${totais.percCtrb.toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        </>
        )}
      </div>
    </DashboardLayout>
  );
}
