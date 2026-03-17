import { ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';

// Interface para registro de transbordo
export interface Transbordo {
  id: number;
  unidadeTransbordo: string;
  unidadeOrigem: string;
  unidadeDestino: string;
  qtdeCtes: number;
  qtdeVol: number;
  pesoCalc: number;  // em toneladas
  participacao: number;  // em percentual
  freteCif: number;
  freteFob: number;
  freteTer: number;
  freteTotal: number;
  icms: number;
}

// Interface para filtros
export interface TransbordoFilters {
  mes: number;
  ano: number;
  unidadeTransbordo?: string;
  unidadeOrigem?: string;
  unidadeDestino?: string;
}

// Mock data para desenvolvimento
const mockTransbordos: Transbordo[] = [
  {
    id: 1,
    unidadeTransbordo: 'CWB',
    unidadeOrigem: 'POA',
    unidadeDestino: 'GRU',
    qtdeCtes: 45,
    qtdeVol: 1250,
    pesoCalc: 18.5,
    participacao: 25.3,
    freteCif: 12500.00,
    freteFob: 8750.00,
    freteTer: 3200.00,
    freteTotal: 24450.00,
    icms: 2934.00
  },
  {
    id: 2,
    unidadeTransbordo: 'CWB',
    unidadeOrigem: 'FLN',
    unidadeDestino: 'GRU',
    qtdeCtes: 32,
    qtdeVol: 890,
    pesoCalc: 13.2,
    participacao: 18.1,
    freteCif: 9800.00,
    freteFob: 6200.00,
    freteTer: 2100.00,
    freteTotal: 18100.00,
    icms: 2172.00
  },
  {
    id: 3,
    unidadeTransbordo: 'GRU',
    unidadeOrigem: 'CWB',
    unidadeDestino: 'REC',
    qtdeCtes: 28,
    qtdeVol: 750,
    pesoCalc: 11.8,
    participacao: 16.2,
    freteCif: 15600.00,
    freteFob: 9400.00,
    freteTer: 4800.00,
    freteTotal: 29800.00,
    icms: 3576.00
  },
  {
    id: 4,
    unidadeTransbordo: 'CWB',
    unidadeOrigem: 'POA',
    unidadeDestino: 'RIO',
    qtdeCtes: 38,
    qtdeVol: 1020,
    pesoCalc: 15.6,
    participacao: 21.4,
    freteCif: 11200.00,
    freteFob: 7800.00,
    freteTer: 2900.00,
    freteTotal: 21900.00,
    icms: 2628.00
  },
  {
    id: 5,
    unidadeTransbordo: 'GRU',
    unidadeOrigem: 'RIO',
    unidadeDestino: 'FOR',
    qtdeCtes: 22,
    qtdeVol: 580,
    pesoCalc: 8.9,
    participacao: 12.2,
    freteCif: 13800.00,
    freteFob: 8200.00,
    freteTer: 3600.00,
    freteTotal: 25600.00,
    icms: 3072.00
  },
  {
    id: 6,
    unidadeTransbordo: 'CWB',
    unidadeOrigem: 'FLN',
    unidadeDestino: 'BSB',
    qtdeCtes: 18,
    qtdeVol: 420,
    pesoCalc: 6.8,
    participacao: 9.3,
    freteCif: 8900.00,
    freteFob: 5600.00,
    freteTer: 1800.00,
    freteTotal: 16300.00,
    icms: 1956.00
  }
];

// Mock function
const mockGetTransbordos = async (filters: TransbordoFilters) => {
  // Simular delay de rede
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Filtrar dados mockados
  let filtered = [...mockTransbordos];
  
  if (filters.unidadeTransbordo) {
    filtered = filtered.filter(t => t.unidadeTransbordo === filters.unidadeTransbordo);
  }
  
  if (filters.unidadeOrigem) {
    filtered = filtered.filter(t => t.unidadeOrigem === filters.unidadeOrigem);
  }
  
  if (filters.unidadeDestino) {
    filtered = filtered.filter(t => t.unidadeDestino === filters.unidadeDestino);
  }
  
  return {
    success: true,
    transbordos: filtered,
    total: filtered.length
  };
};

// Buscar transbordos com filtros
export const getTransbordos = async (filters: TransbordoFilters) => {
  // ✅ SEMPRE USAR MOCK no Figma Make
  if (ENVIRONMENT.isFigmaMake) {
    return await mockGetTransbordos(filters);
  }

  // Produção: Chamar API real
  const token = localStorage.getItem('auth_token');
  const domain = localStorage.getItem('presto_domain') || '';
  
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/controle_transbordo.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      ...filters,
      domain
    })
  });

  // ✅ Normalizar resposta do PHP
  if (result && result.data && result.data.transbordos) {
    const transbordosNormalizados = result.data.transbordos.map((t: any) => ({
      ...t,
      qtdeCtes: parseInt(t.qtdeCtes) || 0,
      qtdeVol: parseInt(t.qtdeVol) || 0,
      pesoCalc: parseFloat(t.pesoCalc) || 0,
      participacao: parseFloat(t.participacao) || 0,
      freteCif: parseFloat(t.freteCif) || 0,
      freteFob: parseFloat(t.freteFob) || 0,
      freteTer: parseFloat(t.freteTer) || 0,
      freteTotal: parseFloat(t.freteTotal) || 0,
      icms: parseFloat(t.icms) || 0,
    }));
    
    return {
      success: result.success,
      transbordos: transbordosNormalizados,
      total: transbordosNormalizados.length
    };
  }

  // ✅ Fallback: retornar array vazio
  return {
    success: false,
    transbordos: [],
    total: 0
  };
};

/**
 * 📊 Exporta transbordos para Excel (.xlsx)
 */
export async function exportarTransbordosExcel(
  filters: TransbordoFilters,
  transbordos: Transbordo[]
): Promise<void> {
  try {
    const token = localStorage.getItem('auth_token');
    
    const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/exportar_controle_transbordo.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        filters,
        transbordos
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'Erro ao exportar planilha');
      } catch {
        throw new Error('Erro ao exportar planilha');
      }
    }
    
    // 📥 Baixar arquivo
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Controle_Transbordo_${filters.mes.toString().padStart(2, '0')}_${filters.ano}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
  } catch (error) {
    console.error('❌ Erro ao exportar Excel:', error);
    throw error;
  }
}

export type { Transbordo, TransbordoFilters };
