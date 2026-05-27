<?php
require_once '../../../config.php';
require_once '../../lib/lib.php';
require_once '../../lib/ssw.php';

header('Content-Type: application/json');

// Garante que o método de requisição seja POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método não permitido']);
    exit;
}

// Função para extrair XML de uma string HTML
function extrair_xml_do_html($html) {
    $inicio_xml = strpos($html, '<?xml');
    if ($inicio_xml === false) return null;
    $fim_xml = strrpos($html, '</data>');
    if ($fim_xml === false) return null;
    return substr($html, $inicio_xml, ($fim_xml + strlen('</data>')) - $inicio_xml);
}

try {
    $input = json_decode(file_get_contents('php://input'), true);
    $sobrescrever = $input['sobrescrever'] ?? false;
    
    $dominio = App\Util\dominio::get();
    $unidade_atual = App\Util\unidade::get();

    if (empty($unidade_atual)) {
        throw new Exception('Unidade do usuário não identificada.', 400);
    }

    $tabela_carregamento = "{$dominio}_carregamento";
    sql("CREATE TABLE IF NOT EXISTS {$tabela_carregamento} (id SERIAL PRIMARY KEY, unidade VARCHAR(10), placa_provisoria VARCHAR(20), seq_cte integer, login_inclusao VARCHAR(50), dat_inclusao DATE DEFAULT CURRENT_DATE, hor_inclusao TIME DEFAULT CURRENT_TIME)");

    ssw_login();
    
    // 1. Obter a lista de placas
    $url_placas = "https://sistema.ssw.inf.br/bin/ssw0194?act=PLACAS&unidade=" . urlencode($unidade_atual);
    $html_placas = ssw_go($url_placas);
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
        echo json_encode(['status' => 'success', 'message' => 'Nenhum carregamento encontrado no SSW para importar.']);
        exit;
    }

    $logs = [];
    // 2. Processar cada placa
    foreach($placas_ssw as $placa){
        $res_check = sql("SELECT id FROM {$tabela_carregamento} WHERE placa_provisoria = $1 AND unidade = $2 LIMIT 1", [$placa, $unidade_atual]);
        $carregamento_existe = count($res_check) > 0;

        if($carregamento_existe && !$sobrescrever){
            $logs[] = "Carregamento para a placa {$placa} já existe no Presto e não foi sobrescrito.";
            continue;
        }

        // 2.1 Gerar o relatório e obter parâmetros para download
        $str_retorno = ssw_go("https://sistema.ssw.inf.br/bin/ssw0194?act=SR_IMP|" . urlencode($placa));
        $str_decodificada = urldecode($str_retorno);
        $act_download = ssw_get_act($str_decodificada);
        $arq_download = ssw_get_arq($str_decodificada);

        if(empty($act_download) || empty($arq_download)){
            $logs[] = "Não foi possível obter os parâmetros de download do relatório para a placa {$placa}.";
            continue;
        }

        // 2.2 Baixar o arquivo do relatório
        $url_download = "https://sistema.ssw.inf.br/bin/ssw0424?act={$act_download}&filename={$arq_download}&path=&down=1&nw=0";
        $relatorio_ctes = ssw_go($url_download);
        
        // 2.3 Parsear o relatório
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

        // 2.4 Salvar no banco de dados
        sql("BEGIN");
        try {
            if($carregamento_existe){
                sql("DELETE FROM {$tabela_carregamento} WHERE placa_provisoria = $1 AND unidade = $2", [$placa, $unidade_atual]);
            }
            
            $ctes_inseridos_count = 0;
            $tabela_cte = "{$dominio}_cte";
            foreach($ctes_par-inserir as $cte_info){
                $res_seq = sql("SELECT nro_seq_cte FROM {$tabela_cte} WHERE ser_cte = $1 AND nro_cte = $2 LIMIT 1", [$cte_info['serie'], $cte_info['numero']]);

                if(count($res_seq) > 0){
                    $seq_cte = (int)$res_seq[0]['nro_seq_cte'];
                    if($seq_cte > 0){
                        sql("INSERT INTO {$tabela_carregamento} (unidade, placa_provisoria, seq_cte, login_inclusao) VALUES ($1, $2, $3, 'IMPORT_SSW')", [$unidade_atual, $placa, $seq_cte]);
                        $ctes_inseridos_count++;
                    }
                } else {
                    $logs[] = "CT-e {$cte_info['serie']}-{$cte_info['numero']} não encontrado no Presto para a placa {$placa}.";
                }
            }

            sql("COMMIT");
            if ($ctes_inseridos_count > 0) {
                 $logs[] = "Carregamento para a placa {$placa} importado/atualizado com {$ctes_inseridos_count} CT-es.";
            } else {
                 $logs[] = "Nenhum CT-e para a placa {$placa} foi encontrado no Presto. O carregamento pode ter sido criado vazio.";
            }

        } catch (Exception $db_exception) {
            sql("ROLLBACK");
            $logs[] = "Erro ao salvar o carregamento para a placa {$placa} no banco de dados: " . $db_exception->getMessage();
        }
    }
    
    echo json_encode(['status' => 'success', 'message' => 'Importação do SSW concluída.', 'logs' => $logs]);

} catch(Exception $e) {
    $statusCode = ($e->getCode() > 0) ? $e->getCode() : 500;
    http_response_code($statusCode);
    error_log("Erro em importar_carregamentos_ssw.php: " . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

?>