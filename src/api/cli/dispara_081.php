<?php
include 'lib/presto.php';
include 'lib/ssw.php';

$agora       = time();
$agora12h    = $agora + (12 * 3600);
$dataPrevMan = date('dmy', $agora12h);
$horaPrevMan = date('Hi', $agora12h);

$result = sql($g_sql, "SELECT domain FROM domains WHERE domain NOT IN ('XXX','EVI') AND is_active = true ORDER BY domain");

$dominios = [];
while ($row = pg_fetch_array($result)) {
    $dominios[] = $row['domain'];
}

echo "========================================\n";
echo "DISPARANDO RELATÓRIO 081 (ssw0052)\n";
echo "Data/hora prevista: $dataPrevMan $horaPrevMan\n";
echo "========================================\n\n";

foreach ($dominios as $dominio) {
    echo "Domínio $dominio: ";

    ssw_login($dominio);

    $url0052 = 'https://sistema.ssw.inf.br/bin/ssw0052?act=ENV'
        . '&data_prev_man='      . $dataPrevMan
        . '&hora_prev_man='      . $horaPrevMan
        . '&tp_cliente_pag=T'
        . '&tp_pessoa_dest=A'
        . '&status_ctrc=C'
        . '&ent_dificil=T'
        . '&ctrc_pendente=T'
        . '&lista_pendencias=N'
        . '&lista_descarregados=T'
        . '&unid_dest_final=T'
        . '&lista_reversa=T'
        . '&a_so_agend_obrig=T'
        . '&apenas_prioritarios=T'
        . '&id_tp_produto=T'
        . '&fg_enderecados=T'
        . '&relacionar_produtos=N'
        . '&relatorio_excel=N'
        . '&button_env_enable=ENV';

    $str = ssw_go($url0052);

    if (substr($str, 0, 5) === '<foc ') {
        echo "ERRO: $str\n";
    } else {
        echo "OK\n";
    }
}

echo "\nConcluído em " . date('d/m/Y H:i:s') . "\n";
