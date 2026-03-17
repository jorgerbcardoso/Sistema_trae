import React, { useState, useEffect, useRef } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Search, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ENVIRONMENT } from '../../config/environment';

interface Evento {
  evento: string;
  descricao: string;
}

// 🎭 MOCK DATA para Figma Make
const MOCK_EVENTOS: Evento[] = [
  { evento: 'ABAST', descricao: 'ABASTECIMENTO' },
  { evento: 'MANUT', descricao: 'MANUTENÇÃO' },
  { evento: 'PEDAGIO', descricao: 'PEDÁGIO' },
  { evento: 'ALIMENT', descricao: 'ALIMENTAÇÃO' },
  { evento: 'HOTEL', descricao: 'HOSPEDAGEM' },
  { evento: 'PNEU', descricao: 'PNEUS' },
  { evento: 'OLEO', descricao: 'ÓLEO E LUBRIFICANTES' },
  { evento: 'BALSA', descricao: 'BALSA/FERRY' },
  { evento: 'LAVAGEM', descricao: 'LAVAGEM' },
  { evento: 'ESTACION', descricao: 'ESTACIONAMENTO' },
  { evento: 'SEGURO', descricao: 'SEGURO' },
  { evento: 'IPVA', descricao: 'IPVA' },
  { evento: 'LICENC', descricao: 'LICENCIAMENTO' },
  { evento: 'MULTA', descricao: 'MULTA DE TRÂNSITO' },
  { evento: 'OUTROS', descricao: 'OUTRAS DESPESAS' },
];

interface EventoSearchInputProps {
  value: string; // Código do evento selecionado
  onChange: (eventoCode: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * 🔍 COMPONENTE DE BUSCA DE EVENTOS
 * 
 * Funcionalidades:
 * - Exibe TODAS as opções ao clicar no input
 * - Filtra eventos ao digitar (busca por código ou descrição)
 * - Retorna o código do evento ([dominio]_evento.evento)
 * - Reutilizável em qualquer tela
 * 
 * @example
 * <EventoSearchInput
 *   value={formData.evento}
 *   onChange={(codigo) => updateFormData('evento', codigo)}
 *   label="Evento"
 *   required
 * />
 */
export function EventoSearchInput({
  value,
  onChange,
  label = "Evento",
  placeholder = "Busque por código ou descrição...",
  disabled = false,
  required = false,
  className = ""
}: EventoSearchInputProps) {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filteredEventos, setFilteredEventos] = useState<Evento[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 📥 BUSCAR EVENTOS DA API
  useEffect(() => {
    const fetchEventos = async () => {
      if (!user?.domain) {
        console.log('⚠️ [EventoSearchInput] Sem domínio do usuário');
        return;
      }

      console.log('🔍 [EventoSearchInput] Buscando eventos para domínio:', user.domain);
      setIsLoading(true);
      try {
        // 🎭 FIGMA MAKE: Usar dados mock
        if (ENVIRONMENT.isFigmaMake || ENVIRONMENT.useMockData) {
          console.log('🎭 [EventoSearchInput] Usando dados MOCK');
          await new Promise(resolve => setTimeout(resolve, 300)); // Simular delay
          setEventos(MOCK_EVENTOS);
          setFilteredEventos(MOCK_EVENTOS);
          setIsLoading(false);
          return;
        }

        // ✅ USAR ENDPOINT DO entrada_estoque.php com action=eventos
        // ✅ CAMINHO ABSOLUTO CORRETO: /sistema/api/estoque/entrada_estoque.php
        const url = `/sistema/api/estoque/entrada_estoque.php?action=eventos&_t=${Date.now()}`;
        console.log('📡 [EventoSearchInput] URL COMPLETA:', url);
        
        const response = await fetch(url);
        console.log('📥 [EventoSearchInput] Status da resposta:', response.status);
        
        const data = await response.json();
        console.log('📦 [EventoSearchInput] Dados recebidos:', data);

        if (data.success && Array.isArray(data.data)) {
          console.log('✅ [EventoSearchInput] Eventos carregados:', data.data.length);
          setEventos(data.data);
          setFilteredEventos(data.data);
        } else {
          console.warn('⚠️ [EventoSearchInput] Resposta sem sucesso ou sem dados array');
        }
      } catch (error) {
        console.error('❌ [EventoSearchInput] Erro ao buscar eventos:', error);
        // 🎭 FALLBACK: Usar dados mock em caso de erro
        console.warn('⚠️ [EventoSearchInput] Usando dados MOCK como fallback');
        setEventos(MOCK_EVENTOS);
        setFilteredEventos(MOCK_EVENTOS);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEventos();
  }, [user?.domain]);

  // 🔍 FILTRAR EVENTOS AO DIGITAR
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredEventos(eventos);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = eventos.filter(
        (evento) =>
          evento.evento.toLowerCase().includes(term) ||
          evento.descricao.toLowerCase().includes(term)
      );
      setFilteredEventos(filtered);
    }
  }, [searchTerm, eventos]);

  // 🎯 SINCRONIZAR EVENTO SELECIONADO COM VALUE EXTERNO
  useEffect(() => {
    if (value) {
      const evento = eventos.find((e) => e.evento === value);
      if (evento) {
        setSelectedEvento(evento);
        setSearchTerm(''); // Limpar busca quando selecionado
      }
    } else {
      setSelectedEvento(null);
      setSearchTerm('');
    }
  }, [value, eventos]);

  // 🖱️ FECHAR DROPDOWN AO CLICAR FORA
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchTerm(''); // Limpar busca ao fechar
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ SELECIONAR EVENTO
  const handleSelectEvento = (evento: Evento) => {
    setSelectedEvento(evento);
    onChange(evento.evento);
    setIsOpen(false);
    setSearchTerm('');
  };

  // ❌ LIMPAR SELEÇÃO
  const handleClear = () => {
    setSelectedEvento(null);
    onChange('');
    setSearchTerm('');
    setIsOpen(false);
  };

  // 🖱️ ABRIR DROPDOWN AO CLICAR NO INPUT
  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  // ⌨️ ATUALIZAR BUSCA AO DIGITAR
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {/* LABEL */}
      <Label>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {/* INPUT CONTAINER */}
      <div className="relative">
        {/* DISPLAY DO EVENTO SELECIONADO */}
        {selectedEvento && !isOpen ? (
          <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-md bg-card">
            <span className="flex-1 text-sm text-foreground">
              <span className="font-semibold">{selectedEvento.evento}</span> - {selectedEvento.descricao}
            </span>
            {!disabled && (
              <button
                type="button"
                onClick={handleClear}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ) : (
          /* INPUT DE BUSCA */
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 dark:text-gray-500" />
            <Input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              onClick={handleInputClick}
              placeholder={placeholder}
              disabled={disabled}
              className="pl-9"
            />
          </div>
        )}

        {/* DROPDOWN DE OPÇÕES */}
        {isOpen && !disabled && (
          <div
            ref={dropdownRef}
            className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Carregando eventos...
              </div>
            ) : filteredEventos.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {searchTerm ? 'Nenhum evento encontrado.' : 'Nenhum evento disponível.'}
              </div>
            ) : (
              <div className="py-1">
                {filteredEventos.map((evento) => (
                  <button
                    key={evento.evento}
                    type="button"
                    onClick={() => handleSelectEvento(evento)}
                    className="w-full px-4 py-2 text-left text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none transition-colors"
                  >
                    <span className="font-semibold">{evento.evento}</span> - {evento.descricao}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}