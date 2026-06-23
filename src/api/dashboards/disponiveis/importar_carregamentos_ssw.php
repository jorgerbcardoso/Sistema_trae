<?php
require_once __DIR__ . '/../../config.php';
require_once '/var/www/html/lib/ssw.php';

handleOptionsRequest();
validateRequestMethod('POST');

$auth        = authenticateAndGetUser();
$domain      = $auth['domain'];
$currentUser = getCurrentUser();
$unidade     = strtoupper(trim($currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? ''));
$login       = $currentUser['username'] ?? '';

if (empty($unidade) || empty($domain)) {
    respondJson(['success' => false, 'message' => 'Unidade ou domínio não identificados.']);
}

$input       = getRequestInput();

$conn = connect();

ssw_login($domain);
set_time_limit(300);

$tabela = "{$domain}_carregamento";

ssw_go("https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2={$unidade}&f3=101");
$html_placas = ssw_go("https://sistema.ssw.inf.br/bin/ssw0194?act=PLACAS&prioritario=N");

$inicio_xml = strpos($html_placas, '<?xml');
if ($inicio_xml === false) {
    $inicio_xml = strpos($html_placas, '<xml');
}
if ($inicio_xml === false) {
    respondJson(['success' => false, 'message' => 'Não foi possível encontrar o XML com as placas no retorno do SSW.']);
}
$fim_xml = strrpos($html_placas, '</data>');
if ($fim_xml === false) {
    $fim_xml = strrpos($html_placas, '</xml>');
    $tag_fim = '</xml>';
} else {
    $tag_fim = '</data>';
}
if ($fim_xml === false) {
    respondJson(['success' => false, 'message' => 'XML de placas malformado no retorno do SSW.']);
}
$xml_string = substr($html_placas, $inicio_xml, ($fim_xml + strlen($tag_fim)) - $inicio_xml);

$xml = @simplexml_load_string($xml_string);
if ($xml === false) {
    respondJson(['success' => false, 'message' => 'Falha ao parsear o XML das placas do SSW.']);
}

$placas_ssw = [];
foreach ($xml->xpath('//f8') as $f8) {
    $placa = strtoupper(trim((string)$f8));
    if (!empty($placa)) {
        $placas_ssw[] = $placa;
    }
}

$unidadeEsc = pg_escape_string($conn, $unidade);

if (empty($placas_ssw)) {
    $resDelSsw = pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND origem_ssw = true");
    if ($resDelSsw === false) {
        respondJson(['success' => false, 'message' => 'Erro ao limpar importações anteriores (origem_ssw=true).']);
    }
    $removidos = pg_affected_rows($resDelSsw);
    respondJson([
        'success' => true,
        'message' => "Nenhum carregamento encontrado no SSW para esta unidade. Removidos {$removidos} registro(s) importado(s).",
        'logs' => [],
        'placas_ssw' => [],
        'removidos' => $removidos,
    ]);
}

$logs = [];

$loginEsc   = pg_escape_string($conn, $login);

// Reimportação: remove todas as linhas anteriormente importadas do SSW
$resDelSsw = pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND origem_ssw = true");
if ($resDelSsw === false) {
    respondJson(['success' => false, 'message' => 'Erro ao limpar importações anteriores (origem_ssw=true).']);
}

function normalizarNumero($v) {
    $s = trim((string)$v);
    if ($s === '') return 0.0;
    $s = preg_replace('/[^0-9,\\.]/', '', $s);
    if ($s === '') return 0.0;
    if (strpos($s, ',') !== false) {
        $s = str_replace('.', '', $s);
        $s = str_replace(',', '.', $s);
        return (float)$s;
    }
    return (float)$s;
}

