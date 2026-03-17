/**
 * Utilitário para gerar cores consistentes para badges de setores
 * Cada número de setor tem sempre a mesma cor
 */

interface SetorColorClasses {
  bg: string;
  text: string;
  bgDark: string;
  textDark: string;
}

const SETOR_COLORS: SetorColorClasses[] = [
  // Azul
  {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    bgDark: 'dark:bg-blue-900',
    textDark: 'dark:text-blue-200'
  },
  // Verde
  {
    bg: 'bg-green-100',
    text: 'text-green-800',
    bgDark: 'dark:bg-green-900',
    textDark: 'dark:text-green-200'
  },
  // Roxo
  {
    bg: 'bg-purple-100',
    text: 'text-purple-800',
    bgDark: 'dark:bg-purple-900',
    textDark: 'dark:text-purple-200'
  },
  // Laranja
  {
    bg: 'bg-orange-100',
    text: 'text-orange-800',
    bgDark: 'dark:bg-orange-900',
    textDark: 'dark:text-orange-200'
  },
  // Rosa
  {
    bg: 'bg-pink-100',
    text: 'text-pink-800',
    bgDark: 'dark:bg-pink-900',
    textDark: 'dark:text-pink-200'
  },
  // Índigo
  {
    bg: 'bg-indigo-100',
    text: 'text-indigo-800',
    bgDark: 'dark:bg-indigo-900',
    textDark: 'dark:text-indigo-200'
  },
  // Amarelo
  {
    bg: 'bg-yellow-100',
    text: 'text-yellow-800',
    bgDark: 'dark:bg-yellow-900',
    textDark: 'dark:text-yellow-200'
  },
  // Teal
  {
    bg: 'bg-teal-100',
    text: 'text-teal-800',
    bgDark: 'dark:bg-teal-900',
    textDark: 'dark:text-teal-200'
  },
  // Cyan
  {
    bg: 'bg-cyan-100',
    text: 'text-cyan-800',
    bgDark: 'dark:bg-cyan-900',
    textDark: 'dark:text-cyan-200'
  },
  // Lime
  {
    bg: 'bg-lime-100',
    text: 'text-lime-800',
    bgDark: 'dark:bg-lime-900',
    textDark: 'dark:text-lime-200'
  }
];

/**
 * Retorna as classes CSS para o badge de um setor específico
 * @param nroSetor - Número do setor (1, 2, 3, ...)
 * @returns Classes CSS para aplicar ao badge
 */
export function getSetorColorClasses(nroSetor: number): string {
  // Usar módulo para ciclar pelas cores disponíveis
  const colorIndex = (nroSetor - 1) % SETOR_COLORS.length;
  const colors = SETOR_COLORS[colorIndex];
  
  return `${colors.bg} ${colors.text} ${colors.bgDark} ${colors.textDark}`;
}

/**
 * Formata o número do setor com 2 dígitos
 * @param nroSetor - Número do setor
 * @returns String formatada (ex: "01", "02", "10")
 */
export function formatSetorNumber(nroSetor: number): string {
  return nroSetor.toString().padStart(2, '0');
}
