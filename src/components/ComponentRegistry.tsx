/**
 * REGISTRO DE COMPONENTES
 * Mapeamento estático de todos os componentes disponíveis no sistema
 */

import React, { lazy, ComponentType } from 'react';

// Importar componentes estaticamente (usando named exports)
import { LinhasDashboard } from './dashboards/LinhasDashboard';
import { PerformanceEntregas } from './dashboards/PerformanceEntregas';
import { PerformanceColetas } from './dashboards/PerformanceColetas';
import { FluxoCaixa } from './dashboards/FluxoCaixa';
import { FinanceiroDashboard } from './dashboards/FinanceiroDashboard';
import { UserManagement } from './UserManagement';
import { DomainManagement } from './DomainManagement';
import { CadastroEventos } from './cadastros/CadastroEventos';
import { GruposEventos } from './cadastros/GruposEventos';
import { CadastroLinhas } from './cadastros/CadastroLinhas';
import { Vendedores } from './cadastros/Vendedores';
import { ClientesVendedor } from './cadastros/ClientesVendedor';
import { ConferenciaSaidas } from './relatorios/ConferenciaSaidas';
import { ControleTransbordo } from './relatorios/ControleTransbordo';
import { TotaisVendedores } from './relatorios/TotaisVendedores';
import { GestaoMenu } from './admin/GestaoMenu';

// Componentes de ESTOQUE
import Produtos from '../pages/estoque/Produtos';
import Categorias from '../pages/estoque/Categorias';
import Unidades from '../pages/estoque/Unidades';
import Locais from '../pages/estoque/Locais';
import Movimentacoes from '../pages/estoque/Movimentacoes';
import PosicaoEstoque from '../pages/estoque/PosicaoEstoque';
import EstoqueMinimo from '../pages/estoque/EstoqueMinimo';
import RelatorioMovimentacao from '../pages/estoque/RelatorioMovimentacao';

// Aliases ESTOQUE (para compatibilidade com banco de dados)
import CadastroEstoques from '../pages/estoque/CadastroEstoques';
import CadastroPosicoes from '../pages/estoque/CadastroPosicoes';
import CadastroTiposItem from '../pages/estoque/CadastroTiposItem';
import CadastroItens from '../pages/estoque/CadastroItens';
import EntradaEstoque from '../pages/estoque/EntradaEstoque';
import SaidaEstoque from '../pages/estoque/SaidaEstoque';
import NovaSaidaEstoque from '../pages/estoque/NovaSaidaEstoque';
import Requisicoes from '../pages/estoque/Requisicoes';
import Inventario from '../pages/estoque/Inventario';
import InventarioContagem from '../pages/estoque/InventarioContagem';

// Componentes de COMPRAS
import Fornecedores from '../pages/compras/Fornecedores';
import CadastroFornecedores from '../pages/compras/CadastroFornecedores';
import CadastroCentrosCusto from '../pages/compras/CadastroCentrosCusto';
import CadastroOrdensCompra from '../pages/compras/CadastroOrdensCompra';
import AprovacaoOrdensCompra from '../pages/compras/AprovacaoOrdensCompra';
import CadastroOrcamentos from '../pages/compras/CadastroOrcamentos';
import GeracaoPedidos from '../pages/compras/GeracaoPedidos';
import Pedidos from '../pages/compras/Pedidos';
import PedidoForm from '../pages/compras/PedidoForm';

// Componente de fallback para rotas não encontradas
const ComponentNotFound = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-red-600 mb-2">COMPONENTE NÃO ENCONTRADO</h2>
      <p className="text-gray-600">Este componente ainda não foi implementado.</p>
    </div>
  </div>
);

// Componente de funcionalidade em desenvolvimento
const InDevelopment = ({ name }: { name?: string }) => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <h2 className="text-2xl font-bold text-blue-600 mb-2">EM DESENVOLVIMENTO</h2>
      <p className="text-gray-600">{name || 'Esta funcionalidade'} está em desenvolvimento.</p>
      <p className="text-gray-500 text-sm mt-2">Em breve disponível!</p>
    </div>
  </div>
);

// ============================================
// REGISTRO DE COMPONENTES
// ============================================

type ComponentMap = Record<string, ComponentType<any>>;

/**
 * Mapeamento de component_path → Componente React
 * 
 * IMPORTANTE: Ao adicionar novas funcionalidades no banco de dados,
 * adicione o componente correspondente aqui.
 * 
 * Exemplo:
 * 'dashboards/PerformanceEntregas': lazy(() => import('./dashboards/PerformanceEntregas'))
 */
