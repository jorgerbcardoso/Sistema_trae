import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';
import { Loader2, Save, DollarSign, CreditCard, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import {
  MOCK_ORCAMENTO_ORDENS,
  MOCK_ORDENS_COMPRA,
  MOCK_ORDEM_COMPRA_ITENS,
  MOCK_ORCAMENTO_COTACOES,
  MOCK_ORCAMENTO_FORNECEDORES
} from '../../utils/estoqueModData';

interface ItemCotacao {
  seq_ordem_compra_item: number;
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_item: number;
  nro_ordem_compra: string;
  unidade_ordem: string;
  vlr_fornecedor?: number;
}

interface DialogPreenchimentoPrecosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seq_orcamento: number;
  seq_fornecedor: number;
  fornecedor_nome: string;
  onSalvoComSucesso?: () => void;
  ordensSelecionadas?: any[]; // 🆕 Receber ordens do formulário
}

export function DialogPreenchimentoPrecos({
  open,
  onOpenChange,
  seq_orcamento,
  seq_fornecedor,
  fornecedor_nome,
  onSalvoComSucesso,
  ordensSelecionadas
}: DialogPreenchimentoPrecosProps) {
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [itens, setItens] = useState<ItemCotacao[]>([]);
  const [precos, setPrecos] = useState<Record<number, string>>({});
  
  // ✅ NOVO: Estados para condição de pagamento e previsão de entrega
  const [condicaoPgto, setCondicaoPgto] = useState('');
  const [dataPrevEnt, setDataPrevEnt] = useState('');

  useEffect(() => {
    if (open) {
      carregarItens();
    }
  }, [open, seq_orcamento, seq_fornecedor]);

  const carregarItens = async () => {
    setLoading(true);
    
    // ✅ RESETAR estados antes de carregar
    setItens([]);
    setPrecos({});
    setCondicaoPgto('');
    setDataPrevEnt('');
    
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK - Buscar itens do orçamento
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 🆕 Se há ordens passadas como prop (orçamento não salvo), usar elas
        if (ordensSelecionadas && ordensSelecionadas.length > 0) {
          console.log('🎯 USANDO ORDENS PASSADAS COMO PROP:', ordensSelecionadas);
          
          const itensFormatados = ordensSelecionadas
            .map(ordem => {
              return (ordem.itens || []).map((item: any) => {
                // Buscar cotação existente (se orçamento já foi salvo)
                const cotacao = seq_orcamento > 0 ? MOCK_ORCAMENTO_COTACOES.find(
                  c => c.seq_orcamento === seq_orcamento &&
                       c.seq_fornecedor === seq_fornecedor &&
                       c.seq_item === item.seq_item
                ) : null;
                
                return {
                  seq_ordem_compra_item: item.seq_item, // Usar seq_item como chave temporária
                  seq_item: item.seq_item,
                  codigo: item.codigo,
                  descricao: item.descricao,
                  unidade_medida: item.unidade_medida,
                  qtde_item: item.qtde_item,
                  nro_ordem_compra: ordem.nro_ordem_compra,
                  unidade_ordem: ordem.unidade_ordem,
                  vlr_fornecedor: cotacao?.vlr_fornecedor
                };
              });
            })
            .flat();
          
          console.log('🎯 ITENS FORMATADOS:', itensFormatados);
          setItens(itensFormatados);
          
          // Preencher preços já informados
          const precosIniciais: Record<number, string> = {};
          itensFormatados.forEach(item => {
            if (item.vlr_fornecedor !== null && item.vlr_fornecedor !== undefined) {
              // ✅ Converter para número antes de aplicar toFixed
              precosIniciais[item.seq_ordem_compra_item] = parseFloat(item.vlr_fornecedor).toFixed(2);
            }
          });
          setPrecos(precosIniciais);
          
          setLoading(false);
          return;
        }
        
        // Caso contrário, buscar do banco (orçamento já salvo)
        const ordensVinculadas = MOCK_ORCAMENTO_ORDENS
          .filter(oo => oo.seq_orcamento === seq_orcamento)
          .map(oo => {
            const ordem = MOCK_ORDENS_COMPRA.find(o => o.seq_ordem_compra === oo.seq_ordem_compra);
            if (!ordem) return null;
            
            // Buscar itens da ordem
            const itensOrdem = MOCK_ORDEM_COMPRA_ITENS
              .filter(oi => oi.seq_ordem_compra === ordem.seq_ordem_compra)
              .map(oi => {
                // Buscar cotação existente
                const cotacao = MOCK_ORCAMENTO_COTACOES.find(
                  c => c.seq_orcamento === seq_orcamento &&
                       c.seq_fornecedor === seq_fornecedor &&
                       c.seq_item === oi.seq_item
                );
                
                return {
                  seq_ordem_compra_item: oi.seq_ordem_item,
                  seq_item: oi.seq_item,
                  codigo: oi.codigo,
                  descricao: oi.descricao,
                  unidade_medida: oi.unidade_medida,
                  qtde_item: oi.qtde_item,
                  nro_ordem_compra: ordem.nro_ordem_compra,
                  unidade_ordem: ordem.unidade_ordem,
                  vlr_fornecedor: cotacao?.vlr_fornecedor
                };
              });
            
            return itensOrdem;
          })
          .filter(i => i !== null)
          .flat() as ItemCotacao[];
        
        console.log('🎯 ITENS CARREGADOS DO BANCO:', ordensVinculadas);
        setItens(ordensVinculadas);
        
        // Preencher preços já informados
        const precosIniciais: Record<number, string> = {};
        ordensVinculadas.forEach(item => {
          if (item.vlr_fornecedor !== null && item.vlr_fornecedor !== undefined) {
            // ✅ Converter para número antes de aplicar toFixed
            precosIniciais[item.seq_ordem_compra_item] = parseFloat(item.vlr_fornecedor).toFixed(2);
          }
        });
        setPrecos(precosIniciais);
        
        // ✅ NOVO: Carregar condição de pagamento e data prevista de entrega (se já existir)
        const orcFornecedor = MOCK_ORCAMENTO_FORNECEDORES.find(
          f => f.seq_orcamento === seq_orcamento && f.seq_fornecedor === seq_fornecedor
        );
        if (orcFornecedor) {
          setCondicaoPgto(orcFornecedor.condicao_pgto || '');
          setDataPrevEnt(orcFornecedor.data_prev_ent || '');
        }
      } else {
        // BACKEND - Buscar itens do orçamento para o fornecedor
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php?action=itens-cotacao&seq_orcamento=${seq_orcamento}&seq_fornecedor=${seq_fornecedor}`,
          { method: 'GET' }
        );

        console.log('🔍 DADOS RECEBIDOS DA API:', data);
        console.log('🔍 Total de itens:', data.data?.length);
        console.log('🔍 Primeiro item:', data.data?.[0]);
        console.log('🔍 Dados do fornecedor:', data.fornecedor);

        if (data.success) {
          setItens(data.data || []);
          
          // ✅ Preencher preços já informados (converter string para número)
          const precosIniciais: Record<number, string> = {};
          data.data.forEach((item: ItemCotacao) => {
            if (item.vlr_fornecedor !== null && item.vlr_fornecedor !== undefined) {
              // ✅ Converter para número antes de aplicar toFixed
              precosIniciais[item.seq_ordem_compra_item] = parseFloat(item.vlr_fornecedor as any).toFixed(2);
            }
          });
          setPrecos(precosIniciais);
          
          // ✅ NOVO: Carregar condição de pagamento e data prevista de entrega do fornecedor
          if (data.fornecedor) {
            setCondicaoPgto(data.fornecedor.condicao_pgto || '');
            setDataPrevEnt(data.fornecedor.data_prev_ent || '');
            console.log('🔍 Condição pgto carregada:', data.fornecedor.condicao_pgto);
            console.log('🔍 Data prev ent carregada:', data.fornecedor.data_prev_ent);
          }
          
          console.log('🔍 Preços iniciais:', precosIniciais);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      toast.error('Erro ao carregar itens para cotação');
    } finally {
      setLoading(false);
    }
  };

  const atualizarPreco = (seq_ordem_compra_item: number, valor: string) => {
    setPrecos(prev => ({
      ...prev,
      [seq_ordem_compra_item]: valor
    }));
  };

  const handleSalvar = async () => {
    // ✅ NOVO: Validar condição de pagamento e data prevista
    if (!condicaoPgto || condicaoPgto.trim() === '') {
      toast.error('Informe a condição de pagamento');
      return;
    }

    if (!dataPrevEnt || dataPrevEnt.trim() === '') {
      toast.error('Informe a previsão de entrega');
      return;
    }

    try {
      setSalvando(true);

      // Preparar dados para envio
      const itensParaSalvar = itens.map(item => ({
        seq_item: item.seq_item,
        seq_ordem_compra_item: item.seq_ordem_compra_item,
        vlr_fornecedor: precos[item.seq_ordem_compra_item] ? parseFloat(precos[item.seq_ordem_compra_item]) : null
      }));

      const response = await apiFetch(
        `${ENVIRONMENT.apiBaseUrl}/compras/orcamentos_full.php`,
        {
          method: 'PUT',
          body: JSON.stringify({
            action: 'salvar-cotacao',
            seq_orcamento: seq_orcamento,
            seq_fornecedor: seq_fornecedor,
            condicao_pgto: condicaoPgto.trim().toUpperCase(),
            data_prev_ent: dataPrevEnt,
            itens: itensParaSalvar
          })
        }
      );

      if (response.success) {
        toast.success('Preços salvos com sucesso!');
        if (onSalvoComSucesso) {
          onSalvoComSucesso();
        }
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Erro ao salvar preços:', error);
      toast.error('Erro ao salvar preços');
    } finally {
      setSalvando(false);
    }
  };

  const formatarNumeroOrdemCompra = (item: ItemCotacao) => {
    // Formato: XXX000000 (unidade + número com 6 dígitos)
    const numero = String(item.nro_ordem_compra).padStart(6, '0');
    return `${item.unidade_ordem}${numero}`;
  };

  const calcularTotal = () => {
    return itens.reduce((total, item) => {
      const preco = precos[item.seq_ordem_compra_item];
      if (preco && parseFloat(preco) > 0) {
        return total + (parseFloat(preco) * item.qtde_item);
      }
      return total;
    }, 0);
  };

  const contarItensPreenchidos = () => {
    return Object.values(precos).filter(p => p && parseFloat(p) > 0).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Preencher Preços - {fornecedor_nome}</DialogTitle>
          <DialogDescription>
            Informe o valor unitário para cada item da cotação
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="size-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {/* Indicador de progresso */}
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 flex-shrink-0">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Progresso: <strong>{contarItensPreenchidos()} / {itens.length}</strong> itens preenchidos
                    </span>
                    <span className="text-sm font-bold text-green-600">
                      Total: R$ {calcularTotal().toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* ✅ NOVO: Condições da Cotação */}
              <Card className="border-2 border-blue-200 dark:border-blue-900 flex-shrink-0">
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="condicao_pgto" className="flex items-center gap-2 mb-1">
                        <CreditCard className="size-4" />
                        Condição de Pagamento <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="condicao_pgto"
                        value={condicaoPgto}
                        onChange={(e) => setCondicaoPgto(e.target.value.toUpperCase())}
                        placeholder="Ex: 30 DIAS, À VISTA, 15/30 DIAS"
                        maxLength={50}
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
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Tabela de itens */}
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Código</TableHead>
                      <TableHead className="min-w-[250px]">Descrição</TableHead>
                      <TableHead className="min-w-[100px]">OC</TableHead>
                      <TableHead className="text-center min-w-[70px]">Unid.</TableHead>
                      <TableHead className="text-right min-w-[90px]">Qtd.</TableHead>
                      <TableHead className="min-w-[150px]">Valor Unit. (R$)</TableHead>
                      <TableHead className="text-right min-w-[120px]">Valor Total (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                          Nenhum item encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      itens.map((item) => {
                        const preco = precos[item.seq_ordem_compra_item] || '';
                        const qtde = parseFloat(item.qtde_item?.toString() || '0');
                        const vlrTotal = preco ? parseFloat(preco) * qtde : 0;
                        
                        return (
                          <TableRow key={item.seq_ordem_compra_item}>
                            <TableCell className="font-medium">{item.codigo || '-'}</TableCell>
                            <TableCell>{item.descricao || '-'}</TableCell>
                            <TableCell className="text-sm text-gray-500">{formatarNumeroOrdemCompra(item)}</TableCell>
                            <TableCell className="text-center">{item.unidade_medida || '-'}</TableCell>
                            <TableCell className="text-right">{qtde.toFixed(2)}</TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={preco}
                                onChange={(e) => atualizarPreco(item.seq_ordem_compra_item, e.target.value)}
                                placeholder="0.00"
                                className="text-right w-full"
                              />
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {vlrTotal > 0 ? vlrTotal.toFixed(2) : '-'}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter className="flex-shrink-0 mt-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <DollarSign className="size-5" />
                  <span className="font-bold text-lg">
                    Total da Cotação: R$ {calcularTotal().toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={salvando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSalvar}
                    disabled={salvando || contarItensPreenchidos() === 0}
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
                        Salvar Preços ({contarItensPreenchidos()})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}