import { useEffect, useState } from 'react';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';
import { Search, Loader2 } from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

interface Estoque {
  seq_estoque: number;
  unidade: string;
  nro_estoque: string;
  descricao: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

export function FilterSelectEstoqueWithSearch({ value, onChange, label = "Estoque", placeholder = "Todos os estoques" }: Props) {
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    carregarEstoques();
  }, []);

  const carregarEstoques = async () => {
    console.log('🔍 [FilterSelectEstoqueWithSearch] Iniciando carregamento de estoques...');
    setLoading(true);
    try {
      const url = `${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php?ativo=S`;
      console.log('🌐 [FilterSelectEstoqueWithSearch] URL:', url);
      
      const data = await apiFetch(url);
      console.log('📦 [FilterSelectEstoqueWithSearch] Dados recebidos:', data);
      
      if (data.success) {
        console.log('✅ [FilterSelectEstoqueWithSearch] Estoques carregados:', data.data?.length || 0);
        setEstoques(data.data || []);
      } else {
        console.error('❌ [FilterSelectEstoqueWithSearch] Sucesso = false');
      }
    } catch (error) {
      console.error('❌ [FilterSelectEstoqueWithSearch] Erro ao carregar estoques:', error);
    } finally {
      setLoading(false);
    }
  };

  const estoquesFiltrados = estoques.filter(e =>
    e.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.unidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.nro_estoque.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid gap-2">
      {label && <Label>{label}</Label>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
          {/* Campo de busca */}
          <div className="flex items-center gap-2 px-2 pb-2 border-b dark:border-slate-700">
            <Search className="h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por nome ou unidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 border-0 focus-visible:ring-0 dark:bg-slate-900"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <SelectItem value="ALL">
                <span className="text-slate-400">Todos os estoques</span>
              </SelectItem>
              {estoquesFiltrados.map((estoque) => (
                <SelectItem key={estoque.seq_estoque} value={estoque.seq_estoque.toString()}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-600">{estoque.unidade}</span>
                    <span className="text-slate-400">|</span>
                    <span className="font-mono">{estoque.nro_estoque}</span>
                    <span className="text-slate-400">-</span>
                    <span className="text-xs">{estoque.descricao}</span>
                  </div>
                </SelectItem>
              ))}
            </>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}