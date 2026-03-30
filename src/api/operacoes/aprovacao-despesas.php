<?php
/**
 * ================================================================
 * API: APROVAÇÃO DE DESPESAS
 * ================================================================
 * Integração com SSW1196 para aprovação de despesas
 * 
 * ENDPOINTS:
 * - GET /api/operacoes/aprovacao-despesas.php?act=LISTAR
 * - POST /api/operacoes/aprovacao-despesas.php?act=APROVAR
 * - POST /api/operacoes/aprovacao-despesas.php?act=REMOVER_APROVACAO
 * ================================================================
 */

header('Content-Type: application/json; charset=utf-8');

try {
    require_once __DIR__ . '/../config.php';
    require_once '/var/www/html/lib/ssw.php';
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro ao carregar dependências',
        'message' => $e->getMessage()
    ]);
    exit;
}

// ✅ REGRA OFICIAL: Sempre usar global $g_sql
global $g_sql;

try {
    // ✅ OBTER DADOS DO USUÁRIO
    $userData = getCurrentUser();
    
    if (!$userData) {
        http_response_code(401);
        echo json_encode(['error' => 'Usuário não autenticado']);
        exit;
    }
    
    // ✅ INICIALIZAR CONEXÃO SE NÃO EXISTIR
    if (!isset($g_sql)) {
        $g_sql = connect();
    }
    
    $domain = strtoupper($userData['domain']);
    ssw_login($domain);
    
    // ✅ ROTEAR AÇÃO
    $act = isset($_GET['act']) ? strtoupper($_GET['act']) : '';
    
    switch ($act) {
        case 'LISTAR':
            listarDespesas($userData);
            break;
            
        case 'TOGGLE_INDIVIDUAL':
            toggleIndividual($userData, $g_sql);
            break;
            
        case 'LER_OBSERVACAO':
            lerObservacao($userData, $g_sql);
            break;
            
        case 'APROVAR':
            aprovarDespesas($userData, $g_sql);
            break;
            
        case 'SALVAR_OBSERVACAO':
            salvarObservacao($userData, $g_sql);
            break;
            
        case 'REMOVER_APROVACAO':
            removerAprovacao($userData, $g_sql);
            break;
            
        default:
            http_response_code(400);
            echo json_encode(['error' => 'Ação inválida']);
            break;
    }
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Erro interno no servidor',
        'message' => $e->getMessage()
    ]);
}

// ================================================================
// FUNÇÃO: LISTAR DESPESAS
// ================================================================
function listarDespesas($userData) {
    try {
        // Parâmetros do filtro
        $periodo_inicio = $_GET['periodo_inicio'] ?? '';
        $periodo_fim = $_GET['periodo_fim'] ?? '';
        $status = $_GET['status'] ?? 'N'; // A=Aprovadas, N=Não aprovadas, T=Todas
        $codigo_evento = $_GET['codigo_evento'] ?? '';
        $unidade = $_GET['unidade'] ?? '';
        
        // Validação de parâmetros obrigatórios
        if (empty($periodo_inicio) || empty($periodo_fim)) {
            http_response_code(400);
            echo json_encode(['error' => 'Período início e fim são obrigatórios']);
            return;
        }
        
        // Converter datas de YYYY-MM-DD para DDMMAA
        $f1 = converterDataParaSSW($periodo_inicio);
        $f2 = converterDataParaSSW($periodo_fim);
        
        // Montar parâmetros para o SSW1196
        $params = "act=PES";
        $params .= "&f1=" . $f1;
        $params .= "&f2=" . $f2;
        $params .= "&f3=" . $status;
        
        if (!empty($codigo_evento)) {
            $params .= "&f5=" . urlencode($codigo_evento);
        }
        
        if (!empty($unidade)) {
            $params .= "&f7=" . urlencode($unidade);
        }
        
        // ✅ SALVAR PARA USO NO ESTORNO (PASSO 1)
        if (session_status() === PHP_SESSION_NONE) session_start();
        $_SESSION['ssw_last_pes_params'] = $params;
        
        // Chamar SSW1196
        $html = ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params);
        
        // Parsear XML do retorno
        $despesas = parsearXMLDespesas($html);
        
        // Retornar JSON
        echo json_encode([
            'success' => true,
            'despesas' => $despesas,
            'total' => count($despesas)
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Erro ao listar despesas',
            'message' => $e->getMessage()
        ]);
    }
}

