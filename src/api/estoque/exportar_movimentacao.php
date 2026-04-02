<?php
/**
 * 📊 EXPORTAÇÃO EXCEL - MOVIMENTAÇÃO DE ESTOQUE
 */

// Limpar buffer de saída
while (ob_get_level()) {
    ob_end_clean();
}
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

// ✅ Carregar config.php
require_once __DIR__ . '/../config.php';

try {
    // ✅ Obter usuário autenticado e domínio
    $currentUser = getCurrentUser();
    $dominioHeader = $_SERVER['HTTP_X_DOMAIN'] ?? null;
    $dominio = $currentUser['domain'] ?? $dominioHeader;
    
    if (!$dominio) {
        throw new Exception('Domínio não identificado');
    }
    
    // ✅ CRIAR CONEXÃO (PADRÃO OBRIGATÓRIO)
    $conn = connect();
    
    // 📥 Receber dados do frontend
    $input = json_decode(file_get_contents('php://input'), true);
    
    $movimentacoes = $input['movimentacoes'] ?? [];
    $filters = $input['filters'] ?? [];
    
    if (empty($movimentacoes)) {
        throw new Exception('Nenhuma movimentação para exportar');
    }
    
    // 🏢 BUSCAR LOGO DO CLIENTE
    // ✅ PADRÃO OBRIGATÓRIO: Se for ACV, usar a logo da Aceville. Caso contrário, Presto.
    $isACV = (strtoupper($dominio) === 'ACV');
    $logoUrl = $isACV 
        ? 'https://sistema.webpresto.com.br/images/logos_clientes/aceville.png' 
        : 'https://webpresto.com.br/images/logo_rel.png';
    
    $nomeCliente = '';
    
    try {
        $sqlLogo = "SELECT logo_light, name FROM domains WHERE domain = $1 LIMIT 1";
        $resultLogo = sql($conn, $sqlLogo, false, [$dominio]);
        
        if ($resultLogo && pg_num_rows($resultLogo) > 0) {
            $rowLogo = pg_fetch_assoc($resultLogo);
            // Se NÃO for ACV e tiver logo no banco, usa a do banco. 
            // Se for ACV, mantemos a que fixamos acima.
            if (!$isACV && !empty($rowLogo['logo_light'])) {
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
    $sheet->setTitle('Movimentação Estoque');
    
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
        $sheet->setCellValue('C1', 'RELATÓRIO DE MOVIMENTAÇÃO DE ESTOQUE');
        $sheet->mergeCells('C1:J1');
        $sheet->getStyle('C1')->applyFromArray([
            'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
        ]);
        
        if ($nomeCliente) {
            $sheet->setCellValue('C2', strtoupper($nomeCliente));
            $sheet->mergeCells('C2:J2');
            $sheet->getStyle('C2')->applyFromArray([
                'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
            ]);
        }
        
        $dataInicio = isset($filters['data_inicio']) ? date('d/m/Y', strtotime($filters['data_inicio'])) : '-';
        $dataFim = isset($filters['data_fim']) ? date('d/m/Y', strtotime($filters['data_fim'])) : '-';
        $periodoTexto = "Período: {$dataInicio} a {$dataFim} | Unidade: " . ($filters['unidade'] ?? 'TODAS');
        
        $sheet->setCellValue('C3', $periodoTexto);
        $sheet->mergeCells('C3:J3');
        $sheet->getStyle('C3')->applyFromArray([
            'font' => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER]
        ]);
        
        $sheet->getRowDimension(1)->setRowHeight(50);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        
        $linhaInicio = 5;
    }
    
    // 📊 CABEÇALHO DA TABELA
    $colunasHeader = [
        'A' => 'Data/Hora',
        'B' => 'Tipo',
        'C' => 'Código Item',
        'D' => 'Descrição Item',
        'E' => 'Unidade',
        'F' => 'Estoque',
        'G' => 'Localização',
        'H' => 'Quantidade',
        'I' => 'Vlr. Unitário',
        'J' => 'Vlr. Total',
        'K' => 'Observação'
    ];
    
    foreach ($colunasHeader as $col => $titulo) {
        $sheet->setCellValue($col . $linhaInicio, $titulo);
    }
    
    $sheet->getStyle('A' . $linhaInicio . ':K' . $linhaInicio)->applyFromArray([
        'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF'], 'size' => 11],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '1E3A8A']]]
    ]);
    
    // 📝 PREENCHER DADOS
    $linha = $linhaInicio + 1;
    $totalEntradas = 0;
    $totalSaidas = 0;
    
    foreach ($movimentacoes as $mvto) {
        $tipoDescricao = '';
        switch ($mvto['tipo']) {
            case 'E': $tipoDescricao = 'Entrada Manual'; break;
            case 'P': $tipoDescricao = 'Pedido'; break;
            case 'I': $tipoDescricao = 'Inventário'; break;
            case 'S': $tipoDescricao = 'Saída'; break;
            case 'R': $tipoDescricao = 'Requisição'; break;
            default: $tipoDescricao = $mvto['tipo'];
        }
        
        $mvtoSimbolo = $mvto['mvto'] === 'E' ? '▲' : '▼';
        
        $sheet->setCellValue('A' . $linha, $mvto['data_mvto'] . ' ' . $mvto['hora_mvto']);
        $sheet->setCellValue('B' . $linha, $mvtoSimbolo . ' ' . $tipoDescricao);
        $sheet->setCellValue('C' . $linha, $mvto['codigo_item']);
        $sheet->setCellValue('D' . $linha, $mvto['descricao_item']);
        $sheet->setCellValue('E' . $linha, $mvto['unidade'] ?? '-');
        $sheet->setCellValue('F' . $linha, ($mvto['nro_estoque'] ?? '') . ' - ' . ($mvto['estoque_descricao'] ?? ''));
        $sheet->setCellValue('G' . $linha, $mvto['localizacao'] ?? '-');
        $sheet->setCellValue('H' . $linha, floatval($mvto['qtde_item']));
        $sheet->setCellValue('I' . $linha, floatval($mvto['vlr_unitario']));
        $sheet->setCellValue('J' . $linha, floatval($mvto['vlr_total']));
        $sheet->setCellValue('K' . $linha, $mvto['observacao'] ?? '-');
        
        // Contabilizar totais
        if ($mvto['mvto'] === 'E') {
            $totalEntradas += floatval($mvto['vlr_total']);
        } else {
            $totalSaidas += floatval($mvto['vlr_total']);
        }
        
        // Aplicar cores por tipo de movimento
        $corFundo = $mvto['mvto'] === 'E' ? 'F0FDF4' : 'FEF2F2';
        $sheet->getStyle('A' . $linha . ':K' . $linha)->applyFromArray([
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $corFundo]],
            'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E5E7EB']]]
        ]);
        
        $linha++;
    }
    
    // 📊 LINHA DE TOTAIS
    $sheet->setCellValue('A' . $linha, 'TOTAIS:');
    $sheet->mergeCells('A' . $linha . ':G' . $linha);
    $sheet->setCellValue('H' . $linha, 'Entradas: R$ ' . number_format($totalEntradas, 2, ',', '.'));
    $sheet->setCellValue('I' . $linha, 'Saídas: R$ ' . number_format($totalSaidas, 2, ',', '.'));
    $sheet->setCellValue('J' . $linha, number_format($totalEntradas - $totalSaidas, 2, ',', '.'));
    $sheet->setCellValue('K' . $linha, 'Saldo');
    
    $sheet->getStyle('A' . $linha . ':K' . $linha)->applyFromArray([
        'font' => ['bold' => true, 'size' => 11],
        'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'EFF6FF']],
        'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => '3B82F6']]],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER]
    ]);
    
    // 🎨 FORMATAÇÃO DE NÚMEROS
    $sheet->getStyle('H' . ($linhaInicio + 1) . ':J' . ($linha - 1))
        ->getNumberFormat()
        ->setFormatCode('#,##0.00');
    
    // 📏 AJUSTAR LARGURA DAS COLUNAS
    $sheet->getColumnDimension('A')->setWidth(18);
    $sheet->getColumnDimension('B')->setWidth(18);
    $sheet->getColumnDimension('C')->setWidth(15);
    $sheet->getColumnDimension('D')->setWidth(35);
    $sheet->getColumnDimension('E')->setWidth(10);
    $sheet->getColumnDimension('F')->setWidth(25);
    $sheet->getColumnDimension('G')->setWidth(15);
    $sheet->getColumnDimension('H')->setWidth(12);
    $sheet->getColumnDimension('I')->setWidth(14);
    $sheet->getColumnDimension('J')->setWidth(14);
    $sheet->getColumnDimension('K')->setWidth(30);
    
    // 📤 ENVIAR ARQUIVO
    $filename = 'movimentacao_estoque_' . date('Y-m-d_His') . '.xlsx';
    
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment;filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    
    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    
    ob_end_flush();
    exit;
    
} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao exportar: ' . $e->getMessage()
    ]);
    exit;
}