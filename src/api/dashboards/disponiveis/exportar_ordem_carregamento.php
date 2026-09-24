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
$mapImage = (string)($input['map_image'] ?? '');
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
$tblCte = "{$domain}_cte";
$tblEmpParam = "{$domain}_emp_param";

@pg_query($conn, "ALTER TABLE {$tblCar} ADD COLUMN IF NOT EXISTS ordem INT");

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

$ocorAgendamento = null;
try {
    $resParam = sql("SELECT ocor_agendamento FROM {$tblEmpParam} LIMIT 1", [], $conn);
    if ($resParam && pg_num_rows($resParam) > 0) {
        $rp = pg_fetch_assoc($resParam);
        if (($rp['ocor_agendamento'] ?? null) !== null && ($rp['ocor_agendamento'] ?? '') !== '') {
            $ocorAgendamento = (int)$rp['ocor_agendamento'];
        }
    }
} catch (Exception $e) {
    $ocorAgendamento = null;
}

$primeiraNf = function($nfs) {
    $raw = trim((string)$nfs);
    if ($raw === '') return '';
    $first = trim(explode(',', $raw)[0] ?? '');
    if ($first === '') return '';
    $parts = array_values(array_filter(array_map('trim', explode('/', $first)), function($x) { return $x !== ''; }));
    return count($parts) >= 2 ? $parts[1] : $parts[0];
};

$fmtDdMmYy = function($v) {
    $s = trim((string)$v);
    if ($s === '') return '';
    if (preg_match('/^(\d{4})-(\d{2})-(\d{2})/', $s, $m)) {
        return $m[3] . '/' . $m[2] . '/' . substr($m[1], -2);
    }
    if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $s, $m)) {
        return $m[1] . '/' . $m[2] . '/' . substr($m[3], -2);
    }
    return $s;
};

$linhasDb = [];
try {
    $qLinhas = "
        SELECT
            car.ordem,
            car.ser_cte,
            car.nro_cte,
            UPPER(COALESCE(NULLIF(car.destino_cte, ''), NULLIF(car.destino, ''))) AS destino_cte,
            COALESCE(cte.nome_dest, car.destinatario_cte, '') AS destinatario,
            COALESCE(cid.nome, '') AS cidade_entrega,
            COALESCE(cid.uf, '') AS uf_entrega,
            COALESCE(cte.nfs, '') AS nfs,
            COALESCE(cte.data_prev_ent::text, car.data_prev_ent_cte::text, '') AS data_prev_ent,
            COALESCE(cte.ult_ocor_agend, 0) AS ult_ocor_agend,
            COALESCE(cte.peso_real, 0) AS peso_real,
            COALESCE(cte.peso_calc, 0) AS peso_calc,
            COALESCE(cte.cubagem, car.cubagem_cte, 0) AS cubagem,
            COALESCE(cte.qtde_vol, car.qtde_vol_cte, 0) AS qtde_vol,
            COALESCE(cte.cep_entrega::text, '') AS cep_entrega,
            COALESCE(cte.endereco_entrega, '') AS endereco_entrega,
            COALESCE(cte.bairro_entrega, '') AS bairro_entrega
        FROM {$tblCar} car
        LEFT JOIN {$tblCte} cte
               ON cte.ser_cte = car.ser_cte
              AND cte.nro_cte = car.nro_cte
        LEFT JOIN cidade cid
               ON cid.seq_cidade = cte.seq_cidade_entr
        WHERE car.unidade = $1
          AND UPPER(car.placa_provisoria) = UPPER($2)
          AND car.data_finalizacao IS NULL
          AND (car.nro_cte::text ~ '^[0-9]+$' AND (car.nro_cte::text)::int > 0)
        ORDER BY
          CASE WHEN car.ordem IS NULL OR car.ordem <= 0 THEN 999999 ELSE car.ordem END,
          car.data_inclusao,
          car.hora_inclusao
    ";
    $resL = sql($qLinhas, [$unidade, $placa], $conn);
    $idx = 1;
    while ($resL && ($r = pg_fetch_assoc($resL))) {
        $destCte = strtoupper(trim((string)($r['destino_cte'] ?? '')));
        $ordem = (int)($r['ordem'] ?? 0);
        if ($ordem <= 0) $ordem = $idx;
        $idx++;

        $isEntrega = ($destCte !== '' && $destCte === $unidade);
        $setor = '';
        if ($isEntrega) {
            $setor = strtoupper(trim((string)($r['bairro_entrega'] ?? '')));
            if ($setor === '') $setor = $destCte;
        } else {
            $setor = $destCte;
        }

        $endLinha2 = '';
        if ($isEntrega) {
            $endereco = trim((string)($r['endereco_entrega'] ?? ''));
            $bairro = trim((string)($r['bairro_entrega'] ?? ''));
            $cep = trim((string)($r['cep_entrega'] ?? ''));
            $street = $endereco;
            if ($bairro !== '') $street = $street !== '' ? ($street . ', ' . $bairro) : $bairro;
            $endLinha2 = implode(' · ', array_values(array_filter([$street, $cep], function($v) { return trim((string)$v) !== ''; })));
        }

        $ultOcorAgend = (int)($r['ult_ocor_agend'] ?? 0);
        $agendado = ($ocorAgendamento !== null && $ultOcorAgend === (int)$ocorAgendamento);
        $agendaTxt = $agendado ? $fmtDdMmYy($r['data_prev_ent'] ?? '') : '';

        $linhasDb[] = [
            'ordem' => $ordem,
            'op' => $isEntrega ? 'E' : 'T',
            'destino_cte' => $destCte,
            'setor' => $setor,
            'destinatario' => trim((string)($r['destinatario'] ?? '')),
            'end_linha2' => $endLinha2,
            'cidade' => trim((string)($r['cidade_entrega'] ?? '')),
            'nf' => $primeiraNf($r['nfs'] ?? ''),
            'agenda' => $agendaTxt,
            'agenda_bold' => $agendado,
            'kg_real' => (float)($r['peso_real'] ?? 0),
            'kg_calc' => (float)($r['peso_calc'] ?? 0),
            'cubagem' => (float)($r['cubagem'] ?? 0),
            'qtde_vol' => (int)($r['qtde_vol'] ?? 0),
            'obs' => '',
        ];
    }
} catch (Exception $e) {
    $linhasDb = [];
}

