# ✅ CHECKLIST DE TELAS - SISTEMA PRESTO

## 📋 CHECKLIST GERAL

Use este checklist para validar TODAS as telas antes de fazer commit.

---

## 🎨 LAYOUT E ESTRUTURA

### **AdminLayout**
- [ ] Tela não-dashboard usa `<AdminLayout>`
- [ ] Props `title` e `description` preenchidas
- [ ] Título em MAIÚSCULAS
- [ ] Dashboard usa estrutura própria (não usa AdminLayout)

### **Responsividade**
- [ ] Layout funciona em mobile (< 768px)
- [ ] Layout funciona em tablet (768px - 1024px)
- [ ] Layout funciona em desktop (> 1024px)
- [ ] Grid adapta colunas: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- [ ] Botões empilham em mobile: `flex-col sm:flex-row`

### **Scrollbars**
- [ ] Scrollbars seguem o padrão fino e arredondado do sistema
- [ ] Cor em modo Light: `slate-300`
- [ ] Cor em modo Dark: `slate-700`
- [ ] Largura/Altura: 8px
- [ ] Não há scrollbars duplicadas (ex: no body + container)

### **Dark Mode**
- [ ] Todas as cores têm variante dark: `bg-white dark:bg-gray-900`
- [ ] Textos adaptam: `text-gray-900 dark:text-gray-100`
- [ ] Borders adaptam: `border-gray-200 dark:border-gray-700`
- [ ] Testado em modo escuro

---

## 📊 TABELAS

### **Estrutura**
- [ ] Usa componentes `Table`, `TableHeader`, `TableBody`, etc
- [ ] Usa `<SortableTableHeader>` para colunas ordenáveis
- [ ] Implementa hook `useSortableTable`
- [ ] Bordas: `rounded-md border`

### **Ordenação**
- [ ] Todas as colunas importantes são ordenáveis
- [ ] Ícone de ordenação visível
- [ ] Ordenação padrão configurada
- [ ] Estado de ordenação persiste

### **Paginação**
- [ ] Listas longas (>50 itens) têm paginação
- [ ] Seleção de itens por página
- [ ] Navegação de páginas funcional
- [ ] Total de registros exibido

### **Estados Vazios**
- [ ] Mensagem quando não há dados
- [ ] Ícone ilustrativo
- [ ] Texto explicativo
- [ ] Sugestão de ação (ex: "Crie seu primeiro item")

### **Loading**
- [ ] Spinner ou skeleton durante carregamento
- [ ] Tabela não "pisca" ao recarregar
- [ ] Loading state desabilita interações

---

## 📝 FORMULÁRIOS

### **Campos de Texto**
- [ ] Labels em MAIÚSCULAS
- [ ] Placeholders descritivos em MAIÚSCULAS
- [ ] Campos obrigatórios marcados com "*"
- [ ] Inputs convertem para MAIÚSCULAS automaticamente
  ```typescript
  onChange={(e) => setValue(toUpperCaseInput(e.target.value))}
  ```

### **Exceção: Logins**
- [ ] Campos de login SEMPRE em minúsculas
- [ ] Conversão automática para lowercase
- [ ] Validação: apenas letras, números e underline

### **Validações**
- [ ] Validação em tempo real
- [ ] Mensagens de erro claras
- [ ] Estados de erro visíveis (bordas vermelhas)
- [ ] Focus automático no primeiro campo com erro

### **Botões de Ação**
- [ ] Ícone + texto
- [ ] Loading state durante processamento
- [ ] Desabilitado durante loading
- [ ] Feedback visual ao clicar

### **Dialogs/Modals**
- [ ] Overlay escurece fundo
- [ ] Fecha ao clicar fora (quando apropriado)
- [ ] Botão "Cancelar" presente
- [ ] Botão de confirmação destaque
- [ ] ESC fecha o dialog

---

## 🔢 FORMATAÇÃO DE DADOS

### **Números de Documentos**
- [ ] **SEMPRE** formato `AAA000000` (unidade + 6 dígitos)
- [ ] **NUNCA** usar "#" antes do número
- [ ] Aplicado em: Solicitações, Ordens, Cotações, Pedidos
  ```typescript
  const formatarNumeroDocumento = (unidade: string, numero: number): string => {
    return `${unidade}${String(numero).padStart(6, '0')}`;
  };
  ```

### **Valores Monetários**
- [ ] Padrão brasileiro: ponto para milhar, vírgula para decimal
- [ ] Exemplo: `1.234,56`
- [ ] Usar `toLocaleString('pt-BR')`
- [ ] Sempre 2 casas decimais

### **Datas**
- [ ] Formato: `DD/MM/YYYY`
- [ ] Usar `toLocaleDateString('pt-BR')`
- [ ] Inputs de data em formato ISO (YYYY-MM-DD)

### **Horas**
- [ ] Formato: `HH:MM` (sem segundos)
- [ ] Exemplo: `14:30`
- [ ] Nunca exibir milissegundos

