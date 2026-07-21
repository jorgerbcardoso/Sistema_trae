<?php

set_time_limit(0);
ini_set('memory_limit', '512M');

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/lib/ssw_loader.php';

setupCORS();
handleOptionsRequest();
requireAuth();

header('Content-Type: application/json; charset=utf-8');

$respondJson = static function(array $payload, int $status = 200): void {
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
};

try {
    require_ssw();
    if (!function_exists('ssw_login') || !function_exists('ssw_go')) {
        throw new Exception('Funções SSW (ssw_login/ssw_go) não disponíveis');
    }

    $domain = $_SERVER['HTTP_X_DOMAIN'] ?? null;
    if (!$domain) {
        $respondJson(['success' => false, 'message' => 'DOMÍNIO NÃO ESPECIFICADO'], 400);
    }

    $dominio = strtoupper((string)$domain);
    ssw_login($dominio);

    $ontemDmy = date('dmy', strtotime('-1 day'));

    $url = 'https://sistema.ssw.inf.br/bin/ssw0103?act=PES'
        . '&cod_emp_ctb=01'
        . '&t_data_ref_ini=010101'
        . '&t_data_ref_fim=' . urlencode($ontemDmy)
        . '&t_tp_fil=C'
        . '&t_tp_cliente=C'
        . '&t_tp_cli_fat=T'
        . '&t_situacao_ctrc=I'
        . '&t_periodicidade=T'
        . '&t_rel_lista=T'
        . '&t_cons_bloqueados=N'
        . '&t_cons_a_vista=N'
        . '&t_tp_classificacao=F'
        . '&t_excel=S'
        . '&t_ler_morto=N';

    $html = ssw_go($url);
    $html = urldecode((string)$html);

    $getActArq = static function(string $html): array {
        $act = function_exists('ssw_get_act') ? ssw_get_act($html) : '';
        $arq = function_exists('ssw_get_arq') ? ssw_get_arq($html) : '';
        $act = trim((string)$act);
        $arq = trim((string)$arq);
        if ($act !== '' && $arq !== '') return [$act, $arq];

        if (preg_match("/ssw0424\\?act=([^&\\s'\\\"]+).*?filename=([^&\\s'\\\"]+)/i", $html, $m)) {
            $a = trim((string)urldecode($m[1]));
            $f = trim((string)urldecode($m[2]));
            if ($a !== '' && $f !== '') return [$a, $f];
        }

        if (preg_match("/act=([^&\\s'\\\"]+).*?filename=([^&\\s'\\\"]+)/i", $html, $m2)) {
            $a = trim((string)urldecode($m2[1]));
            $f = trim((string)urldecode($m2[2]));
            if ($a !== '' && $f !== '') return [$a, $f];
        }

        return ['', ''];
    };

    [$act, $arq] = $getActArq($html);
    if ($act === '' || $arq === '') {
        $preview = mb_substr(preg_replace('/\s+/', ' ', strip_tags($html)), 0, 220, 'UTF-8');
        $respondJson([
            'success' => false,
            'message' => 'Não foi possível localizar o arquivo gerado pelo SSW0103 (act/filename).',
            'debug' => [
                'ontem_dmy' => $ontemDmy,
                'preview' => $preview,
            ],
        ], 500);
    }

    $t0 = microtime(true);
    $csvRaw = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act}&filename={$arq}&path=&down=1&nw=0");
    $t1 = microtime(true);

    if (!$csvRaw || strlen((string)$csvRaw) < 20) {
        $respondJson(['success' => false, 'message' => 'Arquivo CSV do SSW0103 vazio ou inválido.'], 500);
    }

    $csv = mb_convert_encoding((string)$csvRaw, 'UTF-8', 'ISO-8859-1');
    $csv = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $csv);
    $csv = str_replace("\r\n", "\n", str_replace("\r", "\n", $csv));

    $lines = explode("\n", $csv);
    $lines = array_values(array_filter($lines, static fn($l) => trim((string)$l) !== ''));

    $delimiter = ';';
    foreach ($lines as $l) {
        if (strpos($l, ';') !== false) { $delimiter = ';'; break; }
        if (strpos($l, ',') !== false) { $delimiter = ','; break; }
    }

    $header = [];
    $idx = [];
    foreach ($lines as $l) {
        $row = str_getcsv($l, $delimiter);
        if (empty($row)) continue;
        $row[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$row[0]);
        if (trim((string)$row[0]) !== '1') continue;
        $header = $row;
        foreach ($header as $i => $h) {
            $k = trim((string)$h);
            if ($k !== '') $idx[$k] = $i;
        }
        break;
    }

    if (empty($header) || empty($idx)) {
        $respondJson([
            'success' => false,
            'message' => 'Não foi possível localizar o cabeçalho do CSV do SSW0103.',
        ], 500);
    }

    $getCell = static function(array $row, array $idx, string $col): string {
        if (!isset($idx[$col])) return '';
        return trim((string)($row[$idx[$col]] ?? ''));
    };

    $toMoney = static function(string $v): float {
        $s = trim(str_replace("\xC2\xA0", '', $v));
        if ($s === '') return 0.0;
        $s = str_replace('R$', '', $s);
        $s = preg_replace('/\s+/', '', $s);
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
        if (!is_numeric($s)) return 0.0;
        return (float)$s;
    };

    $rowsOut = [];
    $freteTotal = 0.0;
    $updatedAt = null;
    foreach ($lines as $l) {
        $row = str_getcsv($l, $delimiter);
        if (empty($row)) continue;
        $row[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$row[0]);
        $tipo = trim((string)$row[0]);

        if ($tipo === '0' && $updatedAt === null) {
            if (isset($row[6]) && isset($row[7])) {
                $d = trim((string)$row[6]);
                $h = trim((string)$row[7]);
                $updatedAt = trim($d . ' ' . $h);
            }
            continue;
        }

        if ($tipo !== '2') continue;

        $frete = $toMoney($getCell($row, $idx, 'FRETE'));
        $freteTotal += $frete;

        $rowsOut[] = [
            'em' => $getCell($row, $idx, 'EM'),
            'ctrc' => $getCell($row, $idx, 'CTRC'),
            'numero_cte' => $getCell($row, $idx, 'NUMERO CT-e/NFPS'),
            'pagador' => $getCell($row, $idx, 'PAGADOR'),
            'cnpj_pagador' => $getCell($row, $idx, 'CNPJ PAGADOR'),
            'cob' => $getCell($row, $idx, 'COB'),
            'dest' => $getCell($row, $idx, 'DEST'),
            'banco' => $getCell($row, $idx, 'BANCO'),
            'frete' => $frete,
            'emissao' => $getCell($row, $idx, 'EMISSAO'),
            'nfiscal' => $getCell($row, $idx, 'NFISCAL'),
            'tip' => $getCell($row, $idx, 'TIP'),
            'pre_fatu' => $getCell($row, $idx, 'PRE-FATU'),
            'ult_ocor' => $getCell($row, $idx, 'ULT. OCOR'),
            'chave_cte' => $getCell($row, $idx, 'CHAVE CTE'),
            'data_entrega' => $getCell($row, $idx, 'DATA ENTREGA'),
            'prev_entrega' => $getCell($row, $idx, 'PREVISAO DE ENTREGA'),
            'comp_entrega_escaneado' => $getCell($row, $idx, 'COMPROVANTE DE ENTREGA ESCANEADO'),
            'observacao' => $getCell($row, $idx, 'OBSERVACAO'),
        ];
    }

    $respondJson([
        'success' => true,
        'meta' => [
            'programa' => 'ssw0103',
            'ontem_dmy' => $ontemDmy,
            'act' => $act,
            'filename' => $arq,
            'updated_at' => $updatedAt,
            'gerado_em' => date('c'),
            'timing_ms' => [
                'download' => (int)round(($t1 - $t0) * 1000),
            ],
            'size_bytes' => [
                'csv' => strlen($csv),
            ],
        ],
        'totals' => [
            'ctes' => count($rowsOut),
            'frete_total' => round($freteTotal, 2),
        ],
        'rows' => $rowsOut,
    ]);
} catch (Throwable $e) {
    $respondJson(['success' => false, 'message' => $e->getMessage()], 500);
}

