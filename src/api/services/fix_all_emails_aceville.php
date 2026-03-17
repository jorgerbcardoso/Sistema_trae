<?php
/**
 * 🎯 SCRIPT FINAL - Substituir TODAS as referências ao Presto por variáveis dinâmicas
 * 
 * EXECUÇÃO: php fix_all_emails_aceville.php
 * 
 * Este script faz as seguintes alterações no EmailService.php:
 * 1. Substitui todos os footers fixos por variáveis dinâmicas
 * 2. Substitui todas as URLs fixas do webpresto.com.br
 * 3. Adiciona variáveis dinâmicas em templates que ainda não as têm
 */

$file_path = __DIR__ . '/EmailService.php';

if (!file_exists($file_path)) {
    die("❌ Arquivo não encontrado: {$file_path}\n");
}

echo "🚀 INICIANDO SUBSTITUIÇÕES FINAIS...\n\n";
echo "📝 Lendo EmailService.php...\n";
$content = file_get_contents($file_path);

if ($content === false) {
    die("❌ Erro ao ler arquivo!\n");
}

echo "✅ Arquivo lido! Tamanho: " . number_format(strlen($content)) . " bytes\n\n";

// ============================================================================
// BACKUP
// ============================================================================
$backup_path = $file_path . '.backup_aceville_' . date('YmdHis');
copy($file_path, $backup_path);
echo "📦 Backup criado: " . basename($backup_path) . "\n\n";

$total_substituicoes = 0;

// ============================================================================
// SUBSTITUIÇÃO 1: Footers com link (6 ocorrências esperadas)
// ============================================================================
echo "🔄 [1/7] Substituindo footers com link...\n";
$old = '                                <a href="https://webpresto.com.br" style="color: #3b82f6; text-decoration: none;">webpresto.com.br</a>';
$new = '                                <a href="{$sistema_url}" style="color: #3b82f6; text-decoration: none;">{$sistema_host}</a>';
$count = substr_count($content, $old);
$content = str_replace($old, $new, $content);
$total_substituicoes += $count;
echo "   ✓ {$count} ocorrências substituídas\n";

// ============================================================================
// SUBSTITUIÇÃO 2: Footers simples sem link (2-3 ocorrências esperadas)
// ============================================================================
echo "🔄 [2/7] Substituindo footers simples...\n";
$old = '                            <p style="margin: 20px 0 5px; font-size: 12px; color: #9ca3af;">© 2026 Sistema Presto - Gestão de Transportadoras</p>';
$new = '                            <p style="margin: 20px 0 5px; font-size: 12px; color: #9ca3af;">© 2026 {$sistema_nome} - Gestão de Transportadoras</p>';
$count = substr_count($content, $old);
$content = str_replace($old, $new, $content);
$total_substituicoes += $count;
echo "   ✓ {$count} ocorrências substituídas\n";

// ============================================================================
// SUBSTITUIÇÃO 3: Logo URL em sendSolicitacaoCompraConvertida
// ============================================================================
echo "🔄 [3/7] Substituindo logo em sendSolicitacaoCompraConvertida...\n";
$old_pattern = '/(\$logo_url = \$empresa\[\'logo_url\'\] \?: \'https:\/\/webpresto\.com\.br\/images\/logo\.png\';[\s\n]+\$empresa_nome)/';
$new_replacement = '$logo_url = $empresa[\'logo_url\'] ?: $this->getSystemUrl($domain, \'images/logo.png\');' . "\n        \$empresa_nome";
$content_before = $content;
$content = preg_replace($old_pattern, $new_replacement, $content, 2, $count);
$total_substituicoes += $count;
echo "   ✓ {$count} ocorrências substituídas\n";

// ============================================================================
// SUBSTITUIÇÃO 4: Adicionar variáveis dinâmicas em sendSolicitacaoCompraConvertida
// ============================================================================
echo "🔄 [4/7] Adicionando variáveis dinâmicas em sendSolicitacaoCompraConvertida...\n";
$old = "\$destinatario_nome = htmlspecialchars(\$to_name);\n        \n        \$html_body = <<<HTML";
$new = "\$destinatario_nome = htmlspecialchars(\$to_name);\n        \n        // ✅ Variáveis dinâmicas do sistema baseadas no domínio\n        \$sistema_nome = \$this->getSystemName(\$domain);\n        \$sistema_host = \$this->getSystemHost(\$domain);\n        \$sistema_url_base = \$this->getSystemUrl(\$domain);\n        \n        \$html_body = <<<HTML";
if (strpos($content, $old) !== false) {
    $content = str_replace($old, $new, $content, $count);
    $total_substituicoes += $count;
    echo "   ✓ {$count} ocorrências substituídas\n";
} else {
    echo "   ⚠ Padrão não encontrado (pode já estar atualizado)\n";
}

