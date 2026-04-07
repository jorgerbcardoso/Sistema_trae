/**
 * 🎭 MOCK DATA - APROVAÇÃO DE DESPESAS
 * Dados mock extensos para popular a tela no Figma Make
 */

export interface DespesaPendente {
  seq_lancamento: number;
  data: string;
  tipo_lancamento: string;
  evento: string;
  evento_descricao: string;
  veiculo?: string;
  motorista?: string;
  unidade: string;
  valor: number;
  nf?: string;
  fornecedor?: string;
  observacao?: string;
  historico?: string; // ✅ NOVO: f5
  usuario_lancamento: string;
  data_lancamento: string;
  data_inclusao?: string; // ✅ NOVO: f2
  data_pagamento?: string; // ✅ NOVO: f7
  aprovada?: boolean; // ✅ Campo opcional para controle de aprovação
}

// 🎭 MOCK: Despesas pendentes de aprovação (lista grande)
export const MOCK_DESPESAS_PENDENTES: DespesaPendente[] = [
  // ABASTECIMENTOS
  {
    seq_lancamento: 1001,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'ABAST',
    evento_descricao: 'ABASTECIMENTO',
    veiculo: 'ABC-1234',
    motorista: 'JOÃO SILVA',
    unidade: 'MTZ',
    valor: 450.80,
    nf: '12345',
    fornecedor: 'POSTO IPIRANGA',
    observacao: 'Abastecimento completo',
    historico: 'Abastecimento caminhão placa ABC-1234',
    usuario_lancamento: 'JOAO',
    data_lancamento: '2025-02-25T08:30:00',
    data_inclusao: '2025-02-25',
    data_pagamento: '2025-02-25',
    aprovada: true // ✅ JÁ APROVADA
  },
  {
    seq_lancamento: 1002,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'ABAST',
    evento_descricao: 'ABASTECIMENTO',
    veiculo: 'DEF-5678',
    motorista: 'MARIA SANTOS',
    unidade: 'CBA',
    valor: 520.50,
    nf: '12346',
    fornecedor: 'POSTO SHELL',
    observacao: '',
    usuario_lancamento: 'MARIA',
    data_lancamento: '2025-02-25T09:15:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1003,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'ABAST',
    evento_descricao: 'ABASTECIMENTO',
    veiculo: 'GHI-9012',
    motorista: 'PEDRO OLIVEIRA',
    unidade: 'MTZ',
    valor: 380.00,
    nf: '12347',
    fornecedor: 'POSTO BR',
    observacao: 'Meio tanque',
    usuario_lancamento: 'PEDRO',
    data_lancamento: '2025-02-24T14:20:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1004,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'ABAST',
    evento_descricao: 'ABASTECIMENTO',
    veiculo: 'JKL-3456',
    motorista: 'ANA COSTA',
    unidade: 'POA',
    valor: 610.90,
    nf: '12348',
    fornecedor: 'POSTO IPIRANGA',
    observacao: 'Tanque cheio',
    usuario_lancamento: 'ANA',
    data_lancamento: '2025-02-24T16:45:00',
    aprovada: true // ✅ JÁ APROVADA
  },
  {
    seq_lancamento: 1005,
    data: '2025-02-23',
    tipo_lancamento: 'V',
    evento: 'ABAST',
    evento_descricao: 'ABASTECIMENTO',
    veiculo: 'MNO-7890',
    motorista: 'CARLOS MENDES',
    unidade: 'CBA',
    valor: 495.30,
    nf: '12349',
    fornecedor: 'POSTO SHELL',
    observacao: '',
    usuario_lancamento: 'CARLOS',
    data_lancamento: '2025-02-23T10:00:00',
    aprovada: false // ❌ PENDENTE
  },

  // MANUTENÇÕES
  {
    seq_lancamento: 1006,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'MANUT',
    evento_descricao: 'MANUTENÇÃO',
    veiculo: 'ABC-1234',
    motorista: 'JOÃO SILVA',
    unidade: 'MTZ',
    valor: 1250.00,
    nf: '45678',
    fornecedor: 'OFICINA DO ZECA',
    observacao: 'Troca de pastilhas de freio',
    usuario_lancamento: 'JOAO',
    data_lancamento: '2025-02-25T11:00:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1007,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'MANUT',
    evento_descricao: 'MANUTENÇÃO',
    veiculo: 'PQR-1122',
    motorista: 'LUCAS FERREIRA',
    unidade: 'POA',
    valor: 850.50,
    nf: '45679',
    fornecedor: 'AUTO PEÇAS SOUZA',
    observacao: 'Revisão preventiva',
    usuario_lancamento: 'LUCAS',
    data_lancamento: '2025-02-24T13:30:00',
    aprovada: true // ✅ JÁ APROVADA
  },
  {
    seq_lancamento: 1008,
    data: '2025-02-23',
    tipo_lancamento: 'V',
    evento: 'MANUT',
    evento_descricao: 'MANUTENÇÃO',
    veiculo: 'STU-3344',
    motorista: 'FERNANDA LIMA',
    unidade: 'MTZ',
    valor: 2100.00,
    nf: '45680',
    fornecedor: 'MECÂNICA RÁPIDA',
    observacao: 'Troca de embreagem',
    usuario_lancamento: 'FERNANDA',
    data_lancamento: '2025-02-23T15:45:00',
    aprovada: false // ❌ PENDENTE
  },

  // PEDÁGIOS
  {
    seq_lancamento: 1009,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'PEDAGIO',
    evento_descricao: 'PEDÁGIO',
    veiculo: 'DEF-5678',
    motorista: 'MARIA SANTOS',
    unidade: 'CBA',
    valor: 89.60,
    nf: '',
    fornecedor: 'ECOVIAS',
    observacao: 'Rota SP-CBA',
    usuario_lancamento: 'MARIA',
    data_lancamento: '2025-02-25T07:20:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1010,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'PEDAGIO',
    evento_descricao: 'PEDÁGIO',
    veiculo: 'VWX-5566',
    motorista: 'ROBERTO SOUZA',
    unidade: 'POA',
    valor: 125.40,
    nf: '',
    fornecedor: 'CCR VIALAGOS',
    observacao: 'Viagem POA-SP',
    usuario_lancamento: 'ROBERTO',
    data_lancamento: '2025-02-24T09:00:00',
    aprovada: true // ✅ JÁ APROVADA
  },
  {
    seq_lancamento: 1011,
    data: '2025-02-23',
    tipo_lancamento: 'V',
    evento: 'PEDAGIO',
    evento_descricao: 'PEDÁGIO',
    veiculo: 'YZA-7788',
    motorista: 'AMANDA ROCHA',
    unidade: 'MTZ',
    valor: 67.80,
    nf: '',
    fornecedor: 'ARTERIS',
    observacao: '',
    usuario_lancamento: 'AMANDA',
    data_lancamento: '2025-02-23T12:15:00',
    aprovada: false // ❌ PENDENTE
  },

  // ALIMENTAÇÃO
  {
    seq_lancamento: 1012,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'ALIMENT',
    evento_descricao: 'ALIMENTAÇÃO',
    veiculo: 'ABC-1234',
    motorista: 'JOÃO SILVA',
    unidade: 'MTZ',
    valor: 45.90,
    nf: '98765',
    fornecedor: 'RESTAURANTE BOM SABOR',
    observacao: 'Almoço em viagem',
    usuario_lancamento: 'JOAO',
    data_lancamento: '2025-02-25T12:30:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1013,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'ALIMENT',
    evento_descricao: 'ALIMENTAÇÃO',
    veiculo: 'DEF-5678',
    motorista: 'MARIA SANTOS',
    unidade: 'CBA',
    valor: 38.50,
    nf: '98766',
    fornecedor: 'PADARIA CENTRAL',
    observacao: 'Café da manhã',
    usuario_lancamento: 'MARIA',
    data_lancamento: '2025-02-24T07:45:00',
    aprovada: true // ✅ JÁ APROVADA
  },
  {
    seq_lancamento: 1014,
    data: '2025-02-23',
    tipo_lancamento: 'V',
    evento: 'ALIMENT',
    evento_descricao: 'ALIMENTAÇÃO',
    veiculo: 'GHI-9012',
    motorista: 'PEDRO OLIVEIRA',
    unidade: 'MTZ',
    valor: 52.00,
    nf: '98767',
    fornecedor: 'CHURRASCARIA GRILL',
    observacao: 'Jantar em viagem',
    usuario_lancamento: 'PEDRO',
    data_lancamento: '2025-02-23T19:00:00',
    aprovada: false // ❌ PENDENTE
  },

  // HOSPEDAGEM
  {
    seq_lancamento: 1015,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'HOTEL',
    evento_descricao: 'HOSPEDAGEM',
    veiculo: 'JKL-3456',
    motorista: 'ANA COSTA',
    unidade: 'POA',
    valor: 180.00,
    nf: '55555',
    fornecedor: 'HOTEL VIAGEM',
    observacao: 'Pernoite em POA',
    usuario_lancamento: 'ANA',
    data_lancamento: '2025-02-24T20:00:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1016,
    data: '2025-02-23',
    tipo_lancamento: 'V',
    evento: 'HOTEL',
    evento_descricao: 'HOSPEDAGEM',
    veiculo: 'MNO-7890',
    motorista: 'CARLOS MENDES',
    unidade: 'CBA',
    valor: 220.00,
    nf: '55556',
    fornecedor: 'POUSADA ESTRADA',
    observacao: 'Hospedagem de emergência',
    usuario_lancamento: 'CARLOS',
    data_lancamento: '2025-02-23T22:30:00',
    aprovada: true // ✅ JÁ APROVADA
  },

  // PNEUS
  {
    seq_lancamento: 1017,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'PNEU',
    evento_descricao: 'PNEUS',
    veiculo: 'PQR-1122',
    motorista: 'LUCAS FERREIRA',
    unidade: 'POA',
    valor: 1850.00,
    nf: '77777',
    fornecedor: 'PNEUS IRMÃOS LTDA',
    observacao: 'Troca de 2 pneus traseiros',
    usuario_lancamento: 'LUCAS',
    data_lancamento: '2025-02-25T10:15:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1018,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'PNEU',
    evento_descricao: 'PNEUS',
    veiculo: 'STU-3344',
    motorista: 'FERNANDA LIMA',
    unidade: 'MTZ',
    valor: 920.00,
    nf: '77778',
    fornecedor: 'BORRACHARIA DO JOÃO',
    observacao: 'Troca de 1 pneu dianteiro',
    usuario_lancamento: 'FERNANDA',
    data_lancamento: '2025-02-24T11:00:00',
    aprovada: false // ❌ PENDENTE
  },

  // ÓLEO E LUBRIFICANTES
  {
    seq_lancamento: 1019,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'OLEO',
    evento_descricao: 'ÓLEO E LUBRIFICANTES',
    veiculo: 'ABC-1234',
    motorista: 'JOÃO SILVA',
    unidade: 'MTZ',
    valor: 350.00,
    nf: '88888',
    fornecedor: 'AUTO PEÇAS CENTRAL',
    observacao: 'Troca de óleo e filtros',
    usuario_lancamento: 'JOAO',
    data_lancamento: '2025-02-25T14:00:00',
    aprovada: true // ✅ JÁ APROVADA
  },
  {
    seq_lancamento: 1020,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'OLEO',
    evento_descricao: 'ÓLEO E LUBRIFICANTES',
    veiculo: 'VWX-5566',
    motorista: 'ROBERTO SOUZA',
    unidade: 'POA',
    valor: 280.00,
    nf: '88889',
    fornecedor: 'LOJA DO MECÂNICO',
    observacao: 'Troca de óleo sintético',
    usuario_lancamento: 'ROBERTO',
    data_lancamento: '2025-02-24T15:30:00',
    aprovada: false // ❌ PENDENTE
  },

  // BALSA/FERRY
  {
    seq_lancamento: 1021,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'BALSA',
    evento_descricao: 'BALSA/FERRY',
    veiculo: 'YZA-7788',
    motorista: 'AMANDA ROCHA',
    unidade: 'MTZ',
    valor: 150.00,
    nf: '',
    fornecedor: 'FERRY BOAT ILHABELA',
    observacao: 'Travessia para entrega',
    usuario_lancamento: 'AMANDA',
    data_lancamento: '2025-02-25T08:00:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1022,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'BALSA',
    evento_descricao: 'BALSA/FERRY',
    veiculo: 'DEF-5678',
    motorista: 'MARIA SANTOS',
    unidade: 'CBA',
    valor: 200.00,
    nf: '',
    fornecedor: 'BALSA GUARUJÁ',
    observacao: 'Ida e volta',
    usuario_lancamento: 'MARIA',
    data_lancamento: '2025-02-24T06:30:00',
    aprovada: true // ✅ JÁ APROVADA
  },

  // LAVAGEM
  {
    seq_lancamento: 1023,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'LAVAGEM',
    evento_descricao: 'LAVAGEM',
    veiculo: 'GHI-9012',
    motorista: 'PEDRO OLIVEIRA',
    unidade: 'MTZ',
    valor: 80.00,
    nf: '',
    fornecedor: 'LAVA RÁPIDO CLEAN',
    observacao: 'Lavagem completa',
    usuario_lancamento: 'PEDRO',
    data_lancamento: '2025-02-25T16:00:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1024,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'LAVAGEM',
    evento_descricao: 'LAVAGEM',
    veiculo: 'JKL-3456',
    motorista: 'ANA COSTA',
    unidade: 'POA',
    valor: 60.00,
    nf: '',
    fornecedor: 'AUTO LAVAGEM EXPRESS',
    observacao: 'Lavagem externa',
    usuario_lancamento: 'ANA',
    data_lancamento: '2025-02-24T17:30:00',
    aprovada: false // ❌ PENDENTE
  },

  // ESTACIONAMENTO
  {
    seq_lancamento: 1025,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'ESTACION',
    evento_descricao: 'ESTACIONAMENTO',
    veiculo: 'MNO-7890',
    motorista: 'CARLOS MENDES',
    unidade: 'CBA',
    valor: 35.00,
    nf: '',
    fornecedor: 'PARK CENTER',
    observacao: 'Estacionamento durante entrega',
    usuario_lancamento: 'CARLOS',
    data_lancamento: '2025-02-25T10:00:00',
    aprovada: true // ✅ JÁ APROVADA
  },
  {
    seq_lancamento: 1026,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'ESTACION',
    evento_descricao: 'ESTACIONAMENTO',
    veiculo: 'PQR-1122',
    motorista: 'LUCAS FERREIRA',
    unidade: 'POA',
    valor: 28.00,
    nf: '',
    fornecedor: 'ESTACIONE FÁCIL',
    observacao: '4 horas',
    usuario_lancamento: 'LUCAS',
    data_lancamento: '2025-02-24T14:00:00',
    aprovada: false // ❌ PENDENTE
  },

  // MAIS DESPESAS VARIADAS
  {
    seq_lancamento: 1027,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'ABAST',
    evento_descricao: 'ABASTECIMENTO',
    veiculo: 'BCD-9999',
    motorista: 'RAFAEL GOMES',
    unidade: 'MTZ',
    valor: 530.20,
    nf: '12350',
    fornecedor: 'POSTO IPIRANGA',
    observacao: '',
    usuario_lancamento: 'RAFAEL',
    data_lancamento: '2025-02-25T06:45:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1028,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'MANUT',
    evento_descricao: 'MANUTENÇÃO',
    veiculo: 'EFG-8888',
    motorista: 'JULIANA DIAS',
    unidade: 'CBA',
    valor: 675.00,
    nf: '45681',
    fornecedor: 'MECÂNICA AUTO CENTER',
    observacao: 'Alinhamento e balanceamento',
    usuario_lancamento: 'JULIANA',
    data_lancamento: '2025-02-25T13:20:00',
    aprovada: true // ✅ JÁ APROVADA
  },
  {
    seq_lancamento: 1029,
    data: '2025-02-25',
    tipo_lancamento: 'V',
    evento: 'PEDAGIO',
    evento_descricao: 'PEDÁGIO',
    veiculo: 'HIJ-7777',
    motorista: 'BRUNO MARTINS',
    unidade: 'POA',
    valor: 95.80,
    nf: '',
    fornecedor: 'ECOVIAS',
    observacao: 'Rota POA-CBA',
    usuario_lancamento: 'BRUNO',
    data_lancamento: '2025-02-25T08:50:00',
    aprovada: false // ❌ PENDENTE
  },
  {
    seq_lancamento: 1030,
    data: '2025-02-24',
    tipo_lancamento: 'V',
    evento: 'ALIMENT',
    evento_descricao: 'ALIMENTAÇÃO',
    veiculo: 'KLM-6666',
    motorista: 'CAMILA NUNES',
    unidade: 'MTZ',
    valor: 42.00,
    nf: '98768',
    fornecedor: 'LANCHONETE DA ESTRADA',
    observacao: 'Lanche rápido',
    usuario_lancamento: 'CAMILA',
    data_lancamento: '2025-02-24T15:00:00',
    aprovada: false // ❌ PENDENTE
  }
];

