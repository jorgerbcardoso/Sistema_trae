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
import { MOCK_CENTROS_CUSTO } from '../../utils/estoqueModData';
import { useAuth } from '../../contexts/AuthContext';
import { formatCodigoCentroCusto } from '../../utils/formatters';

interface CentroCusto {
  seq_centro_custo: number;
  unidade: string;
  nro_centro_custo: string;
  descricao: string;
  ativo: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  apenasAtivos?: boolean;
  unidadeFiltro?: string; // ✅ Prop para filtrar por unidade específica
  allowClear?: boolean; // ✅ NOVO: Permitir limpar seleção
}

export function FilterSelectCentroCusto({ 
  value, 
  onChange, 
  label = "Centro de Custo", 
  placeholder = "Selecione o centro de custo",
  apenasAtivos = true,
  unidadeFiltro,
  allowClear = true
}: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [options, setOptions] = useState<CentroCusto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCentroCusto, setSelectedCentroCusto] = useState<CentroCusto | null>(null);
  const [allCentrosCusto, setAllCentrosCusto] = useState<CentroCusto[]>([]);

  // Carregar centros de custo quando unidadeFiltro mudar
  useEffect(() => {
    carregarCentrosCusto();
  }, [apenasAtivos, unidadeFiltro]);

  // Atualizar seleção quando value mudar
  useEffect(() => {
    if (value && allCentrosCusto.length > 0) {
      const cc = allCentrosCusto.find(c => c.seq_centro_custo.toString() === value);
      setSelectedCentroCusto(cc || null);
    } else {
      setSelectedCentroCusto(null);
    }
  }, [value, allCentrosCusto]);

  // Filtrar localmente quando buscar
  useEffect(() => {
    if (searchValue.length > 0) {
      const filtrados = allCentrosCusto.filter(cc =>
        cc.descricao.toLowerCase().includes(searchValue.toLowerCase()) ||
        cc.nro_centro_custo.toLowerCase().includes(searchValue.toLowerCase()) ||
        cc.unidade.toLowerCase().includes(searchValue.toLowerCase())
      );
      setOptions(filtrados);
    } else {
      setOptions(allCentrosCusto);
    }
  }, [searchValue, allCentrosCusto]);

  const carregarCentrosCusto = async () => {
    setLoading(true);
    
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        let filtrados = [...MOCK_CENTROS_CUSTO];
        
        if (apenasAtivos) {
          filtrados = filtrados.filter(cc => cc.ativo === 'S');
        }
        
        // ✅ REGRA DE UNIDADE: MTZ vê todos, outros só da sua unidade
        if (user?.unidade && user.unidade !== 'MTZ') {
          filtrados = filtrados.filter(cc => cc.unidade === user.unidade);
        }
        
        // ✅ Aplicar filtro de unidade se fornecido
        if (unidadeFiltro) {
          filtrados = filtrados.filter(cc => cc.unidade === unidadeFiltro);
        }
        
        setAllCentrosCusto(filtrados);
        setOptions(filtrados);
      } else {
        // BACKEND
        const params = new URLSearchParams();
        if (apenasAtivos) {
          params.append('ativo', 'S');
        }
        
        const url = `${ENVIRONMENT.apiBaseUrl}/compras/centros_custo.php?${params}`;
        const data = await apiFetch(url);
        
        if (data.success) {
          const centrosRecebidos = data.data || [];
          setAllCentrosCusto(centrosRecebidos);
          setOptions(centrosRecebidos);
        }
      }
    } catch (error) {
      console.error('❌ [FilterSelectCentroCusto] Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-2">
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Popover open={open} onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen && allCentrosCusto.length === 0) {
            carregarCentrosCusto();
          }
        }}>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              className="w-full justify-start text-left dark:bg-slate-800 dark:border-slate-700 relative"
            >
              <span className={`truncate ${selectedCentroCusto ? 'pr-16' : 'pr-10'}`}>
                {selectedCentroCusto 
                  ? `${formatCodigoCentroCusto(selectedCentroCusto.unidade, selectedCentroCusto.nro_centro_custo)} - ${selectedCentroCusto.descricao}` 
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
                  placeholder="Buscar por unidade, número ou descrição..."
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
                    Carregando centros de custo...
                  </div>
                ) : options.length === 0 ? (
                  <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Nenhum centro de custo encontrado.
                  </div>
                ) : (
                  options.map((cc) => (
                    <div
                      key={cc.seq_centro_custo}
                      onClick={() => {
                        onChange(cc.seq_centro_custo.toString());
                        setSelectedCentroCusto(cc);
                        setSearchValue('');
                        setOpen(false);
                      }}
                      className="relative flex cursor-pointer select-none items-center rounded-sm px-3 py-3 hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                    >
                      <div className="flex flex-col gap-1 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm dark:text-slate-100">{cc.descricao}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                            {formatCodigoCentroCusto(cc.unidade, cc.nro_centro_custo)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span>Unidade: {cc.unidade}</span>
                          <span className={`px-2 py-0.5 rounded ${cc.ativo === 'S' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {cc.ativo === 'S' ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        {selectedCentroCusto && allowClear && (
          <button
            type="button"
            className="absolute right-8 top-1/2 -translate-y-1/2 z-10 hover:bg-slate-100 dark:hover:bg-slate-700 rounded p-0.5"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onChange('');
              setSelectedCentroCusto(null);
            }}
          >
            <X className="h-4 w-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" />
          </button>
        )}
      </div>
    </div>
  );
}