// ============================================================================
// SUBSTITUIÇÃO 5: Botão "Acessar Sistema Presto" (linha 1651)
// ============================================================================
echo "🔄 [5/7] Substituindo botão 'Acessar Sistema'...\n";
$old = '<a href="https://webpresto.com.br/sistema/" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                                            Acessar Sistema Presto
                                        </a>';
$new = '<a href="{$sistema_url}/sistema/" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 6px; box-shadow: 0 4px 6px rgba(59, 130, 246, 0.3);">
                                            Acessar {$sistema_nome}
                                        </a>';
$count = substr_count($content, $old);
$content = str_replace($old, $new, $content);
$total_substituicoes += $count;
echo "   ✓ {$count} ocorrências substituídas\n";

// ============================================================================
// SUBSTITUIÇÃO 6: Logo padrão do método getEmailHeader (linha 207)
// ============================================================================
echo "🔄 [6/7] Substituindo logo padrão em getEmailHeader...\n";
$old = "    private function getEmailHeader(\$logo_url, \$empresa_nome) {\n        \$logo_sistema = 'https://webpresto.com.br/images/logo.png';";
$new = "    private function getEmailHeader(\$logo_url, \$empresa_nome) {\n        \$logo_sistema = 'https://webpresto.com.br/images/logo.png'; // ⚠️ Método auxiliar antigo - considerar deprecar";
$count = substr_count($content, $old);
$content = str_replace($old, $new, $content);
$total_substituicoes += $count;
echo "   ✓ {$count} ocorrências substituídas (marcado como deprecated)\n";

// ============================================================================
// SUBSTITUIÇÃO 7: Todas as restantes de "Sistema Presto" em linhas com ©
// ============================================================================
echo "🔄 [7/7] Substituindo '© 2026 Sistema Presto' restantes...\n";
$old = '© 2026 Sistema Presto - Gestão de Transportadoras<br>';
$new = '© 2026 {$sistema_nome} - Gestão de Transportadoras<br>';
$count = substr_count($content, $old);
$content = str_replace($old, $new, $content);
$total_substituicoes += $count;
echo "   ✓ {$count} ocorrências substituídas\n";

// ============================================================================
// SALVAR ARQUIVO
// ============================================================================
echo "\n💾 Salvando alterações...\n";
$result = file_put_contents($file_path, $content);

if ($result !== false) {
    echo "✅ Arquivo atualizado com sucesso!\n\n";
    echo "📊 RESUMO:\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n";
    echo "  Total de substituições: {$total_substituicoes}\n";
    echo "  Tamanho final: " . number_format(strlen($content)) . " bytes\n";
    echo "  Backup: " . basename($backup_path) . "\n";
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";
    echo "✅ PROCESSO CONCLUÍDO COM SUCESSO! 🎉\n\n";
    echo "🔍 VERIFICAÇÃO FINAL:\n";
    
    // Verificar ocorrências restantes
    $restantes_webpresto = substr_count($content, 'webpresto.com.br');
    $restantes_sistema_presto = substr_count($content, 'Sistema Presto');
    
    echo "   • webpresto.com.br: {$restantes_webpresto} ocorrências\n";
    echo "   • Sistema Presto: {$restantes_sistema_presto} ocorrências\n";
    
    if ($restantes_webpresto === 0 && $restantes_sistema_presto === 0) {
        echo "\n🎯 PERFEITO! Todas as referências foram substituídas!\n";
    } else {
        echo "\n⚠️ Ainda há algumas referências (conferir manualmente se são comentários/docs)\n";
    }
} else {
    echo "❌ Erro ao salvar arquivo!\n";
    echo "Restaurando backup...\n";
    copy($backup_path, $file_path);
    echo "✅ Backup restaurado.\n";
    exit(1);
}

echo "\n🚀 Agora você pode testar enviando um email de recuperação de senha para domínio ACV!\n";
?>
