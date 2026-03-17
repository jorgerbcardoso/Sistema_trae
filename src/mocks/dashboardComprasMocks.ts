// 🛒 DASHBOARD DE COMPRAS - MOCK DATA
import { MOCK_FORNECEDORES, MOCK_ITENS, MOCK_TIPOS_ITEM } from './estoqueComprasMocks';

// Mock de Pedidos de Compra para o Dashboard
interface PedidoCompraItem {
  seq_item: number;
  codigo_item: string;
  descricao_item: string;
  seq_tipo_item: number;
  tipo_item_descricao: string;
  quantidade: number;
  valor_unitario: number;
  subtotal: number;
}

interface PedidoCompraMock {
  seq_pedido: number;
  unidade: string;
  nro_pedido: string;
  data_pedido: string;
  data_inclusao: string;
  situacao: string;
  seq_fornecedor: number;
  fornecedor_nome: string;
  fornecedor_cnpj: string;
  seq_centro_custo: number;
  centro_custo_descricao: string;
  valor_total: number;
  itens: PedidoCompraItem[];
}

// Helper para gerar pedidos mockados massivamente
function gerarPedidosMock(): PedidoCompraMock[] {
  const pedidos: PedidoCompraMock[] = [];
  const unidades = ['MTZ', 'FLN', 'PIN', 'CAM'];
  const meses = ['2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];
  
  const itensDisponiveis = [
    { seq: 1, codigo: 'PNEU-01', desc: 'PNEU 275/80R22.5', tipo: 1, tipoDesc: 'PEÇAS', preco: 1250.00 },
    { seq: 2, codigo: 'FILTRO-01', desc: 'FILTRO DE ÓLEO', tipo: 1, tipoDesc: 'PEÇAS', preco: 85.50 },
    { seq: 3, codigo: 'PASTILHA-01', desc: 'PASTILHA DE FREIO', tipo: 1, tipoDesc: 'PEÇAS', preco: 219.73 },
    { seq: 4, codigo: 'OLEO-MOT', desc: 'ÓLEO MOTOR 15W40', tipo: 1, tipoDesc: 'PEÇAS', preco: 175.30 },
    { seq: 5, codigo: 'PAPEL-A4', desc: 'PAPEL A4 - RESMA', tipo: 2, tipoDesc: 'MATERIAIS DE ESCRITÓRIO', preco: 25.00 },
    { seq: 6, codigo: 'CANETA-AZ', desc: 'CANETA AZUL', tipo: 2, tipoDesc: 'MATERIAIS DE ESCRITÓRIO', preco: 1.80 },
    { seq: 7, codigo: 'TONER-HP', desc: 'TONER HP CF283A', tipo: 3, tipoDesc: 'SUPRIMENTOS DE TI', preco: 250.00 },
    { seq: 8, codigo: 'GRAMPEADOR', desc: 'GRAMPEADOR GRANDE', tipo: 2, tipoDesc: 'MATERIAIS DE ESCRITÓRIO', preco: 42.00 },
    { seq: 9, codigo: 'ARQUIVO-MORTO', desc: 'CAIXA ARQUIVO MORTO', tipo: 2, tipoDesc: 'MATERIAIS DE ESCRITÓRIO', preco: 20.00 },
    { seq: 10, codigo: 'MONITOR-24', desc: 'MONITOR 24 POLEGADAS', tipo: 3, tipoDesc: 'SUPRIMENTOS DE TI', preco: 2000.00 },
    { seq: 11, codigo: 'CADEIRA-ESCR', desc: 'CADEIRA ESCRITÓRIO', tipo: 4, tipoDesc: 'MOBILIÁRIO', preco: 228.00 },
    { seq: 12, codigo: 'TINTA-LATEX', desc: 'TINTA LÁTEX BRANCA 18L', tipo: 5, tipoDesc: 'MATERIAIS DE CONSTRUÇÃO', preco: 198.00 },
    { seq: 13, codigo: 'CIMENTO-50KG', desc: 'CIMENTO CP-II 50KG', tipo: 5, tipoDesc: 'MATERIAIS DE CONSTRUÇÃO', preco: 55.00 },
    { seq: 14, codigo: 'BATERIA-12V', desc: 'BATERIA 12V 150AH', tipo: 1, tipoDesc: 'PEÇAS', preco: 890.00 },
    { seq: 15, codigo: 'LAMPADA-LED', desc: 'LAMPADA LED 12W', tipo: 5, tipoDesc: 'MATERIAIS DE CONSTRUÇÃO', preco: 18.50 },
    { seq: 16, codigo: 'CABO-REDE', desc: 'CABO DE REDE CAT6', tipo: 3, tipoDesc: 'SUPRIMENTOS DE TI', preco: 3.50 },
    { seq: 17, codigo: 'HD-EXTERNO', desc: 'HD EXTERNO 1TB', tipo: 3, tipoDesc: 'SUPRIMENTOS DE TI', preco: 450.00 },
    { seq: 18, codigo: 'MOUSE-USB', desc: 'MOUSE USB ÓPTICO', tipo: 3, tipoDesc: 'SUPRIMENTOS DE TI', preco: 35.00 },
    { seq: 19, codigo: 'TECLADO-USB', desc: 'TECLADO USB PADRÃO', tipo: 3, tipoDesc: 'SUPRIMENTOS DE TI', preco: 65.00 },
    { seq: 20, codigo: 'LUBRIFICANTE', desc: 'LUBRIFICANTE SPRAY', tipo: 1, tipoDesc: 'PEÇAS', preco: 28.00 }
  ];
  
  const fornecedores = [
    { seq: 1, razao: 'PEÇAS E COMPONENTES AUTOMOTIVOS LTDA', cnpj: '12.345.678/0001-90' },
    { seq: 2, razao: 'PAPELARIA MODELO LTDA', cnpj: '23.456.789/0001-01' },
    { seq: 3, razao: 'LUBRIFICANTES PREMIUM LTDA', cnpj: '34.567.890/0001-12' },
    { seq: 4, razao: 'INFORMATICA TOTAL LTDA', cnpj: '45.678.901/0001-23' },
    { seq: 5, razao: 'CONSTRULAR MATERIAIS LTDA', cnpj: '56.789.012/0001-34' },
    { seq: 6, razao: 'ATACADO DE ESCRITÓRIO S.A.', cnpj: '67.890.123/0001-45' },
    { seq: 7, razao: 'TECH SOLUTIONS DISTRIBUIDORA', cnpj: '78.901.234/0001-56' }
  ];
  
  const centrosCusto = [
    { seq: 1, desc: 'MANUTENÇÃO VEÍCULOS' },
    { seq: 2, desc: 'MATERIAIS DE ESCRITÓRIO' },
    { seq: 3, desc: 'EQUIPAMENTOS DE TI' },
    { seq: 4, desc: 'INFRAESTRUTURA' }
  ];
  
  let seqPedido = 1;
  let nroPedido = 1;
  
  // Gerar pedidos para cada mês
  meses.forEach((mesAno, mesIdx) => {
    const [ano, mes] = mesAno.split('-');
    const diasNoMes = new Date(parseInt(ano), parseInt(mes), 0).getDate();
    
    // 🆕 DEZEMBRO/2025 TEM DADOS MASSIVOS (800-1000 pedidos) com distribuição garantida
    // Outros meses: 30-40 pedidos
    const qtdePedidosMes = mesAno === '2025-12' 
      ? 800 + Math.floor(Math.random() * 201) // 800-1000 pedidos em dezembro
      : 30 + Math.floor(Math.random() * 11);  // 30-40 pedidos nos outros meses
    
    for (let i = 0; i < qtdePedidosMes; i++) {
      let dia: string;
      
      // 🆕 DEZEMBRO: Garantir distribuição MASSIVA em TODOS os dias (25 pedidos por dia mínimo)
      if (mesAno === '2025-12') {
        // Primeiro garante pelo menos 25 pedidos por dia (775 pedidos garantidos)
        if (i < diasNoMes * 25) {
          const diaNum = (i % diasNoMes) + 1;
          dia = String(diaNum).padStart(2, '0');
        } else {
          // Restante: distribuição aleatória (25-225 pedidos extras)
          dia = String(Math.floor(Math.random() * diasNoMes) + 1).padStart(2, '0');
        }
      } else {
        // Outros meses: distribuição aleatória
        dia = String(Math.floor(Math.random() * diasNoMes) + 1).padStart(2, '0');
      }
      
      const dataPedido = `${mesAno}-${dia}`;
      
      const unidade = unidades[Math.floor(Math.random() * unidades.length)];
      const fornecedor = fornecedores[Math.floor(Math.random() * fornecedores.length)];
      const centroCusto = centrosCusto[Math.floor(Math.random() * centrosCusto.length)];
      
      // 1-7 itens por pedido (mais variação)
      const qtdeItens = 1 + Math.floor(Math.random() * 7);
      const itens: PedidoCompraItem[] = [];
      
      for (let j = 0; j < qtdeItens; j++) {
        const item = itensDisponiveis[Math.floor(Math.random() * itensDisponiveis.length)];
        const quantidade = Math.floor(Math.random() * 100) + 1; // até 100 unidades
        const subtotal = quantidade * item.preco;
        
        itens.push({
          seq_item: item.seq,
          codigo_item: item.codigo,
          descricao_item: item.desc,
          seq_tipo_item: item.tipo,
          tipo_item_descricao: item.tipoDesc,
          quantidade,
          valor_unitario: item.preco,
          subtotal
        });
      }
      
      const valor_total = itens.reduce((sum, i) => sum + i.subtotal, 0);
      
      pedidos.push({
        seq_pedido: seqPedido++,
        unidade,
        nro_pedido: `PED-${ano}/${String(nroPedido++).padStart(3, '0')}`,
        data_pedido: dataPedido,
        data_inclusao: dataPedido,
        situacao: 'FINALIZADO',
        seq_fornecedor: fornecedor.seq,
        fornecedor_nome: fornecedor.razao,
        fornecedor_cnpj: fornecedor.cnpj,
        seq_centro_custo: centroCusto.seq,
        centro_custo_descricao: centroCusto.desc,
        valor_total,
        itens
      });
    }
  });
  
  return pedidos;
}

const MOCK_PEDIDOS_COMPRA: PedidoCompraMock[] = gerarPedidosMock();

export interface DashboardComprasFilters {
  periodo_inclusao_inicio?: string;
  periodo_inclusao_fim?: string;
  unidade?: string;
  seq_tipo_item?: number;
  seq_item?: number;
  seq_fornecedor?: number;
  unidade_logada?: string; // 🆕 Para aplicar regras de acesso
}

export interface DashboardComprasData {
  // KPIs Gerais
  total_pedidos: number;
  total_itens: number;
  valor_total: number;
  ticket_medio: number;
  total_fornecedores: number;
  
  // 🆕 Evolução Total (dia-a-dia ou mês-a-mês)
  evolucao_total: {
    periodo: string; // "2025-01-01" ou "2025-01"
    periodo_label: string; // "01/01" ou "Jan/25"
    valor: number;
  }[];
  
  // Evolução Temporal (por mês)
  evolucao_temporal: {
    mes: string; // "2025-01", "2025-02", etc
    mes_label: string; // "Jan/25", "Fev/25", etc
    valor: number;
    qtde_pedidos: number;
  }[];
  
  // 🆕 Evolução por Fornecedor (Top 3 + Demais)
  evolucao_por_fornecedor: {
    mes_label: string;
    [fornecedor: string]: number | string; // Key dinâmica: nome fornecedor => valor
  }[];
  
  // 🆕 Evolução por Item (Top 3 + Demais)
  evolucao_por_item: {
    mes_label: string;
    [item: string]: number | string; // Key dinâmica: nome item => valor
  }[];
  
  // 🆕 Evolução por Unidade
  evolucao_por_unidade: {
    mes_label: string;
    [unidade: string]: number | string; // Key dinâmica: unidade => valor
  }[];
  
  // 🆕 Evolução por Centro de Custo (Top 3 + Demais)
  evolucao_por_centro_custo: {
    mes_label: string;
    [centroCusto: string]: number | string; // Key dinâmica: centro custo (com unidade) => valor
  }[];
  
  // 🆕 Evolução por Setor (Top 3 + Demais)
  evolucao_por_setor: {
    periodos: string[];
    series: {
      label: string;
      data: number[];
    }[];
  };
  
  // Divisão por Unidade
  por_unidade: {
    unidade: string;
    valor: number;
    qtde_pedidos: number;
    percentual: number;
  }[];
  
  // Divisão por Centro de Custo
  por_centro_custo: {
    seq_centro_custo: number;
    descricao: string;
    unidade: string;
    valor: number;
    qtde_pedidos: number;
    percentual: number;
  }[];
  
  // Divisão por Setor
  por_setor: {
    nro_setor: number;
    descricao: string;
    valor: number;
    percentual: number;
  }[];
  
  // Top Tipos de Item
  por_tipo_item: {
    seq_tipo_item: number;
    descricao: string;
    valor: number;
    qtde_pedidos: number;
    percentual: number;
  }[];
  
  // Top Itens
  por_item: {
    seq_item: number;
    codigo: string;
    descricao: string;
    tipo_item: string;
    valor: number;
    qtde_pedidos: number;
    percentual: number;
  }[];
  
  // Top Fornecedores
  por_fornecedor: {
    seq_fornecedor: number;
    nome: string;
    cnpj: string;
    valor: number;
    qtde_pedidos: number;
    percentual: number;
  }[];
}

// Helper: Gerar mês/ano formatado
function formatarMesAno(data: Date): { mes: string; mes_label: string } {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const mesNome = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][data.getMonth()];
  
  return {
    mes: `${ano}-${mes}`,
    mes_label: `${mesNome}/${String(ano).slice(2)}`
  };
}

