/**
 * ================================================================
 * MOCKS PARA API DE ESTOQUES
 * ================================================================
 * Simula o comportamento real da API PHP com filtros por unidade
 */

export interface MockEstoque {
  seq_estoque: number;
  unidade: string;
  nro_estoque: string;
  descricao: string;
  ativo: string;
  data_inclusao: string;
  login_inclusao: string;
  qtd_posicoes: number;
  qtd_itens: number;
}

// Dados mockados de estoques de diferentes unidades
const MOCK_ESTOQUES: MockEstoque[] = [
  // Estoques da unidade PIN
  {
    seq_estoque: 1,
    unidade: 'PIN',
    nro_estoque: '001',
    descricao: 'ESTOQUE PRINCIPAL PIN',
    ativo: 'S',
    data_inclusao: '2024-01-15',
    login_inclusao: 'ADMIN',
    qtd_posicoes: 150,
    qtd_itens: 45
  },
  {
    seq_estoque: 2,
    unidade: 'PIN',
    nro_estoque: '002',
    descricao: 'ESTOQUE SECUNDÁRIO PIN',
    ativo: 'S',
    data_inclusao: '2024-02-10',
    login_inclusao: 'ADMIN',
    qtd_posicoes: 80,
    qtd_itens: 22
  },
  {
    seq_estoque: 3,
    unidade: 'PIN',
    nro_estoque: '003',
    descricao: 'ESTOQUE INATIVO PIN',
    ativo: 'N',
    data_inclusao: '2023-12-01',
    login_inclusao: 'ADMIN',
    qtd_posicoes: 0,
    qtd_itens: 0
  },
  
  // Estoques da unidade CAM
  {
    seq_estoque: 4,
    unidade: 'CAM',
    nro_estoque: '001',
    descricao: 'ESTOQUE PRINCIPAL CAMPINAS',
    ativo: 'S',
    data_inclusao: '2024-01-20',
    login_inclusao: 'ADMIN',
    qtd_posicoes: 200,
    qtd_itens: 67
  },
  {
    seq_estoque: 5,
    unidade: 'CAM',
    nro_estoque: '002',
    descricao: 'ESTOQUE TEMPORÁRIO CAM',
    ativo: 'N',
    data_inclusao: '2024-03-05',
    login_inclusao: 'USUARIO_CAM',
    qtd_posicoes: 30,
    qtd_itens: 8
  },
  
  // Estoques da unidade MTZ
  {
    seq_estoque: 6,
    unidade: 'MTZ',
    nro_estoque: '001',
    descricao: 'ESTOQUE MATRIZ',
    ativo: 'S',
    data_inclusao: '2024-01-01',
    login_inclusao: 'PRESTO',
    qtd_posicoes: 500,
    qtd_itens: 150
  },
  
  // Estoques da unidade SPA
  {
    seq_estoque: 7,
    unidade: 'SPA',
    nro_estoque: '001',
    descricao: 'ESTOQUE SÃO PAULO',
    ativo: 'S',
    data_inclusao: '2024-02-15',
    login_inclusao: 'ADMIN',
    qtd_posicoes: 300,
    qtd_itens: 89
  },
  {
    seq_estoque: 8,
    unidade: 'SPA',
    nro_estoque: '002',
    descricao: 'ESTOQUE RESERVA SPA',
    ativo: 'S',
    data_inclusao: '2024-03-20',
    login_inclusao: 'USUARIO_SPA',
    qtd_posicoes: 100,
    qtd_itens: 25
  },
  
  // Estoques da unidade DMN - MATRIZ
  {
    seq_estoque: 9,
    unidade: 'MTZ',
    nro_estoque: '100',
    descricao: 'ESTOQUE CENTRAL DMN',
    ativo: 'S',
    data_inclusao: '2024-01-10',
    login_inclusao: 'PRESTO',
    qtd_posicoes: 450,
    qtd_itens: 120
  },
  {
    seq_estoque: 10,
    unidade: 'MTZ',
    nro_estoque: '101',
    descricao: 'ESTOQUE PEÇAS MTZ',
    ativo: 'S',
    data_inclusao: '2024-02-05',
    login_inclusao: 'ADMIN',
    qtd_posicoes: 200,
    qtd_itens: 78
  },
  
  // Estoques da unidade DMN - FILIAL BH
  {
    seq_estoque: 11,
    unidade: 'BHZ',
    nro_estoque: '001',
    descricao: 'ESTOQUE BELO HORIZONTE',
    ativo: 'S',
    data_inclusao: '2024-03-10',
    login_inclusao: 'ADMIN',
    qtd_posicoes: 180,
    qtd_itens: 56
  },
  {
    seq_estoque: 12,
    unidade: 'BHZ',
    nro_estoque: '002',
    descricao: 'ESTOQUE TEMPORÁRIO BH',
    ativo: 'S',
    data_inclusao: '2024-04-15',
    login_inclusao: 'ESTOQUE',
    qtd_posicoes: 50,
    qtd_itens: 15
  },
  
  // Estoques da unidade DMN - FILIAL RJ
  {
    seq_estoque: 13,
    unidade: 'RJO',
    nro_estoque: '001',
    descricao: 'ESTOQUE RIO DE JANEIRO',
    ativo: 'S',
    data_inclusao: '2024-03-20',
    login_inclusao: 'ADMIN',
    qtd_posicoes: 250,
    qtd_itens: 82
  },
  {
    seq_estoque: 14,
    unidade: 'RJO',
    nro_estoque: '002',
    descricao: 'ESTOQUE ACESSÓRIOS RJ',
    ativo: 'N',
    data_inclusao: '2024-05-01',
    login_inclusao: 'COMPRAS',
    qtd_posicoes: 30,
    qtd_itens: 8
  }
];

