/**
 * COMPONENTE: FILTRO DE ITEM COM BUSCA
 * Permite buscar itens por descrição ou código
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

interface Item {
  seq_item: number;
  codigo: string;
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
  seq_tipo_item?: number; // 🔥 NOVO: Filtrar por tipo de item
  compact?: boolean;
  hideLabel?: boolean;
}

export function FilterSelectItem({ 
  value, 
  onChange, 
  label = "Item", 
  placeholder = "Todos os itens",
  showAll = true,
  apenasAtivos = true,
  seq_tipo_item,
  compact = false,
  hideLabel = false
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [allItens, setAllItens] = useState<Item[]>([]);

  // Carregar itens se há value inicial
  useEffect(() => {
    if (value && value !== 'ALL' && allItens.length === 0) {
      carregarItens();
    }
  }, [value]);

  // Atualizar seleção quando value mudar
  useEffect(() => {
    if (value && value !== 'ALL' && allItens.length > 0) {
      const item = allItens.find(i => i.seq_item.toString() === value);
      setSelectedItem(item || null);
    } else {
      setSelectedItem(null);
    }
  }, [value, allItens]);

  // Filtrar localmente quando buscar
  useEffect(() => {
    if (searchValue.length > 0) {
      const filtrados = allItens.filter(i =>
        i.descricao.toLowerCase().includes(searchValue.toLowerCase()) ||
        i.codigo.toLowerCase().includes(searchValue.toLowerCase())
      );
      setOptions(filtrados);
    } else {
      setOptions(allItens);
    }
  }, [searchValue, allItens]);

  const carregarItens = async () => {
    setLoading(true);
    
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Simular carregamento com dados limitados
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const { MOCK_ITENS } = await import('../../mocks/estoqueComprasMocks');
        
        let itensFiltrados = MOCK_ITENS.filter(i => i.ativo === 'S');
        
        // Filtrar por tipo se especificado
        if (seq_tipo_item) {
          itensFiltrados = itensFiltrados.filter(i => i.seq_tipo_item === seq_tipo_item);
        }
        
        // ✅ LIMITAR A 100 ITENS para evitar erro de memória
        const itensLimitados = itensFiltrados.slice(0, 100);
        
        setAllItens(itensLimitados);
        setOptions(itensLimitados);
      } else {
        // BACKEND
        const params = new URLSearchParams();
        if (apenasAtivos) {
          params.append('ativo', 'S');
        }
        if (seq_tipo_item) {
          params.append('seq_tipo_item', seq_tipo_item.toString());
        }
        
        const url = `${ENVIRONMENT.apiBaseUrl}/estoque/itens.php?${params}`;
        
        const data = await apiFetch(url);
        
        if (data.success) {
          const itensRecebidos = data.data || [];
          setAllItens(itensRecebidos);
          setOptions(itensRecebidos);
        }
      }
    } catch (error) {
      console.error('❌ [FilterSelectItem] Erro:', error);
      // Em caso de erro, definir array vazio
      setAllItens([]);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const limparSelecao = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('ALL');
    setSelectedItem(null);
  };

  return (
    <div className="grid gap-2">
      {!hideLabel && label && <Label>{label}</Label>}
      <div className="relative">
        <Popover open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            carregarItens();
          }
        }}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className={`w-full justify-start text-left dark:bg-slate-800 dark:border-slate-700 ${selectedItem ? 'pr-16' : 'pr-10'}`}
            >
              <span className={`truncate ${selectedItem ? 'pr-2' : ''}`}>
                {selectedItem ? `${selectedItem.codigo} - ${selectedItem.descricao}` : placeholder}
              </span>
              {selectedItem && (
                <X 
                  className="h-4 w-4 shrink-0 opacity-50 hover:opacity-100 cursor-pointer absolute right-9 top-1/2 -translate-y-1/2" 
                  onClick={(e) => limparSelecao(e)}
                />
              )}
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[500px] p-0 dark:bg-slate-800 dark:border-slate-700">
            <div className="flex flex-col">
              <div className="flex items-center border-b dark:border-slate-700 px-3 py-2">
                <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
                <Input
                  placeholder="Buscar por código ou descrição..."
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
                    Carregando itens...
                  </div>
                ) : options.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum item encontrado.
                  </div>
                ) : (
                  <>
                    {showAll && (
                      <div
                        onClick={() => {
                          onChange('ALL');
                          setSelectedItem(null);
                          setSearchValue('');
                          setOpen(false);
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700"
                      >
                        <span className="text-slate-400">Todos os itens</span>
                      </div>
                    )}
                    {options.map((item) => (
                      <div
                        key={item.seq_item}
                        onClick={() => {
                          onChange(item.seq_item.toString());
                          setSelectedItem(item);
                          setSearchValue('');
                          setOpen(false);
                        }}
                        className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        <div className="flex flex-col gap-1 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm dark:text-slate-100">{item.descricao}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{item.codigo}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Código: {item.codigo}</span>
                            <span className={`px-2 py-0.5 rounded ${item.ativo === 'S' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {item.ativo === 'S' ? 'Ativo' : 'Inativo'}
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
      </div>
    </div>
  );
}