function parseRelatorioCarregamentos($texto) {
    $texto = mb_convert_encoding($texto, 'UTF-8', 'ISO-8859-1');
    $texto = str_replace("\r\n", "\n", str_replace("\r", "\n", $texto));
    $linhas = explode("\n", $texto);

    $porPlaca = [];
    $placaAtual = null;
    $anoBase = (int)date('Y');
    $mesBase = (int)date('m');

    $larguras = [12,5,5,10,12,5,6,5,5,20,20,20,14,3,14,11,7,6,2];
    $separador = '------------+-----+-----+----------+------------+-----+------+-----+-----+--------------------+--------------------+--------------------+--------------+---+--------------+-----------+-------+------+--';

    foreach ($linhas as $linha) {
        $linha = rtrim($linha, "\n");
        if ($linha === '') continue;

        if (preg_match('/PLACA:\\s*([A-Z0-9-]+)/', $linha, $m)) {
            $placaAtual = strtoupper(trim($m[1]));
            if (!isset($porPlaca[$placaAtual])) {
                $porPlaca[$placaAtual] = ['ctes' => [], 'destinos' => []];
            }
            if (preg_match('/(\\d{2})\\/(\\d{2})\\/(\\d{4})/', $linha, $d)) {
                $mesBase = (int)$d[2];
                $anoBase = (int)$d[3];
            }
            continue;
        }

        if ($placaAtual === null) continue;
        if (strpos($linha, $separador) !== false) continue;
        if (preg_match('/^TOTAIS:/', trim($linha))) continue;
        if (preg_match('/^TOTAL GERAL/', trim($linha))) continue;

        $ctrc = trim(substr($linha, 0, 13));
        if (!preg_match('/^[A-Z]{3}\\d{6}-\\d$/', $ctrc)) continue;

        $offset = 0;
        $cols = [];
        foreach ($larguras as $w) {
            $cols[] = rtrim(substr($linha, $offset, $w));
            $offset += $w + 1;
        }

        $ctrcRaw = trim($cols[0] ?? '');
        $emiss   = trim($cols[1] ?? '');
        $prevEnt = trim($cols[2] ?? '');
        $qVol    = trim($cols[6] ?? '');
        $remet   = trim($cols[9] ?? '');
        $pagador = trim($cols[10] ?? '');
        $destin  = trim($cols[11] ?? '');
        $locEnt  = trim($cols[12] ?? '');
        $uni     = strtoupper(trim($cols[13] ?? ''));
        $merc    = trim($cols[14] ?? '');
        $frete   = trim($cols[15] ?? '');
        $kg      = trim($cols[16] ?? '');
        $m3      = trim($cols[17] ?? '');

        $ser = substr($ctrcRaw, 0, 3);
        $nro = (int)substr($ctrcRaw, 3, 6);
        if ($ser === '' || $nro <= 0) continue;

        $emissaoFull = null;
        if (preg_match('/^(\\d{2})\\/(\\d{2})$/', $emiss, $dm)) {
            $emissaoFull = sprintf('%02d/%02d/%04d', (int)$dm[1], (int)$dm[2], $anoBase);
        }
        $prevEntFull = null;
        if (preg_match('/^(\\d{2})\\/(\\d{2})$/', $prevEnt, $dm)) {
            $ano = $anoBase;
            $mes = (int)$dm[2];
            if ($mesBase >= 11 && $mes <= 2) $ano = $anoBase + 1;
            $prevEntFull = sprintf('%02d/%02d/%04d', (int)$dm[1], $mes, $ano);
        }

        if ($uni !== '') $porPlaca[$placaAtual]['destinos'][] = $uni;

        $porPlaca[$placaAtual]['ctes'][] = [
            'ser_cte'      => $ser,
            'nro_cte'      => $nro,
            'destino_cte'  => $uni,
            'emissao'      => $emissaoFull,
            'prev_ent'     => $prevEntFull,
            'remetente'    => $remet,
            'pagador'      => $pagador,
            'destinatario' => $destin,
            'cidade'       => $locEnt,
            'qtde_vol'     => (int)preg_replace('/\\D/', '', $qVol),
            'vlr_merc'     => $merc,
            'vlr_frete'    => $frete,
            'peso'         => $kg,
            'cubagem'      => $m3,
        ];
    }

    return $porPlaca;
}

$placasLote = array_values(array_unique($placas_ssw));
$tamanhoLote = 25;
$carregamentos = [];

for ($i = 0; $i < count($placasLote); $i += $tamanhoLote) {
    $chunk = array_slice($placasLote, $i, $tamanhoLote);
    if (empty($chunk)) continue;

    $act = 'SR_IMP|' . implode('|', array_map('rawurlencode', $chunk));
    $str_retorno = ssw_go("https://sistema.ssw.inf.br/bin/ssw0194?act={$act}");
    $str_decodificada = urldecode($str_retorno);
    $act_download = ssw_get_act($str_decodificada);
    $arq_download = ssw_get_arq($str_decodificada);

    if (empty($act_download) || empty($arq_download)) {
        foreach ($chunk as $p) {
            $logs[] = ['placa' => $p, 'status' => 'erro', 'msg' => 'Não foi possível obter os parâmetros de download do relatório.'];
        }
        continue;
    }

    $relatorio = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act_download}&filename={$arq_download}&path=&down=1&nw=0");
    if (empty($relatorio) || strlen($relatorio) < 50) {
        foreach ($chunk as $p) {
            $logs[] = ['placa' => $p, 'status' => 'erro', 'msg' => 'Relatório vazio ou inválido.'];
        }
        continue;
    }

    $parsed = parseRelatorioCarregamentos($relatorio);
    foreach ($parsed as $placa => $data) {
        if (!isset($carregamentos[$placa])) $carregamentos[$placa] = ['ctes' => [], 'destinos' => []];
        $carregamentos[$placa]['ctes'] = array_merge($carregamentos[$placa]['ctes'], $data['ctes'] ?? []);
        $carregamentos[$placa]['destinos'] = array_merge($carregamentos[$placa]['destinos'], $data['destinos'] ?? []);
    }
}

