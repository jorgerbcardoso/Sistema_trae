import React from 'react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export function FretesExpedidosRecebidos() {
  return (
    <AdminLayout
      title="FRETES EXPEDIDOS E RECEBIDOS"
      description="Consulta SSW 0057 (expedidos e recebidos)"
    >
      <Card>
        <CardHeader>
          <CardTitle>Em desenvolvimento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Esta funcionalidade já está cadastrada no menu e a rota está ativa. Agora falta implementar os filtros,
            o processamento do SSW (0057 → 1440 → 0424) e o mini-dashboard com abas.
          </div>
        </CardContent>
      </Card>
    </AdminLayout>
  );
}
