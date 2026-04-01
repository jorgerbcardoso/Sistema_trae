<?php
/**
 * API COMPRAS - CRUD DE ORDENS DE COMPRA
 * Gerencia cadastro de ordens de compra e seus itens
 */

require_once '/var/www/html/sistema/api/config.php';
require_once '/var/www/html/sistema/api/estoque_compras_helper.php';

// ✅ CORS
setupCORS();
handleOptionsRequest();

requireAuth();
$currentUser = getCurrentUser();

$domain = $currentUser['domain'] ?? 'acv';
$login = $currentUser['username'] ?? 'SISTEMA';
$unidadeAtual = $currentUser['unidade_atual'] ?? $currentUser['unidade'] ?? '';

// ✅ DEBUG: Logar dados do usuário
error_log("=== ORDENS DE COMPRA - DEBUG ===");
error_log("Domain: " . $domain);
error_log("Login: " . $login);
error_log("Unidade cadastrada: " . ($currentUser['unidade'] ?? 'VAZIO'));
error_log("Unidade atual (header): " . ($currentUser['unidade_atual'] ?? 'VAZIO'));
error_log("Unidade efetiva (usada): " . $unidadeAtual);

// ✅ PADRÃO OFICIAL: Prefixo é o domínio em minúsculas
$prefix = strtolower($domain) . '_';
$tblOrdemCompra = $prefix . 'ordem_compra';
$tblOrdemCompraItem = $prefix . 'ordem_compra_item';
$tblCentroCusto = $prefix . 'centro_custo';
$tblItem = $prefix . 'item';
$tblUnidadeMedida = $prefix . 'unidade_medida';
$tblSetores = $prefix . 'setores';
$tblPedido = $prefix . 'pedido'; // ✅ NOVO: Tabela de pedidos

// ✅ VERIFICAR SE É MTZ OU ALL (ambos veem tudo)
$unidadeAtualUpper = strtoupper($unidadeAtual);
$isMTZ = ($unidadeAtualUpper === 'MTZ' || $unidadeAtualUpper === 'ALL');

error_log("É MTZ/ALL (vê tudo)? " . ($isMTZ ? 'SIM' : 'NÃO'));
error_log("=================================");

