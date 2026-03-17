/**
 * COMPONENTE: FILTRO DE TIPO DE ITEM COM BUSCA
 * Permite buscar tipos de item por descrição
 * Carrega via API e filtra localmente
 */

import { useEffect, useState } from 'react';
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

interface TipoItem {
  seq_tipo_item: number;
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
}

export function FilterSelectTipoItem({ 
  value, 
  onChange, 
  label = "Tipo de Item", 
  placeholder = "Todos os tipos",
  showAll = true,
  apenasAtivos = true
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<TipoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTipo, setSelectedTipo] = useState<TipoItem | null>(null);
  const [allTipos, setAllTipos] = useState<TipoItem[]>([]);

  // Carregar TODOS os tipos no mount
  useEffect(() => {
    carregarTipos();
  }, [apenasAtivos]);

  // ✅ Sincronizar estado interno quando valor externo muda
  useEffect(() => {
    if (value === 'ALL') {
      setSelectedTipo(null);
    } else {
      // Buscar o tipo correspondente ao valor
      const tipo = allTipos.find(t => t.seq_tipo_item.toString() === value);
      if (tipo) {
        setSelectedTipo(tipo);
      }
    }
  }, [value, allTipos]);

  // Filtrar localmente quando buscar
  useEffect(() => {
    if (searchValue.length > 0) {
      const filtrados = allTipos.filter(t =>
        t.descricao.toLowerCase().includes(searchValue.toLowerCase())
      );
      setOptions(filtrados);
    } else {
      setOptions(allTipos);
    }
  }, [searchValue, allTipos]);

  const carregarTipos = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (apenasAtivos) {
        params.append('ativo', 'S');
      }
      
      const url = `${ENVIRONMENT.apiBaseUrl}/estoque/tipos_item.php?${params}`;
      
      const data = await apiFetch(url);
      
      if (data.success) {
        const tiposRecebidos = data.data || [];
        setAllTipos(tiposRecebidos);
        setOptions(tiposRecebidos);
      }
    } catch (error) {
      console.error('❌ [FilterSelectTipoItem] Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const limparSelecao = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('ALL');
    setSelectedTipo(null);
  };

  return (
    <div className="grid gap-2">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Popover open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            carregarTipos();
          }
        }}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className={`w-full justify-between text-left dark:bg-slate-800 dark:border-slate-700 ${selectedTipo ? 'pr-16' : 'pr-10'}`}
            >
              <span className={`truncate ${selectedTipo ? 'pr-2' : ''}`}>
                {selectedTipo ? selectedTipo.descricao : placeholder}
              </span>
              {selectedTipo && (
                <X 
                  className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 cursor-pointer absolute right-9 top-1/2 -translate-y-1/2" 
                  onClick={(e) => limparSelecao(e)}
                />
              )}
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex flex-col">
              <div className="flex items-center border-b dark:border-slate-700 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                <Input
                  placeholder="Buscar por descrição..."
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
                    Carregando tipos...
                  </div>
                ) : options.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum tipo encontrado.
                  </div>
                ) : (
                  <>
                    {showAll && (
                      <div
                        onClick={() => {
                          onChange('ALL');
                          setSelectedTipo(null);
                          setSearchValue('');
                          setOpen(false);
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700"
                      >
                        <span className="text-slate-400">Todos os tipos</span>
                      </div>
                    )}
                    {options.map((tipo) => (
                      <div
                        key={tipo.seq_tipo_item}
                        onClick={() => {
                          onChange(tipo.seq_tipo_item.toString());
                          setSelectedTipo(tipo);
                          setSearchValue('');
                          setOpen(false);
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <div className="flex items-center justify-between flex-1">
                          <span className="font-semibold text-sm dark:text-slate-100">{tipo.descricao}</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${tipo.ativo === 'S' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {tipo.ativo === 'S' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}