<?php
/**
 * CLI Script - Processa relatório 930
 * Dispara solicitação, importa o resultado e organiza as ocorrências
 *
 * Uso: php processa_930.php [data_ini] [data_fin] [S]
 * Exemplo: php processa_930.php 010426 060526
 * Se o 3º parâmetro for 'S', apenas organiza as ocorrências (pula importação)
 */

include 'lib/presto.php';
include 'lib/pdf.php';
include 'lib/ssw.php';

// Receber parâmetros
$data_ini = date('dmy');
$data_fin = date('dmy');
$apenas_organizar = false;

if ($argv[1] != '') $data_ini = $argv[1];
if ($argv[2] != '') $data_fin = $argv[2];
if ($argv[3] == 'S') $apenas_organizar = true;

if (!$apenas_organizar) {
    echo "========================================\n";
    echo "DISPARANDO SOLICITAÇÕES DO 930\n";
    echo "========================================\n\n";

    $result = sql($g_sql, "SELECT domain FROM domains WHERE domain NOT IN ('XXX','EVI') AND is_active = true ORDER BY domain");

    $dominios = [];
    while ($row = pg_fetch_array($result)) {
        $dominios[] = $row['domain'];
    }

    echo "Domínios encontrados: " . count($dominios) . "\n\n";

    foreach ($dominios as $dominio) {
        echo "Domínio $dominio: ";

        ssw_login($dominio);

        $param = "act=" . "ENV" .
                 "&f1=" . $data_ini .
                 "&f2=" . $data_fin .
                 "&f3=" . "T" .
                 "&f9=" . "C";

        $str = ssw_go("https://sistema.ssw.inf.br/bin/ssw0846?$param");

        if (strpos($str, 'Erro') !== false) {
            echo "ERRO ao comandar 930\n";
        } else {
            echo "930 comandada ($data_ini a $data_fin)\n";
        }
    }

    echo "\n========================================\n";
    echo "AGUARDANDO 1 MINUTO E MEIO PARA OS RELATÓRIOS\n";
    echo "========================================\n\n";

    sleep(90);
}

echo "========================================\n";
echo "IMPORTANDO E ORGANIZANDO RELATÓRIOS DO 930\n";
echo "========================================\n\n";

$result = sql($g_sql, "SELECT domain FROM domains WHERE domain NOT IN ('XXX','EVI') AND is_active = true ORDER BY domain");

$dominios = [];
while ($row = pg_fetch_array($result)) {
    $dominios[] = $row['domain'];
}