if (is_array($linhasDb)) {
    $linhas = $linhasDb;
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
    'A' => 7,
    'B' => 12,
    'C' => 42,
    'D' => 20,
    'E' => 14,
    'F' => 12,
    'G' => 12,
    'H' => 12,
    'I' => 12,
    'J' => 10,
    'K' => 11,
    'L' => 24,
];
foreach ($colWidths as $col => $w) {
    $sheet->getColumnDimension($col)->setWidth($w);
}

$darkBlue = '1F4E79';
$darkBlue2 = '17365D';
$lightBlue = 'D9E2F3';
$inputBg = 'FFF2CC';
$bgEntrega = 'E2F0D9';
$bgTransferencia = 'EDE9FE';
$bgFec = 'FFEAD5';
$gridBorder = 'A6A6A6';

$sheet->getRowDimension(1)->setRowHeight(24);
$sheet->getRowDimension(2)->setRowHeight(18);
$sheet->getRowDimension(3)->setRowHeight(16);
$sheet->getRowDimension(4)->setRowHeight(18);

$styleDarkBar = [
    'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $darkBlue]],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
];
$styleDarkBarCenter = [
    'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => 'FFFFFF']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $darkBlue]],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
];
$styleDarkBarRight = [
    'font' => ['bold' => true, 'size' => 10, 'color' => ['rgb' => 'FFFFFF']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $darkBlue2]],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT, 'vertical' => Alignment::VERTICAL_CENTER],
];
$styleLabel = [
    'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => '000000']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $lightBlue]],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
];
$styleValue = [
    'font' => ['size' => 9, 'color' => ['rgb' => '000000']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $inputBg]],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
];
$styleGrid = [
    'borders' => [
        'allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $gridBorder]],
    ],
];

