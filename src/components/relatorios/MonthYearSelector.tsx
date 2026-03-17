import { Filter } from 'lucide-react';
import { MonthYearFilter, formatMonthYearPeriod, type MonthYearPeriod } from './MonthYearFilter';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface MonthYearSelectorProps {
  value: MonthYearPeriod;
  onChange: (period: MonthYearPeriod) => void;
}

/**
 * Componente visual elegante para seleção de mês/ano
 * Similar ao filtro de período do Dashboard Financeiro
 */
export function MonthYearSelector({ value, onChange }: MonthYearSelectorProps) {
  return (
    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
      <div className="text-right">
        <p className="text-slate-500 dark:text-slate-400 text-xs">Mês de Referência</p>
        <p className="text-slate-900 dark:text-slate-100 text-sm font-medium">
          {formatMonthYearPeriod(value)}
        </p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <MonthYearFilter 
                currentPeriod={value}
                onPeriodChange={onChange}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>Alterar Mês de Referência</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}