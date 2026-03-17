import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Loader2, Mail, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';

interface Pedido {
  seq_pedido: number;
  nro_pedido_formatado?: string;
  fornecedor_nome: string;
  vlr_total: number;
  fornecedor_email?: string;
}

interface DialogEnviarPedidosProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidos: Pedido[];
  onEnvioCompleto?: () => void;
}

export function DialogEnviarPedidos({
  open,
  onOpenChange,
  pedidos,
  onEnvioCompleto
}: DialogEnviarPedidosProps) {
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [enviado, setEnviado] = useState(false);

  const formatarValor = (valor: number): string => {
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleEnviar = async () => {
    setEnviando(true);
    setResultados([]);

    try {
      if (ENVIRONMENT.isFigmaMake) {
        // MOCK
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const resultadosMock = pedidos.map(pedido => ({
          pedido: pedido.nro_pedido_formatado || 'MOCK001',
          fornecedor: pedido.fornecedor_nome,
          email: 'fornecedor@exemplo.com',
          status: 'sucesso',
          mensagem: 'Email enviado com sucesso'
        }));
        
        setResultados(resultadosMock);
        setEnviado(true);
      } else {
        // BACKEND
        const response = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/pedidos_enviar_email.php`, {
          method: 'POST',
          body: JSON.stringify({
            pedidos: pedidos.map(p => ({ seq_pedido: p.seq_pedido }))
          })
        });

        if (response.success) {
          setResultados(response.detalhes || []);
          setEnviado(true);
          
          if (onEnvioCompleto) {
            onEnvioCompleto();
          }
        }
      }
    } catch (error) {
      console.error('Erro ao enviar pedidos:', error);
    } finally {
      setEnviando(false);
    }
  };

  const handleFechar = () => {
    setResultados([]);
    setEnviado(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="size-6 text-blue-600" />
            {enviado ? 'Pedidos Enviados' : 'Enviar Pedidos por Email'}
          </DialogTitle>
          <DialogDescription>
            {enviado 
              ? 'Confira o resultado do envio dos pedidos'
              : 'Os pedidos abaixo serão enviados para os fornecedores por email'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!enviado ? (
            <>
              {/* Lista de pedidos a enviar */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800">
                      <th className="text-left p-3 font-medium">Pedido</th>
                      <th className="text-left p-3 font-medium">Fornecedor</th>
                      <th className="text-right p-3 font-medium">Valor Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map((pedido, index) => (
                      <tr key={index} className="border-t dark:border-slate-700">
                        <td className="p-3 font-mono font-bold text-blue-600">
                          {pedido.nro_pedido_formatado || 'N/A'}
                        </td>
                        <td className="p-3">{pedido.fornecedor_nome}</td>
                        <td className="p-3 text-right font-bold text-green-600">
                          R$ {formatarValor(pedido.vlr_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-slate-900 border-t-2 dark:border-slate-600">
                      <td colSpan={2} className="p-3 text-right font-bold">
                        TOTAL GERAL:
                      </td>
                      <td className="p-3 text-right font-bold text-lg text-green-600">
                        R$ {formatarValor(pedidos.reduce((sum, p) => sum + p.vlr_total, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Observação */}
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                <AlertTriangle className="size-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  <p className="font-medium mb-1">Importante:</p>
                  <p>Os pedidos serão enviados em formato PDF para o email cadastrado de cada fornecedor.</p>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Resultados do envio */}
              <div className="space-y-3">
                {resultados.map((resultado, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-2 ${
                      resultado.status === 'sucesso'
                        ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                        : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {resultado.status === 'sucesso' ? (
                        <CheckCircle className="size-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="size-5 text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono font-bold">
                            {resultado.pedido}
                          </span>
                          <Badge 
                            variant={resultado.status === 'sucesso' ? 'default' : 'destructive'}
                            className="text-xs"
                          >
                            {resultado.status === 'sucesso' ? 'Enviado' : 'Erro'}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {resultado.fornecedor}
                        </p>
                        {resultado.email && (
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {resultado.email}
                          </p>
                        )}
                        <p className="text-xs mt-1 text-slate-600 dark:text-slate-400">
                          {resultado.mensagem}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-4">
            {!enviado ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleFechar}
                  disabled={enviando}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleEnviar}
                  disabled={enviando}
                  className="gap-2"
                >
                  {enviando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="size-4" />
                      Enviar Pedidos
                    </>
                  )}
                </Button>
              </>
            ) : (
              <Button onClick={handleFechar} className="gap-2">
                <CheckCircle className="size-4" />
                Fechar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
