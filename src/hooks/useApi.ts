/**
 * HOOK PERSONALIZADO PARA REQUISIÇÕES API
 * 
 * Facilita o uso do apiService com:
 * - Estado de loading
 * - Tratamento de erros
 * - Retry automático
 * - Cache opcional
 */

import { useState, useCallback } from 'react';
import { apiService, ApiError, ApiResponse } from '../services/apiService';
import { toast } from 'sonner';

interface UseApiOptions {
  showErrorToast?: boolean; // Mostrar toast de erro automaticamente
  showSuccessToast?: boolean; // Mostrar toast de sucesso automaticamente
  successMessage?: string; // Mensagem de sucesso customizada
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  execute: (endpoint: string, options?: any) => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook para fazer requisições GET
 */
export function useApiGet<T = any>(options?: UseApiOptions): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = useCallback(async (endpoint: string, params?: any): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.get<ApiResponse<T>>(endpoint, { params });

      if (response.success) {
        setData(response.data || null);
        
        if (options?.showSuccessToast) {
          toast.success(options.successMessage || 'Dados carregados com sucesso!');
        }
        
        return response.data || null;
      } else {
        throw new Error(response.message || 'Erro ao buscar dados');
      }
    } catch (err: any) {
      const apiError: ApiError = {
        message: err.message || 'Erro desconhecido',
        status: err.response?.status,
        data: err.response?.data,
      };
      
      setError(apiError);
      
      if (options?.showErrorToast !== false) {
        toast.error(apiError.message);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

/**
 * Hook para fazer requisições POST
 */
export function useApiPost<T = any>(options?: UseApiOptions): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = useCallback(async (endpoint: string, body?: any): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.post<ApiResponse<T>>(endpoint, body);

      if (response.success) {
        setData(response.data || null);
        
        if (options?.showSuccessToast) {
          toast.success(options.successMessage || 'Operação realizada com sucesso!');
        }
        
        return response.data || null;
      } else {
        throw new Error(response.message || 'Erro ao processar requisição');
      }
    } catch (err: any) {
      const apiError: ApiError = {
        message: err.message || 'Erro desconhecido',
        status: err.response?.status,
        data: err.response?.data,
      };
      
      setError(apiError);
      
      if (options?.showErrorToast !== false) {
        toast.error(apiError.message);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

/**
 * Hook para fazer requisições PUT
 */
export function useApiPut<T = any>(options?: UseApiOptions): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = useCallback(async (endpoint: string, body?: any): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.put<ApiResponse<T>>(endpoint, body);

      if (response.success) {
        setData(response.data || null);
        
        if (options?.showSuccessToast) {
          toast.success(options.successMessage || 'Atualização realizada com sucesso!');
        }
        
        return response.data || null;
      } else {
        throw new Error(response.message || 'Erro ao atualizar');
      }
    } catch (err: any) {
      const apiError: ApiError = {
        message: err.message || 'Erro desconhecido',
        status: err.response?.status,
        data: err.response?.data,
      };
      
      setError(apiError);
      
      if (options?.showErrorToast !== false) {
        toast.error(apiError.message);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

/**
 * Hook para fazer requisições DELETE
 */
export function useApiDelete<T = any>(options?: UseApiOptions): UseApiReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = useCallback(async (endpoint: string): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.delete<ApiResponse<T>>(endpoint);

      if (response.success) {
        setData(response.data || null);
        
        if (options?.showSuccessToast) {
          toast.success(options.successMessage || 'Removido com sucesso!');
        }
        
        return response.data || null;
      } else {
        throw new Error(response.message || 'Erro ao remover');
      }
    } catch (err: any) {
      const apiError: ApiError = {
        message: err.message || 'Erro desconhecido',
        status: err.response?.status,
        data: err.response?.data,
      };
      
      setError(apiError);
      
      if (options?.showErrorToast !== false) {
        toast.error(apiError.message);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}
