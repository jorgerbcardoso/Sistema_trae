/**
 * ============================================
 * DASHBOARD MOCKS
 * ============================================
 * Funções para gerar dados mockados do dashboard
 */

import { DashboardPeriod, OverviewData, RevenueData, CostsData, LinesData, ProfitabilityData } from '../services/dashboardService';

// Dados base CARGAS
const monthlyDataCargas = [
  { month: 'Jan', receita: 450000, custos: 320000, lucro: 130000 },
  { month: 'Fev', receita: 480000, custos: 335000, lucro: 145000 },
  { month: 'Mar', receita: 520000, custos: 360000, lucro: 160000 },
  { month: 'Abr', receita: 495000, custos: 345000, lucro: 150000 },
  { month: 'Mai', receita: 530000, custos: 370000, lucro: 160000 },
  { month: 'Jun', receita: 560000, custos: 385000, lucro: 175000 },
  { month: 'Jul', receita: 580000, custos: 400000, lucro: 180000 },
  { month: 'Ago', receita: 550000, custos: 390000, lucro: 160000 },
  { month: 'Set', receita: 590000, custos: 410000, lucro: 180000 },
  { month: 'Out', receita: 620000, custos: 425000, lucro: 195000 },
  { month: 'Nov', receita: 640000, custos: 440000, lucro: 200000 },
  { month: 'Dez', receita: 680000, custos: 460000, lucro: 220000 },
];

// Dados base PASSAGEIROS
const monthlyDataPassageiros = [
  { month: 'Jan', receita: 135000, custos: 92000, lucro: 43000 },
  { month: 'Fev', receita: 142000, custos: 97000, lucro: 45000 },
  { month: 'Mar', receita: 155000, custos: 105000, lucro: 50000 },
  { month: 'Abr', receita: 148000, custos: 101000, lucro: 47000 },
  { month: 'Mai', receita: 158000, custos: 108000, lucro: 50000 },
  { month: 'Jun', receita: 168000, custos: 114000, lucro: 54000 },
  { month: 'Jul', receita: 175000, custos: 119000, lucro: 56000 },
  { month: 'Ago', receita: 165000, custos: 113000, lucro: 52000 },
  { month: 'Set', receita: 178000, custos: 121000, lucro: 57000 },
  { month: 'Out', receita: 188000, custos: 128000, lucro: 60000 },
  { month: 'Nov', receita: 192000, custos: 131000, lucro: 61000 },
  { month: 'Dez', receita: 205000, custos: 138000, lucro: 67000 },
];

const unitsCargas = [
  { unidade: 'SAO', receita: 2100000, custos: 1450000, lucro: 650000 },
  { unidade: 'RIO', receita: 1850000, custos: 1280000, lucro: 570000 },
  { unidade: 'BHZ', receita: 1200000, custos: 840000, lucro: 360000 },
  { unidade: 'CWB', receita: 700000, custos: 490000, lucro: 210000 },
  { unidade: 'FLN', receita: 325000, custos: 230000, lucro: 95000 },
];

const unitsPassageiros = [
  { unidade: 'SAO', receita: 620000, custos: 425000, lucro: 195000 },
  { unidade: 'RIO', receita: 545000, custos: 375000, lucro: 170000 },
  { unidade: 'BHZ', receita: 355000, custos: 245000, lucro: 110000 },
  { unidade: 'CWB', receita: 205000, custos: 142000, lucro: 63000 },
  { unidade: 'FLN', receita: 95000, custos: 67000, lucro: 28000 },
];

/**
 * Gerar dados de Overview
 */
