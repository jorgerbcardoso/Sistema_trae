import React, { useEffect, useState } from 'react';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { MOCK_FORNECEDORES } from '../../mocks/estoqueComprasMocks';

interface FilterSelectFornecedorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
}

export function FilterSelectFornecedor({ value, onChange, label = 'Fornecedor', disabled }: FilterSelectFornecedorProps) {
  const [fornecedores, setFornecedores] = useState(MOCK_FORNECEDORES);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Todos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">Todos</SelectItem>
          {fornecedores
            .filter(f => f.ativo === 'S')
            .map((fornecedor) => (
              <SelectItem key={fornecedor.seq_fornecedor} value={fornecedor.seq_fornecedor.toString()}>
                {fornecedor.razao_social}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
