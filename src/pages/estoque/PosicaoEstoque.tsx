import React from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { BarChart3, AlertCircle } from 'lucide-react';
import { usePageTitle } from '../../hooks/usePageTitle';

export default function PosicaoEstoque() {
  usePageTitle('Posição de Estoque');
  
  return (
    <AdminLayout
      title="POSIÇÃO DE ESTOQUE"
      icon={<BarChart3 className="w-6 h-6" />}
      breadcrumbs={[
        { label: 'Estoque', path: '#' },
        { label: 'Posição de Estoque' }
      ]}
    >
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/20 p-6">
              <BarChart3 className="w-16 h-16 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-3">
            FUNCIONALIDADE EM DESENVOLVIMENTO
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            O relatório de <strong>Posição de Estoque</strong> está sendo desenvolvido e estará disponível em breve.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
            <div className="flex gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                  Funcionalidades Planejadas:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                  <li>• Visualização em tempo real do estoque</li>
                  <li>• Filtros por produto, categoria e local</li>
                  <li>• Alertas de estoque baixo</li>
                  <li>• Exportação de dados</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}