foreach ($dominios as $dominio) {
    echo "Domínio $dominio:\n";

    if (!$apenas_organizar) {
        ssw_login($dominio);

        $str = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');

        $str = substr($str, strpos($str,'<xml'), strlen($str));
        $str = substr($str, 0, strpos($str,'</xml>')) . '</xml>';
        $xml = simplexml_load_string($str);

        $encontrado = false;

        for ($i = 0; $i <= 100; $i++) {
            $seq = $xml->xpath('rs/r/f0')[$i];
            $opc = $xml->xpath('rs/r/f1')[$i];
            $usr = $xml->xpath('rs/r/f3')[$i];
            $sit = $xml->xpath('rs/r/f6')[$i];

            $usr = trim($usr);

            if ((substr($opc, 0, 3) == '930') && (($usr == 'presto') || ($usr == 'damasce1')) && ($sit == 'Conclu&iacute;do')) {
                $encontrado = true;
                echo "Arquivo encontrado. Iniciando importação.\n";

                $arq = "$dominio" . fmtnum((int)$seq, 9) . '.csv';

                $pla = ssw_go("https://sistema.ssw.inf.br/bin/ssw0424?act=$arq&filename=$arq&path=/usr/aws/jobs/$dominio/&down=1&nw=1");

                $pla = str_replace(chr(0xa0), '', $pla);

                file_put_contents("c:/Users/Usuário/OneDrive/Drive/Presto/Sistema/src/api/cli/planilha_debug_$dominio.csv", $pla);

                $fil_arr = explode("\r", $pla);
                $count = count($fil_arr);

                for ($j = 0; $j < ($count - 1); $j++) {
                    echo "Processando $j de $count registros: " . fmtdec($j / $count * 100, 2) . " %" . chr(13);

                    $line = str_replace(chr(10), '', $fil_arr[$j]);
                    $arr = str_getcsv($line, ';');

                    if ($arr[0] != '1') continue;

                    $cte = $arr[1];
                    $data_emissao = $arr[2];
                    $unidade = $arr[9];
                    $data_inclusao = $arr[10];
                    $hora_inclusao = $arr[11];
                    $data_ocorrencia = $arr[12];
                    $hora_ocorrencia = $arr[13];
                    $login = $arr[14];
                    $codigo = (int)$arr[15];
                    $complemento = $arr[17];
                    $data_entrega = $arr[18];

                    $ser_cte = substr($cte, 0, 3);
                    $nro_cte = substr($cte, 3, 6);

                    $data_emissao = strtodate($data_emissao);
                    $data_inclusao = strtodate($data_inclusao);
                    $data_ocorrencia = strtodate($data_ocorrencia);
                    $data_entrega = strtodate($data_entrega);

                    $result2 = sql($g_sql, "SELECT seq_cte FROM $dominio" . "_cte WHERE ser_cte = '$ser_cte' AND nro_cte = $nro_cte ORDER BY seq_cte DESC");

                    if (pg_num_rows($result2) == 0) continue;

                    $row2 = pg_fetch_array($result2);

                    $seq_cte = pg_gets($row2, 'seq_cte');

                    sql($g_sql, "INSERT INTO $dominio" . "_cte_ocorrencia VALUES ($seq_cte, " .
                                                                             "'" . $unidade . "', " .
                                                                             "'" . date('Y-m-d', $data_inclusao) . "', " .
                                                                             "'" . $hora_inclusao . "', " .
                                                                             "'" . date('Y-m-d', $data_ocorrencia) . "', " .
                                                                             "'" . $hora_ocorrencia . "', " .
                                                                             "'" . $login . "', " .
                                                                                   $codigo . ",  " .
                                                                             "'" . $complemento . "') ON CONFLICT DO NOTHING");

                    $data_entrega_str = $data_entrega > 0 ? "'" . date('Y-m-d', $data_entrega) . "'" : 'NULL';
                    sql($g_sql, "UPDATE $dominio" . "_cte SET data_entrega = $data_entrega_str WHERE seq_cte = $seq_cte");
                }

                echo "\n\n";

                break;
            }
        }

        if (!$encontrado) {
            echo "Nenhum arquivo 930 concluído encontrado.\n\n";
        }
    }

    echo "========================================\n";
    echo "ORGANIZANDO OCORRÊNCIAS DO DOMÍNIO $dominio\n";
    echo "========================================\n\n";

    $data_ini_fmt = date('Y-m-d', strtodate($data_ini));
    $data_fin_fmt = date('Y-m-d', strtodate($data_fin));

    $result3 = sql($g_sql, "SELECT DISTINCT seq_cte FROM $dominio" . "_cte_ocorrencia WHERE data_inclusao BETWEEN '$data_ini_fmt' AND '$data_fin_fmt' ORDER BY seq_cte");

    $total = pg_num_rows($result3);
    $cont = 0;

    while ($row3 = pg_fetch_array($result3)) {
        $cont++;
        echo "Organizando $cont de $total CT-es: " . fmtdec($cont / $total * 100, 2) . " %" . chr(13);

        $seq_cte = pg_gets($row3, 'seq_cte');

        $result4 = sql($g_sql, "SELECT o.* FROM $dominio" . "_cte_ocorrencia o INNER JOIN $dominio" . "_ocorrencia oc ON o.codigo = oc.codigo WHERE o.seq_cte = $seq_cte AND (oc.tipo != 'I' OR o.codigo IN (14, 15)) ORDER BY o.data_ocorrencia DESC, o.hora_ocorrencia DESC");

        $row4 = pg_fetch_array($result4);

        $ult_ocor = null;
        $data_ult_ocor = null;
        $hora_ult_ocor = null;

        if (pg_num_rows($result4) > 0) {
            $ult_ocor = (int)pg_gets($row4, 'codigo');
            $data_ult_ocor = pg_gets($row4, 'data_ocorrencia');
            $hora_ult_ocor = pg_gets($row4, 'hora_ocorrencia');
        }

        $result4_agend = sql($g_sql, "SELECT o.* FROM $dominio" . "_cte_ocorrencia o INNER JOIN $dominio" . "_ocorrencia oc ON o.codigo = oc.codigo WHERE o.seq_cte = $seq_cte AND o.codigo IN (14, 15) ORDER BY o.data_ocorrencia DESC, o.hora_ocorrencia DESC");

        $ult_ocor_agend = null;
        $data_ult_ocor_agend = null;
        $hora_ult_ocor_agend = null;
        $complemento_agend = null;

        if (pg_num_rows($result4_agend) > 0) {
            $row4_agend = pg_fetch_array($result4_agend);
            $ult_ocor_agend = (int)pg_gets($row4_agend, 'codigo');
            $data_ult_ocor_agend = pg_gets($row4_agend, 'data_ocorrencia');
            $hora_ult_ocor_agend = pg_gets($row4_agend, 'hora_ocorrencia');
            $complemento_agend = pg_gets($row4_agend, 'complemento');
        }

        $result5 = sql($g_sql, "SELECT ult_ocor, data_ult_ocor, hora_ult_ocor, ult_ocor_agend, data_ult_ocor_agend, hora_ult_ocor_agend FROM $dominio" . "_cte WHERE seq_cte = $seq_cte");

        if (pg_num_rows($result5) > 0) {
            $row5 = pg_fetch_array($result5);

            $data_ult_ocor_atual   = pg_gets($row5, 'data_ult_ocor');
            $hora_ult_ocor_atual   = pg_gets($row5, 'hora_ult_ocor');
            $data_ult_ocor_agend_atual = pg_gets($row5, 'data_ult_ocor_agend');
            $hora_ult_ocor_agend_atual = pg_gets($row5, 'hora_ult_ocor_agend');

            $ts_ocor_banco = ($data_ult_ocor_atual && $hora_ult_ocor_atual)
                ? strtotime($data_ult_ocor_atual . ' ' . $hora_ult_ocor_atual)
                : null;

            $ts_ocor_nova = ($data_ult_ocor && $hora_ult_ocor)
                ? strtotime($data_ult_ocor . ' ' . $hora_ult_ocor)
                : null;

            $ts_agend_banco = ($data_ult_ocor_agend_atual && $hora_ult_ocor_agend_atual)
                ? strtotime($data_ult_ocor_agend_atual . ' ' . $hora_ult_ocor_agend_atual)
                : null;

            $ts_agend_nova = ($data_ult_ocor_agend && $hora_ult_ocor_agend)
                ? strtotime($data_ult_ocor_agend . ' ' . $hora_ult_ocor_agend)
                : null;

            $atualizar_ocor  = $ts_ocor_banco === null  || ($ts_ocor_nova  !== null && $ts_ocor_nova  > $ts_ocor_banco);
            $atualizar_agend = $ts_agend_banco === null || ($ts_agend_nova !== null && $ts_agend_nova > $ts_agend_banco);

            $campos = [];

            if ($atualizar_ocor && $ult_ocor !== null) {
                $campos[] = "ult_ocor = $ult_ocor";
                $campos[] = "data_ult_ocor = '$data_ult_ocor'";
                $campos[] = "hora_ult_ocor = '$hora_ult_ocor'";
            }

            if ($atualizar_agend && $ult_ocor_agend !== null) {
                $campos[] = "ult_ocor_agend = $ult_ocor_agend";
                $campos[] = "data_ult_ocor_agend = '$data_ult_ocor_agend'";
                $campos[] = "hora_ult_ocor_agend = '$hora_ult_ocor_agend'";

                if ($ult_ocor_agend == 15 && $complemento_agend !== null && $complemento_agend != '') {
                    $data_prev_ent_str = substr($complemento_agend, 20, 8);
                    if ($data_prev_ent_str !== false && $data_prev_ent_str != '') {
                        $ts_prev = strtodate($data_prev_ent_str);
                        if ($ts_prev > 0) {
                            $campos[] = "data_prev_ent = '" . date('Y-m-d', $ts_prev) . "'";
                        }
                    }
                }
            }

            if (!empty($campos)) {
                sql($g_sql, "UPDATE $dominio" . "_cte SET " . implode(', ', $campos) . " WHERE seq_cte = $seq_cte");
            }
        }
    }

    echo "\n\n";
}

echo "========================================\n";
echo "PROCESSAMENTO CONCLUÍDO\n";
echo "========================================\n";
