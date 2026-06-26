<?php
  include 'lib/presto.php';
  include 'lib/pdf.php';
  include 'lib/ssw.php';

  $dominio = $argv[1];

  ssw_login ($dominio);

  errorlog ('Inicio do processamento');

  // Chama a 477 3 vezes... Uma para gerar relatorio de despesas incluidas nos ultimos 5 dias,
  // outra para gerar relatorio de despesas programadas para os proximos 30 dias, e mais uma
  // para buscar as canceladas
  $data_ini = date ('dmy', strtotime ('-5 days'));
  $data_fin = date ('dmy');

  if ($argv[2] != '') $data_ini = $argv[2];
  if ($argv[3] != '') $data_fin = $argv[3];

  $data_ini_pgto = date ('dmy');
  $data_fin_pgto = date ('dmy', strtotime ('+30 days'));

  if ($argv[4] != '') $data_ini_pgto = $argv[4];
  if ($argv[5] != '') $data_fin_pgto = $argv[5];

  $data_ini_canc = date ('dmy', strtotime ('-30 days'));
  $data_fin_canc = date ('dmy', strtotime ('+30 days'));

  if ($argv[6] != '') $data_ini_canc = $argv[6];
  if ($argv[7] != '') $data_fin_canc = $argv[7];

  $ini = 1;
  $fin = 3;

  // Tratamento para rodar uma vez ao dia, pegando tudo de pagamento de um mes pra tras, até um mes pra frente
  if ($argv[2] == 'TUDO')
  {
    $ini = 2;
    $fin = 3;

    $data_ini_pgto = date ('dmy', strtotime ('-50 days'));
    $data_fin_pgto = date ('dmy', strtotime ('+50 days'));

    $data_ini_canc = date ('dmy', strtotime ($argv[3]));
    $data_fin_canc = date ('dmy', strtotime ($argv[4]));

    sql ($g_sql, "DELETE FROM $dominio" . "_despesa WHERE data_pgto BETWEEN (current_date -49) AND (current_date +49) AND evento NOT IN (1111,2222)");
  }

  // Tratamento para importacao atravez do fluxo de caixa
  if ($argv[2] == 'FLUXO')
  {
    $ini = 2;
    $fin = 3;

    $data_ini_pgto = date ('dmy', strtotime ($argv[3]));
    $data_fin_pgto = date ('dmy', strtotime ($argv[4]));

    $data_ini_canc = date ('dmy', strtotime ($argv[3]));
    $data_fin_canc = date ('dmy', strtotime ($argv[4]));

    sql ($g_sql, "DELETE FROM $dominio" . "_despesa WHERE data_pgto BETWEEN '$argv[3]' AND '$argv[4]' AND evento NOT IN (1111,2222)");
  }

  for ($v = $ini; $v <= $fin; $v++)
  {
    if ($v == 1) $param = "?act=PES&cod_emp_ctb=00&data_ini_inclusao_despesa=$data_ini&data_fin_inclusao_despesa=$data_fin&sit_desp=T&sit_arq=T&sequencia=477";
    if ($v == 2) $param = "?act=PES&cod_emp_ctb=00&data_ini_pagamento_parcela=$data_ini_pgto&data_fin_pagamento_parcela=$data_fin_pgto&sit_desp=T&sit_arq=T&sequencia=477";
    if ($v == 3) $param = "?act=PES&cod_emp_ctb=00&data_ini_pagamento_parcela=$data_ini_canc&data_fin_pagamento_parcela=$data_fin_canc&sit_desp=C&sit_arq=T&sequencia=477";

    $str = ssw_go ("https://sistema.ssw.inf.br/bin/ssw0099$param");

//echo chr(10) . $str . chr (10);
    if (strpos ($str, 'N&atilde;o h&aacute; lan&ccedil;amento') !== false)
      continue;

    $str = substr ($str, strpos($str,'<xml'), strlen($str));
    $str = substr ($str, 0, strpos($str,'</xml>')) . '</xml>';
    $xml = simplexml_load_string($str);

    $count = count ($xml->xpath('rs/r/f0'));

    for ($i = 0; $i < $count; $i++)
    {
      //<f0>0114867-001</f0><f1>02/01/24</f1><f2>MTZ - MATRIZ</f2><f3>5203 - ALIMENTACAO</f3><f4>REFEIOES CAMAPUA</f4><f5>NATHAN HELTER BARBOSA RODRIGUES</f5><f6>000000001223</f6><f7>468,00</f7><f8>05/01/24</f8><f9>05/01/24</f9><f10></f10><f11>12/23</f11><f12>Liquidado</f12><f13></f13><f14>457152</f14>

      $despesa       = $xml->xpath('rs/r/f0')[$i];
      $data_inclusao = $xml->xpath('rs/r/f1')[$i];
      $unidade       = $xml->xpath('rs/r/f2')[$i];
      $evento        = $xml->xpath('rs/r/f3')[$i];
      $historico     = $xml->xpath('rs/r/f4')[$i];
      $fornecedor    = $xml->xpath('rs/r/f5')[$i];
      $nro_nf        = $xml->xpath('rs/r/f6')[$i];
      $vlr_parcela   = $xml->xpath('rs/r/f7')[$i];
      $data_vcto     = $xml->xpath('rs/r/f8')[$i];
      $data_pgto     = $xml->xpath('rs/r/f9')[$i];
      $status_desc   = $xml->xpath('rs/r/f12')[$i];

      $fornecedor = str_replace ("'", "", $fornecedor);

      $nro_lancto    = (int) explode ('-', $despesa)[0];
      $nro_parcela   = (int) explode ('-', $despesa)[1];
      $data_inclusao = str_replace ('/', '', $data_inclusao);
      $data_inclusao = strtodate ($data_inclusao);
      $sigla_unidade = substr ($unidade, 0, 3);
      $evento        = substr ($evento, 0, 4);
      $nro_nf        = (int) substr ($nro_nf, 0, 12);
      $vlr_parcela   = strtofloat ($vlr_parcela);
      $data_vcto     = str_replace ('/', '', $data_vcto);
      $data_vcto     = strtodate ($data_vcto);
      $data_pgto     = str_replace ('/', '', $data_pgto);
      $data_pgto     = strtodate ($data_pgto);

      $status = 'P';

      if ($status_desc == 'Liquidado')
        $status = 'L';

      if (($v == 1) || ($v == 2))
      {
        sql ($g_sql, "DELETE FROM $dominio" . "_despesa WHERE nro_lancto = $nro_lancto AND nro_parcela = $nro_parcela AND evento <> 1111");

        $perc_cargas    = 0;
        $perc_passagens = 0;

        if ($dominio == 'VCS')
          if (strpos ($historico, ']') !== false)
          if (strpos ($historico, '[') !== false)
          {
            $str2 = explode (']', $historico)[0];
            $str2 = explode ('[', $str2)[1];

            if (strpos ($str2, '/') !== false)
            {
              $str2 = str_replace ('//', '/', $str2);

              $perc_cargas    = (float) str_replace (',','.',explode ('/', $str2)[0]);
              $perc_passagens = (float) str_replace (',','.',explode ('/', $str2)[1]);
            }
          }

        $historico = str_replace ("'","",$historico);

        sql ($g_sql, "INSERT INTO $dominio" . "_despesa VALUES ($nro_lancto, $nro_parcela, '" . date ('Y-m-d', $data_inclusao) . "', " .
                     "'$sigla_unidade', $evento, '$fornecedor', $nro_nf, " . str_replace (',', '.', $vlr_parcela) . ", " .
                     "'" . date ('Y-m-d', $data_vcto) . "', '" . date ('Y-m-d', $data_pgto) . "', '$historico', '$status', $perc_cargas, $perc_passagens)");

        if ($v == 1)
          echo "Incluindo $count despesas cadastradas: " . fmtdec ($i / $count * 100, 2) . " %" . chr(13);
        else
          echo "Incluindo $count despesas programadas para os proximos dias: " . fmtdec ($i / $count * 100, 2) . " %" . chr(13);
      }
      else
      {
        sql ($g_sql, "DELETE FROM $dominio" . "_despesa WHERE nro_lancto = $nro_lancto AND nro_parcela = $nro_parcela AND evento <> 1111");
        echo "Cancelando $count despesas: " . fmtdec ($i / $count * 100, 2) . " %" . chr(13);
      }
    }

    echo chr(10);
  }

  if ($argv[2] == 'TUDO')  exit;
  if ($argv[2] == 'FLUXO') exit;