export const COMPONENT_REGISTRY: ComponentMap = {
  // ============================================
  // DASHBOARDS
  // ============================================
  'dashboards/LinhasDashboard': LinhasDashboard,
  'dashboards/PerformanceEntregas': PerformanceEntregas,
  'dashboards/PerformanceColetas': PerformanceColetas,
  'dashboards/FluxoCaixa': FluxoCaixa,
  'dashboards/FinanceiroDashboard': FinanceiroDashboard,
  
  // Outros dashboards (lazy load quando implementados)
  'dashboards/OperacionalDashboard': () => <InDevelopment name="Dashboard Operacional" />,
  'dashboards/FrotasDashboard': () => <InDevelopment name="Dashboard de Frotas" />,
  
  // ============================================
  // OPERAÇÕES
  // ============================================
  'operations/CadastroLinhas': () => <InDevelopment name="Cadastro de Linhas" />,
  'operations/CadastroVeiculos': () => <InDevelopment name="Cadastro de Veículos" />,
  'operations/CadastroMotoristas': () => <InDevelopment name="Cadastro de Motoristas" />,
  'operations/CadastroClientes': () => <InDevelopment name="Cadastro de Clientes" />,
  
  // ============================================
  // CADASTROS
  // ============================================
  'cadastros/CadastroEventos': CadastroEventos,
  'cadastros/GruposEventos': GruposEventos,
  'cadastros/CadastroLinhas': CadastroLinhas, // ✅ CORRIGIDO: era 'cadastros/linhas'
  'cadastros/Vendedores': Vendedores,
  'cadastros/ClientesVendedor': ClientesVendedor,
  
  // ============================================
  // RELATÓRIOS
  // ============================================
  'reports/RelacaoDisponiveis': () => <InDevelopment name="Relação de Disponíveis" />,
  'reports/RelatorioFrete': () => <InDevelopment name="Relatório de Frete" />,
  'reports/RelatorioEntregas': () => <InDevelopment name="Relatório de Entregas" />,
  'relatorios/ConferenciaSaidas': ConferenciaSaidas,
  'relatorios/ControleTransbordo': ControleTransbordo,
  'relatorios/TotaisVendedores': TotaisVendedores,
  
  // ============================================
  // ADMINISTRAÇÃO
  // ============================================
  'admin/GestaoDominios': lazy(() => import('./admin/GestaoDominios').then(module => ({ default: module.default }))),
  'admin/GestaoPermissoes': lazy(() => import('./admin/GestaoPermissoes').then(module => ({ default: module.default }))),
  'admin/GestaoMenu': GestaoMenu,
  'UserManagement': UserManagement, // ✅ Para rota /gerenciamento/usuarios
  'DomainManagement': DomainManagement,
  
  // ============================================
  // ESTOQUE
  // ============================================
  'estoque/Produtos': Produtos,
  'estoque/Categorias': Categorias,
  'estoque/Unidades': Unidades,
  'estoque/Locais': Locais,
  'estoque/Movimentacoes': Movimentacoes,
  'estoque/PosicaoEstoque': PosicaoEstoque,
  'estoque/EstoqueMinimo': EstoqueMinimo,
  'estoque/RelatorioMovimentacao': RelatorioMovimentacao,
  
  // Aliases ESTOQUE (para compatibilidade com banco de dados)
  'estoque/CadastroEstoques': CadastroEstoques,
  'estoque/CadastroPosicoes': CadastroPosicoes,
  'estoque/CadastroTiposItem': CadastroTiposItem,
  'estoque/CadastroItens': CadastroItens,
  'estoque/EntradaEstoque': EntradaEstoque,
  'estoque/SaidaEstoque': SaidaEstoque,
  'estoque/NovaSaidaEstoque': NovaSaidaEstoque,
  'estoque/Requisicoes': Requisicoes,
  'estoque/Inventario': Inventario,
  'estoque/InventarioContagem': InventarioContagem,
  
  // ============================================
  // COMPRAS
  // ============================================
  'compras/Fornecedores': Fornecedores,
  'compras/CadastroFornecedores': CadastroFornecedores,
  'compras/CadastroCentrosCusto': CadastroCentrosCusto,
  'compras/CadastroOrdensCompra': CadastroOrdensCompra,
  'compras/AprovacaoOrdensCompra': AprovacaoOrdensCompra,
  'compras/CadastroOrcamentos': CadastroOrcamentos,
  'compras/GeracaoPedidos': GeracaoPedidos,
  'compras/Pedidos': Pedidos,
  'compras/PedidoForm': PedidoForm,
};

/**
 * Busca um componente pelo path
 * Retorna ComponentNotFound se não encontrar
 */
export const getComponent = (componentPath: string): ComponentType<any> => {
  const Component = COMPONENT_REGISTRY[componentPath];
  
  if (!Component) {
    console.error('❌ [ComponentRegistry] Componente NÃO encontrado:', componentPath);
    return ComponentNotFound;
  }
  
  return Component;
};

/**
 * Verifica se um componente está registrado
 */
export const isComponentRegistered = (componentPath: string): boolean => {
  return componentPath in COMPONENT_REGISTRY;
};

/**
 * Lista todos os componentes registrados
 */
export const getRegisteredComponents = (): string[] => {
  return Object.keys(COMPONENT_REGISTRY);
};

export default COMPONENT_REGISTRY;