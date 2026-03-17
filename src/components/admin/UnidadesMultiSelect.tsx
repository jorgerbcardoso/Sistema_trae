import { useState, useEffect } from 'react';
import { Check, Search, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

interface UnidadesMultiSelectProps {
  value: string[]; // Array de unidades selecionadas: ['MTZ', 'ACV']
  onChange: (value: string[]) => void;
  domain?: string;
}

interface Unidade {
  sigla: string;
  nome: string;
}

export function UnidadesMultiSelect({ value, onChange, domain = 'MTZ' }: UnidadesMultiSelectProps) {
  const [search, setSearch] = useState('');
  const [todasUnidades, setTodasUnidades] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(false);
  
  // ✅ Carregar unidades da API quando o domínio mudar
  useEffect(() => {
    loadUnidades();
  }, [domain]);
  
  const loadUnidades = async () => {
    setLoading(true);
    
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Simular unidades
        await new Promise(resolve => setTimeout(resolve, 300));
        setTodasUnidades([
          { sigla: 'MTZ', nome: 'Matozinhos' },
          { sigla: 'GUA', nome: 'Guarulhos' },
          { sigla: 'SJC', nome: 'São José dos Campos' },
          { sigla: 'CWB', nome: 'Curitiba' },
          { sigla: 'BHZ', nome: 'Belo Horizonte' },
          { sigla: 'VIX', nome: 'Vitória' },
          { sigla: 'BSB', nome: 'Brasília' }
        ]);
      } else {
        // ✅ Buscar unidades da API do domínio
        const token = localStorage.getItem('auth_token');
        const result = await apiFetch(`/sistema/api/users/get_domain_unidades.php?domain=${domain}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (result.success) {
          setTodasUnidades(result.unidades || []);
        } else {
          console.error('Erro ao buscar unidades:', result.error);
          setTodasUnidades([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
      setTodasUnidades([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Filtrar por busca (busca na sigla ou no nome)
  const filtered = todasUnidades.filter(u => 
    u.sigla.toLowerCase().includes(search.toLowerCase()) ||
    u.nome.toLowerCase().includes(search.toLowerCase())
  );
  
  // Toggle unidade
  const handleToggle = (unidade: string) => {
    if (value.includes(unidade)) {
      onChange(value.filter(u => u !== unidade));
    } else {
      onChange([...value, unidade]);
    }
  };
  
  // Selecionar todas
  const handleSelectAll = () => {
    onChange([...todasUnidades.map(u => u.sigla)]);
  };
  
  // Limpar todas
  const handleClearAll = () => {
    onChange([]);
  };
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Unidades Permitidas
        </Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-xs text-blue-600 hover:underline"
          >
            Selecionar todas
          </button>
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-slate-500 hover:underline"
          >
            Limpar
          </button>
        </div>
      </div>
      
      <div className="border rounded-lg p-3 space-y-3 bg-slate-50 dark:bg-slate-900">
        {/* Input de busca */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar unidade..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white dark:bg-slate-800"
          />
        </div>
        
        {/* Lista de checkboxes */}
        <div className="max-h-48 overflow-y-auto space-y-1 bg-white dark:bg-slate-800 rounded border p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <Loader2 className="animate-spin h-6 w-6 mb-2" />
              <span className="text-sm">Carregando unidades...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-4 text-sm text-slate-500">
              Nenhuma unidade encontrada
            </div>
          ) : (
            filtered.map(unidade => (
              <div
                key={unidade.sigla}
                className="flex items-center gap-3 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer transition-colors"
                onClick={() => handleToggle(unidade.sigla)}
              >
                <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                  value.includes(unidade.sigla) 
                    ? 'bg-blue-600 border-blue-600' 
                    : 'border-slate-300 dark:border-slate-600'
                }`}>
                  {value.includes(unidade.sigla) && (
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  )}
                </div>
                <div className="flex flex-col flex-1">
                  <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                    {unidade.sigla}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {unidade.nome}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Resumo das selecionadas */}
        {value.length > 0 ? (
          <div className="text-xs text-slate-600 dark:text-slate-400 border-t pt-2 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
            <strong>Selecionadas ({value.length}):</strong> {value.join(', ')}
          </div>
        ) : (
          <div className="text-xs text-amber-600 dark:text-amber-400 border-t pt-2 bg-amber-50 dark:bg-amber-900/20 rounded p-2">
            ⚠️ <strong>Nenhuma unidade selecionada</strong> = Usuário poderá trocar para QUALQUER unidade
          </div>
        )}
      </div>
    </div>
  );
}