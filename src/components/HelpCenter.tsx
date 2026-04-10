import React from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  ChevronRight, 
  CheckCircle2, 
  AlertCircle, 
  Info,
  Package,
  ArrowRightLeft,
  ClipboardList,
  MapPin,
  Settings2,
  Users,
  Building,
  ArrowRight,
  Workflow,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getLogoConfig } from '../config/clientLogos';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

interface HelpCenterProps {
  module?: 'estoque' | 'compras' | 'geral';
  onClose?: () => void;
}

export function HelpCenter({ module = 'estoque', onClose }: HelpCenterProps) {
  const { user } = useAuth();
  const logoConfig = getLogoConfig(user?.domain);
  const isACV = user?.domain === 'ACV';

  // Configurações de cores baseadas no módulo
  const moduleColors = {
    estoque: 'blue',
    compras: 'emerald',
    geral: 'indigo'
  };

  const primaryColor = moduleColors[module] || 'blue';

  return (
    <div className="flex flex-col h-[90vh] w-full bg-background text-foreground overflow-hidden rounded-xl border shadow-2xl relative">
      {/* Cabeçalho White-Label */}
      <header className="p-6 border-b bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 shrink-0">
        <div className="flex justify-between items-start pr-8">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-${primaryColor}-100 dark:bg-${primaryColor}-900/30 text-${primaryColor}-600 dark:text-${primaryColor}-400`}>
              <HelpCircle className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Central de Ajuda</h1>
              <p className="text-muted-foreground">Manual de Utilização e Protocolos</p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-950 border shadow-sm">
              <img 
                src={isACV 
                  ? "https://www.webpresto.com.br/images/logos_clientes/aceville.png" 
                  : "https://sistema.webpresto.com.br/images/logo-branca-simples.png"
                } 
                alt={isACV ? "Aceville" : "Presto Tecnologia"} 
                className={`h-4 object-contain ${!isACV ? 'brightness-0 dark:brightness-100' : ''}`}
              />
              <span className="text-xs font-semibold text-slate-500">{logoConfig.clientName}</span>
            </div>
          </div>
        </div>

        {/* Botão de Fechar Interno (X) */}
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors z-10"
            title="Fechar"
          >
            <X className="w-6 h-6" />
          </button>
        )}
      </header>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[95%] mx-auto space-y-12 pb-12">
          
          {/* Introdução do Módulo */}
          <section className="space-y-4">
            <h2 className="text-xl font-bold uppercase tracking-wider">Módulo {module}</h2>
            <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
              Bem-vindo ao manual do módulo de {module}. Este guia contém todos os protocolos e fluxos operacionais necessários para manter a integridade e eficiência do sistema.
            </p>
          </section>

          <Separator />

          {/* Fluxograma Visual Simplificado */}
          <section className="space-y-6">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <Workflow className="w-5 h-5" />
              <h3 className="font-bold text-lg">Fluxo Operacional de Estoque</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
              <StepBox icon={<Users />} title="1. Admin" desc="Configurações e Permissões" />
              <div className="hidden md:flex justify-center"><ArrowRight className="text-slate-300" /></div>
              <StepBox icon={<Building />} title="2. Unidades" desc="Importação SSW / Cadastro" />
              <div className="hidden md:flex justify-center"><ArrowRight className="text-slate-300" /></div>
              <StepBox icon={<Package />} title="3. Estoques" desc="Definição por Unidade" />
              <div className="hidden md:flex justify-center"><ArrowRight className="text-slate-300" /></div>
              <StepBox icon={<Settings2 />} title="4. Itens" desc="Tipos e Cadastros" />
              <div className="hidden md:flex justify-center"><ArrowRight className="text-slate-300" /></div>
              <StepBox icon={<MapPin />} title="5. Posições" desc="Endereçamento e Saldos" />
            </div>
          </section>

          {/* Lista de Procedimentos Detalhada baseada no Manual */}
          <section className="space-y-8">
            <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
              <ClipboardList className="w-5 h-5" />
              <h3 className="font-bold text-lg">Protocolos de Utilização (Passo a Passo)</h3>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <ProtocolItem 
                number="01" 
                title="Configuração e Acessos" 
                content="O administrador deve cadastrar usuários e definir permissões por tela. Unidades devem ser importadas do SSW ou cadastradas manualmente antes de iniciar."
              />
              <ProtocolItem 
                number="02" 
                title="Estrutura de Estoques" 
                content="Cada unidade pode ter múltiplos estoques. O formato de numeração AAA000000 (Unidade + Número) é automático para facilitar a identificação."
              />
              <ProtocolItem 
                number="03" 
                title="Gestão de Itens e Tipos" 
                content="Cadastre os 'Tipos de Item' (esqueleto personalizável). Itens exigem código interno (obrigatório) e fabricante (opcional), além da unidade de medida."
              />
              <ProtocolItem 
                number="04" 
                title="Estoque Mínimo e Máximo" 
                content="Defina limites no cadastro do item. Ao atingir o mínimo pelo consumo, o sistema sinaliza automaticamente o setor de COMPRAS para reposição."
              />
              <ProtocolItem 
                number="05" 
                title="Endereçamento (Posições)" 
                content="Use o formato Rua/Altura/Coluna (Ex: A/1/1). Caso não controle endereços, utilize a posição genérica PSO/1/1 para todos os itens."
              />
              <ProtocolItem 
                number="06" 
                title="Inventário e Contagem" 
                content="Realize inventários periódicos (Gerais ou Parciais por Rua). Essencial para corrigir inconsistências de saldo após o início das operações."
              />
              <ProtocolItem 
                number="07" 
                title="Entradas de Mercadoria" 
                content="Podem ser Manuais (ajustes) ou via Pedido (vincular pedido de Compras). No recebimento, confira a quantidade e defina a posição de destino."
              />
              <ProtocolItem 
                number="08" 
                title="Saídas e Requisições" 
                content="Informe o solicitante e o Centro de Custo. Para controle de frota, a placa do veículo é obrigatória para rateio de custos."
              />
              <ProtocolItem 
                number="09" 
                title="Relatórios e Monitoramento" 
                content="Acompanhe entradas, saídas, inventários e o saldo financeiro do período. Filtros detalhados permitem auditoria total da movimentação."
              />
            </div>
          </section>

          {/* Dicas e Alertas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-900/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
                  <AlertCircle className="w-5 h-5" />
                  <span>Dica Importante</span>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-400">
                Mantenha os Inventários frequentes. Mesmo após o Go-Live, conferências parciais (ex: apenas uma rua) evitam inconsistências financeiras.
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/30 dark:bg-blue-900/10">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold">
                  <Info className="w-5 h-5" />
                  <span>Valorização</span>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 dark:text-slate-400">
                Cadastre o valor unitário aproximado dos itens. O sistema atualizará esse valor automaticamente a cada nova compra.
              </CardContent>
            </Card>
          </div>

          <footer className="pt-8 text-center text-sm text-muted-foreground border-t">
            <p>© {new Date().getFullYear()} {logoConfig.clientName} - Todos os direitos reservados</p>
            {!isACV && <p>Desenvolvido por Presto Tecnologia</p>}
          </footer>
        </div>
      </ScrollArea>
    </div>
  );
}

function StepBox({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex flex-col items-center text-center p-8 rounded-xl border bg-card hover:shadow-md transition-shadow min-h-[180px] justify-center w-full">
      <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 mb-5">
        {React.cloneElement(icon as React.ReactElement, { className: 'w-8 h-8' })}
      </div>
      <h4 className="text-base font-bold uppercase mb-3">{title}</h4>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">{desc}</p>
    </div>
  );
}

function ProtocolItem({ number, title, content }: { number: string, title: string, content: string }) {
  return (
    <div className="flex gap-4 p-4 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
      <span className="text-2xl font-black text-slate-200 dark:text-slate-800 select-none">{number}</span>
      <div className="space-y-1">
        <h4 className="font-bold text-slate-900 dark:text-slate-100">{title}</h4>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{content}</p>
      </div>
    </div>
  );
}