### **Percentuais**
- [ ] Com símbolo %
- [ ] 1 ou 2 casas decimais
- [ ] Exemplo: `85,5%`

---

## 🔄 ESTADOS E LOADING

### **Loading States**
- [ ] Spinner ou skeleton durante carregamento inicial
- [ ] Botões mostram loading: `<Loader2 className="animate-spin" />`
- [ ] Botões desabilitados durante loading
- [ ] Texto muda: "Salvar" → "Salvando..."

### **Estados Vazios**
- [ ] Ícone ilustrativo centralizado
- [ ] Mensagem explicativa
- [ ] Sugestão de ação
- [ ] Não mostrar tabela vazia

### **Estados de Erro**
- [ ] Mensagem clara do erro
- [ ] Sugestão de como resolver
- [ ] Botão para tentar novamente
- [ ] Toast de erro automático (via `msg()`)

---

## 🎯 FILTROS

### **Componentes de Filtro**
- [ ] Usar componentes compartilhados:
  - `<FilterSelectCentroCusto>`
  - `<FilterSelectSetor>`
  - `<FilterSelectUnidade>`
- [ ] Botão "Mostrar/Ocultar Filtros"
- [ ] Botão "Limpar Filtros" quando filtros ativos
- [ ] Indicador visual de filtros ativos

### **Período Padrão**
- [ ] Período padrão configurado (ex: últimos 30 dias)
- [ ] Inputs de data com valores pré-preenchidos
- [ ] Validação: data início <= data fim

### **Aplicação de Filtros**
- [ ] Aplicação automática ou botão "Aplicar"
- [ ] Loading durante aplicação
- [ ] Filtros persistem ao navegar

---

## 🔔 FEEDBACK AO USUÁRIO

### **Toasts (Sonner)**
- [ ] Sucesso: toast verde
- [ ] Erro: toast vermelho
- [ ] Aviso: toast amarelo
- [ ] Info: toast azul
- [ ] Toasts aparecem automaticamente (via `msg()` do backend)
- [ ] Nunca duplicar toasts (backend + frontend)

### **Confirmações**
- [ ] Dialog de confirmação para ações destrutivas
- [ ] Texto claro: "Tem certeza que deseja excluir?"
- [ ] Botão de cancelar sempre visível
- [ ] Botão de ação destrutiva em vermelho

### **Ações em Progresso**
- [ ] Feedback visual imediato
- [ ] Desabilitar botão/form durante processamento
- [ ] Loading indicator
- [ ] Mensagem de sucesso ao concluir

---

## 📖 CENTRAL DE AJUDA

### **Estrutura e Layout**
- [ ] Dialog configurado com `max-w-[98vw] w-[98vw]`
- [ ] Botão de fechar padrão oculto via `[&>button]:hidden`
- [ ] Botão de fechar (`X`) interno ao cabeçalho do HelpCenter
- [ ] Conteúdo do manual com scroll vertical (`ScrollArea`)
- [ ] Título no formato: "MÓDULO [NOME DO MÓDULO]" (sem badge separado)
- [ ] Cards de fluxo (`StepBox`) com width adequado e texto legível

### **Identidade Visual e Domínio**
- [ ] Logo Aceville (`aceville.png`) exibida quando `domain === 'ACV'`
- [ ] Logo Presto (`logo-branca-simples.png`) exibida nos demais domínios
- [ ] Frase "Desenvolvido por Presto Tecnologia" **removida** no rodapé do domínio ACV

---

## 🔒 SEGURANÇA E PERMISSÕES

### **Autenticação**
- [ ] Usar `useAuth()` para pegar usuário
- [ ] Verificar `user` antes de renderizar
- [ ] Redirecionar para login se não autenticado

### **Autorização**
- [ ] Verificar permissões específicas quando necessário
- [ ] Ocultar/desabilitar ações não permitidas
- [ ] Validação no backend também

### **Dados Sensíveis**
- [ ] Não exibir senhas
- [ ] Não exibir tokens
- [ ] Logs não contêm dados sensíveis

---

## 🌐 CHAMADAS DE API

### **Padrões**
- [ ] Usar `apiFetch()` (nunca `fetch()` direto)
- [ ] Prefixo `/sistema/api/` em todas as URLs
- [ ] Verificar `data.success` antes de processar
- [ ] Try/catch em todas as chamadas
- [ ] Finally para limpar loading states