$sheet->mergeCells('C1:L2');
$sheet->setCellValue('C1', 'ORDEM DE CARREGAMENTO');
$sheet->getStyle('C1:L2')->applyFromArray([
    'font' => ['bold' => true, 'size' => 14, 'color' => ['rgb' => '000000']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
]);

$sheet->getStyle('A1:L3')->applyFromArray($styleGrid);

$sheet->mergeCells('A4:J4');
$sheet->mergeCells('K4:L4');
$sheet->setCellValue('A4', '');
$sheet->setCellValue('K4', $seqCar > 0 ? ('OC Nº ' . $seqCar) : 'OC Nº');
$sheet->getStyle('A4:J4')->applyFromArray($styleDarkBar);
$sheet->getStyle('K4:L4')->applyFromArray($styleDarkBarRight);

$sheet->mergeCells('A5:C5');
$sheet->mergeCells('D5:F5');
$sheet->mergeCells('G5:H5');
$sheet->mergeCells('K5:L5');
$sheet->setCellValue('A5', 'DATA DA EMISSÃO');
$sheet->setCellValue('D5', 'DATA DO CARREGAMENTO');
$sheet->setCellValue('G5', 'TIPO DE OPERAÇÃO');
$sheet->setCellValue('I5', 'SIGLA');
$sheet->setCellValue('J5', 'Nº:');
$sheet->setCellValue('K5', 'UNIDADE / CD');
$sheet->getStyle('A5:L5')->applyFromArray($styleLabel);

$sheet->mergeCells('A6:C6');
$sheet->mergeCells('D6:F6');
$sheet->mergeCells('G6:H6');
$sheet->mergeCells('K6:L6');
$sheet->setCellValue('A6', '');
$sheet->setCellValue('D6', date('d/m/Y'));
$sheet->setCellValue('G6', 'ENTREGA');
$sheet->setCellValue('I6', $unidade);
$sheet->setCellValue('J6', $seqCar > 0 ? $seqCar : '');
$sheet->setCellValue('K6', trim($unidNome !== '' ? ($unidade . ' - ' . $unidNome) : $unidade));
$sheet->getStyle('A6:L6')->applyFromArray($styleValue);

$sheet->getStyle('A5:L6')->applyFromArray($styleGrid);

$sheet->mergeCells('A7:L7');
$sheet->setCellValue('A7', 'DADOS DO VEÍCULO E MOTORISTA');
$sheet->getStyle('A7:L7')->applyFromArray($styleDarkBar);

$sheet->mergeCells('A8:F8');
$sheet->mergeCells('G8:H8');
$sheet->mergeCells('I8:L8');
$sheet->setCellValue('A8', 'MOTORISTA');
$sheet->setCellValue('G8', 'CPF');
$sheet->setCellValue('I8', 'TELEFONE / CONTATO');
$sheet->getStyle('A8:L8')->applyFromArray($styleLabel);

$sheet->mergeCells('A9:F9');
$sheet->mergeCells('G9:H9');
$sheet->mergeCells('I9:L9');
$sheet->setCellValue('A9', '');
$sheet->setCellValue('G9', '');
$sheet->setCellValue('I9', '');
$sheet->getStyle('A9:L9')->applyFromArray($styleValue);

$sheet->mergeCells('A10:B10');
$sheet->mergeCells('C10:D10');
$sheet->mergeCells('E10:F10');
$sheet->mergeCells('G10:H10');
$sheet->mergeCells('I10:J10');
$sheet->mergeCells('K10:L10');
$sheet->setCellValue('A10', 'PLACA CAVALO');
$sheet->setCellValue('C10', 'PLACA CARRETA');
$sheet->setCellValue('E10', 'TIPO DE VEÍCULO');
$sheet->setCellValue('G10', 'CUBAGEM VEÍCULO');
$sheet->setCellValue('I10', 'QTD. PALLETS');
$sheet->setCellValue('K10', 'VÍNCULO');
$sheet->getStyle('A10:L10')->applyFromArray($styleLabel);

$sheet->mergeCells('A11:B11');
$sheet->mergeCells('C11:D11');
$sheet->mergeCells('E11:F11');
$sheet->mergeCells('G11:H11');
$sheet->mergeCells('I11:J11');
$sheet->mergeCells('K11:L11');
$sheet->setCellValue('A11', '');
$sheet->setCellValue('C11', $placa);
$sheet->setCellValue('E11', '');
$sheet->setCellValue('G11', '');
$sheet->setCellValue('I11', '');
$sheet->setCellValue('K11', '');
$sheet->getStyle('A11:L11')->applyFromArray($styleValue);

$sheet->getStyle('A7:L11')->applyFromArray($styleGrid);

$sheet->mergeCells('A12:L12');
$sheet->setCellValue('A12', 'DADOS DO CARREGAMENTO');
$sheet->getStyle('A12:L12')->applyFromArray($styleDarkBar);

$sheet->mergeCells('A13:C13');
$sheet->mergeCells('D13:F13');
$sheet->mergeCells('G13:H13');
$sheet->mergeCells('I13:J13');
$sheet->setCellValue('A13', 'CONFERENTE RESPONSÁVEL');
$sheet->setCellValue('D13', 'AJUDANTES');
$sheet->setCellValue('G13', 'DOCA');
$sheet->setCellValue('I13', 'TURNO');
$sheet->setCellValue('K13', 'HORA INÍCIO');
$sheet->setCellValue('L13', 'HORA FIM');
$sheet->getStyle('A13:L13')->applyFromArray($styleLabel);

$sheet->mergeCells('A14:C14');
$sheet->mergeCells('D14:F14');
$sheet->mergeCells('G14:H14');
$sheet->mergeCells('I14:J14');
$sheet->setCellValue('A14', '');
$sheet->setCellValue('D14', '');
$sheet->setCellValue('G14', '');
$sheet->setCellValue('I14', '');
$sheet->setCellValue('K14', '');
$sheet->setCellValue('L14', '');
$sheet->getStyle('A14:L14')->applyFromArray($styleValue);

$sheet->mergeCells('A15:C15');
$sheet->mergeCells('D15:F15');
$sheet->mergeCells('G15:L15');
$sheet->setCellValue('A15', 'QTD. VOLUMES CARREGADOS');
$sheet->setCellValue('D15', 'QTD TOTAL DE PALETES');
$sheet->setCellValue('G15', 'TIPO DE CARGA');
$sheet->getStyle('A15:L15')->applyFromArray($styleLabel);

$sheet->mergeCells('A16:C16');
$sheet->mergeCells('D16:F16');
$sheet->mergeCells('G16:L16');
$sheet->setCellValue('A16', '');
$sheet->setCellValue('D16', '');
$sheet->setCellValue('G16', '☐ BATIDA     ☐ PALETIZADA     ☐ MISTA');
$sheet->getStyle('A16:L16')->applyFromArray($styleValue);
$sheet->getStyle('G16')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

$sheet->getStyle('A12:L16')->applyFromArray($styleGrid);

$sheet->mergeCells('A17:L17');
$sheet->setCellValue('A17', 'CHECKLIST DE CARREGAMENTO');
$sheet->getStyle('A17:L17')->applyFromArray($styleDarkBarCenter);

$sheet->setCellValue('A18', '☐ Documentação da carga conferida');
$sheet->setCellValue('E18', '☐ Quantidade de paletes conferida');
$sheet->setCellValue('I18', '☐ Lacre do veículo aplicado');
$sheet->setCellValue('A19', '☐ Notas fiscais conferidas');
$sheet->setCellValue('E19', '☐ Tipo de carga correto (batida/paletizada)');
$sheet->setCellValue('I19', '☐ Veículo limpo e em condições');
$sheet->setCellValue('A20', '☐ Quantidade de volumes conferida');
$sheet->setCellValue('E20', '☐ Doca correta utilizada');
$sheet->setCellValue('I20', '☐ Hora de saída registrada');
$sheet->mergeCells('A18:D18');
$sheet->mergeCells('E18:H18');
$sheet->mergeCells('I18:L18');
$sheet->mergeCells('A19:D19');
$sheet->mergeCells('E19:H19');
$sheet->mergeCells('I19:L19');
$sheet->mergeCells('A20:D20');
$sheet->mergeCells('E20:H20');
$sheet->mergeCells('I20:L20');
$sheet->getStyle('A18:L20')->applyFromArray([
    'font' => ['size' => 9, 'color' => ['rgb' => '000000']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
]);

$sheet->mergeCells('A21:D21');
$sheet->mergeCells('E21:L21');
$sheet->setCellValue('A21', 'NÚMERO DO LACRE:');
$sheet->setCellValue('E21', '');
$sheet->getStyle('A21:D21')->applyFromArray($styleLabel);
$sheet->getStyle('E21:L21')->applyFromArray($styleValue);

$sheet->getStyle('A17:L21')->applyFromArray($styleGrid);

$totalCtrcs = count($linhas);
$totalVolumes = 0;
$totalPesoReal = 0.0;
$totalPesoCalc = 0.0;
$totalCubagem = 0.0;
foreach ($linhas as $it) {
    if (!is_array($it)) continue;
    $totalVolumes += (int)($it['qtde_vol'] ?? $it['qtdeVol'] ?? $it['volume'] ?? 0);
    $totalPesoReal += (float)($it['kg_real'] ?? $it['peso_real'] ?? $it['pesoReal'] ?? $it['peso'] ?? 0);
    $totalPesoCalc += (float)($it['kg_calc'] ?? $it['peso_calc'] ?? $it['pesoCalc'] ?? 0);
    $totalCubagem += (float)($it['cubagem'] ?? 0);
}

$sheet->setCellValue('A16', $totalVolumes > 0 ? $totalVolumes : '');

$sheet->mergeCells('A22:L22');
$sheet->setCellValue('A22', 'RESUMO DA CARGA');
$sheet->getStyle('A22:L22')->applyFromArray($styleDarkBar);

$sheet->mergeCells('A23:B23');
$sheet->mergeCells('C23:D23');
$sheet->mergeCells('E23:F23');
$sheet->mergeCells('G23:H23');
$sheet->mergeCells('I23:L23');
$sheet->setCellValue('A23', 'TOTAL DE CTRCs');
$sheet->setCellValue('C23', 'TOTAL DE VOLUMES');
$sheet->setCellValue('E23', 'TOTAL PESO REAL');
$sheet->setCellValue('G23', 'TOTAL CUBAGEM (m³)');
$sheet->setCellValue('I23', 'TOTAL PESO CALC');
$sheet->getStyle('A23:L23')->applyFromArray($styleLabel);
$sheet->getStyle('A23:L23')->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

$sheet->mergeCells('A24:B24');
$sheet->mergeCells('C24:D24');
$sheet->mergeCells('E24:F24');
$sheet->mergeCells('G24:H24');
$sheet->mergeCells('I24:L24');
$sheet->setCellValue('A24', $totalCtrcs > 0 ? $totalCtrcs : '');
$sheet->setCellValue('C24', $totalVolumes > 0 ? $totalVolumes : '');
$sheet->setCellValue('E24', $totalPesoReal > 0 ? $totalPesoReal : '');
$sheet->setCellValue('G24', $totalCubagem > 0 ? $totalCubagem : '');
$sheet->setCellValue('I24', $totalPesoCalc > 0 ? $totalPesoCalc : '');
$sheet->getStyle('A24:L24')->applyFromArray([
    'font' => ['bold' => true, 'size' => 12, 'color' => ['rgb' => '0B2F5B']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER],
]);
$sheet->getStyle('E24')->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_00);
$sheet->getStyle('G24')->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_00);
$sheet->getStyle('I24')->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_00);

