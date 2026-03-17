<?php
/**
 * ================================================================
 * SCRIPT: IMPORTAÇÃO DIÁRIA DE COLETAS DO SSW
 * ================================================================
 * Importa coletas do SSW0157 e armazena na base PostgreSQL
 *
 * EXECUÇÃO VIA CRONTAB:
 * php imp_coleta.php DOMINIO DATA_INI DATA_FIN
 *
 * EXEMPLO:
 * php imp_coleta.php ACV 010125 310125
 *
 * ARGUMENTOS:
 * $argv[1] = DOMINIO (ex: ACV, JOI, CWB)
 * $argv[2] = DATA_INI no formato dmy (ex: 010125 = 01/01/2025)
 * $argv[3] = DATA_FIN no formato dmy (ex: 310125 = 31/01/2025)
 * ================================================================
 */

// ================================================================
// INCLUDES
// ================================================================
require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/lib/ssw.php';

$dominio  = strtoupper($argv[1]);
$data_ini = $argv[2];
$data_fin = $argv[3];

if ($data_ini == '')
{
  $data_ini = date ('dmy', strtotime ('-1 days'));
  $data_fin = date ('dmy');
}

// Validar formato das datas (6 dígitos)
if (strlen($data_ini) != 6 || strlen($data_fin) != 6 || !is_numeric($data_ini) || !is_numeric($data_fin)) {
    echo "❌ ERRO: Datas devem estar no formato dmy com 6 dígitos (ex: 010125)\n";
    exit(1);
}

echo "================================================================\n";
echo "IMPORTAÇÃO DE COLETAS - SISTEMA PRESTO\n";
echo "================================================================\n";
echo "Domínio:      $dominio\n";
echo "Período:      $data_ini a $data_fin\n";
echo "Data/Hora:    " . date('d/m/Y H:i:s') . "\n";
echo "================================================================\n\n";

ssw_login($dominio);
$g_sql = connect();

// Troca a unidade para matriz no SSW
$str = ssw_go ('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=MTZ&f3=101');

// ================================================================
// BUSCAR COLETAS DO SSW0166
// ================================================================
echo "🔄 Buscando coletas do SSW0166...\n";
echo "   Período cadastro: TODOS\n";
echo "   Período coleta: $data_ini a $data_fin\n";
echo "   Unidade: TODAS\n\n";

