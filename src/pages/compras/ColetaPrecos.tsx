import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Loader2, Save, ArrowLeft, DollarSign, Package, CalendarClock, CreditCard, Link, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import {
  MOCK_ORCAMENTO_ORDENS,
  MOCK_ORDEM_COMPRA_ITENS,
  MOCK_ITENS,
  MOCK_ORCAMENTO_COTACOES,
  MOCK_ORCAMENTO_FORNECEDORES
} from '../../utils/estoqueModData';
import { MOCK_FORNECEDORES } from '../../mocks/estoqueComprasMocks';

interface ItemCotacao {
  seq_item: number;
  seq_ordem_compra: number;
  seq_ordem_compra_item: number; // ✅ NOVO: Adicionar campo para armazenar o ID real
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_item: number;
  vlr_estoque: number;
  vlr_fornecedor?: number;
  observacao?: string;
  link?: string; // ✅ NOVO: URL do link de compra
  seq_orcamento_cotacao?: number;
}

export default function ColetaPrecos() {
  const { seq_orcamento, seq_fornecedor } = useParams();
  const [searchParams] = useSearchParams();
  const origem = searchParams.get('origem') || 'mapa'; // 'mapa' ou 'orcamento'
  
  usePageTitle('Coleta de Preços');

  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [fornecedor, setFornecedor] = useState<any>(null);
  const [cotacoes, setCotacoes] = useState<ItemCotacao[]>([]);
  
  // ✅ NOVO: Estados para condição de pagamento e previsão de entrega
  const [condicaoPgto, setCondicaoPgto] = useState('');
  const [dataPrevEnt, setDataPrevEnt] = useState('');

  // ✅ NOVO: Estados do dialog de link
  const [dialogLinkOpen, setDialogLinkOpen] = useState(false);
  const [itemLinkIndex, setItemLinkIndex] = useState<number | null>(null);
  const [linkTemp, setLinkTemp] = useState('');

  useEffect(() => {
    carregarDados();
  }, [seq_orcamento, seq_fornecedor]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 500));

        // Buscar fornecedor e dados de cotação
        const orcFornecedor = MOCK_ORCAMENTO_FORNECEDORES.find(
          f => f.seq_orcamento === Number(seq_orcamento) && f.seq_fornecedor === Number(seq_fornecedor)
        );
        
        const fornMock = MOCK_FORNECEDORES.find(f => f.seq_fornecedor === Number(seq_fornecedor));
        setFornecedor({ ...fornMock, ...orcFornecedor });
        
        // ✅ Carregar condição de pagamento e data prevista (se já existir)
        setCondicaoPgto(orcFornecedor?.condicao_pgto || '');
        setDataPrevEnt(orcFornecedor?.data_prev_ent || '');

        // Buscar itens das ordens do orçamento
        const ordensDoOrcamento = MOCK_ORCAMENTO_ORDENS
          .filter(oo => oo.seq_orcamento === Number(seq_orcamento))
          .map(oo => oo.seq_ordem_compra);

        const itensLista: ItemCotacao[] = [];

        ordensDoOrcamento.forEach(seqOrdem => {
          const itensOrdem = MOCK_ORDEM_COMPRA_ITENS.filter(oi => oi.seq_ordem_compra === seqOrdem);

          itensOrdem.forEach(itemOrdem => {
            const item = MOCK_ITENS.find(i => i.seq_item === itemOrdem.seq_item);
            
            // Buscar cotação existente
            const cotacaoExistente = MOCK_ORCAMENTO_COTACOES.find(c =>
              c.seq_orcamento === Number(seq_orcamento) &&
              c.seq_fornecedor === Number(seq_fornecedor) &&
              c.seq_item === itemOrdem.seq_item &&
              c.seq_ordem_compra === seqOrdem
            );

            itensLista.push({
              seq_item: itemOrdem.seq_item,
              seq_ordem_compra: seqOrdem,
              seq_ordem_compra_item: itemOrdem.seq_ordem_compra_item, // ✅ NOVO: Adicionar campo para armazenar o ID real
              codigo: itemOrdem.codigo,
              descricao: itemOrdem.descricao,
              unidade_medida: itemOrdem.unidade_medida,
              qtde_item: itemOrdem.qtde_item,
              vlr_estoque: item?.vlr_item || 0,
              vlr_fornecedor: cotacaoExistente?.vlr_fornecedor || 0,
              observacao: cotacaoExistente?.observacao || '',
              link: cotacaoExistente?.link || '', // ✅ NOVO: Adicionar link de compra
              seq_orcamento_cotacao: cotacaoExistente?.seq_orcamento_cotacao
            });
          });
        });

        setCotacoes(itensLista);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=itens-coleta&seq_orcamento=${seq_orcamento}&seq_fornecedor=${seq_fornecedor}`,
          { method: 'GET' }
        );

        console.log('🔍 [ColetaPrecos] Dados recebidos da API:', data);
        console.log('🔍 [ColetaPrecos] Fornecedor:', data.fornecedor);
        console.log('🔍 [ColetaPrecos] Total de itens:', data.data?.length);

        if (data.success) {
          // ✅ Processar dados do fornecedor
          if (data.fornecedor) {
            setFornecedor(data.fornecedor);
            setCondicaoPgto(data.fornecedor.condicao_pgto || '');
            setDataPrevEnt(data.fornecedor.data_prev_ent || '');
            
            console.log('🔍 [ColetaPrecos] Condição pgto carregada:', data.fornecedor.condicao_pgto);
            console.log('🔍 [ColetaPrecos] Data prev ent carregada:', data.fornecedor.data_prev_ent);
          }

          // ✅ Processar itens da cotação (adaptar estrutura da API para o componente)
          const itensFormatados = (data.data || []).map((item: any) => ({
            seq_item: parseInt(item.seq_item),
            seq_ordem_compra: parseInt(item.seq_ordem_compra),
            seq_ordem_compra_item: parseInt(item.seq_ordem_compra_item), // ✅ NOVO: Adicionar campo para armazenar o ID real
            codigo: item.codigo,
            descricao: item.descricao,
            unidade_medida: item.unidade_medida,
            qtde_item: parseFloat(item.qtde_item),
            vlr_estoque: parseFloat(item.vlr_item || 0), // ✅ CORRIGIDO: Agora vem da API como vlr_item
            vlr_fornecedor: item.vlr_fornecedor ? parseFloat(item.vlr_fornecedor) : 0,
            observacao: '',
            link: item.link || '', // ✅ NOVO: Adicionar link de compra
            seq_orcamento_cotacao: item.seq_orcamento_cotacao ? parseInt(item.seq_orcamento_cotacao) : undefined
          }));

          console.log('🔍 [ColetaPrecos] Itens formatados:', itensFormatados);
          setCotacoes(itensFormatados);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const atualizarCotacao = (index: number, campo: string, valor: any) => {
    setCotacoes(prev => prev.map((cot, i) => {
      if (i === index) {
        return { ...cot, [campo]: valor };
      }
      return cot;
    }));
  };

  // ✅ NOVO: Abrir dialog de link
  const abrirDialogLink = (index: number) => {
    setItemLinkIndex(index);
    setLinkTemp(cotacoes[index].link || '');
    setDialogLinkOpen(true);
  };

  // ✅ NOVO: Salvar link
  const salvarLink = () => {
    if (itemLinkIndex !== null) {
      atualizarCotacao(itemLinkIndex, 'link', linkTemp.trim());
      setDialogLinkOpen(false);
      setItemLinkIndex(null);
      setLinkTemp('');
      
      if (linkTemp.trim()) {
        toast.success('Link salvo com sucesso!');
      }
    }
  };

  // ✅ NOVO: Abrir link em nova aba
  const abrirLink = (link: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (link && link.trim()) {
      // Garantir que o link tenha protocolo
      const url = link.startsWith('http://') || link.startsWith('https://') 
        ? link 
        : `https://${link}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleSalvar = async () => {
    // Validar se pelo menos um item tem preço informado
    const cotacoesComPreco = cotacoes.filter(c => c.vlr_fornecedor && c.vlr_fornecedor > 0);

    if (cotacoesComPreco.length === 0) {
      toast.error('Informe o preço de pelo menos um item');
      return;
    }

    // ✅ NOVO: Validar condição de pagamento e data prevista
    if (!condicaoPgto || condicaoPgto.trim() === '') {
      toast.error('Informe a condição de pagamento');
      return;
    }

    if (!dataPrevEnt || dataPrevEnt.trim() === '') {
      toast.error('Informe a previsão de entrega');
      return;
    }

    setSalvando(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // ✅ NOVO: Atualizar condição de pagamento e data prevista no MOCK_ORCAMENTO_FORNECEDORES
        const indexForn = MOCK_ORCAMENTO_FORNECEDORES.findIndex(
          f => f.seq_orcamento === Number(seq_orcamento) && f.seq_fornecedor === Number(seq_fornecedor)
        );
        if (indexForn >= 0) {
          MOCK_ORCAMENTO_FORNECEDORES[indexForn].condicao_pgto = condicaoPgto.trim().toUpperCase();
          MOCK_ORCAMENTO_FORNECEDORES[indexForn].data_prev_ent = dataPrevEnt;
          MOCK_ORCAMENTO_FORNECEDORES[indexForn].status = 'CONCLUIDO';
        }
        
        // Atualizar MOCK_ORCAMENTO_COTACOES (em produção isso seria salvo no banco)
        cotacoesComPreco.forEach(cot => {
          const index = MOCK_ORCAMENTO_COTACOES.findIndex(c =>
            c.seq_orcamento === Number(seq_orcamento) &&
            c.seq_fornecedor === Number(seq_fornecedor) &&
            c.seq_item === cot.seq_item &&
            c.seq_ordem_compra === cot.seq_ordem_compra
          );

          if (index >= 0) {
            // Atualizar existente
            MOCK_ORCAMENTO_COTACOES[index] = {
              ...MOCK_ORCAMENTO_COTACOES[index],
              vlr_fornecedor: cot.vlr_fornecedor || 0,
              vlr_total: (cot.vlr_fornecedor || 0) * cot.qtde_item,
              observacao: cot.observacao?.trim().toUpperCase() || '',
              link: cot.link || '', // ✅ NOVO: Adicionar link de compra
              selecionado: 'N'
            };
          } else {
            // Adicionar nova
            MOCK_ORCAMENTO_COTACOES.push({
              seq_orcamento_cotacao: MOCK_ORCAMENTO_COTACOES.length + 1,
              seq_orcamento: Number(seq_orcamento),
              seq_fornecedor: Number(seq_fornecedor),
              seq_ordem_compra: cot.seq_ordem_compra,
              seq_item: cot.seq_item,
              qtde_item: cot.qtde_item,
              vlr_estoque: cot.vlr_estoque,
              vlr_fornecedor: cot.vlr_fornecedor || 0,
              vlr_total: (cot.vlr_fornecedor || 0) * cot.qtde_item,
              prazo_entrega: 0,
              observacao: cot.observacao?.trim().toUpperCase() || '',
              link: cot.link || '', // ✅ NOVO: Adicionar link de compra
              selecionado: 'N'
            });
          }
        });

        toast.success(`Cotação salva com sucesso! ${cotacoesComPreco.length} ${cotacoesComPreco.length === 1 ? 'item informado' : 'itens informados'}`);
        
        // Voltar para a origem
        setTimeout(() => {
          handleVoltar();
        }, 500);
      } else {
        // BACKEND
        // ✅ Adaptar payload para o formato esperado pela API salvarCotacao
        const payload = {
          seq_orcamento: Number(seq_orcamento),
          seq_fornecedor: Number(seq_fornecedor),
          condicao_pgto: condicaoPgto.trim().toUpperCase(),
          data_prev_ent: dataPrevEnt,
          itens: cotacoesComPreco.map(cot => ({
            seq_item: cot.seq_item,
            seq_ordem_compra_item: cot.seq_ordem_compra_item, // ✅ Usar seq_ordem_compra_item
            vlr_fornecedor: cot.vlr_fornecedor || 0,
            link: cot.link || '' // ✅ NOVO: Adicionar link de compra
          }))
        };

        console.log('🔍 [ColetaPrecos] Salvando cotação...', payload);

        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=salvar-cotacao`,
          {
            method: 'POST',
            body: JSON.stringify(payload)
          }
        );

        if (data.success) {
          toast.success('Cotação salva com sucesso!');
          setTimeout(() => {
            handleVoltar();
          }, 500);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar cotação:', error);
    } finally {
      setSalvando(false);
    }
  };

  const handleVoltar = () => {
    if (origem === 'orcamento') {
      navigate(`/compras/orcamentos/editar/${seq_orcamento}`);
    } else {
      navigate(`/compras/orcamentos/mapa/${seq_orcamento}`);
    }
  };

  const calcularEconomia = (vlr_estoque: number, vlr_fornecedor: number) => {
    // ✅ Se algum valor for zero, retornar null para não exibir cálculo
    if (!vlr_fornecedor || vlr_fornecedor <= 0 || !vlr_estoque || vlr_estoque <= 0) return null;
    
    const economia = vlr_estoque - vlr_fornecedor;
    const percentual = (economia / vlr_estoque) * 100;
    
    return { economia, percentual };
  };

  const totalEstoque = cotacoes.reduce((sum, cot) => sum + (cot.vlr_estoque * cot.qtde_item), 0);
  const totalFornecedor = cotacoes.reduce((sum, cot) => sum + ((cot.vlr_fornecedor || 0) * cot.qtde_item), 0);
  const economiaTotal = totalEstoque - totalFornecedor;
  const percentualEconomia = totalEstoque > 0 ? (economiaTotal / totalEstoque) * 100 : 0;
  const itensInformados = cotacoes.filter(c => c.vlr_fornecedor && c.vlr_fornecedor > 0).length;

  // ✅ Helper para formatar número do orçamento (AAA000000)
  const formatarNumeroOrcamento = (unidade: string, numero: string | number): string => {
    const num = String(numero).padStart(6, '0');
    return `${unidade}${num}`;
  };

  // ✅ Helper para formatar hora (HH:MM)
  const formatarHora = (hora: string): string => {
    if (!hora) return '';
    return hora.substring(0, 5);
  };

  if (loading) {
    return (
      <AdminLayout title="COLETA DE PREÇOS">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="COLETA DE PREÇOS"
      description={`Informe os valores cotados pelo fornecedor: ${fornecedor?.nome || ''}`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Botão Voltar */}
        <div>
          <Button variant="outline" onClick={handleVoltar} className="gap-2">
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
        </div>

        {/* Card de Informações do Orçamento - Layout igual ao OrcamentoForm */}
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Informações do Orçamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Número do Orçamento */}
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Número do Orçamento</Label>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {formatarNumeroOrcamento(fornecedor?.unidade || '', fornecedor?.nro_orcamento || '0')}
                </p>
              </div>

              {/* Itens da Cotação */}
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Itens para Cotação</Label>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {cotacoes.length} {cotacoes.length === 1 ? 'item' : 'itens'}
                </p>
                <p className="text-sm text-gray-500">
                  {itensInformados} {itensInformados === 1 ? 'informado' : 'informados'}
                </p>
              </div>

              {/* Data de Inclusão */}
              <div>
                <Label className="text-xs text-gray-600 dark:text-gray-400">Criado em</Label>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {fornecedor?.data_inclusao && new Date(fornecedor.data_inclusao + 'T00:00:00').toLocaleDateString('pt-BR')} {fornecedor?.hora_inclusao ? formatarHora(fornecedor.hora_inclusao) : ''}
                </p>
                {fornecedor?.login_inclusao && (
                  <p className="text-sm text-gray-500">por {fornecedor.login_inclusao.toLowerCase()}</p>
                )}
              </div>
            </div>

            {/* Linha do Fornecedor (separada, abaixo) */}
            <div className="mt-6 pt-6 border-t border-blue-200 dark:border-blue-800">
              <Label className="text-xs text-gray-600 dark:text-gray-400">Fornecedor</Label>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                {fornecedor?.fornecedor_cnpj && <span className="text-gray-600 dark:text-gray-400 font-normal">{fornecedor.fornecedor_cnpj} - </span>}
                {fornecedor?.fornecedor_nome || 'Carregando...'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ✅ NOVO: Card de Condição de Pagamento e Previsão de Entrega */}
        <Card className="border-2 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5" />
              Condições da Cotação
            </CardTitle>
            <p className="text-sm text-gray-500">
              Informe as condições comerciais oferecidas pelo fornecedor
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="condicao_pgto">
                  Condição de Pagamento <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="condicao_pgto"
                  value={condicaoPgto}
                  onChange={(e) => setCondicaoPgto(e.target.value.toUpperCase())}
                  placeholder="Ex: 30 DIAS, À VISTA, 15/30 DIAS"
                  maxLength={50}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="data_prev_ent">
                  Previsão de Entrega <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="data_prev_ent"
                  type="date"
                  value={dataPrevEnt}
                  onChange={(e) => setDataPrevEnt(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Itens */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Itens para Cotação
            </CardTitle>
            <p className="text-sm text-gray-500">
              Informe os valores cotados. Deixe em branco os itens que o fornecedor não possui.
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center w-12">Link</TableHead>
                    <TableHead className="text-center">UN</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Vlr. Estoque</TableHead>
                    <TableHead className="text-right">Vlr. Fornecedor</TableHead>
                    <TableHead className="text-right">Economia</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cotacoes.map((cotacao, index) => {
                    const economia = calcularEconomia(cotacao.vlr_estoque, cotacao.vlr_fornecedor || 0);
                    const total = (cotacao.vlr_fornecedor || 0) * cotacao.qtde_item;
                    const temLink = cotacao.link && cotacao.link.trim().length > 0;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{cotacao.codigo}</TableCell>
                        <TableCell className="max-w-xs">{cotacao.descricao}</TableCell>
                        <TableCell className="text-center">
                          {/* ✅ NOVO: Ícone de link com estado visual */}
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => abrirDialogLink(index)}
                              title={temLink ? 'Editar link' : 'Adicionar link'}
                            >
                              <Link 
                                className={`h-4 w-4 ${
                                  temLink 
                                    ? 'text-green-600 dark:text-green-400' 
                                    : 'text-slate-400 dark:text-slate-600'
                                }`} 
                              />
                            </Button>
                            {temLink && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => abrirLink(cotacao.link!, e)}
                                title="Abrir link em nova aba"
                              >
                                <ExternalLink className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{cotacao.unidade_medida}</TableCell>
                        <TableCell className="text-right">{parseFloat(cotacao.qtde_item || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          R$ {parseFloat(cotacao.vlr_estoque || 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end">
                            <Input
                              type="number"
                              value={cotacao.vlr_fornecedor || ''}
                              onChange={(e) => atualizarCotacao(index, 'vlr_fornecedor', Number(e.target.value))}
                              placeholder="0,00"
                              step="0.01"
                              min="0"
                              className="w-32 text-right"
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {economia && (
                            <span className={economia.economia >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                              {economia.economia >= 0 ? '+' : ''}{economia.percentual.toFixed(1)}%
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {total > 0 && `R$ ${total.toFixed(2)}`}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-2">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Valor Estoque</p>
                <p className="text-2xl font-bold">R$ {totalEstoque.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Total Valor Fornecedor</p>
                <p className="text-2xl font-bold text-blue-600">R$ {totalFornecedor.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Economia/Acréscimo</p>
                <p className={`text-2xl font-bold ${economiaTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {economiaTotal >= 0 ? '+' : ''}R$ {economiaTotal.toFixed(2)}
                  <span className="text-lg ml-2">({percentualEconomia.toFixed(1)}%)</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handleVoltar}
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando || itensInformados === 0}
            className="gap-2"
            size="lg"
          >
            {salvando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Salvar Cotação ({itensInformados} {itensInformados === 1 ? 'item' : 'itens'})
              </>
            )}
          </Button>
        </div>

        {/* ✅ NOVO: Dialog de Link */}
        <Dialog open={dialogLinkOpen} onOpenChange={setDialogLinkOpen}>
          <DialogContent className="sm:max-w-[500px]" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Link className="h-5 w-5 text-blue-600" />
                Link de Compra do Produto
              </DialogTitle>
              <DialogDescription>
                {itemLinkIndex !== null && (
                  <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Item:</div>
                    <div className="font-medium">{cotacoes[itemLinkIndex]?.codigo}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-400 truncate">
                      {cotacoes[itemLinkIndex]?.descricao}
                    </div>
                  </div>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="link">URL do Produto</Label>
                <Input
                  id="link"
                  type="url"
                  value={linkTemp}
                  onChange={(e) => setLinkTemp(e.target.value)}
                  placeholder="https://exemplo.com/produto"
                  className="w-full"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      salvarLink();
                    }
                  }}
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cole aqui o link do produto no site do fornecedor para facilitar futuras compras.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setDialogLinkOpen(false);
                  setLinkTemp('');
                }}
              >
                Cancelar
              </Button>
              {linkTemp && linkTemp.trim() && (
                <Button
                  variant="outline"
                  onClick={() => {
                    atualizarCotacao(itemLinkIndex!, 'link', '');
                    setDialogLinkOpen(false);
                    setLinkTemp('');
                    toast.success('Link removido!');
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  Remover Link
                </Button>
              )}
              <Button onClick={salvarLink}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}