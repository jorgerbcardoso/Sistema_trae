/**
 * Indicador de Fonte de Dados
 * Mostra se os dados são Mock ou Backend
 */

import React from 'react';
import { AlertTriangle, Database, TestTube2 } from 'lucide-react';

interface DataSourceIndicatorProps {
  isMockData: boolean;
}

export function DataSourceIndicator({ isMockData }: DataSourceIndicatorProps) {
  if (isMockData) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-xs print:hidden">
        <TestTube2 className="w-3 h-3 text-amber-700 dark:text-amber-400" />
        <span className="text-amber-800 dark:text-amber-300">Dados Mock</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 text-xs print:hidden">
      <Database className="w-3 h-3 text-green-700 dark:text-green-400" />
      <span className="text-green-800 dark:text-green-300">Backend Real</span>
    </div>
  );
}
