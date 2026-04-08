import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { mockDREData, MOCK_DOMAINS } from '../../mocks/mockData';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../ThemeProvider';
import { getDomain } from '../../services/domainService';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { usePageTitle } from '../../hooks/usePageTitle';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Percent,
  PieChart,
  Wallet,
  Layers,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { OverviewPage } from './OverviewPage';
import { RevenuePage } from './RevenuePage';
import { CostsPage } from './CostsPage';
import { ProfitabilityPage } from './ProfitabilityPage';
import { PeriodFilter, PeriodRange } from './PeriodFilter';
import { formatPeriod, loadPeriod, savePeriod } from '../../utils/periodUtils';
import { ErrorBoundary } from '../ErrorBoundary';

export function FinanceiroDashboard() {
  
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  
  usePageTitle('DRE - Dashboard Financeiro');
  
  // Estados
  const [period, setPeriod] = useState<PeriodRange>(() => loadPeriod());
  const [viewMode, setViewMode] = useState<'GERAL' | 'CARGAS' | 'PASSAGEIROS'>('GERAL');
  const [activeTab, setActiveTab] = useState<string>(() => {
    // Tentar restaurar última aba ativa do localStorage
    const savedTab = localStorage.getItem('presto_last_tab');
    return savedTab || 'overview';
  });
  
  // Determinar domínio e modalidade
  const domainModalidade = MOCK_DOMAINS[user?.domain as keyof typeof MOCK_DOMAINS]?.modalidade || 'CARGAS';
  const showModalidadeSelector = domainModalidade === 'MISTA';
  
  // Salvar aba ativa quando mudar
  useEffect(() => {
    localStorage.setItem('presto_last_tab', activeTab);
  }, [activeTab]);
  
  const handlePeriodChange = (newPeriod: PeriodRange) => {
    setPeriod(newPeriod);
    savePeriod(newPeriod);
  };

  const modules = user?.clientConfig?.modules || {
    overview: true,
    revenue: true,
    costs: true,
    profitability: true
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
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewMode('GERAL')}
                  className={`flex items-center gap-1.5 px-2 md:px-3 py-1.5 rounded-md transition-all ${
                    viewMode === 'GERAL'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
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
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
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
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
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
          <p className="text-muted-foreground text-xs md:text-sm hidden md:block">Período</p>
          <p className="text-foreground text-xs md:text-base">{formatPeriod(period)}</p>
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
      title="DRE - Dashboard Financeiro"
      description={user?.client_name}
      headerActions={headerActions}
    >
      {/* Menu de Tabs */}
      <div className="fixed top-12 md:top-16 left-0 right-0 z-30 bg-card border-b border-border shadow-sm print:relative">
        <div className="container mx-auto px-3 md:px-6 flex justify-center py-2 md:py-3">
          <div className="inline-flex items-center bg-muted rounded-lg p-1">
            {modules.overview && (
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-md transition-all ${
                  activeTab === 'overview'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <PieChart className="w-4 h-4" />
                <span className="text-sm hidden md:inline">Visão Geral</span>
              </button>
            )}
            {modules.revenue && (
              <button
                onClick={() => setActiveTab('revenue')}
                className={`flex items-center gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-md transition-all ${
                  activeTab === 'revenue'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span className="text-sm hidden md:inline">Receitas</span>
              </button>
            )}
            {modules.costs && (
              <button
                onClick={() => setActiveTab('costs')}
                className={`flex items-center gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-md transition-all ${
                  activeTab === 'costs'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Wallet className="w-4 h-4" />
                <span className="text-sm hidden md:inline">Despesas</span>
              </button>
            )}
            {modules.profitability && (
              <button
                onClick={() => setActiveTab('profitability')}
                className={`flex items-center gap-2 px-2 md:px-4 py-1.5 md:py-2 rounded-md transition-all ${
                  activeTab === 'profitability'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm hidden md:inline">Rentabilidade</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-3 md:px-6">
        {/* Conteúdo */}
        <div className="pt-16 md:pt-20 pb-6">
          <div className="space-y-6 mt-0">
            {modules.overview && activeTab === 'overview' && <OverviewPage viewMode={viewMode} domainModalidade={domainModalidade} period={period} />}
            {modules.revenue && activeTab === 'revenue' && <RevenuePage viewMode={viewMode} domainModalidade={domainModalidade} period={period} />}
            {modules.costs && activeTab === 'costs' && <CostsPage viewMode={viewMode} domainModalidade={domainModalidade} period={period} />}
            {modules.profitability && activeTab === 'profitability' && <ProfitabilityPage viewMode={viewMode} domainModalidade={domainModalidade} period={period} />}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}