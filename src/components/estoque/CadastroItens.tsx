import { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Edit, Trash2, Loader2, Package, Search, Filter, X, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { Checkbox } from '../ui/checkbox';
import { apiFetch } from '../../utils/apiUtils';
import { SortableTableHeader, useSortableTable } from '../table/SortableTableHeader';
import { FilterSelectTipoItem } from './FilterSelectTipoItem';
import { FilterSelectEstoque } from '../shared/FilterSelectEstoque';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface Item {
  seq_item: number;
  codigo: string;
  codigo_fabricante: string;
  descricao: string;
  seq_tipo_item: number;
  seq_unidade_medida: number;
  vlr_item: number;
  estoque_minimo: number;
  estoque_maximo: number;
  ativo: string;
  tipo_descricao: string;
  unidade_medida_sigla: string;
}

interface Posicao {
  seq_posicao: number;
  seq_estoque: number;
  nro_estoque: number;
  unidade: string;
  rua: string;
  altura: number;
  coluna: number;
  saldo: number;
}

interface TipoItem {
  seq_tipo_item: number;
  descricao: string;
}

interface UnidadeMedida {
  seq_unidade_medida: number;
  descricao: string;
  sigla: string;
}

interface FormData {
  seq_item?: number;
  codigo: string;
  codigo_fabricante: string;
  descricao: string;
  seq_tipo_item: string;
  seq_unidade_medida: string;
  vlr_item: string;
  estoque_minimo: string;
  estoque_maximo: string;
  ativo: string;
}

export function CadastroItens() {
  usePageTitle('Cadastro de Itens');

  const [itens, setItens] = useState<Item[]>([]);
  const [tipos, setTipos] = useState<TipoItem[]>([]);
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(false);
  const [filtroAtivos, setFiltroAtivos] = useState(false); // ✅ DESMARCADO por padrão - traz TODOS
  const [filtroTipoItem, setFiltroTipoItem] = useState('ALL'); // ✅ NOVO - Filtro de tipo de item (padrão: TODOS)
  const [busca, setBusca] = useState('');

  const [formData, setFormData] = useState<FormData>({
    codigo: '',
    codigo_fabricante: '',
    descricao: '',
    seq_tipo_item: '',
    seq_unidade_medida: '',
    vlr_item: '0.00',
    estoque_minimo: '0.00',
    estoque_maximo: '0.00',
    ativo: 'S'
  });

  // Estado para posições (apenas quando editando)
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [loadingPosicoes, setLoadingPosicoes] = useState(false);

  // Estados para dialog de adicionar a estoque (após criação)
  const [dialogEstoqueOpen, setDialogEstoqueOpen] = useState(false);
  const [itemCriado, setItemCriado] = useState<{seq_item: number; codigo: string; descricao: string} | null>(null);
  const [seqEstoque, setSeqEstoque] = useState('');
  const [qtdeItem, setQtdeItem] = useState('');
  const [salvandoPosicao, setSalvandoPosicao] = useState(false);

  useEffect(() => {
    carregarTipos();
    carregarUnidades();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarItens();
    }, 500);
    return () => clearTimeout(timer);
  }, [filtroAtivos, filtroTipoItem, busca]);

  const carregarTipos = async () => {
    try {
      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/tipos_item.php?ativo=S`);
      if (data.success) setTipos(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar tipos:', error);
    }
  };

  const carregarUnidades = async () => {
    try {
      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/unidades_medida.php?ativo=S`);
      if (data.success) setUnidades(data.data || []);
    } catch (error) {
      console.error('Erro ao carregar unidades:', error);
    }
  };

  const carregarItens = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filtroAtivos) params.append('ativo', 'S');
      if (filtroTipoItem !== 'ALL') params.append('seq_tipo_item', filtroTipoItem);
      if (busca) params.append('search', busca);

      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/itens.php?${params}`);
      
      if (data.success) {
        setItens(data.data || []);
      }
      // ✅ Se success=false, o toast já foi exibido pelo apiUtils (msg() do backend)
    } catch (error) {
      // ✅ Erro de comunicação (network error, etc) - não relacionado ao backend
      console.error('Erro ao carregar itens:', error);
      toast.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const abrirDialog = (item?: Item) => {
    if (item) {
      setFormData({
        seq_item: item.seq_item,
        codigo: item.codigo,
        codigo_fabricante: item.codigo_fabricante || '',
        descricao: item.descricao,
        seq_tipo_item: item.seq_tipo_item?.toString() || '',
        seq_unidade_medida: item.seq_unidade_medida?.toString() || '',
        vlr_item: item.vlr_item?.toFixed(2) || '0.00',
        estoque_minimo: item.estoque_minimo?.toFixed(2) || '0.00',
        estoque_maximo: item.estoque_maximo?.toFixed(2) || '0.00',
        ativo: item.ativo
      });
      setEditando(true);
      carregarPosicoes(item.seq_item);
    } else {
      setFormData({
        codigo: '',
        codigo_fabricante: '',
        descricao: '',
        seq_tipo_item: '',
        seq_unidade_medida: '',
        vlr_item: '0.00',
        estoque_minimo: '0.00',
        estoque_maximo: '0.00',
        ativo: 'S'
      });
      setEditando(false);
      setPosicoes([]);
    }
    setDialogOpen(true);
  };

  const salvar = async () => {
    if (!formData.codigo || !formData.descricao) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const method = editando ? 'PUT' : 'POST';

      const payload = {
        ...formData,
        seq_tipo_item: formData.seq_tipo_item === '0' ? null : formData.seq_tipo_item || null,
        seq_unidade_medida: formData.seq_unidade_medida === '0' ? null : formData.seq_unidade_medida || null,
        vlr_item: parseFloat(formData.vlr_item),
        estoque_minimo: parseFloat(formData.estoque_minimo),
        estoque_maximo: parseFloat(formData.estoque_maximo)
      };

      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/itens.php`, {
        method,
        body: JSON.stringify(payload)
      });

      // ✅ PADRÃO CORRETO: apiUtils já interceptou e exibiu o toast automaticamente
      // Aqui apenas verificamos se success=true para fechar dialog e recarregar
      if (data.success) {
        toast.success(editando ? 'Item atualizado com sucesso!' : 'Item cadastrado com sucesso!');
        setDialogOpen(false);
        carregarItens();
        
        // Se for criação, abrir dialog de adicionar ao estoque
        if (!editando) {
          console.log('🔍 DEBUG - Item criado:', data);
          
          // ✅ CORREÇÃO: Backend retorna seq_item direto, não em data.data
          if (data.seq_item) {
            setItemCriado({
              seq_item: data.seq_item, 
              codigo: data.codigo || formData.codigo,
              descricao: data.descricao || formData.descricao
            });
            setDialogEstoqueOpen(true);
            console.log('✅ Dialog de estoque deve abrir agora!');
          } else {
            console.warn('⚠️ seq_item não encontrado na resposta');
          }
        }
      }
      // ✅ Se success=false, o toast já foi exibido pelo apiUtils (msg() do backend)
    } catch (error) {
      // ✅ Erro de comunicação (network error, etc) - não relacionado ao backend
      console.error('Erro ao salvar item:', error);
      toast.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (seq_item: number) => {
    if (!confirm('Deseja realmente inativar este item?')) return;

    setLoading(true);
    try {
      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/itens.php`, {
        method: 'DELETE',
        body: JSON.stringify({ seq_item })
      });

      // ✅ PADRÃO CORRETO: apiUtils já interceptou e exibiu o toast automaticamente
      if (data.success) {
        toast.success('Item inativado com sucesso!');
        carregarItens();
      }
      // ✅ Se success=false, o toast já foi exibido pelo apiUtils (msg() do backend)
    } catch (error) {
      // ✅ Erro de comunicação (network error, etc) - não relacionado ao backend
      console.error('Erro ao excluir item:', error);
      toast.error('Erro de comunicação com o servidor');
    } finally {
      setLoading(false);
    }
  };

  const carregarPosicoes = async (seq_item: number) => {
    setLoadingPosicoes(true);
    try {
      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php?seq_item=${seq_item}`);
      if (data.success) {
        setPosicoes(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar posições:', error);
      toast.error('Erro ao carregar posições do item');
    } finally {
      setLoadingPosicoes(false);
    }
  };

  // ✅ Hook de ordenação
  const { sortField, sortDirection, handleSort, sortData } = useSortableTable<
    'codigo' | 'descricao' | 'tipo_descricao' | 'unidade_medida_sigla' | 'vlr_item' | 'ativo'
  >('codigo', 'asc');

  // ✅ Limpar todos os filtros
  const limparFiltros = () => {
    setBusca('');
    setFiltroAtivos(false);
    setFiltroTipoItem('ALL');
  };

  // ✅ Verificar se há filtros ativos
  const hasFiltrosAtivos = busca || filtroAtivos || filtroTipoItem !== 'ALL';

  return (
    <AdminLayout
      title="CADASTRO DE ITENS"
      description="Gerenciar itens do estoque"
    >
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* ✅ Botão Novo Item */}
        <div className="flex justify-end">
          <Button
            onClick={() => abrirDialog()}
            className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo Item
          </Button>
        </div>

        {/* ✅ Card Principal */}
        <Card className="dark:bg-slate-900/90 dark:border-slate-700">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-slate-900 dark:text-slate-100">
                  Itens Cadastrados
                </CardTitle>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Gerencie os itens do estoque
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* ✅ ÁREA DE FILTROS */}
            <Card className="mb-6 bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Busca por Código ou Descrição */}
                  <div className="space-y-2">
                    <Label htmlFor="busca" className="text-sm font-medium">
                      Código ou Descrição
                    </Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="busca"
                        placeholder="Buscar..."
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        className="pl-10 dark:bg-slate-800 dark:border-slate-700"
                      />
                    </div>
                  </div>

                  {/* Tipo de Item */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tipo de Item</Label>
                    <FilterSelectTipoItem
                      value={filtroTipoItem}
                      onChange={(value) => setFiltroTipoItem(value)}
                      placeholder="Todos os tipos"
                      showAll={true}
                      label=""
                    />
                  </div>

                  {/* Status */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <div className="flex items-center h-9 px-3 border rounded-md bg-background dark:bg-slate-800 dark:border-slate-700">
                      <Checkbox
                        id="filtroAtivos"
                        checked={filtroAtivos}
                        onCheckedChange={(checked) => setFiltroAtivos(!!checked)}
                      />
                      <Label 
                        htmlFor="filtroAtivos" 
                        className="ml-2 text-sm cursor-pointer font-normal text-slate-900 dark:text-slate-100"
                      >
                        Apenas ativos
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Botões e Contador */}
                {hasFiltrosAtivos && (
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button 
                      onClick={limparFiltros} 
                      size="sm" 
                      variant="outline" 
                      className="gap-2"
                    >
                      <X className="h-4 w-4" />
                      Limpar Filtros
                    </Button>
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {itens.length} {itens.length === 1 ? 'item encontrado' : 'itens encontrados'}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-800">
                    <tr className="border-b-2 border-slate-300 dark:border-slate-600">
                      <SortableTableHeader
                        field="codigo"
                        label="Código"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="descricao"
                        label="Descrição"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="tipo_descricao"
                        label="Tipo"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                      />
                      <SortableTableHeader
                        field="unidade_medida_sigla"
                        label="UN"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <SortableTableHeader
                        field="vlr_item"
                        label="Valor"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-right"
                      />
                      <SortableTableHeader
                        field="ativo"
                        label="Status"
                        currentSortField={sortField}
                        currentSortDirection={sortDirection}
                        onSort={handleSort}
                        className="text-center"
                      />
                      <th className="px-4 py-3 text-center text-xs font-semibold text-foreground uppercase">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortData(itens).map((item) => (
                      <tr key={item.seq_item} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100 font-mono">{item.codigo}</td>
                        <td className="px-4 py-3 text-sm text-slate-900 dark:text-slate-100">{item.descricao}</td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.tipo_descricao || '-'}</td>
                        <td className="px-4 py-3 text-sm text-center text-slate-900 dark:text-slate-100">{item.unidade_medida_sigla || '-'}</td>
                        <td className="px-4 py-3 text-sm text-right text-slate-900 dark:text-slate-100 font-mono">
                          {item.vlr_item ? `R$ ${item.vlr_item.toFixed(2)}` : 'R$ 0,00'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.ativo === 'S' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {item.ativo === 'S' ? 'ATIVO' : 'INATIVO'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => abrirDialog(item)}
                              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            {item.ativo === 'S' && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => excluir(item.seq_item)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {itens.length === 0 && (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    Nenhum item cadastrado
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Cadastro/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-card-foreground">
              {editando ? 'Editar Item' : 'Novo Item'}
            </DialogTitle>
            <DialogDescription>
              {editando ? 'Atualize os detalhes do item' : 'Insira os detalhes do novo item'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="codigo" className="text-slate-900 dark:text-slate-100">Código *</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) => setFormData({ ...formData, codigo: e.target.value.toUpperCase() })}
                  placeholder="Ex: ITEM001"
                  className="dark:bg-slate-800 dark:border-slate-700"
                  maxLength={50}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo_fabricante" className="text-slate-900 dark:text-slate-100">Código Fabricante</Label>
                <Input
                  id="codigo_fabricante"
                  value={formData.codigo_fabricante}
                  onChange={(e) => setFormData({ ...formData, codigo_fabricante: e.target.value.toUpperCase() })}
                  placeholder="Opcional"
                  className="dark:bg-slate-800 dark:border-slate-700"
                  maxLength={50}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao" className="text-slate-900 dark:text-slate-100">Descrição *</Label>
              <Input
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value.toUpperCase() })}
                placeholder="Ex: PARAFUSO 10MM"
                className="dark:bg-slate-800 dark:border-slate-700"
                maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipo" className="text-slate-900 dark:text-slate-100">Tipo de Item</Label>
                <Select value={formData.seq_tipo_item} onValueChange={(value) => setFormData({ ...formData, seq_tipo_item: value })}>
                  <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    <SelectItem value="0">NENHUM</SelectItem>
                    {tipos.map(tipo => (
                      <SelectItem key={tipo.seq_tipo_item} value={tipo.seq_tipo_item.toString()}>
                        {tipo.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unidade" className="text-slate-900 dark:text-slate-100">Unidade de Medida</Label>
                <Select value={formData.seq_unidade_medida} onValueChange={(value) => setFormData({ ...formData, seq_unidade_medida: value })}>
                  <SelectTrigger className="dark:bg-slate-800 dark:border-slate-700">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-800 dark:border-slate-700">
                    <SelectItem value="0">NENHUM</SelectItem>
                    {unidades.map(unidade => (
                      <SelectItem key={unidade.seq_unidade_medida} value={unidade.seq_unidade_medida.toString()}>
                        {unidade.sigla} - {unidade.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vlr_item" className="text-slate-900 dark:text-slate-100">Valor Unitário</Label>
                <Input
                  id="vlr_item"
                  type="number"
                  step="0.01"
                  value={formData.vlr_item}
                  onChange={(e) => setFormData({ ...formData, vlr_item: e.target.value })}
                  className="dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estoque_minimo" className="text-slate-900 dark:text-slate-100">Estoque Mínimo</Label>
                <Input
                  id="estoque_minimo"
                  type="number"
                  step="0.01"
                  value={formData.estoque_minimo}
                  onChange={(e) => setFormData({ ...formData, estoque_minimo: e.target.value })}
                  className="dark:bg-slate-800 dark:border-slate-700"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="estoque_maximo" className="text-slate-900 dark:text-slate-100">Estoque Máximo</Label>
                <Input
                  id="estoque_maximo"
                  type="number"
                  step="0.01"
                  value={formData.estoque_maximo}
                  onChange={(e) => setFormData({ ...formData, estoque_maximo: e.target.value })}
                  className="dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="ativo"
                checked={formData.ativo === 'S'}
                onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked ? 'S' : 'N' })}
              />
              <Label htmlFor="ativo" className="text-slate-900 dark:text-slate-100 cursor-pointer font-normal">
                Ativo
              </Label>
            </div>

            {/* Lista de Posições (apenas quando editando) */}
            {editando && (
              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Posições em Estoque
                </h3>
                
                {loadingPosicoes ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : posicoes.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 dark:text-slate-400 text-sm">
                    Este item não está cadastrado em nenhum estoque
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border border-slate-200 dark:border-slate-700">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Estoque</TableHead>
                            <TableHead>Posição</TableHead>
                            <TableHead className="text-right">Saldo</TableHead>
                            <TableHead className="text-right">Valor Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {posicoes.map((posicao) => {
                            const valorUnitario = parseFloat(formData.vlr_item) || 0;
                            const qtdeItem = posicao.saldo || 0;
                            const valorTotal = valorUnitario * qtdeItem;
                            const estoqueFormatado = `${posicao.unidade || ''}${String(posicao.nro_estoque || '0').padStart(6, '0')}`;
                            const endereco = `${posicao.rua || 'PSO'}/${posicao.altura || 1}/${posicao.coluna || 1}`;
                            
                            return (
                              <TableRow key={posicao.seq_posicao}>
                                <TableCell className="font-mono text-sm">{estoqueFormatado}</TableCell>
                                <TableCell className="font-mono text-sm">{endereco}</TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {qtdeItem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {/* Linha de totais */}
                          <TableRow className="bg-slate-50 dark:bg-slate-800/50 font-semibold">
                            <TableCell colSpan={2} className="text-right">TOTAL:</TableCell>
                            <TableCell className="text-right font-mono">
                              {posicoes.reduce((acc, p) => acc + (p.saldo || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              R$ {posicoes.reduce((acc, p) => acc + ((parseFloat(formData.vlr_item) || 0) * (p.saldo || 0)), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Adicionar ao Estoque */}
      <Dialog open={dialogEstoqueOpen} onOpenChange={setDialogEstoqueOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-card-foreground">
              Adicionar ao Estoque
            </DialogTitle>
            <DialogDescription>
              Adicione o item recém criado a um estoque
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* ✅ PRIMEIRA LINHA: Código e Descrição do Item */}
            <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Item criado:</div>
              <div className="flex items-baseline gap-3">
                <span className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">
                  {itemCriado?.codigo}
                </span>
                <span className="text-base text-slate-900 dark:text-slate-100">
                  {itemCriado?.descricao}
                </span>
              </div>
            </div>

            {/* ✅ SEGUNDA LINHA: Estoque e Quantidade */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estoque" className="text-slate-900 dark:text-slate-100">Estoque *</Label>
                <FilterSelectEstoque
                  value={seqEstoque}
                  onChange={(value) => setSeqEstoque(value)}
                  placeholder="Selecione o estoque"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="qtde_item" className="text-slate-900 dark:text-slate-100">Quantidade *</Label>
                <Input
                  id="qtde_item"
                  type="number"
                  step="0.01"
                  value={qtdeItem}
                  onChange={(e) => setQtdeItem(e.target.value)}
                  placeholder="0.00"
                  className="dark:bg-slate-800 dark:border-slate-700"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogEstoqueOpen(false)}
              className="dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!seqEstoque || !qtdeItem) {
                  toast.error('Preencha todos os campos obrigatórios');
                  return;
                }

                setSalvandoPosicao(true);
                try {
                  const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php`, {
                    method: 'POST',
                    body: JSON.stringify({
                      seq_item: itemCriado?.seq_item,
                      seq_estoque: parseInt(seqEstoque),
                      rua: 'PSO', // ✅ POSIÇÃO PADRÃO
                      altura: 1,  // ✅ POSIÇÃO PADRÃO
                      coluna: 1,  // ✅ POSIÇÃO PADRÃO
                      qtde_item: parseFloat(qtdeItem)
                    })
                  });

                  // ✅ PADRÃO CORRETO: apiUtils já interceptou e exibiu o toast automaticamente
                  if (data.success) {
                    toast.success('Item adicionado ao estoque com sucesso!');
                    setDialogEstoqueOpen(false);
                    carregarItens();
                  }
                  // ✅ Se success=false, o toast já foi exibido pelo apiUtils (msg() do backend)
                } catch (error) {
                  // ✅ Erro de comunicação (network error, etc) - não relacionado ao backend
                  console.error('Erro ao adicionar ao estoque:', error);
                  toast.error('Erro de comunicação com o servidor');
                } finally {
                  setSalvandoPosicao(false);
                }
              }}
              disabled={salvandoPosicao}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800 text-white"
            >
              {salvandoPosicao ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Adicionar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}