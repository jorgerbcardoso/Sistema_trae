import { ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';
import { 
  mockGetManifestos, 
  type Manifesto,
  type ManifestosFilters 
} from '../mocks/mockManifestos';

// Buscar manifestos com filtros
export const getManifestos = async (filters: ManifestosFilters) => {
  // ✅ SEMPRE USAR MOCK (conforme regra estabelecida)
  if (ENVIRONMENT.isFigmaMake) {
    return await mockGetManifestos(filters);
  }

  // Produção: Chamar API real (SEM FALLBACK PARA MOCK)
  const token = localStorage.getItem('auth_token');
  const domain = localStorage.getItem('presto_domain') || '';
  
  const result = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/conferencia_saidas.php`, {
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

  // ✅ Normalizar resposta do PHP para o formato esperado pelo componente
  if (result && result.data && result.data.manifestos) {
    // 🔧 GARANTIR que valores númericos sejam parseados corretamente
    const manifestosNormalizados = result.data.manifestos.map((m: any) => ({
      ...m,
      totalFrete: parseFloat(m.totalFrete) || 0,
      ctrb: parseFloat(m.ctrb) || 0,
      pedagio: parseFloat(m.pedagio) || 0,
      pesoTotal: parseFloat(m.pesoTotal) || 0,
      cubagem: m.cubagem ? parseFloat(m.cubagem) : undefined,
      vlrMercadoria: m.vlrMercadoria ? parseFloat(m.vlrMercadoria) : undefined,
    }));
    
    return {
      success: result.success,
      manifestos: manifestosNormalizados,
      total: manifestosNormalizados.length
    };
  }

  // ✅ Fallback: Se não tiver data.manifestos, retornar array vazio
  return {
    success: false,
    manifestos: [],
    total: 0
  };
}

/**
 * 📊 Exporta manifestos para Excel (.xlsx)
 * @param filters Filtros de pesquisa (para metadados)
 * @param manifestos Array de manifestos já carregados
 * @returns Blob do arquivo Excel (download automático)
 */
export async function exportarManifestosExcel(
  filters: ManifestosFilters,
  manifestos: Manifesto[]
): Promise<void> {
  try {
    const token = localStorage.getItem('auth_token');
    
    // ✅ ENVIAR OS MANIFESTOS + FILTROS (para metadados como período)
    const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/relatorios/exportar_conferencia_saidas.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        filters,
        manifestos
      })
    });
    
    // ✅ Se não foi sucesso, tentar ler mensagem de erro
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
    a.download = `Conferencia_Saidas_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
  } catch (error) {
    console.error('❌ Erro ao exportar Excel:', error);
    throw error;
  }
}

export type { Manifesto, ManifestosFilters };