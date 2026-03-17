<?php
/**
 * 📊 API JSON - TOTAIS DE VENDEDORES POR UNIDADE
 *
 * Retorna dados em JSON para exibição na tela (não Excel)
 *
 * Recebe: { login_vendedor: string, unidade: string }
 * Retorna: { success: true, dados: [...] }
 *
 * ⚡ OTIMIZADO: Processamento 100% em memória (sem tabela temporária)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ✅ Carregar config.php (tem tudo que precisa)
require_once __DIR__ . '/../config.php';

// ✅ Incluir biblioteca SSW (necessária para conexão SSW)
require_once '/var/www/html/lib/ssw.php';

try {
    // ================================================================
    // AUTENTICAÇÃO
    // ================================================================
    $currentUser = getCurrentUser();

    if (!$currentUser) {
        throw new Exception('Não autenticado');
    }

    $dominio = $currentUser['domain'];

    // ================================================================
    // OBTER PARÂMETROS
    // ================================================================
    $input = json_decode(file_get_contents('php://input'), true);
    $loginVendedor = strtoupper(trim($input['login_vendedor'] ?? ''));
    $unidade = strtoupper(trim($input['unidade'] ?? ''));
    $apenasTeleVendas = isset($input['apenas_tele_vendas']) && $input['apenas_tele_vendas'] === true;
    $mesUsuario = isset($input['mes']) ? (int)$input['mes'] : date('n'); // Mês informado pelo usuário
    $anoUsuario = isset($input['ano']) ? (int)$input['ano'] : date('Y'); // Ano informado pelo usuário

    // ✅ FILTROS OPCIONAIS - não validar se estão vazios

    // ================================================================
    // DETERMINAR PARÂMETRO ACT BASEADO NO PERÍODO
    // ================================================================
    // Se o período for anterior a 2 meses em relação a hoje, usar "TOD" em vez de "U90"
    $hoje = new DateTime();
    $periodoUsuario = new DateTime("{$anoUsuario}-{$mesUsuario}-01");
    
    // Calcular diferença em meses
    $diffAnos = $hoje->format('Y') - $periodoUsuario->format('Y');
    $diffMeses = $hoje->format('n') - $periodoUsuario->format('n');
    $diferencaMeses = ($diffAnos * 12) + $diffMeses;
    
    // Se a diferença for >= 2 meses, usar "TOD", senão usar "U90"
    $actParameter = ($diferencaMeses >= 2) ? 'TOD' : 'U90';

    // ================================================================
    // CRIAR CONEXÃO POSTGRESQL (PADRÃO OBRIGATÓRIO)
    // ================================================================
    $g_sql = connect();

    // ================================================================
    // CONECTAR AO SSW E BUSCAR DADOS
    // ================================================================
    ssw_login($dominio);

    // Dispara requisição para 56, e procura o relatório 73
    // Le lista da 156, em ordem decrescente de data de processo
    $str = ssw_go("https://sistema.ssw.inf.br/bin/ssw0082?act={$actParameter}"); // Comanda a 156

    $str = substr($str, strpos($str,'<xml'), strlen($str));
    $str = substr($str, 0, strpos($str,'</xml>')) . '</xml>';
    $xml = simplexml_load_string($str);

    $dadosEncontrados = false;

    for ($i = 0; $i <= count($xml->xpath('rs/r/f0')); $i++) {
        $rel = $xml->xpath('rs/r/f0')[$i];
        $act = $xml->xpath('rs/r/f6')[$i];
        $pro = $xml->xpath('rs/r/f4')[$i]; // Data de processamento no formato "dd/mm/aa hh:mm"

        // ✅ VALIDAR MÊS E ANO DO RELATÓRIO
        // Extrair mês e ano da data de processamento (formato: "dd/mm/aa hh:mm")
        // Exemplo: "01/01/26 10:30"
        if (!empty($pro) && strlen($pro) >= 8) {
            $partesPro = explode('/', $pro);
            if (count($partesPro) >= 3) {
                // $partesPro[1] = mês (formato "mm")
                // $partesPro[2] = ano + hora (formato "aa hh:mm")
                $mesRelatorio = (int)$partesPro[1];
                $anoRelatorio = (int)substr($partesPro[2], 0, 2); // Pegar apenas os 2 primeiros caracteres (ano)
                
                // Converter ano de 2 dígitos para 4 dígitos
                // Se ano >= 90, é 19xx, senão é 20xx
                if ($anoRelatorio >= 90) {
                    $anoRelatorio = 1900 + $anoRelatorio;
                } else {
                    $anoRelatorio = 2000 + $anoRelatorio;
                }
                
                // Verificar se o mês e ano do relatório batem com o solicitado
                if ($mesRelatorio !== $mesUsuario || $anoRelatorio !== $anoUsuario) {
                    continue; // Pular este relatório
                }
            }
        }

        if (($rel == '073') && (substr($pro, 0, 2) == '01')) {
            $str = ssw_go("https://sistema.ssw.inf.br/bin/ssw0082?act=$act");

            $str = urldecode($str);
            $act = ssw_get_act($str);
            $arq = ssw_get_arq($str);

            // Abre o arquivo do relatório
            $file = ssw_go('https://sistema.ssw.inf.br/bin/ssw0424?act=' . $act . '&filename=' . $arq . '&path=&down=1&nw=0');

            $fil_arr = explode("\r", $file);
            $count = count($fil_arr);

            $chegou_nos_vendedores = false;

            // ⚡ OTIMIZAÇÃO: Array em memória em vez de tabela temporária
            // Estrutura: $dadosMemoria['LOGIN']['UNIDADE'] = [vlr_frete1, vlr_frete2, vlr_frete3]
            $dadosMemoria = [];

            for ($j = 0; $j < ($count - 1); $j++) {
                $line = str_replace(chr(10), '', $fil_arr[$j]);

                if (substr($line, 90, 9) == 'VENDEDOR:') {
                    $chegou_nos_vendedores = true;
                    $vendedor = trim(substr($line, 100, 8));
                }

                if (!$chegou_nos_vendedores) continue;

                // Quando chegar na parte dos supervisores, aborta
                if (strpos($line, 'SUPERVISOR:') !== false) break;

                // Filtros de linhas inválidas
                if (strpos($line, '---') !== false) continue;
                if (strpos($line, 'TOTAL DO VENDEDOR') !== false) continue;
                if (strpos($line, 'TOTAL DO GRUPO') !== false) continue;
                if (strpos($line, 'ABC VENDEDOR') !== false) continue;
                if (strpos($line, 'Kg  R$1000') !== false) continue;
                if (strpos($line, 'PAG:') !== false) continue;
                if (strpos($line, 'ssw0663') !== false) continue;
                if (strpos($line, 'CRES*') !== false) continue;
                if (trim(substr($line, 0, 60)) == '') continue;
                if (strlen($line) < 20) continue;

                // Extrair dados da linha
                $unid = trim(substr($line, 6, 3));
                $login = trim(substr($line, 47, 8));

                // Validar login não vazio
                if (empty($login)) continue;
                
                // ✅ FILTRAR REGISTROS INVÁLIDOS (não são vendedores reais)
                if (strpos($login, 'AL COMPRA') !== false) continue;
                if (strpos($login, 'COMPRA') !== false) continue;
                if (strpos($line, 'AL COMPRA') !== false) continue;

                $vlr_frete1 = strtofloat(substr($line, 84,  13));
                $vlr_frete2 = strtofloat(substr($line, 138, 13));
                $vlr_frete3 = strtofloat(substr($line, 186, 13));

                // ⚡ ARMAZENAR EM MEMÓRIA com agregação automática
                if (!isset($dadosMemoria[$login])) {
                    $dadosMemoria[$login] = [];
                }

                if (!isset($dadosMemoria[$login][$unid])) {
                    $dadosMemoria[$login][$unid] = [
                        'vlr_frete1' => 0,
                        'vlr_frete2' => 0,
                        'vlr_frete3' => 0
                    ];
                }

                // Acumular valores (GROUP BY + SUM em memória)
                $dadosMemoria[$login][$unid]['vlr_frete1'] += $vlr_frete1;
                $dadosMemoria[$login][$unid]['vlr_frete2'] += $vlr_frete2;
                $dadosMemoria[$login][$unid]['vlr_frete3'] += $vlr_frete3;
            }

            $dadosEncontrados = true;
            break;
        }
    }

    if (!$dadosEncontrados) {
        throw new Exception('Relatório 073 não encontrado no SSW');
    }

    // ================================================================
    // APLICAR FILTROS E FORMATAR DADOS
    // ================================================================
    
    // ✅ Se filtrar por tele-vendas, buscar lista de vendedores tele-vendas
    $vendedoresTeleVendas = [];
    if ($apenasTeleVendas) {
        $queryTeleVendas = "SELECT login FROM {$dominio}_vendedor WHERE tele_vendas = true";
        $resultTeleVendas = sql($queryTeleVendas, [], $g_sql);
        
        while ($row = pg_fetch_assoc($resultTeleVendas)) {
            $vendedoresTeleVendas[] = strtoupper($row['login']);
        }
    }
    
    $dados = [];

    foreach ($dadosMemoria as $login => $unidades) {
        // Filtro de vendedor (opcional)
        if (!empty($loginVendedor) && strtoupper($login) !== $loginVendedor) {
            continue;
        }
        
        // ✅ Filtro de tele-vendas (verifica se o login está na lista)
        if ($apenasTeleVendas && !in_array(strtoupper($login), $vendedoresTeleVendas)) {
            continue;
        }

        foreach ($unidades as $unid => $valores) {
            // Filtro de unidade (opcional)
            if (!empty($unidade) && strtoupper($unid) !== $unidade) {
                continue;
            }

            $dados[] = [
                'login' => $login,
                'unid' => $unid,
                'vlr_frete1' => floatval($valores['vlr_frete1']),
                'vlr_frete2' => floatval($valores['vlr_frete2']),
                'vlr_frete3' => floatval($valores['vlr_frete3'])
            ];
        }
    }

    // Ordenar por login e unidade (equivalente ao ORDER BY)
    usort($dados, function($a, $b) {
        $cmpLogin = strcmp($a['login'], $b['login']);
        if ($cmpLogin !== 0) return $cmpLogin;
        return strcmp($a['unid'], $b['unid']);
    });

    // ✅ Retornar JSON
    echo json_encode([
        'success' => true,
        'dados' => $dados,
        'filtros' => [
            'login_vendedor' => $loginVendedor,
            'unidade' => $unidade,
            'apenas_tele_vendas' => $apenasTeleVendas,
            'mes' => $mesUsuario,
            'ano' => $anoUsuario
        ]
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro ao buscar dados: ' . $e->getMessage()
    ]);
}