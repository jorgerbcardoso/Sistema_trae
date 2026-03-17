import { useEffect, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

interface Estoque {
  seq_estoque: number;
  nro_estoque: string;
  descricao: string;
  unidade: string;
}

interface FilterSelectEstoqueProps {
  value: string;
  onChange: (value: string) => void;
  unidade?: string;
}

export function FilterSelectEstoque({ value, onChange, unidade }: FilterSelectEstoqueProps) {
  const [estoques, setEstoques] = useState<Estoque[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarEstoques();
  }, [unidade]);

  const carregarEstoques = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('ativo', 'S');
      if (unidade) {
        params.append('unidade', unidade);
      }

      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/estoques.php?${params}`);
      
      if (data.success) {
        setEstoques(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar estoques:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select value={value} onValueChange={onChange} disabled={loading}>
      <SelectTrigger className="w-full dark:bg-slate-800 dark:border-slate-700">
        <SelectValue placeholder={loading ? "Carregando..." : "Selecione um estoque"} />
      </SelectTrigger>
      <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
        <SelectItem value="ALL">TODOS</SelectItem>
        {estoques.map((estoque) => (
          <SelectItem key={estoque.seq_estoque} value={estoque.seq_estoque.toString()}>
            {estoque.nro_estoque} - {estoque.descricao}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}