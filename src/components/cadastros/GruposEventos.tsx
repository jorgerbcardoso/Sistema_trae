import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Pencil, Trash2, Save, X, ArrowUpDown, ArrowUp, ArrowDown, ArrowLeft, Moon, Sun, LogOut, ChevronLeft, ChevronRight, FolderOpen, FolderPlus, Printer, Download, Search, User, Building2 } from 'lucide-react';
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
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Badge } from '../ui/badge';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router';
import { usePageTitle } from '../../hooks/usePageTitle';
import { ENVIRONMENT } from '../../config/environment';
import { 
  mockGetGruposEventos, 
  mockCreateGrupoEvento, 
  mockUpdateGrupoEvento, 
  mockDeleteGrupoEvento,
  mockGetTodosEventosComGrupo,
  mockAssociarEventoAGrupo,
  mockDesassociarEventoDeGrupo
} from '../../mocks/mockData';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { getLogoUrl } from '../../config/clientLogos';
import { useTheme } from '../ThemeProvider';
import { handleAPIResponse } from '../../utils/apiUtils';
import { toUpperCase } from '../../utils/stringUtils';

interface GrupoEvento {
  grupo: number;
  descricao: string;
}

interface EventoComGrupo {
  evento: number;
  descricao: string;
  ordem: number;
  considerar: string;
  tipo: string;
  grupo: number;
  grupo_descricao: string;
}

// ✅ PADRÃO: Limite de 100 registros por página
const ITEMS_PER_PAGE = 100;

