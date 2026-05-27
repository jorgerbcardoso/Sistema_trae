import { useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { apiFetch } from '../../config/api';
import {
  ChevronsLeft,
  ChevronsRight,
  Filter as FilterIcon, // Renomeado para não conflitar
  RefreshCw,
  Truck,
  Package,
  PlusCircle,
  Archive,
  Send,
  Warehouse,
  Search,
  ArrowRight,
  Bus,
  X,
  DownloadCloud,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { DashboardLayout } from '../layouts/DashboardLayout';

// --- COMPONENTES DO HUB DE CARGAS E MODAIS ---

function ConfirmacaoModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>
        <div className="p-6 text-sm text-slate-600 dark:text-slate-400">{children}</div>
        <div className="flex justify-end p-4 bg-slate-50 dark:bg-slate-800/50 rounded-b-lg space-x-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm}>Confirmar</Button>
        </div>
      </div>
    </div>
  );
}


function HubModal({
  isOpen,
  onRequestClose,
  title,
  children,
}: {
  isOpen: boolean;
  onRequestClose: () => void;
  title: string;
  children: ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          </div>
          <button onClick={onRequestClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}


function UnidadeCompartilhadaCard({
  unidade,
  onCteSelect,
  ctesSelecionados,
}: {
  unidade: string;
  onCteSelect: (cte: any, unidade: string) => void;
  ctesSelecionados: any[];
}) {
  const [dados, setDados] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function carregarDadosUnidade() {
      setLoading(true);
      try {
        const resultado = await apiFetch(
          `dashboards/disponiveis/get_disponiveis_unidade_compartilhada.php`,
          {
            method: 'POST',
            body: JSON.stringify({ unidade }),
          }
        );
        if (resultado.status === 'error') {
          throw new Error(resultado.message);
        }
        setDados(resultado.data);
      } catch (error: any) {
        console.error(`Erro ao buscar dados da unidade ${unidade}:`, error);
        toast.error(`Erro ao buscar dados de ${unidade}: ${error.message}`);
        setDados(null);
      } finally {
        setLoading(false);
      }
    }

    carregarDadosUnidade();
  }, [unidade]);

  const isCteSelecionado = (cte: any) => {
    return ctesSelecionados.some(c => c.chave_cte === cte.chave_cte);
  };

  if (loading) {
    return (
      <Card className="w-full animate-pulse">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Warehouse className="mr-2" size={24} />
            <div className="h-6 bg-gray-300 dark:bg-slate-700 rounded w-24"></div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-gray-300 dark:bg-slate-700 rounded w-1/2 mx-auto mt-4"></div>
        </CardContent>
      </Card>
    );
  }

  if (!dados || (dados.coletas.length === 0 && dados.transferencias.length === 0 && dados.entregas.length === 0)) {
    return null; // Não renderiza nada se não houver cargas
  }

  return (
    <Card className="w-full bg-slate-50 dark:bg-slate-800/50">
      <CardHeader>
        <CardTitle className="flex items-center text-lg">
          <Warehouse className="mr-2" size={24} />
          {unidade}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {dados.coletas.length > 0 && (
          <div>
            <h4 className="font-semibold text-md mb-2">Coletas ({dados.coletas.length})</h4>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
              {dados.coletas.map((cte: any) => (
                <div
                  key={cte.chave_cte}
                  onClick={() => onCteSelect({ ...cte, tipo: 'COLETA' }, unidade)}
                  className={`p-2 border rounded-md cursor-pointer transition-colors ${
                    isCteSelecionado(cte)
                      ? 'bg-blue-100 dark:bg-blue-900 border-blue-400'
                      : 'bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="font-bold text-sm">{cte.destinatario}</p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {cte.volumes} vol, {cte.peso} kg
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {dados.transferencias.length > 0 && (
           <div>
            <h4 className="font-semibold text-md mb-2">Transferências ({dados.transferencias.length})</h4>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
              {dados.transferencias.map((cte: any) => (
                <div
                  key={cte.chave_cte}
                  onClick={() => onCteSelect({ ...cte, tipo: 'TRANSFERENCIA' }, unidade)}
                   className={`p-2 border rounded-md cursor-pointer transition-colors ${
                    isCteSelecionado(cte)
                      ? 'bg-blue-100 dark:bg-blue-900 border-blue-400'
                      : 'bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="font-bold text-sm">
                    {cte.remetente} &rarr; {cte.destinatario}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-slate-400">
                    {cte.volumes} vol, {cte.peso} kg
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {dados.entregas.length > 0 && (
           <div>
            <h4 className="font-semibold text-md mb-2">Entregas ({dados.entregas.length})</h4>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-2">
              {dados.entregas.map((cte: any) => (
                <div
                  key={cte.chave_cte}
                  onClick={() => onCteSelect({ ...cte, tipo: 'ENTREGA' }, unidade)}
                   className={`p-2 border rounded-md cursor-pointer transition-colors ${
                    isCteSelecionado(cte)
                      ? 'bg-blue-100 dark:bg-blue-900 border-blue-400'
                      : 'bg-white dark:bg-slate-900 hover:bg-gray-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="font-bold text-sm">{cte.destinatario}</p>
                   <p className="text-xs text-gray-600 dark:text-slate-400">
                    {cte.volumes} vol, {cte.peso} kg
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HubCargasCompartilhadas({
  carregamento,
  onClose,
  onAddCtes,
}: {
  carregamento: any;
  onClose: () => void;
  onAddCtes: (novosCtes: any[]) => void;
}) {
  const [unidades, setUnidades] = useState<string[]>([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [ctesSelecionados, setCtesSelecionados] = useState<any[]>([]);

  useEffect(() => {
    async function carregarUnidadesCompartilhadas() {
      setLoadingUnidades(true);
      try {
        const resultado = await apiFetch(
          'dashboards/disponiveis/get_unidades_compartilhadas.php',
          { method: 'POST' }
        );
        if (resultado.status === 'success') {
          setUnidades(resultado.data);
        } else {
          throw new Error(resultado.message);
        }
      } catch (error: any) {
        toast.error(`Erro ao buscar unidades: ${error.message}`);
      } finally {
        setLoadingUnidades(false);
      }
    }
    carregarUnidadesCompartilhadas();
  }, []);

  const handleCteSelect = (cte: any, unidade: string) => {
    const cteComUnidade = { ...cte, unidade_origem_hub: unidade };

    setCtesSelecionados(prev => {
      const isJaSelecionado = prev.some(c => c.chave_cte === cte.chave_cte);
      if (isJaSelecionado) {
        return prev.filter(c => c.chave_cte !== cte.chave_cte);
      } else {
        const pesoTotalSelecionado = prev.reduce((acc, cur) => acc + parseFloat(cur.peso || 0), 0);
        const volumeTotalSelecionado = prev.reduce((acc, cur) => acc + parseInt(cur.volumes || 0), 0);
        const capacidadePesoRestante = parseFloat(carregamento.capacidade_kg) - parseFloat(carregamento.peso_total_carregado);
        const capacidadeVolumeRestante = parseInt(carregamento.capacidade_vol) - parseInt(carregamento.volumes_total_carregado);

        if (pesoTotalSelecionado + parseFloat(cte.peso || 0) > capacidadePesoRestante) {
          toast.warning('Peso excederia a capacidade restante do veículo.');
          return prev;
        }
        if (volumeTotalSelecionado + parseInt(cte.volumes || 0) > capacidadeVolumeRestante) {
          toast.warning('Volume excederia a capacidade restante do veículo.');
          return prev;
        }

        return [...prev, cteComUnidade];
      }
    });
  };

  const totalPesoSelecionado = ctesSelecionados.reduce((acc, cur) => acc + parseFloat(cur.peso || 0), 0);
  const totalVolumeSelecionado = ctesSelecionados.reduce((acc, cur) => acc + parseInt(cur.volumes || 0), 0);
  const capacidadePesoRestante = parseFloat(carregamento.capacidade_kg) - parseFloat(carregamento.peso_total_carregado);
  const capacidadeVolumeRestante = parseInt(carregamento.capacidade_vol) - parseInt(carregamento.volumes_total_carregado);

  return (
    <HubModal isOpen={true} onRequestClose={onClose} title={`Hub de Cargas Compartilhadas para ${carregamento.placa}`}>
      <div className="p-6">
        <div className="sticky top-0 bg-white dark:bg-slate-900 z-10 py-4 -my-4 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                <h3 className="font-bold text-lg mb-2">Status do Carregamento ({carregamento.placa})</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                    <div>
                        <span className="text-sm text-gray-600 dark:text-slate-400">Ocupação Atual (Peso):</span>
                        <p className="font-semibold text-base">{Number(carregamento.peso_total_carregado).toFixed(2)} kg / {carregamento.capacidade_kg} kg</p>
                    </div>
                    <div>
                        <span className="text-sm text-gray-600 dark:text-slate-400">Ocupação Atual (Volume):</span>
                        <p className="font-semibold text-base">{carregamento.volumes_total_carregado} / {carregamento.capacidade_vol} vol</p>
                    </div>
                    <div className="col-span-2 mt-2">
                        <p className="text-sm font-bold text-green-700 dark:text-green-400">
                            Capacidade Restante: {Math.max(0, capacidadePesoRestante - totalPesoSelecionado).toFixed(2)} kg e {Math.max(0, capacidadeVolumeRestante - totalVolumeSelecionado)} vol
                        </p>
                    </div>
                </div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <h3 className="font-bold text-lg mb-2">Cargas Selecionadas no Hub</h3>
                 {ctesSelecionados.length > 0 ? (
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                            <span className="text-sm text-gray-600 dark:text-slate-400">CT-es selecionados:</span>
                            <p className="font-semibold text-base">{ctesSelecionados.length}</p>
                        </div>
                         <div>
                            <span className="text-sm text-gray-600 dark:text-slate-400">Peso a adicionar:</span>
                            <p className="font-semibold text-base">{totalPesoSelecionado.toFixed(2)} kg</p>
                        </div>
                         <div>
                            <span className="text-sm text-gray-600 dark:text-slate-400">Volumes a adicionar:</span>
                            <p className="font-semibold text-base">{totalVolumeSelecionado} vol</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 italic mt-6">Nenhum CT-e selecionado nas unidades compartilhadas.</p>
                )}
            </div>
        </div>

        {loadingUnidades ? (
          <p className='text-center py-8'>Buscando unidades compartilhadas...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
            {unidades.map(unidade => (
              <UnidadeCompartilhadaCard 
                key={unidade} 
                unidade={unidade}
                onCteSelect={handleCteSelect}
                ctesSelecionados={ctesSelecionados}
              />
            ))}
             {unidades.length === 0 && !loadingUnidades && (
              <p className="col-span-full text-center text-gray-500 py-8">Nenhuma unidade configurada para compartilhamento.</p>
            )}
          </div>
        )}
      </div>

       <div className="flex justify-end p-4 mt-auto border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 sticky bottom-0">
          <Button variant="outline" onClick={onClose} className="mr-2">
            Cancelar
          </Button>
          <Button
            onClick={() => onAddCtes(ctesSelecionados)}
            disabled={ctesSelecionados.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Adicionar {ctesSelecionados.length > 0 ? ctesSelecionados.length : ''} CT-e(s) ao Carregamento
          </Button>
        </div>
    </HubModal>
  );
}

// --- COMPONENTE PRINCIPAL AJUSTADO ---
export function Disponiveis() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [unidadeSelecionada, setUnidadeSelecionada] = useState<string>('');

  const [manifestoFilter, setManifestoFilter] = useState('');
  const [placaFilter, setPlacaFilter] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [modalCarregamentoAberto, setModalCarregamentoAberto] = useState(false);
  const [placaParaCarregamento, setPlacaParaCarregamento] = useState('');
  const [veiculoParaCarregamento, setVeiculoParaCarregamento] = useState<any>(null);
  const [unidadePodeCarregar, setUnidadePodeCarregar] = useState<boolean | null>(null);

  const [hubAberto, setHubAberto] = useState(false);
  const [carregamentoParaHub, setCarregamentoParaHub] = useState<any>(null);
  const [ctesDoHub, setCtesDoHub] = useState<Record<string, any[]>>({});
  const [modalConfirmacaoAberto, setModalConfirmacaoAberto] = useState(false);
  const [importando, setImportando] = useState(false);

  const fetchData = useCallback(async (unidade: string) => {
    if (!unidade) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
        const res = await apiFetch(`dashboards/disponiveis/check_unidade_carregamento.php`, {
            method: 'POST', body: JSON.stringify({ unidade })
        });

        if (res.status === 'error' || (res.status === 'success' && !res.data.pode_carregar)) {
            setUnidadePodeCarregar(false);
            toast.error(res.message || "Unidade não configurada para efetuar carregamentos.");
            setData(null);
            setLoading(false);
            return;
        }
        
        setUnidadePodeCarregar(true);

      const response = await apiFetch(
        'dashboards/disponiveis/get_disponiveis.php',
        {
          method: 'POST',
          body: JSON.stringify({ unidade: unidade }),
        }
      );

      if (response.status === 'error') {
        throw new Error(response.message);
      }
      
      setData(response.data);
      setLastUpdate(new Date());
      setSecondsLeft(300);
    } catch (e: any) {
      setError(e.message);
      setData(null);
      toast.error(`Erro ao buscar dados: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const iniciarTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prevSeconds => {
        if (prevSeconds <= 1) {
          if (autoRefresh && unidadeSelecionada) {
            fetchData(unidadeSelecionada);
          }
          return 300;
        }
        return prevSeconds - 1;
      });
    }, 1000);
  }, [autoRefresh, unidadeSelecionada, fetchData]);

  useEffect(() => {
    async function getUnidades() {
      try {
        const response = await apiFetch('get_unidades.php', { method: 'POST' });
        if (response.status === 'success') {
          const unidadesFiltradas = response.data.filter((u: any) => u.cgc_franquia === null);
          setUnidades(unidadesFiltradas);
           if (unidadesFiltradas.length > 0) {
              const primeiraUnidade = unidadesFiltradas.find((u:any) => u.sigla !== 'MTZ') || unidadesFiltradas[0];
              setUnidadeSelecionada(primeiraUnidade.sigla);
           }
        }
      } catch (error) {
        console.error('Erro ao buscar unidades:', error);
      }
    }
    getUnidades();
  }, []);

  useEffect(() => {
    if (unidadeSelecionada) {
      fetchData(unidadeSelecionada);
      iniciarTimer();
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [unidadeSelecionada, fetchData, iniciarTimer]);

  const handleRefresh = () => {
    if (unidadeSelecionada) {
      fetchData(unidadeSelecionada);
    }
  };

  const handleAdicionarCtesDoHub = (novosCtes: any[]) => {
    if (!carregamentoParaHub) return;
    const placa = carregamentoParaHub.placa;

    setCtesDoHub(prev => {
        const ctesAtuais = prev[placa] || [];
        const ctesUnicos = novosCtes.filter(
            novoCte => !ctesAtuais.some(cteExistente => cteExistente.chave_cte === novoCte.chave_cte)
        );
        return { ...prev, [placa]: [...ctesAtuais, ...ctesUnicos] };
    });
    
    toast.success(`${novosCtes.length} CT-e(s) adicionados ao planejamento do carregamento ${placa}.`);
    setHubAberto(false);
  };

  const iniciarImportacao = () => {
    if (data && data.carregamentos.length > 0) {
        setModalConfirmacaoAberto(true);
    } else {
        handleImportarCarregamentos(false); // Se não há carregamentos, não precisa perguntar
    }
  };

  const handleImportarCarregamentos = async (sobrescrever: boolean) => {
    setModalConfirmacaoAberto(false);
    toast.info(`Iniciando importação de carregamentos do SSW... (Sobrescrever: ${sobrescrever ? 'Sim' : 'Não'})`);
    // A lógica completa será implementada em uma tarefa futura
  };

  const handleAbrirHub = (carregamento: any) => {
    setCarregamentoParaHub(carregamento);
    setHubAberto(true);
  };

  const handleSalvarCarregamento = async (placa: string) => {
    const carregamento = data.carregamentos.find((c: any) => c.placa === placa);
    if (!carregamento) {
      toast.error('Carregamento não encontrado.');
      return;
    }

    setLoading(true);
    try {
      const ctesOriginais = carregamento.ctes;
      const ctesExtras = ctesDoHub[placa] || [];

      const response = await apiFetch(
        'dashboards/disponiveis/salvar_carregamento.php',
        {
          method: 'POST',
          body: JSON.stringify({
            placa: carregamento.placa,
            ctes: ctesOriginais, // CT-es que já estavam no carregamento
            ctes_hub: ctesExtras, // CT-es novos, vindos do hub
            unidade: unidadeSelecionada,
          }),
        }
      );

      if (response.status === 'success') {
        toast.success(response.message);
        setCtesDoHub(prev => { // Limpa os ctes do hub para este carregamento
            const nextState = { ...prev };
            delete nextState[placa];
            return nextState;
        });
        fetchData(unidadeSelecionada); // Atualiza a tela
      } else {
        throw new Error(response.message);
      }
    } catch (e: any) {
      toast.error(`Falha ao salvar carregamento: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCarregamentoModal = (placa: string) => {
    const veiculo = data.disponiveis.find((v: any) => v.placa === placa);
    if (veiculo) {
      setVeiculoParaCarregamento(veiculo);
      setPlacaParaCarregamento(placa);
      setModalCarregamentoAberto(true);
    }
  };

  const handleGerarCarregamentoAutomatico = async (placa: string) => {
    setLoading(true);
    toast.info(`Gerando carregamento automático para a placa ${placa}...`);

    try {
      const response = await apiFetch(
        'dashboards/disponiveis/gerar_carregamento_automatico.php',
        {
          method: 'POST',
          body: JSON.stringify({ placa: placa, unidade: unidadeSelecionada }),
        }
      );

      if (response.status === 'success') {
        toast.success(response.message);
        setModalCarregamentoAberto(false);
        fetchData(unidadeSelecionada);
      } else {
        throw new Error(response.message);
      }
    } catch (e: any) {
      toast.error(`Falha ao gerar carregamento automático: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = data
    ? {
        ...data,
        em_transito: data.em_transito.filter(
          (item: any) =>
            item.manifesto.includes(manifestoFilter.toUpperCase()) &&
            item.placa.includes(placaFilter.toUpperCase())
        ),
      }
    : null;

  const ProgressIndicator = ({ value, max }: { value: number; max: number }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    let bgColor = 'bg-green-500';
    if (percentage > 70) bgColor = 'bg-yellow-500';
    if (percentage > 90) bgColor = 'bg-red-500';

    return (
      <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2.5">
        <div
          className={`${bgColor} h-2.5 rounded-full`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    );
  };
  
    // Componente de Paginação foi removido para simplificar e focar na funcionalidade principal
    // O código original pode ser reinserido aqui se necessário.

  if (loading && !data) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-full">
           <p className="text-lg animate-pulse" dangerouslySetInnerHTML={{ __html: 'Carregando...<br>Essa operação pode levar alguns segundos.' }}></p>
        </div>
      </DashboardLayout>
    );
  }

  if (unidadePodeCarregar === false) {
    return (
       <DashboardLayout>
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">Disponíveis e em Trânsito</h1>
          <div className="flex items-center space-x-4 mb-4">
            <label htmlFor="unidade">Unidade:</label>
            <select
                id="unidade"
                value={unidadeSelecionada}
                onChange={e => setUnidadeSelecionada(e.target.value)}
                className="border rounded px-2 py-1 bg-white dark:bg-slate-800"
            >
                {unidades.map(u => (<option key={u.sigla} value={u.sigla}>{u.sigla}</option>))}
            </select>
          </div>
           <Card className="mt-6 bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700">
                <CardHeader>
                    <CardTitle className="text-yellow-800 dark:text-yellow-200">Acesso Bloqueado</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-yellow-700 dark:text-yellow-300">A unidade <strong>{unidadeSelecionada}</strong> não está configurada para efetuar carregamentos. Verifique o cadastro de unidades.</p>
                </CardContent>
            </Card>
        </div>
      </DashboardLayout>
    );
  }

   if (error) {
    return (
      <DashboardLayout>
        <div className="p-4 text-red-500">Erro: {error}</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="relative p-4">
        {loading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-black/50 z-10 flex justify-center items-center">
            <RefreshCw className="animate-spin h-8 w-8 text-blue-500" />
          </div>
        )}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">Disponíveis e em Trânsito</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <input type="checkbox" id="autoRefresh" checked={autoRefresh} onChange={() => setAutoRefresh(!autoRefresh)} />
            <label htmlFor="autoRefresh">Atualização automática</label>
            <span>(próxima em {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')})</span>
            <RefreshCw className="cursor-pointer" onClick={handleRefresh} />
          </div>
        </div>
        <div className="flex items-center space-x-4 mb-4">
          <FilterIcon className="cursor-pointer" onClick={() => setShowFilter(!showFilter)} />
          <div className="flex items-center space-x-2">
            <label htmlFor="unidade">Unidade:</label>
            <select
              id="unidade"
              value={unidadeSelecionada}
              onChange={e => setUnidadeSelecionada(e.target.value)}
              className="border rounded px-2 py-1 bg-white dark:bg-slate-800"
            >
              {unidades.map(u => (<option key={u.sigla} value={u.sigla}>{u.sigla}</option>))}
            </select>
          </div>
          <Button
            variant="outline"
            onClick={iniciarImportacao}
            disabled={importando}
          >
            {importando ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <DownloadCloud className="mr-2 h-4 w-4" />} 
            {importando ? 'Importando...' : 'Importar do SSW'}
          </Button>
          <span>Última atualização: {lastUpdate.toLocaleTimeString()}</span>
        </div>
        <Filter isOpen={showFilter} onClose={() => setShowFilter(false)}>
          <div className="p-4">
            <h2 className="text-lg font-bold mb-2">Filtros (Em Trânsito)</h2>
            <Input placeholder="Filtrar por manifesto..." value={manifestoFilter} onChange={e => setManifestoFilter(e.target.value)} className="mb-2" />
            <Input placeholder="Filtrar por placa..." value={placaFilter} onChange={e => setPlacaFilter(e.target.value)} />
          </div>
        </Filter>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Coluna Em Trânsito */}
          <div className="md:col-span-1">
            <h2 className="text-xl font-semibold mb-2">Em Trânsito</h2>
            <div className="space-y-4">
              {filteredData && filteredData.em_transito.length > 0 ? (
                filteredData.em_transito.map((item: any, index: number) => (
                    <Card key={index} className="w-full">
                        <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            <div className='flex flex-row items-center'> <Truck className="mr-2" /> {item.placa} - <span className='ml-1 font-light'>{item.motorista}</span> </div>
                            <Badge>{item.manifesto}</Badge>
                        </CardTitle>
                        </CardHeader>
                        <CardContent>
                        <div className="flex justify-between text-sm"><span>Saída:</span><span>{item.data_saida}</span></div>
                        <div className="flex justify-between text-sm"><span>Unidade Destino:</span><span>{item.unidade_destino}</span></div>
                        <div className="flex justify-between text-sm"><span>Previsão de Chegada:</span><span>{item.previsao_chegada}</span></div>
                        <div className="flex justify-between text-sm font-bold mt-2"><div className='flex flex-row gap-1 items-center'><Package size={16} /> Volumes:</div><span>{item.volumes}</span></div>
                        <div className="flex justify-between text-sm font-bold"><div className='flex flex-row gap-1 items-center'><Archive size={16} /> Peso:</div><span>{parseFloat(item.peso).toFixed(2)} kg</span></div>
                        </CardContent>
                        <CardFooter>
                            <a href={item.link_ssw} target="_blank" rel="noopener noreferrer" className="w-full">
                                <Button variant='outline' className='w-full'><Send className="mr-2 h-4 w-4" /> Acompanhar no SSW</Button>
                            </a>
                        </CardFooter>
                    </Card>
                ))
              ) : (<p>Nenhum veículo em trânsito.</p>)}
            </div>
          </div>

          {/* Coluna Disponíveis */}
          <div className="md:col-span-1">
            <h2 className="text-xl font-semibold mb-2">Disponíveis</h2>
            <div className="space-y-4">
              {data && data.disponiveis.length > 0 ? (
                 data.disponiveis.map((item: any, index: number) => (
                   <Card key={index} className="w-full">
                     <CardHeader><CardTitle className="flex justify-between items-center"><div className='flex flex-row items-center'><Bus className="mr-2" /> {item.placa}</div></CardTitle></CardHeader>
                     <CardContent>
                       <p className="text-sm">Modelo: {item.modelo}</p>
                       <div className="flex justify-between text-sm font-bold mt-2"><span>Capacidade (V):</span><span>{item.capacidade_vol}</span></div>
                       <div className="flex justify-between text-sm font-bold"><span>Capacidade (P):</span><span>{parseFloat(item.capacidade_kg).toFixed(2)} kg</span></div>
                     </CardContent>
                     <CardFooter><Button className='w-full' onClick={() => handleOpenCarregamentoModal(item.placa)}><PlusCircle className="mr-2 h-4 w-4" /> Criar Carregamento</Button></CardFooter>
                   </Card>
                 ))
              ) : (<p>Nenhum veículo disponível.</p>)}
            </div>
          </div>

          {/* Coluna Carregamentos */}
          <div className="md:col-span-1">
            <h2 className="text-xl font-semibold mb-2">Carregamentos</h2>
            <div className="space-y-4">
              {data && data.carregamentos.length > 0 ? (
                data.carregamentos.map((carregamento: any, index: number) => {
                  const ctesExtras = ctesDoHub[carregamento.placa] || [];
                  const pesoExtras = ctesExtras.reduce((acc: number, cte: any) => acc + parseFloat(cte.peso || 0), 0);
                  const volumeExtras = ctesExtras.reduce((acc: number, cte: any) => acc + parseInt(cte.volumes || 0), 0);
                  
                  const pesoTotal = parseFloat(carregamento.peso_total_carregado) + pesoExtras;
                  const volumeTotal = parseInt(carregamento.volumes_total_carregado) + volumeExtras;
                  
                  const ctesOriginaisFormatados = carregamento.ctes.map((c: any) => ({ ...c, destinatario: c.destinatario_cte, volumes: c.volumes_cte, peso: c.peso_cte }));
                  const todosOsCtes = [...ctesOriginaisFormatados, ...ctesExtras];

                  return(
                  <Card key={index} className="w-full bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                    <CardHeader><CardTitle className="flex justify-between items-center"><div className='flex flex-row items-center'><Truck className="mr-2" /> {carregamento.placa}</div></CardTitle></CardHeader>
                    <CardContent>
                        <div className="mb-2">
                        <div className="flex justify-between text-sm font-bold"><span>Peso:</span><span>{pesoTotal.toFixed(2)} kg / {carregamento.capacidade_kg} kg</span></div>
                        <ProgressIndicator value={pesoTotal} max={parseFloat(carregamento.capacidade_kg)} />
                        </div>
                        <div>
                        <div className="flex justify-between text-sm font-bold"><span>Volumes:</span><span>{volumeTotal} / {carregamento.capacidade_vol}</span></div>
                        <ProgressIndicator value={volumeTotal} max={parseInt(carregamento.capacidade_vol)} />
                        </div>

                      <div className="mt-4 pt-2 border-t">
                        <p className="font-bold mb-1">{todosOsCtes.length} CT-es no planejamento:</p>
                         <div className="max-h-24 overflow-y-auto text-xs space-y-1 pr-1">
                           {todosOsCtes.map((cte: any, i:number) => (
                            <div key={i} className={`p-1 rounded ${cte.unidade_origem_hub ? 'bg-yellow-100 dark:bg-yellow-900' : ''}`}>
                              {cte.unidade_origem_hub && <strong className='font-mono'>[HUB: {cte.unidade_origem_hub}]</strong>} {cte.destinatario} ({cte.volumes}v, {cte.peso}kg)
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex-col space-y-2">
                       <Button className='w-full' variant='outline' onClick={() => handleAbrirHub(carregamento)}><Search className="mr-2 h-4 w-4" /> Buscar Cargas Compartilhadas</Button>
                       <Button className='w-full' onClick={() => handleSalvarCarregamento(carregamento.placa)}><ArrowRight className="mr-2 h-4 w-4" /> Manifestar Carregamento</Button>
                    </CardFooter>
                  </Card>
                 )})
              ) : (<p>Nenhum carregamento em andamento.</p>)}
            </div>
          </div>
        </div>
      </div>

       {modalCarregamentoAberto && veiculoParaCarregamento && (
         <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setModalCarregamentoAberto(false)}>
            <div className="fixed inset-y-0 right-0 bg-white dark:bg-slate-900 w-full max-w-md shadow-lg p-6" onClick={e => e.stopPropagation()}>
               <h2 className="text-xl font-bold mb-4">Criar Carregamento para {placaParaCarregamento}</h2>
                <p className="mb-4">Você pode gerar um carregamento automaticamente com base nos CT-es disponíveis ou iniciar um carregamento vazio para adicionar itens manualmente.</p>
                <div className="flex flex-col space-y-4">
                <Button onClick={() => handleGerarCarregamentoAutomatico(placaParaCarregamento)}><RefreshCw className="mr-2 h-4 w-4" /> Gerar Carregamento Automático</Button>
                <Button variant="outline" disabled > <PlusCircle className="mr-2 h-4 w-4" /> Iniciar Carregamento Vazio (em breve)</Button>
                </div>
            </div>
         </div>
      )}

      {hubAberto && carregamentoParaHub && (
        <HubCargasCompartilhadas 
            carregamento={carregamentoParaHub}
            onClose={() => setHubAberto(false)}
            onAddCtes={handleAdicionarCtesDoHub}
        />
      )}

      <ConfirmacaoModal
        isOpen={modalConfirmacaoAberto}
        onClose={() => setModalConfirmacaoAberto(false)}
        onConfirm={() => handleImportarCarregamentos(true)}
        title="Sobrescrever Carregamentos?"
      >
        <p>Já existem carregamentos em andamento. Deseja sobrescrevê-los com os dados importados do SSW para as placas correspondentes?</p>
        <p className="mt-2 font-semibold">Se você escolher "Não", apenas os carregamentos para placas que não estão atualmente na tela serão importados.</p>
      </ConfirmacaoModal>

    </DashboardLayout>
  );
}