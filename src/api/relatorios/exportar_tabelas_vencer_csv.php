<?php
/**
 * ============================================
 * API: Exportar Tabelas a Vencer (CSV)
 * ============================================
 * Gera arquivo CSV com tabelas a vencer
 * Muito mais leve que Excel (sem PhpSpreadsheet)
 * ============================================
 */

set_time_limit(0);
ini_set('memory_limit', '512M');

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/lib/ssw_loader.php';

setupCORS();
handleOptionsRequest();
requireAuth();

try {
    // ============================================
    // 1. Carregar biblioteca SSW
    // ============================================
    require_ssw();
    
    if (!function_exists('ssw_login') || !function_exists('ssw_go')) {
        throw new Exception('Funções SSW (ssw_login/ssw_go) não disponíveis');
    }

    // ============================================
    // 2. Obter domínio do usuário
    // ============================================
    $domain = $_SERVER['HTTP_X_DOMAIN'] ?? null;
    
    if (!$domain) {
        msg('DOMÍNIO NÃO ESPECIFICADO', 'error', 400);
    }
    
    $dominio = strtoupper($domain);
    
    // ============================================
    // 3. Conectar no SSW com domínio do usuário
    // ============================================
    ssw_login($dominio);
    
    // ============================================
    // 4. Buscar dados no SSW (Programa 0169)
    // ============================================
    $dataInicioParam = $_GET['data_inicio'] ?? null;
    $dataFimParam = $_GET['data_fim'] ?? null;
    $unidadeParam = $_GET['unidade'] ?? '';

    // Parâmetros:
    // - f6: unidade (sigla)
    // - f7: data início (DDMMYY)
    // - f8: data fim (DDMMYY)
    
    // Formatar datas para o padrão SSW (DDMMYY)
    $dataInicio = $dataInicioParam ? date('dmy', strtotime($dataInicioParam)) : date('dmy');
    $dataFim = $dataFimParam ? date('dmy', strtotime($dataFimParam)) : date('dmy', strtotime('last day of this month'));
    
    // Unidade (se informada)
    $paramUnidade = $unidadeParam ? "&f6=" . urlencode(strtoupper($unidadeParam)) : "";
    
    $param = "?act=PER&t_tp_geracao=N{$paramUnidade}&f7={$dataInicio}&f8={$dataFim}";
    $str = ssw_go("https://sistema.ssw.inf.br/bin/ssw0169$param");
    
    // ============================================
    // 5. Extrair XML da resposta
    // ============================================
    $str = substr($str, strpos($str, '<xml'), strlen($str));
    $str = substr($str, 0, strpos($str, '</xml>')) . '</xml>';
    $xml = simplexml_load_string($str);
    
    if (!$xml) {
        msg('Erro ao processar XML do SSW', 'error', 500);
    }
    
    // ============================================
    // 6. CRIAR NOVA CONEXÃO (SSW pode ter fechado)
    // ============================================
    $conn = getDBConnection();
    
    if (!$conn) {
        throw new Exception('Não foi possível conectar ao banco de dados');
    }
    
    // ============================================
    // 7. Criar tabela temporária
    // ============================================
    // ⚠️ NOTA: Este arquivo carrega SSW (ssw.php) que sobrescreve a função sql()
    // Por isso, usamos pg_query() diretamente aqui
    $createTableQuery = "CREATE TEMP TABLE tmp_tabelas_vencer (
        cnpj VARCHAR(14),
        nome VARCHAR(255),
        unidade VARCHAR(10),
        tp_tab VARCHAR(50),
        qtde_tab INTEGER,
        vig_atual VARCHAR(10)
    )";
    
    $resultCreate = pg_query($conn, $createTableQuery);
    
    if (!$resultCreate) {
        throw new Exception('Erro ao criar tabela temporária: ' . pg_last_error($conn));
    }
    
    // ============================================
    // 8. Processar registros do XML (BATCH INSERT)
    // ============================================
    $registros = $xml->xpath('rs/r');
    $totalRegistros = count($registros);
    $batchSize = 100;
    
    for ($offset = 0; $offset < $totalRegistros; $offset += $batchSize) {
        $values = [];
        $params = [];
        $paramIndex = 1;
        
        $limit = min($batchSize, $totalRegistros - $offset);
        
        for ($i = 0; $i < $limit; $i++) {
            $idx = $offset + $i;
            
            // Extrair campos do XML
            $cnpj_raw  = (string) $xml->xpath('rs/r/f0')[$idx];
            $nome_raw  = (string) $xml->xpath('rs/r/f1')[$idx];
            $unidade   = (string) $xml->xpath('rs/r/f2')[$idx];
            $tp_tab    = (string) $xml->xpath('rs/r/f3')[$idx];
            $qtde_raw  = (string) $xml->xpath('rs/r/f4')[$idx];
            $vig_atual = (string) $xml->xpath('rs/r/f5')[$idx];
            
            // Processar CNPJ
            $cnpj = substr($cnpj_raw, 7, 14);
            
            // Processar nome
            $nome = str_replace("'", "", $nome_raw);
            
            // Processar quantidade
            $qtde_tab = substr($qtde_raw, 7);
            $qtde_tab = explode('<', $qtde_tab)[0];
            
            // Montar placeholders
            $values[] = "($" . $paramIndex++ . ", $" . $paramIndex++ . ", $" . $paramIndex++ . ", $" . $paramIndex++ . ", $" . $paramIndex++ . ", $" . $paramIndex++ . ")";
            
            // Adicionar parâmetros
            $params[] = $cnpj;
            $params[] = $nome;
            $params[] = $unidade;
            $params[] = $tp_tab;
            $params[] = (int) $qtde_tab;
            $params[] = $vig_atual;
        }
        
        // INSERT em batch usando pg_query_params()
        $query = "INSERT INTO tmp_tabelas_vencer (cnpj, nome, unidade, tp_tab, qtde_tab, vig_atual) VALUES " . implode(', ', $values);
        
        $result = pg_query_params($conn, $query, $params);
        
        if (!$result) {
            throw new Exception('Erro ao inserir batch: ' . pg_last_error($conn));
        }
    }
    
    // ============================================
    // 9. Buscar dados com JOIN vendedor
    // ============================================
    // ⚠️ FILTRO: Apenas registros com qtde_tab > 0
    $selectQuery = "SELECT 
        t.cnpj,
        t.nome,
        t.unidade,
        t.tp_tab,
        t.qtde_tab,
        t.vig_atual,
        COALESCE(v.login, 'SEM VENDEDOR') as vendedor
     FROM tmp_tabelas_vencer t
     LEFT JOIN ntv_vendedor_cliente v ON t.cnpj = v.cnpj
     WHERE t.qtde_tab > 0
     ORDER BY vendedor, t.nome";
    
    $result = pg_query($conn, $selectQuery);
    
    if (!$result) {
        throw new Exception('Erro ao buscar dados: ' . pg_last_error($conn));
    }
    
    $dados = [];
    while ($row = pg_fetch_assoc($result)) {
        $dados[] = $row;
    }
    
    // Fechar conexão
    pg_close($conn);
    
    if (empty($dados)) {
        msg('Nenhuma tabela a vencer encontrada no período.', 'info');
    }
    
    // ============================================
    // 10. Gerar CSV
    // ============================================
    $filename = 'tabelas_vencer_' . date('Y-m-d_His') . '.csv';
    
    // Configurar headers para download
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    header('Pragma: public');
    
    // Abrir output stream
    $output = fopen('php://output', 'w');
    
    // BOM para UTF-8 (Excel reconhece)
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    // Cabeçalho do CSV
    fputcsv($output, [
        'Vendedor',
        'CNPJ',
        'Nome',
        'Unidade',
        'Tipo Tabela',
        'Qtde',
        'Validade'
    ], ';');
    
    // Dados
    foreach ($dados as $row) {
        fputcsv($output, [
            $row['vendedor'] ?? 'SEM VENDEDOR',
            $row['cnpj'] ?? '',
            $row['nome'] ?? '',
            $row['unidade'] ?? '',
            $row['tp_tab'] ?? '',
            $row['qtde_tab'] ?? 0,
            $row['vig_atual'] ?? ''
        ], ';');
    }
    
    fclose($output);
    exit;
    
} catch (Throwable $e) {
    error_log("❌ ERRO em exportar_tabelas_vencer_csv.php: " . $e->getMessage());
    error_log("   Arquivo: " . $e->getFile());
    error_log("   Linha: " . $e->getLine());
    
    msg('Erro ao exportar CSV: ' . $e->getMessage(), 'error', 500);
}
?>