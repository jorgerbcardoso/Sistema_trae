import React, { useEffect, useState, useRef } from 'react';
import { Input } from '../ui/input';
import { Search, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { ENVIRONMENT } from '../../config/environment';
import { mockSearchUnidades } from '../../mocks/mockData';
import { apiFetch } from '../../utils/apiUtils';

interface Unidade {
  sigla: string;
  nome: string;
  cnpj: string;
}

interface FilterSelectUnidadeOrderedProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export function FilterSelectUnidadeOrdered({ value, onChange }: FilterSelectUnidadeOrderedProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [options, setOptions] = useState<Unidade[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Carregar todas as unidades quando abrir
  useEffect(() => {
    if (open && options.length === 0) {
      loadAllUnidades();
    }
  }, [open]);

  // Sincronizar manualInput com value quando o componente monta ou value muda externamente
  useEffect(() => {
    setManualInput(value.join(', '));
  }, [value.join(',')]);

  // ✅ ROLAR AUTOMATICAMENTE até o último item marcado quando value mudar
  useEffect(() => {
    if (value.length > 0 && open && options.length > 0) {
      // Usar setTimeout para garantir que o DOM foi atualizado
      const timeoutId = setTimeout(() => {
        const lastSelectedSigla = value[value.length - 1];
        const itemElement = itemRefs.current[lastSelectedSigla];
        
        if (itemElement) {
          // Elemento existe, rolar diretamente
          itemElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        } else {
          // Elemento não existe, pode estar filtrado
          setSearchValue('');
          
          // Aguardar um pouco mais e tentar novamente
          setTimeout(() => {
            const updatedElement = itemRefs.current[lastSelectedSigla];
            
            if (updatedElement) {
              updatedElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
              });
            }
          }, 200);
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [value, open, options.length]);

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
        const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/search_unidades.php`, {
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
        // Erro silencioso
      }
    }
    setLoading(false);
  };

  const filteredOptions = options
    .filter(u => 
      u.nome.toLowerCase().includes(searchValue.toLowerCase()) ||
      u.sigla.toLowerCase().includes(searchValue.toLowerCase()) ||
      u.cnpj.includes(searchValue)
    )
    .sort((a, b) => {
      // ✅ PRIORIDADE 1: Match exato de sigla (case-insensitive)
      const aExactMatch = a.sigla.toLowerCase() === searchValue.toLowerCase();
      const bExactMatch = b.sigla.toLowerCase() === searchValue.toLowerCase();
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      // ✅ PRIORIDADE 2: Sigla começa com o termo buscado
      const aStartsWithSigla = a.sigla.toLowerCase().startsWith(searchValue.toLowerCase());
      const bStartsWithSigla = b.sigla.toLowerCase().startsWith(searchValue.toLowerCase());
      
      if (aStartsWithSigla && !bStartsWithSigla) return -1;
      if (!aStartsWithSigla && bStartsWithSigla) return 1;
      
      // ✅ PRIORIDADE 3: Nome começa com o termo buscado
      const aStartsWithNome = a.nome.toLowerCase().startsWith(searchValue.toLowerCase());
      const bStartsWithNome = b.nome.toLowerCase().startsWith(searchValue.toLowerCase());
      
      if (aStartsWithNome && !bStartsWithNome) return -1;
      if (!aStartsWithNome && bStartsWithNome) return 1;
      
      // ✅ PRIORIDADE 4: Ordem alfabética por sigla
      return a.sigla.localeCompare(b.sigla);
    });

  // Alternar seleção de unidade (mantendo ordem)
  const toggleUnidade = (sigla: string) => {
    if (value.includes(sigla)) {
      onChange(value.filter(s => s !== sigla));
    } else {
      onChange([...value, sigla]);
    }
  };

  // Limpar todas as seleções
  const clearAll = () => {
    onChange([]);
    setManualInput('');
  };

  // Processar input manual
  const handleManualInputChange = (input: string) => {
    setManualInput(input);
    
    // Processar a string e extrair as siglas
    const siglas = input
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);
    
    onChange(siglas);
  };

  // Texto do botão
  const getButtonText = () => {
    if (value.length === 0) return 'Selecione as unidades';
    return value.join(', ');
  };

  // ✅ Handler de wheel personalizado para garantir funcionamento em produção
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (listRef.current) {
      listRef.current.scrollTop += e.deltaY;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between text-left dark:bg-slate-800 dark:border-slate-700 h-auto min-h-[40px]">
          <span className="truncate flex-1 whitespace-normal text-left">{getButtonText()}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value.length > 0 && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  clearAll();
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
      <PopoverContent className="w-[400px] p-0 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-col">
          {/* Header com contador */}
          <div className="flex items-center justify-between border-b dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {value.length > 0 ? `${value.length} selecionada${value.length > 1 ? 's' : ''}` : 'Selecione as unidades'}
            </span>
            {value.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Limpar Tudo
              </button>
            )}
          </div>

          {/* Input manual */}
          <div className="border-b dark:border-slate-700 px-3 py-2 bg-blue-50 dark:bg-blue-950/20">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              Digite manualmente (separado por vírgulas):
            </label>
            <Input
              placeholder="Ex: SP, RJ, MG"
              value={manualInput}
              onChange={(e) => handleManualInputChange(e.target.value)}
              className="h-8 text-sm dark:bg-slate-800 dark:border-slate-700"
            />
          </div>

          {/* Campo de busca */}
          <div className="flex items-center border-b dark:border-slate-700 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
            <Input
              placeholder="Buscar por nome, sigla ou CNPJ..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8 dark:bg-slate-800"
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

          {/* Lista de opções com checkboxes */}
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
              filteredOptions.map((unidade) => {
                const isSelected = value.includes(unidade.sigla);
                const selectedIndex = value.indexOf(unidade.sigla);
                
                return (
                  <div
                    key={unidade.sigla}
                    onClick={() => toggleUnidade(unidade.sigla)}
                    className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 last:border-0"
                    ref={(el) => itemRefs.current[unidade.sigla] = el}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleUnidade(unidade.sigla)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm dark:text-slate-200">{unidade.sigla}</span>
                        {isSelected && (
                          <span className="text-xs px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded">
                            #{selectedIndex + 1}
                          </span>
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
                );
              })
            )}
          </div>

          {/* Footer mostrando ordem selecionada */}
          {value.length > 0 && (
            <div className="border-t dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Ordem selecionada:
              </div>
              <div className="text-xs text-slate-700 dark:text-slate-300">
                {value.join(' → ')}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}