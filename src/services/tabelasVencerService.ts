import { ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';
import { mockGetTabelasVencer, type TabelaVencer } from '../mocks/mockData';

/**
 * Service para consultar Tabelas a Vencer
 * Usa API real em produção e mock no Figma Make
 */

// Buscar tabelas a vencer
export const getTabelasVencer = async () => {
  // ✅ SEMPRE USAR MOCK no Figma Make
  if (ENVIRONMENT.isFigmaMake) {
    return await mockGetTabelasVencer();
  }

  // Produção: Chamar API real PHP
  const token = localStorage.getItem('auth_token');
  const domain = localStorage.getItem('presto_domain') || '';
  
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/tabelas_vencer.php`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      domain
    })
  });

  // ✅ Normalizar resposta do PHP para o formato esperado pelo componente
  if (result && result.success) {
    return {
      success: true,
      data: result.data || [],
      total: result.total || 0,
      periodo: result.periodo || ''
    };
  }

  // ✅ Fallback: Se não tiver sucesso, retornar array vazio
  return {
    success: false,
    data: [],
    total: 0,
    periodo: ''
  };
};

/**
 * 📊 Exporta tabelas a vencer para CSV
 * CSV é muito mais leve que Excel (evita erro 413 Payload Too Large)
 * @param periodo Período de referência { inicio, fim }
 * @returns Download automático do CSV
 */
export async function exportarTabelasVencerExcel(
  tabelas: TabelaVencer[],
  periodo: { inicio: string; fim: string } | null
): Promise<void> {
  try {
    const token = localStorage.getItem('auth_token');
    const domain = localStorage.getItem('presto_domain') || '';
    
    // ✅ CHAMAR ENDPOINT CSV (sem enviar dados - regenera no servidor)
    const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/exportar_tabelas_vencer_csv.php`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Domain': domain
      }
    });
    
    // ✅ Se não foi sucesso, tentar ler mensagem de erro
    if (!response.ok) {
      const errorText = await response.text();
      try {
        const errorJson = JSON.parse(errorText);
        throw new Error(errorJson.message || 'Erro ao exportar CSV');
      } catch {
        throw new Error(`Erro ao exportar CSV (${response.status})`);
      }
    }
    
    // 📥 Baixar arquivo CSV
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tabelas_Vencer_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
  } catch (error) {
    console.error('❌ Erro ao exportar CSV:', error);
    throw error;
  }
}