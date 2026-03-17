import React from 'react';
import { Calendar, FileSpreadsheet, CircleHelp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { DayData } from '../../services/performanceEntregasService';

interface AnaliseDiariaProps {
  analisePeriodo: 7 | 15 | 30;
  setAnalisePeriodo: (periodo: 7 | 15 | 30) => void;
  diasData: DayData[];
  loadingAnalise: boolean;
  handleExportEntregasDia: (data: string) => void;
  handleExportPrevistosDia: (data: string) => void;
  handleExportEntreguesDia: (data: string) => void;
}

export function AnaliseDiaria({
  analisePeriodo,
  setAnalisePeriodo,
  diasData,
  loadingAnalise,
  handleExportEntregasDia,
  handleExportPrevistosDia,
  handleExportEntreguesDia
}: AnaliseDiariaProps) {
  return (
    <Card className="dark:bg-slate-900 dark:border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="dark:text-slate-100 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Análise Diária
              </CardTitle>
              
              {/* ✅ Ícone de Ajuda */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                  >
                    <CircleHelp className="w-5 h-5" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900">
                  <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <CircleHelp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      Como funciona a Análise Diária
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      Informações sobre como a seção Análise Diária funciona, incluindo filtros aplicados e métricas exibidas
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
                    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        ⚠️ Importante sobre os Filtros
                      </p>
                      <p>
                        Esta seção <strong>DESCONSIDERA os períodos informados no filtro</strong>, mas respeita os outros filtros (Unidade de Destino, CNPJ Pagador e CNPJ Destinatário).
                      </p>
                    </div>
                    
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-2">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        📅 Período Considerado
                      </p>
                      <p>
                        O período analisado é determinado pela chave selecionada: <strong>7 dias</strong>, <strong>15 dias</strong> ou <strong>1 mês</strong>.
                      </p>
                    </div>
                    
                    <div className="space-y-3">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">
                        📊 Métricas Exibidas
                      </p>
                      
                      <div className="pl-3 space-y-2">
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">Entregas:</span>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            Quantidade de conhecimentos entregues no dia em questão.
                          </p>
                        </div>
                        
                        <div>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">Previstos:</span>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            Quantidade de conhecimentos com data de previsão de entrega para o dia em questão.
                          </p>
                        </div>
                        
                        <div>
                          <span className="font-semibold text-green-600 dark:text-green-400">No prazo:</span>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            Quantidade de conhecimentos, dentre os Previstos, que foram entregues dentro da previsão de entrega.
                          </p>
                        </div>
                        
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">Performance:</span>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                            O quanto os conhecimentos "No prazo" representam dentro dos "Previstos". Calculado como: (No prazo / Previstos) × 100.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <p className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-1">
                        <FileSpreadsheet className="w-4 h-4" />
                        Exportação de Dados
                      </p>
                      <p className="text-xs">
                        Clique sobre os totais (Entregas, Previstos ou No prazo) para exportar os conhecimentos correspondentes em formato CSV.
                      </p>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Visão consolidada de entregas, previstos e performance dia a dia
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
              <FileSpreadsheet className="w-3 h-3" />
              Clique sobre os totais para imprimir os conhecimentos
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={analisePeriodo === 7 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAnalisePeriodo(7)}
              className={analisePeriodo === 7 ? 'bg-blue-600 hover:bg-blue-700' : 'dark:border-slate-600'}
            >
              7 dias
            </Button>
            <Button
              variant={analisePeriodo === 15 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAnalisePeriodo(15)}
              className={analisePeriodo === 15 ? 'bg-blue-600 hover:bg-blue-700' : 'dark:border-slate-600'}
            >
              15 dias
            </Button>
            <Button
              variant={analisePeriodo === 30 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAnalisePeriodo(30)}
              className={analisePeriodo === 30 ? 'bg-blue-600 hover:bg-blue-700' : 'dark:border-slate-600'}
            >
              1 mês
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loadingAnalise ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className={`grid gap-3 ${
            analisePeriodo === 7 ? 'grid-cols-7' : 
            analisePeriodo === 15 ? 'grid-cols-5 md:grid-cols-8' : 
            'grid-cols-5 md:grid-cols-7 lg:grid-cols-10'
          }`}>
            {diasData.map((dia, index) => {
              // Calcular performance do dia
              const performanceDia = dia.previstosDia > 0 
                ? (dia.entreguesDia / dia.previstosDia) * 100 
                : 0;
              
              // Cor baseada na performance
              const bgColor = performanceDia >= 90 
                ? 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800' 
                : performanceDia >= 70 
                ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800' 
                : performanceDia > 0
                ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700';
              
              const textColor = performanceDia >= 90 
                ? 'text-green-700 dark:text-green-300' 
                : performanceDia >= 70 
                ? 'text-yellow-700 dark:text-yellow-300' 
                : performanceDia > 0
                ? 'text-red-700 dark:text-red-300'
                : 'text-slate-500 dark:text-slate-400';
              
              return (
                <div
                  key={index}
                  className={`${bgColor} border-2 rounded-lg p-3 transition-all hover:shadow-md`}
                >
                  {/* Cabeçalho: Dia da semana */}
                  <div className="text-center mb-2">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      {dia.diaSemana}
                    </p>
                    <p className={`text-2xl font-bold ${textColor}`}>
                      {dia.dia}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 uppercase">
                      {dia.mesNome}
                    </p>
                  </div>
                  
                  {/* Dados do dia - VERSÃO DESKTOP */}
                  <div className="hidden md:block space-y-1 text-xs">
                    {/* Entregas do Dia */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleExportEntregasDia(dia.data)}
                            disabled={dia.entregasDia === 0}
                            className="w-full text-left px-2 py-1 rounded hover:bg-white/50 dark:hover:bg-black/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 dark:text-slate-400">Entregas:</span>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {dia.entregasDia}
                              </span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Clique para exportar</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Previstos */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleExportPrevistosDia(dia.data)}
                            disabled={dia.previstosDia === 0}
                            className="w-full text-left px-2 py-1 rounded hover:bg-white/50 dark:hover:bg-black/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 dark:text-slate-400">Previstos:</span>
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {dia.previstosDia}
                              </span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Clique para exportar</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Entregues no Prazo */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => handleExportEntreguesDia(dia.data)}
                            disabled={dia.entreguesDia === 0}
                            className="w-full text-left px-2 py-1 rounded hover:bg-white/50 dark:hover:bg-black/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-slate-600 dark:text-slate-400">No prazo:</span>
                              <span className="font-semibold text-green-600 dark:text-green-400">
                                {dia.entreguesDia}
                              </span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Clique para exportar</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Indicador de Performance */}
                    {performanceDia > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-600 dark:text-slate-400">Perf.:</span>
                          <span className={`font-bold ${textColor}`}>
                            {performanceDia.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Dados do dia - VERSÃO MOBILE (simplificada) */}
                  <div className="md:hidden space-y-1 text-xs">
                    {/* Apenas Performance e No Prazo/Previstos */}
                    <div className="px-2 py-1">
                      <div className="text-center">
                        <p className="text-slate-600 dark:text-slate-400 text-[10px] mb-0.5">No prazo</p>
                        <p className="font-semibold text-green-600 dark:text-green-400">
                          {dia.entreguesDia}/{dia.previstosDia}
                        </p>
                      </div>
                    </div>
                    
                    {performanceDia > 0 && (
                      <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                        <div className="text-center px-2 py-1">
                          <p className="text-slate-600 dark:text-slate-400 text-[10px] mb-0.5">Perf.</p>
                          <p className={`font-bold text-sm ${textColor}`}>
                            {performanceDia.toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}