import React, { useState } from 'react';
import { Button } from '../ui/button';
import { ListTree } from 'lucide-react';
import { HubCargasCompartilhadas } from './HubCargasCompartilhadas';

interface HubTriggerProps {
  placa: string;
  temCapacidade: boolean;
}

export function HubTrigger({ placa, temCapacidade }: HubTriggerProps) {
  const [hubAberto, setHubAberto] = useState(false);

  if (!temCapacidade) return null;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 px-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border-slate-200 dark:border-slate-700"
        onClick={() => setHubAberto(true)}
        title="Buscar Cargas Compartilhadas"
      >
        <ListTree className="w-3.5 h-3.5" />
      </Button>
      {hubAberto && (
        <HubCargasCompartilhadas
          placa={placa}
          onFechar={() => setHubAberto(false)}
          onSalvarCtes={async () => {}}
        />
      )}
    </>
  );
}
