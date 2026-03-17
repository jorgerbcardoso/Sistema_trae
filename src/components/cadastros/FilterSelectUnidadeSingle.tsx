import React, { useEffect, useState, useRef } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Search, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Button } from '../ui/button';
import { ENVIRONMENT } from '../../config/environment';
import { mockSearchUnidades } from '../../mocks/mockData';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';

interface Unidade {
  sigla: string;
  nome: string;
  cnpj: string;
}

interface FilterSelectUnidadeSingleProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  respectUserUnit?: boolean;
  compact?: boolean; // ✅ Modo compacto: exibe apenas a sigla quando selecionado
  label?: string; // ✅ Label opcional
  allowedUnidades?: string[]; // ✅ NOVO - Unidades permitidas (filtro)
}

export function FilterSelectUnidadeSingle({ value, onChange, disabled, respectUserUnit, compact, label, allowedUnidades }: FilterSelectUnidadeSingleProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Verificar a unidade atual (selecionada no cabeçalho)
  const unidadeAtual = user?.unidade_atual || user?.unidade || '';
  const isUserNonMTZ = unidadeAtual && unidadeAtual !== 'MTZ';
  const shouldBeDisabled = disabled || (respectUserUnit === true && isUserNonMTZ);

  // Forçar unidade atual do cabeçalho se necessário
  useEffect(() => {
    if (respectUserUnit === true && isUserNonMTZ && unidadeAtual) {
      if (value !== unidadeAtual) {
        onChange(unidadeAtual);
      }
    }
  }, [respectUserUnit, unidadeAtual, value]);

  // Carregar todas as unidades quando abrir
  useEffect(() => {
    if (open) {
      loadAllUnidades();
    }
  }, [open]);

  const loadAllUnidades = async () => {
    setLoading(true);
    
    if (ENVIRONMENT.isFigmaMake) {
      const result = await mockSearchUnidades('');
      if (result.success) {
        setOptions(result.unidades);
      }
    } else {
      try {
        const token = localStorage.getItem('auth_token');
        const url = `${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/search_unidades.php`;
        
        const result = await apiFetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ search: '' })
        });
        
        if (result.success) {
          setOptions(result.unidades);
        }
      } catch (error) {
        console.error('Erro ao carregar unidades:', error);
      }
    }
    setLoading(false);
  };

  const filteredOptions = options
    .filter(u => {
      // Filtrar por unidades permitidas (se especificado)
      if (allowedUnidades && allowedUnidades.length > 0) {
        const normalizedAllowed = allowedUnidades.map(un => un.trim().toUpperCase());
        const normalizedSigla = u.sigla.trim().toUpperCase();
        
        // Se não está nas unidades permitidas, bloqueia
        if (!normalizedAllowed.includes(normalizedSigla)) {
          return false;
        }
      }
      
      // Filtro de busca (só aplica se tiver algo digitado)
      if (searchValue.trim() !== '') {
        const matchesSearch = u.nome.toLowerCase().includes(searchValue.toLowerCase()) ||
          u.sigla.toLowerCase().includes(searchValue.toLowerCase()) ||
          u.cnpj.includes(searchValue);
        
        if (!matchesSearch) {
          return false;
        }
      }
      
      // Passou em todos os filtros
      return true;
    })
    .sort((a, b) => {
      const aExactMatch = a.sigla.toLowerCase() === searchValue.toLowerCase();
      const bExactMatch = b.sigla.toLowerCase() === searchValue.toLowerCase();
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      const aStartsWithSigla = a.sigla.toLowerCase().startsWith(searchValue.toLowerCase());
      const bStartsWithSigla = b.sigla.toLowerCase().startsWith(searchValue.toLowerCase());
      
      if (aStartsWithSigla && !bStartsWithSigla) return -1;
      if (!aStartsWithSigla && bStartsWithSigla) return 1;
      
      const aStartsWithNome = a.nome.toLowerCase().startsWith(searchValue.toLowerCase());
      const bStartsWithNome = b.nome.toLowerCase().startsWith(searchValue.toLowerCase());
      
      if (aStartsWithNome && !bStartsWithNome) return -1;
      if (!aStartsWithNome && bStartsWithNome) return 1;
      
      return a.sigla.localeCompare(b.sigla);
    });

  const selectUnidade = (sigla: string) => {
    onChange(sigla);
    setOpen(false);
    setSearchValue('');
  };

  const clearSelection = () => {
    onChange('');
  };

  const selectedUnidade = options.find(u => u.sigla === value);
  const getButtonText = () => {
    if (!value) return 'Selecione uma unidade';
    if (value === 'TODAS') return 'TODAS';
    return selectedUnidade ? `${selectedUnidade.sigla} - ${selectedUnidade.nome}` : value;
  };
  
  const getCompactText = () => {
    if (!value) return 'Selecione uma unidade';
    if (value === 'TODAS') return 'TODAS';
    return value;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (listRef.current) {
      listRef.current.scrollTop += e.deltaY;
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (shouldBeDisabled) {
      return;
    }
    setOpen(newOpen);
  };

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-between text-left overflow-hidden bg-input-background"
            disabled={shouldBeDisabled}
          >
            <span className="truncate flex-1 block">
              {compact && value ? getCompactText() : getButtonText()}
            </span>
            <div className="flex items-center gap-1 ml-2 shrink-0">
              {value && !shouldBeDisabled && (
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    clearSelection();
                  }}
                  className="hover:bg-slate-200 dark:hover:bg-slate-700 rounded p-0.5 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </div>
              )}
              <Search className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0">
          <div className="flex flex-col">
            <div className="flex items-center border-b px-3 py-2">
              <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
              <Input
                placeholder="Buscar por nome, sigla ou CNPJ..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8"
              />
              {searchValue && (
                <button
                  onClick={() => setSearchValue('')}
                  className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div 
              className="max-h-[300px] overflow-y-auto overscroll-contain touch-auto"
              onWheel={handleWheel}
              onTouchMove={(e) => e.stopPropagation()}
              style={{ 
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
                scrollBehavior: 'smooth'
              }}
              ref={listRef}
            >
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
                </div>
              ) : filteredOptions.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhuma unidade encontrada
                </div>
              ) : (
                filteredOptions.map((unidade) => (
                  <div
                    key={unidade.sigla}
                    onClick={() => selectUnidade(unidade.sigla)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm dark:text-slate-200">{unidade.sigla}</span>
                        {value === unidade.sigla && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                        {unidade.nome}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-500">
                        CNPJ: {unidade.cnpj}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}