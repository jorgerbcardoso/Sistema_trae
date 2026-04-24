import React from 'react';
import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useTheme } from '../ThemeProvider';

export interface DiaPerformanceAgendamento {
  data: string;
  dataIso: string;
  agendados: number;
  entregues: number;
  performance: number;
}

interface PerformanceCronologicaAgendamentosProps {
  periodo: 7 | 15 | 30;
  setPeriodo: (periodo: 7 | 15 | 30) => void;
  diasData: DiaPerformanceAgendamento[];
  loading: boolean;
}

export function PerformanceCronologicaAgendamentos({
  periodo,
  setPeriodo,
  diasData,
  loading,
}: PerformanceCronologicaAgendamentosProps) {
  const { theme } = useTheme();

  const gridColor   = theme === 'dark' ? '#334155' : '#e2e8f0';
  const axisColor   = theme === 'dark' ? '#475569' : '#cbd5e1';
  const tickColor   = theme === 'dark' ? '#94a3b8' : '#64748b';
  const tooltipBg   = theme === 'dark' ? '#1e293b' : '#ffffff';
  const tooltipBorder = theme === 'dark' ? '#334155' : '#e2e8f0';

  const mediaPerformance = diasData.length > 0
    ? diasData.reduce((acc, d) => acc + d.performance, 0) / diasData.length
    : 0;

  return (
    <Card className="dark:bg-slate-900 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance Cronológica de Agendamentos
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Percentual de CT-es agendados entregues no prazo, dia a dia
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
          <div className="flex items-center justify-center h-[350px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : diasData.length === 0 ? (
          <div className="flex items-center justify-center h-[350px] text-slate-500 dark:text-slate-400">
            Nenhum dado disponível para o período selecionado.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={diasData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis
                dataKey="data"
                tick={{ fontSize: 12, fill: tickColor }}
                angle={-45}
                textAnchor="end"
                height={60}
                stroke={axisColor}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fontSize: 12, fill: tickColor }}
                stroke={axisColor}
                label={{
                  value: 'Performance (%)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 10,
                  style: { fill: tickColor, fontSize: 12 },
                }}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload as DiaPerformanceAgendamento;
                    return (
                      <div
                        className="p-3 rounded shadow-lg border text-sm"
                        style={{ background: tooltipBg, borderColor: tooltipBorder }}
                      >
                        <p className="font-semibold text-slate-900 dark:text-slate-100 mb-1">{d.data}</p>
                        <p className="text-indigo-600 dark:text-indigo-400">
                          Performance: <strong>{d.performance.toFixed(1)}%</strong>
                        </p>
                        <p className="text-slate-600 dark:text-slate-400">
                          Agendados: {d.agendados}
                        </p>
                        <p className="text-green-600 dark:text-green-400">
                          Entregues no prazo: {d.entregues}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend wrapperStyle={{ color: tickColor }} />
              {mediaPerformance > 0 && (
                <ReferenceLine
                  y={mediaPerformance}
                  stroke="#a78bfa"
                  strokeDasharray="5 5"
                  label={{
                    value: `Média: ${mediaPerformance.toFixed(1)}%`,
                    position: 'insideTopRight',
                    fill: '#a78bfa',
                    fontSize: 11,
                  }}
                />
              )}
              <Line
                type="monotone"
                dataKey="performance"
                name="Performance (%)"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', r: 3 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
