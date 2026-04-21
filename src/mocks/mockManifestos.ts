// ============================================
// MOCK DE MANIFESTOS - CONFERÊNCIA DE SAÍDAS
// ============================================

export interface Manifesto {
  id: number;
  numero: string; // Exemplo: "VCS12345"
  siglaOrigem: string; // Exemplo: "VCS"
  siglaDestino: string; // Exemplo: "SSA"
  placa: string;
  placaCarreta: string | null;
  totalFrete: number;
  ctrb: number;
  codigoCtrb: string; // ✅ NOVO: Código da CTRB (texto)
  pedagio: number;
  pesoTotal: number;
  dataEmissao: string; // YYYY-MM-DD
  dataSaida: string | null; // YYYY-MM-DD
  dataPrevisaoChegada: string; // YYYY-MM-DD
  horarioTerminoCarga: string | null; // HH:MM
  horarioExpedicao: string | null; // HH:MM
  horarioSaida: string | null; // HH:MM
  nomeDestino: string;
  
  // ✅ NOVO: Tipo de propriedade do veículo
  tpPropriedade: string | null; // 'F' = Frota, outros valores = Terceiro, null = não encontrado
  
  // ✅ CAMPOS EXTRAS para exportação CSV (não exibidos na tela)
  proprietario?: string;
  motorista?: string;
  cubagem?: number;
  vlrMercadoria?: number;
  codigoCtrb?: string;
  dataInicioDescarga?: string | null;
  horaInicioDescarga?: string | null;
  dataFimDescarga?: string | null;
  horaFimDescarga?: string | null;
}

const mockDelay = (ms: number = 300) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Gerar manifestos mock
const generateMockManifestos = (): Manifesto[] => {
  const unidades = [
    { sigla: 'VCS', nome: 'VITÓRIA DA CONQUISTA' },
    { sigla: 'SSA', nome: 'SALVADOR' },
    { sigla: 'ITA', nome: 'ITABUNA' },
    { sigla: 'ILH', nome: 'ILHÉUS' },
    { sigla: 'JEQ', nome: 'JEQUIÉ' },
    { sigla: 'BRU', nome: 'BRUMADO' },
    { sigla: 'FEI', nome: 'FEIRA DE SANTANA' },
    { sigla: 'POR', nome: 'PORTO SEGURO' },
    { sigla: 'GUA', nome: 'GUANAMBI' },
    { sigla: 'CAM', nome: 'CAMAÇARI' }
  ];

  const placas = [
    'ABC1D23', 'XYZ5E67', 'DEF8G90', 'GHI2J34', 'JKL5M67',
    'MNO8P90', 'PQR1S23', 'STU4V56', 'VWX7Y89', 'YZA0B12',
    'BCD3C45', 'EFG6H78', 'HIJ9K01', 'KLM2N34', 'NOP5Q67'
  ];

  const carretas = [
    null, 'CRT1A23', 'CRT4B56', 'CRT7C89', null, 'CRT0D12',
    'CRT3E45', null, 'CRT6F78', 'CRT9G01', null, 'CRT2H34',
    null, 'CRT5I67', 'CRT8J90'
  ];

  const manifestos: Manifesto[] = [];
  let idCounter = 1;

  // Gerar manifestos dos últimos 60 dias
  for (let diasAtras = 0; diasAtras < 60; diasAtras++) {
    const dataBase = new Date();
    dataBase.setDate(dataBase.getDate() - diasAtras);
    
    // Cada dia pode ter 3-8 manifestos
    const qtdeManifestos = Math.floor(Math.random() * 6) + 3;
    
    for (let i = 0; i < qtdeManifestos; i++) {
      const origem = unidades[0]; // Sempre VCS como origem
      const destino = unidades[Math.floor(Math.random() * (unidades.length - 1)) + 1]; // Qualquer destino exceto VCS
      const placa = placas[Math.floor(Math.random() * placas.length)];
      const carreta = carretas[Math.floor(Math.random() * carretas.length)];
      
      const numero = `${origem.sigla}${String(10000 + idCounter).slice(-5)}`;
      
      const dataEmissao = new Date(dataBase);
      dataEmissao.setDate(dataEmissao.getDate() - Math.floor(Math.random() * 2)); // Emissão 0-2 dias antes
      
      const dataSaida = diasAtras < 30 && Math.random() > 0.2 ? new Date(dataBase) : null;
      const dataPrevisao = new Date(dataBase);
      dataPrevisao.setDate(dataPrevisao.getDate() + Math.floor(Math.random() * 3) + 1); // 1-3 dias depois
      
      // Horários
      const horarioTerminoCarga = dataSaida ? `${String(Math.floor(Math.random() * 8) + 6).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}` : null;
      const horarioExpedicao = horarioTerminoCarga && Math.random() > 0.1 
        ? addMinutes(horarioTerminoCarga, Math.floor(Math.random() * 120) + 30) 
        : null;
      const horarioSaida = horarioExpedicao && Math.random() > 0.1
        ? addMinutes(horarioExpedicao, Math.floor(Math.random() * 60) + 15)
        : null;
      
      const pesoTotal = Math.floor(Math.random() * 20000) + 5000; // 5000-25000 kg
      const totalFrete = Math.floor(Math.random() * 8000) + 2000; // R$ 2000-10000
      const ctrb = Math.floor(totalFrete * (Math.random() * 0.1 + 0.05)); // 5-15% do frete
      const pedagio = Math.floor(Math.random() * 400) + 100; // R$ 100-500
      
      // ✅ 50% dos veículos são FROTA ('F'), 50% são TERCEIROS (outros valores ou null)
      const tpPropriedade = Math.random() > 0.5 ? 'F' : (Math.random() > 0.5 ? 'T' : null);
      
      manifestos.push({
        id: idCounter++,
        numero,
        siglaOrigem: origem.sigla,
        siglaDestino: destino.sigla,
        placa,
        placaCarreta: carreta,
        totalFrete,
        ctrb,
        pedagio,
        pesoTotal,
        dataEmissao: formatDate(dataEmissao),
        dataSaida: dataSaida ? formatDate(dataSaida) : null,
        dataPrevisaoChegada: formatDate(dataPrevisao),
        horarioTerminoCarga,
        horarioExpedicao,
        horarioSaida,
        nomeDestino: destino.nome,
        tpPropriedade // ✅ NOVO campo
      });
    }
  }
  
  return manifestos;
};

