import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { X, Truck, ListTree } from 'lucide-react';
import { FilterSelectVeiculo } from './FilterSelectVeiculo';
import { FilterSelectUnidadeSingle } from '../cadastros/FilterSelectUnidadeSingle';

interface ModalCarregamentoAutomaticoProps {
  onConfirmar: (placa: string, unidadeDestino: string, paradas: string[]) => void;
  onFechar: () => void;
}

export function ModalCarregamentoAutomatico({ onConfirmar, onFechar }: ModalCarregamentoAutomaticoProps) {
  const [placa, setPlaca] = useState('');
  const [unidadeDestino, setUnidadeDestino] = useState('');
  const [paradas, setParadas] = useState<string[]>(['', '', '', '', '']);

  const handleParadaChange = (index: number, value: string) => {
    const novasParadas = [...paradas];
    novasParadas[index] = value;
    setParadas(novasParadas);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <ListTree className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Carregamento Automático</h3>
          </div>
          <button onClick={onFechar} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="placa">Placa do Veículo</Label>
            <FilterSelectVeiculo value={placa} onChange={setPlaca} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="unidadeDestino">Unidade de Destino Final</Label>
            <FilterSelectUnidadeSingle value={unidadeDestino} onChange={setUnidadeDestino} />
          </div>

          <div className="space-y-3">
            <Label>Unidades de Parada (em ordem)</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {paradas.map((parada, index) => (
                <div key={index} className="relative">
                  <Input
                    placeholder={`Parada ${index + 1}`}
                    value={parada}
                    onChange={(e) => handleParadaChange(index, e.target.value.toUpperCase())}
                    maxLength={3}
                    className="uppercase dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white"
            disabled={!placa || !unidadeDestino}
            onClick={() => onConfirmar(placa, unidadeDestino, paradas.filter(p => p.trim() !== ''))}
          >
            <ListTree className="w-4 h-4 mr-1.5" />Gerar Carregamento
          </Button>
        </div>
      </div>
    </div>
  );
}