export function generateMockOverviewData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS'
): OverviewData {
  console.log('🔧 [generateMockOverviewData] INICIANDO. period:', period, 'viewMode:', viewMode);
  
  let monthly, units;
  
  if (viewMode === 'CARGAS') {
    monthly = monthlyDataCargas;
    units = unitsCargas;
  } else if (viewMode === 'PASSAGEIROS') {
    monthly = monthlyDataPassageiros;
    units = unitsPassageiros;
  } else { // GERAL
    monthly = monthlyDataCargas.map((c, i) => ({
      month: c.month,
      receita: c.receita + monthlyDataPassageiros[i].receita,
      custos: c.custos + monthlyDataPassageiros[i].custos,
      lucro: c.lucro + monthlyDataPassageiros[i].lucro,
    }));
    units = unitsCargas.map((c, i) => ({
      unidade: c.unidade,
      receita: c.receita + unitsPassageiros[i].receita,
      custos: c.custos + unitsPassageiros[i].custos,
      lucro: c.lucro + unitsPassageiros[i].lucro,
    }));
  }

  console.log('🔧 [generateMockOverviewData] monthly calculado:', monthly);
  console.log('🔧 [generateMockOverviewData] units calculado:', units);

  // ✅ Calcular totais somando os 12 meses (formato completo)
  const totals = monthly.reduce((acc, m) => ({
    receita: acc.receita + m.receita,
    custos: acc.custos + m.custos,
    lucro: acc.lucro + m.lucro,
    margem: 0, // Calculado depois
  }), { receita: 0, custos: 0, lucro: 0, margem: 0 });

  totals.margem = (totals.lucro / totals.receita) * 100;

  console.log('🔧 [generateMockOverviewData] totals calculado:', totals);

  // ✅ RETORNAR NO FORMATO COMPLETO (compatível com interface OverviewData)
  const result: OverviewData = {
    monthly,
    units,
    totals,
    // ✅ Campos extras usados pelo componente OverviewPage
    receita_total: totals.receita,
    custos_total: totals.custos,
    despesas_total: totals.custos * 0.3, // Aproximação: 30% dos custos
    lucro_bruto: totals.lucro,
    lucro_liquido: totals.lucro,
    margem_bruta: totals.margem,
    margem_liquida: totals.margem,
    ebitda: totals.lucro * 1.15,
    margem_ebitda: totals.margem * 1.15,
    // ✅ NOVOS CAMPOS - Separação por tipo de evento
    impostos: totals.custos * 0.075, // 7.5% dos custos = impostos
    depreciacao: totals.custos * 0.045, // 4.5% dos custos = depreciação
    despesas_financeiras: totals.custos * 0.030, // 3% dos custos = desp. financeiras
    comparacao_mes_anterior: {
      receita: 8.5,
      custos: 6.2,
      lucro: 12.3
    },
    alertas: [],
    kpis: {
      receita_por_viagem: totals.receita / 200,
      custo_por_km: 2.85,
      ticket_medio: totals.receita / 200,
      total_viagens: 200
    },
    period: {
      type: period.type,
      start_date: period.startDate || new Date().toISOString().split('T')[0],
      end_date: period.endDate || new Date().toISOString().split('T')[0],
      label: 'Período Mock'
    }
  };
  
  console.log('✅ [generateMockOverviewData] RETORNANDO resultado:', result);
  return result;
}

/**
 * Gerar dados de Receitas
 */
