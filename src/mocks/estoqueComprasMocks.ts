/**
 * ================================================================
 * MOCKS PARA API DE ESTOQUE E COMPRAS - ITENS, FORNECEDORES, ETC
 * ================================================================
 */

export interface MockItem {
  seq_item: number;
  codigo: string;
  codigo_fabricante: string | null;
  descricao: string;
  seq_tipo_item: number;
  tipo_item_descricao: string;
  seq_unidade_medida: number;
  unidade_medida_sigla: string;
  vlr_item: number;
  estoque_minimo: number;
  estoque_maximo: number;
  ativo: string;
  data_inclusao: string;
  login_inclusao: string;
}

export interface MockFornecedor {
  seq_fornecedor: number;
  cnpj: string;
  nome: string;
  endereco: string | null;
  bairro: string | null;
  seq_cidade: number | null;
  cidade_nome: string | null;
  email: string | null;
  telefone: string | null;
  ativo: string;
  data_inclusao: string;
  login_inclusao: string;
}

export interface MockTipoItem {
  seq_tipo_item: number;
  descricao: string;
  ativo: string;
}

export interface MockUnidadeMedida {
  seq_unidade_medida: number;
  sigla: string;
  descricao: string;
  ativo: string;
}

// Tipos de Item
export const MOCK_TIPOS_ITEM: MockTipoItem[] = [
  { seq_tipo_item: 1, descricao: 'PEÇAS', ativo: 'S' },
  { seq_tipo_item: 2, descricao: 'FERRAMENTAS', ativo: 'S' },
  { seq_tipo_item: 3, descricao: 'CONSUMÍVEIS', ativo: 'S' },
  { seq_tipo_item: 4, descricao: 'LUBRIFICANTES', ativo: 'S' },
  { seq_tipo_item: 5, descricao: 'PNEUS', ativo: 'S' },
  { seq_tipo_item: 6, descricao: 'ACESSÓRIOS', ativo: 'S' },
  { seq_tipo_item: 7, descricao: 'ELÉTRICA', ativo: 'S' },
  { seq_tipo_item: 8, descricao: 'HIDRÁULICA', ativo: 'S' }
];

// Unidades de Medida
export const MOCK_UNIDADES_MEDIDA: MockUnidadeMedida[] = [
  { seq_unidade_medida: 1, sigla: 'UN', descricao: 'UNIDADE', ativo: 'S' },
  { seq_unidade_medida: 2, sigla: 'KG', descricao: 'QUILOGRAMA', ativo: 'S' },
  { seq_unidade_medida: 3, sigla: 'LT', descricao: 'LITRO', ativo: 'S' },
  { seq_unidade_medida: 4, sigla: 'MT', descricao: 'METRO', ativo: 'S' },
  { seq_unidade_medida: 5, sigla: 'CX', descricao: 'CAIXA', ativo: 'S' },
  { seq_unidade_medida: 6, sigla: 'PC', descricao: 'PEÇA', ativo: 'S' },
  { seq_unidade_medida: 7, sigla: 'JG', descricao: 'JOGO', ativo: 'S' },
  { seq_unidade_medida: 8, sigla: 'GL', descricao: 'GALÃO', ativo: 'S' }
];