### **Exemplo Correto**
```typescript
const carregarDados = async () => {
  setLoading(true);
  try {
    const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/endpoint.php`, {
      method: 'GET'
    });
    
    if (data.success) {
      setDados(data.data || []);
    }
  } catch (error) {
    console.error('Erro ao carregar:', error);
  } finally {
    setLoading(false);
  }
};
```

---

## 🎨 BADGES E INDICADORES

### **Status**
- [ ] Cores consistentes:
  - Verde: Sucesso/Aprovado/Ativo
  - Vermelho: Erro/Reprovado/Cancelado
  - Amarelo: Pendente/Atenção
  - Azul: Info/Processando
  - Cinza: Inativo/Neutro

### **Formatação**
- [ ] Texto em MAIÚSCULAS
- [ ] Padding adequado: `px-2 py-1`
- [ ] Border radius: `rounded-full` ou `rounded`
- [ ] Tamanho de fonte: `text-xs` ou `text-sm`

---

## 📱 ACESSIBILIDADE

### **Geral**
- [ ] Todas as imagens têm `alt` text
- [ ] Botões têm `title` ou `aria-label`
- [ ] Inputs têm `<Label>` associado
- [ ] Navegação por teclado funciona
- [ ] Contraste de cores adequado (WCAG AA)

### **Foco**
- [ ] Estados de foco visíveis
- [ ] Ordem de foco lógica
- [ ] Primeiro campo com erro recebe foco

### **Screen Readers**
- [ ] Elementos interativos são anunciados
- [ ] Mudanças de estado são comunicadas
- [ ] Loading states são anunciados

---

## 📧 EMAILS (se aplicável)

### **Formatação**
- [ ] Assunto concatena com nome da empresa
- [ ] Logo da empresa no cabeçalho
- [ ] Nome e email do usuário na assinatura
- [ ] Copyright: © 2026 Sistema Presto
- [ ] **Números sem "#" no formato AAA000000**

### **Links**
- [ ] URL baseada no domínio:
  - ACV: `/sistema/login-aceville`
  - Outros: `/sistema/`
- [ ] Links são clicáveis
- [ ] Botões têm estilo adequado

---

## 🧪 TESTES MANUAIS

### **Funcionalidade**
- [ ] Criar novo item funciona
- [ ] Editar item funciona
- [ ] Excluir item funciona (com confirmação)
- [ ] Filtros aplicam corretamente
- [ ] Ordenação funciona
- [ ] Paginação funciona

### **Edge Cases**
- [ ] Lista vazia renderiza corretamente
- [ ] Erro de API é tratado
- [ ] Timeout de requisição é tratado
- [ ] Validação de campos obrigatórios funciona
- [ ] Valores extremos (muito grandes/pequenos)

### **Performance**
- [ ] Tela carrega em < 2 segundos
- [ ] Não há travamentos ao interagir
- [ ] Scroll é suave
- [ ] Imagens carregam progressivamente

---

## 🚀 PRÉ-DEPLOY

### **Código**
- [ ] Sem `console.log()` desnecessários
- [ ] Sem código comentado
- [ ] Sem imports não utilizados
- [ ] Sem warnings no console
- [ ] Sem erros no TypeScript

### **Testes**
- [ ] Testado em Chrome
- [ ] Testado em Firefox
- [ ] Testado em Safari
- [ ] Testado em mobile (responsivo)
- [ ] Testado em dark mode
- [ ] Testado com dados reais
- [ ] Testado com mock (se aplicável)

### **Documentação**
- [ ] README atualizado (se necessário)
- [ ] Comentários explicativos em código complexo
- [ ] Props de componentes documentadas

---

## ✨ CHECKLIST ESPECÍFICO POR TIPO DE TELA

### **Tela de Listagem**
- [ ] AdminLayout implementado
- [ ] Tabela ordenável
- [ ] Filtros funcionais
- [ ] Paginação (se necessário)
- [ ] Botão "Nova" no header
- [ ] Estado vazio
- [ ] Loading state
- [ ] Formatação de números de documentos (AAA000000, sem "#")

### **Tela de Formulário**
- [ ] Validação em tempo real
- [ ] Campos obrigatórios marcados
- [ ] Botão salvar com loading
- [ ] Confirmação ao sair sem salvar
- [ ] Inputs em MAIÚSCULAS (exceto logins)
- [ ] Logins em minúsculas

### **Dashboard**
- [ ] Cards com métricas
- [ ] Gráficos responsivos
- [ ] Filtros de período
- [ ] Loading skeletons
- [ ] Formatação de valores brasileira
- [ ] Atualização automática (se aplicável)

### **Tela com Dialog/Modal**
- [ ] Dialog customizado (não `window.confirm()`)
- [ ] Overlay escurece fundo
- [ ] Botão cancelar sempre visível
- [ ] ESC fecha o dialog
- [ ] Loading durante ação

---

## 🔗 REFERÊNCIAS

- [Regras de Desenvolvimento](/REGRAS_DESENVOLVIMENTO.md)
- [Padrões de Código](/PADROES_CODIGO.md)
- [Padrões de API](/api/README_PADROES_API.md)

---

## 💡 DICA FINAL

Imprima este checklist e mantenha ao lado do computador. Use-o SEMPRE antes de:
- Fazer commit
- Abrir Pull Request
- Marcar tarefa como concluída
- Subir para produção

**Qualidade > Velocidade** 🚀