// ✅ Conectar ao banco
$g_sql = connect();

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);
    
    switch ($method) {
        case 'GET':
            // LISTAR, BUSCAR POR ID ou BUSCAR ITENS DE UMA ORDEM
            if (isset($_GET['seq_ordem_compra']) && isset($_GET['action']) && $_GET['action'] === 'itens') {
                // Buscar itens de uma ordem específica
                $seqOrdem = intval($_GET['seq_ordem_compra']);
                
                $query = "
                    SELECT 
                        oci.seq_ordem_compra_item,
                        oci.seq_ordem_compra,
                        oci.seq_item,
                        oci.qtde_item,
                        i.codigo,
                        i.descricao,
                        um.sigla AS unidade_medida_sigla
                    FROM $tblOrdemCompraItem oci
                    INNER JOIN $tblItem i ON i.seq_item = oci.seq_item
                    LEFT JOIN $tblUnidadeMedida um ON um.seq_unidade_medida = i.seq_unidade_medida
                    WHERE oci.seq_ordem_compra = $1
                    ORDER BY oci.seq_ordem_compra_item
                ";
                
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql($query, [$seqOrdem], $g_sql);
                $itens = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    $itens[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $itens]);
                
            } elseif (isset($_GET['seq_ordem_compra'])) {
                // Buscar ordem específica
                $seq = intval($_GET['seq_ordem_compra']);
                
                $query = "
                    SELECT 
                        oc.*,
                        oc.unidade||TRIM(TO_CHAR(CAST(cc.nro_centro_custo AS INT), '000000')) AS nro_centro_custo,
                        cc.descricao AS centro_custo_descricao,
                        cc.unidade AS centro_custo_unidade,
                        oc.nro_setor,
                        s.descricao AS setor_descricao,
                        p.unidade||TRIM(TO_CHAR(CAST(p.nro_pedido AS INT), '000000')) AS nro_pedido_formatado, -- ✅ NOVO: Número do pedido vinculado
                        (SELECT COUNT(*) FROM $tblOrdemCompraItem WHERE seq_ordem_compra = oc.seq_ordem_compra) AS qtd_itens
                    FROM $tblOrdemCompra oc
                    LEFT JOIN $tblCentroCusto cc ON cc.seq_centro_custo = oc.seq_centro_custo
                    LEFT JOIN $tblSetores s ON s.nro_setor = oc.nro_setor
                    LEFT JOIN $tblPedido p ON p.seq_pedido = oc.seq_pedido -- ✅ NOVO: Join com pedidos
                    WHERE oc.seq_ordem_compra = $1
                ";
                
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql($query, [$seq], $g_sql);
                
                if (pg_num_rows($result) > 0) {
                    echo json_encode(['success' => true, 'data' => pg_fetch_assoc($result)]);
                } else {
                    msg('ORDEM DE COMPRA NÃO ENCONTRADA', 'error', 404);
                }
            } else {
                // Listar todas (com filtros opcionais)
                $where = ['1=1'];
                $params = [];
                $paramCount = 1;
                
                // ✅ FILTRO POR UNIDADE (do centro de custo, não da ordem)
                if (isset($_GET['unidade']) && !empty($_GET['unidade'])) {
                    $unidadeFiltro = strtoupper($_GET['unidade']);
                    
                    // ✅ Validar: não-MTZ só pode filtrar pela própria unidade
                    if (!$isMTZ && $unidadeFiltro !== strtoupper($unidadeAtual)) {
                        msg('VOCÊ NÃO TEM PERMISSÃO PARA VISUALIZAR ORDENS DE COMPRA DE OUTRAS UNIDADES', 'error', 403);
                    }
                    
                    $where[] = "cc.unidade = $" . $paramCount++;
                    $params[] = $unidadeFiltro;
                } elseif (!$isMTZ && !empty($unidadeAtual)) {
                    // ✅ CRÍTICO: Se não passou filtro e não é MTZ, filtrar automaticamente pela unidade do header
                    $where[] = "cc.unidade = $" . $paramCount++;
                    $params[] = strtoupper($unidadeAtual);
                }
                
                // Filtro por aprovação
                if (isset($_GET['aprovada'])) {
                    $where[] = "oc.aprovada = $" . $paramCount++;
                    $params[] = $_GET['aprovada'];
                }
                
                // Filtro por orçamento
                if (isset($_GET['orcar'])) {
                    $where[] = "oc.orcar = $" . $paramCount++;
                    $params[] = $_GET['orcar'];
                }
                
                // ✅ VERIFICAR SE DEVE TRAZER ITENS (quando filtrar por aprovada=S e orcar=N)
                $incluirItens = (isset($_GET['aprovada']) && $_GET['aprovada'] === 'S' && 
                                isset($_GET['orcar']) && $_GET['orcar'] === 'N');
                
                // ✅ FILTRO PARA ORDENS DISPONÍVEIS (não vinculadas a pedido)
                if ($incluirItens) {
                    $where[] = "COALESCE(oc.seq_pedido, 0) = 0";
                }
                
                $whereClause = implode(' AND ', $where);
                
                $query = "
                    SELECT 
                        oc.seq_ordem_compra,
                        oc.unidade,
                        oc.nro_ordem_compra,
                        oc.seq_centro_custo,
                        oc.aprovada,
                        oc.orcar,
                        oc.seq_pedido, -- ✅ NOVO: Retornar seq_pedido na listagem
                        p.unidade||TRIM(TO_CHAR(CAST(p.nro_pedido AS INT), '000000')) AS nro_pedido_formatado, -- ✅ NOVO: Número do pedido vinculado
                        oc.observacao,
                        oc.placa,
                        oc.data_inclusao,
                        oc.hora_inclusao,
                        oc.login_inclusao,
                        oc.data_aprovacao,
                        oc.hora_aprovacao,
                        oc.login_aprovacao,
                        oc.motivo_reprovacao,
                        cc.nro_centro_custo,
                        cc.descricao AS centro_custo_descricao,
                        cc.unidade AS centro_custo_unidade,
                        oc.nro_setor,
                        s.descricao AS setor_descricao,
                        (SELECT COUNT(*) FROM $tblOrdemCompraItem WHERE seq_ordem_compra = oc.seq_ordem_compra) AS qtd_itens
                    FROM $tblOrdemCompra oc
                    LEFT JOIN $tblCentroCusto cc ON cc.seq_centro_custo = oc.seq_centro_custo
                    LEFT JOIN $tblSetores s ON s.nro_setor = oc.nro_setor
                    LEFT JOIN $tblPedido p ON p.seq_pedido = oc.seq_pedido -- ✅ NOVO: Join com pedidos
                    WHERE $whereClause
                    ORDER BY oc.data_inclusao DESC, oc.hora_inclusao DESC
                ";
                
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $result = sql($query, $params, $g_sql);
                $ordens = [];
                
                while ($row = pg_fetch_assoc($result)) {
                    // ✅ Se deve incluir itens, buscar os itens de cada ordem
                    if ($incluirItens) {
                        $queryItens = "
                            SELECT 
                                oci.seq_item,
                                oci.qtde_item,
                                i.codigo,
                                i.descricao,
                                i.vlr_item,
                                um.sigla AS unidade_medida
                            FROM $tblOrdemCompraItem oci
                            INNER JOIN $tblItem i ON i.seq_item = oci.seq_item
                            LEFT JOIN $tblUnidadeMedida um ON um.seq_unidade_medida = i.seq_unidade_medida
                            WHERE oci.seq_ordem_compra = $1
                            ORDER BY oci.seq_ordem_compra_item
                        ";
                        
                        $resultItens = sql($queryItens, [$row['seq_ordem_compra']], $g_sql);
                        $itens = [];
                        
                        while ($itemRow = pg_fetch_assoc($resultItens)) {
                            $itens[] = [
                                'seq_item' => (int)$itemRow['seq_item'], // ✅ CORRIGIDO: Agora pega o seq_item correto da tabela item
                                'codigo' => $itemRow['codigo'],
                                'descricao' => $itemRow['descricao'],
                                'unidade_medida' => $itemRow['unidade_medida'],
                                'qtde_item' => (float)$itemRow['qtde_item'],
                                'vlr_item' => (float)($itemRow['vlr_item'] ?? 0), // ✅ Valor cadastrado
                                'vlr_unitario' => 0,
                                'vlr_total' => 0
                            ];
                        }
                        
                        $row['itens'] = $itens;
                    }
                    
                    $ordens[] = $row;
                }
                
                echo json_encode(['success' => true, 'data' => $ordens]);
            }
            break;
            
        case 'POST':
            // CRIAR NOVA ORDEM DE COMPRA
            $unidade = strtoupper(trim($input['unidade'] ?? ''));
            $seq_centro_custo = intval($input['seq_centro_custo'] ?? 0);
            $nro_setor = isset($input['nro_setor']) && $input['nro_setor'] !== '' ? intval($input['nro_setor']) : null;
            $placa = isset($input['placa']) && !empty($input['placa']) ? strtoupper(trim($input['placa'])) : null; // ✅ NOVO
            $observacao = trim($input['observacao'] ?? '');
            $itens = $input['itens'] ?? [];
            
            if (empty($unidade)) {
                msg('UNIDADE É OBRIGATÓRIA', 'error', 400);
            }
            
            if ($seq_centro_custo <= 0) {
                msg('CENTRO DE CUSTO É OBRIGATÓRIO', 'error', 400);
            }
            
            if (empty($itens)) {
                msg('É NECESSÁRIO ADICIONAR PELO MENOS UM ITEM', 'error', 400);
            }
            
            // ✅ VALIDAR PERMISSÃO: usuários não-MTZ só podem criar ordens da sua unidade
            if (!$isMTZ && strtoupper($unidade) !== strtoupper($unidadeAtual)) {
                msg('VOCÊ NÃO TEM PERMISSÃO PARA CRIAR ORDENS DE COMPRA DE OUTRAS UNIDADES', 'error', 403);
            }
            
            // ✅ GERAR NÚMERO DA ORDEM DE COMPRA
            // Formato: Sequencial numérico único para todas as unidades
            $queryNumero = "
                SELECT COALESCE(MAX(
                    CASE 
                        WHEN nro_ordem_compra ~ '^[0-9]+$' THEN CAST(nro_ordem_compra AS INTEGER)
                        ELSE 0
                    END
                ), 0) + 1 AS proximo_numero
                FROM $tblOrdemCompra
                WHERE nro_ordem_compra IS NOT NULL
            ";
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $resultNumero = sql($queryNumero, [], $g_sql);
            $rowNumero = pg_fetch_assoc($resultNumero);
            $nroOrdemCompra = intval($rowNumero['proximo_numero']);
            
            // ✅ GARANTIR que o número não seja 0 ou NULL
            if ($nroOrdemCompra <= 0) {
                $nroOrdemCompra = 1;
            }
            
            // Iniciar transação
            sql("BEGIN", [], $g_sql);
            
            try {
                // ✅ CRÍTICO: Inserir ordem com data_inclusao e hora_inclusao EXPLÍCITOS
                // ✅ CORREÇÃO URGENTE: CURRENT_DATE e CURRENT_TIME no servidor PostgreSQL
                $queryOrdem = "
                    INSERT INTO $tblOrdemCompra 
                    (unidade, nro_ordem_compra, seq_centro_custo, aprovada, orcar, seq_pedido, observacao, login_inclusao, nro_setor, placa, data_inclusao, hora_inclusao) 
                    VALUES ($1, $2, $3, 'N', 'N', 0, $4, $5, $6, $7, CURRENT_DATE, CURRENT_TIME) 
                    RETURNING seq_ordem_compra
                ";
                
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $resultOrdem = sql($queryOrdem, [
                    $unidade,
                    (string)$nroOrdemCompra, // ✅ GARANTIR que seja string não-vazia
                    $seq_centro_custo,
                    strtoupper($observacao),
                    $login,
                    $nro_setor,
                    $placa
                ], $g_sql);
                
                $rowOrdem = pg_fetch_assoc($resultOrdem);
                $seqOrdemCompra = $rowOrdem['seq_ordem_compra'];
                
                // ✅ Inserir itens
                $queryItem = "INSERT INTO $tblOrdemCompraItem (seq_ordem_compra, seq_item, qtde_item) VALUES ($1, $2, $3)";
                
                foreach ($itens as $item) {
                    $seqItem = intval($item['seq_item'] ?? 0);
                    $qtdeItem = floatval($item['qtde_item'] ?? 0);
                    
                    if ($seqItem <= 0 || $qtdeItem <= 0) {
                        throw new Exception('Item ou quantidade inválidos');
                    }
                    
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    sql($queryItem, [$seqOrdemCompra, $seqItem, $qtdeItem], $g_sql);
                }
                
                sql("COMMIT", [], $g_sql);
                
                echo json_encode([
                    'success' => true,
                    'seq_ordem_compra' => $seqOrdemCompra,
                    'nro_ordem_compra' => $nroOrdemCompra
                ]);
                
            } catch (Exception $e) {
                sql("ROLLBACK", [], $g_sql);
                throw $e;
            }
            break;
            
        case 'PUT':
            // ATUALIZAR ORDEM DE COMPRA
            $seq = intval($input['seq_ordem_compra'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID DA ORDEM DE COMPRA INVÁLIDO', 'error', 400);
            }
            
            // ✅ NOVO: DETECTAR SE É APROVAÇÃO/REPROVAÇÃO
            if (isset($input['aprovar']) || isset($input['reprovar'])) {
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                $checkOrdem = sql("SELECT aprovada FROM $tblOrdemCompra WHERE seq_ordem_compra = $1", [$seq], $g_sql);
                if (pg_num_rows($checkOrdem) === 0) {
                    msg('ORDEM DE COMPRA NÃO ENCONTRADA', 'error', 404);
                }
                
                $aprovar = $input['aprovar'] ?? false;
                $reprovar = $input['reprovar'] ?? false;
                $orcar = $input['orcar'] ?? 'N';
                $motivo_reprovacao = isset($input['motivo_reprovacao']) ? strtoupper(trim($input['motivo_reprovacao'])) : '';
                
                if ($aprovar) {
                    $query = "UPDATE $tblOrdemCompra SET aprovada = 'S', orcar = $1, login_aprovacao = $2, data_aprovacao = CURRENT_DATE, hora_aprovacao = CURRENT_TIME WHERE seq_ordem_compra = $3";
                    sql($query, [$orcar, $login, $seq], $g_sql);
                    echo json_encode(['success' => true, 'message' => 'ORDEM DE COMPRA APROVADA COM SUCESSO']);
                } elseif ($reprovar) {
                    $query = "UPDATE $tblOrdemCompra SET aprovada = 'R', motivo_reprovacao = $1, login_aprovacao = $2, data_aprovacao = CURRENT_DATE, hora_aprovacao = CURRENT_TIME WHERE seq_ordem_compra = $3";
                    sql($query, [strtoupper($motivo_reprovacao), $login, $seq], $g_sql);
                    echo json_encode(['success' => true, 'message' => 'ORDEM DE COMPRA REPROVADA']);
                }
                break;
            }
            
            // ✅ VERIFICAR SE ORDEM EXISTE E SE ESTÁ APROVADA
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $checkOrdem = sql("SELECT unidade, aprovada FROM $tblOrdemCompra WHERE seq_ordem_compra = $1", [$seq], $g_sql);
            if (pg_num_rows($checkOrdem) === 0) {
                msg('ORDEM DE COMPRA NÃO ENCONTRADA', 'error', 404);
            }
            $ordemAtual = pg_fetch_assoc($checkOrdem);
            
            // Não permitir editar ordem aprovada
            if ($ordemAtual['aprovada'] === 'S') {
                msg('NÃO É POSSÍVEL EDITAR UMA ORDEM DE COMPRA APROVADA', 'error', 400);
            }
            
            $seq_centro_custo = intval($input['seq_centro_custo'] ?? 0);
            $nro_setor = isset($input['nro_setor']) && $input['nro_setor'] !== '' ? intval($input['nro_setor']) : null; // ✅ NOVO
            $placa = isset($input['placa']) && !empty($input['placa']) ? strtoupper(trim($input['placa'])) : null; // ✅ NOVO
            $observacao = trim($input['observacao'] ?? '');
            $itens = $input['itens'] ?? [];
            
            if ($seq_centro_custo <= 0) {
                msg('CENTRO DE CUSTO É OBRIGATÓRIO', 'error', 400);
            }
            
            if (empty($itens)) {
                msg('É NECESSÁRIO ADICIONAR PELO MENOS UM ITEM', 'error', 400);
            }
            
            // Iniciar transação
            sql("BEGIN", [], $g_sql);
            
            try {
                // ✅ Atualizar ordem
                $queryOrdem = "
                    UPDATE $tblOrdemCompra SET 
                    seq_centro_custo = $1,
                    observacao = $2,
                    nro_setor = $3,
                    placa = $4
                    WHERE seq_ordem_compra = $5
                ";
                
                // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                sql($queryOrdem, [
                    $seq_centro_custo,
                    strtoupper($observacao),
                    $nro_setor,
                    $placa,
                    $seq
                ], $g_sql);
                
                // ✅ Deletar itens antigos
                sql("DELETE FROM $tblOrdemCompraItem WHERE seq_ordem_compra = $1", [$seq], $g_sql);
                
                // ✅ Inserir novos itens
                $queryItem = "INSERT INTO $tblOrdemCompraItem (seq_ordem_compra, seq_item, qtde_item) VALUES ($1, $2, $3)";
                
                foreach ($itens as $item) {
                    $seqItem = intval($item['seq_item'] ?? 0);
                    $qtdeItem = floatval($item['qtde_item'] ?? 0);
                    
                    if ($seqItem <= 0 || $qtdeItem <= 0) {
                        throw new Exception('Item ou quantidade inválidos');
                    }
                    
                    // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
                    sql($queryItem, [$seq, $seqItem, $qtdeItem], $g_sql);
                }
                
                sql("COMMIT", [], $g_sql);
                
                echo json_encode(['success' => true]);
                
            } catch (Exception $e) {
                sql("ROLLBACK", [], $g_sql);
                throw $e;
            }
            break;
            
        case 'DELETE':
            // DELETAR ORDEM DE COMPRA (apenas se não aprovada)
            $seq = intval($input['seq_ordem_compra'] ?? 0);
            
            if ($seq <= 0) {
                msg('ID DA ORDEM DE COMPRA INVÁLIDO', 'error', 400);
            }
            
            // ✅ VERIFICAR SE ORDEM ESTÁ APROVADA
            // ✅ PADRÃO CORRETO: sql($query, $params, $g_sql)
            $checkOrdem = sql("SELECT aprovada FROM $tblOrdemCompra WHERE seq_ordem_compra = $1", [$seq], $g_sql);
            if (pg_num_rows($checkOrdem) === 0) {
                msg('ORDEM DE COMPRA NÃO ENCONTRADA', 'error', 404);
            }
            $ordemAtual = pg_fetch_assoc($checkOrdem);
            
            if ($ordemAtual['aprovada'] === 'S') {
                msg('NÃO É POSSÍVEL EXCLUIR UMA ORDEM DE COMPRA APROVADA', 'error', 400);
            }
            
            // Iniciar transação
            sql("BEGIN", [], $g_sql);
            
            try {
                // Deletar itens
                sql("DELETE FROM $tblOrdemCompraItem WHERE seq_ordem_compra = $1", [$seq], $g_sql);
                
                // Deletar ordem
                sql("DELETE FROM $tblOrdemCompra WHERE seq_ordem_compra = $1", [$seq], $g_sql);
                
                sql("COMMIT", [], $g_sql);
                
                echo json_encode(['success' => true]);
                
            } catch (Exception $e) {
                sql("ROLLBACK", [], $g_sql);
                throw $e;
            }
            break;
            
        default:
            msg('MÉTODO NÃO PERMITIDO', 'error', 405);
    }
    
} catch (Exception $e) {
    error_log("Erro em /api/compras/ordens_compra.php: " . $e->getMessage());
    msg('ERRO AO PROCESSAR REQUISIÇÃO: ' . $e->getMessage(), 'error', 500);
}