// Helper: Formatar data
const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Adicionar minutos a um horário
const addMinutes = (time: string, minutes: number): string => {
  const [hours, mins] = time.split(':').map(Number);
  const totalMins = hours * 60 + mins + minutes;
  const newHours = Math.floor(totalMins / 60) % 24;
  const newMins = totalMins % 60;
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
};

export const MOCK_MANIFESTOS = generateMockManifestos();

// Filtros de busca
export interface ManifestosFilters {
  periodoEmissaoInicio?: string;
  periodoEmissaoFim?: string;
  placa?: string;
  unidadeOrigem?: string;
  unidadeDestino?: string;
}

// Mock: Buscar manifestos
export const mockGetManifestos = async (filters: ManifestosFilters) => {
  await mockDelay(800);
  
  let manifestosFiltrados = [...MOCK_MANIFESTOS];
  
  // Filtrar por período de emissão
  if (filters.periodoEmissaoInicio) {
    manifestosFiltrados = manifestosFiltrados.filter(
      m => m.dataEmissao >= filters.periodoEmissaoInicio!
    );
  }
  if (filters.periodoEmissaoFim) {
    manifestosFiltrados = manifestosFiltrados.filter(
      m => m.dataEmissao <= filters.periodoEmissaoFim!
    );
  }
  
  // Filtrar por placa
  if (filters.placa) {
    manifestosFiltrados = manifestosFiltrados.filter(
      m => m.placa === filters.placa || m.placaCarreta === filters.placa
    );
  }
  
  // Filtrar por unidade de origem
  if (filters.unidadeOrigem) {
    manifestosFiltrados = manifestosFiltrados.filter(
      m => m.siglaOrigem === filters.unidadeOrigem!
    );
  }
  
  // Filtrar por unidade de destino
  if (filters.unidadeDestino) {
    manifestosFiltrados = manifestosFiltrados.filter(
      m => m.siglaDestino === filters.unidadeDestino!
    );
  }
  
  // Ordenar por data de emissão DESC
  manifestosFiltrados.sort((a, b) => {
    if (a.dataEmissao !== b.dataEmissao) {
      return b.dataEmissao.localeCompare(a.dataEmissao);
    }
    return b.id - a.id;
  });
  
  // Limitar a 100 registros
  manifestosFiltrados = manifestosFiltrados.slice(0, 100);
  
  return {
    success: true,
    manifestos: manifestosFiltrados,
    total: manifestosFiltrados.length
  };
};