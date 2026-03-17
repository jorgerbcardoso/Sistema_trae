import { useState, useEffect } from 'react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Plus, Edit, Trash2, Loader2, MapPin, Map, List, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { FilterSelectEstoque } from '../shared/FilterSelectEstoque';
import { FilterSelectItem } from './FilterSelectItem';
import { FilterSelectTipoItem } from './FilterSelectTipoItem';
import { MOCK_POSICOES, MOCK_ESTOQUES, MOCK_ITENS } from '../../utils/estoqueModData'; // 🆕 IMPORTAR MOCKS
import { SortableTableHeader, useSortableTable } from '../table/SortableTableHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface Posicao {
  seq_posicao: number;
  seq_estoque: number;
  seq_item: number | null;
  rua: string;
  altura: string;
  coluna: string;
  saldo: number;
  ativa: string;
  estoque_descricao: string;
  nro_estoque: string;
  unidade: string;
  item_codigo: string | null;
  item_descricao: string | null;
}

interface FormData {
  seq_posicao?: number;
  seq_estoque: string;
  rua: string;
  altura: string;
  coluna: string;
  seq_item: string;
  saldo: string;
}

export function CadastroPosicoes() {
  usePageTitle('Posições de Estoque');

  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [viewMode, setViewMode] = useState<'mapa' | 'lista'>('mapa');
  
  // Filtros
  const [filtroEstoque, setFiltroEstoque] = useState('');
  const [filtroRua, setFiltroRua] = useState('');
  const [filtroColuna, setFiltroColuna] = useState('');
  const [filtroAltura, setFiltroAltura] = useState('');
  const [filtroItem, setFiltroItem] = useState('');
  const [filtroTipoItem, setFiltroTipoItem] = useState('');

  const [formData, setFormData] = useState<FormData>({
    seq_estoque: '',
    rua: '',
    altura: '',
    coluna: '',
    seq_item: '',
    saldo: '0'
  });

  // ✅ Hook de ordenação
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<
    'ativa' | 'unidade' | 'rua' | 'altura' | 'coluna' | 'item_codigo' | 'saldo'
  >('rua', 'asc');

  useEffect(() => {
    // ✅ CORRIGIDO: Só carregar posições se houver estoque selecionado
    if (filtroEstoque) {
      carregarPosicoes();
    } else {
      // Limpar lista se não houver estoque selecionado
      setPosicoes([]);
    }
  }, [filtroEstoque, filtroRua, filtroColuna, filtroAltura, filtroItem, filtroTipoItem]);

  const carregarPosicoes = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // 🆕 USAR MOCK NO FIGMA MAKE
        await new Promise(resolve => setTimeout(resolve, 300));
        
        let posicoesFiltradas = MOCK_POSICOES.map(p => {
          const estoque = MOCK_ESTOQUES.find(e => e.seq_estoque === p.seq_estoque);
          const item = p.seq_item ? MOCK_ITENS.find(i => i.seq_item === p.seq_item) : null;
          
          return {
            seq_posicao: p.seq_posicao,
            seq_estoque: p.seq_estoque,
            seq_item: p.seq_item,
            rua: p.rua,
            altura: p.altura,
            coluna: p.coluna,
            saldo: p.saldo,
            ativa: p.ativa,
            estoque_descricao: estoque?.descricao || '',
            nro_estoque: estoque?.nro_estoque || '',
            unidade: estoque?.unidade || '',
            item_codigo: item?.codigo || null,
            item_descricao: item?.descricao || null
          };
        });
        
        // Aplicar filtros
        if (filtroEstoque) {
          posicoesFiltradas = posicoesFiltradas.filter(p => p.seq_estoque === parseInt(filtroEstoque));
        }
        if (filtroRua) {
          posicoesFiltradas = posicoesFiltradas.filter(p => p.rua.toLowerCase().includes(filtroRua.toLowerCase()));
        }
        if (filtroColuna) {
          posicoesFiltradas = posicoesFiltradas.filter(p => p.coluna.toLowerCase().includes(filtroColuna.toLowerCase()));
        }
        if (filtroAltura) {
          posicoesFiltradas = posicoesFiltradas.filter(p => p.altura.toLowerCase().includes(filtroAltura.toLowerCase()));
        }
        if (filtroItem) {
          posicoesFiltradas = posicoesFiltradas.filter(p => p.seq_item === parseInt(filtroItem));
        }
        if (filtroTipoItem) {
          const itensDoTipo = MOCK_ITENS.filter(i => i.seq_tipo_item === parseInt(filtroTipoItem)).map(i => i.seq_item);
          posicoesFiltradas = posicoesFiltradas.filter(p => p.seq_item && itensDoTipo.includes(p.seq_item));
        }
        
        setPosicoes(posicoesFiltradas);
      } else {
        // BACKEND REAL - ✅ PASSAR FILTROS VIA QUERY STRING
        const params = new URLSearchParams();
        if (filtroEstoque) params.append('seq_estoque', filtroEstoque);
        if (filtroRua) params.append('rua', filtroRua);
        if (filtroColuna) params.append('coluna', filtroColuna);
        if (filtroAltura) params.append('altura', filtroAltura);
        if (filtroItem) params.append('seq_item', filtroItem);
        if (filtroTipoItem) params.append('seq_tipo_item', filtroTipoItem);

        const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
            'X-Unidade': sessionStorage.getItem('unidade') || ''
          }
        });

        const data = await response.json();

        if (data.success) {
          setPosicoes(data.data || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar posições:', error);
      toast.error('Erro ao carregar posições');
    } finally {
      setLoading(false);
    }
  };

  const abrirDialogNovo = () => {
    setFormData({
      seq_estoque: filtroEstoque || '',
      rua: filtroRua || '',
      altura: filtroAltura || '',
      coluna: '',
      seq_item: '',
      saldo: '0'
    });
    setEditando(false);
    setDialogOpen(true);
  };

  const abrirDialogEdicao = (posicao: Posicao) => {
    setFormData({
      seq_posicao: posicao.seq_posicao,
      seq_estoque: posicao.seq_estoque.toString(),
      rua: posicao.rua,
      altura: posicao.altura,
      coluna: posicao.coluna,
      seq_item: posicao.seq_item?.toString() || '',
      saldo: posicao.saldo.toString()
    });
    setEditando(true);
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!formData.seq_estoque || !formData.rua || !formData.altura || !formData.coluna) {
      toast.error('Estoque, rua, altura e coluna são obrigatórios');
      return;
    }

    if (!formData.seq_item || formData.seq_item === 'ALL') {
      toast.error('Item é obrigatório');
      return;
    }

    setLoading(true);
    try {
      // ✅ NORMALIZAR ALTURA E COLUNA: remover zeros à esquerda e espaços, garantir número inteiro
      const alturaNormalizada = parseInt(formData.altura.trim(), 10).toString();
      const colunaNormalizada = parseInt(formData.coluna.trim(), 10).toString();

      const payload = {
        seq_posicao: formData.seq_posicao,
        seq_estoque: formData.seq_estoque,
        rua: formData.rua.toUpperCase().trim(),
        altura: alturaNormalizada, // ✅ Sempre número inteiro sem zeros à esquerda
        coluna: colunaNormalizada, // ✅ Sempre número inteiro sem zeros à esquerda
        seq_item: formData.seq_item || null,
        saldo: parseFloat(formData.saldo || '0')
      };

      const url = `${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php`;

      const data = await apiFetch(url, {
        method: editando ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });

      if (data.success) {
        toast.success(editando ? 'Posição atualizada com sucesso!' : 'Posição cadastrada com sucesso!');
        setDialogOpen(false);
        carregarPosicoes();
      }
    } catch (error) {
      console.error('Erro ao salvar posição:', error);
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (seq: number) => {
    if (!confirm('Deseja realmente inativar esta posição?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-Unidade': sessionStorage.getItem('unidade') || ''
        },
        body: JSON.stringify({ 
          _method: 'DELETE',
          seq_posicao: seq 
        })
      });

      if (!response.ok) throw new Error('Erro ao inativar posição');

      toast.success('Posição inativada com sucesso!');
      await carregarPosicoes();
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  const reativar = async (seq: number) => {
    if (!confirm('Deseja realmente reativar esta posição?')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-Unidade': sessionStorage.getItem('unidade') || ''
        },
        body: JSON.stringify({ seq_posicao: seq })
      });

      if (!response.ok) throw new Error('Erro ao reativar posição');

      toast.success('Posição reativada com sucesso!');
      await carregarPosicoes();
    } catch (error) {
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  // Obter opções únicas para os filtros
  const ruasUnicas = Array.from(new Set(posicoes.map(p => p.rua))).sort();
  const colunasUnicas = Array.from(new Set(posicoes.map(p => p.coluna))).sort();
  const alturasUnicas = Array.from(new Set(posicoes.map(p => p.altura))).sort();

  // Organizar posições para o mapa
  const organizarMapa = () => {
    const mapa: { [rua: string]: { [altura: string]: { [coluna: string]: Posicao } } } = {};

    // ✅ Filtrar apenas posições ATIVAS no mapa
    posicoes.filter(pos => pos.ativa === 'S').forEach(pos => {
      if (!mapa[pos.rua]) mapa[pos.rua] = {};
      if (!mapa[pos.rua][pos.altura]) mapa[pos.rua][pos.altura] = {};
      mapa[pos.rua][pos.altura][pos.coluna] = pos;
    });

    return mapa;
  };

  const mapa = organizarMapa();
  const ruas = Object.keys(mapa).sort();

  return (
    <AdminLayout
      title="POSIÇÕES DE ESTOQUE"
      description="Gerenciar localizações físicas no estoque"
    >
      <div className="max-w-[1800px] mx-auto space-y-4">
        {/* Filtros */}
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader>
            <CardTitle className="text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Primeira linha: Estoque, Rua, Coluna, Altura */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="grid gap-2">
                  <FilterSelectEstoque
                    value={filtroEstoque}
                    onChange={setFiltroEstoque}
                    label="Estoque"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Rua</Label>
                  <Input
                    value={filtroRua}
                    onChange={(e) => setFiltroRua(e.target.value)}
                    placeholder="Digite a rua..."
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Coluna</Label>
                  <Input
                    value={filtroColuna}
                    onChange={(e) => setFiltroColuna(e.target.value)}
                    placeholder="Digite a coluna..."
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Altura</Label>
                  <Input
                    value={filtroAltura}
                    onChange={(e) => setFiltroAltura(e.target.value)}
                    placeholder="Digite a altura..."
                    className="dark:bg-slate-800 dark:border-slate-700"
                  />
                </div>
              </div>

              {/* Segunda linha: Tipo de Item e Item (maiores) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <FilterSelectTipoItem
                    value={filtroTipoItem}
                    onChange={setFiltroTipoItem}
                    label="Tipo de Item"
                  />
                </div>

                <div className="grid gap-2">
                  <FilterSelectItem
                    value={filtroItem}
                    onChange={setFiltroItem}
                    label="Item"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Controles */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'mapa' ? 'default' : 'outline'}
              onClick={() => setViewMode('mapa')}
              className={viewMode === 'mapa' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <Map className="h-4 w-4 mr-2" />
              Mapa
            </Button>
            <Button
              variant={viewMode === 'lista' ? 'default' : 'outline'}
              onClick={() => setViewMode('lista')}
              className={viewMode === 'lista' ? 'bg-blue-600 hover:bg-blue-700' : ''}
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
          </div>

          <Button onClick={abrirDialogNovo} className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Nova Posição
          </Button>
        </div>

        {/* Conteúdo */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : !filtroEstoque ? (
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="text-center py-12">
              <MapPin className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <p className="text-slate-600 dark:text-slate-400 font-medium mb-2">Selecione um estoque</p>
              <p className="text-sm text-slate-500 dark:text-slate-500">
                Para visualizar as posições, primeiro selecione um estoque nos filtros acima
              </p>
            </CardContent>
          </Card>
        ) : posicoes.length === 0 ? (
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="text-center py-12">
              <p className="text-slate-500 dark:text-slate-400">Nenhuma posição encontrada para este estoque</p>
              <Button onClick={abrirDialogNovo} className="mt-4 bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeira Posição
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === 'mapa' ? (
          /* MAPA VISUAL DO ESTOQUE */
          <div className="space-y-6">
            {ruas.map(rua => {
              const alturas = Object.keys(mapa[rua]).sort();
              const todasColunas = new Set<string>();
              alturas.forEach(altura => {
                Object.keys(mapa[rua][altura]).forEach(coluna => todasColunas.add(coluna));
              });
              const colunas = Array.from(todasColunas).sort();

              return (
                <Card key={rua} className="dark:bg-slate-900/90 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      RUA {rua}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="border dark:border-slate-700 p-2 bg-slate-100 dark:bg-slate-800 text-sm font-semibold">
                              ALTURA / COLUNA
                            </th>
                            {colunas.map(coluna => (
                              <th key={coluna} className="border dark:border-slate-700 p-2 bg-slate-100 dark:bg-slate-800 text-sm font-semibold">
                                {coluna}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {alturas.map(altura => (
                            <tr key={altura}>
                              <td className="border dark:border-slate-700 p-2 bg-slate-50 dark:bg-slate-800/50 text-sm font-semibold text-center">
                                {altura}
                              </td>
                              {colunas.map(coluna => {
                                const posicao = mapa[rua][altura]?.[coluna];
                                
                                return (
                                  <td
                                    key={coluna}
                                    className="border dark:border-slate-700 p-1 text-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                                    onClick={() => posicao && abrirDialogEdicao(posicao)}
                                  >
                                    {posicao ? (
                                      <div className={`p-2 rounded ${
                                        posicao.saldo > 0
                                          ? 'bg-green-100 dark:bg-green-900/30 border border-green-500'
                                          : 'bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600'
                                      }`}>
                                        {posicao.item_codigo ? (
                                          <>
                                            <div className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100">
                                              {posicao.item_codigo}
                                            </div>
                                            <div className="text-[10px] text-slate-600 dark:text-slate-400 truncate" title={posicao.item_descricao || ''}>
                                              {posicao.item_descricao}
                                            </div>
                                            <div className="text-xs font-bold text-green-700 dark:text-green-400 mt-1">
                                              {posicao.saldo.toFixed(2)}
                                            </div>
                                          </>
                                        ) : (
                                          <div className="text-xs text-slate-400 dark:text-slate-500">VAZIO</div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="text-xs text-slate-300 dark:text-slate-600">-</div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          /* LISTA DE POSIÇÕES */
          <Card className="dark:bg-slate-900/90 dark:border-slate-700">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800">
                    <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                      <SortableTableHeader
                        field="ativa"
                        label="Status"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="unidade"
                        label="Estoque"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="rua"
                        label="Rua"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="altura"
                        label="Altura"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="coluna"
                        label="Coluna"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="item_codigo"
                        label="Item"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="saldo"
                        label="Saldo"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortData(posicoes).map((posicao) => (
                      <tr key={posicao.seq_posicao} className={`border-b dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                        posicao.ativa === 'N' ? 'opacity-50' : ''
                      }`}>
                        <td className="p-3 text-sm">
                          {posicao.ativa === 'S' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                              ATIVA
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                              INATIVA
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-slate-700 dark:text-slate-300">
                          <div>
                            <div className="font-bold text-blue-600">{posicao.unidade}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{posicao.estoque_descricao}</div>
                          </div>
                        </td>
                        <td className="p-3 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{posicao.rua}</td>
                        <td className="p-3 text-sm font-mono text-slate-700 dark:text-slate-300">{posicao.altura}</td>
                        <td className="p-3 text-sm font-mono text-slate-700 dark:text-slate-300">{posicao.coluna}</td>
                        <td className="p-3 text-sm text-slate-700 dark:text-slate-300">
                          {posicao.item_codigo ? (
                            <div>
                              <div className="font-medium">{posicao.item_codigo}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{posicao.item_descricao}</div>
                            </div>
                          ) : (
                            <span className="text-slate-400">Vazio</span>
                          )}
                        </td>
                        <td className="p-3 text-sm text-right font-bold">
                          <span className={posicao.saldo > 0 ? 'text-green-600 dark:text-green-400' : 'text-slate-400'}>
                            {posicao.saldo.toFixed(2)}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => abrirDialogEdicao(posicao)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {posicao.ativa === 'S' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => excluir(posicao.seq_posicao)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => reativar(posicao.seq_posicao)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-card-foreground">
              {editando ? 'Editar Posição' : 'Nova Posição'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <FilterSelectEstoque
                value={formData.seq_estoque}
                onChange={(value) => setFormData({ ...formData, seq_estoque: value })}
                label="Estoque *"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="rua">Rua *</Label>
                <Input
                  id="rua"
                  value={formData.rua}
                  onChange={(e) => setFormData({ ...formData, rua: e.target.value })}
                  placeholder="Ex: A"
                  className="uppercase"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="altura">Altura *</Label>
                <Input
                  id="altura"
                  value={formData.altura}
                  onChange={(e) => setFormData({ ...formData, altura: e.target.value })}
                  placeholder="Ex: 1"
                  className="uppercase"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="coluna">Coluna *</Label>
                <Input
                  id="coluna"
                  value={formData.coluna}
                  onChange={(e) => setFormData({ ...formData, coluna: e.target.value })}
                  placeholder="Ex: 01"
                  className="uppercase"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <FilterSelectItem
                value={formData.seq_item}
                onChange={(value) => setFormData({ ...formData, seq_item: value })}
                label="Item *"
                placeholder="Selecione um item"
                showAll={false}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="saldo">Saldo</Label>
              <Input
                id="saldo"
                type="number"
                step="0.01"
                value={formData.saldo}
                onChange={(e) => setFormData({ ...formData, saldo: e.target.value })}
                placeholder="0.00"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}