/**
 * EXEMPLOS DE USO DO DOWNLOAD HELPER
 * 
 * Este arquivo contém exemplos práticos de como usar o downloadHelper
 * para diferentes cenários de download de arquivos.
 */

import { downloadFile, downloadMultipleFiles, openFileInNewTab } from './downloadHelper';

// ============================================
// EXEMPLO 1: Download Simples
// ============================================
export async function exemploDownloadSimples() {
  const token = localStorage.getItem('auth_token');
  
  await downloadFile({
    url: '/sistema/api/relatorios/financeiro.pdf',
    filename: 'relatorio_financeiro.pdf',
    successMessage: 'Relatório baixado com sucesso!',
    errorMessage: 'Erro ao baixar relatório',
    showLoading: true,
    token
  });
}

// ============================================
// EXEMPLO 2: Download Múltiplo Sequencial
// Útil para evitar sobrecarga do servidor
// ============================================
export async function exemploDownloadSequencial() {
  const token = localStorage.getItem('auth_token');
  const year = 2024;
  
  // Baixar relatórios de todos os meses
  const downloads = [];
  for (let month = 1; month <= 12; month++) {
    downloads.push({
      url: `/sistema/api/relatorios/mensal.php?year=${year}&month=${month}`,
      filename: `relatorio_${year}_${String(month).padStart(2, '0')}.pdf`,
      successMessage: `Relatório ${month}/${year} baixado!`,
      token
    });
  }
  
  await downloadMultipleFiles({
    downloads,
    sequential: true, // Baixar um de cada vez
    delay: 1000, // 1 segundo entre cada download
    showProgress: true
  });
}

// ============================================
// EXEMPLO 3: Download Múltiplo Paralelo
// Útil para arquivos pequenos ou quando o servidor aguenta
// ============================================
export async function exemploDownloadParalelo() {
  const token = localStorage.getItem('auth_token');
  
  await downloadMultipleFiles({
    downloads: [
      {
        url: '/sistema/api/relatorios/receitas.csv',
        filename: 'receitas_2024.csv',
        successMessage: 'Receitas exportadas!',
        token
      },
      {
        url: '/sistema/api/relatorios/despesas.csv',
        filename: 'despesas_2024.csv',
        successMessage: 'Despesas exportadas!',
        token
      },
      {
        url: '/sistema/api/relatorios/lucros.csv',
        filename: 'lucros_2024.csv',
        successMessage: 'Lucros exportados!',
        token
      }
    ],
    sequential: false, // Baixar todos ao mesmo tempo
    showProgress: true
  });
}

// ============================================
// EXEMPLO 4: Visualizar PDF em Nova Aba
// ============================================
export async function exemploVisualizarPDF() {
  const token = localStorage.getItem('auth_token');
  
  await openFileInNewTab({
    url: '/sistema/api/relatorios/financeiro.pdf',
    successMessage: 'Abrindo relatório...',
    errorMessage: 'Erro ao abrir PDF',
    showLoading: true,
    token
  });
}

// ============================================
// EXEMPLO 5: Download Condicional
// Baixa múltiplos arquivos com base em condições
// ============================================
export async function exemploDownloadCondicional(options: {
  incluirReceitas: boolean;
  incluirDespesas: boolean;
  incluirDRE: boolean;
  year: number;
  month?: number;
}) {
  const token = localStorage.getItem('auth_token');
  const downloads = [];
  
  const period = options.month 
    ? `${options.year}_${String(options.month).padStart(2, '0')}`
    : `${options.year}`;
  
  if (options.incluirReceitas) {
    downloads.push({
      url: `/sistema/api/dashboards/dre/export_receitas.php`,
      filename: `receitas_${period}.csv`,
      successMessage: 'Receitas exportadas!',
      token
    });
  }
  
  if (options.incluirDespesas) {
    downloads.push({
      url: `/sistema/api/dashboards/dre/export_despesas.php`,
      filename: `despesas_${period}.csv`,
      successMessage: 'Despesas exportadas!',
      token
    });
  }
  
  if (options.incluirDRE) {
    downloads.push({
      url: `/sistema/api/relatorios/dre.pdf`,
      filename: `DRE_${period}.pdf`,
      successMessage: 'DRE exportado!',
      token
    });
  }
  
  if (downloads.length === 0) {
    return;
  }
  
  // Se for apenas 1 arquivo, não precisa mostrar progresso
  if (downloads.length === 1) {
    await downloadFile(downloads[0]);
  } else {
    // Múltiplos arquivos: mostrar progresso
    await downloadMultipleFiles({
      downloads,
      sequential: true,
      delay: 500,
      showProgress: true
    });
  }
}

// ============================================
// EXEMPLO 6: Download com Retry Automático
// ============================================
export async function exemploDownloadComRetry(
  url: string,
  filename: string,
  maxRetries: number = 3
) {
  const token = localStorage.getItem('auth_token');
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const success = await downloadFile({
      url,
      filename,
      successMessage: 'Download concluído!',
      errorMessage: attempt === maxRetries 
        ? 'Falha após múltiplas tentativas'
        : `Tentativa ${attempt} falhou, tentando novamente...`,
      showLoading: true,
      token
    });
    
    if (success) {
      return true;
    }
    
    // Aguardar antes de tentar novamente (exceto na última tentativa)
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return false;
}
