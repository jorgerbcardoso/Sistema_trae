<?php
require_once '../../../config.php';
// ssw.php é carregado pelo config.php, se necessário, ou aqui, vamos garantir
if (file_exists(__DIR__ . '/../../lib/ssw.php')) {
    require_once __DIR__ . '/../../lib/ssw.php';
}

header('Content-Type: application/json');
handleOptionsRequest(); // Do config.php
validateRequestMethod('POST'); // Do config.php

function extrair_xml_do_html($html) {
    $inicio_xml = strpos($html, '<?xml');
    if ($inicio_xml === false) return null;
    $fim_xml = strrpos($html, '</data>');
    if ($fim_xml === false) return null;
    return substr($html, $inicio_xml, ($fim_xml + strlen('</data>')) - $inicio_xml);
}

$conn = null;
try {
    $input = getRequestInput(); // Do config.php
    $sobrescrever = $input['sobrescrever'] ?? false;
    
    $currentUser = getCurrentUser(); // Do config.php
    $dominio = $currentUser['domain'];
    $unidade_atual = $currentUser['unidade_atual'];

    if (empty($unidade_atual) || empty($dominio)) {
        throw new Exception('Unidade ou Domínio do usuário não identificados.', 400);
    }
    
    $conn = getDBConnection(); // Do config.php

    $tabela_carregamento = strtolower($dominio) . "_carregamento";
    
    // 1. Obter a lista de placas do SSW
    $url_placas = "https://sistema.ssw.inf.br/bin/ssw0194.php?act=PLACAS&unidade=" . urlencode($unidade_atual);
    $html_placas = ssw_go($url_placas); // Do ssw.php
    $xml_string = extrair_xml_do_html($html_placas);

    if (empty($xml_string)) {
        throw new Exception('Não foi possível encontrar o XML com as placas no retorno do SSW.');
    }

    $xml = simplexml_load_string($xml_string);
    if ($xml === false) {
        throw new Exception('Falha ao parsear o XML das placas.');
    }
    
    $placas_ssw = [];
    foreach ($xml->row as $row) {
        if (isset($row->f8)) {
            $placas_ssw[] = (string)$row->f8;
        }
    }

    if(empty($placas_ssw)){
        respondJson(['status' => 'success', 'message' => 'Nenhum carregamento encontrado no SSW para importar.']);
    }

    $logs = [];
    // 2. Processar cada placa
    foreach($placas_ssw as $placa){
        $res_check = sql($conn, "SELECT id FROM {$tabela_carregamento} WHERE placa_provisoria = $1 AND unidade = $2 LIMIT 1", false, [$placa, $unidade_atual]);
        $carregamento_existe = pg_num_rows($res_check) > 0;

        if($carregamento_existe && !$sobrescrever){
            $logs[] = "Carregamento para a placa {$placa} já existe no Presto e não foi sobrescrito.";
            continue;
        }

        $str_retorno = ssw_go("https://sistema.ssw.inf.br/bin/ssw0194.php?act=SR_IMP|" . urlencode($placa));
        $str_decodificada = urldecode($str_retorno);
        $act_download = ssw_get_act($str_decodificada);
        $arq_download = ssw_get_arq($str_decodificada);

        if(empty($act_download) || empty($arq_download)){
            $logs[] = "Não foi possível obter os parâmetros de download do relatório para a placa {$placa}.";
            continue;
        }

        $url_download = "https://sistema.ssw.inf.br/bin/ssw0424.php?act={$act_download}&filename={$arq_download}&path=&down=1&nw=0";
        $relatorio_ctes = ssw_go($url_download);
        
        $ctes_par-inserir = [];
        $linhas = explode("\n", $relatorio_ctes);

        foreach($linhas as $linha){
            $linha_trim = trim($linha);
            if (strlen($linha_trim) > 10 && preg_match('/^[A-Z]{3}/ ', $linha_trim)) {
                $chave = trim(substr($linha_trim, 0, 9));
                if(strlen($chave) == 9){
                    $serie = substr($chave, 0, 3);
                    $numero = (int)substr($chave, 3, 6);
                    if(!empty($serie) && $numero > 0){
                        $ctes_par-inserir[] = ['serie' => $serie, 'numero' => $numero];
                    }
                }
            }
        }

        if(empty($ctes_par-inserir)){
            $logs[] = "Nenhum CT-e válido encontrado no relatório do SSW para a placa {$placa}.";
            continue;
        }

        sql($conn, "BEGIN");
        try {
            if($carregamento_existe){
                sql($conn, "DELETE FROM {$tabela_carregamento} WHERE placa_provisoria = $1 AND unidade = $2", false, [$placa, $unidade_atual]);
            }
            
            $ctes_inseridos_count = 0;
            $tabela_cte = strtolower($dominio) . "_cte";
            foreach($ctes_par-inserir as $cte_info){
                $res_seq = sql($conn, "SELECT nro_seq_cte FROM {$tabela_cte} WHERE ser_cte = $1 AND nro_cte = $2 LIMIT 1", false, [$cte_info['serie'], $cte_info['numero']]);

                if($res_seq && pg_num_rows($res_seq) > 0){
                    $seq_cte = (int)pg_fetch_assoc($res_seq)['nro_seq_cte'];
                    if($seq_cte > 0){
                        sql($conn, "INSERT INTO {$tabela_carregamento} (unidade, placa_provisoria, seq_cte, login_inclusao) VALUES ($1, $2, $3, 'IMPORT_SSW')", false, [$unidade_atual, $placa, $seq_cte]);
                        $ctes_inseridos_count++;
                    }
                } else {
                    $logs[] = "CT-e {$cte_info['serie']}-{$cte_info['numero']} não encontrado no Presto para a placa {$placa}.";
                }
            }

            sql($conn, "COMMIT");
            if ($ctes_inseridos_count > 0) {
                 $logs[] = "Carregamento para a placa {$placa} importado/atualizado com {$ctes_inseridos_count} CT-es.";
            } else {
                 $logs[] = "Nenhum CT-e para a placa {$placa} foi encontrado no Presto. O carregamento pode ter sido criado vazio.";
            }

        } catch (Exception $db_exception) {
            sql($conn, "ROLLBACK");
            $logs[] = "Erro ao salvar o carregamento para a placa {$placa} no banco de dados: " . $db_exception->getMessage();
        }
    }
    
    respondJson(['status' => 'success', 'message' => 'Importação do SSW concluída.', 'logs' => $logs]);

} catch(Exception $e) {
    returnError($e->getMessage(), $e->getCode() > 0 ? $e->getCode() : 500);
} finally {
    if($conn){
        closeDBConnection($conn);
    }
}

?>