export function generateMockRevenueData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS'
): RevenueData {
  // Dados CARGAS
  const revenueByUnitCargas = [
    { month: 'Jan/25', SAO: 180000, RIO: 160000, BHZ: 70000, Demais: 40000 },
    { month: 'Fev/25', SAO: 192000, RIO: 168000, BHZ: 78000, Demais: 42000 },
    { month: 'Mar/25', SAO: 208000, RIO: 182000, BHZ: 86000, Demais: 44000 },
    { month: 'Abr/25', SAO: 198000, RIO: 173500, BHZ: 82000, Demais: 41500 },
    { month: 'Mai/25', SAO: 212000, RIO: 185000, BHZ: 90000, Demais: 43000 },
    { month: 'Jun/25', SAO: 224000, RIO: 196000, BHZ: 94000, Demais: 46000 },
    { month: 'Jul/25', SAO: 232000, RIO: 203000, BHZ: 99000, Demais: 46000 },
    { month: 'Ago/25', SAO: 220000, RIO: 192500, BHZ: 95000, Demais: 42500 },
    { month: 'Set/25', SAO: 236000, RIO: 206500, BHZ: 101000, Demais: 46500 },
    { month: 'Out/25', SAO: 248000, RIO: 217000, BHZ: 105000, Demais: 50000 },
    { month: 'Nov/25', SAO: 255000, RIO: 223000, BHZ: 108000, Demais: 52000 },
    { month: 'Dez/25', SAO: 265000, RIO: 232000, BHZ: 112000, Demais: 54000 },
  ];

  // Dados PASSAGEIROS
  const revenueByUnitPassageiros = [
    { month: 'Jan/25', SAO: 54000, RIO: 48000, BHZ: 21000, Demais: 12000 },
    { month: 'Fev/25', SAO: 57600, RIO: 50400, BHZ: 23400, Demais: 12600 },
    { month: 'Mar/25', SAO: 62400, RIO: 54600, BHZ: 25800, Demais: 13200 },
    { month: 'Abr/25', SAO: 59400, RIO: 52050, BHZ: 24600, Demais: 12450 },
    { month: 'Mai/25', SAO: 63600, RIO: 55500, BHZ: 27000, Demais: 12900 },
    { month: 'Jun/25', SAO: 67200, RIO: 58800, BHZ: 28200, Demais: 13800 },
    { month: 'Jul/25', SAO: 69600, RIO: 60900, BHZ: 29700, Demais: 13800 },
    { month: 'Ago/25', SAO: 66000, RIO: 57750, BHZ: 28500, Demais: 12750 },
    { month: 'Set/25', SAO: 70800, RIO: 61950, BHZ: 30300, Demais: 13950 },
    { month: 'Out/25', SAO: 74400, RIO: 65100, BHZ: 31500, Demais: 15000 },
    { month: 'Nov/25', SAO: 76500, RIO: 66900, BHZ: 32400, Demais: 15600 },
    { month: 'Dez/25', SAO: 79500, RIO: 69600, BHZ: 33600, Demais: 16200 },
  ];

  const ticketMedioByUnitCargas = [
    { month: 'Jan/25', SAO: 2850, RIO: 2650, BHZ: 2200, Demais: 1880 },
    { month: 'Fev/25', SAO: 2900, RIO: 2700, BHZ: 2250, Demais: 1930 },
    { month: 'Mar/25', SAO: 2950, RIO: 2750, BHZ: 2300, Demais: 1980 },
    { month: 'Abr/25', SAO: 2880, RIO: 2680, BHZ: 2220, Demais: 1900 },
    { month: 'Mai/25', SAO: 2920, RIO: 2720, BHZ: 2260, Demais: 1940 },
    { month: 'Jun/25', SAO: 2980, RIO: 2780, BHZ: 2320, Demais: 2000 },
    { month: 'Jul/25', SAO: 3020, RIO: 2820, BHZ: 2360, Demais: 2040 },
    { month: 'Ago/25', SAO: 2950, RIO: 2750, BHZ: 2290, Demais: 1970 },
    { month: 'Set/25', SAO: 3050, RIO: 2850, BHZ: 2390, Demais: 2070 },
    { month: 'Out/25', SAO: 3100, RIO: 2900, BHZ: 2440, Demais: 2120 },
    { month: 'Nov/25', SAO: 3150, RIO: 2950, BHZ: 2480, Demais: 2160 },
    { month: 'Dez/25', SAO: 3200, RIO: 3000, BHZ: 2520, Demais: 2200 },
  ];

  const ticketMedioByUnitPassageiros = [
    { month: 'Jan/25', SAO: 85, RIO: 80, BHZ: 68, Demais: 58 },
    { month: 'Fev/25', SAO: 87, RIO: 81, BHZ: 70, Demais: 60 },
    { month: 'Mar/25', SAO: 89, RIO: 83, BHZ: 72, Demais: 62 },
    { month: 'Abr/25', SAO: 86, RIO: 81, BHZ: 69, Demais: 59 },
    { month: 'Mai/25', SAO: 88, RIO: 82, BHZ: 71, Demais: 60 },
    { month: 'Jun/25', SAO: 90, RIO: 84, BHZ: 73, Demais: 62 },
    { month: 'Jul/25', SAO: 92, RIO: 86, BHZ: 75, Demais: 64 },
    { month: 'Ago/25', SAO: 89, RIO: 83, BHZ: 72, Demais: 61 },
    { month: 'Set/25', SAO: 93, RIO: 87, BHZ: 76, Demais: 65 },
    { month: 'Out/25', SAO: 95, RIO: 89, BHZ: 78, Demais: 67 },
    { month: 'Nov/25', SAO: 96, RIO: 90, BHZ: 79, Demais: 68 },
    { month: 'Dez/25', SAO: 98, RIO: 92, BHZ: 81, Demais: 70 },
  ];

  const total = revenueByUnitCargas.reduce((acc, m) => 
    acc + m.SAO + m.RIO + m.BHZ + m.Demais, 0
  );

  // ✅ Calcular unitTotals (soma de cada unidade nos 12 meses)
  const unitTotals = {
    SAO: revenueByUnitCargas.reduce((acc, m) => acc + m.SAO, 0),
    RIO: revenueByUnitCargas.reduce((acc, m) => acc + m.RIO, 0),
    BHZ: revenueByUnitCargas.reduce((acc, m) => acc + m.BHZ, 0),
    Demais: revenueByUnitCargas.reduce((acc, m) => acc + m.Demais, 0)
  };

  return {
    revenueByUnitCargas,
    revenueByUnitPassageiros,
    ticketMedioByUnitCargas,
    ticketMedioByUnitPassageiros,
    unitTotals, // ✅ NOVO: totais por unidade
    total,
  };
}

