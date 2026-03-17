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

export interface PeriodRange {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}

interface PeriodFilterProps {
  currentPeriod: PeriodRange;
  onPeriodChange: (period: PeriodRange) => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

// LIMITE MÍNIMO: 01/01/2025
const MIN_YEAR = 2025;
const MIN_MONTH = 1;

// Array de anos a partir de 2025
const YEARS = Array.from({ length: 10 }, (_, i) => MIN_YEAR + i);

export function PeriodFilter({ currentPeriod, onPeriodChange }: PeriodFilterProps) {
  const [open, setOpen] = useState(false);
  const [tempPeriod, setTempPeriod] = useState<PeriodRange>(currentPeriod);

  const handleApply = () => {
    // Validar data mínima (01/01/2025)
    const minDate = new Date(MIN_YEAR, MIN_MONTH - 1);
    const startDate = new Date(tempPeriod.startYear, tempPeriod.startMonth - 1);
    const endDate = new Date(tempPeriod.endYear, tempPeriod.endMonth - 1);

    if (startDate < minDate) {
      alert(`A data inicial não pode ser anterior a Janeiro de ${MIN_YEAR}`);
      return;
    }

    if (endDate < startDate) {
      alert('A data final não pode ser anterior à data inicial');
      return;
    }

    onPeriodChange(tempPeriod);
    setOpen(false);
  };

  const handleCancel = () => {
    setTempPeriod(currentPeriod);
    setOpen(false);
  };

  const handleQuickSelect = (type: 'current-year' | 'last-year' | 'last-12-months' | 'current-quarter' | 'last-quarter') => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    let newPeriod: PeriodRange;

    switch (type) {
      case 'current-year':
        newPeriod = {
          startMonth: 1,
          startYear: currentYear,
          endMonth: currentMonth,
          endYear: currentYear,
        };
        break;
      
      case 'last-year':
        newPeriod = {
          startMonth: 1,
          startYear: currentYear - 1,
          endMonth: 12,
          endYear: currentYear - 1,
        };
        break;
      
      case 'last-12-months':
        const lastYear = new Date(now.getFullYear(), now.getMonth() - 11);
        newPeriod = {
          startMonth: lastYear.getMonth() + 1,
          startYear: lastYear.getFullYear(),
          endMonth: currentMonth,
          endYear: currentYear,
        };
        break;
      
      case 'current-quarter':
        const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
        newPeriod = {
          startMonth: quarterStart,
          startYear: currentYear,
          endMonth: currentMonth,
          endYear: currentYear,
        };
        break;
      
      case 'last-quarter':
        const lastQuarterEnd = Math.floor((currentMonth - 1) / 3) * 3;
        const lastQuarterStart = lastQuarterEnd - 2;
        const lastQuarterYear = lastQuarterStart < 1 ? currentYear - 1 : currentYear;
        newPeriod = {
          startMonth: lastQuarterStart < 1 ? 12 + lastQuarterStart : lastQuarterStart,
          startYear: lastQuarterYear,
          endMonth: lastQuarterEnd === 0 ? 12 : lastQuarterEnd,
          endYear: lastQuarterEnd === 0 ? currentYear - 1 : currentYear,
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
      <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-100">Filtrar Período</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            Selecione o período que deseja visualizar no dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Atalhos Rápidos */}
          <div>
            <Label className="text-slate-900 dark:text-slate-100 mb-2 block">Atalhos</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('current-year')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Ano Atual
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('last-year')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Ano Passado
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('last-12-months')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Últimos 12 Meses
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('current-quarter')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Trimestre Atual
              </Button>
            </div>
          </div>

          {/* Seleção Manual */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <Label className="text-slate-900 dark:text-slate-100 mb-3 block">Período Personalizado</Label>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Data Inicial */}
              <div className="space-y-3">
                <Label className="text-sm text-slate-600 dark:text-slate-400">Data Inicial</Label>
                <div className="space-y-2">
                  <select
                    value={tempPeriod.startMonth}
                    onChange={(e) => setTempPeriod({ ...tempPeriod, startMonth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={tempPeriod.startYear}
                    onChange={(e) => setTempPeriod({ ...tempPeriod, startYear: parseInt(e.target.value) })}
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

              {/* Data Final */}
              <div className="space-y-3">
                <Label className="text-sm text-slate-600 dark:text-slate-400">Data Final</Label>
                <div className="space-y-2">
                  <select
                    value={tempPeriod.endMonth}
                    onChange={(e) => setTempPeriod({ ...tempPeriod, endMonth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={tempPeriod.endYear}
                    onChange={(e) => setTempPeriod({ ...tempPeriod, endYear: parseInt(e.target.value) })}
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