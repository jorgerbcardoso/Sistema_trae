# 📋 REGRAS DE DESENVOLVIMENTO - SISTEMA PRESTO

## ⚠️ REGRAS CRÍTICAS OBRIGATÓRIAS

### 1. **DADOS REAIS**
- ✅ Sempre usar dados reais do banco de dados
- ✅ Suporte a dados mockados apenas para desenvolvimento/testes
- ❌ NUNCA usar dados mockados em produção

### 2. **NOVO PADRÃO DE CABEÇALHO**
- ✅ Todas as telas não-dashboard devem usar `<AdminLayout>`
- ✅ O AdminLayout implementa o novo padrão de cabeçalho aprovado
- ❌ Nunca criar cabeçalhos customizados fora do AdminLayout

### 3. **TABELAS ORDENÁVEIS**
- ✅ Todas as tabelas devem permitir ordenação por colunas
- ✅ Usar o componente `<SortableTableHeader>`
- ✅ Implementar hook `useSortableTable`

### 4. **LISTAS PAGINADAS**
- ✅ Listas longas devem ter paginação
- ✅ Limite padrão: 50 itens por página
- ✅ Permitir seleção de quantidade de itens por página

### 5. **LOADING OBRIGATÓRIO**
- ✅ Toda requisição assíncrona deve mostrar loading
- ✅ Usar spinners ou skeletons
- ✅ Desabilitar botões durante processamento

### 6. **CAMPOS EM MAIÚSCULAS**
- ✅ Campos de texto devem converter para MAIÚSCULAS automaticamente
- ✅ Usar função `toUpperCaseInput()` do `stringUtils`
- ✅ Aplicar em: inputs, textareas, selects com texto livre

### 7. **LOGINS EM MINÚSCULAS**
- ✅ Logins de usuários SEMPRE em minúsculas
- ✅ Converter antes de salvar no banco
- ✅ Validar formato: apenas letras, números e underline

### 8. **COMPONENTE AdminLayout**
- ✅ Usar para TODAS as telas não-dashboard
- ✅ Dashboards usam estrutura própria
- ✅ Passar props: `title`, `description`

### 9. **INTERCEPTAÇÃO DE MENSAGENS PHP**
- ✅ Todas as mensagens PHP usam função `msg()`
- ✅ Frontend intercepta via `/utils/apiUtils.ts`
- ✅ Mensagens viram Toast automaticamente
- ❌ NUNCA usar `echo json_encode` para mensagens

### 10. **USO DA FUNÇÃO sql() SSW**
- ✅ Todas as APIs PHP devem usar `sql($query, $params, $g_sql)`
- ✅ Biblioteca SSW com PostgreSQL
- ✅ Padrão correto de prepared statements

### 11. **FORMATAÇÃO DE VALORES**
- ✅ Valores/quantidades no padrão brasileiro:
  - Ponto para milhar: `1.234,56`
  - Vírgula para decimal
- ✅ Horas no formato `HH:MM` (sem segundos/milissegundos)

### 12. **PREFIXO DE API**
- ✅ SEMPRE usar `/sistema/api/` (nunca apenas `/api/`)
- ✅ Evita erro 404
- ✅ Aplicar em todas as chamadas `apiFetch()`

### 13. **SPA (SINGLE PAGE APPLICATION)**
- ✅ Sistema tem APENAS um arquivo HTML (`/index.html`)
- ❌ NUNCA criar arquivos HTML separados
- ✅ Sempre usar componentes React e rotas no React Router

### 14. **FORMATAÇÃO DE NÚMEROS DE DOCUMENTOS**
- ✅ **SEMPRE** no formato `AAA000000` (unidade + 6 dígitos)
- ❌ **NUNCA** usar "#" antes do número
- ✅ Aplicar em: Solicitações, Ordens, Cotações, Pedidos
- ✅ Exemplos: `MTZ000001`, `FLN000123`

### 15. **NOMENCLATURA DE TABELAS (DOMÍNIO)**
- ✅ **REGRA GERAL**: Todas as tabelas do banco de dados devem ter o prefixo `[dominio]_` (ex: `acv_setores`, `vcs_produtos`)
- ✅ **EXCEÇÕES (SEM PREFIXO)**:
  - `users`
  - `menu_itens`
  - `menu_sections`
  - `user_permissions`
- ✅ No PHP, usar a variável `$prefix` (geralmente `strtolower($domain) . '_'`) para montar as queries.

### 16. **PADRONIZAÇÃO DE SCROLLBARS**
- ✅ **ESTILO ÚNICO**: O sistema utiliza scrollbars customizadas (finas e arredondadas).
- ✅ **CONFIGURAÇÃO**: Definida globalmente em `globals.css` via `@layer base`.
- ✅ **CORES**: 
  - Light: `bg-slate-300` (hover: `bg-slate-400`)
  - Dark: `bg-slate-700` (hover: `bg-slate-600`)
- ✅ **LARGURA**: 8px para vertical e horizontal.

