# 💻 PADRÕES DE CÓDIGO - SISTEMA PRESTO

## 📋 ÍNDICE
- [TypeScript/React](#typescriptreact)
- [PHP](#php)
- [CSS/Tailwind](#csstailwind)
- [SQL/PostgreSQL](#sqlpostgresql)
- [Formatação](#formatação)
- [Nomenclatura](#nomenclatura)

---

## TypeScript/React

### **1. Componentes**

#### **Estrutura Padrão**
```typescript
import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/layouts/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner@2.0.3';
import { ENVIRONMENT } from '../../config/environment';
import { apiFetch } from '../../utils/apiUtils';
import { useAuth } from '../../contexts/AuthContext';

interface MeuComponenteProps {
  // Props tipadas
}

export default function MeuComponente() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(false);
  const [dados, setDados] = useState<DadoType[]>([]);

  useEffect(() => {
    carregarDados();
  }, []);

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
      console.error('Erro:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="TÍTULO" description="Descrição">
      {/* Conteúdo */}
    </AdminLayout>
  );
}
```

### **2. Hooks**

#### **useState**
```typescript
// ✅ CORRETO - Sempre tipar
const [loading, setLoading] = useState<boolean>(false);
const [items, setItems] = useState<Item[]>([]);
const [selectedId, setSelectedId] = useState<number | null>(null);

// ❌ ERRADO - Sem tipagem
const [loading, setLoading] = useState(false);
```

#### **useEffect**
```typescript
// ✅ CORRETO - Com dependências
useEffect(() => {
  carregarDados();
}, [filtro, periodo]);

// ❌ ERRADO - Sem dependências quando necessário
useEffect(() => {
  carregarDados(); // Pode causar loop infinito
});
```

### **3. Formatação de Dados**

#### **Números de Documentos**
```typescript
// ✅ CORRETO - Sem "#" e formato AAA000000
const formatarNumeroDocumento = (unidade: string, numero: number): string => {
  return `${unidade}${String(numero).padStart(6, '0')}`;
};

const nroSolicitacao = formatarNumeroDocumento('MTZ', 123); // MTZ000123

// ❌ ERRADO
const nroSolicitacao = `#${numero}`;
const nroSolicitacao = `#MTZ${numero}`;
```

#### **Valores Monetários**
```typescript
// ✅ CORRETO - Padrão brasileiro
const formatarValor = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

formatarValor(1234.56); // "1.234,56"
```

#### **Horas**
```typescript
// ✅ CORRETO - Apenas HH:MM
const formatarHora = (hora: string): string => {
  return hora.substring(0, 5); // "14:30:45" → "14:30"
};

// ❌ ERRADO - Com segundos
const hora = "14:30:45";
```

### **4. Inputs em MAIÚSCULAS**

```typescript
import { toUpperCaseInput } from '../../utils/stringUtils';

// ✅ CORRETO
<Input
  value={descricao}
  onChange={(e) => setDescricao(toUpperCaseInput(e.target.value))}
/>

<Textarea
  value={observacao}
  onChange={(e) => setObservacao(toUpperCaseInput(e.target.value))}
/>

// ❌ ERRADO - Sem conversão
<Input
  value={descricao}
  onChange={(e) => setDescricao(e.target.value)}
/>
```

### **5. Chamadas de API**

```typescript
// ✅ CORRETO - Com prefixo /sistema/api/
const data = await apiFetch(`${ENVIRONMENT.apiBaseUrl}/compras/solicitacoes.php`, {
  method: 'POST',
  body: JSON.stringify({ dados })
});

// Toast aparece automaticamente se backend usar msg()
if (data.success) {
  // Processar resposta
}

// ❌ ERRADO - fetch() direto (não intercepta msg())
const response = await fetch('/api/endpoint.php');
const data = await response.json();
toast.success(data.message); // Duplicado!
```

### **6. Loading States**

```typescript
// ✅ CORRETO - Loading em todas as operações
const [salvando, setSalvando] = useState(false);

const salvar = async () => {
  setSalvando(true);
  try {
    const data = await apiFetch(url, options);
    // ...
  } catch (error) {
    console.error(error);
  } finally {
    setSalvando(false); // Sempre no finally
  }
};

return (
  <Button onClick={salvar} disabled={salvando}>
    {salvando ? (
      <>
        <Loader2 className="size-4 mr-2 animate-spin" />
        Salvando...
      </>
    ) : (
      <>
        <Save className="size-4 mr-2" />
        Salvar
      </>
    )}
  </Button>
);
```

---

## PHP

### **1. Estrutura Base**

```php
<?php
/**
 * API: Nome da API
 * Descrição: O que faz
 * Métodos: GET, POST
 */

require_once __DIR__ . '/../config.php';

// CONFIGURAÇÃO INICIAL
handleOptionsRequest();

// AUTENTICAÇÃO
$auth = authenticateAndGetUser();
$user = $auth['user'];
$domain = $auth['domain'];

// RECEBER PARÂMETROS
$method = $_SERVER['REQUEST_METHOD'];

// VALIDAR DOMÍNIO
if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    msg('Domínio inválido', 'error');
}

// MOCK
if (shouldUseMockData($domain)) {
    $mockData = getMockData();
    respondJson(['success' => true, 'data' => $mockData]);
    exit;
}

// BANCO DE DADOS
$conn = connect();
$prefix = strtolower($domain) . '_';

// ROTEAMENTO
if ($method === 'GET') {
    handleGet($conn, $prefix, $user);
} elseif ($method === 'POST') {
    handlePost($conn, $prefix, $user);
} else {
    http_response_code(405);
    respondJson(['success' => false, 'message' => 'Método não permitido']);
}
```

### **2. Mensagens ao Usuário**

```php
// ✅ CORRETO - Sempre usar msg()
if (!$resultado) {
    msg('Erro ao processar operação', 'error');
}

if (pg_num_rows($result) === 0) {
    msg('Nenhum registro encontrado', 'warning');
}

msg('Operação realizada com sucesso!', 'success');

// ❌ ERRADO - echo json_encode
echo json_encode(['success' => true, 'message' => 'OK']);
exit;
```

### **3. Queries com Prepared Statements**

```php
// ✅ CORRETO
$params = [$cnpj, $unidade];
$query = "SELECT * FROM {$prefix}tabela WHERE cnpj = $1 AND unidade = $2";
$result = pg_query_params($conn, $query, $params);

if (!$result) {
    msg('Erro ao buscar dados: ' . pg_last_error($conn), 'error');
}

// ❌ ERRADO - SQL Injection!
$query = "SELECT * FROM {$prefix}tabela WHERE cnpj = '$cnpj'";
$result = pg_query($conn, $query);
```

### **4. Formatação de Números de Documentos**

```php
// ✅ CORRETO - Sem "#" e formato AAA000000
function formatarNumeroDocumento($unidade, $numero) {
    return $unidade . str_pad($numero, 6, '0', STR_PAD_LEFT);
}

$nro_solicitacao = formatarNumeroDocumento('MTZ', 123); // MTZ000123

// Em emails
$nro_formatado = $unidade . str_pad($seq_solicitacao_compra, 6, '0', STR_PAD_LEFT);

$html = <<<HTML
<tr>
    <td><strong>Solicitação:</strong></td>
    <td>{$nro_formatado}</td>  <!-- MTZ000123 (sem #) -->
</tr>
HTML;

// ❌ ERRADO
$nro_solicitacao = "#" . str_pad($numero, 6, '0', STR_PAD_LEFT);
$nro_solicitacao = "#{$unidade}{$numero}";
```

### **5. Transações**

```php
// ✅ CORRETO
pg_query($conn, "BEGIN");

try {
    $result1 = pg_query_params($conn, $query1, $params1);
    if (!$result1) {
        throw new Exception('Erro na query 1');
    }
    
    $result2 = pg_query_params($conn, $query2, $params2);
    if (!$result2) {
        throw new Exception('Erro na query 2');
    }
    
    pg_query($conn, "COMMIT");
    msg('Operação concluída com sucesso!', 'success');
    
} catch (Exception $e) {
    pg_query($conn, "ROLLBACK");
    msg('Erro: ' . $e->getMessage(), 'error');
}
```

### **6. Emails**

```php
// ✅ CORRETO
public function sendEmail($to_email, $to_name, $seq, $unidade, $domain, $username) {
    $empresa = $this->getEmpresaInfo($domain);
    $usuario = $this->getUserInfo($domain, $username);
    
    // Formatar número SEM "#"
    $nro_formatado = $unidade . str_pad($seq, 6, '0', STR_PAD_LEFT);
    
    // URL baseada no domínio
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'webpresto.com.br';
    
    if (strtoupper($domain) === 'ACV') {
        $sistema_url = "{$protocol}://{$host}/sistema/login-aceville";
    } else {
        $sistema_url = "{$protocol}://{$host}/sistema/";
    }
    
    $subject = $this->formatarAssunto("Título do Email", $empresa['name']);
    
    // Template HTML...
}
```

---

## CSS/Tailwind

### **1. Classes Tailwind**

```typescript
// ✅ CORRETO - Usar classes Tailwind
<div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 rounded-lg shadow">

// ❌ ERRADO - CSS inline (exceto casos específicos)
<div style={{ display: 'flex', padding: '16px' }}>
```

### **2. Dark Mode**

```typescript
// ✅ CORRETO - Sempre incluir dark mode
<Card className="bg-white dark:bg-gray-900">
<p className="text-gray-600 dark:text-gray-400">

// ❌ ERRADO - Sem dark mode
<Card className="bg-white">
```

### **3. Responsividade**

```typescript
// ✅ CORRETO - Mobile first
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// ❌ ERRADO - Apenas desktop
<div className="grid grid-cols-3 gap-4">
```

---

## SQL/PostgreSQL

### **1. Nomenclatura de Tabelas**

```sql
-- ✅ CORRETO - Com prefixo de domínio (REGRA GERAL)
{$prefix}solicitacao_compra
{$prefix}ordem_compra
{$prefix}centro_custo
{$prefix}setores

-- ✅ CORRETO - Sem prefixo (EXCEÇÕES GLOBAIS)
users
menu_itens
menu_sections
user_permissions

-- ❌ ERRADO - Sem prefixo para tabelas de domínio
solicitacao_compra
setores
```

### **2. Implementação no PHP**
```php
// Definir prefixo baseado no domínio logado
$prefix = strtolower($domain) . '_';

// Query em tabela de domínio
$query = "SELECT * FROM {$prefix}setores WHERE ativo = 'S'";

// Query em tabela global (exceção)
$query = "SELECT * FROM users WHERE username = $1";
```

### **2. Queries Otimizadas**

```sql
-- ✅ CORRETO - Com índices e limitação
SELECT s.*, cc.descricao AS centro_custo_descricao
FROM {$prefix}solicitacao_compra s
LEFT JOIN {$prefix}centro_custo cc ON s.seq_centro_custo = cc.seq_centro_custo
WHERE s.data_inclusao >= $1
ORDER BY s.data_inclusao DESC
LIMIT 50;

-- ❌ ERRADO - Sem limitação
SELECT * FROM {$prefix}solicitacao_compra;
```

---

## Formatação

### **1. Indentação**
- ✅ Usar 2 espaços (TypeScript/React)
- ✅ Usar 4 espaços (PHP)
- ❌ Nunca usar tabs

### **2. Linhas em Branco**
```typescript
// ✅ CORRETO
const carregarDados = async () => {
  setLoading(true);
  
  try {
    const data = await apiFetch(url);
    setDados(data);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};

// ❌ ERRADO - Sem espaçamento
const carregarDados = async () => {
  setLoading(true);
  try {
    const data = await apiFetch(url);
    setDados(data);
  } catch (error) {
    console.error(error);
  } finally {
    setLoading(false);
  }
};
```

### **3. Comentários**

```typescript
// ✅ CORRETO - Comentários explicativos
// Buscar solicitações do período filtrado
const carregarSolicitacoes = async () => {
  // ...
};

// ❌ ERRADO - Comentário óbvio
// Função para carregar solicitações
const carregarSolicitacoes = async () => {
  // ...
};
```

---

## Nomenclatura

### **1. Variáveis e Funções (TypeScript)**

```typescript
// ✅ CORRETO - camelCase
const nomeUsuario = 'João';
const carregarDados = () => {};
const handleSubmit = () => {};

// ❌ ERRADO
const nome_usuario = 'João';
const CarregarDados = () => {};
```

### **2. Componentes (React)**

```typescript
// ✅ CORRETO - PascalCase
export default function SolicitacoesCompra() {}
const CardUsuario = () => {};

// ❌ ERRADO
export default function solicitacoesCompra() {}
const cardUsuario = () => {};
```

### **3. Constantes**

```typescript
// ✅ CORRETO - UPPER_SNAKE_CASE
const API_BASE_URL = '/sistema/api';
const MAX_ITEMS_PER_PAGE = 50;

// ❌ ERRADO
const apiBaseUrl = '/sistema/api';
const maxItemsPerPage = 50;
```

### **4. Interfaces e Types**

```typescript
// ✅ CORRETO - PascalCase
interface SolicitacaoCompra {
  seq_solicitacao_compra: number;
  unidade: string;
}

type StatusType = 'P' | 'A';

// ❌ ERRADO
interface solicitacaoCompra {}
type statusType = 'P' | 'A';
```

---

## ✅ CHECKLIST DE CÓDIGO

Antes de fazer commit:

- [ ] Código está formatado corretamente
- [ ] Variáveis e funções seguem nomenclatura padrão
- [ ] Números de documentos estão sem "#" (formato AAA000000)
- [ ] Inputs convertem para MAIÚSCULAS (exceto logins)
- [ ] Logins em minúsculas
- [ ] Loading states implementados
- [ ] Mensagens PHP usam `msg()`
- [ ] Queries usam prepared statements
- [ ] Dark mode implementado
- [ ] Responsividade implementada
- [ ] Comentários úteis (não óbvios)
- [ ] Sem console.log() desnecessários
- [ ] Sem código comentado (remover)

---

## 🔗 REFERÊNCIAS

- [Regras de Desenvolvimento](/REGRAS_DESENVOLVIMENTO.md)
- [Padrões de API](/api/README_PADROES_API.md)
- [Checklist de Telas](/CHECKLIST_TELAS.md)