//exit;
  // Chama a 477 novamente para gerar relatorio de despesas liquidadas nos ultimos 5 dias
//$data_ini = '010824';
//$data_fin = '311024';

  $param = "?act=PES&cod_emp_ctb=00&data_ini_caixa=$data_ini&data_fin_caixa=$data_fin&sit_desp=L&sit_arq=T&sequencia=477";

  $str = ssw_go ("https://sistema.ssw.inf.br/bin/ssw0099$param");

  if (strpos ($str, 'N&atilde;o h&aacute; lan&ccedil;amento') !== false)
    exit;

  $str = substr ($str, strpos($str,'<xml'), strlen($str));
  $str = substr ($str, 0, strpos($str,'</xml>')) . '</xml>';
  $xml = simplexml_load_string($str);

  $count = count ($xml->xpath('rs/r/f0'));

  for ($i = 0; $i < count ($xml->xpath('rs/r')); $i++)
  {
    $despesa       = $xml->xpath('rs/r/f0')[$i];
    $nro_lancto    = (int) explode ('-', $despesa)[0];
    $nro_parcela   = (int) explode ('-', $despesa)[1];

    sql ($g_sql, "UPDATE $dominio" . "_despesa SET status = 'L' WHERE nro_lancto = $nro_lancto AND nro_parcela = $nro_parcela");

    echo "Liquidando $count despesas: " . fmtdec ($i / $count * 100, 2) . " %" . chr(13);
  }

  echo chr(10);
