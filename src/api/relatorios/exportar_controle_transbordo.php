<?php
/**
 * ========================================
 * EXPORTAR CONTROLE DE TRANSBORDO - EXCEL
 * ========================================
 *
 * Exporta os dados de transbordo para planilha Excel (.xlsx)
 * Recebe os dados já filtrados do frontend
 *
 * @return Arquivo Excel (.xlsx)
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

// ✅ Carregar APENAS config.php (tem tudo que precisa)
require_once __DIR__ . '/../config.php';

// 🌍 Usar conexão global
global $g_sql;
global $dominio;

try {
    // ✅ Obter usuário autenticado
    $currentUser = getCurrentUser();
    
    if (!$currentUser) {
        throw new Exception('Não autenticado');
    }
    
    $dominio = $currentUser['domain'];
    
    //  Receber dados do frontend
    $input = json_decode(file_get_contents('php://input'), true);
    
    // ✅ RECEBER TRANSBORDOS (que já vêm processados do frontend)
    $transbordos = $input['transbordos'] ?? [];
    $filters = $input['filters'] ?? [];
    
    $mes = str_pad($filters['mes'] ?? date('m'), 2, '0', STR_PAD_LEFT);
    $ano = $filters['ano'] ?? date('Y');
    
    if (empty($transbordos)) {
        throw new Exception('Nenhum transbordo para exportar');
    }
    
    // 🏢 BUSCAR LOGO DO CLIENTE (PostgreSQL)
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
    
    // 📊 CRIAR PLANILHA EXCEL
    $spreadsheet = new Spreadsheet();
    $sheet = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Controle Transbordo');
    
    // 🖼️ INSERIR LOGO
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
    
    // 📋 CABEÇALHO
    $linhaInicio = 1;
    
    if ($logoAdicionada) {
        $sheet->setCellValue('C1', 'CONTROLE DE TRANSBORDO');
        $sheet->mergeCells('C1:H1');
        $sheet->getStyle('C1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
        ]);
        
        if ($nomeCliente) {
            $sheet->setCellValue('C2', strtoupper($nomeCliente));
            $sheet->mergeCells('C2:H2');
            $sheet->getStyle('C2')->applyFromArray([
                'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
            ]);
        }
        
        $periodoTexto = "Período: $mes/$ano";
        $sheet->setCellValue('C3', $periodoTexto);
        $sheet->mergeCells('C3:H3');
        $sheet->getStyle('C3')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        $sheet->getRowDimension(1)->setRowHeight(50);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        
        // ⏰ DATA E HORA DE GERAÇÃO
        $dataHoraGeracao = date('d/m/Y \\à\\s H:i:s');
        $sheet->setCellValue('C4', 'Gerado em: ' . $dataHoraGeracao);
        $sheet->mergeCells('C4:H4');
        $sheet->getStyle('C4')->applyFromArray([
            'font' => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '94A3B8']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        $sheet->getRowDimension(4)->setRowHeight(18);
        
        $linhaInicio = 6;
    } else {
        $sheet->setCellValue('A1', 'CONTROLE DE TRANSBORDO');
        $sheet->mergeCells('A1:L1');
        $sheet->getStyle('A1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
        ]);
        
        if ($nomeCliente) {
            $sheet->setCellValue('A2', strtoupper($nomeCliente));
            $sheet->mergeCells('A2:L2');
            $sheet->getStyle('A2')->applyFromArray([
                'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
            ]);
        }
        
        $periodoTexto = "Período: $mes/$ano";
        $sheet->setCellValue('A3', $periodoTexto);
        $sheet->mergeCells('A3:L3');
        $sheet->getStyle('A3')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        $sheet->getRowDimension(1)->setRowHeight(25);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        
        // ⏰ DATA E HORA DE GERAÇÃO
        $dataHoraGeracao = date('d/m/Y \\à\\s H:i:s');
        $sheet->setCellValue('A4', 'Gerado em: ' . $dataHoraGeracao);
        $sheet->mergeCells('A4:L4');
        $sheet->getStyle('A4')->applyFromArray([
            'font' => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '94A3B8']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        $sheet->getRowDimension(4)->setRowHeight(18);
        
        $linhaInicio = 6;
    }
    
    // 📋 CABEÇALHOS DAS COLUNAS
    $linhaCabecalho = $linhaInicio;
    
    $headers = [
        'A' => 'Unid. Transbordo',
        'B' => 'Unid. Origem',
        'C' => 'Unid. Destino',
        'D' => 'Qtde. CT-es',
        'E' => 'Qtde. Vol.',
        'F' => 'Peso Calc. (ton)',
        'G' => 'Particip. (%)',
        'H' => 'Frete CIF (R$)',
        'I' => 'Frete FOB (R$)',
        'J' => 'Frete Terc. (R$)',
        'K' => 'Frete Total (R$)',
        'L' => 'ICMS (R$)'
    ];
    
    foreach ($headers as $col => $value) {
        $sheet->setCellValue($col . $linhaCabecalho, $value);
    }
    
    // 🎨 Estilizar cabeçalho
    $headerStyle = [
        'font' => [
            'bold' => true,
            'color' => ['rgb' => 'FFFFFF'],
            'size' => 11
        ],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => '2563EB']
        ],
        'alignment' => [
            'horizontal' => Alignment::HORIZONTAL_CENTER,
            'vertical' => Alignment::VERTICAL_CENTER
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'FFFFFF']
            ]
        ]
    ];
    
    $sheet->getStyle('A' . $linhaCabecalho . ':L' . $linhaCabecalho)->applyFromArray($headerStyle);
    $sheet->getRowDimension($linhaCabecalho)->setRowHeight(25);
    
    // 📝 PREENCHER DADOS
    $linhaAtual = $linhaCabecalho + 1;
    
    $totals = [
        'qtdeCtes' => 0,
        'qtdeVol' => 0,
        'pesoCalc' => 0,
        'participacao' => 0,
        'freteCif' => 0,
        'freteFob' => 0,
        'freteTer' => 0,
        'freteTotal' => 0,
        'icms' => 0
    ];
    
    foreach ($transbordos as $t) {
        $sheet->setCellValue('A' . $linhaAtual, $t['unidadeTransbordo']);
        $sheet->setCellValue('B' . $linhaAtual, $t['unidadeOrigem']);
        $sheet->setCellValue('C' . $linhaAtual, $t['unidadeDestino']);
        $sheet->setCellValue('D' . $linhaAtual, $t['qtdeCtes']);
        $sheet->setCellValue('E' . $linhaAtual, $t['qtdeVol']);
        $sheet->setCellValue('F' . $linhaAtual, floatval($t['pesoCalc']));
        $sheet->setCellValue('G' . $linhaAtual, floatval($t['participacao']));
        $sheet->setCellValue('H' . $linhaAtual, floatval($t['freteCif']));
        $sheet->setCellValue('I' . $linhaAtual, floatval($t['freteFob']));
        $sheet->setCellValue('J' . $linhaAtual, floatval($t['freteTer']));
        $sheet->setCellValue('K' . $linhaAtual, floatval($t['freteTotal']));
        $sheet->setCellValue('L' . $linhaAtual, floatval($t['icms']));
        
        // Acumular totais
        $totals['qtdeCtes'] += $t['qtdeCtes'];
        $totals['qtdeVol'] += $t['qtdeVol'];
        $totals['pesoCalc'] += floatval($t['pesoCalc']);
        $totals['participacao'] += floatval($t['participacao']);
        $totals['freteCif'] += floatval($t['freteCif']);
        $totals['freteFob'] += floatval($t['freteFob']);
        $totals['freteTer'] += floatval($t['freteTer']);
        $totals['freteTotal'] += floatval($t['freteTotal']);
        $totals['icms'] += floatval($t['icms']);
        
        // ✅ LINHAS ZEBRADAS
        if ($linhaAtual % 2 === 0) {
            $sheet->getStyle('A' . $linhaAtual . ':L' . $linhaAtual)->applyFromArray([
                'fill' => [
                    'fillType' => Fill::FILL_SOLID,
                    'startColor' => ['rgb' => 'F8FAFC']
                ]
            ]);
        }
        
        $linhaAtual++;
    }
    
    $ultimaLinhaDados = $linhaAtual - 1;
    
    // 🎨 Formatar valores numéricos
    $sheet->getStyle('D' . ($linhaCabecalho + 1) . ':E' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('#,##0');
    $sheet->getStyle('F' . ($linhaCabecalho + 1) . ':G' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('#,##0.00');
    $sheet->getStyle('H' . ($linhaCabecalho + 1) . ':L' . $ultimaLinhaDados)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    
    // 🎨 Centralizar
    $sheet->getStyle('A' . ($linhaCabecalho + 1) . ':C' . $ultimaLinhaDados)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    
    // 🎨 Alinhar direita
    $sheet->getStyle('D' . ($linhaCabecalho + 1) . ':L' . $ultimaLinhaDados)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    
    // 🎨 Bordas
    $sheet->getStyle('A' . $linhaCabecalho . ':L' . $ultimaLinhaDados)->applyFromArray([
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_THIN,
                'color' => ['rgb' => 'CBD5E1']
            ]
        ]
    ]);
    
    // 📏 Auto-ajustar colunas
    foreach (range('A', 'L') as $col) {
        $sheet->getColumnDimension($col)->setAutoSize(true);
    }
    
    // ❄️ Congelar cabeçalho
    $sheet->freezePane('A' . ($linhaCabecalho + 1));
    
    // 📊 Linha TOTAIS
    $linhaTotais = $ultimaLinhaDados + 2;
    
    $sheet->setCellValue('A' . $linhaTotais, 'TOTAIS');
    $sheet->mergeCells('A' . $linhaTotais . ':C' . $linhaTotais);
    $sheet->setCellValue('D' . $linhaTotais, $totals['qtdeCtes']);
    $sheet->setCellValue('E' . $linhaTotais, $totals['qtdeVol']);
    $sheet->setCellValue('F' . $linhaTotais, $totals['pesoCalc']);
    $sheet->setCellValue('G' . $linhaTotais, $totals['participacao']);
    $sheet->setCellValue('H' . $linhaTotais, $totals['freteCif']);
    $sheet->setCellValue('I' . $linhaTotais, $totals['freteFob']);
    $sheet->setCellValue('J' . $linhaTotais, $totals['freteTer']);
    $sheet->setCellValue('K' . $linhaTotais, $totals['freteTotal']);
    $sheet->setCellValue('L' . $linhaTotais, $totals['icms']);
    
    // 🎨 Estilizar TOTAIS
    $totalStyle = [
        'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '1E3A8A']],
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => 'DBEAFE']
        ],
        'borders' => [
            'allBorders' => [
                'borderStyle' => Border::BORDER_MEDIUM,
                'color' => ['rgb' => '2563EB']
            ]
        ]
    ];
    
    $sheet->getStyle('A' . $linhaTotais . ':L' . $linhaTotais)->applyFromArray($totalStyle);
    $sheet->getStyle('A' . $linhaTotais)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
    $sheet->getStyle('D' . $linhaTotais . ':L' . $linhaTotais)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
    $sheet->getRowDimension($linhaTotais)->setRowHeight(25);
    
    // 🎨 Formatar TOTAIS
    $sheet->getStyle('D' . $linhaTotais . ':E' . $linhaTotais)->getNumberFormat()->setFormatCode('#,##0');
    $sheet->getStyle('F' . $linhaTotais . ':G' . $linhaTotais)->getNumberFormat()->setFormatCode('#,##0.00');
    $sheet->getStyle('H' . $linhaTotais . ':L' . $linhaTotais)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    
    // 💾 SALVAR EM ARQUIVO TEMPORÁRIO
    $filename = "Controle_Transbordo_{$mes}_{$ano}_" . date('Ymd_His') . '.xlsx';
    $tempFile = sys_get_temp_dir() . '/' . $filename;
    
    $writer = new Xlsx($spreadsheet);
    $writer->save($tempFile);
    
    // ✅ LIMPAR TODO O BUFFER
    ob_end_clean();
    
    // 📤 ENVIAR ARQUIVO
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Content-Length: ' . filesize($tempFile));
    header('Cache-Control: max-age=0');
    header('Pragma: public');
    
    readfile($tempFile);
    
    // Limpar temporário
    @unlink($tempFile);
    
} catch (Exception $e) {
    // Limpar buffer
    while (ob_get_level()) {
        ob_end_clean();
    }
    
    // Enviar erro
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}

exit;