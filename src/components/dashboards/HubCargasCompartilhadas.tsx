import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { X, Loader2, ServerCrash, ListTree } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { ENVIRONMENT } from '../../utils/environment';
import { UnidadeCompartilhadaCard } from './UnidadeCompartilhadaCard';

interface HubCargasCompartilhadasProps {
  placa: string;
  onFechar: () => void;
  onSalvarCtes: (placa: string, ctes: number[]) => Promise<void>;
}

export function HubCargasCompartilhadas({ placa, onFechar, onSalvarCtes }: HubCargasCompartilhadasProps) {
  const [unidades, setUnidades] = useState<string[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [erroUnidades, setErroUnidades] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_unidades_compartilhadas.php`, { method: 'POST' }, true)
      .then(res => {
        if (res.success) {
          setUnidades(res.unidades || []);
        } else {
          setErroUnidades(res.message || 'Erro ao buscar unidades compartilhadas.');
        }
      })
      .catch(err => setErroUnidades(err.message || 'Erro de comunicação com o servidor.'))
      .finally(() => setLoadingUnidades(false));
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl h-[90vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <ListTree className="w-5 h-5 text-blue-500" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Hub de Cargas Compartilhadas</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Placa: {placa}</p>
            </div>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loadingUnidades && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <Loader2 className="w-10 h-10 animate-spin mb-4" />
              <p>Buscando unidades compartilhadas...</p>
            </div>
          )}
          {erroUnidades && (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
              <ServerCrash className="w-10 h-10 mb-4" />
              <p className="font-semibold">{erroUnidades}</p>
            </div>
          )}
          {!loadingUnidades && !erroUnidades && unidades.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
              <p>Nenhuma unidade compartilhada configurada.</p>
            </div>
          )}
          <div className="space-y-4">
            {unidades.map(unidade => (
              <UnidadeCompartilhadaCard key={unidade} sigla={unidade} />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <Button variant="outline" onClick={onFechar}>Fechar</Button>
          <Button className="bg-blue-500 hover:bg-blue-600 text-white">
            Adicionar ao Carregamento
          </Button>
        </div>
      </div>
    </div>
  );
}
