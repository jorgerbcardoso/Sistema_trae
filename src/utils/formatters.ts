/**
 * Parse string brasileira para número
 * Converte "1.234,56" para 1234.56
 * @param value String no formato brasileiro
 * @returns Número
 */
export function parseBrazilianNumber(value: string): number {
  if (!value || value.trim() === '') {
    return 0;
  }
  
  // Remove pontos (separador de milhar) e substitui vírgula por ponto
  const normalized = value
    .replace(/\./g, '')
    .replace(',', '.');
  
  return parseFloat(normalized) || 0;
}

/**
 * Formata número para exibição no padrão brasileiro
 * Converte 1234.56 para "1.234,56"
 * @param value Número
 * @param decimals Quantidade de casas decimais (padrão: 2)
 * @returns String formatada
 */
export function formatNumber(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0' + (decimals > 0 ? ',' + '0'.repeat(decimals) : '');
  }
  
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formata valor monetário no padrão brasileiro
 * Converte 1234.56 para "R$ 1.234,56"
 * @param value Número
 * @param showSymbol Exibir símbolo R$ (padrão: true)
 * @returns String formatada
 */
export function formatCurrency(value: number, showSymbol: boolean = true): string {
  if (value === null || value === undefined || isNaN(value)) {
    return showSymbol ? 'R$ 0,00' : '0,00';
  }
  
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return showSymbol ? `R$ ${formatted}` : formatted;
}

/**
 * Formata código de centro de custo no padrão AAA000000
 * @param unidade Sigla da unidade (ex: "MTZ", "SPO")
 * @param nroCentroCusto Número do centro de custo (ex: 1, 25, 123)
 * @returns String formatada (ex: "MTZ000001", "SPO000025")
 */
export function formatCodigoCentroCusto(unidade: string, nroCentroCusto: number | string): string {
  if (!unidade || (nroCentroCusto === null || nroCentroCusto === undefined || nroCentroCusto === '')) {
    return '';
  }
  
  const num = typeof nroCentroCusto === 'string' ? parseInt(nroCentroCusto) : nroCentroCusto;
  
  if (isNaN(num)) {
    return '';
  }
  
  // Formatar: AAA + 6 dígitos (ex: MTZ000001)
  return `${unidade.toUpperCase()}${num.toString().padStart(6, '0')}`;
}

/**
 * Formata número da solicitação de compra no padrão AAA000000
 * @param unidade Sigla da unidade (ex: "MTZ", "SPO")
 * @param seq Sequencial da solicitação (ex: 1, 25, 123)
 * @returns String formatada (ex: "MTZ000001", "SPO000025")
 */
export function formatarNumeroSolicitacao(unidade: string, seq: number | string): string {
  if (!unidade || (seq === null || seq === undefined || seq === '')) {
    return '';
  }
  
  const num = typeof seq === 'string' ? parseInt(seq) : seq;
  
  if (isNaN(num)) {
    return '';
  }
  
  // Formatar: AAA + 6 dígitos (ex: MTZ000001)
  return `${unidade.trim().toUpperCase()}${num.toString().padStart(6, '0')}`;
}