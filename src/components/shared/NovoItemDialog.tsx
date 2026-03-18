import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Loader2, CheckCircle, X, Package, PackagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { FilterSelectEstoque } from './FilterSelectEstoque';

interface TipoItem {
  seq_tipo_item: number;
  descricao: string;
}

interface UnidadeMedida {
  seq_unidade_medida: number;
  descricao: string;
  sigla: string;
}

interface NovoItemData {
  seq_item: number;
  codigo: string;
  codigo_fabricante?: string;
  descricao: string;
  seq_tipo_item?: number;
  seq_unidade_medida?: number;
  vlr_item: number;
  estoque_minimo: number;
  estoque_maximo: number;
  ativo: string;
}

interface NovoItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onItemCriado: (item: NovoItemData) => void;
}

export function NovoItemDialog({ open, onOpenChange, onItemCriado }: NovoItemDialogProps) {
  const [salvando, setSalvando] = useState(false);
  const [tipos, setTipos] = useState<TipoItem[]>([]);
  const [unidades, setUnidades] = useState<UnidadeMedida[]>([]);

  // Form data
  const [codigo, setCodigo] = useState('');
  const [codigoFabricante, setCodigoFabricante] = useState('');
  const [descricao, setDescricao] = useState('');
  const [seqTipoItem, setSeqTipoItem] = useState('');
  const [seqUnidadeMedida, setSeqUnidadeMedida] = useState('');
  const [vlrItem, setVlrItem] = useState('0.00');
  const [estoqueMinimo, setEstoqueMinimo] = useState('0.00');
  const [estoqueMaximo, setEstoqueMaximo] = useState('0.00');

  // Dialog de adicionar a estoque
  const [dialogEstoqueOpen, setDialogEstoqueOpen] = useState(false);
  const [itemCriado, setItemCriado] = useState<NovoItemData | null>(null);
  const [seqEstoque, setSeqEstoque] = useState('');
  const [qtdeItem, setQtdeItem] = useState('');
  const [salvandoPosicao, setSalvandoPosicao] = useState(false);

  useEffect(() => {
    if (open) {
      carregarTipos();
      carregarUnidades();
      limparFormulario();
    }
  }, [open]);

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

  const limparFormulario = () => {
    setCodigo('');
    setCodigoFabricante('');
    setDescricao('');
    setSeqTipoItem('');
    setSeqUnidadeMedida('');
    setVlrItem('0.00');
    setEstoqueMinimo('0.00');
    setEstoqueMaximo('0.00');
  };

  const handleSalvar = async () => {
    // Validações
    if (!codigo.trim()) {
      toast.error('Código do item é obrigatório');
      return;
    }

    if (!descricao.trim()) {
      toast.error('Descrição do item é obrigatória');
      return;
    }

    setSalvando(true);
    try {
      const payload = {
        codigo: codigo.trim(),
        codigo_fabricante: codigoFabricante.trim() || null,
        descricao: descricao.trim(),
        seq_tipo_item: seqTipoItem === '0' || !seqTipoItem ? null : parseInt(seqTipoItem),
        seq_unidade_medida: seqUnidadeMedida === '0' || !seqUnidadeMedida ? null : parseInt(seqUnidadeMedida),
        vlr_item: parseFloat(vlrItem),
        estoque_minimo: parseFloat(estoqueMinimo),
        estoque_maximo: parseFloat(estoqueMaximo)
      };

      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/itens.php`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data.success && data.item) {
        // Item criado com sucesso
        setItemCriado(data.item);
        
        // Notificar tela pai
        onItemCriado(data.item);
        
        // Fechar dialog principal
        onOpenChange(false);
        
        // Limpar formulário
        limparFormulario();

        // Abrir dialog de adicionar a estoque
        setDialogEstoqueOpen(true);
      }
    } catch (error) {
      console.error('Erro ao criar item:', error);
      toast.error('Erro de comunicação com o servidor');
    } finally {
      setSalvando(false);
    }
  };

  const handleAdicionarAEstoque = async () => {
    if (!seqEstoque) {
      toast.error('Selecione um estoque');
      return;
    }

    if (!qtdeItem || parseFloat(qtdeItem) <= 0) {
      toast.error('Informe uma quantidade válida');
      return;
    }

    setSalvandoPosicao(true);
    try {
      const payload = {
        seq_item: itemCriado?.seq_item,
        seq_estoque: parseInt(seqEstoque),
        rua: 'PSO',
        altura: 1,
        coluna: 1,
        qtde_item: parseFloat(qtdeItem)
      };

      const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/posicoes.php`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data.success) {
        toast.success(`Item ${itemCriado?.codigo} adicionado ao estoque com sucesso!`);
        setDialogEstoqueOpen(false);
        setSeqEstoque('');
        setQtdeItem('');
        setItemCriado(null);
      }
    } catch (error) {
      console.error('Erro ao adicionar item ao estoque:', error);
      toast.error('Erro de comunicação com o servidor');
    } finally {
      setSalvandoPosicao(false);
    }
  };

  const handlePularEstoque = () => {
    toast.success(`Item ${itemCriado?.codigo} criado com sucesso!`);
    setDialogEstoqueOpen(false);
    setSeqEstoque('');
    setQtdeItem('');
    setItemCriado(null);
  };

  const handleClose = () => {
    if (!salvando) {
      limparFormulario();
      onOpenChange(false);
    }
  };

  return (
    <>
      {/* Dialog principal - Criar Item */}
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Novo Item
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do novo item de estoque.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Código */}
            <div className="grid gap-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ex: ITM001"
                disabled={salvando}
                className="uppercase"
              />
            </div>

            {/* Código Fabricante */}
            <div className="grid gap-2">
              <Label htmlFor="codigo-fabricante">Código Fabricante</Label>
              <Input
                id="codigo-fabricante"
                value={codigoFabricante}
                onChange={(e) => setCodigoFabricante(e.target.value)}
                placeholder="Código do fabricante (opcional)"
                disabled={salvando}
                className="uppercase"
              />
            </div>

            {/* Descrição */}
            <div className="grid gap-2">
              <Label htmlFor="descricao">Descrição *</Label>
              <Input
                id="descricao"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descrição do item"
                disabled={salvando}
                className="uppercase"
              />
            </div>

            {/* Grid de 2 colunas */}
            <div className="grid grid-cols-2 gap-4">
              {/* Tipo de Item */}
              <div className="grid gap-2">
                <Label htmlFor="tipo">Tipo de Item</Label>
                <Select
                  value={seqTipoItem}
                  onValueChange={setSeqTipoItem}
                  disabled={salvando}
                >
                  <SelectTrigger id="tipo">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Nenhum</SelectItem>
                    {tipos.map((tipo) => (
                      <SelectItem key={tipo.seq_tipo_item} value={String(tipo.seq_tipo_item)}>
                        {tipo.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Unidade de Medida */}
              <div className="grid gap-2">
                <Label htmlFor="unidade">Unidade de Medida</Label>
                <Select
                  value={seqUnidadeMedida}
                  onValueChange={setSeqUnidadeMedida}
                  disabled={salvando}
                >
                  <SelectTrigger id="unidade">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Nenhuma</SelectItem>
                    {unidades.map((unidade) => (
                      <SelectItem key={unidade.seq_unidade_medida} value={String(unidade.seq_unidade_medida)}>
                        {unidade.descricao} ({unidade.sigla})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grid de 3 colunas */}
            <div className="grid grid-cols-3 gap-4">
              {/* Valor */}
              <div className="grid gap-2">
                <Label htmlFor="valor">Valor (opcional)</Label>
                <Input
                  id="valor"
                  type="number"
                  step="0.01"
                  value={vlrItem}
                  onChange={(e) => setVlrItem(e.target.value)}
                  disabled={salvando}
                />
              </div>

              {/* Estoque Mínimo */}
              <div className="grid gap-2">
                <Label htmlFor="est-min">Est. Mínimo (opcional)</Label>
                <Input
                  id="est-min"
                  type="number"
                  step="0.01"
                  value={estoqueMinimo}
                  onChange={(e) => setEstoqueMinimo(e.target.value)}
                  disabled={salvando}
                />
              </div>

              {/* Estoque Máximo */}
              <div className="grid gap-2">
                <Label htmlFor="est-max">Est. Máximo (opcional)</Label>
                <Input
                  id="est-max"
                  type="number"
                  step="0.01"
                  value={estoqueMaximo}
                  onChange={(e) => setEstoqueMaximo(e.target.value)}
                  disabled={salvando}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={salvando}
            >
              <X className="size-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <CheckCircle className="size-4 mr-2" />
                  Criar Item
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog - Adicionar a Estoque */}
      <Dialog open={dialogEstoqueOpen} onOpenChange={setDialogEstoqueOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackagePlus className="size-5" />
              Item {itemCriado?.codigo} criado!
            </DialogTitle>
            <DialogDescription>
              Deseja adicionar este item a um estoque agora?
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Estoque */}
            <div className="grid gap-2">
              <FilterSelectEstoque
                value={seqEstoque}
                onChange={setSeqEstoque}
                label="Estoque *"
                placeholder="Selecione o estoque..."
                disabled={salvandoPosicao}
              />
              <p className="text-xs text-gray-500">
                O item será adicionado na posição <strong>PSO/1/1</strong>
              </p>
            </div>

            {/* Quantidade */}
            <div className="grid gap-2">
              <Label htmlFor="qtde">Quantidade (Saldo) *</Label>
              <Input
                id="qtde"
                type="number"
                step="0.01"
                value={qtdeItem}
                onChange={(e) => setQtdeItem(e.target.value)}
                placeholder="Ex: 10"
                disabled={salvandoPosicao}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handlePularEstoque}
              disabled={salvandoPosicao}
            >
              Pular
            </Button>
            <Button onClick={handleAdicionarAEstoque} disabled={salvandoPosicao}>
              {salvandoPosicao ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <PackagePlus className="size-4 mr-2" />
                  Adicionar ao Estoque
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
