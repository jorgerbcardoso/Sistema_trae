import { ENVIRONMENT } from '../config/environment';
import { apiFetch } from '../utils/apiUtils';
import { toast } from 'sonner';

export interface Linha {
  nro_linha: number;
  nome: string;
  sigla_emit: string;
  sigla_dest: string;
  unidades: string;
  km_ida: number;  // INTEGER
  km_volta: number; // INTEGER
  vlr_min_frete: number | null;
  carrega_seg: boolean;
  carrega_ter: boolean;
  carrega_qua: boolean;
  carrega_qui: boolean;
  carrega_sex: boolean;
  carrega_sab: boolean;
  carrega_dom: boolean;
}

interface LinhaInput {
  nome: string;
  sigla_emit: string;
  sigla_dest: string;
  unidades: string;
  km_ida: number; // INTEGER
  vlr_min_frete?: number | null;
  carrega_seg: boolean;
  carrega_ter: boolean;
  carrega_qua: boolean;
  carrega_qui: boolean;
  carrega_sex: boolean;
  carrega_sab: boolean;
  carrega_dom: boolean;
}

// ============================================
// MOCK DATA
// ============================================
const MOCK_LINHAS: Linha[] = [
  {
    nro_linha: 1,
    nome: 'LINHA SP-RJ',
    sigla_emit: 'SJC',
    sigla_dest: 'RJO',
    unidades: 'TAU,GUA',
    km_ida: 450,
    km_volta: 0,
    vlr_min_frete: null,
    carrega_seg: true,
    carrega_ter: true,
    carrega_qua: true,
    carrega_qui: true,
    carrega_sex: true,
    carrega_sab: true,
    carrega_dom: true,
  },
  {
    nro_linha: 2,
    nome: 'LINHA SP-MG',
    sigla_emit: 'CAM',
    sigla_dest: 'BHZ',
    unidades: 'ATI,POA,VGD',
    km_ida: 580,
    km_volta: 0,
    vlr_min_frete: null,
    carrega_seg: true,
    carrega_ter: true,
    carrega_qua: true,
    carrega_qui: true,
    carrega_sex: true,
    carrega_sab: true,
    carrega_dom: true,
  },
  {
    nro_linha: 3,
    nome: 'LINHA RJ-MG',
    sigla_emit: 'RJO',
    sigla_dest: 'BHZ',
    unidades: 'JFO,BBR',
    km_ida: 280,
    km_volta: 0,
    vlr_min_frete: null,
    carrega_seg: true,
    carrega_ter: true,
    carrega_qua: true,
    carrega_qui: true,
    carrega_sex: true,
    carrega_sab: true,
    carrega_dom: true,
  }
];

let mockLinhasState = [...MOCK_LINHAS];
let mockNextId = 4;

