import React, { useState, useEffect, useRef } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { Label } from '../ui/label';

interface Setor {
  nro_setor: number;
  descricao: string;
  efetua_compras: boolean;
}

interface FilterSelectSetorProps {
  value: number | null;
  onChange: (value: number | null) => void;
  allowClear?: boolean;
  label?: string; // ✅ NOVO: Label opcional
  placeholder?: string; // ✅ NOVO: Placeholder opcional
  suggestUserSetor?: boolean; // ✅ NOVO: Sugerir setor do usuário
  apenasEfetuaCompras?: boolean; // ✅ NOVO: Filtrar apenas setores que efetuam compras
}

export function FilterSelectSetor({ 
  value, 
  onChange, 
  allowClear = false,
  label,
  placeholder = 'Selecione o setor',
  suggestUserSetor = false,
  apenasEfetuaCompras = false
}: FilterSelectSetorProps) {
  const { token, user } = useAuth();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const hasSuggested = useRef(false); // ✅ Rastrear se já sugeriu

  useEffect(() => {
    loadSetores();
  }, []);

  // ✅ Sugerir setor do usuário logado ao carregar
  useEffect(() => {
    console.log('🔍 [FilterSelectSetor] useEffect executado:', {
      suggestUserSetor,
      userNroSetor: user?.nro_setor,
      setoresLength: setores.length,
      hasSuggested: hasSuggested.current,
      value,
      apenasEfetuaCompras
    });
    
    if (suggestUserSetor && setores.length > 0 && !hasSuggested.current && value === null) {
      // ✅ Filtrar setores conforme apenasEfetuaCompras
      const setoresFiltrados = apenasEfetuaCompras 
        ? setores.filter(s => s.efetua_compras) 
        : setores;
      
      console.log('🔍 [FilterSelectSetor] Setores disponíveis após filtro:', setoresFiltrados.map(s => s.nro_setor));
      
      // ✅ PRIORIDADE 1: Verificar se o setor do usuário está na lista filtrada
      const setorUsuario = user?.nro_setor;
      const setorUsuarioDisponivel = setorUsuario && setoresFiltrados.some(s => s.nro_setor === setorUsuario);
      
      // ✅ LÓGICA DE SUGESTÃO:
      // - Se apenasEfetuaCompras=true E setor do usuário NÃO efetua compras: NÃO sugerir
      // - Se apenasEfetuaCompras=true E setor do usuário efetua compras: sugerir o setor do usuário
      // - Se apenasEfetuaCompras=false: sugerir setor do usuário (se existir)
      const setorToSuggest = setorUsuarioDisponivel ? setorUsuario : null;
      
      if (setorToSuggest) {
        console.log('🎯 [FilterSelectSetor] ✅ SUGERINDO setor:', setorToSuggest, '(setor do usuário)');
        onChange(setorToSuggest);
        hasSuggested.current = true;
      } else if (!apenasEfetuaCompras && user?.nro_setor) {
        // Se não está filtrando por efetua_compras, sugere o setor do usuário mesmo que ele não esteja na lista
        console.log('🎯 [FilterSelectSetor] ✅ SUGERINDO setor do usuário (mesmo fora da lista):', user.nro_setor);
        onChange(user.nro_setor);
        hasSuggested.current = true;
      } else {
        console.log('🎯 [FilterSelectSetor] ❌ NÃO SUGERINDO: setor do usuário indisponível ou critério não atendido');
      }
    }
  }, [suggestUserSetor, user?.nro_setor, setores.length, value, onChange, apenasEfetuaCompras]);

  const loadSetores = async () => {
    try {
      setIsLoading(true);
      const data = await apiFetch('/sistema/api/admin/setores.php', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (data.success) {
        setSetores(data.setores || []);
      }
    } catch (err: any) {
      console.error('Erro ao carregar setores:', err);
      setSetores([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={label ? "grid gap-2" : ""}>
      {label && <Label>{label}</Label>}
      <Select
        value={value?.toString() || 'all'}
        onValueChange={(val) => onChange(val === 'all' ? null : parseInt(val))}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={isLoading ? 'Carregando...' : placeholder}>
            {isLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Carregando...</span>
              </div>
            ) : value ? (
              // ✅ Buscar no array COMPLETO (não filtrado) para exibir corretamente
              setores.find(s => s.nro_setor === value)?.descricao || `Setor ${value}`
            ) : (
              allowClear ? 'Todos os setores' : placeholder
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {allowClear && (
            <SelectItem value="all">Todos os setores</SelectItem>
          )}
          {/* ✅ Filtrar APENAS na listagem, não na exibição do valor selecionado */}
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