/**
 * Simula a listagem de estoques com filtros
 */
export function mockListarEstoques(params: {
  unidade?: string;
  ativo?: string;
  unidadeUsuario?: string;
  isMTZ?: boolean;
}): { success: boolean; data: MockEstoque[] } {
  console.log('🎭 [MOCK] Listando estoques com params:', params);
  
  let estoques = [...MOCK_ESTOQUES];
  
  // ✅ FILTRO POR UNIDADE
  // Se receber parâmetro 'unidade', filtrar por ele
  if (params.unidade) {
    estoques = estoques.filter(e => e.unidade === params.unidade.toUpperCase());
  } 
  // Se não receber mas não for MTZ, filtrar pela unidade do usuário
  else if (!params.isMTZ && params.unidadeUsuario) {
    estoques = estoques.filter(e => e.unidade === params.unidadeUsuario.toUpperCase());
  }
  // Se for MTZ e não passou filtro, traz TODAS as unidades
  
  // ✅ FILTRO POR ATIVO
  if (params.ativo === 'S') {
    estoques = estoques.filter(e => e.ativo === 'S');
  }
  
  console.log(`🎭 [MOCK] Retornando ${estoques.length} estoques`);
  
  return {
    success: true,
    data: estoques
  };
}

/**
 * Simula a criação de um estoque
 */
export function mockCriarEstoque(data: {
  unidade: string;
  nro_estoque: string;
  descricao: string;
  ativo: string;
}): { success: boolean; seq_estoque: number } {
  console.log('🎭 [MOCK] Criando estoque:', data);
  
  // Simular verificação de duplicidade
  const existe = MOCK_ESTOQUES.find(
    e => e.unidade === data.unidade.toUpperCase() && 
         e.nro_estoque === data.nro_estoque.toUpperCase()
  );
  
  if (existe) {
    throw new Error('Já existe um estoque com este número nesta unidade');
  }
  
  const novoSeq = Math.max(...MOCK_ESTOQUES.map(e => e.seq_estoque)) + 1;
  
  MOCK_ESTOQUES.push({
    seq_estoque: novoSeq,
    unidade: data.unidade.toUpperCase(),
    nro_estoque: data.nro_estoque.toUpperCase(),
    descricao: data.descricao.toUpperCase(),
    ativo: data.ativo,
    data_inclusao: new Date().toISOString().split('T')[0],
    login_inclusao: 'MOCK_USER',
    qtd_posicoes: 0,
    qtd_itens: 0
  });
  
  return {
    success: true,
    seq_estoque: novoSeq
  };
}

/**
 * Simula a atualização de um estoque
 */
export function mockAtualizarEstoque(seq_estoque: number, data: {
  unidade: string;
  nro_estoque: string;
  descricao: string;
  ativo: string;
}): { success: boolean } {
  console.log('🎭 [MOCK] Atualizando estoque:', seq_estoque, data);
  
  const index = MOCK_ESTOQUES.findIndex(e => e.seq_estoque === seq_estoque);
  
  if (index === -1) {
    throw new Error('Estoque não encontrado');
  }
  
  // Verificar duplicidade (exceto consigo mesmo)
  const duplicado = MOCK_ESTOQUES.find(
    e => e.seq_estoque !== seq_estoque &&
         e.unidade === data.unidade.toUpperCase() && 
         e.nro_estoque === data.nro_estoque.toUpperCase()
  );
  
  if (duplicado) {
    throw new Error('Já existe um estoque com este número nesta unidade');
  }
  
  MOCK_ESTOQUES[index] = {
    ...MOCK_ESTOQUES[index],
    unidade: data.unidade.toUpperCase(),
    nro_estoque: data.nro_estoque.toUpperCase(),
    descricao: data.descricao.toUpperCase(),
    ativo: data.ativo
  };
  
  return { success: true };
}

/**
 * Simula inativação/reativação de um estoque
 */
export function mockToggleEstoque(seq_estoque: number, ativo: string): { success: boolean } {
  console.log('🎭 [MOCK] Toggle estoque:', seq_estoque, ativo);
  
  const index = MOCK_ESTOQUES.findIndex(e => e.seq_estoque === seq_estoque);
  
  if (index === -1) {
    throw new Error('Estoque não encontrado');
  }
  
  MOCK_ESTOQUES[index].ativo = ativo;
  
  return { success: true };
}
