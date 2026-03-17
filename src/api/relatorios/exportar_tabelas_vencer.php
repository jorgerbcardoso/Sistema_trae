<?php
/**
 * ============================================
 * API: Exportar Tabelas a Vencer (Excel)
 * ============================================
 * Gera planilha Excel com tabelas a vencer
 * Integração com SSW via XML
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
    $dataInicio = date('dmy');
    $dataFim = date('dmy', strtotime('last day of this month'));
    
    $param = "?act=PER&t_tp_geracao=N&f7={$dataInicio}&f8={$dataFim}";
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
    $batchSize = 100; // Inserir 100 registros por vez
    
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
            
            // Montar placeholders para este registro
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
    
    if (empty($dados)) {
        msg('Nenhuma tabela a vencer encontrada no período.', 'info');
    }
    
    // ============================================
    // 10. Criar planilha Excel
    // ============================================
    use PhpOffice\PhpSpreadsheet\Spreadsheet;
    use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
    use PhpOffice\PhpSpreadsheet\Style\Alignment;
    use PhpOffice\PhpSpreadsheet\Style\Fill;
    use PhpOffice\PhpSpreadsheet\Style\Border;
    
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Tabelas a Vencer');
    
    // ============================================
    // 11. Cabeçalho do relatório
    // ============================================
    $sheet->setCellValue('A1', 'RELAÇÃO DE TABELAS A VENCER');
    $sheet->mergeCells('A1:G1');
    $sheet->getStyle('A1')->getFont()->setBold(true)->setSize(16);
    $sheet->getStyle('A1')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    
    $periodoTexto = 'Vencimento até: ' . date('d/m/Y', strtotime('last day of this month'));
    $sheet->setCellValue('A2', $periodoTexto);
    $sheet->mergeCells('A2:G2');
    $sheet->getStyle('A2')->getFont()->setBold(true)->setSize(12);
    $sheet->getStyle('A2')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    
    // ============================================
    // 12. Cabeçalhos das colunas
    // ============================================
    $headers = ['Vendedor', 'CNPJ', 'Nome', 'Unidade', 'Tipo Tabela', 'Qtde', 'Validade'];
    $col = 'A';
    foreach ($headers as $header) {
        $sheet->setCellValue($col . '4', $header);
        $sheet->getStyle($col . '4')->getFont()->setBold(true);
        $sheet->getStyle($col . '4')->getFill()
            ->setFillType(Fill::FILL_SOLID)
            ->getStartColor()->setARGB('FF4472C4');
        $sheet->getStyle($col . '4')->getFont()->getColor()->setARGB('FFFFFFFF');
        $sheet->getStyle($col . '4')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
        $col++;
    }
    
    // ============================================
    // 13. Dados
    // ============================================
    $row = 5;
    foreach ($dados as $item) {
        $sheet->setCellValue('A' . $row, $item['vendedor'] ?? 'SEM VENDEDOR');
        $sheet->setCellValue('B' . $row, $item['cnpj'] ?? '');
        $sheet->setCellValue('C' . $row, $item['nome'] ?? '');
        $sheet->setCellValue('D' . $row, $item['unidade'] ?? '');
        $sheet->setCellValue('E' . $row, $item['tp_tab'] ?? '');
        $sheet->setCellValue('F' . $row, (int) ($item['qtde_tab'] ?? 0));
        $sheet->setCellValue('G' . $row, $item['vig_atual'] ?? '');
        $row++;
    }
    
    // ============================================
    // 14. Formatação e bordas
    // ============================================
    $lastRow = $row - 1;
    
    // Bordas em toda a tabela
    $sheet->getStyle('A4:G' . $lastRow)->applyFromArray([
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['argb' => 'FF000000'],
            ],
        ],
    ]);
    
    // Largura das colunas
    $sheet->getColumnDimension('A')->setWidth(20); // Vendedor
    $sheet->getColumnDimension('B')->setWidth(18); // CNPJ
    $sheet->getColumnDimension('C')->setWidth(40); // Nome
    $sheet->getColumnDimension('D')->setWidth(12); // Unidade
    $sheet->getColumnDimension('E')->setWidth(25); // Tipo Tabela
    $sheet->getColumnDimension('F')->setWidth(10); // Qtde
    $sheet->getColumnDimension('G')->setWidth(15); // Validade
    
    // Alinhamento
    $sheet->getStyle('B5:B' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
    $sheet->getStyle('F5:F' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle('G5:G' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    
    // ============================================
    // 15. Rodapé
    // ============================================
    $totalRow = $lastRow + 2;
    $sheet->setCellValue('A' . $totalRow, 'Total de registros: ' . count($dados));
    $sheet->mergeCells('A' . $totalRow . ':G' . $totalRow);
    $sheet->getStyle('A' . $totalRow)->getFont()->setBold(true);
    
    // ============================================
    // 16. Gerar arquivo
    // ============================================
    $filename = 'tabelas_vencer_' . date('Y-m-d_His') . '.xlsx';
    $filepath = sys_get_temp_dir() . '/' . $filename;
    
    $writer = new Xlsx($spreadsheet);
    $writer->save($filepath);
    
    // ============================================
    // 17. Enviar arquivo para download
    // ============================================
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($filepath));
    header('Cache-Control: max-age=0');
    
    readfile($filepath);
    unlink($filepath); // Deletar arquivo temporário
    
    exit;
    
} catch (Throwable $e) {
    error_log("❌ ERRO em exportar_tabelas_vencer.php: " . $e->getMessage());
    error_log("   Arquivo: " . $e->getFile());
    error_log("   Linha: " . $e->getLine());
    
    msg('Erro ao exportar tabelas a vencer: ' . $e->getMessage(), 'error', 500);
}
?>