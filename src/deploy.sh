#!/bin/bash

echo "========================================"
echo "  DEPLOY SISTEMA PRESTO"
echo "========================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para log de erro
error_exit() {
    echo -e "${RED}✗ ERRO: $1${NC}" >&2
    exit 1
}

# Função para log de sucesso
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Função para log de aviso
warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# 1. Verificar diretório
echo "[1] Verificando diretório..."
cd /var/www/html/sistema || error_exit "Diretório /var/www/html/sistema não encontrado"
success "Diretório correto"
echo ""

# 2. Verificar repositório Git
echo "[2] Verificando repositório Git..."
if [ ! -d ".git" ]; then
    error_exit "Repositório Git não encontrado em /var/www/html/sistema"
fi
success "Repositório Git encontrado"
echo ""

# 3. Guardar alterações locais (se houver)
echo "[3] Guardando alterações locais..."
git stash push -m "Auto-stash antes do deploy $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 4. Fazer pull COMPLETO do GitHub
echo "[4] Fazendo pull COMPLETO do GitHub..."
git fetch origin || error_exit "Falha ao fazer fetch do repositório"
git reset --hard origin/main || error_exit "Falha ao resetar para origin/main"
success "Pull concluído com sucesso"
echo ""

# 4.5. REMOVIDO: Correção manual de imports
# O repositório já deve conter os imports corretos.
echo "[4.5] Imports mantidos conforme repositório"
echo ""

# 4.7. REMOVIDO: Alteração manual de globals.css
# O globals.css do repositório já deve estar configurado corretamente.
echo "[4.7] globals.css mantido conforme repositório"
echo ""

# 5. REMOVIDO: Movimentação de arquivos de src/ para raiz
# O projeto agora mantém a estrutura padrão /src/ conforme o repositório.
echo "[5] Estrutura mantida (padrão /src/)"
echo ""

# 5.5. REMOVIDO: Correção de index.html
# O index.html do repositório já aponta corretamente para /src/main.tsx.
echo "[5.5] index.html mantido conforme repositório"
echo ""

# 6. Verificar estrutura final
echo "[6] Verificando estrutura..."

if [ ! -f "package.json" ]; then
    error_exit "package.json não encontrado!"
fi
if [ ! -d "src/components" ]; then
    error_exit "Diretório src/components/ não encontrado!"
fi
success "Estrutura verificada"
echo ""

# 7. REMOVIDO: Sobrescrita de vite.config.ts e postcss.config.js
# Usaremos os arquivos que já estão no repositório, pois contêm as configurações ideais.
echo "[7] Configurações do repositório mantidas (vite.config.ts / postcss.config.js)"
echo ""

# 8. Limpar e instalar dependências
echo "[8] Instalando dependências do npm..."
# LIMPAR CACHE E MODULOS ANTIGOS
rm -rf node_modules .vite build dist 2>/dev/null || true
npm install || error_exit "Falha ao instalar dependências"

success "Dependências instaladas"
echo ""

# 8.5. REMOVIDO: Forçar Tailwind v4 beta
# O package.json já contém a versão correta (4.1.12).
echo "[8.5] Versão do Tailwind mantida conforme package.json"
echo ""

# 9. Build em PRODUÇÃO
echo "[9] Executando build em modo PRODUCTION..."
NODE_ENV=production npm run build || error_exit "Falha no build"
success "Build concluído"
echo ""

# 10. Verificar se build foi criado
echo "[10] Verificando build gerado..."
if [ ! -d "build" ]; then
    error_exit "Diretório build/ não foi criado!"
fi
if [ ! -f "build/index.html" ]; then
    error_exit "build/index.html não foi criado!"
fi
if [ ! -d "build/assets" ]; then
    error_exit "build/assets/ não foi criado!"
fi
success "Build verificado"
echo ""

# 11. Verificar caminhos no HTML
echo "[11] Verificando caminhos dos assets..."
if grep -q '"/sistema/assets/' build/index.html; then
    success "Caminhos corretos com /sistema/assets/"
else
    warning "ATENÇÃO: Caminhos podem estar incorretos!"
fi
echo ""

