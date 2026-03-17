import React, { useState } from 'react';
import { Filter, X, Check, Calendar } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Label } from '../ui/label';

export interface MonthYearPeriod {
  mes: number;
  ano: number;
}

interface MonthYearFilterProps {
  currentPeriod: MonthYearPeriod;
  onPeriodChange: (period: MonthYearPeriod) => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro', short: 'Jan' },
  { value: 2, label: 'Fevereiro', short: 'Fev' },
  { value: 3, label: 'Março', short: 'Mar' },
  { value: 4, label: 'Abril', short: 'Abr' },
  { value: 5, label: 'Maio', short: 'Mai' },
  { value: 6, label: 'Junho', short: 'Jun' },
  { value: 7, label: 'Julho', short: 'Jul' },
  { value: 8, label: 'Agosto', short: 'Ago' },
  { value: 9, label: 'Setembro', short: 'Set' },
  { value: 10, label: 'Outubro', short: 'Out' },
  { value: 11, label: 'Novembro', short: 'Nov' },
  { value: 12, label: 'Dezembro', short: 'Dez' },
];

const MIN_YEAR = 2020;
const YEARS = Array.from({ length: 10 }, (_, i) => MIN_YEAR + i);

/**
 * Formatar período no formato "Jan 2026"
 */
export function formatMonthYearPeriod(period: MonthYearPeriod): string {
  const month = MONTHS.find(m => m.value === period.mes);
  return `${month?.short || 'Jan'} ${period.ano}`;
}

export function MonthYearFilter({ currentPeriod, onPeriodChange }: MonthYearFilterProps) {
  const [open, setOpen] = useState(false);
  const [tempPeriod, setTempPeriod] = useState<MonthYearPeriod>(currentPeriod);

  const handleApply = () => {
    // Validação básica
    if (tempPeriod.mes < 1 || tempPeriod.mes > 12) {
      alert('Mês inválido. Deve ser entre 1 e 12.');
      return;
    }

    if (tempPeriod.ano < MIN_YEAR) {
      alert(`O ano não pode ser anterior a ${MIN_YEAR}`);
      return;
    }

    onPeriodChange(tempPeriod);
    setOpen(false);
  };

  const handleCancel = () => {
    setTempPeriod(currentPeriod);
    setOpen(false);
  };

  const handleQuickSelect = (type: 'current-month' | 'last-month' | 'current-year-jan') => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    let newPeriod: MonthYearPeriod;

    switch (type) {
      case 'current-month':
        newPeriod = {
          mes: currentMonth,
          ano: currentYear,
        };
        break;
      
      case 'last-month':
        const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        newPeriod = {
          mes: lastMonth,
          ano: lastMonthYear,
        };
        break;
      
      case 'current-year-jan':
        newPeriod = {
          mes: 1,
          ano: currentYear,
        };
        break;
    }

    setTempPeriod(newPeriod);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
        >
          <Filter className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-100">Filtrar Mês de Referência</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            Selecione o mês e ano de referência para o relatório
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Atalhos Rápidos */}
          <div>
            <Label className="text-slate-900 dark:text-slate-100 mb-2 block">Atalhos</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('current-month')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Mês Atual
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('last-month')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Mês Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('current-year-jan')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Janeiro
              </Button>
            </div>
          </div>

          {/* Seleção Manual */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <Label className="text-slate-900 dark:text-slate-100 mb-3 block">Mês de Referência Personalizado</Label>
            
            <div className="grid grid-cols-2 gap-4">
              {/* Mês */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-600 dark:text-slate-400">Mês</Label>
                <select
                  value={tempPeriod.mes}
                  onChange={(e) => setTempPeriod({ ...tempPeriod, mes: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {MONTHS.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ano */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-600 dark:text-slate-400">Ano</Label>
                <select
                  value={tempPeriod.ano}
                  onChange={(e) => setTempPeriod({ ...tempPeriod, ano: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {YEARS.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              Aplicar Filtro
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}