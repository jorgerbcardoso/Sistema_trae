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
  atrasados?: number;
  atrasados_sem_entrega?: number;
  entregues_com_atraso?: number;
}

interface CalendarioAgendamentosProps {
  periodo: 7 | 15 | 30;
  setPeriodo: (periodo: 7 | 15 | 30) => void;
  diasData: DiaAgendamento[];
  loading: boolean;
  onClickDia?: (data: string, tipo: 'agendados' | 'no_prazo' | 'atrasados' | 'atrasados_sem_entrega' | 'entregues_com_atraso') => void;
  modoVisao?: 'CTE' | 'AGENDA';
}

export function CalendarioAgendamentos({
  periodo,
  setPeriodo,
  diasData,
  loading,
  onClickDia,
  modoVisao = 'CTE',
}: CalendarioAgendamentosProps) {
  const todayISO = new Date().toISOString().slice(0, 10);

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
              {modoVisao === 'AGENDA' ? 'Agendas' : 'CT-es'} com ocorrência 15 — agendados por data de previsão de entrega
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
              const isFromTodayOn = dia.data >= todayISO;
              const isFuture = dia.data > todayISO;
              const atrasSemEntregaRaw = Number.isFinite(dia.atrasados_sem_entrega as number) ? (dia.atrasados_sem_entrega as number) : 0;
              const entreguesAtrasoRaw = Number.isFinite(dia.entregues_com_atraso as number) ? (dia.entregues_com_atraso as number) : 0;
              const atrasadosTotalRaw = Number.isFinite(dia.atrasados as number)
                ? (dia.atrasados as number)
                : Math.max(0, dia.agendados - dia.entregues);
              const atrasadosSemEntrega = isFromTodayOn ? 0 : Math.max(0, atrasSemEntregaRaw);
              const entreguesComAtraso = isFromTodayOn ? 0 : Math.max(0, entreguesAtrasoRaw);
              const atrasados = isFromTodayOn ? 0 : Math.max(0, atrasadosTotalRaw);

              const isToday = dia.data === todayISO;

              const bgColor = isFuture
                ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                : dia.agendados === 0
                ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                : performance >= 90
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
                : performance >= 70
                ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
                : performance > 0
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                : 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800';

              const textColor = isFuture
                ? 'text-slate-400 dark:text-slate-500'
                : dia.agendados === 0
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
                    <div
                      className={`flex justify-between items-center px-2 py-1 rounded ${dia.agendados > 0 && onClickDia ? 'cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40' : ''}`}
                      onClick={dia.agendados > 0 && onClickDia ? () => onClickDia(dia.data, 'agendados') : undefined}
                    >
                      <span className="text-slate-600 dark:text-slate-400">Agendados:</span>
                      <span className={`font-semibold text-indigo-600 dark:text-indigo-400 ${dia.agendados > 0 && onClickDia ? 'underline decoration-dotted' : ''}`}>
                        {dia.agendados}
                      </span>
                    </div>

                    <div
                      className={`flex justify-between items-center px-2 py-1 rounded ${dia.entregues > 0 && onClickDia ? 'cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/40' : ''}`}
                      onClick={dia.entregues > 0 && onClickDia ? () => onClickDia(dia.data, 'no_prazo') : undefined}
                    >
                      <span className="text-slate-600 dark:text-slate-400">No prazo:</span>
                      <span className={`font-semibold text-green-600 dark:text-green-400 ${dia.entregues > 0 && onClickDia ? 'underline decoration-dotted' : ''}`}>
                        {dia.entregues}
                      </span>
                    </div>

                    <div
                      className={`flex justify-between items-center px-2 py-1 rounded ${atrasadosSemEntrega > 0 && onClickDia ? 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40' : ''}`}
                      onClick={atrasadosSemEntrega > 0 && onClickDia ? () => onClickDia(dia.data, 'atrasados_sem_entrega') : undefined}
                    >
                      <span className="text-slate-600 dark:text-slate-400">Atraso (sem entrega):</span>
                      <span className={`font-semibold text-red-600 dark:text-red-400 ${atrasadosSemEntrega > 0 && onClickDia ? 'underline decoration-dotted' : ''}`}>
                        {atrasadosSemEntrega}
                      </span>
                    </div>

                    <div
                      className={`flex justify-between items-center px-2 py-1 rounded ${entreguesComAtraso > 0 && onClickDia ? 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40' : ''}`}
                      onClick={entreguesComAtraso > 0 && onClickDia ? () => onClickDia(dia.data, 'entregues_com_atraso') : undefined}
                    >
                      <span className="text-slate-600 dark:text-slate-400">Entregues c/ atraso:</span>
                      <span className={`font-semibold text-red-600 dark:text-red-400 ${entreguesComAtraso > 0 && onClickDia ? 'underline decoration-dotted' : ''}`}>
                        {entreguesComAtraso}
                      </span>
                    </div>

                    {dia.agendados > 0 && !isFuture && (
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
                    <div
                      className={`px-2 py-1 text-center rounded ${dia.agendados > 0 && onClickDia ? 'cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40' : ''}`}
                      onClick={dia.agendados > 0 && onClickDia ? () => onClickDia(dia.data, 'agendados') : undefined}
                    >
                      <p className="text-slate-600 dark:text-slate-400 text-[10px] mb-0.5">No prazo</p>
                      <p className={`font-semibold text-green-600 dark:text-green-400 ${dia.agendados > 0 && onClickDia ? 'underline decoration-dotted' : ''}`}>
                        {dia.entregues}/{dia.agendados}
                      </p>
                    </div>
                    <div
                      className={`px-2 py-1 text-center rounded ${atrasadosSemEntrega > 0 && onClickDia ? 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40' : ''}`}
                      onClick={atrasadosSemEntrega > 0 && onClickDia ? () => onClickDia(dia.data, 'atrasados_sem_entrega') : undefined}
                    >
                      <p className="text-slate-600 dark:text-slate-400 text-[10px] mb-0.5">Atraso (sem entrega)</p>
                      <p className={`font-semibold text-red-600 dark:text-red-400 ${atrasadosSemEntrega > 0 && onClickDia ? 'underline decoration-dotted' : ''}`}>
                        {atrasadosSemEntrega}
                      </p>
                    </div>
                    <div
                      className={`px-2 py-1 text-center rounded ${entreguesComAtraso > 0 && onClickDia ? 'cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40' : ''}`}
                      onClick={entreguesComAtraso > 0 && onClickDia ? () => onClickDia(dia.data, 'entregues_com_atraso') : undefined}
                    >
                      <p className="text-slate-600 dark:text-slate-400 text-[10px] mb-0.5">Entregues c/ atraso</p>
                      <p className={`font-semibold text-red-600 dark:text-red-400 ${entreguesComAtraso > 0 && onClickDia ? 'underline decoration-dotted' : ''}`}>
                        {entreguesComAtraso}
                      </p>
                    </div>
                    {dia.agendados > 0 && !isFuture && (
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
