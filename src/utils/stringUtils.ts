/**
 * ================================================================
 * UTILITÁRIOS DE STRING - SISTEMA PRESTO
 * ================================================================
 * Funções utilitárias para manipulação de strings seguindo
 * os padrões do sistema
 * ================================================================
 */

/**
 * ✅ PADRÃO GLOBAL: Todas as strings devem ser salvas em MAIÚSCULAS
 * 
 * Converte uma string para MAIÚSCULAS e remove espaços extras
 * @param value - String a ser convertida
 * @returns String em MAIÚSCULAS sem espaços extras
 */
export function toUpperCase(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * ✅ USAR EM INPUTS: Converte para MAIÚSCULAS preservando espaços
 * 
 * Converte uma string para MAIÚSCULAS SEM remover espaços
 * Use esta função em campos de input durante a digitação
 * @param value - String a ser convertida
 * @returns String em MAIÚSCULAS com espaços preservados
 */
export function toUpperCaseInput(value: string): string {
  return value.toUpperCase();
}

/**
 * Converte múltiplas strings para MAIÚSCULAS
 * @param values - Array de strings a serem convertidas
 * @returns Array de strings em MAIÚSCULAS
 */
export function toUpperCaseMultiple(values: string[]): string[] {
  return values.map(v => toUpperCase(v));
}

/**
 * Converte um objeto com propriedades string para MAIÚSCULAS
 * @param obj - Objeto com propriedades string
 * @param keys - Array com os nomes das propriedades que devem ser convertidas
 * @returns Novo objeto com as propriedades especificadas em MAIÚSCULAS
 */
export function toUpperCaseObject<T extends Record<string, any>>(
  obj: T,
  keys: (keyof T)[]
): T {
  const result = { ...obj };
  
  keys.forEach(key => {
    if (typeof result[key] === 'string') {
      result[key] = toUpperCase(result[key] as string) as any;
    }
  });
  
  return result;
}

/**
 * Normaliza uma string removendo acentos e caracteres especiais
 * @param value - String a ser normalizada
 * @returns String normalizada
 */
export function normalizeString(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Formata um CPF/CNPJ
 * @param value - Número do documento
 * @returns Documento formatado
 */
export function formatDocument(value: string): string {
  const numbers = value.replace(/\D/g, '');
  
  if (numbers.length === 11) {
    // CPF: 000.000.000-00
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (numbers.length === 14) {
    // CNPJ: 00.000.000/0000-00
    return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  return value;
}

/**
 * Remove formatação de um documento (CPF/CNPJ)
 * @param value - Documento formatado
 * @returns Apenas números
 */
export function unformatDocument(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Trunca uma string para um tamanho máximo
 * @param value - String a ser truncada
 * @param maxLength - Tamanho máximo
 * @param suffix - Sufixo a ser adicionado (padrão: '...')
 * @returns String truncada
 */
export function truncate(value: string, maxLength: number, suffix: string = '...'): string {
  if (value.length <= maxLength) {
    return value;
  }
  
  return value.substring(0, maxLength - suffix.length) + suffix;
}