import { useState, useEffect, type ReactNode } from 'react';
import { Check, Search, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

export const OCORRENCIA_SEM_CODIGO = '__SEM_OCORRENCIA__';

interface OcorrenciasMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  domain?: string;
  label?: string;
  disabled?: boolean;
  emptyHint?: ReactNode;
  semOcorrenciaLabel?: string;
}

interface Ocorrencia {
  codigo: number;
  descricao: string;
  tipo: string;
  tipo_label: string;
}

export function OcorrenciasMultiSelect({
  value,
  onChange,
  domain = 'MTZ',
  label,
  disabled = false,
  emptyHint,
  semOcorrenciaLabel = 'Sem ocorrência'
}: OcorrenciasMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [todasOcorrencias, setTodasOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOcorrencias();
  }, [domain]);

  const loadOcorrencias = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 300));
        setTodasOcorrencias([
          { codigo: 1, descricao: 'CT-e emitido', tipo: 'I', tipo_label: 'Informativa' },
          { codigo: 2, descricao: 'Cliente em rota', tipo: 'E', tipo_label: 'Entrega' },
          { codigo: 3, descricao: 'Pendência documento transportadora', tipo: 'P', tipo_label: 'Pendência Transportadora' },
          { codigo: 4, descricao: 'Cliente ausente', tipo: 'C', tipo_label: 'Pendência Cliente' },
          { codigo: 5, descricao: 'Recebedor acionado', tipo: 'R', tipo_label: 'Pré-entrega' },
          { codigo: 6, descricao: 'Problema resolvido', tipo: 'S', tipo_label: 'Solução' },
          { codigo: 7, descricao: 'Baixa efetuada', tipo: 'B', tipo_label: 'Baixa' }
        ]);
      } else {
        const token = localStorage.getItem('auth_token');
        const result = await apiFetch(`/sistema/api/users/get_domain_ocorrencias.php?domain=${encodeURIComponent(domain)}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (result.success) {
          setTodasOcorrencias(result.ocorrencias || []);
        } else {
          console.error('Erro ao buscar ocorrências:', result.error);
          setTodasOcorrencias([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar ocorrências:', error);
      setTodasOcorrencias([]);
    } finally {
      setLoading(false);
    }
  };

  const allKeys: string[] = [
    OCORRENCIA_SEM_CODIGO,
    ...todasOcorrencias.map(o => String(o.codigo))
  ];

  const filtrados = todasOcorrencias.filter(o => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      String(o.codigo).includes(q) ||
      o.descricao.toLowerCase().includes(q) ||
      o.tipo.toLowerCase().includes(q) ||
      o.tipo_label.toLowerCase().includes(q)
    );
  });

  const handleToggle = (key: string) => {
    if (disabled) return;
    if (value.includes(key)) {
      onChange(value.filter(u => u !== key));
    } else {
      onChange([...value, key]);
    }
  };

  const handleSelectAll = () => {
    if (disabled) return;
    onChange([...allKeys]);
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const semSel = value.includes(OCORRENCIA_SEM_CODIGO);

  const selecionadasSem = semSel ? [semOcorrenciaLabel] : [];
  const codsReais = value.filter(v => v !== OCORRENCIA_SEM_CODIGO);
  const selecionadasDesc = codsReais
    .map(c => {
      const oc = todasOcorrencias.find(o => String(o.codigo) === c);
      if (!oc) return `#${c}`;
      return `${oc.tipo || ''}#${oc.codigo} ${oc.descricao}`;
    });
  const resumo = [...selecionadasSem, ...selecionadasDesc].join(', ');

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          {label || 'Última Ocorrência'}
        </Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className={`text-xs text-blue-600 hover:underline ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          >
            Selecionar todas
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className={`text-xs text-slate-500 hover:underline ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-3 bg-slate-50 dark:bg-slate-900">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por código / descrição / tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
            className="pl-9 bg-white dark:bg-slate-800"
          />
        </div>

        <div className="max-h-48 overflow-y-auto space-y-1 bg-white dark:bg-slate-800 rounded border p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Loader2 className="animate-spin h-6 w-6 mb-2" />
              <span className="text-sm">Carregando ocorrências...</span>
            </div>
          ) : todasOcorrencias.length === 0 && !semOcorrenciaLabel ? (
            <div className="text-center py-4 text-sm text-slate-500">
              Nenhuma ocorrência encontrada
            </div>
          ) : (
            <>
              <div
                onClick={() => handleToggle(OCORRENCIA_SEM_CODIGO)}
                className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer transition-colors"
              >
                <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                  semSel ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {semSel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                </div>
                <div className="flex flex-col flex-1">
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {semOcorrenciaLabel}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    CT-es que não possuem nenhuma ocorrência atribuída
                  </span>
                </div>
              </div>

              {filtrados.length === 0 && search.trim() !== '' ? (
                <div className="text-center py-2 text-xs text-slate-500">
                  Nenhuma ocorrência corresponde à busca
                </div>
              ) : (
                filtrados.map(oc => {
                  const key = String(oc.codigo);
                  const sel = value.includes(key);
                  return (
                    <div
                      key={key}
                      onClick={() => handleToggle(key)}
                      className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer transition-colors"
                    >
                      <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                        sel ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {sel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            #{oc.codigo}
                          </span>
                          {oc.tipo_label && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold uppercase tracking-wide">
                              {oc.tipo_label}
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-slate-900 dark:text-slate-100 truncate">
                          {oc.descricao}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>

        {value.length > 0 && value.length !== allKeys.length ? (
          <div className="text-xs text-slate-600 dark:text-slate-400 border-t pt-2 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
            <strong>Selecionadas ({value.length}):</strong> {resumo || '-'}
          </div>
        ) : value.length === allKeys.length && allKeys.length > 0 ? (
          <div className="text-xs text-emerald-700 dark:text-emerald-300 border-t pt-2 bg-emerald-50 dark:bg-emerald-900/20 rounded p-2">
            <strong>Todas as ocorrências</strong> estão selecionadas (incluindo "Sem ocorrência")
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400 border-t pt-2 bg-amber-50 dark:bg-amber-900/20 rounded p-2">
            {emptyHint ?? <>⚠️ <strong>Nenhuma ocorrência selecionada</strong> = sem filtro (todas as ocorrências, inclusive "Sem ocorrência")</>}
          </div>
        )}
      </div>
    </div>
  );
}
