# 🎯 FLUXO CORRETO DE DEPLOY - SISTEMA PRESTO

## **✅ SEU FLUXO ESTÁ CORRETO!**

```
FIGMA MAKE → PUSH → GitHub → PULL + DEPLOY → Servidor
```

---

## **📝 PASSO A PASSO:**

### **1️⃣ AQUI NO FIGMA MAKE:**

**Não precisa fazer NADA manualmente!**

Apenas diga: **"Faça commit e push para o GitHub"**

Eu vou fazer:
- ✅ Commit de todos os arquivos corrigidos
- ✅ Push para `origin/main`

---

### **2️⃣ NO SERVIDOR:**

**OPÇÃO A: Deploy Normal (sem limpeza)**

```bash
cd /var/www/html/sistema
sudo bash deploy.sh
```

**OPÇÃO B: Limpeza + Deploy (RECOMENDADO se houver muito lixo)**

```bash
cd /var/www/html/sistema
sudo bash limpar-e-deploy.sh
```

**OPÇÃO C: Limpeza Manual + Deploy**

```bash
cd /var/www/html/sistema

# Limpar lixo (preservando .git e api/)
sudo bash limpar-antes-deploy.sh

# Deploy
sudo bash deploy.sh
```

---

## **🧹 SOBRE A LIMPEZA:**

### **O que será REMOVIDO:**
- ❌ `build/` `dist/` `.next/` (builds antigos)
- ❌ `node_modules/` (será reinstalado)
- ❌ `.vite/` `.cache/` (cache)
- ❌ `assets/` `index.html` da raiz (serão recriados)
- ❌ `components/` `services/` etc da raiz (virão do git)
- ❌ Arquivos `.log` `.tmp`
- ❌ Backups muito antigos (mantém últimos 5)

### **O que será PRESERVADO:**
- ✅ `.git/` (repositório)
- ✅ `api/` (backend PHP)
- ✅ `.env` (configurações)
- ✅ `package.json` `package-lock.json`
- ✅ `.gitignore`
- ✅ Scripts `.sh`

---

## **📋 O QUE O `deploy.sh` FAZ (ATUALIZADO):**

1. ✅ Git pull completo
2. ✅ Corrige imports do sonner
3. ✅ **MOVE `src/` para raiz** (se existir)
4. ✅ **VERIFICA se `main.tsx` importa CSS**
5. ✅ **CRIA `postcss.config.js`** (se não existir)
6. ✅ **CRIA `vite.config.mjs` correto**
7. ✅ Limpa cache do node
8. ✅ Instala dependências
9. ✅ **Instala Tailwind v4**
10. ✅ **Build em produção**
11. ✅ **VERIFICA se CSS foi gerado** ← NOVO!
12. ✅ Copia build para raiz
13. ✅ Corrige permissões
14. ✅ Reinicia NGINX
15. ✅ **Testa se CSS está acessível** ← NOVO!

---

## **🎯 RESUMO:**

### **O QUE VOCÊ PRECISA FAZER:**

**AGORA (aqui no Figma Make):**
```
"Faça commit e push para o GitHub"
```

**DEPOIS (no servidor):**
```bash
cd /var/www/html/sistema
sudo bash limpar-e-deploy.sh
```

**PRONTO!** 🎉

---

## **🔍 VERIFICAÇÃO:**

Após o deploy, o script vai mostrar:

```
[19] Testando assets...
✓ Assets acessíveis (HTTP 200)
```

Se mostrar isso, o CSS está funcionando! ✅

---

## **📞 SE DER ERRO:**

O `deploy.sh` agora tem verificações:

**Se CSS não for gerado:**
```
❌ ERRO: Nenhum CSS gerado!
Assets gerados:
  -rwxr-xr-x 1 www-data www-data 3.0M Mar 16 05:30 index-abc123.js
```

**Se CSS for gerado:**
```
✅ Assets acessíveis (HTTP 200)
Arquivos:
  -rwxr-xr-x 1 www-data www-data  45K Mar 16 05:30 index-abc123.css
  -rwxr-xr-x 1 www-data www-data 3.0M Mar 16 05:30 index-abc123.js
```

---

## **💡 POR QUE O CSS NÃO ESTAVA SENDO GERADO?**

**Problema:**
```typescript
// main.tsx (ANTES)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// ❌ FALTAVA: import './styles/globals.css';
```

**Solução:**
```typescript
// main.tsx (AGORA)
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css'; // ✅ ADICIONADO!
```

Sem a importação, o Vite não sabia que tinha que processar o CSS!

---

## **✅ ESTÁ TUDO CORRIGIDO!**

Os arquivos já estão corrigidos aqui no Figma Make:
- ✅ `main.tsx` - Importa CSS
- ✅ `postcss.config.js` - Criado
- ✅ `vite.config.mjs` - Configurado
- ✅ `deploy.sh` - Verifica CSS

**Basta fazer PUSH e rodar o deploy!**

---

**🚀 PRONTO PARA FAZER PUSH?**