// 🆕 Helper: Gerar dia/mês formatado
function formatarDiaMes(data: Date): { dia: string; dia_label: string } {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  
  return {
    dia: `${ano}-${mes}-${dia}`,
    dia_label: `${dia}/${mes}`
  };
}

// 🆕 Helper: Verificar se período deve ser detalhado (diário) - <= 62 dias
function isPeriodoDetalhado(inicio?: string, fim?: string): boolean {
  if (!inicio || !fim) return false;
  
  const dataInicio = new Date(inicio);
  const dataFim = new Date(fim);
  
  // Calcular diferença em dias
  const diferencaMs = dataFim.getTime() - dataInicio.getTime();
  const diferencaDias = Math.ceil(diferencaMs / (1000 * 60 * 60 * 24));
  
  const deveDetalhar = diferencaDias <= 62;
  
  console.log('🔍 DEBUG isPeriodoDetalhado:', {
    inicio,
    fim,
    diferencaDias,
    deveDetalhar
  });
  
  return deveDetalhar;
}

// 🆕 Helper: Obter mês anterior fechado
export function getUltimoMesFechado(): { inicio: string; fim: string } {
  const hoje = new Date();
  const diaAtual = hoje.getDate();
  
  const formatarData = (data: Date) => {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  };
  
  // ✅ REGRA: Se já passamos do dia 10, período = dia 1 do mês corrente até hoje
  if (diaAtual > 10) {
    const primeiroDiaMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return {
      inicio: formatarData(primeiroDiaMesAtual),
      fim: formatarData(hoje)
    };
  }
  
  // ✅ REGRA: Se ainda não chegamos ao dia 10, período = mês anterior completo
  const primeiroDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
  const ultimoDiaMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
  
  return {
    inicio: formatarData(primeiroDiaMesAnterior),
    fim: formatarData(ultimoDiaMesAnterior)
  };
}

