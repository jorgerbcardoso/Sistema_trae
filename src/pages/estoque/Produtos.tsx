import React from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Package, AlertCircle } from 'lucide-react';

export default function Produtos() {
  return (
    <AdminLayout
      title="CADASTRO DE PRODUTOS"
      icon={<Package className="w-6 h-6" />}
      breadcrumbs={[
        { label: 'Estoque', path: '#' },
        { label: 'Cadastro de Produtos' }
      ]}
    >
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="mb-6 flex justify-center">
            <div className="rounded-full bg-blue-100 dark:bg-blue-900/20 p-6">
              <Package className="w-16 h-16 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-3">
            FUNCIONALIDADE EM DESENVOLVIMENTO
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            O <strong>Cadastro de Produtos</strong> está sendo desenvolvido e estará disponível em breve.
          </p>
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-left">
            <div className="flex gap-2 mb-2">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">
                  Funcionalidades Planejadas:
                </p>
                <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                  <li>• Cadastro completo de produtos</li>
                  <li>• Controle de categorias e unidades</li>
                  <li>• Gestão de preços e fornecedores</li>
                  <li>• Importação e exportação de dados</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
