<?php
/**
 * CLI Script - Processa relatório 930
 *
 * Responsabilidades:
 *   1) Solicitar o relatório 930 (quando necessário)
 *   2) Importar SOMENTE as ocorrências para <dominio>_cte_ocorrencia
 *   3) Organizar os CT-es a partir das ocorrências já gravadas
 *
 * IMPORTANTE:
 * - A importação NÃO altera mais campos derivados do CT-e.
 * - Toda alteração do estado do CT-e acontece na etapa de organização.
 * - Existem duas cronologias independentes:
 *     a) cronologia geral:
 *        ult_ocor / data_ult_ocor / hora_ult_ocor
 *     b) cronologia de agendamento:
 *        ult_ocor_agend / data_ult_ocor_agend / hora_ult_ocor_agend
 * - Uma ocorrência mais antiga que a cronologia correspondente NÃO altera o CT-e.
 * - Informativa comum só avança a cronologia geral se a última ocorrência
 *   aceita também for informativa (ou se ainda não houver última ocorrência).
 * - Os cinco códigos especiais de emp_param são exceções a essa restrição.
 *
 * Exemplos de uso via CLI:
 *
 * Para apenas processar ocorrencias que jah estao no banco
 * php processa_930.php TOP 170626 170626 S N
 *
 * Para fazer o processo completo, com o arquivo já pronto na 156
 * php processa_930.php TOP 170626 170626 N S
 */

include 'lib/presto.php';
include 'lib/pdf.php';
include 'lib/ssw.php';


/**
 * Escapa texto para uso em literal SQL.
 *
 * Mantido em PHP para não exigir functions/procedures no banco.
 */
function sql_text($valor)
{
    return str_replace("'", "''", (string)$valor);
}


/**
 * Converte data + hora do PostgreSQL para timestamp PHP.
 *
 * Retorna NULL quando não houver uma data/hora válida.
 */
function ocorrencia_timestamp($data, $hora)
{
    $data = trim((string)$data);
    $hora = trim((string)$hora);

    if ($data == '' || $hora == '')
        return null;

    if (preg_match('/^\d{2}:\d{2}:\d{2}/', $hora, $m))
        $hora = $m[0];

    $ts = strtotime($data . ' ' . $hora);

    return ($ts === false) ? null : $ts;
}


/**
 * Extrai a previsão de entrega do complemento de uma ocorrência de agendamento.
 *
 * Preserva a regra existente no script original:
 * - quando contém "ENTREGA AGENDADA P/", a data começa na posição 20;
 * - caso contrário, para a ocorrência padrão de agendamento, começa na posição 55.
 *
 * Retorna a data no formato Y-m-d ou NULL se não conseguir interpretá-la.
 */
function extrair_data_previsao($complemento, $codigo, $ocor_agendamento)
{
    $complemento = (string)$complemento;

    if (($codigo != $ocor_agendamento) &&
        (strpos($complemento, 'ENTREGA AGENDADA P/') === false))
        return null;

    if (strpos($complemento, 'ENTREGA AGENDADA P/') !== false)
        $data_prev_ent_str = substr($complemento, 20, 8);
    else
        $data_prev_ent_str = substr($complemento, 55, 8);

    $data_prev_ent_str = str_replace('/', '', trim($data_prev_ent_str));

    if ($data_prev_ent_str == '')
        return null;

    $ts = strtodate($data_prev_ent_str);

    if (!$ts || $ts <= 0)
        return null;

    return date('Y-m-d', $ts);
}


// -----------------------------------------------------------------------------
// PARÂMETROS
// -----------------------------------------------------------------------------

$dominio_inf      = '';
$data_ini         = date('dmy');
$data_fin         = date('dmy');
$apenas_organizar = false;
$relatorio_pronto = false;

