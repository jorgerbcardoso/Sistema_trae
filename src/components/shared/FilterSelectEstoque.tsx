import React, { useEffect, useState } from 'react';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Search, Loader2, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Button } from '../ui/button';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { MOCK_ESTOQUES } from '../../utils/estoqueModData';

interface Estoque {
  seq_estoque: number;
  unidade: string;
  nro_estoque: string;
  descricao: string;
  ativo: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  showAll?: boolean;
  apenasAtivos?: boolean;
  unidade?: string; // Filtro por unidade (MTZ vê todos, outras veem apenas da sua unidade)
  disabled?: boolean;
}

export function FilterSelectEstoque({ 
  value, 
  onChange, 
  label = "Estoque", 
  placeholder = "Todos os estoques",
  showAll = true,
  apenasAtivos = true,
  unidade,
  disabled = false
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<Estoque[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEstoque, setSelectedEstoque] = useState<Estoque | null>(null);
  const [allEstoques, setAllEstoques] = useState<Estoque[]>([]);

  // Carregar TODOS os estoques no mount
  useEffect(() => {
    carregarEstoques();
  }, [apenasAtivos, unidade]);

  // Filtrar localmente quando buscar
  useEffect(() => {
    if (searchValue.length > 0) {
      const filtrados = allEstoques.filter(e =>
        e.descricao.toLowerCase().includes(searchValue.toLowerCase()) ||
        e.nro_estoque.toLowerCase().includes(searchValue.toLowerCase()) ||
        e.unidade.toLowerCase().includes(searchValue.toLowerCase())
      );
      setOptions(filtrados);
    } else {
      setOptions(allEstoques);
    }
  }, [searchValue, allEstoques]);

  const carregarEstoques = async () => {
    setLoading(true);
    
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        let estoquesFiltrados = apenasAtivos 
          ? MOCK_ESTOQUES.filter(e => e.ativo === 'S')
          : MOCK_ESTOQUES;
        
        // Filtrar por unidade se especificado
        if (unidade) {
          estoquesFiltrados = estoquesFiltrados.filter(e => e.unidade === unidade);
        }
        
        console.log('📦 [FilterSelectEstoque] Estoques MOCK carregados:', estoquesFiltrados);
        setAllEstoques(estoquesFiltrados);
        setOptions(estoquesFiltrados);
      } else {
        // BACKEND
        const params = new URLSearchParams();
        if (apenasAtivos) {
          params.append('ativo', 'S');
        }
        if (unidade) {
          params.append('unidade', unidade);
        }
        
        const url = `${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php?${params}`;
        
        const data = await apiFetch(url);
        
        if (data.success) {
          const estoquesRecebidos = data.data || [];
          setAllEstoques(estoquesRecebidos);
          setOptions(estoquesRecebidos);
        }
      }
    } catch (error) {
      console.error('❌ [FilterSelectEstoque] Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const limparSelecao = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('ALL');
    setSelectedEstoque(null);
  };

  return (
    <div className={label ? "grid gap-2" : ""}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Popover open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen && allEstoques.length === 0) {
            carregarEstoques();
          }
        }}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full h-10 justify-start text-left dark:bg-slate-800 dark:border-slate-700 relative"
              disabled={disabled}
            >
              <span className={`truncate ${selectedEstoque ? 'pr-16' : 'pr-10'}`}>
                {selectedEstoque 
                  ? `${selectedEstoque.unidade}${String(selectedEstoque.nro_estoque).padStart(6, '0')} - ${selectedEstoque.descricao}` 
                  : placeholder}
              </span>
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-0 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex flex-col">
              <div className="flex items-center border-b dark:border-slate-700 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                <Input
                  placeholder="Buscar por número ou descrição..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8 dark:bg-slate-800"
                />
              </div>
              <div 
                className="max-h-[400px] overflow-y-auto overscroll-contain p-1"
                onWheel={(e) => e.stopPropagation()}
                style={{ overscrollBehavior: 'contain' }}
              >
                {loading ? (
                  <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                    Carregando estoques...
                  </div>
                ) : options.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum estoque encontrado.
                  </div>
                ) : (
                  <>
                    {showAll && (
                      <div
                        onClick={() => {
                          onChange('ALL');
                          setSelectedEstoque(null);
                          setSearchValue('');
                          setOpen(false);
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700"
                      >
                        <span className="text-slate-400">Todos os estoques</span>
                      </div>
                    )}
                    {options.map((estoque) => (
                      <div
                        key={estoque.seq_estoque}
                        onClick={() => {
                          onChange(estoque.seq_estoque.toString());
                          setSelectedEstoque(estoque);
                          setSearchValue('');
                          setOpen(false);
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm dark:text-slate-100">{estoque.descricao}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {/* ✅ FORMATO: AAA000000 (unidade + 6 dígitos) */}
                              {estoque.unidade}{String(estoque.nro_estoque).padStart(6, '0')}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Unidade: {estoque.unidade}</span>
                            <span className={`px-2 py-0.5 rounded ${estoque.ativo === 'S' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {estoque.ativo === 'S' ? 'Ativo' : 'Inativo'}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {selectedEstoque && showAll && (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hover:bg-slate-100 dark:hover:bg-slate-700 rounded p-0.5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange('ALL');
              setSelectedEstoque(null);
            }}
          >
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
          </button>
        )}
      </div>
    </div>
  );
}