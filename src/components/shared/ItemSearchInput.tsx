import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiUtils';

interface Item {
  seq_item: number;
  codigo: string;
  descricao: string;
  tipo_descricao?: string;
  unidade_medida_sigla?: string;
}

interface ItemSearchInputProps {
  value: string; // seq_item como string
  onChange: (seqItem: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  seqTipoItem?: number; // Filtrar por tipo de item
}

/**
 * 🔍 COMPONENTE DE BUSCA DE ITENS
 * 
 * Funcionalidades:
 * - Exibe TODAS as opções ao clicar no input
 * - Filtra itens ao digitar (busca por código ou descrição)
 * - Retorna o seq_item do item selecionado
 * - Reutilizável em qualquer tela
 * 
 * @example
 * <ItemSearchInput
 *   value={formData.seq_item?.toString() || ''}
 *   onChange={(seq) => updateFormData('seq_item', seq ? Number(seq) : undefined)}
 *   label="Item"
 *   required
 * />
 */
export function ItemSearchInput({
  value,
  onChange,
  label = "Item",
  placeholder = "Busque por código ou descrição...",
  disabled = false,
  required = false,
  className = "",
  seqTipoItem
}: ItemSearchInputProps) {
  const { user } = useAuth();
  const [itens, setItens] = useState<Item[]>([]);
  const [filteredItens, setFilteredItens] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 📥 BUSCAR ITENS DA API
  useEffect(() => {
    const fetchItens = async () => {
      if (!user?.domain) {
        console.log('⚠️ [ItemSearchInput] Sem domínio do usuário');
        return;
      }

      console.log('🔍 [ItemSearchInput] Buscando itens para domínio:', user.domain);
      setIsLoading(true);
      try {
        // Construir URL com filtros
        const params = new URLSearchParams({
          ativo: 'S',
          _t: Date.now().toString()
        });

        if (seqTipoItem) {
          params.append('seq_tipo_item', seqTipoItem.toString());
        }

        const url = `/sistema/api/estoque/itens.php?${params.toString()}`;
        console.log('📡 [ItemSearchInput] URL COMPLETA:', url);
        
        const data = await apiFetch(url);
        console.log('📦 [ItemSearchInput] Dados recebidos:', data);

        if (data.success && Array.isArray(data.data)) {
          console.log('✅ [ItemSearchInput] Itens carregados:', data.data.length);
          setItens(data.data);
          setFilteredItens(data.data);
        } else {
          console.warn('⚠️ [ItemSearchInput] Resposta sem sucesso ou sem dados array');
          setItens([]);
          setFilteredItens([]);
        }
      } catch (error) {
        console.error('❌ [ItemSearchInput] Erro ao buscar itens:', error);
        setItens([]);
        setFilteredItens([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchItens();
  }, [user?.domain, seqTipoItem]);

  // 🔍 FILTRAR ITENS AO DIGITAR
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredItens(itens);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = itens.filter(
        (item) =>
          item.codigo.toLowerCase().includes(term) ||
          item.descricao.toLowerCase().includes(term)
      );
      setFilteredItens(filtered);
    }
  }, [searchTerm, itens]);

  // 🎯 SINCRONIZAR ITEM SELECIONADO COM VALUE EXTERNO
  useEffect(() => {
    if (value) {
      const item = itens.find((i) => i.seq_item.toString() === value);
      if (item) {
        setSelectedItem(item);
        setSearchTerm(''); // Limpar busca quando selecionado
      }
    } else {
      setSelectedItem(null);
      setSearchTerm('');
    }
  }, [value, itens]);

  // 🖱️ FECHAR DROPDOWN AO CLICAR FORA
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm(''); // Limpar busca ao fechar
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ SELECIONAR ITEM
  const handleSelectItem = (item: Item) => {
    setSelectedItem(item);
    onChange(item.seq_item.toString());
    setIsOpen(false);
    setSearchTerm('');
  };

  // ❌ LIMPAR SELEÇÃO
  const handleClear = () => {
    setSelectedItem(null);
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  // 🖱️ ABRIR DROPDOWN AO CLICAR NO INPUT
  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  // ⌨️ ATUALIZAR BUSCA AO DIGITAR
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* LABEL */}
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {/* INPUT CONTAINER */}
      <div className="relative">
        {/* DISPLAY DO ITEM SELECIONADO */}
        {selectedItem && !isOpen ? (
          <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-card">
            <span className="flex-1 text-sm text-foreground">
              <span className="font-semibold">{selectedItem.codigo}</span> - {selectedItem.descricao}
              {selectedItem.unidade_medida_sigla && (
                <span className="text-xs text-gray-500 ml-2">({selectedItem.unidade_medida_sigla})</span>
              )}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ) : (
          /* INPUT DE BUSCA */
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-gray-500" />
            <Input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onClick={handleInputClick}
              placeholder={placeholder}
              disabled={disabled}
              className="pl-9"
            />
          </div>
        )}

        {/* DROPDOWN DE OPÇÕES */}
        {isOpen && !disabled && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Carregando itens...
              </div>
            ) : filteredItens.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? 'Nenhum item encontrado.' : 'Nenhum item disponível.'}
              </div>
            ) : (
              <div className="py-1">
                {filteredItens.map((item) => (
                  <button
                    key={item.seq_item}
                    type="button"
                    onClick={() => handleSelectItem(item)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                  >
                    <div className="flex flex-col">
                      <div>
                        <span className="font-semibold">{item.codigo}</span> - {item.descricao}
                      </div>
                      {(item.tipo_descricao || item.unidade_medida_sigla) && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {item.tipo_descricao}
                          {item.tipo_descricao && item.unidade_medida_sigla && ' • '}
                          {item.unidade_medida_sigla}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}