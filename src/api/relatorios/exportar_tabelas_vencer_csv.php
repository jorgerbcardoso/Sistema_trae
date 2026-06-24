<?php
/**
 * ============================================
 * API: Exportar Tabelas a Vencer (CSV)
 * ============================================
 * Gera arquivo CSV com tabelas a vencer
 * Muito mais leve que Excel (sem PhpSpreadsheet)
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
    // 4. Buscar dados no SSW (Programa 0169) - CSV
    // ============================================
    $dataInicioParam = $_GET['data_inicio'] ?? null;
    $dataFimParam = $_GET['data_fim'] ?? null;
    $unidadeParam = $_GET['unidade'] ?? '';

    // Parâmetros:
    // - f6: unidade (sigla)
    // - f7: data início (DDMMYY)
    // - f8: data fim (DDMMYY)
    
    // Formatar datas para o padrão SSW (DDMMYY)
    $dataInicio = $dataInicioParam ? date('dmy', strtotime($dataInicioParam)) : date('dmy');
    $dataFim = $dataFimParam ? date('dmy', strtotime($dataFimParam)) : date('dmy', strtotime('last day of this month'));
    
    // Unidade (se informada)
    $paramUnidade = $unidadeParam ? "&f6=" . urlencode(strtoupper($unidadeParam)) : "";
    
    $param = "?act=PER&t_tp_geracao=S{$paramUnidade}&f7={$dataInicio}&f8={$dataFim}";
    $str = ssw_go("https://sistema.ssw.inf.br/bin/ssw0169$param");

    $strDec = urldecode((string)$str);
    $act = function_exists('ssw_get_act') ? ssw_get_act($strDec) : null;
    $arq = function_exists('ssw_get_arq') ? ssw_get_arq($strDec) : null;

    $csvFile = null;
    if (!empty($act) && !empty($arq)) {
        $csvFile = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act}&filename={$arq}&path=&down=1&nw=1");
    } else {
        $csvFile = $strDec;
    }

    if (empty($csvFile) || strlen((string)$csvFile) < 20) {
        msg('Arquivo CSV do SSW (0169) vazio ou inválido.', 'error', 500);
    }

    $csvFile = mb_convert_encoding((string)$csvFile, 'UTF-8', 'ISO-8859-1');
    $csvFile = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $csvFile);
    $csvFile = str_replace("\r\n", "\n", str_replace("\r", "\n", $csvFile));
    $linhas = explode("\n", $csvFile);

    $normKey = static function(string $s): string {
        return preg_replace('/[^A-Z0-9]/', '', strtoupper(trim($s)));
    };
    $headerLine = null;
    foreach ($linhas as $l) {
        $t = trim((string)$l);
        if ($t === '') continue;
        if (strpos($t, ';') !== false && stripos($t, 'CNPJ') !== false && stripos($t, 'Vigencia') !== false) {
            $headerLine = $t;
            break;
        }
    }
    if ($headerLine === null) {
        msg('Não foi possível localizar o cabeçalho do CSV (SSW 0169).', 'error', 500);
    }

    $header = str_getcsv($headerLine, ';');
    if (!empty($header)) {
        $header[0] = preg_replace('/^\xEF\xBB\xBF/u', '', (string)$header[0]);
    }
    $idx = [];
    foreach ($header as $i => $h) {
        $k = $normKey((string)$h);
        if ($k !== '') $idx[$k] = $i;
    }

    $getCell = static function(array $row, array $idx, array $candidates) use ($normKey): string {
        foreach ($candidates as $c) {
            $k = $normKey($c);
            if (isset($idx[$k])) return trim((string)($row[$idx[$k]] ?? ''));
        }
        return '';
    };
    $parseCnpj = static function(string $v): string {
        $v = trim(str_replace("\xC2\xA0", '', $v));
        $v = preg_replace('/\D+/', '', $v);
        if ($v === '') return '';
        return substr($v, 0, 14);
    };
    $parseVendedorLogin = static function(string $v): string {
        $v = trim($v);
        if ($v === '') return '';
        $v = preg_replace('/\s+/', ' ', $v);
        if (strpos($v, '-') !== false) {
            $v = trim(explode('-', $v, 2)[0]);
        }
        if (strpos($v, ' ') !== false) {
            $v = trim(explode(' ', $v, 2)[0]);
        }
        return trim($v);
    };
    $toTipo = static function(string $v): string {
        $v = trim($v);
        if ($v === '') return '';
        $v = mb_strtolower($v, 'UTF-8');
        return mb_strtoupper(mb_substr($v, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($v, 1, null, 'UTF-8');
    };

    $dadosBase = [];
    $cnpjs = [];
    $started = false;
    foreach ($linhas as $l) {
        $t = trim((string)$l);
        if ($t === '') continue;
        if (!$started) {
            if (trim($t) === trim($headerLine)) $started = true;
            continue;
        }
        if (strpos($t, ';') === false) continue;
        $row = str_getcsv($t, ';');

        $cnpj = $parseCnpj($getCell($row, $idx, ['CNPJ pagador', 'CNPJ']));
        if ($cnpj === '') continue;

        $qtde = (int)preg_replace('/\D+/', '', $getCell($row, $idx, ['Quantidade tabelas', 'Quantidade']));
        if ($qtde <= 0) continue;

        $nome = $getCell($row, $idx, ['Nome pagador', 'Nome']);
        $vendedor = $parseVendedorLogin($getCell($row, $idx, ['Vendedor']));
        $unidadeResp = strtoupper(trim($getCell($row, $idx, ['Unidade responsavel', 'Unidade responsável', 'Unidade'])));
        $ultimoMov = trim($getCell($row, $idx, ['Ultimo movimento', 'Último movimento']));
        $tipo = $toTipo($getCell($row, $idx, ['Tipo tabela', 'Tipo']));
        $vig = trim($getCell($row, $idx, ['Vigencia atual', 'Vigência atual', 'Vigencia']));

        $dadosBase[] = [
            'cnpj' => $cnpj,
            'razao_social' => $nome,
            'unidade' => $unidadeResp,
            'tipo' => $tipo,
            'vigencia' => $vig,
            'vendedor' => $vendedor,
            'ultimo_movimento' => $ultimoMov,
        ];
        $cnpjs[$cnpj] = true;
    }

    // ============================================
    // 5. Enriquecer: grupos + somas de frete (batch)
    // ============================================
    $conn = getDBConnection();
    if (!$conn) throw new Exception('Não foi possível conectar ao banco de dados');
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $domain)) throw new Exception('Domínio inválido');
    $domainDb = strtolower($domain);

    $cnpjsList = array_keys($cnpjs);
    if (!empty($cnpjsList)) {
        $r1 = pg_query($conn, "CREATE TEMP TABLE tmp_cnpjs (cnpj varchar(14) PRIMARY KEY)");
        if (!$r1) throw new Exception('Erro ao criar tmp_cnpjs: ' . pg_last_error($conn));
        $batch = 500;
        for ($i = 0; $i < count($cnpjsList); $i += $batch) {
            $chunk = array_slice($cnpjsList, $i, $batch);
            $values = [];
            $params = [];
            $p = 1;
            foreach ($chunk as $c) {
                $values[] = "($" . $p++ . ")";
                $params[] = $c;
            }
            $q = "INSERT INTO tmp_cnpjs (cnpj) VALUES " . implode(',', $values) . " ON CONFLICT DO NOTHING";
            $r = pg_query_params($conn, $q, $params);
            if (!$r) throw new Exception('Erro ao inserir tmp_cnpjs: ' . pg_last_error($conn));
        }
    }

    $grupoMap = [];
    $principaisComFilhos = [];
    if (!empty($cnpjsList)) {
        $qG = "SELECT cnpj, cnpj_principal FROM {$domainDb}_grupo_cliente WHERE cnpj IN (SELECT cnpj FROM tmp_cnpjs)";
        $rG = pg_query($conn, $qG);
        if ($rG) {
            while ($row = pg_fetch_assoc($rG)) {
                $c = preg_replace('/\D+/', '', (string)($row['cnpj'] ?? ''));
                $p = preg_replace('/\D+/', '', (string)($row['cnpj_principal'] ?? ''));
                $c = substr($c, 0, 14);
                $p = substr($p, 0, 14);
                if ($c !== '' && $p !== '') $grupoMap[$c] = $p;
            }
        }

        $qP = "SELECT DISTINCT cnpj_principal FROM {$domainDb}_grupo_cliente
               WHERE cnpj_principal IN (SELECT cnpj FROM tmp_cnpjs) AND cnpj <> cnpj_principal";
        $rP = pg_query($conn, $qP);
        if ($rP) {
            while ($row = pg_fetch_assoc($rP)) {
                $p = preg_replace('/\D+/', '', (string)($row['cnpj_principal'] ?? ''));
                $p = substr($p, 0, 14);
                if ($p !== '') $principaisComFilhos[$p] = true;
            }
        }
    }

    $hoje = new DateTime('now');
    $inicioMesAtual = new DateTime($hoje->format('Y-m-01'));
    $fimMesAnterior = (clone $inicioMesAtual)->modify('-1 day');
    $inicioMesAnterior = new DateTime($fimMesAnterior->format('Y-m-01'));
    $inicio3Meses = (clone $inicioMesAtual)->modify('-3 months');

    $freteMap = [];
    if (!empty($cnpjsList)) {
        $qF = "SELECT
                  t.cnpj,
                  COALESCE(SUM(c.vlr_frete) FILTER (WHERE c.data_emissao BETWEEN $1 AND $2), 0) AS frete_mes_anterior,
                  COALESCE(SUM(c.vlr_frete) FILTER (WHERE c.data_emissao BETWEEN $3 AND $2), 0) AS frete_3_meses
               FROM tmp_cnpjs t
               LEFT JOIN {$domainDb}_cte c
                      ON c.cnpj_pag = t.cnpj
                     AND c.status <> 'C'
                     AND c.data_emissao BETWEEN $3 AND $2
               GROUP BY t.cnpj";
        $rF = pg_query_params($conn, $qF, [
            $inicioMesAnterior->format('Y-m-d'),
            $fimMesAnterior->format('Y-m-d'),
            $inicio3Meses->format('Y-m-d'),
        ]);
        if ($rF) {
            while ($row = pg_fetch_assoc($rF)) {
                $c = preg_replace('/\D+/', '', (string)($row['cnpj'] ?? ''));
                $c = substr($c, 0, 14);
                $freteMap[$c] = [
                    'mes_anterior' => (float)($row['frete_mes_anterior'] ?? 0),
                    'tres_meses' => (float)($row['frete_3_meses'] ?? 0),
                ];
            }
        }
    }

    pg_close($conn);

    if (empty($dadosBase)) {
        msg('Nenhuma tabela a vencer encontrada no período.', 'info');
    }
    
    if (empty($dados)) {
        msg('Nenhuma tabela a vencer encontrada no período.', 'info');
    }
    
    // ============================================
    // 6. Gerar CSV no formato objetivo (cliente)
    // ============================================
    $filename = 'tabelas_vencer_' . date('Y-m-d_His') . '.csv';
    
    // Configurar headers para download
    header('Content-Type: text/csv; charset=UTF-8');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Cache-Control: max-age=0');
    header('Pragma: public');
    
    // Abrir output stream
    $output = fopen('php://output', 'w');
    
    // BOM para UTF-8 (Excel reconhece)
    fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF));
    
    $fmtNumero = static function(float $n): string {
        $s = number_format($n, 2, ',', '');
        $s = rtrim($s, '0');
        $s = rtrim($s, ',');
        return $s === '' ? '0' : $s;
    };
    $semMov = 'Nao ha movimento para periodo informado.';

    fputcsv($output, [
        'CNPJ',
        'CNPJ PAI GRUPO',
        'RAZAO SOCIAL',
        'POSSUI GRUPO',
        'TIPO',
        'VIGENCIA',
        'VENDEDOR',
        'ULTIMO MOVIMENTO',
        'TOTAL FRETE MES ANTERIOR',
        'TOTAL FRETE DOS ULTIMOS 3 MESES'
    ], ';');

    foreach ($dadosBase as $r) {
        $cnpj = $r['cnpj'];
        $parent = $grupoMap[$cnpj] ?? null;
        $isMember = $parent !== null && $parent !== '' && $parent !== $cnpj;
        $isPrincipal = isset($principaisComFilhos[$cnpj]);
        $possuiGrupo = $isMember ? 'SIM' : ($isPrincipal ? '' : 'NAO');
        $cnpjPai = $isMember ? $parent : '';

        $fm = $freteMap[$cnpj]['mes_anterior'] ?? 0.0;
        $f3 = $freteMap[$cnpj]['tres_meses'] ?? 0.0;
        $fmOut = $fm > 0 ? $fmtNumero($fm) : $semMov;
        $f3Out = $f3 > 0 ? $fmtNumero($f3) : $semMov;

        $cnpjOut = $cnpj . "'";
        $cnpjPaiOut = $cnpjPai !== '' ? ($cnpjPai . "'") : '';

        fputcsv($output, [
            $cnpjOut,
            $cnpjPaiOut,
            $r['razao_social'] ?? '',
            $possuiGrupo,
            $r['tipo'] ?? '',
            $r['vigencia'] ?? '',
            $r['vendedor'] ?? '',
            $r['ultimo_movimento'] ?? '',
            $fmOut,
            $f3Out,
        ], ';');
    }
    
    fclose($output);
    exit;
    
} catch (Throwable $e) {
    error_log("❌ ERRO em exportar_tabelas_vencer_csv.php: " . $e->getMessage());
    error_log("   Arquivo: " . $e->getFile());
    error_log("   Linha: " . $e->getLine());
    
    msg('Erro ao exportar CSV: ' . $e->getMessage(), 'error', 500);
}
?>
