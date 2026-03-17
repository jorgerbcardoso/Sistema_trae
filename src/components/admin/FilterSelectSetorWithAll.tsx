import React, { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { Label } from '../ui/label';

interface Setor {
  nro_setor: number;
  descricao: string;
  efetua_compras: boolean;
}

// ✅ MOCK de setores para Figma Make
const MOCK_SETORES: Setor[] = [
  { nro_setor: 1, descricao: 'PRODUÇÃO', efetua_compras: true },
  { nro_setor: 2, descricao: 'MANUTENÇÃO', efetua_compras: true },
  { nro_setor: 3, descricao: 'ADMINISTRATIVO', efetua_compras: false },
  { nro_setor: 4, descricao: 'FINANCEIRO', efetua_compras: false },
  { nro_setor: 5, descricao: 'LOGÍSTICA', efetua_compras: true },
  { nro_setor: 6, descricao: 'COMERCIAL', efetua_compras: false },
];

interface FilterSelectSetorWithAllProps {
  value: string; // ✅ ALTERADO: Aceita string ('' para vazio, 'TODOS' ou número como string)
  onChange: (value: string) => void; // ✅ ALTERADO: Retorna string
  suggestUserSetor?: boolean; // Se true, sugere o setor do usuário logado
  className?: string;
  unidadeFiltro?: string; // ✅ NOVO: Filtrar setores por unidade (futuro)
  label?: string; // ✅ NOVO: Label opcional
  apenasEfetuaCompras?: boolean; // ✅ NOVO: Filtrar apenas setores que efetuam compras
}

/**
 * Componente de seleção de setores COM opção "TODOS OS SETORES"
 * Usado em filtros de telas (Aprovação, Geração de Pedidos, Orçamentos)
 */
export function FilterSelectSetorWithAll({ 
  value, 
  onChange, 
  suggestUserSetor = false,
  className = '',
  unidadeFiltro,
  label = 'Setor', // ✅ NOVO: Label padrão
  apenasEfetuaCompras = false
}: FilterSelectSetorWithAllProps) {
  const { token, user } = useAuth();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasSuggested = useRef(false); // ✅ Rastrear se já sugeriu

  useEffect(() => {
    loadSetores();
  }, []);

  // ✅ Sugerir setor do usuário logado ao carregar (APENAS UMA VEZ)
  useEffect(() => {
    console.log('🔍 [FilterSelectSetorWithAll] useEffect executado:', {
      suggestUserSetor,
      userNroSetor: user?.nro_setor,
      setoresLength: setores.length,
      hasSuggested: hasSuggested.current,
      value,
      apenasEfetuaCompras
    });
    
    if (suggestUserSetor && setores.length > 0 && !hasSuggested.current) {
      // Só sugere se o valor atual for vazio
      const valueIsEmpty = value === '' || value === 'all' || value === 'TODOS';
      
      console.log('🔍 [FilterSelectSetorWithAll] valueIsEmpty:', valueIsEmpty);
      
      if (valueIsEmpty) {
        // ✅ Filtrar setores conforme apenasEfetuaCompras
        const setoresFiltrados = apenasEfetuaCompras 
          ? setores.filter(s => s.efetua_compras) 
          : setores;
        
        console.log('🔍 [FilterSelectSetorWithAll] Setores disponíveis após filtro:', setoresFiltrados.map(s => s.nro_setor));
        
        // ✅ LÓGICA DE SUGESTÃO:
        // - Se usuário NÃO é de setor que efetua compras: sugerir '' (TODOS)
        // - Se usuário É de setor que efetua compras: sugerir o setor do usuário
        const setorUsuario = user?.nro_setor;
        const setorUsuarioEfetuaCompras = setorUsuario && setoresFiltrados.some(s => s.nro_setor === setorUsuario);
        
        const setorToSuggest = setorUsuarioEfetuaCompras 
          ? setorUsuario.toString() 
          : ''; // Sugere TODOS se usuário não é de setor que efetua compras
        
        console.log('🎯 [FilterSelectSetorWithAll] ✅ SUGERINDO:', setorToSuggest === '' ? 'TODOS OS SETORES' : `Setor ${setorToSuggest} (do usuário)`);
        onChange(setorToSuggest);
        hasSuggested.current = true; // ✅ Marcar como sugerido
      }
    }
  }, [suggestUserSetor, user?.nro_setor, setores.length, value, onChange, apenasEfetuaCompras]);

  const loadSetores = async () => {
    try {
      setIsLoading(true);
      
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        setSetores(MOCK_SETORES);
      } else {
        // BACKEND
        const data = await apiFetch('/sistema/api/admin/setores.php', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (data.success) {
          setSetores(data.setores || []);
        }
      }
    } catch (err: any) {
      console.error('Erro ao carregar setores:', err);
      setSetores([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getDisplayValue = () => {
    if (isLoading) return 'Carregando...';
    if (value === '') return 'TODOS OS SETORES';
    const setor = setores.find(s => s.nro_setor === parseInt(value));
    return setor?.descricao || 'Selecione o setor';
  };

  return (
    <div className="grid gap-2">
      {label && <Label>{label}</Label>}
      <Select
        value={value?.toString() || 'all'}
        onValueChange={(val) => onChange(val === 'all' ? '' : val)}
        disabled={isLoading}
      >
        <SelectTrigger className={`w-full ${className}`}>
          <SelectValue placeholder={isLoading ? 'Carregando...' : 'TODOS OS SETORES'}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando...</span>
              </div>
            ) : (
              getDisplayValue()
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">TODOS OS SETORES</SelectItem>
          {setores
            .filter(setor => !apenasEfetuaCompras || setor.efetua_compras)
            .map((setor) => (
            <SelectItem key={setor.nro_setor} value={setor.nro_setor.toString()}>
              {setor.descricao}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}