/**
 * Gerar dados de Custos
 */
export function generateMockCostsData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS'
): CostsData {
  // Dados CARGAS
  const costsByCategoryCargas = [
    { month: 'Jan/25', combustivel: 145000, manutencao: 45000, pessoal: 95000, tributos: 35000, demais: 25000 },
    { month: 'Fev/25', combustivel: 152000, manutencao: 48000, pessoal: 98000, tributos: 37000, demais: 27000 },
    { month: 'Mar/25', combustivel: 163000, manutencao: 52000, pessoal: 105000, tributos: 40000, demais: 30000 },
    { month: 'Abr/25', combustivel: 156000, manutencao: 49500, pessoal: 101500, tributos: 38000, demais: 28000 },
    { month: 'Mai/25', combustivel: 168000, manutencao: 53000, pessoal: 108000, tributos: 41000, demais: 31000 },
    { month: 'Jun/25', combustivel: 175000, manutencao: 55000, pessoal: 112000, tributos: 43000, demais: 33000 },
    { month: 'Jul/25', combustivel: 181000, manutencao: 58000, pessoal: 116000, tributos: 45000, demais: 35000 },
    { month: 'Ago/25', combustivel: 177000, manutencao: 56000, pessoal: 114000, tributos: 43000, demais: 32000 },
    { month: 'Set/25', combustivel: 186000, manutencao: 59000, pessoal: 119000, tributos: 46000, demais: 36000 },
    { month: 'Out/25', combustivel: 193000, manutencao: 61000, pessoal: 123000, tributos: 48000, demais: 38000 },
    { month: 'Nov/25', combustivel: 198000, manutencao: 62000, pessoal: 126000, tributos: 49000, demais: 39000 },
    { month: 'Dez/25', combustivel: 205000, manutencao: 64000, pessoal: 130000, tributos: 51000, demais: 41000 },
  ];

  // Dados PASSAGEIROS
  const costsByCategoryPassageiros = [
    { month: 'Jan/25', combustivel: 42000, manutencao: 12000, pessoal: 28000, tributos: 10000, demais: 8000 },
    { month: 'Fev/25', combustivel: 44000, manutencao: 13000, pessoal: 29000, tributos: 11000, demais: 8500 },
    { month: 'Mar/25', combustivel: 47000, manutencao: 14000, pessoal: 31000, tributos: 12000, demais: 9000 },
    { month: 'Abr/25', combustivel: 45000, manutencao: 13500, pessoal: 30000, tributos: 11500, demais: 8500 },
    { month: 'Mai/25', combustivel: 48000, manutencao: 14500, pessoal: 32000, tributos: 12000, demais: 9000 },
    { month: 'Jun/25', combustivel: 50000, manutencao: 15000, pessoal: 33000, tributos: 13000, demais: 9500 },
    { month: 'Jul/25', combustivel: 52000, manutencao: 16000, pessoal: 34000, tributos: 13500, demais: 10000 },
    { month: 'Ago/25', combustivel: 51000, manutencao: 15500, pessoal: 33500, tributos: 13000, demais: 9500 },
    { month: 'Set/25', combustivel: 54000, manutencao: 16500, pessoal: 35000, tributos: 14000, demais: 10000 },
    { month: 'Out/25', combustivel: 56000, manutencao: 17000, pessoal: 36000, tributos: 14500, demais: 10500 },
    { month: 'Nov/25', combustivel: 57000, manutencao: 17500, pessoal: 37000, tributos: 15000, demais: 11000 },
    { month: 'Dez/25', combustivel: 59000, manutencao: 18000, pessoal: 38000, tributos: 15500, demais: 11500 },
  ];

  const fuelEfficiencyCargas = [
    { month: 'Jan/25', kmPorLitro: 3.2, custoKm: 1.52 },
    { month: 'Fev/25', kmPorLitro: 3.25, custoKm: 1.48 },
    { month: 'Mar/25', kmPorLitro: 3.18, custoKm: 1.55 },
    { month: 'Abr/25', kmPorLitro: 3.22, custoKm: 1.50 },
    { month: 'Mai/25', kmPorLitro: 3.28, custoKm: 1.46 },
    { month: 'Jun/25', kmPorLitro: 3.30, custoKm: 1.44 },
    { month: 'Jul/25', kmPorLitro: 3.26, custoKm: 1.47 },
    { month: 'Ago/25', kmPorLitro: 3.24, custoKm: 1.49 },
    { month: 'Set/25', kmPorLitro: 3.32, custoKm: 1.42 },
    { month: 'Out/25', kmPorLitro: 3.35, custoKm: 1.40 },
    { month: 'Nov/25', kmPorLitro: 3.38, custoKm: 1.38 },
    { month: 'Dez/25', kmPorLitro: 3.40, custoKm: 1.36 },
  ];

  const fuelEfficiencyPassageiros = [
    { month: 'Jan/25', kmPorLitro: 4.8, custoKm: 0.98 },
    { month: 'Fev/25', kmPorLitro: 4.9, custoKm: 0.96 },
    { month: 'Mar/25', kmPorLitro: 4.7, custoKm: 1.00 },
    { month: 'Abr/25', kmPorLitro: 4.85, custoKm: 0.97 },
    { month: 'Mai/25', kmPorLitro: 4.95, custoKm: 0.95 },
    { month: 'Jun/25', kmPorLitro: 5.0, custoKm: 0.93 },
    { month: 'Jul/25', kmPorLitro: 4.92, custoKm: 0.95 },
    { month: 'Ago/25', kmPorLitro: 4.88, custoKm: 0.97 },
    { month: 'Set/25', kmPorLitro: 5.05, custoKm: 0.92 },
    { month: 'Out/25', kmPorLitro: 5.1, custoKm: 0.90 },
    { month: 'Nov/25', kmPorLitro: 5.15, custoKm: 0.88 },
    { month: 'Dez/25', kmPorLitro: 5.2, custoKm: 0.86 },
  ];

  const total = costsByCategoryCargas.reduce((acc, m) => 
    acc + m.combustivel + m.manutencao + m.pessoal + m.tributos + m.demais, 0
  );

  // ✅ Calcular categoryTotals (soma de cada categoria nos 12 meses)
  const categoryTotals = {
    combustivel: costsByCategoryCargas.reduce((acc, m) => acc + m.combustivel, 0),
    manutencao: costsByCategoryCargas.reduce((acc, m) => acc + m.manutencao, 0),
    pessoal: costsByCategoryCargas.reduce((acc, m) => acc + m.pessoal, 0),
    tributos: costsByCategoryCargas.reduce((acc, m) => acc + m.tributos, 0),
    demais: costsByCategoryCargas.reduce((acc, m) => acc + m.demais, 0)
  };

  // ✅ NOVO: Dados mockados de UNIDADES
  const unitCategoryTotals = {
    'SPO': 850000,
    'RJO': 650000,
    'BHZ': 450000,
    'CWB': 350000,
    'Demais': 250000
  };

  const costsByUnitCargas = [
    { month: 'Jan/25', 'SPO': 68000, 'RJO': 52000, 'BHZ': 36000, 'CWB': 28000, 'Demais': 20000 },
    { month: 'Fev/25', 'SPO': 71000, 'RJO': 54000, 'BHZ': 38000, 'CWB': 29000, 'Demais': 21000 },
    { month: 'Mar/25', 'SPO': 76000, 'RJO': 58000, 'BHZ': 41000, 'CWB': 32000, 'Demais': 23000 },
    { month: 'Abr/25', 'SPO': 73000, 'RJO': 56000, 'BHZ': 39000, 'CWB': 30000, 'Demais': 22000 },
    { month: 'Mai/25', 'SPO': 78000, 'RJO': 60000, 'BHZ': 42000, 'CWB': 33000, 'Demais': 24000 },
    { month: 'Jun/25', 'SPO': 82000, 'RJO': 63000, 'BHZ': 44000, 'CWB': 34000, 'Demais': 25000 },
    { month: 'Jul/25', 'SPO': 85000, 'RJO': 65000, 'BHZ': 46000, 'CWB': 36000, 'Demais': 26000 },
    { month: 'Ago/25', 'SPO': 83000, 'RJO': 64000, 'BHZ': 45000, 'CWB': 35000, 'Demais': 25000 },
    { month: 'Set/25', 'SPO': 87000, 'RJO': 67000, 'BHZ': 47000, 'CWB': 37000, 'Demais': 27000 },
    { month: 'Out/25', 'SPO': 90000, 'RJO': 69000, 'BHZ': 49000, 'CWB': 38000, 'Demais': 28000 },
    { month: 'Nov/25', 'SPO': 93000, 'RJO': 71000, 'BHZ': 50000, 'CWB': 39000, 'Demais': 29000 },
    { month: 'Dez/25', 'SPO': 96000, 'RJO': 74000, 'BHZ': 52000, 'CWB': 41000, 'Demais': 30000 },
  ];

  const costsByUnitPassageiros = [
    { month: 'Jan/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Fev/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Mar/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Abr/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Mai/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Jun/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Jul/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Ago/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Set/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Out/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Nov/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
    { month: 'Dez/25', 'SPO': 0, 'RJO': 0, 'BHZ': 0, 'CWB': 0, 'Demais': 0 },
  ];

  return {
    costsByCategoryCargas,
    costsByCategoryPassageiros,
    fuelEfficiencyCargas,
    fuelEfficiencyPassageiros,
    categoryTotals, // ✅ NOVO: totais por categoria
    totals: { total },
    // ✅ NOVO: Dados de unidades
    unitCategoryTotals,
    costsByUnitCargas,
    costsByUnitPassageiros
  };
}

/**
 * Gerar dados de Linhas
 */
export function generateMockLinesData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS'
): LinesData {
  const byLine = [
    { linha: 'SP - RJ', receita: 1250000, custos: 875000, lucro: 375000, margem: 30 },
    { linha: 'SP - BH', receita: 980000, custos: 725000, lucro: 255000, margem: 26 },
    { linha: 'RJ - BH', receita: 720000, custos: 540000, lucro: 180000, margem: 25 },
    { linha: 'SP - CWB', receita: 850000, custos: 680000, lucro: 170000, margem: 20 },
    { linha: 'SP - POA', receita: 620000, custos: 496000, lucro: 124000, margem: 20 },
  ];

  const performance = [
    { linha: 'SP - RJ', demanda: 95, ocupacao: 88 },
    { linha: 'SP - BH', demanda: 82, ocupacao: 75 },
    { linha: 'RJ - BH', demanda: 78, ocupacao: 72 },
    { linha: 'SP - CWB', demanda: 85, ocupacao: 80 },
    { linha: 'SP - POA', demanda: 70, ocupacao: 65 },
  ];

  const monthly = monthlyDataCargas.map((m, i) => ({
    month: m.month,
    receita: m.receita,
    viagens: 120 + i * 5,
  }));

  return { byLine, performance, monthly };
}

