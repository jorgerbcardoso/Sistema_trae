import React from 'react';
import { usePageTitle } from '../../hooks/usePageTitle';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

/**
 * 📊 CENTRAL DE AGENDAMENTO - Dashboard de Agendamento
 * 
 * Dashboard para gestão e acompanhamento de agendamentos de coletas e entregas.
 * A estrutura segue o padrão dos demais dashboards do sistema.
 */
export function CentralAgendamento() {
  usePageTitle('Central de Agendamento');
  
  console.log('🚀 Central de Agendamento carregada');

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 🎯 CABEÇALHO DO DASHBOARD */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              Central de Agendamento
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Dashboard para gestão e acompanhamento de agendamentos
            </p>
          </div>
        </div>

        {/* 📦 CONTEÚDO PRINCIPAL */}
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Central de Agendamento</CardTitle>
              <CardDescription>
                Dashboard para gestão de agendamentos de coletas, entregas e recursos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <div className="text-4xl mb-4">📅</div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Central de Agendamento
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Sistema de gestão de agendamentos em desenvolvimento
                </p>
                
                <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Funcionalidades previstas:
                  </h4>
                  <ul className="text-left text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    <li>• Agendamento de coletas e entregas</li>
                    <li>• Calendário de recursos e veículos</li>
                    <li>• Controle de prazos e horários</li>
                    <li>• Dashboard de performance</li>
                  </ul>
                </div>
                
                <div className="mt-4 text-xs text-slate-500 dark:text-slate-500">
                  Versão: 1.0.0 | Status: Desenvolvimento
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 📊 EXEMPLO DE CARDS FUTUROS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Métrica 1</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-slate-500 dark:text-slate-500">Em desenvolvimento</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Métrica 2</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-slate-500 dark:text-slate-500">Em desenvolvimento</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Métrica 3</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">-</div>
                <p className="text-xs text-slate-500 dark:text-slate-500">Em desenvolvimento</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}