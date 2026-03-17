import React, { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { Search } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Button } from '../ui/button';
import { ENVIRONMENT } from '../../config/environment';
import { mockSearchClientes } from '../../mocks/mockData';
import { apiFetch } from '../../utils/apiUtils';
import { X } from 'lucide-react';

interface Cliente {
  cnpj: string;
  nome: string;
  cidade: string;
  dataUltMovimento?: string;
}

interface FilterSelectClienteProps {
  type: 'pagador' | 'destinatario';
  value: string;
  onChange: (value: string) => void;
}

export function FilterSelectCliente({ type, value, onChange }: FilterSelectClienteProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);

  const label = type === 'pagador' ? 'Todos os remetentes' : 'Todos os destinatários';
  const minChars = 3;

  // Buscar quando digitar 3+ caracteres
  useEffect(() => {
    if (searchValue.length >= minChars) {
      searchClientes();
    } else {
      setOptions([]);
    }
  }, [searchValue]);

  const searchClientes = async () => {
    setLoading(true);
    console.log(`🔍 Buscando clientes com termo:`, searchValue);
    
    if (ENVIRONMENT.isFigmaMake) {
      const result = await mockSearchClientes(searchValue);
      console.log(`📦 Resultado do mock:`, result);
      if (result.success) {
        console.log(`✅ Clientes encontrados:`, result.clientes.length, result.clientes);
        setOptions(result.clientes);
      } else {
        console.log(`❌ Mock retornou success=false`);
      }
    } else {
      try {
        const token = localStorage.getItem('auth_token');
        const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/dashboards/performance-entregas/search_clientes.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ search: searchValue })
        });

        if (result.success) {
          setOptions(result.clientes);
        }
      } catch (error) {
        console.error(`❌ Erro ao buscar clientes:`, error);
      }
    }
    setLoading(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          className="w-full justify-start text-left dark:bg-slate-800 dark:border-slate-700 relative"
        >
          <span className={`truncate ${selectedCliente ? 'pr-16' : 'pr-10'}`}>
            {selectedCliente ? selectedCliente.nome : label}
          </span>
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[500px] p-0 dark:bg-slate-800 dark:border-slate-700">
        <div className="flex flex-col">
          <div className="flex items-center border-b dark:border-slate-700 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
            <Input
              placeholder={`Digite ${minChars}+ caracteres para buscar...`}
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
            {searchValue.length < minChars ? (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Digite pelo menos {minChars} caracteres para buscar...
              </div>
            ) : loading ? (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Buscando...
              </div>
            ) : options.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                Nenhum cliente encontrado.
              </div>
            ) : (
              options.map((cliente) => (
                <div
                  key={cliente.cnpj}
                  onClick={() => {
                    console.log(`✅ Cliente selecionado:`, cliente);
                    onChange(cliente.cnpj);
                    setSelectedCliente(cliente);
                    setSearchValue('');
                    setOpen(false);
                  }}
                  className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                >
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm dark:text-slate-100">{cliente.nome}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{cliente.cnpj}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{cliente.cidade}</span>
                      <span className="text-xs">Últ. Mov: {cliente.dataUltMovimento || '-'}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
      {selectedCliente && (
        <button
          type="button"
          className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hover:bg-slate-100 dark:hover:bg-slate-700 rounded p-0.5"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onChange('');
            setSelectedCliente(null);
          }}
        >
          <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
        </button>
      )}
    </Popover>
  );
}