try {
    // Montar parâmetros do SSW0166
    $param = "act=FIL_COL" .
             "&f2=$dominio" .                 // Dominio
             "&f14=$data_ini&f15=$data_fin" . // Período de cadastro
             "&f16=I" .                       // Por data de inclusao
             "&f17=E" .                       // Excel
             "&f19=";                         // Unidade vazia = TODAS

    // Chamar SSW0166
    $str = ssw_go('https://sistema.ssw.inf.br/bin/ssw0166?' . $param);

    // Verificar se não há movimento
    if (strpos($str, 'Sem movimento de coletas para') !== false) {
        echo "⚠️  Nenhuma coleta encontrada no período.\n";
        echo "✅ Importação finalizada (0 coletas)\n";
        exit(0);
    }

    // Verificar erros
    if (strpos($str, '<input type=hidde') === false) {
        echo "❌ ERRO na resposta do SSW: " . substr($str, 0, 200) . "\n";
        exit(1);
    }

    $str = urldecode($str);
    $act = ssw_get_act($str);
    $arq = ssw_get_arq($str);

    // Baixar arquivo do relatório
    echo "📄 Baixando relatório do SSW...\n";
    $file = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act . '&filename=' . $arq . '&path=&down=1&nw=0');
    $fil_arr = explode("\r", $file);
    $count = count($fil_arr);

    echo "✅ Relatório baixado: $count linhas\n\n";
} catch (Exception $e) {
    echo "❌ ERRO ao buscar dados do SSW: " . $e->getMessage() . "\n";
    exit(1);
}

  for ($i = 0; $i < ($count - 1); $i++)
  {
    $line = str_replace(chr(10), '', $fil_arr[$i]);

    $arr = explode (";", $line);

    if ($arr[0] != '3') continue;

    $unidade              = $arr[1];
    $nro_coleta           = $arr[2];
    $data_inclusao        = $arr[3];
    $hora_inclusao        = $arr[4];
    $solicitante          = $arr[6];
    $nome_emit            = $arr[7];
    $cnpj_emit            = substr ($arr[8], 0, 14);
    $endereco_emit        = $arr[9];
    $bairro_emit          = $arr[10];
    $cidade_emit          = $arr[11];
    $uf_emit              = $arr[12];
    $setor                = $arr[13];
    $cep_emit             = $arr[14];
    $cnpj_dest            = $arr[19];
    $peso     = strtofloat ($arr[25]);
    $qtde_vol             = $arr[27];
    $vlr_merc = strtofloat ($arr[28]);
    $data_limite          = $arr[30];
    $hora_limite          = $arr[31];
    $data_efetivacao      = $arr[32];
    $hora_efetivacao      = $arr[33];
    $situacao             = $arr[34];
    $placa                = $arr[36];
    $observacao           = $arr[44] . ' ' . $arr[45] . ' ' . $arr[46];

    // Trata datas
    if (trim ($data_inclusao) == '')
    {
      $data_inclusao = $data_limite;
      $hora_inclusao = '12:00';
    }

    $data_inclusao = str_replace ('/20', '/', $data_inclusao);
    $data_inclusao = "'" . date ('Y-m-d', strtodate (str_replace ("/", "", $data_inclusao))) . "'";
    $data_limite   = str_replace ('/20', '/', $data_limite);
    $data_limite   = "'" . date ('Y-m-d', strtodate (str_replace ("/", "", $data_limite))) . "'";

    if (trim ($data_efetivacao) == '')
    {
      $data_efetivacao = "NULL";
      $hora_efetivacao = "NULL";
    }
    else
    {
      $data_efetivacao = str_replace ('/20', '/', $data_efetivacao);
      $data_efetivacao = "'" . date ('Y-m-d', strtodate (str_replace ("/", "", $data_efetivacao))) . "'";
      $hora_efetivacao = "'$hora_efetivacao'";
    }

    // Trata situacoes
    if ($situacao == 'PRE-CADASTRADA') $situacao = '9';
    if ($situacao == 'CADASTRADA')     $situacao = '0';
    if ($situacao == 'COMANDADA')      $situacao = '1';
    if ($situacao == 'COLETADA')       $situacao = '2';
    if ($situacao == 'CANCELADA')      $situacao = '3';

    if (strlen ($cnpj_dest) < 5) $cnpj_dest = ''; else $cnpj_dest = substr ($cnpj_dest, 0, 14);

    // Remove aspas simples das strings
    $nome_emit     = str_replace ("'", "", $nome_emit);
    $endereco_emit = str_replace ("'", "", $endereco_emit);
    $bairro_emit   = str_replace ("'", "", $bairro_emit);
    $cidade_emit   = str_replace ("'", "", $cidade_emit);
    $solicitante   = str_replace ("'", "", $solicitante);
    $observacao    = str_replace ("'", "", $observacao);

    // Coletas pre-cadastradas nao tem hora limite
    if (trim ($hora_limite) == '') $hora_limite = '17:00';

    // Insere a coleta
    sql ($g_sql, "DELETE FROM $dominio" . "_coleta WHERE unidade = '$unidade' AND nro_coleta = '$nro_coleta'");

    sql ($g_sql, "INSERT INTO $dominio" . "_coleta VALUES ('$unidade', '$nro_coleta', $data_limite, '$hora_limite', " .
                                                          "'$cnpj_emit', '$nome_emit', '$endereco_emit', '$bairro_emit', " .
                                                          "'$cep_emit', '$cidade_emit', '$uf_emit', '$setor', " .
                                                          "'$cnpj_dest', '$solicitante', '$situacao', $vlr_merc, " .
                                                          " $qtde_vol, $peso, '$placa', '$observacao', $data_inclusao, " .
                                                          "'$hora_inclusao', $data_efetivacao, $hora_efetivacao)");

    echo "Processando coletas: " . fmtdec ($i / $count * 100, 2) . " %" . chr(13);
  }

  echo chr(10);