if (isset($argv[1]) && $argv[1] != '') $dominio_inf      = $argv[1];
if (isset($argv[2]) && $argv[2] != '') $data_ini         = $argv[2];
if (isset($argv[3]) && $argv[3] != '') $data_fin         = $argv[3];
if (isset($argv[4]) && $argv[4] == 'S') $apenas_organizar = true;
if (isset($argv[5]) && $argv[5] == 'S') $relatorio_pronto = true;

// Exemplo para apenas organizar 1 dia:
// php processa_930.php TOP 091026 091026 S

// Primeira execução do dia: processa ontem
if ($dominio_inf == 'ONTEM')
{
    $dominio_inf = '';
    $data_ini    = date('dmy', strtotime('-1 days'));
    $data_fin    = date('dmy', strtotime('-1 days'));
}


// -----------------------------------------------------------------------------
// CARREGA DOMÍNIOS UMA ÚNICA VEZ
// -----------------------------------------------------------------------------

$query = "SELECT domain
            FROM domains
           WHERE domain NOT IN ('XXX','EVI')
             AND is_active = true";

if ($dominio_inf != '')
    $query .= " AND domain = '" . sql_text($dominio_inf) . "'";

$result = sql($g_sql, $query);

$dominios = [];

while ($row = pg_fetch_array($result))
    $dominios[] = $row['domain'];


// -----------------------------------------------------------------------------
// 1. SOLICITA RELATÓRIO 930
// -----------------------------------------------------------------------------

if ((!$apenas_organizar) && (!$relatorio_pronto))
{
    echo "========================================\n";
    echo "DISPARANDO SOLICITAÇÕES DO 930\n";
    echo "========================================\n\n";

    echo "Domínios encontrados: " . count($dominios) . "\n\n";

    foreach ($dominios as $dominio)
    {
        echo "Domínio $dominio: ";

        if ($dominio == 'ACV')
        {
            ssw_login($dominio, 'claraj1', '71256911291', 'claraj1');
        }
        else
        {
            if (!ssw_login($dominio))
                continue;
        }

        $param = "act=ENV" .
                 "&f1=" . $data_ini .
                 "&f2=" . $data_fin .
                 "&f3=T" .
                 "&f9=C";

        $str = ssw_go("https://sistema.ssw.inf.br/bin/ssw0846?$param");

        if (strpos($str, 'Erro') !== false)
            echo "ERRO ao comandar 930\n";
        else
            echo "930 comandada ($data_ini a $data_fin)\n";
    }

    echo "\n========================================\n";
    echo "AGUARDANDO 45 SEGUNDOS PARA OS RELATÓRIOS\n";
    echo "========================================\n\n";

    sleep(45);
}


echo "========================================\n";
echo "PROCESSANDO RELATÓRIOS DO 930\n";
echo "========================================\n\n";


// -----------------------------------------------------------------------------
// PROCESSAMENTO POR DOMÍNIO
// -----------------------------------------------------------------------------