### 17. **LOGOTIPOS DO SISTEMA (CABEÇALHOS E LOGIN)**
- ✅ **PRIORIDADE DE EXIBIÇÃO**: 
  1. `logo_light` / `logo_dark` cadastradas no domínio (banco de dados).
  2. Logo específica por domínio (ex: Aceville para `ACV`).
  3. Logo padrão Presto (demais domínios).
- ✅ **TEMAS**: A escolha entre light/dark deve seguir a preferência do sistema/navegador do usuário.
- ✅ **IMPLEMENTAÇÃO**: Usar sempre a função `getLogoUrl(domain, theme, clientConfig)` para garantir a aplicação da prioridade.
- ❌ **URLS HARDCODED**: Evitar o uso de URLs de logotipos fixas nos componentes; centralizar na `clientLogos.ts`.

### 18. **LOGOTIPOS EM IMPRESSÕES (PDF E EXCEL)**
- ✅ **URL ABSOLUTA**: Usar sempre URLs absolutas (`https://...`) para imagens em janelas de impressão ou exportações Excel.
- ✅ **LÓGICA DE POSICIONAMENTO (PDF/HTML)**:
  - **LADO ESQUERDO (Logo Cliente)**: 
    - Se `domain === 'ACV'`: `https://sistema.webpresto.com.br/images/logos_clientes/aceville.png`
    - Demais domínios: `https://webpresto.com.br/images/logo_rel.png`
  - **LADO DIREITO (Logo Sistema)**: 
    - Se `domain === 'ACV'`: **EXCLUIR** a logo do sistema (Presto).
    - Demais domínios: `https://webpresto.com.br/images/logo_rel.png` (Logo oficial do Presto).
- ✅ **LÓGICA EXCEL**:
  - Usar apenas **UMA** logo (do cliente) no cabeçalho.
  - Se `domain === 'ACV'`: Usar obrigatoriamente `https://sistema.webpresto.com.br/images/logos_clientes/aceville.png`.
- ✅ **CABEÇALHO**: O texto abaixo do título do documento deve ser sempre **"Sistema de Gestão"**.
- ❌ **CAMINHOS RELATIVOS**: Nunca usar `/sistema/logo.png` em impressões (causa erro de carregamento).
- ✅ **ESPERA DE CARREGAMENTO (PDF)**: Sempre incluir o script de verificação de carregamento de imagens antes de disparar o `window.print()`.

### 18. **CENTRAL DE AJUDA (MÓDULOS)**
- ✅ **ACIONAMENTO**: Botão `HelpCircle` estilizado como ícone de item (`h-10 w-10`, `rounded-xl`, `bg-gradient-to-br from-blue-100 to-purple-100`), posicionado estrategicamente (ex: ao lado do expansor de módulo).
- ✅ **LARGURA DO DIALOG**: Deve ocupar quase todo o `width` disponível na tela (`max-w-[98vw] w-[98vw]`).
- ✅ **LOGO NO CABEÇALHO**: 
  - Se `domain === 'ACV'`: `https://www.webpresto.com.br/images/logos_clientes/aceville.png`
  - Demais domínios: `https://sistema.webpresto.com.br/images/logo-branca-simples.png`
- ✅ **RODAPÉ (ACV)**: Para o domínio **ACV**, **REMOVER** a frase "Desenvolvido por Presto Tecnologia".
- ✅ **TÍTULO**: Usar o formato **"MÓDULO [NOME DO MÓDULO]"** (ex: MÓDULO ESTOQUE).
- ✅ **BOTÃO DE FECHAR**: Ocultar o botão de fechar padrão do Dialog (`[&>button]:hidden`) e utilizar um botão `X` interno ao cabeçalho do componente de ajuda.
- ✅ **SCROLL**: O conteúdo deve possuir scroll vertical independente do cabeçalho fixo.

---

## 📁 ESTRUTURA DE ARQUIVOS

### **Backend (PHP)**
```
/api/
  ├── config.php                    # Configuração global
  ├── services/
  │   └── EmailService.php          # Serviço de emails
  ├── compras/
  │   ├── solicitacoes_compra.php
  │   └── orcamentos.php
  └── dashboards/
      └── performance-entregas/
```

### **Frontend (React)**
```
/pages/
  ├── compras/
  │   ├── SolicitacoesCompra.tsx
  │   └── MapaCotacao.tsx
  └── dashboards/
      └── PerformanceEntregas.tsx

/components/
  ├── layouts/
  │   └── AdminLayout.tsx           # Layout padrão
  ├── shared/                       # Componentes compartilhados
  └── ui/                           # Componentes base
```

---

## 🎯 PADRÕES DE CÓDIGO

### **TypeScript/React**

#### **1. Importações**
```typescript
// Ordem correta:
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiFetch } from '../../utils/apiUtils';
import { Card } from '../../components/ui/card';
```

#### **2. Estados**
```typescript
// Sempre tipar estados
const [loading, setLoading] = useState<boolean>(false);
const [dados, setDados] = useState<DadosType[]>([]);
```

