import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Loader2, Save, DollarSign, Link, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ItemCotacao {
  seq_item: number;
  seq_ordem_compra: number;
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

interface ModalColetaPrecosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fornecedor: {
    seq_fornecedor: number;
    nome: string;
  };
  itens: ItemCotacao[];
  onSalvar: (cotacoes: any[]) => Promise<void>;
}

export function ModalColetaPrecos({
  open,
  onOpenChange,
  fornecedor,
  itens,
  onSalvar
}: ModalColetaPrecosProps) {
  const [cotacoes, setCotacoes] = useState<ItemCotacao[]>([]);
  const [salvando, setSalvando] = useState(false);
  
  // ✅ NOVO: Estado do dialog de link
  const [dialogLinkOpen, setDialogLinkOpen] = useState(false);
  const [itemLinkIndex, setItemLinkIndex] = useState<number | null>(null);
  const [linkTemp, setLinkTemp] = useState('');

  useEffect(() => {
    if (open) {
      // Inicializar cotações com os valores existentes ou vazios
      setCotacoes(itens.map(item => ({
        ...item,
        vlr_fornecedor: item.vlr_fornecedor || 0,
        observacao: item.observacao || '',
        link: item.link || '' // ✅ NOVO: inicializar link
      })));
    }
  }, [open, itens]);

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

    setSalvando(true);
    try {
      const cotacoesParaSalvar = cotacoesComPreco.map(cot => ({
        seq_ordem_compra: cot.seq_ordem_compra,
        seq_item: cot.seq_item,
        qtde_item: cot.qtde_item,
        vlr_estoque: cot.vlr_estoque,
        vlr_fornecedor: cot.vlr_fornecedor || 0,
        vlr_total: (cot.vlr_fornecedor || 0) * cot.qtde_item,
        observacao: cot.observacao?.trim().toUpperCase() || '',
        link: cot.link || ''
      }));

      await onSalvar(cotacoesParaSalvar);
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar cotação:', error);
    } finally {
      setSalvando(false);
    }
  };

  const calcularEconomia = (vlr_estoque: number, vlr_fornecedor: number) => {
    if (!vlr_fornecedor || vlr_fornecedor <= 0) return null;
    
    const economia = vlr_estoque - vlr_fornecedor;
    const percentual = (economia / vlr_estoque) * 100;
    
    return { economia, percentual };
  };

  const totalEstoque = cotacoes.reduce((sum, cot) => sum + (cot.vlr_estoque * cot.qtde_item), 0);
  const totalFornecedor = cotacoes.reduce((sum, cot) => sum + ((cot.vlr_fornecedor || 0) * cot.qtde_item), 0);
  const economiaTotal = totalEstoque - totalFornecedor;
  const percentualEconomia = totalEstoque > 0 ? (economiaTotal / totalEstoque) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="size-5 text-green-600" />
            Coleta de Preços - {fornecedor.nome}
          </DialogTitle>
          <DialogDescription>
            Informe os valores cotados pelo fornecedor. Deixe em branco os itens que o fornecedor não possui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tabela de Itens */}
          <div className="rounded-md border border-border">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {cotacoes.map((cotacao, index) => {
                  const economia = calcularEconomia(cotacao.vlr_estoque, cotacao.vlr_fornecedor || 0);
                  const temLink = cotacao.link && cotacao.link.trim().length > 0;
                  
                  return (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{cotacao.codigo}</TableCell>
                      <TableCell className="max-w-xs truncate">{cotacao.descricao}</TableCell>
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
                        <Input
                          type="number"
                          value={cotacao.vlr_fornecedor || ''}
                          onChange={(e) => atualizarCotacao(index, 'vlr_fornecedor', Number(e.target.value))}
                          placeholder="0,00"
                          step="0.01"
                          min="0"
                          className="w-32 text-right"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        {economia && (
                          <span className={economia.economia >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                            {economia.economia >= 0 ? '+' : ''}{economia.percentual.toFixed(1)}%
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Resumo */}
          <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Valor Estoque:</span>
              <span className="font-bold text-lg">R$ {totalEstoque.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-medium">Total Valor Fornecedor:</span>
              <span className="font-bold text-lg text-blue-600">R$ {totalFornecedor.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="font-bold">Economia/Acréscimo:</span>
              <span className={`font-bold text-xl ${economiaTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {economiaTotal >= 0 ? '+' : ''}R$ {economiaTotal.toFixed(2)} ({percentualEconomia.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Observações Gerais */}
          <div>
            <Label>Observações Gerais da Cotação</Label>
            <Textarea
              placeholder="INFORMAÇÕES ADICIONAIS..."
              rows={2}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando} className="gap-2">
            {salvando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="size-4" />
                Salvar Cotação
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

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
    </Dialog>
  );
}