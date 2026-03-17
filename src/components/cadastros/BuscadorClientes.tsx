import React, { useEffect, useState } from 'react';
import { Input } from '../ui/input';
import { Search, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Button } from '../ui/button';
import { ENVIRONMENT } from '../../config/environment';
import { mockSearchClientes } from '../../mocks/mockData';
import { apiFetch } from '../../utils/apiUtils';

interface Cliente {
  cnpj: string;
  nome: string;
  cidade: string;
  dataUltMovimento?: string;
}

interface BuscadorClientesProps {
  onSelect: (cliente: { cnpj: string; nome: string }) => void; // ✅ Retorna CNPJ
  selectedNome?: string;
}

export function BuscadorClientes({ onSelect, selectedNome }: BuscadorClientesProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(false);

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
    console.log(`🔍 [BuscadorClientes] Buscando clientes com termo:`, searchValue);
    
    if (ENVIRONMENT.isFigmaMake) {
      const result = await mockSearchClientes(searchValue);
      console.log(`📦 [BuscadorClientes] Resultado do mock:`, result);
      if (result.success) {
        console.log(`✅ [BuscadorClientes] Clientes encontrados:`, result.clientes.length, result.clientes);
        setOptions(result.clientes);
      } else {
        console.log(`❌ [BuscadorClientes] Mock retornou success=false`);
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
          // ✅ Agora a API retorna o campo 'codigo' (cod_cli)
          setOptions(result.clientes);
        }
      } catch (error) {
        console.error(`❌ [BuscadorClientes] Erro ao buscar clientes:`, error);
      }
    }
    setLoading(false);
  };

  const handleClear = () => {
    onSelect({ cnpj: '', nome: '' });
    setSearchValue('');
  };

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="flex-1 justify-between text-left dark:bg-slate-800 dark:border-slate-700">
            <span className="truncate">
              {selectedNome || 'Selecione um cliente...'}
            </span>
            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent 
          className="p-0 dark:bg-slate-800 dark:border-slate-700"
          style={{ width: '800px', maxWidth: '95vw' }}
          side="bottom"
          align="start"
          avoidCollisions={false}
        >
          <div className="flex flex-col">
            <div className="flex items-center border-b dark:border-slate-700 px-4 py-3 bg-slate-50 dark:bg-slate-900">
              <Search className="h-4 w-4 shrink-0 opacity-50 mr-2" />
              <Input
                placeholder={`Digite ${minChars}+ caracteres para buscar...`}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-8 dark:bg-slate-900 bg-slate-50"
                autoFocus
              />
            </div>
            <div 
              className="max-h-[400px] overflow-y-auto overscroll-contain"
              onWheel={(e) => e.stopPropagation()}
              style={{ overscrollBehavior: 'contain' }}
            >
              {searchValue.length < minChars ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Digite pelo menos {minChars} caracteres para buscar...
                </div>
              ) : loading ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Buscando...
                </div>
              ) : options.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Nenhum cliente encontrado.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {options.map((cliente) => (
                    <div
                      key={cliente.cnpj}
                      onClick={() => {
                        console.log(`✅ [BuscadorClientes] Cliente selecionado:`, cliente);
                        onSelect({ cnpj: cliente.cnpj, nome: cliente.nome });
                        setSearchValue('');
                        setOpen(false);
                      }}
                      className="cursor-pointer px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        {/* Nome do Cliente - 6 colunas */}
                        <div className="col-span-6">
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                            {cliente.nome}
                          </div>
                        </div>
                        
                        {/* CNPJ - 3 colunas */}
                        <div className="col-span-3">
                          <div className="text-xs text-slate-600 dark:text-slate-400 font-mono">
                            CNPJ: {cliente.cnpj}
                          </div>
                        </div>
                        
                        {/* Cidade - 2 colunas */}
                        <div className="col-span-2">
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            {cliente.cidade}
                          </div>
                        </div>
                        
                        {/* Última Movimentação - 1 coluna */}
                        <div className="col-span-1 text-right">
                          <div className="text-xs text-slate-500 dark:text-slate-500">
                            {cliente.dataUltMovimento || '-'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {selectedNome && (
        <Button
          variant="outline"
          size="icon"
          onClick={handleClear}
          title="Limpar seleção"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}