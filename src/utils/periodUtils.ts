import { PeriodRange } from '../components/dashboards/PeriodFilter';

const MONTH_ABBR = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

/**
 * Formata um período para exibição compacta
 * Exemplos:
 * - Jan - Out 2025 (mesmo ano)
 * - Dez 2024 - Mar 2025 (anos diferentes)
 * - Jan 2025 (mês único)
 */
export function formatPeriod(period: PeriodRange): string {
  const { startMonth, startYear, endMonth, endYear } = period;
  
  // Mês único
  if (startMonth === endMonth && startYear === endYear) {
    return `${MONTH_ABBR[startMonth - 1]} ${startYear}`;
  }
  
  // Mesmo ano
  if (startYear === endYear) {
    return `${MONTH_ABBR[startMonth - 1]} - ${MONTH_ABBR[endMonth - 1]} ${startYear}`;
  }
  
  // Anos diferentes
  return `${MONTH_ABBR[startMonth - 1]} ${startYear} - ${MONTH_ABBR[endMonth - 1]} ${endYear}`;
}

/**
 * Formata um período para exibição completa
 * Exemplo: Janeiro de 2025 - Outubro de 2025
 */
export function formatPeriodFull(period: PeriodRange): string {
  const MONTHS_FULL = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  const { startMonth, startYear, endMonth, endYear } = period;
  
  // Mês único
  if (startMonth === endMonth && startYear === endYear) {
    return `${MONTHS_FULL[startMonth - 1]} de ${startYear}`;
  }
  
  // Mesmo ano
  if (startYear === endYear) {
    return `${MONTHS_FULL[startMonth - 1]} - ${MONTHS_FULL[endMonth - 1]} de ${startYear}`;
  }
  
  // Anos diferentes
  return `${MONTHS_FULL[startMonth - 1]} de ${startYear} - ${MONTHS_FULL[endMonth - 1]} de ${endYear}`;
}

/**
 * Retorna o período padrão (ano fechado até o mês anterior)
 * REGRA:
 * - Se estamos em Dezembro: Janeiro a Novembro do ano atual
 * - Se estamos em Janeiro: Janeiro a Dezembro do ano anterior
 * - Se estamos em Maio: Janeiro a Abril do ano atual
 * - Se estamos em Março: Janeiro a Fevereiro do ano atual
 * LIMITE MÍNIMO: 01/01/2025
 * 
 * EXEMPLOS:
 * - Hoje: 03/Jan/2026 → Retorna: Jan/2025 - Dez/2025
 * - Hoje: 15/Dez/2025 → Retorna: Jan/2025 - Nov/2025
 * - Hoje: 20/Mai/2025 → Retorna: Jan/2025 - Abr/2025
 * - Hoje: 10/Fev/2025 → Retorna: Jan/2025 - Jan/2025
 */
export function getDefaultPeriod(): PeriodRange {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  
  // ✅ REGRA: Sempre período de Janeiro até o mês ANTERIOR
  let startMonth = 1;
  let startYear = currentYear;
  let endMonth = currentMonth - 1;
  let endYear = currentYear;
  
  // ✅ CASO ESPECIAL: Se estamos em Janeiro, usar ano anterior (Jan-Dez)
  if (currentMonth === 1) {
    startMonth = 1;
    startYear = currentYear - 1;
    endMonth = 12;
    endYear = currentYear - 1;
  }
  
  // ✅ LIMITE MÍNIMO: Não permitir datas antes de 01/01/2025
  if (startYear < 2025) {
    startYear = 2025;
    startMonth = 1;
  }
  
  // Se o endYear for antes de 2025, ajustar para 2025
  if (endYear < 2025) {
    endYear = 2025;
    endMonth = 12; // Se está antes de 2025, usar Jan-Dez 2025
  }
  
  return {
    startMonth,
    startYear,
    endMonth,
    endYear,
  };
}

/**
 * Retorna o período do mês anterior ao corrente (fechado)
 * Usado no Dashboard de Resultado das Linhas
 * Exemplo: Se estamos em Janeiro/2025, retorna Dezembro/2024
 */
export function getPreviousMonthPeriod(): PeriodRange {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1; // 1-12
  
  // Voltar um mês
  month -= 1;
  
  // Se ficou zero, voltar para dezembro do ano anterior
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  
  // Se o ano ficou antes de 2025, usar janeiro de 2025
  if (year < 2025) {
    return {
      startMonth: 1,
      startYear: 2025,
      endMonth: 1,
      endYear: 2025,
    };
  }
  
  return {
    startMonth: month,
    startYear: year,
    endMonth: month,
    endYear: year,
  };
}

/**
 * Salva o período no localStorage
 */
export function savePeriod(period: PeriodRange): void {
  localStorage.setItem('presto_dashboard_period', JSON.stringify(period));
}

/**
 * Recupera o período do localStorage ou retorna o padrão
 */
export function loadPeriod(): PeriodRange {
  const saved = localStorage.getItem('presto_dashboard_period');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return getDefaultPeriod();
    }
  }
  return getDefaultPeriod();
}

/**
 * Verifica se uma data (mês/ano) está dentro do período
 */
export function isDateInPeriod(month: number, year: number, period: PeriodRange): boolean {
  const date = new Date(year, month - 1);
  const startDate = new Date(period.startYear, period.startMonth - 1);
  const endDate = new Date(period.endYear, period.endMonth - 1);
  
  return date >= startDate && date <= endDate;
}

/**
 * Filtra dados por período
 * Assume que os dados têm propriedades 'month' e 'year'
 */
export function filterByPeriod<T extends { month: number; year: number }>(
  data: T[],
  period: PeriodRange
): T[] {
  return data.filter(item => isDateInPeriod(item.month, item.year, period));
}

/**
 * Converte PeriodRange para parâmetros de query para API
 * Útil para passar período nas requisições HTTP
 */
export function periodToQueryParams(period: PeriodRange): Record<string, string | number> {
  return {
    startMonth: period.startMonth,
    startYear: period.startYear,
    endMonth: period.endMonth,
    endYear: period.endYear,
  };
}

/**
 * Gera array de meses dentro do período
 * Útil para filtrar dados mockados que usam abreviações de mês
 */
export function getMonthsInPeriod(period: PeriodRange): string[] {
  const MONTH_ABBR = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
  ];
  
  const months: string[] = [];
  let currentYear = period.startYear;
  let currentMonth = period.startMonth;
  
  while (
    currentYear < period.endYear || 
    (currentYear === period.endYear && currentMonth <= period.endMonth)
  ) {
    // Formato: "Jan/25" (igual ao retornado pela API)
    const yearAbbr = currentYear.toString().slice(-2);
    months.push(`${MONTH_ABBR[currentMonth - 1]}/${yearAbbr}`);
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
  }
  
  return months;
}