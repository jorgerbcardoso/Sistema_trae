import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  ArrowLeft,
  PackageMinus,
  Plus,
  Save,
  Loader2,
  Trash2,
  MapPin,
  Search,
  Package,
  CheckSquare,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { FilterSelectEstoque } from '../../components/shared/FilterSelectEstoque';
import { FilterSelectCentroCusto } from '../../components/shared/FilterSelectCentroCusto';
import { FilterSelectVeiculo } from '../../components/dashboards/FilterSelectVeiculo'; // ✅ NOVO

interface Estoque {
  seq_estoque: number;
  descricao: string;
  unidade: string;
  nro_estoque: string;
}

interface Item {
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
}

interface Posicao {
  seq_posicao: number;
  seq_estoque: number;
  seq_item: number | null;
  rua: string;
  altura: string;
  coluna: string;
  saldo: number;
  localizacao: string;
  ativa: string;
}

interface ItemSaida {
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  quantidade: number;
  seq_posicao: number | null;
  posicao_descricao: string;
  saldo_total_item: number; // Saldo total do item no estoque
  saldo_posicao: number; // Saldo da posição selecionada
}

export default function NovaSaidaEstoque() {
  usePageTitle('Nova Saída do Estoque');

  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Dados da requisição
  const [seqEstoque, setSeqEstoque] = useState('');
  const [seqCentroCusto, setSeqCentroCusto] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [placa, setPlaca] = useState(''); // ✅ NOVO - Placa do veículo
  const [observacao, setObservacao] = useState('');

  // Itens da saída
  const [itensSaida, setItensSaida] = useState<ItemSaida[]>([]);

  // Modal de seleção de ITENS (múltipla seleção)
  const [modalItens, setModalItens] = useState(false);
  const [itensDisponiveis, setItensDisponiveis] = useState<Item[]>([]);
  const [itensSelecionados, setItensSelecionados] = useState<number[]>([]); // seq_item
  const [buscaItem, setBuscaItem] = useState('');
  const [loadingItens, setLoadingItens] = useState(false);

  // Modal de seleção de POSIÇÃO (igual à entrada manual)
  const [modalPosicao, setModalPosicao] = useState(false);
  const [posicoesDisponiveis, setPosicoesDisponiveis] = useState<Posicao[]>([]);
  const [itemParaPosicao, setItemParaPosicao] = useState<number | null>(null);
  const [buscaPosicao, setBuscaPosicao] = useState('');
  const [loadingPosicoes, setLoadingPosicoes] = useState(false);

  // ================================================================
  // CARREGAR ITENS DO ESTOQUE
  // ================================================================
  const carregarItens = async () => {
    if (!seqEstoque) return;

    setLoadingItens(true);
    try {
      const data = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/estoque/itens.php?seq_estoque=${seqEstoque}`
      );

      if (data.success) {
        setItensDisponiveis(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
    } finally {
      setLoadingItens(false);
    }
  };

  // ================================================================
  // ADICIONAR ITENS SELECIONADOS À LISTA
  // ================================================================
  const adicionarItensSelecionados = async () => {
    if (itensSelecionados.length === 0) {
      toast.warning('Selecione pelo menos um item');
      return;
    }

    setLoadingItens(true);
    try {
      const novosItens: ItemSaida[] = [];

      for (const seqItem of itensSelecionados) {
        // Verificar se já existe
        if (itensSaida.some(i => i.seq_item === seqItem)) {
          continue;
        }

        const item = itensDisponiveis.find(i => i.seq_item === seqItem);
        if (!item) continue;

        // Buscar saldo TOTAL do item no estoque (somando todas as posições)
        const dataSaldo = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php?seq_estoque=${seqEstoque}&seq_item=${seqItem}&com_saldo=S`
        );

        let saldoTotal = 0;
        if (dataSaldo.success && dataSaldo.data) {
          saldoTotal = dataSaldo.data.reduce((acc: number, pos: Posicao) => acc + pos.saldo, 0);
        }

        novosItens.push({
          seq_item: item.seq_item,
          codigo: item.codigo,
          descricao: item.descricao,
          unidade_medida: item.unidade_medida,
          quantidade: 0,
          seq_posicao: null,
          posicao_descricao: '',
          saldo_total_item: saldoTotal,
          saldo_posicao: 0,
        });
      }

      setItensSaida([...itensSaida, ...novosItens]);
      setModalItens(false);
      setItensSelecionados([]);
      setBuscaItem('');
      toast.success(`${novosItens.length} item(ns) adicionado(s)`);
    } catch (error) {
      console.error('Erro ao adicionar itens:', error);
      toast.error('Erro ao adicionar itens');
    } finally {
      setLoadingItens(false);
    }
  };

  // ================================================================
  // TOGGLE SELEÇÃO DE ITEM
  // ================================================================
  const toggleSelecaoItem = (seqItem: number) => {
    if (itensSelecionados.includes(seqItem)) {
      setItensSelecionados(itensSelecionados.filter(id => id !== seqItem));
    } else {
      setItensSelecionados([...itensSelecionados, seqItem]);
    }
  };

  // ================================================================
  // REMOVER ITEM DA LISTA
  // ================================================================
  const removerItem = (index: number) => {
    setItensSaida(itensSaida.filter((_, i) => i !== index));
    toast.success('Item removido');
  };

  // ================================================================
  // ATUALIZAR QUANTIDADE
  // ================================================================
  const atualizarQuantidade = (index: number, quantidade: number) => {
    const novosItens = [...itensSaida];
    novosItens[index].quantidade = quantidade;
    setItensSaida(novosItens);
  };

  // ================================================================
  // CARREGAR POSIÇÕES DO ITEM (com saldo)
  // ================================================================
  const carregarPosicoes = async (seq_item: number) => {
    if (!seqEstoque) {
      toast.error('Selecione um estoque primeiro');
      return;
    }

    setLoadingPosicoes(true);
    try {
      const data = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php?seq_estoque=${seqEstoque}&seq_item=${seq_item}&com_saldo=S`
      );

      if (data.success) {
        // Formatar a localização para cada posição
        const posicoesFormatadas = (data.data || []).map((p: any) => ({
          ...p,
          localizacao: p.localizacao || `RUA ${p.rua} - ALT ${p.altura} - COL ${p.coluna}`
        }));
        setPosicoesDisponiveis(posicoesFormatadas);
      }
    } catch (error) {
      console.error('Erro ao carregar posições:', error);
    } finally {
      setLoadingPosicoes(false);
    }
  };

  // ================================================================
  // ABRIR MODAL DE POSIÇÃO
  // ================================================================
  const abrirModalPosicao = (index: number) => {
    const item = itensSaida[index];
    setItemParaPosicao(index);
    carregarPosicoes(item.seq_item);
    setModalPosicao(true);
  };

  // ================================================================
  // SELECIONAR POSIÇÃO
  // ================================================================
  const selecionarPosicao = (posicao: Posicao) => {
    if (itemParaPosicao === null) return;

    const novosItens = [...itensSaida];
    novosItens[itemParaPosicao].seq_posicao = posicao.seq_posicao;
    novosItens[itemParaPosicao].posicao_descricao = posicao.localizacao;
    novosItens[itemParaPosicao].saldo_posicao = posicao.saldo;
    setItensSaida(novosItens);

    setModalPosicao(false);
    setBuscaPosicao('');
    setItemParaPosicao(null);
    toast.success('Posição selecionada');
  };

  // ================================================================
  // VALIDAR E SALVAR REQUISIÇÃO
  // ================================================================
  const salvarRequisicao = async () => {
    // Validações
    if (!seqEstoque) {
      toast.error('Selecione um estoque');
      return;
    }

    if (!seqCentroCusto) {
      toast.error('Selecione um centro de custo');
      return;
    }

    if (!solicitante.trim()) {
      toast.error('Informe o solicitante');
      return;
    }

    if (itensSaida.length === 0) {
      toast.error('Adicione pelo menos um item à requisição');
      return;
    }

    // Validar posições e quantidades
    for (const item of itensSaida) {
      if (item.quantidade <= 0) {
        toast.error(`Quantidade inválida para o item ${item.codigo} - ${item.descricao}`);
        return;
      }

      // Validar saldo apenas se posição foi selecionada
      if (item.seq_posicao && item.quantidade > item.saldo_posicao) {
        toast.error(`Quantidade de ${item.codigo} excede o saldo da posição (${item.saldo_posicao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`);
        return;
      }
    }

    setSalvando(true);
    try {
      const payload = {
        seq_estoque: parseInt(seqEstoque),
        seq_cc: parseInt(seqCentroCusto),
        solicitante: solicitante.toUpperCase(),
        placa: placa ? placa.toUpperCase() : null, // ✅ NOVO - Placa do veículo
        observacao: observacao.toUpperCase(),
        itens: itensSaida.map((item) => ({
          seq_item: item.seq_item,
          seq_posicao: item.seq_posicao,
          quantidade: item.quantidade,
        })),
      };

      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/requisicoes.php`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (data.success) {
        // ✅ Navegar PRIMEIRO, passar mensagem via state
        navigate('/estoque/saida', {
          state: { 
            message: `Requisição nº ${data.data?.seq_requisicao || ''} criada com sucesso!`,
            type: 'success'
          }
        });
      }
    } catch (error) {
      console.error('Erro ao salvar requisição:', error);
    } finally {
      setSalvando(false);
    }
  };

  // ================================================================
  // FILTRAR ITENS PELA BUSCA
  // ================================================================
  const itensFiltrados = itensDisponiveis.filter((item) => {
    if (!buscaItem.trim()) return true;
    const busca = buscaItem.toLowerCase();
    return (
      item.codigo?.toLowerCase().includes(busca) ||
      item.descricao?.toLowerCase().includes(busca)
    );
  });

  // ================================================================
  // FILTRAR POSIÇÕES PELA BUSCA
  // ================================================================
  const posicoesFiltradas = posicoesDisponiveis.filter((pos) => {
    if (!buscaPosicao.trim()) return true;
    const busca = buscaPosicao.toLowerCase();
    return pos.localizacao?.toLowerCase().includes(busca);
  });

  return (
    <AdminLayout
      title="NOVA SAÍDA DO ESTOQUE"
      description="Criar requisição de saída de materiais"
    >
      <div className="max-w-[1400px] mx-auto space-y-6">
        {/* Botão Voltar */}
        <Button
          variant="outline"
          onClick={() => navigate('/estoque/saida')}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Voltar
        </Button>

        {/* Card: Dados da Requisição */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageMinus className="size-5" />
              Dados da Requisição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Estoque */}
            <FilterSelectEstoque
              value={seqEstoque}
              onChange={(value) => {
                setSeqEstoque(value);
                setItensSaida([]); // Limpar itens ao trocar estoque
              }}
              label="Estoque *"
              placeholder="Selecione o estoque"
              showAll={false}
              apenasAtivos={true}
            />

            {seqEstoque && (
              <>
                {/* Centro de Custo */}
                <FilterSelectCentroCusto
                  value={seqCentroCusto}
                  onChange={(value) => setSeqCentroCusto(value)}
                  label="Centro de Custo *"
                />

                {/* Solicitante */}
                <div className="space-y-2">
                  <Label>Solicitante *</Label>
                  <Input
                    value={solicitante}
                    onChange={(e) => setSolicitante(e.target.value.toUpperCase())}
                    placeholder="NOME DO SOLICITANTE"
                    maxLength={100}
                  />
                </div>

                {/* ✅ Placa do Veículo */}
                <div className="space-y-2">
                  <Label>Placa do Veículo</Label>
                  <FilterSelectVeiculo
                    value={placa}
                    onChange={(value) => setPlaca(value)}
                    placeholder="Digite ou selecione a placa do veículo"
                  />
                </div>

                {/* Observação */}
                <div className="space-y-2">
                  <Label>Observação</Label>
                  <Input
                    value={observacao}
                    onChange={(e) => setObservacao(e.target.value.toUpperCase())}
                    placeholder="OBSERVAÇÕES (OPCIONAL)"
                    maxLength={200}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card: Itens da Saída */}
        {seqEstoque && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Itens da Saída</CardTitle>
                <Button
                  onClick={() => {
                    carregarItens();
                    setModalItens(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="size-4" />
                  Adicionar Itens
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 <strong>Dica:</strong> Deixe as posições sem preenchimento para posicionamento automático.
                </p>
              </div>

              {itensSaida.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  Nenhum item adicionado. Clique em "Adicionar Itens" para começar.
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Código</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Posição</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-right">Quantidade *</TableHead>
                        <TableHead className="text-center">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itensSaida.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono">{item.codigo}</TableCell>
                          <TableCell>{item.descricao}</TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => abrirModalPosicao(index)}
                              className="gap-2"
                            >
                              <MapPin className="size-4" />
                              {item.posicao_descricao || 'Selecionar posição'}
                            </Button>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.seq_posicao
                              ? item.saldo_posicao.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : item.saldo_total_item.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end">
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.quantidade}
                                onChange={(e) => atualizarQuantidade(index, parseFloat(e.target.value) || 0)}
                                className="w-28 text-right"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removerItem(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Botões de Ação */}
        {seqEstoque && itensSaida.length > 0 && (
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/estoque/saida')}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarRequisicao}
              disabled={salvando}
              className="gap-2"
            >
              {salvando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  Salvar Requisição
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Modal: Selecionar ITENS (seleção múltipla) */}
      <Dialog open={modalItens} onOpenChange={setModalItens}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Selecionar Itens
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 space-y-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                value={buscaItem}
                onChange={(e) => setBuscaItem(e.target.value)}
                placeholder="Buscar por código ou descrição..."
                className="pl-10"
              />
            </div>

            {/* Contador de selecionados */}
            {itensSelecionados.length > 0 && (
              <div className="text-sm text-blue-600 font-medium">
                {itensSelecionados.length} item(ns) selecionado(s)
              </div>
            )}
          </div>

          {/* Área de conteúdo com scroll */}
          <div className="flex-1 overflow-hidden px-6">
            {loadingItens ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="size-8 animate-spin text-blue-600" />
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {buscaItem
                  ? 'Nenhum item encontrado com os critérios de busca'
                  : 'Nenhum item disponível neste estoque'}
              </div>
            ) : (
              <div className="border rounded-md h-full flex flex-col">
                {/* Cabeçalho fixo da tabela */}
                <div className="bg-slate-50 dark:bg-slate-900 border-b">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead className="w-[150px]">Código</TableHead>
                        <TableHead>Descrição</TableHead>
                      </TableRow>
                    </TableHeader>
                  </Table>
                </div>

                {/* Corpo com scroll */}
                <div className="flex-1 overflow-y-auto">
                  <Table>
                    <TableBody>
                      {itensFiltrados.map((item) => {
                        const selecionado = itensSelecionados.includes(item.seq_item);
                        const jaAdicionado = itensSaida.some(i => i.seq_item === item.seq_item);

                        return (
                          <TableRow
                            key={item.seq_item}
                            className={`cursor-pointer ${selecionado ? 'bg-blue-50 dark:bg-blue-950' : ''} ${jaAdicionado ? 'opacity-50' : ''}`}
                            onClick={() => !jaAdicionado && toggleSelecaoItem(item.seq_item)}
                          >
                            <TableCell className="w-[50px]">
                              {selecionado ? (
                                <CheckSquare className="size-5 text-blue-600" />
                              ) : (
                                <Square className="size-5 text-gray-400" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono w-[150px]">{item.codigo}</TableCell>
                            <TableCell>
                              {item.descricao}
                              {jaAdicionado && (
                                <span className="ml-2 text-xs text-green-600">(já adicionado)</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t bg-slate-50 dark:bg-slate-900">
            <Button variant="outline" onClick={() => {
              setModalItens(false);
              setItensSelecionados([]);
              setBuscaItem('');
            }}>
              Cancelar
            </Button>
            <Button 
              onClick={adicionarItensSelecionados}
              disabled={itensSelecionados.length === 0}
              className="gap-2"
            >
              <Plus className="size-4" />
              Adicionar {itensSelecionados.length > 0 && `(${itensSelecionados.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Selecionar POSIÇÃO (igual à entrada manual) */}
      <Dialog open={modalPosicao} onOpenChange={setModalPosicao}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Selecionar Posição no Estoque</DialogTitle>
            <DialogDescription>
              Escolha a posição de onde o item será retirado
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
              <Input
                value={buscaPosicao}
                onChange={(e) => setBuscaPosicao(e.target.value)}
                placeholder="Buscar por localização..."
                className="pl-10"
              />
            </div>

            {loadingPosicoes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {posicoesFiltradas.map((posicao) => (
                  <Card
                    key={posicao.seq_posicao}
                    className="cursor-pointer hover:border-purple-500 transition-colors"
                    onClick={() => selecionarPosicao(posicao)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <MapPin className="size-5 text-purple-600" />
                            <span className="font-bold text-lg">{posicao.localizacao}</span>
                          </div>
                          <div className="mt-1 text-sm text-gray-500">
                            Saldo disponível: {posicao.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </div>
                        <Button size="sm" className="gap-2">
                          <Plus className="size-4" />
                          Selecionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {posicoesFiltradas.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <MapPin className="size-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma posição com saldo disponível</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}