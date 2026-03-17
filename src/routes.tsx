import React from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import { LoginPage } from './components/auth/LoginPage';
import { LoginAceville } from './components/auth/LoginAceville';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MainMenu } from './components/MainMenu';
import { AutoLoginRedirect } from './components/AutoLoginRedirect';

// Dashboards
import { FinanceiroDashboard } from './components/dashboards/FinanceiroDashboard';
import { LinhasDashboard } from './components/dashboards/LinhasDashboard';
import { PerformanceEntregas } from './components/dashboards/PerformanceEntregas';
import { PerformanceColetas } from './components/dashboards/PerformanceColetas';
import { FluxoCaixa } from './components/dashboards/FluxoCaixa';

// Cadastros
import { CadastroEventos } from './components/cadastros/CadastroEventos';
import { GruposEventos } from './components/cadastros/GruposEventos';
import { CadastroLinhas } from './components/cadastros/CadastroLinhas';
import { Vendedores } from './components/cadastros/Vendedores';
import { ClientesVendedor } from './components/cadastros/ClientesVendedor';

// Relatórios
import { ConferenciaSaidas } from './components/relatorios/ConferenciaSaidas';
import { ControleTransbordo } from './components/relatorios/ControleTransbordo';
import { TotaisVendedores } from './components/relatorios/TotaisVendedores';
import TabelasVencer from './pages/relatorios/TabelasVencer';

// Estoque
import { CadastroEstoques } from './components/estoque/CadastroEstoques';
import { CadastroItens } from './components/estoque/CadastroItens';
import CadastroPosicoes from './pages/estoque/CadastroPosicoes';
import CadastroTiposItem from './pages/estoque/CadastroTiposItem';
import EntradaEstoque from './pages/estoque/EntradaEstoque';
import NovaEntradaEstoque from './pages/estoque/NovaEntradaEstoque';
import DetalhesEntrada from './pages/estoque/DetalhesEntrada';
import SaidaEstoque from './pages/estoque/SaidaEstoque';
import NovaSaidaEstoque from './pages/estoque/NovaSaidaEstoque';
import Requisicoes from './pages/estoque/Requisicoes';
import { RequisicaoDetalhes } from './pages/estoque/RequisicaoDetalhes';
import Inventario from './pages/estoque/Inventario';
import InventarioContagem from './pages/estoque/InventarioContagem';
import RelatorioMovimentacao from './pages/estoque/RelatorioMovimentacao';

// Compras
import Fornecedores from './pages/compras/Fornecedores';
import CadastroFornecedores from './pages/compras/CadastroFornecedores';
import CadastroCentrosCusto from './pages/compras/CadastroCentrosCusto';
import CadastroOrdensCompra from './pages/compras/CadastroOrdensCompra';
import AprovacaoOrdensCompra from './pages/compras/AprovacaoOrdensCompra';
import CadastroOrcamentos from './pages/compras/CadastroOrcamentos';
import OrcamentoForm from './pages/compras/OrcamentoForm';
import MapaCotacao from './pages/compras/MapaCotacao';
import ColetaPrecos from './pages/compras/ColetaPrecos';
import Pedidos from './pages/compras/Pedidos';
import PedidoForm from './pages/compras/PedidoForm';
import DashboardCompras from './pages/compras/DashboardCompras';
import SolicitacoesCompra from './pages/compras/SolicitacoesCompra';
import ConverterSolicitacoesCompra from './pages/compras/ConverterSolicitacoesCompra';
import ConverterSolicitacaoDetalhe from './pages/compras/ConverterSolicitacaoDetalhe';

// Operações
import AprovacaoDespesas from './pages/operacoes/AprovacaoDespesas';

// Admin - usando default exports
import GestaoDominios from './components/admin/GestaoDominios';
import GestaoPermissoes from './components/admin/GestaoPermissoes';
import CadastroUsuarios from './pages/admin/CadastroUsuarios';
import { GestaoMenu } from './components/admin/GestaoMenu';
import DomainPermissions from './pages/admin/DomainPermissions';

// Componente Root que renderiza as rotas filhas
function Root() {
  return <Outlet />;
}

