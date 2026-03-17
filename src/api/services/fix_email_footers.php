<?php
/**
 * Script para substituir footers fixos por variáveis dinâmicas nos templates de email
 * 
 * EXECUÇÃO: php fix_email_footers.php
 */

$file_path = __DIR__ . '/EmailService.php';

if (!file_exists($file_path)) {
    die("❌ Arquivo não encontrado: {$file_path}\n");
}

echo "📝 Lendo arquivo EmailService.php...\n";
$content = file_get_contents($file_path);

if ($content === false) {
    die("❌ Erro ao ler arquivo!\n");
}

echo "🔍 Arquivo lido com sucesso! Tamanho: " . strlen($content) . " bytes\n\n";

// ============================================================================
// SUBSTITUIÇÃO 1: Footer completo com link
// ============================================================================
$old_footer_1 = '                                © 2026 Sistema Presto - Gestão de Transportadoras<br>
                                <a href="https://webpresto.com.br" style="color: #3b82f6; text-decoration: none;">webpresto.com.br</a>';

$new_footer_1 = '                                © 2026 {$sistema_nome} - Gestão de Transportadoras<br>
                                <a href="{$sistema_url}" style="color: #3b82f6; text-decoration: none;">{$sistema_host}</a>';

$count_1 = substr_count($content, $old_footer_1);
echo "🔄 Substituindo footer tipo 1 ({$count_1} ocorrências)...\n";
$content = str_replace($old_footer_1, $new_footer_1, $content);

// ============================================================================
// SUBSTITUIÇÃO 2: Footer simples sem link
// ============================================================================
$old_footer_2 = '                            <p style="margin: 20px 0 5px; font-size: 12px; color: #9ca3af;">© 2026 Sistema Presto - Gestão de Transportadoras</p>';

$new_footer_2 = '                            <p style="margin: 20px 0 5px; font-size: 12px; color: #9ca3af;">© 2026 {$sistema_nome} - Gestão de Transportadoras</p>';

$count_2 = substr_count($content, $old_footer_2);
echo "🔄 Substituindo footer tipo 2 ({$count_2} ocorrências)...\n";
$content = str_replace($old_footer_2, $new_footer_2, $content);

// ============================================================================
// SUBSTITUIÇÃO 3: Footer do getEmailFooter (método auxiliar antigo)
// ============================================================================
$old_footer_3 = '            <p style="margin: 20px 0 5px 0; font-size: 12px;">© 2026 Sistema Presto - Gestão de Transportadoras</p>';

$new_footer_3 = '            <p style="margin: 20px 0 5px 0; font-size: 12px;">© 2026 {$sistema_nome} - Gestão de Transportadoras</p>';

$count_3 = substr_count($content, $old_footer_3);
echo "🔄 Substituindo footer tipo 3 ({$count_3} ocorrências)...\n";
$content = str_replace($old_footer_3, $new_footer_3, $content);

// ============================================================================
// SALVAR ARQUIVO
// ============================================================================
$total_substituicoes = $count_1 + $count_2 + $count_3;

if ($total_substituicoes > 0) {
    echo "\n💾 Salvando alterações...\n";
    
    // Fazer backup
    $backup_path = $file_path . '.backup_' . date('YmdHis');
    copy($file_path, $backup_path);
    echo "📦 Backup criado: {$backup_path}\n";
    
    // Salvar arquivo modificado
    $result = file_put_contents($file_path, $content);
    
    if ($result !== false) {
        echo "✅ Arquivo atualizado com sucesso!\n";
        echo "📊 Total de substituições: {$total_substituicoes}\n";
        echo "   - Tipo 1 (footer completo): {$count_1}\n";
        echo "   - Tipo 2 (footer simples): {$count_2}\n";
        echo "   - Tipo 3 (método auxiliar): {$count_3}\n";
    } else {
        echo "❌ Erro ao salvar arquivo!\n";
        exit(1);
    }
} else {
    echo "⚠️ Nenhuma substituição foi necessária. O arquivo já está atualizado!\n";
}

echo "\n✅ PROCESSO CONCLUÍDO COM SUCESSO! 🎉\n";
