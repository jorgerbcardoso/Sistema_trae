<?php
require_once __DIR__ . '/../../config.php';
require_once '/var/www/html/lib/ssw.php';

function getCtesDisponiveis($sigla, $domain) {
    ssw_login($domain);
    set_time_limit(60);

    $str0083 = ssw_go('https://sistema.ssw.inf.br/bin/ssw0083?act=REL&f1=C&f3=' . strtolower($sigla) . '&f17=N');
    $str0083 = urldecode($str0083);
    $act0083 = ssw_get_act($str0083);
    $arq0083 = ssw_get_arq($str0083);
    $file0083 = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act0083 . '&filename=' . $arq0083 . '&path=&down=1&nw=0');
    $linhas0083 = explode ("\n", $file0083);

    ssw_go('https://sistema.ssw.inf.br/bin/menu01?act=TRO&f2=' . urlencode($sigla) . '&f3=101');

    $agora        = time();
    $agora12h     = $agora + (12 * 3600);
    $dataPrevMan  = date('dmy', $agora12h);
    $horaPrevMan  = date('Hi', $agora12h);
    $dataEmitCte  = date('dmy', $agora);
    $horaEmitCte  = date('Hi', $agora);

    $url0036 = 'https://sistema.ssw.inf.br/bin/ssw0036?act=ENV'
        . '&l_siglas_familia=' . urlencode($sigla)
        . '&data_prev_man='    . $dataPrevMan
        . '&hora_prev_man='    . $horaPrevMan
        . '&data_emit_ctrc='   . $dataEmitCte
        . '&hora_emit_ctrc='   . $horaEmitCte
        . '&status_ctrc=C&ctrc_pendente=T&lista_pendencias=N&apenas_descarregados=T'
        . '&lista_reversa=T&apenas_prioritarios=T&id_tp_produto=T&fg_enderecados=T'
        . '&relacionar_produtos=N&relatorio_excel=N'
        . '&button_env_enable=ENV&button_env_disable=btn_envia';

    $str = ssw_go($url0036);

    if (substr($str, 0, 5) === '<foc ') {
        throw new Exception('Erro SSW (0036): ' . $str);
    }

    $str     = urldecode($str);
    $act     = ssw_get_act($str);
    $arq     = ssw_get_arq($str);
    $file    = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act . '&filename=' . $arq . '&path=&down=1&nw=0');
    return explode("\r", $file);
}
