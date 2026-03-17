import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { ArrowLeft, Package, Calendar, Clock, User, FileText, Warehouse, Building2, CheckCircle, AlertCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

interface RequisicaoDetalhes {
  seq_requisicao: number;
  seq_estoque: number;
  estoque_descricao: string;
  estoque_unidade: string;
  nro_estoque: number;
  seq_centro_custo: number;
  cc_descricao: string;
  cc_unidade: string;
  nro_centro_custo: number;
  login: string;
  solicitante: string;
  observacao: string;
  data_atendimento: string;
  hora_atendimento: string;
  login_atendimento: string;
  placa: string;
  status: string;
}

interface ItemRequisicao {
  seq_item: number;
  item_descricao: string;
  vlr_item: number;
  qtde_item: number;
  rua: string;
  altura: string;
  coluna: string;
  saldo: number;
}

const MOCK_DETALHES: RequisicaoDetalhes = {
  seq_requisicao: 1,
  seq_estoque: 1,
  estoque_descricao: 'ESTOQUE PRINCIPAL - MATRIZ',
  estoque_unidade: 'ACV',
  nro_estoque: 1,
  seq_centro_custo: 5,
  cc_descricao: 'MANUTENÇÃO',
  cc_unidade: 'ACV',
  nro_centro_custo: 5,
  login: 'joao.silva',
  solicitante: 'JOÃO DA SILVA',
  observacao: 'MATERIAL PARA REPARO URGENTE DO CAMINHÃO 5678',
  data_atendimento: '2026-03-02',
  hora_atendimento: '14:30:00',
  login_atendimento: 'joao.silva',
  placa: '',
  status: 'ATENDIDA'
};

const MOCK_ITENS: ItemRequisicao[] = [
  {
    seq_item: 123,
    item_descricao: 'FILTRO DE ÓLEO MOTOR',
    vlr_item: 45.50,
    qtde_item: 2,
    rua: 'A',
    altura: '2',
    coluna: '3',
    saldo: 10
  },
  {
    seq_item: 456,
    item_descricao: 'PASTILHA DE FREIO DIANTEIRA',
    vlr_item: 120.00,
    qtde_item: 1,
    rua: 'B',
    altura: '1',
    coluna: '5',
    saldo: 5
  }
];

export function RequisicaoDetalhes() {
  const { seq_requisicao } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [requisicao, setRequisicao] = useState<RequisicaoDetalhes | null>(null);
  const [itens, setItens] = useState<ItemRequisicao[]>([]);

  useEffect(() => {
    carregarDetalhes();
  }, [seq_requisicao]);

  const carregarDetalhes = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 300));
        setRequisicao(MOCK_DETALHES);
        setItens(MOCK_ITENS);
      } else {
        // BACKEND
        const url = `${ENVIRONMENT.apiBaseUrl}/estoque/requisicoes.php?seq_requisicao=${seq_requisicao}`;
        const data = await apiFetch(url, {
          method: 'GET'
        });

        if (data.success) {
          setRequisicao(data.data.requisicao);
          setItens(data.data.itens || []);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
      toast.error('Erro ao carregar detalhes da requisição');
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
    return hora.substring(0, 5); // HH:MM
  };

  const formatarQuantidade = (qtd: number): string => {
    return qtd.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatarCodigo = (unidade: string, numero: number): string => {
    const numeroFormatado = String(numero).padStart(6, '0');
    return `${unidade}${numeroFormatado}`;
  };

  const calcularValorTotal = (): number => {
    return itens.reduce((total, item) => total + (Number(item.vlr_item) * Number(item.qtde_item)), 0);
  };

  const calcularQuantidadeTotal = (): number => {
    return itens.reduce((total, item) => total + Number(item.qtde_item), 0);
  };

  const handleImprimir = () => {
    window.print();
  };

  if (loading) {
    return (
      <AdminLayout title="Detalhes da Requisição">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Carregando...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!requisicao) {
    return (
      <AdminLayout title="Detalhes da Requisição">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="size-12 text-red-600 mx-auto mb-4" />
            <p className="text-gray-600">Requisição não encontrada</p>
            <Button onClick={() => navigate('/estoque/saida')} className="mt-4">
              <ArrowLeft className="size-4 mr-2" />
              Voltar
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Detalhes da Requisição"
      description={`Requisição ${String(requisicao.seq_requisicao).padStart(6, '0')}`}
    >
      <div className="space-y-6">
        {/* AÇÕES */}
        <div className="flex items-center justify-between print:hidden">
          <Button variant="outline" onClick={() => navigate('/estoque/saida')}>
            <ArrowLeft className="size-4 mr-2" />
            Voltar
          </Button>

          <Button onClick={handleImprimir}>
            <Printer className="size-4 mr-2" />
            Imprimir
          </Button>
        </div>

        {/* CARD: INFORMAÇÕES GERAIS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="size-5" />
              Informações da Requisição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Status */}
              <div>
                <label className="text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1 flex items-center gap-2">
                  {requisicao.status === 'ATENDIDA' ? (
                    <CheckCircle className="size-5 text-green-600" />
                  ) : (
                    <AlertCircle className="size-5 text-yellow-600" />
                  )}
                  <span className={`font-semibold ${requisicao.status === 'ATENDIDA' ? 'text-green-600' : 'text-yellow-600'}`}>
                    {requisicao.status}
                  </span>
                </div>
              </div>

              {/* Estoque */}
              <div>
                <label className="text-sm font-medium text-gray-500">Estoque</label>
                <div className="mt-1 flex items-center gap-2">
                  <Warehouse className="size-4 text-purple-600" />
                  <div>
                    <div className="font-medium">{requisicao.estoque_descricao}</div>
                    <div className="text-xs text-gray-500">{formatarCodigo(requisicao.estoque_unidade, requisicao.nro_estoque)}</div>
                  </div>
                </div>
              </div>

              {/* Centro de Custo */}
              <div>
                <label className="text-sm font-medium text-gray-500">Centro de Custo</label>
                <div className="mt-1 flex items-center gap-2">
                  <Building2 className="size-4 text-blue-600" />
                  <div>
                    <div className="font-medium">{requisicao.cc_descricao}</div>
                    <div className="text-xs text-gray-500">{formatarCodigo(requisicao.cc_unidade, requisicao.nro_centro_custo)}</div>
                  </div>
                </div>
              </div>

              {/* Solicitante */}
              <div>
                <label className="text-sm font-medium text-gray-500">Solicitante</label>
                <div className="mt-1 flex items-center gap-2">
                  <User className="size-4 text-gray-600" />
                  <span className="font-medium">{requisicao.solicitante}</span>
                </div>
              </div>

              {/* Data de Atendimento */}
              <div>
                <label className="text-sm font-medium text-gray-500">Data de Atendimento</label>
                <div className="mt-1 flex items-center gap-2">
                  <Calendar className="size-4 text-gray-600" />
                  <span className="font-medium">{formatarData(requisicao.data_atendimento)}</span>
                </div>
              </div>

              {/* Hora de Atendimento */}
              <div>
                <label className="text-sm font-medium text-gray-500">Hora de Atendimento</label>
                <div className="mt-1 flex items-center gap-2">
                  <Clock className="size-4 text-gray-600" />
                  <span className="font-medium">{formatarHora(requisicao.hora_atendimento)}</span>
                </div>
              </div>

              {/* Login de Atendimento */}
              <div>
                <label className="text-sm font-medium text-gray-500">Atendido Por</label>
                <div className="mt-1 flex items-center gap-2">
                  <User className="size-4 text-gray-600" />
                  <span className="font-medium">{requisicao.login_atendimento || '-'}</span>
                </div>
              </div>

              {/* Observação */}
              {requisicao.observacao && (
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Observação</label>
                  <div className="mt-1">
                    <p className="text-gray-700">{requisicao.observacao}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CARD: ITENS */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="size-5" />
              Itens da Requisição ({itens.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {itens.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="size-12 mx-auto mb-2 opacity-50" />
                <p>Nenhum item encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead>Posição</TableHead>
                      <TableHead className="text-right">Valor Unitário</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Package className="size-4 text-blue-600" />
                            <span className="font-medium">{item.seq_item}</span>
                          </div>
                        </TableCell>
                        <TableCell>{item.item_descricao}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatarQuantidade(item.qtde_item)}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-sm">
                            {item.rua}/{item.altura}/{item.coluna}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatarValor(item.vlr_item)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatarValor(item.vlr_item * item.qtde_item)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 dark:bg-gray-800">
                      <TableCell colSpan={2} className="text-right font-bold text-gray-900 dark:text-gray-100">TOTAL GERAL</TableCell>
                      <TableCell className="text-right font-bold font-mono text-gray-900 dark:text-gray-100">
                        {formatarQuantidade(calcularQuantidadeTotal())}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-bold font-mono text-gray-900 dark:text-gray-100">
                        R$ {formatarValor(calcularValorTotal())}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}