// ============================================
// LIST
// ============================================
export async function listLinhas(domain: string) {
  if (ENVIRONMENT.isFigmaMake) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 300));
    return {
      success: true,
      linhas: mockLinhasState
    };
  }

  try {
    const token = localStorage.getItem('auth_token');
    const result = await apiFetch(
      `${ENVIRONMENT.apiBaseUrl}/linhas/list.php?domain=${domain}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Domain': domain
        }
      }
    );

    return result;
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao carregar linhas',
      linhas: []
    };
  }
}

// ============================================
// CREATE
// ============================================
export async function createLinha(domain: string, data: LinhaInput) {
  if (ENVIRONMENT.isFigmaMake) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verificar se já existe linha com as mesmas unidades
    const unidadesCompletas = `${data.sigla_emit},${data.unidades},${data.sigla_dest}`;
    const linhaExistente = mockLinhasState.find(l => {
      const unidadesExistentes = `${l.sigla_emit},${l.unidades},${l.sigla_dest}`;
      return unidadesExistentes === unidadesCompletas;
    });

    if (linhaExistente) {
      toast.error('Já existe uma linha com as mesmas unidades');
      return {
        success: false,
        error: 'Já existe uma linha com as mesmas unidades'
      };
    }

    const novaLinha: Linha = {
      nro_linha: mockNextId++,
      nome: data.nome,
      sigla_emit: data.sigla_emit,
      sigla_dest: data.sigla_dest,
      unidades: data.unidades,
      km_ida: data.km_ida,
      km_volta: 0,
      vlr_min_frete: data.vlr_min_frete ?? null,
      carrega_seg: data.carrega_seg,
      carrega_ter: data.carrega_ter,
      carrega_qua: data.carrega_qua,
      carrega_qui: data.carrega_qui,
      carrega_sex: data.carrega_sex,
      carrega_sab: data.carrega_sab,
      carrega_dom: data.carrega_dom,
    };

    mockLinhasState.push(novaLinha);

    toast.success('Linha cadastrada com sucesso');
    return {
      success: true,
      linha: novaLinha
    };
  }

  try {
    const token = localStorage.getItem('auth_token');
    const result = await apiFetch(
      `${ENVIRONMENT.apiBaseUrl}/linhas/create.php`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Domain': domain
        },
        body: JSON.stringify(data)
      }
    );

    return result;
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao criar linha'
    };
  }
}

// ============================================
// UPDATE
// ============================================
export async function updateLinha(domain: string, nroLinha: number, data: LinhaInput) {
  if (ENVIRONMENT.isFigmaMake) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));

    const index = mockLinhasState.findIndex(l => l.nro_linha === nroLinha);
    if (index === -1) {
      toast.error('Linha não encontrada');
      return {
        success: false,
        error: 'Linha não encontrada'
      };
    }

    // Verificar se já existe linha com as mesmas unidades (excluindo a própria)
    const unidadesCompletas = `${data.sigla_emit},${data.unidades},${data.sigla_dest}`;
    const linhaExistente = mockLinhasState.find(l => {
      if (l.nro_linha === nroLinha) return false; // Ignorar a própria linha
      const unidadesExistentes = `${l.sigla_emit},${l.unidades},${l.sigla_dest}`;
      return unidadesExistentes === unidadesCompletas;
    });

    if (linhaExistente) {
      toast.error('Já existe uma linha com as mesmas unidades');
      return {
        success: false,
        error: 'Já existe uma linha com as mesmas unidades'
      };
    }

    mockLinhasState[index] = {
      ...mockLinhasState[index],
      nome: data.nome,
      sigla_emit: data.sigla_emit,
      sigla_dest: data.sigla_dest,
      unidades: data.unidades,
      km_ida: data.km_ida,
      vlr_min_frete: data.vlr_min_frete ?? null,
      carrega_seg: data.carrega_seg,
      carrega_ter: data.carrega_ter,
      carrega_qua: data.carrega_qua,
      carrega_qui: data.carrega_qui,
      carrega_sex: data.carrega_sex,
      carrega_sab: data.carrega_sab,
      carrega_dom: data.carrega_dom,
    };

    toast.success('Linha atualizada com sucesso');
    return {
      success: true,
      linha: mockLinhasState[index]
    };
  }

  try {
    const token = localStorage.getItem('auth_token');
    const result = await apiFetch(
      `${ENVIRONMENT.apiBaseUrl}/linhas/update.php`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Domain': domain
        },
        body: JSON.stringify({ nro_linha: nroLinha, ...data })
      }
    );

    return result;
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao atualizar linha'
    };
  }
}

// ============================================
// DELETE
// ============================================
export async function deleteLinha(domain: string, nroLinha: number) {
  if (ENVIRONMENT.isFigmaMake) {
    // Simular delay de rede
    await new Promise(resolve => setTimeout(resolve, 500));

    const index = mockLinhasState.findIndex(l => l.nro_linha === nroLinha);
    if (index === -1) {
      toast.error('Linha não encontrada');
      return {
        success: false,
        error: 'Linha não encontrada'
      };
    }

    mockLinhasState.splice(index, 1);

    toast.success('Linha excluída com sucesso');
    return {
      success: true
    };
  }

  try {
    const token = localStorage.getItem('auth_token');
    const result = await apiFetch(
      `${ENVIRONMENT.apiBaseUrl}/linhas/delete.php`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Domain': domain
        },
        body: JSON.stringify({ nro_linha: nroLinha })
      }
    );

    return result;
  } catch (error) {
    return {
      success: false,
      error: 'Erro ao excluir linha'
    };
  }
}

// ============================================
// VALIDATE UNIDADES
// ============================================
export async function validateUnidades(domain: string, siglas: string[]) {
  if (ENVIRONMENT.isFigmaMake) {
    // No mock, todas as unidades são válidas
    await new Promise(resolve => setTimeout(resolve, 200));
    return {
      success: true,
      valid: true
    };
  }

  try {
    const token = localStorage.getItem('auth_token');
    const result = await apiFetch(
      `${ENVIRONMENT.apiBaseUrl}/linhas/validate_unidades.php`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Domain': domain
        },
        body: JSON.stringify({ siglas })
      }
    );

    return result;
  } catch (error) {
    return {
      success: false,
      valid: false,
      error: 'Erro ao validar unidades'
    };
  }
}
