import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface SortableTableHeaderProps<T extends string> {
  field: T;
  label: string;
  currentSortField: T;
  currentSortDirection: 'asc' | 'desc';
  onSort: (field: T) => void;
  className?: string;
}

export function SortableTableHeader<T extends string>({
  field,
  label,
  currentSortField,
  currentSortDirection,
  onSort,
  className = ''
}: SortableTableHeaderProps<T>) {
  const isActive = currentSortField === field;

  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-foreground uppercase tracking-wider ${className}`}>
      <button
        onClick={() => onSort(field)}
        className="flex items-center hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {label}
        {isActive ? (
          currentSortDirection === 'asc' ? (
            <ArrowUp className="w-4 h-4 ml-1 text-blue-600 dark:text-blue-400" />
          ) : (
            <ArrowDown className="w-4 h-4 ml-1 text-blue-600 dark:text-blue-400" />
          )
        ) : (
          <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400 dark:text-gray-500" />
        )}
      </button>
    </th>
  );
}

// Hook para gerenciar ordenação de forma consistente
export function useSortableTable<T extends string>(defaultField: T, defaultDirection: 'asc' | 'desc' = 'asc') {
  const [sortField, setSortField] = React.useState<T>(defaultField);
  const [sortDirection, setSortDirection] = React.useState<'asc' | 'desc'>(defaultDirection);

  const handleSort = (field: T) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortData = <D extends Record<string, any>>(data: D[]): D[] => {
    return [...data].sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      // Tratar valores nulos
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';

      // Ordenar strings
      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal, 'pt-BR', { numeric: true }) 
          : bVal.localeCompare(aVal, 'pt-BR', { numeric: true });
      }
      
      // Ordenar números
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
  };

  return {
    sortField,
    sortDirection,
    handleSort,
    sortData
  };
}