// Itens
export const MOCK_ITENS: MockItem[] = [
  {
    seq_item: 1,
    codigo: 'PEC001',
    codigo_fabricante: 'MB-A123',
    descricao: 'FILTRO DE ÓLEO MERCEDES',
    seq_tipo_item: 1,
    tipo_item_descricao: 'PEÇAS',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 85.50,
    estoque_minimo: 10,
    estoque_maximo: 50,
    ativo: 'S',
    data_inclusao: '2024-01-10',
    login_inclusao: 'ADMIN'
  },
  {
    seq_item: 2,
    codigo: 'PEC002',
    codigo_fabricante: 'SC-F456',
    descricao: 'PASTILHA DE FREIO SCANIA',
    seq_tipo_item: 1,
    tipo_item_descricao: 'PEÇAS',
    seq_unidade_medida: 7,
    unidade_medida_sigla: 'JG',
    vlr_item: 320.00,
    estoque_minimo: 5,
    estoque_maximo: 30,
    ativo: 'S',
    data_inclusao: '2024-01-15',
    login_inclusao: 'ADMIN'
  },
  {
    seq_item: 3,
    codigo: 'LUB001',
    codigo_fabricante: 'SHELL-15W40',
    descricao: 'ÓLEO MOTOR SHELL 15W40',
    seq_tipo_item: 4,
    tipo_item_descricao: 'LUBRIFICANTES',
    seq_unidade_medida: 3,
    unidade_medida_sigla: 'LT',
    vlr_item: 28.90,
    estoque_minimo: 100,
    estoque_maximo: 500,
    ativo: 'S',
    data_inclusao: '2024-02-01',
    login_inclusao: 'COMPRAS'
  },
  {
    seq_item: 4,
    codigo: 'PNE001',
    codigo_fabricante: 'BR-295/80R22.5',
    descricao: 'PNEU BRIDGESTONE 295/80R22.5',
    seq_tipo_item: 5,
    tipo_item_descricao: 'PNEUS',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 1850.00,
    estoque_minimo: 8,
    estoque_maximo: 40,
    ativo: 'S',
    data_inclusao: '2024-02-10',
    login_inclusao: 'ESTOQUE'
  },
  {
    seq_item: 5,
    codigo: 'FER001',
    codigo_fabricante: null,
    descricao: 'CHAVE COMBINADA 19MM',
    seq_tipo_item: 2,
    tipo_item_descricao: 'FERRAMENTAS',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 45.00,
    estoque_minimo: 3,
    estoque_maximo: 15,
    ativo: 'S',
    data_inclusao: '2024-02-15',
    login_inclusao: 'ADMIN'
  },
  {
    seq_item: 6,
    codigo: 'CON001',
    codigo_fabricante: null,
    descricao: 'GRAXA AUTOMOTIVA',
    seq_tipo_item: 3,
    tipo_item_descricao: 'CONSUMÍVEIS',
    seq_unidade_medida: 2,
    unidade_medida_sigla: 'KG',
    vlr_item: 18.50,
    estoque_minimo: 20,
    estoque_maximo: 100,
    ativo: 'S',
    data_inclusao: '2024-03-01',
    login_inclusao: 'COMPRAS'
  },
  {
    seq_item: 7,
    codigo: 'ELE001',
    codigo_fabricante: 'BOB-12V',
    descricao: 'BOBINA IGNIÇÃO 12V',
    seq_tipo_item: 7,
    tipo_item_descricao: 'ELÉTRICA',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 125.00,
    estoque_minimo: 5,
    estoque_maximo: 25,
    ativo: 'S',
    data_inclusao: '2024-03-10',
    login_inclusao: 'ESTOQUE'
  },
  {
    seq_item: 8,
    codigo: 'HID001',
    codigo_fabricante: 'HYD-1/2',
    descricao: 'MANGUEIRA HIDRÁULICA 1/2',
    seq_tipo_item: 8,
    tipo_item_descricao: 'HIDRÁULICA',
    seq_unidade_medida: 4,
    unidade_medida_sigla: 'MT',
    vlr_item: 35.00,
    estoque_minimo: 50,
    estoque_maximo: 200,
    ativo: 'S',
    data_inclusao: '2024-03-15',
    login_inclusao: 'ADMIN'
  },
  {
    seq_item: 9,
    codigo: 'PEC003',
    codigo_fabricante: 'VW-B789',
    descricao: 'CORREIA DENTADA VOLKSWAGEN',
    seq_tipo_item: 1,
    tipo_item_descricao: 'PEÇAS',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 95.00,
    estoque_minimo: 8,
    estoque_maximo: 40,
    ativo: 'S',
    data_inclusao: '2024-04-01',
    login_inclusao: 'COMPRAS'
  },
  {
    seq_item: 10,
    codigo: 'ACC001',
    codigo_fabricante: null,
    descricao: 'EXTINTOR DE INCÊNDIO 4KG',
    seq_tipo_item: 6,
    tipo_item_descricao: 'ACESSÓRIOS',
    seq_unidade_medida: 1,
    unidade_medida_sigla: 'UN',
    vlr_item: 180.00,
    estoque_minimo: 10,
    estoque_maximo: 30,
    ativo: 'S',
    data_inclusao: '2024-04-10',
    login_inclusao: 'ESTOQUE'
  }
];

