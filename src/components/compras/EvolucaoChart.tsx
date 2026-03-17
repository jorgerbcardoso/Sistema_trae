import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Layers, TrendingUp } from 'lucide-react';

interface EvolucaoChartProps {
  title: string;
  data: any[];
  colors: string[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export function EvolucaoChart({ title, data, colors }: EvolucaoChartProps) {
  const [isStacked, setIsStacked] = useState(false);

  // Extrair os nomes das séries (excluindo mes_label) e garantir que "DEMAIS" venha por último
  let series = data.length > 0 ? Object.keys(data[0]).filter(k => k !== 'mes_label') : [];
  
  // 🔥 GARANTIR que "DEMAIS" seja sempre a última série na legenda
  if (series.includes('DEMAIS')) {
    series = series.filter(s => s !== 'DEMAIS');
    series.push('DEMAIS'); // Adiciona DEMAIS no final
  }

  const formatarValor = (valor: number) => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatarMoeda = (valor: number) => {
    return `R$ ${formatarValor(valor)}`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-lg border border-slate-200 dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {formatarMoeda(entry.value)}
            </p>
          ))}
          {isStacked && payload.length > 1 && (
            <p className="text-sm font-semibold mt-2 pt-2 border-t border-slate-300">
              Total: {formatarMoeda(payload.reduce((sum: number, p: any) => sum + p.value, 0))}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // 🔥 Componente de legenda customizada que garante "DEMAIS" por último
  const CustomLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;

    // Ordenar: "DEMAIS" sempre por último
    const sortedPayload = [...payload].sort((a, b) => {
      if (a.value === 'DEMAIS') return 1;
      if (b.value === 'DEMAIS') return -1;
      return 0;
    });

    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {sortedPayload.map((entry: any, index: number) => (
          <div key={`legend-${index}`} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={!isStacked ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsStacked(false)}
              className="gap-2"
            >
              <TrendingUp className="size-4" />
              Paralelo
            </Button>
            <Button
              variant={isStacked ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsStacked(true)}
              className="gap-2"
            >
              <Layers className="size-4" />
              Empilhado
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>Nenhum dado disponível</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            {isStacked ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes_label" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
                {series.map((serie, index) => (
                  <Area
                    key={serie}
                    type="monotone"
                    dataKey={serie}
                    stackId="1"
                    stroke={COLORS[index % COLORS.length]}
                    fill={COLORS[index % COLORS.length]}
                    fillOpacity={0.6}
                    name={serie}
                  />
                ))}
              </AreaChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes_label" />
                <YAxis />
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
                {series.map((serie, index) => (
                  <Line
                    key={serie}
                    type="monotone"
                    dataKey={serie}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                    name={serie}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}