import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { handleAPIResponse } from '../../utils/apiUtils';
import { AdminLayout } from '../layouts/AdminLayout';
import { Users } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router';

interface ClienteVendedor {
  cnpj: string;
  nome: string;
  cidade: string;
  uf: string;
  data_ult_mvto: string | null;
}

// ✅ PADRÃO: Limite de 50 registros por página
const ITEMS_PER_PAGE = 50;

// ✅ MOCK DATA para Figma Make
const mockClientes: ClienteVendedor[] = [
  { cnpj: '12.345.678/0001-90', nome: 'EMPRESA ABC LTDA', cidade: 'SÃO PAULO', uf: 'SP', data_ult_mvto: '2026-01-25' },
  { cnpj: '98.765.432/0001-10', nome: 'COMÉRCIO XYZ S/A', cidade: 'RIO DE JANEIRO', uf: 'RJ', data_ult_mvto: '2026-01-20' },
  { cnpj: '11.222.333/0001-44', nome: 'DISTRIBUIDORA BETA', cidade: 'BELO HORIZONTE', uf: 'MG', data_ult_mvto: '2026-01-15' },
  { cnpj: '55.666.777/0001-88', nome: 'TRANSPORTES GAMMA', cidade: 'CURITIBA', uf: 'PR', data_ult_mvto: '2026-01-10' },
  { cnpj: '99.888.777/0001-66', nome: 'LOGÍSTICA DELTA', cidade: 'PORTO ALEGRE', uf: 'RS', data_ult_mvto: null },
  { cnpj: '22.333.444/0001-55', nome: 'DISTRIBUIDORA ALPHA', cidade: 'SALVADOR', uf: 'BA', data_ult_mvto: '2026-01-22' },
  { cnpj: '33.444.555/0001-66', nome: 'COMÉRCIO OMEGA', cidade: 'FORTALEZA', uf: 'CE', data_ult_mvto: '2026-01-18' },
  { cnpj: '44.555.666/0001-77', nome: 'TRANSPORTES SIGMA', cidade: 'RECIFE', uf: 'PE', data_ult_mvto: '2026-01-12' },
  { cnpj: '55.666.777/0001-88', nome: 'LOGÍSTICA THETA', cidade: 'BRASÍLIA', uf: 'DF', data_ult_mvto: '2026-01-08' },
  { cnpj: '66.777.888/0001-99', nome: 'EMPRESA ZETA', cidade: 'MANAUS', uf: 'AM', data_ult_mvto: '2026-01-05' },
];

export function ClientesVendedor() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const login = searchParams.get('login') || '';
  const nomeVendedor = searchParams.get('nome') || '';

  const [clientes, setClientes] = useState<ClienteVendedor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ClienteVendedor;
    direction: 'asc' | 'desc';
  }>({ key: 'nome', direction: 'asc' });

  usePageTitle(`Clientes - ${nomeVendedor}`);

  useEffect(() => {
    if (!login) {
      toast.error('Login do vendedor não informado');
      navigate('/cadastros/vendedores');
      return;
    }
    loadClientes();
  }, [login, user?.domain]);

  const loadClientes = async () => {
    try {
      setIsLoading(true);
      
      // ✅ REGRA: No Figma Make, SEMPRE usar mock
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        // Simular delay de carregamento
        await new Promise(resolve => setTimeout(resolve, 600));
        setClientes(mockClientes);
      } else {
        // Usar API real
        const token = localStorage.getItem('auth_token');
        const response = await fetch(
          `${ENVIRONMENT.apiBaseUrl}/cadastros/vendedores.php?action=clientes&login=${encodeURIComponent(login)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Domain': user?.domain || ''
            }
          }
        );

        const data = await handleAPIResponse(response);

        if (data.success) {
          setClientes(data.clientes || []);
        } else {
          if (!data.toast && data.error) {
            toast.error(data.error);
          }
          setClientes([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes do vendedor');
      setClientes([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ============================================
  // ORDENAÇÃO
  // ============================================
  const sortedClientes = useMemo(() => {
    const sorted = [...clientes];

    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      return 0;
    });

    return sorted;
  }, [clientes, sortConfig]);

  // ============================================
  // PAGINAÇÃO (50 registros por página)
  // ============================================
  const totalPages = Math.ceil(sortedClientes.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedClientes = sortedClientes.slice(startIndex, endIndex);

  const handleSort = (key: keyof ClienteVendedor) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key: keyof ClienteVendedor) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-4 h-4" />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-4 h-4" /> 
      : <ArrowDown className="w-4 h-4" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <AdminLayout
      title="CLIENTES DO VENDEDOR"
      description={`${nomeVendedor} (${login})`}
      icon={Users}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>Clientes Vinculados</CardTitle>
            <CardDescription>
              Gerenciamento de Vendedores e Carteiras
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate('/cadastros/vendedores')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
        </CardHeader>

        <CardContent>
          {/* LOADING */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              {/* TABELA */}
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">
                        <button
                          onClick={() => handleSort('cnpj')}
                          className="flex items-center gap-2 font-medium hover:text-blue-600"
                        >
                          CNPJ
                          {getSortIcon('cnpj')}
                        </button>
                      </TableHead>
                      <TableHead>
                        <button
                          onClick={() => handleSort('nome')}
                          className="flex items-center gap-2 font-medium hover:text-blue-600"
                        >
                          Nome
                          {getSortIcon('nome')}
                        </button>
                      </TableHead>
                      <TableHead className="w-[200px]">
                        <button
                          onClick={() => handleSort('cidade')}
                          className="flex items-center gap-2 font-medium hover:text-blue-600"
                        >
                          Cidade
                          {getSortIcon('cidade')}
                        </button>
                      </TableHead>
                      <TableHead className="w-[80px] text-center">
                        <button
                          onClick={() => handleSort('uf')}
                          className="flex items-center gap-2 font-medium hover:text-blue-600 mx-auto"
                        >
                          UF
                          {getSortIcon('uf')}
                        </button>
                      </TableHead>
                      <TableHead className="w-[160px] text-right">
                        <button
                          onClick={() => handleSort('data_ult_mvto')}
                          className="flex items-center gap-2 font-medium hover:text-blue-600 ml-auto"
                        >
                          Último Movimento
                          {getSortIcon('data_ult_mvto')}
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedClientes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                          Nenhum cliente vinculado a este vendedor
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedClientes.map((cliente, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">{cliente.cnpj}</TableCell>
                          <TableCell>{cliente.nome}</TableCell>
                          <TableCell>{cliente.cidade}</TableCell>
                          <TableCell className="text-center font-medium">{cliente.uf}</TableCell>
                          <TableCell className="text-right">
                            {formatDate(cliente.data_ult_mvto)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* PAGINAÇÃO */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Exibindo {startIndex + 1} a {Math.min(endIndex, sortedClientes.length)} de {sortedClientes.length} clientes
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Anterior
                    </Button>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Página {currentPage} de {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Próxima
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </AdminLayout>
  );
}