// Fornecedores
export const MOCK_FORNECEDORES: MockFornecedor[] = [
  {
    seq_fornecedor: 1,
    cnpj: '12.345.678/0001-90',
    nome: 'AUTO PEÇAS BRASIL LTDA',
    endereco: 'RUA DAS FLORES, 123',
    bairro: 'CENTRO',
    seq_cidade: 1,
    cidade_nome: 'SÃO PAULO/SP',
    email: 'contato@autopecasbrasil.com.br',
    telefone: '(11) 3333-4444',
    ativo: 'S',
    data_inclusao: '2024-01-05',
    login_inclusao: 'ADMIN'
  },
  {
    seq_fornecedor: 2,
    cnpj: '98.765.432/0001-10',
    nome: 'DISTRIBUIDORA SCANIA SP',
    endereco: 'AV. INDUSTRIAL, 5000',
    bairro: 'DISTRITO INDUSTRIAL',
    seq_cidade: 1,
    cidade_nome: 'SÃO PAULO/SP',
    email: 'vendas@scania.com.br',
    telefone: '(11) 4444-5555',
    ativo: 'S',
    data_inclusao: '2024-01-10',
    login_inclusao: 'COMPRAS'
  },
  {
    seq_fornecedor: 3,
    cnpj: '11.222.333/0001-44',
    nome: 'MERCEDES BENZ DO BRASIL',
    endereco: 'RUA MERCEDES, 1000',
    bairro: 'ZONA FRANCA',
    seq_cidade: 2,
    cidade_nome: 'RIO DE JANEIRO/RJ',
    email: 'comercial@mercedes.com.br',
    telefone: '(21) 2222-3333',
    ativo: 'S',
    data_inclusao: '2024-01-15',
    login_inclusao: 'ADMIN'
  },
  {
    seq_fornecedor: 4,
    cnpj: '55.666.777/0001-88',
    nome: 'LUBRIFICANTES SHELL',
    endereco: 'AV. PAULISTA, 2000',
    bairro: 'BELA VISTA',
    seq_cidade: 1,
    cidade_nome: 'SÃO PAULO/SP',
    email: 'pedidos@shell.com.br',
    telefone: '(11) 5555-6666',
    ativo: 'S',
    data_inclusao: '2024-02-01',
    login_inclusao: 'COMPRAS'
  },
  {
    seq_fornecedor: 5,
    cnpj: '22.333.444/0001-55',
    nome: 'PNEUS BRIDGESTONE',
    endereco: 'ROD. ANHANGUERA KM 45',
    bairro: 'ZONA INDUSTRIAL',
    seq_cidade: 3,
    cidade_nome: 'CAMPINAS/SP',
    email: 'sac@bridgestone.com.br',
    telefone: '(19) 3333-4444',
    ativo: 'S',
    data_inclusao: '2024-02-10',
    login_inclusao: 'ESTOQUE'
  },
  {
    seq_fornecedor: 6,
    cnpj: '33.444.555/0001-66',
    nome: 'FERRAMENTAS GEDORE',
    endereco: 'RUA DAS FERRAMENTAS, 500',
    bairro: 'INDUSTRIAL',
    seq_cidade: 4,
    cidade_nome: 'BELO HORIZONTE/MG',
    email: 'vendas@gedore.com.br',
    telefone: '(31) 3344-5566',
    ativo: 'S',
    data_inclusao: '2024-02-15',
    login_inclusao: 'ADMIN'
  },
  {
    seq_fornecedor: 7,
    cnpj: '44.555.666/0001-77',
    nome: 'PEÇAS VOLKSWAGEN CAMINHÕES',
    endereco: 'AV. BRASIL, 8000',
    bairro: 'CENTRO',
    seq_cidade: 2,
    cidade_nome: 'RIO DE JANEIRO/RJ',
    email: 'pecas@vwcaminhoes.com.br',
    telefone: '(21) 4455-6677',
    ativo: 'S',
    data_inclusao: '2024-03-01',
    login_inclusao: 'COMPRAS'
  },
  {
    seq_fornecedor: 8,
    cnpj: '66.777.888/0001-99',
    nome: 'EQUIPAMENTOS DE SEGURANÇA LTDA',
    endereco: 'RUA DA SEGURANÇA, 100',
    bairro: 'COMERCIAL',
    seq_cidade: 1,
    cidade_nome: 'SÃO PAULO/SP',
    email: 'vendas@equiseg.com.br',
    telefone: '(11) 6677-8899',
    ativo: 'S',
    data_inclusao: '2024-03-10',
    login_inclusao: 'ESTOQUE'
  }
];

/**
 * Busca itens com filtros
 */
export function mockListarItens(params: {
  search?: string;
  seq_tipo_item?: number;
  ativo?: string;
}): { success: boolean; data: MockItem[] } {
  let itens = [...MOCK_ITENS];

  if (params.ativo === 'S') {
    itens = itens.filter(i => i.ativo === 'S');
  }

  if (params.seq_tipo_item) {
    itens = itens.filter(i => i.seq_tipo_item === params.seq_tipo_item);
  }

  if (params.search) {
    const search = params.search.toUpperCase();
    itens = itens.filter(i =>
      i.codigo.includes(search) ||
      i.descricao.includes(search) ||
      (i.codigo_fabricante && i.codigo_fabricante.includes(search))
    );
  }

  return { success: true, data: itens };
}

/**
 * Busca fornecedores com filtros
 */
export function mockListarFornecedores(params: {
  search?: string;
  ativo?: string;
}): { success: boolean; data: MockFornecedor[] } {
  let fornecedores = [...MOCK_FORNECEDORES];

  if (params.ativo === 'S') {
    fornecedores = fornecedores.filter(f => f.ativo === 'S');
  }

  if (params.search) {
    const search = params.search.toUpperCase();
    fornecedores = fornecedores.filter(f =>
      f.nome.includes(search) ||
      f.cnpj.includes(search)
    );
  }

  return { success: true, data: fornecedores };
}
