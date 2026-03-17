<?php
/**
 * API de Acesso do Fornecedor para Cotação (PÚBLICO - SEM AUTH)
 * 
 * GET  /api/compras/cotacao_fornecedor.php?codigo=XXXXX
 *      - Valida código e retorna dados do orçamento e itens
 * 
 * PUT  /api/compras/cotacao_fornecedor.php
 *      - Atualiza preços dos itens
 * 
 * POST /api/compras/cotacao_fornecedor.php
 *      - Finaliza cotação e envia notificação ao criador
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/../services/EmailService.php';

// ================================================================
// HEADERS CORS (OBRIGATÓRIO)
// ================================================================
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, POST, OPTIONS');
header('Access-Control-Allow-Headers: *');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

try {
    // ===================================================================
    // GET - Validar código e buscar dados do orçamento
    // ===================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        if (!isset($_GET['codigo'])) {
            returnError('Código de acesso não informado');
        }
        
        $codigo = strtoupper(trim($_GET['codigo']));
        
        // Extrair domínio do código (formato: DOMINIO-CODIGO)
        $parts = explode('-', $codigo);
        if (count($parts) !== 2) {
            returnError('Formato de código inválido. Use: DOMINIO-CODIGO', 400);
        }
        
        $domain_codigo = strtoupper($parts[0]);
        $codigo_completo = $codigo;
        
        // Validar se o domínio existe na tabela domains
        $query_domain = "SELECT domain FROM domains WHERE UPPER(domain) = $1 AND is_active = TRUE";
        $result_domain = sql($query_domain, [$domain_codigo]);
        
        if (pg_num_rows($result_domain) === 0) {
            returnError('Domínio inválido no código de acesso', 400);
        }
        
        $domain_row = pg_fetch_assoc($result_domain);
        $domain_encontrado = $domain_row['domain'];
        
        // Buscar orçamento no domínio específico
        $query = "SELECT 
                    of.seq_orcamento_fornecedor,
                    of.seq_orcamento,
                    of.seq_fornecedor,
                    of.data_solicitacao,
                    of.status AS status_fornecedor,
                    of.condicao_pgto,
                    of.data_prev_ent,
                    o.nro_orcamento,
                    o.unidade,
                    o.observacao,
                    f.nome as fornecedor_nome,
                    d.name as nome_empresa
                  FROM {$domain_encontrado}_orcamento_fornecedor of
                  INNER JOIN {$domain_encontrado}_orcamento o ON o.seq_orcamento = of.seq_orcamento
                  INNER JOIN {$domain_encontrado}_fornecedor f ON f.seq_fornecedor = of.seq_fornecedor
                  INNER JOIN domains d ON LOWER(d.domain) = LOWER($2)
                  WHERE of.codigo_acesso = $1
                  AND o.status = 'PENDENTE'";
        
        $result = sql($query, [$codigo_completo, $domain_encontrado]);
        
        if (pg_num_rows($result) === 0) {
            returnError('Código de acesso inválido ou orçamento não encontrado', 404);
        }
        
        $orcamento_data = pg_fetch_assoc($result);
        
        // Verificar validade (data_solicitacao + 7 dias)
        if ($orcamento_data['data_solicitacao']) {
            $expiracao = strtotime($orcamento_data['data_solicitacao'] . ' +7 days');
            if ($expiracao < time()) {
                returnError('Código de acesso expirado', 403);
            }
            $data_expiracao_formatada = date('Y-m-d', $expiracao);
        } else {
            $data_expiracao_formatada = null;
        }
        
        // ✅ REMOVIDO: Não bloquear acesso se já finalizado
        // Fornecedor pode atualizar preços mesmo após finalização
        
        $seq_orcamento = $orcamento_data['seq_orcamento'];
        $seq_fornecedor = $orcamento_data['seq_fornecedor'];
        
        // Buscar itens do orçamento com preços já informados (se houver)
        $query = "SELECT 
                    oci.seq_ordem_compra_item,
                    oci.seq_item,
                    i.codigo,
                    i.descricao,
                    um.sigla as unidade_medida,
                    oci.qtde_item,
                    oc.seq_ordem_compra,
                    oc.nro_ordem_compra,
                    oc.unidade as unidade_ordem,
                    cc.nro_centro_custo,
                    cc.descricao as centro_custo_descricao,
                    cot.vlr_fornecedor,
                    cot.seq_orcamento_cotacao
                  FROM {$domain_encontrado}_orcamento_ordem_compra oo
                  INNER JOIN {$domain_encontrado}_ordem_compra oc ON oc.seq_ordem_compra = oo.seq_ordem_compra
                  INNER JOIN {$domain_encontrado}_ordem_compra_item oci ON oci.seq_ordem_compra = oc.seq_ordem_compra
                  INNER JOIN {$domain_encontrado}_item i ON i.seq_item = oci.seq_item
                  LEFT JOIN {$domain_encontrado}_unidade_medida um ON um.seq_unidade_medida = i.seq_unidade_medida
                  LEFT JOIN {$domain_encontrado}_centro_custo cc ON cc.seq_centro_custo = oc.seq_centro_custo
                  LEFT JOIN {$domain_encontrado}_orcamento_cotacao cot 
                    ON cot.seq_orcamento = oo.seq_orcamento 
                    AND cot.seq_ordem_compra = oc.seq_ordem_compra
                    AND cot.seq_item = oci.seq_item
                    AND cot.seq_fornecedor = $2
                  WHERE oo.seq_orcamento = $1
                  ORDER BY oc.nro_ordem_compra, i.codigo";
        
        $itens = sql($query, [$seq_orcamento, $seq_fornecedor]);
        
        // Converter result para array
        $itens_array = [];
        while ($row = pg_fetch_assoc($itens)) {
            $itens_array[] = $row;
        }
        
        returnSuccess([
            'codigo' => $codigo,
            'domain' => $domain_encontrado,
            'nro_orcamento' => $orcamento_data['nro_orcamento'],
            'unidade' => $orcamento_data['unidade'],
            'fornecedor' => $orcamento_data['fornecedor_nome'],
            'observacao' => $orcamento_data['observacao'],
            'validade' => $data_expiracao_formatada,
            'status_fornecedor' => $orcamento_data['status_fornecedor'], // ✅ Retornar status
            'condicao_pgto' => $orcamento_data['condicao_pgto'], // ✅ NOVO
            'data_prev_ent' => $orcamento_data['data_prev_ent'], // ✅ NOVO
            'itens' => $itens_array,
            'seq_orcamento_fornecedor' => $orcamento_data['seq_orcamento_fornecedor'],
            'nome_empresa' => $orcamento_data['nome_empresa']
        ]);
    }
    
    // ===================================================================
    // PUT - Atualizar preços dos itens
    // ===================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($input['codigo']) || !isset($input['precos'])) {
            returnError('Dados incompletos. Informe codigo e precos');
        }
        
        $codigo = strtoupper(trim($input['codigo']));
        $precos = $input['precos'];
        
        // Extrair domínio do código (formato: DOMINIO-CODIGO)
        $parts = explode('-', $codigo);
        if (count($parts) !== 2) {
            returnError('Formato de código inválido. Use: DOMINIO-CODIGO', 400);
        }
        
        $domain_codigo = strtoupper($parts[0]);
        
        // Validar se o domínio existe na tabela domains
        $query_domain = "SELECT domain FROM domains WHERE UPPER(domain) = $1 AND is_active = TRUE";
        $result_domain = sql($query_domain, [$domain_codigo]);
        
        if (pg_num_rows($result_domain) === 0) {
            returnError('Domínio inválido no código de acesso', 400);
        }
        
        // Usar o domínio em lowercase para as tabelas
        $domain_encontrado = strtolower($domain_codigo);
        
        // Validar código
        $query = "SELECT 
                    of.seq_orcamento_fornecedor,
                    of.seq_orcamento,
                    of.seq_fornecedor,
                    of.data_solicitacao,
                    of.status AS status_fornecedor,
                    o.nro_orcamento
                  FROM {$domain_encontrado}_orcamento_fornecedor of
                  INNER JOIN {$domain_encontrado}_orcamento o ON o.seq_orcamento = of.seq_orcamento
                  WHERE of.codigo_acesso = $1
                  AND o.status = 'PENDENTE'";
        
        $result = sql($query, [$codigo]);
        
        if (pg_num_rows($result) === 0) {
            returnError('Código de acesso inválido', 404);
        }
        
        $orcamento_data = pg_fetch_assoc($result);
        
        // Verificar validade
        if ($orcamento_data['data_solicitacao']) {
            $expiracao = strtotime($orcamento_data['data_solicitacao'] . ' +7 days');
            if ($expiracao < time()) {
                returnError('Código de acesso expirado', 403);
            }
        }
        
        // ✅ REMOVIDO: Não bloquear acesso se já finalizado
        // Fornecedor pode atualizar preços mesmo após finalização
        
        $seq_orcamento = $orcamento_data['seq_orcamento'];
        $seq_fornecedor = $orcamento_data['seq_fornecedor'];
        
        // Atualizar ou inserir preços
        $contador_inseridos = 0;
        $contador_atualizados = 0;
        
        foreach ($precos as $preco) {
            $seq_ordem_compra_item = (int) $preco['seq_ordem_compra_item'];
            $vlr_fornecedor = (float) $preco['vlr_fornecedor'];
            
            // Buscar dados do item
            $query_item = "SELECT 
                            oci.seq_item,
                            oci.seq_ordem_compra,
                            oci.qtde_item,
                            i.vlr_item as vlr_estoque
                          FROM {$domain_encontrado}_ordem_compra_item oci
                          INNER JOIN {$domain_encontrado}_item i ON oci.seq_item = i.seq_item
                          WHERE oci.seq_ordem_compra_item = $1";
            
            $result_item = sql($query_item, [$seq_ordem_compra_item]);
            
            if (pg_num_rows($result_item) === 0) {
                continue;
            }
            
            $item_data = pg_fetch_assoc($result_item);
            $seq_item = $item_data['seq_item'];
            $seq_ordem_compra = $item_data['seq_ordem_compra'];
            $qtde_item = $item_data['qtde_item'];
            $vlr_estoque = $item_data['vlr_estoque'] ?? 0;
            $vlr_total = $vlr_fornecedor * $qtde_item;
            
            // Verificar se já existe cotação
            $query = "SELECT seq_orcamento_cotacao 
                      FROM {$domain_encontrado}_orcamento_cotacao 
                      WHERE seq_orcamento = $1 
                      AND seq_fornecedor = $2 
                      AND seq_ordem_compra = $3
                      AND seq_item = $4";
            
            $result = sql($query, [$seq_orcamento, $seq_fornecedor, $seq_ordem_compra, $seq_item]);
            
            if (pg_num_rows($result) > 0) {
                // UPDATE
                $row_cotacao = pg_fetch_assoc($result);
                $seq_orcamento_cotacao = $row_cotacao['seq_orcamento_cotacao'];
                $query = "UPDATE {$domain_encontrado}_orcamento_cotacao 
                          SET vlr_fornecedor = $1,
                              vlr_total = $2
                          WHERE seq_orcamento_cotacao = $3";
                
                sql($query, [$vlr_fornecedor, $vlr_total, $seq_orcamento_cotacao]);
                $contador_atualizados++;
            } else {
                // INSERT
                $query = "INSERT INTO {$domain_encontrado}_orcamento_cotacao 
                          (seq_orcamento, seq_fornecedor, seq_ordem_compra, seq_item, 
                           qtde_item, vlr_estoque, vlr_fornecedor, vlr_total)
                          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)";
                
                sql($query, [
                    $seq_orcamento, 
                    $seq_fornecedor, 
                    $seq_ordem_compra,
                    $seq_item, 
                    $qtde_item,
                    $vlr_estoque,
                    $vlr_fornecedor, 
                    $vlr_total
                ]);
                $contador_inseridos++;
            }
        }
        
        returnSuccess([
            'inseridos' => $contador_inseridos,
            'atualizados' => $contador_atualizados,
            'message' => 'Preços salvos com sucesso!'
        ]);
    }
    
    // ===================================================================
    // POST - Finalizar cotação e notificar criador
    // ===================================================================
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        error_log("[COTACAO-FINALIZADA] ===== INÍCIO DO POST =====");
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        error_log("[COTACAO-FINALIZADA] Input recebido: " . json_encode($input));
        
        if (!isset($input['codigo'])) {
            returnError('Código de acesso não informado');
        }
        
        // ✅ NOVO: Receber condição de pagamento e previsão de entrega
        $condicao_pgto = isset($input['condicao_pgto']) ? strtoupper(trim($input['condicao_pgto'])) : null;
        $data_prev_ent = isset($input['data_prev_ent']) ? trim($input['data_prev_ent']) : null;
        
        // ✅ VALIDAR campos obrigatórios
        if (empty($condicao_pgto)) {
            returnError('Condição de pagamento não informada');
        }
        
        if (empty($data_prev_ent)) {
            returnError('Previsão de entrega não informada');
        }
        
        $codigo = strtoupper(trim($input['codigo']));
        
        // Extrair domínio do código (formato: DOMINIO-CODIGO)
        $parts = explode('-', $codigo);
        if (count($parts) !== 2) {
            returnError('Formato de código inválido. Use: DOMINIO-CODIGO', 400);
        }
        
        $domain_encontrado = strtolower($parts[0]);
        
        // Validar código
        $query = "SELECT 
                    of.seq_orcamento_fornecedor,
                    of.seq_orcamento,
                    of.seq_fornecedor,
                    of.data_solicitacao,
                    of.status AS status_fornecedor,
                    o.nro_orcamento,
                    o.login_inclusao,
                    f.nome as fornecedor_nome
                  FROM {$domain_encontrado}_orcamento_fornecedor of
                  INNER JOIN {$domain_encontrado}_orcamento o ON o.seq_orcamento = of.seq_orcamento
                  INNER JOIN {$domain_encontrado}_fornecedor f ON f.seq_fornecedor = of.seq_fornecedor
                  WHERE of.codigo_acesso = $1
                  AND o.status = 'PENDENTE'";
        
        $result = sql($query, [$codigo]);
        
        if (pg_num_rows($result) === 0) {
            returnError('Código de acesso inválido', 404);
        }
        
        $orcamento_data = pg_fetch_assoc($result);
        
        // ✅ PERMITIR refinalização (atualização de preços)
        // Se já foi finalizado, atualiza data/hora e reenvia notificação
        $ja_finalizado = ($orcamento_data['status_fornecedor'] === 'CONCLUIDO');
        
        // ✅ ATUALIZADO: Salvar condição de pagamento, previsão de entrega, status e data/hora de retorno
        $query = "UPDATE {$domain_encontrado}_orcamento_fornecedor 
                  SET status = 'CONCLUIDO',
                      data_retorno = CURRENT_DATE,
                      hora_retorno = CURRENT_TIME,
                      condicao_pgto = $2,
                      data_prev_ent = $3
                  WHERE seq_orcamento_fornecedor = $1";
        
        sql($query, [
            $orcamento_data['seq_orcamento_fornecedor'],
            $condicao_pgto,
            $data_prev_ent
        ]);
        
        error_log("[COTACAO-FINALIZADA] Campos salvos: condicao_pgto='{$condicao_pgto}', data_prev_ent='{$data_prev_ent}'");
        
        // Buscar usuário criador
        $query = "SELECT full_name, email, username, domain
                  FROM users 
                  WHERE LOWER(username) = LOWER($1) 
                  AND LOWER(domain) = LOWER($2)";
        $result = sql($query, [$orcamento_data['login_inclusao'], $domain_encontrado]);
        
        error_log("[COTACAO-FINALIZADA] Buscando criador: login='{$orcamento_data['login_inclusao']}', domain='{$domain_encontrado}'");
        error_log("[COTACAO-FINALIZADA] Query executada: " . str_replace(['$1', '$2'], ["'{$orcamento_data['login_inclusao']}'", "'{$domain_encontrado}'"], $query));
        error_log("[COTACAO-FINALIZADA] Resultado query: " . pg_num_rows($result) . " linha(s) encontrada(s)");
        
        if (pg_num_rows($result) > 0) {
            $criador = pg_fetch_assoc($result);
            
            error_log("[COTACAO-FINALIZADA] Criador encontrado: {$criador['full_name']} <{$criador['email']}>");
            error_log("[COTACAO-FINALIZADA] Iniciando envio de email...");
            
            // Enviar notificação
            $emailService = new EmailService();
            
            error_log("[COTACAO-FINALIZADA] Chamando sendNotificacaoCotacaoFinalizada...");
            
            $emailResult = $emailService->sendNotificacaoCotacaoFinalizada(
                $criador['email'],
                $criador['full_name'],
                $orcamento_data['fornecedor_nome'],
                $orcamento_data['nro_orcamento'],
                $domain_encontrado,
                $criador['username']
            );
            
            error_log("[COTACAO-FINALIZADA] Resultado envio: " . json_encode($emailResult));
            
            if (!$emailResult['success']) {
                error_log("[COTACAO-FINALIZADA] Erro ao enviar notificação: " . $emailResult['message']);
            } else {
                error_log("[COTACAO-FINALIZADA] Email enviado com sucesso!");
            }
        } else {
            error_log("[COTACAO-FINALIZADA] ATENÇÃO: Criador NÃO encontrado no banco de dados!");
        }
        
        returnSuccess([
            'message' => 'Cotação finalizada com sucesso! O criador do orçamento foi notificado.'
        ]);
    }
    
    returnError('Método não permitido', 405);
    
} catch (Exception $e) {
    error_log("[COTACAO-FORNECEDOR] Erro: " . $e->getMessage());
    returnError('Erro ao processar solicitação: ' . $e->getMessage(), 500);
}