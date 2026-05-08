<?php
  include 'lib/presto.php';
  include 'lib/pdf.php';
  include 'lib/ssw.php';

  $result = sql ($g_sql, "SELECT domain FROM domains WHERE domain not in ('XXX','EVI') ORDER BY domain");

  while ($row = pg_fetch_array ($result))
  {
    $dominio = $row['domain'];

    echo "Domínio $dominio:\n";

    ssw_login ($dominio);

    // Agora vamos buscar a planilha da 930 na 156
    $str = ssw_go ('https://sistema.ssw.inf.br/bin/ssw1440'); // Comanda a 156

    $str = substr ($str, strpos($str,'<xml'), strlen($str));
    $str = substr ($str, 0, strpos($str,'</xml>')) . '</xml>';
    $xml = simplexml_load_string($str);

    for ($i = 0; $i <= 100; $i++)
    {
      $seq = $xml->xpath('rs/r/f0')[$i];
      $opc = $xml->xpath('rs/r/f1')[$i];
      $usr = $xml->xpath('rs/r/f3')[$i];
      $sit = $xml->xpath('rs/r/f6')[$i];

      $usr = trim ($usr);

      if ((substr ($opc, 0, 3) == '930') && (($usr == 'presto') || ($usr == 'damasce1')) && ($sit == 'Conclu&iacute;do'))
      {
        echo "Arquivo encontrado. Iniciando importação.\n";

        $arq = "$dominio" . fmtnum ((int) $seq, 9) . '.csv';

        $pla = ssw_go ("https://sistema.ssw.inf.br/bin/ssw0424?act=$arq&filename=$arq&path=/usr/aws/jobs/$dominio/&down=1&nw=1");

        $pla = str_replace (chr(0xa0), '', $pla);
        $fil_arr = explode ("\r", $pla);
        $count   = count ($fil_arr);

        for ($i = 0; $i < ($count -1); $i++)
        {
          echo "Processando $i de $count registros: " . fmtdec ($i / $count * 100, 2) . " %" . chr(13);

          $line = str_replace (chr(10),'',$fil_arr[$i]);
          $arr = explode (";", $line);

          if ($arr[0] != '1') continue;

          $cte              = $arr[1];
          $data_emissao     = $arr[2];
          $unidade          = $arr[9];
          $data_inclusao    = $arr[10];
          $hora_inclusao    = $arr[11];
          $data_ocorrencia  = $arr[12];
          $hora_ocorrencia  = $arr[13];
          $login            = $arr[14];
          $codigo           = (int) $arr[15];
          $complemento      = $arr[17];
          $data_entrega     = $arr[18];

          $ser_cte = substr ($cte, 0, 3);
          $nro_cte = substr ($cte, 3);

          $data_emissao    = strtodate ($data_emissao);
          $data_inclusao   = strtodate ($data_inclusao);
          $data_ocorrencia = strtodate ($data_ocorrencia);
          $data_entrega    = strtodate ($data_entrega);

          if ($codigo == 0) $codigo = "ult_ocor";

          $ult_ocor_agend = "ult_ocor_agend";
          $data_prev_ent  = "data_prev_ent";

          if (($codigo == 14) || ($codigo == 15)) $ult_ocor_agend = $codigo;

          // Tratamento de agendamentos
          if ($codigo == 15)
          {
            // Exemplo de complemento: ENTREGA AGENDADA P/ 24/04/26 15:00 - CONTATO TORN, FONE 9119.
            $data_prev_ent = substr ($complemento, 20, 8);
            $data_prev_ent = "'" . date ('Y-m-d', strtodate ($data_prev_ent)) . "'";
          }

          // Converter data e hora da ocorrência para timestamp
          $data_ocorrencia_ts = date('Y-m-d H:i:s', strtotime($data_ocorrencia . ' ' . $hora_ocorrencia));

          // Localiza o cte
          $result2 = sql ($g_sql, "SELECT seq_cte, ult_ocor, data_ult_ocor, hora_ult_ocor, ult_ocor_agend, data_ult_ocor_agend, hora_ult_ocor_agend 
                                   FROM $dominio" . "_cte WHERE ser_cte = '$ser_cte' AND nro_cte = $nro_cte ORDER BY seq_cte DESC");

          if (pg_num_rows ($result2) == 0) continue;

          $row2 = pg_fetch_array ($result2);

          $seq_cte = pg_geti ($row2, 'seq_cte');
          
          $ult_ocor_atual = pg_geti ($row2, 'ult_ocor');
          $data_ult_ocor_atual = pg_geti ($row2, 'data_ult_ocor');
          $hora_ult_ocor_atual = pg_geti ($row2, 'hora_ult_ocor');
          $ult_ocor_agend_atual = pg_geti ($row2, 'ult_ocor_agend');
          $data_ult_ocor_agend_atual = pg_geti ($row2, 'data_ult_ocor_agend');
          $hora_ult_ocor_agend_atual = pg_geti ($row2, 'hora_ult_ocor_agend');

          // Construir data/hora atual da ocorrência no banco
          $data_ult_ocor_ts = null;
          if ($data_ult_ocor_atual && $hora_ult_ocor_atual) {
            $data_ult_ocor_ts = date('Y-m-d H:i:s', strtotime($data_ult_ocor_atual . ' ' . $hora_ult_ocor_atual));
          }

          // Só atualizar se a nova ocorrência for mais recente
          $atualizar = false;
          if ($data_ult_ocor_ts === null || $data_ocorrencia_ts > $data_ult_ocor_ts) {
            $atualizar = true;
          }

          if ($atualizar) {
            // Determinar ult_ocor_agend
            $ult_ocor_agend = $ult_ocor_agend_atual;
            if (($codigo == 14) || ($codigo == 15)) {
              $ult_ocor_agend = $codigo;
            }

            // Determinar data_prev_ent
            $data_prev_ent = 'NULL';
            if ($codigo == 15) {
              $data_prev_ent = "'" . date ('Y-m-d', strtodate ($data_prev_ent)) . "'";
            }

            // Determinar data e hora da ocorrência agendada
            $data_ult_ocor_agend = 'NULL';
            $hora_ult_ocor_agend = 'NULL';
            if ($ult_ocor_agend != $ult_ocor_agend_atual) {
              $data_ult_ocor_agend = "'" . date('Y-m-d', $data_ocorrencia) . "'";
              $hora_ult_ocor_agend = "'" . $hora_ocorrencia . "'";
            }

            // Update inteligente - só atualiza se houver mudança
            $sql_update = "UPDATE $dominio" . "_cte SET 
                           ult_ocor = $codigo,
                           data_ult_ocor = '" . date('Y-m-d', $data_ocorrencia) . "',
                           hora_ult_ocor = '$hora_ocorrencia',
                           ult_ocor_agend = $ult_ocor_agend,
                           data_ult_ocor_agend = $data_ult_ocor_agend,
                           hora_ult_ocor_agend = $hora_ult_ocor_agend,
                           data_prev_ent = $data_prev_ent
                     WHERE seq_cte = $seq_cte";

            sql ($g_sql, $sql_update);
          }

          sql ($g_sql, "INSERT INTO $dominio" . "_cte_ocorrencia VALUES ($seq_cte, " .
                                                                   "'" . $unidade                         . "', " .
                                                                   "'" . date ('Y-m-d', $data_inclusao)   . "', " .
                                                                   "'" . $hora_inclusao                   . "', " .
                                                                   "'" . date ('Y-m-d', $data_ocorrencia) . "', " .
                                                                   "'" . $hora_ocorrencia                 . "', " .
                                                                   "'" . $login                           . "', " .
                                                                         $codigo                          . ",  " .
                                                                   "'" . $complemento                     . "') ON CONFLICT DO NOTHING");
        }

        echo "\n\n";

        break;
      }
    }
  }