// 📊 Estatísticas calculadas a partir dos dados mock
export function calcularEstatisticas() {
  const total = MOCK_DESPESAS_PENDENTES.length;
  const valorTotal = MOCK_DESPESAS_PENDENTES.reduce((sum, d) => sum + d.valor, 0);
  const ticketMedio = valorTotal / total;

  // Agrupar por tipo de evento
  const porEvento = MOCK_DESPESAS_PENDENTES.reduce((acc, d) => {
    if (!acc[d.evento]) {
      acc[d.evento] = { qtd: 0, valor: 0, descricao: d.evento_descricao };
    }
    acc[d.evento].qtd++;
    acc[d.evento].valor += d.valor;
    return acc;
  }, {} as Record<string, { qtd: number; valor: number; descricao: string }>);

  // Agrupar por unidade
  const porUnidade = MOCK_DESPESAS_PENDENTES.reduce((acc, d) => {
    if (!acc[d.unidade]) {
      acc[d.unidade] = { qtd: 0, valor: 0 };
    }
    acc[d.unidade].qtd++;
    acc[d.unidade].valor += d.valor;
    return acc;
  }, {} as Record<string, { qtd: number; valor: number }>);

  return {
    total,
    valorTotal,
    ticketMedio,
    porEvento,
    porUnidade
  };
}