#### **3. Chamadas de API**
```typescript
// ✅ CORRETO
const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes_compra.php`, {
  method: 'GET'
});

// ❌ ERRADO (sem prefixo /sistema/)
const data = await fetch('/api/solicitacoes_compra.php');
```

### **PHP**

#### **1. Estrutura Base**
```php
<?php
require_once __DIR__ . '/../config.php';

handleOptionsRequest();
$auth = authenticateAndGetUser();
$user = $auth['user'];
$domain = $auth['domain'];

// Validações
if (!$param) {
    msg('Erro', 'error');
}

// Query
$result = pg_query_params($conn, $query, $params);
```

#### **2. Mensagens ao Usuário**
```php
// ✅ CORRETO
msg('Operação realizada com sucesso!', 'success');
msg('Erro ao processar', 'error');
msg('Atenção: Dados incompletos', 'warning');

// ❌ ERRADO
echo json_encode(['success' => true, 'message' => 'OK']);
```

---

## 🚀 BOAS PRÁTICAS

### **1. Performance**
- ✅ Usar índices no banco de dados
- ✅ Limitar resultados de queries
- ✅ Implementar lazy loading quando possível
- ✅ Otimizar queries N+1

### **2. Segurança**
- ✅ Sempre usar prepared statements
- ✅ Validar entrada do usuário
- ✅ Sanitizar dados antes de exibir
- ✅ Verificar permissões de acesso

### **3. UX/UI**
- ✅ Feedback visual para todas as ações
- ✅ Loading states
- ✅ Mensagens de erro claras
- ✅ Confirmação para ações destrutivas

### **4. Acessibilidade**
- ✅ Labels em todos os inputs
- ✅ Textos alternativos em imagens
- ✅ Navegação por teclado
- ✅ Contraste adequado de cores

---

## 📧 EMAILS

### **Padrões Obrigatórios**

1. **Assunto**: Sempre concatenar com nome da empresa: `$this->formatarAssunto("Assunto", $empresa['name'])`.
2. **Logo**: Usar logo da empresa (prioridade 1) ou logo do sistema (prioridade 2). SEMPRE passar a URL da logo para o método `sendEmail` para incorporação automática como **CID (Embedded Image)**.
3. **Assinatura**: Nome e email do usuário solicitante (nunca "Sistema Presto").
4. **Copyright**: © 2026 Sistema Presto.
5. **Números de Documentos**: SEMPRE no formato `AAA000000` (unidade + 6 dígitos). **NUNCA** usar "#" antes do número.
6. **Layout (Compatibilidade)**:
   - ✅ **OBRIGATÓRIO**: Usar layout baseado em **TABELAS** (`<table>`, `<tr>`, `<td>`).
   - ✅ **OBRIGATÓRIO**: CSS **ESTRITAMENTE INLINE** em todas as tags.
   - ✅ **OBRIGATÓRIO**: Usar o método `wrapInMainTemplate` do `EmailService.php` para garantir o "Shell" padrão.
   - ❌ **PROIBIDO**: Usar `<div>`, `flex`, `grid`, `gradients`, `box-shadow` ou classes CSS externas/style tags (são ignoradas por Outlook/Gmail).
7. **Fontes**: Usar fontes seguras para email (Arial, Helvetica, sans-serif).

### **Exemplo de Fluxo**
```php
$empresa = $this->getEmpresaInfo($domain);
$usuario = $this->getUserInfo($domain, $username);
$nro_solicitacao = $unidade . str_pad($seq, 6, '0', STR_PAD_LEFT); // Ex: MTZ000123

$subject = $this->formatarAssunto("Nova Solicitação de Compra", $empresa['name']);
$inner_content = "<h1>Título</h1><p>Conteúdo aqui...</p>";

// O wrapInMainTemplate já garante a estrutura de tabelas e CSS inline básica
$html_body = $this->wrapInMainTemplate($inner_content, $domain, $empresa, $usuario);

// Enviar passando a logo para virar CID
return $this->sendEmail($to_email, $to_name, $subject, $html_body, '', [], $domain, $empresa['logo_url']);
```

---

## ✅ CHECKLIST PRÉ-COMMIT

Antes de fazer commit:

- [ ] Código segue os padrões de formatação
- [ ] Todas as mensagens usam `msg()` no backend
- [ ] Números de documentos estão sem "#" e no formato AAA000000
- [ ] Chamadas de API usam prefixo `/sistema/api/`
- [ ] Loading states implementados
- [ ] Inputs convertem para MAIÚSCULAS (exceto logins)
- [ ] Logins em minúsculas
- [ ] Tabelas são ordenáveis
- [ ] AdminLayout usado (se não for dashboard)
- [ ] Testado em ambiente de desenvolvimento

---

## 🔗 LINKS ÚTEIS

- [Padrões de API](/api/README_PADROES_API.md)
- [Padrões de Código](/PADROES_CODIGO.md)
- [Checklist de Telas](/CHECKLIST_TELAS.md)
