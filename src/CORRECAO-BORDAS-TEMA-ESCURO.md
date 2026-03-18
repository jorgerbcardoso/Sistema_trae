# 🎨 Correção de Bordas Brancas no Tema Escuro

## ⚠️ Problema Identificado

No servidor, vários elementos estavam exibindo **bordas brancas** no tema escuro, diferente do comportamento correto do Figma Make onde as bordas usam a cor `hsl(var(--border))` conforme definido nas variáveis CSS.

### Elementos Afetados:
- ❌ Inputs de texto (quando em foco)
- ❌ Textareas (campo de observação em dialogs)
- ❌ Tabelas (bordas de linhas e colunas)
- ❌ Cards (bordas de containers)
- ❌ Checkboxes e radio buttons
- ❌ Dialogs e Popovers

## ✅ Solução Implementada

### Arquivo Modificado: `/styles/globals.css`

Adicionada seção específica para corrigir bordas no tema escuro:

```css
/* ================================================================
 * ✅ CORREÇÃO DE BORDAS NO TEMA ESCURO - FORÇAR CORES CORRETAS
 * ================================================================ */
```

### Regras Aplicadas:

1. **Inputs, Textareas e Selects**
   - Cor padrão: `hsl(var(--input))`
   - Focus: `hsl(var(--ring))`

2. **Tabelas**
   - Todos os elementos (`table`, `thead`, `tbody`, `tr`, `th`, `td`)
   - Cor: `hsl(var(--border))`

3. **Cards e Containers**
   - Elements com `data-slot="card"`
   - Cor: `hsl(var(--border))`
   - **Exceções**: borders coloridos intencionais (red, green, blue, etc.)

4. **Dialogs e Popovers**
   - Elementos com `data-slot="dialog"` e `data-slot="popover"`
   - Cor: `hsl(var(--border))`

5. **Bordas Direcionais** ⭐ NOVO
   - Classes `.border-t`, `.border-b`, `.border-l`, `.border-r`
   - Cor: `hsl(var(--border))`
   - **Exceções**: borders coloridos intencionais

6. **Separator Component** ⭐ NOVO
   - Elemento com `data-slot="separator-root"`
   - Background: `hsl(var(--border))`
   - Corrige linhas separadoras entre seções

## 🚀 Deploy no Servidor

### Passo 1: Verificar Variáveis CSS

Certifique-se de que as variáveis CSS estão corretas no servidor:

```css
.dark {
  --border: 217.2 32.6% 17.5%;  /* Cor escura para bordas */
  --input: 217.2 32.6% 17.5%;   /* Mesma cor para inputs */
  --ring: 212.7 26.8% 83.9%;    /* Cor clara para focus */
}
```

### Passo 2: Limpar Cache

Após fazer o deploy do arquivo `globals.css` atualizado:

1. **Limpar cache do navegador**: Ctrl+Shift+R (Windows/Linux) ou Cmd+Shift+R (Mac)
2. **Limpar cache do servidor** (se aplicável)
3. **Forçar rebuild do Tailwind CSS** (se usar build process)

### Passo 3: Testar no Tema Escuro

Verificar os seguintes elementos no tema escuro:

- [ ] Dialog de detalhes da ordem de compra → campo observação sem borda branca
- [ ] **Linha separadora** entre observação e itens → sem linha branca ⭐ NOVO
- [ ] Tabela de itens em dialogs → bordas corretas
- [ ] Lista de solicitações de compra → sem borda branca
- [ ] Tela de orçamentos → lista sem borda branca
- [ ] Buscador de ordens de compra → input sem borda branca ao focar
- [ ] **Lista de itens após seleção** de ordem → sem borda branca ⭐ NOVO
- [ ] Cadastro de usuários → todos os inputs sem borda branca
- [ ] Checkboxes → bordas corretas
- [ ] Cards em geral → bordas escuras
- [ ] Separadores (linhas horizontais) em geral → sem linhas brancas ⭐ NOVO

## 🔍 Como Verificar se Funcionou

1. Ativar **tema escuro** no sistema
2. Abrir **DevTools** (F12)
3. Inspecionar um elemento com borda problemática
4. Verificar no CSS computado:
   - ✅ `border-color: hsl(217.2, 32.6%, 17.5%)` = Correto
   - ❌ `border-color: white` ou `rgb(255, 255, 255)` = Ainda incorreto

## 📝 Notas Importantes

### Exceções Mantidas

As seguintes classes **mantêm** suas cores originais (não são sobrescritas):

- `.border-white` - branco intencional
- `.border-transparent` - transparente
- `.border-current` - cor atual do texto
- `.border-red-*` - bordas vermelhas (ex: erros, alertas)
- `.border-green-*` - bordas verdes (ex: sucesso, selecionado)
- `.border-blue-*`, `.border-yellow-*`, `.border-purple-*`, etc.

### Prioridade das Regras

As regras usam `!important` para garantir que sobrescrevam estilos compilados do Tailwind que possam estar incorretos no servidor. Isso é necessário porque:

1. O problema é **específico do servidor** (não ocorre no Figma Make)
2. Pode haver diferença na ordem de compilação do CSS
3. Garante consistência entre ambientes

## 🐛 Troubleshooting

### Problema Persiste Após Deploy

Se as bordas brancas ainda aparecerem:

1. **Verificar se o arquivo foi atualizado no servidor**
   ```bash
   # SSH no servidor
   cat /caminho/para/styles/globals.css | grep "CORREÇÃO DE BORDAS"
   ```

2. **Verificar ordem de carregamento do CSS**
   - O `globals.css` deve ser carregado ANTES de outros estilos customizados
   - Verificar no `<head>` do HTML gerado

3. **Verificar cache do CDN** (se houver)
   - Purgar cache do CDN
   - Usar query string para forçar reload: `globals.css?v=2`

### Conflitos com Tailwind

Se houver conflitos com classes Tailwind existentes:

1. As regras CSS adicionadas são **mais específicas** que as do Tailwind
2. O `!important` garante prioridade
3. As exceções (`:not([class*="border-"])`) evitam sobrescrever borders intencionais

## ✅ Checklist Final

Antes de considerar a correção completa:

- [ ] Arquivo `/styles/globals.css` atualizado no servidor
- [ ] Cache limpo (navegador + servidor)
- [ ] Tema escuro ativado para teste
- [ ] Todos os elementos listados testados
- [ ] DevTools confirmam cores corretas
- [ ] Nenhuma exceção (borders coloridos) foi afetada

## 📞 Suporte

Se o problema persistir após seguir todos os passos:

1. Enviar screenshot do DevTools mostrando o CSS computado
2. Informar versão do navegador e sistema operacional
3. Verificar se há CSS customizado adicional no servidor