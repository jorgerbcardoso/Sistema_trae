/**
 * Utilitário para leitura e interpretação de chave NF-e (44 dígitos)
 * 
 * ESTRUTURA DA CHAVE NF-e (44 dígitos):
 * Posições:
 * 01-02: UF do emitente
 * 03-08: AAMM da emissão
 * 09-22: CNPJ do emitente (14 dígitos)
 * 23-24: Modelo (55 para NF-e)
 * 25-27: Série da NF-e
 * 28-36: Número da NF-e (9 dígitos)
 * 37-44: Código numérico + DV
 */

export interface DadosNFe {
  chave: string;
  uf: string;
  anoMes: string;
  cnpj: string;
  cnpjFormatado: string;
  modelo: string;
  serie: string;
  numero: string;
  numeroFormatado: string;
  codigoNumerico: string;
  digitoVerificador: string;
  valido: boolean;
  erro?: string;
}

/**
 * Valida se uma string é uma chave NF-e válida
 */
export function validarChaveNFe(chave: string): boolean {
  // Remove espaços e caracteres não numéricos
  const chaveNumeros = chave.replace(/\D/g, '');
  
  // Deve ter exatamente 44 dígitos
  if (chaveNumeros.length !== 44) {
    return false;
  }
  
  return true;
}

/**
 * Formata CNPJ (14 dígitos) para XX.XXX.XXX/XXXX-XX
 */
export function formatarCNPJ(cnpj: string): string {
  const cnpjNumeros = cnpj.replace(/\D/g, '');
  
  if (cnpjNumeros.length !== 14) {
    return cnpj;
  }
  
  return cnpjNumeros.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Extrai dados da chave NF-e
 */
export function lerChaveNFe(chave: string): DadosNFe {
  // Remove espaços e caracteres não numéricos
  const chaveNumeros = chave.replace(/\D/g, '');
  
  // Validação básica
  if (chaveNumeros.length !== 44) {
    return {
      chave: chaveNumeros,
      uf: '',
      anoMes: '',
      cnpj: '',
      cnpjFormatado: '',
      modelo: '',
      serie: '',
      numero: '',
      numeroFormatado: '',
      codigoNumerico: '',
      digitoVerificador: '',
      valido: false,
      erro: `Chave inválida: deve conter exatamente 44 dígitos (encontrado: ${chaveNumeros.length})`
    };
  }
  
  // Extrai cada parte da chave
  const uf = chaveNumeros.substring(0, 2);
  const anoMes = chaveNumeros.substring(2, 8);
  const cnpj = chaveNumeros.substring(8, 22);
  const modelo = chaveNumeros.substring(22, 24);
  const serie = chaveNumeros.substring(24, 27);
  const numero = chaveNumeros.substring(27, 36);
  const codigoNumerico = chaveNumeros.substring(36, 43);
  const digitoVerificador = chaveNumeros.substring(43, 44);
  
  // Formata CNPJ
  const cnpjFormatado = formatarCNPJ(cnpj);
  
  // Formata número da NF-e (remove zeros à esquerda)
  const numeroInt = parseInt(numero, 10);
  const numeroFormatado = numeroInt.toString();
  
  // Remove zeros à esquerda da série
  const serieInt = parseInt(serie, 10);
  const serieFormatada = serieInt.toString();
  
  return {
    chave: chaveNumeros,
    uf,
    anoMes,
    cnpj,
    cnpjFormatado,
    modelo,
    serie: serieFormatada,
    numero: numeroFormatado,
    numeroFormatado,
    codigoNumerico,
    digitoVerificador,
    valido: true
  };
}

/**
 * Tabela de UFs do Brasil
 */
export const UFS_BRASIL: Record<string, string> = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF'
};

/**
 * Obtém a sigla da UF a partir do código
 */
export function obterSiglaUF(codigoUF: string): string {
  return UFS_BRASIL[codigoUF] || codigoUF;
}

/**
 * Exemplo de uso:
 * 
 * const chave = '35210812345678000123550010000000011234567890';
 * const dados = lerChaveNFe(chave);
 * 
 * console.log(dados);
 * // {
 * //   chave: '35210812345678000123550010000000011234567890',
 * //   uf: '35',
 * //   anoMes: '210812',
 * //   cnpj: '12345678000123',
 * //   cnpjFormatado: '12.345.678/0001-23',
 * //   modelo: '55',
 * //   serie: '1',
 * //   numero: '1',
 * //   numeroFormatado: '1',
 * //   codigoNumerico: '1234567',
 * //   digitoVerificador: '0',
 * //   valido: true
 * // }
 */
