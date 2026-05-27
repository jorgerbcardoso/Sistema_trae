import React, { useState, useEffect } from 'react';
import { Loader2, ServerCrash } from 'lucide-react';
import { apiFetch } from '../../utils/api';
import { ENVIRONMENT } from '../../utils/environment';

interface UnidadeCompartilhadaCardProps {
  sigla: string;
}

export function UnidadeCompartilhadaCard({ sigla }: UnidadeCompartilhadaCardProps) {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<any>(null);

  useEffect(() => {
    apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/disponiveis/get_disponiveis_unidade_compartilhada.php`, { method: 'POST', body: JSON.stringify({ sigla }) }, true)
      .then(res => {
        if (res.success) {
          setDados(res.dados);
        } else {
          setErro(res.message || 'Erro ao buscar dados da unidade.');
        }
      })
      .catch(err => setErro(err.message || 'Erro de comunicação com o servidor.'))
      .finally(() => setLoading(false));
  }, [sigla]);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-lg">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50">
        <h4 className="font-semibold text-slate-800 dark:text-slate-200">{sigla}</h4>
      </div>
      <div className="p-4">
        {loading && (
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Carregando dados...</span>
          </div>
        )}
        {erro && (
          <div className="flex items-center gap-2 text-red-500">
            <ServerCrash className="w-4 h-4" />
            <span>{erro}</span>
          </div>
        )}
        {!loading && !erro && dados && (
          <div className="space-y-4">
            {/* Lógica de exibição dos CT-es aqui */}
          </div>
        )}
      </div>
    </div>
  );
}