$sheet->getStyle('A22:L24')->applyFromArray($styleGrid);

$sheet->mergeCells('A25:L25');
$sheet->setCellValue('A25', 'NOTAS FISCAIS / ITENS CARREGADOS');
$sheet->getStyle('A25:L25')->applyFromArray($styleDarkBar);

$headerRow = 26;
$dataRowStart = 27;
$dataRowsCount = max(count($linhas), 1);
$totalRow = $dataRowStart + $dataRowsCount;
$maxTableRows = max($dataRowsCount + 1 + 8, 20);
$lastRow = $dataRowStart + $maxTableRows - 1;

$tableHeaderStyle = [
    'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => 'FFFFFF']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $darkBlue2]],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => 'FFFFFF']]],
];

$sheet->setCellValue('A' . $headerRow, 'Ord.');
$sheet->setCellValue('B' . $headerRow, 'Setor');
$sheet->setCellValue('C' . $headerRow, 'Destinatário');
$sheet->setCellValue('D' . $headerRow, 'Cidade');
$sheet->setCellValue('E' . $headerRow, 'NF');
$sheet->setCellValue('F' . $headerRow, 'Agenda');
$sheet->setCellValue('G' . $headerRow, 'Kg Real');
$sheet->setCellValue('H' . $headerRow, 'Kg Calc.');
$sheet->setCellValue('I' . $headerRow, 'Cub. m³');
$sheet->setCellValue('J' . $headerRow, 'Qt. Vol.');
$sheet->setCellValue('K' . $headerRow, 'Pallets');
$sheet->setCellValue('L' . $headerRow, 'Observações');
$sheet->getStyle('A' . $headerRow . ':L' . $headerRow)->applyFromArray($tableHeaderStyle);
$sheet->getRowDimension($headerRow)->setRowHeight(20);

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
            $drawing->setHeight(52);
            $drawing->setOffsetX(8);
            $drawing->setOffsetY(6);
            $drawing->setWorksheet($sheet);
        } catch (Exception $e) {
        }
    }
}

