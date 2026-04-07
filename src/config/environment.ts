/**
 * Configuração de Ambiente
 * Detecta automaticamente se está rodando em desenvolvimento (mock) ou produção (backend real)
 * 
 * IMPORTANTE: 
 * - No Figma Make: SEMPRE MOCK
 * - Em produção: BACKEND para login/APIs, MOCK/BACKEND para dashboards (controlado por domínio)
 * - Localhost: pode alternar entre MOCK e BACKEND
 */

// Detectar ambiente
const hostname = window.location.hostname;
const isProduction = hostname === 'webpresto.com.br' || 
                     hostname === 'www.webpresto.com.br' ||
                     hostname === 'sistemagestao.aceville.com.br'; // ✅ ACEVILLE DNS

// Detectar se é acesso via IP (Aceville ou outro cliente)
const isIPAccess = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);

// DETECÇÃO MELHORADA do Figma Make
const isFigmaMake = hostname.includes('figma.com') ||
                    hostname.includes('esm.sh') ||
                    hostname.includes('fig.run') ||
                    hostname === '' || // Fallback para ambientes sem hostname definido
                    window.location.href.includes('figma');

const isLocalhost = hostname === 'localhost' || 
                    hostname === '127.0.0.1';

// Determinar modo
// 🔥 REGRA CRÍTICA: MOCK apenas no Figma Make.
// Em produção ou localhost, SEMPRE usar BACKEND real.
// No modo claro do navegador, alguns ambientes podem falhar na detecção de hostname, 
// por isso forçamos false se não houver certeza absoluta do Figma.
export const USE_MOCK_DATA = isFigmaMake && hostname.includes('figma');

// URL da API - DINÂMICA baseada no hostname
// Se for produção OU acesso via IP, usar URL relativa ao servidor atual
// Se for localhost, apontar para produção
let API_BASE_URL: string;

if (isProduction || isIPAccess) {
  // Produção ou acesso via IP: usar URL relativa
  // Isso garante que funciona tanto em webpresto.com.br quanto em 35.247.234.77
  API_BASE_URL = `${window.location.protocol}//${window.location.host}/sistema/api`;
} else if (isLocalhost) {
  // Desenvolvimento: usar PROXY LOCAL do Vite para evitar CORS
  API_BASE_URL = '/sistema/api';
} else {
  // Fallback
  API_BASE_URL = '/sistema/api';
}

export { API_BASE_URL };

export const ENVIRONMENT = {
  isProduction,
  isIPAccess,
  isFigmaMake,
  isLocalhost,
  useMockData: USE_MOCK_DATA, // Sempre TRUE - controle individual por domínio
  name: isProduction ? 'PRODUCTION' : (isIPAccess ? 'IP ACCESS' : (isFigmaMake ? 'FIGMA MAKE' : 'DEVELOPMENT')),
  apiBaseUrl: API_BASE_URL,
  // URLs do sistema
  baseUrl: isProduction ? 'https://webpresto.com.br/sistema' : (isIPAccess ? `${window.location.protocol}//${window.location.host}/sistema` : 'http://localhost:5173'),
  loginUrl: '/login',
  loginAcevilleUrl: '/login-aceville',
};