<?php
while (ob_get_level()) {
    ob_end_clean();
}
ob_start();

require_once __DIR__ . '/../../config/phpspreadsheet_loader.php';

use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;

require_once __DIR__ . '/../../config.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth = authenticateAndGetUser();
$domain = $auth['domain'];

if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) {
    respondJson(['success' => false, 'message' => 'Domínio inválido.']);
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
    respondJson(['success' => false, 'message' => 'Unidade inválida.']);
}
if ($placa === '') {
    respondJson(['success' => false, 'message' => 'Placa inválida.']);
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

$templatePath = realpath(__DIR__ . '/../../../../../ordem_carregamento.xlsx');
if (!$templatePath || !is_file($templatePath)) {
    respondJson(['success' => false, 'message' => 'Template ordem_carregamento.xlsx não encontrado.']);
}

$spreadsheet = IOFactory::load($templatePath);
$sheet = $spreadsheet->getSheetByName('ORDEM DE CARREGAMENTO');
if (!$sheet) {
    respondJson(['success' => false, 'message' => 'Aba ORDEM DE CARREGAMENTO não encontrada no template.']);
}

$spreadsheet->setActiveSheetIndex($spreadsheet->getIndex($sheet));

for ($i = $spreadsheet->getSheetCount() - 1; $i >= 0; $i--) {
    $s = $spreadsheet->getSheet($i);
    if ($s->getTitle() !== 'ORDEM DE CARREGAMENTO') {
        $spreadsheet->removeSheetByIndex($i);
    }
}

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
            $drawing->setHeight(55);
            $drawing->setOffsetX(8);
            $drawing->setOffsetY(6);
            $drawing->setWorksheet($sheet);
        } catch (Exception $e) {
        }
    }
}

if ($seqCar > 0) {
    $sheet->setCellValue('N5', 'OC Nº ' . $seqCar);
    $sheet->setCellValue('L8', $seqCar);
}

$sheet->setCellValue('E8', date('d/m/Y'));
$sheet->setCellValue('A8', date('d/m/Y'));
$sheet->setCellValue('D13', $placa);
$sheet->setCellValue('K8', $unidade);
$sheet->setCellValue('M8', trim($unidNome !== '' ? ($unidade . ' - ' . $unidNome) : $unidade));

if ($rotaTxt !== '') {
    $sheet->setCellValue('C29', $rotaTxt);
}

$colsToClear = ['A','B','C','F','H','I','J','K','L','N','O','P'];
$highestRow = (int)$sheet->getHighestRow();
for ($r = 30; $r <= $highestRow; $r++) {
    foreach ($colsToClear as $col) {
        $sheet->setCellValue($col . $r, null);
    }
}

$row = 30;
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
    if ($setor !== '') $sheet->setCellValue('B' . $row, $setor);
    if ($destinatario !== '') $sheet->setCellValue('C' . $row, $destinatario);
    if ($cidade !== '') $sheet->setCellValue('F' . $row, $cidade);
    if ($ctrc !== '') $sheet->setCellValue('H' . $row, $ctrc);
    if ($peso > 0) {
        $sheet->setCellValue('J' . $row, $peso);
        $sheet->setCellValue('K' . $row, $peso);
    }
    if ($cubagem > 0) $sheet->setCellValue('L' . $row, $cubagem);
    if ($volume > 0) $sheet->setCellValue('N' . $row, $volume);
    if ($obs !== '') $sheet->setCellValue('P' . $row, $obs);

    $row++;
    $ord++;
}

$filename = 'ordem_carregamento_' . ($seqCar > 0 ? $seqCar : $placa) . '.xlsx';

header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: max-age=0');

$writer = new Xlsx($spreadsheet);
$writer->save('php://output');
exit;