// ================================================================
// FUNÇÃO: TOGGLE INDIVIDUAL (MARCAR/DESMARCAR)
// ================================================================
function toggleIndividual($userData, $g_sql) {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($body['seq_parcela']) || !isset($body['selecionado'])) {
            http_response_code(400);
            echo json_encode(['error' => 'seq_parcela e selecionado são obrigatórios']);
            return;
        }
        
        $seq = $body['seq_parcela'];
        $selecionado = $body['selecionado']; // boolean
        
        // Regra: se marcar (true) -> act=ONE, se desmarcar (false) -> act=EXC
        $act_ssw = $selecionado ? 'ONE' : 'EXC';
        $params = "act=" . $act_ssw . "&seq_desp_parcela=" . urlencode($seq);
        
        // ✅ ENVIO REAL AO SSW
        $result = ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params);
        
        // Verificar se houve erro no retorno
        if (strpos($result, 'erro') !== false || strpos($result, 'ERRO') !== false) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Erro ao comunicar com o SSW',
                'message' => 'SSW retornou erro no toggle individual'
            ]);
            return;
        }
        
        respondJson([
            'success' => true,
            'message' => $selecionado ? 'Despesa marcada no SSW' : 'Despesa desmarcada no SSW'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Erro no toggle individual',
            'message' => $e->getMessage()
        ]);
    }
}

// ================================================================
// FUNÇÃO: APROVAR DESPESAS (EM MASSA)
// ================================================================
function aprovarDespesas($userData, $g_sql) {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($body['seq_parcelas']) || !is_array($body['seq_parcelas'])) {
            http_response_code(400);
            echo json_encode(['error' => 'seq_parcelas é obrigatório e deve ser um array']);
            return;
        }
        
        $seq_parcelas = $body['seq_parcelas'];
        
        // ✅ ENVIO FINAL (SRENV|id1|id2|id3...)
        // Agora confiamos na persistência de cookies da ssw.php para manter o estado das marcações individuais feitas no frontend
        $act_ssw = "SRENV|" . implode('|', $seq_parcelas);
        $params_final = "act=" . $act_ssw; // Manter pipes literais conforme exemplo do usuário
        
        // Chamar SSW1196 para efetivar a aprovação em massa
        $result = ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_final);
        
        // Verificar se houve erro no retorno final
        if (strpos($result, 'erro') !== false || strpos($result, 'ERRO') !== false) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Erro ao comunicar com o SSW',
                'message' => 'SSW retornou erro na aprovação em massa (SRENV)'
            ]);
            return;
        }
        
        respondJson([
            'success' => true,
            'message' => 'Aprovação em massa enviada com sucesso ao SSW'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Erro ao aprovar despesas',
            'message' => $e->getMessage()
        ]);
    }
}

// ================================================================
// FUNÇÃO: LER OBSERVAÇÃO (DO SSW)
// ================================================================
function lerObservacao($userData, $g_sql) {
    try {
        $seq = $_GET['seq_parcela'] ?? $_GET['seq_lancamento'] ?? '';
        
        if (empty($seq)) {
            http_response_code(400);
            echo json_encode(['error' => 'seq_parcela ou seq_lancamento é obrigatório']);
            return;
        }
        
        // 1. Reconsulta as despesas com base nos filtros informados na tela
        if (session_status() === PHP_SESSION_NONE) session_start();
        $last_pes_params = $_SESSION['ssw_last_pes_params'] ?? "act=PES";
        ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $last_pes_params);
        
        // 2. Efetua a busca da observação cadastrada (act=COM)
        $params_com = "act=COM&seq_desp_parcela=" . urlencode($seq);
        $html = ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_com);
        
        // ✅ PARSEAR HTML: Procurar input com id="-3" e extrair seu value
        preg_match('/id=[\"|\']?-3[\"|\']?[^>]*value=[\"|\']?([^\"|\'>]*)[\"|\']?/i', $html, $matches);
        
        $observacao = isset($matches[1]) ? trim($matches[1]) : '';
        
        respondJson([
            'success' => true,
            'observacao' => $observacao
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Erro ao ler observação no SSW',
            'message' => $e->getMessage()
        ]);
    }
}

