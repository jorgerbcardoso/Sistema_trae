🔍 DIAGNÓSTICO COMPLETO - SISTEMA PRESTO
========================================

1️⃣  VITE CONFIG
---
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  base: '/sistema/',
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      'sonner@2.0.3': 'sonner',
      'react-hook-form@7.55.0': 'react-hook-form',
      '@': path.resolve(__dirname, './'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 3000,
    open: false,
  },
});


2️⃣  ESTRUTURA DE DIRETÓRIOS
---
drwxr-xr-x   2 www-data www-data   4096 Mar 16 04:58 assets
drwxr-xr-x   3 www-data www-data   4096 Mar 10 04:40 backup_build_20260310_014006
drwxr-xr-x   3 www-data www-data   4096 Mar 16 04:57 backup_build_20260316_045716
drwxr-xr-x   3 www-data www-data   4096 Mar 16 04:58 backup_build_20260316_045857
drwxr-xr-x   3 www-data www-data   4096 Mar 16 04:58 build
drwxr-xr-x   3 www-data www-data   4096 Feb 19 03:14 dist_broken_backup
-rwxr-xr-x   1 www-data www-data    336 Mar 16 04:58 index.html


3️⃣  CONTEÚDO DO BUILD
---
total 36
drwxr-xr-x  3 www-data www-data  4096 Mar 16 04:58 .
drwxr-xr-x 32 www-data www-data 12288 Mar 16 05:05 ..
-rwxr-xr-x  1 www-data www-data  2764 Mar 16 04:58 TESTE_ATUALIZACAO.html
-rwxr-xr-x  1 www-data www-data  5119 Mar 16 04:58 URGENTE_TESTE_DEPLOY.html
drwxr-xr-x  2 www-data www-data  4096 Mar 16 04:58 assets
-rwxr-xr-x  1 www-data www-data   336 Mar 16 04:58 index.html

Assets no build:
total 3.0M
-rwxr-xr-x 1 www-data www-data  14K Mar 16 04:58 CotacaoFornecedor-DnHAivuy.js
-rwxr-xr-x 1 www-data www-data 3.0M Mar 16 04:58 index-Dnubzyxu.js


4️⃣  INDEX.HTML NO BUILD
---
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sistema Presto</title>
    <script type="module" crossorigin src="/sistema/assets/index-Dnubzyxu.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>


5️⃣  INDEX.HTML NA RAIZ
---
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sistema Presto</title>
    <script type="module" crossorigin src="/sistema/assets/index-Dnubzyxu.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>


6️⃣  ASSETS NA RAIZ
---
total 3.0M
-rwxr-xr-x 1 www-data www-data  14K Mar 16 04:58 CotacaoFornecedor-DnHAivuy.js
-rwxr-xr-x 1 www-data www-data 3.0M Mar 16 04:58 index-Dnubzyxu.js


7️⃣  CONFIGURAÇÃO NGINX
---
Configuração default:
    location /sistema/ {
        alias /var/www/html/sistema/;
        try_files $uri $uri/ /sistema/index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # APIs PHP
    location /api/ {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Processar PHP
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Root
    location / {



8️⃣  TESTE DE ACESSO
---
Testando https://localhost/sistema/
HTTP Status: 301
⚠️  REDIRECT detectado!
Redirecionando para: https://localhost/sistema/login-aceville


9️⃣  TESTE DE ASSETS
---
❌ Nenhum CSS encontrado


🔟  PACKAGE.JSON
---
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {


========================================
DIAGNÓSTICO CONCLUÍDO
========================================