$logoPrestoUrl = 'https://webpresto.com.br/images/logo_rel.png';
if ($logoPrestoUrl !== '') {
    $tmpFile = null;
    try {
        $imgBin = @file_get_contents($logoPrestoUrl);
        if ($imgBin !== false && $imgBin !== '') {
            $tmpFile = tempnam(sys_get_temp_dir(), 'presto_logo_rel_');
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
            $drawing->setName('Logo Presto');
            $drawing->setPath($tmpFile);
            $drawing->setCoordinates('K1');
            $drawing->setHeight(40);
            $drawing->setOffsetX(10);
            $drawing->setOffsetY(10);
            $drawing->setWorksheet($sheet);
        } catch (Exception $e) {
        }
    }
}

$row = $dataRowStart;
$agendaRows = [];
$totReal = 0.0;
$totCalc = 0.0;
$totCub = 0.0;
$totVol = 0;
foreach ($linhas as $item) {
    if (!is_array($item)) continue;
    if ($row >= $totalRow) break;
    $ordem = (int)($item['ordem'] ?? 0);
    $op = strtoupper(trim((string)($item['op'] ?? '')));
    $destinoCte = strtoupper(trim((string)($item['destino_cte'] ?? '')));
    $setor = strtoupper(trim((string)($item['setor'] ?? '')));
    $destinatario = trim((string)($item['destinatario'] ?? ''));
    $endLinha2 = trim((string)($item['end_linha2'] ?? ''));
    $cidade = trim((string)($item['cidade'] ?? ''));
    $nf = trim((string)($item['nf'] ?? ''));
    $agenda = trim((string)($item['agenda'] ?? ''));
    $agBold = (bool)($item['agenda_bold'] ?? false);
    $kgReal = (float)($item['kg_real'] ?? 0);
    $kgCalc = (float)($item['kg_calc'] ?? 0);
    $cubagem = (float)($item['cubagem'] ?? 0);
    $qtVol = (int)($item['qtde_vol'] ?? 0);
    $obs = trim((string)($item['obs'] ?? ''));

    if ($kgReal > 0) $totReal += $kgReal;
    if ($kgCalc > 0) $totCalc += $kgCalc;
    if ($cubagem > 0) $totCub += $cubagem;
    if ($qtVol > 0) $totVol += $qtVol;

    $sheet->setCellValue('A' . $row, $ordem > 0 ? $ordem : '');
    $sheet->setCellValue('B' . $row, $setor);
    $sheet->setCellValue('C' . $row, $destinatario . "\n" . $endLinha2);
    $sheet->setCellValue('D' . $row, $cidade);
    $sheet->setCellValue('E' . $row, $nf);
    $sheet->setCellValue('F' . $row, $agenda);
    $sheet->setCellValue('G' . $row, $kgReal > 0 ? $kgReal : '');
    $sheet->setCellValue('H' . $row, $kgCalc > 0 ? $kgCalc : '');
    $sheet->setCellValue('I' . $row, $cubagem > 0 ? $cubagem : '');
    $sheet->setCellValue('J' . $row, $qtVol > 0 ? $qtVol : '');
    $sheet->setCellValue('K' . $row, '');
    $sheet->setCellValue('L' . $row, $obs);
    if ($agBold && $agenda !== '') $agendaRows[] = $row;
    $sheet->getStyle('A' . $row . ':L' . $row)->applyFromArray([
        'fill' => [
            'fillType' => Fill::FILL_SOLID,
            'startColor' => ['rgb' => ($destinoCte === 'FEC' ? $bgFec : ($op === 'E' ? $bgEntrega : $bgTransferencia))],
        ],
    ]);
    $sheet->getRowDimension($row)->setRowHeight(30);

    $row++;
}

