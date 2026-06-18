import React, { useState, useMemo, useEffect } from 'react';
import { Filter, X, Check, Calendar, Search } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { useAuth } from '../../contexts/AuthContext';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

export interface PeriodRange {
  startMonth: number;
  startYear: number;
  endMonth: number;
  endYear: number;
}

interface PeriodFilterProps {
  currentPeriod: PeriodRange;
  onPeriodChange: (period: PeriodRange) => void;
  selectedUnidades?: string[];
  onUnidadesChange?: (unidades: string[]) => void;
}

const MONTHS = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
];

const MIN_YEAR = 2025;
const MIN_MONTH = 1;

const YEARS = Array.from({ length: 10 }, (_, i) => MIN_YEAR + i);

export function PeriodFilter({ currentPeriod, onPeriodChange, selectedUnidades = [], onUnidadesChange }: PeriodFilterProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [tempPeriod, setTempPeriod] = useState<PeriodRange>(currentPeriod);
  const [tempUnidades, setTempUnidades] = useState<string[]>(selectedUnidades);
  const [manualUnidades, setManualUnidades] = useState('');
  const [searchUnidades, setSearchUnidades] = useState('');

  const unidadeAtual = (user?.unidade_atual || user?.unidade || '').toUpperCase();
  const isMTZ = unidadeAtual === 'MTZ';

  const unidadesDisponiveis = useMemo(() => {
    const csv = user?.unidades || '';
    const lista = csv.trim()
      ? csv.split(',').map(u => u.trim().toUpperCase()).filter(Boolean)
      : [];
    if (!isMTZ && unidadeAtual && !lista.includes(unidadeAtual)) {
      lista.unshift(unidadeAtual);
    }
    return lista;
  }, [user?.unidades, unidadeAtual, isMTZ]);

  const naoMTZSemGrupo = !isMTZ && (user?.unidades || '').trim() === '';
  const unidadeBloqueada = (sigla: string) => !isMTZ && sigla === unidadeAtual;

  const [unidadesMTZ, setUnidadesMTZ] = useState<Array<{ sigla: string; nome?: string }>>([]);

  useEffect(() => {
    if (!isMTZ) return;
    apiFetch(`${ENVIRONMENT.apiBaseUrl}/search_unidades.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ search: '' }),
    })
      .then((res) => {
        const lista = (res?.unidades || []).map((u: any) => ({ sigla: String(u.sigla || '').toUpperCase(), nome: u.nome ? String(u.nome) : '' }));
        setUnidadesMTZ(lista.filter((u: any) => u.sigla));
      })
      .catch(() => {});
  }, [isMTZ]);

  const unidadesParaExibir = isMTZ
    ? unidadesMTZ
    : unidadesDisponiveis.map((sigla) => ({ sigla, nome: '' }));

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTempPeriod(currentPeriod);
      setTempUnidades(selectedUnidades);
      setManualUnidades(selectedUnidades.join(', '));
      setSearchUnidades('');
    }
    setOpen(isOpen);
  };

  useEffect(() => {
    if (!open) return;
    setManualUnidades(tempUnidades.join(', '));
  }, [open, tempUnidades.join(',')]);

  const normalizeSiglas = (siglas: string[]) => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const s of siglas) {
      const v = s.trim().toUpperCase();
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      ordered.push(v);
    }
    if (!isMTZ && unidadeAtual) {
      if (!ordered.includes(unidadeAtual)) ordered.unshift(unidadeAtual);
    }
    return ordered;
  };

  const allowedSet = useMemo(() => {
    if (isMTZ) return null;
    const set = new Set(unidadesDisponiveis.map((u) => u.toUpperCase()));
    if (unidadeAtual) set.add(unidadeAtual);
    return set;
  }, [isMTZ, unidadesDisponiveis, unidadeAtual]);

  const applyAllowed = (siglas: string[]) => {
    if (!allowedSet) return siglas;
    return siglas.filter((s) => allowedSet.has(s));
  };

  const toggleUnidade = (sigla: string) => {
    if (unidadeBloqueada(sigla)) return;
    setTempUnidades((prev) => {
      const next = prev.includes(sigla) ? prev.filter((u) => u !== sigla) : [...prev, sigla];
      const normalized = normalizeSiglas(next);
      return applyAllowed(normalized);
    });
  };

  const handleApply = () => {
    const minDate = new Date(MIN_YEAR, MIN_MONTH - 1);
    const startDate = new Date(tempPeriod.startYear, tempPeriod.startMonth - 1);
    const endDate = new Date(tempPeriod.endYear, tempPeriod.endMonth - 1);

    if (startDate < minDate) {
      alert(`A data inicial não pode ser anterior a Janeiro de ${MIN_YEAR}`);
      return;
    }

    if (endDate < startDate) {
      alert('A data final não pode ser anterior à data inicial');
      return;
    }

    onPeriodChange(tempPeriod);
    if (onUnidadesChange) {
      onUnidadesChange(tempUnidades);
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setTempPeriod(currentPeriod);
    setTempUnidades(selectedUnidades);
    setOpen(false);
  };

  const handleQuickSelect = (type: 'current-year' | 'last-year' | 'last-12-months' | 'current-quarter' | 'last-quarter') => {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    let newPeriod: PeriodRange;

    switch (type) {
      case 'current-year':
        newPeriod = {
          startMonth: 1,
          startYear: currentYear,
          endMonth: currentMonth,
          endYear: currentYear,
        };
        break;
      
      case 'last-year':
        newPeriod = {
          startMonth: 1,
          startYear: currentYear - 1,
          endMonth: 12,
          endYear: currentYear - 1,
        };
        break;
      
      case 'last-12-months':
        const lastYear = new Date(now.getFullYear(), now.getMonth() - 11);
        newPeriod = {
          startMonth: lastYear.getMonth() + 1,
          startYear: lastYear.getFullYear(),
          endMonth: currentMonth,
          endYear: currentYear,
        };
        break;
      
      case 'current-quarter':
        const quarterStart = Math.floor((currentMonth - 1) / 3) * 3 + 1;
        newPeriod = {
          startMonth: quarterStart,
          startYear: currentYear,
          endMonth: currentMonth,
          endYear: currentYear,
        };
        break;
      
      case 'last-quarter':
        const lastQuarterEnd = Math.floor((currentMonth - 1) / 3) * 3;
        const lastQuarterStart = lastQuarterEnd - 2;
        const lastQuarterYear = lastQuarterStart < 1 ? currentYear - 1 : currentYear;
        newPeriod = {
          startMonth: lastQuarterStart < 1 ? 12 + lastQuarterStart : lastQuarterStart,
          startYear: lastQuarterYear,
          endMonth: lastQuarterEnd === 0 ? 12 : lastQuarterEnd,
          endYear: lastQuarterEnd === 0 ? currentYear - 1 : currentYear,
        };
        break;
    }

    setTempPeriod(newPeriod);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="dark:border-slate-600 dark:hover:bg-slate-800 print:hidden"
        >
          <Filter className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] h-[calc(100vh-80px)] overflow-hidden flex flex-col bg-white dark:bg-slate-900">
        <DialogHeader>
          <DialogTitle className="text-slate-900 dark:text-slate-100">Filtrar Período</DialogTitle>
          <DialogDescription className="text-slate-600 dark:text-slate-400">
            Selecione o período que deseja visualizar no dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-1">
          {/* Atalhos Rápidos */}
          <div>
            <Label className="text-slate-900 dark:text-slate-100 mb-2 block">Atalhos</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('current-year')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Ano Atual
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('last-year')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Ano Passado
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('last-12-months')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Últimos 12 Meses
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('current-quarter')}
                className="justify-start dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Trimestre Atual
              </Button>
            </div>
          </div>

          {/* Seleção Manual */}
          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
            <Label className="text-slate-900 dark:text-slate-100 mb-3 block">Período Personalizado</Label>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Data Inicial */}
              <div className="space-y-3">
                <Label className="text-sm text-slate-600 dark:text-slate-400">Data Inicial</Label>
                <div className="space-y-2">
                  <select
                    value={tempPeriod.startMonth}
                    onChange={(e) => setTempPeriod({ ...tempPeriod, startMonth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={tempPeriod.startYear}
                    onChange={(e) => setTempPeriod({ ...tempPeriod, startYear: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Final */}
              <div className="space-y-3">
                <Label className="text-sm text-slate-600 dark:text-slate-400">Data Final</Label>
                <div className="space-y-2">
                  <select
                    value={tempPeriod.endMonth}
                    onChange={(e) => setTempPeriod({ ...tempPeriod, endMonth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={tempPeriod.endYear}
                    onChange={(e) => setTempPeriod({ ...tempPeriod, endYear: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {YEARS.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Filtro de Unidades */}
          {onUnidadesChange && (
            <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-slate-900 dark:text-slate-100">Unidades</Label>
                {isMTZ && tempUnidades.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTempUnidades([])}
                    className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                {naoMTZSemGrupo
                  ? 'Filtro fixo na sua unidade'
                  : tempUnidades.length === 0
                    ? 'Nenhuma unidade selecionada — exibindo todas'
                    : `${tempUnidades.length} unidade${tempUnidades.length > 1 ? 's' : ''} selecionada${tempUnidades.length > 1 ? 's' : ''}`}
              </p>
              {naoMTZSemGrupo ? (
                <div className="text-xs text-slate-700 dark:text-slate-300 font-mono">
                  {unidadeAtual || '-'}
                </div>
              ) : (
                <div className="border rounded-lg p-3 space-y-3 bg-slate-50 dark:bg-slate-900">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-600 dark:text-slate-400">
                      Digite manualmente (separado por vírgulas):
                    </Label>
                    <input
                      type="text"
                      value={manualUnidades}
                      onChange={(e) => {
                        const input = e.target.value;
                        setManualUnidades(input);
                        const siglas = input.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
                        const normalized = normalizeSiglas(siglas);
                        setTempUnidades(applyAllowed(normalized));
                      }}
                      className="w-full px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ex: CWB, SPO, GYN"
                    />
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchUnidades}
                      onChange={(e) => setSearchUnidades(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Buscar unidade..."
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 p-2">
                    {unidadesParaExibir.length === 0 ? (
                      <div className="text-center py-4 text-sm text-slate-500">
                        {isMTZ ? 'Carregando unidades...' : 'Nenhuma unidade configurada no seu cadastro.'}
                      </div>
                    ) : (
                      unidadesParaExibir
                        .filter((u) => {
                          const term = searchUnidades.trim().toLowerCase();
                          if (!term) return true;
                          return (u.sigla || '').toLowerCase().includes(term) || (u.nome || '').toLowerCase().includes(term);
                        })
                        .map((u) => {
                          const sigla = u.sigla;
                          const selected = tempUnidades.includes(sigla);
                          const bloqueado = unidadeBloqueada(sigla);
                          return (
                            <div
                              key={sigla}
                              className={`flex items-center gap-3 p-2 rounded transition-colors ${
                                bloqueado ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700'
                              }`}
                              onClick={() => { if (!bloqueado) toggleUnidade(sigla); }}
                              title={bloqueado ? 'Sua unidade atual — não pode ser removida' : undefined}
                            >
                              <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-all ${
                                selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                              }`}>
                                {selected && (
                                  <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                                )}
                              </div>
                              <div className="flex flex-col flex-1 min-w-0">
                                <span className="font-mono text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                  {sigla}{bloqueado ? ' 🔒' : ''}
                                </span>
                                {u.nome ? (
                                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {u.nome}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-700 pt-2 bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                    <strong>Selecionadas ({tempUnidades.length}):</strong> {tempUnidades.join(', ') || '—'}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleApply}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Check className="w-4 h-4 mr-2" />
              Aplicar Filtro
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
