<?php
ini_set('display_errors', '0');
error_reporting(0);
ini_set('memory_limit', '512M');
set_time_limit(0);

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

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.'], 400);
}

$input = getRequestInput();
$currentUser = getCurrentUser();
$unidade = strtoupper(trim(
    $input['unidade']
    ?? $currentUser['unidade_atual']
    ?? $currentUser['unidade']
    ?? ''
));
$placa = strtoupper(trim((string)($input['placa'] ?? '')));
$rotaTxt = (string)($input['rota'] ?? '');
$linhas = $input['linhas'] ?? [];

if ($unidade === '' || !preg_match('/^[A-Z0-9]{2,5}$/', $unidade)) {
    respondJson(['success' => false, 'message' => 'Unidade inválida.'], 400);
}
if ($placa === '') {
    respondJson(['success' => false, 'message' => 'Placa inválida.'], 400);
}
if (!is_array($linhas)) $linhas = [];

$conn = connect();
$tblCar = "{$domain}_carregamento";
$tblUnid = "{$domain}_unidade";

$seqCar = 0;
try {
    $resCar = sql(
        "SELECT MAX(seq_carregamento) AS seq_carregamento
         FROM {$tblCar}
         WHERE unidade = $1
           AND UPPER(placa_provisoria) = UPPER($2)
           AND data_finalizacao IS NULL",
        [$unidade, $placa],
        $conn
    );
    if ($resCar) {
        $row = pg_fetch_assoc($resCar);
        $seqCar = (int)($row['seq_carregamento'] ?? 0);
    }
} catch (Exception $e) {
    $seqCar = 0;
}

$unidNome = '';
try {
    $resUn = sql(
        "SELECT COALESCE(nome, '') AS nome
         FROM {$tblUnid}
         WHERE UPPER(sigla) = UPPER($1)
         LIMIT 1",
        [$unidade],
        $conn
    );
    if ($resUn) {
        $rowUn = pg_fetch_assoc($resUn);
        $unidNome = (string)($rowUn['nome'] ?? '');
    }
} catch (Exception $e) {
    $unidNome = '';
}

$dominioUpper = strtoupper($domain);
$logoUrl = '';
try {
    $resLogo = sql(
        "SELECT logo_light
         FROM domains
         WHERE domain = $1
         LIMIT 1",
        [$dominioUpper],
        $conn
    );
    if ($resLogo && pg_num_rows($resLogo) > 0) {
        $rowLogo = pg_fetch_assoc($resLogo);
        $logoUrl = trim((string)($rowLogo['logo_light'] ?? ''));
    }
} catch (Exception $e) {
    $logoUrl = '';
}

if ($logoUrl !== '' && stripos($logoUrl, 'http') !== 0) {
    $host = $_SERVER['HTTP_HOST'] ?? 'webpresto.com.br';
    $logoUrl = "https://{$host}/" . ltrim($logoUrl, '/');
}

if (class_exists('\PhpOffice\PhpSpreadsheet\Settings') && class_exists('\PhpOffice\PhpSpreadsheet\CachedObjectStorageFactory')) {
    try {
        if (method_exists('\PhpOffice\PhpSpreadsheet\Settings', 'setCacheStorageMethod')) {
            \PhpOffice\PhpSpreadsheet\Settings::setCacheStorageMethod(
                \PhpOffice\PhpSpreadsheet\CachedObjectStorageFactory::cache_to_discISAM,
                ['dir' => sys_get_temp_dir()]
            );
        }
    } catch (Exception $e) {
    }
}

$spreadsheet = new Spreadsheet();
$sheet = $spreadsheet->getActiveSheet();
$sheet->setTitle('ORDEM DE CARREGAMENTO');

$sheet->getDefaultRowDimension()->setRowHeight(16);
$spreadsheet->getDefaultStyle()->getFont()->setName('Calibri')->setSize(11);

