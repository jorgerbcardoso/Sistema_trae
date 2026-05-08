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

    $data_ini = date ('dmy');
    $data_fin = date ('dmy');
    $cnpj     = '';

    if ($argv[1] != '') $data_ini = $argv[1];
    if ($argv[2] != '') $data_fin = $argv[2];
    if ($argv[3] != '') $cnpj     = $argv[3];

    // Comanda a 455
    $param = "act=" . "ENV" .
             "&f1=" . $data_ini .
             "&f2=" . $data_fin .
             "&f3=" . "T" .
             "&f8=" . $cnpj .
             "&f9=" . "C";

    $str = ssw_go ("https://sistema.ssw.inf.br/bin/ssw0846?$param");
    echo $str . "\n";
    echo "930 comandada ($data_ini a $data_fin). Aguarde alguns minutos para consumir a planilha.\n\n";
  }
