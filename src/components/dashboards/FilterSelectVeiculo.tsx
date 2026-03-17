import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { apiFetch } from '../../utils/apiUtils';
import { Loader2, Search, Truck } from 'lucide-react';

export interface Veiculo {
  placa: string;
  marca: string;
  modelo: string;
  tipo: string;
  proprietario: string;
  propriedade: string;
}

interface FilterSelectVeiculoProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function FilterSelectVeiculo({ value, onChange, placeholder = 'Digite placa, marca, modelo, tipo ou proprietário' }: FilterSelectVeiculoProps) {
  const [search, setSearch] = useState(value);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ MODIFICADO: Buscar veículos quando search mudar (debounce)
  // Se search vazio E dropdown aberto → buscar todos
  // Se search preenchido → buscar filtrado
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showDropdown) {
        searchVeiculos(search);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [search, showDropdown]);

  // Atualizar search quando value externo mudar
  useEffect(() => {
    setSearch(value);
  }, [value]);

  const searchVeiculos = async (term: string) => {
    setLoading(true);
    try {
      const response = await apiFetch('/sistema/api/search_veiculos.php', {
        method: 'POST',
        body: JSON.stringify({ search: term }),
      });

      if (response.success && response.data) {
        setVeiculos(response.data);
        setShowDropdown(response.data.length > 0);
      } else {
        setVeiculos([]);
        setShowDropdown(false);
      }
    } catch (error) {
      console.error('❌ Erro ao buscar veículos:', error);
      setVeiculos([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (veiculo: Veiculo) => {
    setSearch(veiculo.placa);
    onChange(veiculo.placa);
    setShowDropdown(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    setSearch(newValue);
    onChange(newValue);
  };

  const handleClear = () => {
    setSearch('');
    onChange('');
    setVeiculos([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          {loading ? (
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>
        <Input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => {
            // ✅ CRÍTICO: Ao clicar, abrir dropdown
            // O useEffect vai cuidar de buscar os veículos
            setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="pl-10 pr-20 dark:bg-slate-800 dark:border-slate-700 placeholder:normal-case uppercase"
          maxLength={7}
        />
        {search && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown com resultados */}
      {showDropdown && veiculos.length > 0 && (
        <div 
          className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-80 overflow-y-auto"
          onWheel={(e) => e.stopPropagation()}
          style={{ overscrollBehavior: 'contain' }}
        >
          <div className="p-2">
            <div className="text-xs text-slate-500 dark:text-slate-400 px-2 py-1 mb-1">
              {veiculos.length} veículo{veiculos.length !== 1 ? 's' : ''} encontrado{veiculos.length !== 1 ? 's' : ''}
            </div>
            {veiculos.map((veiculo, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelect(veiculo)}
                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <Truck className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {veiculo.placa}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400">
                        {veiculo.tipo}
                      </span>
                    </div>
                    {(veiculo.marca || veiculo.modelo) && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {veiculo.marca} {veiculo.modelo}
                      </div>
                    )}
                    {veiculo.proprietario && (
                      <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-1">
                        <span className="font-medium">{veiculo.proprietario}</span>
                        {veiculo.propriedade && (
                          <>
                            <span>•</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              veiculo.propriedade === 'FROTA'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : veiculo.propriedade === 'AGREGADO'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                : 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                            }`}>
                              {veiculo.propriedade}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Mensagem quando não há resultados */}
      {showDropdown && veiculos.length === 0 && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
            {search ? `Nenhum veículo encontrado para "${search}"` : 'Nenhum veículo cadastrado'}
          </p>
        </div>
      )}
    </div>
  );
}