$colWidths = [
    'A' => 5,
    'B' => 7,
    'C' => 36,
    'D' => 10,
    'E' => 12,
    'F' => 18,
    'G' => 3,
    'H' => 14,
    'I' => 3,
    'J' => 11,
    'K' => 11,
    'L' => 11,
    'M' => 22,
    'N' => 9,
    'O' => 3,
    'P' => 28,
];
foreach ($colWidths as $col => $w) {
    $sheet->getColumnDimension($col)->setWidth($w);
}

$sheet->getRowDimension(1)->setRowHeight(42);
$sheet->getRowDimension(2)->setRowHeight(22);
$sheet->getRowDimension(3)->setRowHeight(18);
$sheet->getRowDimension(4)->setRowHeight(18);

$titleStyle = [
    'font' => ['bold' => true, 'size' => 16, 'color' => ['rgb' => '0F172A']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
];

$subTitleStyle = [
    'font' => ['bold' => true, 'size' => 11, 'color' => ['rgb' => '334155']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
];

$metaLabelStyle = [
    'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => '334155']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
];

$metaValueStyle = [
    'font' => ['size' => 10, 'color' => ['rgb' => '0F172A']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
];

$sheet->mergeCells('C1:P1');
$sheet->setCellValue('C1', 'ORDEM DE CARREGAMENTO');
$sheet->getStyle('C1')->applyFromArray($titleStyle);

$sheet->mergeCells('C2:P2');
$sheet->setCellValue('C2', trim($unidNome !== '' ? ($unidade . ' - ' . $unidNome) : $unidade));
$sheet->getStyle('C2')->applyFromArray($subTitleStyle);

$sheet->mergeCells('C3:P3');
$sheet->setCellValue('C3', 'Gerado em: ' . date('d/m/Y H:i'));
$sheet->getStyle('C3')->applyFromArray([
    'font' => ['size' => 9, 'italic' => true, 'color' => ['rgb' => '64748B']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
]);

$sheet->mergeCells('A5:C5');
$sheet->setCellValue('A5', 'DATA');
$sheet->getStyle('A5')->applyFromArray($metaLabelStyle);
$sheet->mergeCells('D5:F5');
$sheet->setCellValue('D5', date('d/m/Y'));
$sheet->getStyle('D5')->applyFromArray($metaValueStyle);

$sheet->mergeCells('H5:J5');
$sheet->setCellValue('H5', 'PLACA');
$sheet->getStyle('H5')->applyFromArray($metaLabelStyle);
$sheet->mergeCells('K5:M5');
$sheet->setCellValue('K5', $placa);
$sheet->getStyle('K5')->applyFromArray($metaValueStyle);

$sheet->mergeCells('N5:P5');
$sheet->setCellValue('N5', $seqCar > 0 ? ('OC Nº ' . $seqCar) : 'OC Nº');
$sheet->getStyle('N5')->applyFromArray([
    'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '0F172A']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT, 'vertical' => Alignment::VERTICAL_CENTER],
]);

$sheet->mergeCells('A7:P7');
$sheet->setCellValue('A7', $rotaTxt !== '' ? ('ROTA: ' . $rotaTxt) : 'ROTA:');
$sheet->getStyle('A7')->applyFromArray([
    'font' => ['size' => 10, 'color' => ['rgb' => '0F172A']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
]);
$sheet->getRowDimension(7)->setRowHeight(20);

$headerRow = 9;
$dataRowStart = 10;

$tableHeaderStyle = [
    'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => '1F2937']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
];
$tableCellBorder = [
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'CBD5E1']]],
    'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
];

$headers = [
    'A' => 'ORD',
    'B' => 'SETOR',
    'C' => 'DESTINATÁRIO',
    'F' => 'CIDADE',
    'H' => 'CTRC',
    'J' => 'PESO',
    'K' => 'PESO',
    'L' => 'CUBAGEM',
    'N' => 'VOLUME',
    'P' => 'OBS',
];

foreach ($headers as $col => $title) {
    $sheet->setCellValue($col . $headerRow, $title);
}
$sheet->getStyle('A' . $headerRow . ':P' . $headerRow)->applyFromArray($tableHeaderStyle);
$sheet->getRowDimension($headerRow)->setRowHeight(22);

if ($logoUrl !== '') {
    $tmpFile = null;
    try {
        $imgBin = @file_get_contents($logoUrl);
        if ($imgBin !== false && $imgBin !== '') {
            $tmpFile = tempnam(sys_get_temp_dir(), 'presto_logo_');
            $tmpPng = $tmpFile . '.png';
            @file_put_contents($tmpPng, $imgBin);
            $tmpFile = $tmpPng;
        }
    } catch (Exception $e) {
        $tmpFile = null;
    }

    if ($tmpFile && is_file($tmpFile)) {
        try {
            $drawing = new Drawing();
            $drawing->setName('Logo');
            $drawing->setPath($tmpFile);
            $drawing->setCoordinates('A1');
            $drawing->setHeight(46);
            $drawing->setOffsetX(8);
            $drawing->setOffsetY(6);
            $drawing->setWorksheet($sheet);
        } catch (Exception $e) {
        }
    }
}

$row = $dataRowStart;
$ord = 1;
foreach ($linhas as $item) {
    if (!is_array($item)) continue;
    $setor = strtoupper(trim((string)($item['setor'] ?? '')));
    $destinatario = trim((string)($item['destinatario'] ?? ''));
    $cidade = trim((string)($item['cidade'] ?? ''));
    $ctrc = trim((string)($item['ctrc'] ?? ''));
    $peso = (float)($item['peso'] ?? 0);
    $cubagem = (float)($item['cubagem'] ?? 0);
    $volume = (int)($item['volume'] ?? 0);
    $obs = trim((string)($item['obs'] ?? ''));

    $sheet->setCellValue('A' . $row, $ord);
    $sheet->setCellValue('B' . $row, $setor);
    $sheet->setCellValue('C' . $row, $destinatario);
    $sheet->setCellValue('F' . $row, $cidade);
    $sheet->setCellValue('H' . $row, $ctrc);
    $sheet->setCellValue('J' . $row, $peso);
    $sheet->setCellValue('K' . $row, $peso);
    $sheet->setCellValue('L' . $row, $cubagem);
    $sheet->setCellValue('N' . $row, $volume);
    $sheet->setCellValue('P' . $row, $obs);

    $row++;
    $ord++;
}

$lastRow = max($row - 1, $dataRowStart);
$sheet->getStyle('A' . $dataRowStart . ':P' . $lastRow)->applyFromArray($tableCellBorder);
$sheet->getStyle('A' . $dataRowStart . ':A' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
$sheet->getStyle('B' . $dataRowStart . ':B' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
$sheet->getStyle('C' . $dataRowStart . ':C' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setWrapText(true);
$sheet->getStyle('F' . $dataRowStart . ':F' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setWrapText(true);
$sheet->getStyle('H' . $dataRowStart . ':H' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
$sheet->getStyle('J' . $dataRowStart . ':L' . $lastRow)->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_00);
$sheet->getStyle('N' . $dataRowStart . ':N' . $lastRow)->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER);
$sheet->getStyle('J' . $dataRowStart . ':L' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
$sheet->getStyle('N' . $dataRowStart . ':N' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
$sheet->getStyle('P' . $dataRowStart . ':P' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setWrapText(true);

$sheet->getPageSetup()->setFitToWidth(1)->setFitToHeight(0);
$sheet->getPageMargins()->setTop(0.5)->setBottom(0.5)->setLeft(0.35)->setRight(0.35);
$sheet->freezePane('A' . $dataRowStart);
$sheet->getPageSetup()->setPrintArea('A1:P' . $lastRow);

$filename = 'ordem_carregamento_' . ($seqCar > 0 ? $seqCar : $placa) . '.xlsx';

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: max-age=0');

$out = ob_get_contents();
if ($out !== false && $out !== '') {
    ob_end_clean();
}

$writer = new Xlsx($spreadsheet);
$writer->setPreCalculateFormulas(false);
if (method_exists($writer, 'setUseDiskCaching')) {
    try {
        $writer->setUseDiskCaching(true, sys_get_temp_dir());
    } catch (Exception $e) {
    }
}
$writer->save('php://output');
exit;
