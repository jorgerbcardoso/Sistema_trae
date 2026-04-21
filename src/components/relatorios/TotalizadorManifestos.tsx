interface TotalizadorManifestosProps {
  qtdRegistros: number;
  totalFrete: number;
  totalCtrb: number;
  totalPeso: number;
  formatCurrency: (value: number) => string;
  formatPeso: (value: number) => string;
}

export function TotalizadorManifestos({
  qtdRegistros,
  totalFrete,
  totalCtrb,
  totalPeso,
  formatCurrency,
  formatPeso
}: TotalizadorManifestosProps) {
  return (
    <div className="mt-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-4 py-3">
      <div className="grid grid-cols-5 gap-4 items-center">
        <div className="col-span-1">
          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
            TOTAL ({qtdRegistros} {qtdRegistros === 1 ? 'registro' : 'registros'})
          </span>
        </div>
        <div className="col-span-1 text-right">
          <div className="text-xs text-slate-600 dark:text-slate-400">Total Frete</div>
          <div className="text-sm font-bold text-green-700 dark:text-green-400">
            {formatCurrency(totalFrete)}
          </div>
        </div>
        <div className="col-span-1 text-right">
          <div className="text-xs text-slate-600 dark:text-slate-400">Vlr. CTRB</div>
          <div className="text-sm font-bold text-blue-700 dark:text-blue-400">
            {formatCurrency(totalCtrb)}
          </div>
        </div>
        <div className="col-span-1 text-right">
          <div className="text-xs text-slate-600 dark:text-slate-400">Peso (Kg)</div>
          <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {formatPeso(totalPeso)}
          </div>
        </div>
      </div>
    </div>
  );
}