$tableCellStyle = [
    'font' => ['size' => 9, 'color' => ['rgb' => '000000']],
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $gridBorder]]],
    'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
];
$sheet->getStyle('A' . $dataRowStart . ':L' . $lastRow)->applyFromArray($tableCellStyle);
$sheet->getStyle('A' . $dataRowStart . ':A' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
$sheet->getStyle('B' . $dataRowStart . ':B' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
$sheet->getStyle('C' . $dataRowStart . ':C' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setVertical(Alignment::VERTICAL_TOP)->setWrapText(true);
$sheet->getStyle('D' . $dataRowStart . ':D' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setWrapText(true);
$sheet->getStyle('E' . $dataRowStart . ':F' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);
$sheet->getStyle('G' . $dataRowStart . ':I' . $lastRow)->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_00);
$sheet->getStyle('J' . $dataRowStart . ':J' . $lastRow)->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER);
$sheet->getStyle('G' . $dataRowStart . ':K' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
$sheet->getStyle('L' . $dataRowStart . ':L' . $lastRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT)->setWrapText(true);

$sheet->setCellValue('C' . $totalRow, 'Total');
$sheet->setCellValue('G' . $totalRow, $totReal > 0 ? $totReal : '');
$sheet->setCellValue('H' . $totalRow, $totCalc > 0 ? $totCalc : '');
$sheet->setCellValue('I' . $totalRow, $totCub > 0 ? $totCub : '');
$sheet->setCellValue('J' . $totalRow, $totVol > 0 ? $totVol : '');
$sheet->getStyle('A' . $totalRow . ':L' . $totalRow)->applyFromArray([
    'font' => ['bold' => true, 'size' => 9, 'color' => ['rgb' => '000000']],
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $lightBlue]],
    'alignment' => ['vertical' => Alignment::VERTICAL_CENTER],
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $gridBorder]]],
]);
$sheet->getStyle('C' . $totalRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_LEFT);
$sheet->getStyle('G' . $totalRow . ':J' . $totalRow)->getAlignment()->setHorizontal(Alignment::HORIZONTAL_RIGHT);
$sheet->getStyle('G' . $totalRow . ':I' . $totalRow)->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER_00);
$sheet->getStyle('J' . $totalRow)->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_NUMBER);