// ✅ BASENAME: Detectar se está em produção ou localhost
const hostname = window.location.hostname;
const isProduction = hostname === 'webpresto.com.br' || hostname === 'www.webpresto.com.br' || hostname === 'sistemagestao.aceville.com.br';
const isIPAccess = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
const basename = (isProduction || isIPAccess) ? '/sistema' : '';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      // Auth
      {
        path: 'login',
        element: <LoginPage />
      },
      {
        path: 'login-aceville',
        element: <LoginAceville />
      },
      {
        path: 'reset-password',
        element: <ResetPasswordPage />
      },
      
      // 🆕 Rota pública para cotação de fornecedores (SEM AUTENTICAÇÃO)
      {
        path: 'cotacao-fornecedor',
        async lazy() {
          const { default: CotacaoFornecedor } = await import('./pages/public/CotacaoFornecedor');
          return { Component: CotacaoFornecedor };
        }
      },
      
      // ✅ Rota raiz "/" - Detecta auto-login OU redireciona para menu
      {
        path: '/',
        element: <AutoLoginRedirect />
      },
      
      // Menu Principal (protegido) - Agora em /menu
      {
        path: 'menu',
        element: (
          <ProtectedRoute>
            <MainMenu />
          </ProtectedRoute>
        )
      },
      
      // Dashboards (protegidos)
      {
        path: 'financeiro/dashboard',
        element: (
          <ProtectedRoute>
            <FinanceiroDashboard />
          </ProtectedRoute>
        )
      },
      {
        path: 'dashboards/linhas',
        element: (
          <ProtectedRoute>
            <LinhasDashboard />
          </ProtectedRoute>
        )
      },
      {
        path: 'dashboards/performance-entregas',
        element: (
          <ProtectedRoute>
            <PerformanceEntregas />
          </ProtectedRoute>
        )
      },
      {
        path: 'dashboards/performance-coletas',
        element: (
          <ProtectedRoute>
            <PerformanceColetas />
          </ProtectedRoute>
        )
      },
      {
        path: 'financeiro/fluxo-caixa',
        element: (
          <ProtectedRoute>
            <FluxoCaixa />
          </ProtectedRoute>
        )
      },
      
      // Cadastros (protegidos)
      {
        path: 'cadastros/eventos',
        element: (
          <ProtectedRoute>
            <CadastroEventos />
          </ProtectedRoute>
        )
      },
      {
        path: 'cadastros/grupos-eventos',
        element: (
          <ProtectedRoute>
            <GruposEventos />
          </ProtectedRoute>
        )
      },
      {
        path: 'cadastros/linhas',
        element: (
          <ProtectedRoute>
            <CadastroLinhas />
          </ProtectedRoute>
        )
      },
      {
        path: 'cadastros/usuarios',
        element: (
          <ProtectedRoute>
            <CadastroUsuarios />
          </ProtectedRoute>
        )
      },
      {
        path: 'cadastros/vendedores',
        element: (
          <ProtectedRoute>
            <Vendedores />
          </ProtectedRoute>
        )
      },
      {
        path: 'cadastros/clientes-vendedor',
        element: (
          <ProtectedRoute>
            <ClientesVendedor />
          </ProtectedRoute>
        )
      },
      
      // Relatórios (protegidos)
      {
        path: 'relatorios/conferencia-saidas',
        element: (
          <ProtectedRoute>
            <ConferenciaSaidas />
          </ProtectedRoute>
        )
      },
      {
        path: 'relatorios/controle-transbordo',
        element: (
          <ProtectedRoute>
            <ControleTransbordo />
          </ProtectedRoute>
        )
      },
      {
        path: 'relatorios/totais-vendedores',
        element: (
          <ProtectedRoute>
            <TotaisVendedores />
          </ProtectedRoute>
        )
      },
      {
        path: 'relatorios/totais_vendedores',
        element: (
          <ProtectedRoute>
            <TotaisVendedores />
          </ProtectedRoute>
        )
      },
      {
        path: 'relatorios/tabelas-vencer',
        element: (
          <ProtectedRoute>
            <TabelasVencer />
          </ProtectedRoute>
        )
      },
      
      // Administração (protegido)
      {
        path: 'admin/dominios',
        element: (
          <ProtectedRoute>
            <GestaoDominios permissions={{}} />
          </ProtectedRoute>
        )
      },
      {
        path: 'admin/permissoes',
        element: (
          <ProtectedRoute>
            <GestaoPermissoes permissions={{}} />
          </ProtectedRoute>
        )
      },
      {
        path: 'admin/menu',
        element: (
          <ProtectedRoute>
            <GestaoMenu />
          </ProtectedRoute>
        )
      },
      {
        path: 'admin/gestao-menu',
        element: (
          <ProtectedRoute>
            <GestaoMenu />
          </ProtectedRoute>
        )
      },
      {
        path: 'admin/domain-permissions',
        element: (
          <ProtectedRoute>
            <DomainPermissions />
          </ProtectedRoute>
        )
      },
      
      // Estoque (protegido)
      {
        path: 'estoque/cadastro-estoques',
        element: (
          <ProtectedRoute>
            <CadastroEstoques />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/cadastro-itens',
        element: (
          <ProtectedRoute>
            <CadastroItens />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/cadastro-posicoes',
        element: (
          <ProtectedRoute>
            <CadastroPosicoes />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/cadastro-tipos-item',
        element: (
          <ProtectedRoute>
            <CadastroTiposItem />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/entrada',
        element: (
          <ProtectedRoute>
            <EntradaEstoque />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/entrada/nova',
        element: (
          <ProtectedRoute>
            <NovaEntradaEstoque />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/entrada/:seq_entrada',
        element: (
          <ProtectedRoute>
            <DetalhesEntrada />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/saida',
        element: (
          <ProtectedRoute>
            <SaidaEstoque />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/saida/nova',
        element: (
          <ProtectedRoute>
            <NovaSaidaEstoque />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/requisicoes',
        element: (
          <ProtectedRoute>
            <Requisicoes />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/requisicoes/:seq_requisicao',
        element: (
          <ProtectedRoute>
            <RequisicaoDetalhes />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/inventario',
        element: (
          <ProtectedRoute>
            <Inventario />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/inventario/:seqInventario',
        element: (
          <ProtectedRoute>
            <InventarioContagem />
          </ProtectedRoute>
        )
      },
      {
        path: 'estoque/relatorio-movimentacao',
        element: (
          <ProtectedRoute>
            <RelatorioMovimentacao />
          </ProtectedRoute>
        )
      },
      
      // Compras (protegido)
      {
        path: 'compras/fornecedores',
        element: (
          <ProtectedRoute>
            <Fornecedores />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/cadastro-fornecedores',
        element: (
          <ProtectedRoute>
            <CadastroFornecedores />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/cadastro-centros-custo',
        element: (
          <ProtectedRoute>
            <CadastroCentrosCusto />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/ordens-compra',
        element: (
          <ProtectedRoute>
            <CadastroOrdensCompra />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/aprovacao-ordens',
        element: (
          <ProtectedRoute>
            <AprovacaoOrdensCompra />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/orcamentos',
        element: (
          <ProtectedRoute>
            <CadastroOrcamentos />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/orcamentos/novo',
        element: (
          <ProtectedRoute>
            <OrcamentoForm />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/orcamentos/editar/:seq_orcamento',
        element: (
          <ProtectedRoute>
            <OrcamentoForm />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/orcamentos/visualizar/:seq_orcamento',
        element: (
          <ProtectedRoute>
            <OrcamentoForm />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/orcamentos/mapa/:seq_orcamento',
        element: (
          <ProtectedRoute>
            <MapaCotacao />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/orcamentos/coleta/:seq_orcamento/:seq_fornecedor',
        element: (
          <ProtectedRoute>
            <ColetaPrecos />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/orcamento-form',
        element: (
          <ProtectedRoute>
            <OrcamentoForm />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/coleta-precos',
        element: (
          <ProtectedRoute>
            <ColetaPrecos />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/pedidos',
        element: (
          <ProtectedRoute>
            <Pedidos />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/pedidos/novo',
        element: (
          <ProtectedRoute>
            <PedidoForm />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/pedidos/editar/:seq_pedido',
        element: (
          <ProtectedRoute>
            <PedidoForm />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/pedidos/visualizar/:seq_pedido',
        element: (
          <ProtectedRoute>
            <PedidoForm />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/dashboard',
        element: (
          <ProtectedRoute>
            <DashboardCompras />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/solicitacoes-compra',
        element: (
          <ProtectedRoute>
            <SolicitacoesCompra />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/solicitacoes-compra/converter',
        element: (
          <ProtectedRoute>
            <ConverterSolicitacoesCompra />
          </ProtectedRoute>
        )
      },
      {
        path: 'compras/solicitacoes-compra/converter/:id',
        element: (
          <ProtectedRoute>
            <ConverterSolicitacaoDetalhe />
          </ProtectedRoute>
        )
      },
      
      // Operações (protegido)
      {
        path: 'operacoes/aprovacao-despesas',
        element: (
          <ProtectedRoute>
            <AprovacaoDespesas />
          </ProtectedRoute>
        )
      },
      
      // Fallback - rotas não encontradas
      {
        path: '*',
        element: <Navigate to="/" replace />
      }
    ]
  }
], {
  basename: basename
});
