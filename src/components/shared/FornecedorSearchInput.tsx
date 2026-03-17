import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiUtils';

interface Fornecedor {
  seq_fornecedor: number;
  cnpj: string;
  nome: string;
  cidade_nome?: string;
  cidade_uf?: string;
  ativo: string;
}

interface FornecedorSearchInputProps {
  value: string; // seq_fornecedor como string
  onChange: (seqFornecedor: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * 🔍 COMPONENTE DE BUSCA DE FORNECEDORES
 * 
 * Funcionalidades:
 * - Exibe TODAS as opções ao clicar no input
 * - Filtra fornecedores ao digitar (busca por nome ou CNPJ)
 * - Retorna o seq_fornecedor do fornecedor selecionado
 * - Reutilizável em qualquer tela
 * 
 * @example
 * <FornecedorSearchInput
 *   value={formData.seq_fornecedor?.toString() || ''}
 *   onChange={(seq) => updateFormData('seq_fornecedor', seq ? Number(seq) : undefined)}
 *   label="Fornecedor"
 *   required
 * />
 */
export function FornecedorSearchInput({
  value,
  onChange,
  label = "Fornecedor",
  placeholder = "Busque por nome ou CNPJ...",
  disabled = false,
  required = false,
  className = ""
}: FornecedorSearchInputProps) {
  const { user } = useAuth();
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [filteredFornecedores, setFilteredFornecedores] = useState<Fornecedor[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFornecedor, setSelectedFornecedor] = useState<Fornecedor | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 📥 BUSCAR FORNECEDORES DA API (COM DEBOUNCE)
  useEffect(() => {
    const fetchFornecedores = async (search: string) => {
      if (!user?.domain) {
        console.log('⚠️ [FornecedorSearchInput] Sem domínio do usuário');
        return;
      }

      console.log('🔍 [FornecedorSearchInput] Buscando fornecedores:', search);
      setIsLoading(true);
      try {
        let url = `/sistema/api/compras/fornecedores/list.php?limit=200&_t=${Date.now()}`;
        if (search && search.trim() !== '') {
          url += `&search=${encodeURIComponent(search)}`;
        }
        console.log('📡 [FornecedorSearchInput] URL:', url);
        
        const data = await apiFetch(url);

        if (data.success && Array.isArray(data.fornecedores)) {
          // Filtrar apenas fornecedores ativos
          const fornecedoresAtivos = data.fornecedores.filter((f: Fornecedor) => f.ativo === 'S');
          console.log('✅ [FornecedorSearchInput] Fornecedores carregados:', fornecedoresAtivos.length);
          setFornecedores(fornecedoresAtivos);
          setFilteredFornecedores(fornecedoresAtivos);
        } else {
          setFornecedores([]);
          setFilteredFornecedores([]);
        }
      } catch (error) {
        console.error('❌ [FornecedorSearchInput] Erro ao buscar fornecedores:', error);
        setFornecedores([]);
        setFilteredFornecedores([]);
      } finally {
        setIsLoading(false);
      }
    };

    // ✅ DEBOUNCE: Espera 500ms após parar de digitar
    const timer = setTimeout(() => {
      fetchFornecedores(searchTerm);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, user?.domain]);

  // ✅ REMOVIDO: O filtro agora é feito no BACKEND

  // 🎯 SINCRONIZAR FORNECEDOR SELECIONADO COM VALUE EXTERNO
  useEffect(() => {
    if (value) {
      const fornecedor = fornecedores.find((f) => f.seq_fornecedor.toString() === value);
      if (fornecedor) {
        setSelectedFornecedor(fornecedor);
        setSearchTerm(''); // Limpar busca quando selecionado
      }
    } else {
      setSelectedFornecedor(null);
      setSearchTerm('');
    }
  }, [value, fornecedores]);

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

  // ✅ SELECIONAR FORNECEDOR
  const handleSelectFornecedor = (fornecedor: Fornecedor) => {
    setSelectedFornecedor(fornecedor);
    onChange(fornecedor.seq_fornecedor.toString());
    setIsOpen(false);
    setSearchTerm('');
  };

  // ❌ LIMPAR SELEÇÃO
  const handleClear = () => {
    setSelectedFornecedor(null);
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
        {/* DISPLAY DO FORNECEDOR SELECIONADO */}
        {selectedFornecedor && !isOpen ? (
          <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-card">
            <span className="flex-1 text-sm text-foreground">
              <span className="font-semibold">{selectedFornecedor.nome}</span>
              {selectedFornecedor.cnpj && (
                <span className="text-xs text-gray-500 ml-2">CNPJ: {selectedFornecedor.cnpj}</span>
              )}
              {selectedFornecedor.cidade_nome && (
                <span className="text-xs text-gray-500 ml-2">
                  • {selectedFornecedor.cidade_nome}/{selectedFornecedor.cidade_uf}
                </span>
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
                Carregando fornecedores...
              </div>
            ) : filteredFornecedores.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? 'Nenhum fornecedor encontrado.' : 'Nenhum fornecedor disponível.'}
              </div>
            ) : (
              <div className="py-1">
                {filteredFornecedores.map((fornecedor) => (
                  <button
                    key={fornecedor.seq_fornecedor}
                    type="button"
                    onClick={() => handleSelectFornecedor(fornecedor)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                  >
                    <div className="flex flex-col">
                      <div>
                        <span className="font-semibold">{fornecedor.nome}</span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {fornecedor.cnpj && `CNPJ: ${fornecedor.cnpj}`}
                        {fornecedor.cnpj && fornecedor.cidade_nome && ' • '}
                        {fornecedor.cidade_nome && `${fornecedor.cidade_nome}/${fornecedor.cidade_uf}`}
                      </div>
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