import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  Loader2,
  ArrowLeft,
  Calendar,
  User,
  Package,
  ShoppingCart,
  Warehouse,
  MapPin,
  FileText,
  Building2,
  Barcode,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { toast } from 'sonner';

interface DetalhesEntrada {
  seq_entrada: number;
  unidade: string;
  seq_estoque: number;
  estoque_descricao: string;
  tipo_entrada: 'MANUAL' | 'PEDIDO';
  seq_pedido: number | null;
  nro_pedido: string | null;
  nro_lancto: string | null; // ✅ NOVO: Número do lançamento SSW (formatado com 6 dígitos: 000123)
  seq_fornecedor: number | null;
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  ser_nf: string | null;
  nro_nf: string | null;
  chave_nfe: string | null;
  observacao: string | null;
  data_entrada: string;
  hora_entrada: string;
  login_entrada: string;
  itens: ItemEntrada[];
}

interface ItemEntrada {
  seq_item: number;
  codigo: string;
  descricao: string;
  unidade_medida: string;
  qtde_pedida: number;
  qtde_recebida: number;
  seq_posicao: number;
  posicao_descricao: string;
  vlr_unitario: number;
  vlr_total: number;
}

export default function DetalhesEntrada() {
  usePageTitle('Detalhes da Entrada');

  const navigate = useNavigate();
  const { seq_entrada } = useParams();
  const [loading, setLoading] = useState(true);
  const [entrada, setEntrada] = useState<DetalhesEntrada | null>(null);
  const [modalEstorno, setModalEstorno] = useState(false);
  const [estornando, setEstornando] = useState(false);

  useEffect(() => {
    carregarDetalhes();
  }, [seq_entrada]);

  const carregarDetalhes = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const entradaMock: DetalhesEntrada = {
          seq_entrada: parseInt(seq_entrada || '1'),
          unidade: 'MTZ',
          seq_estoque: 1,
          estoque_descricao: 'ESTOQUE GERAL MATRIZ',
          tipo_entrada: 'PEDIDO',
          seq_pedido: 4,
          nro_pedido: 'PED-2026/004',
          nro_lancto: '123', // ✅ NOVO: Número do lançamento SSW (formatado com 6 dígitos: 000123)
          seq_fornecedor: 2,
          fornecedor_nome: 'AUTO PEÇAS SILVA LTDA',
          fornecedor_cnpj: '12.345.678/0001-95',
          ser_nf: '1',
          nro_nf: '12345',
          chave_nfe: '35260112345678000195550010000123451234567890',
          observacao: 'RECEBIMENTO CONFORME PEDIDO',
          data_entrada: '2026-01-29',
          hora_entrada: '10:30:00',
          login_entrada: 'ADMIN',
          itens: [
            {
              seq_item: 1,
              codigo: 'FILTRO-001',
              descricao: 'FILTRO DE ÓLEO MOTOR DIESEL',
              unidade_medida: 'UN',
              qtde_pedida: 50,
              qtde_recebida: 50,
              seq_posicao: 1,
              posicao_descricao: 'RUA A - ALT 1 - COL 01',
              vlr_unitario: 45.00,
              vlr_total: 2250.00
            },
            {
              seq_item: 2,
              codigo: 'PASTILHA-002',
              descricao: 'PASTILHA DE FREIO DIANTEIRA',
              unidade_medida: 'JG',
              qtde_pedida: 30,
              qtde_recebida: 30,
              seq_posicao: 3,
              posicao_descricao: 'RUA A - ALT 1 - COL 03',
              vlr_unitario: 120.00,
              vlr_total: 3600.00
            },
            {
              seq_item: 5,
              codigo: 'PNEU-001',
              descricao: 'PNEU 275/80 R22.5',
              unidade_medida: 'UN',
              qtde_pedida: 20,
              qtde_recebida: 20,
              seq_posicao: 10,
              posicao_descricao: 'RUA B - ALT 1 - COL 02',
              vlr_unitario: 850.00,
              vlr_total: 17000.00
            }
          ]
        };

        setEntrada(entradaMock);
      } else {
        // BACKEND
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/entrada_estoque.php?action=detalhes&seq_entrada=${seq_entrada}`,
          { method: 'GET' }
        );

        if (data.success) {
          setEntrada(data.data);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast.error('Erro ao carregar detalhes da entrada.');
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string): string => {
    if (!data) return '-';
    const partes = data.split('-');
    if (partes.length === 3) {
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return data;
  };

  const formatarHora = (hora: string): string => {
    if (!hora) return '-';
    return hora.substring(0, 5);
  };

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const calcularTotal = (): number => {
    if (!entrada) return 0;
    return entrada.itens.reduce((sum, item) => sum + item.vlr_total, 0);
  };

  const estornarEntrada = async () => {
    setEstornando(true);
    
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast.success('Entrada estornada com sucesso!', { closeButton: true });
        
        setModalEstorno(false);
        setTimeout(() => {
          navigate('/estoque/entrada');
        }, 500);
      } else {
        // BACKEND
        console.log('🔄 Iniciando estorno da entrada:', entrada?.seq_entrada);
        
        const data = await apiFetch(
          `${ENVIRONMENT.apiBaseUrl}/estoque/entrada_estoque.php`,
          {
            method: 'POST',
            body: JSON.stringify({
              action: 'estornar',
              seq_entrada: entrada?.seq_entrada
            })
          }
        );

        console.log('✅ Resposta do estorno:', data);

        // ✅ VERIFICAR SUCESSO E NAVEGAR IMEDIATAMENTE
        if (data && data.success) {
          console.log('✅ Estorno bem-sucedido! Navegando para lista...');
          setModalEstorno(false);
          navigate('/estoque/entrada');
        } else {
          console.error('❌ Estorno falhou:', data);
        }
      }
    } catch (error) {
      console.error('Erro ao estornar entrada:', error);
      toast.error('Erro ao estornar entrada.', { closeButton: true });
    } finally {
      setEstornando(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout title="DETALHES DA ENTRADA" description="Carregando...">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Carregando detalhes...</span>
        </div>
      </AdminLayout>
    );
  }

  if (!entrada) {
    return (
      <AdminLayout title="DETALHES DA ENTRADA" description="Entrada não encontrada">
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Package className="size-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Entrada não encontrada</p>
            <Button
              onClick={() => navigate('/estoque/entrada')}
              className="mt-4"
              variant="outline"
            >
              <ArrowLeft className="size-4 mr-2" />
              Voltar para Entradas
            </Button>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const totalGeral = calcularTotal();

  return (
    <AdminLayout
      title="DETALHES DA ENTRADA"
      description={`Entrada #${entrada.seq_entrada}`}
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Botões de Ação */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate('/estoque/entrada')} className="gap-2">
            <ArrowLeft className="size-4" />
            Voltar para Entradas
          </Button>
          
          <Button
            onClick={() => setModalEstorno(true)}
            className="gap-2"
            variant="destructive"
            disabled={estornando}
          >
            <RotateCcw className="size-4" />
            Estornar Entrada
          </Button>
        </div>

        {/* Informações Principais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Tipo e Data */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Tipo de Entrada</CardTitle>
            </CardHeader>
            <CardContent>
              {entrada.tipo_entrada === 'PEDIDO' ? (
                <div className="flex items-center gap-2">
                  <ShoppingCart className="size-8 text-green-600" />
                  <div>
                    <p className="font-bold text-lg">PEDIDO</p>
                    <p className="text-sm text-gray-500">{entrada.nro_pedido}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Package className="size-8 text-blue-600" />
                  <div>
                    <p className="font-bold text-lg">MANUAL</p>
                    <p className="text-sm text-gray-500">Entrada Manual</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Data e Hora */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Data e Hora</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="size-8 text-blue-600" />
                <div>
                  <p className="font-bold text-lg">{formatarData(entrada.data_entrada)}</p>
                  <p className="text-sm text-gray-500">{formatarHora(entrada.hora_entrada)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usuário */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-gray-500">Usuário</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <User className="size-8 text-purple-600" />
                <div>
                  <p className="font-bold text-lg">{entrada.login_entrada.toLowerCase()}</p>
                  <p className="text-sm text-gray-500">Responsável</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estoque */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Warehouse className="size-5 text-purple-600" />
              Estoque de Destino
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-bold text-lg">{entrada.estoque_descricao}</p>
            <p className="text-sm text-gray-500">Unidade: {entrada.unidade}</p>
          </CardContent>
        </Card>

        {/* Dados da NF-e (se entrada via pedido) */}
        {entrada.tipo_entrada === 'PEDIDO' && (
          <Card className="border-2 border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-5 text-green-600" />
                Dados da Nota Fiscal
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="size-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Fornecedor</p>
                      <p className="font-bold">{entrada.fornecedor_nome}</p>
                      <p className="text-sm text-gray-500">{entrada.fornecedor_cnpj}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Série NF-e</p>
                      <p className="font-bold text-lg">{entrada.ser_nf}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Número NF-e</p>
                      <p className="font-bold text-lg">{entrada.nro_nf}</p>
                    </div>
                  </div>

                  {entrada.chave_nfe && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2">
                        <Barcode className="size-4 text-gray-400" />
                        <p className="text-sm text-gray-500">Chave NF-e</p>
                      </div>
                      <p className="font-mono text-xs mt-1 break-all">{entrada.chave_nfe}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* ✅ NOVO: Número do Lançamento SSW */}
              {entrada.nro_lancto && (
                <div className="mt-6 pt-6 border-t">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-orange-600" />
                    <p className="text-sm text-gray-500">Lancto Contas a Pagar</p>
                  </div>
                  <p className="font-bold text-2xl text-orange-600 mt-1 font-mono">
                    {String(entrada.nro_lancto).padStart(6, '0')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Observações */}
        {entrada.observacao && (
          <Card>
            <CardHeader>
              <CardTitle>Observações</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{entrada.observacao}</p>
            </CardContent>
          </Card>
        )}

        {/* Itens da Entrada */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Package className="size-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle>Itens Recebidos</CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {entrada.itens.length} {entrada.itens.length === 1 ? 'item' : 'itens'}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-600 hover:bg-blue-600">
                    <TableHead className="text-white">Código</TableHead>
                    <TableHead className="text-white">Descrição</TableHead>
                    <TableHead className="text-white text-center">Unid.</TableHead>
                    {entrada.tipo_entrada === 'PEDIDO' && (
                      <TableHead className="text-white text-right">Qtd. Pedida</TableHead>
                    )}
                    <TableHead className="text-white text-right">Qtd. Recebida</TableHead>
                    <TableHead className="text-white">Posição</TableHead>
                    <TableHead className="text-white text-right">Vlr. Unit. (R$)</TableHead>
                    <TableHead className="text-white text-right">Vlr. Total (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entrada.itens.map((item, index) => (
                    <TableRow key={item.seq_item} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-900' : ''}>
                      <TableCell className="font-mono font-semibold">{item.codigo}</TableCell>
                      <TableCell className="font-medium">{item.descricao}</TableCell>
                      <TableCell className="text-center">{item.unidade_medida}</TableCell>
                      {entrada.tipo_entrada === 'PEDIDO' && (
                        <TableCell className="text-right font-medium">
                          {item.qtde_pedida.toFixed(2)}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-bold text-blue-600">
                        {item.qtde_recebida.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          <MapPin className="size-3" />
                          {item.posicao_descricao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatarValor(item.vlr_unitario)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatarValor(item.vlr_total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border-2 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                    VALOR TOTAL DA ENTRADA
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-500">
                    {entrada.itens.length} {entrada.itens.length === 1 ? 'item' : 'itens'}
                  </p>
                </div>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                  R$ {formatarValor(totalGeral)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal Estorno */}
        <Dialog open={modalEstorno} onOpenChange={setModalEstorno}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-red-600" />
                Estornar Entrada
              </DialogTitle>
              <DialogDescription>
                Esta ação irá <span className="font-bold text-red-600">DESFAZER RIGOROSAMENTE</span> todas as movimentações desta entrada:
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {/* Avisos */}
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border-2 border-red-500 p-4">
                <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                  <AlertTriangle className="size-4" />
                  O que será desfeito:
                </h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                  <li>Saldos de todas as posições serão <span className="font-bold">REDUZIDOS</span></li>
                  <li>Movimentações de entrada serão <span className="font-bold">DELETADAS</span></li>
                  {entrada?.tipo_entrada === 'PEDIDO' && (
                    <li>Status do pedido retornará para <span className="font-bold">APROVADO</span></li>
                  )}
                  <li className="font-bold mt-2">Esta ação NÃO PODE ser desfeita!</li>
                </ul>
              </div>
              
              {/* Informações da Entrada */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
                <h4 className="font-semibold mb-2">Dados da Entrada:</h4>
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">ID:</span> #{entrada?.seq_entrada}</p>
                  <p><span className="font-medium">Tipo:</span> {entrada?.tipo_entrada}</p>
                  <p><span className="font-medium">Data:</span> {entrada?.data_entrada ? formatarData(entrada.data_entrada) : '-'}</p>
                  <p><span className="font-medium">Itens:</span> {entrada?.itens.length}</p>
                  <p><span className="font-medium">Valor Total:</span> R$ {formatarValor(totalGeral)}</p>
                </div>
              </div>
            </div>
            
            <DialogFooter className="gap-2">
              <Button
                onClick={() => setModalEstorno(false)}
                variant="outline"
                disabled={estornando}
              >
                Cancelar
              </Button>
              <Button
                onClick={estornarEntrada}
                variant="destructive"
                disabled={estornando}
                className="gap-2"
              >
                {estornando ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Estornando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="size-4" />
                    Confirmar Estorno
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}