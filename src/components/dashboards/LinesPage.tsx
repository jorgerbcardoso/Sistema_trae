import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { MapPin, Route, TrendingUp, Clock, Activity, Compass } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';

// Declaração do Leaflet global
declare global {
  interface Window {
    L: any;
  }
}

interface City {
  name: string;
  lat: number;
  lng: number;
}

interface Line {
  id: string;
  name: string;
  type: 'CARGAS' | 'PASSAGEIROS';
  cities: City[];
  distance: number;
  estimatedTime: string;
  trips: number;
  revenue: number;
  cost: number;
  weight?: number; // Apenas para CARGAS
  passengers?: number; // Apenas para PASSAGEIROS
}

// Cores por tipo
const TYPE_COLORS = {
  CARGAS: '#f97316', // laranja
  PASSAGEIROS: '#3b82f6', // azul
};

// Linhas de Cargas
const cargasLines: Line[] = [
  {
    id: 'c1',
    name: 'São Paulo - Rio de Janeiro',
    type: 'CARGAS',
    cities: [
      { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
      { name: 'São José dos Campos', lat: -23.1791, lng: -45.8872 },
      { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 }
    ],
    distance: 429,
    estimatedTime: '6h 30min',
    trips: 145,
    revenue: 1250000,
    cost: 820000,
    weight: 2175000
  },
  {
    id: 'c2',
    name: 'São Paulo - Belo Horizonte',
    type: 'CARGAS',
    cities: [
      { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
      { name: 'Campinas', lat: -22.9099, lng: -47.0626 },
      { name: 'Ribeirão Preto', lat: -21.1704, lng: -47.8103 },
      { name: 'Belo Horizonte', lat: -19.9167, lng: -43.9345 }
    ],
    distance: 586,
    estimatedTime: '8h 45min',
    trips: 98,
    revenue: 875000,
    cost: 595000,
    weight: 1470000
  },
  {
    id: 'c3',
    name: 'São Paulo - Curitiba',
    type: 'CARGAS',
    cities: [
      { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
      { name: 'Registro', lat: -24.4886, lng: -47.8431 },
      { name: 'Curitiba', lat: -25.4290, lng: -49.2671 }
    ],
    distance: 408,
    estimatedTime: '6h 15min',
    trips: 112,
    revenue: 685000,
    cost: 458000,
    weight: 1344000
  },
  {
    id: 'c4',
    name: 'Rio de Janeiro - Belo Horizonte',
    type: 'CARGAS',
    cities: [
      { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
      { name: 'Juiz de Fora', lat: -21.7642, lng: -43.3502 },
      { name: 'Belo Horizonte', lat: -19.9167, lng: -43.9345 }
    ],
    distance: 434,
    estimatedTime: '6h 45min',
    trips: 87,
    revenue: 520000,
    cost: 358000,
    weight: 1044000
  },
  {
    id: 'c5',
    name: 'Curitiba - Florianópolis',
    type: 'CARGAS',
    cities: [
      { name: 'Curitiba', lat: -25.4290, lng: -49.2671 },
      { name: 'Joinville', lat: -26.3045, lng: -48.8487 },
      { name: 'Florianópolis', lat: -27.5954, lng: -48.5480 }
    ],
    distance: 300,
    estimatedTime: '4h 30min',
    trips: 76,
    revenue: 385000,
    cost: 265000,
    weight: 912000
  }
];

// Linhas de Passageiros
const passageirosLines: Line[] = [
  {
    id: 'p1',
    name: 'São Paulo - Santos',
    type: 'PASSAGEIROS',
    cities: [
      { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
      { name: 'São Bernardo do Campo', lat: -23.6914, lng: -46.5646 },
      { name: 'Cubatão', lat: -23.8951, lng: -46.4251 },
      { name: 'Santos', lat: -23.9608, lng: -46.3335 }
    ],
    distance: 72,
    estimatedTime: '1h 30min',
    trips: 245,
    revenue: 420000,
    cost: 285000,
    passengers: 12250
  },
  {
    id: 'p2',
    name: 'São Paulo - Campinas',
    type: 'PASSAGEIROS',
    cities: [
      { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
      { name: 'Jundiaí', lat: -23.1864, lng: -46.8842 },
      { name: 'Campinas', lat: -22.9099, lng: -47.0626 }
    ],
    distance: 96,
    estimatedTime: '1h 45min',
    trips: 198,
    revenue: 385000,
    cost: 252000,
    passengers: 9900
  },
  {
    id: 'p3',
    name: 'Curitiba - Joinville',
    type: 'PASSAGEIROS',
    cities: [
      { name: 'Curitiba', lat: -25.4290, lng: -49.2671 },
      { name: 'Morretes', lat: -25.4745, lng: -48.8328 },
      { name: 'Joinville', lat: -26.3045, lng: -48.8487 }
    ],
    distance: 132,
    estimatedTime: '2h 15min',
    trips: 156,
    revenue: 315000,
    cost: 218000,
    passengers: 7800
  },
  {
    id: 'p4',
    name: 'Rio de Janeiro - Petrópolis',
    type: 'PASSAGEIROS',
    cities: [
      { name: 'Rio de Janeiro', lat: -22.9068, lng: -43.1729 },
      { name: 'Duque de Caxias', lat: -22.7858, lng: -43.3054 },
      { name: 'Petrópolis', lat: -22.5050, lng: -43.1789 }
    ],
    distance: 68,
    estimatedTime: '1h 20min',
    trips: 187,
    revenue: 295000,
    cost: 195000,
    passengers: 9350
  }
];

// Todas as linhas
const allLines = [...cargasLines, ...passageirosLines];

interface LinesPageProps {
  viewMode: 'GERAL' | 'CARGAS' | 'PASSAGEIROS';
  domainModalidade: 'CARGAS' | 'PASSAGEIROS' | 'MISTA';
  period?: any;
  controlaLinhas: boolean;
}

export function LinesPage({ viewMode = 'GERAL', domainModalidade = 'CARGAS', period, controlaLinhas }: LinesPageProps) {
  // TODO: Quando implementar API real, usar:
  // import { periodToQueryParams } from '../../utils/periodUtils';
  // const params = periodToQueryParams(period);
  // const { data } = useApiGet('/financeiro/linhas', { params });
  
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Filtrar linhas baseado no viewMode
  const availableLines = viewMode === 'GERAL' 
    ? allLines 
    : viewMode === 'CARGAS'
    ? cargasLines
    : passageirosLines;
    
  const displayLines = availableLines;

  // Carregar Leaflet via CDN
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Verificar se já está carregado
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // Carregar CSS
    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Carregar JS
    const scriptId = 'leaflet-js';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.integrity = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';
      script.crossOrigin = '';
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // Quando mudar o segmento, selecionar automaticamente a primeira linha do novo segmento
    if (availableLines.length > 0) {
      setSelectedLineId(availableLines[0].id);
    }
  }, []); // Executa apenas uma vez na montagem do componente

  const selectedLine = availableLines.find(l => l.id === selectedLineId);

  // Buscar rota seguindo rodovias usando OSRM
  useEffect(() => {
    if (!selectedLine) return;

    const fetchRoute = async () => {
      try {
        // Construir coordenadas para OSRM
        const coords = selectedLine.cities
          .map(c => `${c.lng},${c.lat}`)
          .join(';');
        
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.code === 'Ok' && data.routes && data.routes[0]) {
          const routeGeometry = data.routes[0].geometry.coordinates;
          // Converter de [lng, lat] para [lat, lng]
          const route = routeGeometry.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
          setRouteCoordinates(route);
        } else {
          // Fallback: usar linha reta entre cidades
          setRouteCoordinates(selectedLine.cities.map(c => [c.lat, c.lng]));
        }
      } catch (error) {
        console.error('Erro ao buscar rota:', error);
        // Fallback: usar linha reta entre cidades
        setRouteCoordinates(selectedLine.cities.map(c => [c.lat, c.lng]));
      }
    };

    fetchRoute();
  }, [selectedLine]);

  // Criar/atualizar mapa
  useEffect(() => {
    if (!leafletLoaded || !selectedLine || !mapContainerRef.current || !window.L || routeCoordinates.length === 0) return;

    // Limpar mapa anterior
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Criar novo mapa
    const L = window.L;
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
    }).setView(
      [selectedLine.cities[0].lat, selectedLine.cities[0].lng],
      7
    );

    // Forçar z-index baixo nos elementos do Leaflet
    mapContainerRef.current.style.zIndex = '1';

    mapRef.current = map;

    // Adicionar tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const lineColor = TYPE_COLORS[selectedLine.type];

    // Criar ícones em formato de pin
    const createPinIcon = (number: number, color: string) => {
      return L.divIcon({
        className: 'custom-pin-icon',
        html: `
          <div style="position: relative; width: 30px; height: 40px;">
            <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="shadow-${number}" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
                </filter>
              </defs>
              <path d="M15 0C8.373 0 3 5.373 3 12c0 9 12 28 12 28s12-19 12-28c0-6.627-5.373-12-12-12z" 
                    fill="${color}" 
                    stroke="white" 
                    stroke-width="2"
                    filter="url(#shadow-${number})"/>
              <circle cx="15" cy="12" r="7" fill="white"/>
              <text x="15" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="${color}">${number}</text>
            </svg>
          </div>
        `,
        iconSize: [30, 40],
        iconAnchor: [15, 40],
        popupAnchor: [0, -40],
      });
    };

    // Adicionar marcadores
    selectedLine.cities.forEach((city, index) => {
      const isFirstOrLast = index === 0 || index === selectedLine.cities.length - 1;
      const markerColor = isFirstOrLast ? lineColor : '#9ca3af'; // cinza para intermediárias
      
      const marker = L.marker([city.lat, city.lng], {
        icon: createPinIcon(index + 1, markerColor),
        title: city.name, // Tooltip nativo do navegador no hover
      }).addTo(map);
      marker.bindPopup(`<strong>Parada ${index + 1}</strong><br/>${city.name}`);
    });

    // Adicionar rota
    L.polyline(routeCoordinates, {
      color: lineColor,
      weight: 4,
      opacity: 0.7,
    }).addTo(map);

    // Ajustar bounds
    const bounds = L.latLngBounds(selectedLine.cities.map(c => [c.lat, c.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [leafletLoaded, selectedLine, routeCoordinates]);

  const totalLines = displayLines.length;
  const totalRevenue = displayLines.reduce((sum, l) => sum + l.revenue, 0);
  const totalCost = displayLines.reduce((sum, l) => sum + l.cost, 0);
  const totalProfit = totalRevenue - totalCost;
  const avgMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Análise de Linhas</h2>
        <p className="text-slate-500 dark:text-slate-400">Performance e rentabilidade das rotas</p>
      </div>

      {/* Seletor de Linha - sem Card, apenas título e select */}
      <div>
        <h3 className="text-slate-900 dark:text-slate-100 mb-3">Selecione a Linha</h3>
        <Select value={selectedLineId} onValueChange={setSelectedLineId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma linha" />
          </SelectTrigger>
          <SelectContent>
            {availableLines.map((line) => (
              <SelectItem key={line.id} value={line.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: TYPE_COLORS[line.type] }}
                  />
                  <span>{line.name} - {line.type}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedLine && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Mapa da Rota */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Compass className="w-5 h-5" />
                  Mapa da Linha - {selectedLine.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div 
                  ref={mapContainerRef}
                  className="h-[400px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 relative"
                  style={{ zIndex: 1 }}
                >
                  {!leafletLoaded && (
                    <div className="h-full flex items-center justify-center text-slate-500">
                      Carregando mapa...
                    </div>
                  )}
                </div>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-700 dark:text-blue-300" />
                      <span className="text-blue-900 dark:text-blue-100">Viagens no Período</span>
                    </div>
                    <span className="text-blue-900 dark:text-blue-100">{selectedLine.trips} viagens</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cidades da Rota */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Cidades da Rota
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedLine.cities.map((city, index) => {
                    const isFirstOrLast = index === 0 || index === selectedLine.cities.length - 1;
                    const bgColor = isFirstOrLast ? 'bg-orange-600' : 'bg-gray-400';
                    
                    return (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
                      >
                        <div className={`flex items-center justify-center w-8 h-8 ${bgColor} text-white rounded-full flex-shrink-0`}>
                          {index + 1}
                        </div>
                        <span className="text-slate-900 dark:text-slate-100">{city.name}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700 dark:text-slate-300">Distância Total</span>
                    <span className="text-slate-900 dark:text-slate-100">{selectedLine.distance} km</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                      <span className="text-slate-700 dark:text-slate-300">Tempo Estimado</span>
                    </div>
                    <span className="text-slate-900 dark:text-slate-100">{selectedLine.estimatedTime}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Indicadores Absolutos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Indicadores de Performance da Linha {selectedLine.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedLine.type === 'CARGAS' ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                  <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="mb-2">
                      <span className="text-xs text-purple-700 dark:text-purple-300">Peso Total</span>
                    </div>
                    <div className="text-purple-900 dark:text-purple-100">
                      {((selectedLine.weight || 0) / 1000).toLocaleString()} ton
                    </div>
                  </div>
                  
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <div className="mb-2">
                      <span className="text-xs text-indigo-700 dark:text-indigo-300">Km Total Rodado</span>
                    </div>
                    <div className="text-indigo-900 dark:text-indigo-100">
                      {(selectedLine.distance * selectedLine.trips).toLocaleString()} km
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="mb-2">
                      <span className="text-xs text-blue-700 dark:text-blue-300">Frete por Kg</span>
                    </div>
                    <div className="text-blue-900 dark:text-blue-100">
                      R$ {(selectedLine.revenue / (selectedLine.weight || 1)).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="mb-2">
                      <span className="text-xs text-orange-700 dark:text-orange-300">Custo por Kg</span>
                    </div>
                    <div className="text-orange-900 dark:text-orange-100">
                      R$ {(selectedLine.cost / (selectedLine.weight || 1)).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="mb-2">
                      <span className="text-xs text-green-700 dark:text-green-300">Lucro no Período</span>
                    </div>
                    <div className="text-green-900 dark:text-green-100">
                      R$ {(selectedLine.revenue - selectedLine.cost).toLocaleString()}
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="mb-2">
                      <span className="text-xs text-emerald-700 dark:text-emerald-300">Margem de Lucro</span>
                    </div>
                    <div className="text-emerald-900 dark:text-emerald-100">
                      {((selectedLine.revenue - selectedLine.cost) / selectedLine.revenue * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
                  <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="mb-2">
                      <span className="text-xs text-purple-700 dark:text-purple-300">Passageiros</span>
                    </div>
                    <div className="text-purple-900 dark:text-purple-100">
                      {(selectedLine.passengers || 0).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="p-4 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    <div className="mb-2">
                      <span className="text-xs text-indigo-700 dark:text-indigo-300">Km Total Rodado</span>
                    </div>
                    <div className="text-indigo-900 dark:text-indigo-100">
                      {(selectedLine.distance * selectedLine.trips).toLocaleString()} km
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="mb-2">
                      <span className="text-xs text-blue-700 dark:text-blue-300">Receita por Passag.</span>
                    </div>
                    <div className="text-blue-900 dark:text-blue-100">
                      R$ {(selectedLine.revenue / (selectedLine.passengers || 1)).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="mb-2">
                      <span className="text-xs text-orange-700 dark:text-orange-300">Custo por Passag.</span>
                    </div>
                    <div className="text-orange-900 dark:text-orange-100">
                      R$ {(selectedLine.cost / (selectedLine.passengers || 1)).toFixed(2)}
                    </div>
                  </div>

                  <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="mb-2">
                      <span className="text-xs text-green-700 dark:text-green-300">Lucro no Período</span>
                    </div>
                    <div className="text-green-900 dark:text-green-100">
                      R$ {(selectedLine.revenue - selectedLine.cost).toLocaleString()}
                    </div>
                  </div>

                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <div className="mb-2">
                      <span className="text-xs text-emerald-700 dark:text-emerald-300">Margem de Lucro</span>
                    </div>
                    <div className="text-emerald-900 dark:text-emerald-100">
                      {((selectedLine.revenue - selectedLine.cost) / selectedLine.revenue * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Tabela de Todas as Linhas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="w-5 h-5" />
            Resumo de Todas as Linhas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-4 text-slate-700 dark:text-slate-300">Linha</th>
                  <th className="text-center py-3 px-4 text-slate-700 dark:text-slate-300">Tipo</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Distância</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Viagens</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Receita</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Custo</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Lucro</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">Margem</th>
                  <th className="text-right py-3 px-4 text-slate-700 dark:text-slate-300">R$/Km</th>
                </tr>
              </thead>
              <tbody>
                {displayLines.map((line) => {
                  const profit = line.revenue - line.cost;
                  const margin = (profit / line.revenue * 100).toFixed(1);
                  const revenuePerKm = (line.revenue / line.distance).toFixed(2);
                  
                  return (
                    <tr 
                      key={line.id} 
                      onClick={() => setSelectedLineId(line.id)}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${
                        selectedLineId === line.id ? 'bg-slate-100 dark:bg-slate-800' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-slate-900 dark:text-slate-100">{line.name}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: TYPE_COLORS[line.type] }}
                          />
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            {line.type}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{line.distance} km</td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">{line.trips}</td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">R$ {line.revenue.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-red-600 dark:text-red-400">R$ {line.cost.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-green-600 dark:text-green-400">R$ {profit.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-slate-900 dark:text-slate-100">{margin}%</td>
                      <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300">R$ {revenuePerKm}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totalizadores */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total de Linhas</div>
                <div className="text-slate-900 dark:text-slate-100">{totalLines}</div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">Receita Total</div>
                <div className="text-blue-900 dark:text-blue-100">R$ {totalRevenue.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-sm text-red-700 dark:text-red-300 mb-1">Custo Total</div>
                <div className="text-red-900 dark:text-red-100">R$ {totalCost.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-sm text-green-700 dark:text-green-300 mb-1">Lucro Total</div>
                <div className="text-green-900 dark:text-green-100">R$ {totalProfit.toLocaleString()}</div>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950 rounded-lg">
                <div className="text-sm text-emerald-700 dark:text-emerald-300 mb-1">Margem Média</div>
                <div className="text-emerald-900 dark:text-emerald-100">{avgMargin}%</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}