// ================================================================
// FUNÇÃO: SALVAR OBSERVAÇÃO
// ================================================================
function salvarObservacao($userData, $g_sql) {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        
        // Aceitar seq_parcela ou seq_lancamento (termo do SSW vs termo do sistema)
        $seq = $body['seq_parcela'] ?? $body['seq_lancamento'] ?? '';
        
        if (empty($seq)) {
            http_response_code(400);
            echo json_encode(['error' => 'seq_parcela ou seq_lancamento é obrigatório']);
            return;
        }
        
        $obs = $body['observacao'] ?? '';
        $seq_parcelas = $body['seq_parcelas'] ?? [$seq]; // Array de todas as despesas que estão marcadas na tela
        
        if (session_status() === PHP_SESSION_NONE) session_start();
        
        // 1. Reconsulta as despesas com base nos filtros informados na tela
        $last_pes_params = $_SESSION['ssw_last_pes_params'] ?? "act=PES";
        ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $last_pes_params);
        
        // 2. Efetua a busca da observação cadastrada (se houve)
        $params_com = "act=COM&seq_desp_parcela=" . urlencode($seq);
        ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_com);
        
        // 3. Grava a nova observação
        $params_inc = "act=INC&seq_desp_parcela=" . urlencode($seq) . "&comentario1=" . urlencode($obs) . "&comentario2=";
        ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_inc);
        
        // 4. Salva todas as alterações (SRENV|id1|id2...)
        // O disparo deve ser RIGOROSAMENTE igual ao de aprovação em massa
        $act_ssw = "SRENV|" . implode('|', $seq_parcelas);
        $params_final = "act=" . $act_ssw; // Manter pipes literais conforme exemplo
        $result = ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_final);
        
        if (strpos($result, 'erro') !== false || strpos($result, 'ERRO') !== false) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Erro ao salvar observação no SSW',
                'message' => 'SSW retornou erro na gravação final'
            ]);
            return;
        }
        
        respondJson([
            'success' => true,
            'message' => 'Observação gravada com sucesso no SSW'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Erro interno ao salvar observação',
            'message' => $e->getMessage()
        ]);
    }
}

// ================================================================
// FUNÇÃO: REMOVER APROVAÇÃO (ESTORNO)
// ================================================================
function removerAprovacao($userData, $g_sql) {
    try {
        $body = json_decode(file_get_contents('php://input'), true);
        
        $seq_parcela = $body['seq_parcela'] ?? $body['seq_lancamento'] ?? '';
        
        if (empty($seq_parcela)) {
            http_response_code(400);
            echo json_encode(['error' => 'seq_parcela ou seq_lancamento é obrigatório']);
            return;
        }
        $observacao = $body['observacao'] ?? ''; // Motivo do estorno
        $seq_parcelas = $body['seq_parcelas'] ?? []; // Array de despesas marcadas (excluindo a que estamos removendo agora)
        
        if (session_status() === PHP_SESSION_NONE) session_start();
        
        // 1. Reconsulta as despesas com base nos filtros informados na tela
        $last_pes_params = $_SESSION['ssw_last_pes_params'] ?? "act=PES";
        ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $last_pes_params);
        
        // 2. Efetua a busca da observação cadastrada (act=COM)
        $params_com = "act=COM&seq_desp_parcela=" . urlencode($seq_parcela);
        ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_com);
        
        // 3. Chamada act=EXC para desmarcar o registro específico
        $params_exc = "act=EXC&seq_desp_parcela=" . urlencode($seq_parcela);
        ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_exc);
        
        // 4. Grava a nova observação (motivo do estorno)
        $params_inc = "act=INC&seq_desp_parcela=" . urlencode($seq_parcela) . "&comentario1=" . urlencode($observacao) . "&comentario2=";
        ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_inc);
        
        // 5. Chamada act=SRENV para efetivar o estorno
        // Deve conter a lista de despesas que permaneceram marcadas
        $act_ssw = "SRENV";
        if (!empty($seq_parcelas)) {
            $act_ssw .= "|" . implode('|', $seq_parcelas);
        }
        $params_final = "act=" . $act_ssw; // Manter pipes literais
        $result = ssw_go('https://sistema.ssw.inf.br/bin/ssw1196?' . $params_final);
        
        // Verificar se houve erro no retorno final
        if (strpos($result, 'erro') !== false || strpos($result, 'ERRO') !== false) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Erro ao remover aprovação',
                'message' => 'SSW retornou erro no estorno final'
            ]);
            return;
        }
        
        respondJson([
            'success' => true,
            'message' => 'Aprovação removida com sucesso no SSW'
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'error' => 'Erro ao remover aprovação',
            'message' => $e->getMessage()
        ]);
    }
}

