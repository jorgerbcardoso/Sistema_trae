import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
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
  Save, 
  CheckCircle, 
  ArrowLeft, 
  FileDown, 
  Package,
  MapPin,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { ENVIRONMENT } from '../../config/environment';
import { usePageTitle } from '../../hooks/usePageTitle';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';
import { MOCK_INVENTARIOS, MOCK_INVENTARIO_POSICOES } from '../../utils/estoqueModData';

interface PosicaoInventario {
  seq_inventario_posicao: number;
  seq_posicao: number;
  saldo_sistema: number;
  saldo_contado: number;
  diferenca: number;
  rua: string;
  altura: string;
  coluna: string;
  seq_item: number;
  item_codigo: string;
  item_descricao: string;
  vlr_item: number;
}

interface Inventario {
  seq_inventario: number;
  nome_inventario: string;
  status: string;
  nro_estoque: string;
  estoque_descricao: string;
  unidade: string;
  posicoes: PosicaoInventario[];
  data_inclusao: string;
  hora_inclusao: string;
}

export default function InventarioContagem() {
  const { seqInventario } = useParams();
  const navigate = useNavigate();
  const { user, clientConfig } = useAuth();

  const [inventario, setInventario] = useState<Inventario | null>(null);
  const [posicoes, setPosicoes] = useState<PosicaoInventario[]>([]);
  const [loading, setLoading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // 🚨 CRÍTICO: Logo do cliente DEVE vir da config do domínio
  const clientLogo = clientConfig?.theme?.logo_light || '';

  // Atualizar título dinamicamente
  usePageTitle(inventario ? `Inventário: ${inventario.nome_inventario}` : 'Contagem de Inventário');

  useEffect(() => {
    if (seqInventario) {
      carregarInventario();
    }
  }, [seqInventario]);

  const carregarInventario = async () => {
    setLoading(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 300));
        
        const seqInv = parseInt(seqInventario!);
        const inventarioMock = MOCK_INVENTARIOS.find(inv => inv.seq_inventario === seqInv);
        
        if (!inventarioMock) {
          toast.error('Inventário não encontrado');
          setLoading(false);
          return;
        }
        
        const posicoesMock = MOCK_INVENTARIO_POSICOES.filter(p => p.seq_inventario === seqInv);
        
        const inventarioData = {
          seq_inventario: inventarioMock.seq_inventario,
          nome_inventario: inventarioMock.nome_inventario,
          status: inventarioMock.status,
          nro_estoque: inventarioMock.nro_estoque,
          estoque_descricao: inventarioMock.estoque_descricao,
          unidade: inventarioMock.unidade,
          data_inclusao: inventarioMock.data_inclusao,
          hora_inclusao: inventarioMock.hora_inclusao,
          posicoes: posicoesMock.map(p => ({
            seq_inventario_posicao: p.seq_inventario_posicao,
            seq_posicao: p.seq_posicao,
            saldo_sistema: p.saldo_sistema,
            saldo_contado: p.saldo_contado,
            diferenca: p.diferenca,
            rua: p.rua,
            altura: p.altura,
            coluna: p.coluna,
            seq_item: p.seq_item,
            item_codigo: p.item_codigo,
            item_descricao: p.item_descricao,
            vlr_item: p.vlr_item
          }))
        };
        
        setInventario(inventarioData);
        setPosicoes(inventarioData.posicoes);
      } else {
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/inventarios.php`, {
          method: 'POST',
          body: JSON.stringify({
            _method: 'GET_DETALHES',
            seq_inventario: parseInt(seqInventario!)
          })
        });

        if (data.success) {
          setInventario(data.data);
          const posicoesFormatadas = (data.data.posicoes || []).map((p: any) => ({
            ...p,
            saldo_sistema: parseFloat(p.saldo_sistema) || 0,
            saldo_contado: parseFloat(p.saldo_contado) || 0,
            diferenca: parseFloat(p.diferenca) || 0,
            vlr_item: parseFloat(p.vlr_item) || 0
          }));
          setPosicoes(posicoesFormatadas);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar inventário:', error);
      toast.error('Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  };

  const atualizarSaldoContado = (seqInventarioPosicao: number, valor: string) => {
    setPosicoes(prev =>
      prev.map(p =>
        p.seq_inventario_posicao === seqInventarioPosicao
          ? {
              ...p,
              saldo_contado: parseFloat(valor) || 0,
              diferenca: (parseFloat(valor) || 0) - p.saldo_sistema
            }
          : p
      )
    );
  };

  const salvarContagens = async () => {
    setSalvando(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 800));
        toast.success('Contagens salvas com sucesso!');
        await carregarInventario();
      } else {
        const posicoesParaSalvar = posicoes.map(p => ({
          seq_inventario_posicao: p.seq_inventario_posicao,
          saldo_contado: p.saldo_contado
        }));

        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/inventarios.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_inventario: parseInt(seqInventario!),
            posicoes: posicoesParaSalvar
          })
        });

        if (data.success) {
          toast.success('Contagens salvas com sucesso!');
          await carregarInventario();
        }
      }
    } catch (error) {
      console.error('Erro ao salvar contagens:', error);
      toast.error('Erro ao salvar contagens');
    } finally {
      setSalvando(false);
    }
  };

  const finalizarInventario = async () => {
    if (!confirm('Deseja realmente FINALIZAR este inventário?\n\nOs saldos serão ajustados e movimentações serão geradas automaticamente.\n\nEsta ação NÃO pode ser desfeita!')) {
      return;
    }

    setSalvando(true);
    try {
      if (ENVIRONMENT.isFigmaMake) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        toast.success('Inventário finalizado com sucesso!');
        setTimeout(() => navigate('/estoque/inventario'), 500);
      } else {
        // Salvar contagens antes de finalizar
        const posicoesParaSalvar = posicoes.map(p => ({
          seq_inventario_posicao: p.seq_inventario_posicao,
          saldo_contado: p.saldo_contado
        }));

        await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/inventarios.php`, {
          method: 'PUT',
          body: JSON.stringify({
            seq_inventario: parseInt(seqInventario!),
            posicoes: posicoesParaSalvar
          })
        });

        // Finalizar inventário
        const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/estoque/inventarios.php`, {
          method: 'POST',
          body: JSON.stringify({
            _method: 'FINALIZAR',
            seq_inventario: parseInt(seqInventario!)
          })
        });

        if (data.success || (data.toast && data.toast.type === 'success')) {
          toast.success('Inventário finalizado com sucesso!');
          setTimeout(() => navigate('/estoque/inventario'), 500);
        }
      }
    } catch (error) {
      console.error('Erro ao finalizar inventário:', error);
      toast.error('Erro ao finalizar inventário');
    } finally {
      setSalvando(false);
    }
  };

  const imprimirFicha = () => {
    if (!inventario) return;

    // ✅ PADRÃO: Abrir nova janela e imprimir HTML (igual ao pedido)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Não foi possível abrir a janela de impressão');
      return;
    }

    const nroInventarioFormatado = String(inventario.seq_inventario).padStart(6, '0');
    const nroEstoqueFormatado = inventario.unidade + String(inventario.nro_estoque).padStart(6, '0');
    const statusTexto = inventario.status === 'FINALIZADO' ? 'FINALIZADO' : 'PENDENTE';
    
    const totalSistemaFmt = totalSistema.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalContadoFmt = totalContado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const totalDiferencaFmt = totalDiferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="UTF-8">
          <title>Inventário ${nroInventarioFormatado}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: Arial, sans-serif; 
              padding: 15mm; 
              font-size: 11pt;
              color: #000;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 20px;
              padding-bottom: 15px;
              border-bottom: 3px solid #2563eb;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 15px;
            }
            .logo {
              max-width: 120px;
              max-height: 50px;
            }
            .header-info h1 {
              font-size: 16pt;
              color: #2563eb;
              margin-bottom: 3px;
            }
            .header-info p {
              font-size: 10pt;
              color: #666;
            }
            .header-right img {
              max-width: 100px;
              max-height: 45px;
            }
            
            .info-section {
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 15px;
              margin-bottom: 20px;
            }
            .info-section h2 {
              font-size: 12pt;
              color: #2563eb;
              margin-bottom: 10px;
              border-bottom: 2px solid #2563eb;
              padding-bottom: 5px;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
            }
            .info-item {
              margin-bottom: 8px;
            }
            .info-label {
              font-weight: 600;
              color: #6b7280;
              font-size: 9pt;
              display: block;
              margin-bottom: 2px;
            }
            .info-value {
              color: #1f2937;
              font-size: 10pt;
            }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #2563eb;
              color: white;
              padding: 10px 8px;
              text-align: left;
              font-size: 9pt;
              font-weight: 600;
              text-transform: uppercase;
              border: 1px solid #1e40af;
            }
            td {
              padding: 8px;
              border: 1px solid #e5e7eb;
              font-size: 9pt;
            }
            tbody tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .total-row {
              background-color: #dbeafe !important;
              font-weight: bold;
              font-size: 11pt;
            }
            .total-row td {
              padding: 12px 8px;
              border: 2px solid #2563eb;
            }
            
            .observacao {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px;
              margin-bottom: 20px;
              border-radius: 4px;
            }
            .observacao h3 {
              font-size: 10pt;
              color: #92400e;
              margin-bottom: 5px;
            }
            .observacao p {
              font-size: 9pt;
              color: #78350f;
              line-height: 1.5;
            }
            
            .signature-section {
              margin-top: 40px;
              text-align: center;
            }
            .signature-line {
              border-top: 2px solid #1f2937;
              width: 300px;
              margin: 40px auto 10px;
            }
            .signature-label {
              font-size: 10pt;
              color: #6b7280;
              font-weight: 600;
            }
            
            .footer {
              text-align: center;
              font-size: 8pt;
              color: #6b7280;
              margin-top: 30px;
              padding-top: 15px;
              border-top: 1px solid #e5e7eb;
            }
            
            @media print {
              body { padding: 10mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-left">
              <img src="https://webpresto.com.br/images/logo_rel.png" alt="Sistema Presto" class="logo" />
              <div class="header-info">
                <h1>FICHA DE INVENTÁRIO</h1>
                <p>Sistema PRESTO - Gestão de Transportadoras</p>
              </div>
            </div>
            <div class="header-right">
              <img src="${clientLogo}" alt="Logo Empresa" onerror="this.style.display='none'" />
            </div>
          </div>
          
          <div class="info-section">
            <h2>DADOS DO INVENTÁRIO</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Inventário</span>
                <span class="info-value" style="font-weight: bold; color: #2563eb;">${inventario.nome_inventario}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Número</span>
                <span class="info-value">${nroInventarioFormatado}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Status</span>
                <span class="info-value" style="${statusTexto === 'FINALIZADO' ? 'color: #059669; font-weight: bold;' : 'color: #d97706; font-weight: bold;'}">${statusTexto}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Data de Criação</span>
                <span class="info-value">${inventario.data_inclusao} ${inventario.hora_inclusao}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Unidade</span>
                <span class="info-value">${inventario.unidade}</span>
              </div>
            </div>
          </div>
          
          <div class="info-section">
            <h2>DADOS DO ESTOQUE</h2>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Estoque</span>
                <span class="info-value">${nroEstoqueFormatado}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Descrição</span>
                <span class="info-value">${inventario.estoque_descricao}</span>
              </div>
              <div class="info-item">
                <span class="info-label">Total de Posições</span>
                <span class="info-value">${posicoes.length}</span>
              </div>
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th style="width: 60px; text-align: center;">RUA</th>
                <th style="width: 60px; text-align: center;">ALTURA</th>
                <th style="width: 60px; text-align: center;">COLUNA</th>
                <th style="width: 80px;">ITEM</th>
                <th style="max-width: 200px;">DESCRIÇÃO</th>
                <th style="width: 100px; text-align: right;">SALDO SISTEMA</th>
                <th style="width: 100px; text-align: right;">SALDO CONTADO</th>
              </tr>
            </thead>
            <tbody>
              ${posicoes.map(pos => `
                <tr>
                  <td style="text-align: center; font-family: monospace;">${pos.rua}</td>
                  <td style="text-align: center; font-family: monospace;">${pos.altura}</td>
                  <td style="text-align: center; font-family: monospace;">${pos.coluna}</td>
                  <td>${pos.item_codigo}</td>
                  <td>${pos.item_descricao}</td>
                  <td style="text-align: right; font-family: monospace;">${pos.saldo_sistema.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style="text-align: right; font-family: monospace; font-weight: bold;">
                    ${(isFinalizado || pos.saldo_contado > 0) ? pos.saldo_contado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="5" style="text-align: right;">TOTAL GERAL:</td>
                <td style="text-align: right;">${totalSistemaFmt}</td>
                <td style="text-align: right;">${isFinalizado ? totalContadoFmt : ''}</td>
              </tr>
              ${isFinalizado && totalDiferenca !== 0 ? `
              <tr class="total-row">
                <td colspan="6" style="text-align: right;">DIFERENÇA (Contado - Sistema):</td>
                <td style="text-align: right; color: ${totalDiferenca > 0 ? '#059669' : '#dc2626'};">
                  ${totalDiferenca > 0 ? '+' : ''}${totalDiferencaFmt}
                </td>
              </tr>
              ` : ''}
            </tfoot>
          </table>
          
          ${!isFinalizado ? `
          <div class="observacao">
            <h3>📋 INSTRUÇÕES PARA CONTAGEM</h3>
            <p>1. Localize cada posição (RUA, ALTURA, COLUNA) no estoque físico<br>
            2. Conte fisicamente a quantidade de itens em cada posição<br>
            3. Anote o valor contado na coluna "SALDO CONTADO"<br>
            4. Após finalizar todas as contagens, lance os dados no sistema</p>
          </div>
          ` : ''}
          
          <div class="signature-section">
            <div class="signature-line"></div>
            <div class="signature-label">Responsável pela Contagem</div>
          </div>
          
          <div class="footer">
            <p><strong>Sistema Presto - Gestão de Transportadoras</strong></p>
            <p>Este é um documento gerado eletronicamente | Gerado em ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // Cálculos
  const totalSistema = posicoes.reduce((sum, p) => sum + p.saldo_sistema, 0);
  const totalContado = posicoes.reduce((sum, p) => sum + p.saldo_contado, 0);
  const totalDiferenca = totalContado - totalSistema;
  const posicoesContadas = posicoes.filter(p => p.saldo_contado > 0).length;
  const posicoesComDiferenca = posicoes.filter(p => p.diferenca !== 0 && p.saldo_contado > 0).length;
  const percentualContado = posicoes.length > 0 ? (posicoesContadas / posicoes.length) * 100 : 0;

  const isFinalizado = inventario?.status === 'FINALIZADO';
  const isReadOnly = isFinalizado;

  if (loading) {
    return (
      <AdminLayout title="CONTAGEM DE INVENTÁRIO" description="Carregando...">
        <div className="flex justify-center items-center py-12">
          <Loader2 className="size-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  if (!inventario) {
    return (
      <AdminLayout title="CONTAGEM DE INVENTÁRIO" description="Erro">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertTriangle className="size-16 mx-auto mb-4 text-red-500" />
              <p className="text-lg font-medium text-red-600">Inventário não encontrado</p>
              <Button onClick={() => navigate('/estoque/inventario')} className="mt-4" variant="outline">
                <ArrowLeft className="size-4 mr-2" />
                Voltar para lista
              </Button>
            </div>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={inventario.nome_inventario}
      description={`${inventario.unidade} - ${inventario.estoque_descricao}`}
    >
      <div className="space-y-6">
        {/* Botões de ação */}
        <div className="flex items-center justify-between">
          <Button onClick={() => navigate('/estoque/inventario')} variant="outline" className="gap-2">
            <ArrowLeft className="size-4" />
            Voltar
          </Button>

          <div className="flex items-center gap-2">
            <Button onClick={imprimirFicha} variant="outline" className="gap-2">
              <FileDown className="size-4" />
              Imprimir Ficha
            </Button>

            {!isReadOnly && (
              <>
                <Button onClick={salvarContagens} disabled={salvando} variant="secondary" className="gap-2">
                  {salvando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Salvar Contagens
                    </>
                  )}
                </Button>

                <Button onClick={finalizarInventario} disabled={salvando} className="gap-2 bg-green-600 hover:bg-green-700">
                  {salvando ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Finalizando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="size-4" />
                      Finalizar Inventário
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="size-8 text-blue-600 dark:text-blue-400" />
                <Badge variant="outline" className="bg-white/50 dark:bg-black/20">
                  {isFinalizado ? 'FINALIZADO' : 'EM ANDAMENTO'}
                </Badge>
              </div>
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Total de Posições</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{posicoes.length}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {posicoesContadas} contadas ({percentualContado.toFixed(0)}%)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <MapPin className="size-8 text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">Saldo Sistema</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {totalSistema.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Total registrado</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="size-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-1">Saldo Contado</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {totalContado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">Total físico</p>
            </CardContent>
          </Card>

          <Card className={`bg-gradient-to-br ${
            totalDiferenca === 0 
              ? 'from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900 border-gray-200 dark:border-gray-800'
              : totalDiferenca > 0
              ? 'from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800'
              : 'from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 border-red-200 dark:border-red-800'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <AlertTriangle className={`size-8 ${
                  totalDiferenca === 0 
                    ? 'text-gray-600 dark:text-gray-400'
                    : totalDiferenca > 0
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400'
                }`} />
              </div>
              <p className={`text-sm font-medium mb-1 ${
                totalDiferenca === 0 
                  ? 'text-gray-700 dark:text-gray-300'
                  : totalDiferenca > 0
                  ? 'text-green-700 dark:text-green-300'
                  : 'text-red-700 dark:text-red-300'
              }`}>Diferença</p>
              <p className={`text-2xl font-bold ${
                totalDiferenca === 0 
                  ? 'text-gray-900 dark:text-gray-100'
                  : totalDiferenca > 0
                  ? 'text-green-900 dark:text-green-100'
                  : 'text-red-900 dark:text-red-100'
              }`}>
                {totalDiferenca > 0 ? '+' : ''}{totalDiferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className={`text-xs mt-1 ${
                totalDiferenca === 0 
                  ? 'text-gray-600 dark:text-gray-400'
                  : totalDiferenca > 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>{posicoesComDiferenca} posições com diferença</p>
            </CardContent>
          </Card>
        </div>

        {/* Informações do inventário */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Informações do Inventário</span>
              <Badge variant={isFinalizado ? 'default' : 'secondary'} className="gap-1">
                {isFinalizado ? <CheckCircle className="size-3" /> : <Clock className="size-3" />}
                {isFinalizado ? 'FINALIZADO' : 'PENDENTE'}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Estoque</p>
                <p className="font-medium">{inventario.nro_estoque}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{inventario.estoque_descricao}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Unidade</p>
                <p className="font-medium">{inventario.unidade}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Data de Criação</p>
                <p className="font-medium">{inventario.data_inclusao} {inventario.hora_inclusao}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de posições */}
        <Card>
          <CardHeader>
            <CardTitle>Posições para Contagem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Localização</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right w-[120px]">Saldo Sistema</TableHead>
                    <TableHead className="text-right w-[120px]">Saldo Contado</TableHead>
                    <TableHead className="text-right w-[100px]">Diferença</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posicoes.map((pos) => {
                    const temDiferenca = pos.diferenca !== 0 && pos.saldo_contado > 0;
                    
                    return (
                      <TableRow key={pos.seq_inventario_posicao}>
                        <TableCell className="font-mono font-bold">
                          {pos.rua}-{pos.altura}-{pos.coluna}
                        </TableCell>
                        <TableCell className="font-medium text-blue-600">
                          {pos.item_codigo}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {pos.item_descricao}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {pos.saldo_sistema.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {isReadOnly ? (
                            <span className="font-mono font-bold text-green-600">
                              {pos.saldo_contado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <Input
                              type="number"
                              step="0.01"
                              value={pos.saldo_contado || ''}
                              onChange={(e) => atualizarSaldoContado(pos.seq_inventario_posicao, e.target.value)}
                              className="text-right font-mono"
                              placeholder="0.00"
                            />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {temDiferenca && (
                            <Badge variant={pos.diferenca > 0 ? 'default' : 'destructive'} className="font-mono">
                              {pos.diferenca > 0 ? '+' : ''}{pos.diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}