foreach ($agendaRows as $r) {
    $sheet->getStyle('F' . $r)->getFont()->setBold(true);
}

$afterTableRow = $lastRow + 2;

$sheet->mergeCells('A' . $afterTableRow . ':L' . $afterTableRow);
$sheet->setCellValue('A' . $afterTableRow, 'OBSERVAÇÕES GERAIS / OCORRÊNCIAS');
$sheet->getStyle('A' . $afterTableRow . ':L' . $afterTableRow)->applyFromArray($styleDarkBar);

$obsRowStart = $afterTableRow + 1;
$obsRowEnd = $obsRowStart + 6;
$sheet->mergeCells('A' . $obsRowStart . ':L' . $obsRowEnd);
$sheet->setCellValue('A' . $obsRowStart, '');
$sheet->getStyle('A' . $obsRowStart . ':L' . $obsRowEnd)->applyFromArray([
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $inputBg]],
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $gridBorder]]],
]);

$confRow = $obsRowEnd + 2;
$sheet->mergeCells('A' . $confRow . ':L' . $confRow);
$sheet->setCellValue('A' . $confRow, 'CONFERÊNCIA E RESPONSÁVEIS');
$sheet->getStyle('A' . $confRow . ':L' . $confRow)->applyFromArray($styleDarkBar);

$sheet->mergeCells('A' . ($confRow + 1) . ':F' . ($confRow + 1));
$sheet->mergeCells('G' . ($confRow + 1) . ':L' . ($confRow + 1));
$sheet->setCellValue('A' . ($confRow + 1), 'CONFERENTE');
$sheet->setCellValue('G' . ($confRow + 1), 'LÍDER OPERACIONAL');
$sheet->getStyle('A' . ($confRow + 1) . ':L' . ($confRow + 1))->applyFromArray($styleLabel);
$sheet->getStyle('A' . ($confRow + 1) . ':L' . ($confRow + 1))->getAlignment()->setHorizontal(Alignment::HORIZONTAL_CENTER);