export function GruposEventos() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState<GrupoEvento[]>([]);
  const [eventos, setEventos] = useState<EventoComGrupo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingEventos, setIsLoadingEventos] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEventosDialogOpen, setIsEventosDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<GrupoEvento | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentPageEventos, setCurrentPageEventos] = useState(1);
  const [searchEvento, setSearchEvento] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: keyof GrupoEvento;
    direction: 'asc' | 'desc';
  }>({ key: 'grupo', direction: 'asc' });
  const [sortConfigEventos, setSortConfigEventos] = useState<{
    key: keyof EventoComGrupo;
    direction: 'asc' | 'desc';
  }>({ key: 'ordem', direction: 'asc' });
  const [formData, setFormData] = useState({
    descricao: ''
  });
  const [selectedEventos, setSelectedEventos] = useState<number[]>([]);

  usePageTitle('Grupos de Eventos');

  useEffect(() => {
    loadGrupos();
    loadEventos();
  }, [user?.domain]);

  const loadGrupos = async () => {
    try {
      setIsLoading(true);
      
      // ✅ REGRA: No Figma Make, SEMPRE usar mock
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        const result = await mockGetGruposEventos(user?.domain || '');
        if (result.success) {
          setGrupos(result.grupos || []);
        } else {
          toast.error(result.error || 'Erro ao carregar grupos');
          setGrupos([]); // ✅ PROTEÇÃO: Garantir array vazio
        }
      } else {
        // Produção - API real
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/grupos_eventos/list.php`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Domain': user?.domain || ''
          }
        });

        const data = await handleAPIResponse(response);
        
        if (data.success) {
          setGrupos(data.grupos || []);
        } else {
          setGrupos([]); // ✅ PROTEÇÃO: Garantir array vazio
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar grupos:', error);
      toast.error(error.message || 'Erro ao carregar grupos');
      setGrupos([]); // ✅ PROTEÇÃO: Garantir array vazio
    } finally {
      setIsLoading(false);
    }
  };

  const loadEventos = async () => {
    try {
      setIsLoadingEventos(true);
      
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        const result = await mockGetTodosEventosComGrupo(user?.domain || '');
        if (result.success) {
          setEventos(result.eventos || []);
        }
      } else {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/grupos_eventos/todos_eventos.php`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Domain': user?.domain || ''
          }
        });

        const data = await handleAPIResponse(response);
        
        if (data.success) {
          setEventos(data.eventos || []);
        }
      }
    } catch (error: any) {
      console.error('Erro ao carregar eventos:', error);
    } finally {
      setIsLoadingEventos(false);
    }
  };

  const handleCreate = () => {
    setFormData({ descricao: '' });
    setIsEditing(false);
    setSelectedGrupo(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (grupo: GrupoEvento) => {
    setFormData({ descricao: grupo.descricao });
    setIsEditing(true);
    setSelectedGrupo(grupo);
    setIsDialogOpen(true);
  };

  const handleDelete = async (grupo: GrupoEvento) => {
    if (grupo.grupo === 0) {
      toast.error('Não é possível excluir o grupo padrão (0)');
      return;
    }

    if (!confirm(`Deseja realmente excluir o grupo "${grupo.descricao}"?\n\nTodos os eventos associados voltarão para o grupo padrão (Sem Grupo).`)) {
      return;
    }

    try {
      setIsLoading(true);
      
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        const result = await mockDeleteGrupoEvento(user?.domain || '', grupo.grupo);
        if (result.success) {
          await loadGrupos();
          await loadEventos();
        } else {
          toast.error(result.error || 'Erro ao excluir grupo');
        }
      } else {
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/grupos_eventos/delete.php`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Domain': user?.domain || ''
          },
          body: JSON.stringify({ grupo: grupo.grupo })
        });

        // ✅ Ver JSON bruto
        const rawText = await response.text();
        console.log('🔵 [DELETE] Response RAW:', rawText);
        
        let data;
        try {
          data = JSON.parse(rawText);
          console.log('🔵 [DELETE] Response JSON:', data);
        } catch (e) {
          console.error('❌ [DELETE] Erro ao parsear JSON:', e);
          toast.error('Erro ao processar resposta do servidor');
          return;
        }
        
        // ✅ Exibir toast se houver
        if (data.toast) {
          const { message, type } = data.toast;
          switch (type) {
            case 'success': toast.success(message); break;
            case 'error': toast.error(message); break;
            case 'warning': toast.warning(message); break;
            case 'info': 
            default: toast.info(message); break;
          }
        }
        
        // ✅ CORREÇÃO: PHP retorna success=false mesmo quando dá certo!
        const isSuccess = data.success || (data.toast && data.toast.type === 'success');
        
        console.log('🔵 [DELETE] isSuccess:', isSuccess);
        
        if (isSuccess) {
          console.log('✅ [DELETE] Recarregando listas...');
          await loadGrupos();
          await loadEventos();
          console.log('✅ [DELETE] Listas recarregadas!');
        } else {
          console.error('❌ [DELETE] Erro:', data.error);
        }
      }
    } catch (error: any) {
      console.error('Erro ao excluir grupo:', error);
      toast.error(error.message || 'Erro ao excluir grupo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportGrupos = async () => {
    try {
      setIsImporting(true);
      
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      if (useMock) {
        // Mock: Simular importação
        toast.info('Importação de grupos não disponível no modo mock');
      } else {
        // Usar API real
        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/grupos_eventos/import_grupos.php`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Domain': user?.domain || ''
          },
          body: JSON.stringify({ domain: user?.domain })
        });

        const data = await handleAPIResponse(response);
        
        // ✅ CORREÇÃO: Se needsInput = true, não recarregar (esperando confirmação)
        if (data.needsInput) {
          console.log('⏳ Aguardando confirmação do usuário...');
          return; // Não fazer nada, aguardar próxima requisição
        }
        
        // ✅ CORREÇÃO: PHP retorna success=false mas toast de sucesso
        const isSuccess = data.success || (data.toast && data.toast.type === 'success');
        
        // Se success = true OU toast de sucesso, recarregar grupos
        if (isSuccess) {
          await loadGrupos();
        }
      }
    } catch (error: any) {
      console.error('Erro ao importar grupos:', error);
      // ✅ CORREÇÃO: Não mostrar erro se for "needsInput"
      if (!error.message?.includes('needsInput')) {
        toast.error(error.message || 'Erro ao importar grupos');
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleSave = async () => {
    if (!formData.descricao.trim()) {
      toast.error('Preencha a descrição do grupo');
      return;
    }

    try {
      setIsSaving(true);
      
      console.log('🔍 [DEBUG] ENVIRONMENT:', {
        isFigmaMake: ENVIRONMENT.isFigmaMake,
        useMockData: ENVIRONMENT.useMockData,
        hostname: window.location.hostname,
        href: window.location.href
      });
      
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      // ✅ PADRÃO: Todas as strings salvas em MAIÚSCULAS
      const descricaoUpper = toUpperCase(formData.descricao.trim());
      
      console.log('🔵 handleSave - Iniciando...', {
        useMock,
        isEditing,
        selectedGrupo,
        descricaoUpper
      });
      
      if (useMock) {
        let result;
        if (isEditing && selectedGrupo) {
          console.log('🔵 Chamando mockUpdateGrupoEvento...', {
            domain: user?.domain,
            grupo: selectedGrupo.grupo,
            descricao: descricaoUpper
          });
          result = await mockUpdateGrupoEvento(
            user?.domain || '', 
            selectedGrupo.grupo, 
            descricaoUpper
          );
        } else {
          console.log('🔵 Chamando mockCreateGrupoEvento...', {
            domain: user?.domain,
            descricao: descricaoUpper
          });
          result = await mockCreateGrupoEvento(user?.domain || '', descricaoUpper);
        }
        
        console.log('🔵 Resultado do mock:', result);
        
        if (result.success) {
          console.log('✅ Sucesso! Fechando dialog e recarregando...');
          toast.success(isEditing ? 'Grupo atualizado com sucesso!' : 'Grupo criado com sucesso!');
          setIsDialogOpen(false);
          setFormData({ descricao: '' }); // Limpar formulário
          setSelectedGrupo(null);
          setIsEditing(false);
          console.log('🔵 Chamando loadGrupos...');
          await loadGrupos(); // ✅ Recarregar após fechar dialog
          console.log('✅ loadGrupos concluído!');
        } else {
          console.error('❌ Erro no resultado:', result.error);
          toast.error(result.error || 'Erro ao salvar grupo');
        }
      } else {
        const endpoint = isEditing ? 'update.php' : 'create.php';
        const body = isEditing 
          ? { grupo: selectedGrupo?.grupo, descricao: descricaoUpper }
          : { descricao: descricaoUpper };

        console.log('🔵 Chamando API real:', {
          endpoint,
          url: `${ENVIRONMENT.apiBaseUrl}/grupos_eventos/${endpoint}`,
          body
        });

        const token = localStorage.getItem('auth_token');
        const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/grupos_eventos/${endpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Domain': user?.domain || ''
          },
          body: JSON.stringify(body)
        });

        console.log('🔵 Response status:', response.status);
        console.log('🔵 Response headers:', response.headers);

        // ✅ Ver JSON bruto ANTES do handleAPIResponse
        const rawText = await response.text();
        console.log('🔵 Response RAW (texto bruto):', rawText);
        
        // Parsear manualmente para ver estrutura
        let data;
        try {
          data = JSON.parse(rawText);
          console.log('🔵 Response JSON parseado:', data);
        } catch (e) {
          console.error('❌ Erro ao parsear JSON:', e);
          toast.error('Erro ao processar resposta do servidor');
          return;
        }
        
        // ✅ Exibir toast se houver
        if (data.toast) {
          const { message, type } = data.toast;
          switch (type) {
            case 'success': toast.success(message); break;
            case 'error': toast.error(message); break;
            case 'warning': toast.warning(message); break;
            case 'info': 
            default: toast.info(message); break;
          }
        }
        
        console.log('🔵 Data.success:', data.success);
        
        // ✅ CORREÇÃO: PHP retorna success=false mesmo quando dá certo!
        // Verificar TAMBÉM se o toast é de sucesso
        const isSuccess = data.success || (data.toast && data.toast.type === 'success');
        
        console.log('🔵 isSuccess (corrigido):', isSuccess);
        
        if (isSuccess) {
          console.log('✅ API retornou sucesso!');
          setIsDialogOpen(false);
          setFormData({ descricao: '' }); // Limpar formulário
          setSelectedGrupo(null);
          setIsEditing(false);
          console.log('🔵 Chamando loadGrupos...');
          await loadGrupos(); // ✅ Recarregar após fechar dialog
          console.log('✅ loadGrupos concluído!');
        } else {
          console.error('❌ API retornou erro:', data.error);
        }
      }
    } catch (error: any) {
      console.error('❌ Erro ao salvar grupo:', error);
      toast.error(error.message || 'Erro ao salvar grupo');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGerenciarEventos = (grupo: GrupoEvento) => {
    setSelectedGrupo(grupo);
    const eventosDoGrupo = eventos.filter(e => e.grupo === grupo.grupo);
    const eventosIds = eventosDoGrupo.map(e => e.evento);
    console.log('🔍 [GERENCIAR EVENTOS]', {
      grupo,
      eventosDoGrupo,
      eventosIds,
      todosEventos: eventos
    });
    setSelectedEventos(eventosIds);
    setSearchEvento('');
    setIsEventosDialogOpen(true);
  };

  const handleToggleEvento = (eventoId: number) => {
    // Buscar o evento
    const evento = eventos.find(e => e.evento === eventoId);
    
    if (!evento) return;

    // Se está tentando selecionar (adicionar)
    if (!selectedEventos.includes(eventoId)) {
      // Verificar se o evento já pertence a outro grupo
      if (evento.grupo !== 0 && evento.grupo !== selectedGrupo?.grupo) {
        toast.warning(
          `O evento "${evento.descricao}" já pertence ao grupo "${evento.grupo_descricao}". ` +
          `Para associá-lo a este grupo, primeiro remova-o do grupo atual.`,
          { duration: 5000 }
        );
        return;
      }
    }

    setSelectedEventos(prev => {
      if (prev.includes(eventoId)) {
        return prev.filter(id => id !== eventoId);
      } else {
        return [...prev, eventoId];
      }
    });
  };

  const handleSaveEventosAssociation = async () => {
    if (!selectedGrupo) return;

    try {
      setIsSaving(true);
      
      const useMock = ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData;
      
      // Eventos que estavam no grupo antes
      const eventosAntigos = eventos
        .filter(e => e.grupo === selectedGrupo.grupo)
        .map(e => e.evento);
      
      // Eventos para adicionar
      const eventosParaAdicionar = selectedEventos.filter(
        id => !eventosAntigos.includes(id)
      );
      
      // Eventos para remover
      const eventosParaRemover = eventosAntigos.filter(
        id => !selectedEventos.includes(id)
      );

      if (useMock) {
        // Associar novos eventos
        for (const eventoId of eventosParaAdicionar) {
          await mockAssociarEventoAGrupo(
            user?.domain || '', 
            selectedGrupo.grupo, 
            eventoId
          );
        }
        
        // Desassociar eventos removidos
        for (const eventoId of eventosParaRemover) {
          await mockDesassociarEventoDeGrupo(user?.domain || '', eventoId);
        }
        
        toast.success('Eventos associados com sucesso!');
      } else {
        const token = localStorage.getItem('auth_token');
        
        // Associar novos eventos
        for (const eventoId of eventosParaAdicionar) {
          await fetch(`${ENVIRONMENT.apiBaseUrl}/grupos_eventos/associar_evento.php`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Domain': user?.domain || ''
            },
            body: JSON.stringify({ 
              grupo: selectedGrupo.grupo, 
              evento: eventoId 
            })
          });
        }
        
        // Desassociar eventos removidos
        for (const eventoId of eventosParaRemover) {
          await fetch(`${ENVIRONMENT.apiBaseUrl}/grupos_eventos/desassociar_evento.php`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
              'X-Domain': user?.domain || ''
            },
            body: JSON.stringify({ evento: eventoId })
          });
        }
      }

      setIsEventosDialogOpen(false);
      await loadEventos();
      
    } catch (error: any) {
      console.error('Erro ao salvar associações:', error);
      toast.error(error.message || 'Erro ao salvar associações');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ PADRÃO: Tabela 100% ordenável por coluna
  const handleSort = (key: keyof GrupoEvento) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setCurrentPage(1);
  };

  const handleSortEventos = (key: keyof EventoComGrupo) => {
    setSortConfigEventos(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedGrupos = useMemo(() => {
    const sorted = [...grupos].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });

    return sorted;
  }, [grupos, sortConfig]);

  const sortedEventos = useMemo(() => {
    // Primeiro filtrar pela busca
    let filteredEventos = eventos;
    if (searchEvento.trim()) {
      const search = searchEvento.toLowerCase();
      filteredEventos = eventos.filter(e => 
        e.descricao.toLowerCase().includes(search) ||
        String(e.evento).includes(search)
      );
    }

    // ✅ 4. ORDENAR: Primeiro eventos vinculados ao grupo atual, depois os demais
    const sorted = [...filteredEventos].sort((a, b) => {
      // Se estamos gerenciando um grupo específico
      if (selectedGrupo) {
        const aVinculado = a.grupo === selectedGrupo.grupo;
        const bVinculado = b.grupo === selectedGrupo.grupo;
        
        // Eventos vinculados ao grupo atual vêm primeiro
        if (aVinculado && !bVinculado) return -1;
        if (!aVinculado && bVinculado) return 1;
      }
      
      // Depois aplicar ordenação normal
      const aValue = a[sortConfigEventos.key];
      const bValue = b[sortConfigEventos.key];

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfigEventos.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();
      
      if (sortConfigEventos.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
    
    return sorted;
  }, [eventos, sortConfigEventos, searchEvento, selectedGrupo]);

  // ✅ PADRÃO: Paginação com limite de 100 registros por página
  const totalPages = Math.ceil(sortedGrupos.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentGrupos = sortedGrupos.slice(startIndex, endIndex);

  const SortIcon = ({ column }: { column: keyof GrupoEvento }) => {
    if (sortConfig.key !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const SortIconEventos = ({ column }: { column: keyof EventoComGrupo }) => {
    if (sortConfigEventos.key !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortConfigEventos.direction === 'asc' 
      ? <ArrowUp className="ml-2 h-4 w-4" />
      : <ArrowDown className="ml-2 h-4 w-4" />;
  };

  const handleBack = () => {
    navigate('/');
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handlePrint = () => {
    window.print();
  };

  // Features do cliente
  const features = user?.clientConfig?.features || {
    dark_mode: true,
    print: true,
    export_pdf: false,
    export_excel: false
  };

  // ✅ 1. FUNÇÃO: Contar eventos vinculados ao grupo
  const getEventosCountByGrupo = (grupoId: number) => {
    return eventos.filter(e => e.grupo === grupoId).length;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* ✅ PADRÃO: Header estilo Dashboard Financeiro */}
      <header className="sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 print:relative print:border-0">
        <div className="container mx-auto px-3 md:px-6 h-12 md:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="print:hidden"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              <span className="hidden md:inline menu-button-text">Menu</span>
            </Button>
            <ImageWithFallback 
              key={theme}
              src={getLogoUrl(user?.domain, theme)}
              alt="Logo" 
              className="h-6 md:h-8 w-6 md:w-8 object-contain" 
            />
            <div className="flex-1 min-w-0 hidden md:block">
              <h1 className="text-slate-900 dark:text-slate-100 header-title-reduced truncate">Grupos de Eventos</h1>
              <p className="text-slate-500 dark:text-slate-400 header-subtitle-reduced hidden md:block truncate">{user?.client_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {/* ✅ NOVO: Exibir Usuário e Unidade */}
            <div className="hidden lg:flex items-center gap-2 mr-2">
              <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                <User className="w-3 h-3 mr-1" />
                @{user?.username}
              </Badge>
              {user?.unidade_atual && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  <Building2 className="w-3 h-3 mr-1" />
                  {user.unidade_atual}
                </Badge>
              )}
            </div>
            
            {/* ✅ PADRÃO: Botão Imprimir */}
            {features.print && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handlePrint}
                      className="hidden md:flex dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
                    >
                      <Printer className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Imprimir</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            {/* ✅ PADRÃO: Botão Tema - DESATIVADO POR ENQUANTO */}
            {false && features.dark_mode && (
              <Button
                variant="outline"
                size="icon"
                onClick={toggleTheme}
                className="hidden md:flex dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
              >
                {theme === 'light' ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
              </Button>
            )}
            {/* ✅ PADRÃO: Botão Sair */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleLogout}
                    className="hidden md:flex dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Sair</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="container mx-auto p-3 md:p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FolderPlus className="size-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle>Grupos de Eventos</CardTitle>
                  <CardDescription>
                    Gerencie os grupos de eventos e suas associações
                  </CardDescription>
                </div>
              </div>
              {/* ✅ PADRÃO: Botões de ação no card, não no header */}
              <div className="flex gap-2">
                <Button 
                  onClick={handleImportGrupos} 
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
                      <Download className="h-4 w-4" />
                      Importar Grupos
                    </>
                  )}
                </Button>
                <Button onClick={handleCreate} className="gap-2" disabled={isLoading}>
                  <Plus className="h-4 w-4" />
                  Novo Grupo
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3">Carregando grupos...</span>
              </div>
            ) : (
              <>
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('grupo')}
                        >
                          <div className="flex items-center">
                            Código
                            <SortIcon column="grupo" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort('descricao')}
                        >
                          <div className="flex items-center">
                            Descrição
                            <SortIcon column="descricao" />
                          </div>
                        </TableHead>
                        <TableHead className="text-center w-32">Qtd. Eventos</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentGrupos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            Nenhum grupo cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        currentGrupos.map((grupo) => (
                          <TableRow key={grupo.grupo}>
                            <TableCell className="font-medium">{grupo.grupo}</TableCell>
                            <TableCell>{grupo.descricao}</TableCell>
                            <TableCell className="text-center">
                              <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                {getEventosCountByGrupo(grupo.grupo)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleGerenciarEventos(grupo)}
                                      >
                                        <FolderOpen className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Gerenciar Eventos</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleEdit(grupo)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Editar</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>

                                {grupo.grupo !== 0 && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleDelete(grupo)}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Excluir</TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* ✅ PADRÃO: Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-2 py-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {startIndex + 1} a {Math.min(endIndex, sortedGrupos.length)} de {sortedGrupos.length} registros
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <div className="text-sm">
                        Página {currentPage} de {totalPages}
                      </div>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog: Criar/Editar Grupo */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar Grupo' : 'Novo Grupo'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Atualize as informações do grupo' 
                : 'Preencha as informações do novo grupo'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Ex: Despesas Operacionais"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Gerenciar Eventos do Grupo */}
      <Dialog open={isEventosDialogOpen} onOpenChange={setIsEventosDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Gerenciar Eventos - {selectedGrupo?.descricao}
            </DialogTitle>
            <DialogDescription>
              Selecione os eventos que farão parte deste grupo
            </DialogDescription>
          </DialogHeader>
          
          {/* Campo de Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar evento por código ou descrição..."
              value={searchEvento}
              onChange={(e) => setSearchEvento(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="overflow-y-auto overscroll-contain max-h-[50vh]">{/* ✅ ADICIONADO overscroll-contain para permitir scroll */}
            {isLoadingEventos ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSortEventos('evento')}
                      >
                        <div className="flex items-center">
                          Cód.
                          <SortIconEventos column="evento" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSortEventos('descricao')}
                      >
                        <div className="flex items-center">
                          Descrição
                          <SortIconEventos column="descricao" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSortEventos('grupo_descricao')}
                      >
                        <div className="flex items-center">
                          Grupo Atual
                          <SortIconEventos column="grupo_descricao" />
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedEventos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          {searchEvento ? 'Nenhum evento encontrado com este critério de busca' : 'Nenhum evento disponível'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      sortedEventos.map((evento) => (
                        <TableRow key={evento.evento}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedEventos.includes(evento.evento)}
                              onChange={() => handleToggleEvento(evento.evento)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell>{evento.evento}</TableCell>
                          <TableCell>{evento.descricao}</TableCell>
                          <TableCell>
                            <span className={evento.grupo === 0 ? 'text-muted-foreground' : ''}>
                              {evento.grupo_descricao}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEventosDialogOpen(false)}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
            <Button onClick={handleSaveEventosAssociation} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Associações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}