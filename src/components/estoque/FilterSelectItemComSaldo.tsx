/**
 * COMPONENTE: FILTRO DE ITEM COM SALDO EM ESTOQUE
 * Mostra apenas itens que têm saldo no estoque selecionado
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
import { MOCK_ESTOQUES, MOCK_POSICOES, MOCK_ITENS } from '../../utils/estoqueModData'; // 🆕 IMPORTAR MOCKS

interface ItemComSaldo {
  seq_item: number;
  codigo: string;
  descricao: string;
  saldo_total: number;
  unidade_medida_sigla: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  unidade: string;
  nroEstoque: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function FilterSelectItemComSaldo({ 
  value, 
  onChange, 
  unidade,
  nroEstoque,
  label = "Item", 
  placeholder = "Selecione um item",
  disabled = false
}: Props) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<ItemComSaldo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ItemComSaldo | null>(null);
  const [allItens, setAllItens] = useState<ItemComSaldo[]>([]);

  // Carregar itens quando estoque mudar
  useEffect(() => {
    if (unidade && nroEstoque) {
      carregarItens();
    } else {
      setAllItens([]);
      setOptions([]);
      setSelectedItem(null);
    }
  }, [unidade, nroEstoque]);

  // ✅ SINCRONIZAR selectedItem com value prop
  useEffect(() => {
    if (!value || value === '' || value === 'ALL') {
      setSelectedItem(null);
    } else {
      // Buscar item na lista
      const item = allItens.find(i => i.seq_item.toString() === value);
      if (item) {
        setSelectedItem(item);
      }
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
        // 🆕 USAR MOCK NO FIGMA MAKE
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Buscar o estoque pelo unidade + nro_estoque
        const estoque = MOCK_ESTOQUES.find(e => 
          e.unidade === unidade && e.nro_estoque === nroEstoque
        );
        
        console.log('🔍 [FilterSelectItemComSaldo] Estoque encontrado:', estoque);
        
        if (!estoque) {
          console.warn('⚠️ [FilterSelectItemComSaldo] Estoque não encontrado:', { unidade, nroEstoque });
          setAllItens([]);
          setOptions([]);
          setLoading(false);
          return;
        }
        
        // Buscar posições com saldo deste estoque
        const posicoesComSaldo = MOCK_POSICOES.filter(p => 
          p.seq_estoque === estoque.seq_estoque && 
          p.saldo > 0 && 
          p.seq_item !== null
        );
        
        console.log('📦 [FilterSelectItemComSaldo] Posições com saldo:', posicoesComSaldo.length);
        
        // Agrupar por item e somar saldos
        const itensPorSeq = new Map<number, number>();
        posicoesComSaldo.forEach(pos => {
          if (pos.seq_item !== null) {
            const saldoAtual = itensPorSeq.get(pos.seq_item) || 0;
            itensPorSeq.set(pos.seq_item, saldoAtual + pos.saldo);
          }
        });
        
        // Montar lista de itens com saldo
        const itensComSaldo: ItemComSaldo[] = Array.from(itensPorSeq.entries()).map(([seqItem, saldoTotal]) => {
          const item = MOCK_ITENS.find(i => i.seq_item === seqItem);
          if (!item) return null;
          
          return {
            seq_item: item.seq_item,
            codigo: item.codigo,
            descricao: item.descricao,
            saldo_total: saldoTotal,
            unidade_medida_sigla: item.unidade_medida_sigla
          };
        }).filter((item): item is ItemComSaldo => item !== null);
        
        console.log(`✅ [FilterSelectItemComSaldo] ${itensComSaldo.length} itens com saldo carregados`);
        
        setAllItens(itensComSaldo);
        setOptions(itensComSaldo);
      } else {
        // BACKEND REAL
        const params = new URLSearchParams({
          unidade: unidade,
          nro_estoque: nroEstoque,
          apenas_com_saldo: 'S'
        });
        
        const url = `${ENVIRONMENT.apiBaseUrl}/estoque/itens_estoque.php?${params}`;
        
        console.log('🔍 [FilterSelectItemComSaldo] Carregando itens:', {
          unidade,
          nroEstoque,
          url
        });
        
        const data = await apiFetch(url);
        
        console.log('✅ [FilterSelectItemComSaldo] Resposta:', data);
        
        if (data.success) {
          const itensRecebidos = data.data || [];
          console.log(`📦 [FilterSelectItemComSaldo] ${itensRecebidos.length} itens recebidos`);
          setAllItens(itensRecebidos);
          setOptions(itensRecebidos);
        }
      }
    } catch (error) {
      console.error('❌ [FilterSelectItemComSaldo] Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const limparSelecao = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSelectedItem(null);
  };

  return (
    <div className="grid gap-2">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Popover open={open} onOpenChange={(isOpen) => {
          if (disabled || !unidade || !nroEstoque) return;
          setOpen(isOpen);
          if (isOpen) {
            carregarItens();
          }
        }}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-between text-left dark:bg-slate-800 dark:border-slate-700"
              disabled={disabled || !unidade || !nroEstoque}
            >
              <span className="truncate">
                {selectedItem ? `${selectedItem.codigo} - ${selectedItem.descricao}` : placeholder}
              </span>
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[600px] p-0 dark:bg-slate-800 dark:border-slate-700">
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
                    Carregando itens com saldo...
                  </div>
                ) : options.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    {!unidade || !nroEstoque 
                      ? 'Selecione um estoque primeiro' 
                      : 'Nenhum item com saldo neste estoque'}
                  </div>
                ) : (
                  <>
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
                            <span className="font-semibold text-sm dark:text-slate-100">
                              {item.descricao}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {item.codigo}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                            <span>Código: {item.codigo}</span>
                            <span className="px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-semibold">
                              Saldo: {item.saldo_total.toFixed(2)} {item.unidade_medida_sigla}
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
        {selectedItem && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
            onClick={limparSelecao}
          >
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
          </Button>
        )}
      </div>
    </div>
  );
}