# 12. Fazer backup do build anterior (se existir)
echo "[12] Fazendo backup do build anterior..."
if [ -f "index.html" ] && [ -d "assets" ]; then
    BACKUP_DIR="backup_build_$(date '+%Y%m%d_%H%M%S')"
    mkdir -p "$BACKUP_DIR"
    # Fazer backup do index.html e assets do build anterior
    mv index.html "$BACKUP_DIR/" 2>/dev/null
    mv assets "$BACKUP_DIR/" 2>/dev/null
    success "Backup criado em $BACKUP_DIR/"
else
    echo "Nenhum build anterior encontrado"
fi
echo ""

# 13. Copiar novo build para raiz
echo "[13] Copiando novo build para raiz..."
# Copiar TUDO do build (incluindo index.html)
cp -r build/* . || error_exit "Falha ao copiar build"
success "Build copiado para raiz"
echo ""

# 14. Verificar arquivos na raiz
echo "[14] Verificando arquivos na raiz..."
if [ ! -f "index.html" ]; then
    error_exit "index.html não está na raiz!"
fi
if [ ! -d "assets" ]; then
    error_exit "assets/ não está na raiz!"
fi
success "Arquivos na raiz verificados"
echo ""

# 15. Corrigir permissões
echo "[15] Corrigindo permissões..."
chown -R www-data:www-data /var/www/html/sistema/
chmod -R 755 /var/www/html/sistema/
success "Permissões corrigidas"
echo ""

# 16. Verificar configuração do NGINX
echo "[16] Verificando NGINX..."
nginx -t || error_exit "Configuração do NGINX inválida!"
success "Configuração do NGINX válida"
echo ""

# 17. Reiniciar NGINX
echo "[17] Reiniciando NGINX..."
systemctl restart nginx || error_exit "Falha ao reiniciar NGINX"
success "NGINX reiniciado"
echo ""

# 18. Testar acesso local
echo "[18] Testando acesso local..."
HTTP_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" https://localhost/sistema/)
if [ "$HTTP_CODE" = "200" ]; then
    success "Acesso local OK (HTTP $HTTP_CODE)"
else
    warning "Acesso local retornou HTTP $HTTP_CODE"
fi
echo ""

# 19. Testar asset CSS
echo "[19] Testando assets..."
CSS_FILE=$(ls assets/*.css 2>/dev/null | head -1 | xargs basename)
if [ -n "$CSS_FILE" ]; then
    CSS_CODE=$(curl -k -s -o /dev/null -w "%{http_code}" "https://localhost/sistema/assets/$CSS_FILE")
    if [ "$CSS_CODE" = "200" ]; then
        success "Assets acessíveis (HTTP $CSS_CODE)"
    else
        warning "Asset retornou HTTP $CSS_CODE"
    fi
else
    warning "Nenhum CSS encontrado para testar"
fi
echo ""

# 20. Limpar backups antigos (manter apenas último backup)
echo "[20] Limpando backups antigos..."
BACKUP_COUNT=$(ls -d backup_build_* 2>/dev/null | wc -l)
if [ "$BACKUP_COUNT" -gt 3 ]; then
    ls -dt backup_build_* | tail -n +4 | xargs rm -rf
    success "Backups antigos removidos (mantidos últimos 3)"
else
    echo "Sem backups para limpar"
fi
echo ""

# 21. Resumo final
echo "========================================"
echo -e "${GREEN}✅ DEPLOY CONCLUÍDO COM SUCESSO!${NC}"
echo "========================================"
echo ""
echo "📋 RESUMO:"
echo "  • Código atualizado do GitHub"
echo "  • Estrutura mantida padrão (pasta /src/)"
echo "  • Build em modo produção utilizando vite.config.ts do repositório"
echo "  • Base configurado para /sistema/"
echo "  • Assets em /sistema/assets/"
echo "  • Permissões corrigidas"
echo "  • NGINX reiniciado"
echo ""
echo "🌐 ACESSE:"
echo "  https://webpresto.com.br/sistema/"
echo ""
echo "⚠️  IMPORTANTE:"
echo "  Limpe o cache do navegador (CTRL+SHIFT+R)"
echo "  ou abra uma aba anônima para testar"
echo ""
echo "📁 ESTRUTURA:"
echo "  /var/www/html/sistema/"
echo "    ├── src/           (código-fonte)"
echo "    ├── build/         (build gerado)"
echo "    ├── index.html     (produção)"
echo "    ├── assets/        (produção)"
echo "    └── api/           (APIs PHP)"
echo ""
echo "========================================"
