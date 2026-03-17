import React, { useEffect, useState } from 'react';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { MOCK_ITENS } from '../../mocks/estoqueComprasMocks';

interface FilterSelectItemProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  disabled?: boolean;
  seqTipoItem?: number;
}

export function FilterSelectItem({ value, onChange, label = 'Item', disabled, seqTipoItem }: FilterSelectItemProps) {
  const [itens, setItens] = useState(MOCK_ITENS);

  // Filtrar por tipo de item se fornecido
  const itensFiltrados = seqTipoItem
    ? itens.filter(i => i.seq_tipo_item === seqTipoItem && i.ativo === 'S')
    : itens.filter(i => i.ativo === 'S');

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
          {itensFiltrados.map((item) => (
            <SelectItem key={item.seq_item} value={item.seq_item.toString()}>
              {item.codigo} - {item.descricao}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}