/**
 * Gerar dados de Rentabilidade
 */
export function generateMockProfitabilityData(
  period: DashboardPeriod,
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS'
): ProfitabilityData {
  // Dados CARGAS
  const profitabilityDataCargas = [
    { month: 'Jan/25', margemBruta: 28.9, margemOperacional: 34.5, margemLiquida: 23.2, ebitda: 105000, roi: 18.5 },
    { month: 'Fev/25', margemBruta: 30.2, margemOperacional: 35.8, margemLiquida: 24.5, ebitda: 115000, roi: 19.2 },
    { month: 'Mar/25', margemBruta: 30.8, margemOperacional: 36.5, margemLiquida: 25.2, ebitda: 125000, roi: 20.1 },
    { month: 'Abr/25', margemBruta: 30.3, margemOperacional: 36.0, margemLiquida: 24.8, ebitda: 118000, roi: 19.5 },
    { month: 'Mai/25', margemBruta: 30.2, margemOperacional: 35.9, margemLiquida: 24.7, ebitda: 122000, roi: 19.8 },
    { month: 'Jun/25', margemBruta: 31.2, margemOperacional: 37.2, margemLiquida: 25.8, ebitda: 135000, roi: 20.8 },
    { month: 'Jul/25', margemBruta: 31.0, margemOperacional: 37.0, margemLiquida: 25.6, ebitda: 138000, roi: 21.0 },
    { month: 'Ago/25', margemBruta: 29.1, margemOperacional: 34.8, margemLiquida: 23.9, ebitda: 128000, roi: 19.2 },
    { month: 'Set/25', margemBruta: 30.5, margemOperacional: 36.3, margemLiquida: 25.0, ebitda: 142000, roi: 20.5 },
    { month: 'Out/25', margemBruta: 34.2, margemOperacional: 41.0, margemLiquida: 31.2, ebitda: 151000, roi: 25.3 },
    { month: 'Nov/25', margemBruta: 34.0, margemOperacional: 40.8, margemLiquida: 31.0, ebitda: 155000, roi: 25.1 },
    { month: 'Dez/25', margemBruta: 35.0, margemOperacional: 42.0, margemLiquida: 32.0, ebitda: 165000, roi: 26.0 },
  ];

  // Dados PASSAGEIROS
  const profitabilityDataPassageiros = [
    { month: 'Jan/25', margemBruta: 31.5, margemOperacional: 37.7, margemLiquida: 28.3, ebitda: 38000, roi: 22.8 },
    { month: 'Fev/25', margemBruta: 32.8, margemOperacional: 39.2, margemLiquida: 29.5, ebitda: 42000, roi: 23.8 },
    { month: 'Mar/25', margemBruta: 33.5, margemOperacional: 40.0, margemLiquida: 30.2, ebitda: 47000, roi: 24.5 },
    { month: 'Abr/25', margemBruta: 32.9, margemOperacional: 39.3, margemLiquida: 29.6, ebitda: 43000, roi: 23.9 },
    { month: 'Mai/25', margemBruta: 32.8, margemOperacional: 39.2, margemLiquida: 29.5, ebitda: 45000, roi: 23.8 },
    { month: 'Jun/25', margemBruta: 33.8, margemOperacional: 40.4, margemLiquida: 30.5, ebitda: 51000, roi: 24.8 },
    { month: 'Jul/25', margemBruta: 33.6, margemOperacional: 40.2, margemLiquida: 30.3, ebitda: 53000, roi: 24.6 },
    { month: 'Ago/25', margemBruta: 31.7, margemOperacional: 37.9, margemLiquida: 28.5, ebitda: 47000, roi: 23.0 },
    { month: 'Set/25', margemBruta: 33.1, margemOperacional: 39.5, margemLiquida: 29.7, ebitda: 53000, roi: 24.2 },
    { month: 'Out/25', margemBruta: 32.5, margemOperacional: 38.9, margemLiquida: 29.0, ebitda: 42000, roi: 24.0 },
    { month: 'Nov/25', margemBruta: 32.7, margemOperacional: 39.2, margemLiquida: 29.3, ebitda: 41000, roi: 23.5 },
    { month: 'Dez/25', margemBruta: 33.5, margemOperacional: 40.1, margemLiquida: 30.1, ebitda: 45000, roi: 24.5 },
  ];

  const unitProfitabilityCargas = [
    { unidade: 'SAO - São Paulo', receita: 2100000, custo: 1450000, lucro: 650000, margem: 31.0 },
    { unidade: 'RIO - Rio de Janeiro', receita: 1850000, custo: 1280000, lucro: 570000, margem: 30.8 },
    { unidade: 'BHZ - Belo Horizonte', receita: 1200000, custo: 840000, lucro: 360000, margem: 30.0 },
    { unidade: 'CWB - Curitiba', receita: 700000, custo: 490000, lucro: 210000, margem: 30.0 },
    { unidade: 'FLN - Florianópolis', receita: 325000, custo: 230000, lucro: 95000, margem: 29.2 },
  ];

  const unitProfitabilityPassageiros = [
    { unidade: 'SAO - São Paulo', receita: 620000, custo: 425000, lucro: 195000, margem: 31.5 },
    { unidade: 'RIO - Rio de Janeiro', receita: 545000, custo: 375000, lucro: 170000, margem: 31.2 },
    { unidade: 'BHZ - Belo Horizonte', receita: 355000, custo: 245000, lucro: 110000, margem: 31.0 },
    { unidade: 'CWB - Curitiba', receita: 205000, custo: 142000, lucro: 63000, margem: 30.7 },
    { unidade: 'FLN - Florianópolis', receita: 95000, custo: 67000, lucro: 28000, margem: 29.5 },
  ];

  // ✅ Calcular periodMetrics (métricas do período - média dos 12 meses)
  const totalMargens = profitabilityDataCargas.reduce((acc, m) => ({
    margemBruta: acc.margemBruta + m.margemBruta,
    margemOperacional: acc.margemOperacional + m.margemOperacional,
    margemLiquida: acc.margemLiquida + m.margemLiquida,
    ebitda: acc.ebitda + m.ebitda,
    roi: acc.roi + m.roi
  }), { margemBruta: 0, margemOperacional: 0, margemLiquida: 0, ebitda: 0, roi: 0 });

  const periodMetrics = {
    margemBruta: totalMargens.margemBruta / 12,
    margemOperacional: totalMargens.margemOperacional / 12,
    margemLiquida: totalMargens.margemLiquida / 12,
    ebitda: totalMargens.ebitda / 12,
    roi: totalMargens.roi / 12
  };

  return {
    periodMetrics, // ✅ NOVO: métricas do período para os cards
    profitabilityDataCargas,
    profitabilityDataPassageiros,
    unitProfitabilityCargas,
    unitProfitabilityPassageiros,
  };
}