foreach ($dominios as $dominio)
{
    echo "------------\n";
    echo "Domínio $dominio:\n";
    echo "------------\n";


    // -------------------------------------------------------------------------
    // PARÂMETROS DE OCORRÊNCIA DO DOMÍNIO
    // -------------------------------------------------------------------------

    $result3 = sql($g_sql, "SELECT * FROM {$dominio}_emp_param");

    if (pg_num_rows($result3) == 0)
    {
        $ocor_aguardando        = 14;
        $ocor_agendamento       = 15;
        $ocor_chegada_unid      = 83;

        /*
         * O script original NÃO definia um valor padrão para
         * $ocor_chegada_unid_dest.
         *
         * Zero é usado aqui para impedir match acidental.
         * Se houver um código padrão correto para esta ocorrência,
         * substitua 0 pelo código correspondente.
         */
        $ocor_chegada_unid_dest = 0;

        $ocor_estorno_baixa     = 86;
    }
    else
    {
        $row = pg_fetch_array($result3);

        $ocor_aguardando        = pg_geti($row, 'ocor_aguardando_agendamento');
        $ocor_agendamento       = pg_geti($row, 'ocor_agendamento');
        $ocor_chegada_unid      = pg_geti($row, 'ocor_chegada_unid');
        $ocor_chegada_unid_dest = pg_geti($row, 'ocor_chegada_unid_dest');
        $ocor_estorno_baixa     = pg_geti($row, 'ocor_estorno_baixa');
    }


    // Códigos que podem substituir uma ocorrência não informativa,
    // mesmo quando a nova ocorrência é do tipo I.
    // Descarta parâmetros vazios/zero para evitar correspondências indevidas.
    $codigos_especiais = array_values(array_unique(array_filter([
        (int)$ocor_aguardando,
        (int)$ocor_agendamento,
        (int)$ocor_chegada_unid,
        (int)$ocor_chegada_unid_dest,
        (int)$ocor_estorno_baixa
    ], function($codigo_param) {
        return $codigo_param > 0;
    })));

    // =========================================================================
    // 2. IMPORTAÇÃO
    //
    // IMPORTANTE:
    // Este bloco SOMENTE insere em _cte_ocorrencia.
    // Nenhum campo do CT-e é atualizado aqui.
    // =========================================================================

    if (!$apenas_organizar)
    {
        if ($dominio == 'ACV')
        {
            ssw_login($dominio, 'claraj1', '71256911291', 'claraj1');
        }
        else
        {
            if (!ssw_login($dominio))
                continue;
        }

        $str = ssw_go('https://sistema.ssw.inf.br/bin/ssw1440');

        $pos_ini = strpos($str, '<xml');
        $pos_fim = strpos($str, '</xml>');

        if (($pos_ini === false) || ($pos_fim === false))
        {
            echo "Não foi possível interpretar a lista de relatórios.\n\n";
            continue;
        }

        $str = substr($str, $pos_ini, $pos_fim - $pos_ini) . '</xml>';
        $xml = simplexml_load_string($str);

        if ($xml === false)
        {
            echo "XML da lista de relatórios inválido.\n\n";
            continue;
        }

        $encontrado = false;

        $seqs = $xml->xpath('rs/r/f0');
        $opcs = $xml->xpath('rs/r/f1');
        $usrs = $xml->xpath('rs/r/f3');
        $sits = $xml->xpath('rs/r/f6');

        $qtd_relatorios = min(
            count($seqs),
            count($opcs),
            count($usrs),
            count($sits)
        );

        // Mantém o limite original de até 301 registros.
        $qtd_relatorios = min($qtd_relatorios, 301);

        for ($i = 0; $i < $qtd_relatorios; $i++)
        {
            $seq = (string)$seqs[$i];
            $opc = (string)$opcs[$i];
            $usr = trim((string)$usrs[$i]);
            $sit = (string)$sits[$i];

            if ((substr($opc, 0, 3) == '930') &&
                (($usr == 'presto') || ($usr == 'claraj1')) &&
                ($sit == 'Conclu&iacute;do'))
            {
                $encontrado = true;

                echo "Arquivo encontrado. Iniciando importação.\n";

                $arq = $dominio . fmtnum((int)$seq, 9) . '.csv';

                $pla = ssw_go(
                    "https://sistema.ssw.inf.br/bin/ssw0424" .
                    "?act=$arq" .
                    "&filename=$arq" .
                    "&path=/usr/aws/jobs/$dominio/" .
                    "&down=1" .
                    "&nw=1"
                );

                $pla = str_replace(chr(0xa0), '', $pla);

                file_put_contents(
                    "c:/Users/Usuário/OneDrive/Drive/Presto/Sistema/src/api/cli/planilha_debug_$dominio.csv",
                    $pla
                );

                $fil_arr = explode("\r", $pla);
                $count   = count($fil_arr);

                for ($j = 0; $j < ($count - 1); $j++)
                {
                    echo "Importando $j de $count registros: " .
                         fmtdec($j / $count * 100, 2) .
                         " %" .
                         chr(13);

                    $line = str_replace(chr(10), '', $fil_arr[$j]);
                    $arr  = str_getcsv($line, ';');

                    // Proteção contra linha incompleta.
                    if (count($arr) < 18)
                        continue;

                    if ($arr[0] != '1')
                        continue;

                    $cte             = $arr[1];
                    $unidade         = $arr[9];
                    $data_inclusao   = $arr[10];
                    $hora_inclusao   = $arr[11];
                    $data_ocorrencia = $arr[12];
                    $hora_ocorrencia = $arr[13];
                    $login           = $arr[14];
                    $codigo          = (int)$arr[15];
                    $complemento     = $arr[17];

                    $ser_cte = substr($cte, 0, 3);
                    $nro_cte = (int)substr($cte, 3, 6);

                    $data_inclusao   = strtodate($data_inclusao);
                    $data_ocorrencia = strtodate($data_ocorrencia);

                    if (!$data_inclusao || !$data_ocorrencia)
                        continue;

                    $ser_cte_sql = sql_text($ser_cte);

                    $result2 = sql(
                        $g_sql,
                        "SELECT seq_cte
                           FROM {$dominio}_cte
                          WHERE ser_cte = '$ser_cte_sql'
                            AND nro_cte = $nro_cte
                          ORDER BY seq_cte DESC
                          LIMIT 1"
                    );

                    if (pg_num_rows($result2) == 0)
                        continue;

                    $row2    = pg_fetch_array($result2);
                    $seq_cte = (int)pg_gets($row2, 'seq_cte');

                    $unidade_sql     = sql_text($unidade);
                    $hora_inc_sql    = sql_text($hora_inclusao);
                    $hora_ocor_sql   = sql_text($hora_ocorrencia);
                    $login_sql       = sql_text($login);
                    $complemento_sql = sql_text($complemento);

                    sql(
                        $g_sql,
                        "INSERT INTO {$dominio}_cte_ocorrencia
                         VALUES (
                             $seq_cte,
                             '$unidade_sql',
                             '" . date('Y-m-d', $data_inclusao) . "',
                             '$hora_inc_sql',
                             '" . date('Y-m-d', $data_ocorrencia) . "',
                             '$hora_ocor_sql',
                             '$login_sql',
                             $codigo,
                             '$complemento_sql'
                         )
                         ON CONFLICT DO NOTHING"
                    );
                }

                echo "\n";

                // Mantém o comportamento original:
                // usa o primeiro relatório 930 concluído encontrado.
                break;
            }
        }

        if (!$encontrado)
            echo "Nenhum arquivo 930 concluído encontrado.\n\n";
    }


    // =========================================================================
    // 3. ORGANIZAÇÃO
    //
    // O período serve SOMENTE para descobrir quais CT-es precisam ser tratados.
    //
    // Para cada CT-e afetado, são consideradas as ocorrências dele, mas uma
    // ocorrência só altera o CT-e se for posterior à cronologia correspondente
    // já gravada no próprio CT-e.
    //
    // IMPORTANTE:
    // - cronologia geral e cronologia de agendamento são independentes;
    // - ocorrência antiga nunca faz o CT-e "andar para trás";
    // - todos os efeitos gerais (entrega, localização etc.) só acontecem quando
    //   a ocorrência também puder avançar a cronologia geral;
    // - previsão de entrega segue a cronologia de agendamento.
    // =========================================================================

    echo "Organizando ocorrências...\n";

    $data_ini_fmt = date('Y-m-d', strtodate($data_ini));
    $data_fin_fmt = date('Y-m-d', strtodate($data_fin));

    /*
     * Um único result-set para a organização:
     *
     * 1) "afetados" encontra CT-es que receberam ocorrência no período;
     * 2) depois buscamos o histórico desses CT-es;
     * 3) juntamos o estado ATUAL do CT-e;
     * 4) ordenamos cronologicamente.
     *
     * Assim eliminamos o antigo:
     *   - SELECT DISTINCT dos CT-es;
     *   - SELECT da última ocorrência por CT-e;
     *   - SELECT do último agendamento por CT-e;
     *   - SELECT do CT-e por CT-e.
     */
    $query_org = "
        WITH afetados AS (
            SELECT DISTINCT seq_cte
              FROM {$dominio}_cte_ocorrencia
             WHERE data_inclusao BETWEEN '$data_ini_fmt' AND '$data_fin_fmt'
        )
        SELECT
            o.seq_cte,
            o.unidade,
            o.data_inclusao,
            o.hora_inclusao,
            o.data_ocorrencia,
            o.hora_ocorrencia,
            o.login,
            o.codigo,
            o.complemento,
            oc.tipo,
            oc_ult.tipo AS tipo_ult_ocor_banco,

            c.ult_ocor,
            c.data_ult_ocor,
            c.hora_ult_ocor,

            c.ult_ocor_agend,
            c.data_ult_ocor_agend,
            c.hora_ult_ocor_agend

          FROM {$dominio}_cte_ocorrencia o

          INNER JOIN afetados a
                  ON a.seq_cte = o.seq_cte

          INNER JOIN {$dominio}_ocorrencia oc
                  ON oc.codigo = o.codigo

          INNER JOIN {$dominio}_cte c
                  ON c.seq_cte = o.seq_cte

           LEFT JOIN {$dominio}_ocorrencia oc_ult
                  ON oc_ult.codigo = c.ult_ocor

         ORDER BY
               o.seq_cte,
               o.data_ocorrencia,
               o.hora_ocorrencia,
               o.data_inclusao,
               o.hora_inclusao,
               o.codigo
    ";

    $result_org = sql($g_sql, $query_org);

    $total_ocorrencias = pg_num_rows($result_org);

    if ($total_ocorrencias == 0)
    {
        echo "Nenhuma ocorrência para organizar neste período.\n\n";
        continue;
    }

    $seq_cte_atual = null;
    $estado         = null;
    $cont_ocor      = 0;
    $cont_cte       = 0;


    /**
     * Grava o estado acumulado de um CT-e.
     *
     * É uma closure PHP, não uma function do banco.
     * Faz no máximo UM UPDATE por CT-e.
     */
    $gravar_cte = function($seq_cte, $estado) use ($g_sql, $dominio)
    {
        if ($seq_cte === null || $estado === null || !$estado['alterado'])
            return;

        $campos = [];

        // -------------------------
        // Cronologia geral
        // -------------------------
        if ($estado['alterou_geral'])
        {
            $campos[] = "ult_ocor = " . (int)$estado['ult_ocor'];
            $campos[] = "data_ult_ocor = '" . sql_text($estado['data_ult_ocor']) . "'";
            $campos[] = "hora_ult_ocor = '" . sql_text($estado['hora_ult_ocor']) . "'";
        }

        // -------------------------
        // Cronologia de agendamento
        // -------------------------
        if ($estado['alterou_agend'])
        {
            $campos[] = "ult_ocor_agend = " . (int)$estado['ult_ocor_agend'];
            $campos[] = "data_ult_ocor_agend = '" . sql_text($estado['data_ult_ocor_agend']) . "'";
            $campos[] = "hora_ult_ocor_agend = '" . sql_text($estado['hora_ult_ocor_agend']) . "'";
        }

        // -------------------------
        // Efeitos derivados
        // -------------------------
        if ($estado['alterou_data_entrega'])
        {
            if ($estado['data_entrega'] === null)
                $campos[] = "data_entrega = NULL";
            else
                $campos[] = "data_entrega = '" . sql_text($estado['data_entrega']) . "'";
        }

        if ($estado['entrega_abonada'])
            $campos[] = "entrega_abonada = true";

        if ($estado['alterou_localizacao'])
        {
            $campos[] = "data_chegada_unid = '" . sql_text($estado['data_chegada_unid']) . "'";
            $campos[] = "unid_atual = '" . sql_text($estado['unid_atual']) . "'";
        }

        if ($estado['alterou_data_prev_ent'])
            $campos[] = "data_prev_ent = '" . sql_text($estado['data_prev_ent']) . "'";

        if (!empty($campos))
        {
            sql(
                $g_sql,
                "UPDATE {$dominio}_cte
                    SET " . implode(', ', $campos) . "
                  WHERE seq_cte = " . (int)$seq_cte
            );
        }
    };


    while ($row = pg_fetch_array($result_org))
    {
        $cont_ocor++;

        $seq_cte = (int)pg_gets($row, 'seq_cte');

        /*
         * Mudou de CT-e:
         * grava o anterior e inicializa as duas cronologias com o estado
         * que JÁ ESTÁ no banco.
         */
        if ($seq_cte_atual !== $seq_cte)
        {
            if ($seq_cte_atual !== null)
                $gravar_cte($seq_cte_atual, $estado);

            $seq_cte_atual = $seq_cte;
            $cont_cte++;

            $data_ult_ocor_banco       = pg_gets($row, 'data_ult_ocor');
            $hora_ult_ocor_banco       = pg_gets($row, 'hora_ult_ocor');
            $data_ult_agend_banco      = pg_gets($row, 'data_ult_ocor_agend');
            $hora_ult_agend_banco      = pg_gets($row, 'hora_ult_ocor_agend');

            $estado = [
                // Cronologia geral existente
                'ts_geral'              => ocorrencia_timestamp(
                    $data_ult_ocor_banco,
                    $hora_ult_ocor_banco
                ),
                'ts_geral_incl'         => ocorrencia_timestamp(
                    $data_ult_ocor_banco,
                    $hora_ult_ocor_banco
                ),
                'ult_ocor'              => pg_geti($row, 'ult_ocor'),
                'tipo_ult_ocor'         => trim((string)pg_gets($row, 'tipo_ult_ocor_banco')),
                'data_ult_ocor'         => $data_ult_ocor_banco,
                'hora_ult_ocor'         => $hora_ult_ocor_banco,

                // Cronologia de agendamento existente
                'ts_agend'              => ocorrencia_timestamp(
                    $data_ult_agend_banco,
                    $hora_ult_agend_banco
                ),
                'ts_agend_incl'         => ocorrencia_timestamp(
                    $data_ult_agend_banco,
                    $hora_ult_agend_banco
                ),
                'ult_ocor_agend'        => pg_geti($row, 'ult_ocor_agend'),
                'data_ult_ocor_agend'   => $data_ult_agend_banco,
                'hora_ult_ocor_agend'   => $hora_ult_agend_banco,

                // Alterações desta execução
                'alterado'              => false,
                'alterou_geral'         => false,
                'alterou_agend'         => false,

                'alterou_data_entrega'  => false,
                'data_entrega'          => null,

                'entrega_abonada'       => false,

                'alterou_localizacao'   => false,
                'data_chegada_unid'     => null,
                'unid_atual'            => null,

                'alterou_data_prev_ent' => false,
                'data_prev_ent'         => null
            ];
        }


        $codigo          = (int)pg_gets($row, 'codigo');
        $tipo            = pg_gets($row, 'tipo');
        $data_inclusao   = pg_gets($row, 'data_inclusao');
        $hora_inclusao   = pg_gets($row, 'hora_inclusao');
        $data_ocorrencia = pg_gets($row, 'data_ocorrencia');
        $hora_ocorrencia = pg_gets($row, 'hora_ocorrencia');
        $unidade         = pg_gets($row, 'unidade');
        $complemento     = pg_gets($row, 'complemento');

        $ts_ocorrencia = ocorrencia_timestamp(
            $data_ocorrencia,
            $hora_ocorrencia
        );
        $ts_inclusao = ocorrencia_timestamp(
            $data_inclusao,
            $hora_inclusao
        );

        if ($ts_ocorrencia === null)
            continue;


        // =====================================================================
        // CRONOLOGIA GERAL
        // =====================================================================
        // Só aceita uma ocorrência com timestamp estritamente posterior.
        // Uma informativa (I) comum NÃO substitui uma última ocorrência
        // aceita de outro tipo. Os cinco códigos configurados em emp_param
        // são exceções, independentemente do tipo.
        //
        // A comparação usa o estado acumulado do CT-e (última ocorrência
        // ACEITA), não a ocorrência imediatamente anterior do histórico.
        // Se o CT-e ainda não tem uma última ocorrência válida, permite
        // iniciar sua cronologia inclusive com uma informativa.
        // =====================================================================

        $eh_informativa = (strtoupper(trim((string)$tipo)) === 'I');
        $anterior_eh_informativa =
            (strtoupper(trim((string)$estado['tipo_ult_ocor'])) === 'I');
        $eh_especial = in_array($codigo, $codigos_especiais, true);

        $existe_ultima_geral = ($estado['ts_geral'] !== null);

        $bloquear_informativa =
            $existe_ultima_geral &&
            $eh_informativa &&
            !$anterior_eh_informativa &&
            !$eh_especial;

        $ts_incl_atual = ($ts_inclusao !== null) ? $ts_inclusao : 0;
        $ts_incl_banco = ($estado['ts_geral_incl'] !== null) ? $estado['ts_geral_incl'] : (($estado['ts_geral'] !== null) ? $estado['ts_geral'] : 0);
        $ult_codigo_banco = (int)($estado['ult_ocor'] ?? 0);

        $avanca_geral =
            !$bloquear_informativa &&
            (
                !$existe_ultima_geral ||
                ($ts_ocorrencia > $estado['ts_geral']) ||
                (
                    ($ts_ocorrencia == $estado['ts_geral']) &&
                    (
                        ($ts_incl_atual > $ts_incl_banco) ||
                        (($ts_incl_atual == $ts_incl_banco) && ($codigo > $ult_codigo_banco)) ||
                        (
                            ($ts_incl_atual == $ts_incl_banco) &&
                            (strtoupper(trim((string)$tipo)) === 'E') &&
                            (strtoupper(trim((string)$estado['tipo_ult_ocor'])) !== 'E')
                        )
                    )
                )
            );

        if ($avanca_geral)
        {
            $estado['ts_geral']      = $ts_ocorrencia;
            $estado['ts_geral_incl'] = $ts_incl_atual;
            $estado['ult_ocor']      = $codigo;
            $estado['tipo_ult_ocor'] = $tipo;
            $estado['data_ult_ocor'] = $data_ocorrencia;
            $estado['hora_ult_ocor'] = $hora_ocorrencia;

            $estado['alterado']      = true;
            $estado['alterou_geral'] = true;


            /*
             * --------------------------------------------------------------
             * ENTREGA
             * --------------------------------------------------------------
             *
             * No script original:
             * - tipo B grava data da ocorrência;
             * - tipos E/R usam a data da ocorrência quando o CSV não traz
             *   DATA ENTREGA;
             * - estorno limpa data_entrega.
             *
             * Como DATA ENTREGA do CSV NÃO é persistida em _cte_ocorrencia,
             * uma organização executada posteriormente não tem acesso a ela.
             *
             * Para que o organizador seja autônomo/reexecutável:
             * - B, E e R passam a usar data_ocorrencia;
             * - estorno continua limpando data_entrega.
             *
             * IMPORTANTE: o estorno é testado DEPOIS e, portanto, prevalece.
             */
            if (($tipo == 'B') || ($tipo == 'E') || ($tipo == 'R'))
            {
                $estado['data_entrega']         = $data_ocorrencia;
                $estado['alterou_data_entrega'] = true;
            }

            if ($codigo == $ocor_estorno_baixa)
            {
                $estado['data_entrega']         = null;
                $estado['alterou_data_entrega'] = true;
            }


            /*
             * --------------------------------------------------------------
             * ENTREGA ABONADA
             * --------------------------------------------------------------
             *
             * Preserva a regra do script original:
             * tipo C, exceto "aguardando", liga a flag.
             *
             * Não desligamos a flag porque o código original também nunca
             * fazia entrega_abonada voltar para false.
             */
            if (($tipo == 'C') && ($codigo != $ocor_aguardando))
                $estado['entrega_abonada'] = true;


            /*
             * --------------------------------------------------------------
             * LOCALIZAÇÃO
             * --------------------------------------------------------------
             *
             * Agora respeita a cronologia geral.
             * Uma chegada antiga jamais sobrescreve localização de um CT-e
             * que já possua ocorrência geral posterior.
             */
            if (($codigo == $ocor_chegada_unid) ||
                ($codigo == $ocor_chegada_unid_dest))
            {
                if (trim($unidade) != '')
                {
                    $estado['data_chegada_unid']   = $data_ocorrencia;
                    $estado['unid_atual']          = $unidade;
                    $estado['alterou_localizacao'] = true;
                }
            }
        }


        // =====================================================================
        // CRONOLOGIA DE AGENDAMENTO
        //
        // Independente da cronologia geral.
        //
        // Uma ocorrência pode ser antiga para a cronologia geral e ainda ser
        // nova para a cronologia de agendamento.
        // =====================================================================

        $eh_agendamento =
            ($codigo == $ocor_aguardando) ||
            ($codigo == $ocor_agendamento);

        $ts_ag_incl_banco = ($estado['ts_agend_incl'] !== null) ? $estado['ts_agend_incl'] : (($estado['ts_agend'] !== null) ? $estado['ts_agend'] : 0);
        $ult_ag_codigo_banco = (int)($estado['ult_ocor_agend'] ?? 0);

        $avanca_agend =
            $eh_agendamento &&
            (
                ($estado['ts_agend'] === null) ||
                ($ts_ocorrencia > $estado['ts_agend']) ||
                (
                    ($ts_ocorrencia == $estado['ts_agend']) &&
                    (
                        ($ts_incl_atual > $ts_ag_incl_banco) ||
                        (($ts_incl_atual == $ts_ag_incl_banco) && ($codigo > $ult_ag_codigo_banco))
                    )
                )
            );

        if ($avanca_agend)
        {
            $estado['ts_agend']            = $ts_ocorrencia;
            $estado['ts_agend_incl']       = $ts_incl_atual;
            $estado['ult_ocor_agend']      = $codigo;
            $estado['data_ult_ocor_agend'] = $data_ocorrencia;
            $estado['hora_ult_ocor_agend'] = $hora_ocorrencia;

            $estado['alterado']      = true;
            $estado['alterou_agend'] = true;


            /*
             * Previsão de entrega pertence à cronologia de agendamento.
             *
             * Só a ocorrência de agendamento que realmente avançou essa
             * cronologia pode alterar data_prev_ent.
             */
            $data_prev_ent = extrair_data_previsao(
                $complemento,
                $codigo,
                $ocor_agendamento
            );

            if ($data_prev_ent !== null)
            {
                $estado['data_prev_ent']         = $data_prev_ent;
                $estado['alterou_data_prev_ent'] = true;
            }
        }


        echo "Organizando ocorrência $cont_ocor de $total_ocorrencias - " .
             "$cont_cte CT-es encontrados" .
             chr(13);
    }


    // Grava o último CT-e do result-set.
    if ($seq_cte_atual !== null)
        $gravar_cte($seq_cte_atual, $estado);

    echo "\n";
    echo "Organização concluída: $cont_cte CT-es analisados.\n\n";
}


echo "========================================\n";
echo "PROCESSAMENTO CONCLUÍDO\n";
echo "========================================\n";

