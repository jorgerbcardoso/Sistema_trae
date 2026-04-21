import { Button } from '../ui/button';
import { ArrowUpDown } from 'lucide-react';
import type { Manifesto } from '../../services/conferenciaSaidasService';

type SortField = keyof Manifesto;
type SortDirection = 'asc' | 'desc';

export interface ManifestoGroup {
  key: string;
  codigoCtrb: string;
  displayCtrb: string;
  valorCtrb: number;
  valorPedagio: number;
  totalFrete: number;
  totalPeso: number;
  percentualCtrb: number;
  qtdManifestos: number;
  manifestos: Manifesto[];
}

interface ManifestosTableProps {
  groups: ManifestoGroup[];
  sortField: SortField;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  formatCurrency: (value: number) => string;
  formatPeso: (value: number) => string;
}

export function ManifestosTable({
  groups,
  sortField,
  sortDirection,
  onToggleSort,
  formatCurrency,
  formatPeso,
}: ManifestosTableProps) {
  const totalFrete = groups.reduce((sum, group) => sum + group.totalFrete, 0);
  const totalPeso = groups.reduce((sum, group) => sum + group.totalPeso, 0);
  const qtdRegistros = groups.reduce((sum, group) => sum + group.qtdManifestos, 0);

  const formatPercent = (value: number) =>
    `${new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }).format(value)}%`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Grupos CTRB
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{groups.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/70">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Manifestos
          </div>
          <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{qtdRegistros}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Total Frete
          </div>
          <div className="mt-1 text-xl font-bold text-emerald-800 dark:text-emerald-300">
            {formatCurrency(totalFrete)}
          </div>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 shadow-sm dark:border-sky-900/60 dark:bg-sky-950/30">
          <div className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
            Peso Total
          </div>
          <div className="mt-1 text-xl font-bold text-sky-800 dark:text-sky-300">{formatPeso(totalPeso)}</div>
        </div>
      </div>

      {groups.map((group) => (
        <div
          key={group.key}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900/80"
        >
          <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-sky-50/80 to-slate-50 px-4 py-4 dark:border-slate-700 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">
                    Grupo CTRB
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    <div className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100">
                      {group.displayCtrb}
                    </div>
                    <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {group.qtdManifestos} {group.qtdManifestos === 1 ? 'manifesto' : 'manifestos'}
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    Frete acumulado do grupo: <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(group.totalFrete)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/60 dark:bg-blue-950/30">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
                      Vlr. CTRB
                    </div>
                    <div className="mt-1 text-base font-bold text-blue-800 dark:text-blue-300">
                      {formatCurrency(group.valorCtrb)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/60 dark:bg-amber-950/30">
                    <div className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                      Pedagio
                    </div>
                    <div className="mt-1 text-base font-bold text-amber-800 dark:text-amber-300">
                      {formatCurrency(group.valorPedagio)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 dark:border-violet-900/60 dark:bg-violet-950/30">
                    <div className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-400">
                      CTRB/Frete
                    </div>
                    <div className="mt-1 text-base font-bold text-violet-800 dark:text-violet-300">
                      {formatPercent(group.percentualCtrb)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_auto] xl:items-center">
                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                    <span>Participacao do CTRB sobre o frete do grupo</span>
                    <span>{formatPercent(group.percentualCtrb)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-blue-500"
                      style={{ width: `${Math.min(group.percentualCtrb, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Peso do grupo
                  </div>
                  <div className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">
                    {formatPeso(group.totalPeso)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 dark:bg-slate-800/70">
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSort('numero')}
                      className="mx-auto flex items-center"
                    >
                      Manifesto
                      {sortField === 'numero' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSort('siglaDestino')}
                      className="mx-auto flex items-center"
                    >
                      Destino
                      {sortField === 'siglaDestino' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSort('placa')}
                      className="mx-auto flex items-center"
                    >
                      Placa
                      {sortField === 'placa' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSort('totalFrete')}
                      className="ml-auto flex items-center"
                    >
                      Total Frete
                      {sortField === 'totalFrete' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSort('pesoTotal')}
                      className="ml-auto flex items-center"
                    >
                      Peso (Kg)
                      {sortField === 'pesoTotal' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSort('dataEmissao')}
                      className="mx-auto flex items-center"
                    >
                      Emissao
                      {sortField === 'dataEmissao' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onToggleSort('horarioSaida')}
                      className="mx-auto flex items-center"
                    >
                      Saida
                      {sortField === 'horarioSaida' && <ArrowUpDown className="ml-2 h-4 w-4" />}
                    </Button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.manifestos.map((manifesto) => (
                  <tr
                    key={manifesto.id}
                    className="border-b border-slate-100 transition-colors odd:bg-white even:bg-slate-50/60 hover:bg-sky-50/70 dark:border-slate-800 dark:odd:bg-slate-900/20 dark:even:bg-slate-800/30 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3 text-center font-mono text-sm text-slate-900 dark:text-slate-100">
                      {manifesto.numero}
                    </td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {manifesto.siglaDestino}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-slate-700 dark:text-slate-300">
                      {manifesto.placa}
                      {manifesto.placaCarreta && (
                        <span className="text-slate-500 dark:text-slate-500"> + {manifesto.placaCarreta}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(manifesto.totalFrete)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">
                      {formatPeso(manifesto.pesoTotal)}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-slate-700 dark:text-slate-300">
                      {manifesto.dataEmissao || '-'}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-sm text-slate-700 dark:text-slate-300">
                      {manifesto.horarioSaida || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-semibold dark:bg-slate-800/90">
                  <td
                    colSpan={3}
                    className="px-4 py-3 text-center text-sm text-slate-900 dark:text-slate-100"
                  >
                    Subtotal ({group.qtdManifestos}{' '}
                    {group.qtdManifestos === 1 ? 'manifesto' : 'manifestos'})
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(group.totalFrete)}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-900 dark:text-slate-100">
                    {formatPeso(group.totalPeso)}
                  </td>
                  <td
                    colSpan={2}
                    className="px-4 py-3 text-right text-sm text-violet-700 dark:text-violet-400"
                  >
                    CTRB representa {formatPercent(group.percentualCtrb)} do frete
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
