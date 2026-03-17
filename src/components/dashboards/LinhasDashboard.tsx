import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { getDomain } from '../../services/domainService';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { usePageTitle } from '../../hooks/usePageTitle';
import { 
  Layers
} from 'lucide-react';
import { LinesPage } from './LinesPage';
import { PeriodFilter, PeriodRange } from './PeriodFilter';
import { formatPeriod, getPreviousMonthPeriod, savePeriod, getDefaultPeriod } from '../../utils/periodUtils';

/**
 * Dashboard de Resultado das Linhas
 * Mostra apenas o conteúdo da aba Linhas do dashboard financeiro
 * Período padrão: mês anterior ao corrente (fechado)
 */
export function LinhasDashboard() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'GERAL' | 'CARGAS' | 'PASSAGEIROS'>('GERAL');
  
  // Inicializar período com fallback para garantir que nunca seja undefined
  const [period, setPeriod] = useState<PeriodRange>(() => {
    try {
      const prevMonth = getPreviousMonthPeriod();
      console.log('🗓️ [LinhasDashboard] Período do mês anterior:', prevMonth);
      return prevMonth || getDefaultPeriod();
    } catch (error) {
      console.error('❌ [LinhasDashboard] Erro ao obter período anterior:', error);
      return getDefaultPeriod();
    }
  });

  // Atualizar título da página
  usePageTitle('Resultado das Linhas');

  console.log('🎬 [LinhasDashboard] Renderizando. viewMode:', viewMode, 'period:', period);

  // Obter modalidade do domínio
  const currentDomain = getDomain(user?.domain || '');
  const domainModalidade = currentDomain?.modalidade || 'CARGAS';
  const showModalidadeSelector = domainModalidade === 'MISTA';

  const handlePeriodChange = (newPeriod: PeriodRange) => {
    setPeriod(newPeriod);
    savePeriod(newPeriod);
  };

  const features = user?.clientConfig?.features || {
    dark_mode: true,
    print: true,
    export_pdf: false,
    export_excel: false
  };

  // ✅ Construir headerActions com seletores de modalidade e período
  const headerActions = (
    <div className="flex items-center gap-2 md:gap-4">
      {/* Seletor de Modalidade - apenas para domínios MISTA */}
      {showModalidadeSelector && (
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewMode('GERAL')}
                  className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md transition-all ${
                    viewMode === 'GERAL'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span className="text-xs hidden md:inline">Geral</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Visão Geral (Cargas + Passageiros)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewMode('CARGAS')}
                  className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md transition-all ${
                    viewMode === 'CARGAS'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="text-xs hidden md:inline">Cargas</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Apenas Cargas</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewMode('PASSAGEIROS')}
                  className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md transition-all ${
                    viewMode === 'PASSAGEIROS'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-xs hidden md:inline">Passageiros</span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Apenas Passageiros</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}
      
      {/* Filtro de Período */}
      <div className="flex items-center gap-2">
        <div className="text-right print:block">
          <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm hidden md:block">Período</p>
          <p className="text-slate-900 dark:text-slate-100 text-xs md:text-base">{formatPeriod(period)}</p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <PeriodFilter currentPeriod={period} onPeriodChange={handlePeriodChange} />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Filtrar Período</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );

  return (
    <DashboardLayout 
      title="Resultado das Linhas"
      description={user?.client_name}
      headerActions={headerActions}
    >
      {/* Componente de Linhas */}
      <LinesPage 
        viewMode={viewMode} 
        period={period}
      />
    </DashboardLayout>
  );
}