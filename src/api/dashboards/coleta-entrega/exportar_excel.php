<?php
while (ob_get_level()) {
    ob_end_clean();
}
ob_start();

require_once __DIR__ . '/../../config/phpspreadsheet_loader.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

require_once __DIR__ . '/../../config.php';

try {
    $currentUser = getCurrentUser();
    $dominioHeader = $_SERVER['HTTP_X_DOMAIN'] ?? null;
    $dominio = $currentUser['domain'] ?? $dominioHeader;

    if (!$dominio) {
        throw new Exception('Domínio não identificado');
    }

    $conn = connect();

    $input     = json_decode(file_get_contents('php://input'), true);
    $operacoes = $input['operacoes'] ?? [];
    $totais    = $input['totais']    ?? [];
    $filters   = $input['filters']   ?? [];

    if (empty($operacoes)) {
        throw new Exception('Nenhuma operação para exportar');
    }

    $dataIni = $filters['data_ini'] ?? '';
    $dataFin = $filters['data_fin'] ?? '';
    $unidade = strtoupper($filters['unidade'] ?? '');

    $dominioUpper = strtoupper($dominio);
    $logoUrl      = '';
    $nomeCliente  = '';

    try {
        $sqlLogo = "SELECT logo_light, name FROM domains WHERE domain = $1 LIMIT 1";
        $resultLogo = sql($conn, $sqlLogo, false, [$dominioUpper]);
        if ($resultLogo && pg_num_rows($resultLogo) > 0) {
            $rowLogo    = pg_fetch_assoc($resultLogo);
            $logoUrl    = trim($rowLogo['logo_light'] ?? '');
            $nomeCliente = $rowLogo['name'] ?? '';
        }
    } catch (Exception $e) {
        error_log('[ColetaEntrega Excel] Erro SQL logo: ' . $e->getMessage());
    }

    if (!empty($logoUrl) && strpos($logoUrl, 'http') === false) {
        $host    = $_SERVER['HTTP_HOST'] ?? 'sistema.webpresto.com.br';
        $logoUrl = "https://{$host}/" . ltrim($logoUrl, '/');
    }

    $spreadsheet = new Spreadsheet();
    $sheet       = $spreadsheet->getActiveSheet();
    $sheet->setTitle('Coleta e Entrega');

    $logoAdicionada = false;
    if (!empty($logoUrl)) {
        try {
            $drawing = new Drawing();
            $drawing->setName('Logo');
            $drawing->setPath($logoUrl);
            $drawing->setCoordinates('A1');
            $drawing->setHeight(60);
            $drawing->setOffsetX(10);
            $drawing->setOffsetY(10);
            $drawing->setWorksheet($sheet);
            $logoAdicionada = true;
        } catch (Exception $e) {
            error_log('[ColetaEntrega Excel] Falha logo: ' . $e->getMessage());
        }
    }

    $ultimaColuna = 'Q';

    if ($logoAdicionada) {
        $sheet->mergeCells('C1:' . $ultimaColuna . '1');
        $sheet->setCellValue('C1', 'COLETA E ENTREGA');
        $sheet->getStyle('C1')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);

        if ($nomeCliente) {
            $sheet->mergeCells('C2:' . $ultimaColuna . '2');
            $sheet->setCellValue('C2', strtoupper($nomeCliente));
            $sheet->getStyle('C2')->applyFromArray([
                'font'      => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        $periodoTexto = 'Período: ' . $dataIni . ' a ' . $dataFin . ($unidade ? ' | Unidade: ' . $unidade : '');
        $sheet->mergeCells('C3:' . $ultimaColuna . '3');
        $sheet->setCellValue('C3', $periodoTexto);
        $sheet->getStyle('C3')->applyFromArray([
            'font'      => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->mergeCells('C4:' . $ultimaColuna . '4');
        $sheet->setCellValue('C4', 'Gerado em: ' . date('d/m/Y \à\s H:i:s'));
        $sheet->getStyle('C4')->applyFromArray([
            'font'      => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '94A3B8']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->getRowDimension(1)->setRowHeight(50);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        $sheet->getRowDimension(4)->setRowHeight(18);
        $linhaInicio = 6;
    } else {
        $sheet->mergeCells('A1:' . $ultimaColuna . '1');
        $sheet->setCellValue('A1', 'COLETA E ENTREGA');
        $sheet->getStyle('A1')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '1E3A8A']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);

        if ($nomeCliente) {
            $sheet->mergeCells('A2:' . $ultimaColuna . '2');
            $sheet->setCellValue('A2', strtoupper($nomeCliente));
            $sheet->getStyle('A2')->applyFromArray([
                'font'      => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '475569']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
            ]);
        }

        $periodoTexto = 'Período: ' . $dataIni . ' a ' . $dataFin . ($unidade ? ' | Unidade: ' . $unidade : '');
        $sheet->mergeCells('A3:' . $ultimaColuna . '3');
        $sheet->setCellValue('A3', $periodoTexto);
        $sheet->getStyle('A3')->applyFromArray([
            'font'      => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->mergeCells('A4:' . $ultimaColuna . '4');
        $sheet->setCellValue('A4', 'Gerado em: ' . date('d/m/Y \à\s H:i:s'));
        $sheet->getStyle('A4')->applyFromArray([
            'font'      => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '94A3B8']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->getRowDimension(1)->setRowHeight(25);
        $sheet->getRowDimension(2)->setRowHeight(20);
        $sheet->getRowDimension(3)->setRowHeight(20);
        $sheet->getRowDimension(4)->setRowHeight(18);
        $linhaInicio = 6;
    }

    $headerStyle = [
        'font'      => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
        'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E3A8A']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
        'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
    ];

    $headers = [
        'A' => 'DATA',
        'B' => 'TIPO',
        'C' => 'PLACA',
        'D' => 'CTRC',
        'E' => 'NF',
        'F' => 'REMETENTE',
        'G' => 'EXPEDIDOR',
        'H' => 'DESTINATÁRIO',
        'I' => 'RECEBEDOR',
        'J' => 'CIDADE ENTREGA',
        'K' => 'PAGADOR',
        'L' => 'ROMANEIO',
        'M' => 'PESO (KG)',
        'N' => 'VOLUME',
        'O' => 'VLR MERCADORIA',
        'P' => 'VLR FRETE',
        'Q' => '% CTRB/FRETE',
    ];

    $linhaHeader = $linhaInicio;
    foreach ($headers as $col => $titulo) {
        $sheet->setCellValue($col . $linhaHeader, $titulo);
    }
    $sheet->getStyle('A' . $linhaHeader . ':' . $ultimaColuna . $linhaHeader)->applyFromArray($headerStyle);
    $sheet->getRowDimension($linhaHeader)->setRowHeight(28);

    $linhaAtual = $linhaHeader + 1;

    $styleZebra1 = ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F8FAFC']]];
    $styleZebra2 = ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'EFF6FF']]];
    $styleColeta = ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FFF7ED']]];

    $borderThin = [
        'borders' => [
            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E2E8F0']],
        ],
    ];

    foreach ($operacoes as $idx => $op) {
        $sheet->setCellValue('A' . $linhaAtual, $op['dataBaixa'] ?? '');
        $sheet->setCellValue('B' . $linhaAtual, $op['tipo'] ?? '');
        $sheet->setCellValue('C' . $linhaAtual, $op['placa'] ?? '');
        $sheet->setCellValue('D' . $linhaAtual, $op['ctrc'] ?? '');
        $sheet->setCellValue('E' . $linhaAtual, $op['nf'] ?? '');
        $sheet->setCellValue('F' . $linhaAtual, $op['nomeRemetente'] ?? '');
        $sheet->setCellValue('G' . $linhaAtual, $op['nomeExpedidor'] ?? '');
        $sheet->setCellValue('H' . $linhaAtual, $op['nomeDestinatario'] ?? '');
        $sheet->setCellValue('I' . $linhaAtual, $op['nomeRecebedor'] ?? '');
        $sheet->setCellValue('J' . $linhaAtual, $op['cidadeEntrega'] ?? '');
        $sheet->setCellValue('K' . $linhaAtual, $op['nomePagador'] ?? '');
        $sheet->setCellValue('L' . $linhaAtual, $op['romaneio'] ?? '');
        $sheet->setCellValue('M' . $linhaAtual, floatval($op['pesoCalculo'] ?? 0));
        $sheet->setCellValue('N' . $linhaAtual, intval($op['qtVol'] ?? 0));
        $sheet->setCellValue('O' . $linhaAtual, floatval($op['valMerc'] ?? 0));
        $sheet->setCellValue('P' . $linhaAtual, floatval($op['vlrFrete'] ?? 0));
        $sheet->setCellValue('Q' . $linhaAtual, floatval($op['percCtrb'] ?? 0));

        $sheet->getStyle('M' . $linhaAtual)->getNumberFormat()->setFormatCode('#,##0.000');
        $sheet->getStyle('O' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
        $sheet->getStyle('P' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
        $sheet->getStyle('Q' . $linhaAtual)->getNumberFormat()->setFormatCode('0.00"%"');

        $rowStyle = ($op['tipoCodigo'] ?? '') === 'C' ? $styleColeta : ($idx % 2 === 0 ? $styleZebra1 : $styleZebra2);
        $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($rowStyle);
        $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($borderThin);
        $sheet->getRowDimension($linhaAtual)->setRowHeight(18);

        $linhaAtual++;
    }

    $linhaAtual++;

    $totalStyle = [
        'font'      => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
        'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1E40AF']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT],
        'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['rgb' => '1E3A8A']]],
    ];

    $sheet->mergeCells('A' . $linhaAtual . ':L' . $linhaAtual);
    $sheet->setCellValue('A' . $linhaAtual, sprintf(
        'TOTAL: %d operações (%d coletas / %d entregas)',
        $totais['total'] ?? count($operacoes),
        $totais['coletas'] ?? 0,
        $totais['entregas'] ?? 0
    ));
    $sheet->setCellValue('M' . $linhaAtual, floatval($totais['peso'] ?? 0));
    $sheet->setCellValue('N' . $linhaAtual, intval($totais['vol'] ?? 0));
    $sheet->setCellValue('O' . $linhaAtual, floatval($totais['valMerc'] ?? 0));
    $sheet->setCellValue('P' . $linhaAtual, floatval($totais['frete'] ?? 0));
    $sheet->setCellValue('Q' . $linhaAtual, floatval($totais['percCtrb'] ?? 0));

    $sheet->getStyle('M' . $linhaAtual)->getNumberFormat()->setFormatCode('#,##0.000');
    $sheet->getStyle('O' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('P' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('Q' . $linhaAtual)->getNumberFormat()->setFormatCode('0.00"%"');
    $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($totalStyle);
    $sheet->getRowDimension($linhaAtual)->setRowHeight(22);

    $sheet->getColumnDimension('A')->setWidth(12);
    $sheet->getColumnDimension('B')->setWidth(10);
    $sheet->getColumnDimension('C')->setWidth(10);
    $sheet->getColumnDimension('D')->setWidth(16);
    $sheet->getColumnDimension('E')->setWidth(12);
    $sheet->getColumnDimension('F')->setWidth(22);
    $sheet->getColumnDimension('G')->setWidth(22);
    $sheet->getColumnDimension('H')->setWidth(22);
    $sheet->getColumnDimension('I')->setWidth(22);
    $sheet->getColumnDimension('J')->setWidth(18);
    $sheet->getColumnDimension('K')->setWidth(22);
    $sheet->getColumnDimension('L')->setWidth(12);
    $sheet->getColumnDimension('M')->setWidth(12);
    $sheet->getColumnDimension('N')->setWidth(10);
    $sheet->getColumnDimension('O')->setWidth(16);
    $sheet->getColumnDimension('P')->setWidth(14);
    $sheet->getColumnDimension('Q')->setWidth(14);

    $sheet->freezePane('A' . ($linhaHeader + 1));

    $filename = 'coleta_entrega_' . date('Ymd_His') . '.xlsx';

    ob_end_clean();

    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');

    $writer = new Xlsx($spreadsheet);
    $writer->save('php://output');
    exit;

} catch (Exception $e) {
    ob_end_clean();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao exportar: ' . $e->getMessage()]);
    exit;
}
