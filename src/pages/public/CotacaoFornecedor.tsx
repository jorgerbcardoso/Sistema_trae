import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
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
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Package,
  Save,
  Send,
  CreditCard,
  CalendarClock
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { formatCurrency, formatNumber, parseBrazilianNumber } from '../../utils/formatters';

interface ItemCotacao {
  seq_ordem_compra_item: number;
  seq_item: number;
  seq_ordem_compra: number; // ✅ Adicionar para chave única
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_item: number;
  nro_ordem_compra: string;
  unidade_ordem: string;
  nro_centro_custo: string;
  centro_custo_descricao: string;
  vlr_fornecedor?: number;
}

interface DadosOrcamento {
  nro_orcamento: string;
  unidade: string;
  fornecedor: string;
  observacao?: string;
  validade: string;
  status_fornecedor: string;
  itens: ItemCotacao[];
  domain: string;
  condicao_pgto?: string; // ✅ NOVO
  data_prev_ent?: string; // ✅ NOVO
  nome_empresa?: string; // ✅ NOVO: Nome da empresa (domains.name)
}

export default function CotacaoFornecedor() {
  usePageTitle('Cotação de Fornecedor - Sistema Presto');
  
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const codigoParam = searchParams.get('codigo');
  
  const [codigo, setCodigo] = useState(codigoParam || '');
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [validado, setValidado] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [jaFinalizado, setJaFinalizado] = useState(false); // ✅ Novo estado
  
  const [dados, setDados] = useState<DadosOrcamento | null>(null);
  const [precos, setPrecos] = useState<Record<string, string>>({});  // ✅ Alterado para string (chave composta)
  
  // ✅ NOVO: Estados para condição de pagamento e previsão de entrega
  const [condicaoPgto, setCondicaoPgto] = useState('');
  const [dataPrevEnt, setDataPrevEnt] = useState('');

  // ✅ FUNÇÃO AUXILIAR: Gerar chave única para cada item (seq_ordem_compra_item)
  // ATENÇÃO: seq_ordem_compra_item já é único! Não precisa compor chave!
  const getChaveItem = (item: ItemCotacao): number => {
    return item.seq_ordem_compra_item;
  };

  // Formatar número do orçamento como XXX000000
  const formatarNumeroOrcamento = () => {
    if (!dados) return '';
    const nroFormatado = dados.nro_orcamento.toString().padStart(6, '0');
    return `${dados.unidade}${nroFormatado}`;
  };

  useEffect(() => {
    if (codigoParam) {
      validarCodigo();
    }
  }, []);

  const validarCodigo = async () => {
    if (!codigo.trim()) {
      toast.error('Informe o código de acesso');
      return;
    }

    setLoading(true);
    try {
      const url = `${ENVIRONMENT.apiBaseUrl}/compras/cotacao_fornecedor.php?codigo=${encodeURIComponent(codigo.toUpperCase())}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        toast.error(errorData.error || 'Erro ao validar código de acesso');
        return;
      }

      const data = await response.json();

      if (data.success) {
        console.log('📦 [CotacaoFornecedor] Dados recebidos:', data); // ✅ DEBUG
        console.log('🏢 [CotacaoFornecedor] Nome da empresa:', data.nome_empresa); // ✅ DEBUG
        
        setDados(data);
        setValidado(true);
        
        // ✅ Carregar condição de pagamento e previsão de entrega (se já existir)
        setCondicaoPgto(data.condicao_pgto || '');
        setDataPrevEnt(data.data_prev_ent || '');
        
        // Preencher preços já informados
        const precosIniciais: Record<string, string> = {};
        data.itens.forEach((item: ItemCotacao) => {
          if (item.vlr_fornecedor !== null && item.vlr_fornecedor !== undefined) {
            precosIniciais[getChaveItem(item).toString()] = formatNumber(parseFloat(item.vlr_fornecedor));
          }
        });
        setPrecos(precosIniciais);
        
        toast.success('Código validado com sucesso!');
        
        // Verificar se a cotação já foi finalizada
        if (data.status_fornecedor === 'CONCLUIDO') {
          setJaFinalizado(true);
        }
      } else {
        toast.error(data.error || 'Código inválido');
      }
    } catch (error) {
      console.error('Erro ao validar código:', error);
      toast.error('Erro ao validar código de acesso');
    } finally {
      setLoading(false);
    }
  };

  const atualizarPreco = (seq_ordem_compra_item: number, valor: string) => {
    // Remover formatação e permitir apenas números, vírgula e ponto
    const valorLimpo = valor.replace(/[^\d,]/g, '');
    setPrecos(prev => ({
      ...prev,
      [seq_ordem_compra_item.toString()]: valorLimpo
    }));
  };

  const salvarPrecos = async () => {
    if (Object.keys(precos).length === 0) {
      toast.error('Informe ao menos um preço');
      return;
    }

    setSalvando(true);
    try {
      const precosArray = Object.entries(precos)
        .filter(([_, valor]) => valor && parseBrazilianNumber(valor) > 0)
        .map(([seq_ordem_compra_item, valor]) => ({
          seq_ordem_compra_item: parseInt(seq_ordem_compra_item),
          vlr_fornecedor: parseBrazilianNumber(valor)
        }));

      if (precosArray.length === 0) {
        toast.error('Informe preços válidos');
        setSalvando(false);
        return;
      }

      const response = await fetch(
        `${ENVIRONMENT.apiBaseUrl}/compras/cotacao_fornecedor.php`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            codigo: codigo.toUpperCase(),
            precos: precosArray
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Preços salvos com sucesso!');
      } else {
        toast.error(data.message || 'Erro ao salvar preços');
      }
    } catch (error) {
      console.error('Erro ao salvar preços:', error);
      toast.error('Erro ao salvar preços');
    } finally {
      setSalvando(false);
    }
  };

  const finalizarCotacao = async () => {
    // ✅ NOVO: Validar condição de pagamento e data prevista
    if (!condicaoPgto || condicaoPgto.trim() === '') {
      toast.error('Informe a condição de pagamento');
      return;
    }

    if (!dataPrevEnt || dataPrevEnt.trim() === '') {
      toast.error('Informe a previsão de entrega');
      return;
    }

    // Verificar se todos os itens têm preço
    const itensSemPreco = dados?.itens.filter(item => {
      const preco = precos[getChaveItem(item).toString()];
      return !preco || parseBrazilianNumber(preco) <= 0;
    });

    if (itensSemPreco && itensSemPreco.length > 0) {
      toast.error(`Existem ${itensSemPreco.length} item(ns) sem preço informado`);
      return;
    }

    // Salvar antes de finalizar
    await salvarPrecos();

    setFinalizando(true);
    try {
      const response = await fetch(
        `${ENVIRONMENT.apiBaseUrl}/compras/cotacao_fornecedor.php`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            codigo: codigo.toUpperCase(),
            condicao_pgto: condicaoPgto.trim().toUpperCase(), // ✅ NOVO
            data_prev_ent: dataPrevEnt // ✅ NOVO
          })
        }
      );

      const data = await response.json();

      if (data.success) {
        toast.success('Cotação finalizada com sucesso!');
        setFinalizado(true);
      } else {
        toast.error(data.message || 'Erro ao finalizar cotação');
      }
    } catch (error) {
      console.error('Erro ao finalizar cotação:', error);
      toast.error('Erro ao finalizar cotação');
    } finally {
      setFinalizando(false);
    }
  };

  const calcularTotal = () => {
    if (!dados) return 0;
    
    return dados.itens.reduce((total, item) => {
      const preco = precos[getChaveItem(item).toString()];
      if (preco && parseBrazilianNumber(preco) > 0) {
        return total + (parseBrazilianNumber(preco) * item.qtde_item);
      }
      return total;
    }, 0);
  };

  const contarItensPreenchidos = () => {
    return Object.values(precos).filter(p => p && parseBrazilianNumber(p) > 0).length;
  };

  // Tela de finalização
  if (finalizado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl shadow-xl">
          <CardContent className="pt-12 pb-12 text-center">
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full mb-4">
                <CheckCircle2 className="size-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Cotação Finalizada!
            </h1>
            
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
              Sua cotação foi enviada com sucesso.
            </p>
            
            <p className="text-gray-500 dark:text-gray-400 mb-8">
              O responsável pelo orçamento foi notificado por email.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Orçamento:</strong> {formatarNumeroOrcamento()}
              </p>
              <p className="text-sm text-blue-900 dark:text-blue-100 mt-1">
                <strong>Fornecedor:</strong> {dados?.fornecedor}
              </p>
              <p className="text-sm text-blue-900 dark:text-blue-100 mt-1">
                <strong>Itens cotados:</strong> {dados?.itens.length}
              </p>
              <p className="text-sm text-blue-900 dark:text-blue-100 mt-1">
                <strong>Valor total:</strong> {formatCurrency(calcularTotal())}
              </p>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Obrigado pela sua participação!<br />
              Você pode fechar esta janela.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela de validação de código
  if (!validado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mx-auto mb-4">
              <ShieldCheck className="size-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">Acesso de Fornecedor</CardTitle>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Sistema Presto - Cotação de Orçamento
            </p>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Código de Acesso</Label>
                <Input
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Digite o código recebido por email"
                  className="text-center font-mono text-lg tracking-widest"
                  maxLength={8}
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-2">
                  * Informe o código de 8 caracteres recebido por email
                </p>
              </div>

              <Button
                onClick={validarCodigo}
                disabled={loading || !codigo.trim()}
                className="w-full gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="size-4" />
                    Validar e Acessar
                  </>
                )}
              </Button>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                <AlertCircle className="size-4 mt-0.5 flex-shrink-0" />
                <p>
                  Este acesso é restrito para fornecedores participantes do processo de cotação.
                  Caso não tenha recebido o código, entre em contato com o responsável.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Tela principal de preenchimento
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-gray-900 dark:text-white header-title-reduced uppercase">
                {dados?.nome_empresa ? `${dados.nome_empresa} - Cotação de Orçamento` : 'Cotação de Orçamento'}
              </h1>
              <p className="text-gray-500 dark:text-gray-400 header-subtitle-reduced">
                {formatarNumeroOrcamento()} • {dados?.fornecedor}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Progresso</p>
                <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {contarItensPreenchidos()} / {dados?.itens.length || 0} itens
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Informações do Orçamento */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Informações do Orçamento
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Número do Orçamento</Label>
                <p className="font-bold">{formatarNumeroOrcamento()}</p>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Fornecedor</Label>
                <p className="font-bold">{dados?.fornecedor}</p>
              </div>
            </div>
            
            {dados?.observacao && (
              <div>
                <Label className="text-xs text-gray-500">Observações</Label>
                <p className="text-sm">{dados.observacao}</p>
              </div>
            )}
            
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
              <AlertCircle className="size-4 flex-shrink-0" />
              <span>
                Código válido até: <strong>{new Date(dados?.validade || '').toLocaleDateString('pt-BR')}</strong>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Alerta: Cotação já finalizada (mas pode editar) */}
        {jaFinalizado && (
          <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-green-900 dark:text-green-100">
                    Cotação já finalizada anteriormente
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                    Você já enviou esta cotação, mas pode atualizar os preços se necessário. 
                    Após alterar, clique em "Salvar" e depois em "Finalizar" novamente para notificar o criador da atualização.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ✅ NOVO: Card de Condição de Pagamento e Previsão de Entrega */}
        <Card className="border-2 border-blue-200 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="size-5" />
              Condições Comerciais
            </CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Informe as condições comerciais oferecidas pela sua empresa
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
                  placeholder="EX: 30 DIAS, À VISTA, 15/30 DIAS"
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
            <CardTitle>Itens para Cotação</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Informe o valor unitário para cada item abaixo
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Código</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center w-[80px]">Unid.</TableHead>
                    <TableHead className="text-right w-[100px]">Qtd.</TableHead>
                    <TableHead className="w-[180px]">Valor Unit. (R$)</TableHead>
                    <TableHead className="text-right w-[140px]">Valor Total (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dados?.itens.map((item) => {
                    const preco = precos[getChaveItem(item).toString()] || '';
                    const vlrTotal = preco ? parseBrazilianNumber(preco) * item.qtde_item : 0;
                    
                    return (
                      <TableRow key={item.seq_ordem_compra_item}>
                        <TableCell className="font-medium">{item.codigo}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.descricao}</p>
                            <p className="text-xs text-gray-500">
                              OC: {item.nro_ordem_compra} • {item.nro_centro_custo}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.unidade_medida}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.qtde_item)}</TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={preco}
                            onChange={(e) => atualizarPreco(item.seq_ordem_compra_item, e.target.value)}
                            placeholder="0,00"
                            className="text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {vlrTotal > 0 ? formatCurrency(vlrTotal, false) : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            <div className="mt-6 flex justify-end">
              <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900 w-full md:w-auto">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-8">
                    <span className="font-bold text-lg">VALOR TOTAL DA COTAÇÃO:</span>
                    <span className="font-bold text-2xl text-blue-600 dark:text-blue-400">
                      {formatCurrency(calcularTotal())}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>

        {/* Botões de Ação */}
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-gray-500">
            * Salve os preços periodicamente para não perder seu trabalho
          </p>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={salvarPrecos}
              disabled={salvando || Object.keys(precos).length === 0}
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
                  Salvar Preços
                </>
              )}
            </Button>
            
            <Button
              onClick={finalizarCotacao}
              disabled={finalizando || contarItensPreenchidos() !== dados?.itens.length}
              className="gap-2"
            >
              {finalizando ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Finalizando...
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Finalizar e Enviar Cotação
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}