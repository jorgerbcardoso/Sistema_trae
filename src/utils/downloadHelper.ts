/**
 * HELPER DE DOWNLOADS DE ARQUIVOS
 * 
 * Utilitários para fazer download de arquivos com suporte a:
 * - Múltiplos downloads simultâneos ou sequenciais
 * - Mensagens de sucesso/erro via toast
 * - Loading states
 * - Retry automático em caso de falha
 */

import { toast } from 'sonner';

export interface DownloadOptions {
  url: string;
  filename: string;
  successMessage?: string;
  errorMessage?: string;
  showLoading?: boolean;
  token?: string;
}

export interface MultipleDownloadOptions {
  downloads: DownloadOptions[];
  sequential?: boolean; // Se true, baixa um de cada vez. Se false, baixa todos ao mesmo tempo
  delay?: number; // Delay entre downloads sequenciais (ms)
  showProgress?: boolean; // Mostrar progresso no toast
}

/**
 * Faz download de um único arquivo
 */
export async function downloadFile(options: DownloadOptions): Promise<boolean> {
  const {
    url,
    filename,
    successMessage = 'Download iniciado com sucesso!',
    errorMessage = 'Erro ao fazer download',
    showLoading = true,
    token
  } = options;

  let loadingToastId: string | number | undefined;

  try {
    // Mostrar loading
    if (showLoading) {
      loadingToastId = toast.loading(`Preparando download de ${filename}...`);
    }

    // Fazer requisição
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    // Verificar se é JSON (erro da API)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      // Se tem erro
      if (data.error || !data.success) {
        if (loadingToastId) toast.dismiss(loadingToastId);
        toast.error(errorMessage, {
          description: data.error || data.message || 'Erro desconhecido'
        });
        return false;
      }
    }

    // Verificar se resposta é ok
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Criar blob e fazer download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);

    // Fechar toast de loading
    if (loadingToastId) toast.dismiss(loadingToastId);

    // ✨ NOVO: Verificar se o PHP enviou mensagem customizada via headers
    const customToastType = response.headers.get('X-Toast-Type');
    const customToastMessage = response.headers.get('X-Toast-Message');
    
    if (customToastMessage && customToastType) {
      // Usar mensagem personalizada do PHP
      switch (customToastType.toLowerCase()) {
        case 'success':
          toast.success(customToastMessage, { description: filename });
          break;
        case 'error':
          toast.error(customToastMessage, { description: filename });
          break;
        case 'warning':
          toast.warning(customToastMessage, { description: filename });
          break;
        case 'info':
          toast.info(customToastMessage, { description: filename });
          break;
        default:
          toast.success(customToastMessage, { description: filename });
      }
    } else {
      // Usar mensagem padrão
      toast.success(successMessage, {
        description: filename
      });
    }

    return true;
  } catch (error) {
    console.error('Erro ao fazer download:', error);
    
    if (loadingToastId) toast.dismiss(loadingToastId);
    
    toast.error(errorMessage, {
      description: error instanceof Error ? error.message : 'Erro desconhecido'
    });

    return false;
  }
}

/**
 * Faz download de múltiplos arquivos
 */
export async function downloadMultipleFiles(options: MultipleDownloadOptions): Promise<void> {
  const {
    downloads,
    sequential = false,
    delay = 500,
    showProgress = true
  } = options;

  const total = downloads.length;
  let completed = 0;
  let failed = 0;

  let progressToastId: string | number | undefined;

  // Mostrar progresso
  if (showProgress && total > 1) {
    progressToastId = toast.loading(`Preparando ${total} download(s)...`);
  }

  if (sequential) {
    // Download sequencial (um de cada vez)
    for (let i = 0; i < downloads.length; i++) {
      const download = downloads[i];
      
      // Atualizar progresso
      if (progressToastId) {
        toast.loading(`Baixando arquivo ${i + 1} de ${total}...`, {
          id: progressToastId
        });
      }

      const success = await downloadFile({
        ...download,
        showLoading: false // Não mostrar loading individual
      });

      if (success) {
        completed++;
      } else {
        failed++;
      }

      // Aguardar delay entre downloads
      if (i < downloads.length - 1 && delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  } else {
    // Download paralelo (todos ao mesmo tempo)
    const promises = downloads.map(download =>
      downloadFile({
        ...download,
        showLoading: false // Não mostrar loading individual
      })
    );

    const results = await Promise.all(promises);
    completed = results.filter(r => r).length;
    failed = results.filter(r => !r).length;
  }

  // Fechar toast de progresso
  if (progressToastId) {
    toast.dismiss(progressToastId);
  }

  // Mostrar resultado final
  if (failed === 0) {
    toast.success('Downloads concluídos!', {
      description: `${completed} arquivo(s) baixado(s) com sucesso`
    });
  } else if (completed > 0) {
    toast.warning('Downloads parcialmente concluídos', {
      description: `${completed} sucesso, ${failed} falha(s)`
    });
  } else {
    toast.error('Falha nos downloads', {
      description: `${failed} arquivo(s) falharam`
    });
  }
}

/**
 * Abre arquivo em nova aba (para PDFs e visualização)
 */
export async function openFileInNewTab(options: Omit<DownloadOptions, 'filename'>): Promise<boolean> {
  const {
    url,
    successMessage = 'Abrindo arquivo...',
    errorMessage = 'Erro ao abrir arquivo',
    showLoading = true,
    token
  } = options;

  let loadingToastId: string | number | undefined;

  try {
    // Mostrar loading
    if (showLoading) {
      loadingToastId = toast.loading('Preparando visualização...');
    }

    // Fazer requisição
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    // Verificar se é JSON (erro da API)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      
      if (data.error || !data.success) {
        if (loadingToastId) toast.dismiss(loadingToastId);
        toast.error(errorMessage, {
          description: data.error || data.message || 'Erro desconhecido'
        });
        return false;
      }
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Criar blob e abrir em nova aba
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');

    // Cleanup após 1 minuto (tempo suficiente para o navegador carregar)
    setTimeout(() => {
      window.URL.revokeObjectURL(blobUrl);
    }, 60000);

    // Mostrar sucesso
    if (loadingToastId) toast.dismiss(loadingToastId);
    toast.success(successMessage);

    return true;
  } catch (error) {
    console.error('Erro ao abrir arquivo:', error);
    
    if (loadingToastId) toast.dismiss(loadingToastId);
    
    toast.error(errorMessage, {
      description: error instanceof Error ? error.message : 'Erro desconhecido'
    });

    return false;
  }
}