$sigStart = $confRow + 2;
$sigEnd = $sigStart + 2;
$sheet->mergeCells('A' . $sigStart . ':F' . $sigEnd);
$sheet->mergeCells('G' . $sigStart . ':L' . $sigEnd);
$sheet->setCellValue('A' . $sigStart, '');
$sheet->setCellValue('G' . $sigStart, '');
$sheet->getStyle('A' . $sigStart . ':L' . $sigEnd)->applyFromArray([
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $inputBg]],
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $gridBorder]]],
]);

$dtRow = $sigEnd + 1;
$sheet->mergeCells('A' . $dtRow . ':F' . $dtRow);
$sheet->mergeCells('G' . $dtRow . ':L' . $dtRow);
$sheet->setCellValue('A' . $dtRow, 'DATA: ____/____/______    HORA: ______');
$sheet->setCellValue('G' . $dtRow, 'DATA: ____/____/______    HORA: ______');
$sheet->getStyle('A' . $dtRow . ':L' . $dtRow)->applyFromArray([
    'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => 'E2F0D9']],
    'font' => ['bold' => false, 'size' => 10, 'color' => ['rgb' => '000000']],
    'alignment' => ['horizontal' => Alignment::HORIZONTAL_LEFT, 'vertical' => Alignment::VERTICAL_CENTER],
    'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['rgb' => $gridBorder]]],
]);

$finalRow = $dtRow + 1;

$sheet->getPageSetup()->setFitToWidth(1)->setFitToHeight(0);
$sheet->getPageMargins()->setTop(0.5)->setBottom(0.5)->setLeft(0.35)->setRight(0.35);
$sheet->getPageSetup()->setPrintArea('A1:L' . $finalRow);

$mapImage = trim((string)$mapImage);
if ($mapImage !== '') {
    $data = $mapImage;
    if (stripos($data, 'base64,') !== false) {
        $data = substr($data, strpos($data, 'base64,') + 7);
    }
    $bin = base64_decode($data, true);
    if ($bin !== false && $bin !== '') {
        $tmp = tempnam(sys_get_temp_dir(), 'presto_map_');
        $tmpPng = $tmp ? ($tmp . '.png') : null;
        if ($tmpPng) {
            @file_put_contents($tmpPng, $bin);
            if (is_file($tmpPng) && filesize($tmpPng) > 1000) {
                try {
                    $sheet2 = $spreadsheet->createSheet();
                    $sheet2->setTitle('Rota');
                    $sheet2->getDefaultRowDimension()->setRowHeight(16);
                    $sheet2->getColumnDimension('A')->setWidth(18);
                    $sheet2->getColumnDimension('B')->setWidth(18);
                    $sheet2->getColumnDimension('C')->setWidth(18);
                    $sheet2->getColumnDimension('D')->setWidth(18);
                    $sheet2->getColumnDimension('E')->setWidth(18);
                    $sheet2->getColumnDimension('F')->setWidth(18);
                    $sheet2->mergeCells('A1:F1');
                    $sheet2->setCellValue('A1', 'ROTA');
                    $sheet2->getStyle('A1:F1')->applyFromArray($styleDarkBarCenter);
                    $sheet2->mergeCells('A2:F2');
                    $sheet2->setCellValue('A2', $rotaTxt);
                    $sheet2->getStyle('A2:F2')->applyFromArray($styleValue);

                    $drawing = new Drawing();
                    $drawing->setName('Mapa Rota');
                    $drawing->setPath($tmpPng);
                    $drawing->setCoordinates('A4');
                    $drawing->setHeight(430);
                    $drawing->setOffsetX(5);
                    $drawing->setOffsetY(5);
                    $drawing->setWorksheet($sheet2);

                    $sheet2->getPageSetup()->setFitToWidth(1)->setFitToHeight(0);
                    $sheet2->getPageMargins()->setTop(0.5)->setBottom(0.5)->setLeft(0.35)->setRight(0.35);
                    $sheet2->getPageSetup()->setPrintArea('A1:F32');
                } catch (Exception $e) {
                }
            }
        }
    }
}

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