foreach ($placas_ssw as $placa) {
    $placaEsc = pg_escape_string($conn, $placa);

    $res_check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' LIMIT 1");
    $ja_existe = $res_check && pg_num_rows($res_check) > 0;

    $info = $carregamentos[$placa] ?? null;
    $ctes = $info['ctes'] ?? [];
    if (empty($ctes)) {
        $logs[] = ['placa' => $placa, 'status' => 'aviso', 'msg' => 'Nenhum CT-e válido encontrado no relatório.'];
        continue;
    }

    $destinos = array_filter(array_map('strtoupper', array_map('trim', $info['destinos'] ?? [])));
    $destinoCar = null;
    if (!empty($destinos)) {
        $freq = array_count_values($destinos);
        arsort($freq);
        $destinoCar = array_key_first($freq);
    }
    $destinoCarEsc = $destinoCar ? ("'" . pg_escape_string($conn, $destinoCar) . "'") : 'NULL';

    pg_query($conn, 'BEGIN');
    try {
        // Remove somente o que veio do SSW para esta placa (mantém apontamentos manuais)
        $resDel = pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND origem_ssw = true");
        if ($resDel === false) throw new Exception(pg_last_error($conn));

        $inseridos = 0;
        foreach ($ctes as $cte_info) {
            $ser = pg_escape_string($conn, strtoupper(trim($cte_info['ser_cte'] ?? '')));
            $nro = (int)($cte_info['nro_cte'] ?? 0);
            if ($ser === '' || $nro <= 0) continue;

            $check_dup = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND ser_cte = '{$ser}' AND nro_cte = {$nro} LIMIT 1");
            if ($check_dup && pg_num_rows($check_dup) > 0) continue;

            $destinoCte = pg_escape_string($conn, strtoupper(trim($cte_info['destino_cte'] ?? '')));
            $remetente  = pg_escape_string($conn, trim($cte_info['remetente'] ?? ''));
            $pagador    = pg_escape_string($conn, trim($cte_info['pagador'] ?? ''));
            $destinat   = pg_escape_string($conn, trim($cte_info['destinatario'] ?? ''));
            $cidade     = pg_escape_string($conn, trim($cte_info['cidade'] ?? ''));

            $emissao = trim($cte_info['emissao'] ?? '');
            $prevEnt = trim($cte_info['prev_ent'] ?? '');
            $emissaoSql = preg_match('/^\\d{2}\\/\\d{2}\\/\\d{4}$/', $emissao) ? "TO_DATE('{$emissao}', 'DD/MM/YYYY')" : 'NULL';
            $prevEntSql = preg_match('/^\\d{2}\\/\\d{2}\\/\\d{4}$/', $prevEnt) ? "TO_DATE('{$prevEnt}', 'DD/MM/YYYY')" : 'NULL';

            $vlrMerc  = normalizarNumero($cte_info['vlr_merc']  ?? 0);
            $vlrFrete = normalizarNumero($cte_info['vlr_frete'] ?? 0);
            $pesoVal  = normalizarNumero($cte_info['peso']      ?? 0);
            $cubVal   = normalizarNumero($cte_info['cubagem']   ?? 0);
            $qtdeVol  = (int)($cte_info['qtde_vol'] ?? 0);

            $resIns = pg_query($conn,
                "INSERT INTO {$tabela}
                 (unidade, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao,
                  destino, unidades,
                  ser_cte, nro_cte, destino_cte, data_emissao_cte, data_prev_ent_cte,
                  remetente_cte, destinatario_cte, pagador_cte, cidade_destino_cte,
                  vlr_merc_cte, vlr_frete_cte, peso_cte, cubagem_cte, qtde_vol_cte,
                  origem_ssw, unidade_carregamento)
                 VALUES
                 ('{$unidadeEsc}', '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME,
                  {$destinoCarEsc}, NULL,
                  '{$ser}', {$nro}, '{$destinoCte}', {$emissaoSql}, {$prevEntSql},
                  '{$remetente}', '{$destinat}', '{$pagador}', '{$cidade}',
                  {$vlrMerc}, {$vlrFrete}, {$pesoVal}, {$cubVal}, {$qtdeVol},
                  true, '{$unidadeEsc}')"
            );
            if (!$resIns) throw new Exception(pg_last_error($conn));
            $inseridos++;
        }

        if ($inseridos === 0) {
            pg_query($conn, 'ROLLBACK');
            $logs[] = ['placa' => $placa, 'status' => 'aviso', 'msg' => 'Nenhum CT-e importado.'];
            continue;
        }

        // Atualiza timestamps/usuário do carregamento inteiro (inclui linhas manuais)
        $resUpd = pg_query($conn,
            "UPDATE {$tabela}
             SET data_inclusao = CURRENT_DATE,
                 hora_inclusao = CURRENT_TIME,
                 login_inclusao = '{$loginEsc}'
             WHERE UPPER(unidade) = '{$unidadeEsc}'
               AND placa_provisoria = '{$placaEsc}'"
        );
        if ($resUpd === false) throw new Exception(pg_last_error($conn));

        pg_query($conn, 'COMMIT');
        $status = $ja_existe ? 'sobrescrito' : 'importado';
        $logs[] = ['placa' => $placa, 'status' => $status, 'msg' => "{$inseridos} CT-e(s) importado(s)."];
    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        $logs[] = ['placa' => $placa, 'status' => 'erro', 'msg' => 'Erro ao salvar: ' . $e->getMessage()];
    }
}

respondJson(['success' => true, 'placas_ssw' => $placas_ssw, 'logs' => $logs]);