// Mock: Gerar dados do dashboard
export async function mockGetDashboardCompras(filters: DashboardComprasFilters): Promise<{ success: boolean; data: DashboardComprasData }> {
  console.log('🔵 mockGetDashboardCompras chamado com filtros:', filters);
  
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Filtrar pedidos baseado nos filtros
  let pedidosFiltrados = MOCK_PEDIDOS_COMPRA.filter(p => p.situacao !== 'CANCELADO');
  
  // Filtro de período de inclusão (data_inclusao)
  if (filters.periodo_inclusao_inicio) {
    pedidosFiltrados = pedidosFiltrados.filter(p => p.data_inclusao >= filters.periodo_inclusao_inicio!);
  }
  if (filters.periodo_inclusao_fim) {
    pedidosFiltrados = pedidosFiltrados.filter(p => p.data_inclusao <= filters.periodo_inclusao_fim!);
  }
  
  // Filtro de unidade
  if (filters.unidade) {
    pedidosFiltrados = pedidosFiltrados.filter(p => p.unidade === filters.unidade);
  }
  
  // Filtro de fornecedor
  if (filters.seq_fornecedor) {
    pedidosFiltrados = pedidosFiltrados.filter(p => p.seq_fornecedor === filters.seq_fornecedor);
  }
  
  // Filtro de tipo de item e item (requer iterar pelos itens do pedido)
  if (filters.seq_tipo_item || filters.seq_item) {
    pedidosFiltrados = pedidosFiltrados.filter(p => {
      return p.itens.some(item => {
        const tipoMatch = !filters.seq_tipo_item || item.seq_tipo_item === filters.seq_tipo_item;
        const itemMatch = !filters.seq_item || item.seq_item === filters.seq_item;
        return tipoMatch && itemMatch;
      });
    });
  }
  
  // Calcular KPIs Gerais
  const valor_total = pedidosFiltrados.reduce((sum, p) => sum + p.valor_total, 0);
  const total_pedidos = pedidosFiltrados.length;
  const total_itens = pedidosFiltrados.reduce((sum, p) => sum + p.itens.length, 0);
  const ticket_medio = total_pedidos > 0 ? valor_total / total_pedidos : 0;
  const total_fornecedores = new Set(pedidosFiltrados.map(p => p.seq_fornecedor)).size;
  
  // 🆕 Detectar se deve agrupar por dia ou por mês
  const agruparPorDia = isPeriodoDetalhado(filters.periodo_inclusao_inicio, filters.periodo_inclusao_fim);
  
  // Evolução Temporal
  const evolucao_temporal: DashboardComprasData['evolucao_temporal'] = [];
  
  if (agruparPorDia) {
    // Agrupar por DIA
    const diasMap = new Map<string, { valor: number; qtde: number }>();
    
    pedidosFiltrados.forEach(p => {
      const data = new Date(p.data_pedido);
      const { dia, dia_label } = formatarDiaMes(data);
      
      if (!diasMap.has(dia)) {
        diasMap.set(dia, { valor: 0, qtde: 0 });
      }
      
      const item = diasMap.get(dia)!;
      item.valor += p.valor_total;
      item.qtde += 1;
    });
    
    // Ordenar por dia
    const diasOrdenados = Array.from(diasMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    diasOrdenados.forEach(([dia, dados]) => {
      const data = new Date(dia);
      const { dia_label } = formatarDiaMes(data);
      
      evolucao_temporal.push({
        mes: dia,
        mes_label: dia_label,
        valor: dados.valor,
        qtde_pedidos: dados.qtde
      });
    });
  } else {
    // Agrupar por MÊS
    const mesesMap = new Map<string, { valor: number; qtde: number }>();
    
    pedidosFiltrados.forEach(p => {
      const data = new Date(p.data_pedido);
      const { mes, mes_label } = formatarMesAno(data);
      
      if (!mesesMap.has(mes)) {
        mesesMap.set(mes, { valor: 0, qtde: 0 });
      }
      
      const item = mesesMap.get(mes)!;
      item.valor += p.valor_total;
      item.qtde += 1;
    });
    
    // Ordenar por mês e pegar últimos 6
    const mesesOrdenados = Array.from(mesesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);
    
    mesesOrdenados.forEach(([mes, dados]) => {
      const [ano, mesNum] = mes.split('-');
      const mesNome = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(mesNum) - 1];
      
      evolucao_temporal.push({
        mes,
        mes_label: `${mesNome}/${String(ano).slice(2)}`,
        valor: dados.valor,
        qtde_pedidos: dados.qtde
      });
    });
  }
  
  // Referência de períodos para os próximos gráficos
  const periodosReferencia = evolucao_temporal.map(e => ({ chave: e.mes, label: e.mes_label }));
  
  // 🆕 Evolução Total (dia-a-dia ou mês-a-mês)
  const evolucao_total: DashboardComprasData['evolucao_total'] = [];
  
  if (agruparPorDia) {
    // Agrupar por DIA
    const diasMap = new Map<string, { valor: number; qtde: number }>();
    
    pedidosFiltrados.forEach(p => {
      const data = new Date(p.data_pedido);
      const { dia, dia_label } = formatarDiaMes(data);
      
      if (!diasMap.has(dia)) {
        diasMap.set(dia, { valor: 0, qtde: 0 });
      }
      
      const item = diasMap.get(dia)!;
      item.valor += p.valor_total;
      item.qtde += 1;
    });
    
    // Ordenar por dia
    const diasOrdenados = Array.from(diasMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    diasOrdenados.forEach(([dia, dados]) => {
      const data = new Date(dia);
      const { dia_label } = formatarDiaMes(data);
      
      evolucao_total.push({
        periodo: dia,
        periodo_label: dia_label,
        valor: dados.valor
      });
    });
  } else {
    // Agrupar por MÊS
    const mesesMap = new Map<string, { valor: number; qtde: number }>();
    
    pedidosFiltrados.forEach(p => {
      const data = new Date(p.data_pedido);
      const { mes, mes_label } = formatarMesAno(data);
      
      if (!mesesMap.has(mes)) {
        mesesMap.set(mes, { valor: 0, qtde: 0 });
      }
      
      const item = mesesMap.get(mes)!;
      item.valor += p.valor_total;
      item.qtde += 1;
    });
    
    // Ordenar por mês e pegar últimos 6
    const mesesOrdenados = Array.from(mesesMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6);
    
    mesesOrdenados.forEach(([mes, dados]) => {
      const [ano, mesNum] = mes.split('-');
      const mesNome = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(mesNum) - 1];
      
      evolucao_total.push({
        periodo: mes,
        periodo_label: `${mesNome}/${String(ano).slice(2)}`,
        valor: dados.valor
      });
    });
  }
  
  // 🆕 Evolução por Fornecedor (Top 3 + Demais)
  const fornecedoresEvolucaoMap = new Map<string, { [periodo_label: string]: number }>();
  
  pedidosFiltrados.forEach(p => {
    const data = new Date(p.data_pedido);
    const periodo_label = agruparPorDia ? formatarDiaMes(data).dia_label : formatarMesAno(data).mes_label;
    
    if (!fornecedoresEvolucaoMap.has(p.fornecedor_nome)) {
      fornecedoresEvolucaoMap.set(p.fornecedor_nome, {});
    }
    
    const fornecedorData = fornecedoresEvolucaoMap.get(p.fornecedor_nome)!;
    if (!fornecedorData[periodo_label]) {
      fornecedorData[periodo_label] = 0;
    }
    fornecedorData[periodo_label] += p.valor_total;
  });
  
  // Pegar top 3 fornecedores por valor total
  const top3Fornecedores = Array.from(fornecedoresEvolucaoMap.entries())
    .map(([fornecedor, dados]) => ({
      fornecedor,
      total: Object.values(dados).reduce((sum, val) => sum + val, 0)
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(f => f.fornecedor);
  
  // 🆕 Calcular "OUTROS" - todos os fornecedores que não estão no TOP 3
  const outrosFornecedoresMap = new Map<string, number>(); // periodo_label => valor
  
  fornecedoresEvolucaoMap.forEach((dados, fornecedor) => {
    if (!top3Fornecedores.includes(fornecedor)) {
      // Este fornecedor não está no TOP 3, adicionar aos "OUTROS"
      Object.entries(dados).forEach(([periodo_label, valor]) => {
        if (!outrosFornecedoresMap.has(periodo_label)) {
          outrosFornecedoresMap.set(periodo_label, 0);
        }
        outrosFornecedoresMap.set(periodo_label, outrosFornecedoresMap.get(periodo_label)! + valor);
      });
    }
  });
  
  // Criar array com estrutura correta: um objeto por período (dia ou mês)
  const evolucao_por_fornecedor: DashboardComprasData['evolucao_por_fornecedor'] = periodosReferencia.map(({ chave, label }) => {
    const mesData: any = { mes_label: label };
    
    top3Fornecedores.forEach(fornecedor => {
      const fornecedorData = fornecedoresEvolucaoMap.get(fornecedor);
      mesData[fornecedor] = fornecedorData?.[label] || 0;
    });
    
    // 🆕 Adicionar coluna "DEMAIS"
    mesData['DEMAIS'] = outrosFornecedoresMap.get(label) || 0;
    
    return mesData;
  });
  
  // 🆕 Evolução por Item (Top 3 + Demais)
  const itensEvolucaoMap = new Map<string, { [periodo_label: string]: number }>();
  
  pedidosFiltrados.forEach(p => {
    const data = new Date(p.data_pedido);
    const periodo_label = agruparPorDia ? formatarDiaMes(data).dia_label : formatarMesAno(data).mes_label;
    
    p.itens.forEach(item => {
      if (!itensEvolucaoMap.has(item.descricao_item)) {
        itensEvolucaoMap.set(item.descricao_item, {});
      }
      
      const itemData = itensEvolucaoMap.get(item.descricao_item)!;
      if (!itemData[periodo_label]) {
        itemData[periodo_label] = 0;
      }
      itemData[periodo_label] += item.subtotal;
    });
  });
  
  // Pegar top 3 itens por valor total
  const top3Itens = Array.from(itensEvolucaoMap.entries())
    .map(([item, dados]) => ({
      item,
      total: Object.values(dados).reduce((sum, val) => sum + val, 0)
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(i => i.item);
  
  // 🆕 Calcular "OUTROS" - todos os itens que não estão no TOP 3
  const outrosItensMap = new Map<string, number>(); // periodo_label => valor
  
  itensEvolucaoMap.forEach((dados, item) => {
    if (!top3Itens.includes(item)) {
      // Este item não está no TOP 3, adicionar aos "OUTROS"
      Object.entries(dados).forEach(([periodo_label, valor]) => {
        if (!outrosItensMap.has(periodo_label)) {
          outrosItensMap.set(periodo_label, 0);
        }
        outrosItensMap.set(periodo_label, outrosItensMap.get(periodo_label)! + valor);
      });
    }
  });
  
  // Criar array com estrutura correta: um objeto por período (dia ou mês)
  const evolucao_por_item: DashboardComprasData['evolucao_por_item'] = periodosReferencia.map(({ chave, label }) => {
    const mesData: any = { mes_label: label };
    
    top3Itens.forEach(item => {
      const itemData = itensEvolucaoMap.get(item);
      mesData[item] = itemData?.[label] || 0;
    });
    
    // 🆕 Adicionar coluna "DEMAIS"
    mesData['DEMAIS'] = outrosItensMap.get(label) || 0;
    
    return mesData;
  });
  
  // 🆕 Evolução por Unidade (Top 3 + Demais quando não há filtro de unidade)
  const unidadesEvolucaoMap = new Map<string, { [periodo_label: string]: number }>();
  
  pedidosFiltrados.forEach(p => {
    const data = new Date(p.data_pedido);
    const periodo_label = agruparPorDia ? formatarDiaMes(data).dia_label : formatarMesAno(data).mes_label;
    
    if (!unidadesEvolucaoMap.has(p.unidade)) {
      unidadesEvolucaoMap.set(p.unidade, {});
    }
    
    const unidadeData = unidadesEvolucaoMap.get(p.unidade)!;
    if (!unidadeData[periodo_label]) {
      unidadeData[periodo_label] = 0;
    }
    unidadeData[periodo_label] += p.valor_total;
  });
  
  // 🔥 DECIDIR se usa TOP 3 + DEMAIS ou todas as unidades
  const unidadeLogada = filters.unidade_logada || 'MTZ';
  const isMTZ = unidadeLogada === 'MTZ';
  const temFiltroUnidade = !!filters.unidade;
  
  // Se não tem filtro de unidade E é MTZ, usar TOP 3 + DEMAIS
  const usarTop3 = !temFiltroUnidade && isMTZ;
  
  let evolucao_por_unidade: DashboardComprasData['evolucao_por_unidade'];
  
  if (usarTop3 && unidadesEvolucaoMap.size > 3) {
    // Calcular total por unidade para ranquear
    const unidadesTotais = Array.from(unidadesEvolucaoMap.entries()).map(([unidade, dados]) => ({
      unidade,
      total: Object.values(dados).reduce((sum, val) => sum + val, 0)
    }));
    
    // TOP 3 unidades por volume
    const top3Unidades = unidadesTotais
      .sort((a, b) => b.total - a.total)
      .slice(0, 3)
      .map(u => u.unidade);
    
    // 🆕 Calcular "DEMAIS" - todas as unidades que não estão no TOP 3
    const demaisUnidadesMap = new Map<string, number>(); // periodo_label => valor
    
    unidadesEvolucaoMap.forEach((dados, unidade) => {
      if (!top3Unidades.includes(unidade)) {
        // Esta unidade não está no TOP 3, adicionar aos "DEMAIS"
        Object.entries(dados).forEach(([periodo_label, valor]) => {
          if (!demaisUnidadesMap.has(periodo_label)) {
            demaisUnidadesMap.set(periodo_label, 0);
          }
          demaisUnidadesMap.set(periodo_label, demaisUnidadesMap.get(periodo_label)! + valor);
        });
      }
    });
    
    evolucao_por_unidade = periodosReferencia.map(({ chave, label }) => {
      const mesData: any = { mes_label: label };
      
      top3Unidades.forEach(unidade => {
        const unidadeData = unidadesEvolucaoMap.get(unidade);
        mesData[unidade] = unidadeData?.[label] || 0;
      });
      
      // 🆕 Adicionar coluna "DEMAIS"
      mesData['DEMAIS'] = demaisUnidadesMap.get(label) || 0;
      
      return mesData;
    });
  } else {
    // Usar todas as unidades (quando tem filtro ou quando não é MTZ)
    const todasUnidades = Array.from(unidadesEvolucaoMap.keys());
    
    evolucao_por_unidade = periodosReferencia.map(({ chave, label }) => {
      const mesData: any = { mes_label: label };
      
      todasUnidades.forEach(unidade => {
        const unidadeData = unidadesEvolucaoMap.get(unidade);
        mesData[unidade] = unidadeData?.[label] || 0;
      });
      
      return mesData;
    });
  }
  
  // 🆕 Evolução por Centro de Custo (Top 3 + Demais)
  const centrosCustoEvolucaoMap = new Map<string, { [periodo_label: string]: number }>();
  
  pedidosFiltrados.forEach(p => {
    const data = new Date(p.data_pedido);
    const periodo_label = agruparPorDia ? formatarDiaMes(data).dia_label : formatarMesAno(data).mes_label;
    
    const chaveCentroCusto = `${p.centro_custo_descricao} (${p.unidade})`;
    
    if (!centrosCustoEvolucaoMap.has(chaveCentroCusto)) {
      centrosCustoEvolucaoMap.set(chaveCentroCusto, {});
    }
    
    const centroCustoData = centrosCustoEvolucaoMap.get(chaveCentroCusto)!;
    if (!centroCustoData[periodo_label]) {
      centroCustoData[periodo_label] = 0;
    }
    centroCustoData[periodo_label] += p.valor_total;
  });
  
  // Pegar top 3 centros de custo por valor total
  const top3CentrosCusto = Array.from(centrosCustoEvolucaoMap.entries())
    .map(([centroCusto, dados]) => ({
      centroCusto,
      total: Object.values(dados).reduce((sum, val) => sum + val, 0)
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(c => c.centroCusto);
  
  // 🆕 Calcular "OUTROS" - todos os centros de custo que não estão no TOP 3
  const outrosCentrosCustoMap = new Map<string, number>(); // periodo_label => valor
  
  centrosCustoEvolucaoMap.forEach((dados, centroCusto) => {
    if (!top3CentrosCusto.includes(centroCusto)) {
      // Este centro de custo não está no TOP 3, adicionar aos "OUTROS"
      Object.entries(dados).forEach(([periodo_label, valor]) => {
        if (!outrosCentrosCustoMap.has(periodo_label)) {
          outrosCentrosCustoMap.set(periodo_label, 0);
        }
        outrosCentrosCustoMap.set(periodo_label, outrosCentrosCustoMap.get(periodo_label)! + valor);
      });
    }
  });
  
  // Criar array com estrutura correta: um objeto por período (dia ou mês)
  const evolucao_por_centro_custo: DashboardComprasData['evolucao_por_centro_custo'] = periodosReferencia.map(({ chave, label }) => {
    const mesData: any = { mes_label: label };
    
    top3CentrosCusto.forEach(centroCusto => {
      const centroCustoData = centrosCustoEvolucaoMap.get(centroCusto);
      mesData[centroCusto] = centroCustoData?.[label] || 0;
    });
    
    // 🆕 Adicionar coluna "DEMAIS"
    mesData['DEMAIS'] = outrosCentrosCustoMap.get(label) || 0;
    
    return mesData;
  });
  
  // 🆕 Evolução por Setor (Top 3 + Demais)
  const setoresEvolucaoMap = new Map<string, { [periodo_label: string]: number }>();
  
  pedidosFiltrados.forEach(p => {
    const data = new Date(p.data_pedido);
    const periodo_label = agruparPorDia ? formatarDiaMes(data).dia_label : formatarMesAno(data).mes_label;
    
    const chaveSetor = `${p.centro_custo_descricao} (${p.unidade})`;
    
    if (!setoresEvolucaoMap.has(chaveSetor)) {
      setoresEvolucaoMap.set(chaveSetor, {});
    }
    
    const setorData = setoresEvolucaoMap.get(chaveSetor)!;
    if (!setorData[periodo_label]) {
      setorData[periodo_label] = 0;
    }
    setorData[periodo_label] += p.valor_total;
  });
  
  // Pegar top 3 setores por valor total
  const top3Setores = Array.from(setoresEvolucaoMap.entries())
    .map(([setor, dados]) => ({
      setor,
      total: Object.values(dados).reduce((sum, val) => sum + val, 0)
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map(c => c.setor);
  
  // 🆕 Calcular "OUTROS" - todos os setores que não estão no TOP 3
  const outrosSetoresMap = new Map<string, number>(); // periodo_label => valor
  
  setoresEvolucaoMap.forEach((dados, setor) => {
    if (!top3Setores.includes(setor)) {
      // Este setor não está no TOP 3, adicionar aos "OUTROS"
      Object.entries(dados).forEach(([periodo_label, valor]) => {
        if (!outrosSetoresMap.has(periodo_label)) {
          outrosSetoresMap.set(periodo_label, 0);
        }
        outrosSetoresMap.set(periodo_label, outrosSetoresMap.get(periodo_label)! + valor);
      });
    }
  });
  
  // Criar array com estrutura correta: um objeto por período (dia ou mês)
  const evolucao_por_setor: DashboardComprasData['evolucao_por_setor'] = {
    periodos: periodosReferencia.map(p => p.label),
    series: [
      ...top3Setores.map(setor => ({
        label: setor,
        data: periodosReferencia.map(p => setoresEvolucaoMap.get(setor)?.[p.label] || 0)
      })),
      {
        label: 'DEMAIS',
        data: periodosReferencia.map(p => outrosSetoresMap.get(p.label) || 0)
      }
    ]
  };
  
  // Divisão por Unidade
  const unidadesMap = new Map<string, { valor: number; qtde: number }>();
  pedidosFiltrados.forEach(p => {
    if (!unidadesMap.has(p.unidade)) {
      unidadesMap.set(p.unidade, { valor: 0, qtde: 0 });
    }
    const item = unidadesMap.get(p.unidade)!;
    item.valor += p.valor_total;
    item.qtde += 1;
  });
  
  const por_unidade = Array.from(unidadesMap.entries())
    .map(([unidade, dados]) => ({
      unidade,
      valor: dados.valor,
      qtde_pedidos: dados.qtde,
      percentual: valor_total > 0 ? (dados.valor / valor_total) * 100 : 0
    }))
    .sort((a, b) => b.valor - a.valor);
  
  // Divisão por Centro de Custo
  const centrosCustoMap = new Map<number, { descricao: string; unidade: string; valor: number; qtde: number }>();
  pedidosFiltrados.forEach(p => {
    if (!centrosCustoMap.has(p.seq_centro_custo)) {
      centrosCustoMap.set(p.seq_centro_custo, {
        descricao: p.centro_custo_descricao,
        unidade: p.unidade,
        valor: 0,
        qtde: 0
      });
    }
    const item = centrosCustoMap.get(p.seq_centro_custo)!;
    item.valor += p.valor_total;
    item.qtde += 1;
  });
  
  const por_centro_custo = Array.from(centrosCustoMap.entries())
    .map(([seq_centro_custo, dados]) => ({
      seq_centro_custo,
      descricao: dados.descricao,
      unidade: dados.unidade,
      valor: dados.valor,
      qtde_pedidos: dados.qtde,
      percentual: valor_total > 0 ? (dados.valor / valor_total) * 100 : 0
    }))
    .sort((a, b) => b.valor - a.valor);
  
  // Divisão por Setor
  const setoresMap = new Map<number, { descricao: string; valor: number; qtde: number }>();
  pedidosFiltrados.forEach(p => {
    if (!setoresMap.has(p.seq_centro_custo)) {
      setoresMap.set(p.seq_centro_custo, {
        descricao: p.centro_custo_descricao,
        valor: 0,
        qtde: 0
      });
    }
    const item = setoresMap.get(p.seq_centro_custo)!;
    item.valor += p.valor_total;
    item.qtde += 1;
  });
  
  const por_setor = Array.from(setoresMap.entries())
    .map(([nro_setor, dados]) => ({
      nro_setor,
      descricao: dados.descricao,
      valor: dados.valor,
      percentual: valor_total > 0 ? (dados.valor / valor_total) * 100 : 0
    }))
    .sort((a, b) => b.valor - a.valor);
  
  // Divisão por Tipo de Item (Top 4 + Outros)
  const tiposItemMap = new Map<number, { descricao: string; valor: number; qtde: number }>();
  pedidosFiltrados.forEach(p => {
    p.itens.forEach(item => {
      if (!tiposItemMap.has(item.seq_tipo_item)) {
        tiposItemMap.set(item.seq_tipo_item, {
          descricao: item.tipo_item_descricao,
          valor: 0,
          qtde: 0
        });
      }
      const tipoItem = tiposItemMap.get(item.seq_tipo_item)!;
      tipoItem.valor += item.subtotal;
      tipoItem.qtde += 1;
    });
  });
  
  const tiposOrdenados = Array.from(tiposItemMap.entries())
    .map(([seq_tipo_item, dados]) => ({
      seq_tipo_item,
      descricao: dados.descricao,
      valor: dados.valor,
      qtde_pedidos: dados.qtde,
      percentual: valor_total > 0 ? (dados.valor / valor_total) * 100 : 0
    }))
    .sort((a, b) => b.valor - a.valor);
  
  const top4Tipos = tiposOrdenados.slice(0, 4);
  const outrosTipos = tiposOrdenados.slice(4);
  
  const por_tipo_item: DashboardComprasData['por_tipo_item'] = [...top4Tipos];
  if (outrosTipos.length > 0) {
    por_tipo_item.push({
      seq_tipo_item: 0,
      descricao: 'OUTROS',
      valor: outrosTipos.reduce((sum, t) => sum + t.valor, 0),
      qtde_pedidos: outrosTipos.reduce((sum, t) => sum + t.qtde_pedidos, 0),
      percentual: outrosTipos.reduce((sum, t) => sum + t.percentual, 0)
    });
  }
  
  // Divisão por Item (Top 4 + Outros)
  const itensMap = new Map<number, { codigo: string; descricao: string; tipo_item: string; valor: number; qtde: number }>();
  pedidosFiltrados.forEach(p => {
    p.itens.forEach(item => {
      if (!itensMap.has(item.seq_item)) {
        itensMap.set(item.seq_item, {
          codigo: item.codigo_item,
          descricao: item.descricao_item,
          tipo_item: item.tipo_item_descricao,
          valor: 0,
          qtde: 0
        });
      }
      const itemData = itensMap.get(item.seq_item)!;
      itemData.valor += item.subtotal;
      itemData.qtde += 1;
    });
  });
  
  const itensOrdenados = Array.from(itensMap.entries())
    .map(([seq_item, dados]) => ({
      seq_item,
      codigo: dados.codigo,
      descricao: dados.descricao,
      tipo_item: dados.tipo_item,
      valor: dados.valor,
      qtde_pedidos: dados.qtde,
      percentual: valor_total > 0 ? (dados.valor / valor_total) * 100 : 0
    }))
    .sort((a, b) => b.valor - a.valor);
  
  const top4Itens = itensOrdenados.slice(0, 4);
  const outrosItens = itensOrdenados.slice(4);
  
  const por_item: DashboardComprasData['por_item'] = [...top4Itens];
  if (outrosItens.length > 0) {
    por_item.push({
      seq_item: 0,
      codigo: 'OUTROS',
      descricao: 'OUTROS ITENS',
      tipo_item: '',
      valor: outrosItens.reduce((sum, i) => sum + i.valor, 0),
      qtde_pedidos: outrosItens.reduce((sum, i) => sum + i.qtde_pedidos, 0),
      percentual: outrosItens.reduce((sum, i) => sum + i.percentual, 0)
    });
  }
  
  // Divisão por Fornecedor (Top 5)
  const fornecedoresMap = new Map<number, { razao_social: string; cnpj: string; valor: number; qtde: number }>();
  pedidosFiltrados.forEach(p => {
    if (!fornecedoresMap.has(p.seq_fornecedor)) {
      fornecedoresMap.set(p.seq_fornecedor, {
        razao_social: p.fornecedor_nome,
        cnpj: p.fornecedor_cnpj,
        valor: 0,
        qtde: 0
      });
    }
    const fornecedor = fornecedoresMap.get(p.seq_fornecedor)!;
    fornecedor.valor += p.valor_total;
    fornecedor.qtde += 1;
  });
  
  const por_fornecedor = Array.from(fornecedoresMap.entries())
    .map(([seq_fornecedor, dados]) => ({
      seq_fornecedor,
      nome: dados.razao_social,
      cnpj: dados.cnpj,
      valor: dados.valor,
      qtde_pedidos: dados.qtde,
      percentual: valor_total > 0 ? (dados.valor / valor_total) * 100 : 0
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
  
  return {
    success: true,
    data: {
      total_pedidos,
      total_itens,
      valor_total,
      ticket_medio,
      total_fornecedores,
      evolucao_total,
      evolucao_temporal,
      evolucao_por_fornecedor,
      evolucao_por_item,
      evolucao_por_unidade,
      evolucao_por_centro_custo,
      evolucao_por_setor,
      por_unidade,
      por_centro_custo,
      por_setor,
      por_tipo_item,
      por_item,
      por_fornecedor
    }
  };
}