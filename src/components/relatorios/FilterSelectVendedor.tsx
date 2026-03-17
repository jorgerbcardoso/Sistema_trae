import React, { useEffect, useState, useRef } from 'react';
import { Input } from '../ui/input';
import { Search, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover";
import { Button } from '../ui/button';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

interface Vendedor {
  login: string;
  nome: string;
}

interface FilterSelectVendedorProps {
  value: string;
  onChange: (value: string) => void;
}

// ✅ MOCK DATA - Dados obrigatórios
const mockVendedores: Vendedor[] = [
  { login: 'JOAO.SILVA', nome: 'JOÃO DA SILVA' },
  { login: 'MARIA.SANTOS', nome: 'MARIA DOS SANTOS' },
  { login: 'PEDRO.OLIVEIRA', nome: 'PEDRO OLIVEIRA' },
  { login: 'ANA.COSTA', nome: 'ANA COSTA' },
  { login: 'CARLOS.SOUZA', nome: 'CARLOS SOUZA' },
  { login: 'FERNANDA.LIMA', nome: 'FERNANDA LIMA' },
  { login: 'ROBERTO.ALVES', nome: 'ROBERTO ALVES' },
  { login: 'JULIANA.ROCHA', nome: 'JULIANA ROCHA' },
];

export function FilterSelectVendedor({ value, onChange }: FilterSelectVendedorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  // Carregar todos os vendedores quando abrir
  useEffect(() => {
    if (open && options.length === 0) {
      loadAllVendedores();
    }
  }, [open]);

  const loadAllVendedores = async () => {
    setLoading(true);
    
    if (ENVIRONMENT.isFigmaMake) {
      // Mock data
      setOptions(mockVendedores);
    } else {
      try {
        const token = localStorage.getItem('auth_token');
        const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/search_vendedores.php`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ search: '' })
        });

        if (result.success) {
          setOptions(result.vendedores);
        }
      } catch (error) {
        // Erro silencioso
      }
    }
    setLoading(false);
  };

  const filteredOptions = options
    .filter(v => 
      v.nome.toLowerCase().includes(searchValue.toLowerCase()) ||
      v.login.toLowerCase().includes(searchValue.toLowerCase())
    )
    .sort((a, b) => {
      // ✅ PRIORIDADE 1: Match exato de login (case-insensitive)
      const aExactMatch = a.login.toLowerCase() === searchValue.toLowerCase();
      const bExactMatch = b.login.toLowerCase() === searchValue.toLowerCase();
      
      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;
      
      // ✅ PRIORIDADE 2: Login começa com o termo buscado
      const aStartsWithLogin = a.login.toLowerCase().startsWith(searchValue.toLowerCase());
      const bStartsWithLogin = b.login.toLowerCase().startsWith(searchValue.toLowerCase());
      
      if (aStartsWithLogin && !bStartsWithLogin) return -1;
      if (!aStartsWithLogin && bStartsWithLogin) return 1;
      
      // ✅ PRIORIDADE 3: Nome começa com o termo buscado
      const aStartsWithNome = a.nome.toLowerCase().startsWith(searchValue.toLowerCase());
      const bStartsWithNome = b.nome.toLowerCase().startsWith(searchValue.toLowerCase());
      
      if (aStartsWithNome && !bStartsWithNome) return -1;
      if (!aStartsWithNome && bStartsWithNome) return 1;
      
      // ✅ PRIORIDADE 4: Ordem alfabética por login
      return a.login.localeCompare(b.login);
    });

  const selectVendedor = (login: string) => {
    onChange(login);
    setOpen(false);
    setSearchValue('');
  };

  const clearSelection = () => {
    onChange('');
  };

  const selectedVendedor = options.find(v => v.login === value);
  const getButtonText = () => {
    if (!value) return 'Selecione um vendedor';
    return selectedVendedor ? `${selectedVendedor.login} - ${selectedVendedor.nome}` : value;
  };

  // ✅ Handler de wheel personalizado
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
        <Button variant="outline" className="w-full justify-between text-left dark:bg-slate-800 dark:border-slate-700">
          <span className="truncate flex-1">{getButtonText()}</span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {value && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  clearSelection();
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
      <PopoverContent className="w-[500px] p-0" align="start">
        <div className="flex flex-col">
          {/* Campo de busca */}
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por login ou nome..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-8"
                autoFocus
              />
            </div>
          </div>

          {/* Lista de vendedores */}
          <div 
            ref={listRef}
            className="max-h-[300px] overflow-y-auto"
            onWheel={handleWheel}
          >
            {loading ? (
              <div className="p-4 text-center text-muted-foreground">
                Carregando vendedores...
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                Nenhum vendedor encontrado
              </div>
            ) : (
              filteredOptions.map((vendedor) => (
                <button
                  key={vendedor.login}
                  onClick={() => selectVendedor(vendedor.login)}
                  className="w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground flex flex-col cursor-pointer"
                >
                  <span className="font-semibold">{vendedor.login}</span>
                  <span className="text-sm text-muted-foreground">{vendedor.nome}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}