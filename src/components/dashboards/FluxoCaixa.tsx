import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { DollarSign, TrendingUp, TrendingDown, Calendar } from 'lucide-react';

export function FluxoCaixa() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fluxo de Caixa</h1>
          <p className="text-gray-500 mt-1">Controle de entradas e saídas</p>
        </div>
      </div>

      {/* Em Desenvolvimento */}
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-gray-100 p-6 mb-4">
            <DollarSign className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold mb-2">Dashboard em Desenvolvimento</h3>
          <p className="text-gray-500 text-center max-w-md">
            O Dashboard de Fluxo de Caixa está sendo desenvolvido e estará disponível em breve.
            Aqui você poderá visualizar entradas, saídas e saldo em tempo real.
          </p>
        </CardContent>
      </Card>

      {/* Preview de funcionalidades futuras */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              Entradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">Em breve</p>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              Saídas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">Em breve</p>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              Saldo Projetado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">R$ 0,00</div>
            <p className="text-xs text-muted-foreground">Em breve</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
