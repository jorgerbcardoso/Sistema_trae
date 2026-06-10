<?php
while (ob_get_level()) {
    ob_end_clean();
}
ob_start();

require_once __DIR__ . '/../../config.php';
require_once __DIR__ . '/../../config/phpspreadsheet_loader.php';

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

try {
    $currentUser = getCurrentUser();
    $dominioHeader = $_SERVER['HTTP_X_DOMAIN'] ?? null;
    $dominio = $currentUser['domain'] ?? $dominioHeader;

    if (!$dominio) {
        throw new Exception('Domínio não identificado');
    }

    $input   = json_decode(file_get_contents('php://input'), true);
    $ctes    = $input['ctes'] ?? [];
    $totais  = $input['totais'] ?? [];
    $filters = $input['filters'] ?? [];

    if (empty($ctes)) {
        throw new Exception('Nenhum CT-e para exportar');
    }

    $periodoOcorrenciaIni = $filters['periodoOcorrenciaInicio'] ?? '';
    $periodoOcorrenciaFin = $filters['periodoOcorrenciaFim'] ?? '';

    $dominioUpper = strtoupper($dominio);
    $logoUrl      = '';
    $nomeCliente  = '';

    try {
        $sqlLogo = "SELECT logo_light, name FROM domains WHERE domain = $1 LIMIT 1";
        $resultLogo = sql($sqlLogo, [$dominioUpper]);
        if ($resultLogo && pg_num_rows($resultLogo) > 0) {
            $rowLogo    = pg_fetch_assoc($resultLogo);
            $logoUrl    = trim($rowLogo['logo_light'] ?? '');
            $nomeCliente = $rowLogo['name'] ?? '';
        }
    } catch (Exception $e) {
        error_log('[PainelRetidos Excel] Erro SQL logo: ' . $e->getMessage());
    }

    if (!empty($logoUrl) && strpos($logoUrl, 'http') === false) {
        $host    = $_SERVER['HTTP_HOST'] ?? 'sistema.webpresto.com.br';
        $logoUrl = "https://{$host}/" . ltrim($logoUrl, '/');
    }

    $spreadsheet = new Spreadsheet();
    $sheet       = $spreadsheet->getActiveSheet();
    $sheet->setTitle('CT-e Retidos');

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
            error_log('[PainelRetidos Excel] Falha logo: ' . $e->getMessage());
        }
    }

    $ultimaColuna = 'O';

    if ($logoAdicionada) {
        $sheet->mergeCells('C1:' . $ultimaColuna . '1');
        $sheet->setCellValue('C1', 'PAINEL DE RETIDOS');
        $sheet->getStyle('C1')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '991B1B']],
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

        $periodoTexto = '';
        if ($periodoOcorrenciaIni && $periodoOcorrenciaFin) {
            $dtIni = DateTime::createFromFormat('Y-m-d', $periodoOcorrenciaIni);
            $dtFin = DateTime::createFromFormat('Y-m-d', $periodoOcorrenciaFin);
            $periodoTexto = 'Período Ocorrência: ' . ($dtIni ? $dtIni->format('d/m/Y') : $periodoOcorrenciaIni) . ' a ' . ($dtFin ? $dtFin->format('d/m/Y') : $periodoOcorrenciaFin);
        }
        $sheet->mergeCells('C3:' . $ultimaColuna . '3');
        $sheet->setCellValue('C3', $periodoTexto);
        $sheet->getStyle('C3')->applyFromArray([
            'font'      => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->mergeCells('C4:' . $ultimaColuna . '4');
        $sheet->setCellValue('C4', 'Gerado em: ' . date('d/m/Y à\s H:i:s'));
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
        $sheet->setCellValue('A1', 'PAINEL DE RETIDOS');
        $sheet->getStyle('A1')->applyFromArray([
            'font'      => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '991B1B']],
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

        $periodoTexto = '';
        if ($periodoOcorrenciaIni && $periodoOcorrenciaFin) {
            $dtIni = DateTime::createFromFormat('Y-m-d', $periodoOcorrenciaIni);
            $dtFin = DateTime::createFromFormat('Y-m-d', $periodoOcorrenciaFin);
            $periodoTexto = 'Período Ocorrência: ' . ($dtIni ? $dtIni->format('d/m/Y') : $periodoOcorrenciaIni) . ' a ' . ($dtFin ? $dtFin->format('d/m/Y') : $periodoOcorrenciaFin);
        }
        $sheet->mergeCells('A3:' . $ultimaColuna . '3');
        $sheet->setCellValue('A3', $periodoTexto);
        $sheet->getStyle('A3')->applyFromArray([
            'font'      => ['size' => 10, 'color' => ['rgb' => '64748B']],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER],
        ]);

        $sheet->mergeCells('A4:' . $ultimaColuna . '4');
        $sheet->setCellValue('A4', 'Gerado em: ' . date('d/m/Y à\s H:i:s'));
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
        'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '991B1B']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
        'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
    ];

    $headers = [
        'A' => 'CT-e',
        'B' => 'EMISSÃO',
        'C' => 'OCORRÊNCIA 82',
        'D' => 'STATUS',
        'E' => 'UNIDADE',
        'F' => 'CIDADE ORIGEM',
        'G' => 'CIDADE DESTINO',
        'H' => 'REMETENTE',
        'I' => 'DESTINATÁRIO',
        'J' => 'PAGADOR',
        'K' => 'PESO (KG)',
        'L' => 'VOLUME',
        'M' => 'VLR MERCADORIA',
        'N' => 'VLR FRETE',
        'O' => 'ÚLTIMA OCORRÊNCIA',
    ];

    $linhaHeader = $linhaInicio;
    foreach ($headers as $col => $titulo) {
        $sheet->setCellValue($col . $linhaHeader, $titulo);
    }
    $sheet->getStyle('A' . $linhaHeader . ':' . $ultimaColuna . $linhaHeader)->applyFromArray($headerStyle);
    $sheet->getRowDimension($linhaHeader)->setRowHeight(28);

    $linhaAtual = $linhaHeader + 1;

    $styleZebra1 = ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'F8FAFC']]];
    $styleZebra2 = ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEF2F2']]];
    $styleAtivo = ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'FEE2E2']]];

    $borderThin = [
        'borders' => [
            'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'E2E8F0']],
        ],
    ];

    foreach ($ctes as $idx => $cte) {
        $sheet->setCellValue('A' . $linhaAtual, ($cte['ser_cte'] ?? '') . str_pad($cte['nro_cte'] ?? 0, 6, '0', STR_PAD_LEFT));
        $sheet->setCellValue('B' . $linhaAtual, $cte['data_emissao'] ?? '');
        $sheet->setCellValue('C' . $linhaAtual, $cte['data_ocorrencia_82'] ?? '');
        $sheet->setCellValue('D' . $linhaAtual, ($cte['is_ativo'] ?? false) ? 'RETIDO' : 'RESOLVIDO');
        $sheet->setCellValue('E' . $linhaAtual, $cte['sigla_emit'] ?? '');
        $cidadeOrigem = '';
        if (isset($cte['cidade_emit']) && $cte['cidade_emit']) {
            $cidadeOrigem = $cte['cidade_emit'] . (isset($cte['uf_emit']) && $cte['uf_emit'] ? '/' . $cte['uf_emit'] : '');
        }
        $sheet->setCellValue('F' . $linhaAtual, $cidadeOrigem);
        $cidadeDestino = '';
        if (isset($cte['cidade_dest']) && $cte['cidade_dest']) {
            $cidadeDestino = $cte['cidade_dest'] . (isset($cte['uf_dest']) && $cte['uf_dest'] ? '/' . $cte['uf_dest'] : '');
        }
        $sheet->setCellValue('G' . $linhaAtual, $cidadeDestino);
        $sheet->setCellValue('H' . $linhaAtual, $cte['nome_remetente'] ?? '');
        $sheet->setCellValue('I' . $linhaAtual, $cte['nome_destinatario'] ?? '');
        $sheet->setCellValue('J' . $linhaAtual, $cte['nome_pagador'] ?? '');
        $sheet->setCellValue('K' . $linhaAtual, floatval($cte['peso_real'] ?? 0));
        $sheet->setCellValue('L' . $linhaAtual, intval($cte['qt_vol'] ?? 0));
        $sheet->setCellValue('M' . $linhaAtual, floatval($cte['vlr_merc'] ?? 0));
        $sheet->setCellValue('N' . $linhaAtual, floatval($cte['vlr_frete'] ?? 0));
        $sheet->setCellValue('O' . $linhaAtual, $cte['ult_ocor'] ?? '');

        $sheet->getStyle('K' . $linhaAtual)->getNumberFormat()->setFormatCode('#,##0.000');
        $sheet->getStyle('M' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
        $sheet->getStyle('N' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');

        $rowStyle = ($cte['is_ativo'] ?? false) ? $styleAtivo : ($idx % 2 === 0 ? $styleZebra1 : $styleZebra2);
        $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($rowStyle);
        $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($borderThin);
        $sheet->getRowDimension($linhaAtual)->setRowHeight(18);

        $linhaAtual++;
    }

    $linhaAtual++;

    $totalStyle = [
        'font'      => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
        'fill'      => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '991B1B']],
        'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT],
        'borders'   => ['allBorders' => ['borderStyle' => Border::BORDER_MEDIUM, 'color' => ['rgb' => '7F1D1D']]],
    ];

    $sheet->mergeCells('A' . $linhaAtual . ':K' . $linhaAtual);
    $sheet->setCellValue('A' . $linhaAtual, sprintf(
        'TOTAL: %d CT-e (%d retidos / %d resolvidos)',
        $totais['total_retidos'] ?? count($ctes),
        $totais['retidos_ativos'] ?? 0,
        $totais['retidos_resolvidos'] ?? 0
    ));
    $sheet->getStyle('A' . $linhaAtual)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
    $sheet->setCellValue('K' . $linhaAtual, floatval($totais['peso_total'] ?? 0));
    $sheet->setCellValue('L' . $linhaAtual, '');
    $sheet->setCellValue('M' . $linhaAtual, floatval($totais['vlr_merc_total'] ?? 0));
    $sheet->setCellValue('N' . $linhaAtual, floatval($totais['vlr_frete_total'] ?? 0));

    $sheet->getStyle('K' . $linhaAtual)->getNumberFormat()->setFormatCode('#,##0.000');
    $sheet->getStyle('M' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('N' . $linhaAtual)->getNumberFormat()->setFormatCode('R$ #,##0.00');
    $sheet->getStyle('A' . $linhaAtual . ':' . $ultimaColuna . $linhaAtual)->applyFromArray($totalStyle);
    $sheet->getRowDimension($linhaAtual)->setRowHeight(22);

    $sheet->getColumnDimension('A')->setWidth(14);
    $sheet->getColumnDimension('B')->setWidth(12);
    $sheet->getColumnDimension('C')->setWidth(14);
    $sheet->getColumnDimension('D')->setWidth(12);
    $sheet->getColumnDimension('E')->setWidth(10);
    $sheet->getColumnDimension('F')->setWidth(20);
    $sheet->getColumnDimension('G')->setWidth(20);
    $sheet->getColumnDimension('H')->setWidth(22);
    $sheet->getColumnDimension('I')->setWidth(22);
    $sheet->getColumnDimension('J')->setWidth(22);
    $sheet->getColumnDimension('K')->setWidth(12);
    $sheet->getColumnDimension('L')->setWidth(10);
    $sheet->getColumnDimension('M')->setWidth(16);
    $sheet->getColumnDimension('N')->setWidth(14);
    $sheet->getColumnDimension('O')->setWidth(18);

    $sheet->freezePane('A' . ($linhaHeader + 1));

    $filename = 'painel_retidos_' . date('Ymd_His') . '.xlsx';

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
