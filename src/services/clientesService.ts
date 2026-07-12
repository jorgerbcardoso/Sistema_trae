import { ENVIRONMENT } from '../config/environment';
import { apiFetch, getDefaultHeaders } from '../utils/apiUtils';

export type Cliente = {
  cnpj: string;
  nome: string;
  seq_cidade: number | null;
  data_ult_mvto: string | null;
  agenda: boolean;
  email: string;
  cidade_nome?: string | null;
  cidade_uf?: string | null;
  logo_url?: string | null;
  logo_ext?: 'png' | 'jpg' | null;
};

const onlyDigits = (v: string) => (v ?? '').replace(/\D/g, '');
export const padDoc14 = (v: string) => onlyDigits(v).padStart(14, '0').slice(-14);
export const normalizeDocumento = (v: string) => {
  const digits = onlyDigits(v);
  if (digits.length === 11 || digits.length === 14) return digits;
  return '';
};

export async function listClientes(search = ''): Promise<{ success: boolean; clientes?: Cliente[]; message?: string }> {
  return apiFetch(`${ENVIRONMENT.apiBaseUrl}/clientes/list.php`, {
    method: 'POST',
    body: JSON.stringify({ search }),
  }, true);
}

export async function upsertCliente(cliente: {
  cnpj: string;
  nome: string;
  seq_cidade: number | null;
  agenda: boolean;
  email: string;
}): Promise<{ success: boolean; message?: string }> {
  return apiFetch(`${ENVIRONMENT.apiBaseUrl}/clientes/upsert.php`, {
    method: 'POST',
    body: JSON.stringify(cliente),
  }, true);
}

export async function getClienteLogo(cnpj: string): Promise<{ success: boolean; exists?: boolean; url?: string | null; ext?: string | null; size?: number | null; message?: string }> {
  return apiFetch(`${ENVIRONMENT.apiBaseUrl}/clientes/logo_get.php`, {
    method: 'POST',
    body: JSON.stringify({ cnpj }),
  }, true);
}

export async function deleteClienteLogo(cnpj: string): Promise<{ success: boolean; removed?: number; message?: string }> {
  return apiFetch(`${ENVIRONMENT.apiBaseUrl}/clientes/logo_delete.php`, {
    method: 'POST',
    body: JSON.stringify({ cnpj }),
  }, true);
}

export async function uploadClienteLogo(cnpj: string, file: File): Promise<{ success: boolean; url?: string; ext?: string; width?: number; height?: number; warning?: string | null; message?: string }> {
  const headers = new Headers(getDefaultHeaders() as HeadersInit);
  headers.delete('Content-Type');

  const form = new FormData();
  form.append('cnpj', cnpj);
  form.append('logo', file);

  const res = await fetch(`${ENVIRONMENT.apiBaseUrl}/clientes/logo_upload.php`, {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!data) return { success: false, message: 'Resposta inválida do servidor.' };
  return data;
}
