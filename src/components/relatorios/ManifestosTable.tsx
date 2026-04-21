import { Button } from '../ui/button';
import { ArrowUpDown } from 'lucide-react';
import type { Manifesto } from '../../services/conferenciaSaidasService';

type SortField = keyof Manifesto;
type SortDirection = 'asc' | 'desc';

interface ManifestosTableProps {
  manifestos: Manifesto[];
  sortField: SortField;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
  formatCurrency: (value: number) => string;
  formatPeso: (value: number) => string;
  // ✅ NOVOS PROPS: totalizadores
  totalFrete?: number;
  totalCtrb?: number;
  totalPedagio?: number;
  totalPeso?: number;
  qtdRegistros?: number;
}

export function ManifestosTable({
  manifestos,
  sortField,
  sortDirection,
  onToggleSort,
  formatCurrency,
  formatPeso,
  totalFrete,
  totalCtrb,
  totalPedagio,
  totalPeso,
  qtdRegistros
}: ManifestosTableProps) {
  return (
    <div className="overflow-x-auto max-h-[calc(10*3rem)] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-md">
      <table className="w-full">
        <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
          <tr className="border-b-2 border-slate-200 dark:border-slate-700">
            {/* ✅ CENTRALIZADO: Manifesto */}
            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('numero')}
                className="flex items-center mx-auto"
              >
                Manifesto
                {sortField === 'numero' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
            {/* ✅ CENTRALIZADO: Destino */}
            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('siglaDestino')}
                className="flex items-center mx-auto"
              >
                Destino
                {sortField === 'siglaDestino' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
            {/* ✅ CENTRALIZADO: Placa */}
            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('placa')}
                className="flex items-center mx-auto"
              >
                Placa
                {sortField === 'placa' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
            {/* ✅ ALINHADO À DIREITA: Total Frete */}
            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('totalFrete')}
                className="flex items-center ml-auto"
              >
                Total Frete
                {sortField === 'totalFrete' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
            {/* ✅ NOVO: CTRB (código) após Total Frete */}
            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('codigoCtrb')}
                className="flex items-center mx-auto"
              >
                CTRB
                {sortField === 'codigoCtrb' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
            {/* ✅ ALINHADO À DIREITA: Vlr. CTRB (antigo CTRB) */}
            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('ctrb')}
                className="flex items-center ml-auto"
              >
                Vlr. CTRB
                {sortField === 'ctrb' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
            {/* ✅ ALINHADO À DIREITA: Peso (Kg) */}
            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('pesoTotal')}
                className="flex items-center ml-auto"
              >
                Peso (Kg)
                {sortField === 'pesoTotal' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
            {/* ✅ ORDENÁVEL: Emissão (dataEmissao) */}
            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('dataEmissao')}
                className="flex items-center mx-auto"
              >
                Emissão
                {sortField === 'dataEmissao' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
            {/* ✅ ORDENÁVEL: Saída */}
            <th className="px-4 py-3 text-center text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onToggleSort('horarioSaida')}
                className="flex items-center mx-auto"
              >
                Saída
                {sortField === 'horarioSaida' && (
                  <ArrowUpDown className="w-4 h-4 ml-2" />
                )}
              </Button>
            </th>
          </tr>
        </thead>
        <tbody>
          {manifestos.map((manifesto) => (
            <tr
              key={manifesto.id}
              className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              {/* ✅ CENTRALIZADO: Manifesto */}
              <td className="px-4 py-3 text-sm font-mono text-center text-slate-900 dark:text-slate-100">
                {manifesto.numero}
              </td>
              {/* ✅ CENTRALIZADO: Destino */}
              <td className="px-4 py-3 text-sm font-semibold text-center text-slate-900 dark:text-slate-100">
                {manifesto.siglaDestino}
              </td>
              {/* ✅ CENTRALIZADO: Placa */}
              <td className="px-4 py-3 text-sm font-mono text-center text-slate-700 dark:text-slate-300">
                {manifesto.placa}
                {manifesto.placaCarreta && (
                  <span className="text-slate-500 dark:text-slate-500"> + {manifesto.placaCarreta}</span>
                )}
              </td>
              {/* ✅ ALINHADO À DIREITA: Total Frete */}
              <td className="px-4 py-3 text-sm text-right font-medium text-green-700 dark:text-green-400">
                {formatCurrency(manifesto.totalFrete)}
              </td>
              {/* ✅ NOVO: CTRB (código) após Total Frete */}
              <td className="px-4 py-3 text-sm font-mono text-center text-slate-700 dark:text-slate-300">
                {manifesto.codigoCtrb || '-'}
              </td>
              {/* ✅ ALINHADO À DIREITA: Vlr. CTRB (antigo CTRB) */}
              <td className="px-4 py-3 text-sm text-right text-blue-700 dark:text-blue-400">
                {formatCurrency(manifesto.ctrb)}
              </td>
              {/* ✅ ALINHADO À DIREITA: Peso (Kg) */}
              <td className="px-4 py-3 text-sm text-right text-slate-700 dark:text-slate-300">
                {formatPeso(manifesto.pesoTotal)}
              </td>
              <td className="px-4 py-3 text-sm text-center font-mono text-slate-700 dark:text-slate-300">
                {manifesto.dataEmissao || '-'}
              </td>
              <td className="px-4 py-3 text-sm text-center font-mono text-slate-700 dark:text-slate-300">
                {manifesto.horarioSaida || '-'}
              </td>
            </tr>
          ))}
          
          {/* ✅ LINHA DE TOTALIZAÇÃO (último registro fixo) */}
          {qtdRegistros !== undefined && (
            <tr className="border-t-2 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 font-bold sticky bottom-0">
              <td className="px-4 py-3 text-sm text-center text-slate-900 dark:text-slate-100" colSpan={3}>
                TOTAL ({qtdRegistros} {qtdRegistros === 1 ? 'registro' : 'registros'})
              </td>
              <td className="px-4 py-3 text-sm text-right text-green-700 dark:text-green-400">
                {formatCurrency(totalFrete || 0)}
              </td>
              <td className="px-4 py-3 text-sm text-center text-slate-900 dark:text-slate-100">
                {/* Espaço reservado para CTRB (código) - não tem total */}
              </td>
              <td className="px-4 py-3 text-sm text-right text-blue-700 dark:text-blue-400">
                {formatCurrency(totalCtrb || 0)}
              </td>
              <td className="px-4 py-3 text-sm text-right text-slate-900 dark:text-slate-100">
                {formatPeso(totalPeso || 0)}
              </td>
              <td className="px-4 py-3" colSpan={2}></td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}