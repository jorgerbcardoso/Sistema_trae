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
$sobrescrever = !empty($input['sobrescrever']);

$conn = connect();

ssw_login($domain);
set_time_limit(180);

$tabela = "{$domain}_carregamento";

$html_placas = ssw_go("https://sistema.ssw.inf.br/bin/ssw0194?act=PLACAS&unidade=$unidade&prioritario=N");

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

if (empty($placas_ssw)) {
    respondJson(['success' => true, 'message' => 'Nenhum carregamento encontrado no SSW para esta unidade.', 'logs' => []]);
}

$logs = [];

foreach ($placas_ssw as $placa) {
    $placaEsc = pg_escape_string($conn, $placa);
    $unidadeEsc = pg_escape_string($conn, $unidade);

    $res_check = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' LIMIT 1");
    $ja_existe = $res_check && pg_num_rows($res_check) > 0;

    if ($ja_existe && !$sobrescrever) {
        $logs[] = ['placa' => $placa, 'status' => 'ignorado', 'msg' => 'Já existe no Presto (não sobrescrito).'];
        continue;
    }

    $str_retorno = ssw_go("https://sistema.ssw.inf.br/bin/ssw0194?act=SR_IMP|" . urlencode($placa));
    $str_decodificada = urldecode($str_retorno);
    $act_download = ssw_get_act($str_decodificada);
    $arq_download = ssw_get_arq($str_decodificada);

    if (empty($act_download) || empty($arq_download)) {
        $logs[] = ['placa' => $placa, 'status' => 'erro', 'msg' => 'Não foi possível obter os parâmetros de download do relatório.'];
        continue;
    }

    $relatorio = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act={$act_download}&filename={$arq_download}&path=&down=1&nw=0");

    if (empty($relatorio) || strlen($relatorio) < 50) {
        $logs[] = ['placa' => $placa, 'status' => 'erro', 'msg' => 'Relatório vazio ou inválido.'];
        continue;
    }

    $relatorio = mb_convert_encoding($relatorio, 'UTF-8', 'ISO-8859-1');
    $linhas    = explode("\n", str_replace("\r\n", "\n", str_replace("\r", "\n", $relatorio)));

    $ctes_para_inserir = [];
    foreach ($linhas as $linha) {
        $ctrc = trim(substr($linha, 0, 13));
        if (!preg_match('/^[A-Z]{3}\d{6}-\d$/', $ctrc)) continue;

        $serie  = substr($ctrc, 0, 3);
        $numero = (int)substr($ctrc, 3, 6);

        if (empty($serie) || $numero <= 0) continue;

        $ctes_para_inserir[] = ['serie' => $serie, 'numero' => $numero];
    }

    if (empty($ctes_para_inserir)) {
        $logs[] = ['placa' => $placa, 'status' => 'aviso', 'msg' => 'Nenhum CT-e válido encontrado no relatório.'];
        continue;
    }

    pg_query($conn, 'BEGIN');
    try {
        if ($ja_existe) {
            pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}'");
        }

        $loginEsc = pg_escape_string($conn, $login);
        pg_query($conn, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES ('{$unidadeEsc}', 0, '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME)");

        $inseridos = 0;
        $nao_encontrados = 0;

        foreach ($ctes_para_inserir as $cte_info) {
            $seq_cte = imp_cte($cte_info['serie'], $cte_info['numero']);

            if ($seq_cte > 0) {
                $check_dup = pg_query($conn, "SELECT 1 FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = {$seq_cte} LIMIT 1");
                if (!$check_dup || pg_num_rows($check_dup) === 0) {
                    pg_query($conn, "INSERT INTO {$tabela} (unidade, seq_cte, placa_provisoria, login_inclusao, data_inclusao, hora_inclusao) VALUES ('{$unidadeEsc}', {$seq_cte}, '{$placaEsc}', '{$loginEsc}', CURRENT_DATE, CURRENT_TIME)");
                    $inseridos++;
                }
            } else {
                $nao_encontrados++;
            }
        }

        if ($inseridos > 0) {
            pg_query($conn, "DELETE FROM {$tabela} WHERE UPPER(unidade) = '{$unidadeEsc}' AND placa_provisoria = '{$placaEsc}' AND seq_cte = 0");
        }

        pg_query($conn, 'COMMIT');

        $status = $ja_existe ? 'sobrescrito' : 'importado';
        $logs[] = ['placa' => $placa, 'status' => $status, 'msg' => "{$inseridos} CT-e(s) importado(s)." . ($nao_encontrados > 0 ? " {$nao_encontrados} não encontrado(s) na base." : '')];

    } catch (Exception $e) {
        pg_query($conn, 'ROLLBACK');
        $logs[] = ['placa' => $placa, 'status' => 'erro', 'msg' => 'Erro ao salvar: ' . $e->getMessage()];
    }
}

respondJson(['success' => true, 'placas_ssw' => $placas_ssw, 'logs' => $logs]);
