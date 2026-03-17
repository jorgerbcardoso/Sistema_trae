<?php
/**
 * 📊 EXPORTAÇÃO EXCEL - TOTAIS DE VENDEDORES POR UNIDADE
 * 
 * Gera planilha Excel com totais de vendas por vendedor e unidade
 * dos últimos 3 meses consultando o SSW
 * 
 * Recebe: { login_vendedor: string, unidade: string }
 * Retorna: Arquivo Excel (blob)
 */

// ⚠️ TEMPORÁRIO: Habilitar erros para debug
ini_set('display_errors', '1');
error_reporting(E_ALL);

// Limpar TODO buffer de saída
while (ob_get_level()) {
    ob_end_clean();
}

// Iniciar novo buffer limpo
ob_start();

// 📚 Carregar PhpSpreadsheet
require_once __DIR__ . '/../config/phpspreadsheet_loader.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

// ✅ Carregar config.php (tem tudo que precisa)
require_once __DIR__ . '/../config.php';

// ✅ Incluir biblioteca SSW (necessária para conexão SSW)
require_once '/var/www/html/lib/ssw.php';

// 🌍 Usar conexões globais
global $g_sql;
global $dominio;

try {
    // ================================================================
    // AUTENTICAÇÃO
    // ================================================================
    $currentUser = getCurrentUser();
    
    if (!$currentUser) {
        throw new Exception('Não autenticado');
    }
    
    $dominio = $currentUser['domain'];
    
    // ================================================================
    // OBTER PARÂMETROS
    // ================================================================
    $input = json_decode(file_get_contents('php://input'), true);
    $loginVendedor = strtoupper(trim($input['login_vendedor'] ?? ''));
    $unidade = strtoupper(trim($input['unidade'] ?? ''));
    $apenasTeleVendas = isset($input['apenas_tele_vendas']) && $input['apenas_tele_vendas'] === true;
    
    // ✅ RECEBER DADOS (que já vêm processados do frontend com filtros de mês/ano aplicados)
    // ⚡ OTIMIZADO: Não processa SSW aqui - recebe dados prontos
    $dados = $input['dados'] ?? [];
    
    // ✅ RECEBER LABELS DOS MESES
    $mesesLabels = $input['meses_labels'] ?? [
        'mes1' => 'MÊS PASSADO',
        'mes2' => 'MÊS ANTERIOR',
        'mes3' => '2 MESES ATRÁS'
    ];
    
    // ✅ VALIDAR APENAS SE HÁ DADOS PARA EXPORTAR
    if (empty($dados)) {
        throw new Exception('Nenhum dado para exportar');
    }
    
    // ================================================================
    // BUSCAR LOGO DO CLIENTE (não precisa conectar ao SSW aqui)
    // ================================================================
    $logoUrl = 'https://webpresto.com.br/images/logo_rel.png';
    $nomeCliente = '';
    
    try {
        $sqlLogo = "SELECT logo_light, name FROM domains WHERE domain = $1 LIMIT 1";
        $resultLogo = sql($g_sql, $sqlLogo, false, [$dominio]);
        
        if ($resultLogo && pg_num_rows($resultLogo) > 0) {
            $rowLogo = pg_fetch_assoc($resultLogo);
            if (!empty($rowLogo['logo_light'])) {
                $logoUrl = $rowLogo['logo_light'];
            }
            $nomeCliente = $rowLogo['name'] ?? '';
        }
    } catch (Exception $e) {
        // Ignorar erro de logo
    }
    
    // ================================================================
    // GERAR PLANILHA EXCEL
    // ================================================================
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Totais Vendedores');
    
    // 🖼️ INSERIR LOGO (seguindo padrão da Conferência de Saídas)
    $logoAdicionada = false;
    
    try {
        $logoContent = @file_get_contents($logoUrl);
        
        if ($logoContent !== false) {
            $tempLogoPath = sys_get_temp_dir() . '/logo_' . uniqid() . '.png';
            file_put_contents($tempLogoPath, $logoContent);
            
            $drawing = new Drawing();
            $drawing->setName('Logo');
            $drawing->setDescription('Logo do Cliente');
            $drawing->setPath($tempLogoPath);
            $drawing->setCoordinates('A1');
            $drawing->setHeight(60);
            $drawing->setOffsetX(10);
            $drawing->setOffsetY(10);
            $drawing->setWorksheet($sheet);
            
            $logoAdicionada = true;
            
            register_shutdown_function(function() use ($tempLogoPath) {
                if (file_exists($tempLogoPath)) {
                    @unlink($tempLogoPath);
                }
            });
        }
    } catch (Exception $e) {
        // Ignorar erros de logo
    }
    
    // 📋 CABEÇALHO (seguindo padrão da Conferência de Saídas)
    $linhaInicio = 1;
    
    if ($logoAdicionada) {
        $sheet->setCellValue('C1', 'TOTAIS DE VENDEDORES POR UNIDADE');
        $sheet->mergeCells('C1:G1');
        $sheet->getStyle('C1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
        ]);
        
        if ($nomeCliente) {
            $sheet->setCellValue('C2', strtoupper($nomeCliente));
            $sheet->mergeCells('C2:G2');
            $sheet->getStyle('C2')->applyFromArray([
                'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
            ]);
        }
        
        // ✅ EXIBIR "TODOS" / "TODAS" QUANDO FILTROS VAZIOS
        $vendedorTexto = empty($loginVendedor) ? 'TODOS' : $loginVendedor;
        $unidadeTexto = empty($unidade) ? 'TODAS' : $unidade;
        
        $filtroTexto = 'Vendedor: ' . $vendedorTexto . ' | Unidade: ' . $unidadeTexto . ' | Últimos 3 meses';
        $sheet->setCellValue('C3', $filtroTexto);
        $sheet->mergeCells('C3:G3');
        $sheet->getStyle('C3')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        $sheet->getRowDimension(1)->setRowHeight(50);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        
        // ⏰ DATA E HORA DE GERAÇÃO
        $dataHoraGeracao = date('d/m/Y \à\s H:i:s');
        $sheet->setCellValue('C4', 'Gerado em: ' . $dataHoraGeracao);
        $sheet->mergeCells('C4:G4');
        $sheet->getStyle('C4')->applyFromArray([
            'font' => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '94A3B8']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        $sheet->getRowDimension(4)->setRowHeight(18);
        
        $linhaInicio = 6; // Pular linhas do cabeçalho + data/hora
    } else {
        // Sem logo - cabeçalho simples
        $sheet->setCellValue('A1', 'TOTAIS DE VENDEDORES POR UNIDADE');
        $sheet->mergeCells('A1:E1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        // ✅ EXIBIR "TODOS" / "TODAS" QUANDO FILTROS VAZIOS
        $vendedorTexto = empty($loginVendedor) ? 'TODOS' : $loginVendedor;
        $unidadeTexto = empty($unidade) ? 'TODAS' : $unidade;
        
        $filtroTexto = 'Vendedor: ' . $vendedorTexto . ' | Unidade: ' . $unidadeTexto . ' | Últimos 3 meses';
        $sheet->setCellValue('A2', $filtroTexto);
        $sheet->mergeCells('A2:E2');
        $sheet->getStyle('A2')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        // ⏰ DATA E HORA DE GERAÇÃO
        $dataHoraGeracao = date('d/m/Y \à\s H:i:s');
        $sheet->setCellValue('A3', 'Gerado em: ' . $dataHoraGeracao);
        $sheet->mergeCells('A3:E3');
        $sheet->getStyle('A3')->applyFromArray([
            'font' => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '94A3B8']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        $sheet->getRowDimension(3)->setRowHeight(18);
        
        $linhaInicio = 5;
    }
    
    // 📊 TÍTULOS DAS COLUNAS
    $linhaTitulos = $linhaInicio;
    
    $sheet->setCellValue("A{$linhaTitulos}", 'VENDEDOR');
    $sheet->setCellValue("B{$linhaTitulos}", 'UNIDADE');
    $sheet->setCellValue("C{$linhaTitulos}", $mesesLabels['mes1']);
    $sheet->setCellValue("D{$linhaTitulos}", $mesesLabels['mes2']);
    $sheet->setCellValue("E{$linhaTitulos}", $mesesLabels['mes3']);
    
    // Estilizar títulos
    $headerStyle = [
        'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => 'FFFFFF']],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => '1E40AF']
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_CENTER,
            'vertical' => Alignment::VERTICAL_CENTER
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => '000000']
            ]
        ]
    ];
    $sheet->getStyle("A{$linhaTitulos}:E{$linhaTitulos}")->applyFromArray($headerStyle);
    $sheet->getRowDimension($linhaTitulos)->setRowHeight(25);
    
    // 📝 DADOS
    $linhaAtual = $linhaTitulos + 1;
    $totalFrete1 = 0;
    $totalFrete2 = 0;
    $totalFrete3 = 0;
    
    foreach ($dados as $row) {
        $sheet->setCellValue("A{$linhaAtual}", $row['login']);
        $sheet->setCellValue("B{$linhaAtual}", $row['unid']);
        $sheet->setCellValue("C{$linhaAtual}", $row['vlr_frete1']);
        $sheet->setCellValue("D{$linhaAtual}", $row['vlr_frete2']);
        $sheet->setCellValue("E{$linhaAtual}", $row['vlr_frete3']);
        
        // Formatação de moeda brasileira
        $sheet->getStyle("C{$linhaAtual}:E{$linhaAtual}")->getNumberFormat()
            ->setFormatCode('R$ #,##0.00');
        
        // Bordas
        $sheet->getStyle("A{$linhaAtual}:E{$linhaAtual}")->applyFromArray([
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['rgb' => 'CCCCCC']
                ]
            ]
        ]);
        
        $totalFrete1 += $row['vlr_frete1'];
        $totalFrete2 += $row['vlr_frete2'];
        $totalFrete3 += $row['vlr_frete3'];
        
        $linhaAtual++;
    }
    
    // 💰 LINHA DE TOTAIS
    $sheet->setCellValue("A{$linhaAtual}", 'TOTAIS');
    $sheet->setCellValue("B{$linhaAtual}", '');
    $sheet->setCellValue("C{$linhaAtual}", $totalFrete1);
    $sheet->setCellValue("D{$linhaAtual}", $totalFrete2);
    $sheet->setCellValue("E{$linhaAtual}", $totalFrete3);
    
    $sheet->getStyle("A{$linhaAtual}:E{$linhaAtual}")->applyFromArray([
        'font' => ['bold' => true, 'size' => 11],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => 'E5E7EB']
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_MEDIUM,
                'color' => ['rgb' => '000000']
            ]
        ]
    ]);
    
    $sheet->getStyle("C{$linhaAtual}:E{$linhaAtual}")->getNumberFormat()
        ->setFormatCode('R$ #,##0.00');
    
    // 📐 AJUSTAR LARGURAS DAS COLUNAS
    $sheet->getColumnDimension('A')->setWidth(20);
    $sheet->getColumnDimension('B')->setWidth(15);
    $sheet->getColumnDimension('C')->setWidth(18);
    $sheet->getColumnDimension('D')->setWidth(18);
    $sheet->getColumnDimension('E')->setWidth(18);
    
    // ================================================================
    // SALVAR E ENVIAR ARQUIVO
    // ================================================================
    $filename = "totais_vendedores_{$loginVendedor}_{$unidade}_" . date('Ymd') . ".xlsx";
    
    // Limpar buffer antes de enviar
    ob_end_clean();
    
    // Headers para download
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header("Content-Disposition: attachment; filename=\"{$filename}\"");
    header('Cache-Control: max-age=0');
    header('Cache-Control: max-age=1');
    header('Expires: Mon, 26 Jul 1997 05:00:00 GMT');
    header('Last-Modified: ' . gmdate('D, d M Y H:i:s') . ' GMT');
    header('Cache-Control: cache, must-revalidate');
    header('Pragma: public');
    
    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    
    exit;
    
} catch (Exception $e) {
    // Limpar buffer em caso de erro
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao gerar planilha: ' . $e->getMessage()
    ]);
    exit;
}