// ================================================================
// FUNÇÃO: PARSEAR XML DE DESPESAS
// ================================================================
function parsearXMLDespesas($html) {
    $despesas = [];
    
    // Extrair conteúdo da tag <xml id="xmlsr">
    preg_match('/<xml id=\"xmlsr\">(.*?)<\/xml>/s', $html, $matches);
    
    if (!isset($matches[1])) {
        return $despesas;
    }
    
    $xmlContent = '<?xml version="1.0" encoding="UTF-8"?><xml>' . $matches[1] . '</xml>';
    
    // Parsear XML
    try {
        $xml = simplexml_load_string($xmlContent);
        
        if (!$xml || !isset($xml->rs) || !isset($xml->rs->r)) {
            return $despesas;
        }
        
        foreach ($xml->rs->r as $r) {
            // Verificar se está aprovada (atributo ckd="1")
            $aprovada = (string)$r['ckd'] === '1';
            
            // Extrair seq_parcela do campo f22
            $seq_lancamento = (string)$r->f22;
            
            // Extrair número do lançamento do f0 (remover HTML)
            $f0_raw = (string)$r->f0;
            preg_match('/(\d{6}-\d{2})/', $f0_raw, $lancamento_match);
            $lancamento = isset($lancamento_match[1]) ? $lancamento_match[1] : '';
            
            // Converter data de DD/MM/AA para YYYY-MM-DD
            $data_inclusao = converterDataDeSSW((string)$r->f2);
            $data_vencimento = converterDataDeSSW((string)$r->f6, true);
            $data_pagamento = converterDataDeSSW((string)$r->f7, true);
            
            // Montar objeto da despesa
            $despesa = [
                'seq_lancamento' => intval($seq_lancamento),
                'lancamento' => $lancamento,
                'unidade' => trim((string)$r->f1),
                'data_inclusao' => $data_inclusao,
                'usuario_lancamento' => trim((string)$r->f3),
                'fornecedor' => trim((string)$r->f4),
                'descricao' => trim((string)$r->f5),
                'data_vencimento' => $data_vencimento,
                'data_pagamento' => $data_pagamento,
                'data' => $data_pagamento, // ✅ ALIAS para compatibilidade com frontend
                'competencia' => trim((string)$r->f8),
                'evento' => trim((string)$r->f9),
                'evento_descricao' => trim((string)$r->f10),
                'boleto' => trim((string)$r->f11),
                'orcamento' => floatval(str_replace(',', '.', str_replace('.', '', (string)$r->f12))),
                'comprometido' => floatval(str_replace(',', '.', str_replace('.', '', (string)$r->f13))),
                'saldo' => floatval(str_replace(',', '.', str_replace('.', '', (string)$r->f14))),
                'valor_parcela' => floatval(str_replace(',', '.', str_replace('.', '', (string)$r->f15))),
                'juros' => floatval(str_replace(',', '.', str_replace('.', '', (string)$r->f16))),
                'desconto' => floatval(str_replace(',', '.', str_replace('.', '', (string)$r->f17))),
                'valor_final' => floatval(str_replace(',', '.', str_replace('.', '', (string)$r->f18))),
                'valor' => floatval(str_replace(',', '.', str_replace('.', '', (string)$r->f18))), // ✅ ALIAS para compatibilidade
                'repasse' => trim((string)$r->f19),
                'observacao' => '', // ✅ Campo adicional para compatibilidade
                'tipo_lancamento' => 'DESPESA', // ✅ Campo fixo
                'aprovada' => $aprovada
            ];
            
            $despesas[] = $despesa;
        }
    } catch (Exception $e) {
        error_log('Erro ao parsear XML: ' . $e->getMessage());
        return $despesas;
    }
    
    return $despesas;
}

// ================================================================
// FUNÇÃO: CONVERTER DATA DE YYYY-MM-DD PARA DDMMAA
// ================================================================
function converterDataParaSSW($data) {
    // Entrada: 2026-02-27
    // Saída: 270226
    if (empty($data)) return '';
    
    $dt = DateTime::createFromFormat('Y-m-d', $data);
    if (!$dt) return '';
    
    return $dt->format('dmy');
}

// ================================================================
// FUNÇÃO: CONVERTER DATA DE DD/MM/AA ou DD/MM/AA HH:MM PARA YYYY-MM-DD
// ================================================================
function converterDataDeSSW($data, $apenasData = false) {
    // Entrada: 23/02/26 16:59 ou 28/02/26
    // Saída: 2026-02-23
    if (empty($data)) return '';
    
    // Remover hora se houver
    $partes = explode(' ', trim($data));
    $data_parte = $partes[0];
    
    // Parsear DD/MM/AA
    $dt_partes = explode('/', $data_parte);
    if (count($dt_partes) !== 3) return '';
    
    $dia = str_pad($dt_partes[0], 2, '0', STR_PAD_LEFT);
    $mes = str_pad($dt_partes[1], 2, '0', STR_PAD_LEFT);
    $ano = $dt_partes[2];
    
    // Converter ano de 2 dígitos para 4 dígitos
    if (strlen($ano) === 2) {
        $ano = '20' . $ano;
    }
    
    return $ano . '-' . $mes . '-' . $dia;
}
?>