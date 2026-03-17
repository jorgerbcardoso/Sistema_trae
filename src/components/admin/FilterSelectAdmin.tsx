import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Shield } from 'lucide-react';

interface FilterSelectAdminProps {
  value: 'all' | 'yes' | 'no';
  onChange: (value: 'all' | 'yes' | 'no') => void;
  disabled?: boolean;
}

export function FilterSelectAdmin({ value, onChange, disabled }: FilterSelectAdminProps) {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as 'all' | 'yes' | 'no')}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue>
          {value === 'all' && 'Todos'}
          {value === 'yes' && 'Sim'}
          {value === 'no' && 'Não'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        <SelectItem value="yes">Sim</SelectItem>
        <SelectItem value="no">Não</SelectItem>
      </SelectContent>
    </Select>
  );
}
