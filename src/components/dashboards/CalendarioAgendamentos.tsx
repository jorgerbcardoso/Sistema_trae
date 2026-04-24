import React from 'react';
import { Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';

export interface DiaAgendamento {
  data: string;
  dia: string;
  mes: string;
  mesNome: string;
  diaSemana: string;
  agendados: number;
  entregues: number;
}

interface CalendarioAgendamentosProps {
  periodo: 7 | 15 | 30;
  setPeriodo: (periodo: 7 | 15 | 30) => void;
  diasData: DiaAgendamento[];
  loading: boolean;
}

export function CalendarioAgendamentos({
  periodo,
  setPeriodo,
  diasData,
  loading,
}: CalendarioAgendamentosProps) {
  return (
    <Card className="dark:bg-slate-900 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="dark:text-slate-100 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Calendário de Agendamentos
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              CT-es com ocorrência 15 — agendados por data de previsão de entrega
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={periodo === 7 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodo(7)}
              className={periodo === 7 ? 'bg-indigo-600 hover:bg-indigo-700' : 'dark:border-slate-600'}
            >
              7 dias
            </Button>
            <Button
              variant={periodo === 15 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodo(15)}
              className={periodo === 15 ? 'bg-indigo-600 hover:bg-indigo-700' : 'dark:border-slate-600'}
            >
              15 dias
            </Button>
            <Button
              variant={periodo === 30 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodo(30)}
              className={periodo === 30 ? 'bg-indigo-600 hover:bg-indigo-700' : 'dark:border-slate-600'}
            >
              30 dias
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {diasData.map((dia, index) => {
              const performance = dia.agendados > 0
                ? (dia.entregues / dia.agendados) * 100
                : 0;

              const isToday = dia.data === new Date().toISOString().slice(0, 10);

              const bgColor = dia.agendados === 0
                ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                : performance >= 90
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                : performance >= 70
                ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                : performance > 0
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                : 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800';

              const textColor = dia.agendados === 0
                ? 'text-slate-400 dark:text-slate-500'
                : performance >= 90
                ? 'text-green-700 dark:text-green-300'
                : performance >= 70
                ? 'text-yellow-700 dark:text-yellow-300'
                : performance > 0
                ? 'text-red-700 dark:text-red-300'
                : 'text-indigo-700 dark:text-indigo-300';

              return (
                <div
                  key={index}
                  className={`${bgColor} border-2 rounded-lg p-3 transition-all hover:shadow-md ${isToday ? 'ring-2 ring-indigo-400 dark:ring-indigo-500' : ''}`}
                >
                  <div className="text-center mb-2">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {dia.diaSemana}
                    </p>
                    <p className={`text-2xl font-bold ${textColor}`}>
                      {dia.dia}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">
                      {dia.mesNome}
                    </p>
                  </div>

                  <div className="hidden md:block space-y-1 text-xs">
                    <div className="flex justify-between items-center px-2 py-1">
                      <span className="text-slate-600 dark:text-slate-400">Agendados:</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {dia.agendados}
                      </span>
                    </div>

                    <div className="flex justify-between items-center px-2 py-1">
                      <span className="text-slate-600 dark:text-slate-400">No prazo:</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {dia.entregues}
                      </span>
                    </div>

                    {dia.agendados > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center px-2">
                          <span className="text-slate-600 dark:text-slate-400">Perf.:</span>
                          <span className={`font-bold ${textColor}`}>
                            {performance.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="md:hidden space-y-1 text-xs">
                    <div className="px-2 py-1 text-center">
                      <p className="text-slate-600 dark:text-slate-400 text-[10px] mb-0.5">No prazo</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">
                        {dia.entregues}/{dia.agendados}
                      </p>
                    </div>
                    {dia.agendados > 0 && (
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-700 text-center px-2 py-1">
                        <p className="text-slate-600 dark:text-slate-400 text-[10px] mb-0.5">Perf.</p>
                        <p className={`font-bold text-sm ${textColor}`}>
                          {performance.toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
