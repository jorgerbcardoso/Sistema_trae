import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Save, X, FolderPlus, Download, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Search, User, Building2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { 
  mockGetEventos, 
  mockCreateEvento, 
  mockUpdateEvento, 
  mockDeleteEvento 
} from '../../mocks/mockData';
import { handleAPIResponse } from '../../utils/apiUtils';
import { toUpperCase } from '../../utils/stringUtils';
import { AdminLayout } from '../layouts/AdminLayout';

interface Evento {
  evento: number;
  descricao: string;
  ordem: number;
  considerar: string;
  tipo: string; // N=Normal, I=Impostos, D=Depreciação, F=Despesas Financeiras
  seq_grupo?: number | null; // ✅ NOVO: Sequencial do grupo
  grupo_descricao?: string | null; // ✅ NOVO: Descrição do grupo
}

// ✅ PADRÃO: Limite de 100 registros por página
const ITEMS_PER_PAGE = 100;

export function CadastroEventos() {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof Evento;
    direction: 'asc' | 'desc';
  }>({ key: 'descricao', direction: 'asc' });
  const [searchTerm, setSearchTerm] = useState(''); // ✅ NOVO: Estado do filtro
  const [formData, setFormData] = useState({
    descricao: '',
    ordem: '',
    considerar: 'S',
    tipo: 'N'
  });

  usePageTitle('Cadastro de Eventos');

  useEffect(() => {
    loadEventos();
  }, [user?.domain]);

  const loadEventos = async () => {
    try {
      setIsLoading(true);
      
      // ✅ REGRA: No Figma Make, SEMPRE usar mock
      // Em produção, verificar flag use_mock_data do domínio
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        // Usar dados mockados
        const result = await mockGetEventos(user?.domain || '');
        if (result.success) {
          setEventos(result.eventos || []);
        } else {
          toast.error('Erro ao carregar eventos mockados');
          setEventos([]);
        }
      } else {
        // Usar API real
        const token = localStorage.getItem('auth_token');
        const response = await fetch(
          `/sistema/api/eventos/list.php?domain=${user?.domain}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'X-Domain': user?.domain || ''
            }
          }
        );

        // ✅ CORREÇÃO: Usar handleAPIResponse para interpretar toasts do PHP
        const data = await handleAPIResponse(response);

        if (data.success) {
          setEventos(data.eventos || []);
        } else {
          // ✅ CORREÇÃO: Não mostrar toast aqui se já foi exibido pelo handleAPIResponse
          // Só mostrar se não houver data.toast (erro genérico)
          if (!data.toast && data.error) {
            toast.error(data.error);
          }
          setEventos([]);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar eventos:', error);
      toast.error('Erro ao carregar eventos');
      setEventos([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNew = () => {
    setFormData({
      descricao: '',
      ordem: String((eventos || []).length + 1),
      considerar: 'S',
      tipo: 'N'
    });
    setSelectedEvento(null);
    setIsEditing(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (evento: Evento) => {
    setFormData({
      descricao: evento.descricao,
      ordem: String(evento.ordem),
      considerar: evento.considerar,
      tipo: evento.tipo || 'N' // Fallback para 'N' se tipo não existir
    });
    setSelectedEvento(evento);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.descricao.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    if (!formData.ordem || parseInt(formData.ordem) <= 0) {
      toast.error('Ordem deve ser um número maior que zero');
      return;
    }

    try {
      setIsSaving(true);

      // ✅ PADRÃO: Todas as strings salvas em MAIÚSCULAS
      const descricaoUpper = toUpperCase(formData.descricao);

      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        // Usar mock
        const requestData = {
          descricao: descricaoUpper,
          ordem: parseInt(formData.ordem),
          considerar: formData.considerar,
          tipo: formData.tipo
        };
        
        let result;
        if (isEditing && selectedEvento) {
          result = await mockUpdateEvento(user?.domain || '', selectedEvento.evento, requestData);
        } else {
          result = await mockCreateEvento(user?.domain || '', requestData);
        }
        
        if (result.success) {
          setIsDialogOpen(false);
          setFormData({
            descricao: '',
            ordem: '',
            considerar: 'S',
            tipo: 'N'
          });
          setSelectedEvento(null);
          setIsEditing(false);
          await loadEventos();
        } else {
          toast.error(result.error || 'Erro ao salvar evento');
        }
      } else {
        // ✅ UPDATE usa método HTTP PUT (não POST!)
        const endpoint = isEditing ? 'update.php' : 'create.php';
        const method = isEditing ? 'PUT' : 'POST';
        
        const body = {
          domain: user?.domain,
          descricao: descricaoUpper,
          ordem: parseInt(formData.ordem),
          considerar: formData.considerar,
          tipo: formData.tipo
        };
        
        // Se for edição, adicionar o ID
        if (isEditing && selectedEvento) {
          body.evento = selectedEvento.evento;
        }

        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/eventos/${endpoint}`, {
          method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Domain': user?.domain || ''
          },
          body: JSON.stringify(body)
        });

        const rawText = await response.text();
        
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (e) {
          toast.error('Erro ao processar resposta do servidor');
          return;
        }

        // ✅ Exibir toast se houver
        if (data.toast) {
          const { message, type } = data.toast;
          switch (type) {
            case 'success':
              toast.success(message);
              break;
            case 'error':
              toast.error(message);
              break;
            case 'warning':
              toast.warning(message);
              break;
            case 'info':
              toast.info(message);
              break;
          }
        }

        // ✅ COPIAR LÓGICA DE GRUPOS: PHP retorna success=false mesmo quando dá certo!
        const isSuccess = data.success || (data.toast && data.toast.type === 'success');

        if (isSuccess) {
          setIsDialogOpen(false);
          setFormData({
            descricao: '',
            ordem: '',
            considerar: 'S',
            tipo: 'N'
          });
          setSelectedEvento(null);
          setIsEditing(false);
          await loadEventos();
        } else {
          console.error('❌ [EVENTO SAVE] Erro:', data.error);
          if (!data.toast) {
            toast.error(data.error || 'Erro ao salvar evento');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ [EVENTO SAVE] Erro:', error);
      toast.error(error.message || 'Erro ao salvar evento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (evento: Evento) => {
    if (!confirm(`Deseja realmente excluir o evento \"${evento.descricao}\"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      console.log('🔵 [EVENTO DELETE] useMock:', useMock);
      
      if (useMock) {
        const result = await mockDeleteEvento(user?.domain || '', evento.evento);
        if (result.success) {
          await loadEventos();
        } else {
          toast.error(result.error || 'Erro ao excluir evento');
        }
      } else {
        // ✅ DELETE usa método HTTP DELETE (não POST!)
        const token = localStorage.getItem('auth_token');
        
        console.log('🔵 [EVENTO DELETE] Excluindo evento:', evento.evento);
        
        const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/eventos/delete.php`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Domain': user?.domain || ''
          },
          body: JSON.stringify({
            domain: user?.domain,
            evento: evento.evento
          })
        });

        console.log('🔵 [EVENTO DELETE] Response status:', response.status);
        
        const rawText = await response.text();
        console.log('🔵 [EVENTO DELETE] Response RAW:', rawText);
        
        let data;
        try {
          data = JSON.parse(rawText);
          console.log('🔵 [EVENTO DELETE] Response JSON:', data);
        } catch (e) {
          console.error('❌ [EVENTO DELETE] Erro ao parsear JSON:', e);
          toast.error('Erro ao processar resposta do servidor');
          return;
        }

        // ✅ Exibir toast se houver
        if (data.toast) {
          const { message, type } = data.toast;
          switch (type) {
            case 'success':
              toast.success(message);
              break;
            case 'error':
              toast.error(message);
              break;
            case 'warning':
              toast.warning(message);
              break;
            case 'info':
              toast.info(message);
              break;
          }
        }

        // ✅ COPIAR LÓGICA DE GRUPOS: PHP retorna success=false mesmo quando dá certo!
        const isSuccess = data.success || (data.toast && data.toast.type === 'success');
        console.log('🔵 [EVENTO DELETE] isSuccess:', isSuccess);

        if (isSuccess) {
          await loadEventos();
        } else {
          console.error('❌ [EVENTO DELETE] Erro:', data.error);
          if (!data.toast) {
            toast.error(data.error || 'Erro ao excluir evento');
          }
        }
      }
    } catch (error: any) {
      console.error('❌ [EVENTO DELETE] Erro:', error);
      toast.error(error.message || 'Erro ao excluir evento');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportEventos = async () => {
    try {
      setIsImporting(true);
      
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        // Mock: Simular importação
        toast.info('Importação de eventos não disponível no modo mock');
      } else {
        // Usar API real
        const token = localStorage.getItem('auth_token');
        const response = await fetch('/sistema/api/eventos/import_eventos.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Domain': user?.domain || ''
          },
          body: JSON.stringify({
            domain: user?.domain
          })
        });

        const data = await handleAPIResponse(response);

        // ✅ CORREÇÃO: Se needsInput = true, não recarregar (esperando confirmação)
        if (data.needsInput) {
          console.log('⏳ Aguardando confirmação do usuário...');
          return; // Não fazer nada, aguardar próxima requisição
        }
        
        // ✅ CORREÇÃO: PHP retorna success=false mas toast de sucesso
        const isSuccess = data.success || (data.toast && data.toast.type === 'success');
        
        // Se success = true OU toast de sucesso, recarregar eventos
        if (isSuccess) {
          loadEventos();
        }
      }
    } catch (error: any) {
      console.error('Erro ao importar eventos:', error);
      // ✅ CORREÇÃO: Não mostrar erro se for "needsInput"
      if (!error.message?.includes('needsInput')) {
        toast.error(error.message || 'Erro ao importar eventos');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLogout = () => {
    if (confirm('Deseja realmente sair do sistema?')) {
      logout();
      navigate('/login');
    }
  };

  const handleSort = (key: keyof Evento) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof Evento) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="size-4 ml-2 inline opacity-50" />;
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="size-4 ml-2 inline text-blue-600 dark:text-blue-400" />;
    }
    return <ArrowDown className="size-4 ml-2 inline text-blue-600 dark:text-blue-400" />;
  };

  // ✅ NOVO: Filtrar eventos por descrição
  const filteredEventos = useMemo(() => {
    if (!searchTerm.trim()) {
      return eventos;
    }
    const searchUpper = searchTerm.toUpperCase();
    return eventos.filter(evento => 
      evento.descricao.toUpperCase().includes(searchUpper)
    );
  }, [eventos, searchTerm]);

  // Ordenar eventos filtrados
  const sortedEventos = useMemo(() => {
    let sortableEventos = [...filteredEventos];
    if (sortConfig.key) {
      sortableEventos.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableEventos;
  }, [filteredEventos, sortConfig]);

  // ✅ PADRÃO: Paginação com limite de 100 registros
  const totalPages = Math.ceil(sortedEventos.length / ITEMS_PER_PAGE);
  const paginatedEventos = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return sortedEventos.slice(startIndex, endIndex);
  }, [sortedEventos, currentPage]);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // Features do cliente
  const features = user?.clientConfig?.features || {
    dark_mode: true,
    print: true,
    export_pdf: false,
    export_excel: false
  };

  return (
    <AdminLayout
      title="Cadastro de Eventos"
      description="Gerenciar tipos de despesas e eventos do sistema"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FolderPlus className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Cadastro de Eventos</CardTitle>
                  <CardDescription>
                    Gerenciar tipos de despesas e eventos do domínio {toUpperCase(user?.domain || '')}
                  </CardDescription>
                </div>
              </div>
              {/* ✅ PADRÃO: Botões de ação no card, não no header */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleImportEventos} 
                  variant="outline" 
                  className="gap-2"
                  disabled={isImporting || isLoading}
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 dark:border-gray-100"></div>
                      Importando...
                    </>
                  ) : (
                    <>
                      <Download className="size-4" />
                      Importar Eventos
                    </>
                  )}
                </Button>
                <Button onClick={handleNew} className="gap-2" disabled={isLoading}>
                  <Plus className="size-4" />
                  Novo Evento
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
              </div>
            ) : eventos.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FolderPlus className="size-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum evento cadastrado</p>
                <p className="text-sm mt-1">Clique em "Novo Evento" para começar</p>
              </div>
            ) : (
              <>
                {/* ✅ NOVO: Campo de busca */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 size-4" />
                    <Input
                      type="text"
                      placeholder="Filtrar por descrição..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setCurrentPage(1); // Resetar para primeira página ao filtrar
                      }}
                      className="pl-10"
                    />
                  </div>
                  {searchTerm && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      Encontrados {filteredEventos.length} evento(s) de {eventos.length} total
                    </p>
                  )}
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="w-[100px] cursor-pointer"
                        onClick={() => handleSort('evento')}
                      >
                        Código
                        {getSortIcon('evento')}
                      </TableHead>
                      <TableHead
                        className="cursor-pointer"
                        onClick={() => handleSort('descricao')}
                      >
                        Descrição
                        {getSortIcon('descricao')}
                      </TableHead>
                      <TableHead 
                        className="w-[100px] cursor-pointer"
                        onClick={() => handleSort('ordem')}
                      >
                        Ordem
                        {getSortIcon('ordem')}
                      </TableHead>
                      <TableHead 
                        className="w-[150px] cursor-pointer"
                        onClick={() => handleSort('tipo')}
                      >
                        Tipo
                        {getSortIcon('tipo')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer"
                        onClick={() => handleSort('grupo_descricao')}
                      >
                        Grupo
                        {getSortIcon('grupo_descricao')}
                      </TableHead>
                      <TableHead 
                        className="w-[120px] cursor-pointer"
                        onClick={() => handleSort('considerar')}
                      >
                        Considerar
                        {getSortIcon('considerar')}
                      </TableHead>
                      <TableHead className="w-[120px] text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEventos.map((evento) => (
                      <TableRow key={evento.evento}>
                        <TableCell>{evento.evento}</TableCell>
                        <TableCell>{evento.descricao}</TableCell>
                        <TableCell>{evento.ordem}</TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                            evento.tipo === 'N' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                            evento.tipo === 'I' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                            evento.tipo === 'D' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                            evento.tipo === 'F' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                            'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {evento.tipo === 'N' ? 'Normal' :
                             evento.tipo === 'I' ? 'Impostos' :
                             evento.tipo === 'D' ? 'Depreciação' :
                             evento.tipo === 'F' ? 'Desp. Financeiras' : 'N/D'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                            evento.grupo_descricao ? 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
                          }`}>
                            {evento.grupo_descricao || 'N/D'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                            evento.considerar === 'S' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {evento.considerar === 'S' ? 'Sim' : 'Não'}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(evento)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(evento)}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* ✅ PADRÃO: Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1} a {Math.min(currentPage * ITEMS_PER_PAGE, sortedEventos.length)} de {sortedEventos.length} registros
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePreviousPage}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="size-4 mr-1" />
                        Anterior
                      </Button>
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        Página {currentPage} de {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages}
                      >
                        Próxima
                        <ChevronRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Criar/Editar */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Editar Evento' : 'Novo Evento'}
              </DialogTitle>
              <DialogDescription>
                {isEditing ? 'Atualize os dados do evento' : 'Preencha os dados para criar um novo evento'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="descricao">
                  Descrição <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="descricao"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Combustível, Pedágio, Manutenção..."
                  maxLength={100}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ordem">
                  Ordem <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ordem"
                  type="number"
                  min="1"
                  value={formData.ordem}
                  onChange={(e) => setFormData({ ...formData, ordem: e.target.value })}
                  placeholder="Ex: 1, 2, 3..."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="considerar">
                  Considerar
                </Label>
                <Select
                  value={formData.considerar}
                  onValueChange={(value) => setFormData({ ...formData, considerar: value })}
                >
                  <SelectTrigger id="considerar">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="S">Sim</SelectItem>
                    <SelectItem value="N">Não</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tipo">
                  Tipo
                </Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="N">Normal</SelectItem>
                    <SelectItem value="I">Impostos</SelectItem>
                    <SelectItem value="D">Depreciação</SelectItem>
                    <SelectItem value="F">Despesas Financeiras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSaving}
              >
                <X className="size-4 mr-2" />
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="size-4 mr-2" />
                    Salvar
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}