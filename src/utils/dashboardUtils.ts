/**
 * Utilitários para Dashboard
 */

import { PeriodRange } from '../components/dashboards/PeriodFilter';
import { DashboardPeriod } from '../services/dashboardService';

/**
 * Converter PeriodRange (frontend) para DashboardPeriod (service)
 */
export function periodRangeToDashboardPeriod(period: PeriodRange): DashboardPeriod {
  // Período customizado (range de meses)
  const startDate = `${period.startYear}-${String(period.startMonth).padStart(2, '0')}-01`;
  
  // ✅ CORREÇÃO CRÍTICA: Calcular o último dia REAL do mês (não fixar em 31)
  // Usar Date nativo do JavaScript para obter o último dia correto
  const lastDay = new Date(period.endYear, period.endMonth, 0).getDate();
  const endDate = `${period.endYear}-${String(period.endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  
  return {
    type: 'custom',
    startDate,
    endDate,
  };
}