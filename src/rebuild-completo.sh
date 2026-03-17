#!/bin/bash

echo "🔧 REBUILD COMPLETO - CORREÇÃO CSS"
echo "========================================"
echo ""

cd /var/www/html/sistema || exit 1

echo "[1] Backup completo..."
BACKUP_DIR="backup_rebuild_$(date '+%Y%m%d_%H%M%S')"
mkdir -p "$BACKUP_DIR"

# Fazer backup de TUDO que está na raiz
if [ -f "index.html" ]; then cp index.html "$BACKUP_DIR/"; fi
if [ -d "assets" ]; then cp -r assets "$BACKUP_DIR/"; fi
if [ -d "build" ]; then cp -r build "$BACKUP_DIR/"; fi

echo "✓ Backup em $BACKUP_DIR/"
echo ""

echo "[2] Limpando TUDO..."
rm -rf build dist .vite node_modules/.cache node_modules/.vite 2>/dev/null || true
rm -f index.html 2>/dev/null || true
rm -rf assets 2>/dev/null || true
echo "✓ Limpeza completa"
echo ""

echo "[3] Verificando vite.config.mjs..."
if [ -f "vite.config.mjs" ]; then
    echo "vite.config.mjs existe. Conteúdo:"
    cat vite.config.mjs
else
    echo "❌ ERRO: vite.config.mjs não existe!"
    echo "Criando agora..."
    cat > vite.config.mjs << 'VITECONFIG'
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
    assetsDir: 'assets',
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
VITECONFIG
    echo "✓ vite.config.mjs criado"
fi
echo ""

echo "[4] Verificando index.html SOURCE (para dev)..."
if [ ! -f "index.html" ]; then
    echo "Criando index.html source..."
    cat > index.html << 'INDEXHTML'
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sistema Presto</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/main.tsx"></script>
  </body>
</html>
INDEXHTML
    echo "✓ index.html source criado"
else
    echo "✓ index.html source já existe"
fi
echo ""

echo "[5] EXECUTANDO BUILD..."
echo "Comando: NODE_ENV=production npm run build"
echo ""
NODE_ENV=production npm run build

BUILD_STATUS=$?
if [ $BUILD_STATUS -ne 0 ]; then
    echo "❌ ERRO NO BUILD!"
    exit 1
fi
echo ""

echo "[6] Verificando resultado do build..."
if [ -d "build" ]; then
    echo "✅ Diretório build/ CRIADO!"
    echo ""
    echo "Estrutura:"
    ls -lh build/
    echo ""
    
    if [ -f "build/index.html" ]; then
        echo "✅ build/index.html existe!"
        echo ""
        echo "=== CONTEÚDO DO INDEX.HTML GERADO ==="
        cat build/index.html
        echo "======================================"
        echo ""
    else
        echo "❌ build/index.html NÃO EXISTE!"
        exit 1
    fi
    
    if [ -d "build/assets" ]; then
        echo "✅ build/assets/ existe!"
        echo "Arquivos:"
        ls -lh build/assets/
        echo ""
    else
        echo "❌ build/assets/ NÃO EXISTE!"
        exit 1
    fi
    
elif [ -d "dist" ]; then
    echo "⚠️  ATENÇÃO: Foi criado dist/ em vez de build/"
    echo "Renomeando..."
    mv dist build
    echo "✓ Renomeado para build/"
    echo ""
else
    echo "❌ ERRO: Nem build/ nem dist/ foram criados!"
    exit 1
fi

echo "[7] Verificando caminhos no HTML gerado..."
echo "Buscando por 'href' e 'src':"
grep -E "(href|src)=" build/index.html
echo ""

if grep -q "/sistema/" build/index.html; then
    echo "✅ Caminhos contêm /sistema/ (CORRETO)"
elif grep -q "assets/" build/index.html; then
    echo "⚠️  Caminhos relativos encontrados (pode precisar de ajuste)"
else
    echo "❌ Caminhos não identificados!"
fi
echo ""

echo "[8] Copiando build para raiz..."
cp -rf build/* .
echo "✓ Build copiado"
echo ""

echo "[9] Verificando arquivos na raiz..."
if [ -f "index.html" ]; then
    echo "✅ index.html na raiz"
    echo "Primeiras linhas:"
    head -20 index.html
    echo ""
else
    echo "❌ index.html NÃO está na raiz!"
    exit 1
fi

if [ -d "assets" ]; then
    echo "✅ assets/ na raiz"
    echo "Conteúdo:"
    ls -lh assets/ | head -10
    echo ""
else
    echo "❌ assets/ NÃO está na raiz!"
    exit 1
fi

echo "[10] Testando arquivo CSS..."
CSS_FILES=$(find assets -name "*.css" 2>/dev/null)
CSS_COUNT=$(echo "$CSS_FILES" | wc -l)

if [ $CSS_COUNT -gt 0 ]; then
    echo "✅ $CSS_COUNT arquivo(s) CSS encontrado(s)"
    echo ""
    for CSS_FILE in $CSS_FILES; do
        echo "Arquivo: $CSS_FILE"
        SIZE=$(ls -lh "$CSS_FILE" | awk '{print $5}')
        echo "Tamanho: $SIZE"
        echo "Primeiras linhas:"
        head -5 "$CSS_FILE"
        echo ""
    done
else
    echo "❌ NENHUM arquivo CSS encontrado!"
    echo ""
    echo "Verificando se há SCSS ou outros:"
    find assets -type f 2>/dev/null
fi
echo ""

echo "[11] Corrigindo permissões..."
chown -R www-data:www-data /var/www/html/sistema/
chmod -R 755 /var/www/html/sistema/
echo "✓ Permissões OK"
echo ""

echo "[12] Reiniciando NGINX..."
systemctl restart nginx
sleep 2
echo "✓ NGINX reiniciado"
echo ""

echo "[13] TESTE DE ACESSO FINAL..."
echo ""
echo "Testando https://localhost/sistema/"
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/sistema/)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Acesso OK!"
elif [ "$HTTP_CODE" = "301" ] || [ "$HTTP_CODE" = "302" ]; then
    echo "⚠️  REDIRECT ($HTTP_CODE)"
    LOCATION=$(curl -k -s -I https://localhost/sistema/ | grep -i "^location:" | cut -d' ' -f2 | tr -d '\r\n')
    echo "Redirecionando para: $LOCATION"
else
    echo "❌ Erro HTTP $HTTP_CODE"
fi
echo ""

# Testar CSS
CSS_FILE=$(find assets -name "*.css" 2>/dev/null | head -1)
if [ -n "$CSS_FILE" ]; then
    CSS_BASENAME=$(basename "$CSS_FILE")
    echo "Testando CSS: /sistema/assets/$CSS_BASENAME"
    HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" "https://localhost/sistema/assets/$CSS_BASENAME")
    echo "HTTP Status: $HTTP_CODE"
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✅ CSS acessível!"
    else
        echo "❌ CSS retornou HTTP $HTTP_CODE"
    fi
fi
echo ""

echo "========================================"
echo "✅ REBUILD COMPLETO CONCLUÍDO!"
echo "========================================"
echo ""
echo "🌐 ACESSE: https://webpresto.com.br/sistema/"
echo ""
echo "⚠️  IMPORTANTE:"
echo "  • Limpe o cache do navegador (CTRL+SHIFT+R)"
echo "  • Ou abra aba anônima"
echo "  • Verifique o Console do navegador (F12)"
echo ""
echo "📁 BACKUP em: $BACKUP_DIR/"
echo ""
